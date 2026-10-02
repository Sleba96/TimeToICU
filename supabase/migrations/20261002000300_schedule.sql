-- Scheduling: pg_cron calls the `collect` Edge Function through pg_net.
-- Requires two Vault secrets created once per project, outside version control (see docs/setup.md):
--   project_url      e.g. https://<ref>.supabase.co
--   collector_token  random shared token checked by the Edge Function

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Called by the Edge Function (as service_role) to authenticate the cron caller.
create function public.collector_token_ok(t text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'collector_token' and decrypted_secret = t
  );
$$;
revoke all on function public.collector_token_ok(text) from public, anon, authenticated;
grant execute on function public.collector_token_ok(text) to service_role;

create function private.invoke_collector(p_sources text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_token  text := (select decrypted_secret from vault.decrypted_secrets where name = 'collector_token');
begin
  if v_url is null or v_token is null then
    raise exception 'Vault secrets project_url and collector_token must be set (see docs/setup.md)';
  end if;
  return net.http_post(
    url                  := v_url || '/functions/v1/collect',
    headers              := jsonb_build_object('Content-Type', 'application/json', 'x-collector-token', v_token),
    body                 := jsonb_build_object('sources', p_sources),
    timeout_milliseconds := 60000
  );
end;
$$;
revoke all on function private.invoke_collector(text) from public, anon, authenticated;

-- Cadences match SourceDef.cadenceMinutes in supabase/functions/collect/sources.ts.
-- Offsets spread the load so the 5-minute and 15-minute jobs do not fire together.
select cron.schedule('collect-every-5-min',  '*/5 * * * *',    $$select private.invoke_collector('ed_waits,rainfall')$$);
select cron.schedule('collect-every-15-min', '2-59/15 * * * *', $$select private.invoke_collector('taxi,air_temperature')$$);
select cron.schedule('collect-hourly',       '21 * * * *',     $$select private.invoke_collector('psi')$$);
select cron.schedule('collect-daily',        '33 19 * * *',    $$select private.invoke_collector('holidays')$$);  -- 03:33 SGT

-- Housekeeping: cron's own run history grows without bound.
select cron.schedule('purge-cron-history', '47 20 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '14 days'$$);
