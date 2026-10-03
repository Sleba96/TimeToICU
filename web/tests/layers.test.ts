import { test } from "node:test";
import assert from "node:assert/strict";
import { AIR, DENGUE, RAIN, dengueFromGeo, dengueSummary, dengueText, airBand, airBandOf, airField, nearestRain, rainField, rainText, tint } from "../lib/layers.ts";

// NEA 1-hour PM2.5 bands (haze.gov.sg): Normal 0-55, Elevated 56-150, High 151-250, Very High 251 and above.
test("air band edges follow NEA", () => {
  const cases: [number, string][] = [
    [0, "Normal"], [55, "Normal"], [56, "Elevated"], [150, "Elevated"],
    [151, "High"], [250, "High"], [251, "Very high"], [900, "Very high"],
  ];
  for (const [v, name] of cases) assert.equal(airBand(v), name, `${v} µg/m³`);
});

test("only zones above normal are tinted, and steps get darker", () => {
  assert.equal(airBandOf(40).alpha, 0);
  const a = AIR.bands.map((b) => b.alpha);
  assert.deepEqual(a, [...a].sort((x, y) => x - y));
  assert.ok(a[1] > 0);
  assert.equal(AIR.bands.length, 4);
});

test("tint builds a css colour", () => {
  assert.equal(tint(AIR.rgb, 0.3), "rgba(106,76,156,0.3)");
});

test("rain text", () => {
  assert.equal(rainText(0), "0 mm rain");
  assert.equal(rainText(0.6), "0.6 mm rain");
  assert.equal(rainText(1.24), "1.2 mm rain");
});

test("nearest rain station", () => {
  const d = { at: "x", stations: [{ lat: 1.3, lon: 103.8, mm: 2 }, { lat: 1.4, lon: 103.8, mm: 0.4 }] };
  assert.equal(nearestRain(d, 1.31, 103.8), 2);
  assert.equal(nearestRain(d, 1.39, 103.81), 0.4);
});

test("the rain scale and legend text agree", () => {
  assert.equal(RAIN.max, 5);
  assert.equal(RAIN.hi, "5 mm or more");
  assert.equal(RAIN.lo, "0 mm");
});

test("colour fields need a browser canvas and return null without one", () => {
  assert.equal(rainField({ at: "x", stations: [{ lat: 1.3, lon: 103.8, mm: 1 }] }), null);
  assert.equal(airField({ at: "x", regions: [{ name: "north", lat: 1.4, lon: 103.8, v: 70 }] }), null);
});

const ring = [[103.8, 1.3], [103.82, 1.3], [103.82, 1.32], [103.8, 1.32], [103.8, 1.3]];
const feat = (cases: unknown, upd: string, geometry: unknown = { type: "Polygon", coordinates: [ring] }) =>
  ({ geometry, properties: { CASE_SIZE: cases, LOCALITY: " Soon Lee Rd ", FMEL_UPD_D: upd } }) as never;

test("dengue: clusters keep cases, place and a bounding-box centre; newest update stamps the file", () => {
  const d = dengueFromGeo({ features: [feat(4, "20260924154240"), feat(10, "20260929150115")] })!;
  assert.equal(d.clusters.length, 2);
  assert.deepEqual([d.clusters[0].cases, d.clusters[0].place], [4, "Soon Lee Rd"]);
  assert.ok(Math.abs(d.clusters[0].lon - 103.81) < 1e-9 && Math.abs(d.clusters[0].lat - 1.31) < 1e-9);
  assert.equal(d.at, "2026-09-29T15:01:15+08:00");
});

test("dengue: bad rows are dropped, a wrong file is null, an empty file is a real zero", () => {
  const d = dengueFromGeo({ features: [feat("x", "1"), feat(3, "1", { type: "Point", coordinates: [1, 1] })] })!;
  assert.equal(d.clusters.length, 0);
  assert.equal(dengueFromGeo({} as never), null);
  assert.equal(dengueSummary({ at: null, clusters: [] }), "No active clusters.");
});

test("dengue: wording is singular and plural, and the colour is neither red nor green", () => {
  assert.equal(dengueText(1), "1 case");
  assert.equal(dengueText(5), "5 cases");
  assert.equal(dengueSummary({ at: null, clusters: [{ place: "", cases: 1, lat: 0, lon: 0, ring: [] }] }), "1 cluster, 1 case");
  const [r, g, b] = DENGUE.rgb;
  assert.ok(r > g && g > b && g > 60, "amber");
});
