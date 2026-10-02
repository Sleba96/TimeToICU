# Decision log

Decisions that shape scope, data or governance. Newest first. Each entry says what was decided, why, and what would reopen it.

## D-015 · 2026-10-02 · Layers: colour on the map, figures on zoom (provisional)

**Decision.** Rain, PM2.5 and taxis are toggled by chips. Zoomed out, each active layer paints soft colour on the map, one hue per layer (rain blue, air violet, taxis amber), light for less and dark for more, with a small legend; no red or green (red stays for the selected site and 995). Zoomed in, the colour stays fainter and figures appear beside each site (rain in mm at the nearest station, taxis within 2 km, PM2.5 in µg/m³ with the NEA band name in text). Any combination of layers may be on. Rain starts as a smooth blend between stations. PM2.5 is five soft regional zones, because only five regions are published. Taxi density is read live from the LTA feed and positions are not stored (D-007).

**Provisional.** The smooth rain blend suggests more precision than about 90 stations give. We may return to one cell per station. This supersedes the earlier idea of figures-only layers with NEA band names and no colour. It also changes D-012 in one respect: colour is used for layers, never for ED waits.

**Reopen if** blended rain is read as exact, the three hues are muddy together, or colour on the map hides the ED numbers.

## D-014 · 2026-10-02 · Sites without open data: quiet "No data" tags, tappable, reason-only sheet

**Decision.** The six public sites with `open_data_status = 'not_published'` (SGH, CGH, SKH, NUH, NTFGH, KKH) are shown on the map as outlined tags with the site name and "No data", in muted ink, with the same tap target as live pins. They are quieter than live pins and never coloured or sorted by wait. Where tags would overlap, each tag is offset from the true coordinate and joined to it by a line; this applies to live pins too. Tapping a gap site opens the sheet with its name, the line "No open waiting time is published for this hospital." and nothing else (995 stays in the footer). KKH's sheet is labelled "Children's emergency department". When a site is selected, the map pans so it sits above the sheet. A selected gap site is red, like a live one (D-012).

**Why.** A map with silent holes reads as broken; a labelled gap is honest (D-003). Quieter styling lets live readings stand out without ranking anything. At island scale the central-south sites sit 11 to 20px apart, so names cannot sit under the dot and tags need an automatic offset layout.

**Reopen if** the offset layout cannot keep tags readable at first view, or user testing shows "No data" read as "no wait".

## D-013 · 2026-10-02 · Map: MapLibre with a self-hosted OpenStreetMap extract

**Decision.** The map uses MapLibre GL with a Singapore-only PMTiles file cut from the public Protomaps daily build of OpenStreetMap (`scripts/extract-map.sh`, about 29 MB, zoom 0 to 15). The style is ours, following the chosen Water tint and a dark variant. The tile file is hosted by us and not committed to git. Attribution: "© OpenStreetMap contributors" (ODbL). OneMap stays an option for address search and routing later.

**Why.** The chosen look has to be reproduced exactly, in light and dark, and OneMap tiles cannot be restyled. A self-hosted file has no per-view cost or key. Feasibility was verified on 2026-10-02: the extract took 7 seconds.

**Reopen if** the file's hosting adds cost or latency, or if accuracy at street level proves insufficient for the itinerary phase.

## D-012 · 2026-10-02 · v1 is a map-first public interface; caveats and 995 live in the sheet and footer

**Decision.** The first view is the map. Each site with a feed shows its current reading as a large number on the pin. Tapping a site opens a bottom sheet with the detail, the source definition caveat (statistic undefined; Alexandra is an Urgent Care Centre, not an ED) and the typical range. No text sits above the map. Rain, PM2.5 and taxi availability are toggleable layers. The "call 995" reminder lives in the footer and about page only. Itinerary from the visitor's location and taxi-based features are later phases; v1 leaves room for them.

**Why.** The user's priority is a consumer-facing UX, not a data dashboard. The user judged the statistic caveat not crucial on the pin and chose footer-only for 995; recorded as their explicit sign-off, with the risk noted that the pin number can be read across sites. Pins are never ranked, ordered or coloured by wait (D-001, D-005).

**Reopen if** user testing shows people compare pins as a ranking, or if the 995 placement draws a safety objection. Any routing that combines travel time with waits needs its own decision.

## D-011 · 2026-10-02 · School holidays entered by hand, not collected

**Decision.** `school_holiday` holds MK, primary and secondary school holidays for 2026, typed in from the MOE academic calendar with the source URL and retrieval date. There is no collector.

**Why.** MOE publishes no dataset or API, only an HTML calendar, and its reuse terms are unverified. A scraper would be fragile and would rest on terms nobody has checked; dates change once a year, so a short manual table costs less. School holidays are a plausible driver of paediatric and less urgent attendances, so the dates are worth having.

**Action for the author.** Add 2027 when MOE publishes it, and check MOE's terms before releasing this table in the CC BY export.

## D-010 · 2026-10-02 · ICU epi-week series: assumed week convention, label kept

**Decision.** `icu_epiweek` is stored as three national metrics (`icu_beds_covid`, `icu_beds_noncovid`, `icu_beds_empty`) at location `SG`. Observation time is the Sunday that starts the epi-week, assuming MMWR numbering (week 1 is the first Sunday-to-Saturday week with four days in the year). The original label, for example `2023-09`, is stored in `value_text`.

**Why.** The publisher states neither the unit nor the week-numbering rule. Sunday-to-Saturday weeks are documented for Singapore's infectious-disease bulletin; the week-1 rule is an assumption. Keeping the label means no information is lost if the assumption proves wrong.

**Reopen if** the publisher documents its convention, or the dates look shifted against other series.

## D-009 · 2026-10-02 · Back off on data.gov.sg rate limits

**Decision.** The collector retries HTTP 429 up to three times (2 s, 5 s, 10 s, or `Retry-After`), pauses 1.5 s between holiday datasets, and sends an `x-api-key` header when the `DATA_GOV_SG_API_KEY` function secret is set.

**Why.** The first manual run, which hit six sources at once, got 429 on all nine holiday datasets. The ED feed uses the same anonymous datastore API, so rate limiting is a reliability risk for the core source. **Action for the author:** request a free data.gov.sg API key and set it as an Edge Function secret.

## D-008 · 2026-10-02 · Raw retention differs by source

**Decision.** ED waits and PSI keep every distinct raw payload. Rainfall, air temperature and taxi keep the first payload of each Singapore day, plus the SHA-256 of every payload in `run_log`. Holidays keep every distinct payload.

**Why.** The ED feed has no upstream history, so our copy is the only record. Weather and taxi payloads are large (taxi ~43 KB every 15 min ≈ 1.5 GB/year) and data.gov.sg serves their history by date. Keeping all of them would exhaust the Supabase free tier (500 MB) within months.

**Departs from** the cahier des charges §5 rule "keep every raw payload". Reproducibility for these sources relies on the upstream archive plus our hashes.

**Reopen if** upstream history for weather or taxi disappears, or storage stops being a constraint.

## D-007 · 2026-10-02 · Taxi data aggregated at collection time

**Decision.** Store available-taxi counts within 2 km of each hospital and the island-wide total, not coordinates.

**Why.** Coordinates are about 1,800 points per snapshot. The research question needs local supply near hospitals, not positions. The 2 km radius is pre-registered here, before any modelling, to avoid tuning it to the outcome.

## D-006 · 2026-10-02 · ED freshness is "fetched at", and staleness is inferred

**Decision.** The overview shows when we last fetched each ED value. Whether the source itself is stale is inferred from how long the value has stayed unchanged.

**Why.** The data.gov.sg ED feed has no timestamp field, no metadata endpoint for this dataset, and its `Last-Modified` header equals the fetch time. The feed is polled every 5 minutes at first to measure its real refresh cadence; reduce the cadence once that is known.

## D-005 · 2026-10-02 · ED values are never ranked across sites

**Decision.** `metric.comparable_across_locations = false` for `ed_wait_minutes`. The UI must not sort or rank hospitals by it.

**Why.** The publisher does not define the statistic (mean or median, triage scope). Alexandra Hospital is an Urgent Care Centre, not an ED: it showed 240 minutes while EDs showed 17–64 on 2026-10-02.

## D-004 · 2026-10-02 · Collectors run on Supabase, not GitHub Actions

**Decision.** One Edge Function (`collect`) invoked by `pg_cron` through `pg_net`, authenticated by a shared token stored in Supabase Vault.

**Why.** A 5–15 minute cadence would exceed GitHub's free Actions minutes on a private repo, and GitHub disables scheduled workflows on public repos after 60 days without activity, which would silently end the history. Running inside Supabase also keeps writes and the schedule next to the data.

## D-003 · 2026-10-02 · Hospitals without open data are shown, not hidden

**Decision.** All public emergency facilities are in `hospital`. Those without an open feed have `open_data_status = 'not_published'` and appear on the map as a visible gap.

**Why.** Only TTSH, KTPH, Woodlands Health and the Alexandra UCC publish open data. A map with silent holes reads as broken; a labelled gap is honest and is itself a finding about open health data.

## D-002 · 2026-10-02 · High-risk sources stay off for v1

**Decision.** No collection from the NUHS app, the SingHealth queue page or social media.

**Why.** No open licence; legal ambiguity and maintenance cost. **Reopen if** a cluster data team grants permission.

## D-001 · 2026-10-02 · Positioning: queue transparency

**Decision.** The product presents queue transparency and demand visibility. It does not recommend where or when to go.

**Why.** MOH steers non-urgent cases to GPs and polyclinics. "Quickest option for a non-urgent visit" would push traffic into EDs, and it conflicts with the no-routing rule. A neutral, static pointer to GPs and polyclinics is allowed. Licences: MIT for code, CC BY 4.0 for our own aggregated data.
