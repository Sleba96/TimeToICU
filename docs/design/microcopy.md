# Microcopy (draft for review)

English only for v1. Tone: neutral and sober, short sentences, no advice, no ranking. Choices so far (2026-10-02): neutral tone; the caveat gives its reason; a stale figure says since when.

## Footer and chrome

| Where | Text |
| --- | --- |
| Footer | Emergency? Call 995 |
| Footer links | About · Sources |
| Chips | Rain · Air quality |
| Map attribution | © OpenStreetMap contributors |
| Map loading | Loading map… |
| Map failed | The map could not load. Try again. |

## Pins

| Where | Text |
| --- | --- |
| Live pin | 61 and "min", with the site name |
| Gap pin | Site name, then "No data" |

## Legend strip (one row per active layer)

| Layer | Text |
| --- | --- |
| Rain | Rain, last 5 min · 0 mm … 5 mm or more |
| Air | PM2.5, 1 hour · Normal, Elevated, High, Very high (swatches; Normal has no colour) |
| Rain, dry | No rain at the moment. |

## Figures beside sites (zoomed in)

| Layer | Text |
| --- | --- |
| Rain | 0.6 mm rain |
| Air, per region | Normal · 12 µg/m³ (band names: Normal, Elevated, High, Very high; to confirm against NEA) |
| Layer data missing | Rain data is unavailable right now. / Air quality data is unavailable right now. |

## Sheet, site with a figure

| Where | Text |
| --- | --- |
| Eyebrow | Emergency department · Urgent care centre (Alexandra) |
| Figure | 61 minutes |
| Under the figure | Waiting time as published. |
| Under the figure, Alexandra | Waiting time as published. This is not an emergency department. |
| Row | Last checked · 4 minutes ago |
| Row | Usual range · Not enough data yet |
| Row | Taxis free within 2 km · 14 |
| Row | Source · data.gov.sg |
| Stale (more than 30 min unchanged) | This figure has not changed for 45 minutes. |
| No figure yet | No figure received yet. |
| Caveat | The source does not say if this is an average or a median. Sites may measure it differently. |
| Close button (label for screen readers) | Close |

## Sheet, site with no open data

| Where | Text |
| --- | --- |
| Eyebrow | Emergency department · Children's emergency department (KKH) |
| Body | No open waiting time is published for this hospital. |

## About page

**In an emergency, call 995. This site is not for emergency decisions.**

sg-health-monitor shows the emergency waiting times that Singapore publishes as open data, on a map. It does not tell you where to go or when to go, and it does not rank hospitals.

### What the numbers are

Four sites publish a waiting time: Tan Tock Seng Hospital, Khoo Teck Puat Hospital, Woodlands Health, and the Urgent Care Centre at Alexandra Hospital (not an emergency department). The source does not say whether the figure is an average or a median, which patients it covers, or when it was worked out. So the figures at different sites are not guaranteed to mean the same thing, and we do not compare them.

We check the source every few minutes. The time shown on a site is when we last checked, not when the hospital measured it.

### Hospitals with no figure

Six public hospitals do not publish a waiting time as open data: Singapore General Hospital, Changi General Hospital, Sengkang General Hospital, National University Hospital, Ng Teng Fong General Hospital, and KK Women's and Children's Hospital. They appear on the map as "No data", so the gap stays visible.

### Rain, air quality and taxis

Rain and air quality can be shown as colour on the map. Light is less, dark is more, and the legend gives the lowest and highest value. Rain comes from NEA stations and is blended between them, so it is approximate. Air quality (PM2.5) is published for five regions only. Each hospital's sheet shows how many taxis were free within 2 km at the last check. None of this is advice on how or when to travel.

### Sources and licences

- Waiting times: data.gov.sg, ED Waiting Times. Singapore Open Data Licence v1.0.
- Rain and PM2.5: NEA, via data.gov.sg. Taxi availability: LTA, via data.gov.sg. Same licence.
- Map: © OpenStreetMap contributors, under the Open Database Licence.
- Labels: Noto Sans, SIL Open Font Licence 1.1.
- Code: MIT. Data produced by this project: CC BY 4.0.

## Open points

- "Usual range · Not enough data yet" replaces "Collecting data". Say if you prefer the old wording.
- Air band names and limits are confirmed against NEA (haze.gov.sg, 2026-10-02). NEA writes "Very High"; the interface writes "Very high".
- "Children's emergency department" is long for the eyebrow at 11px; it wraps on a narrow phone.
