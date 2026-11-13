'use client';

import React, { useMemo, useState } from 'react';
import { ProfileAvatar } from '../ProfileAvatar';
import { IOSListSection, IOSListRow } from '../Primitives';
import { Button, NestedTabBar, TabBar } from '../Controls';
import { buildHistoryPRRanges, buildHistoryPRs, getBestHistory1RMInfo, oneRepMaxLabel, withEngineBodyweight } from '../../utils/workoutEngine';
import { UI } from '../../styles/kineticTokens';
import {
  EXERCISE_MAP,
  EXRX_CLASSES,
  getExRxCurrentClass
} from '../../data/exerciseLibrary';

// One tab per leaderboard (BIG 3 / BW first and default); the tabs name the board, so no section titles
const LEADERBOARD_TABS = [
  { id: 'big3_normalized', label: 'BIG 3 / BW' },
  // Short labels so the nested tab row stays on one line at phone width
  { id: 'big3_total', label: 'BIG 3 LB' },
  { id: 'ohp_normalized', label: 'OHP / BW' },
  { id: 'most_improved', label: 'IMPROVED' }
];

// The bodyweight a friend's BW ratios are worked out with (never shown): saved bodyweight, shared or not
const rankingBwOf = f => {
  const bw = Number(f?.rankingBodyweightLbs) || Number(f?.bodyweightLbs) || 0;
  return bw > 0 ? Math.max(50, bw) : 0;
};

const BIG_THREE_LIFT_IDS = ['barbell_bench_press', 'barbell_back_squat', 'barbell_deadlift'];
// An athlete's name is a link to their profile (the whole row is tappable)
const STANDING_SCALE = ['Below Untrained', ...EXRX_CLASSES]; // ['Below Untrained', 'Untrained', 'Novice', 'Intermediate', 'Advanced', 'Elite']

// Unranked (nothing logged for this board): a dash instead of a number
function formatRankLabel(rank) {
  if (!rank) return '—';
  return `#${rank < 10 ? `0${rank}` : rank}`;
}
const NOT_LOGGED_STYLE = { fontSize: '11px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase' };

function getAverageBig3Standing(prs = {}, bw = 220, heightInches = 70) {
  const loggedVals = BIG_THREE_LIFT_IDS.map(liftId => Number(prs?.[liftId]) || 0);
  if (loggedVals.every(v => v <= 0)) {
    return 'Unlogged';
  }
  const scores = BIG_THREE_LIFT_IDS.map((liftId, i) => {
    const val = loggedVals[i];
    if (val <= 0) return 0;
    const cls = getExRxCurrentClass(liftId, val, bw, heightInches);
    const idx = STANDING_SCALE.indexOf(cls);
    return idx >= 0 ? idx : 0;
  });
  const avgIdx = Math.round((scores[0] + scores[1] + scores[2]) / 3);
  return STANDING_SCALE[Math.max(0, Math.min(STANDING_SCALE.length - 1, avgIdx))] || 'Untrained';
}

// Only athletes with something logged for the board are ranked (top 10, plus you if you're further down). Those
// with nothing logged follow, unranked, reading NOT LOGGED YET instead of a zero.
function buildTop10WithSelfSlot(sortedEntries, valueOf = null) {
  if (valueOf) {
    const logged = sortedEntries.filter(e => valueOf(e) > 0);
    const unlogged = sortedEntries.filter(e => !(valueOf(e) > 0)).map(e => ({ ...e, rank: null, unlogged: true }));
    return [...buildTop10WithSelfSlot(logged), ...unlogged];
  }
  const ranked = sortedEntries.map((item, idx) => ({
    ...item,
    rank: idx + 1
  }));
  const top10 = ranked.slice(0, 10);
  const selfInTop10 = top10.some(e => e.isSelf);
  if (selfInTop10) {
    return top10;
  }
  const bestSelfEntry = ranked.find(e => e.isSelf);
  if (bestSelfEntry) {
    return [...top10, bestSelfEntry];
  }
  return top10;
}

// Everything the boards need from an athlete's logged History: PRs, MOST IMPROVED ranges, and which of the
// Big 3 + OHP bests are calculated (asterisk)
const statsOf = hist => ({
  prs: buildHistoryPRs(hist),
  ranges: buildHistoryPRRanges(hist),
  best: Object.fromEntries(
    [...BIG_THREE_LIFT_IDS, 'overhead_press'].map(liftId => [liftId, getBestHistory1RMInfo(liftId, hist || [])])
  )
});

export function LeaderboardView({
  colors,
  user,
  oneRepMaxes = {},
  friendsList = [],
  userBodyweightLbs = 220,
  totalHeightInches = 70,
  history = [],
  // Section heading above the tabs (optional)
  title,
  // Inside the Social page's LEADERBOARDS tab: no extra top padding, and its tabs nest under LEADERBOARDS
  embedded = false,
  // Signed out: the boards need an account, so a SIGN IN button stands in for them
  onSignIn,
  // Tapping a row opens that athlete's profile (yours or the friend's): onOpenProfile(entry)
  onOpenProfile,
  // Your profile photo (beside your name on the boards; friends' come from their profiles)
  profilePhoto = null
}) {
  const [activeTab, setActiveTab] = useState('big3_normalized');
  const selfName = user?.username || 'you (logged out)';
  const selfBw = Math.max(50, Number(userBodyweightLbs) || 220);

  // One entry per friend account (by id), never yourself
  const userId = user?.id || null;
  const distinctFriends = useMemo(() => {
    const seenFriendIds = new Set(userId ? [String(userId)] : []);
    return (friendsList || []).filter(f => {
      const id = String(f?.id || '');
      if (!id || seenFriendIds.has(id)) return false;
      seenFriendIds.add(id);
      return true;
    });
  }, [friendsList, userId]);

  // Each athlete's History stats (statsOf), worked out once per History change, not on every tab tap
  // (yours with your bodyweight — it's a dependency now; each friend's with theirs, unknown = as stored)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selfStats = useMemo(() => statsOf(history), [history, userBodyweightLbs]);
  const friendStats = useMemo(
    () => new Map(distinctFriends.map(f => [f, withEngineBodyweight(rankingBwOf(f), () => statsOf(f.history))])),
    [distinctFriends]
  );

  // 1. BIG 3 TOTAL, BIG 3 NORMALIZED & OVERHEAD PRESS NORMALIZED (Strictly from logged PRs — no fake fallbacks)
  const selfBench = Number(oneRepMaxes.barbell_bench_press) || 0;
  const selfSquat = Number(oneRepMaxes.barbell_back_squat) || 0;
  const selfDead = Number(oneRepMaxes.barbell_deadlift) || 0;
  const selfOhp = Number(oneRepMaxes.overhead_press) || 0;
  const selfBig3Total = selfBench + selfSquat + selfDead;
  // * = a 1RM in it was calculated from reps (not lifted for 1 rep); a total is marked if any lift in it is
  const isCalc = (liftId, value, stats) => {
    if (!(value > 0)) return false;
    const info = stats.best[liftId];
    return Boolean(info) && value === info.best && info.calculated;
  };
  const big3Calculated = (vals, stats) =>
    BIG_THREE_LIFT_IDS.some((liftId, i) => isCalc(liftId, vals[i], stats));
  const selfStanding = getAverageBig3Standing(
    {
      barbell_bench_press: selfBench,
      barbell_back_squat: selfSquat,
      barbell_deadlift: selfDead
    },
    selfBw,
    totalHeightInches
  );
  const selfOhpStanding =
    selfOhp > 0
      ? getExRxCurrentClass('overhead_press', selfOhp, selfBw, totalHeightInches)
      : 'Unlogged';

  const rawAthletes = [
    {
      id: user?.id || 'self_user',
      bwShared: true,
      name: selfName,
      photo: profilePhoto,
      isSelf: true,
      bw: selfBw,
      total: selfBig3Total,
      totalCalculated: big3Calculated([selfBench, selfSquat, selfDead], selfStats),
      normalized: selfBig3Total / selfBw,
      standing: selfStanding,
      ohp: selfOhp,
      ohpCalculated: isCalc('overhead_press', selfOhp, selfStats),
      ohpNormalized: selfOhp / selfBw,
      ohpStanding: selfOhpStanding
    },
    ...distinctFriends.map((f, i) => {
      // Their bodyweight is used for the ratios whether or not they share it (Social → Privacy), but never shown:
      // the boards show only the ratio and the standing. Without any bodyweight saved they sit out the BW boards.
      const fBwKnown = rankingBwOf(f) > 0;
      const fBw = fBwKnown ? rankingBwOf(f) : 200;
      // Their PRs from their logged History only (no data = 0)
      const fStats = friendStats.get(f);
      const fHistPrs = fStats.prs;
      const fBench = Number(fHistPrs.barbell_bench_press) || 0;
      const fSquat = Number(fHistPrs.barbell_back_squat) || 0;
      const fDead = Number(fHistPrs.barbell_deadlift) || 0;
      const fOhp = Number(fHistPrs.overhead_press) || 0;
      const fTotal = fBench + fSquat + fDead;
      const fStanding = getAverageBig3Standing(
        {
          barbell_bench_press: fBench,
          barbell_back_squat: fSquat,
          barbell_deadlift: fDead
        },
        fBw,
        70
      );
      const fOhpStanding =
        fOhp > 0 ? getExRxCurrentClass('overhead_press', fOhp, fBw, 70) : 'Unlogged';
      return {
        bwShared: fBwKnown,
        id: f.id || `friend_${f.username}_${i}`,
        name: f.username || `athlete_${i + 1}`,
        photo: f.profilePhoto,
        isSelf: false,
        friend: f,
        bw: fBw,
        total: fTotal,
        totalCalculated: big3Calculated([fBench, fSquat, fDead], fStats),
        normalized: fTotal / fBw,
        standing: fBwKnown ? fStanding : null,
        ohp: fOhp,
        ohpCalculated: isCalc('overhead_press', fOhp, fStats),
        ohpNormalized: fOhp / fBw,
        ohpStanding: fBwKnown ? fOhpStanding : null
      };
    })
  ];

  const big3TotalEntries = buildTop10WithSelfSlot(
    [...rawAthletes].sort((a, b) => b.total - a.total),
    a => a.total
  );

  // 2. BIG 3 NORMALIZED (Literal sum of Big 3 divided by user's bodyweight)
  const big3NormalizedEntries = buildTop10WithSelfSlot(
    rawAthletes.filter(a => a.bwShared).sort((a, b) => b.normalized - a.normalized),
    a => a.normalized
  );

  // 3. OVERHEAD PRESS NORMALIZED (OHP 1RM divided by user's bodyweight)
  const ohpNormalizedEntries = buildTop10WithSelfSlot(
    rawAthletes.filter(a => a.bwShared).sort((a, b) => b.ohpNormalized - a.ohpNormalized),
    a => a.ohpNormalized
  );

  // 4. MOST IMPROVED (Delta between lowest logged value and highest logged value, divided by user's bodyweight)
  const improvementEntries = [];

  const pushImprovements = (ranges, who) => {
    Object.entries(ranges).forEach(([exId, { low, high }]) => {
      const exObj = EXERCISE_MAP[exId];
      if (!exObj || exObj.isBodyweight) return;
      const deltaLbs = Math.max(0, high - low);
      if (low <= 0 || deltaLbs <= 0) return;
      improvementEntries.push({
        id: `${who.idPrefix}_${exId}`,
        name: who.name,
        photo: who.photo,
        isSelf: who.isSelf,
        friend: who.friend,
        exerciseId: exId,
        exerciseName: exObj.name,
        startWeight: low,
        peakWeight: high,
        deltaLbs,
        bw: who.bw,
        normalizedGain: deltaLbs / who.bw
      });
    });
  };
  pushImprovements(selfStats.ranges, { idPrefix: 'self_imp', name: selfName, photo: profilePhoto, isSelf: true, bw: selfBw });
  distinctFriends.forEach((f, i) => {
    if (!(rankingBwOf(f) > 0)) return; // no bodyweight saved: not on this board
    pushImprovements(friendStats.get(f).ranges, {
      idPrefix: `friend_${f.username}_${i}`,
      name: f.username || `athlete_${i + 1}`,
      photo: f.profilePhoto,
      isSelf: false,
      friend: f,
      bw: rankingBwOf(f)
    });
  });

  // Friends with no bodyweight saved at all sit out the BW boards (a note says how many)
  const bwHiddenCount = distinctFriends.filter(f => !(rankingBwOf(f) > 0)).length;

  const mostImprovedEntries = buildTop10WithSelfSlot(
    improvementEntries.sort((a, b) => b.normalizedGain - a.normalizedGain || b.deltaLbs - a.deltaLbs)
  );

  return (
    <div style={{ paddingTop: embedded ? 0 : '12px' }}>
      <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '14px' }}>
        {title && <div style={{ ...UI.sectionTitle, marginBottom: '8px' }}>{title}</div>}
        {!user ? null : embedded ? (
          <NestedTabBar ariaLabel="Leaderboards" tabs={LEADERBOARD_TABS} value={activeTab} onChange={setActiveTab} />
        ) : (
          <TabBar ariaLabel="Leaderboards" tabs={LEADERBOARD_TABS} value={activeTab} onChange={setActiveTab} />
        )}
        {user && bwHiddenCount > 0 && activeTab !== 'big3_total' && (
          <div style={{ ...UI.sentence, marginTop: '10px' }}>
            {bwHiddenCount === 1 ? '1 friend hasn’t' : `${bwHiddenCount} friends haven’t`} saved a bodyweight, so they’re not on this board.
          </div>
        )}
      </div>

      {!user && (
        <IOSListSection colors={colors}>
          <IOSListRow isLast={true} colors={colors}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#BDBDBD', lineHeight: 1.4 }}>
                Sign in to see where you rank against your friends.
              </span>
              {onSignIn && (
                <Button variant="primary-row" onClick={onSignIn}>
                  <span>SIGN IN</span>
                  <span>→</span>
                </Button>
              )}
            </div>
          </IOSListRow>
        </IOSListSection>
      )}

      {user && activeTab === 'big3_total' && (
      <IOSListSection colors={colors}>
        {big3TotalEntries.map((entry, idx, arr) => (
          <IOSListRow
            key={`big3_tot_${entry.id}_${idx}`}
            indexLabel={formatRankLabel(entry.rank)}
            onClick={onOpenProfile ? () => onOpenProfile(entry) : undefined}
            isLast={idx === arr.length - 1}
            colors={colors}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <ProfileAvatar photo={entry.photo} username={entry.name} size={32} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: entry.rank === 1 ? 'var(--cr-red-text)' : '#FFFFFF'
                }}
              >
                <span>@{entry.name}</span>
              </span>
              {entry.unlogged ? (
                <span style={NOT_LOGGED_STYLE}>BIG 3 NOT LOGGED YET</span>
              ) : (
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase' }}>
                {entry.standing ? (
                  <strong style={{ color: 'var(--dp-color-accent)', fontWeight: 500 }}>{entry.standing.toUpperCase()}</strong>
                ) : (
                  'BENCH + SQUAT + DEADLIFT'
                )}
              </span>
              )}
            </div>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 500, color: entry.unlogged ? '#8A8A8A' : 'var(--dp-color-accent)' }}>
              {entry.unlogged ? '—' : `${oneRepMaxLabel(entry.total, entry.totalCalculated)} LB`}
            </span>
          </IOSListRow>
        ))}
      </IOSListSection>
      )}

      {user && activeTab === 'big3_normalized' && (
      <IOSListSection colors={colors}>
        {big3NormalizedEntries.map((entry, idx, arr) => (
          <IOSListRow
            key={`big3_norm_${entry.id}_${idx}`}
            indexLabel={formatRankLabel(entry.rank)}
            onClick={onOpenProfile ? () => onOpenProfile(entry) : undefined}
            isLast={idx === arr.length - 1}
            colors={colors}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <ProfileAvatar photo={entry.photo} username={entry.name} size={32} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: entry.rank === 1 ? 'var(--cr-red-text)' : '#FFFFFF'
                }}
              >
                <span>@{entry.name}</span>
              </span>
              {entry.unlogged ? (
                <span style={NOT_LOGGED_STYLE}>BIG 3 NOT LOGGED YET</span>
              ) : (
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase' }}>
                  {oneRepMaxLabel(entry.total, entry.totalCalculated)} LB •{' '}
                  <strong style={{ color: 'var(--dp-color-accent)', fontWeight: 500 }}>{entry.standing.toUpperCase()}</strong>
                </span>
              )}
            </div>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 500, color: entry.unlogged ? '#8A8A8A' : 'var(--dp-color-accent)' }}>
              {entry.unlogged ? '—' : `${entry.normalized.toFixed(2)}x BW`}
            </span>
          </IOSListRow>
        ))}
      </IOSListSection>
      )}

      {user && activeTab === 'ohp_normalized' && (
      <IOSListSection colors={colors}>
        {ohpNormalizedEntries.map((entry, idx, arr) => (
          <IOSListRow
            key={`ohp_norm_${entry.id}_${idx}`}
            indexLabel={formatRankLabel(entry.rank)}
            onClick={onOpenProfile ? () => onOpenProfile(entry) : undefined}
            isLast={idx === arr.length - 1}
            colors={colors}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <ProfileAvatar photo={entry.photo} username={entry.name} size={32} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: entry.rank === 1 ? 'var(--cr-red-text)' : '#FFFFFF'
                }}
              >
                <span>@{entry.name}</span>
              </span>
              {entry.unlogged ? (
                <span style={NOT_LOGGED_STYLE}>OVERHEAD PRESS NOT LOGGED YET</span>
              ) : (
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase' }}>
                  {oneRepMaxLabel(entry.ohp, entry.ohpCalculated)} LB •{' '}
                  <strong style={{ color: 'var(--dp-color-accent)', fontWeight: 500 }}>{entry.ohpStanding.toUpperCase()}</strong>
                </span>
              )}
            </div>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 500, color: entry.unlogged ? '#8A8A8A' : 'var(--dp-color-accent)' }}>
              {entry.unlogged ? '—' : `${entry.ohpNormalized.toFixed(2)}x BW`}
            </span>
          </IOSListRow>
        ))}
      </IOSListSection>
      )}

      {user && activeTab === 'most_improved' && (
      <IOSListSection colors={colors}>
        {mostImprovedEntries.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase' }}>
              NO LOGGED IMPROVEMENTS YET.
            </span>
          </IOSListRow>
        ) : (
          mostImprovedEntries.map((entry, idx, arr) => (
            <IOSListRow
              key={`most_imp_${entry.id}_${idx}`}
              indexLabel={formatRankLabel(entry.rank)}
            onClick={onOpenProfile ? () => onOpenProfile(entry) : undefined}
              isLast={idx === arr.length - 1}
              colors={colors}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, paddingRight: '8px' }}>
              <ProfileAvatar photo={entry.photo} username={entry.name} size={32} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: entry.rank === 1 ? 'var(--cr-red-text)' : '#FFFFFF',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  <span>@{entry.name}</span> <span style={{ color: '#9A9A9A' }}>•</span>{' '}
                  <span style={{ color: '#FFFFFF' }}>{entry.exerciseName}</span>
                </span>
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase' }}>
                  {entry.startWeight} LB → {entry.peakWeight} LB ({entry.normalizedGain.toFixed(2)}x BW GAIN)
                </span>
              </div>
              </div>
              <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--dp-color-accent)', flexShrink: 0 }}>
                +{entry.deltaLbs} LB
              </span>
            </IOSListRow>
          ))
        )}
      </IOSListSection>
      )}
    </div>
  );
}
