'use client';

import React, { useState } from 'react';
import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  getExRxTargetForLift
} from '../../data/exerciseLibrary';

const SHARED_CELL_BORDER = {
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: '1px solid var(--dp-color-rule)',
  borderBottom: '1px solid var(--dp-color-rule)'
};

const SHARED_GROUP_OUTER = {
  borderTop: '1px solid var(--dp-color-rule)',
  borderLeft: '1px solid var(--dp-color-rule)'
};

const BIG_THREE_IDS = ['barbell_bench_press', 'barbell_back_squat', 'barbell_deadlift'];

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
  const [customExerciseId, setCustomExerciseId] = useState(() => {
    if (
      selectedChartLift &&
      selectedChartLift !== 'ALL' &&
      !BIG_THREE_IDS.includes(selectedChartLift) &&
      EXERCISE_MAP[selectedChartLift]
    ) {
      return selectedChartLift;
    }
    return 'overhead_press';
  });

  const isCustomActive =
    selectedChartLift !== 'ALL' && !BIG_THREE_IDS.includes(selectedChartLift);

  const activeCustomId = isCustomActive && EXERCISE_MAP[selectedChartLift]
    ? selectedChartLift
    : customExerciseId;

  const customEx = EXERCISE_MAP[activeCustomId] || EXERCISE_MAP.overhead_press;

  const liftMeta = {
    barbell_bench_press: { short: 'BENCH', color: '#FF6B00' },
    barbell_back_squat: { short: 'SQUAT', color: '#30D158' },
    barbell_deadlift: { short: 'DEADLIFT', color: '#FFD60A' },
    [activeCustomId]: {
      short: (customEx?.name || 'CUSTOM').toUpperCase(),
      color: '#00E5FF'
    }
  };

  const displayedLiftIds = Array.from(new Set([...BIG_THREE_IDS, activeCustomId]));
  const activeLifts = selectedChartLift === 'ALL' ? displayedLiftIds : [isCustomActive ? activeCustomId : selectedChartLift];

  const allDates = Array.from(
    new Set(activeLifts.flatMap(id => (progressionSeriesByLift[id] || []).map(pt => pt.dateLabel)))
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
    <div style={{ paddingTop: '12px', paddingBottom: '36px' }}>
      <section style={{ padding: '0 var(--dp-spacing-gutter)' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: colors?.secondaryLabel || '#A0A0A0',
            marginBottom: '6px',
            textTransform: 'uppercase'
          }}
        >
          PROGRESS
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            ...SHARED_GROUP_OUTER
          }}
        >
          {/* METRIC TOGGLE ROW: 1 REP MAX | VOLUME (ZERO GAP, SHARED BORDERS) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0
            }}
          >
            <button
              type="button"
              onClick={() => setChartMetric('weight')}
              style={{
                height: '44px',
                padding: '0 8px',
                backgroundColor: chartMetric === 'weight' ? 'var(--dp-color-accent)' : '#141416',
                color: chartMetric === 'weight' ? '#000000' : '#FFFFFF',
                ...SHARED_CELL_BORDER,
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              1 REP MAX
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('volume')}
              style={{
                height: '44px',
                padding: '0 8px',
                backgroundColor: chartMetric === 'volume' ? 'var(--dp-color-accent)' : '#141416',
                color: chartMetric === 'volume' ? '#000000' : '#FFFFFF',
                ...SHARED_CELL_BORDER,
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              VOLUME
            </button>
          </div>

          {/* LIFT FILTER ROW: ALL | BENCH | SQUAT | DEAD | CUSTOM (ZERO GAP, SHARED BORDERS) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
              gap: 0
            }}
          >
            {[
              { id: 'ALL', label: 'ALL', active: selectedChartLift === 'ALL' },
              { id: 'barbell_bench_press', label: 'BENCH', active: selectedChartLift === 'barbell_bench_press' },
              { id: 'barbell_back_squat', label: 'SQUAT', active: selectedChartLift === 'barbell_back_squat' },
              { id: 'barbell_deadlift', label: 'DEAD', active: selectedChartLift === 'barbell_deadlift' },
              { id: 'CUSTOM', label: 'CUSTOM', active: isCustomActive }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  if (f.id === 'CUSTOM') {
                    setSelectedChartLift(activeCustomId);
                  } else {
                    setSelectedChartLift(f.id);
                  }
                }}
                style={{
                  height: '42px',
                  padding: '0 4px',
                  backgroundColor: f.active ? '#FFFFFF' : '#141416',
                  color: f.active ? '#000000' : '#A0A0A0',
                  ...SHARED_CELL_BORDER,
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* CUSTOM EXERCISE SELECTOR ROW (SHOWN WHEN CUSTOM IS ACTIVE) */}
          {isCustomActive && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '130px minmax(0, 1fr)',
                gap: 0,
                height: '42px',
                backgroundColor: '#18181B'
              }}
            >
              <div
                style={{
                  padding: '0 10px',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#00E5FF',
                  textTransform: 'uppercase',
                  ...SHARED_CELL_BORDER
                }}
              >
                CUSTOM EXERCISE
              </div>
              <select
                aria-label="Select Custom Exercise for Progress"
                value={activeCustomId}
                onChange={e => {
                  const nextId = e.target.value;
                  setCustomExerciseId(nextId);
                  setSelectedChartLift(nextId);
                }}
                style={{
                  width: '100%',
                  height: '42px',
                  backgroundColor: '#141416',
                  color: '#FFFFFF',
                  ...SHARED_CELL_BORDER,
                  padding: '0 10px',
                  fontSize: '12px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  cursor: 'pointer'
                }}
              >
                {EXERCISE_LIBRARY.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name.toUpperCase()} ({ex.equipment.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* SVG CHART CELL */}
          <div
            style={{
              padding: '12px',
              backgroundColor: '#141416',
              ...SHARED_CELL_BORDER
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
              {activeLifts.map(id => {
                const meta = liftMeta[id] || {
                  short: (EXERCISE_MAP[id]?.name || id).toUpperCase(),
                  color: '#00E5FF'
                };
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        backgroundColor: meta.color,
                        display: 'inline-block'
                      }}
                    />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#FFFFFF' }}>{meta.short}</span>
                  </div>
                );
              })}
            </div>

            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              style={{
                width: '100%',
                height: 'auto',
                backgroundColor: '#101010',
                border: '1px solid var(--dp-color-rule)',
                display: 'block'
              }}
            >
              {yTicks.map((tickVal, idx) => {
                const y = getY(tickVal);
                return (
                  <g key={idx}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={svgW - padR}
                      y2={y}
                      stroke="#2A2A2A"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
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
                const color = liftMeta[liftId]?.color || '#00E5FF';

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
                        <rect
                          x={c.x - 4}
                          y={c.y - 4}
                          width="8"
                          height="8"
                          fill="#101010"
                          stroke={color}
                          strokeWidth="2.2"
                        />
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

          {/* LOWER SECTION: EXERCISE ROWS WITH REDUCED ORANGE TEXT ("X LB FROM GOAL") */}
          {displayedLiftIds.map(liftId => {
            const ex = EXERCISE_MAP[liftId];
            if (!ex) return null;
            const rawVal = Number(oneRepMaxes?.[liftId]) || 0;
            const isTBD = rawVal <= 0;
            const cur1RM = isTBD ? ex.default1RM : rawVal;
            const goalWeight = getExRxTargetForLift(
              liftId,
              targetStandardClass,
              userBodyweightLbs,
              totalHeightInches,
              customGoalWeights
            );
            const distance = Math.max(0, goalWeight - cur1RM);
            const series = progressionSeriesByLift[liftId] || [];
            const firstVal = series.length ? (chartMetric === 'weight' ? series[0].weight : series[0].volume) : 0;
            const latestVal = series.length
              ? chartMetric === 'weight'
                ? series[series.length - 1].weight
                : series[series.length - 1].volume
              : 0;
            const delta = latestVal - firstVal;

            return (
              <div
                key={liftId}
                onClick={() => setSelectedChartLift(prev => (prev === liftId ? 'ALL' : liftId))}
                style={{
                  padding: '10px 12px',
                  backgroundColor: selectedChartLift === liftId ? '#1C1C20' : '#141416',
                  ...SHARED_CELL_BORDER,
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase' }}>
                    {ex.name}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: 'var(--dp-color-accent)',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {distance} LB FROM GOAL
                  </span>
                </div>
                <div
                  className="kinetic-sub"
                  style={{
                    fontSize: '11px',
                    color: '#A0A0A0',
                    fontWeight: 700,
                    marginTop: '3px',
                    display: 'flex',
                    justifyContent: 'space-between'
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
            );
          })}
        </div>
      </section>
    </div>
  );
}


