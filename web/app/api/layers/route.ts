// Live rain and PM2.5 for the map layers. Read from data.gov.sg on the server, so the key stays private. Nothing is stored.
// Each layer fails on its own (D-009, D-019). Dengue has its own, much slower route (api/dengue).
//
// Upstream calls stay rare on purpose: these figures need minutes, not seconds.
//   1. Per layer, the server keeps the last good value (15 min) and serves it to every visitor.
//   2. A failed refresh falls back to the last good value instead of showing "unavailable", and a failure is never kept as a result.
//   3. The response is cached by the CDN, so most visits never reach this function.

import { getWithRetry, layer } from "@/lib/upstream";
import type { AirData, RainData } from "@/lib/layers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FRESH_MS = { rain: 15 * 60_000, air: 15 * 60_000 };
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

export async function GET() {
  const [rain, air] = await Promise.all([layer("rain", FRESH_MS.rain, loadRain), layer("air", FRESH_MS.air, loadAir)]);
  const complete = rain !== null && air !== null;
  const found = { rain, air };
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
