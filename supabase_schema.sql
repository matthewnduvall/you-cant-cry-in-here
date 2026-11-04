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

-- 6. RLS Policies for user_profiles (Owners can edit; authenticated users can view profiles for Social/Search)
CREATE POLICY "Anyone authenticated can view profiles"
  ON public.user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- 7. RLS Policies for workout_history
CREATE POLICY "Users can view own workout history"
  ON public.workout_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout history"
  ON public.workout_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout history"
  ON public.workout_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout history"
  ON public.workout_history FOR DELETE
  USING (auth.uid() = user_id);

-- 8. RLS Policies for routines (Users can view own routines OR routines marked is_shared = true)
CREATE POLICY "Users can view own or shared routines"
  ON public.routines FOR SELECT
  USING (auth.uid() = user_id OR is_shared = TRUE);

CREATE POLICY "Users can insert own routines"
  ON public.routines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routines"
  ON public.routines FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own routines"
  ON public.routines FOR DELETE
  USING (auth.uid() = user_id);

-- 9. RLS Policies for friendships
CREATE POLICY "Users can view own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update friendship status"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);