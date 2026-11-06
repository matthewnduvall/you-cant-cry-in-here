'use client';

import React, { useEffect } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import { CORE_PR_EXERCISE_IDS, EXERCISE_MAP } from '../../data/exerciseLibrary';
import { getBestHistory1RM } from '../../utils/workoutEngine';
import { resolveInviteFriendshipsForUser } from '../../utils/supabaseAuth';

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
  handleOpenPreviewRoutine
}) {
  const isFriend = currentView === 'friend_profile' && viewingFriendProfile;

  // Refresh the friend's profile live from Supabase when viewing a friend's profile
  useEffect(() => {
    if (!isFriend || !viewingFriendProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const { matchedFriends } = await resolveInviteFriendshipsForUser(
          user || { username: 'guest', email: '' },
          [],
          [...(friendsList || []), viewingFriendProfile]
        );
        if (cancelled || !Array.isArray(matchedFriends) || matchedFriends.length === 0) return;

        const targetUname = (viewingFriendProfile.username || '').trim().toLowerCase();
        const targetEmail = (viewingFriendProfile.email || '').trim().toLowerCase();
        const freshMatch = matchedFriends.find(
          f =>
            (targetUname && (f?.username || '').trim().toLowerCase() === targetUname) ||
            (targetEmail && (f?.email || '').trim().toLowerCase() === targetEmail) ||
            (viewingFriendProfile.id && String(f?.id) === String(viewingFriendProfile.id))
        );

        if (freshMatch) {
          const mergedPrs = { ...(viewingFriendProfile.prs || {}) };
          Object.entries(freshMatch.prs || {}).forEach(([k, v]) => {
            const num = Number(v) || 0;
            if (num > (Number(mergedPrs[k]) || 0)) {
              mergedPrs[k] = num;
            }
          });
          const updatedFriend = {
            ...viewingFriendProfile,
            ...freshMatch,
            prs: mergedPrs,
            history:
              Array.isArray(freshMatch.history) && freshMatch.history.length > 0
                ? freshMatch.history
                : viewingFriendProfile.history || [],
            sharedRoutines:
              Array.isArray(freshMatch.sharedRoutines) && freshMatch.sharedRoutines.length > 0
                ? freshMatch.sharedRoutines
                : viewingFriendProfile.sharedRoutines || []
          };
          setViewingFriendProfile?.(updatedFriend);
          setFriendsList?.(prev =>
            (Array.isArray(prev) ? prev : []).map(f => {
              const fU = (f?.username || '').trim().toLowerCase();
              const fE = (f?.email || '').trim().toLowerCase();
              if (
                (targetUname && fU === targetUname) ||
                (targetEmail && fE === targetEmail)
              ) {
                return updatedFriend;
              }
              return f;
            })
          );
        }
      } catch {
        // ignore network error
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isFriend, viewingFriendProfile?.username, viewingFriendProfile?.email, user?.id]);

  // Also check if `friendsList` has newer PRs for `viewingFriendProfile`
  const liveFriendMatch = isFriend
    ? (friendsList || []).find(
        f =>
          f &&
          ((viewingFriendProfile.username &&
            (f.username || '').toLowerCase() === viewingFriendProfile.username.toLowerCase()) ||
            (viewingFriendProfile.email &&
              (f.email || '').toLowerCase() === viewingFriendProfile.email.toLowerCase()))
      ) || viewingFriendProfile
    : null;

  const profUser = isFriend
    ? liveFriendMatch
    : user || { username: 'guest', email: 'Not Signed In' };

  const profHistory = isFriend ? liveFriendMatch?.history || [] : history || [];
  const rawProfPRs = isFriend
    ? { ...(viewingFriendProfile?.prs || {}), ...(liveFriendMatch?.prs || {}) }
    : oneRepMaxes || {};

  const profPRs = { ...rawProfPRs };
  if (Array.isArray(profHistory) && profHistory.length > 0) {
    CORE_PR_EXERCISE_IDS.forEach(exId => {
      const bestHist = getBestHistory1RM(exId, profHistory);
      if (bestHist > (Number(profPRs[exId]) || 0)) {
        profPRs[exId] = bestHist;
      }
    });
  }

  const profRoutines = isFriend
    ? liveFriendMatch?.sharedRoutines || viewingFriendProfile?.sharedRoutines || []
    : sharedRoutines;

  return (
    <div style={{ paddingTop: '14px' }}>
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
        {Array.from(
          new Set([
            ...CORE_PR_EXERCISE_IDS,
            ...Object.keys(profPRs || {}).filter(id => Number(profPRs[id]) > 0)
          ])
        )
          .map(id => EXERCISE_MAP[id])
          .filter(Boolean)
          .map((ex, i, arr) => {
            const histBest = getBestHistory1RM(ex.id, profHistory);
            const rawVal = Math.max(Number(profPRs?.[ex.id]) || 0, histBest);
            const isTBD = rawVal <= 0;
            return (
              <IOSListRow
                key={ex.id}
                isLast={i === arr.length - 1}
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
    </div>
  );
}
