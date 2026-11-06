'use client';

import { useEffect, useRef } from 'react';
import {
  PERSISTENCE_KEY,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_MATT_FRIEND,
  ensureDefaultMattFriend,
  normalizeWorkoutFromStorage,
  normalizeSlotFromStorage,
  loadHydratedAppState
} from '../utils/storageMigration';
import {
  fetchCloudStateForUser,
  pushCloudStateForUser,
  resolveInviteFriendshipsForUser
} from '../utils/supabaseAuth';
import { getInitial1RMs, getBestHistory1RM } from '../utils/workoutEngine';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';

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
}) {
  const cloudSyncReadyForUserKeyRef = useRef(null);

  // 1. Client-Side LocalStorage Hydration, Recovery Hash & Invite Link Detection
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

    // Detect email invite join link (?invite_from=...&beta_code=imnotcrying)
    const searchParams = new URLSearchParams(window.location.search || '');
    const inviteFrom = (searchParams.get('invite_from') || '').trim();
    const inviteFromEmail = (searchParams.get('invite_from_email') || '').trim().toLowerCase();
    const invitedEmail = (searchParams.get('invited_email') || '').trim().toLowerCase();
    const inviteBetaCode = (searchParams.get('beta_code') || '').trim();

    if (inviteFrom) {
      const inviterObj = {
        username: inviteFrom,
        email: inviteFromEmail
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

      if (hydrated?.user) {
        setFriendsList(prev => {
          const list = ensureDefaultMattFriend(prev);
          const exists = list.some(
            f => (f.username || '').toLowerCase() === inviteFrom.toLowerCase()
          );
          if (exists) return list;
          return [
            ...list,
            {
              id: `friend_${inviteFrom.toLowerCase()}`,
              username: inviteFrom,
              email: inviteFromEmail,
              prs: {},
              sharedRoutines: []
            }
          ];
        });
      } else {
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

  // 2. Cross-Device Cloud Pull & Merge on Sign-In / Startup
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
                const existing = byKey.get(k);
                byKey.set(
                  k,
                  existing
                    ? {
                        ...existing,
                        ...f,
                        prs: { ...(existing.prs || {}), ...(f.prs || {}) },
                        history:
                          Array.isArray(existing.history) && existing.history.length > 0
                            ? existing.history
                            : f.history || []
                      }
                    : f
                );
              });
              return ensureDefaultMattFriend(Array.from(byKey.values()));
            });
          }

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

  // 3. Automatic Friend Request & Accepted Friendship Sync
  useEffect(() => {
    if (typeof window === 'undefined' || !isStorageHydrated) return;
    if (!user && (!Array.isArray(outgoingInvites) || outgoingInvites.length === 0)) return;

    let cancelled = false;
    (async () => {
      try {
        const { incomingRequests, matchedFriends, resolvedInviteEmails } =
          await resolveInviteFriendshipsForUser(user, outgoingInvites, friendsList);
        if (cancelled) return;

        if (Array.isArray(incomingRequests)) {
          setPendingIncomingRequests(prev => {
            const byKey = new Map();
            (Array.isArray(prev) ? prev : []).forEach(r => {
              if (!r) return;
              const k = String(r.username || r.email || r.id).toLowerCase();
              byKey.set(k, r);
            });
            incomingRequests.forEach(r => {
              if (!r) return;
              const k = String(r.username || r.email || r.id).toLowerCase();
              byKey.set(k, r);
            });
            const friendKeys = new Set(
              (Array.isArray(friendsList) ? friendsList : []).map(f =>
                String(f?.username || f?.email || f?.id).toLowerCase()
              )
            );
            return Array.from(byKey.values()).filter(
              r => !friendKeys.has(String(r?.username || r?.email || r?.id).toLowerCase())
            );
          });
        }

        if (Array.isArray(matchedFriends) && matchedFriends.length > 0) {
          setFriendsList(prev => {
            const byKey = new Map();
            ensureDefaultMattFriend(prev).forEach(f => {
              const k = String(f.username || f.email || f.id).toLowerCase();
              byKey.set(k, f);
            });
            matchedFriends.forEach(f => {
              if (!f) return;
              const k = String(f.username || f.email || f.id).toLowerCase();
              const existing = byKey.get(k);
              byKey.set(k, existing ? { ...existing, ...f } : f);
            });
            return ensureDefaultMattFriend(Array.from(byKey.values()));
          });
        }

        if (Array.isArray(resolvedInviteEmails) && resolvedInviteEmails.length > 0) {
          setOutgoingInvites(prev =>
            (Array.isArray(prev) ? prev : []).filter(inv => {
              const em = (typeof inv === 'string' ? inv : inv?.email || '').trim().toLowerCase();
              const un = (typeof inv === 'object' && inv?.username ? inv.username : '').trim().toLowerCase();
              return !resolvedInviteEmails.includes(em) && (!un || !resolvedInviteEmails.includes(un));
            })
          );
        }
      } catch {
        // ignore resolution error
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isStorageHydrated,
    user?.id,
    user?.email,
    `${outgoingInvites?.length || 0}_${friendsList?.length || 0}`
  ]);

  // 4. Debounced Automatic Versioned Persistence & Cloud Push
  useEffect(() => {
    if (typeof window === 'undefined' || !isStorageHydrated) return;
    const debounceTimer = setTimeout(() => {
      try {
        const historyBackedOneRepMaxes = { ...(oneRepMaxes || {}) };
        EXERCISE_LIBRARY.forEach(ex => {
          const best = getBestHistory1RM(ex.id, history);
          const cur = Number(historyBackedOneRepMaxes[ex.id]) || 0;
          if (best > cur) {
            historyBackedOneRepMaxes[ex.id] = best;
          }
        });

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
    shareStatsWithFriends,
    shareRoutinesWithFriends,
    selectedGymId
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

  return {
    handleExportBackupJSON,
    handleImportBackupJSON,
    handleResetToDemoDefaults
  };
}

