'use client';

import React, { useState, useEffect } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  formatDateYMD,
  EXERCISE_MAP,
  stripEquipmentFromExerciseName,
  getBandLoadLabel,
  isBodyweightExercise
} from '../../data/exerciseLibrary';
import {
  NEW_FRIEND_DAYS,
  readFriendFirstSeen,
  recordFriendFirstSeen,
  daysBetweenYMD
} from '../../utils/friendFirstSeen';
import { buildHistoryPRs, getBestHistory1RMInfo, oneRepMaxLabel, getSetTimerMMSS } from '../../utils/workoutEngine';

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

// Other exercises from a friend's latest workout: at most this many per friend
const RECENT_EXERCISES_PER_FRIEND = 3;

/**
 * A friend's last completed exercises outside the Big 3 + OHP (those have their own entries): from their most recent
 * workout with a completed set, each exercise's best completed set — "@X: LAT PULLDOWN 140 LB × 10 (11/12)",
 * "@X: PULL-UP × 12", "@X: PLANK 01:30", "@X: BAND ROW RED BAND × 15". Entries carry the same sort fields as the lift
 * entries (newest first).
 */
function getAthleteRecentExerciseEntries(friend, randomSeed = 1) {
  const uname = (friend?.username || 'athlete').toUpperCase();
  const timeOf = w => new Date(w?.startedAt || w?.workoutDate || w?.updatedAt || 0).getTime();
  const done = st => st && st.completed;
  const latest = [...(Array.isArray(friend?.history) ? friend.history : [])]
    .sort((a, b) => timeOf(b) - timeOf(a))
    .find(w => (w?.slots || []).some(slot => (slot?.supersetSetsByExercise || [slot?.sets]).some(list => (list || []).some(done))));
  if (!latest) return [];
  const timeMs = timeOf(latest) || 0;
  const dateStr = timeMs > 0 ? formatDateYMD(latest.startedAt || latest.workoutDate).replace(/^\d{4}\//, '') : '';
  const coreIds = new Set(SCROLLER_LIFTS.map(l => l.id));
  const seen = new Set();
  const entries = [];
  (latest.slots || []).forEach(slot => {
    const ids =
      Array.isArray(slot?.supersetExerciseIds) && slot.supersetExerciseIds.length > 0
        ? slot.supersetExerciseIds
        : [slot?.exerciseId].filter(Boolean);
    ids.forEach((exId, exIdx) => {
      if (!exId || coreIds.has(exId) || seen.has(exId)) return;
      const list = Array.isArray(slot?.supersetSetsByExercise) && slot.supersetSetsByExercise[exIdx]
        ? slot.supersetSetsByExercise[exIdx]
        : exIdx === 0 ? slot?.sets || [] : slot?.secondarySets || [];
      const completed = (list || []).filter(done);
      if (completed.length === 0) return;
      seen.add(exId);
      // Best completed set: heaviest estimated 1RM, else most reps / longest time
      const score = st => {
        const w = Number(st.weight) || 0;
        const r = Math.max(1, Number(st.reps) || 1);
        return w > 0 ? w * (1 + r / 30) : Number(st.durationSeconds) || r;
      };
      const best = completed.reduce((a, b) => (score(b) > score(a) ? b : a));
      const name = stripEquipmentFromExerciseName(EXERCISE_MAP[exId]?.name || exId).toUpperCase();
      const reps = Number(best.reps) || 0;
      const load = best.durationSeconds || best.timerStr
        ? getSetTimerMMSS(best, true)
        : best.bandColor
          ? `${getBandLoadLabel(best.bandColor)} × ${reps}`
          : Number(best.weight) > 0 && !isBodyweightExercise(exId)
            ? `${best.weight} LB × ${reps}`
            : `× ${reps}`;
      entries.push({
        uname,
        dayBucket: Math.floor(timeMs / 86400000),
        entryTimeMs: timeMs,
        tieRand: deterministicHash(`${uname}_${exId}_${randomSeed}`),
        text: `@${uname}: ${name} ${load}${dateStr ? ` (${dateStr})` : ''}`
      });
    });
  });
  return entries.slice(0, RECENT_EXERCISES_PER_FRIEND);
}

function getAthleteScrollerEntries(friend, randomSeed = 1, todayFallbackStr = '') {
  const uname = (friend?.username || 'athlete').toUpperCase();
  // Their PRs from logged History only (saved numbers without data don't count)
  const prs = buildHistoryPRs(friend?.history);
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
    // * = their best was calculated from reps, not lifted for 1 rep
    const histInfo = getBestHistory1RMInfo(lift.id, histList);
    const weightLabel = oneRepMaxLabel(weightVal, weightVal === histInfo.best && histInfo.calculated);

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
      // Month and day only (MM/DD): the year is clear enough in a news ticker
      const dateSuffix = dateStr ? ` (${dateStr.replace(/^\d{4}\//, '')})` : '';

      entries.push({
        uname,
        liftId: lift.id,
        liftLabel: lift.label,
        weightVal,
        dateStr,
        entryTimeMs,
        dayBucket,
        tieRand: deterministicHash(`${uname}_${lift.id}_${dateStr}_${randomSeed}`),
        // Every ticker value is a 1RM, so it isn't spelled out
        text: `@${uname}: ${lift.label} ${weightLabel} LB${dateSuffix}`
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
  pendingIncomingRequests,
  // Your muscle groups' stimulus status (READY / OVERDUE entries in the ticker)
  muscleStimulusStatus = {}
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

  const friendIdsKey = uniqueAthletes.map(f => String(f.id)).sort().join(',');
  useEffect(() => {
    if (!user?.id || !todayFallbackStr) return;
    recordFriendFirstSeen(user.id, friendIdsKey ? friendIdsKey.split(',') : [], todayFallbackStr);
  }, [user?.id, friendIdsKey, todayFallbackStr]);

  // NEW FRIEND entries: friends first seen on this device in the last NEW_FRIEND_DAYS days. Before the
  // account's first record exists nothing counts as new (existing friends on a new device aren't "new").
  const firstSeen = todayFallbackStr ? readFriendFirstSeen(user?.id) : null;
  const newFriendEntries = firstSeen
    ? uniqueAthletes
        .filter(f => {
          const seen = firstSeen[String(f.id)];
          if (seen === undefined) return true; // appeared since the last record
          return Boolean(seen) && daysBetweenYMD(seen, todayFallbackStr) < NEW_FRIEND_DAYS;
        })
        .map(f => `NEW FRIEND: @${String(f.username || 'athlete').toUpperCase()}`)
    : [];

  // Your muscle groups that are ready (RECOVERED) or OVERDUE for stimulus, most overdue first
  const muscleEntries = Object.entries(muscleStimulusStatus || {})
    .filter(([, s]) => /OVERDUE|RECOVERED/.test(s?.label || ''))
    .sort(([, a], [, b]) => (b?.daysAgo || 0) - (a?.daysAgo || 0))
    .map(([group, s]) =>
      /OVERDUE/.test(s.label)
        ? `${group.toUpperCase()} OVERDUE (${s.daysAgo}D AGO)`
        : `${group.toUpperCase()} READY (${s.daysAgo}D AGO)`
    );

  // Limit to 10 athletes: their Big 3 + OHP entries plus up to 3 other exercises from their latest workout, ordered by
  // time of entry
  const tickerEntryObjects = uniqueAthletes
    .slice(0, 10)
    .flatMap(a => [
      ...getAthleteScrollerEntries(a, scrollerSeed, todayFallbackStr),
      ...getAthleteRecentExerciseEntries(a, scrollerSeed)
    ]);

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

  // Order: new friends, then your muscle groups, then friends' lifts (or a prompt when there are none)
  const tickerItems = [
    ...newFriendEntries,
    ...muscleEntries,
    ...(sortedTickerEntries.length > 0
      ? sortedTickerEntries
      : [uniqueAthletes.length === 0 ? 'INVITE FRIENDS TO KEEP TRACK OF PROGRESS!' : 'NO RECENT LIFTS FROM YOUR FRIENDS YET'])
  ];
  const baseTickerText = tickerItems.join('   ///   ') + '   ///   ';

  const repeatCount = Math.max(1, Math.ceil(90 / Math.max(1, baseTickerText.length)));
  const friendsTickerText = baseTickerText.repeat(repeatCount);

  // Constant linear character/pixel speed (~11.5 chars/sec, 1/4 of the previous 7s fixed-duration speed)
  // Scales duration proportionally to total character length so speed never changes with entry count.
  const marqueeDurationSec = Math.max(8, Math.round(friendsTickerText.length * 0.087 * 10) / 10);

  return (
    <div>
      {/* No big title on Home (the locked header already says YOU CAN'T CRY IN HERE): the ticker sits at the top,
          straight under the header. The page's heading is kept for screen readers. */}
      <h1
        style={{
          position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: 0, overflow: 'hidden',
          clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0
        }}
      >
        You can&apos;t cry in here
      </h1>

      {/* NEWS TICKER (top of Home, above the primary actions) — tap anywhere on it to pause / play */}
      <button
        type="button"
        aria-pressed={marqueePaused}
        aria-label={marqueePaused ? 'News ticker paused. Tap to play' : 'News ticker. Tap to pause'}
        onClick={() => setMarqueePaused(p => !p)}
        className={marqueePaused ? 'kinetic-marquee-paused' : ''}
        style={{
          width: '100%',
          minHeight: '40px',
          padding: 0,
          border: 'none',
          borderBottom: '1px solid var(--dp-color-rule)',
          backgroundColor: '#1C1C1C',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit'
        }}
      >
        <span style={{ display: 'block', flex: 1, overflow: 'hidden', padding: '8px 0' }}>
          <span
            className="kinetic-marquee-track"
            style={{
              '--dp-marquee-duration': `${marqueeDurationSec}s`,
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}
          >
            <span style={{ paddingRight: '32px' }}>{friendsTickerText}</span>
            <span aria-hidden="true" style={{ paddingRight: '32px' }}>{friendsTickerText}</span>
          </span>
        </span>
      </button>

      {/* PRIMARY ACTIONS: NEW SESSION, AUTO SESSION (History lives on the PROGRESS page) */}
      <section
        style={{
          padding: '16px var(--dp-spacing-gutter)',
          borderBottom: '1px solid var(--dp-color-rule)',
          marginBottom: '22px'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '8px'
          }}
        >
          {/* NEW / CURRENT SESSION: Home's one red action */}
          <button
            type="button"
            onClick={handleOpenNewSession}
            className="kinetic-btn"
            style={{
              height: '52px',
              boxSizing: 'border-box',
              padding: '0 6px',
              backgroundColor: 'var(--cr-red)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '12px',
              letterSpacing: '0.08em',
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
              height: '52px',
              boxSizing: 'border-box',
              padding: '0 6px',
              // Secondary to NEW / CURRENT SESSION: a graphite button
              backgroundColor: '#1C1C1C',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 500,
              fontSize: '12px',
              letterSpacing: '0.08em',
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

      {/* YOUR TRAINING: the main pages (no numbers, like the menu) */}
      <IOSListSection header="YOUR TRAINING" colors={colors}>
        {[
          // PROGRESS is one page with the chart, Personal Records and logged History (view id 'history')
          { id: 'history', title: 'Performance', sub: 'Trends, personal records and workout history' },
          { id: 'stimulus_map', title: 'Stimulus', sub: 'Recovery windows and muscle readiness' },
          { id: 'social', title: 'Social', sub: `${friendsList.length} ${friendsList.length === 1 ? 'friend' : 'friends'} · ${pendingIncomingRequests.length} pending ${pendingIncomingRequests.length === 1 ? 'request' : 'requests'} · leaderboards` }
        ].map((item, i, arr) => (
          <IOSListRow
            key={item.id}
            isLast={i === arr.length - 1}
            colors={colors}
            onClick={() => {
              setRoutineSelectReturnView(null);
              setCurrentView(item.id);
            }}
          >
            <div>
              <div style={{ fontSize: '17px', fontWeight: 500 }}>{item.title}</div>
              <div className="kinetic-sub" style={{ fontSize: '13px', color: '#9A9A9A', fontWeight: 400, marginTop: '2px' }}>
                {item.sub}
              </div>
            </div>
            <span aria-hidden="true" style={{ fontSize: '20px', fontWeight: 300, color: '#8A8A8A' }}>›</span>
          </IOSListRow>
        ))}
      </IOSListSection>
    </div>
  );
}

export default HomeView;

