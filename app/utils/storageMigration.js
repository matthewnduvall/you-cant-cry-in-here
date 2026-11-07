// ============================================================================
// UPDATE-RESILIENT PERSISTENCE & SCHEMA MIGRATION ENGINE (V3)
// ============================================================================

import { EXERCISE_LIBRARY, EXERCISE_MAP, normalizeSlotCategory, isSupersetCategory } from '../data/exerciseLibrary';
import { cloneSlots, getInitial1RMs, normalizeSlotLabels } from './workoutEngine';
import { isLocallyVerifiedUser } from './supabaseAuth';

export const PERSISTENCE_KEY = 'yccih_app_state_v3';
export const CURRENT_SCHEMA_VERSION = 3;

const DEFAULT_MATT_EMAIL = 'matthew.n.duvall@gmail.com';

// Every athlete starts out friends with @matt. This is only a stub: his real PRs, history and
// shared routines are filled in from his cloud profile by the friend sync.
export const DEFAULT_MATT_FRIEND = {
  id: 'friend_matt_default',
  username: 'matt',
  email: DEFAULT_MATT_EMAIL,
  prs: {},
  history: [],
  sharedRoutines: []
};

// Demo numbers older builds seeded into the @matt stub. Stripped from saved state so only real
// records show (PR merges keep the max value, so they would otherwise never go away).
const LEGACY_MATT_DEMO = {
  bodyweightLbs: 205,
  prs: {
    barbell_bench_press: 225, barbell_back_squat: 285, barbell_deadlift: 335, overhead_press: 145,
    incline_bench_press: 195, chin_ups: 210, barbell_row: 195, barbell_bicep_curl: 95
  },
  startingPrs: {
    barbell_bench_press: 175, barbell_back_squat: 215, barbell_deadlift: 255, overhead_press: 115,
    incline_bench_press: 155, chin_ups: 175, barbell_row: 155, barbell_bicep_curl: 70
  }
};

const normalizedFriendKeys = f => {
  const email = (f?.email || '').trim().toLowerCase();
  return {
    id: String(f?.id || '').toLowerCase(),
    username: (f?.username || '').trim().toLowerCase().replace(/^@/, ''),
    email,
    emailPrefix: email ? email.split('@')[0] : ''
  };
};

/** True when two friend/athlete records refer to the same person (by id, username, or email). */
export const isSameFriend = (a, b) => {
  if (!a || !b) return false;
  const x = normalizedFriendKeys(a);
  const y = normalizedFriendKeys(b);
  return Boolean(
    (x.id && x.id === y.id) ||
      (x.email && x.email === y.email) ||
      (x.username && (x.username === y.username || x.username === y.emailPrefix)) ||
      (y.username && y.username === x.emailPrefix)
  );
};

export const isFriendRemoved = (friend, removedFriends = []) =>
  (Array.isArray(removedFriends) ? removedFriends : []).some(r => isSameFriend(friend, r));

const isDefaultMatt = f => isSameFriend(f, DEFAULT_MATT_FRIEND);

const withoutValues = (obj, demo) =>
  Object.fromEntries(Object.entries(obj || {}).filter(([k, v]) => Number(v) !== demo[k]));

const stripLegacyMattDemo = f => {
  if (!isDefaultMatt(f)) return f;
  const next = { ...f, prs: withoutValues(f.prs, LEGACY_MATT_DEMO.prs) };
  if (f.startingPrs) next.startingPrs = withoutValues(f.startingPrs, LEGACY_MATT_DEMO.startingPrs);
  if (Number(f.bodyweightLbs) === LEGACY_MATT_DEMO.bodyweightLbs) delete next.bodyweightLbs;
  return next;
};

/**
 * Normalizes a friends list: drops friends the user removed, strips legacy @matt demo numbers,
 * and adds the default @matt friend unless the user has removed him.
 */
export const ensureDefaultMattFriend = (list, removedFriends = []) => {
  const arr = (Array.isArray(list) ? list : [])
    .filter(f => f && !isFriendRemoved(f, removedFriends))
    .map(stripLegacyMattDemo);
  if (arr.some(isDefaultMatt) || isFriendRemoved(DEFAULT_MATT_FRIEND, removedFriends)) return arr;
  return [DEFAULT_MATT_FRIEND, ...arr];
};

const mergeFriendPrs = (prsA = {}, prsB = {}) => {
  const out = { ...(prsA || {}) };
  Object.entries(prsB || {}).forEach(([k, v]) => {
    const num = Number(v) || 0;
    if (num > (Number(out[k]) || 0)) out[k] = num;
  });
  return out;
};

/**
 * Merges incoming friend records into a friends list (matching by id/username/email), keeping the
 * best PR per exercise, then applies the removed-friends list and the default @matt friend.
 * `preferIncoming` decides whose history and shared routines win when both sides have them.
 */
export const mergeFriendsIntoList = (prevList, incoming, removedFriends = [], { preferIncoming = true } = {}) => {
  const list = [...ensureDefaultMattFriend(prevList, removedFriends)];
  (incoming || []).forEach(f => {
    if (!f) return;
    const existingIdx = list.findIndex(item => isSameFriend(item, f));
    if (existingIdx < 0) {
      list.push(f);
      return;
    }
    const existing = list[existingIdx];
    const pick = key => {
      const first = preferIncoming ? f[key] : existing[key];
      const second = preferIncoming ? existing[key] : f[key];
      return Array.isArray(first) && first.length > 0 ? first : second || [];
    };
    list[existingIdx] = {
      ...existing,
      ...f,
      prs: mergeFriendPrs(existing.prs, f.prs),
      history: pick('history'),
      sharedRoutines: pick('sharedRoutines')
    };
  });
  return ensureDefaultMattFriend(list, removedFriends);
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
  routinePreferences: ['Compound', 'Compound', 'Superset', 'Superset', 'Accessory'],
  social: { shareStatsWithFriends: true, shareRoutinesWithFriends: true, removedFriends: [] },
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
      friendsList: ensureDefaultMattFriend(parsed.friendsList, mergedSettings.social.removedFriends),
      pendingIncomingRequests: Array.isArray(parsed.pendingIncomingRequests) ? parsed.pendingIncomingRequests : [],
      outgoingInvites: Array.isArray(parsed.outgoingInvites) ? parsed.outgoingInvites : [],
      settings: mergedSettings
    };
  } catch (err) {
    console.warn('State hydration warning, falling back to defaults:', err);
    return null;
  }
};

