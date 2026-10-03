// Rare, forgiving reads of an upstream API (D-019). Kept out of the route file, which may only export its handlers.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const RETRY_MS = [1_000, 3_000];
export const ATTEMPT_TIMEOUT_MS = 8_000;

// Retries only what can pass by itself: rate limiting (429), server errors and network failures.
export async function getWithRetry(
  url: string,
  headers?: Record<string, string>,
  retryMs: number[] = RETRY_MS,
): Promise<Response | null> {
  for (let attempt = 0; ; attempt++) {
    let wait = retryMs[attempt];
    try {
      const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) });
      if (res.ok) return res;
      if (res.status !== 429 && res.status < 500) return null;
      const retryAfter = Number(res.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) wait = Math.min(retryAfter * 1000, 5_000);
    } catch {
      // timeout or network error: try again
    }
    if (attempt >= retryMs.length) return null;
    await sleep(wait);
  }
}


type Slot = { at: number; value: unknown; inflight: Promise<unknown> | null };
const slots = new Map<string, Slot>();

/** Fresh value if there is one; otherwise refresh once (concurrent callers share the call); if that fails, the last good value. A null is a failure and is never kept. */
export async function layer<T>(name: string, freshMs: number, load: () => Promise<T | null>): Promise<T | null> {
  const slot = slots.get(name) ?? { at: 0, value: null, inflight: null };
  slots.set(name, slot);
  if (slot.value !== null && Date.now() - slot.at < freshMs) return slot.value as T;
  slot.inflight ??= load()
    .then((v) => {
      if (v !== null) {
        slot.value = v;
        slot.at = Date.now();
      }
      return slot.value;
    })
    .catch(() => slot.value)
    .finally(() => {
      slot.inflight = null;
    });
  return (await slot.inflight) as T | null;
}

export function resetLayers() {
  slots.clear();
}
