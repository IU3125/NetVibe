-- ============================================================
-- NetVibe - Auto-delete expired active jobs
-- Run in SQL Editor. Safe to run multiple times.
-- Active jobs are deleted the day AFTER their application
-- deadline (apply_before). Example: deadline 2026.08.05 ->
-- job is removed from the system on 2026.08.06.
-- ============================================================

-- 1. Cleanup function: removes active jobs whose deadline passed.
CREATE OR REPLACE FUNCTION delete_expired_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM jobs
  WHERE status = 'active'
    AND apply_before IS NOT NULL
    AND apply_before < CURRENT_DATE;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- 2. Schedule it to run every day at 00:05 UTC.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('netvibe-delete-expired-jobs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'netvibe-delete-expired-jobs');

SELECT cron.schedule('netvibe-delete-expired-jobs', '5 0 * * *', $$SELECT delete_expired_jobs()$$);

-- 3. Optional: run once immediately to clean up already-expired jobs:
-- SELECT delete_expired_jobs();
