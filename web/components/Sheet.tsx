"use client";

import { useEffect, useRef } from "react";
import { agoText, durationText, type Site } from "@/lib/data";

const STALE_AFTER_MIN = 30;

function eyebrow(f: Site["facility"]) {
  return f === "UCC" ? "Urgent care centre" : f === "CHILDREN_ED" ? "Children's emergency department" : "Emergency department";
}

export default function Sheet({ site, onClose }: { site: Site; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [site.code, onClose]);

  const ucc = site.facility === "UCC";
  const stale = site.unchangedMin !== null && site.unchangedMin >= STALE_AFTER_MIN;

  return (
    <section ref={ref} tabIndex={-1} className="sheet" aria-label={site.name}>
      <div className="grab" aria-hidden="true" />
      <div className={"sheet-head" + (site.open ? "" : " gap")}>
        <span className="sign" aria-hidden="true">{ucc ? "UCC" : "ED"}</span>
        <div>
          <p className="eyebrow">{eyebrow(site.facility)}</p>
          <h2>{site.name}</h2>
        </div>
        <button className="close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l12 12M16 4L4 16" />
          </svg>
        </button>
      </div>

      {!site.open ? (
        <p className="reason">
          {site.status === "paused"
            ? "The published figure for this site looks out of date, so it is not shown."
            : "No open waiting time is published for this hospital."}
        </p>
      ) : (
        <>
          {site.minutes === null ? (
            <p className="sub">No figure received yet.</p>
          ) : (
            <>
              <div className="big">
                <b>{Math.round(site.minutes)}</b>
                <span>minutes</span>
              </div>
              <p className="sub">Waiting time as published{ucc ? ". This is not an emergency department." : "."}</p>
            </>
          )}

          <dl>
            <div>
              <dt>Last checked</dt>
              <dd>{site.checkedAt ? agoText(site.checkedAt) : "Not yet"}</dd>
            </div>
            <div>
              <dt>Usual range</dt>
              <dd>Not enough data yet</dd>
            </div>
            {site.taxis !== null && (
              <div>
                <dt>Taxis free within 2 km</dt>
                <dd>{site.taxis}</dd>
              </div>
            )}
            <div>
              <dt>Source</dt>
              <dd>data.gov.sg</dd>
            </div>
          </dl>
          {stale && site.unchangedMin !== null && <p className="stale">This figure has not changed for {durationText(site.unchangedMin)}.</p>}
          <p className="caveat">The source does not say if this is an average or a median. Sites may measure it differently.</p>
        </>
      )}
    </section>
  );
}
