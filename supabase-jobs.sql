-- ============================================================
-- NetVibe - Jobs backend (phase 2: Vacancies + Job Details)
-- Run in SQL Editor. Safe to run multiple times.
-- ============================================================

-- 1. Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  category TEXT NOT NULL,            -- matches UI categories: services, education, buysell, sports, arts, it, work, technology
  type TEXT NOT NULL,                -- Full-Time / Part-Time / Contract / Internship
  salary_min NUMERIC,
  salary_max NUMERIC,
  currency TEXT DEFAULT 'USD',
  period TEXT DEFAULT 'month',       -- hour / week / month / year
  location TEXT NOT NULL,
  city TEXT DEFAULT 'Dhaka',
  description TEXT,
  responsibilities JSONB DEFAULT '[]',
  qualifications JSONB DEFAULT '[]',
  perks JSONB DEFAULT '[]',
  weekly TEXT,
  work_days TEXT,
  work_hours TEXT,
  apply_before DATE,
  banner_url TEXT,
  logo_url TEXT,
  employer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration for existing DBs (safe to run repeatedly)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_employer BOOLEAN DEFAULT false;
ALTER TABLE jobs ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check CHECK (status IN ('pending', 'active', 'rejected', 'closed'));

-- 2. Job applications (one per user per job)
CREATE TABLE IF NOT EXISTS job_applications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'applied' CHECK (status IN ('applied', 'reviewed', 'accepted', 'rejected')),
  cover_letter TEXT,
  cv_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, user_id)
);

-- 3. Saved jobs (bookmarks)
CREATE TABLE IF NOT EXISTS saved_jobs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, user_id)
);

-- 4. RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active jobs" ON jobs;
CREATE POLICY "Anyone can view active jobs"
  ON jobs FOR SELECT
  USING (status = 'active' OR employer_id = auth.uid()
         OR (SELECT is_admin FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Employers can insert jobs" ON jobs;
CREATE POLICY "Employers can insert jobs"
  ON jobs FOR INSERT
  WITH CHECK (employer_id = auth.uid());

DROP POLICY IF EXISTS "Employers can update own jobs" ON jobs;
CREATE POLICY "Employers can update own jobs"
  ON jobs FOR UPDATE
  USING (employer_id = auth.uid() OR (SELECT is_admin FROM profiles WHERE id = auth.uid()));

-- Force new jobs into 'pending' unless inserted by an admin.
-- Runs on INSERT and UPDATE so employers cannot publish their own ads.
CREATE OR REPLACE FUNCTION set_job_pending_unless_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.status IS DISTINCT FROM 'pending' THEN
    IF (SELECT is_admin FROM profiles WHERE id = auth.uid()) IS NOT TRUE THEN
      NEW.status := 'pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_pending_unless_admin ON jobs;
CREATE TRIGGER trg_job_pending_unless_admin
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_job_pending_unless_admin();

-- When a job is approved (status becomes 'active'), mark the employer's
-- profile as an employer so it shows "Employer" on their profile.
CREATE OR REPLACE FUNCTION mark_profile_as_employer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.employer_id IS NOT NULL THEN
    UPDATE profiles SET is_employer = true WHERE id = NEW.employer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_mark_employer ON jobs;
CREATE TRIGGER trg_job_mark_employer
  AFTER INSERT OR UPDATE OF status ON jobs
  FOR EACH ROW EXECUTE FUNCTION mark_profile_as_employer();

DROP POLICY IF EXISTS "Users can view own applications" ON job_applications;
CREATE POLICY "Users can view own applications"
  ON job_applications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own applications" ON job_applications;
CREATE POLICY "Users can insert own applications"
  ON job_applications FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own applications" ON job_applications;
CREATE POLICY "Users can update own applications"
  ON job_applications FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own saved jobs" ON saved_jobs;
CREATE POLICY "Users can view own saved jobs"
  ON saved_jobs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own saved jobs" ON saved_jobs;
CREATE POLICY "Users can insert own saved jobs"
  ON saved_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own saved jobs" ON saved_jobs;
CREATE POLICY "Users can delete own saved jobs"
  ON saved_jobs FOR DELETE
  USING (user_id = auth.uid());

-- 5. Apply helper (prevents double apply)
CREATE OR REPLACE FUNCTION apply_to_job(job_id BIGINT, cover TEXT DEFAULT NULL, cv TEXT DEFAULT NULL)
RETURNS job_applications
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  existing job_applications;
  inserted job_applications;
BEGIN
  SELECT * INTO existing FROM job_applications
  WHERE job_applications.job_id = apply_to_job.job_id AND user_id = auth.uid();

  IF existing.id IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO job_applications (job_id, user_id, cover_letter, cv_url)
  VALUES (apply_to_job.job_id, auth.uid(), cover, cv)
  RETURNING * INTO inserted;

  RETURN inserted;
END;
$$;

-- 6. Seed sample jobs (skips if jobs table already has data)
-- Uses dollar-quoted strings ($$...$$) so no quote escaping issues on copy-paste.
INSERT INTO jobs (
  title, company, category, type, salary_min, salary_max, currency, period,
  location, city, description,
  responsibilities, qualifications, perks,
  weekly, work_days, work_hours, apply_before,
  banner_url, logo_url, status
)
SELECT * FROM (VALUES
  (
    'Graphic Designer', 'Art Design Agency', 'arts', 'Full-Time',
    1000, 2000, 'USD', 'month',
    'Mohammadpur, Dhaka', 'Dhaka',
    $$The ideal candidate will have strong creative skills and a portfolio of work which demonstrates their passion for illustrative design and typography. This candidate will have experiences in working with numerous different design platforms such as digital and print forms.$$,
    $$["Collaborate with the team to ensure consistency of designs across various media outlets.", "Create compelling and effective logos, designs, print and digital media.", "Maintain awareness of current industry and technology standards, social media, competitive landscape and market trends."]$$::jsonb,
    $$["Bachelor's degree in Graphic Design or related field.", "5-10 years of experience in graphic design.", "Proficient in Adobe Creative Suite.", "Strong communication, conceptual thinking, typography skills and design skills."]$$::jsonb,
    $$["Lunch", "Yearly leave", "High-end devices", "Office Perks"]$$::jsonb,
    'Weekly: 5 days', 'Sunday to Thursday', '09:00am to 06:00pm',
    '2026-09-30'::date,
    NULL, NULL,
    'active'
  ),
  (
    'UI/UX Illustrator', 'Creative Pulse Studio', 'arts', 'Contract',
    1200, 1800, 'USD', 'month',
    'Gulshan, Dhaka', 'Dhaka',
    $$We are looking for a talented illustrator to join our creative team. You will craft visual stories, design illustrations for web and mobile products, and help shape delightful user experiences.$$,
    $$["Produce high-quality illustrations for web and mobile interfaces.", "Work closely with designers and developers to translate ideas into visuals.", "Iterate on concepts based on feedback."]$$::jsonb,
    $$["Portfolio with strong illustration work.", "2+ years of professional illustration experience.", "Excellent visual and color sense."]$$::jsonb,
    $$["Flexible hours", "Remote-friendly", "Creative workspace"]$$::jsonb,
    'Weekly: 5 days', 'Saturday to Wednesday', '10:00am to 07:00pm',
    '2026-08-31'::date,
    NULL, NULL,
    'active'
  ),
  (
    'Junior Web Developer', 'TechFlow Systems', 'it', 'Internship',
    850, 1000, 'USD', 'month',
    'Banani, Dhaka', 'Dhaka',
    $$Kick-start your career at TechFlow Systems. You will work on real products with a senior team, learning modern web development practices while contributing to production code.$$,
    $$["Build and maintain web features using modern JavaScript.", "Write clean, testable code.", "Participate in code reviews and daily standups."]$$::jsonb,
    $$["Knowledge of HTML, CSS and JavaScript.", "Basic understanding of React or similar frameworks.", "Eagerness to learn and grow."]$$::jsonb,
    $$["Mentorship", "Certification", "Possible full-time offer"]$$::jsonb,
    'Weekly: 5 days', 'Sunday to Thursday', '09:00am to 05:00pm',
    '2026-08-15'::date,
    NULL, NULL,
    'active'
  ),
  (
    'Motion Designer', 'Visionary Media', 'arts', 'Full-Time',
    1500, 2500, 'USD', 'month',
    'Uttara, Dhaka', 'Dhaka',
    $$Join our award-winning media house. As a motion designer you will create animations for brand campaigns, social media and product launches.$$,
    $$["Create motion graphics and animations for digital campaigns.", "Collaborate with the video production team.", "Stay on top of motion design trends."]$$::jsonb,
    $$["Expertise in After Effects and related tools.", "Strong design fundamentals.", "3+ years of motion design experience."]$$::jsonb,
    $$["Health insurance", "Annual bonus", "Training budget"]$$::jsonb,
    'Weekly: 5 days', 'Sunday to Thursday', '10:00am to 06:30pm',
    '2026-10-15'::date,
    NULL, NULL,
    'active'
  ),
  (
    'Customer Support Specialist', 'QuickServe', 'services', 'Full-Time',
    600, 800, 'USD', 'month',
    'Dhanmondi, Dhaka', 'Dhaka',
    $$Be the friendly face of QuickServe. You will handle customer inquiries via chat and email, resolve issues fast and keep our users happy.$$,
    $$["Respond to customer inquiries within SLA.", "Troubleshoot common issues and escalate when needed.", "Document feedback to improve our product."]$$::jsonb,
    $$["Excellent written communication.", "Customer-first mindset.", "Basic computer skills."]$$::jsonb,
    $$["Lunch", "Performance bonus"]$$::jsonb,
    'Weekly: 6 days', 'Saturday to Thursday', '09:00am to 06:00pm',
    '2026-09-15'::date,
    NULL, NULL,
    'active'
  ),
  (
    'Math Teacher (Online)', 'Bright Minds Academy', 'education', 'Part-Time',
    400, 600, 'USD', 'month',
    'Mirpur, Dhaka', 'Dhaka',
    $$Teach mathematics to students online. Flexible schedule, structured curriculum and a supportive team of educators.$$,
    $$["Prepare and deliver engaging online lessons.", "Track student progress and report to parents.", "Adapt teaching style to student needs."]$$::jsonb,
    $$["Degree in Mathematics or related field.", "1+ years of teaching experience.", "Reliable internet connection."]$$::jsonb,
    $$["Flexible schedule", "Remote"]$$::jsonb,
    'Weekly: 3 days', 'Flexible', 'Flexible',
    '2026-08-30'::date,
    NULL, NULL,
    'active'
  )
) AS v(
  title, company, category, type, salary_min, salary_max, currency, period,
  location, city, description,
  responsibilities, qualifications, perks,
  weekly, work_days, work_hours, apply_before,
  banner_url, logo_url, status
)
WHERE NOT EXISTS (SELECT 1 FROM jobs);

-- ============================================================
-- 7. How to make a user an admin
-- Replace <USER_EMAIL> with the admin's email address, then run:
--   UPDATE profiles SET is_admin = true
--   WHERE id = (SELECT id FROM auth.users WHERE email = '<USER_EMAIL>');
-- ============================================================
