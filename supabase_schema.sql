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
      "goalType": "Strength",
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
    "goalType": "Strength",
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

-- 5. Enable Row-Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for user_profiles (Owners can edit; anyone can view profiles for Social/Search & Username Lookup)
DROP POLICY IF EXISTS "Anyone authenticated can view profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.user_profiles;
CREATE POLICY "Anyone can view profiles"
  ON public.user_profiles FOR SELECT
  USING (true);

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

-- 7. RLS Policies for workout_history (Anyone can view workout_history for friend PRs & Leaderboards; owners can insert/update/delete)
DROP POLICY IF EXISTS "Users can view own workout history" ON public.workout_history;
DROP POLICY IF EXISTS "Anyone can view workout history" ON public.workout_history;
CREATE POLICY "Anyone can view workout history"
  ON public.workout_history FOR SELECT
  USING (true);

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

-- 8. RLS Policies for routines (Users can view own routines OR routines marked is_shared = true)
DROP POLICY IF EXISTS "Users can view own or shared routines" ON public.routines;
CREATE POLICY "Users can view own or shared routines"
  ON public.routines FOR SELECT
  USING (auth.uid() = user_id OR is_shared = TRUE);

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

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
CREATE POLICY "Users can delete own friendships"
  ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users can update friendship status" ON public.friendships;
CREATE POLICY "Users can update friendship status"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
