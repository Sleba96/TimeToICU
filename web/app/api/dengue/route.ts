// NEA dengue clusters for the map. The file is republished about once a day (Last-Modified, 3 Oct 2026: 10:06 SGT) and the
// clusters inside change on working days only, so this is read rarely: the server keeps it 12 hours and the CDN a day (D-021).
// It sits on S3 without CORS headers, so a browser cannot read it directly; this route is the thin proxy.

import { getWithRetry, layer } from "@/lib/upstream";
import { dengueFromGeo, type DengueData } from "@/lib/layers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DATASET = "d_dbfabf16158d1b0e1c420627c0819168";
const FRESH_MS = 12 * 60 * 60_000;

let why = "no data";

async function load(): Promise<DengueData | null> {
  const key = process.env.DATA_GOV_SG_API_KEY;
  const headers = key ? { "x-api-key": key } : undefined;
  // Two calls: poll-download returns a short-lived signed URL, which holds the file.
  const poll = await getWithRetry(`https://api-open.data.gov.sg/v1/public/api/datasets/${DATASET}/poll-download`, headers, undefined, (r) => (why = `poll-download: ${r}`));
  if (!poll) return null;
  try {
    const url = ((await poll.json()) as { data?: { url?: string } }).data?.url;
    if (!url) return null;
    const file = await getWithRetry(url, undefined, undefined, (r) => (why = `file: ${r}`));
    return file ? dengueFromGeo(await file.json()) : null;
  } catch {
    why = "unreadable response";
    return null;
  }
}

export async function GET() {
  const dengue = await layer("dengue", FRESH_MS, load);
  if (!dengue) console.warn("dengue missing", why);
  return Response.json(
    { dengue, issues: dengue ? {} : { dengue: why } },
    // Present: a day at the CDN, and a stale copy for a week while it refreshes. Missing: a minute only, so a recovery shows soon.
    { headers: { "Cache-Control": dengue ? "public, s-maxage=86400, stale-while-revalidate=604800" : "public, s-maxage=60" } },
  );
}
