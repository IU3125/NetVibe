-- ============================================================
-- NetVibe - Chat extras (phase 1: Inbox + Conversation)
-- Run AFTER supabase-chat.sql. Safe to run multiple times.
-- ============================================================

-- 1. Mute: per-participant mute until date
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;

-- 2. Reply: quote previous message
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id BIGINT REFERENCES messages(id) ON DELETE SET NULL;

-- 3. Message reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view reactions" ON message_reactions;
CREATE POLICY "Members can view reactions"
  ON message_reactions FOR SELECT
  USING (
    message_id IN (
      SELECT m.id FROM messages m
      WHERE m.conversation_id IN (
        SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Members can react" ON message_reactions;
CREATE POLICY "Members can react"
  ON message_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    message_id IN (
      SELECT m.id FROM messages m
      WHERE m.conversation_id IN (
        SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can remove own reactions" ON message_reactions;
CREATE POLICY "Users can remove own reactions"
  ON message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- 4. Reports (for messages; content_type also covers posts)
CREATE TABLE IF NOT EXISTS reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'message')),
  content_id BIGINT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reports" ON reports;
CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert reports" ON reports;
CREATE POLICY "Users can insert reports"
  ON reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

-- 5. Unread counts per conversation (for inbox badges)
CREATE OR REPLACE FUNCTION get_unread_counts(conv_ids BIGINT[])
RETURNS TABLE (conversation_id BIGINT, unread_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT cp.conversation_id, count(m.id)::BIGINT
  FROM conversation_participants cp
  LEFT JOIN messages m ON m.conversation_id = cp.conversation_id
    AND m.created_at > cp.last_read_at
    AND m.sender_id != auth.uid()
  WHERE cp.user_id = auth.uid()
    AND cp.conversation_id = ANY(conv_ids)
  GROUP BY cp.conversation_id;
END;
$$;

-- 6. Realtime: reactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
  END IF;
END $$;
