// ============================================================================
// WORKOUT, 1RM EQUIVALENT & SUPERSET GENERATION ENGINE
// ============================================================================

import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  normalizeSlotCategory,
  isSupersetCategory,
  isBodyweightExercise,
  formatDateYMD,
  formatTodayYMD,
  parseYMDToISO,
  roundTo5,
  roundToIncrement
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
export const buildPersonalRecordHistoryEntry = ({ exerciseId, oneRepMax, dateYMD, scheme = 'Pyramid 1RM' }) => {
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
    completed: true
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
    title: `${cleanDate} - ${exObj.name} PR (${oneRepMax} LB)`,
    loadedRoutineTitle: 'PERSONAL RECORD',
    startedAt: parseYMDToISO(cleanDate),
    updatedAt: new Date().toISOString(),
    isComplete: true,
    verifiedByUser: true,
    defaultRestSeconds: 90,
    slots: normalizeSlotLabels([prSlot])
  };
};

/** Inserts a History entry and keeps History sorted newest first. */
export const insertHistoryEntrySorted = (history, entry) =>
  [entry, ...(history || [])].sort(
    (a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime()
  );

export const SCHEME_OPTIONS = [
  '5x5',
  '5x8',
  '8x8',
  'Pyramid',
  'Pyramid 1RM',
  'Reverse Pyramid',
  'Timer'
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

export const getBestHistory1RMInfo = (exerciseId, history = []) => {
  let best = 0;
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
          if (est > best) {
            best = est;
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

export const getIncrementInLbs = (goalIncrement = 1.25, goalUnit = 'lb', goalType = 'Strength') => {
  if (goalType === 'Maintain') return 0;
  const inc = Number(goalIncrement) || 0;
  return goalUnit === 'kg' ? roundToIncrement(inc * 2.20462) : roundToIncrement(inc);
};

export const getEffectiveIncrementForExercise = (exerciseId, baseIncrementLbs = 0) => {
  const inc = Number(baseIncrementLbs) || 0;
  if (inc <= 0) return 0;
  const exObj = EXERCISE_MAP[exerciseId];
  const isBarbell = exObj?.equipment === 'Barbell';
  return isBarbell ? roundToIncrement(inc * 2) : roundToIncrement(inc);
};

export const generateSetsForScheme = (
  scheme,
  oneRepMax,
  category = 'Compound',
  exerciseId = '',
  incrementLbs = 0,
  userBodyweightLbs = 220
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
      return buildWithLastAndTarget(Array.from({ length: 5 }, () => ({ type: 'Working', reps: 5 })));
    case '8x8':
      return buildWithLastAndTarget(Array.from({ length: 8 }, () => ({ type: 'Working', reps: 8 })));
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
      return buildWithLastAndTarget(Array.from({ length: 5 }, () => ({ type: 'Working', reps: 8 })));
  }
};

export const createWorkoutSlot = ({
  category,
  slotLabel,
  exerciseId,
  secondaryExerciseId = null,
  supersetExerciseIds = null,
  scheme = '5x8',
  oneRepMaxes = {},
  history = [],
  incrementLbs = 0,
  restSeconds = 90,
  userBodyweightLbs = 220,
  // Optional { [exerciseId]: estimated1RM } used only when the exercise has no logged history
  // (e.g. converting a barbell lift's 1RM to a dumbbell equivalent after an equipment swap).
  base1RMOverrides = null
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

    const setsByExercise = cleanIds.map(id => {
      const calcMax = resolveBase1RM(id);
      return generateSetsForScheme(scheme, calcMax, 'Superset', id, incrementLbs, userBodyweightLbs);
    });
    return {
      id: uid,
      category: 'Superset',
      slotLabel: slotLabel || 'Superset',
      scheme,
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
  const sets1 = generateSetsForScheme(scheme, calcMax1, normCat, ex1.id, incrementLbs, userBodyweightLbs);

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
            const exName = EXERCISE_MAP[ids[exIdx]]?.name || ids[exIdx] || 'Lift';
            const repOrTime = isTimer ? getSetTimerMMSS(st, true) : `${st.reps} REPS`;
            return {
              topLine: `NEXT: ${exName.toUpperCase()}`,
              bottomLine: `SET #${st.setNumber} • ${st.weight} LB × ${repOrTime}`
            };
          }
        }
      }
    } else if (Array.isArray(slot.sets)) {
      for (const st of slot.sets) {
        if (st && !st.completed) {
          const exName = EXERCISE_MAP[slot.exerciseId]?.name || slot.exerciseId || 'Lift';
          const repOrTime = isTimer ? getSetTimerMMSS(st, true) : `${st.reps} REPS`;
          const loadStr = `${st.weight} LB × ${repOrTime}`;
          return {
            topLine: `NEXT: ${exName.toUpperCase()}`,
            bottomLine: `SET #${st.setNumber} • ${loadStr}`
          };
        }
      }
    }
  }
  return { topLine: 'ALL SETS COMPLETE ✓', bottomLine: 'READY TO SAVE SESSION' };
};

