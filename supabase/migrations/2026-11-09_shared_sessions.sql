-- ============================================================================
-- 2026-11-09: Live session sync between two friends (SYNC button in the session header)
-- Same as section 14 of supabase_schema.sql. Safe to re-run.
-- Run this once in the Supabase SQL Editor before using SYNC.
-- ============================================================================

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

-- Account deletion also removes the athlete's shared sessions (the foreign keys cascade too)
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
