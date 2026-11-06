'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { IOS_DARK, KINETIC_CSS } from './styles/kineticTokens';
import { getIncrementInLbs, getInitial1RMs } from './utils/workoutEngine';
import { DEFAULT_MATT_FRIEND, ensureDefaultMattFriend } from './utils/storageMigration';
import { AppHeaderAndDrawer } from './components/AppHeaderAndDrawer';
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
import { RoutinesView } from './components/views/RoutinesView';
import { GymsView, GymEditorView } from './components/views/GymsView';
import { HistoryView } from './components/views/HistoryView';
import { GoalsView } from './components/views/GoalsView';
import { ProgressionChartView } from './components/views/ProgressionChartView';
import { StimulusMapView } from './components/views/StimulusMapView';
import { LeaderboardView } from './components/views/LeaderboardView';
import { SocialView } from './components/views/SocialView';
import { ProfileView } from './components/views/ProfileView';
import { SettingsView } from './components/views/SettingsView';
import { InfoView } from './components/views/InfoView';
import { OnboardingView } from './components/views/OnboardingView';
import { AuthView } from './components/views/AuthView';
import { useCloudAndStorageSync } from './hooks/useCloudAndStorageSync';
import { useTelemetryAndAnalytics } from './hooks/useTelemetryAndAnalytics';
import { useWorkoutMutations } from './hooks/useWorkoutMutations';
import { usePlateCalculator } from './hooks/usePlateCalculator';

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
  const [isCurrentEditorShared, setIsCurrentEditorShared] = useState(false);

  // --- Modal & Confirmation States ---
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [saveConfirmTarget, setSaveConfirmTarget] = useState(null);
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
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [addSlotGymFilter, setAddSlotGymFilter] = useState('');
  const [newSlotCategory, setNewSlotCategory] = useState('Compound');
  const [newSlotMuscleGroup, setNewSlotMuscleGroup] = useState('All Muscles');
  const [newSlotEx1, setNewSlotEx1] = useState('barbell_bench_press');
  const [newSlotSupersetIds, setNewSlotSupersetIds] = useState(['reverse_lunge', 'front_flies']);
  const [newSlotScheme, setNewSlotScheme] = useState('5x8');

  // --- Saved & Shared Routines + Gyms State ---
  const [savedRoutines, setSavedRoutines] = useState([]);
  const [sharedRoutines, setSharedRoutines] = useState([]);
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
    'Compound',
    'Compound',
    'Superset',
    'Superset',
    'Abs'
  ]);
  const [shareStatsWithFriends, setShareStatsWithFriends] = useState(true);
  const [shareRoutinesWithFriends, setShareRoutinesWithFriends] = useState(true);

  // --- History & Personal Records Page State ---
  const [historySessionsExpanded, setHistorySessionsExpanded] = useState(true);
  const [historyPRsExpanded, setHistoryPRsExpanded] = useState(true);
  const [expandedHistoryWorkoutId, setExpandedHistoryWorkoutId] = useState(null);
  const [customPrExerciseIds, setCustomPrExerciseIds] = useState([]);

  // --- Social & Friends State ---
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendsList, setFriendsList] = useState(() => [DEFAULT_MATT_FRIEND]);
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
    const inviterFriend = {
      id: `friend_${pendingInviter.username.toLowerCase()}`,
      username: pendingInviter.username,
      email: pendingInviter.email || '',
      prs: {},
      sharedRoutines: []
    };
    setFriendsList(prev => {
      const list = ensureDefaultMattFriend(prev);
      const exists = list.some(
        f => (f.username || '').toLowerCase() === inviterFriend.username.toLowerCase()
      );
      if (exists) return list;
      return [...list, inviterFriend];
    });
    setPendingInviter(null);
    if (typeof window !== 'undefined') {
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
    handleResetToDemoDefaults
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
    shareStatsWithFriends,
    setShareStatsWithFriends,
    shareRoutinesWithFriends,
    setShareRoutinesWithFriends
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
  } = useWorkoutMutations({
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
    userBodyweightLbs,
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
  });

  // --- 4. Plate & Weight Calculator Hook ---
  const {
    plateCalcTarget,
    setPlateCalcTarget,
    calcUnit,
    calcMode,
    setCalcMode,
    calcBarWeight,
    calcPlatesPerSide,
    setCalcPlatesPerSide,
    calcDirectTotal,
    setCalcDirectTotal,
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
          setRoutineSelectReturnView={setRoutineSelectReturnView}
          showHamburgerDrawer={showHamburgerDrawer}
          setShowHamburgerDrawer={setShowHamburgerDrawer}
          setShowFeedbackModal={setShowFeedbackModal}
          isRoutineEditorView={isRoutineEditorView}
          currentEditorWorkout={currentEditorWorkout}
          timerTrigger={timerTrigger}
          setTimerTrigger={setTimerTrigger}
          updateCurrentWorkoutState={updateCurrentWorkoutState}
          user={user}
          isStorageHydrated={isStorageHydrated}
          setAuthMode={setAuthMode}
        />

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

          {currentView === 'history' && (
            <HistoryView
              colors={colors}
              history={history}
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
              oneRepMaxes={effectiveOneRepMaxes}
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
              setDeleteConfirmTarget={setDeleteConfirmTarget}
              buildHistoryWorkoutEditorProps={buildHistoryWorkoutEditorProps}
            />
          )}

          {currentView === 'gyms' && (
            <GymsView
              colors={colors}
              gyms={gyms}
              setGyms={setGyms}
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
              customPrExerciseIds={customPrExerciseIds}
              setCustomPrExerciseIds={setCustomPrExerciseIds}
              selectedGymId={selectedGymId}
              gyms={gyms}
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
              totalHeightInches={totalHeightInches}
              history={history}
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
              setViewingFriendProfile={setViewingFriendProfile}
              setCurrentView={setCurrentView}
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

          {currentView === 'onboarding' && (
            <OnboardingView
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
              setOneRepMaxes={setOneRepMaxes}
              history={history}
              setHistory={setHistory}
              currentIncrementLbs={currentIncrementLbs}
              customPrExerciseIds={customPrExerciseIds}
              setCustomPrExerciseIds={setCustomPrExerciseIds}
              customGoalWeights={customGoalWeights}
              openPlateCalculatorForPR={openPlateCalculatorForPR}
              selectedGymId={selectedGymId}
              setSelectedGymId={setSelectedGymId}
              gyms={gyms}
              routinePreferences={routinePreferences}
              setRoutinePreferences={setRoutinePreferences}
            />
          )}

          {currentView === 'info' && (
            <InfoView colors={colors} />
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
