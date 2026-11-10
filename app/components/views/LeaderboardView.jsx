'use client';

import React, { useState } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import { TabBar } from '../Controls';
import { UI } from '../../styles/kineticTokens';
import {
  EXERCISE_MAP,
  EXRX_CLASSES,
  getExRxCurrentClass
} from '../../data/exerciseLibrary';

// One tab per leaderboard (BIG 3 / BW first and default); the tabs name the board, so no section titles
const LEADERBOARD_TABS = [
  { id: 'big3_normalized', label: 'BIG 3 / BW' },
  { id: 'big3_total', label: 'BIG 3 TOTAL' },
  { id: 'ohp_normalized', label: 'OHP / BW' },
  { id: 'most_improved', label: 'MOST IMPROVED' }
];

const BIG_THREE_LIFT_IDS = ['barbell_bench_press', 'barbell_back_squat', 'barbell_deadlift'];
const STANDING_SCALE = ['Below Untrained', ...EXRX_CLASSES]; // ['Below Untrained', 'Untrained', 'Novice', 'Intermediate', 'Advanced', 'Elite']

function formatRankLabel(rank) {
  return `#${rank < 10 ? `0${rank}` : rank}`;
}

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

function buildTop10WithSelfSlot(sortedEntries) {
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
  // Inside the Social page's LEADERBOARDS tab: no extra top padding
  embedded = false
}) {
  const [activeTab, setActiveTab] = useState('big3_normalized');
  const selfName = user?.username || 'you (logged out)';
  const selfBw = Math.max(50, Number(userBodyweightLbs) || 220);

  // One entry per friend account (by id), never yourself
  const seenFriendIds = new Set(user?.id ? [String(user.id)] : []);
  const distinctFriends = (friendsList || []).filter(f => {
    const id = String(f?.id || '');
    if (!id || seenFriendIds.has(id)) return false;
    seenFriendIds.add(id);
    return true;
  });

  // 1. BIG 3 TOTAL, BIG 3 NORMALIZED & OVERHEAD PRESS NORMALIZED (Strictly from logged PRs — no fake fallbacks)
  const selfBench = Number(oneRepMaxes.barbell_bench_press) || 0;
  const selfSquat = Number(oneRepMaxes.barbell_back_squat) || 0;
  const selfDead = Number(oneRepMaxes.barbell_deadlift) || 0;
  const selfOhp = Number(oneRepMaxes.overhead_press) || 0;
  const selfBig3Total = selfBench + selfSquat + selfDead;
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
      name: selfName,
      isSelf: true,
      bw: selfBw,
      total: selfBig3Total,
      normalized: selfBig3Total / selfBw,
      standing: selfStanding,
      ohp: selfOhp,
      ohpNormalized: selfOhp / selfBw,
      ohpStanding: selfOhpStanding
    },
    ...distinctFriends.map((f, i) => {
      const fBw = Math.max(50, Number(f.bodyweightLbs || f.bodyweight) || 200);
      const fBench = Number(f.prs?.barbell_bench_press) || 0;
      const fSquat = Number(f.prs?.barbell_back_squat) || 0;
      const fDead = Number(f.prs?.barbell_deadlift) || 0;
      const fOhp = Number(f.prs?.overhead_press) || 0;
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
        id: f.id || `friend_${f.username}_${i}`,
        name: f.username || `athlete_${i + 1}`,
        isSelf: false,
        bw: fBw,
        total: fTotal,
        normalized: fTotal / fBw,
        standing: fStanding,
        ohp: fOhp,
        ohpNormalized: fOhp / fBw,
        ohpStanding: fOhpStanding
      };
    })
  ];

  const big3TotalEntries = buildTop10WithSelfSlot(
    [...rawAthletes].sort((a, b) => b.total - a.total)
  );

  // 2. BIG 3 NORMALIZED (Literal sum of Big 3 divided by user's bodyweight)
  const big3NormalizedEntries = buildTop10WithSelfSlot(
    [...rawAthletes].sort((a, b) => b.normalized - a.normalized)
  );

  // 3. OVERHEAD PRESS NORMALIZED (OHP 1RM divided by user's bodyweight)
  const ohpNormalizedEntries = buildTop10WithSelfSlot(
    [...rawAthletes].sort((a, b) => b.ohpNormalized - a.ohpNormalized)
  );

  // 4. MOST IMPROVED (Delta between lowest logged value and highest logged value, divided by user's bodyweight)
  const improvementEntries = [];

  const selfLiftStats = {};
  (history || []).forEach(workout => {
    (workout?.slots || []).forEach(slot => {
      const collectSets = (exId, setsList) => {
        if (!exId || !Array.isArray(setsList)) return;
        const exObj = EXERCISE_MAP[exId];
        if (exObj?.isBodyweight) return;
        setsList.forEach(st => {
          const w = Number(st?.weight) || 0;
          if (w <= 0) return;
          if (!selfLiftStats[exId]) {
            selfLiftStats[exId] = { minVal: w, maxVal: w };
          } else {
            selfLiftStats[exId].minVal = Math.min(selfLiftStats[exId].minVal, w);
            selfLiftStats[exId].maxVal = Math.max(selfLiftStats[exId].maxVal, w);
          }
        });
      };

      if (Array.isArray(slot?.supersetExerciseIds) && Array.isArray(slot?.supersetSetsByExercise)) {
        slot.supersetExerciseIds.slice(0, 2).forEach((exId, idx) => {
          collectSets(exId, slot.supersetSetsByExercise[idx] || []);
        });
      } else {
        collectSets(slot?.exerciseId, slot?.sets || []);
      }
    });
  });

  // Include logged history ranges + current 1RMs for the user
  const allSelfLiftIds = new Set([
    ...Object.keys(selfLiftStats),
    ...Object.keys(oneRepMaxes || {})
  ]);

  allSelfLiftIds.forEach(exId => {
    const exObj = EXERCISE_MAP[exId];
    if (!exObj || exObj.isBodyweight) return;
    const currentPr = Number(oneRepMaxes?.[exId]) || 0;
    const existing = selfLiftStats[exId];

    let startWeight = 0;
    let peakWeight = 0;
    if (existing) {
      startWeight = existing.minVal;
      peakWeight = currentPr > 0 ? Math.max(existing.maxVal, currentPr) : existing.maxVal;
    }

    const deltaLbs = Math.max(0, peakWeight - startWeight);
    if (startWeight > 0 && deltaLbs > 0) {
      improvementEntries.push({
        id: `self_imp_${exId}`,
        name: selfName,
        isSelf: true,
        exerciseId: exId,
        exerciseName: exObj.name,
        startWeight,
        peakWeight,
        deltaLbs,
        bw: selfBw,
        normalizedGain: deltaLbs / selfBw
      });
    }
  });

  // Friends' lift improvements (strictly from logged startingPrs -> peakWeight, no synthetic fallback)
  distinctFriends.forEach((f, i) => {
    const fBw = Math.max(50, Number(f.bodyweightLbs || f.bodyweight) || 200);
    const fPrs = f.prs || {};
    const fStartPrs = f.startingPrs || {};
    Object.entries(fPrs).forEach(([exId, prVal]) => {
      const peakWeight = Number(prVal) || 0;
      const startWeight = Number(fStartPrs[exId]) || 0;
      if (peakWeight <= 0 || startWeight <= 0) return;
      const exObj = EXERCISE_MAP[exId];
      if (!exObj || exObj.isBodyweight) return;
      const deltaLbs = Math.max(0, peakWeight - startWeight);
      if (deltaLbs > 0) {
        improvementEntries.push({
          id: `friend_${f.username}_${i}_${exId}`,
          name: f.username || `athlete_${i + 1}`,
          isSelf: false,
          exerciseId: exId,
          exerciseName: exObj.name,
          startWeight,
          peakWeight,
          deltaLbs,
          bw: fBw,
          normalizedGain: deltaLbs / fBw
        });
      }
    });
  });

  const mostImprovedEntries = buildTop10WithSelfSlot(
    improvementEntries.sort((a, b) => b.normalizedGain - a.normalizedGain || b.deltaLbs - a.deltaLbs)
  );

  return (
    <div style={{ paddingTop: embedded ? 0 : '12px' }}>
      <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '14px' }}>
        {title && <div style={{ ...UI.sectionTitle, marginBottom: '8px' }}>{title}</div>}
        <TabBar ariaLabel="Leaderboards" tabs={LEADERBOARD_TABS} value={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'big3_total' && (
      <IOSListSection colors={colors}>
        {big3TotalEntries.map((entry, idx, arr) => (
          <IOSListRow
            key={`big3_tot_${entry.id}_${idx}`}
            indexLabel={formatRankLabel(entry.rank)}
            isLast={idx === arr.length - 1}
            colors={colors}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: entry.isSelf ? 'var(--dp-color-accent)' : '#FFFFFF'
                }}
              >
                @{entry.name}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#888888', textTransform: 'uppercase' }}>
                <span style={{ color: '#FFFFFF' }}>BENCH + SQUAT + DEADLIFT</span> • STANDING:{' '}
                <strong style={{ color: 'var(--dp-color-accent)' }}>{entry.standing.toUpperCase()}</strong>
              </span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>
              {entry.total} LB
            </span>
          </IOSListRow>
        ))}
      </IOSListSection>
      )}

      {activeTab === 'big3_normalized' && (
      <IOSListSection colors={colors}>
        {big3NormalizedEntries.map((entry, idx, arr) => (
          <IOSListRow
            key={`big3_norm_${entry.id}_${idx}`}
            indexLabel={formatRankLabel(entry.rank)}
            isLast={idx === arr.length - 1}
            colors={colors}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: entry.isSelf ? 'var(--dp-color-accent)' : '#FFFFFF'
                }}
              >
                @{entry.name}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#888888', textTransform: 'uppercase' }}>
                {entry.total} LB ÷ {entry.bw} LB BW • STANDING:{' '}
                <strong style={{ color: 'var(--dp-color-accent)' }}>{entry.standing.toUpperCase()}</strong>
              </span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>
              {entry.normalized.toFixed(2)}x BW
            </span>
          </IOSListRow>
        ))}
      </IOSListSection>
      )}

      {activeTab === 'ohp_normalized' && (
      <IOSListSection colors={colors}>
        {ohpNormalizedEntries.map((entry, idx, arr) => (
          <IOSListRow
            key={`ohp_norm_${entry.id}_${idx}`}
            indexLabel={formatRankLabel(entry.rank)}
            isLast={idx === arr.length - 1}
            colors={colors}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: entry.isSelf ? 'var(--dp-color-accent)' : '#FFFFFF'
                }}
              >
                @{entry.name}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#888888', textTransform: 'uppercase' }}>
                {entry.ohp} LB <span style={{ color: '#FFFFFF' }}>OHP</span> ÷ {entry.bw} LB BW • STANDING:{' '}
                <strong style={{ color: 'var(--dp-color-accent)' }}>{entry.ohpStanding.toUpperCase()}</strong>
              </span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>
              {entry.ohpNormalized.toFixed(2)}x BW
            </span>
          </IOSListRow>
        ))}
      </IOSListSection>
      )}

      {activeTab === 'most_improved' && (
      <IOSListSection colors={colors}>
        {mostImprovedEntries.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#888888', textTransform: 'uppercase' }}>
              NO LOGGED IMPROVEMENTS YET.
            </span>
          </IOSListRow>
        ) : (
          mostImprovedEntries.map((entry, idx, arr) => (
            <IOSListRow
              key={`most_imp_${entry.id}_${idx}`}
              indexLabel={formatRankLabel(entry.rank)}
              isLast={idx === arr.length - 1}
              colors={colors}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, paddingRight: '8px' }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: entry.isSelf ? 'var(--dp-color-accent)' : '#FFFFFF',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  @{entry.name} <span style={{ color: '#888888' }}>•</span>{' '}
                  <span style={{ color: '#FFFFFF' }}>{entry.exerciseName}</span>
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#888888', textTransform: 'uppercase' }}>
                  {entry.startWeight} LB → {entry.peakWeight} LB ({entry.normalizedGain.toFixed(2)}x BW GAIN)
                </span>
              </div>
              <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--dp-color-accent)', flexShrink: 0 }}>
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
