'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { IOS_DARK, KINETIC_CSS } from './styles/kineticTokens';
import { getIncrementInLbs, getInitial1RMs, asHistoricalWorkout } from './utils/workoutEngine';
import { fetchAthleteProfileSnapshot } from './utils/supabaseAuth';
import { AppHeaderAndDrawer } from './components/AppHeaderAndDrawer';
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
import { ProgressionChartView, DEFAULT_CHART_LIFTS } from './components/views/ProgressionChartView';
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
import { SessionSyncModal, IncomingSyncInviteModal, SyncNoticeModal } from './components/SessionSyncModals';
import { useIdleAutoFinish } from './hooks/useIdleAutoFinish';
import { collectSetValues, sameSetValues, overlaySetValues } from './utils/sessionSync';
import { useWorkoutMutations } from './hooks/useWorkoutMutations';
import { usePlateCalculator } from './hooks/usePlateCalculator';
import { TabBar } from './components/Controls';

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
  const [activeSession, setActiveSession] = useState(null);
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
  const [selectedChartLifts, setSelectedChartLifts] = useState(DEFAULT_CHART_LIFTS);
  const [targetStandardClass, setTargetStandardClass] = useState('Intermediate');
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
  const [shareStatsWithFriends, setShareStatsWithFriends] = useState(true);
  const [shareRoutinesWithFriends, setShareRoutinesWithFriends] = useState(true);
  // Public profiles let friends-of-friends see you in their friend lists (Profile → FRIENDS)
  const [profileIsPublic, setProfileIsPublic] = useState(true);

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
    shareStatsWithFriends,
    setShareStatsWithFriends,
    shareRoutinesWithFriends,
    setShareRoutinesWithFriends,
    profileIsPublic,
    setProfileIsPublic
  });

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

  // While synced the session page has two tabs: YOU (your session) and @FRIEND (their session with their numbers,
  // which you can edit too). Structure edits on either tab are shared; number edits go to that athlete only.
  const [sessionTab, setSessionTab] = useState('me');
  const showingPartnerSession = currentView === 'session' && sessionTab === 'partner' && Boolean(sessionSync.syncId);
  const partnerSession = useMemo(
    () => (showingPartnerSession ? overlaySetValues(activeSession, sessionSync.partnerValues) : null),
    [showingPartnerSession, activeSession, sessionSync.partnerValues]
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
    if (!showingPartnerSession || !syncPartnerId || !user) return undefined;
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
        bodyweightLbs: Number(snapshot.bodyweightLbs) || 200,
        incrementLbs: getIncrementInLbs(goals.goalIncrement ?? 1.25, goals.goalUnit || 'lb', goals.goalType || 'Balanced'),
        goalType: goals.goalType || 'Balanced',
        setPreferences: snapshot.setPreferences || null
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [showingPartnerSession, syncPartnerId, user]);
  const friendNumbers = showingPartnerSession && partnerNumbers?.id === syncPartnerId ? partnerNumbers : null;
  const editorHistory = friendNumbers ? friendNumbers.history : history;
  const editorOneRepMaxes = friendNumbers ? friendNumbers.oneRepMaxes : oneRepMaxes;
  const editorIncrementLbs = friendNumbers ? friendNumbers.incrementLbs : currentIncrementLbs;
  const editorBodyweightLbs = friendNumbers ? friendNumbers.bodyweightLbs : userBodyweightLbs;
  const editorSetPreferences = friendNumbers?.setPreferences || setPreferences;
  const editorGoalType = friendNumbers ? friendNumbers.goalType : goalType;

  // --- 3. Workout & Slot Mutation Handlers Hook ---
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
    handleToggleSetLock,
    handleToggleSetDone,
    handleChangeGymSelection
  } = useWorkoutMutations({
    currentView,
    setCurrentView,
    user,
    // On the friend's tab: their history, PRs, increment, bodyweight, set preferences and goal (editor* below)
    history: editorHistory,
    setHistory,
    oneRepMaxes: editorOneRepMaxes,
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
    setPreferences: editorSetPreferences,
    currentIncrementLbs: editorIncrementLbs,
    userBodyweightLbs: editorBodyweightLbs,
    shareRoutinesWithFriends,
    setSavedRoutines,
    setSharedRoutines,
    setTimerTrigger,
    appendSessionLog,
    muscleStimulusStatus,
    availableEquipment,
    goalType: editorGoalType,
    partnerSession,
    onEditPartnerSession: handleEditPartnerSession
  });

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
    const fromPartnerTab = Boolean(partnerSession);
    setSessionTab('me');
    if (sessionSync.syncId) await sessionSync.unsync();
    if (fromPartnerTab) setActiveSession(prev => (prev ? { ...prev, loadedRoutineTitle: 'MANUAL', slots: [] } : prev));
    else handleResetCurrentEditor();
  };
  const handleFinishSession = () => {
    setSessionTab('me');
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
    handleUpdateSetField,
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

  // BACK (header): the pages visited since Home, newest last. Going Home clears it; going back pops it.
  const viewHistoryRef = useRef([]);
  const lastViewRef = useRef(currentView);
  const goingBackRef = useRef(false);
  useEffect(() => {
    const prev = lastViewRef.current;
    if (prev === currentView) return;
    if (goingBackRef.current) goingBackRef.current = false;
    else if (currentView === 'home') viewHistoryRef.current = [];
    else viewHistoryRef.current = [...viewHistoryRef.current, prev].slice(-30);
    lastViewRef.current = currentView;
  }, [currentView]);
  // Previous page that can still be shown (editors need their draft; sign-in only while signed out), else Home
  const handleBack = () => {
    const canShow = view =>
      view &&
      view !== currentView &&
      !(view === 'gym_editor' && !gymDraft) &&
      !(view === 'historical_entry' && !historicalDraft) &&
      !(view === 'routine_editor' && !routineDraft) &&
      !(view === 'friend_profile' && !viewingFriendProfile) &&
      !(view === 'auth' && user);
    const stack = [...viewHistoryRef.current];
    let target = stack.pop();
    while (target && !canShow(target)) target = stack.pop();
    viewHistoryRef.current = stack;
    goingBackRef.current = true;
    setRoutineSelectReturnView(null);
    setCurrentView(target || 'home');
  };

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

  // The PROGRESS page: tabs PROGRESS (chart) / PERSONAL RECORDS / HISTORY. Also each profile's PROGRESS tab;
  // a friend's profile passes their history / PRs / chart series, its own tab state and readOnly.
  // An open History workout (e.g. from the 1RM box's PR link) always shows your HISTORY tab.
  const renderProgressPage = ({
    readOnly = false,
    history: profileHistory = history,
    oneRepMaxes: prs = effectiveOneRepMaxes,
    seriesByLift = progressionSeriesByLift,
    tab = progressTab,
    onTabChange = nextTab => {
      if (nextTab !== 'history' && expandedHistoryWorkoutId) {
        setConfirmedHistoryEditWorkoutId(null);
        setExpandedHistoryWorkoutId(null);
      }
      setProgressTabChoice(nextTab);
    }
  } = {}) => (
    <>
      <div style={{ padding: '12px var(--dp-spacing-gutter) 0' }}>
        <TabBar ariaLabel="Progress sections" tabs={PROGRESS_TABS} value={tab} onChange={onTabChange} />
      </div>
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
          targetStandardClass={targetStandardClass}
          setTargetStandardClass={readOnly ? undefined : setTargetStandardClass}
          openPlateCalculatorForGoal={readOnly ? undefined : openPlateCalculatorForGoal}
          userBodyweightLbs={userBodyweightLbs}
          totalHeightInches={totalHeightInches}
          customGoalWeights={customGoalWeights}
        />
      )}
      {tab !== 'progress' && (
        <HistoryView
          section={tab}
          readOnly={readOnly}
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

  return (
    <div className="kinetic-app min-h-screen flex justify-center bg-[#080808] text-white">
      <style>{KINETIC_CSS}</style>

      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          minHeight: '100vh',
          backgroundColor: 'var(--dp-color-ground)',
          borderLeft: '2px solid var(--dp-color-rule)',
          borderRight: '2px solid var(--dp-color-rule)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          containerType: 'inline-size'
        }}
      >
        <AppHeaderAndDrawer
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
          onResetSession={handleResetSession}
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
          user={user}
          isStorageHydrated={isStorageHydrated}
          setAuthMode={setAuthMode}
        />

        {user && <CloudSyncBanner status={cloudSyncStatus} onRetry={retryCloudSync} />}
        <UpdateBanner show={appUpdate.updateAvailable} onReload={appUpdate.reloadNow} />

        {/* MAIN VIEWPORT CONTENT */}
        <div style={{ flex: 1, paddingBottom: '48px' }}>
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
              currentView={currentView}
              currentEditorWorkout={currentEditorWorkout}
              routineSelectReturnView={routineSelectReturnView}
              setRoutineSelectReturnView={setRoutineSelectReturnView}
              setCurrentView={setCurrentView}
              selectedGymId={selectedGymId}
              setSelectedGymId={handleChangeGymSelection}
              gyms={gyms}
              history={editorHistory}
              oneRepMaxes={friendNumbers ? friendNumbers.oneRepMaxes : effectiveOneRepMaxes}
              currentIncrementLbs={editorIncrementLbs}
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
              sessionTabs={
                sessionSync.syncId
                  ? {
                      active: showingPartnerSession ? 'partner' : 'me',
                      onChange: setSessionTab,
                      partnerName: sessionSync.syncPartnerName,
                      partnerNumbersLoaded: Boolean(friendNumbers),
                      partnerAppOutdated: sessionSync.partnerAppOutdated
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
            />
          )}

          {currentView === 'social' && (
            <SocialView
              colors={colors}
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
                setShareRoutinesWithFriends
              }}
            />
          )}

          {(currentView === 'profile' || currentView === 'friend_profile') && (
            <ProfileView
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
              oneRepMaxes={effectiveOneRepMaxes}
              history={history}
              sharedRoutines={sharedRoutines}
              handleOpenPreviewRoutine={handleOpenPreviewRoutine}
              setDeleteConfirmTarget={setDeleteConfirmTarget}
              onDeleteAccount={handleDeleteAccount}
              appendSessionLog={appendSessionLog}
              renderProgressPage={renderProgressPage}
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
            borderTop: '2px solid var(--dp-color-rule)',
            // Extra room above the iPhone home indicator (0 elsewhere)
            padding: `14px var(--dp-spacing-gutter) calc(14px + env(safe-area-inset-bottom, 0px))`,
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            color: '#A0A0A0'
          }}
        >
          Copyright © 2026 MaNoDuV LLC
        </footer>

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
        />

        <SetValueEditorModal
          setValueTarget={setValueTarget}
          setSetValueTarget={setSetValueTarget}
          handleUpdateSetField={handleUpdateSetField}
          handleUpdateSetType={handleUpdateSetType}
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

        <IncomingSyncInviteModal
          invite={sessionSync.incomingInvite}
          fromName={sessionSync.incomingInviteFromName}
          willReplaceSession={(activeSession?.slots || []).length > 0}
          busy={sessionSync.isSyncBusy}
          onAccept={() => sessionSync.acceptIncomingInvite()}
          onDecline={() => sessionSync.declineIncomingInvite()}
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
