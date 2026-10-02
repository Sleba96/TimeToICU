#!/usr/bin/env bash
# Cut a Singapore-only tile file (about 29 MB, zoom 0-15) from the public Protomaps daily build of OpenStreetMap.
# Usage: scripts/extract-map.sh [YYYYMMDD]   (defaults to yesterday, UTC)
# Needs go-pmtiles: go install github.com/protomaps/go-pmtiles@latest
set -euo pipefail
day="${1:-$(date -u -d yesterday +%Y%m%d)}"
out="${OUT:-singapore.pmtiles}"
pmtiles extract "https://build.protomaps.com/${day}.pmtiles" "$out" --bbox=103.55,1.15,104.12,1.50 --maxzoom=15
echo "wrote $out from the ${day} build. Data: OpenStreetMap contributors (ODbL)."
