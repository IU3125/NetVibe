-- ============================================================
-- NetVibe - Voice messages + Calls (phase 4)
-- Run in SQL Editor. Safe to run multiple times.
-- ============================================================

-- 1. Voice message columns
ALTER TABLE messages ADD COLUMN IF NOT EXISTS voice_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS voice_duration REAL;

-- 2. Voice bucket + storage policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-messages', 'voice-messages', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload voice messages" ON storage.objects;
CREATE POLICY "Users can upload voice messages"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'voice-messages'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view voice messages" ON storage.objects;
CREATE POLICY "Users can view voice messages"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-messages');

-- 3. Calls table (signaling; LiveKit room used for actual media)
CREATE TABLE IF NOT EXISTS calls (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  caller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'audio' CHECK (type IN ('audio', 'video')),
  status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended', 'declined', 'missed')),
  room_name TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Call participants can view calls" ON calls;
CREATE POLICY "Call participants can view calls"
  ON calls FOR SELECT
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

DROP POLICY IF EXISTS "Users can start calls" ON calls;
CREATE POLICY "Users can start calls"
  ON calls FOR INSERT
  WITH CHECK (caller_id = auth.uid());

DROP POLICY IF EXISTS "Call participants can update calls" ON calls;
CREATE POLICY "Call participants can update calls"
  ON calls FOR UPDATE
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- 4. Realtime for calls (ringing, accept, decline)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE calls;
  END IF;
END $$;
