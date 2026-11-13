// The 1RM an exercise starts from when it has never been logged (no History for it):
//   1. a related lift you have logged — the same Big 3 / OHP family (front squat ← back squat, incline bench ← bench,
//      RDL ← deadlift…) — converted by the two lifts' strength standards at the same class (so the ratio between them
//      is the standards' ratio), the best such conversion;
//   2. otherwise the strength standard one class below your goal (Intermediate goal → Novice), for your bodyweight.
// Exercises that have been logged use their own History. Bodyweight exercises keep the library default.

import { EXERCISE_MAP, EXRX_CLASSES, getExRxTargetForLift, isBodyweightExercise } from '../data/exerciseLibrary';
import { getBestHistory1RM, estimateSet1RM, setReportedRir } from './workoutEngine';
import { fmt } from './calcTrace';

// Families by name: the first pattern an exercise's name matches
const FAMILIES = [
  { parent: 'barbell_deadlift', pattern: /deadlift|\brdl\b|romanian|good morning/i },
  { parent: 'barbell_back_squat', pattern: /squat/i },
  { parent: 'overhead_press', pattern: /overhead press|shoulder press|military press|push press/i },
  { parent: 'barbell_bench_press', pattern: /bench press|floor press|chest press/i }
];

/** The Big 3 / OHP lift an exercise is a variant of (or is), else null. */
export const getLiftFamilyParent = exerciseId => {
  if (FAMILIES.some(f => f.parent === exerciseId)) return exerciseId;
  const name = EXERCISE_MAP[exerciseId]?.name || '';
  return FAMILIES.find(f => f.pattern.test(name))?.parent || null;
};

/** One class below the goal (Untrained stays Untrained); a non-standard goal (1000 LB Club, Custom) → Novice. */
export const getStartingClass = targetClass => {
  const idx = EXRX_CLASSES.indexOf(targetClass);
  if (idx < 0) return 'Novice';
  return EXRX_CLASSES[Math.max(0, idx - 1)];
};

const loggedExerciseIds = history => {
  const ids = new Set();
  (history || []).forEach(w =>
    (w?.slots || []).forEach(slot => {
      (slot?.supersetExerciseIds || [slot?.exerciseId, slot?.secondaryExerciseId]).forEach(id => id && ids.add(id));
    })
  );
  return ids;
};

/**
 * { value, source: 'history' | 'related' | 'standard' | 'default', fromId } for an exercise.
 * opts = { history, targetStandardClass, bodyweightLbs, heightInches }
 */
export const getStarting1RMInfo = (exerciseId, { history = [], targetStandardClass = 'Intermediate', bodyweightLbs = 220, heightInches = 70 } = {}) => {
  const own = getBestHistory1RM(exerciseId, history);
  if (own > 0) return { value: own, source: 'history', fromId: exerciseId };
  if (!EXERCISE_MAP[exerciseId] || isBodyweightExercise(exerciseId)) {
    return { value: EXERCISE_MAP[exerciseId]?.default1RM ?? 135, source: 'default', fromId: null };
  }
  const cls = getStartingClass(targetStandardClass);
  const standard = id => getExRxTargetForLift(id, cls, bodyweightLbs, heightInches, {}, {});
  const target = standard(exerciseId);

  // 1. A related lift you've logged, converted by the standards' ratio
  const family = getLiftFamilyParent(exerciseId);
  if (family && target > 0) {
    let best = null;
    loggedExerciseIds(history).forEach(id => {
      if (id === exerciseId || getLiftFamilyParent(id) !== family || isBodyweightExercise(id)) return;
      const logged = getBestHistory1RM(id, history);
      const ref = standard(id);
      if (!(logged > 0) || !(ref > 0)) return;
      const value = (logged * target) / ref;
      if (!best || value > best.value) best = { value, source: 'related', fromId: id };
    });
    if (best) return { ...best, value: Math.round(best.value / 5) * 5 };
  }

  // 2. The strength standard one class below the goal
  if (target > 0) return { value: Math.round(target / 5) * 5, source: 'standard', fromId: null };
  return { value: EXERCISE_MAP[exerciseId]?.default1RM ?? 135, source: 'default', fromId: null };
};

export const getStarting1RM = (exerciseId, opts) => getStarting1RMInfo(exerciseId, opts).value;

/**
 * One FORMULAS line explaining an exercise's 1RM: its best logged set (weight × (1 + reps ÷ 30)), or how the starting
 * 1RM was worked out (a related lift × the standards' ratio, or the standard one class below the goal).
 */
export const describe1RM = (exerciseId, opts = {}) => {
  const name = EXERCISE_MAP[exerciseId]?.name || exerciseId;
  const history = opts.history || [];
  let best = null;
  history.forEach(w =>
    (w?.slots || []).forEach(slot => {
      const lists = (slot?.supersetSetsByExercise || [slot?.sets]).map((list, i) => ({
        list: list || [],
        id: (slot?.supersetExerciseIds || [slot?.exerciseId])[i] || slot?.exerciseId
      }));
      lists.forEach(({ list, id }) => {
        if (id !== exerciseId) return;
        const done = list.some(s => s?.completed && Number(s.weight) > 0);
        list.forEach(st => {
          const wt = Number(st?.weight) || 0;
          if (wt <= 0 || (done && !st.completed)) return;
          const reps = Math.max(1, Number(st.reps) || 1);
          const est = estimateSet1RM(st);
          if (!best || est > best.est) best = { est, wt, reps, rir: setReportedRir(st), at: w.startedAt };
        });
      });
    })
  );
  if (best) {
    const when = best.at ? ` (best logged set, ${String(best.at).slice(0, 10)})` : ' (best logged set)';
    if (best.reps === 1 && !best.rir) return `1RM ${name} = ${fmt(best.wt)} lb × 1 rep = ${fmt(best.est)} lb${when}`;
    return best.rir
      ? `1RM ${name} = ${fmt(best.wt)} × (1 + (${best.reps} reps + ${fmt(best.rir)} RIR) ÷ 30) = ${fmt(best.est)} lb${when}`
      : `1RM ${name} = ${fmt(best.wt)} × (1 + ${best.reps} ÷ 30) = ${fmt(best.est)} lb${when}`;
  }
  const info = getStarting1RMInfo(exerciseId, opts);
  const cls = getStartingClass(opts.targetStandardClass || 'Intermediate');
  if (info.source === 'related') {
    const fromName = EXERCISE_MAP[info.fromId]?.name || info.fromId;
    const std = id => getExRxTargetForLift(id, cls, opts.bodyweightLbs || 220, opts.heightInches || 70, {}, {});
    return `1RM ${name} (never logged) = ${fromName} ${fmt(getBestHistory1RM(info.fromId, history))} × standards ${fmt(std(exerciseId))} ÷ ${fmt(std(info.fromId))} (${cls}) = ${fmt(info.value)} lb`;
  }
  if (info.source === 'standard') {
    return `1RM ${name} (never logged) = ${cls} standard (one class below your ${opts.targetStandardClass || 'Intermediate'} goal) at ${fmt(opts.bodyweightLbs || 220)} lb bodyweight = ${fmt(info.value)} lb`;
  }
  return `1RM ${name} = library default ${fmt(info.value)} lb`;
};
