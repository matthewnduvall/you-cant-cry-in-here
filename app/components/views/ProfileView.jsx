'use client';

import React, { useEffect, useState } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import { CORE_PR_EXERCISE_IDS, EXERCISE_LIBRARY, EXERCISE_MAP } from '../../data/exerciseLibrary';
import { getBestHistory1RM } from '../../utils/workoutEngine';
import {
  fetchAthleteProfileSnapshot,
  fetchFriendsOfAthlete,
  sendFriendRequestToAthlete,
  syncFriendshipsForUser,
  signOutUser
} from '../../utils/supabaseAuth';
import { isSameFriend, applyFriendshipSync } from '../../utils/storageMigration';
import { Button } from '../Controls';

const PROFILE_PR_LIMIT = 10;

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
  openPlateCalculatorForPR,
  handleOpenPreviewRoutine,
  setDeleteConfirmTarget,
  onDeleteAccount,
  appendSessionLog
}) {
  const isFriend = currentView === 'friend_profile' && viewingFriendProfile;
  const [showAllPrs, setShowAllPrs] = useState(false);
  const [friendUnavailable, setFriendUnavailable] = useState(false);
  // A friend's friends (public profiles only): null while loading, else { ok, friends }
  const [friendsOfFriend, setFriendsOfFriend] = useState(null);
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

  // Their friends list (empty when their profile is private)
  useEffect(() => {
    if (!isFriend || !viewingFriendProfile?.id || !user) return;
    let cancelled = false;
    (async () => {
      const result = await fetchFriendsOfAthlete(user, viewingFriendProfile.id);
      if (!cancelled) setFriendsOfFriend(result);
    })();
    return () => {
      cancelled = true;
      setFriendsOfFriend(null);
      setRequestStatusById({});
    };
  }, [isFriend, viewingFriendProfile?.id, user]);

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

  const profHistory = isFriend
    ? (liveFriendMatch?.history?.length ? liveFriendMatch.history : viewingFriendProfile?.history) || []
    : history || [];
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

  // Logged PRs sorted heaviest first, then any core lifts still TBD; show the top 10 until expanded.
  const allPrRows = Array.from(
    new Set([...CORE_PR_EXERCISE_IDS, ...Object.keys(profPRs || {}).filter(id => Number(profPRs[id]) > 0)])
  )
    .map(id => EXERCISE_MAP[id])
    .filter(Boolean)
    .map(ex => {
      const rawVal = Math.max(Number(profPRs?.[ex.id]) || 0, getBestHistory1RM(ex.id, profHistory));
      return { ex, rawVal, isTBD: rawVal <= 0 };
    })
    .sort((a, b) => b.rawVal - a.rawVal);
  const hasMorePrs = allPrRows.length > PROFILE_PR_LIMIT;
  const visiblePrRows = showAllPrs ? allPrRows : allPrRows.slice(0, PROFILE_PR_LIMIT);

  const profRoutines = isFriend
    ? liveFriendMatch?.sharedRoutines || viewingFriendProfile?.sharedRoutines || []
    : sharedRoutines;

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

      <IOSListSection header="PERSONAL RECORDS" colors={colors}>
        {visiblePrRows.map(({ ex, rawVal, isTBD }, i) => {
            return (
              <IOSListRow
                key={ex.id}
                isLast={i === visiblePrRows.length - 1 && !hasMorePrs}
                colors={colors}
                onClick={!isFriend ? () => openPlateCalculatorForPR(ex.id, ex.name, isTBD ? ex.default1RM : rawVal) : undefined}
              >
                <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase' }}>{ex.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>
                    {isTBD ? 'TBD' : `${rawVal} LB`} {!isFriend && '✎'}
                  </span>
                </div>
              </IOSListRow>
            );
          })}
        {hasMorePrs && (
          <IOSListRow isLast={true} colors={colors} onClick={() => setShowAllPrs(prev => !prev)}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--dp-color-accent)', textTransform: 'uppercase' }}>
              {showAllPrs ? 'SHOW TOP 10 ↑' : `SEE ALL (${allPrRows.length}) ↓`}
            </span>
          </IOSListRow>
        )}
      </IOSListSection>

      <IOSListSection header="SHARED ROUTINES" colors={colors}>
        {profRoutines.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={{ fontSize: '12px', color: '#888888' }}>No routines shared yet.</span>
          </IOSListRow>
        ) : (
          profRoutines.map((r, i) => (
            <IOSListRow
              key={r.key}
              isLast={i === profRoutines.length - 1}
              colors={colors}
              onClick={() => handleOpenPreviewRoutine(r, 'session')}
            >
              <span style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>{r.label}</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>LOAD →</span>
            </IOSListRow>
          ))
        )}
      </IOSListSection>

      {isFriend && (
        <IOSListSection
          header={`@${profUser.username}'S FRIENDS`}
          footer={
            friendsOfFriend?.ok && friendsOfFriend.friends.length === 0
              ? 'NO PUBLIC FRIENDS TO SHOW, OR THIS PROFILE IS PRIVATE.'
              : null
          }
          colors={colors}
        >
          {!friendsOfFriend ? (
            <IOSListRow isLast={true} colors={colors}>
              <span style={{ fontSize: '12px', color: '#888888' }}>Loading friends…</span>
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
