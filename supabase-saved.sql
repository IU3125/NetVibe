-- ============================================================
-- Saved posts system
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own saved posts" ON saved_posts;
CREATE POLICY "Users can view own saved posts"
  ON saved_posts FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own saved posts" ON saved_posts;
CREATE POLICY "Users can insert own saved posts"
  ON saved_posts FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own saved posts" ON saved_posts;
CREATE POLICY "Users can delete own saved posts"
  ON saved_posts FOR DELETE
  USING (user_id = auth.uid());
