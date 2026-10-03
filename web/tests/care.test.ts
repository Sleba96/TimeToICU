import { test } from "node:test";
import assert from "node:assert/strict";
import { careWithout, CARE_KINDS, CARE_SITES } from "../lib/care.ts";

test("care list: unique names, known kinds, inside Singapore", () => {
  assert.equal(new Set(CARE_SITES.map((c) => c.name)).size, CARE_SITES.length);
  const kinds = new Set(CARE_KINDS.map((k) => k.kind));
  for (const c of CARE_SITES) {
    assert.ok(kinds.has(c.kind), c.name);
    assert.ok(c.lat > 1.2 && c.lat < 1.48 && c.lon > 103.6 && c.lon < 104.1, `${c.name} is outside Singapore`);
  }
  for (const k of kinds) assert.ok(CARE_SITES.some((c) => c.kind === k));
});

test("care list: the 25 polyclinics' worth of known names are present", () => {
  assert.ok(CARE_SITES.filter((c) => c.kind === "polyclinic").length >= 25);
  assert.ok(CARE_SITES.some((c) => c.name === "Tan Tock Seng Hospital"));
});

test("careWithout drops only what sits on an existing site", () => {
  const ttsh = CARE_SITES.find((c) => c.name === "Tan Tock Seng Hospital")!;
  const kept = careWithout([{ lat: ttsh.lat + 0.0005, lon: ttsh.lon }]);
  assert.equal(kept.length, CARE_SITES.length - 1);
  assert.ok(!kept.some((c) => c.name === ttsh.name));
  assert.equal(careWithout([]).length, CARE_SITES.length);
});
