'use client';

import React from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import { EXERCISE_MAP } from '../../data/exerciseLibrary';

// ============================================================================
// VIEW: HOME SCREEN
// ============================================================================

function getFriendSingleBig3TickerEntry(friend) {
  const uname = (friend?.username || 'athlete').toUpperCase();
  const big3Map = [
    { id: 'barbell_deadlift', label: 'DEADLIFT' },
    { id: 'barbell_back_squat', label: 'SQUAT' },
    { id: 'barbell_bench_press', label: 'BENCH' }
  ];

  const prs = friend?.prs || {};

  // 1. If the athlete has logged session history, pick the most recently trained Squat, Bench, or Deadlift
  if (Array.isArray(friend?.history) && friend.history.length > 0) {
    const sortedHist = [...friend.history].sort(
      (a, b) => new Date(b?.startedAt || 0).getTime() - new Date(a?.startedAt || 0).getTime()
    );
    for (const w of sortedHist) {
      for (const slot of w?.slots || []) {
        const match = big3Map.find(b => b.id === slot?.exerciseId);
        if (match) {
          const maxSetW = Math.max(
            0,
            ...(slot.sets || []).map(st => {
              const sw = Number(st?.weight) || 0;
              const sr = Math.max(1, Number(st?.reps) || 1);
              return sr === 1 ? sw : Math.round(sw * (1 + sr / 30));
            })
          );
          const prVal = Number(prs[match.id]) || 0;
          const weightVal = Math.max(prVal, maxSetW);
          if (weightVal > 0) {
            return `@${uname}: ${match.label} 1RM ${weightVal} LB`;
          }
        }
      }
    }

    // 1b. If no Big 3 lift in history, pick the most recently trained exercise in history with weight > 0
    for (const w of sortedHist) {
      for (const slot of w?.slots || []) {
        const exId = slot?.exerciseId;
        if (!exId) continue;
        const maxSetW = Math.max(
          0,
          ...(slot.sets || []).map(st => {
            const sw = Number(st?.weight) || 0;
            const sr = Math.max(1, Number(st?.reps) || 1);
            return sr === 1 ? sw : Math.round(sw * (1 + sr / 30));
          })
        );
        const prVal = Number(prs[exId]) || 0;
        const weightVal = Math.max(prVal, maxSetW);
        if (weightVal > 0) {
          const exLabel = (EXERCISE_MAP[exId]?.name || exId).toUpperCase();
          return `@${uname}: ${exLabel} 1RM ${weightVal} LB`;
        }
      }
    }
  }

  // 2. Otherwise pick the lift among Squat, Bench, and Deadlift with the highest logged PR (> 0)
  let chosen = null;
  let bestVal = 0;
  big3Map.forEach(item => {
    const cur = Number(prs[item.id]) || 0;
    if (cur > bestVal) {
      bestVal = cur;
      chosen = item;
    }
  });

  if (chosen && bestVal > 0) {
    return `@${uname}: ${chosen.label} 1RM ${bestVal} LB`;
  }

  // 3. Fallback: pick the highest logged PR across ANY exercise in friend.prs
  let bestAnyLabel = null;
  let bestAnyVal = 0;
  Object.entries(prs).forEach(([exId, val]) => {
    const num = Number(val) || 0;
    if (num > bestAnyVal) {
      bestAnyVal = num;
      bestAnyLabel = (EXERCISE_MAP[exId]?.name || exId).toUpperCase();
    }
  });

  if (bestAnyLabel && bestAnyVal > 0) {
    return `@${uname}: ${bestAnyLabel} 1RM ${bestAnyVal} LB`;
  }

  return `@${uname}: BENCH 1RM TBD`;
}

export function HomeView({
  colors,
  user,
  oneRepMaxes = {},
  history = [],
  hasActiveSession,
  handleOpenNewSession,
  handleOpenNewAutoSession,
  setCurrentView,
  setRoutineSelectReturnView,
  marqueePaused,
  setMarqueePaused,
  friendsList,
  pendingIncomingRequests
}) {
  const curUsername = (user?.username || '').trim().toLowerCase();
  const curEmail = (user?.email || '').trim().toLowerCase();

  // Build deduplicated athlete list for the scroller:
  // - Signed-in user uses their own live `oneRepMaxes` and `history`
  // - Friends strictly use their own `f.prs` and `f.history` (never overwritten by the local user's state)
  const uniqueAthletes = [];
  const seenKeys = new Set();

  if (user && (curUsername || curEmail)) {
    if (curUsername) seenKeys.add(curUsername);
    if (curEmail) seenKeys.add(curEmail);
    if (curEmail === 'matthew.n.duvall@gmail.com' || curUsername === 'matt') {
      seenKeys.add('matt');
      seenKeys.add('matthew.n.duvall@gmail.com');
    }
    uniqueAthletes.push({
      id: user.id || 'self',
      username: user.username || curEmail.split('@')[0],
      email: curEmail,
      prs: oneRepMaxes,
      history
    });
  } else if (!user && (Object.keys(oneRepMaxes || {}).length > 0 || (Array.isArray(history) && history.length > 0))) {
    uniqueAthletes.push({
      id: 'local_self',
      username: 'YOU',
      email: '',
      prs: oneRepMaxes,
      history
    });
  }

  (friendsList || []).forEach(f => {
    if (!f) return;
    const fUname = String(f.username || '').trim().toLowerCase();
    const fEmail = String(f.email || '').trim().toLowerCase();
    const key = fUname || fEmail || String(f.id || '').toLowerCase();
    if (!key) return;
    if ((fUname && seenKeys.has(fUname)) || (fEmail && seenKeys.has(fEmail)) || seenKeys.has(key)) {
      return;
    }

    if (fUname) seenKeys.add(fUname);
    if (fEmail) seenKeys.add(fEmail);
    seenKeys.add(key);
    uniqueAthletes.push(f);
  });

  const tickerEntries = uniqueAthletes
    .map(a => getFriendSingleBig3TickerEntry(a))
    .filter(Boolean);

  const friendsTickerText =
    tickerEntries.length > 0
      ? tickerEntries.join('   ///   ') + '   ///   '
      : 'ADD FRIENDS IN SOCIAL TO STREAM LIVE 1RM UPDATES   ///   ';

  return (
    <div>
      {/* HERO TITLE BANNER */}
      <section
        style={{
          padding: '18px var(--dp-spacing-gutter) 16px',
          borderBottom: '2px solid var(--dp-color-rule)'
        }}
      >
        <div
          style={{
            fontSize: 'clamp(40px, 12.5cqw, 58px)', fontWeight: 800,
            lineHeight: 0.92, letterSpacing: '-0.045em', textTransform: 'uppercase'
          }}
        >
          <div style={{ textAlign: 'left', marginBottom: '6px' }}>YOU CAN'T</div>
          <div
            style={{
              backgroundColor: 'var(--dp-color-accent)', color: '#101010',
              padding: '4px 12px', margin: '6px 0', textAlign: 'right'
            }}
          >
            CRY
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
            <span>IN HERE</span>
            <span style={{ color: 'var(--dp-color-accent)' }}>↘</span>
          </div>
        </div>
      </section>

      {/* REPEATED-TEXT MARQUEE BAND (BETWEEN TITLE & PRIMARY ACTION BUTTONS) */}
      <div
        className={marqueePaused ? 'kinetic-marquee-paused' : ''}
        style={{
          borderBottom: '2px solid var(--dp-color-rule)', backgroundColor: '#141414',
          display: 'flex', alignItems: 'center', overflow: 'hidden'
        }}
      >
        <div style={{ flex: 1, overflow: 'hidden', padding: '8px 0' }}>
          <div
            className="kinetic-marquee-track"
            style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            <span style={{ paddingRight: '32px' }}>{friendsTickerText}</span>
            <span aria-hidden="true" style={{ paddingRight: '32px' }}>{friendsTickerText}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMarqueePaused(p => !p)}
          style={{
            backgroundColor: '#101010', color: '#FFFFFF', border: 'none',
            borderLeft: '2px solid var(--dp-color-rule)', padding: '8px 10px',
            fontSize: '10px', fontWeight: 800, cursor: 'pointer'
          }}
        >
          {marqueePaused ? 'PLAY' : 'PAUSE'}
        </button>
      </div>

      {/* PRIMARY ACTIONS: NEW SESSION, AUTO SESSION, HISTORY (SHARED BORDERS, ZERO GAPS) */}
      <section
        style={{
          padding: '16px var(--dp-spacing-gutter)',
          borderBottom: '2px solid var(--dp-color-rule)',
          marginBottom: '22px'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 0,
            borderTop: '1px solid var(--dp-color-rule)',
            borderLeft: '1px solid var(--dp-color-rule)'
          }}
        >
          <button
            type="button"
            onClick={handleOpenNewSession}
            className="kinetic-btn"
            style={{
              height: '46px',
              boxSizing: 'border-box',
              padding: '0 6px',
              backgroundColor: 'var(--dp-color-accent)',
              color: '#101010',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: '1px solid var(--dp-color-rule)',
              borderBottom: '1px solid var(--dp-color-rule)',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              cursor: 'pointer'
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {hasActiveSession ? 'CURRENT SESSION' : 'NEW SESSION'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewAutoSession}
            className="kinetic-btn"
            style={{
              height: '46px',
              boxSizing: 'border-box',
              padding: '0 6px',
              backgroundColor: 'var(--dp-color-accent)',
              color: '#FFFFFF',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: '1px solid var(--dp-color-rule)',
              borderBottom: '1px solid var(--dp-color-rule)',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              cursor: 'pointer'
            }}
          >
            <span>AUTO SESSION</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('history')}
            className="kinetic-btn"
            style={{
              height: '46px',
              boxSizing: 'border-box',
              padding: '0 6px',
              backgroundColor: '#161616',
              color: '#FFFFFF',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: '1px solid var(--dp-color-rule)',
              borderBottom: '1px solid var(--dp-color-rule)',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              cursor: 'pointer'
            }}
          >
            <span>HISTORY</span>
          </button>
        </div>
      </section>

      {/* STATS SECTION ON HOME SCREEN */}
      <IOSListSection header="STATS" colors={colors}>
        {[
          { id: 'progression_chart', idx: '01', title: 'PROGRESS', sub: 'Big 3 + OHP Weight & Volume Graphed Trends', num: '01' },
          { id: 'stimulus_map', idx: '02', title: 'STIMULUS', sub: 'Recovery Windows & Muscle Readiness', num: '02' },
          { id: 'leaderboard', idx: '03', title: 'LEADERBOARD', sub: 'Big 3 + OHP Community Standings', num: '03' },
          { id: 'social', idx: '04', title: 'SOCIAL', sub: `${friendsList.length} Friends • ${pendingIncomingRequests.length} Pending Request`, num: '04' }
        ].map((item, i, arr) => (
          <IOSListRow
            key={item.id}
            indexLabel={item.idx}
            bgNumeral={item.num}
            isLast={i === arr.length - 1}
            colors={colors}
            onClick={() => {
              setRoutineSelectReturnView(null);
              setCurrentView(item.id);
            }}
          >
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
                {item.title}
              </div>
              <div className="kinetic-sub" style={{ fontSize: '12px', color: '#A0A0A0', fontWeight: 600 }}>
                {item.sub}
              </div>
            </div>
            <span style={{ fontSize: '20px', fontWeight: 800 }}>→</span>
          </IOSListRow>
        ))}
      </IOSListSection>
    </div>
  );
}

export default HomeView;

