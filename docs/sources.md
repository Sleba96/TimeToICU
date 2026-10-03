# Source catalogue

Verified by direct requests on 2026-10-02. Fixtures in `tests/fixtures/` are the real responses from that day.

| Source | Endpoint | Shape | Timestamp | Status |
| --- | --- | --- | --- | --- |
| ED waiting times | `data.gov.sg/api/action/datastore_search?resource_id=d_9d0bbe366aee923a6e202f80bb356bb9` | 4 records: `hospital` (text), `minutes` (text) | **None** | Collected every 5 min |
| Rainfall | `api-open.data.gov.sg/v2/real-time/api/rainfall` | ~90 stations, 5-min reading | Yes | Collected every 5 min |
| Air temperature | `api-open.data.gov.sg/v2/real-time/api/air-temperature` | ~18 stations | Yes | Collected every 15 min |
| PSI / PM2.5 | `api-open.data.gov.sg/v2/real-time/api/psi` | 5 regions, 12 readings | Yes (hourly) | Collected hourly |
| PM2.5 1-hour | `api-open.data.gov.sg/v2/real-time/api/pm25` | 5 regions, `pm25_one_hourly` | Yes (on the hour, published ~30 min later) | Collected hourly at minute 36 |
| Taxi availability | `api.data.gov.sg/v1/transport/taxi-availability` | GeoJSON MultiPoint, ~1,800 points, 43 KB | Yes | Collected every 15 min, aggregated |
| Dengue clusters | `data.gov.sg/api/action/datastore_search_sql?sql=SELECT%20*%20FROM%20%22d_dbfabf16158d1b0e1c420627c0819168%22` | GeoJSON FeatureCollection, polygons with case counts | Yes | Collected hourly; near-real-time clusters (2+ cases, 14 days, 150m radius) |
| Public holidays | `api-production.data.gov.sg/v2/public/api/collections/691/metadata` then each child dataset | `date`, `day`, `holiday` | n/a | Collected daily |
| ICU utilisation by epi-week | datastore `d_ac42b0ea4ae0528bc9dbef90f0658f2b` | `epi_year`, `epi_week`, `status` (COVID / Non-COVID / Empty), `count` | Epi-week | Collected daily; static series, 156 rows covering epi-weeks 2023-09 to 2024-08 |
| Admissions 1984–2020 | datastore `d_a5267c58f60b20f8e04576261abfac93` | Annual, 296 rows, many nulls | Year | Context only |
| Beds in inpatient facilities | datastore `d_0f8f02e6e821fc88aa96442656b69241` | Annual series | Year | Context only |
| Hong Kong A&E | `api.data.gov.hk/v1/historical-archive/...` for `ha.org.hk/opendata/aed/aedwtdata2-en.json` | Per hospital: `t1wt`, `t2wt`, `t3p50`, `t3p95`, `t45p50`, `t45p95` as text ("1.5 hours", "less than 15 minutes") | `updateTime` | Benchmark; archive from 2025-10-13 at 15 min |
| OneMap search | `onemap.gov.sg/api/common/elastic/search` | Geocoding | n/a | Hospital coordinates, and the hospitals and polyclinics layer (`scripts/build-care.mjs`, D-020); rate-limits quick bursts (429) |

## Not yet reachable or not yet verified

- **MOH waiting time for admission to ward**: `www.moh.gov.sg` returned 403 from the build environment. Format and reuse terms unverified.
- **CDA Weekly Infectious Disease Bulletin**: `www.cda.gov.sg` and `isomer-user-content.by.gov.sg` returned 403. PDF only.
- **LTA DataMall**: needs an API key.
- **Hong Kong before 2025-10-13**: the revised dataset has no earlier versions. The old URL (`aedwtdata-en.json`) now returns a notice; its archive and schema are unexplored.

## Known quirks

- ED: `minutes` is text. Labels include an en dash ("Alexandra Hospital (AH) – Urgent Care Centre"). Unknown labels are logged as `unknown_location`, never guessed.
- ED: the dataset is titled "ED Waiting Times (2025)" in search results. If data.gov.sg publishes a new dataset per year, the collector will keep reading the old one; watch for values that stop changing.
- data.gov.sg CKAN `package_show` is behind a Cloudflare challenge; the v2 metadata API does not know this dataset id.
- data.gov.sg rate-limits anonymous datastore calls (HTTP 429 seen on 2026-10-02 when several requests ran together). See decision D-009.
- Care facilities: no open dataset lists every hospital and polyclinic. CHAS clinics (1,193 points, 2024-06) carry no hours; the polyclinic vaccination dataset has 8 sites. The map layer therefore uses a hand-kept list of names geocoded by OneMap (D-020). OneMap did not know "Bright Vision Hospital" by name; its address resolves.
