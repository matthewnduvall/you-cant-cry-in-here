-- Challenge emails (app/api/notify-challenge/route.js).
--
-- After an athlete creates a challenge, their app asks the server to email their friends. The server (with the
-- service-role key, never the browser) calls claim_challenge_emails, which:
--   * only answers for a challenge that athlete created and that hasn't been announced yet,
--   * marks it announced (challenges.notified_at) so each challenge is emailed at most once,
--   * returns each accepted friend's email and username, the creator's username and the challenge, for friends who
--     want these emails (user_profiles.settings.social.emailChallenges, on unless set to false).
-- Only service_role may run it, so no athlete can read another athlete's email through it. Safe to re-run.

ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.claim_challenge_emails(p_challenge UUID, p_creator UUID)
RETURNS TABLE (
  email TEXT,
  username TEXT,
  creator_username TEXT,
  kind TEXT,
  exercise_id TEXT,
  target NUMERIC,
  title TEXT,
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
