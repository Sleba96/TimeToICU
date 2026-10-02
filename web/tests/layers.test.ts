import { test } from "node:test";
import assert from "node:assert/strict";
import { AIR, RAIN, airBand, airBandOf, airField, nearestRain, rainField, rainText, tint } from "../lib/layers.ts";

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
