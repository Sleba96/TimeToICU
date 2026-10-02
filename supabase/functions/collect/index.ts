// Edge Function: collect one or more sources and ingest each run atomically.
// Invoked by pg_cron (see migration *_schedule.sql) with a shared token held in Supabase Vault.
//
//   POST /functions/v1/collect   { "sources": "ed_waits,rainfall" }   header: x-collector-token
import { COLLECTOR_VERSION, type Fetched, type Hospital, sha256Hex, slotFor, SOURCES } from "./sources.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FETCH_TIMEOUT_MS = 20_000;

const dbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function rpc<T>(fn: string, args: unknown): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: dbHeaders,
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${fn}: HTTP ${r.status} ${await r.text()}`);
  return await r.json() as T;
}

async function loadHospitals(): Promise<Hospital[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/location?kind=eq.hospital&select=code,lat,lon`, { headers: dbHeaders });
  if (!r.ok) throw new Error(`load hospitals: HTTP ${r.status}`);
  return await r.json();
}

// Optional: a data.gov.sg API key raises the anonymous rate limit (set as an Edge Function secret).
const DATA_GOV_SG_API_KEY = Deno.env.get("DATA_GOV_SG_API_KEY");
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

async function get(url: string): Promise<Fetched> {
  const headers: Record<string, string> = { "User-Agent": "sg-queue-monitor collector (open data research)" };
  if (DATA_GOV_SG_API_KEY && new URL(url).hostname.endsWith("data.gov.sg")) headers["x-api-key"] = DATA_GOV_SG_API_KEY;

  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const body = await r.text();
    // data.gov.sg rate-limits anonymous callers with 429; back off and retry a few times.
    if (r.status === 429 && attempt < RETRY_DELAYS_MS.length) {
      const retryAfter = Number(r.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 15_000) : RETRY_DELAYS_MS[attempt];
      await new Promise((resolve) => setTimeout(resolve, wait));
      continue;
    }
    return { status: r.status, body, contentType: r.headers.get("content-type") };
  }
}

async function runSource(id: string, hospitals: Hospital[]) {
  const def = SOURCES[id];
  const startedAt = new Date();
  if (!def) return { source_id: id, error: "unknown source" };

  const base = {
    source_id: id,
    slot_at: slotFor(startedAt, def.cadenceMinutes).toISOString(),
    started_at: startedAt.toISOString(),
    collector_version: COLLECTOR_VERSION,
  };

  let fetched: Fetched | null = null;
  try {
    fetched = await def.fetch(get);
    const fetchedAt = new Date().toISOString();
    const sha256 = await sha256Hex(fetched.body);
    const payload = {
      ...base,
      fetched_at: fetchedAt,
      http_status: fetched.status,
      sha256,
      body: fetched.body,
      bytes: new TextEncoder().encode(fetched.body).length,
      content_type: fetched.contentType,
    };
    if (fetched.status !== 200) {
      return await rpc("ingest_run", { p: { ...payload, status: "error", error: `upstream HTTP ${fetched.status}` } });
    }
    const parsed = def.parse(fetched.body, hospitals);
    return await rpc("ingest_run", {
      p: {
        ...payload,
        status: parsed.issues.length > 0 ? "partial" : "ok",
        observations: parsed.observations,
        locations: parsed.locations,
        holidays: parsed.holidays,
        issues: parsed.issues,
      },
    });
  } catch (e) {
    // Parse or network failure: still log the run, and keep the body if we got one.
    const message = e instanceof Error ? e.message : String(e);
    try {
      const body = fetched?.body;
      return await rpc("ingest_run", {
        p: {
          ...base,
          fetched_at: new Date().toISOString(),
          status: "error",
          error: message.slice(0, 2000),
          http_status: fetched?.status ?? null,
          ...(body !== undefined
            ? { body, sha256: await sha256Hex(body), bytes: new TextEncoder().encode(body).length, content_type: fetched?.contentType }
            : {}),
        },
      });
    } catch (logError) {
      return { source_id: id, error: message, log_error: String(logError) };
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const token = req.headers.get("x-collector-token") ?? "";
  if (!token || !(await rpc<boolean>("collector_token_ok", { t: token }))) {
    return new Response("unauthorized", { status: 401 });
  }

  const { sources } = await req.json().catch(() => ({ sources: "" }));
  const ids = String(sources ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return new Response("no sources", { status: 400 });

  const hospitals = await loadHospitals();
  const results = await Promise.all(ids.map((id) => runSource(id, hospitals)));
  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
});
