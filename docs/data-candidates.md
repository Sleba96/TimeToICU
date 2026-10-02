# Health data candidates for Singapore (research 2026-10-02)

Checked on 2026-10-02 from the build environment. "Open licence" means the Singapore Open Data Licence on data.gov.sg. Nothing here is collected yet.

## First: is the ED waiting-time feed current? Probably not (D-016)

What we poll: `data.gov.sg/api/action/datastore_search?resource_id=d_9d0bbe366aee923a6e202f80bb356bb9`, titled "ED Waiting Times (2025)". It returns four rows with no timestamp of any kind; the `Last-Modified` header is simply the time of the request.

- Our own history: all four values were identical on 68 consecutive polls over 5.5 hours (TTSH 61, KTPH 64, Woodlands 17, Alexandra UCC 240). Calling the source directly returns the same numbers.
- A search result for the dataset page shows "Last updated: 19 Aug 2025".
- The dataset is not in the current public catalogue (1,290 datasets listed through the v2 API; the list may be incomplete), the v2 metadata endpoint answers that the id does not exist, and the dataset page says "Dataset not found ... or this dataset has been unpublished". The old datastore endpoint still serves the four rows.
- The NUHS page, which is live, said at 17:30 SGT on 2026-10-02 that Alexandra UCC's estimated wait to see a doctor was under 1 hour. Our feed says 240 minutes.

This is strong evidence, not proof. The figures should not be presented as current.

## Official data that is current

| Data | Source | Update | Licence | Map use | Notes |
| --- | --- | --- | --- | --- | --- |
| Daily ED attendances for AH, CGH, KTPH, NTFGH, NUH (adults), SGH, SKH, TTSH, WH | [MOH, Attendances at Emergency Medicine Departments](https://www.moh.gov.sg/others/resources-and-statistics/healthcare-institution-statistics-attendances-at-emergency-medicine-departments/) (Excel, one sheet from 2023-01-01, one for the latest week) | Weekly; latest day 26 Sep 2026, page updated 2 Oct 2026 | Not stated: "© 2026 Government of Singapore" and Terms of Use, no open licence | Covers five of the six hospitals with no waiting-time feed, and gives a real "usual for this weekday" range for all eight | Counts visits, not waiting time. Excludes KKH and NUH children's. Terms of reuse must be checked with MOH. |
| Dengue clusters | NEA, [data.gov.sg d_dbfabf16...](https://data.gov.sg/datasets/d_dbfabf16158d1b0e1c420627c0819168/view), GeoJSON polygons with case count | Near real time; last updated 2026-10-02 10:06 SGT | Open licence | Polygons on the map | A cluster is two or more cases within 14 days and 150 m. Strongest candidate. |
| Public access AEDs | SCDF, [data.gov.sg d_4e6b82c5...](https://data.gov.sg/datasets/d_4e6b82c58a8a832f6f1fee5dfa6d47ea/view), GeoJSON points, 6.9 MB | 13 Nov 2025 | Open licence | Points | The data page itself points to the myResponder app for the latest locations. |
| CHAS clinics | MOH, [data.gov.sg d_548c33ea...](https://data.gov.sg/datasets/d_548c33ea2d99e29ec63a7cc9edcccedc/view), about 1,190 points | 6 Jun 2024 | Open licence | Points | Old. Not a measure of opening hours or capacity. |
| Polyclinic vaccination sites; cervical and breast screening centres | MOH and HPB on data.gov.sg (`d_b22489c7...`, `d_3ca2a280...`, `d_0cdfbf7e...`) | Nov 2025 to Jan 2026 | Open licence | Points | Minor. |
| Heat stress (WBGT) | NEA, [data.gov.sg d_87884af1...](https://data.gov.sg/datasets/d_87884af1f85d702d4f74c6af13b4853d/view) | Every 15 minutes | Open licence | Nine sensors, levels low, moderate, high | Few sensors, mostly sports sites. |
| UV index | NEA real-time API (`/v2/real-time/api/uv`) | Hourly | Open licence | One island-wide value | Not map-shaped. |
| Admissions to public hospitals, monthly | SingStat, [data.gov.sg d_1338b55f...](https://data.gov.sg/datasets/d_1338b55f6d4ea6b2df9884ec4bce4464/view) | Updated 2026-08-26 | Open licence | Chart, not a map | National, monthly. |
| Hospital beds by facility type and planning region | SingStat, `d_0ed27481...` | Annual, 2026-05 | Open licence | Region shading | Annual. |

Already collected: rainfall, air temperature, PM2.5, taxi availability, holidays, ICU utilisation (to 2024-08).

## Live but not open

| Data | Source | Why not |
| --- | --- | --- |
| Wait to see a doctor and bed wait, for NUH ED, NUH Children's, NTFGH and Alexandra UCC | [NUHS, Emergency Department Wait Times](https://www.nuhs.edu.sg/patient-care/emergency-department-wait-times), "last updated 02 Oct 2026, 05:30:03 PM" | No open licence (D-002). Would cover three of the six gap hospitals. Ask NUHS for permission or a feed. |
| Estimated wait and patients waiting for TTSH, KTPH and Woodlands | NHG hospital websites | Not verified (the pages returned HTTP 429 to the checker). Same licence question. |
| SGH, CGH, SKH | SingHealth Health Buddy app | Queue tracking is for clinic registration; no ED wait figure was found. |

## Not usable for a map

Weekly infectious disease bulletin on data.gov.sg stops at 2022 (the current bulletin is on the CDA site as reports); COVID series stop in 2024; aedes breeding habitats and dengue case geojsons stop in 2024.
