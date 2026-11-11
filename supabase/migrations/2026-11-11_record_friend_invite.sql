-- Email invites: record the invite through a function instead of a direct insert, so it doesn't depend on the
-- friend_invites row-level policies being in place (sending an invite failed with "Could not record the invite").
-- Safe to re-run. Also in supabase_schema.sql.

ALTER TABLE public.friend_invites ADD COLUMN IF NOT EXISTS inviter_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.friend_invites ADD COLUMN IF NOT EXISTS inviter_username TEXT;
ALTER TABLE public.friend_invites ADD COLUMN IF NOT EXISTS inviter_email TEXT;
ALTER TABLE public.friend_invites ADD COLUMN IF NOT EXISTS invited_email TEXT;
ALTER TABLE public.friend_invites ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.friend_invites ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.friend_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inviters can create invites" ON public.friend_invites;
CREATE POLICY "Inviters can create invites"
  ON public.friend_invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_user_id);

DROP POLICY IF EXISTS "Inviters can view their invites" ON public.friend_invites;
CREATE POLICY "Inviters can view their invites"
  ON public.friend_invites FOR SELECT
  USING (auth.uid() = inviter_user_id);

-- Records an invite from the signed-in athlete (always as auth.uid(); their email comes from auth.users) and
-- returns its id, which goes in the join link (claim_invite_link).
CREATE OR REPLACE FUNCTION public.record_friend_invite(target_email TEXT, inviter_name TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  my_email TEXT;
  clean_target TEXT := lower(trim(coalesce(target_email, '')));
  new_id UUID;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Sign in to send invites';
  END IF;
  IF clean_target !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;
  SELECT lower(email) INTO my_email FROM auth.users WHERE id = me;
  INSERT INTO public.friend_invites (inviter_user_id, inviter_username, inviter_email, invited_email, status)
  VALUES (me, nullif(trim(coalesce(inviter_name, '')), ''), my_email, clean_target, 'pending')
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_friend_invite(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_friend_invite(TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
