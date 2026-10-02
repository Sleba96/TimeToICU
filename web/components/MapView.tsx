"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import { style } from "@/lib/mapStyle";
import type { Site } from "@/lib/data";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const BOUNDS: maplibregl.LngLatBoundsLike = [[103.55, 1.15], [104.12, 1.5]];
const SHEET_PAD = 300;

function pinLabel(s: Site) {
  const what = s.facility === "UCC" ? "urgent care centre" : "emergency department";
  return `${s.name}, ${what}${s.minutes === null ? ", no figure" : `, ${Math.round(s.minutes)} minutes`}`;
}

function buildPin(s: Site, onSelect: (code: string) => void) {
  const el = document.createElement("button");
  el.className = "pin" + (s.minutes === null ? " nodata" : "");
  el.setAttribute("aria-label", pinLabel(s));
  const tag = document.createElement("span");
  tag.className = "tag";
  const b = document.createElement("b");
  b.textContent = s.minutes === null ? "–" : String(Math.round(s.minutes));
  const i = document.createElement("i");
  i.textContent = s.facility === "UCC" ? "UCC min" : "min";
  tag.append(b, i);
  const stem = Object.assign(document.createElement("span"), { className: "stem" });
  const dot = Object.assign(document.createElement("span"), { className: "dot" });
  const nm = Object.assign(document.createElement("span"), { className: "nm", textContent: s.short });
  el.append(tag, stem, dot, nm);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(s.code);
  });
  return el;
}

export default function MapView({
  sites,
  selected,
  onSelect,
  onClear,
}: {
  sites: Site[];
  selected: string | null;
  onSelect: (code: string) => void;
  onClear: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLElement }>>(new Map());
  const callbacks = useRef({ onSelect, onClear });
  callbacks.current = { onSelect, onClear };
  const fitted = useRef(false);

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
    map.current = m;
    const store = markers.current;
    return () => {
      store.forEach(({ marker }) => marker.remove());
      store.clear();
      m.remove();
      map.current = null;
      fitted.current = false;
      maplibregl.removeProtocol("pmtiles");
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    for (const s of sites) {
      seen.add(s.code);
      const old = markers.current.get(s.code);
      if (old) old.marker.remove();
      const el = buildPin(s, (c) => callbacks.current.onSelect(c));
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, 4] }).setLngLat([s.lon, s.lat]).addTo(m);
      markers.current.set(s.code, { marker, el });
    }
    markers.current.forEach((v, code) => {
      if (!seen.has(code)) {
        v.marker.remove();
        markers.current.delete(code);
      }
    });
    if (!fitted.current && sites.length > 0) {
      fitted.current = true;
      const b = new maplibregl.LngLatBounds();
      sites.forEach((s) => b.extend([s.lon, s.lat]));
      m.fitBounds(b, { padding: { top: 90, bottom: 90, left: 70, right: 70 }, maxZoom: 13, duration: 0 });
    }
  }, [sites]);

  useEffect(() => {
    markers.current.forEach(({ el }, code) => el.classList.toggle("sel", code === selected));
    const m = map.current;
    const s = sites.find((x) => x.code === selected);
    if (m && s) {
      m.easeTo({ center: [s.lon, s.lat], padding: { bottom: window.innerWidth < 720 ? SHEET_PAD : 0 }, duration: 300 });
    } else if (m) {
      m.easeTo({ padding: { bottom: 0 }, duration: 200 });
    }
  }, [selected, sites]);

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
