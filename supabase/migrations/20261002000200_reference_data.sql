-- Reference data: sources, hospitals (including those with no open feed), aliases, metrics.
-- Hospital coordinates: OneMap search API, 2026-10-02 (main building or postal-code match).

insert into public.source (id, name, url, licence, role, cadence_minutes, raw_retention, notes) values
  ('ed_waits', 'data.gov.sg ED Waiting Times',
   'https://data.gov.sg/api/action/datastore_search?resource_id=d_9d0bbe366aee923a6e202f80bb356bb9&limit=100',
   'Singapore Open Data Licence v1.0', 'core', 5, 'every_distinct',
   'Snapshot of 4 rows (hospital, minutes as text). No timestamp in the payload and no metadata endpoint; '
   'Last-Modified equals fetch time. Publisher does not define the statistic. Polled every 5 min to learn the real refresh cadence.'),
  ('rainfall', 'data.gov.sg / NEA rainfall (real-time v2)',
   'https://api-open.data.gov.sg/v2/real-time/api/rainfall',
   'Singapore Open Data Licence v1.0', 'context', 5, 'daily_sample',
   'Per-station 5-minute readings with timestamp. Upstream supports historical queries by date.'),
  ('air_temperature', 'data.gov.sg / NEA air temperature (real-time v2)',
   'https://api-open.data.gov.sg/v2/real-time/api/air-temperature',
   'Singapore Open Data Licence v1.0', 'context', 15, 'daily_sample',
   'Per-station readings with timestamp. Upstream supports historical queries by date.'),
  ('psi', 'data.gov.sg / NEA PSI and PM2.5 (real-time v2)',
   'https://api-open.data.gov.sg/v2/real-time/api/psi',
   'Singapore Open Data Licence v1.0', 'context', 60, 'every_distinct',
   'Hourly by region (north, south, east, west, central).'),
  ('taxi', 'data.gov.sg / LTA taxi availability',
   'https://api.data.gov.sg/v1/transport/taxi-availability',
   'Singapore Open Data Licence v1.0', 'mobility', 15, 'daily_sample',
   'About 1,800 coordinates per snapshot (~43 KB). Aggregated at collection time to counts within 2 km of each hospital.'),
  ('holidays', 'data.gov.sg / MOM public holidays collection',
   'https://api-production.data.gov.sg/v2/public/api/collections/691/metadata',
   'Singapore Open Data Licence v1.0', 'context', 1440, 'every_distinct',
   'Collection 691; one child dataset per year, each read via datastore_search.');

insert into public.location (code, kind, name, lat, lon) values
  ('SG',       'national', 'Singapore',                            null,        null),
  ('TTSH',     'hospital', 'Tan Tock Seng Hospital',               1.3213686,   103.845694),
  ('KTPH',     'hospital', 'Khoo Teck Puat Hospital',              1.424081,    103.838579),
  ('WH',       'hospital', 'Woodlands Health',                     1.4246813,   103.794743),
  ('AH',       'hospital', 'Alexandra Hospital',                   1.285481,    103.800181),
  ('SGH',      'hospital', 'Singapore General Hospital',           1.279644,    103.835542),
  ('CGH',      'hospital', 'Changi General Hospital',              1.3408259,   103.949467),
  ('SKH',      'hospital', 'Sengkang General Hospital',            1.394393,    103.893164),
  ('NUH',      'hospital', 'National University Hospital',         1.292776,    103.782455),
  ('NTFGH',    'hospital', 'Ng Teng Fong General Hospital',        1.333606,    103.745448),
  ('KKH',      'hospital', 'KK Women''s and Children''s Hospital', 1.310490,    103.846813),
  ('psi:north',   'psi_region', 'North',   1.41803, 103.82),
  ('psi:south',   'psi_region', 'South',   1.29587, 103.82),
  ('psi:east',    'psi_region', 'East',    1.35735, 103.94),
  ('psi:west',    'psi_region', 'West',    1.35735, 103.70),
  ('psi:central', 'psi_region', 'Central', 1.35735, 103.82);

insert into public.hospital (location_id, cluster, facility_type, open_data_status, notes)
select l.id, h.cluster, h.facility_type, h.status, h.notes
from (values
  ('TTSH',  'NHG',        'ED',          'published',     null),
  ('KTPH',  'NHG',        'ED',          'published',     null),
  ('WH',    'NHG',        'ED',          'published',     'Newest of the published sites; expect a shorter and less stable history.'),
  ('AH',    'NUHS',       'UCC',         'published',     'Urgent Care Centre, not a full ED. Values not comparable with EDs.'),
  ('SGH',   'SingHealth', 'ED',          'not_published', 'No open wait-time feed found (checked 2026-10-02).'),
  ('CGH',   'SingHealth', 'ED',          'not_published', 'No open wait-time feed found (checked 2026-10-02).'),
  ('SKH',   'SingHealth', 'ED',          'not_published', 'No open wait-time feed found (checked 2026-10-02).'),
  ('NUH',   'NUHS',       'ED',          'not_published', 'No open feed found. A public NUH web page on ED wait times exists; its reuse terms are unchecked. Children''s Emergency is on the same site.'),
  ('NTFGH', 'NUHS',       'ED',          'not_published', 'No open wait-time feed found (checked 2026-10-02).'),
  ('KKH',   'SingHealth', 'CHILDREN_ED', 'not_published', 'Children''s Emergency; excluded from MOH ward-admission statistics.')
) as h(code, cluster, facility_type, status, notes)
join public.location l on l.code = h.code;

-- Labels exactly as printed by the ED feed (note the en dash in the Alexandra label).
insert into public.location_alias (source_id, label, location_id)
select 'ed_waits', a.label, l.id
from (values
  ('Tan Tock Seng Hospital (TTSH)',                  'TTSH'),
  ('Khoo Teck Puat Hospital (KTPH)',                 'KTPH'),
  ('Woodlands Health (WH)',                          'WH'),
  ('Alexandra Hospital (AH) – Urgent Care Centre',   'AH')
) as a(label, code)
join public.location l on l.code = a.code;

insert into public.metric (code, source_id, name, unit, definition, comparable_across_locations) values
  ('ed_wait_minutes', 'ed_waits', 'ED waiting time', 'min',
   'Waiting time as published by data.gov.sg ED Waiting Times. The publisher does not state whether it is a mean or median, '
   'which triage categories it covers, or when it was computed. Not comparable across sites; the UCC is a different service.', false),
  ('rain_mm', 'rainfall', 'Rainfall at station', 'mm',
   'Rainfall in the latest 5-minute reading at an NEA station. Collected for the reporting station nearest to each hospital; '
   'the hospital-to-station link is recomputed from coordinates, not stored.', true),
  ('rain_max_mm', 'rainfall', 'Maximum rainfall across stations', 'mm',
   'Highest 5-minute rainfall reading across all reporting NEA stations.', true),
  ('rain_wet_share', 'rainfall', 'Share of stations with rain', 'ratio',
   'Fraction of reporting NEA stations with rainfall > 0 in the latest 5-minute reading.', true),
  ('air_temp_c', 'air_temperature', 'Air temperature at station', '°C',
   'Latest air temperature at an NEA station. Collected for the reporting station nearest to each hospital.', true),
  ('psi_24h', 'psi', '24-hour PSI', 'index', '24-hour Pollutant Standards Index by region (NEA).', true),
  ('pm25_24h', 'psi', '24-hour PM2.5', 'µg/m³', '24-hour PM2.5 concentration by region (NEA).', true),
  ('pm25_sub_index', 'psi', 'PM2.5 sub-index', 'index', 'PM2.5 sub-index by region (NEA).', true),
  ('taxi_available_2km', 'taxi', 'Available taxis within 2 km', 'count',
   'Number of available taxis within 2 km (great-circle) of a hospital in the LTA snapshot.', true),
  ('taxi_available_total', 'taxi', 'Available taxis, island-wide', 'count',
   'Total available taxis reported in the LTA snapshot.', true);
