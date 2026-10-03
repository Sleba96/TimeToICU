// Hospitals and polyclinics as a quiet directory layer (D-020). A fixed list built by scripts/build-care.mjs: no figures, no ranking,
// and nothing here says which one to go to.

import list from "./care.json" with { type: "json" };

export type CareKind = "hospital" | "community" | "polyclinic";
export type CareSite = { name: string; kind: CareKind; lat: number; lon: number };

export const CARE_SITES = list.sites as CareSite[];
export const CARE_SOURCE = { source: list.source, fetched: list.fetched };

// Told apart by shape as well as by name, never by colour alone: square, hollow square, circle.
export const CARE_KINDS: { kind: CareKind; label: string }[] = [
  { kind: "hospital", label: "Hospital" },
  { kind: "community", label: "Community hospital" },
  { kind: "polyclinic", label: "Polyclinic" },
];
export const CARE_NOTE = "A directory, not advice on where to go. Opening hours are not shown: check before travelling. Emergency: call 995.";

export const kindLabel = (k: CareKind) => CARE_KINDS.find((c) => c.kind === k)?.label ?? k;

function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const dx = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const dy = (b.lat - a.lat) * rad;
  return Math.hypot(dx, dy) * 6_371_000;
}

// A hospital that already has its own emergency-department pin is left out here, so one place never shows twice.
export function careWithout(sites: { lat: number; lon: number }[], care: CareSite[] = CARE_SITES, within = 100): CareSite[] {
  return care.filter((c) => !sites.some((s) => metres(c, s) <= within));
}
