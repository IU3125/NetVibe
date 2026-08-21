-- ============================================================
-- NetVibe - Discover backend (phase 3: hashtags, suggestions, communities)
-- Run in SQL Editor. Safe to run multiple times.
-- ============================================================

-- 1. Hashtags + post links
CREATE TABLE IF NOT EXISTS hashtags (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_hashtags (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  hashtag_id BIGINT NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  UNIQUE(post_id, hashtag_id)
);

-- Auto-parse #tags from post text
CREATE OR REPLACE FUNCTION sync_post_hashtags() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  tag TEXT;
BEGIN
  DELETE FROM post_hashtags WHERE post_id = NEW.id;
  IF NEW.text IS NULL THEN
    RETURN NEW;
  END IF;
  FOR tag IN SELECT lower(t) FROM regexp_matches(NEW.text, '#([A-Za-z0-9_]+)', 'g') AS m(t)
  LOOP
    INSERT INTO hashtags(name) VALUES (tag) ON CONFLICT (name) DO NOTHING;
    INSERT INTO post_hashtags(post_id, hashtag_id)
    SELECT NEW.id, id FROM hashtags WHERE name = tag
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_post_hashtags ON posts;
CREATE TRIGGER trg_sync_post_hashtags
  AFTER INSERT OR UPDATE OF text ON posts
  FOR EACH ROW EXECUTE FUNCTION sync_post_hashtags();

-- Backfill hashtags for existing posts
CREATE OR REPLACE FUNCTION backfill_hashtags() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  tag TEXT;
BEGIN
  FOR r IN SELECT id, text FROM posts WHERE text ILIKE '%#%'
  LOOP
    FOR tag IN SELECT lower(t) FROM regexp_matches(r.text, '#([A-Za-z0-9_]+)', 'g') AS m(t)
    LOOP
      INSERT INTO hashtags(name) VALUES (tag) ON CONFLICT (name) DO NOTHING;
      INSERT INTO post_hashtags(post_id, hashtag_id)
      SELECT r.id, id FROM hashtags WHERE name = tag
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

-- 2. Communities (minimal: join/leave + member count)
CREATE TABLE IF NOT EXISTS communities (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  icon TEXT DEFAULT 'groups',
  color TEXT DEFAULT 'primary',
  hashtag TEXT,
  image_url TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_members (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

-- 3. RLS
ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view hashtags" ON hashtags;
CREATE POLICY "Anyone can view hashtags" ON hashtags FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view post hashtags" ON post_hashtags;
CREATE POLICY "Anyone can view post hashtags" ON post_hashtags FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view communities" ON communities;
CREATE POLICY "Anyone can view communities" ON communities FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create communities" ON communities;
CREATE POLICY "Users can create communities" ON communities FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Creators can update own communities" ON communities;
CREATE POLICY "Creators can update own communities" ON communities FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Anyone can view members" ON community_members;
CREATE POLICY "Anyone can view members" ON community_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join communities" ON community_members;
CREATE POLICY "Users can join communities" ON community_members FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can leave communities" ON community_members;
CREATE POLICY "Users can leave communities" ON community_members FOR DELETE USING (user_id = auth.uid());

-- 4. Suggestion RPC: friends-of-friends first, then most followed
DROP FUNCTION IF EXISTS get_suggestions(integer);
CREATE OR REPLACE FUNCTION get_suggestions(limit_n INT)
RETURNS TABLE (
  id UUID, full_name TEXT, username TEXT, avatar_url TEXT, job_title TEXT, mutual BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH my_followings AS (
    SELECT following_id FROM followers WHERE follower_id = auth.uid()
  ),
  friends_of_friends AS (
    SELECT f2.follower_id AS cand_id, count(*) AS mutual
    FROM followers f2
    WHERE f2.following_id IN (SELECT following_id FROM my_followings)
      AND f2.follower_id <> auth.uid()
      AND f2.follower_id NOT IN (SELECT following_id FROM followers WHERE follower_id = auth.uid())
    GROUP BY f2.follower_id
  ),
  not_followed AS (
    SELECT p.id, p.full_name, p.username, p.avatar_url, p.job_title,
           COALESCE(f.mutual, 0) AS mutual
    FROM profiles p
    LEFT JOIN friends_of_friends f ON f.cand_id = p.id
    WHERE p.id <> auth.uid()
      AND p.id NOT IN (SELECT following_id FROM followers WHERE follower_id = auth.uid())
  )
  SELECT nf.id, nf.full_name, nf.username, nf.avatar_url, nf.job_title, nf.mutual
  FROM not_followed nf
  ORDER BY nf.mutual DESC, nf.username ASC
  LIMIT limit_n;
END;
$$;

-- 5. Trending hashtags RPC (post count in last 7 days)
CREATE OR REPLACE FUNCTION get_trending_hashtags(limit_n INT)
RETURNS TABLE (name TEXT, post_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT h.name, count(ph.post_id)::BIGINT AS post_count
  FROM hashtags h
  JOIN post_hashtags ph ON ph.hashtag_id = h.id
  JOIN posts p ON p.id = ph.post_id
  WHERE p.created_at > NOW() - INTERVAL '7 days'
  GROUP BY h.name
  ORDER BY post_count DESC
  LIMIT limit_n;
END;
$$;

-- 6. Seed communities (skips if communities already exist)
INSERT INTO communities (name, description, category, icon, color, hashtag, image_url, is_featured)
SELECT * FROM (VALUES
  (
    'Web Design Forum', 'The largest community for web designers. Share your work, get feedback and grow together.',
    'featured', 'web', 'primary', 'design',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuA-OaMu31WwYxBo6B6dkgBBMzw43_-2dGiZP-Xr9PRvhoSC9R7oSRXdUMrxpOHkrjHIsBYI9YhVynD-6hFVplH0C3XCAYj6RD4Gv7St4BqI3wYRXosAO88CcvR0Gs67tBsgDuwtAruzokkCDci6u034MSlywuj0YOXFe39FEvn5vG1e4-68pP9JTkLGavpZZjs-09TIaC6GpDJGyskJW6NdwBq9n8ckzvc-tK_GyznnfxIO_QcyIDWHqg5_9NbnvbfVOuV3oMD3Yrw',
    TRUE
  ),
  (
    'Wedding Photography', 'Wedding photographers from around the world sharing their best shots and tips.',
    'photography', 'photo-camera', 'primary', 'photography',
    NULL, FALSE
  ),
  (
    'Computer Sale & Buy', 'Buy and sell computers, parts and accessories. Trusted marketplace inside NetVibe.',
    'buysell', 'computer', 'secondary', 'computers',
    NULL, FALSE
  ),
  (
    'Gaming Community', 'Daily clips, live streams, game news and squad finder. 50k+ gamers and growing.',
    'gaming', 'sports-esports', 'tertiary', 'gaming',
    NULL, FALSE
  )
) AS v(name, description, category, icon, color, hashtag, image_url, is_featured)
WHERE NOT EXISTS (SELECT 1 FROM communities);

-- 7. Seed members: random 60% of existing profiles join each community (demo counts)
INSERT INTO community_members (community_id, user_id)
SELECT c.id, p.id
FROM communities c
CROSS JOIN profiles p
WHERE random() < 0.6
ON CONFLICT DO NOTHING;

-- 8. Backfill hashtags for existing posts
SELECT backfill_hashtags();
