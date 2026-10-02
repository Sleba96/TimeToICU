import { test } from "node:test";
import assert from "node:assert/strict";
import { agoText, durationText, unchangedMinutes, type HistoryRow } from "../lib/data.ts";

const row = (min: number, value: number | null): HistoryRow => ({
  value,
  ref_time: new Date(Date.UTC(2026, 9, 2, 10, 0) - min * 60000).toISOString(),
  location: { code: "TTSH" },
});

test("unchanged minutes counts back to the last change (rows newest first)", () => {
  assert.equal(unchangedMinutes([row(0, 61), row(5, 61), row(10, 61), row(15, 58)]), 10);
});

test("a figure that just changed has been unchanged for 0 minutes", () => {
  assert.equal(unchangedMinutes([row(0, 61), row(5, 58)]), 0);
});

test("a flat history is a lower bound over the whole window", () => {
  assert.equal(unchangedMinutes([row(0, 61), row(5, 61), row(10, 61)]), 10);
});

test("no history or no figure gives null", () => {
  assert.equal(unchangedMinutes([]), null);
  assert.equal(unchangedMinutes([row(0, null), row(5, 61)]), null);
});

test("age text uses minutes and hours, singular and plural", () => {
  const now = Date.UTC(2026, 9, 2, 10, 0);
  const ago = (m: number) => new Date(now - m * 60000).toISOString();
  assert.equal(agoText(ago(0), now), "just now");
  assert.equal(agoText(ago(1), now), "1 minute ago");
  assert.equal(agoText(ago(4), now), "4 minutes ago");
  assert.equal(agoText(ago(60), now), "1 hour ago");
  assert.equal(agoText(ago(135), now), "2 hours ago");
});

test("duration text", () => {
  assert.equal(durationText(45), "45 minutes");
  assert.equal(durationText(60), "1 hour");
  assert.equal(durationText(295), "4 hours 55 minutes");
});

test("the ED feed pause hides figures for sites that have a feed, and sites with none stay none", async () => {
  const { statusOf, ED_FEED_PAUSED } = await import("../lib/data.ts");
  assert.equal(ED_FEED_PAUSED, true);
  assert.equal(statusOf(true), "paused");
  assert.equal(statusOf(false), "none");
  assert.equal(statusOf(true, false), "live");
  assert.equal(statusOf(false, false), "none");
});
