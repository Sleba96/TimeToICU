-- Add dengue to the hourly collection job.
-- Dengue has 60-minute cadence like PSI.

select cron.unschedule('collect-hourly');
select cron.schedule('collect-hourly', '21 * * * *', $$select private.invoke_collector('psi,pm25_hourly,dengue')$$);
