// Live rain, PM2.5 and dengue clusters for the map layers. Read from data.gov.sg on the server and cached, so visitors never hit
// the upstream rate limit directly (D-009). Nothing is stored. Each layer fails on its own.

export const revalidate = 300;

import { dengueFromGeo } from "@/lib/layers";

const DENGUE_DATASET = "d_dbfabf16158d1b0e1c420627c0819168";
const API = "https://api-open.data.gov.sg/v2/real-time/api";

async function upstream<T>(path: string): Promise<T | null> {
  try {
    const key = process.env.DATA_GOV_SG_API_KEY;
    const res = await fetch(`${API}/${path}`, {
      headers: key ? { "x-api-key": key } : undefined,
      next: { revalidate },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { code: number; data: T };
    return body.code === 0 ? body.data : null;
  } catch {
    return null;
  }
}

// Dengue clusters: a GeoJSON file reached through a short-lived signed URL (poll-download).
async function dengueFile(): Promise<Parameters<typeof dengueFromGeo>[0] | null> {
  try {
    const key = process.env.DATA_GOV_SG_API_KEY;
    const poll = await fetch(`https://api-open.data.gov.sg/v1/public/api/datasets/${DENGUE_DATASET}/poll-download`, {
      headers: key ? { "x-api-key": key } : undefined,
      next: { revalidate },
      signal: AbortSignal.timeout(10_000),
    });
    if (!poll.ok) return null;
    const url = ((await poll.json()) as { data?: { url?: string } }).data?.url;
    if (!url) return null;
    const file = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(10_000) });
    return file.ok ? await file.json() : null;
  } catch {
    return null;
  }
}

type RainData = {
  stations: { id: string; location: { latitude: number; longitude: number } }[];
  readings: { timestamp: string; data: { stationId: string; value: number | null }[] }[];
};
type Pm25Data = {
  regionMetadata: { name: string; labelLocation: { latitude: number; longitude: number } }[];
  items: { timestamp: string; readings: { pm25_one_hourly: Record<string, number> } }[];
};

export async function GET() {
  const [rainRaw, pmRaw, dengueRaw] = await Promise.all([upstream<RainData>("rainfall"), upstream<Pm25Data>("pm25"), dengueFile()]);

  let rain = null;
  const r = rainRaw?.readings?.[0];
  if (rainRaw && r) {
    const at = new Map(r.data.map((d) => [d.stationId, d.value]));
    const stations = rainRaw.stations.flatMap((s) => {
      const mm = at.get(s.id);
      return typeof mm === "number" ? [{ lat: s.location.latitude, lon: s.location.longitude, mm }] : [];
    });
    if (stations.length > 0) rain = { at: r.timestamp, stations };
  }

  let air = null;
  const p = pmRaw?.items?.at(-1);
  if (pmRaw && p) {
    const regions = pmRaw.regionMetadata.flatMap((m) => {
      const v = p.readings.pm25_one_hourly[m.name];
      return typeof v === "number" ? [{ name: m.name, lat: m.labelLocation.latitude, lon: m.labelLocation.longitude, v }] : [];
    });
    if (regions.length > 0) air = { at: p.timestamp, regions };
  }

  return Response.json({ rain, air, dengue: dengueRaw ? dengueFromGeo(dengueRaw) : null });
}
