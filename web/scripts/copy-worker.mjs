// MapLibre runs its tile work in a Web Worker that the bundler cannot inline; serve it from /maplibre instead.
import { cpSync, mkdirSync } from "node:fs";
mkdirSync("public/maplibre", { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) cpSync(`node_modules/maplibre-gl/dist/${f}`, `public/maplibre/${f}`);
