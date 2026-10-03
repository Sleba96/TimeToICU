"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Footer from "./Footer";
import Sheet from "./Sheet";
import { loadSites, type Site } from "@/lib/data";
import { CARE_KINDS, CARE_NOTE, CARE_SOURCE } from "@/lib/care";
import { AIR, DENGUE, RAIN, dengueSummary, gradient, tint, type LayerData, type LayerKey } from "@/lib/layers";

const MapView = dynamic(() => import("./MapView"), { ssr: false });
const REFRESH_MS = 60_000;
const LAYER_REFRESH_MS = 900_000;
const LAYER_RETRY_MS = 60_000;
// NEA republishes the cluster file about once a day (D-021): look again twice a day, and again in five minutes after a failure.
const DENGUE_REFRESH_MS = 12 * 3_600_000;
const DENGUE_RETRY_MS = 300_000;
const CHIPS: [LayerKey, string][] = [
  ["rain", "Rain"],
  ["air", "Air quality"],
  ["dengue", "Dengue"],
];

// Fetches `url` while `enabled`, then again after refreshMs (everything present) or retryMs (something missing or failed).
function useRefresh<T>(enabled: boolean, url: string, refreshMs: number, retryMs: number, apply: (d: T) => boolean, done: () => void) {
  const latest = useRef({ apply, done });
  latest.current = { apply, done };
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const run = () =>
      fetch(url)
        .then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(String(r.status)))))
        .then((d) => (live ? latest.current.apply(d) : true), () => false)
        .then((complete) => {
          if (!live) return;
          latest.current.done();
          timer = setTimeout(run, complete ? refreshMs : retryMs);
        });
    run();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [enabled, url, refreshMs, retryMs]);
}

export default function Home() {
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [layers, setLayers] = useState<Set<LayerKey>>(new Set());
  const [data, setData] = useState<LayerData>({ rain: null, air: null, dengue: null });
  const [care, setCare] = useState(false);
  const [loaded, setLoaded] = useState({ layers: false, dengue: false });
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

  // Rain, PM2.5 and dengue are fetched only once someone turns a layer on. Dengue changes about daily, so it is read far less often.
  const wantLayers = layers.has("rain") || layers.has("air");
  useRefresh(wantLayers, "/api/layers", LAYER_REFRESH_MS, LAYER_RETRY_MS, (d: Pick<LayerData, "rain" | "air">) => {
    // A layer that came back empty keeps its last good value; a failed call changes nothing.
    setData((prev) => ({ ...prev, rain: d.rain ?? prev.rain, air: d.air ?? prev.air }));
    return d.rain !== null && d.air !== null;
  }, () => setLoaded((v) => ({ ...v, layers: true })));
  useRefresh(layers.has("dengue"), "/api/dengue", DENGUE_REFRESH_MS, DENGUE_RETRY_MS, (d: Pick<LayerData, "dengue">) => {
    setData((prev) => ({ ...prev, dengue: d.dengue ?? prev.dengue }));
    return d.dengue !== null;
  }, () => setLoaded((v) => ({ ...v, dengue: true })));

  const site = sites.find((s) => s.code === selected) ?? null;
  const missing = CHIPS.filter(([k]) => layers.has(k) && !data[k] && loaded[k === "dengue" ? "dengue" : "layers"]).map(([, n]) => n);
  const showRain = layers.has("rain") && data.rain !== null;
  const showAir = layers.has("air") && data.air !== null;
  const showDengue = layers.has("dengue") && data.dengue !== null;
  const dry = data.rain !== null && data.rain.stations.every((st) => st.mm <= 0);

  return (
    <div className="app">
      <main className="stage">
        <MapView sites={sites} selected={selected} layers={layers} care={care} data={data} onSelect={setSelected} onClear={clear} />
        <div className="chips" role="group" aria-label="Map layers">
          {CHIPS.map(([k, name]) => (
            <button key={k} className="chip" aria-pressed={layers.has(k)} onClick={() => toggle(k)}>
              {name}
            </button>
          ))}
          <button className="chip" aria-pressed={care} onClick={() => setCare((v) => !v)}>
            Hospitals &amp; clinics
          </button>
        </div>
        {error && <p className="status" role="status">{error}</p>}
        {!error && missing.length > 0 && (
          <p className="status" role="status">
            {missing.map((n) => `${n} data is unavailable right now.`).join(" ")}
          </p>
        )}
        {site && <Sheet site={site} onClose={clear} />}
      </main>
      {(showRain || showAir || showDengue || care) && (
        <div className="legend" aria-label="Map legend">
          {showRain && (
            <>
              <div className="legend-row">
                <b>{RAIN.title}</b>
                <span>{RAIN.lo}</span>
                <i style={{ background: gradient(RAIN.rgb) }} aria-hidden="true" />
                <span>{RAIN.hi}</span>
              </div>
              {dry && <p className="legend-note">{RAIN.dry}</p>}
            </>
          )}
          {showAir && (
            <div className="legend-row bands">
              <b>{AIR.title}</b>
              {AIR.bands.map((band) => (
                <span key={band.name} className="band">
                  <i style={{ background: band.alpha === 0 ? "transparent" : tint(AIR.rgb, band.alpha) }} aria-hidden="true" />
                  {band.name}
                </span>
              ))}
            </div>
          )}
          {showDengue && data.dengue && (
            <div className="legend-row bands">
              <b>{DENGUE.title}</b>
              <span className="band">
                <i style={{ background: tint(DENGUE.rgb, 0.35), borderColor: tint(DENGUE.rgb, 1) }} aria-hidden="true" />
                {dengueSummary(data.dengue)}
              </span>
              <p className="legend-note">{DENGUE.note}</p>
            </div>
          )}
          {care && (
            <div className="legend-row bands">
              <b>Hospitals &amp; clinics</b>
              {CARE_KINDS.map((k) => (
                <span key={k.kind} className="band">
                  <i className={`care-key ${k.kind}`} aria-hidden="true" />
                  {k.label}
                </span>
              ))}
              <p className="legend-note">
                {CARE_NOTE} Source: {CARE_SOURCE.source}, {CARE_SOURCE.fetched}.
              </p>
            </div>
          )}
        </div>
      )}
      <Footer />
    </div>
  );
}
