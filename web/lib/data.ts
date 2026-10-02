// Reads the latest ED figure for every site that publishes one. Nothing here ranks or combines sites.

export type Facility = "ED" | "UCC";

export type Site = {
  code: string;
  name: string;
  short: string;
  facility: Facility;
  lat: number;
  lon: number;
  minutes: number | null;
  checkedAt: string | null; // when we last fetched the figure; the source gives no timestamp of its own
};

const SHORT: Record<string, string> = {
  TTSH: "TTSH",
  KTPH: "KTPH",
  WH: "Woodlands",
  AH: "Alexandra UCC",
};

type HospitalRow = {
  facility_type: string;
  location: { code: string; name: string; lat: number; lon: number };
};
type ObservationRow = { location: string; value: number | null; fetched_at: string };

const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

async function get<T>(path: string): Promise<T> {
  if (!base || !key) throw new Error("Supabase environment variables are not set");
  const res = await fetch(`${base}/rest/v1/${path}`, { headers: { apikey: key }, cache: "no-store" });
  if (!res.ok) throw new Error(`Data request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export async function loadSites(): Promise<Site[]> {
  const [hospitals, observations] = await Promise.all([
    get<HospitalRow[]>("hospital?select=facility_type,location(code,name,lat,lon)&open_data_status=eq.published"),
    get<ObservationRow[]>("v_latest_observation?select=location,value,fetched_at&metric=eq.ed_wait_minutes"),
  ]);
  const latest = new Map(observations.map((o) => [o.location, o]));
  return hospitals
    .map((h): Site => {
      const o = latest.get(h.location.code);
      return {
        code: h.location.code,
        name: h.location.name,
        short: SHORT[h.location.code] ?? h.location.name,
        facility: h.facility_type === "UCC" ? "UCC" : "ED",
        lat: h.location.lat,
        lon: h.location.lon,
        minutes: o?.value ?? null,
        checkedAt: o?.fetched_at ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name)); // alphabetical, never by value
}

export function minutesAgo(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}

export function agoText(iso: string, now = Date.now()): string {
  const m = minutesAgo(iso, now);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ago`;
}
