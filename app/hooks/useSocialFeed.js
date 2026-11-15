'use client';

// ============================================================================
// Home's social section: the FEED (posts by you and your friends, with reactions and comments) and CHALLENGES
// (public.activity_posts, post_reactions, post_comments, challenges, challenge_participants;
// supabase/migrations/2026-11-15_social_feed_challenges.sql). Signed in only.
// - Checked 3 s after sign-in, every minute while the app is open, and when it comes back to the foreground.
// - PR posts: a workout newly in your History (dated in the last 3 days) that beats an earlier best on any exercise
//   is posted automatically (kind 'pr'), unless Social → PRIVACY turns it off or you don't share your stats. Workouts
//   already in History the first time this runs for an account are never posted (no backfill).
// - Challenges you joined: your progress is worked out from your History (utils/challenges.js) and written to your
//   participant row; reaching the target stamps completed_at and posts it (kind 'challenge_done').
// `available` is false when the tables don't exist yet (the migration hasn't been run): Home then says so.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addPostComment,
  createChallenge as apiCreateChallenge,
  createFeedPost,
  deleteChallenge as apiDeleteChallenge,
  deleteFeedPost,
  deletePostComment,
  fetchChallenges,
  fetchFeedPosts,
  joinChallenge as apiJoinChallenge,
  leaveChallenge as apiLeaveChallenge,
  setPostReaction,
  updateChallengeProgress
} from '../utils/supabaseAuth';
import { challengeProgressFromHistory } from '../utils/challenges';
import { EXERCISE_MAP, isSupersetCategory, getSlotEquipmentChoice } from '../data/exerciseLibrary';
import { loggedExercise1RMInfo, workoutTimeMs } from '../utils/workoutEngine';

const CHECK_EVERY_MS = 60 * 1000;
const PR_POST_MAX_AGE_MS = 3 * 86400000;
const SEEN_KEY = id => `yccih_feed_seen_workouts_v1:${id}`;
// The reactions offered on every post
export const FEED_REACTIONS = ['💪', '🔥', '👏', '😭'];

const readSeen = userId => {
  try {
    const raw = localStorage.getItem(SEEN_KEY(userId));
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};
const writeSeen = (userId, set) => {
  try {
    localStorage.setItem(SEEN_KEY(userId), JSON.stringify(Array.from(set).slice(-500)));
  } catch {
    // storage full / blocked: PR posts may repeat their check, the database keeps them unique
  }
};

// One workout's best session 1RM per exercise: { [exerciseId]: { value, calculated } }
const bestsOf = workout => {
  const out = {};
  (workout?.slots || []).forEach(slot => {
    const halves =
      isSupersetCategory(slot?.category) && Array.isArray(slot.supersetSetsByExercise)
        ? (slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId]).map((id, i) => [id, slot.supersetSetsByExercise[i], i])
        : [[slot?.exerciseId, slot?.sets, 0]];
    halves.forEach(([id, sets, half]) => {
      if (!id) return;
      const info = loggedExercise1RMInfo(id, sets || [], getSlotEquipmentChoice(slot, half));
      if (info.value > (out[id]?.value || 0)) out[id] = { value: info.value, calculated: info.calculated };
    });
  });
  return out;
};

/** A workout's exercise names (superset halves each), for a post: ['Barbell Bench Press', …] */
export const workoutExerciseNames = workout =>
  Array.from(
    new Set(
      (workout?.slots || [])
        .flatMap(slot =>
          isSupersetCategory(slot?.category) && Array.isArray(slot.supersetExerciseIds) ? slot.supersetExerciseIds : [slot?.exerciseId]
        )
        .map(id => EXERCISE_MAP[id]?.name)
        .filter(Boolean)
    )
  );

/** The records a workout set: exercises whose session 1RM beats every earlier logged one (first-ever logs don't count). */
export const workoutRecords = (workout, history = []) => {
  const t = workoutTimeMs(workout);
  const before = {};
  (history || []).forEach(w => {
    if (!w || w.id === workout.id || workoutTimeMs(w) >= t) return;
    Object.entries(bestsOf(w)).forEach(([id, b]) => {
      if (b.value > (before[id] || 0)) before[id] = b.value;
    });
  });
  return Object.entries(bestsOf(workout))
    .filter(([id, b]) => before[id] > 0 && b.value > before[id])
    .map(([id, b]) => ({ exerciseId: id, name: EXERCISE_MAP[id]?.name || id, value: b.value, calculated: b.calculated, previous: before[id] }));
};

export function useSocialFeed({ user, history, shareStatsWithFriends = true, autoPostPRs = true, appendSessionLog }) {
  const [posts, setPosts] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [available, setAvailable] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const [feed, ch] = await Promise.all([fetchFeedPosts(user), fetchChallenges(user)]);
    // 404 / PGRST205 = the tables aren't there yet (migration not run)
    if (!feed.ok && (feed.status === 404 || feed.status === 400)) setAvailable(false);
    else if (feed.ok) setAvailable(true);
    if (feed.ok) setPosts(feed.posts);
    if (ch.ok) setChallenges(ch.challenges);
    setError(feed.ok || feed.status === 404 ? '' : "Couldn't load the feed. It will try again in a minute.");
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return undefined;
    const first = setTimeout(refresh, 3000);
    const timer = setInterval(refresh, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, refresh]);

  // --- Automatic PR posts -------------------------------------------------------------------------------------
  const postingRef = useRef(false);
  useEffect(() => {
    if (!user?.id || !available || !loaded || postingRef.current || typeof window === 'undefined') return;
    const list = Array.isArray(history) ? history : [];
    let seen = readSeen(user.id);
    // First run for this account on this device: everything already logged counts as seen (no backfill)
    if (!seen) {
      writeSeen(user.id, new Set(list.map(w => w?.id).filter(Boolean)));
      return;
    }
    const fresh = list.filter(w => w?.id && !seen.has(w.id));
    if (fresh.length === 0) return;
    postingRef.current = true;
    (async () => {
      const now = Date.now();
      for (const w of fresh) {
        const recent = now - workoutTimeMs(w) <= PR_POST_MAX_AGE_MS;
        if (recent && shareStatsWithFriends && autoPostPRs) {
          const records = workoutRecords(w, list);
          if (records.length > 0) {
            const res = await createFeedPost(user, {
              kind: 'pr',
              refId: w.id,
              payload: { workoutId: w.id, title: w.title || '', date: w.startedAt || w.workoutDate || null, records }
            });
            if (!res.ok) {
              appendSessionLog?.('FEED_PR_POST_FAILED', `PR post for ${w.id} failed (${res.status})`);
              continue; // tried again on the next change
            }
          }
        }
        seen = new Set([...seen, w.id]);
        writeSeen(user.id, seen);
      }
      postingRef.current = false;
      refresh();
    })();
  }, [user, history, available, loaded, shareStatsWithFriends, autoPostPRs, appendSessionLog, refresh]);

  // --- Your challenge progress ----------------------------------------------------------------------------------
  const progressSigRef = useRef('');
  useEffect(() => {
    if (!user?.id || !available) return;
    const mine = challenges.filter(c => c.participants.some(p => p.user_id === user.id));
    const updates = mine
      .map(c => {
        const me = c.participants.find(p => p.user_id === user.id);
        const { value, calculated } = challengeProgressFromHistory(c, history);
        const reached = value >= c.target;
        const changed = Math.abs((me.progress || 0) - value) >= 0.5 || Boolean(me.progress_calculated) !== calculated;
        const newlyDone = reached && !me.completed_at;
        return changed || newlyDone ? { c, value, calculated, newlyDone, completedAt: reached ? me.completed_at || new Date().toISOString() : null } : null;
      })
      .filter(Boolean);
    const sig = updates.map(u => `${u.c.id}:${u.value}:${u.completedAt ? 1 : 0}`).join('|');
    if (!sig || sig === progressSigRef.current) return;
    progressSigRef.current = sig;
    (async () => {
      for (const u of updates) {
        await updateChallengeProgress(user, u.c.id, { progress: u.value, calculated: u.calculated, completedAt: u.completedAt });
        if (u.newlyDone) {
          await createFeedPost(user, {
            kind: 'challenge_done',
            refId: u.c.id,
            payload: { challengeId: u.c.id, kind: u.c.kind, exerciseId: u.c.exercise_id, target: u.c.target, title: u.c.title || '', value: u.value, calculated: u.calculated }
          });
        }
      }
      refresh();
    })();
  }, [user, challenges, history, available, refresh]);

  // --- Actions (optimistic where it matters) --------------------------------------------------------------------
  const toggleReaction = async (post, emoji) => {
    if (!user?.id || !post) return;
    const mine = post.reactions.some(r => r.user_id === user.id && r.emoji === emoji);
    setPosts(list =>
      list.map(p =>
        p.id !== post.id
          ? p
          : {
              ...p,
              reactions: mine
                ? p.reactions.filter(r => !(r.user_id === user.id && r.emoji === emoji))
                : [...p.reactions, { user_id: user.id, username: user.username, emoji }]
            }
      )
    );
    const res = await setPostReaction(user, post.id, emoji, !mine);
    if (!res.ok) refresh();
  };

  const addComment = async (post, body) => {
    const text = String(body || '').trim();
    if (!user?.id || !post || !text) return false;
    const res = await addPostComment(user, post.id, text);
    if (res.ok) refresh();
    return res.ok;
  };

  const removeComment = async comment => {
    setPosts(list => list.map(p => ({ ...p, comments: p.comments.filter(c => c.id !== comment.id) })));
    const res = await deletePostComment(user, comment.id);
    if (!res.ok) refresh();
  };

  const removePost = async post => {
    setPosts(list => list.filter(p => p.id !== post.id));
    const res = await deleteFeedPost(user, post.id);
    if (!res.ok) refresh();
  };

  /** A workout or routine you chose to post (FINISH / SAVE → SHARE → @all). */
  const postWorkout = async ({ kind, refId, title, date, exercises, slots, caption }) => {
    if (!user?.id) return { ok: false };
    const res = await createFeedPost(user, {
      kind,
      refId,
      caption,
      payload: { title: title || '', date: date || null, exercises: exercises || [], slots: slots || [] }
    });
    if (!res.ok) appendSessionLog?.('FEED_POST_FAILED', `Posting ${kind} ${refId} failed (${res.status})`);
    refresh();
    return res;
  };

  const createChallenge = async fields => {
    const res = await apiCreateChallenge(user, fields);
    refresh();
    return res;
  };
  const joinChallenge = async challenge => {
    const res = await apiJoinChallenge(user, challenge.id);
    refresh();
    return res;
  };
  const leaveChallenge = async challenge => {
    const res = await apiLeaveChallenge(user, challenge.id);
    refresh();
    return res;
  };
  const deleteChallenge = async challenge => {
    setChallenges(list => list.filter(c => c.id !== challenge.id));
    const res = await apiDeleteChallenge(user, challenge.id);
    if (!res.ok) refresh();
    return res;
  };

  // Signed out: nothing (the last account's posts are never shown)
  const signedIn = Boolean(user?.id);
  return {
    available,
    loaded: signedIn && loaded,
    error: signedIn ? error : '',
    posts: signedIn ? posts : [],
    challenges: signedIn ? challenges : [],
    refresh,
    toggleReaction,
    addComment,
    removeComment,
    removePost,
    postWorkout,
    createChallenge,
    joinChallenge,
    leaveChallenge,
    deleteChallenge
  };
}

export default useSocialFeed;
