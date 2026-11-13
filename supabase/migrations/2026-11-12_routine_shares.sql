-- ============================================================================
-- 2026-11-12: Send a routine straight to a friend (SEND on a routine in the routine browser)
-- Same as section 11c of supabase_schema.sql (plus the routine_shares line in delete_my_account). Safe to re-run.
-- Run this once in the Supabase SQL Editor before using SEND.
-- ============================================================================

-- One row per routine sent. The sender writes a copy of the routine (its exercises, schemes and sets) for one
-- accepted friend; the friend's app shows it until they SAVE it, LOAD it or DISMISS it (status). Only the two
-- athletes in the row can see it; only the recipient can answer it; either can delete it.
CREATE TABLE IF NOT EXISTS public.routine_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_username TEXT,
  label TEXT NOT NULL DEFAULT 'Routine',
  routine JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'saved', 'loaded', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  CONSTRAINT routine_shares_two_athletes CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS routine_shares_recipient_idx ON public.routine_shares (recipient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS routine_shares_sender_idx ON public.routine_shares (sender_id, created_at DESC);

ALTER TABLE public.routine_shares ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'routine_shares'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.routine_shares', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Sender and recipient can view routine shares"
  ON public.routine_shares FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Only send as yourself, only to an accepted friend, and only as a new (pending) share
CREATE POLICY "Athletes can send a routine to a friend"
  ON public.routine_shares FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND status = 'pending' AND public.are_friends(sender_id, recipient_id));

CREATE POLICY "Recipients can answer a routine share"
  ON public.routine_shares FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "Sender and recipient can delete a routine share"
  ON public.routine_shares FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_shares TO authenticated;

-- An answer changes only the status (and stamps answered_at): the athletes and the routine stay as sent
CREATE OR REPLACE FUNCTION public.guard_routine_share_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_id <> OLD.sender_id OR NEW.recipient_id <> OLD.recipient_id OR NEW.routine <> OLD.routine
     OR NEW.label <> OLD.label OR NEW.sender_username IS DISTINCT FROM OLD.sender_username THEN
    RAISE EXCEPTION 'Only the status of a routine share can change';
  END IF;
  NEW.answered_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_routine_share_update ON public.routine_shares;
CREATE TRIGGER guard_routine_share_update
  BEFORE UPDATE ON public.routine_shares
  FOR EACH ROW EXECUTE FUNCTION public.guard_routine_share_update();

-- Account deletion also removes routines the athlete sent or received
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
  DELETE FROM public.routine_shares WHERE sender_id = uid OR recipient_id = uid;
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
