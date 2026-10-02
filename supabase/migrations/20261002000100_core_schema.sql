-- Core schema: sources, locations, metrics, raw payloads, run log, observations.
-- Collectors write only through public.ingest_run(); the web app reads through RLS-protected selects.

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table public.source (
  id               text primary key,
  name             text not null,
  url              text not null,
  licence          text not null,
  role             text not null check (role in ('core', 'context', 'mobility', 'benchmark', 'optional')),
  cadence_minutes  integer not null check (cadence_minutes > 0),
  -- every_distinct: keep every distinct payload (sources with no upstream history, e.g. ED waits)
  -- daily_sample:   keep the first payload of each Singapore day; upstream keeps its own history
  raw_retention    text not null check (raw_retention in ('every_distinct', 'daily_sample')),
  enabled          boolean not null default true,
  notes            text
);
comment on table public.source is 'Catalogue of upstream data sources, with licence and raw-payload retention policy.';

create table public.location (
  id          smallint generated always as identity primary key,
  code        text not null unique,      -- 'TTSH', 'stn:S218', 'psi:west', 'SG'
  kind        text not null check (kind in ('hospital', 'weather_station', 'psi_region', 'national')),
  name        text not null,
  lat         double precision,
  lon         double precision,
  created_at  timestamptz not null default now()
);
comment on table public.location is 'Anything an observation is about: hospitals, weather stations, PSI regions, Singapore as a whole.';

create table public.hospital (
  location_id       smallint primary key references public.location (id),
  cluster           text not null check (cluster in ('NHG', 'SingHealth', 'NUHS')),
  facility_type     text not null check (facility_type in ('ED', 'UCC', 'CHILDREN_ED')),
  -- 'published': an open feed exists and we collect it; 'not_published': shown on the map as a visible gap
  open_data_status  text not null check (open_data_status in ('published', 'not_published')),
  opened_on         date,
  closed_on         date,
  notes             text
);
comment on table public.hospital is 'Public emergency facilities, including those with no open wait-time feed (open_data_status = not_published).';

create table public.location_alias (
  source_id    text not null references public.source (id),
  label        text not null,             -- exact label as the source prints it
  location_id  smallint not null references public.location (id),
  primary key (source_id, label)
);
comment on table public.location_alias is 'Maps a source''s own facility labels to locations. An unknown label is logged as an issue, never guessed.';

create table public.metric (
  id                           smallint generated always as identity primary key,
  code                         text not null unique,
  source_id                    text not null references public.source (id),
  name                         text not null,
  unit                         text not null,
  definition                   text not null,
  comparable_across_locations  boolean not null
);
comment on column public.metric.comparable_across_locations is 'False when the publisher does not guarantee the same definition at every site. The UI must not rank such values.';

create table public.public_holiday (
  day   date not null,
  name  text not null,
  primary key (day, name)
);

-- ---------------------------------------------------------------------------
-- Collection
-- ---------------------------------------------------------------------------

create table public.raw_payload (
  id             bigint generated always as identity primary key,
  source_id      text not null references public.source (id),
  sha256         text not null,
  content_type   text,
  body           text not null,           -- exact response text, so the hash can be re-checked
  bytes          integer not null,
  first_seen_at  timestamptz not null default now(),
  unique (source_id, sha256)
);
comment on table public.raw_payload is 'Append-only store of raw responses, one row per distinct payload. Never updated.';

create table public.run_log (
  id                 bigint generated always as identity primary key,
  source_id          text not null references public.source (id),
  slot_at            timestamptz not null,   -- scheduled slot, floored to the source cadence
  started_at         timestamptz not null,
  finished_at        timestamptz not null default now(),
  status             text not null check (status in ('ok', 'partial', 'error')),
  http_status        integer,
  payload_sha256     text,                   -- recorded on every run, even when the body is not kept
  payload_id         bigint references public.raw_payload (id),
  n_observations     integer not null default 0,
  issues             jsonb not null default '[]'::jsonb,
  error              text,
  collector_version  text not null
);
create index run_log_source_started_idx on public.run_log (source_id, started_at desc);
create index run_log_payload_idx on public.run_log (payload_id);
comment on table public.run_log is 'One row per collector run, successful or not. Feeds the data-quality status page.';

create table public.observation (
  metric_id    smallint not null references public.metric (id),
  location_id  smallint not null references public.location (id),
  ref_time     timestamptz not null,   -- source timestamp when given, otherwise the run slot
  observed_at  timestamptz,            -- source's own timestamp; null when the source gives none
  fetched_at   timestamptz not null,
  value        real,
  value_text   text,                   -- original text when the value is not a clean number
  run_id       bigint not null references public.run_log (id),
  primary key (metric_id, location_id, ref_time)
);
create index observation_location_time_idx on public.observation (location_id, ref_time desc);
create index observation_run_idx on public.observation (run_id);
comment on table public.observation is 'Normalised time series. The primary key makes collectors idempotent: a retried slot never duplicates rows.';

-- ---------------------------------------------------------------------------
-- Row level security: public read of normalised data, no public write.
-- raw_payload stays private until the open export (F6) is designed.
-- ---------------------------------------------------------------------------

alter table public.source          enable row level security;
alter table public.location        enable row level security;
alter table public.hospital        enable row level security;
alter table public.location_alias  enable row level security;
alter table public.metric          enable row level security;
alter table public.public_holiday  enable row level security;
alter table public.raw_payload     enable row level security;
alter table public.run_log         enable row level security;
alter table public.observation     enable row level security;

create policy "public read" on public.source         for select to anon, authenticated using (true);
create policy "public read" on public.location       for select to anon, authenticated using (true);
create policy "public read" on public.hospital       for select to anon, authenticated using (true);
create policy "public read" on public.location_alias for select to anon, authenticated using (true);
create policy "public read" on public.metric         for select to anon, authenticated using (true);
create policy "public read" on public.public_holiday for select to anon, authenticated using (true);
create policy "public read" on public.run_log        for select to anon, authenticated using (true);
create policy "public read" on public.observation    for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Ingestion: one atomic call per collector run.
-- ---------------------------------------------------------------------------

create function public.ingest_run(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source      public.source;
  v_payload_id  bigint;
  v_run_id      bigint;
  v_inserted    integer := 0;
  v_unmatched   jsonb;
  v_issues      jsonb := coalesce(p -> 'issues', '[]'::jsonb);
  v_status      text := coalesce(p ->> 'status', 'ok');
  v_keep_body   boolean;
begin
  select * into strict v_source from public.source where id = p ->> 'source_id';

  -- New locations announced by the collector (e.g. the weather station nearest a hospital).
  insert into public.location (code, kind, name, lat, lon)
  select l.code, l.kind, l.name, l.lat, l.lon
  from jsonb_to_recordset(coalesce(p -> 'locations', '[]'::jsonb))
       as l(code text, kind text, name text, lat double precision, lon double precision)
  on conflict (code) do nothing;

  -- Raw payload, subject to the source's retention policy.
  if p ->> 'body' is not null then
    v_keep_body := v_source.raw_retention = 'every_distinct'
      or not exists (
        select 1 from public.raw_payload r
        where r.source_id = v_source.id
          and r.first_seen_at >= (date_trunc('day', now() at time zone 'Asia/Singapore') at time zone 'Asia/Singapore')
      );
    if v_keep_body then
      insert into public.raw_payload (source_id, sha256, content_type, body, bytes)
      values (v_source.id, p ->> 'sha256', p ->> 'content_type', p ->> 'body', (p ->> 'bytes')::integer)
      on conflict (source_id, sha256) do nothing;
    end if;
    select r.id into v_payload_id
    from public.raw_payload r
    where r.source_id = v_source.id and r.sha256 = p ->> 'sha256';
  end if;

  -- Observation labels that match neither a location code nor an alias for this source.
  select coalesce(jsonb_agg(distinct o.location), '[]'::jsonb) into v_unmatched
  from jsonb_to_recordset(coalesce(p -> 'observations', '[]'::jsonb)) as o(location text)
  where not exists (select 1 from public.location l where l.code = o.location)
    and not exists (select 1 from public.location_alias a where a.source_id = v_source.id and a.label = o.location);

  if jsonb_array_length(v_unmatched) > 0 then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object('kind', 'unknown_location', 'labels', v_unmatched));
    if v_status = 'ok' then v_status := 'partial'; end if;
  end if;

  insert into public.run_log (source_id, slot_at, started_at, status, http_status, payload_sha256,
                              payload_id, issues, error, collector_version)
  values (v_source.id, (p ->> 'slot_at')::timestamptz, (p ->> 'started_at')::timestamptz, v_status,
          (p ->> 'http_status')::integer, p ->> 'sha256', v_payload_id, v_issues, p ->> 'error',
          p ->> 'collector_version')
  returning id into v_run_id;

  with obs as (
    select *
    from jsonb_to_recordset(coalesce(p -> 'observations', '[]'::jsonb))
         as o(metric text, location text, observed_at timestamptz, value real, value_text text)
  ),
  ins as (
    insert into public.observation (metric_id, location_id, ref_time, observed_at, fetched_at, value, value_text, run_id)
    select m.id,
           coalesce(l.id, a.location_id),
           coalesce(o.observed_at, (p ->> 'slot_at')::timestamptz),
           o.observed_at,
           (p ->> 'fetched_at')::timestamptz,
           o.value,
           o.value_text,
           v_run_id
    from obs o
    join public.metric m on m.code = o.metric and m.source_id = v_source.id
    left join public.location l on l.code = o.location
    left join public.location_alias a on a.source_id = v_source.id and a.label = o.location
    where coalesce(l.id, a.location_id) is not null
    on conflict (metric_id, location_id, ref_time) do nothing
    returning 1
  )
  select count(*) into v_inserted from ins;

  insert into public.public_holiday (day, name)
  select h.day, h.name
  from jsonb_to_recordset(coalesce(p -> 'holidays', '[]'::jsonb)) as h(day date, name text)
  on conflict do nothing;

  update public.run_log set n_observations = v_inserted, finished_at = now() where id = v_run_id;

  return jsonb_build_object('run_id', v_run_id, 'inserted', v_inserted, 'payload_id', v_payload_id, 'status', v_status);
end;
$$;

revoke all on function public.ingest_run(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_run(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Read views (security_invoker so RLS of the caller applies).
-- ---------------------------------------------------------------------------

create view public.v_latest_observation
with (security_invoker = true) as
select distinct on (o.metric_id, o.location_id)
       m.code as metric, l.code as location, l.kind as location_kind, l.name as location_name,
       o.ref_time, o.observed_at, o.fetched_at, o.value, o.value_text, m.unit,
       m.comparable_across_locations
from public.observation o
join public.metric m on m.id = o.metric_id
join public.location l on l.id = o.location_id
order by o.metric_id, o.location_id, o.ref_time desc;

create view public.v_source_health
with (security_invoker = true) as
select s.id as source_id,
       s.cadence_minutes,
       max(r.started_at) filter (where r.status in ('ok', 'partial'))                         as last_success_at,
       count(*) filter (where r.started_at > now() - interval '24 hours')                     as runs_24h,
       count(*) filter (where r.started_at > now() - interval '24 hours' and r.status = 'ok') as ok_24h,
       count(*) filter (where r.started_at > now() - interval '30 days')                      as runs_30d,
       count(*) filter (where r.started_at > now() - interval '30 days' and r.status = 'ok')  as ok_30d,
       (array_agg(r.error order by r.started_at desc) filter (where r.status = 'error'))[1]   as last_error
from public.source s
left join public.run_log r on r.source_id = s.id
group by s.id, s.cadence_minutes;
