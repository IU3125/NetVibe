-- ============================================================
-- NetVibe - Community Chat backend
-- Run in SQL Editor. Safe to run multiple times.
-- ============================================================

-- 1. Community messages (group chat inside a community)
CREATE TABLE IF NOT EXISTS community_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_messages_community
  ON community_messages (community_id, created_at);

-- 2. RLS
ALTER TABLE community_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view community messages" ON community_messages;
CREATE POLICY "Members can view community messages"
  ON community_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = community_messages.community_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can insert community messages" ON community_messages;
CREATE POLICY "Members can insert community messages"
  ON community_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = community_messages.community_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can update own community messages" ON community_messages;
CREATE POLICY "Members can update own community messages"
  ON community_messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Members can delete own community messages" ON community_messages;
CREATE POLICY "Members can delete own community messages"
  ON community_messages FOR DELETE
  USING (sender_id = auth.uid());

-- 3. Realtime: community messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE community_messages;
  END IF;
END
$$;
