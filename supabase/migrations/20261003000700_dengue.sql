-- NEA dengue clusters, stored as island-wide totals (the polygons are read live by the web layer).

insert into public.source (id, name, url, licence, role, cadence_minutes, raw_retention, notes) values
  ('dengue', 'data.gov.sg / NEA dengue clusters',
   'https://api-open.data.gov.sg/v1/public/api/datasets/d_dbfabf16158d1b0e1c420627c0819168/poll-download',
   'Singapore Open Data Licence v1.0', 'context', 60, 'every_distinct',
   'GeoJSON polygons, one per cluster (two or more cases within 14 days and 150 m), property CASE_SIZE. Two steps: poll-download returns a signed URL for the file. '
   'No overall timestamp: the newest FMEL_UPD_D stands in, assumed Singapore time.');

insert into public.metric (code, source_id, name, unit, definition, comparable_across_locations) values
  ('dengue_clusters', 'dengue', 'Active dengue clusters', 'count', 'Number of active NEA dengue clusters in the file.', true),
  ('dengue_cases_total', 'dengue', 'Cases in active clusters', 'count', 'Sum of CASE_SIZE over all active clusters. Cases in clusters only, not all notified cases.', true),
  ('dengue_cluster_max_cases', 'dengue', 'Largest dengue cluster', 'count', 'Largest CASE_SIZE among active clusters.', true);
