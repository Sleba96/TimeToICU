// Builds web/lib/care.json: hospitals and polyclinics of Singapore with coordinates from OneMap (Singapore Land Authority).
// The list of names is curated here, by hand, because no open dataset lists them all (docs/sources.md). A name that OneMap
// does not return exactly fails the run instead of being guessed. Run: node scripts/build-care.mjs
import { writeFileSync } from "node:fs";

// [kind, shown name, OneMap query, text the OneMap result name must contain, which of the matches to take]
const HOSPITAL = "hospital";
const COMMUNITY = "community";
const POLYCLINIC = "polyclinic";
const SITES = [
  [HOSPITAL, "Singapore General Hospital", "Singapore General Hospital", "SINGAPORE GENERAL HOSPITAL"],
  [HOSPITAL, "Changi General Hospital", "Changi General Hospital", "CHANGI GENERAL HOSPITAL"],
  [HOSPITAL, "National University Hospital", "National University Hospital", "NATIONAL UNIVERSITY HOSPITAL", 1],
  [HOSPITAL, "Tan Tock Seng Hospital", "Tan Tock Seng Hospital", "TAN TOCK SENG HOSPITAL"],
  [HOSPITAL, "Khoo Teck Puat Hospital", "Khoo Teck Puat Hospital", "KHOO TECK PUAT HOSPITAL"],
  [HOSPITAL, "Ng Teng Fong General Hospital", "Ng Teng Fong General Hospital", "NG TENG FONG GENERAL HOSPITAL"],
  [HOSPITAL, "Sengkang General Hospital", "Sengkang General Hospital", "SENGKANG GENERAL HOSPITAL"],
  [HOSPITAL, "Woodlands Health", "Woodlands Hospital", "WOODLANDS HOSPITAL"],
  [HOSPITAL, "Alexandra Hospital", "Alexandra Hospital", "ALEXANDRA HOSPITAL"],
  [HOSPITAL, "KK Women's and Children's Hospital", "KK Women's and Children's Hospital", "KK WOMEN'S AND CHILDREN'S HOSPITAL"],
  [HOSPITAL, "Mount Elizabeth Hospital", "Mount Elizabeth Hospital", "MOUNT ELIZABETH HOSPITAL"],
  [HOSPITAL, "Mount Elizabeth Novena Hospital", "Mount Elizabeth Novena Hospital", "MOUNT ELIZABETH NOVENA HOSPITAL"],
  [HOSPITAL, "Gleneagles Hospital", "Gleneagles Hospital", "GLENEAGLES HOSPITAL"],
  [HOSPITAL, "Raffles Hospital", "Raffles Hospital", "RAFFLES HOSPITAL"],
  [HOSPITAL, "Parkway East Hospital", "Parkway East Hospital", "PARKWAY EAST HOSPITAL"],
  [HOSPITAL, "Mount Alvernia Hospital", "Mount Alvernia Hospital", "MOUNT ALVERNIA HOSPITAL"],
  [HOSPITAL, "Farrer Park Hospital", "Farrer Park Hospital", "FARRER PARK HOSPITAL"],
  [COMMUNITY, "Ang Mo Kio-Thye Hua Kwan Hospital", "Ang Mo Kio-Thye Hua Kwan Hospital", "ANG MO KIO-THYE HUA KWAN HOSPITAL"],
  // OneMap has no entry under this name; its address (5 Lorong Napiri) resolves to the same point as OpenStreetMap's.
  [COMMUNITY, "Bright Vision Hospital", "5 Lorong Napiri", "SINGAPORE GENERAL HOSPITAL REHABILITATION MEDICINE"],
  [COMMUNITY, "Jurong Community Hospital", "Jurong Community Hospital", "JURONG COMMUNITY HOSPITAL"],
  [COMMUNITY, "Outram Community Hospital", "Outram Community Hospital", "OUTRAM COMMUNITY HOSPITAL"],
  [COMMUNITY, "Ren Ci Community Hospital", "Ren Ci Community Hospital", "REN CI COMMUNITY HOSPITAL"],
  [COMMUNITY, "St Andrew's Community Hospital", "Saint Andrew's Community Hospital", "SAINT ANDREW'S COMMUNITY HOSPITAL"],
  [COMMUNITY, "St Luke's Hospital", "St Luke's Hospital", "ST LUKE'S HOSPITAL"],
  [COMMUNITY, "Sengkang Community Hospital", "Sengkang Community Hospital", "SENGKANG COMMUNITY HOSPITAL"],
  [COMMUNITY, "Yishun Community Hospital", "Yishun Community Hospital", "YISHUN COMMUNITY HOSPITAL"],
  ...[
    ["Ang Mo Kio", "ANG MO KIO POLYCLINIC"],
    ["Bedok", "(BEDOK POLYCLINIC)"],
    ["Bidadari", "BIDADARI POLYCLINIC"],
    ["Bukit Batok", "BUKIT BATOK POLYCLINIC"],
    ["Bukit Merah", "(BUKIT MERAH POLYCLINIC)"],
    ["Bukit Panjang", "(BUKIT PANJANG POLYCLINIC)"],
    ["Choa Chu Kang", "CHOA CHU KANG POLYCLINIC"],
    ["Clementi", "(CLEMENTI POLYCLINIC)"],
    ["Eunos", "EUNOS POLYCLINIC"],
    ["Geylang", "GEYLANG POLYCLINIC"],
    ["Hougang", "HOUGANG POLYCLINIC"],
    ["Jurong", "(JURONG POLYCLINIC)"],
    ["Kallang", "KALLANG POLYCLINIC"],
    ["Khatib", "KHATIB POLYCLINIC"],
    ["Marine Parade", "(MARINE PARADE POLYCLINIC)"],
    ["Outram", "(OUTRAM POLYCLINIC)"],
    ["Pasir Ris", "PASIR RIS POLYCLINIC"],
    ["Pioneer", "PIONEER POLYCLINIC"],
    ["Punggol", "(PUNGGOL POLYCLINIC)"],
    ["Queenstown", "QUEENSTOWN POLYCLINIC"],
    ["Sembawang", "(SEMBAWANG POLYCLINIC)"],
    ["Sengkang", "(SENGKANG POLYCLINIC)"],
    ["Serangoon", "SERANGOON POLYCLINIC"],
    ["Tampines", "TAMPINES POLYCLINIC"],
    ["Tampines North", "TAMPINES NORTH POLYCLINIC"],
    ["Toa Payoh", "TOA PAYOH POLYCLINIC"],
    ["Woodlands", "(WOODLANDS POLYCLINIC)"],
    ["Yishun", "YISHUN POLYCLINIC"],
  ].map(([n, match]) => [POLYCLINIC, `${n} Polyclinic`, `${n} polyclinic`, match]),
];

const out = [];
for (const [kind, name, query, match, take = 0] of SITES) {
  const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=N`;
  let res = await fetch(url);
  for (let wait = 2000; res.status === 429 && wait <= 16000; wait *= 2) {
    await new Promise((r) => setTimeout(r, wait));
    res = await fetch(url);
  }
  if (!res.ok) throw new Error(`OneMap ${res.status} for ${name}`);
  await new Promise((r) => setTimeout(r, 700)); // OneMap rate-limits quick bursts
  // Exact names first, so "Tan Tock Seng Hospital" is not a department that merely mentions it.
  const hits = (await res.json()).results
    .filter((r) => r.SEARCHVAL.includes(match))
    .sort((a, b) => Number(b.SEARCHVAL === match) - Number(a.SEARCHVAL === match));
  const hit = hits[take];
  if (!hit) throw new Error(`No OneMap result containing "${match}" for ${name}`);
  out.push({ name, kind, lat: Number(Number(hit.LATITUDE).toFixed(5)), lon: Number(Number(hit.LONGITUDE).toFixed(5)) });
}
const file = new URL("../web/lib/care.json", import.meta.url);
writeFileSync(file, JSON.stringify({ source: "OneMap (Singapore Land Authority), names curated by hand", fetched: new Date().toISOString().slice(0, 10), sites: out }, null, 1) + "\n");
console.log(`${out.length} sites written`);
