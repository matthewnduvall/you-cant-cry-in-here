'use client';

import { FormulaConsole } from './components/FormulaConsole';
import { getProgram, getWorkoutProgramInfo } from './data/programs';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { IOS_DARK, KINETIC_CSS } from './styles/kineticTokens';
import { getIncrementInLbs, getInitial1RMs, asHistoricalWorkout, withAutoSessionName } from './utils/workoutEngine';
import { fetchAthleteProfileSnapshot, signOutUser } from './utils/supabaseAuth';
import { AppHeaderAndDrawer, PageTitle } from './components/AppHeaderAndDrawer';
import {
  DeleteConfirmModal,
  PlateCalculatorModal,
  SetValueEditorModal,
  SaveConfirmModal,
  HistoricalEditConfirmModal,
  FeedbackModal
} from './components/Modals';
import { HomeView } from './components/views/HomeView';
import { RoutineEditorView } from './components/views/RoutineEditorView';
import { RoutinesView } from './components/views/RoutinesView';
import { GymEditorView } from './components/views/GymsView';
import { HistoryView } from './components/views/HistoryView';
import { ProgressionChartView } from './components/views/ProgressionChartView';
import { StimulusMapView } from './components/views/StimulusMapView';
import { SocialView } from './components/views/SocialView';
import { ProfileView } from './components/views/ProfileView';
import { InfoView } from './components/views/InfoView';
import { ConfigurationView } from './components/views/ConfigurationView';
import { CloudSyncBanner } from './components/CloudSyncBanner';
import { UpdateBanner } from './components/UpdateBanner';
import { useAppUpdateCheck } from './hooks/useAppUpdateCheck';
import { AuthView } from './components/views/AuthView';
import { useCloudAndStorageSync } from './hooks/useCloudAndStorageSync';
import { useTelemetryAndAnalytics } from './hooks/useTelemetryAndAnalytics';
import { useSessionSync } from './hooks/useSessionSync';
import {
  SessionSyncModal,
  IncomingSyncInviteModal,
  SyncNoticeModal,
  SyncedHistoryUpdateModal
} from './components/SessionSyncModals';
import { useSyncedHistoryUpdates } from './hooks/useSyncedHistoryUpdates';
import { useRoutineShares } from './hooks/useRoutineShares';
import { SendRoutineModal, IncomingRoutineModal } from './components/RoutineShareModals';
import { EXERCISE_MAP, formatDateYMD, stripDateFromTitle } from './data/exerciseLibrary';
import { useIdleAutoFinish } from './hooks/useIdleAutoFinish';
import { collectSetValues, sameSetValues, overlaySetValues } from './utils/sessionSync';
import { useWorkoutMutations } from './hooks/useWorkoutMutations';
import { usePlateCalculator } from './hooks/usePlateCalculator';
import { NestedTabBar, TabBar } from './components/Controls';

const PROGRESS_TABS = [
  { id: 'progress', label: 'PROGRESS' },
  { id: 'records', label: 'PERSONAL RECORDS' },
  { id: 'history', label: 'HISTORY' }
];

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
  const [, setAuthMode] = useState('login');
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
  const [activeSession, setActiveSessionRaw] = useState(null);
  // Every change to the live session goes through the auto-namer: an unnamed session is named after its two main
  // muscles as exercises are added ("Chest and Quads"); a name you type is never changed (withAutoSessionName)
  const setActiveSession = useCallback(
    update =>
      setActiveSessionRaw(prev => withAutoSessionName(prev, typeof update === 'function' ? update(prev) : update)),
    []
  );
  const [historicalDraft, setHistoricalDraft] = useState(null);
  const [routineDraft, setRoutineDraft] = useState(null);
  const [previewRoutineDraft, setPreviewRoutineDraft] = useState(null);
  const [routineSelectReturnView, setRoutineSelectReturnView] = useState(null);
  // PROGRESS page tab: 'progress' (chart) | 'records' (Personal Records) | 'history'
  const [progressTabChoice, setProgressTabChoice] = useState('progress');
  // CONFIGURATION page tab: 'body' | 'goals' | 'equipment' | 'routines'
  const [configurationTab, setConfigurationTab] = useState('body');
  const [isCurrentEditorShared, setIsCurrentEditorShared] = useState(false);

  // --- Modal & Confirmation States ---
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [saveConfirmTarget, setSaveConfirmTarget] = useState(null);
  const [showSessionSyncModal, setShowSessionSyncModal] = useState(false);
  const [historicalEditConfirmTarget, setHistoricalEditConfirmTarget] = useState(null);
  const [confirmedHistoryEditWorkoutId, setConfirmedHistoryEditWorkoutId] = useState(null);
  const [openedFromRoutines, setOpenedFromRoutines] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [setValueTarget, setSetValueTarget] = useState(null);
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

  // --- Saved & Shared Routines + Gyms State ---
  const [savedRoutines, setSavedRoutines] = useState([]);
  const [sharedRoutines, setSharedRoutines] = useState([]);
  const [gyms, setGyms] = useState([]);
  const [selectedGymId, setSelectedGymId] = useState('');
  // the Equipment page list: equipment types the athlete has (drives the default exercise picks)
  const [availableEquipment, setAvailableEquipment] = useState(null);
  const [gymDraft, setGymDraft] = useState(null);

  // --- Goals, Standards & Settings State ---
  // Primary training goal (Strength 5x5 · Balanced 5x8 · Hypertrophy 5x10 · Maintain 5x8); Balanced by default
  const [goalType, setGoalType] = useState('Balanced');
  const [goalIncrement, setGoalIncrement] = useState(1.25);
  const [goalUnit, setGoalUnit] = useState('lb');
  const [chartMetric, setChartMetric] = useState('weight');
  // Progress chart lift toggles (Big 3 + OHP by default)
  // Lifts shown on the PROGRESS chart: null = every lift (the Big 3, OHP and the CUSTOM exercise)
  const [selectedChartLifts, setSelectedChartLifts] = useState(null);
  const [targetStandardClass, setTargetStandardClass] = useState('Novice');
  const [customGoalWeights, setCustomGoalWeights] = useState({});
  const [userBodyweightLbs, setUserBodyweightLbs] = useState(220);
  const [userHeightFeet, setUserHeightFeet] = useState(5);
  const [userHeightInches, setUserHeightInches] = useState(10);
  const [stimulusGreenDays, setStimulusGreenDays] = useState(2);
  const [stimulusYellowDays, setStimulusYellowDays] = useState(4);
  const [routinePreferences, setRoutinePreferences] = useState([
    'Compound',
    'Compound',
    'Superset',
    'Superset',
    'Abs'
  ]);
  // Exercise Set Preferences (Configuration → ROUTINES): set types by position for new exercises
  const [setPreferences, setSetPreferences] = useState(['Warmup', 'Warmup', 'Working', 'Working', 'Working']);
  // Training program (Configuration → PROGRAM; app/data/programs.js). Programs other than Crying add the session's
  // PROGRAM / WEEK row and an intensity per set.
  const [trainingProgram, setTrainingProgram] = useState('crying');
  // When the program's current cycle began (ISO): the week a session falls in is counted from it
  const [programCycleStart, setProgramCycleStart] = useState(null);
  // The athlete's training weekdays per program ({ [programId]: ['Mon', 'Wed', 'Fri'] }; none = the program's own)
  const [programSchedules, setProgramSchedules] = useState({});
  // Picking a different program starts its cycle today (week 1)
  const selectTrainingProgram = id => {
    if (id === trainingProgram) return;
    setTrainingProgram(id);
    setProgramCycleStart(new Date().toISOString());
  };
  const [shareStatsWithFriends, setShareStatsWithFriends] = useState(true);
  const [shareRoutinesWithFriends, setShareRoutinesWithFriends] = useState(true);
  // Public profiles let friends-of-friends see you in their friend lists (Profile → FRIENDS)
  const [profileIsPublic, setProfileIsPublic] = useState(true);
  // Friends see your bodyweight (BW leaderboards, their goal maths) only when this is on; off by default
  const [shareBodyweightWithFriends, setShareBodyweightWithFriends] = useState(false);
  // The Social page's first tab when it next opens ('privacy' from your profile's PRIVACY →)
  const [socialInitialTab, setSocialInitialTab] = useState('leaderboards');
  // Profile photo: a small JPEG data URL (settings.profilePhoto, local + cloud); see ProfileAvatar.jsx
  const [profilePhoto, setProfilePhoto] = useState(null);

  // --- History & Personal Records Page State ---
  const [historySessionsExpanded, setHistorySessionsExpanded] = useState(true);
  const [historyPRsExpanded, setHistoryPRsExpanded] = useState(true);
  const [expandedHistoryWorkoutId, setExpandedHistoryWorkoutId] = useState(null);
  // Unsaved edits to the open History workout (saved with SAVE, dropped with DISCARD)
  const [historyEditDraft, setHistoryEditDraft] = useState(null);
  // An open History workout (PR link, History edits) always shows the HISTORY tab
  const progressTab = expandedHistoryWorkoutId ? 'history' : progressTabChoice;
  const [customPrExerciseIds, setCustomPrExerciseIds] = useState([]);

  // --- Social & Friends State ---
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  // Cache of accepted friends from public.friendships (synced in useCloudAndStorageSync)
  const [friendsList, setFriendsList] = useState([]);
  const [pendingIncomingRequests, setPendingIncomingRequests] = useState([]);
  const [outgoingInvites, setOutgoingInvites] = useState([]);
  const [viewingFriendProfile, setViewingFriendProfile] = useState(null);
  const [pendingInviter, setPendingInviter] = useState(null);

  // --- Rest Timer Trigger State ---
  const [timerTrigger, setTimerTrigger] = useState({
    isRunning: false,
    targetSeconds: 90,
    startedAtMs: null
  });

  const currentIncrementLbs = useMemo(
    () => getIncrementInLbs(goalIncrement, goalUnit, goalType),
    [goalIncrement, goalUnit, goalType]
  );

  // --- Social Email Invite Handlers ---
  const handleSendEmailInvite = inviteEmail => {
    const cleanEmail = (inviteEmail || '').trim().toLowerCase();
    if (!cleanEmail) return;
    setOutgoingInvites(prev => {
      const existing = Array.isArray(prev) ? prev : [];
      const alreadyExists = existing.some(
        item => (typeof item === 'string' ? item : item?.email || '').trim().toLowerCase() === cleanEmail
      );
      if (alreadyExists) return existing;
      return [
        ...existing,
        {
          email: cleanEmail,
          invitedAt: new Date().toISOString(),
          inviterUsername: user?.username || 'athlete'
        }
      ];
    });
    appendSessionLog('social_email_invite_sent', { email: cleanEmail });
  };

  const handleInviteAccepted = joinedUser => {
    if (!pendingInviter || !pendingInviter.username) return;
    // The friendship itself is created in the database: by the invite link's id on the next friendship
    // sync (claim_invite_link, which then clears the stored invite), or when the invited email signs up
    // (friend_invites → handle_new_profile_friendships).
    setPendingInviter(null);
    if (typeof window !== 'undefined' && !pendingInviter.inviteId) {
      window.localStorage.removeItem('yccih_pending_inviter_v1');
    }
    appendSessionLog('social_invite_accepted', {
      inviter: pendingInviter.username,
      joinedUser: joinedUser?.username
    });
  };

  // --- 1. Cloud Sync, LocalStorage Hydration & Backup Hook ---
  const {
    handleExportBackupJSON,
    handleImportBackupJSON,
    handleResetToDemoDefaults,
    handleDeleteAccount,
    cloudSyncStatus,
    retryCloudSync
  } = useCloudAndStorageSync({
    isStorageHydrated,
    setIsStorageHydrated,
    user,
    setUser,
    setAuthUsername,
    setAuthEmail,
    setAuthMode,
    setSignupEmail,
    setSignupBetaCode,
    setRecoveryAccessToken,
    setCurrentView,
    oneRepMaxes,
    setOneRepMaxes,
    history,
    setHistory,
    activeSession,
    setActiveSession,
    savedRoutines,
    setSavedRoutines,
    sharedRoutines,
    setSharedRoutines,
    gyms,
    setGyms,
    friendsList,
    setFriendsList,
    pendingIncomingRequests,
    setPendingIncomingRequests,
    outgoingInvites,
    setOutgoingInvites,
    setPendingInviter,
    selectedGymId,
    setSelectedGymId,
    availableEquipment,
    setAvailableEquipment,
    goalType,
    setGoalType,
    goalIncrement,
    setGoalIncrement,
    goalUnit,
    setGoalUnit,
    chartMetric,
    setChartMetric,
    targetStandardClass,
    setTargetStandardClass,
    customGoalWeights,
    setCustomGoalWeights,
    userBodyweightLbs,
    setUserBodyweightLbs,
    userHeightFeet,
    setUserHeightFeet,
    userHeightInches,
    setUserHeightInches,
    stimulusGreenDays,
    setStimulusGreenDays,
    stimulusYellowDays,
    setStimulusYellowDays,
    routinePreferences,
    setRoutinePreferences,
    setPreferences,
    setSetPreferences,
    trainingProgram,
    setTrainingProgram,
    programCycleStart,
    setProgramCycleStart,
    programSchedules,
    setProgramSchedules,
    shareStatsWithFriends,
    setShareStatsWithFriends,
    shareRoutinesWithFriends,
    setShareRoutinesWithFriends,
    profileIsPublic,
    setProfileIsPublic,
    shareBodyweightWithFriends,
    setShareBodyweightWithFriends,
    profilePhoto,
    setProfilePhoto
  });

  // SIGN OUT (Profile page and the menu): revokes the session, back to Home; workouts stay on the device
  const handleSignOut = () => {
    signOutUser();
    setShowHamburgerDrawer(false);
    setUser(null);
    setCurrentView('home');
  };

  // --- 2. Telemetry, PRs, Stimulus Map & Progression Series Hook ---
  const {
    effectiveOneRepMaxes,
    totalHeightInches,
    muscleStimulusStatus,
    progressionSeriesByLift
  } = useTelemetryAndAnalytics({
    history,
    oneRepMaxes,
    userHeightFeet,
    userHeightInches,
    stimulusGreenDays,
    stimulusYellowDays
  });

  // --- 3a. Live session sync with a friend (SYNC in the session header) ---
  const sessionSync = useSessionSync({
    user,
    friendsList,
    activeSession,
    setActiveSession,
    setCurrentView,
    history,
    oneRepMaxes: effectiveOneRepMaxes,
    currentIncrementLbs,
    userBodyweightLbs,
    appendSessionLog
  });

  // While synced every exercise has its own YOU / @FRIEND tab (partnerSlotTabs: slot id → true while that
  // exercise shows the friend's numbers, which you can edit too). Structure edits on either tab are shared; number
  // edits go to that athlete only.
  const [partnerSlotTabs, setPartnerSlotTabs] = useState({});
  const isSynced = Boolean(sessionSync.syncId);
  const isPartnerSlot = slotId => isSynced && currentView === 'session' && Boolean(partnerSlotTabs[slotId]);
  const partnerTabOpen = isSynced && currentView === 'session' && Object.values(partnerSlotTabs).some(Boolean);
  const partnerSession = useMemo(
    () => (isSynced && currentView === 'session' ? overlaySetValues(activeSession, sessionSync.partnerValues) : null),
    [isSynced, currentView, activeSession, sessionSync.partnerValues]
  );
  const handleEditPartnerSession = nextSession => {
    if (!nextSession || !partnerSession) return;
    // Their numbers that changed → sent to them
    const before = collectSetValues(partnerSession);
    const changed = {};
    Object.entries(collectSetValues(nextSession)).forEach(([id, vals]) => {
      if (!before[id] || !sameSetValues(before[id], vals)) changed[id] = vals;
    });
    sessionSync.editPartnerValues(changed);
    // Structure (exercises, sets, order, name) → your session too, keeping your own numbers
    setActiveSession(prev => {
      if (!prev) return prev;
      const mine = collectSetValues(prev);
      return { ...prev, title: nextSession.title, slots: overlaySetValues({ slots: nextSession.slots }, mine).slots };
    });
  };

  // The friend's own numbers (history, PRs, goal, increment, bodyweight, set preferences), so RECALCULATE and new
  // exercises on their tab suggest their weights. Loaded when their tab opens (again after a minute); until it
  // arrives, or if it can't be loaded, your numbers are used.
  const [partnerNumbers, setPartnerNumbers] = useState(null);
  const partnerNumbersLoadedRef = useRef({ id: null, at: 0 });
  const syncPartnerId = sessionSync.syncPartnerId;
  useEffect(() => {
    if (!partnerTabOpen || !syncPartnerId || !user) return undefined;
    const loaded = partnerNumbersLoadedRef.current;
    if (loaded.id === syncPartnerId && Date.now() - loaded.at < 60 * 1000) return undefined;
    let cancelled = false;
    (async () => {
      const snapshot = await fetchAthleteProfileSnapshot({ id: syncPartnerId }, user);
      if (cancelled || !snapshot) return;
      const goals = snapshot.goals || {};
      partnerNumbersLoadedRef.current = { id: syncPartnerId, at: Date.now() };
      setPartnerNumbers({
        id: syncPartnerId,
        history: Array.isArray(snapshot.history) ? snapshot.history : [],
        oneRepMaxes: snapshot.prs || {},
        // Their bodyweight only when they share it (null = not shared: yours is used)
        bodyweightLbs: Number(snapshot.bodyweightLbs) || null,
        incrementLbs: getIncrementInLbs(goals.goalIncrement ?? 1.25, goals.goalUnit || 'lb', goals.goalType || 'Balanced'),
        goalType: goals.goalType || 'Balanced',
        setPreferences: snapshot.setPreferences || null
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [partnerTabOpen, syncPartnerId, user]);
  const friendNumbers = isSynced && partnerNumbers?.id === syncPartnerId ? partnerNumbers : null;

  // --- 3. Workout & Slot Mutation Handlers Hook ---
  // Two copies: yours (your session, your numbers) and the friend's (their session = your structure + their
  // numbers, their history / PRs / goal for suggested weights; every change goes through handleEditPartnerSession).
  // Each exercise's buttons and pop-ups use the copy for the tab that exercise has open (routed* below).
  const mutationArgs = {
    currentView,
    setCurrentView,
    user,
    history,
    setHistory,
    // Suggested weights (getStored1RM) use the History-based 1RMs, never leftover saved numbers
    oneRepMaxes: effectiveOneRepMaxes,
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
    setConfirmedHistoryEditWorkoutId,
    historyEditDraft,
    setHistoryEditDraft,
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
    setPreferences,
    currentIncrementLbs,
    userBodyweightLbs,
    shareRoutinesWithFriends,
    savedRoutines,
    setSavedRoutines,
    setSharedRoutines,
    setTimerTrigger,
    appendSessionLog,
    muscleStimulusStatus,
    availableEquipment,
    goalType,
    trainingProgram,
    programCycleStart,
    programSchedules,
    targetStandardClass,
    heightInches: totalHeightInches
  };
  const partnerMutations = useWorkoutMutations({
    ...mutationArgs,
    // Their numbers once loaded; yours until then
    history: friendNumbers ? friendNumbers.history : history,
    oneRepMaxes: friendNumbers ? friendNumbers.oneRepMaxes : effectiveOneRepMaxes,
    currentIncrementLbs: friendNumbers ? friendNumbers.incrementLbs : currentIncrementLbs,
    userBodyweightLbs: friendNumbers?.bodyweightLbs || userBodyweightLbs,
    setPreferences: friendNumbers?.setPreferences || setPreferences,
    goalType: friendNumbers ? friendNumbers.goalType : goalType,
    partnerSession,
    onEditPartnerSession: handleEditPartnerSession
  });
  const {
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
    handleAutoFinishActiveSession,
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
    handleChangeProgramWeek,
    handleChangeSessionProgram,
    handleChangeProgramDay,
    handleToggleSetLock,
    handleToggleSetDone,
    handleChangeGymSelection
  } = useWorkoutMutations(mutationArgs);

  // Each exercise's edits go to the copy for the tab it has open (yours, or the friend's on their tab)
  const mutationsForSlot = slotId => (isPartnerSlot(slotId) ? partnerMutations : null);
  const routedUpdateSetField = (slotId, ...rest) =>
    (mutationsForSlot(slotId)?.handleUpdateSetField || handleUpdateSetField)(slotId, ...rest);
  const routedUpdateSetType = (slotId, ...rest) =>
    (mutationsForSlot(slotId)?.handleUpdateSetType || handleUpdateSetType)(slotId, ...rest);

  // When a sync connects while its pop-up is open (inviter waiting for an answer), show "SYNCED WITH @x"
  // for a second, then close it. Opening the pop-up later (e.g. to UNSYNC) doesn't auto-close.
  const previousSyncIdForModalRef = useRef(sessionSync.syncId);
  useEffect(() => {
    const justConnected = Boolean(sessionSync.syncId) && !previousSyncIdForModalRef.current;
    previousSyncIdForModalRef.current = sessionSync.syncId;
    if (!justConnected) return undefined;
    const timer = setTimeout(() => setShowSessionSyncModal(false), 1000);
    return () => clearTimeout(timer);
  }, [sessionSync.syncId]);

  // RESET while synced would empty the friend's session too, so it ends the sync first
  // RESET and FINISH always act on your own session, even from the friend's tab
  const handleResetSession = async () => {
    setPartnerSlotTabs({});
    if (sessionSync.syncId) await sessionSync.unsync();
    handleResetCurrentEditor();
    // RESET also stops and clears the rest timer (back to the session's default rest)
    setTimerTrigger(prev => ({
      ...prev,
      isRunning: false,
      startedAtMs: null,
      targetSeconds: activeSession?.defaultRestSeconds || 90
    }));
  };
  // RESET asks first: it clears every exercise in one tap (and, while synced, ends the sync)
  const requestResetSession = () => {
    const count = (currentEditorWorkout?.slots || []).length;
    const what = currentView === 'routine_editor' ? 'this routine' : currentView === 'session' ? 'this session' : 'this workout';
    setDeleteConfirmTarget({
      type: 'reset_session',
      title: currentView === 'routine_editor' ? 'RESET ROUTINE?' : 'RESET SESSION?',
      verb: 'clear',
      label: `${count === 1 ? 'the 1 exercise' : `all ${count} exercises`} in ${what}${sessionSync.syncId ? ' and end the sync' : ''}`,
      confirmLabel: 'RESET',
      onConfirm: handleResetSession
    });
  };
  const handleFinishSession = () => {
    setPartnerSlotTabs({});
    handleSaveCurrentEditor();
  };

  // --- 4. Plate & Weight Calculator Hook ---
  const {
    plateCalcTarget,
    setPlateCalcTarget,
    calcUnit,
    calcIsSingleLoad,
    calcBarWeight,
    calcBarLabel,
    calcPlatesPerSide,
    setCalcPlatesPerSide,
    calcExtraLbs,
    clearCalcExtra,
    setCalcTotalFromInput,
    prRecordDate,
    setPrRecordDate,
    openPlateCalculatorForSet,
    openPlateCalculatorForPR,
    openPlateCalculatorForGoal,
    computedPlateCalculatorTotal,
    handleApplyCalculatedWeight
  } = usePlateCalculator({
    handleUpdateSetField: routedUpdateSetField,
    setOneRepMaxes,
    setHistory,
    setCustomGoalWeights,
    setTargetStandardClass,
    appendSessionLog
  });

  useEffect(() => {
    appendSessionLog('VIEW_CHANGE', `Navigated to view: ${currentView}`);
    if (currentView !== 'history') {
      setConfirmedHistoryEditWorkoutId(null);
    }
  }, [currentView]);

  // BACK: a real back stack of the places visited since Home, newest last. A place is a page, plus (on the
  // PROGRESS page) its tab and the History workout opened from elsewhere (e.g. a chart point), so BACK from that
  // workout returns to the chart. Each place is also a browser history entry, so the phone's / browser's back
  // gesture does the same as the header ←. Going Home clears the stack.
  const placeOf = () => ({
    view: currentView,
    progressTab: progressTabChoice,
    workoutId: currentView === 'history' ? expandedHistoryWorkoutId : null
  });
  const backStackRef = useRef([]);
  const placeRef = useRef({ view: currentView, progressTab: progressTabChoice, workoutId: null });
  const ignorePopsRef = useRef(0);
  // How many browser entries this app has pushed above where it started (each carries its number in
  // history.state.yccihBack), so a popstate can tell back from forward and Home can rewind to the start
  const browserDepthRef = useRef(0);
  const goBrowserBack = wanted => {
    // Never further back than the entries this app pushed (the trail can be deeper than the capped entries)
    const steps = Math.min(Number(wanted) || 0, browserDepthRef.current);
    if (!(steps > 0)) return;
    ignorePopsRef.current += 1;
    browserDepthRef.current -= steps;
    try {
      window.history.go(-steps);
    } catch {
      ignorePopsRef.current -= 1;
    }
  };
  // Home starts a new trail: the browser goes back to where the app started, so the phone's back gesture on
  // Home leaves the app instead of stepping through entries that no longer lead anywhere
  const rewindToHome = () => {
    backStackRef.current = [];
    goBrowserBack(browserDepthRef.current);
  };
  // Browsers keep at most ~50 history entries and drop the oldest past that, which would break the count, so the
  // app's own entries stop growing at 30 (deeper places still go on the in-app trail)
  const MAX_BROWSER_DEPTH = 30;
  const pushPlace = place => {
    backStackRef.current = [...backStackRef.current, place].slice(-50);
    if (browserDepthRef.current >= MAX_BROWSER_DEPTH) return;
    browserDepthRef.current += 1;
    try {
      window.history.pushState({ yccihBack: browserDepthRef.current }, '');
    } catch {
      // ignore (no history API)
    }
  };
  useEffect(() => {
    const prev = placeRef.current;
    const next = placeOf();
    placeRef.current = next;
    // Tab changes on the same page aren't back steps; nor is a back step (goBack already set placeRef to the
    // place it went to, so prev and next match)
    if (prev.view === next.view) return;
    if (next.view === 'home') rewindToHome();
    else pushPlace(prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, progressTabChoice, expandedHistoryWorkoutId]);
  // Goes to the newest place that can still be shown (editors need their draft, sign-in only while signed out,
  // a History workout must still exist), else Home. `fromBrowser`: the browser already went back one entry.
  const goBack = ({ fromBrowser = false } = {}) => {
    const canShow = place =>
      place &&
      !(place.view === currentView && (place.workoutId || null) === (placeRef.current?.workoutId || null)) &&
      !(place.view === 'gym_editor' && !gymDraft) &&
      !(place.view === 'historical_entry' && !historicalDraft) &&
      !(place.view === 'routine_editor' && !routineDraft) &&
      !(place.view === 'friend_profile' && !viewingFriendProfile) &&
      !(place.view === 'auth' && user) &&
      !(place.workoutId && !history.some(w => w?.id === place.workoutId));
    const stack = [...backStackRef.current];
    let target = stack.pop();
    while (target && !canShow(target)) target = stack.pop();
    // Keep the browser's entries in step: one entry per place popped (the browser already went back one when
    // the back gesture started this)
    const browserSteps = backStackRef.current.length - stack.length - (fromBrowser ? 1 : 0);
    backStackRef.current = stack;
    const place = target || { view: 'home', progressTab: progressTabChoice, workoutId: null };
    if (place.view === 'home') rewindToHome();
    else goBrowserBack(browserSteps);
    setRoutineSelectReturnView(null);
    setConfirmedHistoryEditWorkoutId(null);
    if (place.view === 'history') setProgressTabChoice(place.progressTab || 'progress');
    setExpandedHistoryWorkoutId(place.workoutId || null);
    // The place now shown is the current one (so the effect above doesn't record it as a new step)
    placeRef.current = { view: place.view, progressTab: place.progressTab || progressTabChoice, workoutId: place.workoutId || null };
    setCurrentView(place.view);
  };
  const handleBack = () => goBack();
  // The phone's / browser's back gesture
  const goBackRef = useRef(goBack);
  useEffect(() => {
    goBackRef.current = goBack;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onPopState = e => {
      if (ignorePopsRef.current > 0) {
        ignorePopsRef.current -= 1;
        return;
      }
      const depth = Number(e?.state?.yccihBack) || 0;
      if (depth > browserDepthRef.current) {
        // Forward (browser button / gesture): the app has no forward trail, so undo it
        const steps = depth - browserDepthRef.current;
        browserDepthRef.current = depth;
        goBrowserBack(steps);
        return;
      }
      if (depth === browserDepthRef.current) return;
      browserDepthRef.current = depth;
      goBackRef.current({ fromBrowser: true });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Locked interface: iOS Safari ignores `user-scalable=no`, so cancel its pinch-zoom gestures and
  // multi-touch zoom directly (the viewport export in layout.js covers other browsers).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const preventGesture = e => e.preventDefault();
    const preventMultiTouchZoom = e => {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    document.addEventListener('touchmove', preventMultiTouchZoom, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('touchmove', preventMultiTouchZoom);
    };
  }, []);

  // The PROGRESS page: tabs PROGRESS (chart) / PERSONAL RECORDS / HISTORY. Also each profile's PROGRESS tab;
  // a friend's profile passes their history / PRs / chart series, its own tab state and readOnly.
  // An open History workout (e.g. from the 1RM box's PR link) always shows your HISTORY tab.
  // A friend's logged workout → your session: their exercises and sets (none done), your weights (handleDirectLoadRoutine
  // re-works a friend's routine to your History). A session with exercises asks before it is replaced.
  const handleLoadFriendWorkout = (workout, friendName) => {
    const load = () =>
      handleDirectLoadRoutine(
        {
          key: `friend_workout_${workout.id}`,
          label: stripDateFromTitle(workout.title) || 'Session',
          slots: workout.slots || [],
          friendName: friendName || 'friend'
        },
        'session'
      );
    if ((activeSession?.slots || []).length > 0) {
      setDeleteConfirmTarget({
        type: 'generic',
        title: 'REPLACE YOUR SESSION?',
        verb: 'replace',
        label: `your current session with @${friendName}'s ${stripDateFromTitle(workout.title) || 'workout'}`,
        confirmLabel: 'LOAD',
        onConfirm: load
      });
      return;
    }
    load();
  };

  // Routines sent straight to a friend: SEND in the routine browser, and the ones friends sent you (SAVE / LOAD NOW)
  const routineShares = useRoutineShares({
    user,
    setSavedRoutines,
    onLoadRoutine: routine => handleDirectLoadRoutine(routine, 'session'),
    appendSessionLog
  });

  const renderProgressPage = ({
    readOnly = false,
    history: profileHistory = history,
    oneRepMaxes: prs = effectiveOneRepMaxes,
    seriesByLift = progressionSeriesByLift,
    tab = progressTab,
    // A friend's profile: their goal settings, so their chart's distance-to-goal view uses THEIR strength class goal
    // ({ targetStandardClass, customGoalWeights, bodyweightLbs }); yours otherwise
    goalSettings = null,
    // A friend's profile: LOAD on their History rows (onLoadHistoryWorkout(workout))
    onLoadHistoryWorkout = null,
    // On a profile the page sits under the profile's own PERFORMANCE tab: its tabs are indented with an elbow
    // line so they read as that tab's children rather than a second row of page tabs
    nested = false,
    onTabChange = nextTab => {
      if (nextTab !== 'history' && expandedHistoryWorkoutId) {
        setConfirmedHistoryEditWorkoutId(null);
        setExpandedHistoryWorkoutId(null);
      }
      setProgressTabChoice(nextTab);
    }
  } = {}) => (
    <>
      {nested ? (
        <div style={{ padding: '0 var(--dp-spacing-gutter)' }}>
          <NestedTabBar ariaLabel="Performance sections" tabs={PROGRESS_TABS} value={tab} onChange={onTabChange} />
        </div>
      ) : (
        <div style={{ padding: '12px var(--dp-spacing-gutter) 0' }}>
          <TabBar ariaLabel="Progress sections" tabs={PROGRESS_TABS} value={tab} onChange={onTabChange} />
        </div>
      )}
      {tab === 'progress' && (
        <ProgressionChartView
          colors={colors}
          selectedChartLifts={selectedChartLifts}
          setSelectedChartLifts={setSelectedChartLifts}
          progressionSeriesByLift={seriesByLift}
          oneRepMaxes={prs}
          showGoalDistance={!readOnly}
          onOpenHistoryWorkout={readOnly ? undefined : openHistoryWorkout}
          onOpenGoals={
            readOnly
              ? undefined
              : () => {
                  setConfigurationTab('goals');
                  setCurrentView('configuration');
                }
          }
          targetStandardClass={goalSettings?.targetStandardClass || targetStandardClass}
          setTargetStandardClass={readOnly ? undefined : setTargetStandardClass}
          openPlateCalculatorForGoal={readOnly ? undefined : openPlateCalculatorForGoal}
          userBodyweightLbs={goalSettings?.bodyweightLbs || userBodyweightLbs}
          totalHeightInches={totalHeightInches}
          customGoalWeights={goalSettings ? goalSettings.customGoalWeights || {} : customGoalWeights}
        />
      )}
      {tab !== 'progress' && (
        <HistoryView
          section={tab}
          readOnly={readOnly}
          onLoadWorkout={onLoadHistoryWorkout}
          colors={colors}
          history={profileHistory}
          setHistory={setHistory}
          currentIncrementLbs={currentIncrementLbs}
          historySessionsExpanded={historySessionsExpanded}
          setHistorySessionsExpanded={setHistorySessionsExpanded}
          expandedHistoryWorkoutId={expandedHistoryWorkoutId}
          setExpandedHistoryWorkoutId={id => {
            setConfirmedHistoryEditWorkoutId(null);
            setExpandedHistoryWorkoutId(id);
          }}
          historyPRsExpanded={historyPRsExpanded}
          setHistoryPRsExpanded={setHistoryPRsExpanded}
          oneRepMaxes={prs}
          setOneRepMaxes={setOneRepMaxes}
          customPrExerciseIds={customPrExerciseIds}
          setCustomPrExerciseIds={setCustomPrExerciseIds}
          selectedGymId={selectedGymId}
          gyms={gyms}
          targetStandardClass={targetStandardClass}
          userBodyweightLbs={userBodyweightLbs}
          totalHeightInches={totalHeightInches}
          customGoalWeights={customGoalWeights}
          setHistoricalDraft={setHistoricalDraft}
          setCurrentView={setCurrentView}
          openPlateCalculatorForPR={openPlateCalculatorForPR}
          openPlateCalculatorForSet={openPlateCalculatorForSet}
          setSetValueTarget={setSetValueTarget}
          setDeleteConfirmTarget={setDeleteConfirmTarget}
          buildHistoryWorkoutEditorProps={buildHistoryWorkoutEditorProps}
        />
      )}
    </>
  );

  // Opens a logged workout on the PROGRESS page (expanded) and scrolls it into view below the sticky header
  const openHistoryWorkout = workoutId => {
    if (!workoutId) return;
    // Already on the PROGRESS page (e.g. a chart point): opening the workout is still a back step
    if (currentView === 'history' && expandedHistoryWorkoutId !== workoutId) pushPlace(placeRef.current);
    setRoutineSelectReturnView(null);
    setConfirmedHistoryEditWorkoutId(null);
    setExpandedHistoryWorkoutId(workoutId);
    setProgressTabChoice('history');
    setCurrentView('history');
    let tries = 0;
    const scrollToEntry = () => {
      const el = document.getElementById(`history-entry-${workoutId}`);
      if (!el) {
        if (tries++ < 20) setTimeout(scrollToEntry, 100);
        return;
      }
      const headerHeight = document.querySelector('header')?.offsetHeight || 0;
      const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    };
    setTimeout(scrollToEntry, 50);
  };

  const buildHistoryWorkoutEditorProps = historyWorkout => ({
    // Logged under a program other than Crying: its sets keep their INTENSITY strip
    showIntensity: Boolean(getWorkoutProgramInfo(historyWorkout)),
    colors,
    currentView: 'history',
    // The open workout's unsaved edits, if any
    // History workouts show their sets done and locked (asHistoricalWorkout)
    currentEditorWorkout: historyEditDraft?.id === historyWorkout?.id ? historyEditDraft : asHistoricalWorkout(historyWorkout),
    historyEdit: {
      dirty: Boolean(historyWorkout && historyEditDraft?.id === historyWorkout.id),
      onSave: handleSaveCurrentEditor,
      onDiscard: () => setHistoryEditDraft(null)
    },
    routineSelectReturnView,
    setRoutineSelectReturnView,
    setCurrentView,
    selectedGymId,
    setSelectedGymId,
    gyms,
    history,
    oneRepMaxes: effectiveOneRepMaxes,
    currentIncrementLbs,
    setHistoricalDraft,
    setDeleteConfirmTarget,
    isCurrentEditorShared,
    updateCurrentWorkoutState,
    handleApplyPreviewRoutine,
    handleAutoBuildWorkout,
    handleAddAutoSlot,
    handleSaveCurrentEditor,
    handleShareCurrentEditor,
    handleResetCurrentEditor,
    handleUpdateSlotCategoryOrExercise,
    handleUpdateSetField,
    handleUpdateSetType,
    handleInsertSetAtPosition,
    handleRecalculateSlotWeights,
    handleToggleSetLock,
    handleToggleSetDone,
    handleReorderExercises,
    handleReorderSets,
    openPlateCalculatorForSet,
    setSetValueTarget,
    isEmbeddedHistorySession: true
  });

  // Newer deployment live: reload on returning to the app, or offer RELOAD (both synced phones run the same version)
  const appUpdate = useAppUpdateCheck();

  // 15 minutes without a touch: a live session with completed sets is saved to History and closed
  const [idleFinishNotice, setIdleFinishNotice] = useState('');
  useIdleAutoFinish({
    hasLiveSession: (activeSession?.slots || []).length > 0,
    onAutoFinish: () => {
      const saved = handleAutoFinishActiveSession();
      if (saved) setIdleFinishNotice('No activity for 15 minutes, so your session was finished and saved to History.');
      return saved;
    }
  });

  // A friend added exercises to a workout you did together (synced) after saving it: offer to add them to yours
  const { pendingHistoryUpdate, acceptUpdate, dismissUpdate } = useSyncedHistoryUpdates({
    user,
    history,
    setHistory,
    oneRepMaxes: effectiveOneRepMaxes,
    incrementLbs: currentIncrementLbs,
    userBodyweightLbs,
    appendSessionLog
  });

  return (
    <div className="kinetic-app min-h-screen flex justify-center bg-black text-white">
      <style>{KINETIC_CSS}</style>

      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          minHeight: '100vh',
          backgroundColor: 'var(--dp-color-ground)',
          borderLeft: '1px solid var(--dp-color-rule)',
          borderRight: '1px solid var(--dp-color-rule)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          containerType: 'inline-size'
        }}
      >
        <AppHeaderAndDrawer
          trainingProgram={trainingProgram}
          programCycleStart={programCycleStart}
          programSchedules={programSchedules}
          currentView={currentView}
          setCurrentView={setCurrentView}
          onBack={handleBack}
          setRoutineSelectReturnView={setRoutineSelectReturnView}
          showHamburgerDrawer={showHamburgerDrawer}
          setShowHamburgerDrawer={setShowHamburgerDrawer}
          setShowFeedbackModal={setShowFeedbackModal}
          isRoutineEditorView={isRoutineEditorView}
          currentEditorWorkout={currentEditorWorkout}
          onFinishSession={handleFinishSession}
          onResetSession={requestResetSession}
          sessionSync={
            sessionSync.canSync
              ? {
                  status: sessionSync.syncId ? 'synced' : sessionSync.outgoingInvite ? 'pending' : 'idle',
                  onClick: () => setShowSessionSyncModal(true)
                }
              : null
          }
          finishSessionPending={Boolean(saveConfirmTarget)}
          timerTrigger={timerTrigger}
          setTimerTrigger={setTimerTrigger}
          updateCurrentWorkoutState={updateCurrentWorkoutState}
          onChangeProgramWeek={handleChangeProgramWeek}
          onChangeSessionProgram={handleChangeSessionProgram}
          onChangeProgramDay={handleChangeProgramDay}
          history={history}
          user={user}
          profilePhoto={profilePhoto}
          onSignOut={handleSignOut}
          isStorageHydrated={isStorageHydrated}
          setAuthMode={setAuthMode}
        />

        {user && <CloudSyncBanner status={cloudSyncStatus} onRetry={retryCloudSync} />}
        <UpdateBanner show={appUpdate.updateAvailable} onReload={appUpdate.reloadNow} />

        {/* MAIN VIEWPORT CONTENT */}
        <div style={{ flex: 1, paddingBottom: '48px' }}>
          {currentView !== 'home' && <PageTitle view={currentView} />}
          {currentView === 'home' && (
            <HomeView
              colors={colors}
              user={user}
              oneRepMaxes={effectiveOneRepMaxes}
              history={history}
              hasActiveSession={Boolean(activeSession?.slots?.length > 0)}
              handleOpenNewSession={handleOpenNewSession}
              handleOpenNewAutoSession={handleOpenNewAutoSession}
              setCurrentView={setCurrentView}
              setRoutineSelectReturnView={setRoutineSelectReturnView}
              marqueePaused={marqueePaused}
              setMarqueePaused={setMarqueePaused}
              friendsList={friendsList}
              pendingIncomingRequests={pendingIncomingRequests}
              muscleStimulusStatus={muscleStimulusStatus}
            />
          )}

          {isRoutineEditorView && currentEditorWorkout && (
            <RoutineEditorView
              colors={colors}
              showIntensity={getProgram(currentEditorWorkout?.program || trainingProgram).usesIntensity}
              currentView={currentView}
              currentEditorWorkout={currentEditorWorkout}
              routineSelectReturnView={routineSelectReturnView}
              setRoutineSelectReturnView={setRoutineSelectReturnView}
              setCurrentView={setCurrentView}
              selectedGymId={selectedGymId}
              setSelectedGymId={handleChangeGymSelection}
              gyms={gyms}
              history={history}
              oneRepMaxes={effectiveOneRepMaxes}
              currentIncrementLbs={currentIncrementLbs}
              setHistoricalDraft={setHistoricalDraft}
              setDeleteConfirmTarget={setDeleteConfirmTarget}
              isCurrentEditorShared={isCurrentEditorShared}
              updateCurrentWorkoutState={updateCurrentWorkoutState}
              handleApplyPreviewRoutine={handleApplyPreviewRoutine}
              handleAutoBuildWorkout={handleAutoBuildWorkout}
              handleAddAutoSlot={handleAddAutoSlot}
              handleSaveCurrentEditor={handleSaveCurrentEditor}
              handleShareCurrentEditor={handleShareCurrentEditor}
              handleResetCurrentEditor={handleResetCurrentEditor}
              handleUpdateSlotCategoryOrExercise={handleUpdateSlotCategoryOrExercise}
              handleUpdateSetField={handleUpdateSetField}
              handleUpdateSetType={handleUpdateSetType}
              handleInsertSetAtPosition={handleInsertSetAtPosition}
              handleRecalculateSlotWeights={handleRecalculateSlotWeights}
              handleToggleSetLock={handleToggleSetLock}
              handleToggleSetDone={handleToggleSetDone}
              handleReorderExercises={handleReorderExercises}
              handleReorderSets={handleReorderSets}
              openPlateCalculatorForSet={openPlateCalculatorForSet}
              setSetValueTarget={setSetValueTarget}
              openedFromRoutines={openedFromRoutines}
              setOpenedFromRoutines={setOpenedFromRoutines}
              slotTabs={
                isSynced && currentView === 'session'
                  ? {
                      isPartner: slotId => Boolean(partnerSlotTabs[slotId]),
                      onChange: (slotId, tab) => setPartnerSlotTabs(prev => ({ ...prev, [slotId]: tab === 'partner' })),
                      partnerName: sessionSync.syncPartnerName,
                      partnerWorkout: partnerSession,
                      partnerHistory: friendNumbers ? friendNumbers.history : history,
                      partnerNumbersLoaded: Boolean(friendNumbers),
                      partnerAppOutdated: sessionSync.partnerAppOutdated,
                      handlers: {
                        handleUpdateSlotCategoryOrExercise: partnerMutations.handleUpdateSlotCategoryOrExercise,
                        handleUpdateSetField: partnerMutations.handleUpdateSetField,
                        handleUpdateSetType: partnerMutations.handleUpdateSetType,
                        handleInsertSetAtPosition: partnerMutations.handleInsertSetAtPosition,
                        handleRecalculateSlotWeights: partnerMutations.handleRecalculateSlotWeights,
                        handleToggleSetLock: partnerMutations.handleToggleSetLock,
                        handleToggleSetDone: partnerMutations.handleToggleSetDone,
                        handleReorderSets: partnerMutations.handleReorderSets
                      }
                    }
                  : null
              }
            />
          )}

          {currentView === 'routines' && (
            <RoutinesView
              colors={colors}
              user={user}
              savedRoutines={savedRoutines}
              sharedRoutines={sharedRoutines}
              friendsList={friendsList}
              selectedGymId={selectedGymId}
              setSelectedGymId={setSelectedGymId}
              gyms={gyms}
              routineSelectReturnView={routineSelectReturnView}
              handleOpenPreviewRoutine={handleOpenPreviewRoutine}
              handleDirectLoadRoutine={handleDirectLoadRoutine}
              handleCancelRoutineSelection={handleCancelRoutineSelection}
              setDeleteConfirmTarget={setDeleteConfirmTarget}
              onAutoRoutine={handleAutoBuildWorkout}
              availableEquipment={availableEquipment}
              onSendRoutine={user ? routineShares.openSend : undefined}
            />
          )}

          {/* PROGRESS page (view id 'history'): see renderProgressPage */}
          {currentView === 'history' && renderProgressPage()}

          {currentView === 'gym_editor' && gymDraft && (
            <GymEditorView
              colors={colors}
              gymDraft={gymDraft}
              setGymDraft={setGymDraft}
              setGyms={setGyms}
              setAvailableEquipment={setAvailableEquipment}
              setCurrentView={setCurrentView}
            />
          )}

          {/* 01 / CONFIGURATION: BODY METRICS · GOALS · EQUIPMENT · ROUTINES tabs (replaces Onboarding and the
              Routines / Equipment / Goals menu pages) */}
          {currentView === 'configuration' && (
            <ConfigurationView
              colors={colors}
              tab={configurationTab}
              setTab={setConfigurationTab}
              setCurrentView={setCurrentView}
              bodyMetricsProps={{
                userBodyweightLbs,
                setUserBodyweightLbs,
                userHeightFeet,
                setUserHeightFeet,
                userHeightInches,
                setUserHeightInches
              }}
              goalsProps={{
                goalType,
                setGoalType,
                goalUnit,
                setGoalUnit,
                goalIncrement,
                setGoalIncrement,
                userBodyweightLbs,
                userHeightFeet,
                userHeightInches,
                totalHeightInches,
                targetStandardClass,
                setTargetStandardClass,
                oneRepMaxes: effectiveOneRepMaxes,
                customGoalWeights,
                progressionSeriesByLift,
                openPlateCalculatorForGoal,
                onOpenHistoryWorkout: openHistoryWorkout,
                customPrExerciseIds,
                setCustomPrExerciseIds
              }}
              equipmentProps={{
                gyms,
                setGyms,
                selectedGymId,
                setSelectedGymId,
                availableEquipment,
                setAvailableEquipment,
                setGymDraft
              }}
              routinePreferencesProps={{ routinePreferences, setRoutinePreferences }}
              setPreferencesProps={{ setPreferences, setSetPreferences }}
              programProps={{
                trainingProgram,
                setTrainingProgram: selectTrainingProgram,
                programCycleStart,
                history,
                programSchedules,
                setProgramSchedule: (programId, days) => setProgramSchedules(prev => ({ ...(prev || {}), [programId]: days })),
                onRestartCycle: () => setProgramCycleStart(new Date().toISOString())
              }}
            />
          )}

          {currentView === 'stimulus_map' && (
            <StimulusMapView
              colors={colors}
              stimulusGreenDays={stimulusGreenDays}
              stimulusYellowDays={stimulusYellowDays}
              setStimulusGreenDays={setStimulusGreenDays}
              setStimulusYellowDays={setStimulusYellowDays}
              muscleStimulusStatus={muscleStimulusStatus}
              setSetValueTarget={setSetValueTarget}
            />
          )}

          {currentView === 'social' && (
            <SocialView
              colors={colors}
              initialTab={socialInitialTab}
              onInitialTabUsed={() => setSocialInitialTab('leaderboards')}
              user={user}
              friendSearchQuery={friendSearchQuery}
              setFriendSearchQuery={setFriendSearchQuery}
              pendingIncomingRequests={pendingIncomingRequests}
              setPendingIncomingRequests={setPendingIncomingRequests}
              outgoingInvites={outgoingInvites}
              setOutgoingInvites={setOutgoingInvites}
              onSendEmailInvite={handleSendEmailInvite}
              friendsList={friendsList}
              setFriendsList={setFriendsList}
              setDeleteConfirmTarget={setDeleteConfirmTarget}
              appendSessionLog={appendSessionLog}
              setViewingFriendProfile={setViewingFriendProfile}
              setCurrentView={setCurrentView}
              leaderboardProps={{
                onSignIn: () => setCurrentView('auth'),
                profilePhoto,
                // A leaderboard row opens that athlete's profile
                onOpenProfile: entry => {
                  if (entry?.isSelf) {
                    setCurrentView(user ? 'profile' : 'auth');
                  } else if (entry?.friend) {
                    setViewingFriendProfile(entry.friend);
                    setCurrentView('friend_profile');
                  }
                },
                oneRepMaxes: effectiveOneRepMaxes,
                userBodyweightLbs,
                totalHeightInches,
                history
              }}
              socialSettingsProps={{
                profileIsPublic,
                setProfileIsPublic,
                shareStatsWithFriends,
                setShareStatsWithFriends,
                shareRoutinesWithFriends,
                setShareRoutinesWithFriends,
                shareBodyweightWithFriends,
                setShareBodyweightWithFriends
              }}
            />
          )}

          {(currentView === 'profile' || currentView === 'friend_profile') && (
            <ProfileView
              // One instance per athlete: opening another profile (yours after a friend's) starts on its first tab
              key={currentView === 'friend_profile' ? `friend_${viewingFriendProfile?.id || viewingFriendProfile?.username || ''}` : 'own'}
              colors={colors}
              currentView={currentView}
              viewingFriendProfile={viewingFriendProfile}
              setViewingFriendProfile={setViewingFriendProfile}
              friendsList={friendsList}
              setFriendsList={setFriendsList}
              user={user}
              setUser={setUser}
              setCurrentView={setCurrentView}
              fileInputRef={fileInputRef}
              profilePhoto={profilePhoto}
              setProfilePhoto={setProfilePhoto}
              onSignOut={handleSignOut}
              oneRepMaxes={effectiveOneRepMaxes}
              history={history}
              sharedRoutines={sharedRoutines}
              handleOpenPreviewRoutine={handleOpenPreviewRoutine}
              setDeleteConfirmTarget={setDeleteConfirmTarget}
              onDeleteAccount={handleDeleteAccount}
              appendSessionLog={appendSessionLog}
              renderProgressPage={renderProgressPage}
              shareStatsWithFriends={shareStatsWithFriends}
              shareBodyweightWithFriends={shareBodyweightWithFriends}
              profileIsPublic={profileIsPublic}
              onLoadFriendWorkout={handleLoadFriendWorkout}
              onOpenPrivacy={() => {
                setSocialInitialTab('privacy');
                setCurrentView('social');
              }}
              routinesProps={{
                user,
                savedRoutines,
                sharedRoutines,
                friendsList,
                selectedGymId,
                setSelectedGymId,
                gyms,
                routineSelectReturnView: null,
                handleOpenPreviewRoutine,
                handleDirectLoadRoutine,
                handleCancelRoutineSelection,
                setDeleteConfirmTarget
              }}
            />
          )}


          {currentView === 'info' && (
            <InfoView
              colors={colors}
              setCurrentView={setCurrentView}
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
              pendingInviter={pendingInviter}
              onInviteAccepted={handleInviteAccepted}
              setUser={setUser}
              setCurrentView={setCurrentView}
              hasLocalHistory={(history || []).length > 0}
            />
          )}
        </div>

        {/* COPYRIGHT FOOTER (every view) */}
        <footer
          style={{
            borderTop: '1px solid var(--dp-color-rule)',
            // Extra room above the iPhone home indicator (0 elsewhere)
            padding: `14px var(--dp-spacing-gutter) calc(14px + env(safe-area-inset-bottom, 0px))`,
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.02em',
            color: '#9A9A9A'
          }}
        >
          Copyright © 2026 MaNoDuV LLC
        </footer>

        {/* FORMULAS console (workout editors): the formulas behind RECALCULATE and new exercises, for checking */}
        {(['session', 'routine_editor', 'historical_entry', 'routine_preview'].includes(currentView) ||
          (currentView === 'history' && expandedHistoryWorkoutId)) && <FormulaConsole />}

        {/* MODALS */}
        <DeleteConfirmModal
          deleteConfirmTarget={deleteConfirmTarget}
          setDeleteConfirmTarget={setDeleteConfirmTarget}
          handleConfirmDeleteAction={handleConfirmDeleteAction}
        />


        <PlateCalculatorModal
          plateCalcTarget={plateCalcTarget}
          setPlateCalcTarget={setPlateCalcTarget}
          computedPlateCalculatorTotal={computedPlateCalculatorTotal}
          calcUnit={calcUnit}
          calcIsSingleLoad={calcIsSingleLoad}
          calcBarWeight={calcBarWeight}
          calcBarLabel={calcBarLabel}
          calcPlatesPerSide={calcPlatesPerSide}
          setCalcPlatesPerSide={setCalcPlatesPerSide}
          calcExtraLbs={calcExtraLbs}
          clearCalcExtra={clearCalcExtra}
          setCalcTotalFromInput={setCalcTotalFromInput}
          prRecordDate={prRecordDate}
          setPrRecordDate={setPrRecordDate}
          handleApplyCalculatedWeight={handleApplyCalculatedWeight}
          onOpenHistoryWorkout={openHistoryWorkout}
          bodyweightLbs={userBodyweightLbs}
        />

        <SetValueEditorModal
          setValueTarget={setValueTarget}
          setSetValueTarget={setSetValueTarget}
          handleUpdateSetField={routedUpdateSetField}
          handleUpdateSetType={routedUpdateSetType}
        />

        <SessionSyncModal
          open={showSessionSyncModal}
          onClose={() => setShowSessionSyncModal(false)}
          friends={friendsList}
          isSynced={Boolean(sessionSync.syncId)}
          syncPartnerName={sessionSync.syncPartnerName || ''}
          outgoingInvite={sessionSync.outgoingInvite}
          busy={sessionSync.isSyncBusy}
          onInvite={friend => sessionSync.inviteFriendToSync(friend)}
          onCancelInvite={() => sessionSync.cancelOutgoingInvite()}
          onUnsync={async () => {
            await sessionSync.unsync();
            setShowSessionSyncModal(false);
          }}
        />

        <SyncedHistoryUpdateModal
          update={pendingHistoryUpdate}
          exerciseName={id => EXERCISE_MAP[id]?.name || id}
          formatDate={formatDateYMD}
          onAdd={acceptUpdate}
          onDismiss={dismissUpdate}
        />

        <IncomingSyncInviteModal
          invite={sessionSync.incomingInvite}
          fromName={sessionSync.incomingInviteFromName}
          willReplaceSession={(activeSession?.slots || []).length > 0}
          busy={sessionSync.isSyncBusy}
          onAccept={() => sessionSync.acceptIncomingInvite()}
          onDecline={() => sessionSync.declineIncomingInvite()}
        />

        <SendRoutineModal
          key={routineShares.sendTarget?.key || 'none'}
          routine={routineShares.sendTarget}
          friends={friendsList}
          busy={routineShares.sendState.busy}
          sentTo={routineShares.sendState.sentTo}
          error={routineShares.sendState.error}
          onSend={routineShares.sendTo}
          onClose={routineShares.closeSend}
        />
        <IncomingRoutineModal
          share={sessionSync.incomingInvite ? null : routineShares.incomingRoutine}
          exerciseName={id => EXERCISE_MAP[id]?.name || id}
          willReplaceSession={(activeSession?.slots || []).length > 0}
          busy={routineShares.incomingBusy}
          onSave={routineShares.saveIncoming}
          onLoad={routineShares.loadIncoming}
          onDismiss={routineShares.dismissIncoming}
        />

        <SyncNoticeModal message={sessionSync.syncNotice} onClose={sessionSync.clearSyncNotice} />
        <SyncNoticeModal title="SESSION SAVED" message={idleFinishNotice} onClose={() => setIdleFinishNotice('')} />

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
