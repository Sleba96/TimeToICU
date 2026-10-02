// Rain and PM2.5 colour layers (D-015). One hue per layer, light for less and dark for more, never red or green.

export type RainData = { at: string; stations: { lat: number; lon: number; mm: number }[] };
export type AirData = { at: string; regions: { name: string; lat: number; lon: number; v: number }[] };
export type LayerData = { rain: RainData | null; air: AirData | null };
export type LayerKey = "rain" | "air";

// Fixed scales, so a calm day looks calm. The ends are what the legend writes.
export const RAIN = { max: 5, rgb: [29, 79, 145] as const, lo: "0 mm", hi: "5 mm or more", title: "Rain, last 5 min", dry: "No rain at the moment." };
// Air is shown in the four NEA bands, not as a gradient. Normal is left uncoloured, so only zones above normal are tinted.
// NEA: Normal is 55 µg/m³ and below. The upper limits of the other bands are not yet confirmed against NEA.
export const AIR = {
  rgb: [106, 76, 156] as const,
  title: "PM2.5, 1 hour",
  bands: [
    { name: "Normal", max: 55, alpha: 0 },
    { name: "Elevated", max: 150, alpha: 0.3 },
    { name: "High", max: 250, alpha: 0.5 },
    { name: "Very high", max: Infinity, alpha: 0.72 },
  ],
};

export function airBandOf(v: number) {
  return AIR.bands.find((b) => v <= b.max) ?? AIR.bands[AIR.bands.length - 1];
}

export function airBand(v: number): string {
  return airBandOf(v).name;
}

export function rainText(mm: number): string {
  return `${mm === 0 ? "0" : mm.toFixed(1)} mm rain`;
}

// Same window as the map's maxBounds, so the image never needs to be wider than the visible map.
export const FIELD_BOUNDS = { west: 103.55, east: 104.12, south: 1.15, north: 1.5 };
export const FIELD_COORDS: [[number, number], [number, number], [number, number], [number, number]] = [
  [FIELD_BOUNDS.west, FIELD_BOUNDS.north],
  [FIELD_BOUNDS.east, FIELD_BOUNDS.north],
  [FIELD_BOUNDS.east, FIELD_BOUNDS.south],
  [FIELD_BOUNDS.west, FIELD_BOUNDS.south],
];

const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const unmerc = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

type Point = { lat: number; lon: number; v: number };

// Inverse-distance blend of the points onto a small canvas, drawn as a transparent tint.
// Rain uses a gentle power (smooth blend). Air uses a steep one, which gives five soft regional zones.
export function renderField(
  points: Point[],
  opts: { rgb: readonly [number, number, number]; power: number; soft: number; toAlpha: (v: number) => number },
): string | null {
  if (points.length === 0 || typeof document === "undefined") return null;
  const w = 285;
  const b = FIELD_BOUNDS;
  const y0 = merc(b.north);
  const y1 = merc(b.south);
  const h = Math.round((w * (y0 - y1)) / (((b.east - b.west) * Math.PI) / 180));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  const s2 = opts.soft * opts.soft;
  for (let j = 0; j < h; j++) {
    const lat = unmerc(y0 + ((y1 - y0) * (j + 0.5)) / h);
    for (let i = 0; i < w; i++) {
      const lon = b.west + ((b.east - b.west) * (i + 0.5)) / w;
      let num = 0;
      let den = 0;
      for (const p of points) {
        const dx = lon - p.lon;
        const dy = lat - p.lat;
        const wt = 1 / Math.pow(dx * dx + dy * dy + s2, opts.power / 2);
        num += wt * p.v;
        den += wt;
      }
      const a = Math.min(1, Math.max(0, opts.toAlpha(num / den)));
      const k = (j * w + i) * 4;
      img.data[k] = opts.rgb[0];
      img.data[k + 1] = opts.rgb[1];
      img.data[k + 2] = opts.rgb[2];
      img.data[k + 3] = Math.round(255 * a);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

// Rain: a smooth blend between stations, uncoloured where it is dry.
export function rainField(d: RainData): string | null {
  const toAlpha = (mm: number) => (mm <= 0.005 ? 0 : 0.1 + 0.6 * Math.min(1, mm / RAIN.max));
  return renderField(d.stations.map((s) => ({ lat: s.lat, lon: s.lon, v: s.mm })), { rgb: RAIN.rgb, power: 2, soft: 0.012, toAlpha });
}

// Air: each region carries the opacity of its band, and the steep blend gives five soft zones.
export function airField(d: AirData): string | null {
  return renderField(d.regions.map((r) => ({ lat: r.lat, lon: r.lon, v: airBandOf(r.v).alpha })), {
    rgb: AIR.rgb,
    power: 6,
    soft: 0.02,
    toAlpha: (a) => a,
  });
}

// Rain at the station nearest a site.
export function nearestRain(d: RainData, lat: number, lon: number): number {
  let best = Infinity;
  let mm = 0;
  for (const s of d.stations) {
    const dist = (s.lat - lat) ** 2 + (s.lon - lon) ** 2;
    if (dist < best) {
      best = dist;
      mm = s.mm;
    }
  }
  return mm;
}

export function tint([r, g, b]: readonly [number, number, number], alpha: number): string {
  return `rgba(${r},${g},${b},${alpha})`;
}

export function gradient([r, g, b]: readonly [number, number, number]): string {
  return `linear-gradient(90deg, rgba(${r},${g},${b},.1), rgba(${r},${g},${b},.7))`;
}
