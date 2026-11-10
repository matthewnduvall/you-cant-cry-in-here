'use client';

import React, { useState, useEffect } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import { EXERCISE_MAP, formatDateYMD } from '../../data/exerciseLibrary';

// ============================================================================
// VIEW: HOME SCREEN
// ============================================================================

const SCROLLER_LIFTS = [
  { id: 'barbell_bench_press', label: 'BENCH' },
  { id: 'barbell_back_squat', label: 'SQUAT' },
  { id: 'barbell_deadlift', label: 'DEADLIFT' },
  { id: 'overhead_press', label: 'OHP' }
];

const deterministicHash = str => {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

function getAthleteScrollerEntries(friend, randomSeed = 1, todayFallbackStr = '') {
  const uname = (friend?.username || 'athlete').toUpperCase();
  const prs = friend?.prs || {};
  const histList = Array.isArray(friend?.history) ? friend.history : [];

  const sortedHist = [...histList].sort(
    (a, b) =>
      new Date(b?.startedAt || b?.workoutDate || b?.updatedAt || 0).getTime() -
      new Date(a?.startedAt || a?.workoutDate || a?.updatedAt || 0).getTime()
  );

  const fallbackDateRaw =
    sortedHist[0]?.startedAt ||
    sortedHist[0]?.workoutDate ||
    sortedHist[0]?.updatedAt ||
    friend?.updatedAt ||
    null;

  // Shuffle the 4 lifts (Big 3 + OHP) per athlete using randomSeed
  const shuffledLifts = [...SCROLLER_LIFTS].sort((a, b) => {
    const ha = deterministicHash(`${uname}_${a.id}_${randomSeed}`);
    const hb = deterministicHash(`${uname}_${b.id}_${randomSeed}`);
    return ha - hb;
  });

  const entries = [];

  shuffledLifts.forEach(lift => {
    let latestHistWeight = 0;
    let bestHistWeight = 0;
    let latestDateRaw = null;
    let latestTimeMs = 0;

    for (const w of sortedHist) {
      const wDateRaw = w?.startedAt || w?.workoutDate || w?.updatedAt || null;
      const wTimeMs = wDateRaw ? new Date(wDateRaw).getTime() : 0;

      for (const slot of w?.slots || []) {
        const slotExIds =
          Array.isArray(slot?.supersetExerciseIds) && slot.supersetExerciseIds.length > 0
            ? slot.supersetExerciseIds
            : [slot?.exerciseId, slot?.secondaryExerciseId].filter(Boolean);

        slotExIds.forEach((exId, exIdx) => {
          if (exId !== lift.id) return;
          const sets =
            Array.isArray(slot?.supersetSetsByExercise) && slot.supersetSetsByExercise[exIdx]
              ? slot.supersetSetsByExercise[exIdx]
              : slot?.sets || [];
          const maxSetW = Math.max(
            0,
            ...sets.map(st => {
              const sw = Number(st?.weight) || 0;
              const sr = Math.max(1, Number(st?.reps) || 1);
              return sr === 1 ? sw : Math.round(sw * (1 + sr / 30));
            })
          );
          if (maxSetW > 0) {
            if (maxSetW > bestHistWeight) bestHistWeight = maxSetW;
            if (!latestDateRaw || wTimeMs > latestTimeMs) {
              latestHistWeight = maxSetW;
              latestDateRaw = wDateRaw;
              latestTimeMs = Number.isNaN(wTimeMs) ? 0 : wTimeMs;
            }
          }
        });
      }
    }

    const prVal = Number(prs[lift.id]) || 0;
    const weightVal = Math.max(prVal, bestHistWeight, latestHistWeight);

    if (weightVal > 0) {
      const resolvedDateRaw = latestDateRaw || fallbackDateRaw;
      const parsedTimeMs =
        resolvedDateRaw && !Number.isNaN(new Date(resolvedDateRaw).getTime())
          ? new Date(resolvedDateRaw).getTime()
          : 0;
      const dateStr =
        resolvedDateRaw && parsedTimeMs > 0
          ? formatDateYMD(resolvedDateRaw)
          : todayFallbackStr;
      const entryTimeMs = latestTimeMs > 0 ? latestTimeMs : parsedTimeMs;
      const dayBucket = Math.floor(entryTimeMs / 86400000);
      const dateSuffix = dateStr ? ` (${dateStr})` : '';

      entries.push({
        uname,
        liftId: lift.id,
        liftLabel: lift.label,
        weightVal,
        dateStr,
        entryTimeMs,
        dayBucket,
        tieRand: deterministicHash(`${uname}_${lift.id}_${dateStr}_${randomSeed}`),
        text: `@${uname}: ${lift.label} 1RM ${weightVal} LB${dateSuffix}`
      });
    }
  });

  return entries.slice(0, 4);
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
  const [scrollerSeed, setScrollerSeed] = useState(1);
  const [todayFallbackStr, setTodayFallbackStr] = useState('');
  useEffect(() => {
    setScrollerSeed(Math.floor(Math.random() * 1000000) + 2);
    setTodayFallbackStr(formatDateYMD(new Date()));
  }, []);


  // The scroller shows friends only (never your own lifts): one list entry per friend account.
  const uniqueAthletes = [];
  const seenKeys = new Set();
  if (user?.id) seenKeys.add(String(user.id));

  // Friends are accepted friendships keyed by account id (one entry per account, never yourself)
  (friendsList || []).forEach(f => {
    const key = String(f?.id || '');
    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);
    uniqueAthletes.push(f);
  });

  // Limit to 10 athletes, up to 4 exercises each (Big 3 + OHP) = max 40 entries, ordered by time of entry
  const tickerEntryObjects = uniqueAthletes
    .slice(0, 10)
    .flatMap(a => getAthleteScrollerEntries(a, scrollerSeed, todayFallbackStr));

  const sortedTickerEntries = [...tickerEntryObjects]
    .sort((a, b) => {
      if (b.dayBucket !== a.dayBucket) {
        return b.dayBucket - a.dayBucket;
      }
      if (b.entryTimeMs !== a.entryTimeMs) {
        return b.entryTimeMs - a.entryTimeMs;
      }
      return a.tieRand - b.tieRand;
    })
    .slice(0, 40)
    .map(item => item.text);

  const baseTickerText =
    sortedTickerEntries.length > 0
      ? sortedTickerEntries.join('   ///   ') + '   ///   '
      : uniqueAthletes.length === 0
        ? 'INVITE FRIENDS TO KEEP TRACK OF PROGRESS!   ///   '
        : 'NO RECENT LIFTS FROM YOUR FRIENDS YET   ///   ';

  const repeatCount = Math.max(1, Math.ceil(90 / Math.max(1, baseTickerText.length)));
  const friendsTickerText = baseTickerText.repeat(repeatCount);

  // Constant linear character/pixel speed (~11.5 chars/sec, 1/4 of the previous 7s fixed-duration speed)
  // Scales duration proportionally to total character length so speed never changes with entry count.
  const marqueeDurationSec = Math.max(8, Math.round(friendsTickerText.length * 0.087 * 10) / 10);

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
            style={{
              '--dp-marquee-duration': `${marqueeDurationSec}s`,
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}
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
            fontSize: '11px', fontWeight: 800, cursor: 'pointer'
          }}
        >
          {marqueePaused ? 'PLAY' : 'PAUSE'}
        </button>
      </div>

      {/* PRIMARY ACTIONS: NEW SESSION, AUTO SESSION (History lives on the PROGRESS page) */}
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
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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

        </div>
      </section>

      {/* STATS SECTION ON HOME SCREEN */}
      <IOSListSection header="STATS" colors={colors}>
        {[
          // PROGRESS is one page with the chart, Personal Records and logged History (view id 'history')
          { id: 'history', idx: '01', title: 'PROGRESS', sub: 'Trends, Personal Records & Workout History', num: '01' },
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

