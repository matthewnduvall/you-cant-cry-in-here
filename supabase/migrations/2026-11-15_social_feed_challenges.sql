-- ============================================================================
-- 2026-11-15: Social feed (posts, reactions, comments) and challenges
-- Same as section 15 of supabase_schema.sql. Safe to re-run. Run once in the Supabase SQL Editor.
--
-- activity_posts       what friends see on Home's FEED: workouts and routines you post, PRs (posted
--                      automatically unless turned off), challenges you finish
-- post_reactions       one row per athlete per emoji per post
-- post_comments        short comments on a post
-- challenges           a goal friends can join (weight target, total reps, total volume, sessions) in a time window
-- challenge_participants  who joined, and each one's progress (worked out by their own app from their History)
--
-- Who sees what: a post, and a challenge, can be seen by its author and the author's accepted friends
-- (are_friends). Reactions and comments are visible to whoever can see the post. You can join a challenge you can
-- see, only while you share your stats with friends. Usernames on every row are filled in by the database from
-- user_profiles, so they can't be faked. Deleting an account removes all of it (ON DELETE CASCADE from auth.users).
-- ============================================================================

-- --- Posts ----------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('workout', 'routine', 'pr', 'challenge_done')),
  -- The workout / routine / challenge it is about (app ids), and a snapshot to show (exercises, PRs, the routine)
  ref_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  caption TEXT CHECK (caption IS NULL OR char_length(caption) <= 280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activity_posts_user_idx ON public.activity_posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_posts_created_idx ON public.activity_posts (created_at DESC);
-- One post per workout / PR set / finished challenge (the app may retry)
CREATE UNIQUE INDEX IF NOT EXISTS activity_posts_unique_ref ON public.activity_posts (user_id, kind, ref_id) WHERE ref_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.post_reactions (
  post_id UUID NOT NULL REFERENCES public.activity_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  emoji TEXT NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.activity_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS post_comments_post_idx ON public.post_comments (post_id, created_at);

-- --- Challenges -----------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('target_weight', 'total_reps', 'total_volume', 'sessions')),
  exercise_id TEXT,
  target NUMERIC NOT NULL CHECK (target > 0),
  title TEXT CHECK (title IS NULL OR char_length(title) <= 80),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT challenges_window CHECK (ends_at > starts_at),
  CONSTRAINT challenges_exercise CHECK (kind = 'sessions' OR exercise_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS challenges_creator_idx ON public.challenges (creator_id, ends_at DESC);

CREATE TABLE IF NOT EXISTS public.challenge_participants (
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  progress NUMERIC NOT NULL DEFAULT 0,
  -- true when the number is an estimated (calculated) 1RM
  progress_calculated BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (challenge_id, user_id)
);
CREATE INDEX IF NOT EXISTS challenge_participants_user_idx ON public.challenge_participants (user_id);

-- --- Helpers ----------------------------------------------------------------------------------------------------
-- The signed-in athlete shares their stats with friends (Social → PRIVACY: on unless turned off)
CREATE OR REPLACE FUNCTION public.my_stats_shared()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (p.settings -> 'social' ->> 'shareStatsWithFriends') IS DISTINCT FROM 'false'
       FROM public.user_profiles p WHERE p.id = auth.uid()),
    TRUE
  );
$$;
REVOKE ALL ON FUNCTION public.my_stats_shared() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_stats_shared() TO authenticated;

-- Fill a row's username from its athlete's profile (never trusted from the app)
CREATE OR REPLACE FUNCTION public.fill_social_username()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  who UUID := COALESCE((to_jsonb(NEW) ->> 'user_id')::uuid, (to_jsonb(NEW) ->> 'creator_id')::uuid);
BEGIN
  NEW.username := (SELECT p.username FROM public.user_profiles p WHERE p.id = who);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fill_username ON public.activity_posts;
CREATE TRIGGER fill_username BEFORE INSERT ON public.activity_posts FOR EACH ROW EXECUTE FUNCTION public.fill_social_username();
DROP TRIGGER IF EXISTS fill_username ON public.post_reactions;
CREATE TRIGGER fill_username BEFORE INSERT ON public.post_reactions FOR EACH ROW EXECUTE FUNCTION public.fill_social_username();
DROP TRIGGER IF EXISTS fill_username ON public.post_comments;
CREATE TRIGGER fill_username BEFORE INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.fill_social_username();
DROP TRIGGER IF EXISTS fill_username ON public.challenges;
CREATE TRIGGER fill_username BEFORE INSERT ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.fill_social_username();
DROP TRIGGER IF EXISTS fill_username ON public.challenge_participants;
CREATE TRIGGER fill_username BEFORE INSERT ON public.challenge_participants FOR EACH ROW EXECUTE FUNCTION public.fill_social_username();

-- A participant's update may only change their progress (and stamps updated_at)
CREATE OR REPLACE FUNCTION public.guard_challenge_participant_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.challenge_id <> OLD.challenge_id OR NEW.user_id <> OLD.user_id OR NEW.username IS DISTINCT FROM OLD.username
     OR NEW.joined_at <> OLD.joined_at THEN
    RAISE EXCEPTION 'Only progress can change';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_challenge_participant_update ON public.challenge_participants;
CREATE TRIGGER guard_challenge_participant_update
  BEFORE UPDATE ON public.challenge_participants
  FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_participant_update();

-- --- Row-level security -----------------------------------------------------------------------------------------
ALTER TABLE public.activity_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('activity_posts', 'post_reactions', 'post_comments', 'challenges', 'challenge_participants')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Posts: the author and their friends
CREATE POLICY "Authors and friends can view posts"
  ON public.activity_posts FOR SELECT
  USING (auth.uid() = user_id OR public.are_friends(auth.uid(), user_id));
CREATE POLICY "Athletes can post as themselves"
  ON public.activity_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors can edit their posts"
  ON public.activity_posts FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors can delete their posts"
  ON public.activity_posts FOR DELETE
  USING (auth.uid() = user_id);

-- Reactions and comments: whoever can see the post (the EXISTS runs under the posts' own policy)
CREATE POLICY "Anyone who sees the post sees its reactions"
  ON public.post_reactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.activity_posts p WHERE p.id = post_id));
CREATE POLICY "React as yourself to a post you can see"
  ON public.post_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.activity_posts p WHERE p.id = post_id));
CREATE POLICY "Remove your own reaction"
  ON public.post_reactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone who sees the post sees its comments"
  ON public.post_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.activity_posts p WHERE p.id = post_id));
CREATE POLICY "Comment as yourself on a post you can see"
  ON public.post_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.activity_posts p WHERE p.id = post_id));
CREATE POLICY "Delete your comment, or any comment on your post"
  ON public.post_comments FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.activity_posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  );

-- Challenges: the creator and their friends (only they can join, so this covers every participant; no reference to
-- challenge_participants here, whose own policy reads challenges — that would recurse)
CREATE POLICY "Creators and their friends can view challenges"
  ON public.challenges FOR SELECT
  USING (auth.uid() = creator_id OR public.are_friends(auth.uid(), creator_id));
CREATE POLICY "Athletes can create challenges as themselves"
  ON public.challenges FOR INSERT
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can delete their challenges"
  ON public.challenges FOR DELETE
  USING (auth.uid() = creator_id);

CREATE POLICY "Anyone who sees the challenge sees who joined"
  ON public.challenge_participants FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id));
-- Join as yourself, a challenge you can see, while you share your stats with friends
CREATE POLICY "Join a challenge you can see while sharing your stats"
  ON public.challenge_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.my_stats_shared()
    AND EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = challenge_id AND (c.creator_id = auth.uid() OR public.are_friends(auth.uid(), c.creator_id))
    )
  );
CREATE POLICY "Update your own progress"
  ON public.challenge_participants FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Leave a challenge"
  ON public.challenge_participants FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_posts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_reactions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.challenges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_participants TO authenticated;
