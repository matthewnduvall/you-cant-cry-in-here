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
//   day / week / month  the target in EACH day, 7-day week or calendar month counted from the start ("100 reps of
//          push-ups a day for 30 days", "3 sessions a week for 4 weeks", "12 sessions a month for 3 months"); not for
//          weights. Periodic challenges start at local midnight on the day they are made. Progress = periods met in a
//          row from the first, so a missed one ends the run; done when every period is met.

import { EXERCISE_MAP, isSupersetCategory, getSlotEquipmentChoice } from '../data/exerciseLibrary';
import { loggedExercise1RMInfo, withEffectiveLoad, workoutTimeMs } from './workoutEngine';

export const CHALLENGE_KINDS = [
  { id: 'target_weight', label: 'Weight', unit: 'LB', needsExercise: true, help: 'Reach this estimated 1RM on the exercise.' },
  { id: 'total_reps', label: 'Reps', unit: 'REPS', needsExercise: true, help: 'Add up this many reps of the exercise.' },
  { id: 'total_volume', label: 'Volume', unit: 'LB', needsExercise: true, help: 'Add up this much weight × reps on the exercise.' },
  { id: 'sessions', label: 'Sessions', unit: 'SESSIONS', needsExercise: false, help: 'Log this many workouts.' }
];
export const challengeKindOf = kind => CHALLENGE_KINDS.find(k => k.id === kind) || CHALLENGE_KINDS[0];

const DAY_MS = 86400000;
/** The repeating patterns: their words and the lengths offered when making one. */
export const CHALLENGE_PERIODS = {
  day: { id: 'day', each: 'each day', a: 'a day', unit: 'day', units: 'days', lengths: [7, 14, 30, 60] },
  week: { id: 'week', each: 'each week', a: 'a week', unit: 'week', units: 'weeks', lengths: [2, 4, 6, 8] },
  month: { id: 'month', each: 'each month', a: 'a month', unit: 'month', units: 'months', lengths: [2, 3, 6, 12] }
};
export const normalizeChallengePeriod = p => (CHALLENGE_PERIODS[p] ? p : 'total');
/** The challenge repeats each day / week / month (never a weight target). */
export const isPeriodicChallenge = c => Boolean(CHALLENGE_PERIODS[c?.period]) && c?.kind !== 'target_weight';
export const challengePeriodOf = c => (isPeriodicChallenge(c) ? CHALLENGE_PERIODS[c.period] : null);

/** The start of period i (ms) for a challenge starting at `from` (day / week: fixed lengths; month: calendar months). */
const periodStart = (period, from, i) => {
  if (period === 'month') {
    const d = new Date(from);
    d.setMonth(d.getMonth() + i);
    return d.getTime();
  }
  return from + i * (period === 'day' ? DAY_MS : 7 * DAY_MS);
};
/** When a periodic challenge of `count` periods starting at `from` ends (ms). */
export const challengePeriodEnd = (period, from, count) => periodStart(period, from, count);

/** A periodic challenge's number of periods (at least 1). */
export const challengePeriodCount = c => {
  const from = Date.parse(c?.starts_at || '');
  const to = Date.parse(c?.ends_at || '');
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 1;
  if (c?.period === 'month') {
    let n = 0;
    while (n < 120 && periodStart('month', from, n + 1) <= to + 2 * 3600000) n += 1;
    return Math.max(1, n);
  }
  return Math.max(1, Math.round((to - from) / (c?.period === 'day' ? DAY_MS : 7 * DAY_MS)));
};
/** Which period (0-based) a moment falls in, or -1 before the start. */
const periodIndexAt = (c, t) => {
  const from = Date.parse(c?.starts_at || '');
  if (!Number.isFinite(from) || t < from) return -1;
  const n = challengePeriodCount(c);
  let i = 0;
  while (i < n - 1 && periodStart(c.period, from, i + 1) <= t) i += 1;
  return i;
};
/** What progress is measured against: the target, or (periodic) the number of periods. */
export const challengeGoal = c => (isPeriodicChallenge(c) ? challengePeriodCount(c) : Number(c?.target) || 0);
/** Periods of a periodic challenge that have fully passed by `nowMs` (0 in the first one). */
export const challengePeriodsPassed = (c, nowMs) => {
  if (!nowMs || !isPeriodicChallenge(c)) return 0;
  const from = Date.parse(c?.starts_at || '');
  if (!Number.isFinite(from) || nowMs < from) return 0;
  const n = challengePeriodCount(c);
  let i = 0;
  while (i < n && periodStart(c.period, from, i + 1) <= nowMs) i += 1;
  return i;
};

/** "Bench Press 315 lb", "1,000 push-up reps", "20 sessions" — a challenge's name when it has no title. */
export const describeChallenge = c => {
  const ex = EXERCISE_MAP[c?.exercise_id]?.name || 'exercise';
  const n = Math.round(Number(c?.target) || 0).toLocaleString('en-US');
  // "3 sessions a week for 4 weeks", "100 reps of Push-Up a day for 30 days"
  const per = challengePeriodOf(c);
  const count = per ? challengePeriodCount(c) : 0;
  const weekly = per ? ` ${per.a} for ${count} ${count === 1 ? per.unit : per.units}` : '';
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
 * target_weight only). Workouts outside [starts_at, ends_at] don't count. A periodic challenge also returns
 * `periodic`: { amounts } (each day's / week's / month's amount, the first first), and its value is the periods met
 * in a row from the first.
 */
export const challengeProgressFromHistory = (challenge, history = []) => {
  const from = Date.parse(challenge?.starts_at || '') || 0;
  const to = Date.parse(challenge?.ends_at || '') || Infinity;
  const inWindow = (history || []).filter(w => {
    const t = workoutTimeMs(w);
    return t >= from && t <= to;
  });
  if (isPeriodicChallenge(challenge)) {
    const count = challengePeriodCount(challenge);
    const byPeriod = Array.from({ length: count }, () => []);
    inWindow.forEach(w => {
      const i = periodIndexAt(challenge, workoutTimeMs(w));
      if (i >= 0) byPeriod[i].push(w);
    });
    const amounts = byPeriod.map(ws => Math.round(amountOf(challenge, ws)));
    const target = Number(challenge.target) || 0;
    let streak = 0;
    while (streak < count && amounts[streak] >= target) streak += 1;
    return { value: streak, calculated: false, periodic: { amounts } };
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
