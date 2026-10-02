import type { StyleSpecification, LayerSpecification } from "maplibre-gl";

// "Water" tint from docs/design-brief.md. Schema: Protomaps basemap tiles v4.
export const C = {
  sea: "#cfe2ef",
  land: "#ffffff",
  park: "#d6e8cf",
  coast: "#7f9bb0",
  ink: "#14181f",
  muted: "#4b5563",
  roadMinor: "#dde5ec",
  roadMedium: "#c6d3dd",
  roadMajor: "#adbfcc",
  roadHighway: "#90a6b6",
  building: "#eef2f5",
};

const REGULAR = ["Noto Sans Regular"];
const MEDIUM = ["Noto Sans Medium"];

function road(id: string, kinds: string[], minzoom: number, color: string, width: unknown[]): LayerSpecification {
  return {
    id,
    type: "line",
    source: "sg",
    "source-layer": "roads",
    minzoom,
    filter: ["all", ["in", ["get", "kind"], ["literal", kinds]], ["!=", ["get", "is_tunnel"], true]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": color, "line-width": width as never },
  };
}

export function style(tilesUrl: string, origin: string): StyleSpecification {
  return {
    version: 8,
    glyphs: `${origin}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      sg: {
        type: "vector",
        url: `pmtiles://${tilesUrl}`,
        maxzoom: 15,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [
      { id: "sea", type: "background", paint: { "background-color": C.sea } },
      { id: "land", type: "fill", source: "sg", "source-layer": "earth", paint: { "fill-color": C.land } },
      {
        id: "parks",
        type: "fill",
        source: "sg",
        "source-layer": "landuse",
        filter: ["in", ["get", "kind"], ["literal", ["park", "nature_reserve", "forest", "golf_course", "grass", "garden", "recreation_ground", "playground", "pitch"]]],
        paint: { "fill-color": C.park },
      },
      {
        id: "green",
        type: "fill",
        source: "sg",
        "source-layer": "landcover",
        filter: ["in", ["get", "kind"], ["literal", ["forest", "grassland", "scrub"]]],
        paint: { "fill-color": C.park, "fill-opacity": 0.7 },
      },
      { id: "water", type: "fill", source: "sg", "source-layer": "water", paint: { "fill-color": C.sea } },
      {
        id: "coast",
        type: "line",
        source: "sg",
        "source-layer": "water",
        paint: { "line-color": C.coast, "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.8, 15, 1.4] },
      },
      {
        id: "buildings",
        type: "fill",
        source: "sg",
        "source-layer": "buildings",
        minzoom: 14,
        paint: { "fill-color": C.building, "fill-outline-color": C.roadMinor },
      },
      road("roads-minor", ["minor_road", "other"], 13, C.roadMinor, ["interpolate", ["linear"], ["zoom"], 13, 0.6, 17, 4]),
      road("roads-medium", ["medium_road"], 12, C.roadMedium, ["interpolate", ["linear"], ["zoom"], 12, 0.6, 17, 6]),
      road("roads-major", ["major_road"], 9, C.roadMajor, ["interpolate", ["linear"], ["zoom"], 9, 0.5, 12, 1.2, 17, 8]),
      road("roads-highway", ["highway"], 8, C.roadHighway, ["interpolate", ["linear"], ["zoom"], 8, 0.8, 12, 1.8, 17, 10]),
      {
        id: "road-labels",
        type: "symbol",
        source: "sg",
        "source-layer": "roads",
        minzoom: 14,
        filter: ["in", ["get", "kind"], ["literal", ["highway", "major_road", "medium_road"]]],
        layout: {
          "symbol-placement": "line",
          "text-field": ["get", "name"],
          "text-font": REGULAR,
          "text-size": 12,
        },
        paint: { "text-color": C.muted, "text-halo-color": C.land, "text-halo-width": 2 },
      },
      {
        id: "places",
        type: "symbol",
        source: "sg",
        "source-layer": "places",
        filter: ["in", ["get", "kind"], ["literal", ["locality", "macrohood", "neighbourhood"]]],
        layout: {
          "text-field": ["get", "name"],
          "text-font": MEDIUM,
          "text-size": ["interpolate", ["linear"], ["zoom"], 9, 12, 14, 14],
          "text-letter-spacing": 0.04,
          "text-max-width": 8,
        },
        paint: { "text-color": C.muted, "text-halo-color": C.land, "text-halo-width": 2 },
      },
    ],
  };
}
