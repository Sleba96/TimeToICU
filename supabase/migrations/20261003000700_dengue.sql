-- Add dengue data source and metrics.

insert into public.source (id, name, url, licence, role, cadence_minutes, raw_retention, notes) values
  ('dengue', 'data.gov.sg / NEA dengue clusters (GeoJSON)',
   'https://data.gov.sg/api/action/datastore_search_sql?sql=SELECT%20*%20FROM%20%22d_dbfabf16158d1b0e1c420627c0819168%22&limit=100',
   'Singapore Open Data Licence v1.0', 'context', 60, 'every_distinct',
   'Near real-time GeoJSON polygons of dengue clusters (2+ cases within 14 days and 150m) with case counts. Updated by NEA.');

insert into public.metric (code, source_id, name, unit, definition, comparable_across_locations) values
  ('dengue_cluster_cases', 'dengue', 'Dengue cases in cluster', 'count',
   'Number of confirmed dengue cases in a cluster (defined as 2+ cases within 14 days and 150m). '
   'Location codes are of the form dengue:<cluster_name>.', false);
