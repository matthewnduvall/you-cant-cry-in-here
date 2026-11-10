-- ============================================================================
-- 2026-11-09: Invite links always connect the two athletes; the default friend (@matt) is found reliably.
-- Same as section 11 of supabase_schema.sql. Safe to re-run. Run once in the Supabase SQL Editor.
-- ============================================================================

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

-- Invite links carry the invite's id. Whoever signs up or signs in through the link becomes friends with
-- the inviter, whatever email they use. Each unused invite can be claimed once (so a forwarded email
-- can't be reused); claiming it again is fine for the athlete who already did. Returns true when the two
-- athletes are friends afterwards.
CREATE OR REPLACE FUNCTION public.claim_invite_link(invite UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.claim_invite_link(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_invite_link(UUID) TO authenticated;

-- Check after running (read-only): the default friend is found, and how many accounts aren't friends with it.
SELECT
  (SELECT username FROM public.user_profiles WHERE id = public.default_friend_id()) AS default_friend_username,
  (SELECT count(*) FROM public.user_profiles p
     WHERE p.id <> public.default_friend_id()
       AND NOT EXISTS (
         SELECT 1 FROM public.friendships f
         WHERE f.status = 'accepted'
           AND ((f.requester_id = p.id AND f.addressee_id = public.default_friend_id())
             OR (f.addressee_id = p.id AND f.requester_id = public.default_friend_id()))
       )) AS accounts_not_friends_with_default;
