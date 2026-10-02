import Link from "next/link";

export const metadata = { title: "About · sg-health-monitor" };

export default function About() {
  return (
    <main className="page">
      <Link className="back" href="/">← Map</Link>
      <h1>About</h1>
      <p className="emergency">In an emergency, call 995. This site is not for emergency decisions.</p>

      <p>
        sg-health-monitor shows the emergency waiting times that Singapore publishes as open data, on a map. It does not tell
        you where to go or when to go, and it does not rank hospitals.
      </p>

      <h2>What the numbers are</h2>
      <p>
        Four sites have a waiting time on data.gov.sg: Tan Tock Seng Hospital, Khoo Teck Puat Hospital, Woodlands Health, and
        the Urgent Care Centre at Alexandra Hospital (not an emergency department). That figure looks out of date. Its dataset
        is titled &ldquo;ED Waiting Times (2025)&rdquo;, it carries no date, and it has not changed since we began checking on
        2 October 2026. At Alexandra it also disagrees with the hospital group&apos;s own page. So we do not show it, and these
        four sites appear as &ldquo;No data&rdquo; until a current source is found.
      </p>
      <p>
        When a figure is shown, the source does not say whether it is an average or a median, which patients it covers, or
        when it was worked out. Figures at different sites are not guaranteed to mean the same thing, and we do not compare
        them. We check the source every few minutes, and the time shown is when we last checked.
      </p>

      <h2>Hospitals that publish no figure</h2>
      <p>
        Six public hospitals do not publish a waiting time as open data: Singapore General Hospital, Changi General Hospital,
        Sengkang General Hospital, National University Hospital, Ng Teng Fong General Hospital, and KK Women&apos;s and
        Children&apos;s Hospital. They appear on the map as &ldquo;No data&rdquo;, so the gap stays visible.
      </p>

      <h2>Rain, air quality and taxis</h2>
      <p>
        Rain and air quality can be shown as colour on the map. Light is less, dark is more, and the legend gives the lowest and
        highest value. Rain comes from NEA stations and is blended between them, so it is approximate. Air quality (PM2.5) is
        published for five regions only. Each hospital&apos;s sheet shows how many taxis were free within 2 km at the last check.
        None of this is advice on how or when to travel.
      </p>

      <h2 id="sources">Sources and licences</h2>
      <ul>
        <li>Waiting times (not shown for now): data.gov.sg, ED Waiting Times. Singapore Open Data Licence v1.0.</li>
        <li>Rain and PM2.5: NEA, via data.gov.sg. Taxi availability: LTA, via data.gov.sg. Same licence.</li>
        <li>Map: © OpenStreetMap contributors, under the Open Database Licence.</li>
        <li>Labels: Noto Sans, SIL Open Font Licence 1.1.</li>
        <li>Code: MIT. Data produced by this project: CC BY 4.0.</li>
      </ul>
    </main>
  );
}
