// Reads the latest ED figure for every public site, with or without open data. Nothing here ranks or combines sites.

export type Facility = "ED" | "UCC" | "CHILDREN_ED";

// D-017: the ED waiting-time feed looks retired (D-016), so its four figures are not shown. Set to false to show them again.
export const ED_FEED_PAUSED = true;

// live: a current figure is shown. paused: the site has a feed that looks out of date. none: no open feed exists (D-003).
export type Status = "live" | "paused" | "none";

export function statusOf(published: boolean, paused: boolean = ED_FEED_PAUSED): Status {
  return !published ? "none" : paused ? "paused" : "live";
}

export type Site = {
  code: string;
  name: string;
  short: string;
  facility: Facility;
  status: Status;
  open: boolean; // true only when a current figure is shown; every other site is a quiet "No data" tag (D-014, D-017)
  lat: number;
  lon: number;
  minutes: number | null;
  checkedAt: string | null; // when we last fetched the figure; the source gives no timestamp of its own
  unchangedMin: number | null; // how long the figure has stayed the same, inferred from our own history (D-006)
  taxis: number | null; // available taxis within 2 km at the last LTA snapshot
};

const SHORT: Record<string, string> = {
  TTSH: "TTSH",
  KTPH: "KTPH",
  WH: "Woodlands",
  AH: "Alexandra UCC",
};

type HospitalRow = {
  facility_type: string;
  open_data_status: string;
  location: { code: string; name: string; lat: number; lon: number };
};
type ObservationRow = { location: string; metric: string; value: number | null; fetched_at: string };
export type HistoryRow = { value: number | null; ref_time: string; location: { code: string } };

const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

async function get<T>(path: string): Promise<T> {
  if (!base || !key) throw new Error("Supabase environment variables are not set");
  const res = await fetch(`${base}/rest/v1/${path}`, { headers: { apikey: key }, cache: "no-store" });
  if (!res.ok) throw new Error(`Data request failed (${res.status})`);
  return res.json() as Promise<T>;
}

function facility(t: string): Facility {
  return t === "UCC" ? "UCC" : t === "CHILDREN_ED" ? "CHILDREN_ED" : "ED";
}

// Minutes the newest figure has stayed unchanged, walking back through our own 5-minute history.
// Rows are newest first. The result is a lower bound when the history window ends before the change.
export function unchangedMinutes(rows: HistoryRow[]): number | null {
  if (rows.length === 0 || rows[0].value === null) return null;
  const newest = new Date(rows[0].ref_time).getTime();
  let oldest = newest;
  for (const r of rows) {
    if (r.value !== rows[0].value) break;
    oldest = new Date(r.ref_time).getTime();
  }
  return Math.round((newest - oldest) / 60000);
}

export async function loadSites(): Promise<Site[]> {
  const [hospitals, observations, history] = await Promise.all([
    get<HospitalRow[]>("hospital?select=facility_type,open_data_status,location(code,name,lat,lon)"),
    get<ObservationRow[]>("v_latest_observation?select=location,metric,value,fetched_at&metric=in.(ed_wait_minutes,taxi_available_2km)"),
    get<HistoryRow[]>(
      "observation?select=value,ref_time,location!inner(code),metric!inner(code)&metric.code=eq.ed_wait_minutes&order=ref_time.desc&limit=240",
    ),
  ]);
  const wait = new Map(observations.filter((o) => o.metric === "ed_wait_minutes").map((o) => [o.location, o]));
  const taxi = new Map(observations.filter((o) => o.metric === "taxi_available_2km").map((o) => [o.location, o]));
  const hist = new Map<string, HistoryRow[]>();
  for (const h of history) hist.set(h.location.code, [...(hist.get(h.location.code) ?? []), h]);
  return hospitals
    .map((h): Site => {
      const code = h.location.code;
      const status = statusOf(h.open_data_status === "published");
      const open = status === "live";
      const o = open ? wait.get(code) : undefined;
      return {
        code,
        name: h.location.name,
        short: SHORT[code] ?? code,
        facility: facility(h.facility_type),
        status,
        open,
        lat: h.location.lat,
        lon: h.location.lon,
        minutes: o?.value ?? null,
        checkedAt: o?.fetched_at ?? null,
        unchangedMin: open ? unchangedMinutes(hist.get(code) ?? []) : null,
        taxis: taxi.get(code)?.value ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name)); // alphabetical, never by value
}

export function minutesAgo(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

export function agoText(iso: string, now = Date.now()): string {
  const m = minutesAgo(iso, now);
  if (m < 1) return "just now";
  if (m < 60) return `${plural(m, "minute")} ago`;
  return `${plural(Math.floor(m / 60), "hour")} ago`;
}

export function durationText(min: number): string {
  if (min < 60) return plural(min, "minute");
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r === 0 ? plural(h, "hour") : `${plural(h, "hour")} ${plural(r, "minute")}`;
}
