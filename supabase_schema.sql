-- ============================================================================
-- SUPABASE DATABASE SETUP FOR "YOU CAN'T CRY IN HERE" (V2 - UPDATE RESILIENT)
-- Copy and paste this entire script into the Supabase SQL Editor and click "Run"
-- ============================================================================

-- 1. User Profiles, PRs (1RMs), Gyms, and Versioned Settings JSONB
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  avatar_url TEXT,
  schema_version INTEGER NOT NULL DEFAULT 2,
  one_rep_maxes JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{
    "bodyMetrics": { "bodyweightLbs": 220, "heightFeet": 5, "heightInches": 10 },
    "goals": {
      "goalType": "Balanced",
      "goalIncrement": 1.25,
      "goalUnit": "lb",
      "targetStandardClass": "Intermediate",
      "customGoalWeights": {}
    },
    "stimulus": { "greenDays": 2, "yellowDays": 4 },
    "routinePreferences": ["Compounds", "Compounds", "Supersets", "Supersets", "Abs"],
    "social": { "shareStatsWithFriends": true, "shareRoutinesWithFriends": true },
    "selectedGymId": ""
  }'::jsonb,
  gyms JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all required columns exist on public.user_profiles if the table was created by an earlier schema version
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 2;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS one_rep_maxes JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{
  "bodyMetrics": { "bodyweightLbs": 220, "heightFeet": 5, "heightInches": 10 },
  "goals": {
    "goalType": "Balanced",
    "goalIncrement": 1.25,
    "goalUnit": "lb",
    "targetStandardClass": "Intermediate",
    "customGoalWeights": {}
  },
  "stimulus": { "greenDays": 2, "yellowDays": 4 },
  "routinePreferences": ["Compounds", "Compounds", "Supersets", "Supersets", "Abs"],
  "social": { "shareStatsWithFriends": true, "shareRoutinesWithFriends": true },
  "selectedGymId": ""
}'::jsonb;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS gyms JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Workout History Logs (Live & Historical Sessions)
CREATE TABLE IF NOT EXISTS public.workout_history (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 2,
  title TEXT NOT NULL,
  preset_used TEXT,
  gym_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  default_rest_seconds INTEGER DEFAULT 90,
  is_complete BOOLEAN DEFAULT FALSE,
  verified_by_user BOOLEAN DEFAULT FALSE,
  slots JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 3. Saved & Shared Routines (Supports "Saved", "Shared", and "Friends" playlists)
CREATE TABLE IF NOT EXISTS public.routines (
  key TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  author_username TEXT NOT NULL,
  label TEXT NOT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  schema_version INTEGER NOT NULL DEFAULT 2,
  slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Social Friendships & Pending Friend Invites
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  addressee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- Email invites sent from Social. The inviter is always the signed-in user who sent it (enforced by RLS),
-- so an invite can't be forged on someone else's behalf. When the invited email signs up, a trigger
-- (section 11) makes the two athletes friends.
CREATE TABLE IF NOT EXISTS public.friend_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inviter_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  inviter_username TEXT,
  inviter_email TEXT,
  invited_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.friend_invites ADD COLUMN IF NOT EXISTS inviter_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.friend_invites ADD COLUMN IF NOT EXISTS inviter_username TEXT;
ALTER TABLE public.friend_invites ADD COLUMN IF NOT EXISTS inviter_email TEXT;
ALTER TABLE public.friend_invites ADD COLUMN IF NOT EXISTS invited_email TEXT;
ALTER TABLE public.friend_invites ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.friend_invites ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 5. Enable Row-Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_invites ENABLE ROW LEVEL SECURITY;

-- Policies are additive (any permissive policy grants access), so clear every existing policy on
-- these tables — including ones created by hand in the dashboard or by older versions of this
-- script — before recreating the intended set below.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('user_profiles', 'workout_history', 'routines', 'friendships', 'friend_invites')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 5b. Friendship helper functions
-- Friendships are the single source of truth for who can see whose data. A friend is an
-- 'accepted' row in public.friendships in either direction. Deleting the row (either athlete can)
-- immediately revokes access both ways.

-- True when the two athletes have an accepted friendship. SECURITY DEFINER so the policies below can
-- consult friendships without recursing through friendships' own RLS.
CREATE OR REPLACE FUNCTION public.are_friends(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = a AND f.addressee_id = b) OR (f.requester_id = b AND f.addressee_id = a))
  );
$$;

-- The caller's friendships with the other athlete's id + username (no email), for the Social page.
CREATE OR REPLACE FUNCTION public.my_friendships()
RETURNS TABLE (friendship_id UUID, other_id UUID, other_username TEXT, status TEXT, direction TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT f.id,
         CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END,
         p.username,
         f.status,
         CASE WHEN f.requester_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END
  FROM public.friendships f
  LEFT JOIN public.user_profiles p
    ON p.id = CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END
  WHERE auth.uid() IS NOT NULL
    AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid());
$$;

-- Athlete search for signed-in users: partial username match or an exact email match.
-- Returns only id + username so emails and stats are never exposed to non-friends.
CREATE OR REPLACE FUNCTION public.search_athletes(q TEXT)
RETURNS TABLE (id UUID, username TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.username
  FROM public.user_profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND length(trim(coalesce(q, ''))) >= 2
    AND (
      p.username ILIKE '%' || replace(replace(trim(ltrim(q, '@')), '%', ''), '_', '\_') || '%'
      OR lower(p.email) = lower(trim(q))
    )
  ORDER BY p.username
  LIMIT 25;
$$;

-- Sign in with a username: returns the account email for an exact username match (needed because
-- Supabase password sign-in takes an email). Exact matches only, one account at a time.
CREATE OR REPLACE FUNCTION public.resolve_login_email(identifier TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT lower(p.email) FROM public.user_profiles p
  WHERE lower(p.username) = lower(trim(ltrim(identifier, '@')))
  LIMIT 1;
$$;

-- A friend's friends, for their profile page. Returned only while the caller and `target` are
-- accepted friends and `target`'s profile is public (settings.social.profileIsPublic, default true).
-- Lists only friends whose profiles are public too, never the caller, as id + username (no email),
-- plus the caller's own relationship with each: 'friends' | 'requested' | 'incoming' | 'none'.
CREATE OR REPLACE FUNCTION public.friends_of_athlete(target UUID)
RETURNS TABLE (athlete_id UUID, username TEXT, relation TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH visible_target AS (
    SELECT p.id
    FROM public.user_profiles p
    WHERE p.id = target
      AND auth.uid() IS NOT NULL
      AND public.are_friends(auth.uid(), target)
      AND COALESCE((p.settings -> 'social' ->> 'profileIsPublic')::boolean, TRUE)
  ),
  their_friends AS (
    SELECT CASE WHEN f.requester_id = target THEN f.addressee_id ELSE f.requester_id END AS friend_id
    FROM public.friendships f
    JOIN visible_target vt ON TRUE
    WHERE f.status = 'accepted'
      AND (f.requester_id = target OR f.addressee_id = target)
  )
  SELECT p.id,
         p.username,
         CASE
           WHEN public.are_friends(auth.uid(), p.id) THEN 'friends'
           WHEN EXISTS (SELECT 1 FROM public.friendships x
                        WHERE x.status = 'pending' AND x.requester_id = auth.uid() AND x.addressee_id = p.id)
             THEN 'requested'
           WHEN EXISTS (SELECT 1 FROM public.friendships x
                        WHERE x.status = 'pending' AND x.requester_id = p.id AND x.addressee_id = auth.uid())
             THEN 'incoming'
           ELSE 'none'
         END
  FROM their_friends t
  JOIN public.user_profiles p ON p.id = t.friend_id
  WHERE p.id <> auth.uid()
    AND COALESCE((p.settings -> 'social' ->> 'profileIsPublic')::boolean, TRUE)
  ORDER BY lower(p.username);
$$;

REVOKE ALL ON FUNCTION public.friends_of_athlete(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friends_of_athlete(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.my_friendships() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_athletes(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_friendships() TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_athletes(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.are_friends(UUID, UUID) TO anon, authenticated;

-- 6. RLS Policies for user_profiles (owners and accepted friends can view; owners can edit)
DROP POLICY IF EXISTS "Anyone authenticated can view profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Owners and friends can view profiles" ON public.user_profiles;
CREATE POLICY "Owners and friends can view profiles"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id OR public.are_friends(auth.uid(), id));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- 6b. Automatic Trigger + Backfill from auth.users -> public.user_profiles
-- Ensures every registered user in auth.users always has a searchable row in public.user_profiles
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, username, one_rep_maxes, settings, updated_at)
  VALUES (
    NEW.id,
    LOWER(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->'yccih_cloud_state_v3'->'oneRepMaxes', '{}'::jsonb),
    COALESCE(NEW.raw_user_meta_data->'yccih_cloud_state_v3'->'settings', '{}'::jsonb) ||
      jsonb_build_object(
        'oneRepMaxes', COALESCE(NEW.raw_user_meta_data->'yccih_cloud_state_v3'->'oneRepMaxes', '{}'::jsonb),
        'recentHistory', COALESCE(NEW.raw_user_meta_data->'yccih_cloud_state_v3'->'history', '[]'::jsonb),
        'savedRoutines', COALESCE(NEW.raw_user_meta_data->'yccih_cloud_state_v3'->'savedRoutines', '[]'::jsonb),
        'sharedRoutines', COALESCE(NEW.raw_user_meta_data->'yccih_cloud_state_v3'->'sharedRoutines', '[]'::jsonb),
        'activeSession', NEW.raw_user_meta_data->'yccih_cloud_state_v3'->'activeSession'
      ),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        username = COALESCE(public.user_profiles.username, EXCLUDED.username),
        one_rep_maxes = COALESCE(public.user_profiles.one_rep_maxes, '{}'::jsonb) || COALESCE(EXCLUDED.one_rep_maxes, '{}'::jsonb),
        settings = COALESCE(public.user_profiles.settings, '{}'::jsonb) || COALESCE(EXCLUDED.settings, '{}'::jsonb),
        updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill any existing users in auth.users who do not yet have a public.user_profiles row
INSERT INTO public.user_profiles (id, email, username, one_rep_maxes, settings, updated_at)
SELECT
  id,
  LOWER(email),
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  COALESCE(raw_user_meta_data->'yccih_cloud_state_v3'->'oneRepMaxes', '{}'::jsonb),
  COALESCE(raw_user_meta_data->'yccih_cloud_state_v3'->'settings', '{}'::jsonb) ||
    jsonb_build_object(
      'oneRepMaxes', COALESCE(raw_user_meta_data->'yccih_cloud_state_v3'->'oneRepMaxes', '{}'::jsonb),
      'recentHistory', COALESCE(raw_user_meta_data->'yccih_cloud_state_v3'->'history', '[]'::jsonb),
      'savedRoutines', COALESCE(raw_user_meta_data->'yccih_cloud_state_v3'->'savedRoutines', '[]'::jsonb),
      'sharedRoutines', COALESCE(raw_user_meta_data->'yccih_cloud_state_v3'->'sharedRoutines', '[]'::jsonb),
      'activeSession', raw_user_meta_data->'yccih_cloud_state_v3'->'activeSession'
    ),
  NOW()
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      username = COALESCE(public.user_profiles.username, EXCLUDED.username),
      one_rep_maxes = COALESCE(public.user_profiles.one_rep_maxes, '{}'::jsonb) || COALESCE(EXCLUDED.one_rep_maxes, '{}'::jsonb),
      settings = COALESCE(public.user_profiles.settings, '{}'::jsonb) || COALESCE(EXCLUDED.settings, '{}'::jsonb);

-- 7. RLS Policies for workout_history (owners and accepted friends can view; owners can insert/update/delete)
DROP POLICY IF EXISTS "Users can view own workout history" ON public.workout_history;
DROP POLICY IF EXISTS "Anyone can view workout history" ON public.workout_history;
DROP POLICY IF EXISTS "Owners and friends can view workout history" ON public.workout_history;
CREATE POLICY "Owners and friends can view workout history"
  ON public.workout_history FOR SELECT
  USING (auth.uid() = user_id OR public.are_friends(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert own workout history" ON public.workout_history;
CREATE POLICY "Users can insert own workout history"
  ON public.workout_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own workout history" ON public.workout_history;
CREATE POLICY "Users can update own workout history"
  ON public.workout_history FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own workout history" ON public.workout_history;
CREATE POLICY "Users can delete own workout history"
  ON public.workout_history FOR DELETE
  USING (auth.uid() = user_id);

-- 8. RLS Policies for routines (owners see all of theirs; accepted friends see shared ones)
DROP POLICY IF EXISTS "Users can view own or shared routines" ON public.routines;
DROP POLICY IF EXISTS "Owners and friends can view routines" ON public.routines;
CREATE POLICY "Owners and friends can view routines"
  ON public.routines FOR SELECT
  USING (auth.uid() = user_id OR (is_shared = TRUE AND public.are_friends(auth.uid(), user_id)));

DROP POLICY IF EXISTS "Users can insert own routines" ON public.routines;
CREATE POLICY "Users can insert own routines"
  ON public.routines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own routines" ON public.routines;
CREATE POLICY "Users can update own routines"
  ON public.routines FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own routines" ON public.routines;
CREATE POLICY "Users can delete own routines"
  ON public.routines FOR DELETE
  USING (auth.uid() = user_id);

-- 9. RLS Policies for friendships
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
CREATE POLICY "Users can view own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Requests always start as 'pending' and can't target yourself
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id AND status = 'pending' AND requester_id <> addressee_id);

-- Either athlete can remove the friendship (revokes access both ways)
DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
CREATE POLICY "Users can delete own friendships"
  ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Only the recipient can accept or decline (the requester can't accept their own request)
DROP POLICY IF EXISTS "Users can update friendship status" ON public.friendships;
DROP POLICY IF EXISTS "Recipients can answer friend requests" ON public.friendships;
CREATE POLICY "Recipients can answer friend requests"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

-- 10. RLS Policies for friend_invites (only the signed-in inviter can create or see their invites)
DROP POLICY IF EXISTS "Inviters can create invites" ON public.friend_invites;
CREATE POLICY "Inviters can create invites"
  ON public.friend_invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_user_id);

DROP POLICY IF EXISTS "Inviters can view their invites" ON public.friend_invites;
CREATE POLICY "Inviters can view their invites"
  ON public.friend_invites FOR SELECT
  USING (auth.uid() = inviter_user_id);

-- The default friend every new account starts with: @matt. Looked up by the sign-in account's email
-- (auth.users, always set), falling back to the username, so a profile row without an email can't
-- silently skip it.
CREATE OR REPLACE FUNCTION public.default_friend_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id FROM auth.users WHERE lower(email) = 'matthew.n.duvall@gmail.com' LIMIT 1),
    (SELECT id FROM public.user_profiles WHERE lower(username) = 'matt' LIMIT 1)
  );
$$;

REVOKE ALL ON FUNCTION public.default_friend_id() FROM PUBLIC, anon, authenticated;

-- New profile: friends with @matt and with everyone who emailed an invite to this address.
CREATE OR REPLACE FUNCTION public.handle_new_profile_friendships()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  default_friend UUID := public.default_friend_id();
  my_email TEXT;
  inv RECORD;
BEGIN
  IF default_friend IS NOT NULL AND default_friend <> NEW.id THEN
    INSERT INTO public.friendships (requester_id, addressee_id, status)
    SELECT default_friend, NEW.id, 'accepted'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (f.requester_id = default_friend AND f.addressee_id = NEW.id)
         OR (f.requester_id = NEW.id AND f.addressee_id = default_friend)
    );
  END IF;

  -- The verified sign-in email (falls back to the profile's copy)
  SELECT lower(email) INTO my_email FROM auth.users WHERE id = NEW.id;
  my_email := COALESCE(my_email, lower(NEW.email));

  IF my_email IS NOT NULL THEN
    FOR inv IN
      SELECT DISTINCT inviter_user_id FROM public.friend_invites
      WHERE lower(invited_email) = my_email
        AND inviter_user_id IS NOT NULL
        AND inviter_user_id <> NEW.id
    LOOP
      INSERT INTO public.friendships (requester_id, addressee_id, status)
      SELECT inv.inviter_user_id, NEW.id, 'accepted'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE (f.requester_id = inv.inviter_user_id AND f.addressee_id = NEW.id)
           OR (f.requester_id = NEW.id AND f.addressee_id = inv.inviter_user_id)
      );
    END LOOP;
    UPDATE public.friend_invites SET status = 'accepted'
    WHERE lower(invited_email) = my_email AND status <> 'accepted';
  END IF;

  RETURN NEW;
END;
$$;

-- Existing athletes who receive an invite: the app calls this on every friendship sync. It accepts
-- invites addressed to the caller's own verified account email, then marks them used so removing the
-- friend later sticks.
CREATE OR REPLACE FUNCTION public.claim_my_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  my_email TEXT;
  claimed INTEGER := 0;
  inv RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;
  SELECT lower(email) INTO my_email FROM auth.users WHERE id = auth.uid();
  IF my_email IS NULL THEN
    RETURN 0;
  END IF;

  FOR inv IN
    SELECT DISTINCT inviter_user_id FROM public.friend_invites
    WHERE lower(invited_email) = my_email
      AND status <> 'accepted'
      AND inviter_user_id IS NOT NULL
      AND inviter_user_id <> auth.uid()
  LOOP
    INSERT INTO public.friendships (requester_id, addressee_id, status)
    SELECT inv.inviter_user_id, auth.uid(), 'accepted'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (f.requester_id = inv.inviter_user_id AND f.addressee_id = auth.uid())
         OR (f.requester_id = auth.uid() AND f.addressee_id = inv.inviter_user_id)
    );
    claimed := claimed + 1;
  END LOOP;

  UPDATE public.friend_invites SET status = 'accepted'
  WHERE lower(invited_email) = my_email AND status <> 'accepted';
  RETURN claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_my_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_my_invites() TO authenticated;

-- Invite links carry the invite's id. Whoever signs up or signs in through the link becomes friends with
-- the inviter, whatever email they use. Each unused invite can be claimed once (so a forwarded email
-- can't be reused); claiming it again is fine for the athlete who already did. Returns true when the two
-- athletes are friends afterwards.
CREATE OR REPLACE FUNCTION public.claim_invite_link(invite UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $
DECLARE
  me UUID := auth.uid();
  inv RECORD;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT id, inviter_user_id, status INTO inv FROM public.friend_invites WHERE id = invite;
  IF inv.id IS NULL OR inv.inviter_user_id IS NULL OR inv.inviter_user_id = me THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE ((f.requester_id = inv.inviter_user_id AND f.addressee_id = me)
        OR (f.requester_id = me AND f.addressee_id = inv.inviter_user_id))
      AND f.status = 'accepted'
  ) THEN
    UPDATE public.friend_invites SET status = 'accepted' WHERE id = inv.id AND status <> 'accepted';
    RETURN TRUE;
  END IF;

  IF inv.status = 'accepted' THEN
    RETURN FALSE; -- already used by someone else
  END IF;

  -- A pending request between the two (either direction) becomes the friendship
  UPDATE public.friendships SET status = 'accepted'
  WHERE (requester_id = inv.inviter_user_id AND addressee_id = me)
     OR (requester_id = me AND addressee_id = inv.inviter_user_id);
  IF NOT FOUND THEN
    INSERT INTO public.friendships (requester_id, addressee_id, status)
    VALUES (inv.inviter_user_id, me, 'accepted');
  END IF;

  UPDATE public.friend_invites SET status = 'accepted' WHERE id = inv.id;
  RETURN TRUE;
END;
$;

REVOKE ALL ON FUNCTION public.claim_invite_link(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_invite_link(UUID) TO authenticated;

DROP TRIGGER IF EXISTS on_user_profile_created_friendships ON public.user_profiles;
CREATE TRIGGER on_user_profile_created_friendships
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_friendships();

-- 11b. Live session sync between two friends (SYNC button in the session header; needed by delete_my_account below)
-- One row per sync. The owner invites an accepted friend; when the friend accepts, both apps poll this
-- row and mirror the exercise structure (exercises, order, schemes, set count and set types — never
-- weights, reps or checkmarks). Only the two athletes in the row can see or change it.
CREATE TABLE IF NOT EXISTS public.shared_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_username TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'ended')),
  structure JSONB NOT NULL DEFAULT '{}'::jsonb,
  structure_version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shared_sessions_two_athletes CHECK (owner_id <> participant_id)
);

CREATE INDEX IF NOT EXISTS shared_sessions_owner_idx ON public.shared_sessions (owner_id, status);
CREATE INDEX IF NOT EXISTS shared_sessions_participant_idx ON public.shared_sessions (participant_id, status);

ALTER TABLE public.shared_sessions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_sessions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.shared_sessions', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Session members can view shared sessions"
  ON public.shared_sessions FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = participant_id);

-- Only invite yourself as owner, and only an accepted friend
CREATE POLICY "Athletes can invite a friend to sync"
  ON public.shared_sessions FOR INSERT
  WITH CHECK (auth.uid() = owner_id AND public.are_friends(owner_id, participant_id));

CREATE POLICY "Session members can update shared sessions"
  ON public.shared_sessions FOR UPDATE
  USING (auth.uid() = owner_id OR auth.uid() = participant_id)
  WITH CHECK (auth.uid() = owner_id OR auth.uid() = participant_id);

CREATE POLICY "Session members can delete shared sessions"
  ON public.shared_sessions FOR DELETE
  USING (auth.uid() = owner_id OR auth.uid() = participant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_sessions TO authenticated;

-- The two athletes in a sync can't be swapped after the invite, and updated_at always moves forward
CREATE OR REPLACE FUNCTION public.guard_shared_session_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id <> OLD.owner_id OR NEW.participant_id <> OLD.participant_id THEN
    RAISE EXCEPTION 'The athletes in a shared session cannot be changed';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_shared_session_update ON public.shared_sessions;
CREATE TRIGGER guard_shared_session_update
  BEFORE UPDATE ON public.shared_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_shared_session_update();

-- 12. Account deletion: the signed-in athlete permanently deletes their account and every row that
-- belongs to them or mentions their email. Runs as the database owner because removing the sign-in
-- account (auth.users) isn't allowed for normal users. Each table is cleared explicitly so this works
-- even where an older table version lacks ON DELETE CASCADE.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  my_email TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  SELECT lower(email) INTO my_email FROM auth.users WHERE id = uid;

  DELETE FROM public.friend_invites
  WHERE inviter_user_id = uid OR (my_email IS NOT NULL AND lower(invited_email) = my_email);
  DELETE FROM public.shared_sessions WHERE owner_id = uid OR participant_id = uid;
  DELETE FROM public.friendships WHERE requester_id = uid OR addressee_id = uid;
  DELETE FROM public.workout_history WHERE user_id = uid;
  DELETE FROM public.routines WHERE user_id = uid;
  DELETE FROM public.user_profiles WHERE id = uid;
  -- Removes the sign-in account; Supabase cascades its sessions, refresh tokens and identities
  DELETE FROM auth.users WHERE id = uid;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- 13. Keep sign-in tokens small: Supabase copies user_metadata into every access token. Older app
-- builds saved the whole app state there ("yccih_cloud_state_v3"), producing tokens over 100 KB that
-- the API rejects. This trigger drops that key on every write, so an outdated tab or device can't
-- bring it back. (History lives in public.workout_history.)
CREATE OR REPLACE FUNCTION public.strip_app_state_from_user_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data ? 'yccih_cloud_state_v3' THEN
    NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'yccih_cloud_state_v3';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS strip_app_state_from_user_metadata ON auth.users;
CREATE TRIGGER strip_app_state_from_user_metadata
  BEFORE INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.strip_app_state_from_user_metadata();
