DO $$
DECLARE
  j record;
BEGIN
  FOR j IN SELECT jobid, jobname FROM cron.job WHERE jobname IN ('qogita-daily-incremental', 'qogita-daily-full') LOOP
    PERFORM cron.alter_job(job_id := j.jobid, active := false);
    RAISE NOTICE 'Disabled cron job % (id=%)', j.jobname, j.jobid;
  END LOOP;
END $$;