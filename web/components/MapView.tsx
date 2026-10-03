"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import { style } from "@/lib/mapStyle";
import type { Site } from "@/lib/data";
import { placeTags, type Rect, type TagBox } from "@/lib/placement";
import { DENGUE, FIELD_COORDS, airBand, dengueText, airField, nearestRain, rainField, rainText, type LayerData, type LayerKey } from "@/lib/layers";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const BOUNDS: maplibregl.LngLatBoundsLike = [[103.55, 1.15], [104.12, 1.5]];
const SHEET_PAD = 300;
const NEAR_ZOOM = 12; // from here, rain figures appear beside each site
const MID_ZOOM = 11; // from here, the air regions are labelled

type Entry = { marker: maplibregl.Marker; root: HTMLElement; tag: HTMLElement; lead: HTMLElement; pill: HTMLElement; site: Site };

function pinLabel(s: Site) {
  const what = s.facility === "UCC" ? "urgent care centre" : s.facility === "CHILDREN_ED" ? "children's emergency department" : "emergency department";
  if (!s.open) return `${s.name}, ${what}, ${s.status === "paused" ? "waiting time not current, not shown" : "no open waiting time published"}`;
  return `${s.name}, ${what}${s.minutes === null ? ", no figure" : `, ${Math.round(s.minutes)} minutes`}`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// A site sits on its true coordinate (the dot). Its tag is offset from the dot with a leader line, so tags never overlap (D-014).
function buildSite(s: Site, onSelect: (code: string) => void): Omit<Entry, "marker"> {
  const root = el("div", "site" + (s.open ? "" : " gap"));
  const lead = el("span", "lead");
  const dot = el("span", "dot");
  const pill = el("span", "pill");
  const tag = el("button", "tag");
  tag.type = "button";
  tag.setAttribute("aria-label", pinLabel(s));
  if (s.open) {
    tag.append(el("b", "", s.minutes === null ? "–" : String(Math.round(s.minutes))), el("i", "", "min"), el("small", "", s.short));
  } else {
    tag.append(el("small", "", s.short), el("b", "", "No data"));
  }
  tag.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(s.code);
  });
  root.append(lead, dot, pill, tag);
  return { root, tag, lead, pill, site: s };
}

export default function MapView({
  sites,
  selected,
  layers,
  data,
  onSelect,
  onClear,
}: {
  sites: Site[];
  selected: string | null;
  layers: Set<LayerKey>;
  data: LayerData;
  onSelect: (code: string) => void;
  onClear: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const entries = useRef<Map<string, Entry>>(new Map());
  const airMarkers = useRef<maplibregl.Marker[]>([]);
  const dengueMarkers = useRef<maplibregl.Marker[]>([]);
  const callbacks = useRef({ onSelect, onClear });
  callbacks.current = { onSelect, onClear };
  const live = useRef({ layers, data });
  live.current = { layers, data };
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);

  // Place every tag at the first offset that overlaps nothing already placed. Live sites go first, so they keep the best spots.
  const layout = useRef(() => {});
  layout.current = () => {
    const m = map.current;
    const container = box.current;
    if (!m || !container) return;
    const z = m.getZoom();
    container.classList.toggle("near", z >= NEAR_ZOOM);
    container.classList.toggle("mid", z >= MID_ZOOM);
    container.classList.toggle("l-rain", live.current.layers.has("rain"));
    container.classList.toggle("l-air", live.current.layers.has("air"));
    container.classList.toggle("l-dengue", live.current.layers.has("dengue"));
    const { clientWidth: W, clientHeight: H } = container;
    const list = [...entries.current.values()].sort((a, b) =>
      a.site.open === b.site.open ? a.site.code.localeCompare(b.site.code) : a.site.open ? -1 : 1,
    );
    const rain = live.current.data.rain;
    const obstacles: Rect[] = [];
    const boxes: TagBox[] = [];
    for (const e of list) {
      const p = m.project([e.site.lon, e.site.lat]);
      obstacles.push([p.x - 5, p.y - 5, p.x + 5, p.y + 5]);
      const showPill = live.current.layers.has("rain") && !!rain && z >= NEAR_ZOOM;
      const text = showPill && rain ? rainText(nearestRain(rain, e.site.lat, e.site.lon)) : "";
      if (e.pill.textContent !== text) e.pill.textContent = text;
      if (showPill) obstacles.push([p.x - e.pill.offsetWidth / 2, p.y + 8, p.x + e.pill.offsetWidth / 2, p.y + 8 + e.pill.offsetHeight]);
      boxes.push({ id: e.site.code, x: p.x, y: p.y, w: e.tag.offsetWidth || 70, h: e.tag.offsetHeight || 44 });
    }
    const offsets = placeTags(boxes, obstacles, { width: W, height: H, top: 56 });
    for (const e of list) {
      const [dx, dy] = offsets.get(e.site.code) ?? [0, -22];
      e.tag.style.left = `${dx}px`;
      e.tag.style.top = `${dy}px`;
      e.lead.style.width = `${Math.hypot(dx, dy)}px`;
      e.lead.style.transform = `rotate(${(Math.atan2(dy, dx) * 180) / Math.PI}deg)`;
    }
  };

  useEffect(() => {
    if (!box.current) return;
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    const tiles =
      process.env.NEXT_PUBLIC_MAP_URL ??
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/map/singapore.pmtiles`;
    const m = new maplibregl.Map({
      container: box.current,
      style: style(tiles, window.location.origin),
      bounds: [[103.6, 1.22], [104.05, 1.48]],
      maxBounds: BOUNDS,
      minZoom: 9,
      maxZoom: 18,
      attributionControl: { compact: false },
      dragRotate: false,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 80 }), "bottom-left");
    m.on("click", () => callbacks.current.onClear());
    m.on("move", () => layout.current());
    m.on("resize", () => layout.current());
    m.on("load", () => setReady(true));
    map.current = m;
    const store = entries.current;
    return () => {
      store.forEach(({ marker }) => marker.remove());
      store.clear();
      airMarkers.current.forEach((a) => a.remove());
      airMarkers.current = [];
      dengueMarkers.current.forEach((a) => a.remove());
      dengueMarkers.current = [];
      m.remove();
      map.current = null;
      fitted.current = false;
      setReady(false);
      maplibregl.removeProtocol("pmtiles");
    };
  }, []);

  // Sites: one marker each, with or without a figure.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    for (const s of sites) {
      seen.add(s.code);
      entries.current.get(s.code)?.marker.remove();
      const built = buildSite(s, (c) => callbacks.current.onSelect(c));
      const marker = new maplibregl.Marker({ element: built.root, anchor: "center" }).setLngLat([s.lon, s.lat]).addTo(m);
      entries.current.set(s.code, { ...built, marker });
    }
    entries.current.forEach((v, code) => {
      if (!seen.has(code)) {
        v.marker.remove();
        entries.current.delete(code);
      }
    });
    if (!fitted.current && sites.length > 0) {
      fitted.current = true;
      const b = new maplibregl.LngLatBounds();
      sites.forEach((s) => b.extend([s.lon, s.lat]));
      m.fitBounds(b, { padding: { top: 110, bottom: 70, left: 60, right: 60 }, maxZoom: 13, duration: 0 });
    }
    entries.current.forEach(({ root, site }, code) => {
      root.classList.toggle("sel", code === selected);
      root.style.zIndex = code === selected ? "3" : site.open ? "2" : "1";
    });
    layout.current();
  }, [sites, selected]);

  // Selecting a site moves the map so the site sits above the sheet.
  useEffect(() => {
    const m = map.current;
    const s = sites.find((x) => x.code === selected);
    if (m && s) {
      m.easeTo({ center: [s.lon, s.lat], padding: { bottom: window.innerWidth < 720 ? SHEET_PAD : 0 }, duration: 300 });
    } else if (m) {
      m.easeTo({ padding: { bottom: 0 }, duration: 200 });
    }
  }, [selected, sites]);

  // Colour layers: soft images under the water and coast, so only land is tinted.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const images: [LayerKey, string | null][] = [
      ["air", data.air ? airField(data.air) : null],
      ["rain", data.rain ? rainField(data.rain) : null],
    ];
    for (const [key, url] of images) {
      const src = m.getSource(key) as maplibregl.ImageSource | undefined;
      if (url) {
        if (src) src.updateImage({ url, coordinates: FIELD_COORDS });
        else {
          m.addSource(key, { type: "image", url, coordinates: FIELD_COORDS });
          m.addLayer(
            {
              id: key,
              type: "raster",
              source: key,
              paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 11, 1, 14, 0.55], "raster-fade-duration": 0 },
            },
            "water",
          );
        }
      }
      if (m.getLayer(key)) m.setLayoutProperty(key, "visibility", layers.has(key) && url ? "visible" : "none");
    }
    layout.current();
  }, [ready, data, layers]);

  // Dengue clusters: each outline from a close zoom, and a dot sized by cases so clusters stay visible zoomed out.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const d = data.dengue;
    const fc = (features: object[]) => ({ type: "FeatureCollection", features }) as unknown as maplibregl.GeoJSONSourceSpecification["data"];
    const polys = fc((d?.clusters ?? []).map((c) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [c.ring] } })));
    const dots = fc((d?.clusters ?? []).map((c) => ({ type: "Feature", properties: { cases: c.cases }, geometry: { type: "Point", coordinates: [c.lon, c.lat] } })));
    const color = `rgb(${DENGUE.rgb.join(",")})`;
    const src = m.getSource("dengue") as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(polys);
      (m.getSource("dengue-dots") as maplibregl.GeoJSONSource).setData(dots);
    } else {
      m.addSource("dengue", { type: "geojson", data: polys });
      m.addSource("dengue-dots", { type: "geojson", data: dots });
      m.addLayer({ id: "dengue-fill", type: "fill", source: "dengue", paint: { "fill-color": color, "fill-opacity": 0.35 } }, "water");
      m.addLayer({ id: "dengue-line", type: "line", source: "dengue", paint: { "line-color": color, "line-width": 1.5 } }, "water");
      m.addLayer(
        {
          id: "dengue-dot",
          type: "circle",
          source: "dengue-dots",
          paint: {
            "circle-color": color,
            "circle-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.55, 14, 0],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
            "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 12, 1, 14, 0],
            "circle-radius": ["min", 18, ["+", 5, ["*", 2.2, ["sqrt", ["get", "cases"]]]]],
          },
        },
        "water",
      );
    }
    const show = layers.has("dengue") && !!d;
    for (const id of ["dengue-fill", "dengue-line", "dengue-dot"]) m.setLayoutProperty(id, "visibility", show ? "visible" : "none");
    dengueMarkers.current.forEach((a) => a.remove());
    dengueMarkers.current = [];
    for (const c of d?.clusters ?? []) {
      const label = el("div", "dnglbl", dengueText(c.cases));
      dengueMarkers.current.push(new maplibregl.Marker({ element: label, anchor: "center" }).setLngLat([c.lon, c.lat]).addTo(m));
    }
    layout.current();
  }, [ready, data.dengue, layers]);

  // Air region labels: shown from a closer zoom, with the NEA band name in text.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    airMarkers.current.forEach((a) => a.remove());
    airMarkers.current = [];
    if (!data.air) return;
    for (const r of data.air.regions) {
      const label = el("div", "airlbl");
      label.append(el("span", "", r.name[0].toUpperCase() + r.name.slice(1)), el("b", "", `${airBand(r.v)} · ${Math.round(r.v)} µg/m³`));
      airMarkers.current.push(new maplibregl.Marker({ element: label, anchor: "center" }).setLngLat([r.lon, r.lat]).addTo(m));
    }
  }, [data.air, ready]);

  return (
    <>
      <div ref={box} className="map" role="application" aria-label="Map of Singapore with emergency waiting times" />
      <div className="north" aria-hidden="true">
        N
        <svg width="10" height="12" viewBox="0 0 10 12"><path d="M5 0l5 12-5-3-5 3z" fill="#14181f" /></svg>
      </div>
    </>
  );
}
