# Setup

## Supabase

Project `sg-queue-monitor`, region `ap-southeast-1` (Singapore).

1. Apply `supabase/migrations/*.sql` in order (`supabase db push`, or the SQL editor).
2. Deploy the Edge Function with JWT verification off; it checks its own token:
   `supabase functions deploy collect --no-verify-jwt`
3. Create the two Vault secrets once. They are not in version control:

   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'collector_token');
   ```

4. The schedule migration registers the `pg_cron` jobs. Check them with `select * from cron.job;`.

To run a collection by hand:

```sql
select private.invoke_collector('ed_waits,rainfall,air_temperature,psi,taxi,holidays');
-- a few seconds later
select source_id, status, n_observations, issues, error from public.run_log order by id desc limit 10;
```

To rotate the collector token, update the `collector_token` secret in Vault. No redeploy is needed.

## Health checks

```sql
select * from public.v_source_health;          -- last success, success counts over 24 h and 30 days
select * from public.v_latest_observation where location_kind = 'hospital';
select pg_size_pretty(pg_database_size(current_database()));  -- watch the 500 MB free-tier limit
```

## Tests

`npm test` runs the parser tests against the recorded payloads in `tests/fixtures` (Node 22.6 or later).
