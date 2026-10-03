-- Dengue joins the hourly PSI job (60-minute cadence). PM2.5 hourly keeps its own job at minute 36.

select cron.unschedule('collect-hourly');
select cron.schedule('collect-hourly', '21 * * * *', $$select private.invoke_collector('psi,dengue')$$);
