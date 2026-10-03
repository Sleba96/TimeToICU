# web

Public interface: a map of the public emergency sites. All ten show as "No data": six publish no feed (D-014), and the four that do are hidden because the feed looks retired (D-017, switch `ED_FEED_PAUSED` in `lib/data.ts`). Rain and air quality can be shown as colour (D-015), and dengue clusters as outlines (D-018). Next.js, MapLibre GL, PMTiles.

- Look and rules: `docs/design-brief.md`, `docs/decisions.md` (D-012, D-013).
- Env (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Optional `NEXT_PUBLIC_MAP_URL` overrides the tile file.
- Layers: `app/api/layers/route.ts` reads rain, 1-hour PM2.5 and the NEA dengue cluster file from data.gov.sg on the server (last good value kept 15 minutes, dengue 1 hour, with retries and CDN caching; nothing stored, D-019). Optional server env `DATA_GOV_SG_API_KEY` raises the rate limit (D-009). Colour scales and the NEA band names are in `lib/layers.ts`.
- Hospitals and polyclinics: a fixed directory layer from `lib/care.json`, regenerated with `node scripts/build-care.mjs` (OneMap, hand-kept names; D-020).
- Tiles: `singapore.pmtiles` in the public Supabase bucket `map` (see `scripts/extract-map.sh`).
- MapLibre's worker is copied to `public/maplibre/` by `scripts/copy-worker.mjs` (runs before `dev` and `build`).
- Map labels use Noto Sans glyphs in `public/fonts` (SIL OFL 1.1, from protomaps/basemaps-assets).
- Vercel: root directory `web`.

Run: `npm install && npm run dev`. Tests: `npm test` (Node 22.6+; bands, age text, unchanged-figure logic and tag placement).

Not built yet: the usual range (the sheet says "Not enough data yet") and the dark map. The NEA band limits in `lib/layers.ts` were checked against haze.gov.sg on 2026-10-02.
