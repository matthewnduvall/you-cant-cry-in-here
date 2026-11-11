'use client';

import React, { useEffect, useRef, useState } from 'react';
import { EXERCISE_LIBRARY, EXERCISE_MAP, parseYMDToISO } from '../../data/exerciseLibrary';
import { SHARED_CELL_BORDER, SHARED_GROUP_OUTER } from '../../styles/kineticTokens';
import { Button, SegmentButton } from '../Controls';
import { ExercisePicker } from '../ExercisePicker';
import {
  CORE_LIFT_IDS,
  CORE_LIFT_META,
  CUSTOM_LIFT_COLOR as CUSTOM_COLOR,
  LiftGoalRow,
  StrengthClassGoalPicker,
  formatLiftLabel as formatProgressExerciseLabel,
  getLiftGoalStats
} from '../LiftGoals';

// Big 3 + OHP: each has its own row in the legend and is shown by default
export const DEFAULT_CHART_LIFTS = [...CORE_LIFT_IDS];
const DEFAULT_CUSTOM_EXERCISE_ID = 'incline_bench_press';

const TIME_FRAME_OPTIONS = [
  { id: '30D', label: '30 DAYS', days: 30 },
  { id: '90D', label: '90 DAYS', days: 90 },
  { id: '1Y', label: '1 YEAR', days: 365 },
  { id: 'ALL', label: 'ALL', days: null }
];
const DEFAULT_TIME_FRAME = '90D';
const DAY_MS = 86400000;

const getPointTimestampMs = pt => {
  if (Number.isFinite(pt?.timestampMs) && pt.timestampMs > 0) {
    return pt.timestampMs;
  }
  const iso = parseYMDToISO(pt?.dateLabel || '');
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

// Bottom-axis date: M/D in the current year, M/D/YYYY for dates in an earlier year (e.g. 10/9/2025)
const formatBottomAxisDate = (ms, currentYear) => {
  const dt = new Date(ms);
  if (Number.isNaN(dt.getTime())) return '';
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  return dt.getFullYear() < currentYear ? `${m}/${d}/${dt.getFullYear()}` : `${m}/${d}`;
};

// The smoothed average curve: Gaussian-weighted average of the lift's points (bandwidth `bandMs`) sampled evenly
// between `fromMs` and `toMs`
const smoothSeries = (points, fromMs, toMs, bandMs, samples = 48) => {
  if (points.length < 3 || toMs <= fromMs || bandMs <= 0) return [];
  return Array.from({ length: samples }, (_, i) => {
    const t = fromMs + ((toMs - fromMs) * i) / (samples - 1);
    let sumW = 0;
    let sumV = 0;
    points.forEach(pt => {
      const z = (pt.timestampMs - t) / bandMs;
      const w = Math.exp(-0.5 * z * z);
      sumW += w;
      sumV += w * pt.weight;
    });
    return sumW > 1e-9 ? { t, v: sumV / sumW } : null;
  }).filter(Boolean);
};

// Catmull-Rom → cubic Bézier: a smooth SVG path through the coordinates
const smoothPath = coords => {
  if (coords.length < 2) return '';
  let d = `M${coords[0].x},${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[i - 1] || coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] || p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`;
  }
  return d;
};

export function ProgressionChartView({
  // Lifts drawn on the chart (several at once); the legend rows under the chart pick them
  selectedChartLifts = DEFAULT_CHART_LIFTS,
  setSelectedChartLifts,
  progressionSeriesByLift,
  oneRepMaxes,
  targetStandardClass,
  userBodyweightLbs,
  totalHeightInches,
  customGoalWeights,
  // STRENGTH CLASS GOAL picker at the top (own Progress page) and GOAL ✎ on each lift (Plate Calculator, goal mode)
  setTargetStandardClass,
  openPlateCalculatorForGoal,
  // A friend's profile: START | PR | LATEST only (no goals)
  showGoalDistance = true,
  // Tapping a chart point opens that workout in History (own profile / PROGRESS page only)
  onOpenHistoryWorkout,
  // GOALS → shortcut under the legend (Configuration → GOALS)
  onOpenGoals
}) {
  // The chart always shows the estimated 1 rep max
  const [timeFrame, setTimeFrame] = useState(DEFAULT_TIME_FRAME);
  // How far the window is scrolled back from the latest logged date (0 = ends at the latest)
  const [offsetMs, setOffsetMs] = useState(0);
  // Read the year after mount (no Date.now() during render with cacheComponents)
  const [currentYear, setCurrentYear] = useState(null);
  useEffect(() => {
    const id = setTimeout(() => setCurrentYear(new Date().getFullYear()), 0);
    return () => clearTimeout(id);
  }, []);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);

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
    ...CORE_LIFT_META,
    [activeCustomId]: {
      short: formatProgressExerciseLabel(activeCustomId, customEx?.name || 'CUSTOM'),
      color: CUSTOM_COLOR
    }
  };

  // Legend rows: the Big 3 + OHP, then the CUSTOM exercise
  const legendLiftIds = [...CORE_LIFT_IDS, activeCustomId];
  const activeLifts = legendLiftIds.filter(id => selectedLifts.includes(id));
  const singleLift = activeLifts.length === 1;

  // Tapping a lift shows only that lift; tapping the only lift shown brings every lift back
  const soloLift = liftId =>
    setSelectedChartLifts?.(() => (singleLift && activeLifts[0] === liftId ? [...legendLiftIds] : [liftId]));

  // Time range of the data (the lifts shown, else every lift)
  const timestampsOf = ids => ids.flatMap(id => (progressionSeriesByLift[id] || []).map(getPointTimestampMs).filter(ms => ms > 0));
  const shownTimestamps = timestampsOf(activeLifts);
  const refTimestamps = shownTimestamps.length > 0 ? shownTimestamps : timestampsOf(legendLiftIds);
  const DEFAULT_REF_MS = 1793966400000; // Deterministic fallback if no workouts logged yet
  const maxDataMs = refTimestamps.length > 0 ? Math.max(...refTimestamps) : DEFAULT_REF_MS;
  const minDataMs = refTimestamps.length > 0 ? Math.min(...refTimestamps) : maxDataMs - 30 * DAY_MS;
  const yearNow = currentYear || new Date(maxDataMs).getFullYear();

  const selectedTimeFrameObj = TIME_FRAME_OPTIONS.find(t => t.id === timeFrame) || TIME_FRAME_OPTIONS[1];
  const windowMs = selectedTimeFrameObj.days ? selectedTimeFrameObj.days * DAY_MS : null;
  // The window can scroll back until its start reaches the first logged date (a few days' margin)
  // A little room after the latest date so its point and value aren't cut off at the right edge
  const endRoomMs = Math.round((windowMs || Math.max(30 * DAY_MS, maxDataMs - minDataMs)) * 0.05);
  const maxOffsetMs = windowMs ? Math.max(0, maxDataMs - minDataMs - windowMs + endRoomMs + 3 * DAY_MS) : 0;
  const clampedOffset = Math.max(0, Math.min(maxOffsetMs, offsetMs));
  const canScroll = maxOffsetMs > 0;

  const domainMaxMs = (windowMs ? maxDataMs - clampedOffset : maxDataMs) + endRoomMs;
  const domainMinMs = windowMs
    ? domainMaxMs - windowMs
    : minDataMs < maxDataMs
      ? minDataMs - endRoomMs
      : domainMaxMs - 30 * DAY_MS;

  // Each lift's points, oldest first; `inWindow` = the points inside the visible window
  const seriesByLift = {};
  const inWindowByLift = {};
  legendLiftIds.forEach(id => {
    const all = (progressionSeriesByLift[id] || [])
      .map(pt => ({ ...pt, timestampMs: getPointTimestampMs(pt) }))
      .filter(pt => pt.timestampMs > 0)
      .sort((a, b) => a.timestampMs - b.timestampMs);
    seriesByLift[id] = all;
    inWindowByLift[id] = all.filter(pt => pt.timestampMs >= domainMinMs && pt.timestampMs <= domainMaxMs);
  });

  const allVals = activeLifts.flatMap(id => (inWindowByLift[id] || []).map(pt => pt.weight));
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

  // Points outside the window get x outside the plot; the clip path hides them (lines run off the edges)
  const getXByTime = tsMs => {
    const span = domainMaxMs - domainMinMs;
    if (span <= 0) return padL + plotW / 2;
    return padL + ((tsMs - domainMinMs) / span) * plotW;
  };

  const getY = val => padT + plotH - ((val - minVal) / Math.max(1, maxVal - minVal)) * plotH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(minVal + t * (maxVal - minVal)));

  // 6 date ticks, or 3 when they carry their year (M/D/YYYY) so they don't crowd
  const tickMsAt = (count, idx) => Math.round(domainMinMs + (idx / (count - 1)) * (domainMaxMs - domainMinMs));
  const anyOldYear = [0, 1].some(i => new Date(tickMsAt(2, i)).getFullYear() < yearNow);
  const xTickCount = anyOldYear ? 3 : 6;
  const xDateTicks = Array.from({ length: xTickCount }, (_, idx) => {
    const ratio = idx / (xTickCount - 1);
    return {
      key: `xtick_${idx}`,
      x: padL + ratio * plotW,
      // The first and last labels end at their gridline so they never run off the chart
      anchor: idx === xTickCount - 1 ? 'end' : idx === 0 && anyOldYear ? 'start' : 'middle',
      label: formatBottomAxisDate(tickMsAt(xTickCount, idx), yearNow)
    };
  });

  // Drag sideways on the chart to scroll through time (the time frame sets the zoom). Vertical drags still scroll
  // the page (touch-action: pan-y).
  const handlePointerDown = e => {
    suppressClickRef.current = false;
    if (!canScroll) return;
    dragRef.current = { x: e.clientX, start: clampedOffset, moved: false };
  };
  const handlePointerMove = e => {
    const drag = dragRef.current;
    if (!drag || !svgRef.current) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      suppressClickRef.current = true;
      svgRef.current.setPointerCapture?.(e.pointerId);
    }
    const plotPx = (svgRef.current.getBoundingClientRect().width * plotW) / svgW;
    const msPerPx = (domainMaxMs - domainMinMs) / Math.max(1, plotPx);
    // Dragging right shows earlier dates
    setOffsetMs(Math.max(0, Math.min(maxOffsetMs, drag.start + dx * msPerPx)));
  };
  const endDrag = () => {
    dragRef.current = null;
  };
  const stepWindow = direction =>
    setOffsetMs(Math.max(0, Math.min(maxOffsetMs, clampedOffset + direction * (windowMs || 0) * 0.5)));

  const openPoint = workoutId => {
    if (suppressClickRef.current || !onOpenHistoryWorkout || !workoutId) return;
    onOpenHistoryWorkout(workoutId);
  };

  const rangeLabel = `${formatBottomAxisDate(domainMinMs, yearNow)} – ${formatBottomAxisDate(domainMaxMs, yearNow)}`;
  const smallButton = {
    height: '40px',
    padding: '0 10px',
    backgroundColor: '#161618',
    color: '#FFFFFF',
    border: 'none',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit'
  };

  return (
    <div style={{ paddingTop: '16px', paddingBottom: '36px' }}>
      <section style={{ padding: '0 var(--dp-spacing-gutter)' }}>
        {/* STRENGTH CLASS GOAL (same as Configuration → GOALS): sets each lift's GOAL below */}
        {showGoalDistance && setTargetStandardClass && (
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px', ...SHARED_GROUP_OUTER }}>
            <StrengthClassGoalPicker
              targetStandardClass={targetStandardClass}
              setTargetStandardClass={setTargetStandardClass}
              oneRepMaxes={oneRepMaxes}
            />
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            ...SHARED_GROUP_OUTER
          }}
        >
          {/* TIME FRAME: 30 DAYS | 90 DAYS | 1 YEAR | ALL — the chart's zoom */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 0
            }}
          >
            {TIME_FRAME_OPTIONS.map(tf => (
              <SegmentButton
                active={timeFrame === tf.id}
                inactiveColor="#A0A0A0"
                key={tf.id}
                onClick={() => {
                  setTimeFrame(tf.id);
                  setOffsetMs(0);
                }}
                style={{ height: '38px', padding: '0 4px', fontSize: '11px' }}
              >
                {tf.label}
              </SegmentButton>
            ))}
          </div>

          {/* SVG CHART CELL */}
          <div
            style={{
              padding: '12px',
              backgroundColor: '#141416',
              ...SHARED_CELL_BORDER
            }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgW} ${svgH}`}
              role="img"
              aria-label={`Estimated 1 rep max, ${rangeLabel}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{
                width: '100%',
                height: 'auto',
                backgroundColor: '#101010',
                border: '1px solid var(--dp-color-rule)',
                display: 'block',
                touchAction: 'pan-y',
                cursor: canScroll ? 'grab' : 'default'
              }}
            >
              <defs>
                <clipPath id="progress-plot-clip">
                  <rect x={padL - 6} y={0} width={svgW - padL + 6} height={padT + plotH + 6} />
                </clipPath>
              </defs>
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
                      {tickVal}
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
                    textAnchor={tick.anchor}
                    fill="#A0A0A0"
                    fontSize="12.5"
                    fontWeight="800"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}

              <g clipPath="url(#progress-plot-clip)">
                {activeLifts.map(liftId => {
                  const series = seriesByLift[liftId] || [];
                  if (series.length === 0) return null;
                  const color = liftMeta[liftId]?.color || '#00E5FF';
                  const coords = series.map(pt => ({
                    x: getXByTime(pt.timestampMs),
                    y: getY(pt.weight),
                    rawVal: pt.weight,
                    dateLabel: pt.dateLabel,
                    workoutId: pt.workoutId,
                    inWindow: pt.timestampMs >= domainMinMs && pt.timestampMs <= domainMaxMs
                  }));
                  const polylinePoints = coords.map(c => `${c.x},${c.y}`).join(' ');
                  const areaPoints =
                    coords.length > 1
                      ? `${coords[0].x},${padT + plotH} ${polylinePoints} ${coords[coords.length - 1].x},${padT + plotH}`
                      : null;
                  const lastInWindow = coords.reduce((last, c, i) => (c.inWindow ? i : last), -1);
                  // Smoothed average (3+ points): bandwidth ~1/8 of the visible span, at least 5 days
                  const bandMs = Math.max(5 * DAY_MS, (domainMaxMs - domainMinMs) / 8);
                  const avgFrom = Math.max(series[0].timestampMs, domainMinMs - 2 * bandMs);
                  const avgTo = Math.min(series[series.length - 1].timestampMs, domainMaxMs + 2 * bandMs);
                  const avgPath = smoothPath(
                    smoothSeries(series, avgFrom, avgTo, bandMs).map(p => ({
                      x: Math.round(getXByTime(p.t) * 10) / 10,
                      y: Math.round(getY(p.v) * 10) / 10
                    }))
                  );

                  return (
                    <g key={liftId}>
                      {singleLift && areaPoints && <polygon points={areaPoints} fill={color} fillOpacity="0.14" />}
                      <polyline fill="none" stroke={color} strokeWidth="2" strokeOpacity="0.6" points={polylinePoints} />
                      {avgPath && (
                        <path
                          d={avgPath}
                          fill="none"
                          stroke={color}
                          strokeWidth="3.5"
                          strokeDasharray="7 4"
                          strokeLinecap="round"
                        />
                      )}
                      {coords.map((c, cIdx) =>
                        c.inWindow ? (
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
                            {(singleLift || cIdx === lastInWindow) && (
                              <text
                                x={c.x}
                                y={c.y - 8}
                                textAnchor={c.x > padL + plotW - 14 ? 'end' : 'middle'}
                                fill={color}
                                fontSize="12.5"
                                fontWeight="800"
                              >
                                {c.rawVal}
                              </text>
                            )}
                            {/* Tap target: opens the workout in History */}
                            {onOpenHistoryWorkout && c.workoutId && (
                              <circle
                                cx={c.x}
                                cy={c.y}
                                r="12"
                                fill="transparent"
                                role="button"
                                tabIndex={0}
                                aria-label={`${liftMeta[liftId]?.short || ''} ${c.rawVal} lb on ${c.dateLabel}: open in History`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => openPoint(c.workoutId)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') openPoint(c.workoutId);
                                }}
                              />
                            )}
                          </g>
                        ) : null
                      )}
                    </g>
                  );
                })}
              </g>
              {activeLifts.every(id => (inWindowByLift[id] || []).length === 0) && (
                <text
                  x={padL + plotW / 2}
                  y={padT + plotH / 2}
                  textAnchor="middle"
                  fill="#A0A0A0"
                  fontSize="14"
                  fontWeight="800"
                >
                  {activeLifts.length === 0 ? 'PICK A LIFT BELOW' : 'NO SESSIONS IN THIS RANGE'}
                </text>
              )}
            </svg>

            {/* Scroll through time: drag the chart, or step half a window with the arrows */}
            {canScroll && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                  alignItems: 'center',
                  marginTop: '8px',
                  border: '1px solid var(--dp-color-rule)'
                }}
              >
                <button
                  type="button"
                  aria-label="Show earlier dates"
                  disabled={clampedOffset >= maxOffsetMs}
                  onClick={() => stepWindow(1)}
                  style={{ ...smallButton, opacity: clampedOffset >= maxOffsetMs ? 0.4 : 1 }}
                >
                  ‹ EARLIER
                </button>
                <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 800, color: '#A0A0A0' }}>
                  {rangeLabel}
                </span>
                <button
                  type="button"
                  aria-label="Show later dates"
                  disabled={clampedOffset <= 0}
                  onClick={() => stepWindow(-1)}
                  style={{ ...smallButton, opacity: clampedOffset <= 0 ? 0.4 : 1 }}
                >
                  LATER ›
                </button>
              </div>
            )}
            {(onOpenHistoryWorkout || activeLifts.some(id => (seriesByLift[id] || []).length >= 3)) && (
              <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 700, color: '#8E8E93', textAlign: 'center' }}>
                Dashed line = smoothed average.
                {onOpenHistoryWorkout ? ' Tap a point to open that workout.' : ''}
                {canScroll ? ' Drag sideways to scroll.' : ''}
              </div>
            )}
          </div>

          {/* LEGEND + VALUES: one row per lift in its line colour. Tap a lift to show only it; tap it again to show
              every lift. */}
          {legendLiftIds.map(liftId => {
            const ex = EXERCISE_MAP[liftId];
            if (!ex) return null;
            const isCustom = liftId === activeCustomId && !CORE_LIFT_IDS.includes(liftId);
            const color = liftMeta[liftId]?.color || CUSTOM_COLOR;
            const shown = selectedLifts.includes(liftId);
            const label = formatProgressExerciseLabel(ex.id, ex.name);
            // START / PR / LATEST over everything logged; TO GO = goal − PR
            const stats = getLiftGoalStats({
              liftId,
              series: seriesByLift[liftId],
              oneRepMaxes,
              targetStandardClass,
              userBodyweightLbs,
              totalHeightInches,
              customGoalWeights
            });

            return (
              <LiftGoalRow
                key={isCustom ? 'custom' : liftId}
                name={isCustom ? `CUSTOM · ${label}` : label}
                color={color}
                stats={stats}
                dimmed={!shown}
                showGoal={showGoalDistance}
                onTitleClick={() => soloLift(liftId)}
                titlePressed={shown}
                titleAriaLabel={`${label}: ${singleLift && shown ? 'show every lift' : 'show only this lift'}`}
                onEditGoal={
                  showGoalDistance && openPlateCalculatorForGoal
                    ? () => openPlateCalculatorForGoal(liftId, ex.name, stats.goal)
                    : undefined
                }
              >
                {/* CUSTOM's exercise, while it is shown: the standard exercise picker */}
                {isCustom && isCustomActive && (
                  <ExercisePicker
                    exerciseId={activeCustomId}
                    types={['Compound', 'Accessory']}
                    excludeIds={CORE_LIFT_IDS}
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
              </LiftGoalRow>
            );
          })}
        </div>

        {/* Shortcut to Configuration → GOALS (training goal, increment, custom goals) */}
        {onOpenGoals && (
          <div style={{ marginTop: '16px' }}>
            <Button variant="primary-row" onClick={onOpenGoals}>
              <span>SET GOALS</span>
              <span>→</span>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
