'use client';

import React from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  EXERCISE_MAP,
  EXRX_CLASSES,
  getExRxCurrentClass
} from '../../data/exerciseLibrary';

const DEFAULT_STARTING_RATIO = 0.78;
const BIG_THREE_LIFT_IDS = ['barbell_bench_press', 'barbell_back_squat', 'barbell_deadlift'];
const STANDING_SCALE = ['Below Untrained', ...EXRX_CLASSES]; // ['Below Untrained', 'Untrained', 'Novice', 'Intermediate', 'Advanced', 'Elite']

function formatRankLabel(rank) {
  return `#${rank < 10 ? `0${rank}` : rank}`;
}

function getAverageBig3Standing(prs = {}, bw = 220, heightInches = 70) {
  const scores = BIG_THREE_LIFT_IDS.map(liftId => {
    const fallback =
      liftId === 'barbell_bench_press'
        ? 185
        : liftId === 'barbell_back_squat'
          ? 265
          : 315;
    const val = Number(prs?.[liftId]) || fallback;
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
  history = []
}) {
  const curUsername = (user?.username || '').trim().toLowerCase();
  const curEmail = (user?.email || '').trim().toLowerCase();
  const selfName = user?.username || 'you (logged out)';
  const selfBw = Math.max(50, Number(userBodyweightLbs) || 220);

  const distinctFriends = (friendsList || []).filter(f => {
    if (!f) return false;
    const fUser = (f.username || '').trim().toLowerCase();
    const fEmail = (f.email || '').trim().toLowerCase();
    if (curEmail && fEmail && curEmail === fEmail) return false;
    if (curUsername && fUser && curUsername === fUser) return false;
    return true;
  });

  // 1. BIG 3 TOTAL, BIG 3 NORMALIZED & OVERHEAD PRESS NORMALIZED
  const selfBench = Number(oneRepMaxes.barbell_bench_press) || 225;
  const selfSquat = Number(oneRepMaxes.barbell_back_squat) || 285;
  const selfDead = Number(oneRepMaxes.barbell_deadlift) || 335;
  const selfOhp = Number(oneRepMaxes.overhead_press) || 135;
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
  const selfOhpStanding = getExRxCurrentClass(
    'overhead_press',
    selfOhp,
    selfBw,
    totalHeightInches
  );

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
      const fBench = Number(f.prs?.barbell_bench_press) || 185;
      const fSquat = Number(f.prs?.barbell_back_squat) || 265;
      const fDead = Number(f.prs?.barbell_deadlift) || 315;
      const fOhp = Number(f.prs?.overhead_press) || 125;
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
      const fOhpStanding = getExRxCurrentClass('overhead_press', fOhp, fBw, 70);
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
    } else if (currentPr > 0) {
      startWeight = Math.round((currentPr * DEFAULT_STARTING_RATIO) / 5) * 5;
      peakWeight = currentPr;
    }

    const deltaLbs = Math.max(0, peakWeight - startWeight);
    if (deltaLbs > 0) {
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

  // Friends' lift improvements (delta between lowest logged/starting value and highest logged value, divided by bodyweight)
  distinctFriends.forEach((f, i) => {
    const fBw = Math.max(50, Number(f.bodyweightLbs || f.bodyweight) || 200);
    const fPrs = f.prs || {};
    const fStartPrs = f.startingPrs || {};
    Object.entries(fPrs).forEach(([exId, prVal]) => {
      const peakWeight = Number(prVal) || 0;
      if (peakWeight <= 0) return;
      const exObj = EXERCISE_MAP[exId];
      if (!exObj || exObj.isBodyweight) return;
      const startWeight =
        Number(fStartPrs[exId]) > 0
          ? Number(fStartPrs[exId])
          : Math.round((peakWeight * DEFAULT_STARTING_RATIO) / 5) * 5;
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
    <div style={{ paddingTop: '14px' }}>
      <IOSListSection header="BIG 3 TOTAL" colors={colors}>
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
                  color: entry.isSelf ? '#30D158' : '#FFFFFF'
                }}
              >
                @{entry.name}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#888888', textTransform: 'uppercase' }}>
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

      <IOSListSection header="BIG 3 NORMALIZED" colors={colors}>
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
                  color: entry.isSelf ? '#30D158' : '#FFFFFF'
                }}
              >
                @{entry.name}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#888888', textTransform: 'uppercase' }}>
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

      <IOSListSection header="OVERHEAD PRESS NORMALIZED" colors={colors}>
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
                  color: entry.isSelf ? '#30D158' : '#FFFFFF'
                }}
              >
                @{entry.name}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#888888', textTransform: 'uppercase' }}>
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

      <IOSListSection header="MOST IMPROVED" colors={colors}>
        {mostImprovedEntries.map((entry, idx, arr) => (
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
                  color: entry.isSelf ? '#30D158' : 'var(--dp-color-accent)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                @{entry.name} <span style={{ color: '#888888' }}>•</span>{' '}
                <span style={{ color: '#FFFFFF' }}>{entry.exerciseName}</span>
              </span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#888888', textTransform: 'uppercase' }}>
                {entry.startWeight} LB → {entry.peakWeight} LB ({entry.normalizedGain.toFixed(2)}x BW GAIN)
              </span>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--dp-color-accent)', flexShrink: 0 }}>
              +{entry.deltaLbs} LB
            </span>
          </IOSListRow>
        ))}
      </IOSListSection>
    </div>
  );
}
