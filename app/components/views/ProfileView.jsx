'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import { EXERCISE_LIBRARY } from '../../data/exerciseLibrary';
import { getBestHistory1RM } from '../../utils/workoutEngine';
import {
  fetchAthleteProfileSnapshot,
  fetchFriendsOfAthlete,
  sendFriendRequestToAthlete,
  syncFriendshipsForUser,
  signOutUser
} from '../../utils/supabaseAuth';
import { isSameFriend, applyFriendshipSync } from '../../utils/storageMigration';
import { Button, TabBar } from '../Controls';
import { RoutinesView } from './RoutinesView';
import { buildProgressionSeriesByLift } from '../../hooks/useTelemetryAndAnalytics';

// Profile tabs: PROGRESS (their Progress page: chart / personal records / history) · ROUTINES · FRIENDS
const PROFILE_TABS = [
  { id: 'progress', label: 'PROGRESS' },
  { id: 'routines', label: 'ROUTINES' },
  { id: 'friends', label: 'FRIENDS' }
];

export function ProfileView({
  colors,
  currentView,
  viewingFriendProfile,
  setViewingFriendProfile,
  friendsList = [],
  setFriendsList,
  user,
  setUser,
  setCurrentView,
  fileInputRef,
  oneRepMaxes,
  history = [],
  sharedRoutines,
  handleOpenPreviewRoutine,
  setDeleteConfirmTarget,
  onDeleteAccount,
  appendSessionLog,
  // (opts) => the Progress page (tabs PROGRESS / PERSONAL RECORDS / HISTORY); opts.readOnly for a friend
  renderProgressPage,
  // Your own routines (same props as Configuration → ROUTINES)
  routinesProps
}) {
  // A boolean: effects depend on it, and the profile object is replaced after every server refresh (using the
  // object here made each refresh re-run both effects, looping between LOADING FRIENDS and the empty state)
  const isFriend = Boolean(currentView === 'friend_profile' && viewingFriendProfile);
  const [profileTab, setProfileTab] = useState('progress');
  // A friend's Progress page has its own inner tab (yours shares the PROGRESS page's)
  const [friendProgressTab, setFriendProgressTab] = useState('progress');
  const [friendUnavailable, setFriendUnavailable] = useState(false);
  // A friend's friends (public profiles only): { forId, result: { ok, friends } } for the profile it was loaded for
  const [friendsOfFriendEntry, setFriendsOfFriendEntry] = useState(null);
  // athleteId -> 'sending' | 'requested' | 'friends' | 'error'
  const [requestStatusById, setRequestStatusById] = useState({});
  // null | 'deleting' | error message
  const [accountDeleteStatus, setAccountDeleteStatus] = useState(null);

  const handleDeleteAccountClick = () => {
    setAccountDeleteStatus(null);
    setDeleteConfirmTarget?.({
      type: 'account',
      title: 'DELETE ACCOUNT?',
      verb: 'permanently delete',
      label: `@${user?.username} and all of your data (workouts, PRs, routines, friends). This cannot be undone`,
      confirmLabel: 'DELETE ACCOUNT ✕',
      onConfirm: async () => {
        setAccountDeleteStatus('deleting');
        const result = await onDeleteAccount?.();
        if (result?.ok) {
          appendSessionLog?.('ACCOUNT_DELETED', 'Account and all data deleted');
          setAccountDeleteStatus(null);
          setCurrentView('home');
        } else {
          setAccountDeleteStatus(result?.error || 'COULD NOT DELETE YOUR ACCOUNT.');
        }
      }
    });
  };

  // Refresh the friend's profile from the server by account id. RLS only returns it while you are
  // still friends; if the friendship was removed (by either athlete), drop the cached copy.
  useEffect(() => {
    if (!isFriend || !viewingFriendProfile?.id || !user) return;
    let cancelled = false;
    (async () => {
      const snapshot = await fetchAthleteProfileSnapshot(viewingFriendProfile, user);
      if (cancelled) return;
      if (snapshot) {
        const updatedFriend = { ...viewingFriendProfile, ...snapshot };
        setViewingFriendProfile?.(updatedFriend);
        setFriendsList?.(prev => (Array.isArray(prev) ? prev : []).map(f => (isSameFriend(f, updatedFriend) ? { ...f, ...snapshot } : f)));
        return;
      }
      // No row: confirm the friendship is gone (not just a network error) before clearing the cache
      const sync = await syncFriendshipsForUser(user);
      if (cancelled || !sync.ok || sync.friends.some(fr => isSameFriend(fr, viewingFriendProfile))) return;
      setFriendsList?.(prev => applyFriendshipSync(prev, sync));
      setFriendUnavailable(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isFriend, viewingFriendProfile?.id, user?.id]);

  // Their friends list (empty when their profile is private). Loaded once per profile; a result kept for
  // another profile counts as still loading, so nothing is reset in the cleanup.
  const viewingFriendId = viewingFriendProfile?.id || null;
  useEffect(() => {
    if (!isFriend || !viewingFriendId || !user) return;
    let cancelled = false;
    (async () => {
      const result = await fetchFriendsOfAthlete(user, viewingFriendId);
      if (!cancelled) {
        setFriendsOfFriendEntry({ forId: viewingFriendId, result });
        setRequestStatusById({});
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFriend, viewingFriendId, user?.id]);
  const friendsOfFriend = friendsOfFriendEntry?.forId === viewingFriendId ? friendsOfFriendEntry.result : null;

  const handleRequestFriend = async athlete => {
    setRequestStatusById(prev => ({ ...prev, [athlete.id]: 'sending' }));
    const result = await sendFriendRequestToAthlete(user, athlete);
    const next = !result.ok ? 'error' : result.status === 'accepted' ? 'friends' : 'requested';
    setRequestStatusById(prev => ({ ...prev, [athlete.id]: next }));
    appendSessionLog?.('FRIEND_REQUEST', `Request to @${athlete.username} from a friend's profile: ${next}`);
  };

  // Prefer the cached friends-list copy (kept fresh by the friendship sync)
  const liveFriendMatch = isFriend
    ? (friendsList || []).find(f => isSameFriend(f, viewingFriendProfile)) || viewingFriendProfile
    : null;

  const profUser = isFriend
    ? liveFriendMatch
    : user || { username: 'guest', email: 'Not Signed In' };

  // A friend's logged History (the stored array itself, so the chart below is only rebuilt when it changes)
  const friendHistorySource = isFriend
    ? liveFriendMatch?.history?.length
      ? liveFriendMatch.history
      : viewingFriendProfile?.history
    : null;
  const profHistory = isFriend ? friendHistorySource || [] : history || [];
  const rawProfPRs = isFriend
    ? { ...(viewingFriendProfile?.prs || {}), ...(liveFriendMatch?.prs || {}) }
    : oneRepMaxes || {};

  const profPRs = { ...rawProfPRs };
  if (Array.isArray(profHistory) && profHistory.length > 0) {
    EXERCISE_LIBRARY.forEach(ex => {
      const bestHist = getBestHistory1RM(ex.id, profHistory);
      if (bestHist > (Number(profPRs[ex.id]) || 0)) {
        profPRs[ex.id] = bestHist;
      }
    });
  }

  const profRoutines = isFriend
    ? liveFriendMatch?.sharedRoutines || viewingFriendProfile?.sharedRoutines || []
    : sharedRoutines;
  // A friend's PROGRESS chart is built from their logged History
  const friendSeriesByLift = useMemo(
    () => (isFriend ? buildProgressionSeriesByLift(friendHistorySource || []) : null),
    [isFriend, friendHistorySource]
  );

  return (
    <div style={{ paddingTop: '14px' }}>
      {isFriend && (
        <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '12px' }}>
          <button
            type="button"
            onClick={() => setCurrentView('social')}
            className="kinetic-btn"
            style={{
              padding: '8px 14px',
              backgroundColor: '#161618',
              color: '#FFFFFF',
              border: '2px solid var(--dp-color-rule)',
              fontSize: '12px',
              fontWeight: 800,
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ← BACK TO SOCIAL
          </button>
        </div>
      )}
      {isFriend && friendUnavailable && (
        <IOSListSection header="PROFILE UNAVAILABLE" colors={colors}>
          <IOSListRow isLast={true} colors={colors}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#A0A0A0', lineHeight: 1.4 }}>
              You and @{viewingFriendProfile.username} are no longer friends, so their profile is private.
            </span>
          </IOSListRow>
        </IOSListSection>
      )}

      {!(isFriend && friendUnavailable) && (
      <>
      <IOSListSection header="ATHLETE IDENTITY" colors={colors}>
        <IOSListRow isLast={isFriend || !user} colors={colors}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
              @{profUser.username}
            </div>
            {!isFriend && (
              <div style={{ fontSize: '12px', color: '#A0A0A0', fontWeight: 700 }}>{profUser.email}</div>
            )}
          </div>

          {!isFriend && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '8px 12px', backgroundColor: '#101010',
                color: 'var(--dp-color-accent)', border: '2px solid var(--dp-color-rule)',
                fontSize: '11px', fontWeight: 800, cursor: 'pointer'
              }}
            >
              PHOTO
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} />
        </IOSListRow>

        {!isFriend && user && (
          <IOSListRow isLast={true} colors={colors}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#A0A0A0' }}>ACTIVE ACCOUNT SESSION</span>
            <button
              type="button"
              onClick={() => {
                signOutUser();
                setUser(null);
                setCurrentView('home');
              }}
              className="kinetic-btn"
              style={{
                padding: '6px 12px', backgroundColor: '#161616', color: '#FF3B30',
                border: '2px solid var(--dp-color-rule)', fontSize: '11px',
                fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
              }}
            >
              SIGN OUT
            </button>
          </IOSListRow>
        )}
      </IOSListSection>

      <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '4px' }}>
        <TabBar ariaLabel="Profile sections" tabs={PROFILE_TABS} value={profileTab} onChange={setProfileTab} />
      </div>

      {profileTab === 'progress' &&
        renderProgressPage?.(
          isFriend
            ? {
                readOnly: true,
                history: profHistory,
                oneRepMaxes: profPRs,
                seriesByLift: friendSeriesByLift,
                tab: friendProgressTab,
                onTabChange: setFriendProgressTab
              }
            : {}
        )}

      {profileTab === 'routines' &&
        (isFriend ? (
          <RoutinesView
            colors={colors}
            user={{ username: profUser.username }}
            savedRoutines={[]}
            sharedRoutines={profRoutines}
            friendsList={[]}
            selectedGymId=""
            gyms={[]}
            routineSelectReturnView={null}
            handleDirectLoadRoutine={handleOpenPreviewRoutine}
            showCancel={false}
            sections={['shared']}
            readOnly={true}
          />
        ) : (
          <RoutinesView colors={colors} showCancel={false} {...routinesProps} />
        ))}

      {profileTab === 'friends' && !isFriend && (
        <IOSListSection header={`FRIENDS (${(friendsList || []).length})`} colors={colors}>
          {(friendsList || []).length === 0 ? (
            <IOSListRow isLast={true} colors={colors}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#A0A0A0', textTransform: 'uppercase' }}>NO FRIENDS YET</span>
            </IOSListRow>
          ) : (
            friendsList.map((friend, i) => (
              <IOSListRow
                key={friend.id}
                isLast={i === friendsList.length - 1}
                colors={colors}
                onClick={() => {
                  setViewingFriendProfile?.(friend);
                  setCurrentView('friend_profile');
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>@{friend.username}</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--dp-color-accent)', flexShrink: 0 }}>VIEW PROFILE →</span>
              </IOSListRow>
            ))
          )}
        </IOSListSection>
      )}

      {profileTab === 'friends' && isFriend && (
        <IOSListSection
          header={`@${profUser.username}'S FRIENDS`}
          colors={colors}
        >
          {!friendsOfFriend ? (
            <IOSListRow isLast={true} colors={colors}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#A0A0A0', textTransform: 'uppercase' }}>LOADING FRIENDS…</span>
            </IOSListRow>
          ) : friendsOfFriend.ok && friendsOfFriend.friends.length === 0 ? (
            <IOSListRow isLast={true} colors={colors}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#A0A0A0' }}>No public friends to show, or this profile is private.</span>
            </IOSListRow>
          ) : !friendsOfFriend.ok ? (
            <IOSListRow isLast={true} colors={colors}>
              <span style={{ fontSize: '12px', color: '#FF3B30', fontWeight: 700 }}>COULD NOT LOAD THEIR FRIENDS.</span>
            </IOSListRow>
          ) : (
            friendsOfFriend.friends.map((athlete, i) => {
              const status = requestStatusById[athlete.id] || athlete.relation;
              return (
                <IOSListRow key={athlete.id} isLast={i === friendsOfFriend.friends.length - 1} colors={colors}>
                  <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase' }}>@{athlete.username}</span>
                  {status === 'friends' ? (
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#30D158' }}>FRIENDS ✓</span>
                  ) : status === 'requested' ? (
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#A0A0A0' }}>REQUESTED</span>
                  ) : (
                    <Button
                      variant="primary"
                      disabled={status === 'sending'}
                      onClick={() => handleRequestFriend(athlete)}
                      style={{ width: 'auto', flexShrink: 0, padding: '6px 12px', fontSize: '11px', border: '2px solid var(--dp-color-rule)' }}
                    >
                      {status === 'sending'
                        ? 'SENDING…'
                        : status === 'error'
                          ? 'RETRY'
                          : status === 'incoming'
                            ? 'ACCEPT'
                            : 'REQUEST'}
                    </Button>
                  )}
                </IOSListRow>
              );
            })
          )}
        </IOSListSection>
      )}

      {/* ACCOUNT: kept at the very bottom so the permanent delete is out of the way */}
      {!isFriend && user && (
        <IOSListSection header="ACCOUNT" colors={colors}>
          <IOSListRow isLast={!accountDeleteStatus} colors={colors}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#A0A0A0' }}>PERMANENTLY DELETE YOUR ACCOUNT AND DATA</span>
            <Button
              variant="danger"
              disabled={accountDeleteStatus === 'deleting'}
              onClick={handleDeleteAccountClick}
              style={{ width: 'auto', flexShrink: 0, padding: '6px 12px', fontSize: '11px', border: '2px solid var(--dp-color-rule)' }}
            >
              DELETE ACCOUNT
            </Button>
          </IOSListRow>
          {accountDeleteStatus && (
            <IOSListRow isLast={true} colors={colors}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: accountDeleteStatus === 'deleting' ? '#A0A0A0' : '#FF3B30'
                }}
              >
                {accountDeleteStatus === 'deleting' ? 'DELETING ACCOUNT…' : `⚠ ${accountDeleteStatus}`}
              </span>
            </IOSListRow>
          )}
        </IOSListSection>
      )}
      </>
      )}
    </div>
  );
}
