'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { IOS_DARK, KINETIC_CSS, UI } from './styles/kineticTokens';
import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  BIG_FOUR_IDS,
  getDefaultSessionName,
  getDefaultAutoSessionName,
  formatTitleWithDate,
  isExerciseCompatibleWithGymSelection,
  roundTo5,
  roundToIncrement
} from './data/exerciseLibrary';
import {
  getHistoricalCalculated1RM,
  calculateLastEquivalentWeightForSet,
  getIncrementInLbs,
  createWorkoutSlot,
  normalizeSlotLabels,
  buildPresetSlots,
  getInitial1RMs,
  checkIsWorkoutComplete,
  cloneSlots,
  getNextIncompleteSetInfo
} from './utils/workoutEngine';
import {
  PERSISTENCE_KEY,
  CURRENT_SCHEMA_VERSION,
  loadHydratedAppState
} from './utils/storageMigration';
import { SFSymbol, SessionRestTimerBar } from './components/Primitives';
import {
  DeleteConfirmModal,
  AddSlotModal,
  PlateCalculatorModal
} from './components/Modals';
import { HomeView } from './components/views/HomeView';
import { RoutineEditorView } from './components/views/RoutineEditorView';
import {
  RoutinesView,
  GymsView,
  GymEditorView
} from './components/views/RoutinesAndGymsViews';
import {
  HistoryView,
  GoalsView,
  ProgressionChartView,
  StimulusMapView,
  LeaderboardView,
  SocialView,
  ProfileView
} from './components/views/HistoryAndStatsViews';
import {
  SettingsView,
  InfoView,
  AuthView
} from './components/views/SettingsInfoAuthViews';

// ============================================================================
// MAIN KINETIC APPLICATION COMPONENT
// ============================================================================

export default function App() {
  const colors = IOS_DARK;

  const hydratedRef = useRef(undefined);
  if (hydratedRef.current === undefined) {
    hydratedRef.current = loadHydratedAppState();
  }
  const initialHydrated = hydratedRef.current;

  // --- Navigation & Drawer State ---
  const [currentView, setCurrentView] = useState('home');
  const [showHamburgerDrawer, setShowHamburgerDrawer] = useState(false);
  const [marqueePaused, setMarqueePaused] = useState(false);
  const importBackupInputRef = useRef(null);

  // --- User & Auth State ---
  const [user, setUser] = useState(() => (initialHydrated?.user !== undefined ? initialHydrated.user : null));
  const [authMode, setAuthMode] = useState('login');
  const [authUsername, setAuthUsername] = useState(() => initialHydrated?.user?.username || '');
  const [authEmail, setAuthEmail] = useState(() => initialHydrated?.user?.email || '');
  const [authPassword, setAuthPassword] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupBetaCode, setSignupBetaCode] = useState('');
  const fileInputRef = useRef(null);

  // --- 1RM & History State ---
  const [oneRepMaxes, setOneRepMaxes] = useState(() => initialHydrated?.oneRepMaxes || getInitial1RMs());
  const [history, setHistory] = useState(() => initialHydrated?.history || []);

  // --- Active Session, Historical Entry, Routine Editor & Preview State ---
  const [activeSession, setActiveSession] = useState(() => initialHydrated?.activeSession || null);
  const [historicalDraft, setHistoricalDraft] = useState(null);
  const [routineDraft, setRoutineDraft] = useState(null);
  const [previewRoutineDraft, setPreviewRoutineDraft] = useState(null);
  const [routineSelectReturnView, setRoutineSelectReturnView] = useState(null);
  const [isCurrentEditorShared, setIsCurrentEditorShared] = useState(false);

  // --- Delete Confirmation Modal State (for Exercise Slot or Individual Set) ---
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  // --- Add Exercise Modal State ---
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [addSlotGymFilter, setAddSlotGymFilter] = useState('');
  const [newSlotCategory, setNewSlotCategory] = useState('Compound Lift');
  const [newSlotEx1, setNewSlotEx1] = useState('barbell_bench_press');
  const [newSlotSupersetIds, setNewSlotSupersetIds] = useState(['reverse_lunge', 'front_flies']);
  const [newSlotScheme, setNewSlotScheme] = useState('5x8');

  // --- Saved & Shared Routines State ---
  const [savedRoutines, setSavedRoutines] = useState(() => initialHydrated?.savedRoutines || []);
  const [sharedRoutines, setSharedRoutines] = useState(() => initialHydrated?.sharedRoutines || []);

  // --- Gyms & Gym Editor State ---
  const [gyms, setGyms] = useState(() => initialHydrated?.gyms || []);
  const [selectedGymId, setSelectedGymId] = useState(() => initialHydrated?.settings?.selectedGymId || '');
  const [gymDraft, setGymDraft] = useState(null);

  // --- Goals, Standards & Settings State ---
  const [goalType, setGoalType] = useState(() => initialHydrated?.settings?.goals?.goalType || 'Strength');
  const [goalIncrement, setGoalIncrement] = useState(() => initialHydrated?.settings?.goals?.goalIncrement || 1.25);
  const [goalUnit, setGoalUnit] = useState(() => initialHydrated?.settings?.goals?.goalUnit || 'lb');
  const [chartMetric, setChartMetric] = useState(() => initialHydrated?.settings?.goals?.chartMetric || 'weight');
  const [selectedChartLift, setSelectedChartLift] = useState('ALL');
  const [targetStandardClass, setTargetStandardClass] = useState(() => initialHydrated?.settings?.goals?.targetStandardClass || 'Intermediate');
  const [customGoalWeights, setCustomGoalWeights] = useState(() => initialHydrated?.settings?.goals?.customGoalWeights || {});

  const [userBodyweightLbs, setUserBodyweightLbs] = useState(() => initialHydrated?.settings?.bodyMetrics?.bodyweightLbs ?? 220);
  const [userHeightFeet, setUserHeightFeet] = useState(() => initialHydrated?.settings?.bodyMetrics?.heightFeet ?? 5);
  const [userHeightInches, setUserHeightInches] = useState(() => initialHydrated?.settings?.bodyMetrics?.heightInches ?? 10);
  const [stimulusGreenDays, setStimulusGreenDays] = useState(() => initialHydrated?.settings?.stimulus?.greenDays ?? 2);
  const [stimulusYellowDays, setStimulusYellowDays] = useState(() => initialHydrated?.settings?.stimulus?.yellowDays ?? 4);
  const [routinePreferences, setRoutinePreferences] = useState(
    () => initialHydrated?.settings?.routinePreferences || ['Compounds', 'Compounds', 'Supersets', 'Supersets', 'Abs']
  );
  const [shareStatsWithFriends, setShareStatsWithFriends] = useState(
    () => initialHydrated?.settings?.social?.shareStatsWithFriends ?? true
  );
  const [shareRoutinesWithFriends, setShareRoutinesWithFriends] = useState(
    () => initialHydrated?.settings?.social?.shareRoutinesWithFriends ?? true
  );

  // --- History Page Collapsible Sections State ---
  const [historySessionsExpanded, setHistorySessionsExpanded] = useState(true);
  const [historyPRsExpanded, setHistoryPRsExpanded] = useState(true);
  const [expandedHistoryWorkoutId, setExpandedHistoryWorkoutId] = useState(null);

  // --- Social & Friends State ---
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendsList, setFriendsList] = useState(() => initialHydrated?.friendsList || []);
  const [pendingIncomingRequests, setPendingIncomingRequests] = useState(() => initialHydrated?.pendingIncomingRequests || []);
  const [outgoingInvites, setOutgoingInvites] = useState(() => initialHydrated?.outgoingInvites || []);
  const [viewingFriendProfile, setViewingFriendProfile] = useState(null);

  const currentIncrementLbs = useMemo(
    () => getIncrementInLbs(goalIncrement, goalUnit, goalType),
    [goalIncrement, goalUnit, goalType]
  );

  // --- Debounced Automatic Versioned Persistence Effect (300ms) ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const debounceTimer = setTimeout(() => {
      try {
        const payload = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
          user, oneRepMaxes, history, activeSession, savedRoutines, sharedRoutines,
          gyms, friendsList, pendingIncomingRequests, outgoingInvites,
          settings: {
            schemaVersion: CURRENT_SCHEMA_VERSION,
            bodyMetrics: { bodyweightLbs: userBodyweightLbs, heightFeet: userHeightFeet, heightInches: userHeightInches },
            goals: { goalType, goalIncrement, goalUnit, chartMetric, targetStandardClass, customGoalWeights },
            stimulus: { greenDays: stimulusGreenDays, yellowDays: stimulusYellowDays },
            routinePreferences,
            social: { shareStatsWithFriends, shareRoutinesWithFriends },
            selectedGymId
          }
        };
        window.localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.warn('Failed to save state to localStorage:', err);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [
    user, oneRepMaxes, history, activeSession, savedRoutines, sharedRoutines,
    gyms, friendsList, pendingIncomingRequests, outgoingInvites, userBodyweightLbs,
    userHeightFeet, userHeightInches, goalType, goalIncrement, goalUnit, chartMetric,
    targetStandardClass, customGoalWeights, stimulusGreenDays, stimulusYellowDays,
    routinePreferences, shareStatsWithFriends, shareRoutinesWithFriends, selectedGymId
  ]);

  const handleExportBackupJSON = () => {
    try {
      const raw = window.localStorage.getItem(PERSISTENCE_KEY);
      if (!raw) return;
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `you-cant-cry-in-here-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleImportBackupJSON = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result || '{}');
        if (!parsed || typeof parsed !== 'object') return;
        window.localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(parsed));
        const rehydrated = loadHydratedAppState();
        if (rehydrated) {
          setUser(rehydrated.user);
          setOneRepMaxes(rehydrated.oneRepMaxes);
          setHistory(rehydrated.history);
          setActiveSession(rehydrated.activeSession);
          if (rehydrated.savedRoutines) setSavedRoutines(rehydrated.savedRoutines);
          if (rehydrated.sharedRoutines) setSharedRoutines(rehydrated.sharedRoutines);
          if (rehydrated.gyms) setGyms(rehydrated.gyms);
          if (rehydrated.friendsList) setFriendsList(rehydrated.friendsList);
          setUserBodyweightLbs(rehydrated.settings.bodyMetrics.bodyweightLbs);
          setUserHeightFeet(rehydrated.settings.bodyMetrics.heightFeet);
          setUserHeightInches(rehydrated.settings.bodyMetrics.heightInches);
          setGoalType(rehydrated.settings.goals.goalType);
          setGoalIncrement(rehydrated.settings.goals.goalIncrement);
          setGoalUnit(rehydrated.settings.goals.goalUnit);
          setTargetStandardClass(rehydrated.settings.goals.targetStandardClass);
          setCustomGoalWeights(rehydrated.settings.goals.customGoalWeights);
          setStimulusGreenDays(rehydrated.settings.stimulus.greenDays);
          setStimulusYellowDays(rehydrated.settings.stimulus.yellowDays);
          setRoutinePreferences(rehydrated.settings.routinePreferences);
          setShareStatsWithFriends(rehydrated.settings.social.shareStatsWithFriends);
          setShareRoutinesWithFriends(rehydrated.settings.social.shareRoutinesWithFriends);
          setSelectedGymId(rehydrated.settings.selectedGymId);
        }
      } catch {
        // ignore
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleResetToDemoDefaults = () => {
    const freshMaxes = getInitial1RMs();
    setUser(null);
    setOneRepMaxes(freshMaxes);
    setHistory([]);
    setActiveSession(null);
    setSavedRoutines([]);
    setSharedRoutines([]);
    setGyms([]);
    setFriendsList([]);
    setPendingIncomingRequests([]);
    setOutgoingInvites([]);
    setUserBodyweightLbs(220);
    setUserHeightFeet(5);
    setUserHeightInches(10);
    setGoalType('Strength');
    setGoalIncrement(1.25);
    setGoalUnit('lb');
    setTargetStandardClass('Intermediate');
    setCustomGoalWeights({});
    setStimulusGreenDays(2);
    setStimulusYellowDays(4);
    setRoutinePreferences(['Compounds', 'Compounds', 'Supersets', 'Supersets', 'Abs']);
    setShareStatsWithFriends(true);
    setShareRoutinesWithFriends(true);
    setSelectedGymId('');
  };

  // --- Plate & Weight Calculator Modal State ---
  const [plateCalcTarget, setPlateCalcTarget] = useState(null);
  const [calcUnit, setCalcUnit] = useState('lb');
  const [calcMode, setCalcMode] = useState('per_side');
  const [calcBarWeight, setCalcBarWeight] = useState(45);
  const [calcPlatesPerSide, setCalcPlatesPerSide] = useState([]);
  const [calcDirectTotal, setCalcDirectTotal] = useState(135);

  // --- Isolated Rest Timer Trigger State ---
  const [timerTrigger, setTimerTrigger] = useState({
    isRunning: false,
    targetSeconds: 90,
    startedAtMs: null
  });

  // ============================================================================
  // COMPUTED TELEMETRY, STIMULUS MAP & PROGRESSION SERIES
  // ============================================================================

  const totalHeightInches = useMemo(() => {
    return (Number(userHeightFeet) || 5) * 12 + (Number(userHeightInches) || 10);
  }, [userHeightFeet, userHeightInches]);

  const [stimulusNowMs, setStimulusNowMs] = useState(null);
  useEffect(() => {
    setStimulusNowMs(Date.now());
  }, [history]);

  const muscleStimulusStatus = useMemo(() => {
    const groups = ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core'];
    const result = {};

    groups.forEach(g => {
      let minDays = 99;
      if (stimulusNowMs !== null) {
        history.forEach(w => {
          const daysAgo = Math.max(0, Math.floor((stimulusNowMs - new Date(w.startedAt).getTime()) / 86400000));
          (w.slots || []).forEach(slot => {
            const ids =
              slot.category === 'Supersets' && slot.supersetExerciseIds
                ? slot.supersetExerciseIds
                : [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
            ids.forEach(id => {
              const ex = EXERCISE_MAP[id];
              if (ex && ex.muscleGroup === g && daysAgo < minDays) {
                minDays = daysAgo;
              }
            });
          });
        });
      }

      const greenMax = Number(stimulusGreenDays) || 2;
      const yellowMax = Number(stimulusYellowDays) || 4;
      let statusColor = '#FF3B30';
      let statusLabel = `${yellowMax + 1}+ DAYS`;
      if (minDays <= greenMax) {
        statusColor = '#30D158';
        statusLabel = `${minDays}D AGO (FRESH)`;
      } else if (minDays <= yellowMax) {
        statusColor = '#FFD60A';
        statusLabel = `${minDays}D AGO (READY)`;
      } else if (minDays < 99) {
        statusLabel = `${minDays}D AGO (DUE)`;
      } else {
        statusLabel = 'UNLOGGED';
      }

      result[g] = { daysAgo: minDays, color: statusColor, label: statusLabel };
    });

    return result;
  }, [history, stimulusGreenDays, stimulusYellowDays, stimulusNowMs]);

  const progressionSeriesByLift = useMemo(() => {
    const sorted = [...history].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    const map = {};
    BIG_FOUR_IDS.forEach(liftId => {
      const points = [];
      sorted.forEach(w => {
        let topWeight = 0;
        let totalVol = 0;
        (w.slots || []).forEach(slot => {
          if (slot.exerciseId === liftId) {
            (slot.sets || []).forEach(s => {
              if (s.completed && s.weight > 0) {
                if (s.weight > topWeight) topWeight = s.weight;
                totalVol += (Number(s.weight) || 0) * (Number(s.reps) || 0);
              }
            });
          }
        });
        if (topWeight > 0 || totalVol > 0) {
          points.push({
            dateLabel: new Date(w.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            weight: topWeight,
            volume: totalVol
          });
        }
      });
      map[liftId] = points;
    });
    return map;
  }, [history]);

  // ============================================================================
  // ROUTINE EDITOR & WORKOUT MUTATION HANDLERS
  // ============================================================================

  const getCurrentEditorWorkout = () => {
    if (currentView === 'historical_entry') return historicalDraft;
    if (currentView === 'routine_editor') return routineDraft;
    if (currentView === 'routine_preview') return previewRoutineDraft;
    return activeSession;
  };

  const updateCurrentWorkoutState = updater => {
    setIsCurrentEditorShared(false);
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

  const buildGeneratedAutoSlots = () => {
    const compatiblePool = EXERCISE_LIBRARY.filter(ex =>
      isExerciseCompatibleWithGymSelection(ex, selectedGymId, gyms)
    );
    const fallbackPool = compatiblePool.length > 0 ? compatiblePool : EXERCISE_LIBRARY;

    const compatCompounds = compatiblePool.filter(e => e.category === 'Compound Lift');
    const compatAccessories = compatiblePool.filter(e => e.category === 'Accessories');
    const compatAbs = compatiblePool.filter(e => e.category === 'Abs');

    let compIdx = 0;
    let accIdx = 0;

    const generatedSlots = routinePreferences
      .filter(pref => pref !== 'Warmup')
      .map(pref => {
        if (pref === 'Compounds') {
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
        if (pref === 'Supersets') {
          const pool = compatAccessories.length > 0 ? compatAccessories : fallbackPool;
          const a1 = pool[accIdx % Math.max(1, pool.length)] || EXERCISE_MAP.reverse_lunge;
          const a2 = pool[(accIdx + 1) % Math.max(1, pool.length)] || EXERCISE_MAP.front_flies;
          accIdx += 2;
          return createWorkoutSlot({
            category: 'Supersets',
            slotLabel: 'Superset',
            supersetExerciseIds: [a1.id, a2.id],
            scheme: '5x8',
            oneRepMaxes,
            history,
            incrementLbs: currentIncrementLbs
          });
        }
        if (pref === 'Accessories') {
          const pool = compatAccessories.length > 0 ? compatAccessories : fallbackPool;
          const pick = pool[accIdx % Math.max(1, pool.length)] || EXERCISE_MAP.dumbbell_hammer_curl;
          accIdx += 1;
          return createWorkoutSlot({
            category: 'Accessories',
            slotLabel: 'Accessories',
            exerciseId: pick.id,
            scheme: '5x8',
            oneRepMaxes,
            history,
            incrementLbs: currentIncrementLbs
          });
        }
        const absPick =
          compatAbs[0] ||
          fallbackPool.find(e => e.category === 'Abs') ||
          fallbackPool[0] ||
          EXERCISE_MAP.hollow_holds;
        return createWorkoutSlot({
          category: 'Abs',
          slotLabel: 'Abs',
          exerciseId: absPick.id,
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
    setIsCurrentEditorShared(false);
    setCurrentView('session');
  };

  const handleOpenPreviewRoutine = (routineObj, returnToView = 'routines') => {
    setPreviewRoutineDraft({
      key: routineObj.key,
      title: formatTitleWithDate(routineObj.label),
      baseRoutineLabel: routineObj.label,
      loadedRoutineTitle: routineObj.label,
      defaultRestSeconds: 90,
      slots: normalizeSlotLabels(
        cloneSlots(
          routineObj.slots ||
          buildPresetSlots(routineObj.key, oneRepMaxes, history, currentIncrementLbs)
        )
      )
    });
    setRoutineSelectReturnView(returnToView);
    setCurrentView('routine_preview');
  };

  const handleDirectLoadRoutine = (routineObj, returnToView = 'session') => {
    const builtSlots = normalizeSlotLabels(
      cloneSlots(
        routineObj.slots ||
        buildPresetSlots(routineObj.key, oneRepMaxes, history, currentIncrementLbs)
      )
    );
    const datedTitle = formatTitleWithDate(routineObj.label);
    const routineLabel = routineObj.label || datedTitle;

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

  const handleApplyPreviewRoutine = () => {
    if (!previewRoutineDraft) return;
    const clonedSlots = normalizeSlotLabels(cloneSlots(previewRoutineDraft.slots));
    const datedTitle = previewRoutineDraft.title || getDefaultSessionName();
    const routineLabel = previewRoutineDraft.baseRoutineLabel || previewRoutineDraft.title || datedTitle;

    if (routineSelectReturnView === 'historical_entry') {
      setHistoricalDraft(prev => ({
        ...(prev || { id: `hist_${Date.now()}`, workoutDate: new Date().toISOString().split('T')[0] }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        slots: clonedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('historical_entry');
    } else if (routineSelectReturnView === 'routine_editor') {
      setRoutineDraft(prev => ({
        ...(prev || { key: `routine_${Date.now()}`, isEditingExisting: false, defaultRestSeconds: 90 }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        slots: clonedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('routine_editor');
    } else {
      setActiveSession(prev => ({
        ...(prev || { id: `session_${Date.now()}`, startedAt: new Date().toISOString(), defaultRestSeconds: 90 }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        updatedAt: new Date().toISOString(),
        slots: clonedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('session');
    }
  };

  const handleAutoBuildWorkout = () => {
    const generatedSlots = buildGeneratedAutoSlots();
    const autoTitle = getDefaultAutoSessionName();
    const returnTarget =
      currentView === 'historical_entry' ||
        currentView === 'routine_editor' ||
        currentView === 'session'
        ? currentView
        : routineSelectReturnView || 'session';

    setPreviewRoutineDraft({
      key: `auto_${Date.now()}`,
      title: autoTitle,
      baseRoutineLabel: 'AUTO',
      loadedRoutineTitle: 'AUTO',
      defaultRestSeconds: 90,
      slots: generatedSlots
    });
    setRoutineSelectReturnView(returnTarget);
    setCurrentView('routine_preview');
  };

  const handleSaveCurrentEditor = () => {
    const currentWorkout = getCurrentEditorWorkout();
    if (!currentWorkout || !currentWorkout.slots || currentWorkout.slots.length === 0) {
      return;
    }

    if (currentView === 'routine_editor') {
      const routineItem = {
        key: currentWorkout.key || `routine_${Date.now()}`,
        label: currentWorkout.title || 'Saved Routine',
        author: user?.username || 'test_lifter',
        slots: normalizeSlotLabels(currentWorkout.slots)
      };
      setSavedRoutines(prev => {
        const exists = prev.some(r => r.key === routineItem.key);
        return exists ? prev.map(r => (r.key === routineItem.key ? routineItem : r)) : [routineItem, ...prev];
      });
      setCurrentView('routines');
      return;
    }

    if (currentView === 'historical_entry') {
      const iso = new Date(`${currentWorkout.workoutDate || '2026-10-28'}T12:00:00`).toISOString();
      const entry = {
        ...currentWorkout,
        id: currentWorkout.id || `hist_${Date.now()}`,
        startedAt: iso,
        updatedAt: new Date().toISOString(),
        isComplete: true,
        verifiedByUser: true,
        slots: normalizeSlotLabels(currentWorkout.slots)
      };
      setHistory(prev => [entry, ...prev]);
      setHistoricalDraft(null);
      setCurrentView('history');
      return;
    }

    const entry = {
      ...currentWorkout,
      updatedAt: new Date().toISOString(),
      isComplete: checkIsWorkoutComplete(currentWorkout.slots),
      verifiedByUser: true
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
          if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
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

        const nextCategory = changes.category ?? slot.category;
        const nextScheme = changes.scheme ?? slot.scheme;
        let nextExId = changes.exerciseId ?? slot.exerciseId;
        let nextSupersetIds =
          changes.supersetExerciseIds ??
          slot.supersetExerciseIds ??
          [nextExId, slot.secondaryExerciseId].filter(Boolean);

        if (
          slot.category === 'Supersets' &&
          nextCategory === 'Supersets' &&
          changes.supersetExerciseIds &&
          !changes.scheme &&
          !changes.category
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
            const totalCount = existingList.length || 5;
            return existingList.map((st, sIdx) => {
              const lastW = calculateLastEquivalentWeightForSet(calcMax, st, totalCount, 'Supersets');
              const nextW = st.type === '1 Rep Max' ? roundTo5(calcMax) : roundToIncrement(lastW + currentIncrementLbs);
              return { ...st, setNumber: sIdx + 1, lastWeight: lastW, weight: nextW };
            });
          });

          return {
            ...slot,
            exerciseId: cleanIds[0],
            secondaryExerciseId: cleanIds[1],
            supersetExerciseIds: cleanIds,
            supersetSetsByExercise: updatedMatrix,
            sets: updatedMatrix[0] || [],
            secondarySets: updatedMatrix[1] || []
          };
        }

        if (changes.category && !changes.exerciseId) {
          if (nextCategory === 'Abs') {
            const absMatch = EXERCISE_LIBRARY.find(e => e.category === 'Abs');
            nextExId = absMatch ? absMatch.id : 'hollow_holds';
          } else if (nextCategory === 'Accessories') {
            const sameFamilyAcc = EXERCISE_LIBRARY.filter(e => e.category === 'Accessories' && e.muscleGroup === targetMuscleGroup);
            const fallbackAcc = EXERCISE_LIBRARY.filter(e => e.category === 'Accessories');
            nextExId = (sameFamilyAcc[0] || fallbackAcc[0] || currentEx).id;
          } else if (nextCategory === 'Compound Lift') {
            const sameFamilyComp = EXERCISE_LIBRARY.filter(e => e.category === 'Compound Lift' && e.muscleGroup === targetMuscleGroup);
            const fallbackComp = EXERCISE_LIBRARY.filter(e => e.category === 'Compound Lift');
            nextExId = (sameFamilyComp[0] || fallbackComp[0] || currentEx).id;
          } else if (nextCategory === 'Supersets') {
            const sameFamilyPool = EXERCISE_LIBRARY.filter(e => e.muscleGroup === targetMuscleGroup);
            const secondPick =
              sameFamilyPool.find(e => e.id !== nextExId) ||
              EXERCISE_LIBRARY.find(e => e.category === 'Accessories' && e.id !== nextExId) ||
              EXERCISE_MAP.front_flies;
            nextSupersetIds = [nextExId, secondPick.id].filter(Boolean);
          }
        }

        const rebuiltSlot = createWorkoutSlot({
          category: nextCategory,
          slotLabel: nextCategory,
          exerciseId: nextExId,
          supersetExerciseIds: nextCategory === 'Supersets' ? nextSupersetIds.slice(0, 2) : [nextExId],
          scheme: nextScheme,
          oneRepMaxes,
          history,
          incrementLbs: currentIncrementLbs,
          restSeconds: slot.restSeconds || 90
        });

        return { ...rebuiltSlot, id: slot.id, familyMuscleGroup: targetMuscleGroup };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  const handleUpdateSetField = (slotId, exIndex, setId, field, rawVal) => {
    const val = Math.max(0, Number(rawVal) || 0);
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;
        if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            idx === exIndex ? list.map(st => (st.id === setId ? { ...st, [field]: val } : st)) : list
          );
          return {
            ...slot,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }
        const nextSets = (slot.sets || []).map(st => (st.id === setId ? { ...st, [field]: val } : st));
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

        const updateSingleSet = (st, exId, totalCount) => {
          if (st.id !== setId) return st;
          const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
          if (newType === '1 Rep Max') {
            return {
              ...st,
              type: newType,
              reps: 1,
              lastWeight: roundTo5(calc1RM),
              weight: roundTo5(calc1RM)
            };
          }
          const updatedSet = { ...st, type: newType };
          const lastW = calculateLastEquivalentWeightForSet(calc1RM, updatedSet, totalCount, slot.category);
          return {
            ...updatedSet,
            lastWeight: lastW,
            weight: roundToIncrement(lastW + currentIncrementLbs)
          };
        };

        if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
          const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            idx === exIndex
              ? list.map(st => updateSingleSet(st, supIds[idx] || slot.exerciseId, list.length))
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
        const nextSets = (slot.sets || []).map(st => updateSingleSet(st, slot.exerciseId, totalLen));
        return { ...slot, sets: nextSets };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  const handleInsertSetAtPosition = (slotId, position = 'bottom') => {
    const isTop = position === 'top';
    const defaultSetType = isTop ? 'Warmup Set' : 'Burn Out Set';
    const ts = Date.now() + Math.floor(Math.random() * 10000);

    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;

        const insertIntoList = (list, exId) => {
          const currentList = Array.isArray(list) ? list : [];
          const refSet = isTop ? currentList[0] : currentList[currentList.length - 1];
          const base1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
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
            weight: slot.category === 'Abs' ? 0 : roundToIncrement(lastW + currentIncrementLbs)
          };
          const combined = isTop ? [newSet, ...currentList] : [...currentList, newSet];
          return combined.map((st, idx) => ({ ...st, setNumber: idx + 1 }));
        };

        if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
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

        const recalcList = (list, exId) => {
          const currentList = Array.isArray(list) ? list : [];
          const totalCount = currentList.length;
          const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);

          if (slot.category === 'Abs') {
            return currentList.map((st, idx) => ({ ...st, setNumber: idx + 1, lastWeight: 0, weight: 0 }));
          }

          const lastSetIs1RM =
            totalCount > 1 && currentList[totalCount - 1]?.type === '1 Rep Max';

          if (lastSetIs1RM) {
            const warmupCount = totalCount - 1;
            const maxW = roundTo5(calc1RM);
            return currentList.map((st, idx) => {
              if (idx === totalCount - 1) {
                return {
                  ...st,
                  setNumber: idx + 1,
                  type: '1 Rep Max',
                  reps: 1,
                  lastWeight: maxW,
                  weight: roundToIncrement(maxW + currentIncrementLbs)
                };
              }
              const pct =
                warmupCount === 1
                  ? 0.70
                  : 0.50 + (idx / (warmupCount - 1)) * 0.35;
              const warmupReps = Math.max(1, Math.round(8 - (idx / Math.max(1, warmupCount - 1)) * 6));
              const warmupW = roundTo5(calc1RM * pct);
              return {
                ...st,
                setNumber: idx + 1,
                type: 'Warmup Set',
                reps: warmupReps,
                lastWeight: warmupW,
                weight: warmupW
              };
            });
          }

          return currentList.map((st, idx) => {
            if (st.type === '1 Rep Max') {
              const maxW = roundTo5(calc1RM);
              return { ...st, setNumber: idx + 1, reps: 1, lastWeight: maxW, weight: maxW };
            }
            const lastW = calculateLastEquivalentWeightForSet(calc1RM, st, totalCount, slot.category);
            const targetW = roundToIncrement(lastW + currentIncrementLbs);
            return { ...st, setNumber: idx + 1, lastWeight: lastW, weight: targetW };
          });
        };

        if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
          const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            recalcList(list, supIds[idx] || slot.exerciseId)
          );
          return {
            ...slot,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }

        const nextSets = recalcList(slot.sets || [], slot.exerciseId);
        return { ...slot, sets: nextSets, supersetSetsByExercise: [nextSets] };
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
        if (s.category === 'Supersets' && Array.isArray(s.supersetSetsByExercise)) {
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
    const newSlot = createWorkoutSlot({
      category: newSlotCategory,
      slotLabel: newSlotCategory,
      exerciseId: newSlotEx1,
      supersetExerciseIds:
        newSlotCategory === 'Supersets'
          ? newSlotSupersetIds.length >= 2
            ? newSlotSupersetIds.slice(0, 2)
            : ['reverse_lunge', 'front_flies']
          : [newSlotEx1],
      scheme: newSlotScheme,
      oneRepMaxes,
      history,
      incrementLbs: currentIncrementLbs
    });
    updateCurrentWorkoutState(prev => ({
      ...(prev || { id: `session_${Date.now()}`, title: getDefaultSessionName(), slots: [] }),
      slots: [...(prev?.slots || []), newSlot]
    }));
    setShowAddSlotModal(false);
  };

  const decomposeWeightToPlates = initialWeight => {
    const defaultBar = 45;
    setCalcUnit('lb');
    setCalcBarWeight(defaultBar);
    setCalcDirectTotal(initialWeight);
    const availableLbPlates = [45, 35, 25, 10, 5, 2.5, 1.25];
    let remPerSide = Math.max(0, (initialWeight - defaultBar) / 2);
    const initialPlates = [];
    availableLbPlates.forEach(plate => {
      while (remPerSide >= plate - 0.01) {
        initialPlates.push(plate);
        remPerSide = Math.round((remPerSide - plate) * 100) / 100;
      }
    });
    setCalcPlatesPerSide(initialPlates.sort((a, b) => b - a));
    setCalcMode('per_side');
  };

  const openPlateCalculatorForSet = (slotId, exIndex, setItem, exerciseName) => {
    decomposeWeightToPlates(Number(setItem.weight) || 135);
    setPlateCalcTarget({
      mode: 'set', slotId, exIndex, setId: setItem.id, setNumber: setItem.setNumber, exerciseName
    });
  };

  const openPlateCalculatorForPR = (exerciseId, exerciseName, currentWeight) => {
    decomposeWeightToPlates(Number(currentWeight) || 225);
    setPlateCalcTarget({ mode: 'pr', exerciseId, exerciseName });
  };

  const openPlateCalculatorForGoal = (exerciseId, exerciseName, currentGoalWeight) => {
    decomposeWeightToPlates(Number(currentGoalWeight) || 225);
    setPlateCalcTarget({ mode: 'goal', exerciseId, exerciseName });
  };

  const computedPlateCalculatorTotal = useMemo(() => {
    if (calcMode === 'total') return Math.max(0, Number(calcDirectTotal) || 0);
    const oneSideSum = calcPlatesPerSide.reduce((acc, p) => acc + p, 0);
    return Math.round((calcBarWeight + oneSideSum * 2) * 100) / 100;
  }, [calcMode, calcDirectTotal, calcPlatesPerSide, calcBarWeight]);

  const handleApplyCalculatedWeight = () => {
    if (!plateCalcTarget) return;
    const finalWeightLbs =
      calcUnit === 'kg'
        ? Math.round(computedPlateCalculatorTotal * 2.20462 * 4) / 4
        : computedPlateCalculatorTotal;

    if (plateCalcTarget.mode === 'set') {
      handleUpdateSetField(
        plateCalcTarget.slotId,
        plateCalcTarget.exIndex,
        plateCalcTarget.setId,
        'weight',
        finalWeightLbs
      );
    } else if (plateCalcTarget.mode === 'pr') {
      setOneRepMaxes(prev => ({
        ...prev,
        [plateCalcTarget.exerciseId]: roundTo5(finalWeightLbs)
      }));
    } else if (plateCalcTarget.mode === 'goal') {
      setCustomGoalWeights(prev => ({
        ...prev,
        [plateCalcTarget.exerciseId]: roundTo5(finalWeightLbs)
      }));
      setTargetStandardClass('Custom');
    }
    setPlateCalcTarget(null);
  };

  // ============================================================================
  // RENDER KINETIC INTERFACE
  // ============================================================================

  return (
    <div className="kinetic-app min-h-screen flex justify-center bg-[#080808] text-white">
      <style>{KINETIC_CSS}</style>

      <div
        style={{
          width: '100%', maxWidth: '480px', minHeight: '100vh',
          backgroundColor: 'var(--dp-color-ground)',
          borderLeft: '2px solid var(--dp-color-rule)',
          borderRight: '2px solid var(--dp-color-rule)',
          display: 'flex', flexDirection: 'column', position: 'relative', containerType: 'inline-size'
        }}
      >
        {/* TOP NAVIGATION BAR */}
        <header
          style={{
            position: 'sticky', top: 0, zIndex: 30,
            backgroundColor: 'var(--dp-color-ground)',
            borderBottom: '2px solid var(--dp-color-rule)',
            padding: '12px var(--dp-spacing-gutter)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            {currentView === 'home' ? (
              <button
                type="button"
                aria-label="Open navigation menu"
                onClick={() => setShowHamburgerDrawer(true)}
                className="kinetic-btn"
                style={{
                  width: '40px', height: '40px', backgroundColor: '#161616',
                  border: '2px solid var(--dp-color-rule)', color: '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}
              >
                <SFSymbol name="line.3.horizontal" size={20} color="#FFFFFF" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (currentView === 'friend_profile') setCurrentView('social');
                  else if (currentView === 'gym_editor') setCurrentView('gyms');
                  else if (currentView === 'routine_editor') setCurrentView('routines');
                  else if (currentView === 'routine_preview') setCurrentView(routineSelectReturnView || 'routines');
                  else if (currentView === 'routines' && routineSelectReturnView) {
                    const ret = routineSelectReturnView;
                    setRoutineSelectReturnView(null);
                    setCurrentView(ret);
                  } else setCurrentView('home');
                }}
                className="kinetic-btn"
                style={{
                  padding: '8px 12px', backgroundColor: '#161616', border: '2px solid var(--dp-color-rule)',
                  color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                }}
              >
                <SFSymbol name="chevron.backward" size={16} color="var(--dp-color-accent)" />
                <span>BACK</span>
              </button>
            )}

            <div
              style={{
                fontSize: '14px', fontWeight: 800, letterSpacing: '-0.03em',
                textTransform: 'uppercase', color: '#FFFFFF', textAlign: 'center', flex: 1,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
              }}
            >
              {currentView !== 'home' ? "You Can't Cry in Here" : ''}
            </div>

            <div style={{ width: '40px' }} />
          </div>

          {isRoutineEditorView && currentEditorWorkout && (
            <SessionRestTimerBar
              defaultRestSeconds={currentEditorWorkout.defaultRestSeconds || 90}
              timerTrigger={timerTrigger}
              nextLiftInfo={getNextIncompleteSetInfo(currentEditorWorkout.slots)}
              onChangeDefaultRest={sec => {
                updateCurrentWorkoutState(prev => ({ ...prev, defaultRestSeconds: sec }));
                setTimerTrigger(prev => ({ ...prev, targetSeconds: sec }));
              }}
              onStopTimer={() => setTimerTrigger(prev => ({ ...prev, isRunning: false, startedAtMs: null }))}
            />
          )}
        </header>

        {/* SLIDE-OUT HAMBURGER DRAWER */}
        {showHamburgerDrawer && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex'
            }}
            onClick={() => setShowHamburgerDrawer(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '300px', maxWidth: '82vw', height: '100%', backgroundColor: '#101010',
                borderRight: '2px solid var(--dp-color-rule)', padding: '20px 16px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '24px', fontWeight: 800, letterSpacing: '-0.045em', textTransform: 'uppercase',
                    borderBottom: '2px solid var(--dp-color-rule)', paddingBottom: '12px', marginBottom: '16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <span>MENU</span>
                  <button
                    type="button"
                    onClick={() => setShowHamburgerDrawer(false)}
                    style={{
                      background: 'var(--dp-color-accent)', color: '#101010', border: 'none',
                      padding: '4px 8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHamburgerDrawer(false);
                      setCurrentView(user ? 'profile' : 'auth');
                    }}
                    className="kinetic-btn"
                    style={UI.drawerBtn(true)}
                  >
                    <span>{user ? `00 / PROFILE (@${user.username})` : '00 / SIGN IN'}</span>
                    <span>→</span>
                  </button>

                  {[
                    { id: 'routines', label: '01 / ROUTINES', clearReturn: true },
                    { id: 'gyms', label: '02 / GYMS/EQUIPMENT' },
                    { id: 'goals', label: '03 / GOALS' },
                    { id: 'settings', label: '04 / SETTINGS' },
                    { id: 'info', label: '05 / INFO' }
                  ].map(nav => (
                    <button
                      key={nav.id}
                      type="button"
                      onClick={() => {
                        setShowHamburgerDrawer(false);
                        if (nav.clearReturn) setRoutineSelectReturnView(null);
                        setCurrentView(nav.id);
                      }}
                      className="kinetic-btn"
                      style={UI.drawerBtn(false)}
                    >
                      <span>{nav.label}</span>
                      <span>→</span>
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  borderTop: '2px solid var(--dp-color-rule)', paddingTop: '12px',
                  fontSize: '11px', color: '#888888', fontWeight: 700, textTransform: 'uppercase'
                }}
              >
                LOGGED IN: {user ? user.email : 'OFFLINE'}
              </div>
            </div>
          </div>
        )}

        {/* PERSISTENT LOGGED-OUT ORANGE NOTIFICATION BAR */}
        {!user && (
          <div
            style={{
              margin: '12px var(--dp-spacing-gutter) 0', padding: '12px 14px',
              backgroundColor: 'var(--dp-color-accent)', color: '#101010', border: '2px solid #FFFFFF',
              fontWeight: 800, fontSize: '12px', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap'
            }}
          >
            <span>NOT SIGNED IN</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setCurrentView('auth');
                }}
                className="kinetic-btn"
                style={{
                  background: '#101010', color: '#FFFFFF', border: '2px solid #101010',
                  padding: '5px 10px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                }}
              >
                SIGN IN
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setCurrentView('auth');
                }}
                className="kinetic-btn"
                style={{
                  background: '#FFFFFF', color: '#101010', border: '2px solid #101010',
                  padding: '5px 10px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                }}
              >
                CREATE ACCOUNT
              </button>
            </div>
          </div>
        )}

        {/* MAIN VIEWPORT CONTENT */}
        <div style={{ flex: 1, paddingBottom: '48px' }}>
          {currentView === 'home' && (
            <HomeView
              colors={colors}
              handleOpenNewSession={handleOpenNewSession}
              handleOpenNewAutoSession={handleOpenNewAutoSession}
              setCurrentView={setCurrentView}
              setRoutineSelectReturnView={setRoutineSelectReturnView}
              marqueePaused={marqueePaused}
              setMarqueePaused={setMarqueePaused}
              friendsList={friendsList}
              pendingIncomingRequests={pendingIncomingRequests}
            />
          )}

          {isRoutineEditorView && currentEditorWorkout && (
            <RoutineEditorView
              colors={colors}
              currentView={currentView}
              currentEditorWorkout={currentEditorWorkout}
              routineSelectReturnView={routineSelectReturnView}
              setRoutineSelectReturnView={setRoutineSelectReturnView}
              setCurrentView={setCurrentView}
              selectedGymId={selectedGymId}
              setSelectedGymId={setSelectedGymId}
              gyms={gyms}
              history={history}
              oneRepMaxes={oneRepMaxes}
              newSlotCategory={newSlotCategory}
              setAddSlotGymFilter={setAddSlotGymFilter}
              setNewSlotEx1={setNewSlotEx1}
              setNewSlotSupersetIds={setNewSlotSupersetIds}
              setShowAddSlotModal={setShowAddSlotModal}
              setHistoricalDraft={setHistoricalDraft}
              setDeleteConfirmTarget={setDeleteConfirmTarget}
              isCurrentEditorShared={isCurrentEditorShared}
              updateCurrentWorkoutState={updateCurrentWorkoutState}
              handleApplyPreviewRoutine={handleApplyPreviewRoutine}
              handleAutoBuildWorkout={handleAutoBuildWorkout}
              handleSaveCurrentEditor={handleSaveCurrentEditor}
              handleShareCurrentEditor={handleShareCurrentEditor}
              handleResetCurrentEditor={handleResetCurrentEditor}
              handleUpdateSlotCategoryOrExercise={handleUpdateSlotCategoryOrExercise}
              handleUpdateSetField={handleUpdateSetField}
              handleUpdateSetType={handleUpdateSetType}
              handleInsertSetAtPosition={handleInsertSetAtPosition}
              handleRecalculateSlotWeights={handleRecalculateSlotWeights}
              handleToggleSetDone={handleToggleSetDone}
              openPlateCalculatorForSet={openPlateCalculatorForSet}
            />
          )}

          {currentView === 'routines' && (
            <RoutinesView
              colors={colors}
              savedRoutines={savedRoutines}
              sharedRoutines={sharedRoutines}
              friendsList={friendsList}
              routineSelectReturnView={routineSelectReturnView}
              handleOpenPreviewRoutine={handleOpenPreviewRoutine}
              handleDirectLoadRoutine={handleDirectLoadRoutine}
            />
          )}

          {currentView === 'history' && (
            <HistoryView
              colors={colors}
              history={history}
              historySessionsExpanded={historySessionsExpanded}
              setHistorySessionsExpanded={setHistorySessionsExpanded}
              expandedHistoryWorkoutId={expandedHistoryWorkoutId}
              setExpandedHistoryWorkoutId={setExpandedHistoryWorkoutId}
              historyPRsExpanded={historyPRsExpanded}
              setHistoryPRsExpanded={setHistoryPRsExpanded}
              oneRepMaxes={oneRepMaxes}
              targetStandardClass={targetStandardClass}
              userBodyweightLbs={userBodyweightLbs}
              totalHeightInches={totalHeightInches}
              customGoalWeights={customGoalWeights}
              setHistoricalDraft={setHistoricalDraft}
              setCurrentView={setCurrentView}
              openPlateCalculatorForPR={openPlateCalculatorForPR}
            />
          )}

          {currentView === 'gyms' && (
            <GymsView
              colors={colors}
              gyms={gyms}
              selectedGymId={selectedGymId}
              setSelectedGymId={setSelectedGymId}
              setGymDraft={setGymDraft}
              setCurrentView={setCurrentView}
            />
          )}

          {currentView === 'gym_editor' && gymDraft && (
            <GymEditorView
              colors={colors}
              gymDraft={gymDraft}
              setGymDraft={setGymDraft}
              setGyms={setGyms}
              setSelectedGymId={setSelectedGymId}
              setCurrentView={setCurrentView}
            />
          )}

          {currentView === 'goals' && (
            <GoalsView
              colors={colors}
              goalType={goalType}
              setGoalType={setGoalType}
              goalUnit={goalUnit}
              setGoalUnit={setGoalUnit}
              goalIncrement={goalIncrement}
              setGoalIncrement={setGoalIncrement}
              userBodyweightLbs={userBodyweightLbs}
              userHeightFeet={userHeightFeet}
              userHeightInches={userHeightInches}
              totalHeightInches={totalHeightInches}
              targetStandardClass={targetStandardClass}
              setTargetStandardClass={setTargetStandardClass}
              oneRepMaxes={oneRepMaxes}
              customGoalWeights={customGoalWeights}
              openPlateCalculatorForGoal={openPlateCalculatorForGoal}
            />
          )}

          {currentView === 'progression_chart' && (
            <ProgressionChartView
              colors={colors}
              chartMetric={chartMetric}
              setChartMetric={setChartMetric}
              selectedChartLift={selectedChartLift}
              setSelectedChartLift={setSelectedChartLift}
              progressionSeriesByLift={progressionSeriesByLift}
              oneRepMaxes={oneRepMaxes}
              targetStandardClass={targetStandardClass}
              userBodyweightLbs={userBodyweightLbs}
              totalHeightInches={totalHeightInches}
              customGoalWeights={customGoalWeights}
            />
          )}

          {currentView === 'stimulus_map' && (
            <StimulusMapView
              colors={colors}
              stimulusGreenDays={stimulusGreenDays}
              stimulusYellowDays={stimulusYellowDays}
              muscleStimulusStatus={muscleStimulusStatus}
            />
          )}

          {currentView === 'leaderboard' && (
            <LeaderboardView
              colors={colors}
              user={user}
              oneRepMaxes={oneRepMaxes}
              friendsList={friendsList}
            />
          )}

          {currentView === 'social' && (
            <SocialView
              colors={colors}
              friendSearchQuery={friendSearchQuery}
              setFriendSearchQuery={setFriendSearchQuery}
              pendingIncomingRequests={pendingIncomingRequests}
              setPendingIncomingRequests={setPendingIncomingRequests}
              friendsList={friendsList}
              setFriendsList={setFriendsList}
              setViewingFriendProfile={setViewingFriendProfile}
              setCurrentView={setCurrentView}
            />
          )}

          {(currentView === 'profile' || currentView === 'friend_profile') && (
            <ProfileView
              colors={colors}
              currentView={currentView}
              viewingFriendProfile={viewingFriendProfile}
              user={user}
              setUser={setUser}
              setCurrentView={setCurrentView}
              fileInputRef={fileInputRef}
              oneRepMaxes={oneRepMaxes}
              sharedRoutines={sharedRoutines}
              openPlateCalculatorForPR={openPlateCalculatorForPR}
              handleOpenPreviewRoutine={handleOpenPreviewRoutine}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView
              colors={colors}
              userBodyweightLbs={userBodyweightLbs}
              setUserBodyweightLbs={setUserBodyweightLbs}
              userHeightFeet={userHeightFeet}
              setUserHeightFeet={setUserHeightFeet}
              userHeightInches={userHeightInches}
              setUserHeightInches={setUserHeightInches}
              stimulusGreenDays={stimulusGreenDays}
              setStimulusGreenDays={setStimulusGreenDays}
              stimulusYellowDays={stimulusYellowDays}
              setStimulusYellowDays={setStimulusYellowDays}
              routinePreferences={routinePreferences}
              setRoutinePreferences={setRoutinePreferences}
              shareStatsWithFriends={shareStatsWithFriends}
              setShareStatsWithFriends={setShareStatsWithFriends}
              shareRoutinesWithFriends={shareRoutinesWithFriends}
              setShareRoutinesWithFriends={setShareRoutinesWithFriends}
              importBackupInputRef={importBackupInputRef}
              handleExportBackupJSON={handleExportBackupJSON}
              handleImportBackupJSON={handleImportBackupJSON}
              handleResetToDemoDefaults={handleResetToDemoDefaults}
            />
          )}

          {currentView === 'info' && (
            <InfoView
              colors={colors}
              setCurrentView={setCurrentView}
            />
          )}

          {currentView === 'auth' && (
            <AuthView
              colors={colors}
              authUsername={authUsername}
              setAuthUsername={setAuthUsername}
              authEmail={authEmail}
              setAuthEmail={setAuthEmail}
              authPassword={authPassword}
              setAuthPassword={setAuthPassword}
              signupUsername={signupUsername}
              setSignupUsername={setSignupUsername}
              signupEmail={signupEmail}
              setSignupEmail={setSignupEmail}
              signupPassword={signupPassword}
              setSignupPassword={setSignupPassword}
              signupBetaCode={signupBetaCode}
              setSignupBetaCode={setSignupBetaCode}
              setUser={setUser}
              setCurrentView={setCurrentView}
            />
          )}
        </div>

        {/* MODALS */}
        <DeleteConfirmModal
          deleteConfirmTarget={deleteConfirmTarget}
          setDeleteConfirmTarget={setDeleteConfirmTarget}
          handleConfirmDeleteAction={handleConfirmDeleteAction}
        />

        <AddSlotModal
          showAddSlotModal={showAddSlotModal}
          setShowAddSlotModal={setShowAddSlotModal}
          addSlotGymFilter={addSlotGymFilter}
          setAddSlotGymFilter={setAddSlotGymFilter}
          newSlotCategory={newSlotCategory}
          setNewSlotCategory={setNewSlotCategory}
          newSlotEx1={newSlotEx1}
          setNewSlotEx1={setNewSlotEx1}
          newSlotSupersetIds={newSlotSupersetIds}
          setNewSlotSupersetIds={setNewSlotSupersetIds}
          newSlotScheme={newSlotScheme}
          setNewSlotScheme={setNewSlotScheme}
          gyms={gyms}
          handleAddManualSlot={handleAddManualSlot}
        />

        <PlateCalculatorModal
          plateCalcTarget={plateCalcTarget}
          setPlateCalcTarget={setPlateCalcTarget}
          computedPlateCalculatorTotal={computedPlateCalculatorTotal}
          calcUnit={calcUnit}
          calcMode={calcMode}
          setCalcMode={setCalcMode}
          calcBarWeight={calcBarWeight}
          calcPlatesPerSide={calcPlatesPerSide}
          setCalcPlatesPerSide={setCalcPlatesPerSide}
          calcDirectTotal={calcDirectTotal}
          setCalcDirectTotal={setCalcDirectTotal}
          handleApplyCalculatedWeight={handleApplyCalculatedWeight}
        />
      </div>
    </div>
  );
}
