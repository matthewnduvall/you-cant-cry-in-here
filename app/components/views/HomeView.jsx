'use client';

import React from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';

// ============================================================================
// VIEW: HOME SCREEN
// ============================================================================

export function HomeView({
  colors,
  handleOpenNewSession,
  handleOpenNewAutoSession,
  setCurrentView,
  setRoutineSelectReturnView,
  marqueePaused,
  setMarqueePaused,
  friendsList,
  pendingIncomingRequests
}) {
  const friendsTickerText =
    friendsList.length > 0
      ? friendsList
        .map(
          f =>
            `@${f.username.toUpperCase()}: BENCH 1RM ${f.prs?.barbell_bench_press || 185} LB • SQUAT 1RM ${f.prs?.barbell_back_squat || 265} LB • DEADLIFT 1RM ${f.prs?.barbell_deadlift || 315} LB • OHP 1RM ${f.prs?.overhead_press || 115} LB`
        )
        .join('   ///   ') + '   ///   '
      : 'ADD FRIENDS IN SOCIAL TO STREAM LIVE 1RM UPDATES   ///   ';

  return (
    <div>
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

        {/* Primary Actions: NEW SESSION, NEW AUTO, HISTORY */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '8px',
            marginTop: '16px'
          }}
        >
          <button
            type="button"
            onClick={handleOpenNewSession}
            className="kinetic-btn"
            style={{
              padding: '14px 10px', backgroundColor: 'var(--dp-color-accent)', color: '#101010',
              border: '2px solid #FFFFFF', fontWeight: 800, fontSize: '13px',
              textTransform: 'uppercase', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', cursor: 'pointer'
            }}
          >
            <span>NEW SESSION</span>
            <span>→</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewAutoSession}
            className="kinetic-btn"
            style={{
              padding: '14px 10px', backgroundColor: '#FFFFFF', color: '#101010',
              border: '2px solid var(--dp-color-accent)', fontWeight: 800, fontSize: '13px',
              textTransform: 'uppercase', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', cursor: 'pointer'
            }}
          >
            <span>NEW AUTO</span>
            <span>⚡</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('history')}
            className="kinetic-btn"
            style={{
              padding: '14px 10px', backgroundColor: '#161616', color: '#FFFFFF',
              border: '2px solid var(--dp-color-rule)', fontWeight: 800, fontSize: '13px',
              textTransform: 'uppercase', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', cursor: 'pointer'
            }}
          >
            <span>HISTORY</span>
            <span style={{ color: 'var(--dp-color-accent)' }}>↗</span>
          </button>
        </div>
      </section>

      {/* REPEATED-TEXT MARQUEE BAND */}
      <div
        className={marqueePaused ? 'kinetic-marquee-paused' : ''}
        style={{
          borderBottom: '2px solid var(--dp-color-rule)', backgroundColor: '#141414',
          display: 'flex', alignItems: 'center', overflow: 'hidden', marginBottom: '22px'
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

      {/* STATS SECTION ON HOME SCREEN */}
      <IOSListSection header="STATS" colors={colors}>
        {[
          { id: 'progression_chart', idx: '01', title: 'PROGRESSION CHART', sub: 'Big 3 + OHP Weight & Volume Graphed Trends', num: '01' },
          { id: 'stimulus_map', idx: '02', title: 'STIMULUS MAP', sub: 'Recovery Windows & Muscle Readiness', num: '02' },
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

