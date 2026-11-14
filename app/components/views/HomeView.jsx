'use client';

import React, { useState, useEffect } from 'react';
import { UI } from '../../styles/kineticTokens';
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
import { buildHistoryPRs, getBestHistory1RMInfo, oneRepMaxLabel, getSetTimerMMSS, estimateSet1RM } from '../../utils/workoutEngine';

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
        return w > 0 ? estimateSet1RM(st) : Number(st.durationSeconds) || r;
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
              return Math.round(estimateSet1RM(st));
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

// The count of routines friends sent you that are still waiting (Routines row)
function CountBadge({ count }) {
  if (!(count > 0)) return null;
  return (
    <span
      aria-label={`${count} new`}
      style={{
        minWidth: '22px',
        height: '22px',
        padding: '0 7px',
        boxSizing: 'border-box',
        borderRadius: '11px',
        backgroundColor: 'var(--cr-red)',
        color: '#FFFFFF',
        fontSize: '12px',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
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
  muscleStimulusStatus = {},
  // Routines friends sent you, still waiting (the INBOX tile)
  receivedRoutineCount = 0,
  // The TO GOAL tile: lb still to go to the strength class goal over the Big 3 + OHP you have logged (null = none
  // logged) and the class's name
  goalToGoLbs = null,
  goalClassName = '',
  // The TODAY panel while a session is open: { title, done, total } (sets)
  activeSessionSummary = null,
  // Bodyweight / height not entered yet: the ticker starts with a reminder
  bodyMetricsSet = true,
  // LAST SESSION opens that workout in History (onOpenWorkout(id)); THIS WEEK opens History filtered to the last
  // 7 days (onOpenThisWeek)
  onOpenWorkout,
  onOpenThisWeek,
  // INBOX opens the Routines page on its INBOX tab
  onOpenInbox
}) {
  const [scrollerSeed, setScrollerSeed] = useState(1);
  const [todayFallbackStr, setTodayFallbackStr] = useState('');
  // "Now" for LAST SESSION / THIS WEEK (read after mount: never Date.now() in render)
  const [nowMs, setNowMs] = useState(null);
  useEffect(() => {
    setScrollerSeed(Math.floor(Math.random() * 1000000) + 2);
    setTodayFallbackStr(formatDateYMD(new Date()));
    setNowMs(Date.now());
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
    // Goals, standards and bodyweight lifts use them: a reminder first until they are entered
    ...(bodyMetricsSet ? [] : ['SET YOUR BODYWEIGHT AND HEIGHT IN CONFIGURATION → BODY METRICS']),
    ...newFriendEntries,
    ...muscleEntries,
    ...(sortedTickerEntries.length > 0
      ? sortedTickerEntries
      : [uniqueAthletes.length === 0 ? 'INVITE FRIENDS TO KEEP TRACK OF PROGRESS' : 'NO RECENT LIFTS FROM YOUR FRIENDS YET'])
  ];
  const baseTickerText = tickerItems.join('   ·   ') + '   ·   ';

  const repeatCount = Math.max(1, Math.ceil(90 / Math.max(1, baseTickerText.length)));
  const friendsTickerText = baseTickerText.repeat(repeatCount);

  // Constant linear character/pixel speed (~11.5 chars/sec, 1/4 of the previous 7s fixed-duration speed)
  // Scales duration proportionally to total character length so speed never changes with entry count.
  const marqueeDurationSec = Math.max(8, Math.round(friendsTickerText.length * 0.087 * 10) / 10);

  // ---- Home's readouts (each tile opens its page) ----
  const workoutMs = w => (typeof w?.startedAt === 'number' ? w.startedAt : Date.parse(w?.startedAt || '')) || 0;
  const loggedTimes = (history || [])
    .filter(w => w && w.loadedRoutineTitle !== 'PERSONAL RECORD')
    .map(workoutMs)
    .filter(t => t > 0);
  // Calendar days in local time (a session at 6 pm yesterday is "1D AGO" at 9 am today, not "TODAY"); sessions dated
  // after today (a typed future date) don't count
  const DAY = 24 * 60 * 60 * 1000;
  const dayStart = ms => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const todayStart = nowMs ? dayStart(nowMs) : null;
  const pastTimes = todayStart === null ? [] : loggedTimes.filter(t => dayStart(t) <= todayStart);
  const lastMs = pastTimes.length > 0 ? Math.max(...pastTimes) : 0;
  // The workout LAST SESSION opens
  const lastWorkoutId = lastMs
    ? (history || []).find(w => w && w.loadedRoutineTitle !== 'PERSONAL RECORD' && workoutMs(w) === lastMs)?.id || null
    : null;
  const lastAgoDays = todayStart !== null && lastMs ? Math.max(0, Math.round((todayStart - dayStart(lastMs)) / DAY)) : null;
  // Today and the 6 days before it
  const thisWeek = todayStart === null ? null : pastTimes.filter(t => dayStart(t) >= todayStart - 6 * DAY).length;
  // Muscle groups: overdue first, then the longest since trained (never-trained last)
  const statusEntries = Object.entries(muscleStimulusStatus || {});
  const overdue = statusEntries
    .filter(([, st]) => /OVERDUE/.test(st?.label || ''))
    .sort(([, a], [, b]) => (b?.daysAgo || 0) - (a?.daysAgo || 0))
    .map(([g]) => g);
  const behind = statusEntries
    .filter(([, st]) => (st?.daysAgo ?? 99) < 99)
    .sort(([, a], [, b]) => (b?.daysAgo || 0) - (a?.daysAgo || 0))
    .map(([g]) => g);
  const nextUp = (overdue.length > 0 ? overdue : behind).slice(0, 2);
  const friendCount = (friendsList || []).length;
  const requestCount = (pendingIncomingRequests || []).length;
  const inboxTotal = requestCount + (receivedRoutineCount || 0);
  const open = view => {
    setRoutineSelectReturnView(null);
    setCurrentView(view);
  };
  const tiles = [
    {
      id: 'goal',
      label: 'TO GOAL',
      value: goalToGoLbs === null ? '—' : goalToGoLbs === 0 ? 'DONE' : String(goalToGoLbs),
      unit: goalToGoLbs > 0 ? 'LB' : '',
      // The same number as Performance's BIG 3 + OHP TO GOAL row (TO GO summed over the Big 3 + OHP)
      sub: goalToGoLbs === null ? 'LOG A BIG 3 LIFT' : `BIG 3 + OHP · ${(goalClassName || 'GOAL').toUpperCase()}`,
      view: 'history'
    },
    {
      id: 'overdue',
      label: 'OVERDUE',
      value: String(overdue.length),
      unit: overdue.length === 1 ? 'GROUP' : 'GROUPS',
      sub: overdue.length > 0 ? overdue.slice(0, 2).join(' · ').toUpperCase() : 'ALL ON SCHEDULE',
      // the screen's red: something needs training
      alert: overdue.length > 0,
      view: 'stimulus_map'
    },
    {
      id: 'last',
      label: 'LAST SESSION',
      value: lastAgoDays === null ? '—' : lastAgoDays === 0 ? 'TODAY' : String(lastAgoDays),
      unit: lastAgoDays > 0 ? 'D AGO' : '',
      sub: lastMs ? formatDateYMD(new Date(lastMs)) : 'NOTHING LOGGED YET',
      view: 'history',
      onClick: lastWorkoutId && onOpenWorkout ? () => onOpenWorkout(lastWorkoutId) : null
    },
    {
      id: 'week',
      label: 'THIS WEEK',
      value: thisWeek === null ? '—' : String(thisWeek),
      unit: thisWeek === 1 ? 'SESSION' : 'SESSIONS',
      sub: 'LAST 7 DAYS',
      view: 'history',
      onClick: onOpenThisWeek || null
    },
    {
      id: 'inbox',
      label: 'INBOX',
      // The Social page's INBOX: friend requests + routines friends sent
      value: String(inboxTotal),
      unit: inboxTotal === 1 ? 'MESSAGE' : 'MESSAGES',
      sub:
        inboxTotal > 0
          ? [
              requestCount > 0 ? `${requestCount} ${requestCount === 1 ? 'REQUEST' : 'REQUESTS'}` : null,
              receivedRoutineCount > 0 ? `${receivedRoutineCount} ${receivedRoutineCount === 1 ? 'ROUTINE' : 'ROUTINES'}` : null
            ]
              .filter(Boolean)
              .join(' · ')
          : 'NOTHING NEW',
      badge: inboxTotal,
      view: 'social',
      onClick: onOpenInbox || null
    },
    {
      id: 'friends',
      label: 'FRIENDS',
      value: String(friendCount),
      unit: '',
      // Requests are counted in INBOX
      sub: 'FIND ATHLETES',
      view: 'social'
    }
  ];

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

      {/* TODAY: what to do now. NEW / CURRENT SESSION is Home's one red action; AUTO SESSION is graphite */}
      <section style={{ padding: '12px var(--dp-spacing-gutter) 0' }}>
        <div style={{ backgroundColor: '#1C1C1C', borderRadius: '14px', padding: '14px' }}>
          <div style={{ ...UI.capsLabel, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            {activeSessionSummary && (
              <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--cr-red)', flexShrink: 0 }} />
            )}
            {activeSessionSummary ? 'IN PROGRESS' : 'TODAY'}
          </div>
          <div style={{ fontSize: '22px', fontWeight: 300, lineHeight: 1.2, marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeSessionSummary
              ? activeSessionSummary.title || 'Session'
              : nextUp.length > 0
                ? nextUp.join(' & ')
                : 'Start your first session'}
          </div>
          <div style={{ ...UI.sentence, marginTop: '-8px', marginBottom: '12px' }}>
            {activeSessionSummary
              ? `${activeSessionSummary.done} of ${activeSessionSummary.total} sets done`
              : nextUp.length > 0
                ? `${overdue.length > 0 ? 'Overdue' : 'Longest since trained'}: AUTO SESSION builds around ${nextUp.length > 1 ? 'them' : 'it'}.`
                : 'Log a session and Home keeps track of what to train next.'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: activeSessionSummary ? '1fr' : '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={handleOpenNewSession}
              className="kinetic-btn"
              style={{ ...UI.primaryBtnCenter, minHeight: '52px' }}
            >
              {hasActiveSession ? 'CURRENT SESSION' : 'NEW SESSION'}
            </button>
            {!activeSessionSummary && (
              <button type="button" onClick={handleOpenNewAutoSession} className="kinetic-btn" style={{ ...UI.secondaryBtnCenter, minHeight: '52px' }}>
                AUTO SESSION
              </button>
            )}
          </div>
        </div>
      </section>

      {/* READOUTS: each tile is a number worth tapping (it opens its page); no list of pages here (the menu has those) */}
      <section
        aria-label="Your training at a glance"
        style={{ padding: '8px var(--dp-spacing-gutter) 12px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}
      >
        {tiles.map(t => (
          <button
            key={t.id}
            type="button"
            className="kinetic-btn"
            onClick={() => (t.onClick ? t.onClick() : open(t.view))}
            aria-label={`${t.label}: ${t.value} ${t.unit}. ${t.sub}`.replace(/\s+/g, ' ')}
            style={{
              position: 'relative',
              minHeight: '92px',
              padding: '12px',
              boxSizing: 'border-box',
              backgroundColor: '#1C1C1C',
              border: 'none',
              borderRadius: '12px',
              color: '#FFFFFF',
              fontFamily: 'inherit',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', width: '100%' }}>
              <span style={UI.capsLabel}>{t.label}</span>
              <CountBadge count={t.badge} />
            </span>
            <span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '26px', fontWeight: 300, lineHeight: 1.1, color: t.alert ? 'var(--cr-red-text)' : '#FFFFFF' }}>{t.value}</span>
                {t.unit && <span style={{ ...UI.capsLabel, fontSize: '10px' }}>{t.unit}</span>}
              </span>
              <span style={{ display: 'block', marginTop: '2px', fontSize: '10px', fontWeight: 500, letterSpacing: '0.08em', color: '#8A8A8A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t.sub}
              </span>
            </span>
          </button>
        ))}
      </section>

      {/* NEWS TICKER: friends' lifts and your muscles, under the readouts; tap anywhere on it to pause / play */}
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

    </div>
  );
}

export default HomeView;

