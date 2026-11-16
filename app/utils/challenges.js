// Challenges (public.challenges; Home → CHALLENGES): what each kind measures, and an athlete's progress worked out
// from their own History. Only workouts dated inside the challenge's window count (from its start to its end).
//
// Kinds:
//   target_weight  reach an estimated 1RM on one exercise (the best session 1RM in the window; loggedExercise1RMInfo)
//   total_reps     reps of one exercise added up (completed sets)
//   total_volume   weight × reps of one exercise added up, in lb (bodyweight exercises count bodyweight)
//   sessions       workouts logged
//
// Period (challenges.period, supabase/migrations/2026-11-17_challenge_patterns.sql):
//   total  the target over the whole window (the default)
//   week   the target in EACH 7-day week counted from the start ("3 sessions a week for 4 weeks"); not for weights.
//          Progress = weeks met in a row from week 1, so a missed week ends the run; done when every week is met.

import { EXERCISE_MAP, isSupersetCategory, getSlotEquipmentChoice } from '../data/exerciseLibrary';
import { loggedExercise1RMInfo, withEffectiveLoad, workoutTimeMs } from './workoutEngine';

export const CHALLENGE_KINDS = [
  { id: 'target_weight', label: 'Weight', unit: 'LB', needsExercise: true, help: 'Reach this estimated 1RM on the exercise.' },
  { id: 'total_reps', label: 'Reps', unit: 'REPS', needsExercise: true, help: 'Add up this many reps of the exercise.' },
  { id: 'total_volume', label: 'Volume', unit: 'LB', needsExercise: true, help: 'Add up this much weight × reps on the exercise.' },
  { id: 'sessions', label: 'Sessions', unit: 'SESSIONS', needsExercise: false, help: 'Log this many workouts.' }
];
export const challengeKindOf = kind => CHALLENGE_KINDS.find(k => k.id === kind) || CHALLENGE_KINDS[0];

const WEEK_MS = 7 * 86400000;
export const isWeeklyChallenge = c => c?.period === 'week' && c?.kind !== 'target_weight';
/** A weekly challenge's number of weeks (its window in whole weeks, at least 1). */
export const challengeWeeks = c => {
  const from = Date.parse(c?.starts_at || '');
  const to = Date.parse(c?.ends_at || '');
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 1;
  return Math.max(1, Math.round((to - from) / WEEK_MS));
};
/** What progress is measured against: the target, or (weekly) the number of weeks. */
export const challengeGoal = c => (isWeeklyChallenge(c) ? challengeWeeks(c) : Number(c?.target) || 0);
/** Weeks of a weekly challenge that have fully passed by `nowMs` (0 in week 1). */
export const challengeWeeksPassed = (c, nowMs) => {
  const from = Date.parse(c?.starts_at || '');
  if (!Number.isFinite(from) || !nowMs) return 0;
  return Math.max(0, Math.min(challengeWeeks(c), Math.floor((nowMs - from) / WEEK_MS)));
};

/** "Bench Press 315 lb", "1,000 push-up reps", "20 sessions" — a challenge's name when it has no title. */
export const describeChallenge = c => {
  const ex = EXERCISE_MAP[c?.exercise_id]?.name || 'exercise';
  const n = Math.round(Number(c?.target) || 0).toLocaleString('en-US');
  // "3 sessions a week for 4 weeks"
  const weekly = isWeeklyChallenge(c) ? ` a week for ${challengeWeeks(c)} ${challengeWeeks(c) === 1 ? 'week' : 'weeks'}` : '';
  if (c?.kind === 'target_weight') return `${ex} ${n} lb`;
  if (c?.kind === 'total_reps') return `${n} reps of ${ex}${weekly}`;
  if (c?.kind === 'total_volume') return `${n} lb of ${ex}${weekly}`;
  return `${n} ${Number(c?.target) === 1 ? 'session' : 'sessions'}${weekly}`;
};

// Each logged exercise in a workout: [{ exerciseId, sets, option }] (superset halves separately)
const exercisesOf = workout =>
  (workout?.slots || []).flatMap(slot =>
    isSupersetCategory(slot?.category) && Array.isArray(slot.supersetSetsByExercise)
      ? (slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId]).map((id, i) => ({
          exerciseId: id,
          sets: slot.supersetSetsByExercise[i] || [],
          option: getSlotEquipmentChoice(slot, i)
        }))
      : [{ exerciseId: slot?.exerciseId, sets: slot?.sets || [], option: getSlotEquipmentChoice(slot, 0) }]
  );

// Reps / volume of the challenge's exercise in these workouts, or the number of workouts (sessions)
const amountOf = (challenge, workouts) => {
  if (challenge?.kind === 'sessions') return workouts.length;
  let value = 0;
  workouts.forEach(w =>
    exercisesOf(w).forEach(({ exerciseId, sets, option }) => {
      if (exerciseId !== challenge?.exercise_id) return;
      const done = (sets || []).filter(st => st?.completed);
      const counted = withEffectiveLoad(exerciseId, done.length ? done : sets, option);
      counted.forEach(st => {
        const reps = Math.max(0, Number(st?.reps) || 0);
        if (challenge.kind === 'total_reps') value += reps;
        else value += (Number(st?.weight) || 0) * reps;
      });
    })
  );
  return value;
};

/**
 * An athlete's progress in a challenge from their History: { value, calculated } (calculated = an estimated 1RM,
 * target_weight only). Workouts outside [starts_at, ends_at] don't count. A weekly challenge also returns `weekly`:
 * { amounts } (each week's amount, week 1 first), and its value is the weeks met in a row from week 1.
 */
export const challengeProgressFromHistory = (challenge, history = []) => {
  const from = Date.parse(challenge?.starts_at || '') || 0;
  const to = Date.parse(challenge?.ends_at || '') || Infinity;
  const inWindow = (history || []).filter(w => {
    const t = workoutTimeMs(w);
    return t >= from && t <= to;
  });
  if (isWeeklyChallenge(challenge)) {
    const weeks = challengeWeeks(challenge);
    const byWeek = Array.from({ length: weeks }, () => []);
    inWindow.forEach(w => {
      const i = Math.min(weeks - 1, Math.floor((workoutTimeMs(w) - from) / WEEK_MS));
      if (i >= 0) byWeek[i].push(w);
    });
    const amounts = byWeek.map(ws => Math.round(amountOf(challenge, ws)));
    const target = Number(challenge.target) || 0;
    let streak = 0;
    while (streak < weeks && amounts[streak] >= target) streak += 1;
    return { value: streak, calculated: false, weekly: { amounts } };
  }
  if (challenge?.kind !== 'target_weight') return { value: Math.round(amountOf(challenge, inWindow)), calculated: false };
  let value = 0;
  let calculated = false;
  inWindow.forEach(w =>
    exercisesOf(w).forEach(({ exerciseId, sets, option }) => {
      if (exerciseId !== challenge?.exercise_id) return;
      const info = loggedExercise1RMInfo(exerciseId, sets, option);
      if (info.value > value || (info.value === value && calculated && !info.calculated)) {
        value = info.value;
        calculated = info.calculated;
      }
    })
  );
  return { value: Math.round(value), calculated };
};

/** Days left (rounded up; 0 = ends today or has ended) — `nowMs` read after mount. */
export const challengeDaysLeft = (challenge, nowMs) => {
  const end = Date.parse(challenge?.ends_at || '');
  if (!Number.isFinite(end) || !nowMs) return null;
  // An hour's slack: "now" may have been read a moment before the challenge was created (a 7-day one read 8D)
  return Math.max(0, Math.ceil((end - nowMs - 3600000) / 86400000));
};
