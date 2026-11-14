-- Friend request emails (app/api/notify-friend-request/route.js).
--
-- After an athlete sends a friend request, their app asks the server to email the recipient. The server (with the
-- service-role key, never the browser) calls claim_friend_request_email, which:
--   * only answers for a request that is still pending from that requester to that recipient,
--   * marks it notified (friendships.notified_at) so each request is emailed at most once,
--   * returns the recipient's email, both usernames and whether the recipient wants these emails
--     (user_profiles.settings.social.emailFriendRequests, on unless set to false).
-- Only service_role may run it, so no athlete can read another athlete's email through it. Safe to re-run.

ALTER TABLE public.friendships ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.claim_friend_request_email(requester UUID, addressee UUID)
RETURNS TABLE (email TEXT, requester_username TEXT, addressee_username TEXT, wants_email BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed UUID;
BEGIN
  UPDATE public.friendships f
     SET notified_at = NOW()
   WHERE f.requester_id = requester
     AND f.addressee_id = addressee
     AND f.status = 'pending'
     AND f.notified_at IS NULL
  RETURNING f.id INTO claimed;

  IF claimed IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.email::TEXT,
         (SELECT p.username FROM public.user_profiles p WHERE p.id = requester)::TEXT,
         ap.username::TEXT,
         COALESCE((ap.settings -> 'social' ->> 'emailFriendRequests') <> 'false', TRUE)
    FROM auth.users u
    LEFT JOIN public.user_profiles ap ON ap.id = u.id
   WHERE u.id = addressee;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_friend_request_email(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_friend_request_email(UUID, UUID) TO service_role;
