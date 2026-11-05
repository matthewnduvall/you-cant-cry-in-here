'use client';

import React, { useState, useEffect } from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import { RoutineEditorView } from './RoutineEditorView';
import {
  BIG_FOUR_IDS,
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  EXRX_CLASSES,
  getDefaultSessionName,
  getExRxCurrentClass,
  getExRxTargetForLift
} from '../../data/exerciseLibrary';

// ============================================================================
// VIEWS: HISTORY, GOALS, PROGRESSION CHART, STIMULUS MAP, LEADERBOARD, SOCIAL & PROFILE
// ============================================================================

export function HistoryView({
  colors,
  history,
  expandedHistoryWorkoutId,
  setExpandedHistoryWorkoutId,
  oneRepMaxes,
  targetStandardClass,
  userBodyweightLbs,
  totalHeightInches,
  customGoalWeights,
  setHistoricalDraft,
  setCurrentView,
  openPlateCalculatorForPR,
  setDeleteConfirmTarget,
  buildHistoryWorkoutEditorProps
}) {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);

  const PAGE_SIZE = 100;
  const INITIAL_LIMIT = 10;
  const totalSessions = (history || []).length;
  const totalPages = Math.max(1, Math.ceil(totalSessions / PAGE_SIZE));

  // If a linked workout is beyond the initial 10, automatically switch to See All and its 100-item page
  useEffect(() => {
    if (!expandedHistoryWorkoutId) return;
    const idx = (history || []).findIndex(w => w?.id === expandedHistoryWorkoutId);
    if (idx >= INITIAL_LIMIT) {
      setShowAllHistory(true);
      setHistoryPage(Math.floor(idx / PAGE_SIZE));
    }
  }, [expandedHistoryWorkoutId, history]);

  const visibleHistory = showAllHistory
    ? (history || []).slice(historyPage * PAGE_SIZE, (historyPage + 1) * PAGE_SIZE)
    : (history || []).slice(0, INITIAL_LIMIT);

  return (
    <div style={UI.pagePad}>
      <IOSListSection
        header="PERSONAL RECORDS"
        footer="Tap any Personal Record to override it with the Plate & Weight Calculator (with an optional date to log a History entry)."
        colors={colors}
      >
        {EXERCISE_LIBRARY.filter(e => e.isPriority).map((ex, idx, arr) => {
          const currentMax = Number(oneRepMaxes?.[ex.id]) || 0;
          const isTBD = currentMax <= 0;
          const isBigFour = BIG_FOUR_IDS.includes(ex.id);
          const targetVal = isBigFour
            ? getExRxTargetForLift(ex.id, targetStandardClass, userBodyweightLbs, totalHeightInches, customGoalWeights)
            : null;
          const diffFromGoal = !isTBD && targetVal !== null ? targetVal - currentMax : null;

          return (
            <IOSListRow
              key={ex.id}
              isLast={idx === arr.length - 1}
              colors={colors}
              onClick={() => openPlateCalculatorForPR(ex.id, ex.name, isTBD ? ex.default1RM : currentMax)}
            >
              <div style={{ minWidth: 0, paddingRight: '8px' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>
                  {ex.name}
                </div>
                {isTBD && targetVal !== null ? (
                  <div className="kinetic-sub" style={{ fontSize: '11px', color: '#A0A0A0', fontWeight: 700 }}>
                    Target ({targetStandardClass}): {targetVal} lb
                  </div>
                ) : (
                  diffFromGoal !== null && (
                    <div className="kinetic-sub" style={{ fontSize: '11px', color: '#A0A0A0', fontWeight: 700 }}>
                      {diffFromGoal > 0
                        ? `${diffFromGoal} lb from ${targetStandardClass}`
                        : `Goal Achieved (+${Math.abs(diffFromGoal)} lb)`}
                    </div>
                  )
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <span
                  style={{
                    padding: '6px 10px', backgroundColor: '#101010',
                    border: '2px solid var(--dp-color-rule)', color: 'var(--dp-color-accent)',
                    fontSize: '14px', fontWeight: 800
                  }}
                >
                  {isTBD ? 'TBD ✎' : `${currentMax} LB ✎`}
                </span>
              </div>
            </IOSListRow>
          );
        })}
      </IOSListSection>

      <div style={UI.gutterBottom}>
        <button
          type="button"
          onClick={() => {
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            setHistoricalDraft({
              id: `hist_${Date.now()}`,
              title: getDefaultSessionName(),
              loadedRoutineTitle: 'MANUAL',
              workoutDate: yesterday,
              defaultRestSeconds: 90,
              slots: []
            });
            setCurrentView('historical_entry');
          }}
          className="kinetic-btn"
          style={UI.primaryBtn}
        >
          <span>+ LOG PAST WORKOUT</span>
          <span>→</span>
        </button>
      </div>

      <IOSListSection header="HISTORY" colors={colors}>
        {totalSessions === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={{ fontSize: '12px', color: '#888888', fontWeight: 700, textTransform: 'uppercase' }}>
              NO SESSIONS LOGGED YET.
            </span>
          </IOSListRow>
        ) : (
          <>
            {visibleHistory.map((w, idx) => {
              const isExp = expandedHistoryWorkoutId === w.id;
              const editorProps = isExp && buildHistoryWorkoutEditorProps ? buildHistoryWorkoutEditorProps(w) : null;
              const isLastRow =
                idx === visibleHistory.length - 1 &&
                (showAllHistory ? totalPages <= 1 : totalSessions <= INITIAL_LIMIT);

              return (
                <div
                  id={`history-entry-${w.id}`}
                  key={w.id}
                  style={{
                    borderBottom: isLastRow ? 'none' : '2px solid var(--dp-color-rule)'
                  }}
                >
                  <div
                    onClick={() => setExpandedHistoryWorkoutId(isExp ? null : w.id)}
                    style={{
                      padding: '14px 16px',
                      backgroundColor: isExp ? '#1C1C1C' : '#141414',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>
                        {w.title}
                      </div>
                      <div style={{ fontSize: '11px', color: '#A0A0A0', fontWeight: 600 }}>
                        {new Date(w.startedAt).toLocaleDateString()} • {(w.slots || []).length} EXERCISES
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: '18px',
                          fontWeight: 800,
                          color: isExp ? 'var(--dp-color-accent)' : '#FFFFFF',
                          lineHeight: 1
                        }}
                      >
                        {isExp ? '−' : '+'}
                      </span>
                      <button
                        type="button"
                        aria-label={`Delete ${w.title}`}
                        onClick={e => {
                          e.stopPropagation();
                          setDeleteConfirmTarget?.({
                            type: 'history_workout',
                            workoutId: w.id,
                            label: w.title
                          });
                        }}
                        className="kinetic-btn"
                        style={{
                          ...UI.deleteXBtn,
                          width: '26px',
                          height: '26px',
                          fontSize: '12px',
                          boxSizing: 'border-box'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {isExp && editorProps && (
                    <div
                      style={{
                        paddingBottom: '14px',
                        backgroundColor: '#101010',
                        borderTop: '2px solid var(--dp-color-rule)'
                      }}
                    >
                      <RoutineEditorView {...editorProps} />
                    </div>
                  )}
                </div>
              );
            })}

            {!showAllHistory && totalSessions > 0 && (
              <IOSListRow isLast={true} colors={colors} style={{ padding: '10px 12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAllHistory(true);
                    setHistoryPage(0);
                  }}
                  className="kinetic-btn"
                  style={{
                    ...UI.secondaryBtnCenter,
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: 'var(--dp-color-accent)'
                  }}
                >
                  SEE ALL ({totalSessions})
                </button>
              </IOSListRow>
            )}

            {showAllHistory && (
              <IOSListRow isLast={true} colors={colors} style={{ padding: '10px 12px' }}>
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={historyPage <= 0}
                    onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                    className="kinetic-btn"
                    style={{
                      ...UI.secondaryBtnCenter,
                      padding: '8px 12px',
                      fontSize: '11px',
                      opacity: historyPage <= 0 ? 0.4 : 1
                    }}
                  >
                    ← PREV 100
                  </button>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#A0A0A0', textTransform: 'uppercase' }}>
                    PAGE {historyPage + 1} OF {totalPages} ({historyPage * PAGE_SIZE + 1}–{Math.min(totalSessions, (historyPage + 1) * PAGE_SIZE)} OF {totalSessions})
                  </span>
                  <button
                    type="button"
                    disabled={historyPage >= totalPages - 1}
                    onClick={() => setHistoryPage(p => Math.min(totalPages - 1, p + 1))}
                    className="kinetic-btn"
                    style={{
                      ...UI.secondaryBtnCenter,
                      padding: '8px 12px',
                      fontSize: '11px',
                      opacity: historyPage >= totalPages - 1 ? 0.4 : 1
                    }}
                  >
                    NEXT 100 →
                  </button>
                </div>
              </IOSListRow>
            )}
          </>
        )}
      </IOSListSection>
    </div>
  );
}

export function GoalsView({
  colors,
  goalType,
  setGoalType,
  goalUnit,
  setGoalUnit,
  goalIncrement,
  setGoalIncrement,
  userBodyweightLbs,
  userHeightFeet,
  userHeightInches,
  totalHeightInches,
  targetStandardClass,
  setTargetStandardClass,
  oneRepMaxes,
  customGoalWeights,
  openPlateCalculatorForGoal
}) {
  return (
    <div style={{ paddingTop: '14px' }}>
      <IOSListSection header="PRIMARY TRAINING GOAL" colors={colors}>
        <IOSListRow isLast={goalType === 'Maintain'} colors={colors}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', width: '100%' }}>
            {['Strength', 'Hypertrophy', 'Maintain'].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setGoalType(opt)}
                className="kinetic-btn"
                style={{
                  padding: '10px 6px',
                  backgroundColor: goalType === opt ? 'var(--dp-color-accent)' : '#101010',
                  color: goalType === opt ? '#101010' : '#FFFFFF',
                  border: '2px solid var(--dp-color-rule)',
                  fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </IOSListRow>

        {(goalType === 'Strength' || goalType === 'Hypertrophy') && (
          <IOSListRow isLast={true} colors={colors}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
                  PROGRESSION INCREMENT
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['lb', 'kg'].map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setGoalUnit(u)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: goalUnit === u ? 'var(--dp-color-accent)' : '#101010',
                        color: goalUnit === u ? '#101010' : '#FFFFFF',
                        border: '2px solid var(--dp-color-rule)',
                        fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                      }}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[1.25, 2.5, 5, 10].map(inc => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => setGoalIncrement(inc)}
                    style={{
                      padding: '8px 4px',
                      backgroundColor: goalIncrement === inc ? 'var(--dp-color-accent)' : '#101010',
                      color: goalIncrement === inc ? '#101010' : '#FFFFFF',
                      border: '2px solid var(--dp-color-rule)',
                      fontSize: '12px', fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    +{inc} {goalUnit}
                  </button>
                ))}
              </div>
            </div>
          </IOSListRow>
        )}
      </IOSListSection>

      <IOSListSection
        header="STANDARDS (EXRX.NET)"
        footer={`Cross-referenced with your Settings metrics (${userBodyweightLbs} lbs, ${userHeightFeet}'${userHeightInches}"). Tap any goal weight to customize it.`}
        colors={colors}
      >
        <IOSListRow colors={colors}>
          <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase' }}>
            TARGET STANDARD GOAL
          </span>
          <select
            value={targetStandardClass}
            onChange={e => setTargetStandardClass(e.target.value)}
            style={{
              backgroundColor: '#101010', color: 'var(--dp-color-accent)',
              border: '2px solid var(--dp-color-rule)', padding: '6px 10px',
              fontSize: '12px', fontWeight: 800, textTransform: 'uppercase'
            }}
          >
            {EXRX_CLASSES.map(c => (
              <option key={c} value={c}>{c.toUpperCase()}</option>
            ))}
            <option value="Custom">CUSTOM</option>
          </select>
        </IOSListRow>

        {BIG_FOUR_IDS.map((liftId, idx) => {
          const ex = EXERCISE_MAP[liftId];
          const rawVal = Number(oneRepMaxes?.[liftId]) || 0;
          const isTBD = rawVal <= 0;
          const cur1RM = isTBD ? ex.default1RM : rawVal;
          const curClass = getExRxCurrentClass(liftId, cur1RM, userBodyweightLbs, totalHeightInches);
          const goalWeight = getExRxTargetForLift(liftId, targetStandardClass, userBodyweightLbs, totalHeightInches, customGoalWeights);
          const distance = goalWeight - cur1RM;

          return (
            <IOSListRow key={liftId} isLast={idx === BIG_FOUR_IDS.length - 1} colors={colors}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>
                  {ex.name}
                </div>
                <div style={{ fontSize: '11px', color: '#A0A0A0', fontWeight: 700 }}>
                  1RM: <strong style={{ color: '#FFFFFF' }}>{isTBD ? 'TBD' : `${cur1RM} LB`}</strong> • CLASS:{' '}
                  <strong style={{ color: 'var(--dp-color-accent)' }}>{isTBD ? 'TBD' : curClass.toUpperCase()}</strong>
                </div>
                <div style={{ fontSize: '11px', color: '#30D158', fontWeight: 700 }}>
                  {isTBD
                    ? `Target (${targetStandardClass}): ${goalWeight} lb`
                    : distance > 0
                      ? `${distance} lb from ${targetStandardClass}`
                      : `Surpassed ${targetStandardClass} by ${Math.abs(distance)} lb`}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openPlateCalculatorForGoal(liftId, ex.name, goalWeight)}
                style={{
                  padding: '6px 10px', backgroundColor: '#101010',
                  color: 'var(--dp-color-accent)', border: '2px solid var(--dp-color-rule)',
                  fontSize: '12px', fontWeight: 800, cursor: 'pointer', flexShrink: 0
                }}
              >
                GOAL: {goalWeight} LB ✎
              </button>
            </IOSListRow>
          );
        })}
      </IOSListSection>
    </div>
  );
}

export function ProgressionChartView({
  colors,
  chartMetric,
  setChartMetric,
  selectedChartLift,
  setSelectedChartLift,
  progressionSeriesByLift,
  oneRepMaxes,
  targetStandardClass,
  userBodyweightLbs,
  totalHeightInches,
  customGoalWeights
}) {
  const liftMeta = {
    barbell_bench_press: { short: 'BENCH', color: '#FF6B00' },
    barbell_back_squat: { short: 'SQUAT', color: '#30D158' },
    barbell_deadlift: { short: 'DEADLIFT', color: '#FFD60A' },
    overhead_press: { short: 'OHP', color: '#00E5FF' }
  };

  const activeLifts = selectedChartLift === 'ALL' ? BIG_FOUR_IDS : [selectedChartLift];
  const allDates = Array.from(
    new Set(BIG_FOUR_IDS.flatMap(id => (progressionSeriesByLift[id] || []).map(pt => pt.dateLabel)))
  );
  const allVals = activeLifts.flatMap(id =>
    (progressionSeriesByLift[id] || []).map(pt => (chartMetric === 'weight' ? pt.weight : pt.volume))
  );

  const rawMin = allVals.length ? Math.min(...allVals) : 0;
  const rawMax = allVals.length ? Math.max(...allVals) : 300;
  const pad = Math.max(10, Math.round((rawMax - rawMin) * 0.15));
  const minVal = Math.max(0, rawMin - pad);
  const maxVal = rawMax + pad;

  const svgW = 360;
  const svgH = 210;
  const padL = 44;
  const padR = 18;
  const padT = 18;
  const padB = 30;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const getX = (idx, count) => (count <= 1 ? padL + plotW / 2 : padL + (idx / (count - 1)) * plotW);
  const getY = val => padT + plotH - ((val - minVal) / Math.max(1, maxVal - minVal)) * plotH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(minVal + t * (maxVal - minVal)));

  return (
    <div style={{ paddingTop: '14px' }}>
      <IOSListSection
        header="PROGRESSION CHART (BIG 3 + OHP)"
        footer="Toggle between Top Working Weight (lb) and Workout Volume (weight × reps × sets). Filter individual lifts or view all 4 together."
        colors={colors}
      >
        <IOSListRow colors={colors}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%' }}>
            <button
              type="button"
              onClick={() => setChartMetric('weight')}
              style={UI.pillBtn(chartMetric === 'weight')}
            >
              WEIGHT CHANGES (LB)
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('volume')}
              style={UI.pillBtn(chartMetric === 'volume')}
            >
              VOLUME / WORKOUT
            </button>
          </div>
        </IOSListRow>

        <IOSListRow colors={colors}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', width: '100%' }}>
            {[
              { id: 'ALL', label: 'ALL 4' },
              { id: 'barbell_bench_press', label: 'BENCH' },
              { id: 'barbell_back_squat', label: 'SQUAT' },
              { id: 'barbell_deadlift', label: 'DEAD' },
              { id: 'overhead_press', label: 'OHP' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedChartLift(f.id)}
                style={{
                  padding: '6px 4px',
                  backgroundColor: selectedChartLift === f.id ? '#FFFFFF' : '#101010',
                  color: selectedChartLift === f.id ? '#101010' : '#A0A0A0',
                  border: '2px solid var(--dp-color-rule)',
                  fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </IOSListRow>

        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
              {activeLifts.map(id => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', backgroundColor: liftMeta[id].color, display: 'inline-block' }} />
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#FFFFFF' }}>
                    {liftMeta[id].short}
                  </span>
                </div>
              ))}
            </div>

            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              style={{
                width: '100%', height: 'auto', backgroundColor: '#101010',
                border: '2px solid var(--dp-color-rule)', display: 'block'
              }}
            >
              {yTicks.map((tickVal, idx) => {
                const y = getY(tickVal);
                return (
                  <g key={idx}>
                    <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#2A2A2A" strokeWidth="1" strokeDasharray="3 3" />
                    <text x={padL - 6} y={y + 3} textAnchor="end" fill="#888888" fontSize="9" fontWeight="700">
                      {tickVal >= 1000 && chartMetric === 'volume' ? `${(tickVal / 1000).toFixed(1)}k` : tickVal}
                    </text>
                  </g>
                );
              })}

              {allDates.map((dLabel, idx) => {
                const x = getX(idx, allDates.length);
                return (
                  <g key={dLabel}>
                    <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke="#1E1E1E" strokeWidth="1" />
                    <text x={x} y={svgH - 9} textAnchor="middle" fill="#A0A0A0" fontSize="9" fontWeight="800">
                      {dLabel.toUpperCase()}
                    </text>
                  </g>
                );
              })}

              {activeLifts.map(liftId => {
                const series = progressionSeriesByLift[liftId] || [];
                if (series.length === 0) return null;
                const color = liftMeta[liftId].color;

                const coords = series.map((pt, sIdx) => {
                  const dateIdx = allDates.indexOf(pt.dateLabel);
                  const x = dateIdx >= 0 ? getX(dateIdx, allDates.length) : getX(sIdx, series.length);
                  const rawVal = chartMetric === 'weight' ? pt.weight : pt.volume;
                  const y = getY(rawVal);
                  return { x, y, rawVal, dateLabel: pt.dateLabel };
                });

                const polylinePoints = coords.map(c => `${c.x},${c.y}`).join(' ');
                const areaPoints =
                  coords.length > 1
                    ? `${coords[0].x},${padT + plotH} ${polylinePoints} ${coords[coords.length - 1].x},${padT + plotH}`
                    : null;

                return (
                  <g key={liftId}>
                    {selectedChartLift !== 'ALL' && areaPoints && (
                      <polygon points={areaPoints} fill={color} fillOpacity="0.14" />
                    )}
                    <polyline fill="none" stroke={color} strokeWidth="2.75" points={polylinePoints} />
                    {coords.map((c, cIdx) => (
                      <g key={`${liftId}_${cIdx}`}>
                        <rect x={c.x - 4} y={c.y - 4} width="8" height="8" fill="#101010" stroke={color} strokeWidth="2.2" />
                        {(selectedChartLift !== 'ALL' || cIdx === coords.length - 1) && (
                          <text x={c.x} y={c.y - 8} textAnchor="middle" fill={color} fontSize="9" fontWeight="800">
                            {c.rawVal}
                          </text>
                        )}
                      </g>
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>
        </IOSListRow>

        {BIG_FOUR_IDS.map((liftId, idx) => {
          const ex = EXERCISE_MAP[liftId];
          const rawVal = Number(oneRepMaxes?.[liftId]) || 0;
          const isTBD = rawVal <= 0;
          const cur1RM = isTBD ? ex.default1RM : rawVal;
          const goalWeight = getExRxTargetForLift(liftId, targetStandardClass, userBodyweightLbs, totalHeightInches, customGoalWeights);
          const distance = goalWeight - cur1RM;
          const series = progressionSeriesByLift[liftId] || [];
          const firstVal = series.length ? (chartMetric === 'weight' ? series[0].weight : series[0].volume) : 0;
          const latestVal = series.length
            ? chartMetric === 'weight'
              ? series[series.length - 1].weight
              : series[series.length - 1].volume
            : 0;
          const delta = latestVal - firstVal;

          return (
            <IOSListRow
              key={liftId}
              isLast={idx === BIG_FOUR_IDS.length - 1}
              colors={colors}
              onClick={() => setSelectedChartLift(prev => (prev === liftId ? 'ALL' : liftId))}
            >
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase' }}>{ex.name}</span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>
                    {isTBD
                      ? `1RM TBD (TARGET ${goalWeight} LB)`
                      : `1RM ${cur1RM} LB (${distance > 0 ? `${distance} lb from ${targetStandardClass}` : 'Goal Met'})`}
                  </span>
                </div>
                <div
                  className="kinetic-sub"
                  style={{
                    fontSize: '11px', color: '#A0A0A0', fontWeight: 700,
                    marginTop: '3px', display: 'flex', justifyContent: 'space-between'
                  }}
                >
                  <span>
                    START: {firstVal} {chartMetric === 'weight' ? 'LB' : 'VOL'} → LATEST: {latestVal}{' '}
                    {chartMetric === 'weight' ? 'LB' : 'VOL'}
                  </span>
                  <span style={{ color: delta >= 0 ? '#30D158' : '#FF3B30' }}>
                    {delta >= 0 ? `+${delta}` : delta} {chartMetric === 'weight' ? 'LB' : 'VOL'}
                  </span>
                </div>
              </div>
            </IOSListRow>
          );
        })}
      </IOSListSection>
    </div>
  );
}

export function StimulusMapView({
  colors,
  stimulusGreenDays,
  stimulusYellowDays,
  muscleStimulusStatus
}) {
  return (
    <div style={{ paddingTop: '14px' }}>
      <IOSListSection
        header="ANATOMICAL STIMULUS DIAGRAM"
        footer={`Green: 0–${stimulusGreenDays}d • Yellow: ${Number(stimulusGreenDays) + 1}–${stimulusYellowDays}d • Red: ${Number(stimulusYellowDays) + 1}+ days since last logged stimulus.`}
        colors={colors}
      >
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '8px 0' }}>
            <div
              style={{
                border: '2px solid var(--dp-color-rule)', backgroundColor: '#101010',
                padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--dp-color-accent)', letterSpacing: '0.06em', marginBottom: '8px' }}>
                ANTERIOR // FRONT
              </div>
              <svg viewBox="0 0 120 230" style={{ width: '100%', maxWidth: '135px', height: 'auto' }}>
                <rect x="50" y="6" width="20" height="22" fill="#262626" stroke="#5C5C5C" strokeWidth="1.5" />
                <rect x="54" y="28" width="12" height="8" fill={muscleStimulusStatus.Neck?.color || '#FF3B30'} stroke="#101010" strokeWidth="1" />
                <rect x="22" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="82" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="36" width="21" height="28" fill={muscleStimulusStatus.Chest?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="61" y="36" width="21" height="28" fill={muscleStimulusStatus.Chest?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="18" y="60" width="15" height="24" fill={muscleStimulusStatus['Upper Arms']?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="87" y="60" width="15" height="24" fill={muscleStimulusStatus['Upper Arms']?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="18" y="85" width="15" height="23" fill={muscleStimulusStatus.Forearms?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="87" y="85" width="15" height="23" fill={muscleStimulusStatus.Forearms?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="40" y="66" width="40" height="46" fill={muscleStimulusStatus.Waist?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <line x1="60" y1="66" x2="60" y2="112" stroke="#101010" strokeWidth="1.5" />
                <line x1="40" y1="81" x2="80" y2="81" stroke="#101010" strokeWidth="1.5" />
                <line x1="40" y1="96" x2="80" y2="96" stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="116" width="20" height="58" fill={muscleStimulusStatus.Thighs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="62" y="116" width="20" height="58" fill={muscleStimulusStatus.Thighs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="40" y="177" width="16" height="44" fill={muscleStimulusStatus.Calves?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="64" y="177" width="16" height="44" fill={muscleStimulusStatus.Calves?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
              </svg>
            </div>

            <div
              style={{
                border: '2px solid var(--dp-color-rule)', backgroundColor: '#101010',
                padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--dp-color-accent)', letterSpacing: '0.06em', marginBottom: '8px' }}>
                POSTERIOR // BACK
              </div>
              <svg viewBox="0 0 120 230" style={{ width: '100%', maxWidth: '135px', height: 'auto' }}>
                <rect x="50" y="6" width="20" height="22" fill="#262626" stroke="#5C5C5C" strokeWidth="1.5" />
                <rect x="54" y="28" width="12" height="8" fill={muscleStimulusStatus.Neck?.color || '#FF3B30'} stroke="#101010" strokeWidth="1" />
                <rect x="22" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="82" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="36" width="44" height="52" fill={muscleStimulusStatus.Back?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <line x1="60" y1="36" x2="60" y2="88" stroke="#101010" strokeWidth="1.5" />
                <rect x="18" y="60" width="15" height="24" fill={muscleStimulusStatus['Upper Arms']?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="87" y="60" width="15" height="24" fill={muscleStimulusStatus['Upper Arms']?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="18" y="85" width="15" height="23" fill={muscleStimulusStatus.Forearms?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="87" y="85" width="15" height="23" fill={muscleStimulusStatus.Forearms?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="42" y="90" width="36" height="22" fill={muscleStimulusStatus.Waist?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="114" width="21" height="24" fill={muscleStimulusStatus.Hips?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="61" y="114" width="21" height="24" fill={muscleStimulusStatus.Hips?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="140" width="20" height="36" fill={muscleStimulusStatus.Thighs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="62" y="140" width="20" height="36" fill={muscleStimulusStatus.Thighs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="40" y="178" width="16" height="43" fill={muscleStimulusStatus.Calves?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="64" y="178" width="16" height="43" fill={muscleStimulusStatus.Calves?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="MUSCLE GROUP TELEMETRY" colors={colors}>
        {Object.entries(muscleStimulusStatus).map(([group, info], idx, arr) => (
          <IOSListRow key={group} isLast={idx === arr.length - 1} colors={colors}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '16px', height: '16px', backgroundColor: info.color, border: '2px solid #FFFFFF', display: 'inline-block' }} />
              <span style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>{group}</span>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 800, color: info.color, textTransform: 'uppercase' }}>
              {info.label}
            </span>
          </IOSListRow>
        ))}
      </IOSListSection>
    </div>
  );
}

const DEFAULT_STARTING_RATIO = 0.78;

function formatRankLabel(rank) {
  return `#${rank < 10 ? `0${rank}` : rank}`;
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

  // 1. BIG 3 TOTAL (Bench + Squat + Deadlift)
  const selfBig3Total =
    (Number(oneRepMaxes.barbell_bench_press) || 225) +
    (Number(oneRepMaxes.barbell_back_squat) || 285) +
    (Number(oneRepMaxes.barbell_deadlift) || 335);

  const rawAthletes = [
    {
      id: user?.id || 'self_user',
      name: selfName,
      isSelf: true,
      bw: selfBw,
      total: selfBig3Total,
      normalized: selfBig3Total / selfBw
    },
    ...distinctFriends.map((f, i) => {
      const fBw = Math.max(50, Number(f.bodyweightLbs || f.bodyweight) || 200);
      const fTotal =
        (Number(f.prs?.barbell_bench_press) || 185) +
        (Number(f.prs?.barbell_back_squat) || 265) +
        (Number(f.prs?.barbell_deadlift) || 315);
      return {
        id: f.id || `friend_${f.username}_${i}`,
        name: f.username || `athlete_${i + 1}`,
        isSelf: false,
        bw: fBw,
        total: fTotal,
        normalized: fTotal / fBw
      };
    })
  ];

  const big3TotalEntries = buildTop10WithSelfSlot(
    [...rawAthletes].sort((a, b) => b.total - a.total)
  );

  // 2. BIG 3 NORMALIZED (Big 3 Total / Bodyweight)
  const big3NormalizedEntries = buildTop10WithSelfSlot(
    [...rawAthletes].sort((a, b) => b.normalized - a.normalized)
  );

  // 3. MOST IMPROVED (Widest range of improvement across any lift, normalized by bodyweight)
  const improvementEntries = [];

  // Current user's lift improvements from logged history + current 1RMs
  const selfLiftStats = {};
  (history || []).forEach(workout => {
    (workout?.slots || []).forEach(slot => {
      const collectSets = (exId, setsList) => {
        if (!exId || !Array.isArray(setsList)) return;
        const exObj = EXERCISE_MAP[exId];
        if (exObj?.isBodyweight) return;
        setsList.forEach(st => {
          const w = Number(st?.weight) || 0;
          const r = Number(st?.reps) || 0;
          if (w <= 0) return;
          const est1rm = r > 1 ? Math.round(w * (1 + r / 30)) : w;
          if (!selfLiftStats[exId]) {
            selfLiftStats[exId] = { min1rm: est1rm, max1rm: est1rm };
          } else {
            selfLiftStats[exId].min1rm = Math.min(selfLiftStats[exId].min1rm, est1rm);
            selfLiftStats[exId].max1rm = Math.max(selfLiftStats[exId].max1rm, est1rm);
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

  // Include current 1RMs for the user so they always have ranked lifts on the Most Improved board
  Object.entries(oneRepMaxes || {}).forEach(([exId, prVal]) => {
    const currentPr = Number(prVal) || 0;
    if (currentPr <= 0) return;
    const exObj = EXERCISE_MAP[exId];
    if (!exObj || exObj.isBodyweight) return;
    const existing = selfLiftStats[exId];
    const startWeight = existing
      ? Math.min(existing.min1rm, currentPr)
      : Math.round((currentPr * DEFAULT_STARTING_RATIO) / 5) * 5;
    const peakWeight = existing ? Math.max(existing.max1rm, currentPr) : currentPr;
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

  // Friends' lift improvements across all exercises in their PRs / startingPrs
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
                BENCH + SQUAT + DEADLIFT
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
                {entry.total} LB TOTAL @ {entry.bw} LB BW
              </span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>
              {entry.normalized.toFixed(2)}× BW
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
                  color: entry.isSelf ? '#30D158' : '#FFFFFF',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                @{entry.name} • {entry.exerciseName}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#888888', textTransform: 'uppercase' }}>
                {entry.startWeight} LB → {entry.peakWeight} LB (+{entry.deltaLbs} LB @ {entry.bw} LB BW)
              </span>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--dp-color-accent)', flexShrink: 0 }}>
              +{entry.normalizedGain.toFixed(2)}× BW
            </span>
          </IOSListRow>
        ))}
      </IOSListSection>
    </div>
  );
}

export function SocialView({
  colors,
  friendSearchQuery,
  setFriendSearchQuery,
  pendingIncomingRequests,
  setPendingIncomingRequests,
  friendsList,
  setFriendsList,
  setViewingFriendProfile,
  setCurrentView
}) {
  return (
    <div style={{ paddingTop: '14px' }}>
      <IOSListSection header="FIND ATHLETES" colors={colors}>
        <IOSListRow isLast={true} colors={colors}>
          <input
            type="text"
            placeholder="SEARCH USERNAME OR EMAIL..."
            value={friendSearchQuery}
            onChange={e => setFriendSearchQuery(e.target.value)}
            style={{
              width: '100%', backgroundColor: '#101010', color: '#FFFFFF',
              border: '2px solid var(--dp-color-rule)', padding: '10px 12px',
              fontSize: '13px', fontWeight: 800, textTransform: 'uppercase'
            }}
          />
        </IOSListRow>
      </IOSListSection>

      {pendingIncomingRequests.length > 0 && (
        <IOSListSection header="INCOMING REQUESTS" colors={colors}>
          {pendingIncomingRequests.map((req, idx) => (
            <IOSListRow key={req.id} isLast={idx === pendingIncomingRequests.length - 1} colors={colors}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>@{req.username}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFriendsList(prev => [...prev, req]);
                  setPendingIncomingRequests(prev => prev.filter(r => r.id !== req.id));
                }}
                style={{
                  padding: '6px 12px', backgroundColor: 'var(--dp-color-accent)',
                  color: '#101010', border: '2px solid #FFFFFF', fontSize: '11px', fontWeight: 800, cursor: 'pointer'
                }}
              >
                ACCEPT
              </button>
            </IOSListRow>
          ))}
        </IOSListSection>
      )}

      <IOSListSection
        header={`FRIENDS (${friendsList.length})`}
        footer="Tap any friend to open their Profile page and view their Personal Records and Shared Routines."
        colors={colors}
      >
        {friendsList
          .filter(
            f =>
              !friendSearchQuery.trim() ||
              f.username.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
              (f.email || '').toLowerCase().includes(friendSearchQuery.toLowerCase())
          )
          .map((friend, i, arr) => (
            <IOSListRow
              key={friend.id}
              isLast={i === arr.length - 1}
              colors={colors}
              onClick={() => {
                setViewingFriendProfile(friend);
                setCurrentView('friend_profile');
              }}
            >
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>@{friend.username}</div>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>VIEW PROFILE →</span>
            </IOSListRow>
          ))}
      </IOSListSection>
    </div>
  );
}

export function ProfileView({
  colors,
  currentView,
  viewingFriendProfile,
  user,
  setUser,
  setCurrentView,
  fileInputRef,
  oneRepMaxes,
  sharedRoutines,
  openPlateCalculatorForPR,
  handleOpenPreviewRoutine,
  onJumpToPRHistoryEntry
}) {
  const isFriend = currentView === 'friend_profile' && viewingFriendProfile;
  const profUser = isFriend
    ? viewingFriendProfile
    : user || { username: 'guest', email: 'Not Signed In' };
  const profPRs = isFriend ? viewingFriendProfile.prs || {} : oneRepMaxes;
  const profRoutines = isFriend ? viewingFriendProfile.sharedRoutines || [] : sharedRoutines;

  return (
    <div style={{ paddingTop: '14px' }}>
      <IOSListSection header="ATHLETE IDENTITY" colors={colors}>
        <IOSListRow isLast={isFriend || !user} colors={colors}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
              @{profUser.username}
            </div>
            {!isFriend && (
              <div style={{ fontSize: '12px', color: '#A0A0A0', fontWeight: 700 }}>{profUser.email}</div>
            )}
          </div>

          {!isFriend && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '8px 12px', backgroundColor: '#101010',
                color: 'var(--dp-color-accent)', border: '2px solid var(--dp-color-rule)',
                fontSize: '11px', fontWeight: 800, cursor: 'pointer'
              }}
            >
              PHOTO
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} />
        </IOSListRow>

        {!isFriend && user && (
          <IOSListRow isLast={true} colors={colors}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#A0A0A0' }}>ACTIVE ACCOUNT SESSION</span>
            <button
              type="button"
              onClick={() => {
                setUser(null);
                setCurrentView('home');
              }}
              className="kinetic-btn"
              style={{
                padding: '6px 12px', backgroundColor: '#161616', color: '#FF3B30',
                border: '2px solid var(--dp-color-rule)', fontSize: '11px',
                fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
              }}
            >
              SIGN OUT
            </button>
          </IOSListRow>
        )}
      </IOSListSection>

      <IOSListSection header="PERSONAL RECORDS" colors={colors}>
        {EXERCISE_LIBRARY.filter(e => e.isPriority).map((ex, i, arr) => {
          const rawVal = Number(profPRs?.[ex.id]) || 0;
          const isTBD = rawVal <= 0;
          return (
            <IOSListRow
              key={ex.id}
              isLast={i === arr.length - 1}
              colors={colors}
              onClick={!isFriend ? () => openPlateCalculatorForPR(ex.id, ex.name, isTBD ? ex.default1RM : rawVal) : undefined}
            >
              <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase' }}>{ex.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>
                  {isTBD ? 'TBD' : `${rawVal} LB`} {!isFriend && '✎'}
                </span>
              </div>
            </IOSListRow>
          );
        })}
      </IOSListSection>

      <IOSListSection header="SHARED ROUTINES" colors={colors}>
        {profRoutines.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={{ fontSize: '12px', color: '#888888' }}>No routines shared yet.</span>
          </IOSListRow>
        ) : (
          profRoutines.map((r, i) => (
            <IOSListRow
              key={r.key}
              isLast={i === profRoutines.length - 1}
              colors={colors}
              onClick={() => handleOpenPreviewRoutine(r, 'session')}
            >
              <span style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>{r.label}</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>LOAD →</span>
            </IOSListRow>
          ))
        )}
      </IOSListSection>
    </div>
  );
}

