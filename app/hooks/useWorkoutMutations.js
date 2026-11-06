'use client';

import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  normalizeSlotCategory,
  isSupersetCategory,
  getDefaultSessionName,
  getDefaultAutoSessionName,
  formatTitleWithDate,
  parseYMDToISO,
  isExerciseCompatibleWithGymSelection,
  filterAddSlotExercises,
  getFilteredExercisesForSlotInline,
  getAvailableMuscleGroupsForCategory,
  roundTo5,
  roundToIncrement
} from '../data/exerciseLibrary';
import {
  getBestHistory1RM,
  getHistoricalCalculated1RM,
  calculateLastEquivalentWeightForSet,
  calculateEquivalentRepsForWeight,
  getEffectiveIncrementForExercise,
  createWorkoutSlot,
  normalizeSlotLabels,
  buildPresetSlots,
  checkIsWorkoutComplete,
  cloneSlots
} from '../utils/workoutEngine';
import { deleteCloudRoutineByKey } from '../utils/supabaseAuth';

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
  gyms,
  routinePreferences,
  currentIncrementLbs,
  shareRoutinesWithFriends,
  setSavedRoutines,
  setSharedRoutines,
  setTimerTrigger,
  addSlotGymFilter,
  newSlotCategory,
  newSlotMuscleGroup,
  newSlotEx1,
  newSlotSupersetIds,
  newSlotScheme,
  setShowAddSlotModal,
  appendSessionLog
}) {
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

  const buildGeneratedAutoSlots = () => {
    const compatiblePool = EXERCISE_LIBRARY.filter(ex =>
      isExerciseCompatibleWithGymSelection(ex, selectedGymId, gyms)
    );
    const fallbackPool = compatiblePool.length > 0 ? compatiblePool : EXERCISE_LIBRARY;

    const compatCompounds = compatiblePool.filter(e => e.category === 'Compound Lift');
    const compatAccessories = compatiblePool.filter(e => e.category === 'Accessory');

    let compIdx = 0;
    let accIdx = 0;

    const generatedSlots = routinePreferences
      .filter(pref => pref !== 'Warmup')
      .map(rawPref => {
        const pref = normalizeSlotCategory(rawPref);
        if (pref === 'Compound Lift') {
          const pool = compatCompounds.length > 0 ? compatCompounds : fallbackPool;
          const pick = pool[compIdx % Math.max(1, pool.length)] || EXERCISE_MAP.dumbbell_press;
          compIdx += 1;
          return createWorkoutSlot({
            category: 'Compound Lift',
            slotLabel: `Compound Lift ${compIdx}`,
            exerciseId: pick.id,
            scheme: '5x8',
            oneRepMaxes,
            history,
            incrementLbs: currentIncrementLbs
          });
        }
        if (pref === 'Superset') {
          const pool = compatAccessories.length > 0 ? compatAccessories : fallbackPool;
          const a1 = pool[accIdx % Math.max(1, pool.length)] || EXERCISE_MAP.reverse_lunge;
          const a2 = pool[(accIdx + 1) % Math.max(1, pool.length)] || EXERCISE_MAP.front_flies;
          accIdx += 2;
          return createWorkoutSlot({
            category: 'Superset',
            slotLabel: 'Superset',
            supersetExerciseIds: [a1.id, a2.id],
            scheme: '5x8',
            oneRepMaxes,
            history,
            incrementLbs: currentIncrementLbs
          });
        }
        const pool = compatAccessories.length > 0 ? compatAccessories : fallbackPool;
        const pick = pool[accIdx % Math.max(1, pool.length)] || EXERCISE_MAP.dumbbell_hammer_curl;
        accIdx += 1;
        return createWorkoutSlot({
          category: 'Accessory',
          slotLabel: 'Accessory',
          exerciseId: pick.id,
          scheme: '5x8',
          oneRepMaxes,
          history,
          incrementLbs: currentIncrementLbs
        });
      });

    return normalizeSlotLabels(generatedSlots);
  };

  const handleOpenNewSession = () => {
    if (!activeSession) {
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
    const autoSlots = buildGeneratedAutoSlots();
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
          buildPresetSlots(routineObj.key, oneRepMaxes, history, currentIncrementLbs)
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
        ...(prev || { id: `hist_${Date.now()}`, workoutDate: new Date().toISOString().split('T')[0] }),
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
    const generatedSlots = buildGeneratedAutoSlots();
    const autoTitle = getDefaultAutoSessionName();
    const returnTarget =
      currentView === 'historical_entry' ||
      currentView === 'routine_editor' ||
      currentView === 'session' ||
      currentView === 'history'
        ? currentView
        : routineSelectReturnView || 'session';

    appendSessionLog?.('AUTO_BUILD', `Generated auto workout: ${autoTitle}`);

    if (returnTarget === 'history' && expandedHistoryWorkoutId) {
      updateCurrentWorkoutState(prev => ({
        ...prev,
        title: autoTitle,
        loadedRoutineTitle: 'AUTO',
        slots: generatedSlots
      }));
      return;
    }

    if (returnTarget === 'historical_entry') {
      setHistoricalDraft(prev => ({
        ...(prev || { id: `hist_${Date.now()}`, workoutDate: new Date().toISOString().split('T')[0] }),
        title: autoTitle,
        loadedRoutineTitle: 'AUTO',
        slots: generatedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('historical_entry');
    } else if (returnTarget === 'routine_editor') {
      setRoutineDraft(prev => ({
        ...(prev || { key: `routine_${Date.now()}`, isEditingExisting: false, defaultRestSeconds: 90 }),
        title: autoTitle,
        loadedRoutineTitle: 'AUTO',
        slots: generatedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('routine_editor');
    } else {
      setActiveSession(prev => ({
        ...(prev || { id: `session_${Date.now()}`, startedAt: new Date().toISOString(), defaultRestSeconds: 90 }),
        title: autoTitle,
        loadedRoutineTitle: 'AUTO',
        updatedAt: new Date().toISOString(),
        slots: generatedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('session');
    }
  };

  const handleSaveCurrentEditor = () => {
    const currentWorkout = getCurrentEditorWorkout();
    if (!currentWorkout || !currentWorkout.slots || currentWorkout.slots.length === 0) {
      return;
    }
    setSaveConfirmTarget({
      name: currentWorkout.title || getDefaultSessionName(),
      shareWithFriends: Boolean(isCurrentEditorShared || shareRoutinesWithFriends),
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

    const routineItem = {
      key: currentWorkout.key || `routine_${currentWorkout.id || Date.now()}`,
      label: finalTitle,
      author: user?.username || 'test_lifter',
      slots: normalizedSlots
    };
    setSavedRoutines(prev => {
      const exists = prev.some(r => r.key === routineItem.key || r.label === finalTitle);
      return exists
        ? prev.map(r => (r.key === routineItem.key || r.label === finalTitle ? routineItem : r))
        : [routineItem, ...prev];
    });

    if (shouldShare) {
      const sharedItem = {
        key: `shared_${currentWorkout.id || currentWorkout.key || Date.now()}`,
        label: finalTitle,
        author: user?.username || 'test_lifter',
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

    appendSessionLog?.('SAVE_WORKOUT', `Saved "${finalTitle}" (shareWithFriends=${shouldShare})`);
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
      const iso = parseYMDToISO(currentWorkout.workoutDate || '2026/10/28');
      const entry = {
        ...currentWorkout,
        id: currentWorkout.id || `hist_${Date.now()}`,
        title: finalTitle,
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
    const sharedItem = {
      key: `shared_${currentWorkout.id || currentWorkout.key || Date.now()}`,
      label: currentWorkout.title || 'Shared Routine',
      author: user?.username || 'test_lifter',
      slots: normalizeSlotLabels(cloneSlots(currentWorkout.slots))
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
    if (deleteConfirmTarget.type === 'history_workout') {
      const targetWorkoutId = deleteConfirmTarget.workoutId;
      const deletedWorkout = (history || []).find(w => w.id === targetWorkoutId);
      const nextHistory = (history || []).filter(w => w.id !== targetWorkoutId);
      setHistory(nextHistory);

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

  const handleUpdateSlotCategoryOrExercise = (slotId, changes) => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;
        const currentEx = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
        const targetMuscleGroup =
          changes.exerciseId && EXERCISE_MAP[changes.exerciseId]
            ? EXERCISE_MAP[changes.exerciseId].muscleGroup
            : slot.familyMuscleGroup || currentEx.muscleGroup || 'Chest';

        let nextCategory = normalizeSlotCategory(changes.category ?? slot.category);
        const availMuscleGroups = getAvailableMuscleGroupsForCategory(nextCategory, selectedGymId, gyms);
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

        const candidatePool = getFilteredExercisesForSlotInline(
          { ...slot, category: nextCategory, muscleGroupFilter: nextMuscleFilter },
          selectedGymId,
          gyms
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
            const calcMax = getHistoricalCalculated1RM(id, history, oneRepMaxes);
            const effInc = getEffectiveIncrementForExercise(id, currentIncrementLbs);
            const totalCount = existingList.length || 5;
            return existingList.map((st, sIdx) => {
              const lastW = calculateLastEquivalentWeightForSet(calcMax, st, totalCount, 'Superset', sIdx, slot.scheme);
              const nextW = st.type === '1 Rep Max' ? roundTo5(calcMax) : roundToIncrement(lastW + effInc);
              return { ...st, setNumber: sIdx + 1, lastWeight: lastW, increment: st.type === '1 Rep Max' ? 0 : effInc, weight: nextW };
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
          restSeconds: slot.restSeconds || 90
        });

        return {
          ...rebuiltSlot,
          id: slot.id,
          familyMuscleGroup: targetMuscleGroup,
          muscleGroupFilter: nextMuscleFilter
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

        const applyFieldChange = (st, exId, totalCount, sIdx) => {
          if (st.id !== setId) return st;
          const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
          const lastW =
            st.lastWeight !== undefined
              ? st.lastWeight
              : calculateLastEquivalentWeightForSet(calc1RM, st, totalCount, slot.category, sIdx, slot.scheme);

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
              ? list.map((st, sIdx) => applyFieldChange(st, supIds[idx] || slot.exerciseId, list.length, sIdx))
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

        const updateSingleSet = (st, exId, totalCount, sIdx) => {
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
          const lastW = calculateLastEquivalentWeightForSet(calc1RM, updatedSet, totalCount, slot.category, sIdx, slot.scheme);
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
              ? list.map((st, sIdx) => updateSingleSet(st, supIds[idx] || slot.exerciseId, list.length, sIdx))
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

        const insertIntoList = (list, exId) => {
          const currentList = Array.isArray(list) ? list : [];
          const refSet = isTop ? currentList[0] : currentList[currentList.length - 1];
          const base1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
          const effInc = getEffectiveIncrementForExercise(exId, currentIncrementLbs);
          const nextCount = currentList.length + 1;
          const newReps = refSet ? refSet.reps : slot.category === 'Abs' ? 45 : 8;
          const draftSet = {
            id: `set_${ts}_${Math.random().toString(36).slice(2, 6)}`,
            setNumber: 1,
            type: defaultSetType,
            reps: newReps,
            completed: false
          };
          const lastW =
            slot.category === 'Abs'
              ? 0
              : calculateLastEquivalentWeightForSet(base1RM, draftSet, nextCount, slot.category);
          const newSet = {
            ...draftSet,
            lastWeight: lastW,
            increment: slot.category === 'Abs' ? 0 : effInc,
            weight: slot.category === 'Abs' ? 0 : roundToIncrement(lastW + effInc)
          };
          const combined = isTop ? [newSet, ...currentList] : [...currentList, newSet];
          return combined.map((st, idx) => ({ ...st, setNumber: idx + 1 }));
        };

        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
          const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            insertIntoList(list, supIds[idx] || slot.exerciseId)
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

        let nextSlotScheme = slot.scheme;

        const recalcList = (list, exId) => {
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
            if (slot.scheme === 'Pyramid') {
              nextSlotScheme = 'Pyramid 1RM';
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
            if (slot.scheme === 'Pyramid 1RM' && lastSet.type === 'Top Out') {
              nextSlotScheme = 'Pyramid';
            }
            const effectiveScheme = nextSlotScheme === 'Pyramid 1RM' ? 'Pyramid' : nextSlotScheme;

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
              slot.scheme === 'Pyramid 1RM' &&
              st.type === 'Warmup' &&
              idx < totalCount - 1;
            const isPyramid1RMTopSet =
              slot.scheme === 'Pyramid 1RM' &&
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
                slot.scheme
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
              slot.scheme
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
            recalcList(list, supIds[idx] || slot.exerciseId)
          );
          return {
            ...slot,
            scheme: nextSlotScheme,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }

        const nextSets = recalcList(slot.sets || [], slot.exerciseId);
        return { ...slot, scheme: nextSlotScheme, sets: nextSets, supersetSetsByExercise: [nextSets] };
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

  const handleAddManualSlot = () => {
    const normCat = normalizeSlotCategory(newSlotCategory);
    const activeMuscle = newSlotMuscleGroup || 'All Muscles';
    const validList = filterAddSlotExercises(addSlotGymFilter, normCat, gyms, activeMuscle);

    const resolvedEx1 = validList.some(ex => ex.id === newSlotEx1)
      ? newSlotEx1
      : validList[0]?.id || newSlotEx1 || 'barbell_bench_press';

    const resolvedSupersetIds = isSupersetCategory(normCat)
      ? [
          validList.some(ex => ex.id === newSlotSupersetIds?.[0])
            ? newSlotSupersetIds[0]
            : validList[0]?.id || 'reverse_lunge',
          validList.some(ex => ex.id === newSlotSupersetIds?.[1])
            ? newSlotSupersetIds[1]
            : validList[1]?.id || validList[0]?.id || 'front_flies'
        ]
      : [resolvedEx1];

    const resolvedMuscleGroupFilter =
      activeMuscle !== 'All Muscles'
        ? activeMuscle
        : EXERCISE_MAP[resolvedEx1]?.muscleGroup || 'All Muscles';

    const newSlot = {
      ...createWorkoutSlot({
        category: normCat,
        slotLabel: normCat,
        exerciseId: resolvedEx1,
        supersetExerciseIds: resolvedSupersetIds,
        scheme: newSlotScheme,
        oneRepMaxes,
        history,
        incrementLbs: currentIncrementLbs
      }),
      muscleGroupFilter: resolvedMuscleGroupFilter
    };
    updateCurrentWorkoutState(prev => ({
      ...(prev || { id: `session_${Date.now()}`, title: getDefaultSessionName(), slots: [] }),
      slots: [...(prev?.slots || []), newSlot]
    }));
    setShowAddSlotModal(false);
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
    handleAddManualSlot
  };
}

