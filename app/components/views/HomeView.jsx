'use client';

import React from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';

// ============================================================================
// VIEW: HOME SCREEN
// ============================================================================

function getFriendSingleBig3TickerEntry(friend) {
  const uname = (friend?.username || 'athlete').toUpperCase();
  const big3Map = [
    { id: 'barbell_deadlift', label: 'DEADLIFT', fallback: 315 },
    { id: 'barbell_back_squat', label: 'SQUAT', fallback: 265 },
    { id: 'barbell_bench_press', label: 'BENCH', fallback: 185 }
  ];

  if (friend?.latestBig3Update && friend.latestBig3Update.label && friend.latestBig3Update.weight) {
    return `@${uname}: ${String(friend.latestBig3Update.label).toUpperCase()} 1RM ${friend.latestBig3Update.weight} LB`;
  }

  // If the friend has logged session history, pick the most recent Squat, Bench, or Deadlift entry
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
          const weightVal = maxSetW > 0 ? maxSetW : friend?.prs?.[match.id] || match.fallback;
          return `@${uname}: ${match.label} 1RM ${weightVal} LB`;
        }
      }
    }
  }

  // Otherwise pick the lift among Squat, Bench, and Deadlift with the largest recent gain or highest PR
  const prs = friend?.prs || {};
  const startPrs = friend?.startingPrs || {};
  let chosen = big3Map[0];
  let bestGain = -1;
  big3Map.forEach(item => {
    const cur = Number(prs[item.id]) || item.fallback;
    const base = Number(startPrs[item.id]) || Math.round(cur * 0.8);
    const gain = cur - base;
    if (gain > bestGain) {
      bestGain = gain;
      chosen = item;
    }
  });

  const weightVal = Number(prs[chosen.id]) || chosen.fallback;
  return `@${uname}: ${chosen.label} 1RM ${weightVal} LB`;
}

export function HomeView({
  colors,
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
  // Deduplicate friendsList so each friend user has strictly a single entry in the scroller
  const uniqueFriends = [];
  const seenKeys = new Set();
  (friendsList || []).forEach(f => {
    if (!f) return;
    const key = String(f.username || f.email || f.id || '').trim().toLowerCase();
    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);
    uniqueFriends.push(f);
  });

  const friendsTickerText =
    uniqueFriends.length > 0
      ? uniqueFriends.map(f => getFriendSingleBig3TickerEntry(f)).join('   ///   ') + '   ///   '
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

