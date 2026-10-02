"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Footer from "./Footer";
import Sheet from "./Sheet";
import { loadSites, type Site } from "@/lib/data";

const MapView = dynamic(() => import("./MapView"), { ssr: false });
const REFRESH_MS = 60_000;

export default function Home() {
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const clear = useCallback(() => setSelected(null), []);

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

  const site = sites.find((s) => s.code === selected) ?? null;

  return (
    <div className="app">
      <main className="stage">
        <MapView sites={sites} selected={selected} onSelect={setSelected} onClear={clear} />
        {error && <p className="status" role="status">{error}</p>}
        {site && <Sheet site={site} onClose={clear} />}
      </main>
      <Footer />
    </div>
  );
}
