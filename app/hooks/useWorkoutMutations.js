'use client';

import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  normalizeSlotCategory,
  isSupersetCategory,
  isBodyweightExercise,
  inferRoutineGymCategory,
  getDefaultSessionName,
  getDefaultAutoSessionName,
  formatTitleWithDate,
  parseYMDToISO,
  formatTodayYMD,
  findEquivalentExerciseForGym,
  convertEquivalent1RM,
  getFilteredExercisesForSlotInline,
  getAvailableMuscleGroupsForCategory,
  roundTo5,
  roundToIncrement,
  CORE_PR_EXERCISE_IDS,
  isExerciseAvailableWithEquipment,
  findEquivalentExerciseForEquipment
} from '../data/exerciseLibrary';
import {
  getBestHistory1RM,
  getHistoricalCalculated1RM,
  calculateLastEquivalentWeightForSet,
  calculateEquivalentRepsForWeight,
  getEffectiveIncrementForExercise,
  createWorkoutSlot,
  generateSetsForScheme,
  getDefaultSchemeForGoal,
  getSupersetSchemes,
  normalizeSlotLabels,
  buildPresetSlots,
  checkIsWorkoutComplete,
  cloneSlots,
  parseTimerDurationSeconds,
  formatSecondsToMMSS
} from '../utils/workoutEngine';
import { deleteCloudRoutineByKey, deleteCloudWorkoutsByIds } from '../utils/supabaseAuth';
import { markWorkoutIdDeleted, clearDeletedWorkoutIds } from '../utils/cloudSyncLedger';

// ---------------------------------------------------------------------------
// Auto-pick scoring (+ ADD EXERCISE and AUTO SESSION). Score ≈ "days this muscle group is behind",
// weighted by how much the group matters, plus a bonus for the Big 3 + OHP on compound picks.
// ---------------------------------------------------------------------------
const STIMULUS_DAYS_CAP = 14; // unlogged / very stale groups count as this many days behind
const BIG4_BONUS_DAYS = 6; // Big 3 + OHP win unless their muscles were trained much more recently
const SAME_WORKOUT_PENALTY_DAYS = 10; // avoid hitting the same muscle group twice in one workout
const MUSCLE_GROUP_WEIGHT = {
  Chest: 1,
  Back: 1,
  Thighs: 1,
  Shoulders: 1,
  Hips: 0.9,
  'Upper Arms': 0.8,
  Waist: 0.6,
  Calves: 0.5,
  Forearms: 0.4,
  Neck: 0.25
};
const NON_TRAINING_EQUIPMENT = ['stretch', 'isometric'];

export function useWorkoutMutations({
  currentView,
  setCurrentView,
  user,
  history,
  setHistory,
  oneRepMaxes,
  setOneRepMaxes,
  activeSession,
  setActiveSession,
  historicalDraft,
  setHistoricalDraft,
  routineDraft,
  setRoutineDraft,
  previewRoutineDraft,
  setPreviewRoutineDraft,
  routineSelectReturnView,
  setRoutineSelectReturnView,
  isCurrentEditorShared,
  setIsCurrentEditorShared,
  expandedHistoryWorkoutId,
  setExpandedHistoryWorkoutId,
  confirmedHistoryEditWorkoutId,
  setConfirmedHistoryEditWorkoutId,
  historicalEditConfirmTarget,
  setHistoricalEditConfirmTarget,
  deleteConfirmTarget,
  setDeleteConfirmTarget,
  setSaveConfirmTarget,
  setOpenedFromRoutines,
  selectedGymId,
  setSelectedGymId,
  gyms,
  routinePreferences,
  currentIncrementLbs,
  userBodyweightLbs = 220,
  shareRoutinesWithFriends,
  setSavedRoutines,
  setSharedRoutines,
  setTimerTrigger,
  appendSessionLog,
  // { [muscleGroup]: { daysAgo } } from useTelemetryAndAnalytics — drives which muscles are "behind"
  muscleStimulusStatus = {},
  // the Equipment page list (null = everything); drives every exercise picked for the athlete
  availableEquipment = null,
  // Training goal: sets the default scheme of new exercises (Strength 5x5, Hypertrophy 5x10, Maintain 5x8)
  goalType = 'Strength'
}) {
  const defaultScheme = getDefaultSchemeForGoal(goalType);
  const isAvailable = ex => isExerciseAvailableWithEquipment(ex, availableEquipment);
  // Default picks prefer exercises the athlete has the equipment for; the full list is the fallback
  const preferAvailable = pool => {
    const available = pool.filter(isAvailable);
    return available.length > 0 ? available : pool;
  };

  const getCurrentEditorWorkout = () => {
    if (currentView === 'historical_entry') return historicalDraft;
    if (currentView === 'routine_editor') return routineDraft;
    if (currentView === 'routine_preview') return previewRoutineDraft;
    if (currentView === 'history' && expandedHistoryWorkoutId) {
      return history.find(w => w.id === expandedHistoryWorkoutId) || null;
    }
    return activeSession;
  };

  const updateCurrentWorkoutState = updater => {
    setIsCurrentEditorShared(false);
    if (currentView === 'history' && expandedHistoryWorkoutId) {
      const targetHistId = expandedHistoryWorkoutId;
      const targetWorkout = history.find(w => w.id === targetHistId);
      const applyHistoryMutation = () => {
        setHistory(prev =>
          prev.map(w => {
            if (w.id !== targetHistId) return w;
            const next = updater(w);
            return next
              ? {
                  ...next,
                  updatedAt: new Date().toISOString(),
                  slots: normalizeSlotLabels(next.slots)
                }
              : w;
          })
        );
        appendSessionLog?.('HISTORY_EDIT', `Edited historical workout: ${targetWorkout?.title || targetHistId}`);
      };

      if (confirmedHistoryEditWorkoutId === targetHistId) {
        applyHistoryMutation();
      } else {
        setHistoricalEditConfirmTarget({
          workoutId: targetHistId,
          label: targetWorkout?.title || 'Logged Session',
          onConfirm: () => {
            setConfirmedHistoryEditWorkoutId(targetHistId);
            applyHistoryMutation();
          }
        });
      }
      return;
    }

    if (currentView === 'historical_entry') {
      setHistoricalDraft(prev => {
        const next = updater(prev);
        return next ? { ...next, slots: normalizeSlotLabels(next.slots) } : next;
      });
    } else if (currentView === 'routine_editor') {
      setRoutineDraft(prev => {
        const next = updater(prev);
        return next ? { ...next, slots: normalizeSlotLabels(next.slots) } : next;
      });
    } else if (currentView === 'routine_preview') {
      setPreviewRoutineDraft(prev => {
        const next = updater(prev);
        return next ? { ...next, slots: normalizeSlotLabels(next.slots) } : next;
      });
    } else {
      setActiveSession(prev => {
        const next = updater(prev);
        return next ? { ...next, slots: normalizeSlotLabels(next.slots) } : next;
      });
    }
  };

  const handleConfirmHistoricalEdit = () => {
    if (!historicalEditConfirmTarget) return;
    const fn = historicalEditConfirmTarget.onConfirm;
    setHistoricalEditConfirmTarget(null);
    if (typeof fn === 'function') fn();
  };

  // addOne: return the existing slots plus just the next guessed slot (+ ADD EXERCISE)
  const buildGeneratedAutoSlots = (existingSlots = [], { addOne = false } = {}) => {
    const cleanExisting = Array.isArray(existingSlots) ? cloneSlots(existingSlots) : [];
    const usedIds = new Set();
    const remainingCategoryCounts = {
      Compound: 0,
      Superset: 0,
      Accessory: 0
    };

    cleanExisting.forEach(slot => {
      if (!slot) return;
      const cat = normalizeSlotCategory(slot.category);
      remainingCategoryCounts[cat] = (remainingCategoryCounts[cat] || 0) + 1;
      if (isSupersetCategory(cat)) {
        (slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId])
          .filter(Boolean)
          .forEach(id => usedIds.add(id));
      } else if (slot.exerciseId) {
        usedIds.add(slot.exerciseId);
      }
    });

    const fallbackPool = preferAvailable(EXERCISE_LIBRARY);
    const isTrainingExercise = ex =>
      !NON_TRAINING_EQUIPMENT.some(word => String(ex.equipment || '').toLowerCase().includes(word));

    // Big 3 + OHP, or each one's closest equivalent for the athlete's equipment
    const big4Order = CORE_PR_EXERCISE_IDS.map(id => findEquivalentExerciseForEquipment(id, availableEquipment)).filter(
      Boolean
    );
    const big4Rank = id => {
      const idx = big4Order.indexOf(id);
      return idx < 0 ? big4Order.length : idx;
    };

    // Muscle groups already in this workout (existing slots + picks made below)
    const usedGroups = new Set();
    usedIds.forEach(id => {
      if (EXERCISE_MAP[id]?.muscleGroup) usedGroups.add(EXERCISE_MAP[id].muscleGroup);
    });

    const daysBehind = group => {
      const days = Number(muscleStimulusStatus?.[group]?.daysAgo);
      return Math.min(STIMULUS_DAYS_CAP, Number.isFinite(days) ? days : STIMULUS_DAYS_CAP);
    };

    const scoreExercise = (ex, preferBig4) => {
      let score = daysBehind(ex.muscleGroup) * (MUSCLE_GROUP_WEIGHT[ex.muscleGroup] ?? 0.7);
      if (preferBig4 && big4Order.includes(ex.id)) score += BIG4_BONUS_DAYS;
      if (usedGroups.has(ex.muscleGroup)) score -= SAME_WORKOUT_PENALTY_DAYS;
      if (ex.isPriority) score += 1;
      if (!String(ex.id).startsWith('exrx_')) score += 1.5; // hand-curated library entries first
      return score;
    };

    // Best unused exercise of a category for the gym filter: most-behind muscle group first
    const pickBest = (category, fallbackId) => {
      const preferBig4 = category === 'Compound';
      let pool = fallbackPool.filter(ex => ex.category === category && !usedIds.has(ex.id) && isTrainingExercise(ex));
      if (pool.length === 0) pool = fallbackPool.filter(ex => !usedIds.has(ex.id) && isTrainingExercise(ex));
      if (pool.length === 0) return EXERCISE_MAP[fallbackId] || EXERCISE_LIBRARY[0];
      const best = pool
        .map(ex => ({ ex, score: scoreExercise(ex, preferBig4) }))
        .sort(
          (a, b) =>
            b.score - a.score ||
            big4Rank(a.ex.id) - big4Rank(b.ex.id) ||
            a.ex.name.localeCompare(b.ex.name)
        )[0].ex;
      usedIds.add(best.id);
      usedGroups.add(best.muscleGroup);
      return best;
    };

    const createSlotForPref = rawPref => {
      const pref = normalizeSlotCategory(rawPref);
      if (pref === 'Compound') {
        const pick = pickBest('Compound', 'barbell_bench_press');
        return createWorkoutSlot({
          category: 'Compound',
          slotLabel: 'Compound',
          exerciseId: pick.id,
          scheme: defaultScheme,
          oneRepMaxes,
          history,
          incrementLbs: currentIncrementLbs,
          userBodyweightLbs
        });
      }
      if (pref === 'Superset') {
        const a1 = pickBest('Accessory', 'reverse_lunge');
        const a2 = pickBest('Accessory', 'front_flies');
        return createWorkoutSlot({
          category: 'Superset',
          slotLabel: 'Superset',
          supersetExerciseIds: [a1.id, a2.id],
          scheme: defaultScheme,
          oneRepMaxes,
          history,
          incrementLbs: currentIncrementLbs,
          userBodyweightLbs
        });
      }
      const pick = pickBest('Accessory', 'dumbbell_hammer_curl');
      return createWorkoutSlot({
        category: 'Accessory',
        slotLabel: 'Accessory',
        exerciseId: pick.id,
        scheme: defaultScheme,
        oneRepMaxes,
        history,
        incrementLbs: currentIncrementLbs,
        userBodyweightLbs
      });
    };

    const activePrefs = (routinePreferences || []).filter(pref => pref !== 'Warmup');
    const prefsToFill = [];

    activePrefs.forEach(rawPref => {
      const norm = normalizeSlotCategory(rawPref);
      if (remainingCategoryCounts[norm] > 0) {
        remainingCategoryCounts[norm] -= 1;
      } else {
        prefsToFill.push(norm);
      }
    });

    if (cleanExisting.length > 0 && prefsToFill.length === 0 && cleanExisting.length < activePrefs.length) {
      for (let i = cleanExisting.length; i < activePrefs.length; i++) {
        prefsToFill.push(normalizeSlotCategory(activePrefs[i]));
      }
    }

    if (addOne) {
      // Next unfilled routine-preference category; once the routine is full, keep cycling through it
      const nextPref =
        prefsToFill[0] ||
        (activePrefs.length > 0
          ? normalizeSlotCategory(activePrefs[cleanExisting.length % activePrefs.length])
          : 'Compound');
      return [...cleanExisting, createSlotForPref(nextPref)];
    }

    const generatedSlots = prefsToFill.map(pref => createSlotForPref(pref));
    return normalizeSlotLabels([...cleanExisting, ...generatedSlots]);
  };

  const handleOpenNewSession = () => {
    // An empty leftover session (e.g. from an earlier day) is replaced so the name and start date are today's
    if (!activeSession || !(activeSession.slots || []).length) {
      setActiveSession({
        id: `session_${Date.now()}`,
        title: getDefaultSessionName(),
        loadedRoutineTitle: 'MANUAL',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        defaultRestSeconds: 90,
        gymId: selectedGymId,
        slots: []
      });
    } else {
      setActiveSession(prev => ({
        ...prev,
        title: prev.title || getDefaultSessionName(),
        loadedRoutineTitle: prev.loadedRoutineTitle || 'MANUAL'
      }));
    }
    setOpenedFromRoutines(false);
    setIsCurrentEditorShared(false);
    setCurrentView('session');
  };

  const handleOpenNewAutoSession = () => {
    const autoSlots = buildGeneratedAutoSlots([]);
    const autoTitle = getDefaultAutoSessionName();
    setActiveSession({
      id: `session_${Date.now()}`,
      title: autoTitle,
      loadedRoutineTitle: 'AUTO',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      defaultRestSeconds: 90,
      gymId: selectedGymId,
      slots: autoSlots
    });
    setOpenedFromRoutines(false);
    setIsCurrentEditorShared(false);
    setCurrentView('session');
  };

  const handleDirectLoadRoutine = (routineObj, returnToView = 'session') => {
    const wasOnRoutinesPage = currentView === 'routines';
    const builtSlots = normalizeSlotLabels(
      cloneSlots(
        routineObj.slots ||
          buildPresetSlots(routineObj.key, oneRepMaxes, history, currentIncrementLbs, userBodyweightLbs)
      )
    );
    const datedTitle = formatTitleWithDate(routineObj.label);
    const routineLabel = routineObj.label || datedTitle;

    if (wasOnRoutinesPage) {
      setOpenedFromRoutines(true);
      if (typeof window !== 'undefined') {
        try {
          window.history.pushState({ yccihFromRoutines: true }, '');
        } catch {
          // ignore
        }
      }
    }
    appendSessionLog?.('LOAD_ROUTINE', `Loaded routine: ${routineLabel}`);

    if (returnToView === 'history' && expandedHistoryWorkoutId) {
      setCurrentView('history');
      updateCurrentWorkoutState(prev => ({
        ...prev,
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        slots: builtSlots
      }));
      setRoutineSelectReturnView(null);
      return;
    }

    if (returnToView === 'historical_entry') {
      setHistoricalDraft(prev => ({
        ...(prev || { id: `hist_${Date.now()}`, workoutDate: formatTodayYMD() }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        slots: builtSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('historical_entry');
    } else if (returnToView === 'routine_editor') {
      setRoutineDraft(prev => ({
        ...(prev || { key: `routine_${Date.now()}`, isEditingExisting: false, defaultRestSeconds: 90 }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        slots: builtSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('routine_editor');
    } else {
      setActiveSession(prev => ({
        ...(prev || { id: `session_${Date.now()}`, startedAt: new Date().toISOString(), defaultRestSeconds: 90 }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        updatedAt: new Date().toISOString(),
        slots: builtSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('session');
    }
  };

  const handleOpenPreviewRoutine = (routineObj, returnToView = 'session') => {
    handleDirectLoadRoutine(routineObj, returnToView || 'session');
  };

  const handleCancelRoutineSelection = () => {
    const returnTarget = routineSelectReturnView || 'session';
    setRoutineSelectReturnView(null);
    if (returnTarget === 'historical_entry' && historicalDraft) {
      setCurrentView('historical_entry');
    } else if (returnTarget === 'routine_editor' && routineDraft) {
      setCurrentView('routine_editor');
    } else if (returnTarget === 'history' && expandedHistoryWorkoutId) {
      setCurrentView('history');
    } else {
      handleOpenNewSession();
    }
  };

  const handleApplyPreviewRoutine = () => {};

  const handleAutoBuildWorkout = () => {
    const currentWorkout = getCurrentEditorWorkout();
    const existingSlots = Array.isArray(currentWorkout?.slots) ? currentWorkout.slots : [];
    const isCompletingExisting = existingSlots.length > 0;
    const generatedSlots = buildGeneratedAutoSlots(existingSlots);
    const autoTitle = isCompletingExisting
      ? currentWorkout?.title || getDefaultAutoSessionName()
      : getDefaultAutoSessionName();
    const returnTarget =
      currentView === 'historical_entry' ||
      currentView === 'routine_editor' ||
      currentView === 'session' ||
      currentView === 'history'
        ? currentView
        : routineSelectReturnView || 'session';

    appendSessionLog?.(
      'AUTO_BUILD',
      isCompletingExisting
        ? `Auto-completed workout: ${autoTitle}`
        : `Generated auto workout: ${autoTitle}`
    );

    if (returnTarget === 'history' && expandedHistoryWorkoutId) {
      updateCurrentWorkoutState(prev => ({
        ...prev,
        title: autoTitle,
        loadedRoutineTitle: prev?.loadedRoutineTitle || 'AUTO',
        slots: generatedSlots
      }));
      return;
    }

    if (returnTarget === 'historical_entry') {
      setHistoricalDraft(prev => ({
        ...(prev || { id: `hist_${Date.now()}`, workoutDate: formatTodayYMD() }),
        title: autoTitle,
        loadedRoutineTitle: isCompletingExisting ? prev?.loadedRoutineTitle || 'AUTO' : 'AUTO',
        slots: generatedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('historical_entry');
    } else if (returnTarget === 'routine_editor') {
      setRoutineDraft(prev => ({
        ...(prev || { key: `routine_${Date.now()}`, isEditingExisting: false, defaultRestSeconds: 90 }),
        title: autoTitle,
        loadedRoutineTitle: isCompletingExisting ? prev?.loadedRoutineTitle || 'AUTO' : 'AUTO',
        slots: generatedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('routine_editor');
    } else {
      setActiveSession(prev => ({
        ...(prev || { id: `session_${Date.now()}`, startedAt: new Date().toISOString(), defaultRestSeconds: 90 }),
        title: autoTitle,
        loadedRoutineTitle: isCompletingExisting ? prev?.loadedRoutineTitle || 'AUTO' : 'AUTO',
        updatedAt: new Date().toISOString(),
        slots: generatedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('session');
    }
  };

  // + ADD EXERCISE: append one auto-guessed exercise (next routine-preference category, not already in the
  // workout, fits the gym selection) that the athlete can then change in the slot editor.
  const handleAddAutoSlot = () => {
    const existingSlots = getCurrentEditorWorkout()?.slots || [];
    const withNext = buildGeneratedAutoSlots(existingSlots, { addOne: true });
    const newSlot = withNext[withNext.length - 1];
    if (!newSlot) return;
    appendSessionLog?.(
      'AUTO_ADD_SLOT',
      `Added auto-picked ${newSlot.category} slot: ${(newSlot.supersetExerciseIds || [newSlot.exerciseId]).join(' + ')}`
    );
    updateCurrentWorkoutState(prev => ({
      ...(prev || { id: `session_${Date.now()}`, title: getDefaultSessionName(), slots: [] }),
      slots: [...(prev?.slots || []), newSlot]
    }));
  };

  const handleSaveCurrentEditor = () => {
    const currentWorkout = getCurrentEditorWorkout();
    if (!currentWorkout || !currentWorkout.slots || currentWorkout.slots.length === 0) {
      return;
    }
    const detectedGymType = inferRoutineGymCategory(currentWorkout.slots);
    setSaveConfirmTarget({
      name: currentWorkout.title || getDefaultSessionName(),
      shareWithFriends: Boolean(isCurrentEditorShared || shareRoutinesWithFriends),
      saveAsRoutine: currentView === 'routine_editor',
      gymType: detectedGymType,
      sourceView: currentView
    });
  };

  const handleConfirmSaveWorkout = confirmed => {
    const currentWorkout = getCurrentEditorWorkout();
    if (!currentWorkout || !currentWorkout.slots || currentWorkout.slots.length === 0) {
      setSaveConfirmTarget(null);
      return;
    }

    const finalTitle = (confirmed?.name || '').trim() || currentWorkout.title || getDefaultSessionName();
    const shouldShare = Boolean(confirmed?.shareWithFriends);
    const sourceView = confirmed?.sourceView || currentView;
    const normalizedSlots = normalizeSlotLabels(cloneSlots(currentWorkout.slots));
    const routineGymType = inferRoutineGymCategory(normalizedSlots);

    const routineItem = {
      key: currentWorkout.key || `routine_${currentWorkout.id || Date.now()}`,
      label: finalTitle,
      author: user?.username || 'test_lifter',
      gymType: routineGymType,
      slots: normalizedSlots
    };
    // ROUTINE toggle: the routine editor always saves a routine; sessions/History only when it is on.
    const shouldSaveRoutine = sourceView === 'routine_editor' || Boolean(confirmed?.saveAsRoutine);
    if (shouldSaveRoutine) {
      setSavedRoutines(prev => {
        const exists = prev.some(r => r.key === routineItem.key || r.label === finalTitle);
        return exists
          ? prev.map(r => (r.key === routineItem.key || r.label === finalTitle ? routineItem : r))
          : [routineItem, ...prev];
      });
    }

    if (shouldShare) {
      const sharedItem = {
        key: `shared_${currentWorkout.id || currentWorkout.key || Date.now()}`,
        label: finalTitle,
        author: user?.username || 'test_lifter',
        gymType: routineGymType,
        slots: normalizedSlots
      };
      setSharedRoutines(prev => {
        const exists = prev.some(r => r.label === sharedItem.label || r.key === sharedItem.key);
        return exists
          ? prev.map(r => (r.label === sharedItem.label || r.key === sharedItem.key ? sharedItem : r))
          : [sharedItem, ...prev];
      });
      setIsCurrentEditorShared(true);
    } else {
      setSharedRoutines(prev => prev.filter(r => r.label !== finalTitle));
      setIsCurrentEditorShared(false);
    }

    appendSessionLog?.('SAVE_WORKOUT', `Saved "${finalTitle}" (gymType=${routineGymType}, shareWithFriends=${shouldShare}, saveAsRoutine=${shouldSaveRoutine})`);
    setSaveConfirmTarget(null);
    setOpenedFromRoutines(false);

    if (sourceView === 'routine_editor') {
      setCurrentView('routines');
      return;
    }

    if (sourceView === 'history' && expandedHistoryWorkoutId) {
      setHistory(prev =>
        prev.map(w =>
          w.id === expandedHistoryWorkoutId
            ? {
                ...w,
                title: finalTitle,
                gymType: routineGymType,
                updatedAt: new Date().toISOString(),
                slots: normalizedSlots
              }
            : w
        )
      );
      setConfirmedHistoryEditWorkoutId(null);
      return;
    }

    if (sourceView === 'historical_entry') {
      const iso = parseYMDToISO(currentWorkout.workoutDate || formatTodayYMD());
      const entry = {
        ...currentWorkout,
        id: currentWorkout.id || `hist_${Date.now()}`,
        title: finalTitle,
        gymType: routineGymType,
        startedAt: iso,
        updatedAt: new Date().toISOString(),
        isComplete: true,
        verifiedByUser: true,
        slots: normalizedSlots
      };
      setHistory(prev => [entry, ...prev]);
      setHistoricalDraft(null);
      setCurrentView('history');
      return;
    }

    const entry = {
      ...currentWorkout,
      title: finalTitle,
      gymType: routineGymType,
      updatedAt: new Date().toISOString(),
      isComplete: checkIsWorkoutComplete(normalizedSlots),
      verifiedByUser: true,
      slots: normalizedSlots
    };
    setHistory(prev => {
      const exists = prev.some(w => w.id === entry.id);
      return exists ? prev.map(w => (w.id === entry.id ? entry : w)) : [entry, ...prev];
    });
    setActiveSession(null);
    setCurrentView('home');
  };

  const handleShareCurrentEditor = () => {
    const currentWorkout = getCurrentEditorWorkout();
    if (!currentWorkout || !currentWorkout.slots || currentWorkout.slots.length === 0) return;
    const normalizedSlots = normalizeSlotLabels(cloneSlots(currentWorkout.slots));
    const routineGymType = inferRoutineGymCategory(normalizedSlots);
    const sharedItem = {
      key: `shared_${currentWorkout.id || currentWorkout.key || Date.now()}`,
      label: currentWorkout.title || 'Shared Routine',
      author: user?.username || 'test_lifter',
      gymType: routineGymType,
      slots: normalizedSlots
    };
    setSharedRoutines(prev => {
      const exists = prev.some(r => r.label === sharedItem.label);
      return exists ? prev.map(r => (r.label === sharedItem.label ? sharedItem : r)) : [sharedItem, ...prev];
    });
    setIsCurrentEditorShared(true);
  };

  const handleResetCurrentEditor = () => {
    updateCurrentWorkoutState(prev => ({
      ...prev,
      loadedRoutineTitle: 'MANUAL',
      slots: []
    }));
  };

  const handleConfirmDeleteAction = () => {
    if (!deleteConfirmTarget) return;
    // Generic targets (e.g. removing a friend) carry their own confirm action.
    if (typeof deleteConfirmTarget.onConfirm === 'function') {
      deleteConfirmTarget.onConfirm();
      setDeleteConfirmTarget(null);
      return;
    }
    if (deleteConfirmTarget.type === 'history_workout') {
      const targetWorkoutId = deleteConfirmTarget.workoutId;
      const deletedWorkout = (history || []).find(w => w.id === targetWorkoutId);
      const nextHistory = (history || []).filter(w => w.id !== targetWorkoutId);
      setHistory(nextHistory);

      // Delete it on the server too; until that succeeds the id stays queued (retried on each sync)
      // so pulls don't bring the workout back.
      if (user && targetWorkoutId) {
        markWorkoutIdDeleted(user, targetWorkoutId);
        deleteCloudWorkoutsByIds(user, [targetWorkoutId]).then(result => {
          if (result.ok) clearDeletedWorkoutIds(user, [targetWorkoutId]);
        });
      }

      if (deletedWorkout) {
        const affectedIds = new Set();
        (deletedWorkout.slots || []).forEach(slot => {
          const ids = isSupersetCategory(slot.category)
            ? (slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId]).filter(Boolean)
            : [slot.exerciseId].filter(Boolean);
          ids.forEach(id => affectedIds.add(id));
        });
        if (affectedIds.size > 0) {
          setOneRepMaxes(prev => {
            const copy = { ...(prev || {}) };
            affectedIds.forEach(exId => {
              const deletedBest = getBestHistory1RM(exId, [deletedWorkout]);
              const remainingBest = getBestHistory1RM(exId, nextHistory);
              if (deletedBest > 0 && Number(copy[exId]) === deletedBest) {
                if (remainingBest > 0) {
                  copy[exId] = remainingBest;
                } else {
                  delete copy[exId];
                }
              }
            });
            return copy;
          });
        }
      }

      if (expandedHistoryWorkoutId === targetWorkoutId) {
        setExpandedHistoryWorkoutId(null);
      }
      appendSessionLog?.('DELETE_HISTORY', `Deleted history workout: ${deleteConfirmTarget.label || targetWorkoutId}`);
      setDeleteConfirmTarget(null);
      return;
    }
    if (deleteConfirmTarget.type === 'saved_routine') {
      const { routineKey, routineLabel } = deleteConfirmTarget;
      setSavedRoutines(prev =>
        (prev || []).filter(r => r.key !== routineKey && r.label !== routineLabel)
      );
      if (routineKey) {
        deleteCloudRoutineByKey(user, routineKey);
      }
      appendSessionLog?.('DELETE_SAVED_ROUTINE', `Deleted saved routine: ${routineLabel || routineKey}`);
      setDeleteConfirmTarget(null);
      return;
    }
    if (deleteConfirmTarget.type === 'shared_routine') {
      const { routineKey, routineLabel } = deleteConfirmTarget;
      setSharedRoutines(prev =>
        (prev || []).filter(r => r.key !== routineKey && r.label !== routineLabel)
      );
      if (routineKey) {
        deleteCloudRoutineByKey(user, routineKey);
      }
      appendSessionLog?.('DELETE_SHARED_ROUTINE', `Deleted shared routine: ${routineLabel || routineKey}`);
      setDeleteConfirmTarget(null);
      return;
    }
    if (deleteConfirmTarget.type === 'slot') {
      updateCurrentWorkoutState(prev => ({
        ...prev,
        slots: (prev?.slots || []).filter(s => s.id !== deleteConfirmTarget.slotId)
      }));
    } else if (deleteConfirmTarget.type === 'set') {
      const { slotId, exIdx, setId } = deleteConfirmTarget;
      updateCurrentWorkoutState(prev => {
        if (!prev) return prev;
        const nextSlots = prev.slots.map(slot => {
          if (slot.id !== slotId) return slot;
          if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
            const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
              idx === exIdx
                ? (list || []).filter(st => st.id !== setId).map((st, i) => ({ ...st, setNumber: i + 1 }))
                : list
            );
            return {
              ...slot,
              supersetSetsByExercise: nextMatrix,
              sets: nextMatrix[0] || [],
              secondarySets: nextMatrix[1] || []
            };
          }
          const nextSets = (slot.sets || [])
            .filter(st => st.id !== setId)
            .map((st, i) => ({ ...st, setNumber: i + 1 }));
          return { ...slot, sets: nextSets, supersetSetsByExercise: [nextSets] };
        });
        return { ...prev, slots: nextSlots };
      });
    }
    setDeleteConfirmTarget(null);
  };

  const handleReorderExercises = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    updateCurrentWorkoutState(prev => {
      if (!prev || !Array.isArray(prev.slots)) return prev;
      const copy = [...prev.slots];
      if (fromIndex >= copy.length || toIndex >= copy.length) return prev;
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return { ...prev, slots: copy };
    });
  };

  const handleReorderSets = (slotId, exIdx, fromSetIdx, toSetIdx) => {
    if (fromSetIdx === toSetIdx || fromSetIdx < 0 || toSetIdx < 0) return;
    updateCurrentWorkoutState(prev => {
      if (!prev || !Array.isArray(prev.slots)) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;
        const reorderArray = arr => {
          const copy = [...(arr || [])];
          if (fromSetIdx >= copy.length || toSetIdx >= copy.length) return copy;
          const [moved] = copy.splice(fromSetIdx, 1);
          copy.splice(toSetIdx, 0, moved);
          return copy.map((st, i) => ({ ...st, setNumber: i + 1 }));
        };
        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            idx === exIdx ? reorderArray(list) : list
          );
          return {
            ...slot,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }
        const nextSets = reorderArray(slot.sets || []);
        return { ...slot, sets: nextSets, supersetSetsByExercise: [nextSets] };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  /**
   * Changes the equipment selection and swaps every untouched exercise in the open editor for
   * its closest equivalent with that equipment (e.g. Barbell Bench Press → Dumbbell Bench Press).
   * Slots with any set marked done are left alone. New weights come from the swapped exercise's own
   * history (+ increment), or else a conversion of the old exercise's 1RM (dumbbells ≈ 35% lower).
   */
  const handleChangeGymSelection = nextGymId => {
    setSelectedGymId(nextGymId);
    // Logged/historical workouts keep the exercises that were actually performed.
    if (currentView === 'historical_entry' || (currentView === 'history' && expandedHistoryWorkoutId)) return;
    const editorWorkout = getCurrentEditorWorkout();
    if (!editorWorkout?.slots?.length) return;

    const slotHasDoneSet = slot =>
      [slot.sets, slot.secondarySets, ...(slot.supersetSetsByExercise || [])].some(
        list => Array.isArray(list) && list.some(st => st?.completed)
      );

    let swappedCount = 0;
    const swapSlot = slot => {
      if (!slot || slotHasDoneSet(slot)) return slot;
      const isSuperset = isSupersetCategory(slot.category);
      const oldIds = isSuperset
        ? (slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId]).filter(Boolean).slice(0, 2)
        : [slot.exerciseId].filter(Boolean);
      // Superset partners must stay distinct, so the second pick excludes the first.
      const newIds = [];
      oldIds.forEach(id => {
        newIds.push(findEquivalentExerciseForGym(id, nextGymId, gyms, newIds) || id);
      });
      if (newIds.every((id, i) => id === oldIds[i])) return slot;

      // Old exercise's 1RM: logged history first, then the estimate saved by a previous swap
      // (so swapping back and forth doesn't drift), then the library default.
      const getOld1RM = id =>
        getBestHistory1RM(id, history) > 0
          ? getHistoricalCalculated1RM(id, history, oneRepMaxes)
          : Number(slot.estimated1RMs?.[id]) || getHistoricalCalculated1RM(id, history, oneRepMaxes);
      const base1RMOverrides = {};
      newIds.forEach((id, i) => {
        if (id !== oldIds[i]) {
          base1RMOverrides[id] = convertEquivalent1RM(oldIds[i], id, getOld1RM(oldIds[i]));
        }
      });
      swappedCount += newIds.filter((id, i) => id !== oldIds[i]).length;

      const rebuilt = createWorkoutSlot({
        category: slot.category,
        slotLabel: slot.slotLabel,
        exerciseId: newIds[0],
        supersetExerciseIds: isSuperset ? newIds : [newIds[0]],
        scheme: slot.scheme,
        supersetSchemes: isSuperset ? getSupersetSchemes(slot) : null,
        oneRepMaxes,
        history,
        incrementLbs: currentIncrementLbs,
        restSeconds: slot.restSeconds || 90,
        userBodyweightLbs,
        base1RMOverrides
      });
      return {
        ...rebuilt,
        id: slot.id,
        estimated1RMs: { ...(slot.estimated1RMs || {}), ...base1RMOverrides },
        familyMuscleGroup: EXERCISE_MAP[newIds[0]]?.muscleGroup || slot.familyMuscleGroup,
        muscleGroupFilter: EXERCISE_MAP[newIds[0]]?.muscleGroup || slot.muscleGroupFilter
      };
    };

    const nextSlots = editorWorkout.slots.map(swapSlot);
    if (swappedCount === 0) return;
    updateCurrentWorkoutState(prev => (prev ? { ...prev, slots: prev.slots.map(swapSlot) } : prev));
    appendSessionLog?.(
      'GYM_SWAP',
      `Swapped ${swappedCount} exercise(s) for gym selection "${nextGymId || 'full_gym'}": ${nextSlots
        .map(s => s.exerciseId)
        .join(', ')}`
    );
  };

  // A superset is two full exercise pickers. Each half (0 = A, 1 = B) has its own type (Compound /
  // Accessory), muscle group, exercise and scheme; changing one half rebuilds only that half's sets.
  const supersetHalfState = slot => {
    const ids = [
      slot.supersetExerciseIds?.[0] || slot.exerciseId || 'reverse_lunge',
      slot.supersetExerciseIds?.[1] || slot.secondaryExerciseId || 'front_flies'
    ];
    const cats = ids.map((id, i) => {
      const cat = normalizeSlotCategory(slot.supersetCategories?.[i] || EXERCISE_MAP[id]?.category || 'Accessory');
      return isSupersetCategory(cat) ? 'Accessory' : cat;
    });
    const muscles = ids.map(
      (id, i) => slot.supersetMuscleFilters?.[i] || EXERCISE_MAP[id]?.muscleGroup || 'All Muscles'
    );
    const matrix = [
      slot.supersetSetsByExercise?.[0] || slot.sets || [],
      slot.supersetSetsByExercise?.[1] || slot.secondarySets || []
    ];
    return { ids, cats, muscles, schemes: getSupersetSchemes(slot), matrix };
  };

  const applySupersetHalfChange = (slot, changes) => {
    const half = changes.supersetHalf === 1 ? 1 : 0;
    const { ids, cats, muscles, schemes, matrix } = supersetHalfState(slot);
    let rebuildHalf = false;

    if (changes.category) {
      const cat = normalizeSlotCategory(changes.category);
      cats[half] = isSupersetCategory(cat) ? cats[half] : cat;
    }
    if (changes.muscleGroupFilter !== undefined) muscles[half] = changes.muscleGroupFilter;
    const equipmentFilters = [slot.supersetEquipmentFilters?.[0], slot.supersetEquipmentFilters?.[1]];
    if (changes.equipmentFilter !== undefined) equipmentFilters[half] = changes.equipmentFilter;
    if (changes.scheme && changes.scheme !== schemes[half]) {
      schemes[half] = changes.scheme;
      rebuildHalf = true;
    }
    if (changes.exerciseId && changes.exerciseId !== ids[half]) {
      ids[half] = changes.exerciseId;
      rebuildHalf = true;
      if (changes.muscleGroupFilter === undefined) {
        muscles[half] = EXERCISE_MAP[changes.exerciseId]?.muscleGroup || muscles[half];
      }
    }

    // Filters cover the whole library; only the default exercise picked below prefers the athlete's equipment
    const availMuscles = getAvailableMuscleGroupsForCategory(cats[half], '', []);
    if (!availMuscles.includes(muscles[half])) muscles[half] = 'All Muscles';

    if (!changes.exerciseId && (changes.category || changes.muscleGroupFilter !== undefined)) {
      const pool = preferAvailable(
        getFilteredExercisesForSlotInline({ category: cats[half], muscleGroupFilter: muscles[half] }, '', [])
      ).filter(ex => ex.id !== ids[1 - half]);
      if (pool.length > 0 && !pool.some(ex => ex.id === ids[half])) {
        ids[half] = pool[0].id;
        rebuildHalf = true;
      }
    }

    if (rebuildHalf) {
      matrix[half] = generateSetsForScheme(
        schemes[half],
        getHistoricalCalculated1RM(ids[half], history, oneRepMaxes),
        'Superset',
        ids[half],
        currentIncrementLbs,
        userBodyweightLbs
      );
    }

    return {
      ...slot,
      category: 'Superset',
      exerciseId: ids[0],
      secondaryExerciseId: ids[1],
      supersetExerciseIds: ids,
      supersetCategories: cats,
      supersetMuscleFilters: muscles,
      supersetSchemes: schemes,
      supersetEquipmentFilters: equipmentFilters,
      scheme: schemes[0],
      muscleGroupFilter: muscles[0],
      supersetSetsByExercise: matrix,
      sets: matrix[0],
      secondarySets: matrix[1]
    };
  };

  // "Remove from superset" on half `removedHalf`: the slot becomes the other exercise on its own, sets kept
  const endSuperset = (slot, removedHalf) => {
    const keep = removedHalf === 1 ? 0 : 1;
    const { ids, cats, muscles, schemes, matrix } = supersetHalfState(slot);
    const rebuilt = createWorkoutSlot({
      category: cats[keep],
      slotLabel: cats[keep],
      exerciseId: ids[keep],
      scheme: schemes[keep],
      oneRepMaxes,
      history,
      incrementLbs: currentIncrementLbs,
      restSeconds: slot.restSeconds || 90,
      userBodyweightLbs
    });
    const keptSets = (matrix[keep] || []).map((st, i) => ({ ...st, setNumber: i + 1 }));
    const sets = keptSets.length > 0 ? keptSets : rebuilt.sets;
    return {
      ...rebuilt,
      id: slot.id,
      familyMuscleGroup: slot.familyMuscleGroup,
      muscleGroupFilter: muscles[keep],
      equipmentFilter: slot.supersetEquipmentFilters?.[keep],
      sets,
      supersetSetsByExercise: [sets]
    };
  };

  const handleUpdateSlotCategoryOrExercise = (slotId, changes) => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;
        if (isSupersetCategory(slot.category) && changes.endSuperset !== undefined) {
          return endSuperset(slot, changes.endSuperset);
        }
        if (isSupersetCategory(slot.category) && changes.supersetHalf !== undefined) {
          return applySupersetHalfChange(slot, changes);
        }
        // Equipment filter only (the exercise already allows it): nothing to rebuild
        if (Object.keys(changes).every(key => key === 'equipmentFilter')) {
          return { ...slot, equipmentFilter: changes.equipmentFilter };
        }
        const currentEx = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
        const targetMuscleGroup =
          changes.exerciseId && EXERCISE_MAP[changes.exerciseId]
            ? EXERCISE_MAP[changes.exerciseId].muscleGroup
            : slot.familyMuscleGroup || currentEx.muscleGroup || 'Chest';

        let nextCategory = normalizeSlotCategory(changes.category ?? slot.category);
        // Filters cover the whole library; only default exercise picks prefer the athlete's equipment
        const availMuscleGroups = getAvailableMuscleGroupsForCategory(nextCategory, '', []);
        let rawNextMuscleFilter;
        if (changes.muscleGroupFilter !== undefined) {
          rawNextMuscleFilter = changes.muscleGroupFilter;
        } else if (changes.exerciseId && EXERCISE_MAP[changes.exerciseId]?.muscleGroup) {
          rawNextMuscleFilter = EXERCISE_MAP[changes.exerciseId].muscleGroup;
        } else if (changes.category) {
          const prevMg = slot.muscleGroupFilter || currentEx.muscleGroup || 'All Muscles';
          const hasInNewCat =
            prevMg === 'All Muscles' ||
            isSupersetCategory(nextCategory) ||
            EXERCISE_LIBRARY.some(e => e.category === nextCategory && e.muscleGroup === prevMg);
          rawNextMuscleFilter = hasInNewCat ? prevMg : 'All Muscles';
        } else {
          rawNextMuscleFilter = slot.muscleGroupFilter || currentEx.muscleGroup || 'All Muscles';
        }
        let nextMuscleFilter = availMuscleGroups.includes(rawNextMuscleFilter)
          ? rawNextMuscleFilter
          : 'All Muscles';
        const nextScheme = changes.scheme ?? slot.scheme;
        let nextExId = changes.exerciseId ?? slot.exerciseId;
        let nextSupersetIds =
          changes.supersetExerciseIds ??
          slot.supersetExerciseIds ??
          [nextExId, slot.secondaryExerciseId].filter(Boolean);

        const candidatePool = preferAvailable(
          getFilteredExercisesForSlotInline({ ...slot, category: nextCategory, muscleGroupFilter: nextMuscleFilter }, '', [])
        );

        if (
          isSupersetCategory(slot.category) &&
          isSupersetCategory(nextCategory) &&
          changes.supersetExerciseIds &&
          !changes.scheme &&
          !changes.category &&
          changes.muscleGroupFilter === undefined
        ) {
          const cleanIds = [
            changes.supersetExerciseIds[0] || slot.exerciseId || 'reverse_lunge',
            changes.supersetExerciseIds[1] || slot.secondaryExerciseId || 'front_flies'
          ];
          const prevMatrix = slot.supersetSetsByExercise || [slot.sets || [], slot.secondarySets || []];
          const updatedMatrix = cleanIds.map((id, idx) => {
            const existingList =
              Array.isArray(prevMatrix[idx]) && prevMatrix[idx].length > 0
                ? prevMatrix[idx]
                : prevMatrix[0] || [];
            const isBw = isBodyweightExercise(id);
            const bwDefault = Math.max(0, Number(userBodyweightLbs) || 220);
            const calcMax = getHistoricalCalculated1RM(id, history, oneRepMaxes);
            const effInc = isBw ? 0 : getEffectiveIncrementForExercise(id, currentIncrementLbs);
            const totalCount = existingList.length || 5;
            return existingList.map((st, sIdx) => {
              const lastW = isBw
                ? bwDefault
                : calculateLastEquivalentWeightForSet(calcMax, st, totalCount, 'Superset', sIdx, slot.scheme);
              const nextW = isBw
                ? bwDefault
                : st.type === '1 Rep Max'
                  ? roundTo5(calcMax)
                  : roundToIncrement(lastW + effInc);
              return { ...st, setNumber: sIdx + 1, lastWeight: lastW, increment: isBw || st.type === '1 Rep Max' ? 0 : effInc, weight: nextW };
            });
          });

          return {
            ...slot,
            category: 'Superset',
            muscleGroupFilter: nextMuscleFilter,
            exerciseId: cleanIds[0],
            secondaryExerciseId: cleanIds[1],
            supersetExerciseIds: cleanIds,
            supersetSetsByExercise: updatedMatrix,
            sets: updatedMatrix[0] || [],
            secondarySets: updatedMatrix[1] || []
          };
        }

        if ((changes.category || changes.muscleGroupFilter !== undefined) && !changes.exerciseId) {
          if (isSupersetCategory(nextCategory)) {
            const exA = candidatePool.some(e => e.id === nextSupersetIds[0])
              ? nextSupersetIds[0]
              : (candidatePool[0] || currentEx).id;
            const exB = candidatePool.some(e => e.id === nextSupersetIds[1] && e.id !== exA)
              ? nextSupersetIds[1]
              : (candidatePool.find(e => e.id !== exA) || candidatePool[0] || EXERCISE_MAP.front_flies).id;
            nextExId = exA;
            nextSupersetIds = [exA, exB];
          } else {
            if (!candidatePool.some(e => e.id === nextExId)) {
              nextExId = (candidatePool[0] || currentEx).id;
            }
            if (
              changes.muscleGroupFilter !== undefined &&
              !changes.category &&
              EXERCISE_MAP[nextExId]?.category &&
              EXERCISE_MAP[nextExId].category !== nextCategory
            ) {
              nextCategory = normalizeSlotCategory(EXERCISE_MAP[nextExId].category);
            }
            if (changes.category && nextMuscleFilter === 'All Muscles' && EXERCISE_MAP[nextExId]?.muscleGroup) {
              nextMuscleFilter = EXERCISE_MAP[nextExId].muscleGroup;
            }
          }
        }

        const rebuiltSlot = createWorkoutSlot({
          category: nextCategory,
          slotLabel: nextCategory,
          exerciseId: nextExId,
          supersetExerciseIds: isSupersetCategory(nextCategory) ? nextSupersetIds.slice(0, 2) : [nextExId],
          scheme: nextScheme,
          oneRepMaxes,
          history,
          incrementLbs: currentIncrementLbs,
          restSeconds: slot.restSeconds || 90,
          userBodyweightLbs
        });

        return {
          ...rebuiltSlot,
          id: slot.id,
          familyMuscleGroup: targetMuscleGroup,
          muscleGroupFilter: nextMuscleFilter,
          equipmentFilter: changes.equipmentFilter ?? slot.equipmentFilter
        };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  const handleUpdateSetField = (slotId, exIndex, setId, field, rawVal) => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;

        const applyFieldChange = (st, exId, totalCount, sIdx, listScheme = slot.scheme) => {
          if (st.id !== setId) return st;
          // Band exercises: the load is a band colour, not a weight
          if (field === 'bandColor') return { ...st, bandColor: rawVal };
          const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
          const lastW =
            st.lastWeight !== undefined
              ? st.lastWeight
              : calculateLastEquivalentWeightForSet(calc1RM, st, totalCount, slot.category, sIdx, listScheme);

          if (field === 'increment') {
            const rawStr = String(rawVal ?? '');
            const cleanStr = rawStr.replace(/^\+/, '');
            if (cleanStr === '' || cleanStr === '-' || cleanStr === '.' || cleanStr === '-.') {
              return { ...st, increment: cleanStr, weight: Math.max(0, roundToIncrement(lastW)), lastEditedField: 'weight' };
            }
            const incNum = Number(cleanStr);
            const safeInc = Number.isNaN(incNum) ? 0 : incNum;
            const nextWeight = Math.max(0, roundToIncrement(lastW + safeInc));
            return {
              ...st,
              increment: cleanStr.endsWith('.') ? cleanStr : safeInc,
              weight: nextWeight,
              lastEditedField: 'weight'
            };
          }

          if (field === 'timer') {
            const sec = parseTimerDurationSeconds(rawVal);
            const mmss = formatSecondsToMMSS(sec, true);
            return {
              ...st,
              reps: sec,
              durationSeconds: sec,
              timerStr: mmss,
              lastEditedField: 'timer'
            };
          }

          const val = Math.max(0, Number(rawVal) || 0);
          if (field === 'weight') {
            const nextInc = Math.round((val - lastW) * 100) / 100;
            return { ...st, weight: val, increment: nextInc, lastEditedField: 'weight' };
          }

          if (field === 'reps') {
            return { ...st, reps: Math.max(1, val), lastEditedField: 'reps' };
          }

          return { ...st, [field]: val };
        };

        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
          const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            idx === exIndex
              ? list.map((st, sIdx) =>
                  applyFieldChange(st, supIds[idx] || slot.exerciseId, list.length, sIdx, getSupersetSchemes(slot)[idx])
                )
              : list
          );
          return {
            ...slot,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }
        const totalLen = (slot.sets || []).length;
        const nextSets = (slot.sets || []).map((st, sIdx) => applyFieldChange(st, slot.exerciseId, totalLen, sIdx));
        return { ...slot, sets: nextSets };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  const handleUpdateSetType = (slotId, exIndex, setId, newType) => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;

        const updateSingleSet = (st, exId, totalCount, sIdx, listScheme = slot.scheme) => {
          if (st.id !== setId) return st;
          const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
          const effInc = getEffectiveIncrementForExercise(exId, currentIncrementLbs);
          if (newType === '1 Rep Max') {
            const isLastSet = sIdx === totalCount - 1;
            const maxW = roundTo5(calc1RM);
            const incFor1RM = isLastSet ? effInc : 0;
            return {
              ...st,
              type: newType,
              reps: 1,
              lastWeight: maxW,
              increment: incFor1RM,
              weight: roundToIncrement(maxW + incFor1RM),
              lastEditedField: 'type'
            };
          }
          const updatedSet = { ...st, type: newType, lastEditedField: 'type' };
          const lastW = calculateLastEquivalentWeightForSet(calc1RM, updatedSet, totalCount, slot.category, sIdx, listScheme);
          const setInc =
            st.increment !== undefined && st.increment !== '' && !Number.isNaN(Number(st.increment))
              ? Number(st.increment)
              : effInc;
          return {
            ...updatedSet,
            lastWeight: lastW,
            increment: setInc,
            weight: Math.max(0, roundToIncrement(lastW + setInc))
          };
        };

        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
          const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            idx === exIndex
              ? list.map((st, sIdx) =>
                  updateSingleSet(st, supIds[idx] || slot.exerciseId, list.length, sIdx, getSupersetSchemes(slot)[idx])
                )
              : list
          );
          return {
            ...slot,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }
        const totalLen = (slot.sets || []).length;
        const nextSets = (slot.sets || []).map((st, sIdx) => updateSingleSet(st, slot.exerciseId, totalLen, sIdx));
        return { ...slot, sets: nextSets };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  const handleInsertSetAtPosition = (slotId, position = 'bottom') => {
    const isTop = position === 'top';
    const defaultSetType = isTop ? 'Warmup' : 'Burn Out';
    const ts = Date.now() + Math.floor(Math.random() * 10000);

    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;

        const insertIntoList = (list, exId, listScheme = slot.scheme) => {
          const currentList = Array.isArray(list) ? list : [];
          const refSet = isTop ? currentList[0] : currentList[currentList.length - 1];
          const base1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
          const effInc = getEffectiveIncrementForExercise(exId, currentIncrementLbs);
          const nextCount = currentList.length + 1;
          const isTimerScheme = listScheme === 'Timer';
          const newReps = isTimerScheme
            ? refSet?.durationSeconds || 120
            : refSet
              ? refSet.reps
              : slot.category === 'Abs'
                ? 45
                : 8;
          const draftSet = {
            id: `set_${ts}_${Math.random().toString(36).slice(2, 6)}`,
            setNumber: 1,
            type: defaultSetType,
            reps: newReps,
            ...(isTimerScheme
              ? {
                  durationSeconds: newReps,
                  timerStr: formatSecondsToMMSS(newReps, true)
                }
              : {}),
            completed: false
          };
          const isBw = isBodyweightExercise(exId);
          const bwDefault = Math.max(0, Number(userBodyweightLbs) || 220);
          const lastW =
            slot.category === 'Abs'
              ? 0
              : isBw
                ? bwDefault
                : calculateLastEquivalentWeightForSet(base1RM, draftSet, nextCount, slot.category, 0, listScheme);
          const newSet = {
            ...draftSet,
            lastWeight: lastW,
            increment: slot.category === 'Abs' || isTimerScheme || isBw ? 0 : effInc,
            weight: slot.category === 'Abs' ? 0 : isTimerScheme || isBw ? lastW : roundToIncrement(lastW + effInc)
          };
          const combined = isTop ? [newSet, ...currentList] : [...currentList, newSet];
          return combined.map((st, idx) => ({ ...st, setNumber: idx + 1 }));
        };

        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
          const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            insertIntoList(list, supIds[idx] || slot.exerciseId, getSupersetSchemes(slot)[idx])
          );
          return {
            ...slot,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }

        const nextSets = insertIntoList(slot.sets || [], slot.exerciseId);
        return { ...slot, sets: nextSets, supersetSetsByExercise: [nextSets] };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  const handleRecalculateSlotWeights = slotId => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;

        const baseSchemes = isSupersetCategory(slot.category) ? getSupersetSchemes(slot) : [slot.scheme];
        const nextSchemes = [...baseSchemes];

        const recalcList = (list, exId, half = 0) => {
          const listScheme = baseSchemes[half];
          const currentList = Array.isArray(list) ? list : [];
          const totalCount = currentList.length;
          if (totalCount === 0) return [];
          const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
          const effInc = getEffectiveIncrementForExercise(exId, currentIncrementLbs);

          if (slot.category === 'Abs') {
            return currentList.map((st, idx) =>
              st.completed
                ? { ...st, setNumber: idx + 1 }
                : {
                    ...st,
                    setNumber: idx + 1,
                    lastWeight: 0,
                    increment: 0,
                    weight: 0,
                    lastEditedField: undefined
                  }
            );
          }

          const standardPyramidReps = [8, 5, 3, 2, 1];
          const warmupCount = Math.max(1, totalCount - 1);
          const getPyramidWarmupReps = setIdx => {
            if (totalCount === 5) return standardPyramidReps[setIdx] || 2;
            if (warmupCount <= 1) return 5;
            return Math.max(2, Math.round(8 - (setIdx / (warmupCount - 1)) * 6));
          };

          const lastSet = currentList[totalCount - 1];
          const isLastSet1RM = lastSet?.type === '1 Rep Max';
          const lastSetWasEdited = Boolean(lastSet?.lastEditedField);

          // Case A: Last set is '1 Rep Max' (either via 'Pyramid 1RM' or user changing the last set to '1 Rep Max')
          if (isLastSet1RM) {
            if (listScheme === 'Pyramid') {
              nextSchemes[half] = 'Pyramid 1RM';
            }
            const rampBase1RM =
              lastSet?.lastEditedField === 'weight'
                ? Math.max(5, (Number(lastSet.weight) || calc1RM) - effInc)
                : calc1RM;
            const maxW = roundTo5(calc1RM);

            return currentList.map((st, idx) => {
              // Ignore sets already marked done
              if (st.completed) {
                return { ...st, setNumber: idx + 1 };
              }

              // Last set: 1 Rep Max
              if (idx === totalCount - 1) {
                if (st.lastEditedField === 'weight') {
                  const chosenW = Math.max(0, Number(st.weight) || roundToIncrement(maxW + effInc));
                  const nextInc = Math.round((chosenW - maxW) * 100) / 100;
                  return {
                    ...st,
                    setNumber: idx + 1,
                    type: '1 Rep Max',
                    reps: 1,
                    lastWeight: maxW,
                    increment: nextInc,
                    weight: chosenW,
                    lastEditedField: undefined
                  };
                }
                return {
                  ...st,
                  setNumber: idx + 1,
                  type: '1 Rep Max',
                  reps: 1,
                  lastWeight: maxW,
                  increment: effInc,
                  weight: roundToIncrement(maxW + effInc),
                  lastEditedField: undefined
                };
              }

              // Preceding sets: if individually edited by weight or reps, honor that; otherwise adjust both weight & reps to match Pyramid 1RM
              if (st.lastEditedField === 'weight') {
                const chosenWeight = Math.max(0, Number(st.weight) || 0);
                const newReps = calculateEquivalentRepsForWeight(
                  rampBase1RM,
                  chosenWeight,
                  { ...st, type: 'Warmup' },
                  totalCount,
                  slot.category,
                  0
                );
                return {
                  ...st,
                  setNumber: idx + 1,
                  type: 'Warmup',
                  reps: newReps,
                  lastWeight: chosenWeight,
                  increment: 0,
                  weight: chosenWeight,
                  lastEditedField: undefined
                };
              }

              if (st.lastEditedField === 'reps') {
                const customReps = Math.max(1, Number(st.reps) || getPyramidWarmupReps(idx));
                const customW = calculateLastEquivalentWeightForSet(
                  rampBase1RM,
                  { ...st, type: 'Warmup', reps: customReps, lastEditedField: 'reps' },
                  totalCount,
                  slot.category,
                  idx,
                  'Pyramid 1RM'
                );
                return {
                  ...st,
                  setNumber: idx + 1,
                  type: 'Warmup',
                  reps: customReps,
                  lastWeight: customW,
                  increment: 0,
                  weight: customW,
                  lastEditedField: undefined
                };
              }

              const warmupReps = getPyramidWarmupReps(idx);
              const warmupW = calculateLastEquivalentWeightForSet(
                rampBase1RM,
                { reps: warmupReps, type: 'Warmup' },
                totalCount,
                slot.category,
                idx,
                'Pyramid 1RM'
              );
              return {
                ...st,
                setNumber: idx + 1,
                type: 'Warmup',
                reps: warmupReps,
                lastWeight: warmupW,
                increment: 0,
                weight: warmupW,
                lastEditedField: undefined
              };
            });
          }

          // Case B: Last set was edited (weight, increment, reps, or type) and is not '1 Rep Max'
          // Adjust both weight and reps across incomplete preceding sets to make that last set possible
          if (lastSetWasEdited && totalCount > 1) {
            if (listScheme === 'Pyramid 1RM' && lastSet.type === 'Top Out') {
              nextSchemes[half] = 'Pyramid';
            }
            const effectiveScheme = nextSchemes[half] === 'Pyramid 1RM' ? 'Pyramid' : nextSchemes[half];

            let finalLastReps = Math.max(1, Number(lastSet.reps) || 1);
            let finalLastWeight = Math.max(0, Number(lastSet.weight) || 0);
            let finalLastBaseW = 0;
            let finalLastInc = effInc;

            if (lastSet.lastEditedField === 'weight') {
              finalLastReps = calculateEquivalentRepsForWeight(
                calc1RM,
                finalLastWeight,
                lastSet,
                totalCount,
                slot.category,
                effInc
              );
              finalLastBaseW = calculateLastEquivalentWeightForSet(
                calc1RM,
                { ...lastSet, reps: finalLastReps, lastEditedField: 'reps' },
                totalCount,
                slot.category,
                totalCount - 1,
                effectiveScheme
              );
              finalLastInc = Math.round((finalLastWeight - finalLastBaseW) * 100) / 100;
            } else {
              if (lastSet.lastEditedField === 'type' && lastSet.type === 'Top Out') {
                finalLastReps = 1;
              }
              finalLastBaseW = calculateLastEquivalentWeightForSet(
                calc1RM,
                { ...lastSet, reps: finalLastReps, lastEditedField: 'reps' },
                totalCount,
                slot.category,
                totalCount - 1,
                effectiveScheme
              );
              finalLastInc = effInc;
              finalLastWeight = Math.max(0, roundToIncrement(finalLastBaseW + finalLastInc));
            }

            const startReps = Math.max(finalLastReps, Number(currentList[0]?.reps) || 8, 8);

            return currentList.map((st, idx) => {
              // Ignore sets already marked done
              if (st.completed) {
                return { ...st, setNumber: idx + 1 };
              }

              if (idx === totalCount - 1) {
                return {
                  ...st,
                  setNumber: idx + 1,
                  reps: finalLastReps,
                  lastWeight: finalLastBaseW,
                  increment: finalLastInc,
                  weight: finalLastWeight,
                  lastEditedField: undefined
                };
              }

              // If an earlier set was also individually edited, honor its edit
              if (st.lastEditedField === 'weight') {
                const chosenW = Math.max(0, Number(st.weight) || 0);
                const newReps = calculateEquivalentRepsForWeight(
                  calc1RM,
                  chosenW,
                  st,
                  totalCount,
                  slot.category,
                  effInc
                );
                const newLastW = calculateLastEquivalentWeightForSet(
                  calc1RM,
                  { ...st, reps: newReps, lastEditedField: 'reps' },
                  totalCount,
                  slot.category,
                  idx,
                  effectiveScheme
                );
                return {
                  ...st,
                  setNumber: idx + 1,
                  reps: newReps,
                  lastWeight: newLastW,
                  increment: Math.round((chosenW - newLastW) * 100) / 100,
                  weight: chosenW,
                  lastEditedField: undefined
                };
              }

              // Adjust both reps and weight on preceding sets to ramp toward the edited last set
              const targetReps =
                finalLastReps <= 1 || lastSet.type === 'Top Out'
                  ? getPyramidWarmupReps(idx)
                  : Math.max(
                      1,
                      Math.round(startReps + ((finalLastReps - startReps) * idx) / (totalCount - 1))
                    );
              const nextType =
                finalLastReps <= 1 || lastSet.type === 'Top Out'
                  ? idx === 0
                    ? 'Warmup'
                    : 'Working'
                  : st.type;
              const lastW = calculateLastEquivalentWeightForSet(
                calc1RM,
                { ...st, type: nextType, reps: targetReps, lastEditedField: 'reps' },
                totalCount,
                slot.category,
                idx,
                effectiveScheme
              );
              const targetW = Math.max(0, roundToIncrement(lastW + effInc));
              return {
                ...st,
                setNumber: idx + 1,
                type: nextType,
                reps: targetReps,
                lastWeight: lastW,
                increment: effInc,
                weight: targetW,
                lastEditedField: undefined
              };
            });
          }

          // Case C: Standard per-set recalculation (last set was not edited)
          return currentList.map((st, idx) => {
            // Ignore sets already marked done
            if (st.completed) {
              return { ...st, setNumber: idx + 1 };
            }

            const isPyramid1RMWarmup =
              listScheme === 'Pyramid 1RM' &&
              st.type === 'Warmup' &&
              idx < totalCount - 1;
            const isPyramid1RMTopSet =
              listScheme === 'Pyramid 1RM' &&
              st.type === '1 Rep Max' &&
              idx === totalCount - 1;

            const defaultInc =
              isPyramid1RMWarmup
                ? 0
                : st.type === '1 Rep Max' && !isPyramid1RMTopSet
                  ? 0
                  : effInc;

            // Priority 1: If the user most recently edited WEIGHT (or increment), adjust REPS to match the selected weight
            if (st.lastEditedField === 'weight' && st.type !== '1 Rep Max') {
              const chosenWeight = Math.max(0, Number(st.weight) || 0);
              const newReps = calculateEquivalentRepsForWeight(
                calc1RM,
                chosenWeight,
                st,
                totalCount,
                slot.category,
                defaultInc
              );
              const newLastW = calculateLastEquivalentWeightForSet(
                calc1RM,
                { ...st, reps: newReps, lastEditedField: 'reps' },
                totalCount,
                slot.category,
                idx,
                listScheme
              );
              const nextInc = Math.round((chosenWeight - newLastW) * 100) / 100;
              return {
                ...st,
                setNumber: idx + 1,
                reps: newReps,
                lastWeight: newLastW,
                increment: nextInc,
                weight: chosenWeight,
                lastEditedField: undefined
              };
            }

            // Priority 2: Otherwise adjust WEIGHT to match reps (identical to generateSetsForScheme)
            if (st.type === '1 Rep Max') {
              const maxW = roundTo5(calc1RM);
              const incFor1RM = isPyramid1RMTopSet || idx === totalCount - 1 ? effInc : 0;
              return {
                ...st,
                setNumber: idx + 1,
                reps: 1,
                lastWeight: maxW,
                increment: incFor1RM,
                weight: roundToIncrement(maxW + incFor1RM),
                lastEditedField: undefined
              };
            }

            const lastW = calculateLastEquivalentWeightForSet(
              calc1RM,
              st,
              totalCount,
              slot.category,
              idx,
              listScheme
            );
            const targetW = Math.max(0, roundToIncrement(lastW + defaultInc));
            return {
              ...st,
              setNumber: idx + 1,
              lastWeight: lastW,
              increment: defaultInc,
              weight: targetW,
              lastEditedField: undefined
            };
          });
        };

        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
          const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            recalcList(list, supIds[idx] || slot.exerciseId, idx)
          );
          return {
            ...slot,
            scheme: nextSchemes[0],
            supersetSchemes: [nextSchemes[0], nextSchemes[1] || nextSchemes[0]],
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }

        const nextSets = recalcList(slot.sets || [], slot.exerciseId);
        return { ...slot, scheme: nextSchemes[0], sets: nextSets, supersetSetsByExercise: [nextSets] };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  const isRoutineEditorView =
    currentView === 'session' ||
    currentView === 'historical_entry' ||
    currentView === 'routine_editor' ||
    currentView === 'routine_preview';

  const currentEditorWorkout = getCurrentEditorWorkout();

  const handleToggleSetDone = (slot, exIndex, setItem) => {
    const markingDone = !setItem.completed;
    if (markingDone && isRoutineEditorView) {
      setTimerTrigger({
        isRunning: true,
        targetSeconds: slot.restSeconds || currentEditorWorkout?.defaultRestSeconds || 90,
        startedAtMs: Date.now()
      });
    }
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(s => {
        if (s.id !== slot.id) return s;
        if (isSupersetCategory(s.category) && Array.isArray(s.supersetSetsByExercise)) {
          const nextMatrix = s.supersetSetsByExercise.map((list, idx) =>
            idx === exIndex
              ? list.map(st => (st.id === setItem.id ? { ...st, completed: markingDone } : st))
              : list
          );
          return {
            ...s,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }
        return {
          ...s,
          sets: (s.sets || []).map(st => (st.id === setItem.id ? { ...st, completed: markingDone } : st))
        };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  return {
    isRoutineEditorView,
    currentEditorWorkout,
    updateCurrentWorkoutState,
    handleConfirmHistoricalEdit,
    handleOpenNewSession,
    handleOpenNewAutoSession,
    handleDirectLoadRoutine,
    handleOpenPreviewRoutine,
    handleCancelRoutineSelection,
    handleApplyPreviewRoutine,
    handleAutoBuildWorkout,
    handleAddAutoSlot,
    handleSaveCurrentEditor,
    handleConfirmSaveWorkout,
    handleShareCurrentEditor,
    handleResetCurrentEditor,
    handleConfirmDeleteAction,
    handleReorderExercises,
    handleReorderSets,
    handleUpdateSlotCategoryOrExercise,
    handleUpdateSetField,
    handleUpdateSetType,
    handleInsertSetAtPosition,
    handleRecalculateSlotWeights,
    handleToggleSetDone,
    handleChangeGymSelection
  };
}

