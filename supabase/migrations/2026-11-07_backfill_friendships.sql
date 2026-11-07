-- ============================================================================
-- ONE-TIME BACKFILL: move existing friendships into public.friendships
-- Run ONCE in the Supabase SQL Editor, after re-running supabase_schema.sql.
--
-- Before this change, friendships also lived in each athlete's settings.friendsList and in
-- email invites. Friendships are now only rows in public.friendships, so this turns the existing
-- relationships into 'accepted' rows. Matching uses exact email or exact username only.
-- Running it again is harmless (it never duplicates a pair) but would re-add @matt for anyone
-- who has since removed him, so don't re-run it after launch.
-- ============================================================================

-- 1. Friends listed in either athlete's saved friends list
INSERT INTO public.friendships (requester_id, addressee_id, status)
SELECT DISTINCT LEAST(a.id, b.id), GREATEST(a.id, b.id), 'accepted'
FROM public.user_profiles a
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(a.settings -> 'friendsList') = 'array' THEN a.settings -> 'friendsList' ELSE '[]'::jsonb END
) AS f(entry)
JOIN public.user_profiles b
  ON b.id <> a.id
 AND (
   (coalesce(f.entry ->> 'email', '') <> '' AND lower(b.email) = lower(f.entry ->> 'email'))
   OR (coalesce(f.entry ->> 'username', '') <> '' AND lower(b.username) = lower(f.entry ->> 'username'))
 )
WHERE NOT EXISTS (
  SELECT 1 FROM public.friendships x
  WHERE (x.requester_id = a.id AND x.addressee_id = b.id)
     OR (x.requester_id = b.id AND x.addressee_id = a.id)
);

-- 2. Email invites whose invited email already has an account
INSERT INTO public.friendships (requester_id, addressee_id, status)
SELECT DISTINCT i.inviter_user_id, p.id, 'accepted'
FROM public.friend_invites i
JOIN public.user_profiles p ON lower(p.email) = lower(i.invited_email)
WHERE i.inviter_user_id IS NOT NULL
  AND i.inviter_user_id <> p.id
  AND NOT EXISTS (
    SELECT 1 FROM public.friendships x
    WHERE (x.requester_id = i.inviter_user_id AND x.addressee_id = p.id)
       OR (x.requester_id = p.id AND x.addressee_id = i.inviter_user_id)
  );

-- 3. Default friend @matt for every existing athlete
INSERT INTO public.friendships (requester_id, addressee_id, status)
SELECT m.id, p.id, 'accepted'
FROM public.user_profiles m
JOIN public.user_profiles p ON p.id <> m.id
WHERE lower(m.email) = 'matthew.n.duvall@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.friendships x
    WHERE (x.requester_id = m.id AND x.addressee_id = p.id)
       OR (x.requester_id = p.id AND x.addressee_id = m.id)
  );

-- 4. Stop copying friends lists into profiles (other athletes' data no longer lives in your profile)
UPDATE public.user_profiles
SET settings = settings - 'friendsList'
WHERE settings ? 'friendsList';

-- Check the result:
-- SELECT p1.username AS athlete, p2.username AS friend, f.status
-- FROM public.friendships f
-- JOIN public.user_profiles p1 ON p1.id = f.requester_id
-- JOIN public.user_profiles p2 ON p2.id = f.addressee_id
-- ORDER BY 1, 2;
