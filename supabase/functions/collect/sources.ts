// Source definitions and parsers. Pure functions: no Deno or Supabase globals, so they run
// under the Edge runtime and under `node --test` against the recorded fixtures in tests/fixtures.

export const COLLECTOR_VERSION = "0.3.0";

export interface Hospital {
  code: string;
  lat: number;
  lon: number;
}

export interface Observation {
  metric: string;
  location: string; // location code, or the source's own label (resolved via location_alias)
  observed_at: string | null;
  value: number | null;
  value_text: string | null;
}

export interface NewLocation {
  code: string;
  kind: "weather_station";
  name: string;
  lat: number;
  lon: number;
}

export interface Issue {
  kind: string;
  detail: unknown;
}

export interface Parsed {
  observations: Observation[];
  locations: NewLocation[];
  holidays: { day: string; name: string }[];
  issues: Issue[];
}

export interface Fetched {
  status: number;
  body: string;
  contentType: string | null;
}

export type Getter = (url: string) => Promise<Fetched>;

export interface SourceDef {
  id: string;
  cadenceMinutes: number;
  fetch(get: Getter): Promise<Fetched>;
  parse(body: string, hospitals: Hospital[]): Parsed;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Start of the scheduled slot containing `at`, for a cadence in minutes. */
export function slotFor(at: Date, cadenceMinutes: number): Date {
  const ms = cadenceMinutes * 60_000;
  return new Date(Math.floor(at.getTime() / ms) * ms);
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function empty(): Parsed {
  return { observations: [], locations: [], holidays: [], issues: [] };
}

const simpleFetch = (url: string) => (get: Getter) => get(url);

// ---------------------------------------------------------------------------
// ED waiting times (data.gov.sg datastore). No timestamp in the payload.
// ---------------------------------------------------------------------------

export const ED_WAITS_URL =
  "https://data.gov.sg/api/action/datastore_search?resource_id=d_9d0bbe366aee923a6e202f80bb356bb9&limit=100";

const ED_EXPECTED_FIELDS = "_id,hospital,minutes";

export function parseEdWaits(body: string): Parsed {
  const out = empty();
  const d = JSON.parse(body);
  if (!d?.success || !Array.isArray(d?.result?.records)) {
    throw new Error("ed_waits: unexpected response shape");
  }
  const fields = (d.result.fields ?? []).map((f: { id: string }) => f.id).sort().join(",");
  if (fields !== ED_EXPECTED_FIELDS) {
    out.issues.push({ kind: "schema_change", detail: { expected: ED_EXPECTED_FIELDS, got: fields } });
  }
  if (typeof d.result.total === "number" && d.result.total !== d.result.records.length) {
    out.issues.push({ kind: "incomplete_page", detail: { total: d.result.total, returned: d.result.records.length } });
  }
  for (const r of d.result.records) {
    const label = String(r.hospital ?? "").trim();
    const raw = String(r.minutes ?? "").trim();
    const numeric = /^\d+(\.\d+)?$/.test(raw);
    const value = numeric ? Number(raw) : null;
    if (!numeric) out.issues.push({ kind: "unparsable_value", detail: { label, raw } });
    if (value !== null && value > 24 * 60) out.issues.push({ kind: "implausible_value", detail: { label, value } });
    out.observations.push({
      metric: "ed_wait_minutes",
      location: label,
      observed_at: null,
      value,
      value_text: numeric ? null : raw,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// NEA station readings (rainfall, air temperature): data.gov.sg real-time v2.
// Kept for the station nearest to each hospital, plus island-wide summaries.
// ---------------------------------------------------------------------------

interface Station {
  id: string;
  name: string;
  location: { latitude: number; longitude: number };
}

function readStations(body: string, source: string) {
  const d = JSON.parse(body);
  const stations: Station[] = d?.data?.stations;
  const reading = d?.data?.readings?.[0];
  if (d?.code !== 0 || !Array.isArray(stations) || !reading?.timestamp || !Array.isArray(reading?.data)) {
    throw new Error(`${source}: unexpected response shape`);
  }
  const values = new Map<string, number>();
  for (const r of reading.data) {
    if (typeof r.value === "number") values.set(r.stationId, r.value);
  }
  return { stations, values, timestamp: reading.timestamp as string };
}

function nearestStations(hospitals: Hospital[], stations: Station[], values: Map<string, number>): Station[] {
  const chosen = new Map<string, Station>();
  for (const h of hospitals) {
    let best: Station | null = null;
    let bestKm = Infinity;
    for (const s of stations) {
      if (!values.has(s.id)) continue;
      const km = distanceKm(h.lat, h.lon, s.location.latitude, s.location.longitude);
      if (km < bestKm) {
        best = s;
        bestKm = km;
      }
    }
    if (best) chosen.set(best.id, best);
  }
  return [...chosen.values()];
}

function stationObservations(
  out: Parsed,
  metric: string,
  chosen: Station[],
  values: Map<string, number>,
  timestamp: string,
) {
  for (const s of chosen) {
    out.locations.push({
      code: `stn:${s.id}`,
      kind: "weather_station",
      name: s.name,
      lat: s.location.latitude,
      lon: s.location.longitude,
    });
    out.observations.push({ metric, location: `stn:${s.id}`, observed_at: timestamp, value: values.get(s.id)!, value_text: null });
  }
}

export function parseRainfall(body: string, hospitals: Hospital[]): Parsed {
  const out = empty();
  const { stations, values, timestamp } = readStations(body, "rainfall");
  stationObservations(out, "rain_mm", nearestStations(hospitals, stations, values), values, timestamp);
  const all = [...values.values()];
  if (all.length > 0) {
    out.observations.push({ metric: "rain_max_mm", location: "SG", observed_at: timestamp, value: Math.max(...all), value_text: null });
    out.observations.push({
      metric: "rain_wet_share",
      location: "SG",
      observed_at: timestamp,
      value: all.filter((v) => v > 0).length / all.length,
      value_text: null,
    });
  } else {
    out.issues.push({ kind: "no_readings", detail: null });
  }
  return out;
}

export function parseAirTemperature(body: string, hospitals: Hospital[]): Parsed {
  const out = empty();
  const { stations, values, timestamp } = readStations(body, "air_temperature");
  stationObservations(out, "air_temp_c", nearestStations(hospitals, stations, values), values, timestamp);
  if (values.size === 0) out.issues.push({ kind: "no_readings", detail: null });
  return out;
}

// ---------------------------------------------------------------------------
// PSI / PM2.5 by region: data.gov.sg real-time v2.
// ---------------------------------------------------------------------------

const PSI_METRICS: Record<string, string> = {
  psi_twenty_four_hourly: "psi_24h",
  pm25_twenty_four_hourly: "pm25_24h",
  pm25_sub_index: "pm25_sub_index",
};

export function parsePsi(body: string): Parsed {
  const out = empty();
  const d = JSON.parse(body);
  const item = d?.data?.items?.[0];
  if (d?.code !== 0 || !item?.timestamp || !item?.readings) throw new Error("psi: unexpected response shape");
  for (const [key, metric] of Object.entries(PSI_METRICS)) {
    const byRegion = item.readings[key];
    if (!byRegion) {
      out.issues.push({ kind: "missing_metric", detail: key });
      continue;
    }
    for (const [region, value] of Object.entries(byRegion)) {
      if (typeof value !== "number") continue;
      out.observations.push({ metric, location: `psi:${region}`, observed_at: item.timestamp, value, value_text: null });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// PM2.5 1-hour reading by region (separate data.gov.sg endpoint, reacts faster than the 24-hour average).
// ---------------------------------------------------------------------------

export function parsePm25Hourly(body: string): Parsed {
  const out = empty();
  const d = JSON.parse(body);
  const item = d?.data?.items?.[0];
  if (d?.code !== 0 || !item?.timestamp || !item?.readings) throw new Error("pm25_hourly: unexpected response shape");
  const byRegion = item.readings.pm25_one_hourly;
  if (!byRegion) {
    out.issues.push({ kind: "missing_metric", detail: "pm25_one_hourly" });
    return out;
  }
  for (const [region, value] of Object.entries(byRegion)) {
    if (typeof value !== "number") continue;
    out.observations.push({ metric: "pm25_1h", location: `psi:${region}`, observed_at: item.timestamp, value, value_text: null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Taxi availability (LTA via data.gov.sg v1). Aggregated: raw coordinates are not stored per run.
// ---------------------------------------------------------------------------

export const TAXI_RADIUS_KM = 2;

export function parseTaxi(body: string, hospitals: Hospital[]): Parsed {
  const out = empty();
  const d = JSON.parse(body);
  const f = d?.features?.[0];
  const coords: [number, number][] = f?.geometry?.coordinates;
  const ts: string = f?.properties?.timestamp;
  if (!Array.isArray(coords) || !ts) throw new Error("taxi: unexpected response shape");
  const reported = f.properties.taxi_count;
  if (typeof reported === "number" && reported !== coords.length) {
    out.issues.push({ kind: "count_mismatch", detail: { reported, coordinates: coords.length } });
  }
  out.observations.push({ metric: "taxi_available_total", location: "SG", observed_at: ts, value: coords.length, value_text: null });
  for (const h of hospitals) {
    let n = 0;
    for (const [lon, lat] of coords) {
      if (distanceKm(h.lat, h.lon, lat, lon) <= TAXI_RADIUS_KM) n++;
    }
    out.observations.push({ metric: "taxi_available_2km", location: h.code, observed_at: ts, value: n, value_text: null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public holidays: collection 691 lists one child dataset per year.
// The stored body is a JSON envelope of every response read, so the run is reproducible.
// ---------------------------------------------------------------------------

export const HOLIDAYS_COLLECTION_URL = "https://api-production.data.gov.sg/v2/public/api/collections/691/metadata";
const DATASTORE_URL = "https://data.gov.sg/api/action/datastore_search?limit=100&resource_id=";
const HOLIDAYS_PAUSE_MS = 1_500;

async function fetchHolidays(get: Getter): Promise<Fetched> {
  const meta = await get(HOLIDAYS_COLLECTION_URL);
  if (meta.status !== 200) return meta;
  const ids: string[] = JSON.parse(meta.body)?.data?.collectionMetadata?.childDatasets ?? [];
  const datasets: Record<string, { status: number; body: string }> = {};
  for (const [i, id] of ids.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, HOLIDAYS_PAUSE_MS)); // be polite to the datastore
    const r = await get(DATASTORE_URL + id);
    datasets[id] = { status: r.status, body: r.body };
    if (r.status === 429) break; // still rate-limited after retries: stop, the next daily run fills the gap
  }
  return { status: 200, body: JSON.stringify({ collection: meta.body, datasets }), contentType: "application/json" };
}

export function parseHolidays(body: string): Parsed {
  const out = empty();
  const env = JSON.parse(body);
  if (typeof env?.collection !== "string" || typeof env?.datasets !== "object") {
    throw new Error("holidays: unexpected envelope");
  }
  for (const [id, r] of Object.entries(env.datasets as Record<string, { status: number; body: string }>)) {
    if (r.status !== 200) {
      out.issues.push({ kind: "dataset_unavailable", detail: { id, status: r.status } });
      continue;
    }
    const records = JSON.parse(r.body)?.result?.records;
    if (!Array.isArray(records)) {
      out.issues.push({ kind: "schema_change", detail: { id } });
      continue;
    }
    for (const rec of records) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(rec.date ?? "") && rec.holiday) {
        out.holidays.push({ day: rec.date, name: String(rec.holiday).trim() });
      } else {
        out.issues.push({ kind: "unparsable_record", detail: { id, rec } });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dengue clusters (NEA, data.gov.sg dataset d_dbfabf16...). A GeoJSON file, reached in two steps:
// poll-download returns a short-lived signed URL. Stored as island-wide totals, not as polygons.
// ---------------------------------------------------------------------------

export const DENGUE_POLL_URL = "https://api-open.data.gov.sg/v1/public/api/datasets/d_dbfabf16158d1b0e1c420627c0819168/poll-download";

async function fetchDengue(get: Getter): Promise<Fetched> {
  const meta = await get(DENGUE_POLL_URL);
  if (meta.status !== 200) return meta;
  const url: unknown = JSON.parse(meta.body)?.data?.url;
  if (typeof url !== "string") throw new Error("dengue: poll-download gave no url");
  return get(url);
}

/** FMEL_UPD_D is "yyyymmddhhmmss". The publisher does not state a time zone; Singapore time is assumed. */
export function dengueTimestamp(raw: unknown): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(raw ?? ""));
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+08:00` : null;
}

export function parseDengue(body: string): Parsed {
  const out = empty();
  const d = JSON.parse(body);
  if (d?.type !== "FeatureCollection" || !Array.isArray(d?.features)) throw new Error("dengue: unexpected response shape");
  const sizes: number[] = [];
  let latest: string | null = null;
  for (const f of d.features) {
    const size = Number(f?.properties?.CASE_SIZE);
    if (!Number.isInteger(size) || size < 0 || !f?.geometry) {
      out.issues.push({ kind: "unparsable_record", detail: f?.properties ?? null });
      continue;
    }
    sizes.push(size);
    const ts = dengueTimestamp(f.properties.FMEL_UPD_D);
    if (ts && (latest === null || ts > latest)) latest = ts;
  }
  // The file carries no overall timestamp; the newest cluster update stands in. An empty file is a real "no clusters".
  const at = (metric: string, value: number) => out.observations.push({ metric, location: "SG", observed_at: latest, value, value_text: null });
  at("dengue_clusters", sizes.length);
  at("dengue_cases_total", sizes.reduce((a, b) => a + b, 0));
  at("dengue_cluster_max_cases", sizes.length ? Math.max(...sizes) : 0);
  return out;
}

// ---------------------------------------------------------------------------
// ICU utilisation by epi-week (static MOH series on data.gov.sg)

const ICU_URL = "https://data.gov.sg/api/action/datastore_search?limit=500&resource_id=d_ac42b0ea4ae0528bc9dbef90f0658f2b";
const ICU_METRICS: Record<string, string> = {
  "COVID": "icu_beds_covid",
  "Non-COVID": "icu_beds_noncovid",
  "Empty": "icu_beds_empty",
};

/**
 * First day (Sunday) of an epi-week, assuming the MMWR convention: weeks run Sunday to Saturday and
 * week 1 is the first week with at least four days in the year. The publisher does not state its
 * convention (see D-010); the original label is always kept in value_text.
 */
export function epiWeekStart(year: number, week: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1 = jan4.getTime() - jan4.getUTCDay() * 86_400_000;
  return new Date(week1 + (week - 1) * 7 * 86_400_000).toISOString().slice(0, 10);
}

export function parseIcuEpiweek(body: string): Parsed {
  const out = empty();
  const records = JSON.parse(body)?.result?.records;
  if (!Array.isArray(records)) {
    out.issues.push({ kind: "schema_change", detail: "result.records missing" });
    return out;
  }
  for (const rec of records) {
    const metric = ICU_METRICS[String(rec.status)];
    const m = /^(\d{4})-(\d{2})$/.exec(String(rec.epi_week ?? ""));
    const value = Number(rec.count);
    if (!metric || !m || rec.count === null || rec.count === "" || !Number.isFinite(value) || value < 0) {
      out.issues.push({ kind: "unparsable_record", detail: rec });
      continue;
    }
    out.observations.push({
      metric,
      location: "SG",
      observed_at: `${epiWeekStart(Number(m[1]), Number(m[2]))}T00:00:00+08:00`,
      value,
      value_text: String(rec.epi_week),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------

export const SOURCES: Record<string, SourceDef> = {
  ed_waits: { id: "ed_waits", cadenceMinutes: 5, fetch: simpleFetch(ED_WAITS_URL), parse: (b) => parseEdWaits(b) },
  rainfall: {
    id: "rainfall",
    cadenceMinutes: 5,
    fetch: simpleFetch("https://api-open.data.gov.sg/v2/real-time/api/rainfall"),
    parse: parseRainfall,
  },
  air_temperature: {
    id: "air_temperature",
    cadenceMinutes: 15,
    fetch: simpleFetch("https://api-open.data.gov.sg/v2/real-time/api/air-temperature"),
    parse: parseAirTemperature,
  },
  psi: {
    id: "psi",
    cadenceMinutes: 60,
    fetch: simpleFetch("https://api-open.data.gov.sg/v2/real-time/api/psi"),
    parse: (b) => parsePsi(b),
  },
  pm25_hourly: {
    id: "pm25_hourly",
    cadenceMinutes: 60,
    fetch: simpleFetch("https://api-open.data.gov.sg/v2/real-time/api/pm25"),
    parse: (b) => parsePm25Hourly(b),
  },
  taxi: {
    id: "taxi",
    cadenceMinutes: 15,
    fetch: simpleFetch("https://api.data.gov.sg/v1/transport/taxi-availability"),
    parse: parseTaxi,
  },
  dengue: { id: "dengue", cadenceMinutes: 60, fetch: fetchDengue, parse: (b) => parseDengue(b) },
  icu_epiweek: {
    id: "icu_epiweek",
    cadenceMinutes: 1440,
    fetch: simpleFetch(ICU_URL),
    parse: (b) => parseIcuEpiweek(b),
  },
  holidays: { id: "holidays", cadenceMinutes: 1440, fetch: fetchHolidays, parse: (b) => parseHolidays(b) },
};
