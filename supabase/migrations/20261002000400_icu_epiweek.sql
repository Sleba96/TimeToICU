-- ICU utilisation by epi-week: static national context series (MOH via data.gov.sg).
-- Covers epi-weeks 2023-09 to 2024-08 (156 rows). Read daily; the primary key makes re-reads a no-op.

insert into public.source (id, name, url, licence, role, cadence_minutes, raw_retention, notes) values
  ('icu_epiweek', 'data.gov.sg / MOH ICU utilisation by epi-week',
   'https://data.gov.sg/api/action/datastore_search?limit=500&resource_id=d_ac42b0ea4ae0528bc9dbef90f0658f2b',
   'Singapore Open Data Licence v1.0', 'context', 1440, 'every_distinct',
   'National series: epi_week, status (COVID, Non-COVID, Empty), count. The publisher does not define the unit or the epi-week '
   'convention; observation time assumes Sunday-start MMWR weeks (decision D-010). The original label is kept in value_text.');

insert into public.metric (code, source_id, name, unit, definition, comparable_across_locations) values
  ('icu_beds_covid', 'icu_epiweek', 'ICU beds, COVID patients', 'beds',
   'Value of the COVID status row in the MOH ICU utilisation by epi-week dataset. Unit not defined by the publisher; values suggest a weekly average number of beds.', true),
  ('icu_beds_noncovid', 'icu_epiweek', 'ICU beds, non-COVID patients', 'beds',
   'Value of the Non-COVID status row in the same dataset. Unit not defined by the publisher.', true),
  ('icu_beds_empty', 'icu_epiweek', 'ICU beds, empty', 'beds',
   'Value of the Empty status row in the same dataset. Unit not defined by the publisher.', true);

select cron.schedule('collect-daily-icu', '38 19 * * *', $$select private.invoke_collector('icu_epiweek')$$);  -- 03:38 SGT
