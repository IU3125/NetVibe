-- ============================================================
-- NetVibe - Chat / Messaging system
-- Run in Supabase Dashboard -> SQL Editor. Safe to run multiple times.
-- ============================================================

-- Online status columns on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pinned BOOLEAN DEFAULT false,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view conversations" ON conversations;
CREATE POLICY "Members can view conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversations.id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can create conversations" ON conversations;
CREATE POLICY "Members can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Members can view participants" ON conversation_participants;
CREATE POLICY "Members can view participants"
  ON conversation_participants FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can insert participants" ON conversation_participants;
CREATE POLICY "Participants can insert participants"
  ON conversation_participants FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own participation" ON conversation_participants;
CREATE POLICY "Users can update own participation"
  ON conversation_participants FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own participation" ON conversation_participants;
CREATE POLICY "Users can delete own participation"
  ON conversation_participants FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members can view messages" ON messages;
CREATE POLICY "Members can view messages"
  ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can insert messages" ON messages;
CREATE POLICY "Members can insert messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can delete messages" ON messages;
CREATE POLICY "Members can delete messages"
  ON messages FOR DELETE
  USING (sender_id = auth.uid());

-- ============================================================
-- 3. HELPER: get_or_create_conversation(other_user_id)
-- Returns existing conversation id or creates a new one.
-- Call via supabase.rpc('get_or_create_conversation', { other_user_id })
-- ============================================================

CREATE OR REPLACE FUNCTION get_or_create_conversation(other_user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  conv_id BIGINT;
BEGIN
  SELECT cp1.conversation_id INTO conv_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp2.conversation_id = cp1.conversation_id
  WHERE cp1.user_id = auth.uid() AND cp2.user_id = other_user_id
  LIMIT 1;

  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  INSERT INTO conversations DEFAULT VALUES RETURNING id INTO conv_id;
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (conv_id, auth.uid()), (conv_id, other_user_id);
  RETURN conv_id;
END;
$$;

-- ============================================================
-- 4. TRIGGER: update last_message_at on new message
-- ============================================================

CREATE OR REPLACE FUNCTION touch_conversation()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations SET last_message_at = NOW() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_insert_touch ON messages;
CREATE TRIGGER on_message_insert_touch
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION touch_conversation();

-- ============================================================
-- 5. REALTIME
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
  END IF;
END $$;

-- ============================================================
-- 6. STORAGE: chat-images bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view chat-images" ON storage.objects;
CREATE POLICY "Anyone can view chat-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-images');

DROP POLICY IF EXISTS "Users can upload chat-images" ON storage.objects;
CREATE POLICY "Users can upload chat-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own chat-images" ON storage.objects;
CREATE POLICY "Users can delete own chat-images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);
