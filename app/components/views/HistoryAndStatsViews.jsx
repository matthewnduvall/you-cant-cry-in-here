'use client';

import React from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
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
  historySessionsExpanded,
  setHistorySessionsExpanded,
  expandedHistoryWorkoutId,
  setExpandedHistoryWorkoutId,
  historyPRsExpanded,
  setHistoryPRsExpanded,
  oneRepMaxes,
  targetStandardClass,
  userBodyweightLbs,
  totalHeightInches,
  customGoalWeights,
  setHistoricalDraft,
  setCurrentView,
  openPlateCalculatorForPR
}) {
  return (
    <div style={UI.pagePad}>
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

      <IOSListSection header="LOGGED SESSIONS" colors={colors}>
        <IOSListRow
          onClick={() => setHistorySessionsExpanded(p => !p)}
          isLast={!historySessionsExpanded || history.length === 0}
          colors={colors}
        >
          <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--dp-color-accent)' }}>
            {historySessionsExpanded ? 'HIDE SESSIONS' : `SHOW SESSIONS (${history.length})`}
          </span>
          <span style={{ fontSize: '18px', fontWeight: 800 }}>
            {historySessionsExpanded ? '−' : '+'}
          </span>
        </IOSListRow>

        {historySessionsExpanded &&
          history.map((w, idx) => {
            const isExp = expandedHistoryWorkoutId === w.id;
            return (
              <div
                key={w.id}
                style={{
                  borderBottom: idx === history.length - 1 ? 'none' : '2px solid var(--dp-color-rule)'
                }}
              >
                <div
                  onClick={() => setExpandedHistoryWorkoutId(isExp ? null : w.id)}
                  style={{
                    padding: '14px 16px', backgroundColor: '#141414',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>
                      {w.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#A0A0A0', fontWeight: 600 }}>
                      {new Date(w.startedAt).toLocaleDateString()} • {(w.slots || []).length} SLOTS
                    </div>
                  </div>
                  <span style={{ fontSize: '18px', fontWeight: 800 }}>{isExp ? '−' : '+'}</span>
                </div>

                {isExp && (
                  <div
                    style={{
                      padding: '12px 16px', backgroundColor: '#101010',
                      borderTop: '2px solid var(--dp-color-rule)',
                      display: 'flex', flexDirection: 'column', gap: '8px'
                    }}
                  >
                    {(w.slots || []).map(s => (
                      <div key={s.id} style={{ fontSize: '12px', fontWeight: 700 }}>
                        <span style={{ color: 'var(--dp-color-accent)' }}>{s.slotLabel}:</span>{' '}
                        {EXERCISE_MAP[s.exerciseId]?.name || s.exerciseId} ({(s.sets || []).length} sets)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </IOSListSection>

      <IOSListSection
        header="PERSONAL RECORDS"
        footer="Tap any Personal Record weight to edit it with the Plate & Weight Calculator."
        colors={colors}
      >
        <IOSListRow
          onClick={() => setHistoryPRsExpanded(p => !p)}
          isLast={!historyPRsExpanded}
          colors={colors}
        >
          <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--dp-color-accent)' }}>
            {historyPRsExpanded ? 'HIDE PERSONAL RECORDS' : 'SHOW PERSONAL RECORDS'}
          </span>
          <span style={{ fontSize: '18px', fontWeight: 800 }}>
            {historyPRsExpanded ? '−' : '+'}
          </span>
        </IOSListRow>

        {historyPRsExpanded &&
          EXERCISE_LIBRARY.filter(e => e.isPriority).map((ex, idx, arr) => {
            const currentMax = oneRepMaxes[ex.id] ?? ex.default1RM;
            const isBigFour = BIG_FOUR_IDS.includes(ex.id);
            const targetVal = isBigFour
              ? getExRxTargetForLift(ex.id, targetStandardClass, userBodyweightLbs, totalHeightInches, customGoalWeights)
              : null;
            const diffFromGoal = targetVal !== null ? targetVal - currentMax : null;

            return (
              <IOSListRow
                key={ex.id}
                isLast={idx === arr.length - 1}
                colors={colors}
                onClick={() => openPlateCalculatorForPR(ex.id, ex.name, currentMax)}
              >
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>
                    {ex.name}
                  </div>
                  {diffFromGoal !== null && (
                    <div className="kinetic-sub" style={{ fontSize: '11px', color: '#A0A0A0', fontWeight: 700 }}>
                      {diffFromGoal > 0
                        ? `${diffFromGoal} lb from ${targetStandardClass}`
                        : `Goal Achieved (+${Math.abs(diffFromGoal)} lb)`}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    padding: '6px 10px', backgroundColor: '#101010',
                    border: '2px solid var(--dp-color-rule)', color: 'var(--dp-color-accent)',
                    fontSize: '14px', fontWeight: 800
                  }}
                >
                  {currentMax} LB ✎
                </span>
              </IOSListRow>
            );
          })}
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
          const cur1RM = oneRepMaxes[liftId] ?? ex.default1RM;
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
                  1RM: <strong style={{ color: '#FFFFFF' }}>{cur1RM} LB</strong> • CLASS:{' '}
                  <strong style={{ color: 'var(--dp-color-accent)' }}>{curClass.toUpperCase()}</strong>
                </div>
                <div style={{ fontSize: '11px', color: '#30D158', fontWeight: 700 }}>
                  {distance > 0
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
          const cur1RM = oneRepMaxes[liftId] ?? ex.default1RM;
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
                    1RM {cur1RM} LB ({distance > 0 ? `${distance} lb from ${targetStandardClass}` : 'Goal Met'})
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
                <rect x="54" y="28" width="12" height="8" fill="#262626" />
                <rect x="22" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="82" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="36" width="21" height="28" fill={muscleStimulusStatus.Chest?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="61" y="36" width="21" height="28" fill={muscleStimulusStatus.Chest?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="18" y="60" width="15" height="48" fill={muscleStimulusStatus.Arms?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="87" y="60" width="15" height="48" fill={muscleStimulusStatus.Arms?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="40" y="66" width="40" height="46" fill={muscleStimulusStatus.Core?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <line x1="60" y1="66" x2="60" y2="112" stroke="#101010" strokeWidth="1.5" />
                <line x1="40" y1="81" x2="80" y2="81" stroke="#101010" strokeWidth="1.5" />
                <line x1="40" y1="96" x2="80" y2="96" stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="116" width="20" height="58" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="62" y="116" width="20" height="58" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="40" y="177" width="16" height="44" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="64" y="177" width="16" height="44" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
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
                <rect x="54" y="28" width="12" height="8" fill="#262626" />
                <rect x="22" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="82" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="36" width="44" height="52" fill={muscleStimulusStatus.Back?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <line x1="60" y1="36" x2="60" y2="88" stroke="#101010" strokeWidth="1.5" />
                <rect x="18" y="60" width="15" height="48" fill={muscleStimulusStatus.Arms?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="87" y="60" width="15" height="48" fill={muscleStimulusStatus.Arms?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="42" y="90" width="36" height="22" fill={muscleStimulusStatus.Back?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="114" width="21" height="24" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="61" y="114" width="21" height="24" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="140" width="20" height="36" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="62" y="140" width="20" height="36" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="40" y="178" width="16" height="43" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                <rect x="64" y="178" width="16" height="43" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
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

export function LeaderboardView({
  colors,
  user,
  oneRepMaxes,
  friendsList
}) {
  const entries = [
    {
      name: user?.username || 'you (logged out)',
      total:
        (oneRepMaxes.barbell_bench_press || 225) +
        (oneRepMaxes.barbell_back_squat || 285) +
        (oneRepMaxes.barbell_deadlift || 335) +
        (oneRepMaxes.overhead_press || 145)
    },
    ...friendsList.map(f => ({
      name: f.username,
      total:
        (f.prs?.barbell_bench_press || 185) +
        (f.prs?.barbell_back_squat || 265) +
        (f.prs?.barbell_deadlift || 315) +
        (f.prs?.overhead_press || 115)
    }))
  ].sort((a, b) => b.total - a.total);

  return (
    <div style={{ paddingTop: '14px' }}>
      <IOSListSection header="COMMUNITY BIG 3 + OHP TOTAL" colors={colors}>
        {entries.map((entry, idx, arr) => (
          <IOSListRow key={entry.name} indexLabel={`#0${idx + 1}`} isLast={idx === arr.length - 1} colors={colors}>
            <span style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>@{entry.name}</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>{entry.total} LB</span>
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
                <div style={{ fontSize: '11px', color: '#A0A0A0' }}>{req.email}</div>
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
        footer="Tap any friend to open their Profile page and view their PRs and Shared Routines."
        colors={colors}
      >
        {friendsList
          .filter(
            f =>
              !friendSearchQuery.trim() ||
              f.username.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
              f.email.toLowerCase().includes(friendSearchQuery.toLowerCase())
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
                <div className="kinetic-sub" style={{ fontSize: '11px', color: '#A0A0A0' }}>{friend.email}</div>
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
  handleOpenPreviewRoutine
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
            <div style={{ fontSize: '12px', color: '#A0A0A0', fontWeight: 700 }}>{profUser.email}</div>
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

      <IOSListSection header="PRS (PERSONAL RECORDS)" colors={colors}>
        {EXERCISE_LIBRARY.filter(e => e.isPriority).map((ex, i, arr) => {
          const val = profPRs[ex.id] ?? ex.default1RM;
          return (
            <IOSListRow
              key={ex.id}
              isLast={i === arr.length - 1}
              colors={colors}
              onClick={!isFriend ? () => openPlateCalculatorForPR(ex.id, ex.name, val) : undefined}
            >
              <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase' }}>{ex.name}</span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>
                {val} LB {!isFriend && '✎'}
              </span>
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
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>PREVIEW →</span>
            </IOSListRow>
          ))
        )}
      </IOSListSection>
    </div>
  );
}

