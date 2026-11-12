'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import { buildHistoryPRs } from '../../utils/workoutEngine';
import {
  fetchAthleteProfileSnapshot,
  fetchFriendsOfAthlete,
  sendFriendRequestToAthlete,
  syncFriendshipsForUser
} from '../../utils/supabaseAuth';
import { isSameFriend, applyFriendshipSync } from '../../utils/storageMigration';
import { Button, TabBar } from '../Controls';
import { RoutinesView } from './RoutinesView';
import { buildProgressionSeriesByLift } from '../../hooks/useTelemetryAndAnalytics';
import { ProfileAvatar, resizeImageFileToDataUrl } from '../ProfileAvatar';
import { SHARED_CELL_BORDER, SHARED_GROUP_OUTER } from '../../styles/kineticTokens';

// Profile tabs: PERFORMANCE (their Progress page: progress / personal records / history — not called PROGRESS,
// so it doesn't read PROGRESS > PROGRESS) · ROUTINES · FRIENDS
const PROFILE_TABS = [
  { id: 'progress', label: 'PERFORMANCE' },
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
  setCurrentView,
  fileInputRef,
  // Your profile photo (data URL) and its setter; a friend's comes with their profile
  profilePhoto,
  setProfilePhoto,
  onSignOut,
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
  // null | 'saving' | error message
  const [photoStatus, setPhotoStatus] = useState(null);
  // The pencil's CHANGE PHOTO / REMOVE PHOTO menu (only when there is a photo)
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);

  const handlePhotoPicked = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoStatus('saving');
    try {
      setProfilePhoto?.(await resizeImageFileToDataUrl(file));
      setPhotoStatus(null);
      appendSessionLog?.('PROFILE_PHOTO', 'Profile photo updated');
    } catch (err) {
      setPhotoStatus(err?.message || 'Could not use that image.');
    }
  };

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
          setAccountDeleteStatus(result?.error || 'Could not delete your account.');
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
    ? {} // a friend's PRs come only from their logged History (below)
    : oneRepMaxes || {};

  // One pass over the History (PRs come only from logged History)
  const historyPRs = useMemo(
    () => buildHistoryPRs(isFriend ? friendHistorySource : history),
    [isFriend, friendHistorySource, history]
  );
  const profPRs = { ...rawProfPRs };
  Object.entries(historyPRs).forEach(([exId, best]) => {
    if (best > (Number(profPRs[exId]) || 0)) profPRs[exId] = best;
  });

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
              backgroundColor: '#1C1C1C',
              color: '#FFFFFF',
              border: 'none', borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 500,
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
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A', lineHeight: 1.4 }}>
              You and @{viewingFriendProfile.username} are no longer friends, so their profile is private.
            </span>
          </IOSListRow>
        </IOSListSection>
      )}

      {!(isFriend && friendUnavailable) && (
      <>
      <IOSListSection header="ATHLETE IDENTITY" colors={colors}>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <ProfileAvatar
                photo={isFriend ? liveFriendMatch?.profilePhoto || viewingFriendProfile?.profilePhoto : user ? profilePhoto : null}
                username={profUser.username}
                size={64}
              />
              {/* Your own photo: a small pencil on the corner. No photo yet = pick one; with a photo = CHANGE / REMOVE */}
              {!isFriend && user && (
                <button
                  type="button"
                  aria-label={profilePhoto ? 'Change or remove profile photo' : 'Add a profile photo'}
                  aria-expanded={profilePhoto ? photoMenuOpen : undefined}
                  disabled={photoStatus === 'saving'}
                  onClick={() => (profilePhoto ? setPhotoMenuOpen(open => !open) : fileInputRef.current?.click())}
                  style={{
                    position: 'absolute',
                    right: '-14px',
                    bottom: '-14px',
                    width: '40px',
                    height: '40px',
                    padding: 0,
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--dp-color-accent)',
                      border: '2px solid #000000',
                      boxSizing: 'border-box'
                    }}
                  >
                    {photoStatus === 'saving' ? (
                      <span style={{ fontSize: '11px', fontWeight: 500, color: '#000000' }}>…</span>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 16 16">
                        <path d="M11.5 1.5l3 3L5 14H2v-3z" fill="none" stroke="#000000" strokeWidth="2" strokeLinejoin="miter" />
                        <line x1="9.5" y1="3.5" x2="12.5" y2="6.5" stroke="#000000" strokeWidth="2" />
                      </svg>
                    )}
                  </span>
                </button>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '22px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>
                @{profUser.username}
              </div>
              {!isFriend && (
                <div style={{ fontSize: '12px', color: '#9A9A9A', fontWeight: 500, overflowWrap: 'anywhere' }}>{profUser.email}</div>
              )}
              {/* SIGN OUT, just below the name and email */}
              {!isFriend && user && (
                <button
                  type="button"
                  onClick={() => onSignOut?.()}
                  className="kinetic-btn"
                  style={{
                    marginTop: '8px',
                    height: '40px',
                    padding: '0 14px',
                    backgroundColor: '#1C1C1C',
                    color: '#FF4A3D',
                    border: 'none', borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  SIGN OUT
                </button>
              )}
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoPicked} />
        </IOSListRow>
        {/* The pencil's menu (with a photo): its own row, so the list card never clips it */}
        {photoMenuOpen && profilePhoto && !isFriend && (
          <IOSListRow isLast={true} colors={colors}>
            <div role="menu" aria-label="Profile photo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 44px', width: '100%', gap: 0, ...SHARED_GROUP_OUTER }}>
              <button
                type="button"
                role="menuitem"
                className="kinetic-btn"
                onClick={() => {
                  setPhotoMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                style={{ ...SHARED_CELL_BORDER, height: '44px', backgroundColor: '#1C1C1C', color: '#FFFFFF', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
              >
                CHANGE PHOTO
              </button>
              <button
                type="button"
                role="menuitem"
                className="kinetic-btn"
                onClick={() => {
                  setPhotoMenuOpen(false);
                  setProfilePhoto?.(null);
                }}
                style={{ ...SHARED_CELL_BORDER, height: '44px', backgroundColor: '#1C1C1C', color: '#FF4A3D', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
              >
                REMOVE PHOTO
              </button>
              <button
                type="button"
                aria-label="Close photo menu"
                className="kinetic-btn"
                onClick={() => setPhotoMenuOpen(false)}
                style={{ ...SHARED_CELL_BORDER, height: '44px', backgroundColor: '#1C1C1C', color: '#9A9A9A', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          </IOSListRow>
        )}
        {photoStatus && photoStatus !== 'saving' && (
          <IOSListRow isLast={true} colors={colors}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#FF4A3D' }}>{photoStatus}</span>
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
                nested: true,
                readOnly: true,
                history: profHistory,
                oneRepMaxes: profPRs,
                seriesByLift: friendSeriesByLift,
                // Their strength class goal (distance-to-goal view); falls back to Intermediate
                goalSettings: {
                  targetStandardClass: profUser?.goals?.targetStandardClass || 'Intermediate',
                  customGoalWeights: profUser?.goals?.customGoalWeights || {},
                  bodyweightLbs: profUser?.bodyweightLbs
                },
                tab: friendProgressTab,
                onTabChange: setFriendProgressTab
              }
            : { nested: true }
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

      {/* FRIENDS tab: same breathing room under the tabs as PERFORMANCE / ROUTINES */}
      {profileTab === 'friends' && <div style={{ height: '16px' }} />}

      {profileTab === 'friends' && !isFriend && (
        <IOSListSection header={`FRIENDS (${(friendsList || []).length})`} colors={colors}>
          {(friendsList || []).length === 0 ? (
            <IOSListRow isLast={true} colors={colors}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase' }}>NO FRIENDS YET</span>
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
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <ProfileAvatar photo={friend.profilePhoto} username={friend.username} size={32} />
                  <span style={{ fontSize: '15px', fontWeight: 500, textTransform: 'uppercase' }}>@{friend.username}</span>
                </span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--dp-color-accent)', flexShrink: 0 }}>VIEW PROFILE →</span>
              </IOSListRow>
            ))
          )}
        </IOSListSection>
      )}

      {profileTab === 'friends' && isFriend && (
        <IOSListSection
          header={`@${profUser.username}'S FRIENDS${friendsOfFriend?.ok ? ` (${friendsOfFriend.friends.length})` : ''}`}
          colors={colors}
        >
          {!friendsOfFriend ? (
            <IOSListRow isLast={true} colors={colors}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase' }}>LOADING FRIENDS…</span>
            </IOSListRow>
          ) : friendsOfFriend.ok && friendsOfFriend.friends.length === 0 ? (
            <IOSListRow isLast={true} colors={colors}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A' }}>No public friends to show, or this profile is private.</span>
            </IOSListRow>
          ) : !friendsOfFriend.ok ? (
            <IOSListRow isLast={true} colors={colors}>
              <span style={{ fontSize: '12px', color: '#FF4A3D', fontWeight: 500 }}>COULD NOT LOAD THEIR FRIENDS.</span>
            </IOSListRow>
          ) : (
            friendsOfFriend.friends.map((athlete, i) => {
              const status = requestStatusById[athlete.id] || athlete.relation;
              return (
                <IOSListRow key={athlete.id} isLast={i === friendsOfFriend.friends.length - 1} colors={colors}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    {/* Their photo when they're also your friend (the list itself only carries usernames) */}
                    <ProfileAvatar
                      photo={(friendsList || []).find(f => f.id === athlete.id)?.profilePhoto}
                      username={athlete.username}
                      size={32}
                    />
                    <span style={{ fontSize: '15px', fontWeight: 500, textTransform: 'uppercase', minWidth: 0, overflowWrap: 'anywhere' }}>
                      @{athlete.username}
                    </span>
                  </span>
                  {status === 'friends' ? (
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#FFFFFF', flexShrink: 0 }}>FRIENDS ✓</span>
                  ) : status === 'requested' ? (
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A', flexShrink: 0 }}>REQUESTED</span>
                  ) : (
                    <Button
                      variant="success"
                      disabled={status === 'sending'}
                      onClick={() => handleRequestFriend(athlete)}
                      style={{ width: 'auto', minWidth: '96px', minHeight: '40px', flexShrink: 0, padding: '0 14px', fontSize: '12px', border: 'none', borderRadius: '10px' }}
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
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A' }}>PERMANENTLY DELETE YOUR ACCOUNT AND DATA</span>
            <Button
              variant="danger"
              disabled={accountDeleteStatus === 'deleting'}
              onClick={handleDeleteAccountClick}
              style={{ width: 'auto', flexShrink: 0, padding: '6px 12px', fontSize: '11px', border: 'none', borderRadius: '10px' }}
            >
              DELETE ACCOUNT
            </Button>
          </IOSListRow>
          {accountDeleteStatus && (
            <IOSListRow isLast={true} colors={colors}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: accountDeleteStatus === 'deleting' ? '#9A9A9A' : '#FF4A3D'
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
