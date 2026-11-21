// The 1RM an exercise starts from when it has never been logged (no History for it):
//   1. a related lift you have logged — the same Big 3 / OHP family (front squat ← back squat, incline bench ← bench,
//      RDL ← deadlift…) — converted by the two lifts' strength standards at the same class (so the ratio between them
//      is the standards' ratio), the best such conversion;
//   2. otherwise the strength standard one class below your goal (Intermediate goal → Novice), for your bodyweight.
// Exercises that have been logged use their own History. Bodyweight exercises keep the library default.

import { EXERCISE_MAP, EXRX_CLASSES, getExRxTargetForLift, isBodyweightExercise } from '../data/exerciseLibrary';
import { getBestHistory1RM, estimateSet1RM, setReportedRir, loggedExercise1RMInfo,
  withEffectiveLoad
} from './workoutEngine';
import { getSlotEquipmentChoice } from '../data/exerciseLibrary';
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

// A never-logged bodyweight exercise's starting 1RM assumes this many reps to failure at bodyweight
export const BODYWEIGHT_START_REPS = 12;

/**
 * { value, source: 'history' | 'related' | 'standard' | 'bodyweight' | 'default', fromId } for an exercise.
 * opts = { history, targetStandardClass, bodyweightLbs, heightInches }
 */
export const getStarting1RMInfo = (exerciseId, { history = [], targetStandardClass = 'Novice', bodyweightLbs = 220, heightInches = 70 } = {}) => {
  const own = getBestHistory1RM(exerciseId, history);
  if (own > 0) return { value: own, source: 'history', fromId: exerciseId };
  if (EXERCISE_MAP[exerciseId] && isBodyweightExercise(exerciseId) && Number(bodyweightLbs) > 0) {
    // Bodyweight exercises count your bodyweight as the load, so a 1RM below it would mean one rep at most. Never
    // logged: start at about BODYWEIGHT_START_REPS reps to failure at bodyweight (the library default if higher)
    const fromBodyweight = Math.round((Number(bodyweightLbs) * (1 + (BODYWEIGHT_START_REPS - 1) / 30)) / 5) * 5;
    const libraryDefault = EXERCISE_MAP[exerciseId]?.default1RM ?? 0;
    return libraryDefault >= fromBodyweight
      ? { value: libraryDefault, source: 'default', fromId: null }
      : { value: fromBodyweight, source: 'bodyweight', fromId: null };
  }
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
  // The best session: its 1RM is a real single when it has one, else the whole exercise's average
  // (loggedExercise1RMInfo, the rule History's PRs and the PROGRESS page use)
  let best = null;
  history.forEach(w =>
    (w?.slots || []).forEach(slot => {
      const ids = slot?.supersetSetsByExercise ? slot.supersetExerciseIds || [slot.exerciseId] : [slot?.exerciseId];
      const lists = slot?.supersetSetsByExercise || [slot?.sets];
      ids.forEach((id, i) => {
        if (id !== exerciseId) return;
        const info = loggedExercise1RMInfo(id, lists[i] || [], getSlotEquipmentChoice(slot, i));
        if (info.value > 0 && (!best || info.value > best.info.value)) best = { info, at: w.startedAt };
      });
    })
  );
  if (best) {
    const { info } = best;
    const day = best.at ? String(best.at).slice(0, 10) : '';
    const setText = st => {
      const reps = Math.max(1, Number(st.reps) || 1);
      const rir = setReportedRir(st);
      return rir ? `${fmt(st.weight)} × (1 + (${reps} + ${fmt(rir)} RIR − 1) ÷ 30)` : `${fmt(st.weight)} × (1 + (${reps} − 1) ÷ 30)`;
    };
    if (!info.calculated) {
      return `1RM ${name} = ${fmt(info.value)} lb, lifted for 1 rep${day ? ` (${day})` : ''}`;
    }
    const parts = info.sets.map(st => fmt(Math.round(estimateSet1RM(st))));
    if (info.sets.length === 1) {
      return `1RM ${name} = ${setText(info.sets[0])} = ${fmt(info.value)} lb (best session${day ? `, ${day}` : ''})`;
    }
    return `1RM ${name} = average of ${info.sets.length} working sets (${parts.join(', ')}) = ${fmt(info.value)} lb (best session${day ? `, ${day}` : ''}; each set = weight × (1 + (reps + RIR − 1) ÷ 30))`;
  }
  const info = getStarting1RMInfo(exerciseId, opts);
  const cls = getStartingClass(opts.targetStandardClass || 'Novice');
  if (info.source === 'related') {
    const fromName = EXERCISE_MAP[info.fromId]?.name || info.fromId;
    const std = id => getExRxTargetForLift(id, cls, opts.bodyweightLbs || 220, opts.heightInches || 70, {}, {});
    return `1RM ${name} (never logged) = ${fromName} ${fmt(getBestHistory1RM(info.fromId, history))} × standards ${fmt(std(exerciseId))} ÷ ${fmt(std(info.fromId))} (${cls}) = ${fmt(info.value)} lb`;
  }
  if (info.source === 'standard') {
    return `1RM ${name} (never logged) = ${cls} standard (one class below your ${opts.targetStandardClass || 'Novice'} goal) at ${fmt(opts.bodyweightLbs || 220)} lb bodyweight = ${fmt(info.value)} lb`;
  }
  if (info.source === 'bodyweight') {
    return `1RM ${name} (never logged) = bodyweight ${fmt(opts.bodyweightLbs || 220)} × (1 + (${BODYWEIGHT_START_REPS} reps to failure − 1) ÷ 30) = ${fmt(info.value)} lb`;
  }
  return `1RM ${name} = library default ${fmt(info.value)} lb`;
};
