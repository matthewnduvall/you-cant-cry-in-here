-- Repeating pattern challenges ("100 push-ups a day for 30 days", "3 sessions a week for 4 weeks", "12 sessions a
-- month for 3 months").
--
-- challenges.period: 'total' (the target is reached over the whole window; every challenge before this) or 'day' /
-- 'week' / 'month' (the target must be reached in each day, 7-day week or calendar month counted from starts_at). A
-- repeating challenge can't be a weight target. Participants' progress is the number of periods met in a row from the
-- first (utils/challenges.js); it is complete when every period is met. Re-running it updates the constraint.
--
-- Personal challenges (challenges.is_private): a challenge an athlete sets only for themselves. Only its creator can
-- see it or its participant row, only the creator can join it (no need to share stats for that), and nobody is
-- emailed about it.
--
-- claim_challenge_emails also returns period and starts_at so the email can say "a week for 4 weeks". Its return
-- type changes, so it is dropped and created again. Safe to re-run.

ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'total';
ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS challenges_period;
ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_period CHECK (period IN ('total', 'day', 'week', 'month') AND (period = 'total' OR kind <> 'target_weight'));

ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- Personal challenges: seen and joined by their creator only
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;

DROP POLICY IF EXISTS "Creators and their friends can view challenges" ON public.challenges;
CREATE POLICY "Creators and their friends can view challenges"
  ON public.challenges FOR SELECT
  USING (auth.uid() = creator_id OR (NOT is_private AND public.are_friends(auth.uid(), creator_id)));

-- Join as yourself: your own personal challenge, or (while you share your stats with friends) a challenge by you or a
-- friend that you can see
DROP POLICY IF EXISTS "Join a challenge you can see while sharing your stats" ON public.challenge_participants;
CREATE POLICY "Join a challenge you can see while sharing your stats"
  ON public.challenge_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = challenge_id
        AND (
          (c.creator_id = auth.uid() AND c.is_private)
          OR (
            NOT c.is_private
            AND public.my_stats_shared()
            AND (c.creator_id = auth.uid() OR public.are_friends(auth.uid(), c.creator_id))
          )
        )
    )
  );

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

  -- Unknown, already announced, or a personal challenge (nobody to tell)
  IF c.id IS NULL OR c.is_private THEN
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
