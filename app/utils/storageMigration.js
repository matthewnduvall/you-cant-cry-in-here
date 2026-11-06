// ============================================================================
// UPDATE-RESILIENT PERSISTENCE & SCHEMA MIGRATION ENGINE (V3)
// ============================================================================

import { EXERCISE_LIBRARY, EXERCISE_MAP, normalizeSlotCategory, isSupersetCategory } from '../data/exerciseLibrary';
import { cloneSlots, getInitial1RMs, normalizeSlotLabels } from './workoutEngine';
import { isLocallyVerifiedUser } from './supabaseAuth';

export const PERSISTENCE_KEY = 'yccih_app_state_v3';
export const CURRENT_SCHEMA_VERSION = 3;

export const DEFAULT_MATT_FRIEND = {
  id: 'friend_matt_default',
  username: 'matt',
  email: 'matthew.n.duvall@gmail.com',
  bodyweightLbs: 205,
  startingPrs: {
    barbell_bench_press: 175,
    barbell_back_squat: 215,
    barbell_deadlift: 255,
    overhead_press: 115,
    incline_bench_press: 155,
    chin_ups: 175,
    barbell_row: 155,
    barbell_bicep_curl: 70
  },
  prs: {
    barbell_bench_press: 225,
    barbell_back_squat: 285,
    barbell_deadlift: 335,
    overhead_press: 145,
    incline_bench_press: 195,
    chin_ups: 210,
    barbell_row: 195,
    barbell_bicep_curl: 95
  },
  sharedRoutines: []
};

export const ensureDefaultMattFriend = list => {
  const arr = Array.isArray(list) ? list : [];
  const hasMatt = arr.some(
    f =>
      f &&
      ((f.email || '').trim().toLowerCase() === 'matthew.n.duvall@gmail.com' ||
        (f.username || '').trim().toLowerCase() === 'matt')
  );
  return hasMatt ? arr : [DEFAULT_MATT_FRIEND, ...arr];
};

export const DEFAULT_SETTINGS_V2 = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  prDefaultsCleanedV4: true,
  bodyMetrics: { bodyweightLbs: 220, heightFeet: 5, heightInches: 10 },
  goals: {
    goalType: 'Strength', goalIncrement: 1.25, goalUnit: 'lb',
    chartMetric: 'weight', targetStandardClass: 'Intermediate', customGoalWeights: {}
  },
  stimulus: { greenDays: 2, yellowDays: 4 },
  routinePreferences: ['Compound Lift', 'Compound Lift', 'Superset', 'Superset', 'Accessory'],
  social: { shareStatsWithFriends: true, shareRoutinesWithFriends: true },
  selectedGymId: ''
};

export const normalizeSlotFromStorage = slot => {
  if (!slot || slot.category === 'Warm-Up Routine' || slot.exerciseId === 'warmup_12_step') return null;
  const normCat = normalizeSlotCategory(slot.category);
  const ex1 = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
  const familyMuscleGroup = slot.familyMuscleGroup || ex1?.muscleGroup || 'Chest';
  const sets = Array.isArray(slot.sets) ? slot.sets : [];

  if (isSupersetCategory(normCat)) {
    const supIds =
      Array.isArray(slot.supersetExerciseIds) && slot.supersetExerciseIds.length > 0
        ? slot.supersetExerciseIds
        : [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
    const exA = supIds[0] || 'reverse_lunge';
    const exB = supIds[1] || (exA === 'reverse_lunge' ? 'front_flies' : 'reverse_lunge');
    const cleanSupIds = [exA, exB];
    const supSets =
      Array.isArray(slot.supersetSetsByExercise) && slot.supersetSetsByExercise.length >= 2
        ? [slot.supersetSetsByExercise[0], slot.supersetSetsByExercise[1]]
        : [sets, Array.isArray(slot.secondarySets) && slot.secondarySets.length > 0 ? slot.secondarySets : cloneSlots(sets)];

    return {
      ...slot,
      category: 'Superset',
      muscleGroupFilter: slot.muscleGroupFilter || EXERCISE_MAP[cleanSupIds[0]]?.muscleGroup || 'All Muscles',
      exerciseId: cleanSupIds[0],
      secondaryExerciseId: cleanSupIds[1],
      familyMuscleGroup,
      exerciseNameSnapshot: slot.exerciseNameSnapshot || ex1?.name || slot.exerciseId,
      supersetExerciseIds: cleanSupIds,
      supersetSetsByExercise: supSets,
      sets: supSets[0] || sets,
      secondarySets: supSets[1] || []
    };
  }

  return {
    ...slot,
    category: normCat,
    muscleGroupFilter: slot.muscleGroupFilter || ex1?.muscleGroup || 'All Muscles',
    exerciseId: ex1.id,
    familyMuscleGroup,
    exerciseNameSnapshot: slot.exerciseNameSnapshot || ex1.name,
    supersetExerciseIds: [ex1.id],
    supersetSetsByExercise: [sets],
    sets
  };
};

export const normalizeWorkoutFromStorage = workout => {
  if (!workout) return null;
  const rawSlots = Array.isArray(workout.slots) ? workout.slots : [];
  const normalizedSlots = normalizeSlotLabels(rawSlots.map(normalizeSlotFromStorage).filter(Boolean));
  const rawTitle = String(workout.title || '').trim();
  const normalizedTitle = rawTitle.replace(/^(\d{4})-(\d{2})-(\d{2})\b/, '$1/$2/$3');
  const normalizedWorkoutDate = workout.workoutDate
    ? String(workout.workoutDate).trim().replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1/$2/$3')
    : workout.workoutDate;
  return {
    ...workout,
    title: normalizedTitle || workout.title,
    workoutDate: normalizedWorkoutDate,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    slots: normalizedSlots
  };
};

export const loadHydratedAppState = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PERSISTENCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const rawMaxes = parsed.oneRepMaxes && typeof parsed.oneRepMaxes === 'object' ? parsed.oneRepMaxes : {};
    const wasCleanedV4 = Boolean(parsed.settings?.prDefaultsCleanedV4);
    const mergedMaxes = {};
    Object.entries(rawMaxes).forEach(([exId, val]) => {
      const num = Number(val) || 0;
      if (num <= 0) return;
      // Strip legacy auto-seeded default1RM values so unlogged/un-overridden PRs default to TBD
      if (!wasCleanedV4 && EXERCISE_MAP[exId]?.default1RM === num) {
        return;
      }
      mergedMaxes[exId] = num;
    });

    const cleanedRoutinePrefs = Array.isArray(parsed.settings?.routinePreferences)
      ? parsed.settings.routinePreferences
          .filter(p => p !== 'Warmup')
          .map(p => normalizeSlotCategory(p))
      : [];

    const mergedSettings = {
      ...DEFAULT_SETTINGS_V2,
      ...(parsed.settings || {}),
      prDefaultsCleanedV4: true,
      bodyMetrics: { ...DEFAULT_SETTINGS_V2.bodyMetrics, ...(parsed.settings?.bodyMetrics || {}) },
      goals: {
        ...DEFAULT_SETTINGS_V2.goals,
        ...(parsed.settings?.goals || {}),
        customGoalWeights: {
          ...DEFAULT_SETTINGS_V2.goals.customGoalWeights,
          ...(parsed.settings?.goals?.customGoalWeights || {})
        }
      },
      stimulus: { ...DEFAULT_SETTINGS_V2.stimulus, ...(parsed.settings?.stimulus || {}) },
      social: { ...DEFAULT_SETTINGS_V2.social, ...(parsed.settings?.social || {}) },
      routinePreferences: cleanedRoutinePrefs.length > 0 ? cleanedRoutinePrefs : DEFAULT_SETTINGS_V2.routinePreferences
    };

    const hydratedHistory = Array.isArray(parsed.history)
      ? parsed.history.map(normalizeWorkoutFromStorage).filter(Boolean)
      : [];

    const hydratedSavedRoutines = Array.isArray(parsed.savedRoutines)
      ? parsed.savedRoutines.map(r => ({
        ...r,
        slots: normalizeSlotLabels((r.slots || []).map(normalizeSlotFromStorage).filter(Boolean))
      }))
      : [];

    const hydratedSharedRoutines = Array.isArray(parsed.sharedRoutines)
      ? parsed.sharedRoutines.map(r => ({
        ...r,
        slots: normalizeSlotLabels((r.slots || []).map(normalizeSlotFromStorage).filter(Boolean))
      }))
      : [];

    return {
      user: isLocallyVerifiedUser(parsed.user) ? parsed.user : null,
      oneRepMaxes: mergedMaxes,
      history: hydratedHistory,
      activeSession: parsed.activeSession ? normalizeWorkoutFromStorage(parsed.activeSession) : null,
      savedRoutines: hydratedSavedRoutines,
      sharedRoutines: hydratedSharedRoutines,
      gyms: Array.isArray(parsed.gyms) ? parsed.gyms : [],
      friendsList: ensureDefaultMattFriend(parsed.friendsList),
      pendingIncomingRequests: Array.isArray(parsed.pendingIncomingRequests) ? parsed.pendingIncomingRequests : [],
      outgoingInvites: Array.isArray(parsed.outgoingInvites) ? parsed.outgoingInvites : [],
      settings: mergedSettings
    };
  } catch (err) {
    console.warn('State hydration warning, falling back to defaults:', err);
    return null;
  }
};

