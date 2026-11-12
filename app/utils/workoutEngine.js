// ============================================================================
// WORKOUT, 1RM EQUIVALENT & SUPERSET GENERATION ENGINE
// ============================================================================

import {
  getSlotEquipmentChoice,
  isBandEquipment,
  getSetBandColor,
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  normalizeSlotCategory,
  isSupersetCategory,
  isBodyweightExercise,
  formatDateYMD,
  formatTodayYMD,
  parseYMDToISO,
  roundTo5,
  roundToIncrement,
  stripEquipmentFromExerciseName
} from '../data/exerciseLibrary';

export const SET_TYPES_LIST = ['Warmup', 'Working', 'Top Out', 'Burn Out', '1 Rep Max'];

// Effort multiplier per set type used when converting a logged set to a 1RM estimate.
export const SET_TYPE_MULTIPLIER_MAP = {
  Warmup: 0.74,
  Working: 0.98,
  'Top Out': 1.04,
  'Burn Out': 0.84,
  '1 Rep Max': 1.0
};

/**
 * Estimates a 1RM from one set (used by the 1RM calculator): rep percentage × set-type effort ×
 * a small fatigue factor for the number of sets in the scheme. Never returns less than the weight.
 */
export const estimate1RMFromSet = (setItem, totalSetsCount = 1) => {
  const w = Math.max(0, Number(setItem?.weight) || 0);
  if (w <= 0) return 0;
  const r = Math.max(1, Number(setItem?.reps) || 1);
  const sType = normalizeSetType(setItem?.type);
  if (sType === '1 Rep Max' || (r === 1 && totalSetsCount <= 1)) return roundTo5(w);
  const repPct = 1 / (1 + Math.max(0, r - 1) / 30);
  const typeMultiplier = SET_TYPE_MULTIPLIER_MAP[sType] || 0.98;
  const setStressFactor = 1 / (1 + Math.max(0, totalSetsCount - 1) * 0.035);
  const factor = Math.min(1, repPct * typeMultiplier * setStressFactor);
  if (factor <= 0) return roundTo5(w);
  return Math.max(w, roundTo5(w / factor));
};

/**
 * Builds the single-set "PERSONAL RECORD" History entry logged whenever a PR is entered
 * (plate calculator, 1RM calculator). `dateYMD` defaults to today.
 */
// estimated: the 1RM came from the 1RM calculator (worked out from reps), so it shows with an asterisk
export const buildPersonalRecordHistoryEntry = ({ exerciseId, oneRepMax, dateYMD, scheme = 'Pyramid 1RM', estimated = false }) => {
  const exObj = EXERCISE_MAP[exerciseId] || {
    id: exerciseId,
    name: exerciseId,
    category: 'Compound',
    muscleGroup: 'All Muscles'
  };
  const cleanDate = dateYMD && String(dateYMD).trim() ? formatDateYMD(dateYMD) : formatTodayYMD();
  const ts = Date.now();
  const prSet = {
    id: `set_pr_${ts}`,
    setNumber: 1,
    type: '1 Rep Max',
    reps: 1,
    lastWeight: oneRepMax,
    increment: 0,
    weight: oneRepMax,
    completed: true,
    ...(estimated ? { estimated: true } : {})
  };
  const category = normalizeSlotCategory(exObj.category || 'Compound');
  const prSlot = {
    id: `slot_pr_${ts}`,
    category,
    slotLabel: category,
    scheme,
    restSeconds: 90,
    muscleGroupFilter: exObj.muscleGroup || 'All Muscles',
    familyMuscleGroup: exObj.muscleGroup || 'Chest',
    exerciseId: exObj.id,
    secondaryExerciseId: null,
    supersetExerciseIds: [exObj.id],
    supersetSetsByExercise: [[prSet]],
    sets: [prSet],
    secondarySets: []
  };
  return {
    id: `hist_pr_${exObj.id}_${ts}`,
    title: `${exObj.name} PR (${oneRepMax} LB)`,
    loadedRoutineTitle: 'PERSONAL RECORD',
    startedAt: parseYMDToISO(cleanDate),
    updatedAt: new Date().toISOString(),
    isComplete: true,
    verifiedByUser: true,
    defaultRestSeconds: 90,
    slots: lockAndCompleteSets(normalizeSlotLabels([prSlot]))
  };
};

/** Inserts a History entry and keeps History sorted newest first. */
export const insertHistoryEntrySorted = (history, entry) =>
  [entry, ...(history || [])].sort(
    (a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime()
  );

/** Default scheme for new exercises from the training goal: Strength 5x5, Balanced 5x8 (default), Hypertrophy 5x10, Maintain 5x8. */
export const getDefaultSchemeForGoal = goalType =>
  goalType === 'Strength' ? '5x5' : goalType === 'Hypertrophy' ? '5x10' : '5x8';

// CLUSTER scheme: 3 working sets of one exercise, 6 reps each, with only
// CLUSTER_REST_SECONDS of rest between sets (the rest timer uses it after each set)
export const CLUSTER_SCHEME = 'Cluster';
export const CLUSTER_SET_COUNT = 3;
export const CLUSTER_REPS = 6;
export const CLUSTER_REST_SECONDS = 6;
export const isClusterScheme = scheme => scheme === CLUSTER_SCHEME;

export const SCHEME_OPTIONS = [
  '5x5',
  '5x6',
  '5x8',
  '5x10',
  '8x8',
  'Pyramid',
  'Pyramid 1RM',
  'Reverse Pyramid',
  'Timer',
  CLUSTER_SCHEME
];

export const parseTimerDurationSeconds = rawVal => {
  if (rawVal === null || rawVal === undefined || rawVal === '') return 120;
  if (typeof rawVal === 'string' && rawVal.includes(':')) {
    const parts = rawVal.trim().split(':');
    const mins = Math.max(0, parseInt(parts[0], 10) || 0);
    const secs = Math.max(0, parseInt(parts[1], 10) || 0);
    const total = mins * 60 + secs;
    return total > 0 ? total : 120;
  }
  const num = Number(rawVal);
  if (!Number.isFinite(num) || num <= 0) return 120;
  return Math.round(num);
};

export const formatSecondsToMMSS = (secondsOrStr, padMinutes = true) => {
  const totalSec = parseTimerDurationSeconds(secondsOrStr);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const minStr = padMinutes ? String(mins).padStart(2, '0') : String(mins);
  const secStr = String(secs).padStart(2, '0');
  return `${minStr}:${secStr}`;
};

export const getSetTimerMMSS = (setItem, padMinutes = true) => {
  if (!setItem) return padMinutes ? '02:00' : '2:00';
  if (typeof setItem.timerStr === 'string' && setItem.timerStr.includes(':')) {
    return formatSecondsToMMSS(setItem.timerStr, padMinutes);
  }
  if (Number(setItem.durationSeconds) > 0) {
    return formatSecondsToMMSS(setItem.durationSeconds, padMinutes);
  }
  if (typeof setItem.reps === 'string' && setItem.reps.includes(':')) {
    return formatSecondsToMMSS(setItem.reps, padMinutes);
  }
  const numReps = Number(setItem.reps);
  const sec = Number.isFinite(numReps) && numReps >= 15 ? numReps : 120;
  return formatSecondsToMMSS(sec, padMinutes);
};

export const getLastLoggedTimerDisplay = (
  exerciseId,
  setItem,
  setIdxInEx = 0,
  fallbackWeight = 0,
  history = []
) => {
  const sortedHistory = [...(history || [])].sort(
    (a, b) => new Date(b?.startedAt || 0).getTime() - new Date(a?.startedAt || 0).getTime()
  );

  for (const w of sortedHistory) {
    for (const slot of w?.slots || []) {
      let targetSets = null;
      if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
        const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
        const matchIdx = ids.findIndex(id => id === exerciseId);
        if (matchIdx >= 0) {
          targetSets = slot.supersetSetsByExercise[matchIdx];
        }
      } else if (slot.exerciseId === exerciseId) {
        targetSets = slot.sets;
      }

      if (Array.isArray(targetSets) && targetSets.length > 0) {
        const completedSets = targetSets.filter(s => s && s.completed);
        const pool = completedSets.length > 0 ? completedSets : targetSets;
        const picked = pool[Math.min(setIdxInEx, pool.length - 1)] || pool[0];
        if (picked) {
          const timeStr =
            slot.scheme === 'Timer' || picked.durationSeconds || picked.timerStr
              ? getSetTimerMMSS(picked, false)
              : getSetTimerMMSS(setItem, false);
          const wVal =
            Number(picked.weight) > 0
              ? Number(picked.weight)
              : Math.max(0, Number(fallbackWeight) || 0);
          return `${timeStr}@${wVal}`;
        }
      }
    }
  }

  const defaultTimeStr = getSetTimerMMSS(setItem, false);
  const defaultW = Math.max(0, Number(fallbackWeight) || 0);
  return `${defaultTimeStr}@${defaultW}`;
};

export const normalizeSetType = rawType => {
  if (!rawType) return 'Working';
  const t = String(rawType).trim();
  if (t === 'Warmup Set' || t === 'Warmup') return 'Warmup';
  if (t === 'Working Set' || t === 'Working') return 'Working';
  if (t === 'Top Out Set' || t === 'Top Out') return 'Top Out';
  if (t === 'Burn Out Set' || t === 'Burn Out') return 'Burn Out';
  if (t === '1 Rep Max') return '1 Rep Max';
  return 'Working';
};

// A 1RM is "true" when it was actually lifted for 1 rep; one worked out from a multi-rep set (weight × (1 + reps / 30))
// or entered from the 1RM calculator (set.estimated) is "calculated" and shows with an asterisk (oneRepMaxLabel).
export const isCalculated1RMSet = set => Math.max(1, Number(set?.reps) || 1) > 1 || Boolean(set?.estimated);
/** "225" for a true 1RM, "225*" for a calculated one. */
export const oneRepMaxLabel = (value, calculated) => `${value}${calculated ? '*' : ''}`;
/** Best 1RM over sets: { value, calculated } (on a tie a true single wins). */
export const best1RMInfoOfSets = (sets = []) => {
  let value = 0;
  let calculated = false;
  (sets || []).forEach(st => {
    const w = Number(st?.weight) || 0;
    if (w <= 0) return;
    const reps = Math.max(1, Number(st.reps) || 1);
    const est = reps === 1 ? w : Math.round(w * (1 + reps / 30));
    const calc = isCalculated1RMSet(st);
    if (est > value || (est === value && calculated && !calc)) {
      value = est;
      calculated = calc;
    }
  });
  return { value, calculated };
};

export const getBestHistory1RMInfo = (exerciseId, history = []) => {
  let best = 0;
  let bestCalculated = false;
  let bestWorkoutId = null;
  let bestSlotId = null;
  let bestDateLabel = '';

  (history || []).forEach(w => {
    (w?.slots || []).forEach(slot => {
      const scanSets = setsList => {
        const arr = Array.isArray(setsList) ? setsList : [];
        const hasCompleted = arr.some(s => s && s.completed && Number(s.weight) > 0);
        arr.forEach(st => {
          if (!st || Number(st.weight) <= 0) return;
          if (hasCompleted && !st.completed) return;
          const reps = Math.max(1, Number(st.reps) || 1);
          const est = reps === 1 ? Number(st.weight) : Math.round(Number(st.weight) * (1 + reps / 30));
          const calc = isCalculated1RMSet(st);
          if (est > best || (est === best && bestCalculated && !calc)) {
            best = est;
            bestCalculated = calc;
            bestWorkoutId = w?.id || null;
            bestSlotId = slot?.id || null;
            bestDateLabel = w?.startedAt ? formatDateYMD(w.startedAt) : '';
          }
        });
      };

      if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
        const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
        ids.forEach((id, idx) => {
          if (id === exerciseId) {
            scanSets(slot.supersetSetsByExercise[idx]);
          }
        });
      } else if (slot.exerciseId === exerciseId) {
        scanSets(slot.sets);
      }
    });
  });

  return {
    best,
    // true = worked out from a multi-rep set or the 1RM calculator, not lifted for 1 rep
    calculated: best > 0 && bestCalculated,
    workoutId: bestWorkoutId,
    slotId: bestSlotId,
    dateLabel: bestDateLabel
  };
};

export const getBestHistory1RM = (exerciseId, history = []) => {
  return getBestHistory1RMInfo(exerciseId, history).best;
};

export const getPersonalRecord1RM = (exerciseId, history = []) => {
  return getBestHistory1RM(exerciseId, history);
};

export const getHistoricalCalculated1RM = (exerciseId, history = [], oneRepMaxes = {}) => {
  const best = getPersonalRecord1RM(exerciseId, history, oneRepMaxes);
  return best > 0 ? best : EXERCISE_MAP[exerciseId]?.default1RM ?? 135;
};

export const calculateLastEquivalentWeightForSet = (
  base1RM,
  setItem,
  totalSetsCount = 5,
  category = 'Compound',
  setIndex = 0,
  scheme = ''
) => {
  const max1RM = Math.max(5, Number(base1RM) || 135);
  const sType = normalizeSetType(setItem?.type);
  const reps = scheme === 'Timer' ? 8 : Math.max(1, Number(setItem?.reps) || 8);

  if (sType === '1 Rep Max' || totalSetsCount <= 1) return roundTo5(max1RM);

  // For Pyramid 1RM warmup sets (unless the user explicitly edited reps), use the exact 50%..85% warmup ramp
  if (
    scheme === 'Pyramid 1RM' &&
    sType === 'Warmup' &&
    setIndex < totalSetsCount - 1 &&
    setItem?.lastEditedField !== 'reps'
  ) {
    const warmupCount = Math.max(1, totalSetsCount - 1);
    const pct = warmupCount <= 1 ? 0.70 : 0.50 + (setIndex / (warmupCount - 1)) * 0.35;
    return roundTo5(max1RM * pct);
  }

  const repPct = 1 / (1 + Math.max(0, reps - 1) / 30);
  let typeMultiplier = 0.98;
  if (sType === 'Warmup') typeMultiplier = 0.74;
  else if (sType === 'Top Out') typeMultiplier = 1.04;
  else if (sType === 'Burn Out') typeMultiplier = 0.84;

  const setStressFactor = 1 / (1 + Math.max(0, totalSetsCount - 1) * 0.035);

  const rawWeight = max1RM * Math.min(1, repPct * typeMultiplier * setStressFactor);
  return roundTo5(rawWeight);
};

export const calculateEquivalentRepsForWeight = (
  base1RM,
  targetWeightLbs,
  setItem,
  totalSetsCount = 5,
  category = 'Compound',
  incrementLbs = 0
) => {
  const max1RM = Math.max(5, Number(base1RM) || 135);
  const sType = normalizeSetType(setItem?.type);
  if (sType === '1 Rep Max' || totalSetsCount <= 1) return 1;

  let typeMultiplier = 0.98;
  if (sType === 'Warmup') typeMultiplier = 0.74;
  else if (sType === 'Top Out') typeMultiplier = 1.04;
  else if (sType === 'Burn Out') typeMultiplier = 0.84;

  const setStressFactor = 1 / (1 + Math.max(0, totalSetsCount - 1) * 0.035);
  const effectiveBaseWeight = Math.max(5, (Number(targetWeightLbs) || 0) - (Number(incrementLbs) || 0));
  const denom = max1RM * typeMultiplier * setStressFactor;
  if (denom <= 0) return 1;

  const repPct = effectiveBaseWeight / denom;
  if (repPct >= 1) return 1;
  const computedReps = Math.round(1 + 30 * (1 / repPct - 1));
  return Math.max(1, Math.min(50, computedReps));
};

export const getIncrementInLbs = (goalIncrement = 1.25, goalUnit = 'lb', goalType = 'Balanced') => {
  if (goalType === 'Maintain') return 0;
  const inc = Number(goalIncrement) || 0;
  return goalUnit === 'kg' ? roundToIncrement(inc * 2.20462) : roundToIncrement(inc);
};

// The progression increment is added once to the total weight lifted (not per side of a barbell)
export const getEffectiveIncrementForExercise = (exerciseId, baseIncrementLbs = 0) => {
  const inc = Number(baseIncrementLbs) || 0;
  return inc > 0 ? roundToIncrement(inc) : 0;
};

// Exercise Set Preferences (Configuration → ROUTINES): the type of each set, by position, for new exercises on the
// uniform rep schemes (5x5, 5x6, 5x8, 5x10, 8x8). Sets beyond the list are Working.
export const DEFAULT_SET_PREFERENCES = ['Warmup', 'Warmup', 'Working', 'Working', 'Working'];
export const SET_PREFERENCE_TYPES = ['Warmup', 'Working', 'Top Out', 'Burn Out'];
const typesFromSetPreferences = (count, setPreferences) => {
  const prefs = Array.isArray(setPreferences) && setPreferences.length > 0 ? setPreferences : DEFAULT_SET_PREFERENCES;
  return Array.from({ length: count }, (_, i) => (SET_PREFERENCE_TYPES.includes(prefs[i]) ? prefs[i] : 'Working'));
};

export const generateSetsForScheme = (
  scheme,
  oneRepMax,
  category = 'Compound',
  exerciseId = '',
  incrementLbs = 0,
  userBodyweightLbs = 220,
  setPreferences = DEFAULT_SET_PREFERENCES
) => {
  const isBw = isBodyweightExercise(exerciseId);
  const bwDefault = Math.max(0, Number(userBodyweightLbs) || 220);
  const base1RM = oneRepMax || (isBw ? bwDefault : EXERCISE_MAP[exerciseId]?.default1RM ?? 135);
  const effectiveInc = isBw ? 0 : getEffectiveIncrementForExercise(exerciseId, incrementLbs);
  const ts = Date.now() + Math.floor(Math.random() * 10000);

  const buildWithLastAndTarget = rawSets => {
    const totalCount = rawSets.length;
    return rawSets.map((s, idx) => {
      const normType = normalizeSetType(s.type);
      const lastW =
        s.lastWeight !== undefined
          ? s.lastWeight
          : isBw
            ? bwDefault
            : calculateLastEquivalentWeightForSet(base1RM, { ...s, type: normType }, totalCount, category, idx, scheme);
      const setInc = isBw || scheme === 'Timer' || normType === '1 Rep Max' ? 0 : effectiveInc;
      const targetW = isBw
        ? bwDefault
        : normType === '1 Rep Max'
          ? roundTo5(base1RM)
          : roundToIncrement(lastW + setInc);
      return {
        id: `set_${ts}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
        setNumber: idx + 1,
        type: normType,
        reps: s.reps,
        ...(scheme === 'Timer'
          ? {
              durationSeconds: s.durationSeconds || 120,
              timerStr: s.timerStr || '02:00'
            }
          : {}),
        lastWeight: lastW,
        increment: setInc,
        weight: targetW,
        completed: false
      };
    });
  };

  switch (scheme) {
    case 'Timer':
      return buildWithLastAndTarget(
        Array.from({ length: 5 }, () => ({
          type: 'Working',
          reps: 120,
          durationSeconds: 120,
          timerStr: '02:00'
        }))
      );
    case '5x5':
      return buildWithLastAndTarget(typesFromSetPreferences(5, setPreferences).map(type => ({ type, reps: 5 })));
    case '5x6':
      return buildWithLastAndTarget(typesFromSetPreferences(5, setPreferences).map(type => ({ type, reps: 6 })));
    case '5x10':
      return buildWithLastAndTarget(typesFromSetPreferences(5, setPreferences).map(type => ({ type, reps: 10 })));
    case '8x8':
      return buildWithLastAndTarget(typesFromSetPreferences(8, setPreferences).map(type => ({ type, reps: 8 })));
    case CLUSTER_SCHEME:
      return buildWithLastAndTarget(
        Array.from({ length: CLUSTER_SET_COUNT }, () => ({ type: 'Working', reps: CLUSTER_REPS }))
      );
    case 'Pyramid':
      return buildWithLastAndTarget([
        { reps: 8, type: 'Warmup' },
        { reps: 5, type: 'Working' },
        { reps: 3, type: 'Working' },
        { reps: 2, type: 'Working' },
        { reps: 1, type: 'Top Out' }
      ]);
    case 'Pyramid 1RM': {
      const pyramidReps = [8, 5, 3, 2, 1];
      const totalCount = pyramidReps.length;
      const maxW = isBw ? bwDefault : roundTo5(base1RM);
      return pyramidReps.map((reps, idx) => {
        if (idx === totalCount - 1) {
          return {
            id: `set_${ts}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
            setNumber: idx + 1,
            type: '1 Rep Max',
            reps: 1,
            lastWeight: maxW,
            increment: isBw ? 0 : effectiveInc,
            weight: isBw ? bwDefault : roundToIncrement(maxW + effectiveInc),
            completed: false
          };
        }
        const warmupW = isBw
          ? bwDefault
          : calculateLastEquivalentWeightForSet(
              base1RM,
              { reps, type: 'Warmup' },
              totalCount,
              category,
              idx,
              'Pyramid 1RM'
            );
        return {
          id: `set_${ts}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
          setNumber: idx + 1,
          type: 'Warmup',
          reps,
          lastWeight: warmupW,
          increment: 0,
          weight: warmupW,
          completed: false
        };
      });
    }
    case 'Reverse Pyramid':
      return buildWithLastAndTarget([
        { reps: 8, type: 'Warmup' },
        { reps: 4, type: 'Top Out' },
        { reps: 6, type: 'Working' },
        { reps: 8, type: 'Working' },
        { reps: 10, type: 'Working' }
      ]);
    case '5x8':
    default:
      return buildWithLastAndTarget(typesFromSetPreferences(5, setPreferences).map(type => ({ type, reps: 8 })));
  }
};

// ============================================================================
// GOAL PROGRESS — set weights for RECALCULATE, + ADD EXERCISE and AUTO SESSION, all through ONE calculated 1RM
// for the whole exercise (the common value that converts between schemes, reps and set types).
// A set's 1RM factor = rep % × set-type effort × fatigue for the number of sets (the same estimate as the 1RM
// calculator, estimate1RMFromSet, unrounded); an exercise's calculated 1RM = the highest weight ÷ factor over its sets.
// Working sets (every set that isn't a Warm-up) each get the LOWER of:
//   A) last session: if that set's reps (and type) match last time, last weight + increment; otherwise last
//      session's calculated 1RM converted to this set, + increment
//   B) the stored 1RM + increment, converted to this set
// The increment is added once to the total weight. Warm-up sets are converted from the 1RM the working weight
// implies; on RECALCULATE, once the first set's weight is entered, the sets before the working sets ramp up from it.
// Weights round to the nearest min(2.5, increment) lb. Applies to rep schemes (not Pyramid 1RM / Timer) and
// weighted exercises (not bodyweight). Nothing known yet (no 1RM, no previous session) → the scheme defaults.
// ============================================================================

export const GOAL_PROGRESS_SCHEMES = ['5x5', '5x6', '5x8', '5x10', '8x8', 'Pyramid', 'Reverse Pyramid', 'Cluster'];

const roundToStep = (val, step) => Math.round(val / step) * step;

/** 1RM factor of one set within an exercise of `totalSetsCount` sets (weight = 1RM × factor). */
export const getSetOneRepMaxFactor = (setItem, totalSetsCount = 1) => {
  const reps = Math.max(1, Number(setItem?.reps) || 1);
  const sType = normalizeSetType(setItem?.type);
  if (sType === '1 Rep Max' || (reps === 1 && totalSetsCount <= 1)) return 1;
  const repPct = 1 / (1 + Math.max(0, reps - 1) / 30);
  const typeMultiplier = SET_TYPE_MULTIPLIER_MAP[sType] || 0.98;
  const setStressFactor = 1 / (1 + Math.max(0, totalSetsCount - 1) * 0.035);
  return Math.min(1, repPct * typeMultiplier * setStressFactor);
};

/**
 * Calculated 1RM of a whole exercise from its sets (completed ones if any were completed); 0 = no weights.
 * Warm-ups only count when the exercise has no other sets: they're deliberately easy, so with their 0.74 effort
 * factor a warm-up close to the working weight would otherwise imply a higher 1RM than the working sets.
 */
export const getExerciseCalculated1RM = sets => {
  const weighted = (Array.isArray(sets) ? sets : []).filter(st => st && Number(st.weight) > 0);
  if (weighted.length === 0) return 0;
  const completed = weighted.filter(st => st.completed);
  const pool = completed.length > 0 ? completed : weighted;
  const nonWarmup = pool.filter(st => normalizeSetType(st.type) !== 'Warmup');
  const used = nonWarmup.length > 0 ? nonWarmup : pool;
  const total = (Array.isArray(sets) ? sets : []).length || used.length;
  return Math.max(...used.map(st => Number(st.weight) / getSetOneRepMaxFactor(st, total)));
};

/** Every logged session of an exercise, newest first: [{ workoutId, startedAt, sets }] (PR entries included). */
const getLoggedSessionsForExercise = (exerciseId, history = [], excludeWorkoutId = null) =>
  (history || [])
    .filter(w => w && w.id !== excludeWorkoutId)
    .sort((a, b) => (Date.parse(b.startedAt || '') || 0) - (Date.parse(a.startedAt || '') || 0))
    .map(w => {
      const sets = [];
      (w.slots || []).forEach(slot => {
        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
          const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          ids.forEach((id, idx) => {
            if (id === exerciseId) sets.push(...(slot.supersetSetsByExercise[idx] || []));
          });
        } else if (slot.exerciseId === exerciseId) {
          sets.push(...(slot.sets || []));
        }
      });
      return { workoutId: w.id, isPersonalRecord: w.loadedRoutineTitle === 'PERSONAL RECORD', sets };
    })
    .filter(s => s.sets.some(st => st && Number(st.weight) > 0));

/** Sets of the most recent real session (not a PERSONAL RECORD entry) that logged the exercise. */
export const getLastLoggedSetsForExercise = (exerciseId, history = [], excludeWorkoutId = null) =>
  getLoggedSessionsForExercise(exerciseId, history, excludeWorkoutId).find(s => !s.isPersonalRecord)?.sets || [];

/** Stored 1RM: the highest calculated 1RM over all logged sessions (PR entries included) or a saved 1RM. */
export const getStored1RM = (exerciseId, history = [], oneRepMaxes = {}, excludeWorkoutId = null) =>
  Math.max(
    Number(oneRepMaxes?.[exerciseId]) || 0,
    ...getLoggedSessionsForExercise(exerciseId, history, excludeWorkoutId).map(s => getExerciseCalculated1RM(s.sets))
  );

/**
 * Applies goal progress to an exercise's sets. `lockedIndexes` (completed sets, weights the athlete typed) and
 * set 0 when `startWeight` is given keep their weight.
 */
export const applyGoalProgressToSets = (
  sets,
  { exerciseId, scheme, history = [], oneRepMaxes = {}, incrementLbs = 0, excludeWorkoutId = null, lockedIndexes = [], startWeight = null }
) => {
  const list = Array.isArray(sets) ? sets : [];
  if (list.length === 0 || !GOAL_PROGRESS_SCHEMES.includes(scheme) || isBodyweightExercise(exerciseId)) return list;
  const inc = getEffectiveIncrementForExercise(exerciseId, incrementLbs);
  const step = inc > 0 ? Math.min(2.5, inc) : 2.5;
  const total = list.length;
  const stored1RM = getStored1RM(exerciseId, history, oneRepMaxes, excludeWorkoutId);
  const lastSets = getLastLoggedSetsForExercise(exerciseId, history, excludeWorkoutId);
  const last1RM = getExerciseCalculated1RM(lastSets);
  if (stored1RM <= 0 && last1RM <= 0) return list;

  const isWarmup = st => normalizeSetType(st?.type) === 'Warmup';
  let workingIdx = list.map((st, i) => (isWarmup(st) ? -1 : i)).filter(i => i >= 0);
  if (workingIdx.length === 0) workingIdx = list.map((_, i) => i);
  const firstWorking = workingIdx[0];
  // Last session matches when it had the same number of sets; then set i is compared with set i
  const sameShape = lastSets.length === total;

  const targetFor = (st, idx) => {
    const factor = getSetOneRepMaxFactor(st, total);
    const options = [];
    if (last1RM > 0) {
      const prev = sameShape ? lastSets[idx] : null;
      const repsMatch =
        prev && Number(prev.reps) === Number(st.reps) && normalizeSetType(prev.type) === normalizeSetType(st.type);
      options.push(repsMatch ? Number(prev.weight) + inc : last1RM * factor + inc);
    }
    if (stored1RM > 0) options.push((stored1RM + inc) * factor);
    return Math.max(0, roundToStep(Math.min(...options), step));
  };

  const targets = {};
  workingIdx.forEach(i => {
    targets[i] = targetFor(list[i], i);
  });
  // The 1RM the first working set implies (warm-ups are converted from it)
  const implied1RM = targets[firstWorking] / getSetOneRepMaxFactor(list[firstWorking], total);

  const locked = new Set(lockedIndexes);
  const hasStart = Number(startWeight) > 0;
  if (hasStart) locked.add(0);
  const withIncrement = (st, weight) => {
    const lastWeight = Number(st.lastWeight) > 0 ? Number(st.lastWeight) : weight;
    return { ...st, weight, lastWeight, increment: Math.round((weight - lastWeight) * 100) / 100 };
  };
  return list.map((st, idx) => {
    if (locked.has(idx)) return st;
    if (targets[idx] !== undefined) return withIncrement(st, targets[idx]);
    // Sets before the first working set: ramp from the entered first weight on RECALCULATE, else convert
    if (hasStart && idx < firstWorking) {
      const ramp = Number(startWeight) + ((targets[firstWorking] - Number(startWeight)) * idx) / firstWorking;
      return withIncrement(st, Math.max(0, roundToStep(ramp, step)));
    }
    return withIncrement(st, Math.max(0, roundToStep(implied1RM * getSetOneRepMaxFactor(st, total), step)));
  });
};

// Pyramid schemes vary the reps set by set, so the editor's SETS / REPS boxes read NA for them (and for Timer reps)
export const PYRAMID_SCHEMES = ['Pyramid', 'Pyramid 1RM', 'Reverse Pyramid'];
const PYRAMID_REPS = { Pyramid: [8, 5, 3, 2, 1], 'Pyramid 1RM': [8, 5, 3, 2, 1], 'Reverse Pyramid': [8, 4, 6, 8, 10] };
// A superset has this many sets (rounds); each round is one set of exercise A and one of exercise B
export const SUPERSET_SET_COUNT = 3;

/** Reps a uniform scheme asks for ("5x8" → 8); null for pyramids and Timer. */
export const getSchemeUniformReps = scheme => {
  if (isClusterScheme(scheme)) return CLUSTER_REPS;
  const match = /^(\d+)x(\d+)/.exec(String(scheme || ''));
  return match ? Number(match[2]) : null;
};

/**
 * Target reps of set `idx` (of `total`) when RECALCULATE resets unlocked reps: the slot's own REPS box
 * (`targetReps`) on uniform schemes, else the scheme's reps; pyramids follow their pattern (stretched to the count).
 * null = leave the reps alone (Timer).
 */
export const getTargetRepsForSet = (scheme, idx, total, targetReps = null) => {
  if (scheme === 'Timer') return null;
  const pattern = PYRAMID_REPS[scheme];
  if (pattern) {
    if (total <= 1) return pattern[pattern.length - 1];
    const pos = Math.round((idx / (total - 1)) * (pattern.length - 1));
    return pattern[Math.max(0, Math.min(pattern.length - 1, pos))];
  }
  const typed = Number(targetReps);
  if (Number.isFinite(typed) && typed > 0) return Math.round(typed);
  return getSchemeUniformReps(scheme) || 8;
};

/** Keeps the last `count` sets (the working sets on the usual schemes), renumbered. */
export const trimSetsTo = (sets, count) =>
  (Array.isArray(sets) ? sets : []).slice(-count).map((st, i) => ({ ...st, setNumber: i + 1 }));

/**
 * History entries default to finished, fixed sets: every set is marked done and its type, weight and reps are
 * locked (lockType / lockWeight / lockReps), unless a lock was already turned off (false stays false). Done once per
 * exercise: the slot is marked `historyLocked` (slots sync with the workout), so later edits in the History editor —
 * e.g. unticking a set — are kept.
 */
export const lockAndCompleteSets = slots => {
  const fix = list =>
    (Array.isArray(list) ? list : []).map(st =>
      st
        ? {
            ...st,
            completed: true,
            lockType: st.lockType ?? true,
            lockWeight: st.lockWeight ?? true,
            lockReps: st.lockReps ?? true
          }
        : st
    );
  return (Array.isArray(slots) ? slots : []).map(slot => {
    if (!slot || slot.historyLocked) return slot;
    const matrix = Array.isArray(slot.supersetSetsByExercise) ? slot.supersetSetsByExercise.map(fix) : undefined;
    return {
      ...slot,
      historyLocked: true,
      sets: fix(slot.sets),
      ...(Array.isArray(slot.secondarySets) ? { secondarySets: fix(slot.secondarySets) } : {}),
      ...(matrix ? { supersetSetsByExercise: matrix } : {})
    };
  });
};

/**
 * FINISH: only the sets marked done go to History. Exercises with no done set are left out; a superset keeps both
 * halves' done sets (`sets` / `secondarySets` mirror the halves).
 */
export const keepCompletedSets = slots =>
  (Array.isArray(slots) ? slots : [])
    .map(slot => {
      if (!slot) return null;
      const done = list => (Array.isArray(list) ? list : []).filter(st => st && st.completed);
      if (Array.isArray(slot.supersetSetsByExercise) && slot.supersetSetsByExercise.length > 1) {
        const matrix = slot.supersetSetsByExercise.map(done);
        if (matrix.every(list => list.length === 0)) return null;
        return { ...slot, supersetSetsByExercise: matrix, sets: matrix[0] || [], secondarySets: matrix[1] || [] };
      }
      const sets = done(slot.sets);
      if (sets.length === 0) return null;
      return {
        ...slot,
        sets,
        ...(Array.isArray(slot.supersetSetsByExercise) ? { supersetSetsByExercise: [sets] } : {})
      };
    })
    .filter(Boolean);

/** A History workout as it is shown and edited: exercises not yet marked get their sets done and locked once. */
export const asHistoricalWorkout = workout =>
  workout && (workout.slots || []).some(slot => slot && !slot.historyLocked)
    ? { ...workout, slots: lockAndCompleteSets(workout.slots) }
    : workout;

/** [schemeA, schemeB] for a superset (each exercise may run its own scheme); falls back to slot.scheme. */
export const getSupersetSchemes = slot => [
  slot?.supersetSchemes?.[0] || slot?.scheme || '5x8',
  slot?.supersetSchemes?.[1] || slot?.scheme || '5x8'
];

export const createWorkoutSlot = ({
  category,
  slotLabel,
  exerciseId,
  secondaryExerciseId = null,
  supersetExerciseIds = null,
  scheme = '5x8',
  // Superset only: [schemeA, schemeB]; defaults to scheme for both
  supersetSchemes = null,
  oneRepMaxes = {},
  history = [],
  incrementLbs = 0,
  restSeconds = 90,
  userBodyweightLbs = 220,
  // Optional { [exerciseId]: estimated1RM } used only when the exercise has no logged history
  // (e.g. converting a barbell lift's 1RM to a dumbbell equivalent after an equipment swap).
  base1RMOverrides = null,
  // Exercise Set Preferences (types of each set on the uniform rep schemes)
  setPreferences = DEFAULT_SET_PREFERENCES
}) => {
  const uid = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const normCat = normalizeSlotCategory(category);
  const resolveBase1RM = id => {
    const override = Number(base1RMOverrides?.[id]) || 0;
    if (override > 0 && getBestHistory1RM(id, history) <= 0) return override;
    return getHistoricalCalculated1RM(id, history, oneRepMaxes);
  };

  if (normCat === 'Superset') {
    const rawIds =
      Array.isArray(supersetExerciseIds) && supersetExerciseIds.length > 0
        ? supersetExerciseIds
        : [exerciseId, secondaryExerciseId].filter(Boolean);
    const exA = rawIds[0] || 'reverse_lunge';
    const exB = rawIds[1] || (exA === 'reverse_lunge' ? 'front_flies' : 'reverse_lunge');
    const cleanIds = [exA, exB];
    const schemes = [supersetSchemes?.[0] || scheme, supersetSchemes?.[1] || scheme];

    const setsByExercise = cleanIds.map((id, idx) => {
      const calcMax = resolveBase1RM(id);
      // Working sets follow goal progress (last weight + increment, or stored 1RM + increment, whichever is lower)
      // Supersets run SUPERSET_SET_COUNT rounds: the scheme's last sets (its working sets)
      return applyGoalProgressToSets(
        trimSetsTo(
          generateSetsForScheme(schemes[idx], calcMax, 'Superset', id, incrementLbs, userBodyweightLbs, setPreferences),
          SUPERSET_SET_COUNT
        ),
        { exerciseId: id, scheme: schemes[idx], history, oneRepMaxes, incrementLbs }
      );
    });
    return {
      id: uid,
      category: 'Superset',
      slotLabel: slotLabel || 'Superset',
      scheme: schemes[0],
      supersetSchemes: schemes,
      restSeconds,
      muscleGroupFilter: EXERCISE_MAP[cleanIds[0]]?.muscleGroup || 'All Muscles',
      exerciseId: cleanIds[0],
      secondaryExerciseId: cleanIds[1],
      supersetExerciseIds: cleanIds,
      supersetSetsByExercise: setsByExercise,
      sets: setsByExercise[0] || [],
      secondarySets: setsByExercise[1] || []
    };
  }

  const ex1 = EXERCISE_MAP[exerciseId] || EXERCISE_LIBRARY[0];
  const calcMax1 = resolveBase1RM(ex1.id);
  // Working sets follow goal progress (last weight + increment, or stored 1RM + increment, whichever is lower)
  const sets1 = applyGoalProgressToSets(
    generateSetsForScheme(scheme, calcMax1, normCat, ex1.id, incrementLbs, userBodyweightLbs, setPreferences),
    { exerciseId: ex1.id, scheme, history, oneRepMaxes, incrementLbs }
  );

  return {
    id: uid,
    category: normCat,
    slotLabel: slotLabel || normCat,
    scheme,
    restSeconds,
    muscleGroupFilter: ex1.muscleGroup || 'All Muscles',
    exerciseId: ex1.id,
    secondaryExerciseId: null,
    supersetExerciseIds: [ex1.id],
    supersetSetsByExercise: [sets1],
    sets: sets1,
    secondarySets: []
  };
};

export const normalizeSlotLabels = slots => {
  let compoundCount = 0;
  let supersetCount = 0;
  let accessoryCount = 0;
  return (slots || [])
    .filter(slot => slot && slot.category !== 'Warm-Up Routine' && slot.exerciseId !== 'warmup_12_step')
    .map(slot => {
      const normCat = normalizeSlotCategory(slot.category);
      if (normCat === 'Compound') {
        compoundCount += 1;
        return { ...slot, category: 'Compound', slotLabel: `Compound ${compoundCount}` };
      }
      if (normCat === 'Superset') {
        supersetCount += 1;
        const rawIds =
          Array.isArray(slot.supersetExerciseIds) && slot.supersetExerciseIds.length > 0
            ? slot.supersetExerciseIds
            : [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
        const exA = rawIds[0] || 'reverse_lunge';
        const exB = rawIds[1] || (exA === 'reverse_lunge' ? 'front_flies' : 'reverse_lunge');
        return {
          ...slot,
          category: 'Superset',
          slotLabel: `Superset ${supersetCount}`,
          exerciseId: exA,
          secondaryExerciseId: exB,
          supersetExerciseIds: [exA, exB]
        };
      }
      if (normCat === 'Accessory') {
        accessoryCount += 1;
        return { ...slot, category: 'Accessory', slotLabel: `Accessory ${accessoryCount}` };
      }
      return { ...slot, category: normCat };
    });
};

export const buildPresetSlots = (presetKey, oneRepMaxes, history = [], incrementLbs = 0, userBodyweightLbs = 220) => {
  switch (presetKey) {
    case 'full_body_a':
    case 'mon_tue':
      return normalizeSlotLabels([
        createWorkoutSlot({ category: 'Compound', slotLabel: 'Compound 1', exerciseId: 'barbell_bench_press', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Compound', slotLabel: 'Compound 2', exerciseId: 'barbell_back_squat', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Superset', slotLabel: 'Superset 1', supersetExerciseIds: ['reverse_lunge', 'front_flies'], scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Accessory', slotLabel: 'Accessory 1', exerciseId: 'hollow_holds', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs })
      ]);
    case 'full_body_b':
    case 'wed_thu':
      return normalizeSlotLabels([
        createWorkoutSlot({ category: 'Compound', slotLabel: 'Compound 1', exerciseId: 'barbell_deadlift', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Compound', slotLabel: 'Compound 2', exerciseId: 'overhead_press', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Superset', slotLabel: 'Superset 1', supersetExerciseIds: ['pistol_squats', 'reverse_flies'], scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Accessory', slotLabel: 'Accessory 1', exerciseId: 'hollow_holds', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs })
      ]);
    case 'arms_only':
    case 'arms_pump':
      return normalizeSlotLabels([
        createWorkoutSlot({ category: 'Compound', slotLabel: 'Compound 1', exerciseId: 'chin_ups', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Compound', slotLabel: 'Compound 2', exerciseId: 'incline_bench_press', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Superset', slotLabel: 'Superset 1', supersetExerciseIds: ['barbell_bicep_curl', 'tricep_skullcrusher'], scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Superset', slotLabel: 'Superset 2', supersetExerciseIds: ['dumbbell_hammer_curl', 'side_raise_dumbbell'], scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs })
      ]);
    default:
      return [];
  }
};

export const getInitial1RMs = () => {
  return {};
};

export const checkIsWorkoutComplete = slots => {
  if (!slots || slots.length === 0) return false;
  for (const slot of slots) {
    if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
      for (const list of slot.supersetSetsByExercise) {
        if (!list || list.some(s => !s.completed)) return false;
      }
    } else {
      if (!slot.sets || slot.sets.length === 0 || slot.sets.some(s => !s.completed)) return false;
    }
  }
  return true;
};

export const formatTimerSeconds = sec => {
  const isNeg = sec < 0;
  const abs = Math.abs(sec);
  const mins = Math.floor(abs / 60);
  const rem = abs % 60;
  const formatted = `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  return isNeg ? `-${formatted}` : formatted;
};

export const cloneSlots = slots => {
  if (!Array.isArray(slots)) return [];
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(slots);
    } catch {
      // Fallback below
    }
  }
  return JSON.parse(JSON.stringify(slots));
};

// Session header NEXT bar: short exercise name (no Barbell / Dumbbell…) and 'SET 1 • 172.5 LB × 5' so it fits at phone width
export const getNextIncompleteSetInfo = slots => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return {
      topLine: 'NO EXERCISES QUEUED',
      bottomLine: ''
    };
  }
  for (const slot of slots) {
    const isTimer = slot.scheme === 'Timer';
    if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
      const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
      const maxLen = Math.max(0, ...slot.supersetSetsByExercise.map(l => (l ? l.length : 0)));
      for (let sIdx = 0; sIdx < maxLen; sIdx++) {
        for (let exIdx = 0; exIdx < Math.min(2, slot.supersetSetsByExercise.length); exIdx++) {
          const st = slot.supersetSetsByExercise[exIdx]?.[sIdx];
          if (st && !st.completed) {
            const exName = stripEquipmentFromExerciseName(EXERCISE_MAP[ids[exIdx]]?.name || ids[exIdx] || 'Lift');
            const repOrTime = isTimer ? getSetTimerMMSS(st, true) : `${st.reps}`;
            const load = isBandEquipment(getSlotEquipmentChoice(slot, exIdx))
              ? `${getSetBandColor(st).toUpperCase()} BAND`
              : `${st.weight} LB`;
            return {
              topLine: `NEXT: ${exName.toUpperCase()}`,
              bottomLine: `SET ${st.setNumber} • ${load} × ${repOrTime}`
            };
          }
        }
      }
    } else if (Array.isArray(slot.sets)) {
      for (const st of slot.sets) {
        if (st && !st.completed) {
          const exName = stripEquipmentFromExerciseName(EXERCISE_MAP[slot.exerciseId]?.name || slot.exerciseId || 'Lift');
          const repOrTime = isTimer ? getSetTimerMMSS(st, true) : `${st.reps}`;
          const load = isBandEquipment(getSlotEquipmentChoice(slot, 0))
            ? `${getSetBandColor(st).toUpperCase()} BAND`
            : `${st.weight} LB`;
          const loadStr = `${load} × ${repOrTime}`;
          return {
            topLine: `NEXT: ${exName.toUpperCase()}`,
            bottomLine: `SET ${st.setNumber} • ${loadStr}`
          };
        }
      }
    }
  }
  return { topLine: 'ALL SETS COMPLETE ✓', bottomLine: 'READY TO SAVE SESSION' };
};

