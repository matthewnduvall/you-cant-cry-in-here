// Challenges (public.challenges; Home → CHALLENGES): what each kind measures, and an athlete's progress worked out
// from their own History. Only workouts dated inside the challenge's window count (from its start to its end).
//
// Kinds:
//   target_weight  reach an estimated 1RM on one exercise (the best session 1RM in the window; loggedExercise1RMInfo)
//   total_reps     reps of one exercise added up (completed sets)
//   total_volume   weight × reps of one exercise added up, in lb (bodyweight exercises count bodyweight)
//   sessions       workouts logged

import { EXERCISE_MAP, isSupersetCategory, getSlotEquipmentChoice } from '../data/exerciseLibrary';
import { loggedExercise1RMInfo, withEffectiveLoad, workoutTimeMs } from './workoutEngine';

export const CHALLENGE_KINDS = [
  { id: 'target_weight', label: 'Weight', unit: 'LB', needsExercise: true, help: 'Reach this estimated 1RM on the exercise.' },
  { id: 'total_reps', label: 'Reps', unit: 'REPS', needsExercise: true, help: 'Add up this many reps of the exercise.' },
  { id: 'total_volume', label: 'Volume', unit: 'LB', needsExercise: true, help: 'Add up this much weight × reps on the exercise.' },
  { id: 'sessions', label: 'Sessions', unit: 'SESSIONS', needsExercise: false, help: 'Log this many workouts.' }
];
export const challengeKindOf = kind => CHALLENGE_KINDS.find(k => k.id === kind) || CHALLENGE_KINDS[0];

/** "Bench Press 315 lb", "1,000 push-up reps", "20 sessions" — a challenge's name when it has no title. */
export const describeChallenge = c => {
  const ex = EXERCISE_MAP[c?.exercise_id]?.name || 'exercise';
  const n = Math.round(Number(c?.target) || 0).toLocaleString('en-US');
  if (c?.kind === 'target_weight') return `${ex} ${n} lb`;
  if (c?.kind === 'total_reps') return `${n} reps of ${ex}`;
  if (c?.kind === 'total_volume') return `${n} lb of ${ex}`;
  return `${n} sessions`;
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

/**
 * An athlete's progress in a challenge from their History: { value, calculated } (calculated = an estimated 1RM,
 * target_weight only). Workouts outside [starts_at, ends_at] don't count.
 */
export const challengeProgressFromHistory = (challenge, history = []) => {
  const from = Date.parse(challenge?.starts_at || '') || 0;
  const to = Date.parse(challenge?.ends_at || '') || Infinity;
  const inWindow = (history || []).filter(w => {
    const t = workoutTimeMs(w);
    return t >= from && t <= to;
  });
  if (challenge?.kind === 'sessions') return { value: inWindow.length, calculated: false };
  let value = 0;
  let calculated = false;
  inWindow.forEach(w =>
    exercisesOf(w).forEach(({ exerciseId, sets, option }) => {
      if (exerciseId !== challenge?.exercise_id) return;
      if (challenge.kind === 'target_weight') {
        const info = loggedExercise1RMInfo(exerciseId, sets, option);
        if (info.value > value || (info.value === value && calculated && !info.calculated)) {
          value = info.value;
          calculated = info.calculated;
        }
        return;
      }
      const done = (sets || []).filter(st => st?.completed);
      const counted = withEffectiveLoad(exerciseId, done.length ? done : sets, option);
      counted.forEach(st => {
        const reps = Math.max(0, Number(st?.reps) || 0);
        if (challenge.kind === 'total_reps') value += reps;
        else value += (Number(st?.weight) || 0) * reps;
      });
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
