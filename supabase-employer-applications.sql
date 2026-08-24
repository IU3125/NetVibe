-- ============================================================
-- NetVibe - Employer panel: view & manage applications to own jobs
-- Run in SQL Editor. Safe to run multiple times.
-- ============================================================

-- Employers (and admins) can SELECT applications submitted to their jobs
DROP POLICY IF EXISTS "Employers can view applications to their jobs" ON job_applications;
CREATE POLICY "Employers can view applications to their jobs"
  ON job_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_applications.job_id
        AND (
          jobs.employer_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
        )
    )
  );

-- Employers (and admins) can UPDATE status of applications to their jobs
-- (applied -> reviewed / accepted / rejected)
DROP POLICY IF EXISTS "Employers can update applications to their jobs" ON job_applications;
CREATE POLICY "Employers can update applications to their jobs"
  ON job_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_applications.job_id
        AND (
          jobs.employer_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
        )
    )
  );
