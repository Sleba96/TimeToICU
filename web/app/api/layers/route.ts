// Live rain, PM2.5 and dengue clusters for the map layers. Read from data.gov.sg on the server, so the key stays private and the
// dengue file (served without CORS headers) is reachable at all. Nothing is stored. Each layer fails on its own (D-009, D-019).
//
// Upstream calls stay rare on purpose: these figures need minutes, not seconds.
//   1. Per layer, the server keeps the last good value (rain and air 15 min, dengue 1 h) and serves it to every visitor.
//   2. A failed refresh falls back to the last good value instead of showing "unavailable", and a failure is never kept as a result.
//   3. The response is cached by the CDN, so most visits never reach this function.

import { getWithRetry, layer } from "@/lib/upstream";
import { dengueFromGeo, type AirData, type DengueData, type RainData } from "@/lib/layers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DENGUE_DATASET = "d_dbfabf16158d1b0e1c420627c0819168";
const FRESH_MS = { rain: 15 * 60_000, air: 15 * 60_000, dengue: 60 * 60_000 };
const API = "https://api-open.data.gov.sg/v2/real-time/api";

const apiKey = () => {
  const key = process.env.DATA_GOV_SG_API_KEY;
  return key ? { "x-api-key": key } : undefined;
};

// Why a layer last failed, so a missing layer can be explained without server logs.
const why = new Map<string, string>();
const noteFor = (name: string) => (reason: string) => void why.set(name, reason);

async function upstream<T>(name: string, path: string): Promise<T | null> {
  const res = await getWithRetry(`${API}/${path}`, apiKey(), undefined, noteFor(name));
  if (!res) return null;
  try {
    const body = (await res.json()) as { code: number; data: T };
    return body.code === 0 ? body.data : null;
  } catch {
    return null;
  }
}

// Dengue clusters: a GeoJSON file reached through a short-lived signed URL (poll-download), so two calls.
async function dengueFile(): Promise<Parameters<typeof dengueFromGeo>[0] | null> {
  const poll = await getWithRetry(`https://api-open.data.gov.sg/v1/public/api/datasets/${DENGUE_DATASET}/poll-download`, apiKey(), undefined, (r) => why.set("dengue", `poll-download: ${r}`));
  if (!poll) return null;
  try {
    const url = ((await poll.json()) as { data?: { url?: string } }).data?.url;
    if (!url) return null;
    const file = await getWithRetry(url, undefined, undefined, (r) => why.set("dengue", `file: ${r}`));
    return file ? await file.json() : null;
  } catch {
    why.set("dengue", "unreadable response");
    return null;
  }
}

type RainRaw = {
  stations: { id: string; location: { latitude: number; longitude: number } }[];
  readings: { timestamp: string; data: { stationId: string; value: number | null }[] }[];
};
type Pm25Raw = {
  regionMetadata: { name: string; labelLocation: { latitude: number; longitude: number } }[];
  items: { timestamp: string; readings: { pm25_one_hourly: Record<string, number> } }[];
};

async function loadRain(): Promise<RainData | null> {
  const raw = await upstream<RainRaw>("rain", "rainfall");
  const r = raw?.readings?.[0];
  if (!raw || !r) return null;
  const at = new Map(r.data.map((d) => [d.stationId, d.value]));
  const stations = raw.stations.flatMap((s) => {
    const mm = at.get(s.id);
    return typeof mm === "number" ? [{ lat: s.location.latitude, lon: s.location.longitude, mm }] : [];
  });
  return stations.length > 0 ? { at: r.timestamp, stations } : null;
}

async function loadAir(): Promise<AirData | null> {
  const raw = await upstream<Pm25Raw>("air", "pm25");
  const p = raw?.items?.at(-1);
  if (!raw || !p) return null;
  const regions = raw.regionMetadata.flatMap((m) => {
    const v = p.readings.pm25_one_hourly[m.name];
    return typeof v === "number" ? [{ name: m.name, lat: m.labelLocation.latitude, lon: m.labelLocation.longitude, v }] : [];
  });
  return regions.length > 0 ? { at: p.timestamp, regions } : null;
}

async function loadDengue(): Promise<DengueData | null> {
  const file = await dengueFile();
  return file ? dengueFromGeo(file) : null;
}

export async function GET() {
  const [rain, air, dengue] = await Promise.all([layer("rain", FRESH_MS.rain, loadRain), layer("air", FRESH_MS.air, loadAir), layer("dengue", FRESH_MS.dengue, loadDengue)]);
  const complete = rain !== null && air !== null && dengue !== null;
  const found = { rain, air, dengue };
  const issues = Object.fromEntries(Object.entries(found).flatMap(([k, v]) => (v === null ? [[k, why.get(k) ?? "no data"]] : [])));
  if (!complete) console.warn("layers missing", issues);
  return Response.json(
    { ...found, issues },
    {
      headers: {
        // All layers present: the CDN may serve this for 15 min, and a stale copy for up to an hour while it refreshes.
        // A layer missing: keep it for a minute only, so a recovered source shows soon.
        "Cache-Control": complete ? "public, s-maxage=900, stale-while-revalidate=3600" : "public, s-maxage=60",
      },
    },
  );
}
