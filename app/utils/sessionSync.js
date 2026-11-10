// ============================================================================
// LIVE SESSION SYNC — shared structure + merge rules (pure functions)
// Two friends share one session's *structure*: which exercises, their order, type / muscle / equipment
// choice, scheme, and the number and types of sets. Weights, reps and checkmarks stay each athlete's own.
// The structure travels through public.shared_sessions (see useSessionSync).
// ============================================================================

import {
  normalizeSlotCategory,
  isSupersetCategory,
  isBodyweightExercise,
  roundToIncrement
} from '../data/exerciseLibrary';
import {
  getHistoricalCalculated1RM,
  calculateLastEquivalentWeightForSet,
  getEffectiveIncrementForExercise,
  getSupersetSchemes,
  formatSecondsToMMSS
} from './workoutEngine';

const slotExerciseIds = slot =>
  isSupersetCategory(slot?.category)
    ? [
        slot.supersetExerciseIds?.[0] || slot.exerciseId,
        slot.supersetExerciseIds?.[1] || slot.secondaryExerciseId
      ]
    : [slot?.exerciseId];

const slotSetLists = slot =>
  isSupersetCategory(slot?.category)
    ? [slot.supersetSetsByExercise?.[0] || slot.sets || [], slot.supersetSetsByExercise?.[1] || slot.secondarySets || []]
    : [slot?.sets || []];

/** The shareable structure of a session (no weights, no checkmarks; reps only as defaults for new sets). */
export const buildSessionSyncStructure = session => ({
  title: session?.title || '',
  slots: (session?.slots || []).map(slot => {
    const isSuperset = isSupersetCategory(slot.category);
    return {
      id: slot.id,
      category: normalizeSlotCategory(slot.category),
      scheme: slot.scheme || '5x8',
      exerciseIds: slotExerciseIds(slot),
      supersetSchemes: isSuperset ? getSupersetSchemes(slot) : null,
      supersetCategories: isSuperset ? slot.supersetCategories || null : null,
      supersetMuscleFilters: isSuperset ? slot.supersetMuscleFilters || null : null,
      supersetEquipmentFilters: isSuperset ? slot.supersetEquipmentFilters || null : null,
      muscleGroupFilter: slot.muscleGroupFilter || null,
      equipmentFilter: slot.equipmentFilter || null,
      restSeconds: slot.restSeconds || 90,
      sets: slotSetLists(slot).map(list =>
        (list || []).map(st => ({
          id: st.id,
          type: st.type || 'Working',
          reps: st.reps ?? null,
          durationSeconds: st.durationSeconds ?? null
        }))
      )
    };
  })
});

/**
 * Compares only what is mirrored: a change in weights, reps, checkmarks or the session name is not a
 * structural change and is never pushed.
 */
export const sessionSyncSignature = structure =>
  JSON.stringify(
    (structure?.slots || []).map(slot => ({
      ...slot,
      restSeconds: undefined,
      sets: (slot.sets || []).map(list => (list || []).map(st => [st.id, st.type]))
    }))
  );

/**
 * Applies a partner's structure to this athlete's session. Slots and sets are matched by id: anything
 * this athlete already has keeps its own weight, reps and checkmark (only the set type follows the
 * partner); new exercises and sets get weights from this athlete's own history and increment.
 */
export const mergeSessionSyncStructure = (localSlots, structure, ctx = {}) => {
  const { history = [], oneRepMaxes = {}, incrementLbs = 0, userBodyweightLbs = 220 } = ctx;
  const localById = new Map((localSlots || []).map(slot => [slot.id, slot]));

  return (structure?.slots || []).map(remote => {
    const local = localById.get(remote.id);
    const category = normalizeSlotCategory(remote.category);
    const isSuperset = isSupersetCategory(category);
    const ids = isSuperset ? [remote.exerciseIds?.[0], remote.exerciseIds?.[1]] : [remote.exerciseIds?.[0]];
    const schemes = isSuperset
      ? [remote.supersetSchemes?.[0] || remote.scheme, remote.supersetSchemes?.[1] || remote.scheme]
      : [remote.scheme];
    const localIds = local ? slotExerciseIds(local) : [];
    const localLists = local ? slotSetLists(local) : [];

    const lists = ids.map((exId, half) => {
      const remoteSets = remote.sets?.[half] || [];
      // Sets only carry over while this half is still the same exercise
      const mineById = new Map((localIds[half] === exId ? localLists[half] || [] : []).map(st => [st.id, st]));
      const total = remoteSets.length;
      const base1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
      const effInc = getEffectiveIncrementForExercise(exId, incrementLbs);
      const isBw = isBodyweightExercise(exId);
      const bodyweight = Math.max(0, Number(userBodyweightLbs) || 220);

      return remoteSets.map((rs, idx) => {
        const mine = mineById.get(rs.id);
        if (mine) return { ...mine, type: rs.type || mine.type, setNumber: idx + 1 };
        const isTimer = rs.durationSeconds !== null && rs.durationSeconds !== undefined;
        const draft = {
          id: rs.id,
          setNumber: idx + 1,
          type: rs.type || 'Working',
          reps: rs.reps ?? 8,
          ...(isTimer ? { durationSeconds: rs.durationSeconds, timerStr: formatSecondsToMMSS(rs.durationSeconds, true) } : {}),
          completed: false
        };
        const lastW = isBw
          ? bodyweight
          : calculateLastEquivalentWeightForSet(base1RM, draft, total, category, idx, schemes[half]);
        const inc = isBw || isTimer || draft.type === '1 Rep Max' ? 0 : effInc;
        return { ...draft, lastWeight: lastW, increment: inc, weight: isBw || isTimer ? lastW : roundToIncrement(lastW + inc) };
      });
    });

    const merged = {
      ...(local || {}),
      id: remote.id,
      category,
      slotLabel: local?.slotLabel || category,
      scheme: schemes[0],
      restSeconds: local?.restSeconds || remote.restSeconds || 90,
      exerciseId: ids[0],
      secondaryExerciseId: isSuperset ? ids[1] : null,
      supersetExerciseIds: ids,
      // Exactly what the partner sent (the slot editor falls back to the exercise's own group), so applying a
      // structure and reading it back gives the same signature and nothing echoes back to the partner
      muscleGroupFilter: remote.muscleGroupFilter || undefined,
      equipmentFilter: remote.equipmentFilter || undefined,
      supersetSetsByExercise: lists,
      sets: lists[0] || [],
      secondarySets: lists[1] || []
    };
    if (isSuperset) {
      merged.supersetSchemes = schemes;
      merged.supersetCategories = remote.supersetCategories || undefined;
      merged.supersetMuscleFilters = remote.supersetMuscleFilters || undefined;
      merged.supersetEquipmentFilters = remote.supersetEquipmentFilters || undefined;
    }
    return merged;
  });
};
