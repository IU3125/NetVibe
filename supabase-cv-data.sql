-- ============================================================
-- NetVibe - CV analysis + job recommendation backend
-- Run in SQL Editor. Safe to run multiple times.
-- ============================================================

-- 1. cv_data: structured CV data extracted by the cv-analyze
--    Edge Function (OpenAI). One row per user.
CREATE TABLE IF NOT EXISTS cv_data (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  skills JSONB DEFAULT '[]',              -- English skill names, e.g. ["React","SQL"]
  desired_roles JSONB DEFAULT '[]',       -- English role names
  years_experience NUMERIC,
  location TEXT,
  salary_expectation JSONB DEFAULT '{}',  -- {min, max, currency, period}
  summary TEXT,
  source_url TEXT,                        -- cv_url that was analyzed
  analysis_version INTEGER DEFAULT 1,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. cv_analysis_log: used for rate limiting (1 analysis per user / 24h).
--    Every analysis inserts a row; the Edge Function checks the last 24h.
CREATE TABLE IF NOT EXISTS cv_analysis_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cv_analysis_log_user_time
  ON cv_analysis_log (user_id, created_at DESC);

-- 3. Jobs: English translation columns for cross-language matching.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS qualifications_en JSONB DEFAULT '[]';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS responsibilities_en JSONB DEFAULT '[]';

-- 4. RLS
ALTER TABLE cv_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_analysis_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own cv_data" ON cv_data;
CREATE POLICY "Users can view own cv_data"
  ON cv_data FOR SELECT
  USING (user_id = auth.uid());

-- Writes are done by the cv-analyze Edge Function using the
-- service-role client, so no INSERT/UPDATE policies are required.
-- (Service role bypasses RLS.)

DROP POLICY IF EXISTS "Users can view own cv log" ON cv_analysis_log;
CREATE POLICY "Users can view own cv log"
  ON cv_analysis_log FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- Deploy steps (one-time):
--
-- 1. Deploy the edge functions (from the repo root):
--      npx supabase functions deploy cv-analyze
--      npx supabase functions deploy job-translate
--
-- 2. Set the OpenAI key as a function secret:
--      npx supabase secrets set OPENAI_API_KEY=sk-xxxx
--
-- 3. Schedule the daily job translation:
--    Supabase Dashboard -> Database -> Scheduled Functions -> Create,
--    cron expression "0 3 * * *" (03:00 UTC), function: job-translate.
--    (If you prefer SQL, enable the pg_net extension and use net.http_post,
--     or just call job-translate manually once — it is idempotent.)
--
-- 4. Test manually:
--      curl -X POST https://<project-ref>.supabase.co/functions/v1/cv-analyze
--           -H "Authorization: Bearer <anon-key>"
--           -H "Content-Type: application/json"
--           -d '{"cvUrl":"<public-cv-url>"}'
-- ============================================================
