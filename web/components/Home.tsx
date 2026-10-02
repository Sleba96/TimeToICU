"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Footer from "./Footer";
import Sheet from "./Sheet";
import { loadSites, type Site } from "@/lib/data";
import { AIR, RAIN, gradient, type LayerData, type LayerKey } from "@/lib/layers";

const MapView = dynamic(() => import("./MapView"), { ssr: false });
const REFRESH_MS = 60_000;
const LAYER_REFRESH_MS = 300_000;
const CHIPS: [LayerKey, string][] = [
  ["rain", "Rain"],
  ["air", "Air quality"],
];

export default function Home() {
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [layers, setLayers] = useState<Set<LayerKey>>(new Set());
  const [data, setData] = useState<LayerData>({ rain: null, air: null });
  const [loaded, setLoaded] = useState(false);
  const clear = useCallback(() => setSelected(null), []);
  const toggle = (k: LayerKey) =>
    setLayers((prev) => {
      const next = new Set(prev);
      if (!next.delete(k)) next.add(k);
      return next;
    });

  useEffect(() => {
    let live = true;
    const run = () =>
      loadSites().then(
        (s) => live && (setSites(s), setError(null)),
        () => live && setError("Waiting times could not be loaded. Try again in a moment."),
      );
    run();
    const t = setInterval(run, REFRESH_MS);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  // Rain and PM2.5 are fetched only once someone turns a layer on.
  const wanted = layers.size > 0;
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    const run = () =>
      fetch("/api/layers")
        .then((r) => (r.ok ? (r.json() as Promise<LayerData>) : Promise.reject(new Error(String(r.status)))))
        .then((d) => live && (setData(d), setLoaded(true)))
        .catch(() => live && (setData({ rain: null, air: null }), setLoaded(true)));
    run();
    const t = setInterval(run, LAYER_REFRESH_MS);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [wanted]);

  const site = sites.find((s) => s.code === selected) ?? null;
  const missing = loaded ? CHIPS.filter(([k]) => layers.has(k) && !data[k]).map(([, n]) => n) : [];
  const legend = [
    layers.has("rain") && data.rain ? { ...RAIN, key: "rain" } : null,
    layers.has("air") && data.air ? { ...AIR, key: "air" } : null,
  ].filter((x) => x !== null);

  return (
    <div className="app">
      <main className="stage">
        <MapView sites={sites} selected={selected} layers={layers} data={data} onSelect={setSelected} onClear={clear} />
        <div className="chips" role="group" aria-label="Map layers">
          {CHIPS.map(([k, name]) => (
            <button key={k} className="chip" aria-pressed={layers.has(k)} onClick={() => toggle(k)}>
              {name}
            </button>
          ))}
        </div>
        {error && <p className="status" role="status">{error}</p>}
        {!error && missing.length > 0 && (
          <p className="status" role="status">
            {missing.map((n) => `${n} data is unavailable right now.`).join(" ")}
          </p>
        )}
        {site && <Sheet site={site} onClose={clear} />}
      </main>
      {legend.length > 0 && (
        <div className="legend" aria-label="Map legend">
          {legend.map((l) => (
            <div key={l.key} className="legend-row">
              <b>{l.title}</b>
              <span>{l.lo}</span>
              <i style={{ background: gradient(l.rgb) }} aria-hidden="true" />
              <span>{l.hi}</span>
            </div>
          ))}
        </div>
      )}
      <Footer />
    </div>
  );
}
