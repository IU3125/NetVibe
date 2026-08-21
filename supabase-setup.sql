-- Add new columns to existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cv_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS open_to_work BOOLEAN DEFAULT false;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('cvs', 'cvs', true) ON CONFLICT (id) DO NOTHING;

-- Row Level Security - add policy for viewing any profile (for other users)
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Profile visibility
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_retention_days INTEGER DEFAULT 30;

-- Followers table
CREATE TABLE IF NOT EXISTS followers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- Blocked users table
CREATE TABLE IF NOT EXISTS blocked_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- RLS: followers
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view followers" ON followers;
CREATE POLICY "Anyone can view followers"
  ON followers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage own follows" ON followers;
CREATE POLICY "Users can manage own follows"
  ON followers FOR INSERT
  WITH CHECK (follower_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete own follows" ON followers;
CREATE POLICY "Users can delete own follows"
  ON followers FOR DELETE
  USING (follower_id = auth.uid());

-- RLS: blocked_users
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view blocked users" ON blocked_users;
CREATE POLICY "Anyone can view blocked users"
  ON blocked_users FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage own blocks" ON blocked_users;
CREATE POLICY "Users can manage own blocks"
  ON blocked_users FOR INSERT
  WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete own blocks" ON blocked_users;
CREATE POLICY "Users can delete own blocks"
  ON blocked_users FOR DELETE
  USING (blocker_id = auth.uid());

-- Login history table
CREATE TABLE IF NOT EXISTS login_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  city TEXT,
  country TEXT,
  isp TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own login history" ON login_history;
CREATE POLICY "Users can view own login history"
  ON login_history FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own login history" ON login_history;
CREATE POLICY "Users can insert own login history"
  ON login_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Update profile SELECT policy to respect visibility + blocks
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  USING (
    id = auth.uid() OR
    visibility = 'public' OR
    (
      visibility = 'friends' AND
      EXISTS (
        SELECT 1 FROM followers f1
        WHERE f1.follower_id = auth.uid() AND f1.following_id = profiles.id
      ) AND
      EXISTS (
        SELECT 1 FROM followers f2
        WHERE f2.follower_id = profiles.id AND f2.following_id = auth.uid()
      )
    )
  );

-- Storage policies
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
CREATE POLICY "Users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone can view covers" ON storage.objects;
CREATE POLICY "Anyone can view covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "Users can upload covers" ON storage.objects;
CREATE POLICY "Users can upload covers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone can view cvs" ON storage.objects;
CREATE POLICY "Anyone can view cvs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cvs');

DROP POLICY IF EXISTS "Users can upload cvs" ON storage.objects;
CREATE POLICY "Users can upload cvs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cvs' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own cvs" ON storage.objects;
CREATE POLICY "Users can delete own cvs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- Posts system (tables first, then storage)
-- ============================================================

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT,
  image_url TEXT,
  video_url TEXT,
  gif_url TEXT,
  document_url TEXT,
  document_name TEXT,
  bg_color TEXT DEFAULT '#131313',
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'friends')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view visible posts" ON posts;
CREATE POLICY "Anyone can view visible posts"
  ON posts FOR SELECT
  USING (
    user_id = auth.uid() OR
    visibility = 'public' OR
    (
      visibility = 'friends' AND
      EXISTS (SELECT 1 FROM followers WHERE follower_id = auth.uid() AND following_id = posts.user_id) AND
      EXISTS (SELECT 1 FROM followers WHERE follower_id = posts.user_id AND following_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own posts" ON posts;
CREATE POLICY "Users can insert own posts"
  ON posts FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own posts" ON posts;
CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own posts" ON posts;
CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  USING (user_id = auth.uid());

-- Post likes table
CREATE TABLE IF NOT EXISTS post_likes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view post likes" ON post_likes;
CREATE POLICY "Anyone can view post likes"
  ON post_likes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage own likes" ON post_likes;
CREATE POLICY "Users can manage own likes"
  ON post_likes FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own likes" ON post_likes;
CREATE POLICY "Users can delete own likes"
  ON post_likes FOR DELETE
  USING (user_id = auth.uid());

-- Post comments table
CREATE TABLE IF NOT EXISTS post_comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  parent_id BIGINT REFERENCES post_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view post comments" ON post_comments;
CREATE POLICY "Anyone can view post comments"
  ON post_comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own comments" ON post_comments;
CREATE POLICY "Users can insert own comments"
  ON post_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own comments" ON post_comments;
CREATE POLICY "Users can delete own comments"
  ON post_comments FOR DELETE
  USING (user_id = auth.uid());

-- Storage bucket for post media
INSERT INTO storage.buckets (id, name, public) VALUES ('posts', 'posts', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view post media" ON storage.objects;
CREATE POLICY "Anyone can view post media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posts');

DROP POLICY IF EXISTS "Users can upload post media" ON storage.objects;
CREATE POLICY "Users can upload post media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'posts' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own post media" ON storage.objects;
CREATE POLICY "Users can delete own post media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'posts' AND auth.uid() = (SELECT user_id FROM posts WHERE id::text = (storage.foldername(name))[1]));

-- Stories table
CREATE TABLE IF NOT EXISTS stories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  type TEXT DEFAULT 'image' CHECK (type IN ('image', 'video')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view stories" ON stories;
CREATE POLICY "Anyone can view stories"
  ON stories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own stories" ON stories;
CREATE POLICY "Users can insert own stories"
  ON stories FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own stories" ON stories;
CREATE POLICY "Users can delete own stories"
  ON stories FOR DELETE
  USING (user_id = auth.uid());

-- Story views table
CREATE TABLE IF NOT EXISTS story_views (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id BIGINT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, story_id)
);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view story_views" ON story_views;
CREATE POLICY "Users can view story_views"
  ON story_views FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert story_views" ON story_views;
CREATE POLICY "Users can insert story_views"
  ON story_views FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Stories storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('stories', 'stories', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view stories bucket" ON storage.objects;
CREATE POLICY "Anyone can view stories bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stories');

DROP POLICY IF EXISTS "Users can upload stories" ON storage.objects;
CREATE POLICY "Users can upload stories"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'stories' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own stories" ON storage.objects;
CREATE POLICY "Users can delete own stories"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'stories' AND auth.uid() = (SELECT user_id FROM stories WHERE id::text = (storage.foldername(name))[1]));
