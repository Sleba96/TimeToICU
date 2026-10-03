// Parser tests against real payloads recorded on 2026-10-02 (tests/fixtures).
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DENGUE_POLL_URL,
  distanceKm,
  epiWeekStart,
  type Fetched,
  type Hospital,
  parseAirTemperature,
  parseDengue,
  parseEdWaits,
  parseHolidays,
  parseIcuEpiweek,
  parsePm25Hourly,
  parsePsi,
  parseRainfall,
  parseTaxi,
  sha256Hex,
  slotFor,
  SOURCES,
} from "../supabase/functions/collect/sources.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const HOSPITALS: Hospital[] = [
  { code: "TTSH", lat: 1.3213686, lon: 103.845694 },
  { code: "KTPH", lat: 1.424081, lon: 103.838579 },
  { code: "WH", lat: 1.4246813, lon: 103.794743 },
  { code: "AH", lat: 1.285481, lon: 103.800181 },
  { code: "CGH", lat: 1.3408259, lon: 103.949467 },
];

test("ED waits: four sites, values parsed, no source timestamp", () => {
  const p = parseEdWaits(fixture("ed_waits.json"));
  assert.deepEqual(p.issues, []);
  assert.equal(p.observations.length, 4);
  assert.deepEqual(
    p.observations.map((o) => [o.location, o.value]),
    [
      ["Tan Tock Seng Hospital (TTSH)", 61],
      ["Khoo Teck Puat Hospital (KTPH)", 64],
      ["Woodlands Health (WH)", 17],
      ["Alexandra Hospital (AH) – Urgent Care Centre", 240],
    ],
  );
  assert.ok(p.observations.every((o) => o.observed_at === null && o.metric === "ed_wait_minutes"));
});

test("ED waits: non-numeric value kept as text and flagged", () => {
  const d = JSON.parse(fixture("ed_waits.json"));
  d.result.records[0].minutes = "N/A";
  const p = parseEdWaits(JSON.stringify(d));
  assert.equal(p.observations[0].value, null);
  assert.equal(p.observations[0].value_text, "N/A");
  assert.equal(p.issues[0].kind, "unparsable_value");
});

test("ED waits: a new field is reported as a schema change", () => {
  const d = JSON.parse(fixture("ed_waits.json"));
  d.result.fields.push({ type: "text", id: "updated" });
  const p = parseEdWaits(JSON.stringify(d));
  assert.equal(p.issues[0].kind, "schema_change");
});

test("ED waits: wrong shape throws", () => {
  assert.throws(() => parseEdWaits('{"success":false}'));
});

test("rainfall: one station per hospital, deduplicated, plus island-wide summaries", () => {
  const p = parseRainfall(fixture("rainfall.json"), HOSPITALS);
  const stationObs = p.observations.filter((o) => o.metric === "rain_mm");
  assert.ok(stationObs.length >= 1 && stationObs.length <= HOSPITALS.length);
  assert.equal(new Set(stationObs.map((o) => o.location)).size, stationObs.length);
  assert.equal(p.locations.length, stationObs.length);
  assert.ok(p.observations.some((o) => o.metric === "rain_max_mm" && o.location === "SG"));
  const wet = p.observations.find((o) => o.metric === "rain_wet_share")!;
  assert.ok(wet.value! >= 0 && wet.value! <= 1);
  assert.equal(stationObs[0].observed_at, "2026-10-02T11:50:00+08:00");
});

test("air temperature: nearest stations with plausible values", () => {
  const p = parseAirTemperature(fixture("air_temperature.json"), HOSPITALS);
  assert.ok(p.observations.length >= 1);
  assert.ok(p.observations.every((o) => o.value! > 15 && o.value! < 45));
});

test("PSI: three metrics for five regions", () => {
  const p = parsePsi(fixture("psi.json"));
  assert.equal(p.observations.length, 15);
  assert.deepEqual(p.issues, []);
  const central = p.observations.find((o) => o.metric === "psi_24h" && o.location === "psi:central")!;
  assert.equal(central.value, 74);
  assert.equal(central.observed_at, "2026-10-02T11:00:00+08:00");
});

test("taxi: island total equals coordinate count, per-hospital counts within total", () => {
  const p = parseTaxi(fixture("taxi.json"), HOSPITALS);
  const total = p.observations.find((o) => o.metric === "taxi_available_total")!;
  assert.equal(total.value, 1755);
  const perHospital = p.observations.filter((o) => o.metric === "taxi_available_2km");
  assert.equal(perHospital.length, HOSPITALS.length);
  assert.ok(perHospital.every((o) => o.value! >= 0 && o.value! <= 1755));
});

test("holidays: fetch follows child datasets, parse reads records", async () => {
  const urls: string[] = [];
  const get = (url: string): Promise<Fetched> => {
    urls.push(url);
    const body = url.includes("collections/691")
      ? JSON.stringify({ code: 0, data: { collectionMetadata: { childDatasets: ["d_149b61ad0a22f61c09dc80f2df5bbec8"] } } })
      : fixture("holidays_2026.json");
    return Promise.resolve({ status: 200, body, contentType: "application/json" });
  };
  const fetched = await SOURCES.holidays.fetch(get);
  assert.equal(urls.length, 2);
  const p = parseHolidays(fetched.body);
  assert.deepEqual(p.issues, []);
  assert.ok(p.holidays.some((h) => h.day === "2026-01-01"));
  assert.ok(p.holidays.length >= 10);
});

test("helpers: slot flooring, distance, hashing", async () => {
  assert.equal(slotFor(new Date("2026-10-02T04:07:31Z"), 5).toISOString(), "2026-10-02T04:05:00.000Z");
  assert.equal(slotFor(new Date("2026-10-02T04:07:31Z"), 15).toISOString(), "2026-10-02T04:00:00.000Z");
  // TTSH to KTPH is roughly 11.5 km.
  const km = distanceKm(1.3213686, 103.845694, 1.424081, 103.838579);
  assert.ok(km > 11 && km < 12.5, `got ${km}`);
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("ICU epi-week: 52 weeks x 3 statuses, national location, label kept", () => {
  const p = parseIcuEpiweek(fixture("icu_epiweek.json"));
  assert.deepEqual(p.issues, []);
  assert.equal(p.observations.length, 156);
  assert.ok(p.observations.every((o) => o.location === "SG" && o.value !== null && o.value >= 0));
  const first = p.observations[0];
  assert.deepEqual([first.metric, first.value, first.value_text], ["icu_beds_covid", 2.7, "2023-09"]);
  assert.equal(first.observed_at, "2023-02-26T00:00:00+08:00");
  assert.equal(new Set(p.observations.map((o) => o.metric)).size, 3);
});

test("ICU epi-week: bad rows are flagged, not guessed", () => {
  const body = JSON.stringify({ result: { records: [
    { epi_week: "2024-01", status: "Other", count: "1.0" },
    { epi_week: "2024-1", status: "COVID", count: "1.0" },
    { epi_week: "2024-01", status: "COVID", count: null },
    { epi_week: "2024-01", status: "COVID", count: "4.5" },
  ] } });
  const p = parseIcuEpiweek(body);
  assert.equal(p.observations.length, 1);
  assert.equal(p.issues.length, 3);
  assert.equal(parseIcuEpiweek("{}").issues[0].kind, "schema_change");
});

test("epiWeekStart: Sunday start, week 1 holds 4 January", () => {
  assert.equal(epiWeekStart(2023, 1), "2023-01-01");
  assert.equal(epiWeekStart(2024, 1), "2023-12-31");
  assert.equal(epiWeekStart(2024, 8), "2024-02-18");
});

test("dengue: island-wide totals from the real cluster file, newest update as timestamp", () => {
  const p = parseDengue(fixture("dengue.json"));
  assert.deepEqual(p.issues, []);
  assert.deepEqual(p.observations.map((o) => [o.metric, o.location, o.value]), [
    ["dengue_clusters", "SG", 9],
    ["dengue_cases_total", "SG", 120],
    ["dengue_cluster_max_cases", "SG", 83],
  ]);
  assert.ok(p.observations.every((o) => o.observed_at === "2026-09-29T15:01:15+08:00"));
});

test("dengue: no clusters is a real zero; bad rows are flagged; wrong shape throws", () => {
  const none = parseDengue(JSON.stringify({ type: "FeatureCollection", features: [] }));
  assert.deepEqual(none.observations.map((o) => o.value), [0, 0, 0]);
  const bad = parseDengue(JSON.stringify({ type: "FeatureCollection", features: [{ geometry: {}, properties: { CASE_SIZE: "x" } }] }));
  assert.equal(bad.issues[0].kind, "unparsable_record");
  assert.throws(() => parseDengue("{}"));
});

test("dengue: fetch follows the signed url from poll-download", async () => {
  const urls: string[] = [];
  const get = (url: string): Promise<Fetched> => {
    urls.push(url);
    const body = url.includes("poll-download") ? JSON.stringify({ code: 0, data: { url: "https://s3.example/file.geojson?sig=1" } }) : fixture("dengue.json");
    return Promise.resolve({ status: 200, body, contentType: null });
  };
  const f = await SOURCES.dengue.fetch(get);
  assert.deepEqual(urls, [DENGUE_POLL_URL, "https://s3.example/file.geojson?sig=1"]);
  assert.equal(parseDengue(f.body).observations.length, 3);
});

test("PM2.5 hourly: five regions, 1-hour metric, source timestamp kept", () => {
  const p = parsePm25Hourly(fixture("pm25.json"));
  assert.deepEqual(p.issues, []);
  assert.equal(p.observations.length, 5);
  assert.ok(p.observations.every((o) => o.metric === "pm25_1h" && o.location.startsWith("psi:") && o.observed_at?.endsWith("+08:00")));
  assert.equal(parsePm25Hourly(JSON.stringify({ code: 0, data: { items: [{ timestamp: "x", readings: {} }] } })).issues[0].kind, "missing_metric");
});
