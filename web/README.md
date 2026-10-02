# web

Public interface: a map of the four sites that publish an ED waiting time. Next.js, MapLibre GL, PMTiles.

- Look and rules: `docs/design-brief.md`, `docs/decisions.md` (D-012, D-013).
- Env (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Optional `NEXT_PUBLIC_MAP_URL` overrides the tile file.
- Tiles: `singapore.pmtiles` in the public Supabase bucket `map` (see `scripts/extract-map.sh`).
- MapLibre's worker is copied to `public/maplibre/` by `scripts/copy-worker.mjs` (runs before `dev` and `build`).
- Map labels use Noto Sans glyphs in `public/fonts` (SIL OFL 1.1, from protomaps/basemaps-assets).
- Vercel: root directory `web`.

Run: `npm install && npm run dev`.

Not built yet: rain and PM2.5 colour layers with legend strip, taxi row in the sheet, the dark map, the usual range.
