# sg-health-monitor

**Not for emergency decisions. In an emergency, call 995.**

A public, documented record of emergency-department queues in Singapore, built only from open data. It collects published waiting times every few minutes, keeps the raw responses, and shows what is and is not openly published.

Project name: `sg-health-monitor` (final). The GitHub repository is still called TimeToICU and the Supabase project `sg-queue-monitor`; both are display names only.

## What it does today

- Collects ED waiting times for the four sites that publish open data (TTSH, KTPH, Woodlands Health, Alexandra Hospital Urgent Care Centre) every 5 minutes.
- Collects context for later research: rainfall, air temperature, PSI, 24-hour and 1-hour PM2.5, taxi availability near each hospital, public holidays, school holidays (entered by hand), and the national ICU utilisation series by epi-week (2023-09 to 2024-08).
- Logs every run, keeps raw payloads under a documented retention policy, and flags schema changes and unknown labels instead of guessing.

The web interface is not built yet. Design starts from a written brief, not a template.

## What it will not do

- Recommend where or when to go, triage, or give clinical advice.
- Rank hospitals: the published figures are not defined consistently across sites.
- Collect personal or patient data.

## How it works

```
pg_cron ──► Edge Function `collect` ──► upstream open APIs
                 │
                 └─► ingest_run() ──► raw_payload · run_log · observation
```

One Postgres store (Supabase, Singapore region). Every observation links to the run that produced it, and every run links to the raw payload it parsed.

- `supabase/migrations/`: schema, reference data, schedule
- `supabase/functions/collect/`: collectors; parsers are pure functions in `sources.ts`
- `tests/`: parser tests against real recorded payloads
- `docs/decisions.md`: decision log
- `docs/sources.md`: source catalogue, verified endpoints and known quirks
- `docs/setup.md`: deployment and health checks

## Data and licences

- Code: MIT (see `LICENSE`).
- Our aggregated data: CC BY 4.0 (see `DATA_LICENSE.md`).
- Upstream data: Singapore Open Data Licence v1.0 (data.gov.sg). Hong Kong Hospital Authority data, used only as a benchmark, is subject to its own terms and is not redistributed.

## Development

```
npm test   # Node 22.6+
```
