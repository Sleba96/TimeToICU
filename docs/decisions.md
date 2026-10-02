# Decision log

Decisions that shape scope, data or governance. Newest first. Each entry says what was decided, why, and what would reopen it.

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
