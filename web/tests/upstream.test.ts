import { test } from "node:test";
import assert from "node:assert/strict";
import { getWithRetry, layer, resetLayers } from "../lib/upstream.ts";

const real = globalThis.fetch;
const stub = (statuses: (number | "throw")[]) => {
  let n = 0;
  globalThis.fetch = (() => {
    const s = statuses[Math.min(n++, statuses.length - 1)];
    return s === "throw" ? Promise.reject(new Error("net")) : Promise.resolve(new Response("{}", { status: s }));
  }) as typeof fetch;
  return () => n;
};

test("retries a 429, a 5xx and a network error, then succeeds", async () => {
  const calls = stub([429, 503, "throw", 200]);
  const res = await getWithRetry("https://x", undefined, [0, 0, 0]);
  assert.equal(res?.status, 200);
  assert.equal(calls(), 4);
  globalThis.fetch = real;
});

test("gives up after the last retry, and never retries a 404", async () => {
  let calls = stub([429]);
  assert.equal(await getWithRetry("https://x", undefined, [0, 0]), null);
  assert.equal(calls(), 3);
  calls = stub([404, 200]);
  assert.equal(await getWithRetry("https://x", undefined, [0, 0]), null);
  assert.equal(calls(), 1);
  globalThis.fetch = real;
});

test("layer: a fresh value is reused, a failed refresh keeps the last good value, null is never stored", async () => {
  resetLayers();
  let n = 0;
  assert.equal(await layer("a", 60_000, async () => (++n, "one")), "one");
  assert.equal(await layer("a", 60_000, async () => (++n, "two")), "one");
  assert.equal(n, 1);
  assert.equal(await layer("a", 0, async () => null), "one");
  assert.equal(await layer("a", 0, async () => { throw new Error("x"); }), "one");
  assert.equal(await layer("b", 0, async () => null), null);
  assert.equal(await layer("b", 0, async () => "late"), "late");
});

test("layer: concurrent callers share one refresh", async () => {
  resetLayers();
  let n = 0;
  const load = async () => (++n, await new Promise((r) => setTimeout(r, 5)), "v");
  await Promise.all([layer("c", 60_000, load), layer("c", 60_000, load), layer("c", 60_000, load)]);
  assert.equal(n, 1);
});
