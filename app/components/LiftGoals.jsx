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

// Big 3 + OHP. Crying charts give no lift its own hue: every line is grey and the selected lift is red (its row
// below fills red); lines are labelled at their ends instead of by a colour legend.
export const LIFT_LINE_GREY = '#8A8A8A';
export const CORE_LIFT_IDS = ['barbell_bench_press', 'barbell_back_squat', 'barbell_deadlift', 'overhead_press'];
export const CORE_LIFT_META = {
  barbell_bench_press: { short: 'BENCH', color: LIFT_LINE_GREY },
  barbell_back_squat: { short: 'SQUAT', color: LIFT_LINE_GREY },
  barbell_deadlift: { short: 'DEADLIFT', color: LIFT_LINE_GREY },
  overhead_press: { short: 'OHP', color: LIFT_LINE_GREY }
};
export const CUSTOM_LIFT_COLOR = LIFT_LINE_GREY;

/** The key for the asterisk on calculated 1RMs, shown under lists of 1RMs. */
export function CalculatedOneRepMaxKey({ style }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: 500, color: '#9A9A9A', lineHeight: 1.4, ...style }}>
      * Calculated from your reps, not lifted for 1 rep.
    </div>
  );
}
const TO_GO_RED = '#FF4A3D';

export const formatLiftLabel = (exId, rawName) => {
  const upper = String(rawName || '').trim().toUpperCase();
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
  // The History workouts the values come from (START / PR / LATEST open them); a PR from saved numbers has none
  const bestPoint = points.find(pt => Number(pt.weight) === best && !pt.calculated) || points.find(pt => Number(pt.weight) === best);
  return {
    startWorkoutId: first?.workoutId || null,
    latestWorkoutId: last?.workoutId || null,
    prWorkoutId: pr > 0 && pr === best ? bestPoint?.workoutId || null : null,
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

const cellLabel = { fontFamily: 'var(--cr-face-display)', fontSize: '11px', fontWeight: 500, color: '#9A9A9A', letterSpacing: '0.1em' };
const cellValue = { fontFamily: 'var(--cr-face-display)', fontSize: '15px', fontWeight: 500, color: '#FFFFFF', whiteSpace: 'nowrap' };
// The selected lift's stat cells: a step brighter than the tile so it's clear which row is selected
export const SELECTED_STATS_BG = '#242424';
const statCell = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2px',
  minWidth: 0,
  height: '48px',
  boxSizing: 'border-box',
  backgroundColor: '#1C1C1C',
  ...SHARED_CELL_BORDER
};

/**
 * A tracked lift. `onTitleClick` makes the title strip a button (the Progress page: show only this lift);
 * `onEditGoal` makes GOAL ✎ editable; `showGoal={false}` (a friend's profile) shows START | PR | LATEST only;
 * `onOpenWorkout(workoutId)` makes START / PR / LATEST open the History workout each value comes from.
 */
export function LiftGoalRow({
  name,
  color = '#FFFFFF',
  stats,
  onTitleClick,
  titlePressed,
  titleAriaLabel,
  dimmed = false,
  // The lift highlighted on the chart: its title strip fills red (the chart line and this row are the one red pair)
  selected = false,
  showGoal = true,
  onEditGoal,
  // START / PR / LATEST open the History workout they come from (Performance and Configuration → GOALS)
  onOpenWorkout,
  children
}) {
  const dash = <span style={{ color: '#9A9A9A' }}>—</span>;
  const cellStyle = selected ? { ...statCell, backgroundColor: SELECTED_STATS_BG } : statCell;
  // A stat cell; with a workout to open it's a button (same look, value underlined like a link)
  const statCellOf = (label, valueNode, workoutId, ariaValue) =>
    onOpenWorkout && workoutId ? (
      <button
        type="button"
        aria-label={`${label} ${ariaValue}: open this workout in History`}
        onClick={() => onOpenWorkout(workoutId)}
        style={{ ...cellStyle, border: 'none', ...SHARED_CELL_BORDER, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
      >
        <span style={cellLabel}>{label}</span>
        <span style={{ ...cellValue, textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: '#8A8A8A' }}>
          {valueNode}
        </span>
      </button>
    ) : (
      <div style={cellStyle}>
        <span style={cellLabel}>{label}</span>
        <span style={cellValue}>{valueNode}</span>
      </div>
    );
  const titleInner = (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{ width: '14px', height: '2px', flexShrink: 0, backgroundColor: selected ? '#FFFFFF' : color }}
        />
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '0.06em',
            color: '#FFFFFF',
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {name}
        </span>
      </span>
      <span style={{ fontSize: '11px', fontWeight: 500, color: selected ? '#FFFFFF' : '#9A9A9A', whiteSpace: 'nowrap', flexShrink: 0 }}>
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
    minHeight: '44px',
    padding: '0 12px',
    boxSizing: 'border-box',
    backgroundColor: selected ? 'var(--cr-red)' : '#1C1C1C',
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
      {/* The selected lift's stats are a step brighter than the rest (#242424 keeps red TO GO readable) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${showGoal ? 5 : 3}, minmax(0, 1fr))`,
          gap: 0
        }}
      >
        {statCellOf(
          'START',
          stats.start > 0 ? oneRepMaxLabel(stats.start, stats.startCalculated) : dash,
          stats.start > 0 ? stats.startWorkoutId : null,
          `${stats.start} lb`
        )}
        {statCellOf(
          'PR',
          stats.pr > 0 ? oneRepMaxLabel(stats.pr, stats.prCalculated) : dash,
          stats.pr > 0 ? stats.prWorkoutId : null,
          `${stats.pr} lb`
        )}
        {statCellOf(
          'LATEST',
          stats.latest > 0 ? oneRepMaxLabel(stats.latest, stats.latestCalculated) : dash,
          stats.latest > 0 ? stats.latestWorkoutId : null,
          `${stats.latest} lb`
        )}
        {showGoal && (
          <div style={cellStyle}>
            <span style={cellLabel}>TO GO</span>
            <span style={{ ...cellValue, color: !stats.logged ? '#9A9A9A' : stats.toGo > 0 ? TO_GO_RED : '#FFFFFF' }}>
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
              ...cellStyle,
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
          backgroundColor: '#1C1C1C'
        }}
      >
        <div
          style={{
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '12px',
            fontWeight: 500,
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
            backgroundColor: '#1C1C1C',
            color: 'var(--dp-color-accent)',
            ...SHARED_CELL_BORDER,
            padding: '0 10px',
            fontSize: '12px',
            fontWeight: 500,
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
            backgroundColor: '#1C1C1C',
            fontSize: '12px',
            fontWeight: 500,
            textTransform: 'uppercase',
            ...SHARED_CELL_BORDER
          }}
        >
          <span style={{ color: '#FFFFFF' }}>
            BIG 3 TOTAL: {club.total} / {THOUSAND_LB_CLUB_TOTAL} LB
          </span>
          <span style={{ color: club.remaining > 0 ? TO_GO_RED : '#FFFFFF', whiteSpace: 'nowrap' }}>
            {club.remaining > 0 ? `${club.remaining} LB TO GO` : 'REACHED ✓'}
          </span>
        </div>
      )}
    </>
  );
}

