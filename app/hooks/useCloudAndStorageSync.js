'use client';

import { normalizeProgramId } from '../data/programs';
import { useState, useEffect, useRef } from 'react';
import {
  PERSISTENCE_KEY,
  CURRENT_SCHEMA_VERSION,
  applyFriendshipSync,
  applyOutgoingInvitesSync,
  normalizeWorkoutFromStorage,
  normalizeSlotFromStorage,
  loadHydratedAppState
} from '../utils/storageMigration';
import {
  fetchCloudStateForUser,
  pushCloudStateForUser,
  deleteCloudWorkoutsByIds,
  syncFriendshipsForUser,
  fetchLatestFriendWorkoutStamp,
  signOutUser,
  deleteMyAccount,
  purgeLegacyStoredPasswords,
  isUuid,
  SESSION_EXPIRED_EVENT
} from '../utils/supabaseAuth';
import {
  getCloudSyncLedger,
  setSyncedWorkouts,
  markWorkoutsSynced,
  clearDeletedWorkoutIds,
  forgetCloudSyncLedger,
  workoutSyncSignature
} from '../utils/cloudSyncLedger';
import { getInitial1RMs, buildHistoryPRs } from '../utils/workoutEngine';
import { getEquipmentListForGymSelection, normalizeSlotCategory } from '../data/exerciseLibrary';

// How often an on-screen app checks whether a friend has logged a new workout (one tiny request)
const FRIEND_ACTIVITY_POLL_MS = 30000;

export function useCloudAndStorageSync({
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
  // Training program id (settings.program; Configuration → PROGRAM)
  trainingProgram,
  setTrainingProgram,
  programCycleStart = null,
  setProgramCycleStart,
  programSchedules = {},
  setProgramSchedules,
  shareStatsWithFriends,
  setShareStatsWithFriends,
  shareRoutinesWithFriends,
  setShareRoutinesWithFriends,
  profileIsPublic,
  setProfileIsPublic,
  // Share bodyweight with friends (settings.social.shareBodyweightWithFriends; off unless turned on)
  shareBodyweightWithFriends = false,
  setShareBodyweightWithFriends,
  // Profile photo (small JPEG data URL; settings.profilePhoto, local + cloud)
  profilePhoto,
  setProfilePhoto
}) {
  const cloudSyncReadyForUserKeyRef = useRef(null);
  const [cloudPullReadyTick, setCloudPullReadyTick] = useState(0);
  // Bumped when a friend logs or changes a workout (3b), so friends' data reloads straight away
  const [friendActivityTick, setFriendActivityTick] = useState(0);
  // Cloud sync health shown in the app: state 'idle' | 'syncing' | 'ok' | 'error'
  const [cloudSyncStatus, setCloudSyncStatus] = useState({ state: 'idle', error: null });
  // Bumped to pull again (RETRY button, app returning to the foreground, network back online)
  const [cloudSyncRetryTick, setCloudSyncRetryTick] = useState(0);
  const lastCloudPullAtRef = useRef(0);


  // 1. Client-Side LocalStorage Hydration, Recovery Hash & Invite Link Detection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Older builds kept plain-text passwords on the device; delete them before anything else
    purgeLegacyStoredPasswords();

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
      setFriendsList(hydrated.friendsList || []);
      if (hydrated.pendingIncomingRequests) setPendingIncomingRequests(hydrated.pendingIncomingRequests);
      if (hydrated.outgoingInvites) setOutgoingInvites(hydrated.outgoingInvites);
      if (hydrated.settings) {
        setSelectedGymId(hydrated.settings.selectedGymId || '');
        setAvailableEquipment(
          Array.isArray(hydrated.settings.availableEquipment)
            ? hydrated.settings.availableEquipment
            : getEquipmentListForGymSelection(hydrated.settings.selectedGymId, hydrated.gyms || [])
        );
        if (hydrated.settings.goals) {
          setGoalType(hydrated.settings.goals.goalType || 'Balanced');
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
        if (Array.isArray(hydrated.settings.setPreferences) && hydrated.settings.setPreferences.length > 0) {
          setSetPreferences?.(hydrated.settings.setPreferences);
        }
        setTrainingProgram?.(normalizeProgramId(hydrated.settings.program));
        setProgramCycleStart?.(hydrated.settings.programCycleStart || null);
        setProgramSchedules?.(hydrated.settings.programSchedules || {});
        if (typeof hydrated.settings.profilePhoto === 'string') setProfilePhoto?.(hydrated.settings.profilePhoto);
        if (hydrated.settings.social) {
          setShareStatsWithFriends(hydrated.settings.social.shareStatsWithFriends ?? true);
          setShareRoutinesWithFriends(hydrated.settings.social.shareRoutinesWithFriends ?? true);
          setProfileIsPublic(hydrated.settings.social.profileIsPublic ?? true);
          setShareBodyweightWithFriends?.(hydrated.settings.social.shareBodyweightWithFriends === true);
        }
      }
    }
    setIsStorageHydrated(true);

    const hash = window.location.hash || '';
    if (hash.includes('type=recovery') && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const token = params.get('access_token');
      if (token) {
        setRecoveryAccessToken({ accessToken: token, refreshToken: params.get('refresh_token') || null });
        setCurrentView('auth');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }

    // Detect email invite join link (?invite_from=...&beta_code=imnotcrying)
    const searchParams = new URLSearchParams(window.location.search || '');
    const inviteFrom = (searchParams.get('invite_from') || '').trim();
    const inviteFromEmail = (searchParams.get('invite_from_email') || '').trim().toLowerCase();
    const invitedEmail = (searchParams.get('invited_email') || '').trim().toLowerCase();
    const inviteBetaCode = (searchParams.get('beta_code') || '').trim();
    const inviteId = (searchParams.get('invite_id') || '').trim();

    if (inviteFrom) {
      const inviterObj = {
        username: inviteFrom,
        email: inviteFromEmail,
        // Claimed on the next friendship sync once signed in (claimPendingInviteLink)
        inviteId: inviteId || undefined
      };
      setPendingInviter(inviterObj);
      try {
        window.localStorage.setItem('yccih_pending_inviter_v1', JSON.stringify(inviterObj));
      } catch {
        // ignore storage error
      }
      if (inviteBetaCode) setSignupBetaCode(inviteBetaCode);
      else setSignupBetaCode('imnotcrying');
      if (invitedEmail) setSignupEmail(invitedEmail);

      // Signed-in athletes: the invite is claimed server-side on the next friendship sync
      // (claim_invite_link by the link's invite id, then claim_my_invites by email).
      if (!hydrated?.user) {
        setAuthMode('signup');
        setCurrentView('auth');
      }
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      try {
        const storedInviter = window.localStorage.getItem('yccih_pending_inviter_v1');
        if (storedInviter) {
          const parsedInviter = JSON.parse(storedInviter);
          if (parsedInviter?.username) {
            setPendingInviter(parsedInviter);
            setSignupBetaCode(prev => prev || 'imnotcrying');
          }
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // 1b. Session expiry: when Supabase rejects the refresh token (revoked/expired session), sign out on
  // this device. Local workout data stays; the athlete signs in again to resume cloud sync.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onExpired = () => {
      try {
        window.sessionStorage.setItem('yccih_session_expired', '1');
      } catch {
        // ignore storage error
      }
      setUser(null);
      setAuthMode('login');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [setUser, setAuthMode]);

  // 2. Cross-Device Cloud Pull & Merge on Sign-In / Startup
  useEffect(() => {
    if (typeof window === 'undefined' || !isStorageHydrated) return;
    const userKey = user?.id || user?.email || user?.username || null;
    if (!userKey) {
      cloudSyncReadyForUserKeyRef.current = null;
      return;
    }
    const isCloudAccount = isUuid(user?.id);

    // Hold uploads until this pull finishes, so a device can't re-upload a workout that another
    // device deleted before it learns about the deletion.
    cloudSyncReadyForUserKeyRef.current = null;
    lastCloudPullAtRef.current = Date.now();

    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (isCloudAccount) setCloudSyncStatus(prev => ({ state: 'syncing', error: prev.error }));
      try {
        // Retry deletions that haven't reached the server yet
        const pendingDeletes = Array.from(getCloudSyncLedger(user).deleted);
        if (isCloudAccount && pendingDeletes.length > 0) {
          const del = await deleteCloudWorkoutsByIds(user, pendingDeletes);
          if (del.ok) clearDeletedWorkoutIds(user, pendingDeletes);
        }

        const cloud = await fetchCloudStateForUser(user);
        if (cancelled) return;

        if (cloud?.error) {
          if (isCloudAccount) {
            setCloudSyncStatus({ state: 'error', error: `COULD NOT DOWNLOAD YOUR DATA (${cloud.error})` });
          }
        } else if (cloud && typeof cloud === 'object') {
          if (isCloudAccount) setCloudSyncStatus({ state: 'ok', error: null });
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

          // History: workout_history is the source of truth. Workouts this device already confirmed
          // on the server but that are gone now were deleted on another device, so drop them here;
          // workouts never confirmed are kept and uploaded by the next push.
          {
            const ledger = getCloudSyncLedger(user);
            const serverIds = new Set(cloud.tableHistoryIds || []);
            const cloudWorkouts = (Array.isArray(cloud.history) ? cloud.history : [])
              .filter(w => w && w.id && !ledger.deleted.has(String(w.id)))
              .map(w => normalizeWorkoutFromStorage(w));
            setHistory(prev => {
              const byId = new Map();
              (Array.isArray(prev) ? prev : []).forEach(w => {
                if (!w || !w.id) return;
                const id = String(w.id);
                if (ledger.deleted.has(id)) return;
                if (ledger.synced[id] && !serverIds.has(id)) return;
                byId.set(w.id, normalizeWorkoutFromStorage(w));
              });
              cloudWorkouts.forEach(w => {
                if (!byId.has(w.id)) byId.set(w.id, w);
              });
              return Array.from(byId.values()).sort(
                (a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime()
              );
            });
            if (isCloudAccount) {
              const confirmed = {};
              cloudWorkouts.forEach(w => {
                if (serverIds.has(String(w.id))) confirmed[String(w.id)] = workoutSyncSignature(w);
              });
              setSyncedWorkouts(user, confirmed);
            }
          }

          // Only an in-progress session (with exercises) carries over from another device
          if (cloud.activeSession && typeof cloud.activeSession === 'object' && (cloud.activeSession.slots || []).length > 0) {
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

          // Friends are not restored from the cloud snapshot; the friendship sync below loads them
          // from public.friendships.

          if (Array.isArray(cloud.outgoingInvites) && cloud.outgoingInvites.length > 0) {
            setOutgoingInvites(prev => {
              const byEmail = new Map();
              (Array.isArray(prev) ? prev : []).forEach(inv => {
                const em = (typeof inv === 'string' ? inv : inv?.email || '').trim().toLowerCase();
                if (em) byEmail.set(em, typeof inv === 'string' ? { email: em } : inv);
              });
              cloud.outgoingInvites.forEach(inv => {
                const em = (typeof inv === 'string' ? inv : inv?.email || '').trim().toLowerCase();
                if (em && !byEmail.has(em)) byEmail.set(em, typeof inv === 'string' ? { email: em } : inv);
              });
              return Array.from(byEmail.values());
            });
          }

          if (cloud.settings && typeof cloud.settings === 'object') {
            if (cloud.settings.selectedGymId !== undefined) {
              setSelectedGymId(prev => prev || cloud.settings.selectedGymId || '');
            }
            if (Array.isArray(cloud.settings.availableEquipment)) {
              setAvailableEquipment(cloud.settings.availableEquipment);
            }
            // A photo set (or removed) on another device; an account that never set one keeps this device's
            if ('profilePhoto' in cloud.settings && cloud.settings.updatedAt) {
              setProfilePhoto?.(typeof cloud.settings.profilePhoto === 'string' ? cloud.settings.profilePhoto : null);
            }
            if (cloud.settings.bodyMetrics) {
              if (cloud.settings.bodyMetrics.bodyweightLbs) setUserBodyweightLbs(cloud.settings.bodyMetrics.bodyweightLbs);
              if (cloud.settings.bodyMetrics.heightFeet !== undefined) setUserHeightFeet(cloud.settings.bodyMetrics.heightFeet);
              if (cloud.settings.bodyMetrics.heightInches !== undefined) setUserHeightInches(cloud.settings.bodyMetrics.heightInches);
            }
            if (cloud.settings.goals) {
              // Only a goal the app saved (pushes stamp settings.updatedAt): a new account's row holds the database
              // defaults (Strength), which would override the app's default (Balanced)
              if (cloud.settings.goals.goalType && cloud.settings.updatedAt) setGoalType(cloud.settings.goals.goalType);
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
              setRoutinePreferences(cloud.settings.routinePreferences.map(p => normalizeSlotCategory(p)));
            }
            if (
              Array.isArray(cloud.settings.setPreferences) &&
              cloud.settings.setPreferences.length > 0 &&
              cloud.settings.setPreferences.every(t => ['Warmup', 'Working', 'Top Out', 'Burn Out'].includes(t))
            ) {
              setSetPreferences?.(cloud.settings.setPreferences);
            }
            if (typeof cloud.settings.program === 'string') setTrainingProgram?.(normalizeProgramId(cloud.settings.program));
            if (typeof cloud.settings.programCycleStart === 'string') setProgramCycleStart?.(cloud.settings.programCycleStart);
            if (cloud.settings.programSchedules && typeof cloud.settings.programSchedules === 'object') {
              setProgramSchedules?.(cloud.settings.programSchedules);
            }
            if (cloud.settings.social) {
              if (cloud.settings.social.shareStatsWithFriends !== undefined) {
                setShareStatsWithFriends(cloud.settings.social.shareStatsWithFriends);
              }
              if (cloud.settings.social.shareRoutinesWithFriends !== undefined) {
                setShareRoutinesWithFriends(cloud.settings.social.shareRoutinesWithFriends);
              }
              if (cloud.settings.social.profileIsPublic !== undefined) {
                setProfileIsPublic(cloud.settings.social.profileIsPublic);
              }
              if (cloud.settings.social.shareBodyweightWithFriends !== undefined) {
                setShareBodyweightWithFriends?.(cloud.settings.social.shareBodyweightWithFriends === true);
              }
            }
          }
        }
      } catch {
        if (!cancelled && isCloudAccount) {
          setCloudSyncStatus({ state: 'error', error: 'COULD NOT DOWNLOAD YOUR DATA' });
        }
      } finally {
        if (!cancelled) {
          cloudSyncReadyForUserKeyRef.current = userKey;
          setCloudPullReadyTick(t => t + 1);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isStorageHydrated, user?.id, user?.email, user?.username, cloudSyncRetryTick]);

  // 2b. Pull again when the app comes back to the foreground (home-screen apps on iOS stay suspended
  // in the background rather than reloading) or the network returns. At most once every 30 seconds.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const retry = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastCloudPullAtRef.current < 30 * 1000) return;
      setCloudSyncRetryTick(t => t + 1);
    };
    document.addEventListener('visibilitychange', retry);
    window.addEventListener('online', retry);
    return () => {
      document.removeEventListener('visibilitychange', retry);
      window.removeEventListener('online', retry);
    };
  }, []);

  const retryCloudSync = () => setCloudSyncRetryTick(t => t + 1);

  // 3. Friendship sync: public.friendships is the source of truth (accepted friends + pending
  // requests). Friends removed by either athlete disappear here.
  useEffect(() => {
    if (typeof window === 'undefined' || !isStorageHydrated) return;
    if (!user) {
      // Signed out: keep no friends' data on this device
      setFriendsList([]);
      setPendingIncomingRequests([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await syncFriendshipsForUser(user);
      if (cancelled || !result.ok) return;
      setFriendsList(prev => applyFriendshipSync(prev, result));
      setPendingIncomingRequests(result.incomingRequests);
      setOutgoingInvites(prev => applyOutgoingInvitesSync(prev, result));
    })();

    return () => {
      cancelled = true;
    };
  }, [isStorageHydrated, user?.id, cloudPullReadyTick, friendActivityTick]);

  // 3b. Friends' new workouts (Home ticker, leaderboards, profiles) without waiting for the next full pull: every
  // FRIEND_ACTIVITY_POLL_MS while the app is on screen, a one-row check of the newest friend workout; when it
  // changes, the friendship sync above re-reads friends' data.
  useEffect(() => {
    if (typeof window === 'undefined' || !isStorageHydrated || !user) return undefined;
    let lastStamp = null;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      const { ok, stamp } = await fetchLatestFriendWorkoutStamp(user);
      if (stopped || !ok) return;
      if (lastStamp !== null && stamp !== lastStamp) setFriendActivityTick(t => t + 1);
      lastStamp = stamp;
    };
    check();
    const timer = setInterval(check, FRIEND_ACTIVITY_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [isStorageHydrated, user?.id]);

  // 4. Debounced Automatic Versioned Persistence & Cloud Push
  useEffect(() => {
    if (typeof window === 'undefined' || !isStorageHydrated) return;
    const debounceTimer = setTimeout(() => {
      try {
        // Saved / uploaded 1RMs are exactly the History-based ones (one pass): numbers without logged data
        // (old imports, removed workouts) drop out here instead of being carried forward
        const historyBackedOneRepMaxes = buildHistoryPRs(history);

        const payload = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
          user,
          oneRepMaxes: historyBackedOneRepMaxes,
          history,
          activeSession,
          savedRoutines,
          sharedRoutines,
          gyms,
          friendsList,
          pendingIncomingRequests,
          outgoingInvites,
          settings: {
            schemaVersion: CURRENT_SCHEMA_VERSION,
            prDefaultsCleanedV4: true,
            bodyMetrics: {
              bodyweightLbs: userBodyweightLbs,
              heightFeet: userHeightFeet,
              heightInches: userHeightInches
            },
            goals: {
              goalType,
              goalIncrement,
              goalUnit,
              chartMetric,
              targetStandardClass,
              customGoalWeights
            },
            stimulus: { greenDays: stimulusGreenDays, yellowDays: stimulusYellowDays },
            routinePreferences,
            setPreferences,
            program: trainingProgram || 'crying',
            programCycleStart: programCycleStart || null,
            programSchedules: programSchedules || {},
            social: { shareStatsWithFriends, shareRoutinesWithFriends, profileIsPublic, shareBodyweightWithFriends },
            selectedGymId,
            availableEquipment,
            profilePhoto: profilePhoto || null
          }
        };
        window.localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(payload));

        const userKey = user?.id || user?.email || user?.username || null;
        if (user && userKey && cloudSyncReadyForUserKeyRef.current === userKey) {
          // Upload only workouts that are new or changed since the server last confirmed them
          const ledger = getCloudSyncLedger(user);
          const signatures = {};
          const historyToUpload = (Array.isArray(history) ? history : []).filter(w => {
            if (!w || !w.id || ledger.deleted.has(String(w.id))) return false;
            const sig = workoutSyncSignature(w);
            signatures[String(w.id)] = sig;
            return ledger.synced[String(w.id)] !== sig;
          });
          pushCloudStateForUser(user, payload, { historyToUpload }).then(result => {
            if (!result || !isUuid(user.id)) return;
            const confirmed = {};
            (result.syncedWorkoutIds || []).forEach(id => {
              if (signatures[id]) confirmed[id] = signatures[id];
            });
            if (Object.keys(confirmed).length > 0) markWorkoutsSynced(user, confirmed);
            const notUploaded = result.failedWorkoutCount
              ? `${result.failedWorkoutCount} WORKOUT${result.failedWorkoutCount === 1 ? '' : 'S'} NOT UPLOADED — `
              : '';
            const next = result.ok
              ? { state: 'ok', error: null }
              : { state: 'error', error: `COULD NOT UPLOAD YOUR DATA (${notUploaded}${result.error})` };
            // A failed download is the more basic problem: keep showing it until the next pull
            setCloudSyncStatus(prev =>
              prev.state === 'error' && String(prev.error || '').startsWith('COULD NOT DOWNLOAD') ? prev : next
            );
          });
        }
      } catch (err) {
        console.warn('Failed to save state to localStorage:', err);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [
    isStorageHydrated,
    user,
    oneRepMaxes,
    history,
    activeSession,
    savedRoutines,
    sharedRoutines,
    gyms,
    friendsList,
    pendingIncomingRequests,
    outgoingInvites,
    userBodyweightLbs,
    userHeightFeet,
    userHeightInches,
    goalType,
    goalIncrement,
    goalUnit,
    chartMetric,
    targetStandardClass,
    customGoalWeights,
    stimulusGreenDays,
    stimulusYellowDays,
    routinePreferences,
    setPreferences,
    trainingProgram,
    programCycleStart,
    programSchedules,
    shareStatsWithFriends,
    shareRoutinesWithFriends,
    profileIsPublic,
    shareBodyweightWithFriends,
    selectedGymId,
    availableEquipment,
    profilePhoto,
    cloudPullReadyTick
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
          if (Array.isArray(rehydrated.settings.setPreferences)) setSetPreferences?.(rehydrated.settings.setPreferences);
          setTrainingProgram?.(normalizeProgramId(rehydrated.settings.program));
          setProgramCycleStart?.(rehydrated.settings.programCycleStart || null);
          setProgramSchedules?.(rehydrated.settings.programSchedules || {});
          setShareStatsWithFriends(rehydrated.settings.social.shareStatsWithFriends);
          setShareRoutinesWithFriends(rehydrated.settings.social.shareRoutinesWithFriends);
          setProfileIsPublic(rehydrated.settings.social.profileIsPublic ?? true);
          setShareBodyweightWithFriends?.(rehydrated.settings.social.shareBodyweightWithFriends === true);
          setSelectedGymId(rehydrated.settings.selectedGymId);
          setAvailableEquipment(
            Array.isArray(rehydrated.settings.availableEquipment)
              ? rehydrated.settings.availableEquipment
              : getEquipmentListForGymSelection(rehydrated.settings.selectedGymId, rehydrated.gyms || [])
          );
        }
      } catch {
        // ignore
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleResetToDemoDefaults = () => {
    signOutUser();
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
    setGoalType('Balanced');
    setGoalIncrement(1.25);
    setGoalUnit('lb');
    setTargetStandardClass('Intermediate');
    setCustomGoalWeights({});
    setStimulusGreenDays(2);
    setStimulusYellowDays(4);
    setRoutinePreferences(['Compound', 'Compound', 'Superset', 'Superset', 'Abs']);
    setSetPreferences?.(['Warmup', 'Warmup', 'Working', 'Working', 'Working']);
    setTrainingProgram?.('crying');
    setProgramCycleStart?.(null);
    setProgramSchedules?.({});
    setShareStatsWithFriends(true);
    setShareRoutinesWithFriends(true);
    setSelectedGymId('');
  };

  /**
   * Permanently deletes the signed-in account (server data + sign-in account), then erases this
   * account's data from this device and resets the app. Returns { ok, error }.
   */
  const handleDeleteAccount = async () => {
    const deletingUser = user;
    const result = await deleteMyAccount(deletingUser);
    if (!result.ok) return result;
    try {
      [PERSISTENCE_KEY, 'yccih_pending_inviter_v1', 'yccih_local_friend_requests_v1'].forEach(key =>
        window.localStorage.removeItem(key)
      );
      const onboarded = JSON.parse(window.localStorage.getItem('yccih_onboarded_users_v1') || '{}');
      [deletingUser?.email, deletingUser?.username, deletingUser?.id].forEach(k => {
        if (k) delete onboarded[String(k).toLowerCase()];
      });
      window.localStorage.setItem('yccih_onboarded_users_v1', JSON.stringify(onboarded));
    } catch {
      // ignore storage errors
    }
    forgetCloudSyncLedger(deletingUser);
    handleResetToDemoDefaults();
    return { ok: true };
  };

  return {
    handleExportBackupJSON,
    handleImportBackupJSON,
    handleResetToDemoDefaults,
    handleDeleteAccount,
    cloudSyncStatus,
    retryCloudSync
  };
}

