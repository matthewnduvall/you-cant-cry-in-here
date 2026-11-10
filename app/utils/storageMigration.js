// ============================================================================
// UPDATE-RESILIENT PERSISTENCE & SCHEMA MIGRATION ENGINE (V3)
// ============================================================================

import { EXERCISE_LIBRARY, EXERCISE_MAP, normalizeSlotCategory, isSupersetCategory } from '../data/exerciseLibrary';
import { cloneSlots, getInitial1RMs, normalizeSlotLabels } from './workoutEngine';
import { isLocallyVerifiedUser } from './supabaseAuth';

export const PERSISTENCE_KEY = 'yccih_app_state_v3';
export const CURRENT_SCHEMA_VERSION = 3;

// ---------------------------------------------------------------------------
// FRIENDS
// Friendships are server-side rows in public.friendships keyed by Supabase account ids; the
// default @matt friendship is created by a database trigger at sign-up. The local friends list is
// only a cache of what the server returned, so it is matched by account id and nothing else.
// ---------------------------------------------------------------------------

const ACCOUNT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hasAccountId = f => ACCOUNT_ID_RE.test(String(f?.id || ''));

/** True when two friend records are the same account (same Supabase account id). */
export const isSameFriend = (a, b) => Boolean(hasAccountId(a) && hasAccountId(b) && String(a.id) === String(b.id));

/**
 * Cleans a stored friends list: keeps only real accounts (legacy name-matched stubs are dropped)
 * and removes duplicates. Signed-out devices keep no friends' data at all.
 */
export const cleanStoredFriendsList = (list, signedIn = true) => {
  if (!signedIn) return [];
  const seen = new Set();
  return (Array.isArray(list) ? list : []).filter(f => {
    if (!hasAccountId(f) || seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
};

/**
 * Applies a server friendship sync (syncFriendshipsForUser) to the cached friends list. The server
 * list is authoritative: friends who were removed (by either athlete) disappear. When friend
 * profiles could not be loaded, cached details are kept for friends that are still friends.
 */
export const applyFriendshipSync = (prevList, result) => {
  if (!result?.ok) return Array.isArray(prevList) ? prevList : [];
  const prevById = new Map((Array.isArray(prevList) ? prevList : []).filter(hasAccountId).map(f => [f.id, f]));
  return result.friends.map(friend => {
    const cached = prevById.get(friend.id);
    return !result.profilesLoaded && cached ? { ...cached, friendshipId: friend.friendshipId } : friend;
  });
};

/**
 * Cleans the "sent" list after a sync: drops in-app requests that became friendships or no longer
 * exist (declined/cancelled), and email invites whose recipient is now a friend.
 */
export const applyOutgoingInvitesSync = (prevInvites, result) => {
  if (!result?.ok) return Array.isArray(prevInvites) ? prevInvites : [];
  const friendIds = new Set(result.friends.map(f => f.id));
  const friendEmails = new Set(result.friends.map(f => (f.email || '').toLowerCase()).filter(Boolean));
  const pendingIds = new Set(result.outgoingRequests.map(r => r.id));
  return (Array.isArray(prevInvites) ? prevInvites : []).filter(inv => {
    if (typeof inv === 'string') return !friendEmails.has(inv.toLowerCase());
    if (hasAccountId(inv)) return !friendIds.has(inv.id) && pendingIds.has(inv.id);
    return !friendEmails.has((inv?.email || '').toLowerCase());
  });
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
  // Exercise Set Preferences: the type of each set (by position) for new exercises on the uniform rep schemes
  setPreferences: ['Warmup', 'Warmup', 'Working', 'Working', 'Working'],
  social: { shareStatsWithFriends: true, shareRoutinesWithFriends: true, profileIsPublic: true },
  selectedGymId: '',
  // the Equipment page list (GYM_EQUIPMENT_OPTIONS the athlete has); null = not chosen yet (derived from selectedGymId)
  availableEquipment: null
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
      routinePreferences: cleanedRoutinePrefs.length > 0 ? cleanedRoutinePrefs : DEFAULT_SETTINGS_V2.routinePreferences,
      setPreferences:
        Array.isArray(parsed.settings?.setPreferences) &&
        parsed.settings.setPreferences.length > 0 &&
        parsed.settings.setPreferences.every(t => ['Warmup', 'Working', 'Top Out', 'Burn Out'].includes(t))
          ? parsed.settings.setPreferences
          : DEFAULT_SETTINGS_V2.setPreferences
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
      friendsList: cleanStoredFriendsList(parsed.friendsList, isLocallyVerifiedUser(parsed.user)),
      pendingIncomingRequests: Array.isArray(parsed.pendingIncomingRequests) ? parsed.pendingIncomingRequests : [],
      outgoingInvites: Array.isArray(parsed.outgoingInvites) ? parsed.outgoingInvites : [],
      settings: mergedSettings
    };
  } catch (err) {
    console.warn('State hydration warning, falling back to defaults:', err);
    return null;
  }
};

