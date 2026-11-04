// ============================================================================
// WORKOUT, 1RM EQUIVALENT & SUPERSET GENERATION ENGINE
// ============================================================================

import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  roundTo5,
  roundToIncrement
} from '../data/exerciseLibrary';

export const SET_TYPES_LIST = ['Warmup Set', 'Working Set', 'Top Out Set', 'Burn Out Set', '1 Rep Max'];

export const getHistoricalCalculated1RM = (exerciseId, history = [], oneRepMaxes = {}) => {
  let best = Number(oneRepMaxes?.[exerciseId]) || 0;
  (history || []).forEach(w => {
    (w.slots || []).forEach(slot => {
      if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
        const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
        ids.forEach((id, idx) => {
          if (id === exerciseId) {
            (slot.supersetSetsByExercise[idx] || []).forEach(st => {
              if (st.completed && Number(st.weight) > 0) {
                const reps = Math.max(1, Number(st.reps) || 1);
                const est = reps === 1 ? Number(st.weight) : Math.round(Number(st.weight) * (1 + reps / 30));
                if (est > best) best = est;
              }
            });
          }
        });
      } else if (slot.exerciseId === exerciseId) {
        (slot.sets || []).forEach(st => {
          if (st.completed && Number(st.weight) > 0) {
            const reps = Math.max(1, Number(st.reps) || 1);
            const est = reps === 1 ? Number(st.weight) : Math.round(Number(st.weight) * (1 + reps / 30));
            if (est > best) best = est;
          }
        });
      }
    });
  });
  return best > 0 ? best : EXERCISE_MAP[exerciseId]?.default1RM ?? 135;
};

export const calculateLastEquivalentWeightForSet = (base1RM, setItem, totalSetsCount = 5, category = 'Compound Lift') => {
  if (category === 'Abs') return 0;
  const max1RM = Math.max(5, Number(base1RM) || 135);
  const sType = setItem?.type || 'Working Set';
  const reps = Math.max(1, Number(setItem?.reps) || 8);

  if (sType === '1 Rep Max') return roundTo5(max1RM);

  const repPct = 1 / (1 + reps / 30);
  let typeMultiplier = 0.96;
  if (sType === 'Warmup Set') typeMultiplier = 0.72;
  else if (sType === 'Top Out Set') typeMultiplier = 1.04;
  else if (sType === 'Burn Out Set') typeMultiplier = 0.82;

  const extraSets = Math.max(0, totalSetsCount - 5);
  const fatigueDiscount = Math.max(0.74, 1 - extraSets * 0.025);

  const rawWeight = max1RM * Math.min(1, repPct * typeMultiplier * fatigueDiscount);
  return roundTo5(rawWeight);
};

export const getIncrementInLbs = (goalIncrement = 1.25, goalUnit = 'lb', goalType = 'Strength') => {
  if (goalType === 'Maintain') return 0;
  const inc = Number(goalIncrement) || 0;
  return goalUnit === 'kg' ? roundToIncrement(inc * 2.20462) : roundToIncrement(inc);
};

export const generateSetsForScheme = (scheme, oneRepMax, category = 'Compound Lift', exerciseId = '', incrementLbs = 0) => {
  const base1RM = oneRepMax || (EXERCISE_MAP[exerciseId]?.default1RM ?? 135);
  const ts = Date.now() + Math.floor(Math.random() * 10000);

  if (category === 'Abs' || exerciseId === 'hollow_holds') {
    return [
      { id: `set_${ts}_abs1`, setNumber: 1, type: 'Working Set', reps: 45, lastWeight: 0, weight: 0, completed: false },
      { id: `set_${ts}_abs2`, setNumber: 2, type: 'Working Set', reps: 45, lastWeight: 0, weight: 0, completed: false }
    ];
  }

  const buildWithLastAndTarget = rawSets => {
    const totalCount = rawSets.length;
    return rawSets.map((s, idx) => {
      const lastW =
        s.lastWeight !== undefined
          ? s.lastWeight
          : calculateLastEquivalentWeightForSet(base1RM, s, totalCount, category);
      const targetW =
        s.type === '1 Rep Max' ? roundTo5(base1RM) : roundToIncrement(lastW + incrementLbs);
      return {
        id: `set_${ts}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
        setNumber: idx + 1,
        type: s.type,
        reps: s.reps,
        lastWeight: lastW,
        weight: targetW,
        completed: false
      };
    });
  };

  switch (scheme) {
    case '5x5':
      return buildWithLastAndTarget(Array.from({ length: 5 }, () => ({ type: 'Working Set', reps: 5 })));
    case '8x8':
      return buildWithLastAndTarget(Array.from({ length: 8 }, () => ({ type: 'Working Set', reps: 8 })));
    case 'Pyramid':
      return buildWithLastAndTarget([
        { reps: 8, type: 'Warmup Set' },
        { reps: 5, type: 'Working Set' },
        { reps: 3, type: 'Working Set' },
        { reps: 2, type: 'Working Set' },
        { reps: 1, type: 'Top Out Set' }
      ]);
    case 'Reverse Pyramid':
      return buildWithLastAndTarget([
        { reps: 8, type: 'Warmup Set' },
        { reps: 4, type: 'Top Out Set' },
        { reps: 6, type: 'Working Set' },
        { reps: 8, type: 'Working Set' },
        { reps: 10, type: 'Working Set' }
      ]);
    case '5x8':
    default:
      return buildWithLastAndTarget(Array.from({ length: 5 }, () => ({ type: 'Working Set', reps: 8 })));
  }
};

export const createWorkoutSlot = ({
  category, slotLabel, exerciseId, secondaryExerciseId = null, supersetExerciseIds = null,
  scheme = '5x8', oneRepMaxes = {}, history = [], incrementLbs = 0, restSeconds = 90
}) => {
  const uid = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (category === 'Supersets') {
    const rawIds =
      Array.isArray(supersetExerciseIds) && supersetExerciseIds.length > 0
        ? supersetExerciseIds
        : [exerciseId, secondaryExerciseId].filter(Boolean);
    const exA = rawIds[0] || 'reverse_lunge';
    const exB = rawIds[1] || (exA === 'reverse_lunge' ? 'front_flies' : 'reverse_lunge');
    const cleanIds = [exA, exB];

    const setsByExercise = cleanIds.map(id => {
      const calcMax = getHistoricalCalculated1RM(id, history, oneRepMaxes);
      return generateSetsForScheme(scheme, calcMax, 'Supersets', id, incrementLbs);
    });
    return {
      id: uid, category: 'Supersets', slotLabel: slotLabel || 'Superset', scheme, restSeconds,
      exerciseId: cleanIds[0], secondaryExerciseId: cleanIds[1], supersetExerciseIds: cleanIds,
      supersetSetsByExercise: setsByExercise, sets: setsByExercise[0] || [], secondarySets: setsByExercise[1] || []
    };
  }

  const ex1 = EXERCISE_MAP[exerciseId] || EXERCISE_LIBRARY[0];
  const calcMax1 = getHistoricalCalculated1RM(ex1.id, history, oneRepMaxes);
  const sets1 = generateSetsForScheme(scheme, calcMax1, category, ex1.id, incrementLbs);

  return {
    id: uid, category, slotLabel: slotLabel || category, scheme, restSeconds,
    exerciseId: ex1.id, secondaryExerciseId: null, supersetExerciseIds: [ex1.id],
    supersetSetsByExercise: [sets1], sets: sets1, secondarySets: []
  };
};

export const normalizeSlotLabels = slots => {
  let compoundCount = 0;
  let supersetCount = 0;
  return (slots || [])
    .filter(slot => slot && slot.category !== 'Warm-Up Routine' && slot.exerciseId !== 'warmup_12_step')
    .map(slot => {
      if (slot.category === 'Compound Lift' || slot.category === 'Compound Lifts') {
        compoundCount += 1;
        return { ...slot, category: 'Compound Lift', slotLabel: `Compound Lift ${compoundCount}` };
      }
      if (slot.category === 'Supersets') {
        supersetCount += 1;
        const rawIds =
          Array.isArray(slot.supersetExerciseIds) && slot.supersetExerciseIds.length > 0
            ? slot.supersetExerciseIds
            : [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
        const exA = rawIds[0] || 'reverse_lunge';
        const exB = rawIds[1] || (exA === 'reverse_lunge' ? 'front_flies' : 'reverse_lunge');
        return {
          ...slot, slotLabel: `Superset ${supersetCount}`,
          exerciseId: exA, secondaryExerciseId: exB, supersetExerciseIds: [exA, exB]
        };
      }
      return slot;
    });
};

export const buildPresetSlots = (presetKey, oneRepMaxes, history = [], incrementLbs = 0) => {
  switch (presetKey) {
    case 'full_body_a':
    case 'mon_tue':
      return normalizeSlotLabels([
        createWorkoutSlot({ category: 'Compound Lift', slotLabel: 'Compound Lift 1', exerciseId: 'barbell_bench_press', scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Compound Lift', slotLabel: 'Compound Lift 2', exerciseId: 'barbell_back_squat', scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Supersets', slotLabel: 'Superset 1', supersetExerciseIds: ['reverse_lunge', 'front_flies'], scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Abs', slotLabel: 'Abs Slot', exerciseId: 'hollow_holds', oneRepMaxes, history, incrementLbs })
      ]);
    case 'full_body_b':
    case 'wed_thu':
      return normalizeSlotLabels([
        createWorkoutSlot({ category: 'Compound Lift', slotLabel: 'Compound Lift 1', exerciseId: 'barbell_deadlift', scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Compound Lift', slotLabel: 'Compound Lift 2', exerciseId: 'overhead_press', scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Supersets', slotLabel: 'Superset 1', supersetExerciseIds: ['pistol_squats', 'reverse_flies'], scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Abs', slotLabel: 'Abs Slot', exerciseId: 'hollow_holds', oneRepMaxes, history, incrementLbs })
      ]);
    case 'arms_only':
    case 'arms_pump':
      return normalizeSlotLabels([
        createWorkoutSlot({ category: 'Compound Lift', slotLabel: 'Compound Lift 1', exerciseId: 'chin_ups', scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Compound Lift', slotLabel: 'Compound Lift 2', exerciseId: 'incline_bench_press', scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Supersets', slotLabel: 'Superset 1', supersetExerciseIds: ['barbell_bicep_curl', 'tricep_skullcrusher'], scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Supersets', slotLabel: 'Supersets', supersetExerciseIds: ['dumbbell_hammer_curl', 'side_raise_dumbbell'], scheme: '5x8', oneRepMaxes, history, incrementLbs })
      ]);
    default:
      return [];
  }
};

export const getInitial1RMs = () => {
  const map = {};
  EXERCISE_LIBRARY.forEach(ex => {
    if (ex.default1RM > 0) map[ex.id] = ex.default1RM;
  });
  return map;
};

export const checkIsWorkoutComplete = slots => {
  if (!slots || slots.length === 0) return false;
  for (const slot of slots) {
    if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
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
    return { topLine: 'NO EXERCISES QUEUED', bottomLine: 'ADD AN EXERCISE TO BEGIN' };
  }
  for (const slot of slots) {
    if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
      const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
      const maxLen = Math.max(0, ...slot.supersetSetsByExercise.map(l => (l ? l.length : 0)));
      for (let sIdx = 0; sIdx < maxLen; sIdx++) {
        for (let exIdx = 0; exIdx < Math.min(2, slot.supersetSetsByExercise.length); exIdx++) {
          const st = slot.supersetSetsByExercise[exIdx]?.[sIdx];
          if (st && !st.completed) {
            const exName = EXERCISE_MAP[ids[exIdx]]?.name || ids[exIdx] || 'Lift';
            return {
              topLine: `NEXT: ${exName.toUpperCase()}`,
              bottomLine: `SET #${st.setNumber} • ${st.weight} LB × ${st.reps} REPS`
            };
          }
        }
      }
    } else if (Array.isArray(slot.sets)) {
      for (const st of slot.sets) {
        if (st && !st.completed) {
          const exName = EXERCISE_MAP[slot.exerciseId]?.name || slot.exerciseId || 'Lift';
          const loadStr = slot.category === 'Abs' ? `${st.reps} SEC` : `${st.weight} LB × ${st.reps} REPS`;
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

