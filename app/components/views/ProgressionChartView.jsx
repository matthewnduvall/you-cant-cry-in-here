'use client';

import React, { useState } from 'react';
import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  getExRxTargetForLift,
  parseYMDToISO
} from '../../data/exerciseLibrary';
import { SHARED_CELL_BORDER, SHARED_GROUP_OUTER } from '../../styles/kineticTokens';
import { SegmentButton } from '../Controls';
import { ExercisePicker } from '../ExercisePicker';

// Big 3 + OHP: each has its own toggle and is shown by default
const CORE_LIFT_IDS = ['barbell_bench_press', 'barbell_back_squat', 'barbell_deadlift', 'overhead_press'];
export const DEFAULT_CHART_LIFTS = [...CORE_LIFT_IDS];
const DEFAULT_CUSTOM_EXERCISE_ID = 'incline_bench_press';
const CUSTOM_COLOR = '#BF5AF2';

const TIME_FRAME_OPTIONS = [
  { id: '30D', label: '30 DAYS', days: 30 },
  { id: '90D', label: '90 DAYS', days: 90 },
  { id: '1Y', label: '1 YEAR', days: 365 },
  { id: 'ALL', label: 'ALL', days: null }
];

const getPointTimestampMs = pt => {
  if (Number.isFinite(pt?.timestampMs) && pt.timestampMs > 0) {
    return pt.timestampMs;
  }
  const iso = parseYMDToISO(pt?.dateLabel || '');
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const formatBottomAxisDate = ms => {
  const dt = new Date(ms);
  if (Number.isNaN(dt.getTime())) return '';
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  return `${m}/${d}`;
};

const formatProgressExerciseLabel = (exId, rawName) => {
  const upper = String(rawName || '').trim().toUpperCase();
  if (exId === 'overhead_press' || upper === 'BARBELL MILITARY OVERHEAD PRESS') {
    return 'OHP';
  }
  return upper || String(exId || 'CUSTOM').toUpperCase();
};

export function ProgressionChartView({
  colors,
  chartMetric,
  setChartMetric,
  // Lifts drawn on the chart (toggles; several at once)
  selectedChartLifts = DEFAULT_CHART_LIFTS,
  setSelectedChartLifts,
  progressionSeriesByLift,
  oneRepMaxes,
  targetStandardClass,
  userBodyweightLbs,
  totalHeightInches,
  customGoalWeights,
  // A friend's profile: their 1RM instead of distance to the viewer's goal
  showGoalDistance = true
}) {
  const [timeFrame, setTimeFrame] = useState('30D');
  const selectedLifts = Array.isArray(selectedChartLifts) ? selectedChartLifts : DEFAULT_CHART_LIFTS;
  const [customExerciseId, setCustomExerciseId] = useState(() => {
    const picked = selectedLifts.find(id => !CORE_LIFT_IDS.includes(id) && EXERCISE_MAP[id]);
    if (picked) return picked;
    return EXERCISE_MAP[DEFAULT_CUSTOM_EXERCISE_ID] ? DEFAULT_CUSTOM_EXERCISE_ID : EXERCISE_LIBRARY[0].id;
  });

  const activeCustomId = customExerciseId;
  const isCustomActive = selectedLifts.includes(activeCustomId);
  const customEx = EXERCISE_MAP[activeCustomId];

  const liftMeta = {
    barbell_bench_press: { short: 'BENCH', color: '#FF6B00' },
    barbell_back_squat: { short: 'SQUAT', color: '#30D158' },
    barbell_deadlift: { short: 'DEADLIFT', color: '#FFD60A' },
    overhead_press: { short: 'OHP', color: '#00E5FF' },
    [activeCustomId]: {
      short: formatProgressExerciseLabel(activeCustomId, customEx?.name || 'CUSTOM'),
      color: CUSTOM_COLOR
    }
  };

  const toggleLift = liftId =>
    setSelectedChartLifts?.(prev => {
      const list = Array.isArray(prev) ? prev : DEFAULT_CHART_LIFTS;
      return list.includes(liftId) ? list.filter(id => id !== liftId) : [...list, liftId];
    });

  // Lower list: Big 3 + OHP, plus the custom exercise while its toggle is on
  const displayedLiftIds = isCustomActive ? [...CORE_LIFT_IDS, activeCustomId] : [...CORE_LIFT_IDS];
  const activeLifts = displayedLiftIds.filter(id => selectedLifts.includes(id));
  const singleLift = activeLifts.length === 1;

  // Collect all timestamps across active lifts (and fallback to all displayed lifts)
  const rawTimestamps = activeLifts.flatMap(id =>
    (progressionSeriesByLift[id] || []).map(getPointTimestampMs).filter(ms => ms > 0)
  );
  const fallbackTimestamps = displayedLiftIds.flatMap(id =>
    (progressionSeriesByLift[id] || []).map(getPointTimestampMs).filter(ms => ms > 0)
  );
  const refTimestamps = rawTimestamps.length > 0 ? rawTimestamps : fallbackTimestamps;

  const DAY_MS = 86400000;
  const DEFAULT_REF_MS = 1793966400000; // Deterministic fallback if no workouts logged yet
  const maxDataMs = refTimestamps.length > 0 ? Math.max(...refTimestamps) : DEFAULT_REF_MS;
  const minDataMs =
    refTimestamps.length > 0 ? Math.min(...refTimestamps) : maxDataMs - 30 * DAY_MS;

  const selectedTimeFrameObj =
    TIME_FRAME_OPTIONS.find(t => t.id === timeFrame) || TIME_FRAME_OPTIONS[0];

  const domainMaxMs = maxDataMs;
  const domainMinMs = selectedTimeFrameObj.days
    ? domainMaxMs - selectedTimeFrameObj.days * DAY_MS
    : minDataMs < domainMaxMs
      ? minDataMs
      : domainMaxMs - 30 * DAY_MS;

  // Filter and strictly sort each lift's series chronologically within [domainMinMs, domainMaxMs]
  const filteredSeriesByLift = {};
  displayedLiftIds.forEach(id => {
    const rawSeries = progressionSeriesByLift[id] || [];
    const withTime = rawSeries
      .map(pt => ({
        ...pt,
        timestampMs: getPointTimestampMs(pt)
      }))
      .filter(pt => {
        if (pt.timestampMs <= 0) return false;
        if (selectedTimeFrameObj.days) {
          return pt.timestampMs >= domainMinMs && pt.timestampMs <= domainMaxMs;
        }
        return true;
      })
      .sort((a, b) => a.timestampMs - b.timestampMs);
    filteredSeriesByLift[id] = withTime;
  });

  const allVals = activeLifts.flatMap(id =>
    (filteredSeriesByLift[id] || []).map(pt =>
      chartMetric === 'weight' ? pt.weight : pt.volume
    )
  );

  const rawMin = allVals.length ? Math.min(...allVals) : 0;
  const rawMax = allVals.length ? Math.max(...allVals) : 300;
  const pad = Math.max(10, Math.round((rawMax - rawMin) * 0.15));
  const minVal = Math.max(0, rawMin - pad);
  const maxVal = rawMax + pad;

  const svgW = 360;
  const svgH = 210;
  const padL = 40;
  const padR = 16;
  const padT = 18;
  const padB = 30;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const getXByTime = tsMs => {
    const span = domainMaxMs - domainMinMs;
    if (span <= 0) return padL + plotW / 2;
    const clampedRatio = Math.max(0, Math.min(1, (tsMs - domainMinMs) / span));
    return padL + clampedRatio * plotW;
  };

  const getY = val => padT + plotH - ((val - minVal) / Math.max(1, maxVal - minVal)) * plotH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(minVal + t * (maxVal - minVal)));

  // Always generate 10 evenly spaced date ticks along the bottom X-axis for the active timeframe
  const xDateTicks = Array.from({ length: 6 }, (_, idx) => {
    const ratio = idx / 5;
    const tickMs = Math.round(domainMinMs + ratio * (domainMaxMs - domainMinMs));
    return {
      key: `xtick_${idx}`,
      x: padL + ratio * plotW,
      label: formatBottomAxisDate(tickMs)
    };
  });

  return (
    <div style={{ paddingTop: '16px', paddingBottom: '36px' }}>
      <section style={{ padding: '0 var(--dp-spacing-gutter)' }}>

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
            <SegmentButton
              active={chartMetric === 'weight'}
              onClick={() => setChartMetric('weight')}
              style={{ height: '44px', padding: '0 8px' }}
            >
              1 REP MAX
            </SegmentButton>
            <SegmentButton
              active={chartMetric === 'volume'}
              onClick={() => setChartMetric('volume')}
              style={{ height: '44px', padding: '0 8px' }}
            >
              VOLUME
            </SegmentButton>
          </div>

          {/* TIME FRAME FILTER ROW: 30 DAYS | 90 DAYS | 1 YEAR | ALL (ZERO GAP, SHARED BORDERS) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 0
            }}
          >
            {TIME_FRAME_OPTIONS.map(tf => {
              const isActive = timeFrame === tf.id;
              return (
                <SegmentButton
                  active={isActive}
                  inactiveColor="#A0A0A0"
                  key={tf.id}
                  onClick={() => setTimeFrame(tf.id)}
                  style={{ height: '38px', padding: '0 4px', fontSize: '11px' }}
                >
                  {tf.label}
                </SegmentButton>
              );
            })}
          </div>

          {/* LIFT TOGGLES: BENCH | SQUAT | DEAD | OHP | CUSTOM — any combination (ZERO GAP, SHARED BORDERS) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
              gap: 0
            }}
          >
            {[
              { id: 'barbell_bench_press', label: 'BENCH' },
              { id: 'barbell_back_squat', label: 'SQUAT' },
              { id: 'barbell_deadlift', label: 'DEAD' },
              { id: 'overhead_press', label: 'OHP' },
              { id: activeCustomId, label: 'CUSTOM', isCustom: true }
            ].map(f => {
              const active = selectedLifts.includes(f.id);
              const color = f.isCustom ? CUSTOM_COLOR : liftMeta[f.id]?.color;
              return (
                <SegmentButton
                  active={active}
                  inactiveColor="#A0A0A0"
                  key={f.isCustom ? 'CUSTOM' : f.id}
                  onClick={() => toggleLift(f.id)}
                  style={{
                    height: '42px',
                    padding: '0 4px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  {/* The lift's line colour, so the toggles double as the chart legend */}
                  <span
                    aria-hidden="true"
                    style={{
                      width: '8px',
                      height: '8px',
                      flexShrink: 0,
                      backgroundColor: color,
                      outline: active ? '1px solid #101010' : 'none'
                    }}
                  />
                  {f.label}
                </SegmentButton>
              );
            })}
          </div>

          {/* CUSTOM EXERCISE (SHOWN WHEN CUSTOM IS ACTIVE): the standard exercise picker */}
          {isCustomActive && (
            <ExercisePicker
              exerciseId={activeCustomId}
              types={['Compound', 'Accessory']}
              onChange={nextId => {
                const prevId = activeCustomId;
                setCustomExerciseId(nextId);
                setSelectedChartLifts?.(prev => {
                  const list = (Array.isArray(prev) ? prev : DEFAULT_CHART_LIFTS).filter(id => id !== prevId);
                  return list.includes(nextId) ? list : [...list, nextId];
                });
              }}
            />
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
                  short: formatProgressExerciseLabel(id, EXERCISE_MAP[id]?.name || id),
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
                    <text x={padL - 6} y={y + 3} textAnchor="end" fill="#A0A0A0" fontSize="12.5" fontWeight="700">
                      {tickVal >= 1000 && chartMetric === 'volume' ? `${(tickVal / 1000).toFixed(1)}k` : tickVal}
                    </text>
                  </g>
                );
              })}

              {xDateTicks.map(tick => (
                <g key={tick.key}>
                  <line x1={tick.x} y1={padT} x2={tick.x} y2={padT + plotH} stroke="#1E1E1E" strokeWidth="1" />
                  <text
                    x={tick.x}
                    y={svgH - 9}
                    textAnchor="middle"
                    fill="#A0A0A0"
                    fontSize="12.5"
                    fontWeight="800"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}

              {activeLifts.map(liftId => {
                const series = filteredSeriesByLift[liftId] || [];
                if (series.length === 0) return null;
                const color = liftMeta[liftId]?.color || '#00E5FF';

                const coords = series.map(pt => {
                  const x = getXByTime(pt.timestampMs);
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
                    {singleLift && areaPoints && (
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
                        {(singleLift || cIdx === coords.length - 1) && (
                          <text x={c.x} y={c.y - 8} textAnchor="middle" fill={color} fontSize="12.5" fontWeight="800">
                            {c.rawVal}
                          </text>
                        )}
                      </g>
                    ))}
                  </g>
                );
              })}
              {activeLifts.every(id => (filteredSeriesByLift[id] || []).length === 0) && (
                <text
                  x={padL + plotW / 2}
                  y={padT + plotH / 2}
                  textAnchor="middle"
                  fill="#A0A0A0"
                  fontSize="14"
                  fontWeight="800"
                >
                  {activeLifts.length === 0 ? 'TURN ON A LIFT ABOVE' : 'LOG A SESSION TO SEE PROGRESS'}
                </text>
              )}
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
            const series = filteredSeriesByLift[liftId] || [];
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
                onClick={() => toggleLift(liftId)}
                style={{
                  padding: '10px 12px',
                  backgroundColor: selectedLifts.includes(liftId) ? '#1C1C20' : '#141416',
                  opacity: selectedLifts.includes(liftId) ? 1 : 0.55,
                  ...SHARED_CELL_BORDER,
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase' }}>
                    {formatProgressExerciseLabel(ex.id, ex.name)}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: isTBD ? '#8E8E93' : 'var(--dp-color-accent)',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isTBD ? 'NOT LOGGED YET' : showGoalDistance ? `${distance} LB FROM GOAL` : `1RM ${cur1RM} LB`}
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
                  {series.length === 0 ? (
                    <span>NO SESSIONS IN THIS TIME FRAME</span>
                  ) : (
                    <>
                      <span>
                        START: {firstVal} LB → LATEST: {latestVal} LB
                      </span>
                      <span style={{ color: delta >= 0 ? '#30D158' : '#FF3B30' }}>
                        {delta >= 0 ? `+${delta}` : delta} LB
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}


