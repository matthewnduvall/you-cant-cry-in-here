'use client';

// Tracked-lift goal rows shared by the PROGRESS page (under the chart) and Configuration → GOALS (STANDARDS):
// a title strip (colour swatch + name) over START | PR | LATEST | TO GO | GOAL ✎ (estimated 1RM, lb), plus the
// STRENGTH CLASS GOAL picker (+ the 1000 LB CLUB total row). Both pages render the same rows from the same numbers.

import React from 'react';
import { SHARED_CELL_BORDER } from '../styles/kineticTokens';
import { oneRepMaxLabel } from '../utils/workoutEngine';
import {
  STRENGTH_GOAL_CLASSES,
  THOUSAND_LB_CLUB,
  THOUSAND_LB_CLUB_TOTAL,
  getThousandLbClubGoals,
  getExRxTargetForLift
} from '../data/exerciseLibrary';

// Big 3 + OHP line colours (the Progress chart's lines and these rows' swatches)
export const CORE_LIFT_IDS = ['barbell_bench_press', 'barbell_back_squat', 'barbell_deadlift', 'overhead_press'];
export const CORE_LIFT_META = {
  barbell_bench_press: { short: 'BENCH', color: '#FF6B00' },
  barbell_back_squat: { short: 'SQUAT', color: '#30D158' },
  barbell_deadlift: { short: 'DEADLIFT', color: '#FFD60A' },
  overhead_press: { short: 'OHP', color: '#00E5FF' }
};
export const CUSTOM_LIFT_COLOR = '#BF5AF2';
const TO_GO_RED = '#FF3B30';

export const formatLiftLabel = (exId, rawName) => {
  const upper = String(rawName || '').trim().toUpperCase();
  if (exId === 'overhead_press' || upper === 'BARBELL MILITARY OVERHEAD PRESS') return 'BARBELL OVERHEAD PRESS';
  return upper || String(exId || 'CUSTOM').toUpperCase();
};

/**
 * One lift's numbers: START (first logged estimated 1RM), PR (best: History or a saved 1RM), LATEST (last logged),
 * GOAL (strength class / custom goal) and TO GO (goal − PR, never below 0). Unlogged lifts have pr = 0.
 */
export const getLiftGoalStats = ({
  liftId,
  series,
  oneRepMaxes,
  targetStandardClass,
  userBodyweightLbs,
  totalHeightInches,
  customGoalWeights
}) => {
  const points = (Array.isArray(series) ? series : []).filter(pt => Number(pt?.weight) > 0);
  const best = Math.max(0, ...points.map(pt => Number(pt.weight)));
  const pr = Math.max(Number(oneRepMaxes?.[liftId]) || 0, best);
  // * = calculated from reps: the best logged point is calculated unless some point with that value was a real
  // single; a higher saved 1RM (typed in as a PR) counts as lifted
  const bestCalculated = best > 0 && !points.some(pt => Number(pt.weight) === best && !pt.calculated);
  const first = points[0];
  const last = points[points.length - 1];
  const goal = getExRxTargetForLift(
    liftId,
    targetStandardClass,
    userBodyweightLbs,
    totalHeightInches,
    customGoalWeights,
    oneRepMaxes
  );
  return {
    start: points.length ? Number(first.weight) : 0,
    startCalculated: Boolean(first?.calculated),
    latest: points.length ? Number(last.weight) : 0,
    latestCalculated: Boolean(last?.calculated),
    pr,
    prCalculated: pr > 0 && pr === best && bestCalculated,
    goal,
    toGo: Math.max(0, goal - pr),
    logged: pr > 0
  };
};

const cellLabel = { fontSize: '11px', fontWeight: 800, color: '#8E8E93', letterSpacing: '0.02em' };
const cellValue = { fontSize: '14px', fontWeight: 800, color: '#FFFFFF', whiteSpace: 'nowrap' };
const statCell = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2px',
  minWidth: 0,
  height: '48px',
  boxSizing: 'border-box',
  backgroundColor: '#141416',
  ...SHARED_CELL_BORDER
};

/**
 * A tracked lift. `onTitleClick` makes the title strip a button (the Progress page: show only this lift);
 * `onEditGoal` makes GOAL ✎ editable; `showGoal={false}` (a friend's profile) shows START | PR | LATEST only.
 */
export function LiftGoalRow({
  name,
  color = '#FFFFFF',
  stats,
  onTitleClick,
  titlePressed,
  titleAriaLabel,
  dimmed = false,
  showGoal = true,
  onEditGoal,
  children
}) {
  const dash = <span style={{ color: '#8E8E93' }}>—</span>;
  const titleInner = (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <span aria-hidden="true" style={{ width: '12px', height: '12px', flexShrink: 0, backgroundColor: color }} />
        <span
          style={{
            fontSize: '13px',
            fontWeight: 800,
            color,
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {name}
        </span>
      </span>
      <span style={{ fontSize: '11px', fontWeight: 800, color: '#8E8E93', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {stats.logged ? '1RM · LB' : 'NOT LOGGED YET'}
      </span>
    </>
  );
  const titleStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    minHeight: '40px',
    padding: '0 12px',
    boxSizing: 'border-box',
    backgroundColor: dimmed ? '#141416' : '#1C1C20',
    textAlign: 'left',
    fontFamily: 'inherit',
    color: '#FFFFFF',
    border: 'none',
    ...SHARED_CELL_BORDER
  };

  return (
    <div style={{ opacity: dimmed ? 0.5 : 1 }}>
      {onTitleClick ? (
        <button
          type="button"
          aria-pressed={titlePressed}
          aria-label={titleAriaLabel}
          onClick={onTitleClick}
          style={{ ...titleStyle, cursor: 'pointer' }}
        >
          {titleInner}
        </button>
      ) : (
        <div style={titleStyle}>{titleInner}</div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${showGoal ? 5 : 3}, minmax(0, 1fr))`,
          gap: 0
        }}
      >
        <div style={statCell}>
          <span style={cellLabel}>START</span>
          <span style={cellValue}>{stats.start > 0 ? oneRepMaxLabel(stats.start, stats.startCalculated) : dash}</span>
        </div>
        <div style={statCell}>
          <span style={cellLabel}>PR</span>
          <span style={cellValue}>{stats.pr > 0 ? oneRepMaxLabel(stats.pr, stats.prCalculated) : dash}</span>
        </div>
        <div style={statCell}>
          <span style={cellLabel}>LATEST</span>
          <span style={cellValue}>{stats.latest > 0 ? oneRepMaxLabel(stats.latest, stats.latestCalculated) : dash}</span>
        </div>
        {showGoal && (
          <div style={statCell}>
            <span style={cellLabel}>TO GO</span>
            <span style={{ ...cellValue, color: !stats.logged ? '#8E8E93' : stats.toGo > 0 ? TO_GO_RED : '#30D158' }}>
              {!stats.logged ? '—' : stats.toGo > 0 ? stats.toGo : 'DONE ✓'}
            </span>
          </div>
        )}
        {showGoal && (
          <button
            type="button"
            disabled={!onEditGoal}
            aria-label={`Goal ${stats.goal} lb${onEditGoal ? ': edit' : ''}`}
            onClick={onEditGoal}
            style={{
              ...statCell,
              backgroundColor: '#1C1C20',
              border: 'none',
              ...SHARED_CELL_BORDER,
              cursor: onEditGoal ? 'pointer' : 'default',
              fontFamily: 'inherit',
              padding: 0
            }}
          >
            <span style={cellLabel}>GOAL</span>
            <span style={{ ...cellValue, color: 'var(--dp-color-accent)' }}>
              {stats.goal}
              {onEditGoal ? ' ✎' : ''}
            </span>
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/** STRENGTH CLASS GOAL row (+ BIG 3 TOTAL for the 1000 LB CLUB). Goes inside a SHARED_GROUP_OUTER column. */
export function StrengthClassGoalPicker({ targetStandardClass, setTargetStandardClass, oneRepMaxes }) {
  const club = targetStandardClass === THOUSAND_LB_CLUB ? getThousandLbClubGoals(oneRepMaxes) : null;
  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 150px',
          gap: 0,
          height: '44px',
          backgroundColor: '#18181B'
        }}
      >
        <div
          style={{
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '12px',
            fontWeight: 800,
            color: '#FFFFFF',
            textTransform: 'uppercase',
            ...SHARED_CELL_BORDER
          }}
        >
          STRENGTH CLASS GOAL
        </div>
        <select
          className="kinetic-filter-select"
          aria-label="Strength class goal"
          value={targetStandardClass}
          onChange={e => setTargetStandardClass?.(e.target.value)}
          style={{
            width: '100%',
            height: '44px',
            backgroundColor: '#141416',
            color: 'var(--dp-color-accent)',
            ...SHARED_CELL_BORDER,
            padding: '0 10px',
            fontSize: '12px',
            fontWeight: 800,
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}
        >
          {STRENGTH_GOAL_CLASSES.map(c => (
            <option key={c} value={c}>
              {c.toUpperCase()}
            </option>
          ))}
          <option value="Custom">CUSTOM</option>
        </select>
      </div>

      {/* 1000 LB CLUB: Big 3 total so far; the rest is split evenly across the bench / squat / deadlift goals */}
      {club && (
        <div
          style={{
            padding: '0 12px',
            minHeight: '44px',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            backgroundColor: '#141416',
            fontSize: '12px',
            fontWeight: 800,
            textTransform: 'uppercase',
            ...SHARED_CELL_BORDER
          }}
        >
          <span style={{ color: '#FFFFFF' }}>
            BIG 3 TOTAL: {club.total} / {THOUSAND_LB_CLUB_TOTAL} LB
          </span>
          <span style={{ color: club.remaining > 0 ? TO_GO_RED : '#30D158', whiteSpace: 'nowrap' }}>
            {club.remaining > 0 ? `${club.remaining} LB TO GO` : 'REACHED ✓'}
          </span>
        </div>
      )}
    </>
  );
}

