'use client';

import React, { useEffect, useState } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import { CORE_PR_EXERCISE_IDS, EXERCISE_LIBRARY, EXERCISE_MAP } from '../../data/exerciseLibrary';
import { getBestHistory1RM } from '../../utils/workoutEngine';
import { fetchAthleteProfileSnapshot, resolveInviteFriendshipsForUser } from '../../utils/supabaseAuth';

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
  handleOpenPreviewRoutine
}) {
  const isFriend = currentView === 'friend_profile' && viewingFriendProfile;
  const [showAllPrs, setShowAllPrs] = useState(false);

  // Refresh the friend's profile live from Supabase when viewing a friend's profile
  useEffect(() => {
    if (!isFriend || !viewingFriendProfile) return;
    let cancelled = false;
    (async () => {
      try {
        // Load the friend's own profile row directly (works even when the friendship only exists locally),
        // then merge in anything the friendship resolver finds.
        const [directSnapshot, { matchedFriends: resolvedFriends }] = await Promise.all([
          fetchAthleteProfileSnapshot(viewingFriendProfile, user),
          resolveInviteFriendshipsForUser(
            user || { username: 'guest', email: '' },
            [],
            [...(friendsList || []), viewingFriendProfile]
          )
        ]);
        const matchedFriends = [
          ...(directSnapshot ? [directSnapshot] : []),
          ...(Array.isArray(resolvedFriends) ? resolvedFriends : [])
        ];
        if (cancelled || matchedFriends.length === 0) return;

        const targetUname = (viewingFriendProfile.username || '').trim().toLowerCase();
        const targetEmail = (viewingFriendProfile.email || '').trim().toLowerCase();
        const targetEmailPrefix = targetEmail ? targetEmail.split('@')[0] : '';

        const matchingEntries = matchedFriends.filter(f => {
          if (!f) return false;
          const fU = (f.username || '').trim().toLowerCase();
          const fE = (f.email || '').trim().toLowerCase();
          const fEPrefix = fE ? fE.split('@')[0] : '';
          return (
            (viewingFriendProfile.id && String(f.id) === String(viewingFriendProfile.id)) ||
            (targetUname && (fU === targetUname || fEPrefix === targetUname)) ||
            (targetEmail && fE === targetEmail) ||
            (targetEmailPrefix && fU === targetEmailPrefix)
          );
        });

        if (matchingEntries.length > 0) {
          const mergedPrs = { ...(viewingFriendProfile.prs || {}) };
          const historyMap = new Map();
          (viewingFriendProfile.history || []).forEach(w => {
            if (w && w.id) historyMap.set(w.id, w);
          });
          const routinesMap = new Map();
          (viewingFriendProfile.sharedRoutines || []).forEach(r => {
            if (r && r.key) routinesMap.set(r.key, r);
          });

          let latestMeta = {};
          matchingEntries.forEach(entry => {
            latestMeta = { ...latestMeta, ...entry };
            Object.entries(entry.prs || {}).forEach(([k, v]) => {
              const num = Number(v) || 0;
              if (num > (Number(mergedPrs[k]) || 0)) {
                mergedPrs[k] = num;
              }
            });
            (entry.history || []).forEach(w => {
              if (w && w.id && !historyMap.has(w.id)) {
                historyMap.set(w.id, w);
              }
            });
            (entry.sharedRoutines || []).forEach(r => {
              if (r && r.key && !routinesMap.has(r.key)) {
                routinesMap.set(r.key, r);
              }
            });
          });

          const mergedHistory = Array.from(historyMap.values()).sort(
            (a, b) => new Date(b?.startedAt || 0).getTime() - new Date(a?.startedAt || 0).getTime()
          );

          const updatedFriend = {
            ...viewingFriendProfile,
            ...latestMeta,
            username: viewingFriendProfile.username || latestMeta.username,
            prs: mergedPrs,
            history: mergedHistory,
            sharedRoutines: Array.from(routinesMap.values())
          };
          setViewingFriendProfile?.(updatedFriend);
          setFriendsList?.(prev =>
            (Array.isArray(prev) ? prev : []).map(f => {
              const fU = (f?.username || '').trim().toLowerCase();
              const fE = (f?.email || '').trim().toLowerCase();
              const fEPrefix = fE ? fE.split('@')[0] : '';
              if (
                (targetUname && (fU === targetUname || fEPrefix === targetUname)) ||
                (targetEmail && fE === targetEmail) ||
                (targetEmailPrefix && fU === targetEmailPrefix)
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
    </div>
  );
}
