# Design brief (working draft)

Built together with the author, one decision at a time. Decisions that shape scope or governance are logged in `decisions.md` (D-012).

## Settled

- **First users:** (1) someone worried right now, on a phone; (2) someone curious on a quiet day.
- **Feeling:** calm, trustworthy and precise, human and warm.
- **Author presence:** invisible. Name in the footer and about page only.
- **Not** a data-science dashboard. A user-facing interface.
- **First view:** the map, nothing above it.
- **On a pin:** the current reading as a big number.
- **Detail:** bottom sheet that slides up, map visible behind it. Source caveats and typical range live here.
- **Map layers (v1):** rain, PM2.5, taxi availability, toggleable.
- **995 reminder:** footer and about page only.
- **Later:** itinerary from the visitor's location to a site they choose; taxi features. Never a combined "best option".
- **Visual direction (chosen 2026-10-02):** "Wayfinding". Subtle Singapore signage and clean public-site conventions, serious and precise. Readability comes first.
  - Type: Noto Sans (also gives matching Chinese and Tamil families for later translation). Smallest text 11px labels, 12px body. Tap targets at least 38px.
  - Colour: near-white paper `#ffffff`, ink `#14181f`, muted `#4b5563`, flag red `#c8102e`. Red is used only for the selected site and the 995 marker. Contrast: ink 17.8:1, muted 7.6:1, white on red 5.9:1.
  - Pins: dark sign-panel tag with a white figure, squarer corners (3px), a stem and dot on the true coordinate. Selected pin is red.
  - Sheet: "ED" pictogram square (UCC for Alexandra), figure at 48px, rows for age, usual range and source, then the definition-gap line.
  - Nothing imitates an official banner, crest or logo.
- **Map tint (chosen):** "Water". White land, soft blue sea `#cfe2ef`, pale green parks `#d6e8cf`, coast `#7f9bb0`, grid `#bcd3e2`. Reference: `docs/design/map-tints-mockup.html` (map 1).
- **Sites with no open data (chosen 2026-10-02, D-014):** outlined tag, muted, showing the name and "No data". Quieter than live pins, same tap target, tappable. Overlapping tags are offset from the true spot with a leader line. Sheet: name and "No open waiting time is published for this hospital."; KKH is labelled "Children's emergency department". Selecting a site pans the map so it sits above the sheet. Reference: `docs/design/gap-pins-mockup.html`.
- **Dark mode:** user choice, following the device setting by default. Dark map to be designed from the Water tint.

## Constraints from the data (see `sources.md`)

- Four live sites: TTSH, KTPH, Woodlands Health, Alexandra UCC. Others are shown as labelled gaps (D-003).
- The ED statistic is undefined by the source; Alexandra is not an ED.
- No ranking, sorting or colouring by wait (D-001, D-005).

## Still open

Dark version of the Water map, voice and microcopy, layer visuals for rain, PM2.5 and taxis, map provider and tiles, mobile behaviour of the layer chips.
