'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { IOS_DARK, KINETIC_CSS, UI } from './styles/kineticTokens';
import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  BIG_FOUR_IDS,
  MUSCLE_GROUP_OPTIONS,
  normalizeSlotCategory,
  isSupersetCategory,
  doesExerciseInteractWithMuscleGroup,
  getDefaultSessionName,
  getDefaultAutoSessionName,
  formatTodayYMD,
  formatTitleWithDate,
  isExerciseCompatibleWithGymSelection,
  filterAddSlotExercises,
  getFilteredExercisesForSlotInline,
  getAvailableMuscleGroupsForCategory,
  roundTo5,
  roundToIncrement
} from './data/exerciseLibrary';
import {
  getBestHistory1RM,
  getPersonalRecord1RM,
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
  DEFAULT_MATT_FRIEND,
  ensureDefaultMattFriend,
  normalizeWorkoutFromStorage,
  normalizeSlotFromStorage,
  loadHydratedAppState
} from './utils/storageMigration';
import {
  fetchCloudStateForUser,
  pushCloudStateForUser
} from './utils/supabaseAuth';
import { SFSymbol, SessionRestTimerBar } from './components/Primitives';
import {
  DeleteConfirmModal,
  AddSlotModal,
  PlateCalculatorModal,
  SetValueEditorModal,
  SaveConfirmModal,
  HistoricalEditConfirmModal,
  FeedbackModal
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
  const [isStorageHydrated, setIsStorageHydrated] = useState(false);

  // --- Navigation & Drawer State ---
  const [currentView, setCurrentView] = useState('home');
  const [showHamburgerDrawer, setShowHamburgerDrawer] = useState(false);
  const [marqueePaused, setMarqueePaused] = useState(false);
  const importBackupInputRef = useRef(null);

  // --- User & Auth State ---
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupBetaCode, setSignupBetaCode] = useState('');
  const [recoveryAccessToken, setRecoveryAccessToken] = useState(null);
  const fileInputRef = useRef(null);

  // --- 1RM & History State ---
  const [oneRepMaxes, setOneRepMaxes] = useState(() => getInitial1RMs());
  const [history, setHistory] = useState([]);

  // --- Active Session, Historical Entry, Routine Editor & Preview State ---
  const [activeSession, setActiveSession] = useState(null);
  const [historicalDraft, setHistoricalDraft] = useState(null);
  const [routineDraft, setRoutineDraft] = useState(null);
  const [previewRoutineDraft, setPreviewRoutineDraft] = useState(null);
  const [routineSelectReturnView, setRoutineSelectReturnView] = useState(null);
  const [isCurrentEditorShared, setIsCurrentEditorShared] = useState(false);

  // --- Delete Confirmation Modal State (for Exercise Slot or Individual Set) ---
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  // --- Save Confirmation, Historical Edit Confirmation, Routines Back & Feedback Modal States ---
  const [saveConfirmTarget, setSaveConfirmTarget] = useState(null);
  const [historicalEditConfirmTarget, setHistoricalEditConfirmTarget] = useState(null);
  const [confirmedHistoryEditWorkoutId, setConfirmedHistoryEditWorkoutId] = useState(null);
  const [openedFromRoutines, setOpenedFromRoutines] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [sessionLogs, setSessionLogs] = useState([]);

  const appendSessionLog = (type, detail) => {
    setSessionLogs(prev => [
      ...prev.slice(-99),
      {
        timestamp: new Date().toISOString(),
        type,
        detail
      }
    ]);
  };

  // --- Add Exercise Modal State ---
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [addSlotGymFilter, setAddSlotGymFilter] = useState('');
  const [newSlotCategory, setNewSlotCategory] = useState('Compound Lift');
  const [newSlotMuscleGroup, setNewSlotMuscleGroup] = useState('All Muscles');
  const [newSlotEx1, setNewSlotEx1] = useState('barbell_bench_press');
  const [newSlotSupersetIds, setNewSlotSupersetIds] = useState(['reverse_lunge', 'front_flies']);
  const [newSlotScheme, setNewSlotScheme] = useState('5x8');

  // --- Saved & Shared Routines State ---
  const [savedRoutines, setSavedRoutines] = useState([]);
  const [sharedRoutines, setSharedRoutines] = useState([]);

  // --- Gyms & Gym Editor State ---
  const [gyms, setGyms] = useState([]);
  const [selectedGymId, setSelectedGymId] = useState('');
  const [gymDraft, setGymDraft] = useState(null);

  // --- Goals, Standards & Settings State ---
  const [goalType, setGoalType] = useState('Strength');
  const [goalIncrement, setGoalIncrement] = useState(1.25);
  const [goalUnit, setGoalUnit] = useState('lb');
  const [chartMetric, setChartMetric] = useState('weight');
  const [selectedChartLift, setSelectedChartLift] = useState('ALL');
  const [targetStandardClass, setTargetStandardClass] = useState('Intermediate');
  const [customGoalWeights, setCustomGoalWeights] = useState({});

  const [userBodyweightLbs, setUserBodyweightLbs] = useState(220);
  const [userHeightFeet, setUserHeightFeet] = useState(5);
  const [userHeightInches, setUserHeightInches] = useState(10);
  const [stimulusGreenDays, setStimulusGreenDays] = useState(2);
  const [stimulusYellowDays, setStimulusYellowDays] = useState(4);
  const [routinePreferences, setRoutinePreferences] = useState([
    'Compound Lift', 'Compound Lift', 'Superset', 'Superset', 'Abs'
  ]);
  const [shareStatsWithFriends, setShareStatsWithFriends] = useState(true);
  const [shareRoutinesWithFriends, setShareRoutinesWithFriends] = useState(true);

  // --- History Page Collapsible Sections State ---
  const [historySessionsExpanded, setHistorySessionsExpanded] = useState(true);
  const [historyPRsExpanded, setHistoryPRsExpanded] = useState(true);
  const [expandedHistoryWorkoutId, setExpandedHistoryWorkoutId] = useState(null);

  // --- Social & Friends State ---
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendsList, setFriendsList] = useState(() => [DEFAULT_MATT_FRIEND]);
  const [pendingIncomingRequests, setPendingIncomingRequests] = useState([]);
  const [outgoingInvites, setOutgoingInvites] = useState([]);
  const [viewingFriendProfile, setViewingFriendProfile] = useState(null);

  // --- Client-Side LocalStorage Hydration & Recovery Hash Detection Effect ---
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hydrated = loadHydratedAppState();
    if (hydrated) {
      setUser(hydrated.user !== undefined ? hydrated.user : null);
      if (hydrated.user?.username) setAuthUsername(hydrated.user.username);
      if (hydrated.user?.email) setAuthEmail(hydrated.user.email);
      if (hydrated.oneRepMaxes) setOneRepMaxes(hydrated.oneRepMaxes);
      if (hydrated.history) setHistory(hydrated.history);
      if (hydrated.activeSession) setActiveSession(hydrated.activeSession);
      if (hydrated.savedRoutines) setSavedRoutines(hydrated.savedRoutines);
      if (hydrated.sharedRoutines) setSharedRoutines(hydrated.sharedRoutines);
      if (hydrated.gyms) setGyms(hydrated.gyms);
      setFriendsList(ensureDefaultMattFriend(hydrated.friendsList));
      if (hydrated.pendingIncomingRequests) setPendingIncomingRequests(hydrated.pendingIncomingRequests);
      if (hydrated.outgoingInvites) setOutgoingInvites(hydrated.outgoingInvites);
      if (hydrated.settings) {
        setSelectedGymId(hydrated.settings.selectedGymId || '');
        if (hydrated.settings.goals) {
          setGoalType(hydrated.settings.goals.goalType || 'Strength');
          setGoalIncrement(hydrated.settings.goals.goalIncrement ?? 1.25);
          setGoalUnit(hydrated.settings.goals.goalUnit || 'lb');
          setChartMetric(hydrated.settings.goals.chartMetric || 'weight');
          setTargetStandardClass(hydrated.settings.goals.targetStandardClass || 'Intermediate');
          setCustomGoalWeights(hydrated.settings.goals.customGoalWeights || {});
        }
        if (hydrated.settings.bodyMetrics) {
          setUserBodyweightLbs(hydrated.settings.bodyMetrics.bodyweightLbs ?? 220);
          setUserHeightFeet(hydrated.settings.bodyMetrics.heightFeet ?? 5);
          setUserHeightInches(hydrated.settings.bodyMetrics.heightInches ?? 10);
        }
        if (hydrated.settings.stimulus) {
          setStimulusGreenDays(hydrated.settings.stimulus.greenDays ?? 2);
          setStimulusYellowDays(hydrated.settings.stimulus.yellowDays ?? 4);
        }
        if (hydrated.settings.routinePreferences) {
          setRoutinePreferences(hydrated.settings.routinePreferences);
        }
        if (hydrated.settings.social) {
          setShareStatsWithFriends(hydrated.settings.social.shareStatsWithFriends ?? true);
          setShareRoutinesWithFriends(hydrated.settings.social.shareRoutinesWithFriends ?? true);
        }
      }
    }
    setIsStorageHydrated(true);

    const hash = window.location.hash || '';
    if (hash.includes('type=recovery') && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const token = params.get('access_token');
      if (token) {
        setRecoveryAccessToken(token);
        setCurrentView('auth');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, []);

  const currentIncrementLbs = useMemo(
    () => getIncrementInLbs(goalIncrement, goalUnit, goalType),
    [goalIncrement, goalUnit, goalType]
  );

  const cloudSyncReadyForUserKeyRef = useRef(null);

  // --- Cross-Device Cloud Pull & Merge Effect on Sign-In / Startup ---
  useEffect(() => {
    if (typeof window === 'undefined' || !isStorageHydrated) return;
    const userKey = user?.id || user?.email || user?.username || null;
    if (!userKey) {
      cloudSyncReadyForUserKeyRef.current = null;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const cloud = await fetchCloudStateForUser(user);
        if (cancelled) return;

        if (cloud && typeof cloud === 'object') {
          if (cloud.oneRepMaxes && typeof cloud.oneRepMaxes === 'object') {
            setOneRepMaxes(prev => {
              const merged = { ...getInitial1RMs(), ...(prev || {}) };
              Object.entries(cloud.oneRepMaxes).forEach(([exId, val]) => {
                const cloudVal = Number(val) || 0;
                const localVal = Number(merged[exId]) || 0;
                if (cloudVal > localVal) merged[exId] = cloudVal;
              });
              return merged;
            });
          }

          if (Array.isArray(cloud.history) && cloud.history.length > 0) {
            setHistory(prev => {
              const byId = new Map();
              (Array.isArray(prev) ? prev : []).forEach(w => {
                if (w && w.id) byId.set(w.id, normalizeWorkoutFromStorage(w));
              });
              cloud.history.forEach(w => {
                if (w && w.id && !byId.has(w.id)) {
                  byId.set(w.id, normalizeWorkoutFromStorage(w));
                }
              });
              return Array.from(byId.values()).sort(
                (a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime()
              );
            });
          }

          if (cloud.activeSession && typeof cloud.activeSession === 'object') {
            setActiveSession(prev => prev || normalizeWorkoutFromStorage(cloud.activeSession));
          }

          if (Array.isArray(cloud.savedRoutines) && cloud.savedRoutines.length > 0) {
            setSavedRoutines(prev => {
              const byKey = new Map();
              (Array.isArray(prev) ? prev : []).forEach(r => {
                if (r && r.key) byKey.set(r.key, r);
              });
              cloud.savedRoutines.forEach(r => {
                if (r && r.key && !byKey.has(r.key)) {
                  byKey.set(r.key, {
                    ...r,
                    slots: Array.isArray(r.slots) ? r.slots.map(normalizeSlotFromStorage) : []
                  });
                }
              });
              return Array.from(byKey.values());
            });
          }

          if (Array.isArray(cloud.sharedRoutines) && cloud.sharedRoutines.length > 0) {
            setSharedRoutines(prev => {
              const byKey = new Map();
              (Array.isArray(prev) ? prev : []).forEach(r => {
                if (r && r.key) byKey.set(r.key, r);
              });
              cloud.sharedRoutines.forEach(r => {
                if (r && r.key && !byKey.has(r.key)) {
                  byKey.set(r.key, {
                    ...r,
                    slots: Array.isArray(r.slots) ? r.slots.map(normalizeSlotFromStorage) : []
                  });
                }
              });
              return Array.from(byKey.values());
            });
          }

          if (Array.isArray(cloud.gyms) && cloud.gyms.length > 0) {
            setGyms(prev => {
              const byId = new Map();
              (Array.isArray(prev) ? prev : []).forEach(g => {
                if (g && g.id) byId.set(g.id, g);
              });
              cloud.gyms.forEach(g => {
                if (g && g.id && !byId.has(g.id)) byId.set(g.id, g);
              });
              return Array.from(byId.values());
            });
          }

          if (Array.isArray(cloud.friendsList) && cloud.friendsList.length > 0) {
            setFriendsList(prev => {
              const byKey = new Map();
              ensureDefaultMattFriend(prev).forEach(f => {
                const k = String(f.username || f.email || f.id).toLowerCase();
                byKey.set(k, f);
              });
              cloud.friendsList.forEach(f => {
                if (!f) return;
                const k = String(f.username || f.email || f.id).toLowerCase();
                if (!byKey.has(k)) byKey.set(k, f);
              });
              return ensureDefaultMattFriend(Array.from(byKey.values()));
            });
          }

          if (cloud.settings && typeof cloud.settings === 'object') {
            if (cloud.settings.selectedGymId !== undefined) {
              setSelectedGymId(prev => prev || cloud.settings.selectedGymId || '');
            }
            if (cloud.settings.bodyMetrics) {
              if (cloud.settings.bodyMetrics.bodyweightLbs) setUserBodyweightLbs(cloud.settings.bodyMetrics.bodyweightLbs);
              if (cloud.settings.bodyMetrics.heightFeet !== undefined) setUserHeightFeet(cloud.settings.bodyMetrics.heightFeet);
              if (cloud.settings.bodyMetrics.heightInches !== undefined) setUserHeightInches(cloud.settings.bodyMetrics.heightInches);
            }
            if (cloud.settings.goals) {
              if (cloud.settings.goals.goalType) setGoalType(cloud.settings.goals.goalType);
              if (cloud.settings.goals.goalIncrement !== undefined) setGoalIncrement(cloud.settings.goals.goalIncrement);
              if (cloud.settings.goals.goalUnit) setGoalUnit(cloud.settings.goals.goalUnit);
              if (cloud.settings.goals.targetStandardClass) setTargetStandardClass(cloud.settings.goals.targetStandardClass);
              if (cloud.settings.goals.customGoalWeights) {
                setCustomGoalWeights(prev => ({ ...(cloud.settings.goals.customGoalWeights || {}), ...(prev || {}) }));
              }
            }
            if (cloud.settings.stimulus) {
              if (cloud.settings.stimulus.greenDays !== undefined) setStimulusGreenDays(cloud.settings.stimulus.greenDays);
              if (cloud.settings.stimulus.yellowDays !== undefined) setStimulusYellowDays(cloud.settings.stimulus.yellowDays);
            }
            if (Array.isArray(cloud.settings.routinePreferences) && cloud.settings.routinePreferences.length > 0) {
              setRoutinePreferences(cloud.settings.routinePreferences);
            }
            if (cloud.settings.social) {
              if (cloud.settings.social.shareStatsWithFriends !== undefined) {
                setShareStatsWithFriends(cloud.settings.social.shareStatsWithFriends);
              }
              if (cloud.settings.social.shareRoutinesWithFriends !== undefined) {
                setShareRoutinesWithFriends(cloud.settings.social.shareRoutinesWithFriends);
              }
            }
          }
        }
      } catch {
        // ignore cloud pull error
      } finally {
        if (!cancelled) {
          cloudSyncReadyForUserKeyRef.current = userKey;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isStorageHydrated, user?.id, user?.email, user?.username]);

  // --- Debounced Automatic Versioned Persistence & Cloud Sync Effect ---
  useEffect(() => {
    if (typeof window === 'undefined' || !isStorageHydrated) return;
    const debounceTimer = setTimeout(() => {
      try {
        const payload = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
          user, oneRepMaxes, history, activeSession, savedRoutines, sharedRoutines,
          gyms, friendsList, pendingIncomingRequests, outgoingInvites,
          settings: {
            schemaVersion: CURRENT_SCHEMA_VERSION,
            prDefaultsCleanedV4: true,
            bodyMetrics: { bodyweightLbs: userBodyweightLbs, heightFeet: userHeightFeet, heightInches: userHeightInches },
            goals: { goalType, goalIncrement, goalUnit, chartMetric, targetStandardClass, customGoalWeights },
            stimulus: { greenDays: stimulusGreenDays, yellowDays: stimulusYellowDays },
            routinePreferences,
            social: { shareStatsWithFriends, shareRoutinesWithFriends },
            selectedGymId
          }
        };
        window.localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(payload));

        const userKey = user?.id || user?.email || user?.username || null;
        if (user && userKey && cloudSyncReadyForUserKeyRef.current === userKey) {
          pushCloudStateForUser(user, payload);
        }
      } catch (err) {
        console.warn('Failed to save state to localStorage:', err);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [
    isStorageHydrated,
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
    setFriendsList([DEFAULT_MATT_FRIEND]);
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
    setRoutinePreferences(['Compound Lift', 'Compound Lift', 'Superset', 'Superset', 'Abs']);
    setShareStatsWithFriends(true);
    setShareRoutinesWithFriends(true);
    setSelectedGymId('');
  };

  // --- Plate & Weight Calculator Modal State + Set Value Editor Modal State ---
  const [plateCalcTarget, setPlateCalcTarget] = useState(null);
  const [setValueTarget, setSetValueTarget] = useState(null);
  const [calcUnit, setCalcUnit] = useState('lb');
  const [calcMode, setCalcMode] = useState('per_side');
  const [calcBarWeight, setCalcBarWeight] = useState(45);
  const [calcPlatesPerSide, setCalcPlatesPerSide] = useState([]);
  const [calcDirectTotal, setCalcDirectTotal] = useState(135);
  const [prRecordDate, setPrRecordDate] = useState('');

  // --- Computed Personal Records (Updated from Highest Calculated 1RM in History + Manual Overrides) ---
  const effectiveOneRepMaxes = useMemo(() => {
    const map = {};
    EXERCISE_LIBRARY.forEach(ex => {
      const best = getPersonalRecord1RM(ex.id, history, oneRepMaxes);
      if (best > 0) map[ex.id] = best;
    });
    return map;
  }, [history, oneRepMaxes]);

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
    const groups = MUSCLE_GROUP_OPTIONS.filter(g => g !== 'All Muscles');
    const result = {};

    groups.forEach(g => {
      let minDays = 99;
      if (stimulusNowMs !== null) {
        history.forEach(w => {
          const daysAgo = Math.max(0, Math.floor((stimulusNowMs - new Date(w.startedAt).getTime()) / 86400000));
          (w.slots || []).forEach(slot => {
            const ids =
              isSupersetCategory(slot.category) && slot.supersetExerciseIds
                ? slot.supersetExerciseIds
                : [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
            ids.forEach(id => {
              const ex = EXERCISE_MAP[id];
              if (ex && doesExerciseInteractWithMuscleGroup(ex, g) && daysAgo < minDays) {
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

  useEffect(() => {
    appendSessionLog('VIEW_CHANGE', `Navigated to view: ${currentView}`);
    if (currentView !== 'history') {
      setConfirmedHistoryEditWorkoutId(null);
    }
  }, [currentView]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      if (openedFromRoutines) {
        setOpenedFromRoutines(false);
        setCurrentView('routines');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [openedFromRoutines]);

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
        appendSessionLog('HISTORY_EDIT', `Edited historical workout: ${targetWorkout?.title || targetHistId}`);
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
    const compatAbs = compatiblePool.filter(e => e.category === 'Abs');

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
        if (pref === 'Accessory') {
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
    appendSessionLog('LOAD_ROUTINE', `Loaded routine: ${routineLabel}`);

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

    appendSessionLog('AUTO_BUILD', `Generated auto workout: ${autoTitle}`);

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

    // Save or update in Saved Routines under the confirmed name
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

    // Share or unshare with friends based on confirmation choice
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

    appendSessionLog('SAVE_WORKOUT', `Saved "${finalTitle}" (shareWithFriends=${shouldShare})`);
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
      const iso = new Date(`${currentWorkout.workoutDate || '2026-10-28'}T12:00:00`).toISOString();
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

      // If the deleted history entry had sets that matched stored manual oneRepMaxes, recalculate from remaining history
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
      appendSessionLog('DELETE_HISTORY', `Deleted history workout: ${deleteConfirmTarget.label || targetWorkoutId}`);
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

        const nextCategory = normalizeSlotCategory(changes.category ?? slot.category);
        const availMuscleGroups = getAvailableMuscleGroupsForCategory(nextCategory, selectedGymId, gyms);
        const rawNextMuscleFilter =
          changes.muscleGroupFilter !== undefined
            ? changes.muscleGroupFilter
            : changes.exerciseId && EXERCISE_MAP[changes.exerciseId]?.muscleGroup
              ? EXERCISE_MAP[changes.exerciseId].muscleGroup
              : slot.muscleGroupFilter || currentEx.muscleGroup || 'All Muscles';
        const nextMuscleFilter = availMuscleGroups.includes(rawNextMuscleFilter)
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
            const totalCount = existingList.length || 5;
            return existingList.map((st, sIdx) => {
              const lastW = calculateLastEquivalentWeightForSet(calcMax, st, totalCount, 'Superset');
              const nextW = st.type === '1 Rep Max' ? roundTo5(calcMax) : roundToIncrement(lastW + currentIncrementLbs);
              return { ...st, setNumber: sIdx + 1, lastWeight: lastW, weight: nextW };
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

        const applyFieldChange = (st, exId, totalCount) => {
          if (st.id !== setId) return st;
          const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
          const lastW =
            st.lastWeight !== undefined
              ? st.lastWeight
              : calculateLastEquivalentWeightForSet(calc1RM, st, totalCount, slot.category);

          if (field === 'increment') {
            const rawStr = String(rawVal ?? '');
            const cleanStr = rawStr.replace(/^\+/, '');
            if (cleanStr === '' || cleanStr === '-' || cleanStr === '.' || cleanStr === '-.') {
              return { ...st, increment: cleanStr, weight: Math.max(0, roundToIncrement(lastW)) };
            }
            const incNum = Number(cleanStr);
            const safeInc = Number.isNaN(incNum) ? 0 : incNum;
            const nextWeight = Math.max(0, roundToIncrement(lastW + safeInc));
            return { ...st, increment: cleanStr.endsWith('.') ? cleanStr : safeInc, weight: nextWeight };
          }

          const val = Math.max(0, Number(rawVal) || 0);
          if (field === 'weight') {
            const nextInc = Math.round((val - lastW) * 100) / 100;
            return { ...st, weight: val, increment: nextInc };
          }

          return { ...st, [field]: val };
        };

        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
          const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            idx === exIndex
              ? list.map(st => applyFieldChange(st, supIds[idx] || slot.exerciseId, list.length))
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
        const nextSets = (slot.sets || []).map(st => applyFieldChange(st, slot.exerciseId, totalLen));
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
              increment: 0,
              weight: roundTo5(calc1RM)
            };
          }
          const updatedSet = { ...st, type: newType };
          const lastW = calculateLastEquivalentWeightForSet(calc1RM, updatedSet, totalCount, slot.category);
          const setInc =
            st.increment !== undefined && st.increment !== '' && !Number.isNaN(Number(st.increment))
              ? Number(st.increment)
              : currentIncrementLbs;
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
            increment: slot.category === 'Abs' ? 0 : currentIncrementLbs,
            weight: slot.category === 'Abs' ? 0 : roundToIncrement(lastW + currentIncrementLbs)
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

        const recalcList = (list, exId) => {
          const currentList = Array.isArray(list) ? list : [];
          const totalCount = currentList.length;
          const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);

          if (slot.category === 'Abs') {
            return currentList.map((st, idx) => ({
              ...st,
              setNumber: idx + 1,
              lastWeight: 0,
              increment: 0,
              weight: 0
            }));
          }

          // If only 1 set remains, set weight to the calculated 1 Rep Max to achieve equivalent stress
          if (totalCount === 1) {
            const maxW = roundTo5(calc1RM);
            return currentList.map(st => ({
              ...st,
              setNumber: 1,
              lastWeight: maxW,
              increment: 0,
              weight: maxW
            }));
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
                  increment: currentIncrementLbs,
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
                type: 'Warmup',
                reps: warmupReps,
                lastWeight: warmupW,
                increment: 0,
                weight: warmupW
              };
            });
          }

          return currentList.map((st, idx) => {
            if (st.type === '1 Rep Max') {
              const maxW = roundTo5(calc1RM);
              return { ...st, setNumber: idx + 1, reps: 1, lastWeight: maxW, increment: 0, weight: maxW };
            }
            const lastW = calculateLastEquivalentWeightForSet(calc1RM, st, totalCount, slot.category);
            const setInc =
              st.increment !== undefined && st.increment !== '' && !Number.isNaN(Number(st.increment))
                ? Number(st.increment)
                : currentIncrementLbs;
            const targetW = Math.max(0, roundToIncrement(lastW + setInc));
            return { ...st, setNumber: idx + 1, lastWeight: lastW, increment: setInc, weight: targetW };
          });
        };

        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
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
    const startW = Number(currentWeight) > 0 ? Number(currentWeight) : (EXERCISE_MAP[exerciseId]?.default1RM || 135);
    decomposeWeightToPlates(startW);
    setPrRecordDate('');
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
      const roundedPR = roundTo5(finalWeightLbs);
      const exId = plateCalcTarget.exerciseId;
      const exObj = EXERCISE_MAP[exId] || {
        id: exId,
        name: plateCalcTarget.exerciseName || exId,
        category: 'Compound Lift',
        muscleGroup: 'All Muscles'
      };
      setOneRepMaxes(prev => ({
        ...prev,
        [exId]: roundedPR
      }));

      // If a date was entered for this Personal Record, create an individual History entry just for that record
      if (prRecordDate && String(prRecordDate).trim()) {
        const cleanDate = String(prRecordDate).trim();
        const ts = Date.now();
        const prSet = {
          id: `set_pr_${ts}`,
          setNumber: 1,
          type: '1 Rep Max',
          reps: 1,
          lastWeight: roundedPR,
          increment: 0,
          weight: roundedPR,
          completed: true
        };
        const prSlot = {
          id: `slot_pr_${ts}`,
          category: normalizeSlotCategory(exObj.category || 'Compound Lift'),
          slotLabel: normalizeSlotCategory(exObj.category || 'Compound Lift'),
          scheme: 'Pyramid 1RM',
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
        const isoDate = new Date(`${cleanDate}T12:00:00`).toISOString();
        const newHistEntry = {
          id: `hist_pr_${exObj.id}_${ts}`,
          title: `${cleanDate} - ${exObj.name} PR (${roundedPR} LB)`,
          loadedRoutineTitle: 'PERSONAL RECORD',
          startedAt: isoDate,
          updatedAt: new Date().toISOString(),
          isComplete: true,
          verifiedByUser: true,
          defaultRestSeconds: 90,
          slots: normalizeSlotLabels([prSlot])
        };
        setHistory(prev =>
          [newHistEntry, ...(prev || [])].sort(
            (a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime()
          )
        );
        appendSessionLog('PR_HISTORY_CREATE', `Created PR History entry for ${exObj.name} (${roundedPR} LB on ${cleanDate})`);
      }
      setPrRecordDate('');
    } else if (plateCalcTarget.mode === 'goal') {
      setCustomGoalWeights(prev => ({
        ...prev,
        [plateCalcTarget.exerciseId]: roundTo5(finalWeightLbs)
      }));
      setTargetStandardClass('Custom');
    }
    setPlateCalcTarget(null);
  };

  const handleSetPRUnknown = exerciseId => {
    if (!exerciseId) return;
    setOneRepMaxes(prev => ({
      ...prev,
      [exerciseId]: 'unknown'
    }));
  };

  const handleJumpToPRHistoryEntry = (ex, currentMax) => {
    if (!ex) return;
    // Find the logged workout in history containing ex.id with the highest weight/1RM
    let matchedWorkout = null;
    let bestEst = -1;

    (history || []).forEach(w => {
      (w?.slots || []).forEach(slot => {
        const checkSetList = (exId, list) => {
          if (exId !== ex.id || !Array.isArray(list)) return;
          list.forEach(st => {
            const wt = Number(st?.weight) || 0;
            const rp = Math.max(1, Number(st?.reps) || 1);
            const est = rp === 1 ? wt : Math.round(wt * (1 + rp / 30));
            if (est > bestEst) {
              bestEst = est;
              matchedWorkout = w;
            }
          });
          if (!matchedWorkout) matchedWorkout = w;
        };
        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
          const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          ids.forEach((id, idx) => checkSetList(id, slot.supersetSetsByExercise[idx] || []));
        } else {
          checkSetList(slot.exerciseId, slot.sets || []);
        }
      });
    });

    let targetId = matchedWorkout?.id;

    // If no logged session exists yet for this PR, create a logged PR session so the link always opens a History entry
    if (!targetId) {
      const prSlot = {
        ...createWorkoutSlot({
          category: ex.category || 'Compound Lift',
          slotLabel: ex.category || 'Compound Lift',
          exerciseId: ex.id,
          scheme: 'Pyramid 1RM',
          oneRepMaxes,
          history,
          incrementLbs: 0
        }),
        muscleGroupFilter: ex.muscleGroup || 'All Muscles'
      };
      prSlot.sets = (prSlot.sets || []).map((st, idx, arr) =>
        idx === arr.length - 1
          ? {
              ...st,
              type: '1 Rep Max',
              reps: 1,
              lastWeight: currentMax,
              increment: 0,
              weight: currentMax,
              completed: true
            }
          : { ...st, completed: true }
      );
      prSlot.supersetSetsByExercise = [prSlot.sets];

      const newHistEntry = {
        id: `hist_pr_${ex.id}_${Date.now()}`,
        title: `${formatTodayYMD()} - ${ex.name} PR (${currentMax} LB)`,
        loadedRoutineTitle: 'PERSONAL RECORD',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isComplete: true,
        verifiedByUser: true,
        defaultRestSeconds: 90,
        slots: normalizeSlotLabels([prSlot])
      };
      targetId = newHistEntry.id;
      setHistory(prev => [newHistEntry, ...prev]);
    }

    appendSessionLog('JUMP_PR_HISTORY', `Linked to History entry for ${ex.name} (${currentMax} LB)`);
    setCurrentView('history');
    setHistorySessionsExpanded(true);
    setExpandedHistoryWorkoutId(targetId);

    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const el = document.getElementById(`history-entry-${targetId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 90);
    }
  };

  const buildHistoryWorkoutEditorProps = historyWorkout => ({
    colors,
    currentView: 'history',
    currentEditorWorkout: historyWorkout,
    routineSelectReturnView,
    setRoutineSelectReturnView,
    setCurrentView,
    selectedGymId,
    setSelectedGymId,
    gyms,
    history,
    oneRepMaxes: effectiveOneRepMaxes,
    currentIncrementLbs,
    newSlotCategory,
    newSlotMuscleGroup,
    setAddSlotGymFilter,
    setNewSlotEx1,
    setNewSlotSupersetIds,
    setShowAddSlotModal,
    setHistoricalDraft,
    setDeleteConfirmTarget,
    isCurrentEditorShared,
    updateCurrentWorkoutState,
    handleApplyPreviewRoutine,
    handleAutoBuildWorkout,
    handleSaveCurrentEditor,
    handleShareCurrentEditor,
    handleResetCurrentEditor,
    handleUpdateSlotCategoryOrExercise,
    handleUpdateSetField,
    handleUpdateSetType,
    handleInsertSetAtPosition,
    handleRecalculateSlotWeights,
    handleToggleSetDone,
    handleReorderExercises,
    handleReorderSets,
    openPlateCalculatorForSet,
    setSetValueTarget,
    isEmbeddedHistorySession: true
  });

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
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setShowHamburgerDrawer(true)}
              className="kinetic-btn"
              style={{
                width: '40px', height: '40px', backgroundColor: '#161616',
                border: '2px solid var(--dp-color-rule)', color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <SFSymbol name="line.3.horizontal" size={20} color="#FFFFFF" />
            </button>

            {currentView !== 'home' ? (
              <button
                type="button"
                aria-label="Return to Home screen"
                onClick={() => {
                  setRoutineSelectReturnView(null);
                  setCurrentView('home');
                }}
                className="kinetic-btn"
                style={{
                  fontSize: '14px', fontWeight: 800, letterSpacing: '-0.03em',
                  textTransform: 'uppercase', color: '#FFFFFF', textAlign: 'center', flex: 1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  background: 'none', border: 'none', padding: '8px 4px', cursor: 'pointer'
                }}
              >
                You Can't Cry in Here
              </button>
            ) : (
              <div style={{ flex: 1 }} />
            )}

            <button
              type="button"
              aria-label="Send Feedback"
              onClick={() => setShowFeedbackModal(true)}
              className="kinetic-btn"
              style={{
                height: '40px',
                padding: '0 10px',
                backgroundColor: '#161616',
                border: '2px solid var(--dp-color-rule)',
                color: 'var(--dp-color-accent)',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              FEEDBACK
            </button>
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
        {isStorageHydrated && !user && (
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
              hasActiveSession={Boolean(activeSession?.slots?.length > 0)}
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
              oneRepMaxes={effectiveOneRepMaxes}
              currentIncrementLbs={currentIncrementLbs}
              newSlotCategory={newSlotCategory}
              newSlotMuscleGroup={newSlotMuscleGroup}
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
              handleReorderExercises={handleReorderExercises}
              handleReorderSets={handleReorderSets}
              openPlateCalculatorForSet={openPlateCalculatorForSet}
              setSetValueTarget={setSetValueTarget}
              openedFromRoutines={openedFromRoutines}
              setOpenedFromRoutines={setOpenedFromRoutines}
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
              handleCancelRoutineSelection={handleCancelRoutineSelection}
            />
          )}

          {currentView === 'history' && (
            <HistoryView
              colors={colors}
              history={history}
              historySessionsExpanded={historySessionsExpanded}
              setHistorySessionsExpanded={setHistorySessionsExpanded}
              expandedHistoryWorkoutId={expandedHistoryWorkoutId}
              setExpandedHistoryWorkoutId={id => {
                setConfirmedHistoryEditWorkoutId(null);
                setExpandedHistoryWorkoutId(id);
              }}
              historyPRsExpanded={historyPRsExpanded}
              setHistoryPRsExpanded={setHistoryPRsExpanded}
              oneRepMaxes={effectiveOneRepMaxes}
              targetStandardClass={targetStandardClass}
              userBodyweightLbs={userBodyweightLbs}
              totalHeightInches={totalHeightInches}
              customGoalWeights={customGoalWeights}
              setHistoricalDraft={setHistoricalDraft}
              setCurrentView={setCurrentView}
              openPlateCalculatorForPR={openPlateCalculatorForPR}
              setDeleteConfirmTarget={setDeleteConfirmTarget}
              buildHistoryWorkoutEditorProps={buildHistoryWorkoutEditorProps}
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
              oneRepMaxes={effectiveOneRepMaxes}
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
              oneRepMaxes={effectiveOneRepMaxes}
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
              oneRepMaxes={effectiveOneRepMaxes}
              friendsList={friendsList}
              userBodyweightLbs={userBodyweightLbs}
              history={history}
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
              oneRepMaxes={effectiveOneRepMaxes}
              sharedRoutines={sharedRoutines}
              openPlateCalculatorForPR={openPlateCalculatorForPR}
              handleOpenPreviewRoutine={handleOpenPreviewRoutine}
              onJumpToPRHistoryEntry={handleJumpToPRHistoryEntry}
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
              userBodyweightLbs={userBodyweightLbs}
              setUserBodyweightLbs={setUserBodyweightLbs}
              userHeightFeet={userHeightFeet}
              setUserHeightFeet={setUserHeightFeet}
              userHeightInches={userHeightInches}
              setUserHeightInches={setUserHeightInches}
              totalHeightInches={totalHeightInches}
              goalType={goalType}
              setGoalType={setGoalType}
              goalIncrement={goalIncrement}
              setGoalIncrement={setGoalIncrement}
              goalUnit={goalUnit}
              setGoalUnit={setGoalUnit}
              targetStandardClass={targetStandardClass}
              setTargetStandardClass={setTargetStandardClass}
              oneRepMaxes={effectiveOneRepMaxes}
              customGoalWeights={customGoalWeights}
              openPlateCalculatorForPR={openPlateCalculatorForPR}
              hasActiveSession={Boolean(activeSession?.slots?.length > 0)}
              selectedGymId={selectedGymId}
              setSelectedGymId={setSelectedGymId}
              gyms={gyms}
              routinePreferences={routinePreferences}
              setRoutinePreferences={setRoutinePreferences}
              handleOpenNewSession={handleOpenNewSession}
              handleOpenNewAutoSession={handleOpenNewAutoSession}
              user={user}
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
              recoveryAccessToken={recoveryAccessToken}
              setRecoveryAccessToken={setRecoveryAccessToken}
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
          newSlotMuscleGroup={newSlotMuscleGroup}
          setNewSlotMuscleGroup={setNewSlotMuscleGroup}
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
          prRecordDate={prRecordDate}
          setPrRecordDate={setPrRecordDate}
          handleApplyCalculatedWeight={handleApplyCalculatedWeight}
        />

        <SetValueEditorModal
          setValueTarget={setValueTarget}
          setSetValueTarget={setSetValueTarget}
          handleUpdateSetField={handleUpdateSetField}
          handleUpdateSetType={handleUpdateSetType}
        />

        <SaveConfirmModal
          saveConfirmTarget={saveConfirmTarget}
          setSaveConfirmTarget={setSaveConfirmTarget}
          handleConfirmSaveWorkout={handleConfirmSaveWorkout}
        />

        <HistoricalEditConfirmModal
          historicalEditConfirmTarget={historicalEditConfirmTarget}
          setHistoricalEditConfirmTarget={setHistoricalEditConfirmTarget}
          handleConfirmHistoricalEdit={handleConfirmHistoricalEdit}
        />

        <FeedbackModal
          showFeedbackModal={showFeedbackModal}
          setShowFeedbackModal={setShowFeedbackModal}
          user={user}
          sessionLogs={sessionLogs}
          appSnapshot={{
            currentView,
            selectedGymId,
            activeSessionTitle: activeSession?.title || null,
            activeSessionExercisesCount: (activeSession?.slots || []).length,
            historySessionsCount: (history || []).length,
            savedRoutinesCount: (savedRoutines || []).length,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
          }}
        />
      </div>
    </div>
  );
}
