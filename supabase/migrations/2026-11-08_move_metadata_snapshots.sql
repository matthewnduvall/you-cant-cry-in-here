-- One-time migration: move History out of the old sign-in-account snapshot.
--
-- Older builds copied the whole app state (every History workout) into each account's
-- auth user_metadata under "yccih_cloud_state_v3". Supabase embeds user_metadata in every access
-- token, so the tokens grew too large to send and the app's sync requests failed. Workouts logged
-- then may exist only in that snapshot (or in user_profiles.settings.recentHistory), not in
-- public.workout_history, which is what a new device or home-screen app downloads.
--
-- This copies every workout found in those snapshots into public.workout_history (existing rows
-- are left untouched), then removes the snapshot from user_metadata. Safe to re-run.
-- Run in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION pg_temp.try_timestamptz(value TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN value::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- 1. Gather workouts from every snapshot source
WITH sources AS (
  SELECT u.id AS user_id, u.raw_user_meta_data -> 'yccih_cloud_state_v3' -> 'history' AS list
  FROM auth.users u
  UNION ALL
  SELECT p.id, p.settings -> 'recentHistory' FROM public.user_profiles p
  UNION ALL
  SELECT p.id, p.settings -> 'yccih_cloud_state_v3' -> 'history' FROM public.user_profiles p
),
workouts AS (
  SELECT s.user_id, w
  FROM sources s
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(s.list) = 'array' THEN s.list ELSE '[]'::jsonb END
  ) AS w
  WHERE jsonb_typeof(w) = 'object'
    AND COALESCE(w ->> 'id', '') <> ''
    AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = s.user_id)
)
INSERT INTO public.workout_history (id, user_id, title, preset_used, started_at, slots)
SELECT DISTINCT ON (w ->> 'id')
  w ->> 'id',
  user_id,
  COALESCE(NULLIF(w ->> 'title', ''), 'Workout Session'),
  COALESCE(NULLIF(w ->> 'loadedRoutineTitle', ''), 'MANUAL'),
  COALESCE(
    pg_temp.try_timestamptz(w ->> 'startedAt'),
    pg_temp.try_timestamptz(w ->> 'workoutDate'),
    NOW()
  ),
  CASE WHEN jsonb_typeof(w -> 'slots') = 'array' THEN w -> 'slots' ELSE '[]'::jsonb END
FROM workouts
ORDER BY w ->> 'id'
ON CONFLICT (id) DO NOTHING;

-- 2. Remove the snapshot from sign-in accounts so access tokens are small again
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'yccih_cloud_state_v3'
WHERE raw_user_meta_data ? 'yccih_cloud_state_v3';

-- 3. Check: History rows per account, and that no account still carries a snapshot
SELECT
  (SELECT COUNT(*) FROM public.workout_history) AS workout_history_rows,
  (SELECT COUNT(*) FROM auth.users WHERE raw_user_meta_data ? 'yccih_cloud_state_v3') AS accounts_with_snapshot;
