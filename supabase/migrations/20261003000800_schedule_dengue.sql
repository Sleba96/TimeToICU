-- Dengue clusters change on working days and the file is republished about once a day (about 10:06 Singapore time),
-- so the collector reads it once a day, at 10:30 Singapore time (02:30 UTC). PSI and PM2.5 keep their own jobs.

select cron.schedule('collect-dengue', '30 2 * * *', $$select private.invoke_collector('dengue')$$);
