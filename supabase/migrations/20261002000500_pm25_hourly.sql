-- PM2.5 1-hour reading by region. The PSI source only carries 24-hour averages, which lag a haze event.
-- Regions reuse the psi:<region> locations.

insert into public.source (id, name, url, licence, role, cadence_minutes, raw_retention, notes) values
  ('pm25_hourly', 'data.gov.sg / NEA PM2.5 1-hour (real-time v2)',
   'https://api-open.data.gov.sg/v2/real-time/api/pm25',
   'Singapore Open Data Licence v1.0', 'context', 60, 'every_distinct',
   'Hourly by region. The reading is stamped on the hour and published about 30 minutes later, so it is polled at minute 36.');

insert into public.metric (code, source_id, name, unit, definition, comparable_across_locations) values
  ('pm25_1h', 'pm25_hourly', '1-hour PM2.5', 'µg/m³', '1-hour PM2.5 concentration by region (NEA).', true);

select cron.schedule('collect-hourly-pm25', '36 * * * *', $$select private.invoke_collector('pm25_hourly')$$);
