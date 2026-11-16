-- Weekly pattern challenges ("3 sessions a week for 4 weeks", "100 push-ups a week for 6 weeks").
--
-- challenges.period: 'total' (the target is reached over the whole window; every challenge before this) or 'week'
-- (the target must be reached in each 7-day week counted from starts_at; the number of weeks is the window's length
-- in weeks). A weekly challenge can't be a weight target. Participants' progress for a weekly challenge is the
-- number of weeks met in a row from week 1 (utils/challenges.js); it is complete when every week is met.
--
-- claim_challenge_emails also returns period and starts_at so the email can say "a week for 4 weeks". Its return
-- type changes, so it is dropped and created again. Safe to re-run.

ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'total';
ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS challenges_period;
ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_period CHECK (period IN ('total', 'week') AND (period = 'total' OR kind <> 'target_weight'));

ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

DROP FUNCTION IF EXISTS public.claim_challenge_emails(UUID, UUID);
CREATE FUNCTION public.claim_challenge_emails(p_challenge UUID, p_creator UUID)
RETURNS TABLE (
  email TEXT,
  username TEXT,
  creator_username TEXT,
  kind TEXT,
  exercise_id TEXT,
  target NUMERIC,
  title TEXT,
  period TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.challenges%ROWTYPE;
BEGIN
  UPDATE public.challenges ch
     SET notified_at = NOW()
   WHERE ch.id = p_challenge
     AND ch.creator_id = p_creator
     AND ch.notified_at IS NULL
  RETURNING ch.* INTO c;

  IF c.id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.email::TEXT,
         p.username::TEXT,
         (SELECT cp.username FROM public.user_profiles cp WHERE cp.id = c.creator_id)::TEXT,
         c.kind,
         c.exercise_id,
         c.target,
         c.title,
         c.period,
         c.starts_at,
         c.ends_at
    FROM public.friendships f
    JOIN auth.users u
      ON u.id = CASE WHEN f.requester_id = c.creator_id THEN f.addressee_id ELSE f.requester_id END
    LEFT JOIN public.user_profiles p ON p.id = u.id
   WHERE f.status = 'accepted'
     AND (f.requester_id = c.creator_id OR f.addressee_id = c.creator_id)
     AND u.email IS NOT NULL
     AND COALESCE((p.settings -> 'social' ->> 'emailChallenges') <> 'false', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_challenge_emails(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_challenge_emails(UUID, UUID) TO service_role;
