'use client';

import React, { useEffect, useRef, useState } from 'react';
import { EXERCISE_LIBRARY, EXERCISE_MAP, parseYMDToISO } from '../../data/exerciseLibrary';
import { SHARED_CELL_BORDER, SHARED_GROUP_OUTER, SHARED_PICKER_GROUP } from '../../styles/kineticTokens';
import { Button, SegmentButton } from '../Controls';
import { oneRepMaxLabel } from '../../utils/workoutEngine';
import { ExercisePicker } from '../ExercisePicker';
import {
  CORE_LIFT_IDS,
  CalculatedOneRepMaxKey,
  CORE_LIFT_META,
  CUSTOM_LIFT_COLOR as CUSTOM_COLOR,
  LiftGoalRow,
  SELECTED_STATS_BG,
  StrengthClassGoalPicker,
  formatLiftLabel as formatProgressExerciseLabel,
  getLiftGoalStats
} from '../LiftGoals';

// Big 3 + OHP: each has its own row in the legend and is shown by default
export const DEFAULT_CHART_LIFTS = [...CORE_LIFT_IDS];
const DEFAULT_CUSTOM_EXERCISE_ID = 'incline_bench_press';
// The default view: DISTANCE TO GOAL — how far the tracked lifts (Big 3 + OHP) are below their goals for the selected
// STRENGTH CLASS GOAL, added up, over time. Lower is better; it re-draws when the class changes.
export const GOAL_SERIES_ID = 'goal_distance';

/**
 * Distance to goal over time. Each lift counts goal − its latest estimated 1RM on or before the date (never below 0, so
 * a lift past its goal counts 0). Only lifts with a goal and at least one logged point are included, and the line
 * starts once each of them has a value (so it doesn't jump when a lift is first logged).
 * `liftIds` / `goalsById`: the tracked lifts and their goals. Returns [] when nothing is logged.
 */
const buildGoalDistanceSeries = (seriesByLift, liftIds, goalsById) => {
  const tracked = liftIds.filter(
    id => Number(goalsById[id]) > 0 && (seriesByLift[id] || []).some(pt => Number(pt.weight) > 0)
  );
  if (tracked.length === 0) return [];
  const lists = tracked.map(id => (seriesByLift[id] || []).filter(pt => Number(pt.weight) > 0));
  const dates = Array.from(new Set(lists.flatMap(l => l.map(pt => pt.timestampMs)))).sort((a, b) => a - b);
  const idx = lists.map(() => 0);
  const latest = lists.map(() => null);
  const out = [];
  dates.forEach(t => {
    let loggedToday = null;
    lists.forEach((l, i) => {
      while (idx[i] < l.length && l[idx[i]].timestampMs <= t) {
        latest[i] = l[idx[i]];
        if (l[idx[i]].timestampMs === t) loggedToday = l[idx[i]];
        idx[i] += 1;
      }
    });
    if (latest.some(pt => !pt)) return;
    out.push({
      timestampMs: t,
      dateLabel: loggedToday?.dateLabel || latest[0].dateLabel,
      weight: Math.round(
        latest.reduce((sum, pt, i) => sum + Math.max(0, Number(goalsById[tracked[i]]) - Number(pt.weight)), 0)
      ),
      // A distance isn't a 1RM: no asterisk
      calculated: false,
      workoutId: loggedToday?.workoutId
    });
  });
  return out;
};

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

/** The DISTANCE TO GOAL row under the chart: a title strip (red while selected) over four readouts. */
function GoalDistanceRow({ className, selected, onTitleClick, cells, onOpenWorkout }) {
  const empty = cells.every(c => c.value === null || c.value === undefined);
  return (
    <div>
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`Distance to your ${className} goal: ${selected ? 'selected' : 'show on the chart'}`}
        onClick={onTitleClick}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          minHeight: '44px',
          padding: '0 12px',
          boxSizing: 'border-box',
          backgroundColor: selected ? 'var(--cr-red)' : '#1C1C1C',
          color: '#FFFFFF',
          border: 'none',
          ...SHARED_CELL_BORDER,
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'inherit'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span aria-hidden="true" style={{ width: '14px', height: '2px', flexShrink: 0, backgroundColor: selected ? '#FFFFFF' : CUSTOM_COLOR }} />
          <span style={{ fontSize: '13px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            DISTANCE TO {className} GOAL
          </span>
        </span>
        <span style={{ fontSize: '11px', fontWeight: 500, color: selected ? '#FFFFFF' : '#9A9A9A', whiteSpace: 'nowrap', flexShrink: 0, textTransform: 'uppercase' }}>
          {empty ? 'NOT LOGGED YET' : 'LB'}
        </span>
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 0 }}>
        {cells.map(cell => {
          const opens = Boolean(onOpenWorkout && cell.workoutId && cell.value !== null && cell.value !== undefined);
          const Tag = opens ? 'button' : 'div';
          return (
          <Tag
            key={cell.label}
            {...(opens
              ? {
                  type: 'button',
                  'aria-label': `${cell.label} ${cell.value}: open this workout in History`,
                  onClick: () => onOpenWorkout(cell.workoutId)
                }
              : {})}
            style={{
              border: 'none',
              padding: 0,
              fontFamily: 'inherit',
              cursor: opens ? 'pointer' : 'default',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
              minWidth: 0, height: '48px', boxSizing: 'border-box',
              // Selected: a step brighter, like a selected lift's stats
              backgroundColor: selected ? SELECTED_STATS_BG : '#1C1C1C', ...SHARED_CELL_BORDER
            }}
          >
            <span style={{ fontFamily: 'var(--cr-face-display)', fontSize: '11px', fontWeight: 500, color: '#9A9A9A', letterSpacing: '0.1em' }}>
              {cell.label}
            </span>
            <span
              style={{
                fontFamily: 'var(--cr-face-display)', fontSize: '15px', fontWeight: 500,
                color: cell.value === null || cell.value === undefined ? '#9A9A9A' : '#FFFFFF', whiteSpace: 'nowrap',
                ...(opens ? { textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: '#8A8A8A' } : {})
              }}
            >
              {cell.value === null || cell.value === undefined ? '—' : cell.label === 'LATEST' && cell.value === 0 ? 'DONE ✓' : cell.value}
            </span>
          </Tag>
          );
        })}
      </div>
    </div>
  );
}

export function ProgressionChartView({
  // Lifts drawn on the chart (several at once); the legend rows under the chart pick them
  selectedChartLifts = null,
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
  // The chart block pins under the locked header while the lift rows scroll; the header's height changes (notch
  // inset, session bars), so it is measured and followed
  const [stickyTop, setStickyTop] = useState(0);
  useEffect(() => {
    const header = document.querySelector('.kinetic-app header');
    if (!header || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setStickyTop(header.getBoundingClientRect().height));
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const suppressClickRef = useRef(false);

  // null (nothing chosen yet) = every lift, the CUSTOM exercise included, like the others
  const chosenLifts = Array.isArray(selectedChartLifts) ? selectedChartLifts : null;
  const [customExerciseId, setCustomExerciseId] = useState(() => {
    const picked = (chosenLifts || []).find(id => !CORE_LIFT_IDS.includes(id) && EXERCISE_MAP[id]);
    if (picked) return picked;
    return EXERCISE_MAP[DEFAULT_CUSTOM_EXERCISE_ID] ? DEFAULT_CUSTOM_EXERCISE_ID : EXERCISE_LIBRARY[0].id;
  });

  const activeCustomId = customExerciseId;
  // Legend rows: the Big 3 + OHP, then the CUSTOM exercise
  const legendLiftIds = [...CORE_LIFT_IDS, activeCustomId];
  const selectedLifts = chosenLifts || legendLiftIds;
  const customEx = EXERCISE_MAP[activeCustomId];

  const liftMeta = {
    ...CORE_LIFT_META,
    [GOAL_SERIES_ID]: { short: 'TO GO', color: CUSTOM_COLOR },
    [activeCustomId]: {
      short: formatProgressExerciseLabel(activeCustomId, customEx?.name || 'CUSTOM'),
      color: CUSTOM_COLOR
    }
  };

  // One series is always selected (red, with its row): DISTANCE TO GOAL by default (your own chart), or the lift tapped
  // in the list. Only the selected series is drawn, and the chart is framed on it. A friend's
  // profile shows the distance to THEIR goal (page.js passes their goal settings).
  const hasGoalView = true;
  const defaultSeriesId = hasGoalView ? GOAL_SERIES_ID : legendLiftIds[0];
  const allSeriesIds = hasGoalView ? [GOAL_SERIES_ID, ...legendLiftIds] : [...legendLiftIds];
  const highlightId =
    selectedLifts.length === 1 && allSeriesIds.includes(selectedLifts[0]) && chosenLifts ? selectedLifts[0] : defaultSeriesId;
  // Only the selected series is drawn (no other curves)
  const drawnLifts = [highlightId];

  // Tapping a row selects it; tapping the selected row goes back to the default view (null)
  const soloLift = liftId => setSelectedChartLifts?.(() => (highlightId === liftId ? null : [liftId]));

  // Each lift's points, oldest first, plus the distance-to-goal line built from them and the current goals
  const fullSeriesById = {};
  legendLiftIds.forEach(id => {
    fullSeriesById[id] = (progressionSeriesByLift[id] || [])
      .map(pt => ({ ...pt, timestampMs: getPointTimestampMs(pt) }))
      .filter(pt => pt.timestampMs > 0)
      .sort((a, b) => a.timestampMs - b.timestampMs);
  });
  // Each tracked lift's goal for the selected STRENGTH CLASS GOAL (changing the class re-draws the goal line)
  const goalStatsById = {};
  CORE_LIFT_IDS.forEach(id => {
    goalStatsById[id] = getLiftGoalStats({
      liftId: id,
      series: fullSeriesById[id],
      oneRepMaxes,
      targetStandardClass,
      userBodyweightLbs,
      totalHeightInches,
      customGoalWeights
    });
  });
  const goalsById = Object.fromEntries(CORE_LIFT_IDS.map(id => [id, goalStatsById[id].goal]));
  if (hasGoalView) fullSeriesById[GOAL_SERIES_ID] = buildGoalDistanceSeries(fullSeriesById, CORE_LIFT_IDS, goalsById);

  // Time range: the selected series (framed on it), else every series
  const timestampsOf = ids => ids.flatMap(id => (fullSeriesById[id] || []).map(pt => pt.timestampMs));
  const shownTimestamps = timestampsOf([highlightId]);
  const refTimestamps = shownTimestamps.length > 0 ? shownTimestamps : timestampsOf(allSeriesIds);
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

  // Each series' points; `inWindow` = the points inside the visible window
  const seriesByLift = fullSeriesById;
  const inWindowByLift = {};
  allSeriesIds.forEach(id => {
    inWindowByLift[id] = (seriesByLift[id] || []).filter(pt => pt.timestampMs >= domainMinMs && pt.timestampMs <= domainMaxMs);
  });

  // Value axis framed on the selected series (in the window), else on everything shown
  const framedVals = (inWindowByLift[highlightId] || []).map(pt => pt.weight);
  const allVals = framedVals.length > 0 ? framedVals : drawnLifts.flatMap(id => (inWindowByLift[id] || []).map(pt => pt.weight));
  const rawMin = allVals.length ? Math.min(...allVals) : 0;
  const rawMax = allVals.length ? Math.max(...allVals) : 300;
  const pad = Math.max(10, Math.round((rawMax - rawMin) * 0.15));
  const tickStep = (() => {
    const span = Math.max(1, rawMax + pad - Math.max(0, rawMin - pad));
    return [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(step => span / step <= 5) || 1000;
  })();
  const minVal = Math.max(0, Math.floor((rawMin - pad) / tickStep) * tickStep);
  const maxVal = Math.ceil((rawMax + pad) / tickStep) * tickStep;

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
  const yTicks = [];
  for (let v = minVal; v <= maxVal + 0.001; v += tickStep) yTicks.push(v);

  // Every series' points on the chart; grey lines first, the selected (red) one last so it draws on top
  const drawOrder = [...drawnLifts.filter(id => id !== highlightId), highlightId];
  const coordsById = {};
  drawOrder.forEach(liftId => {
    coordsById[liftId] = (seriesByLift[liftId] || []).map((pt, cIdx) => ({
      key: `${liftId}_${cIdx}`,
      x: getXByTime(pt.timestampMs),
      y: getY(pt.weight),
      timestampMs: pt.timestampMs,
      // * = calculated from reps (not lifted for 1 rep)
      label: oneRepMaxLabel(pt.weight, pt.calculated),
      dateLabel: pt.dateLabel,
      workoutId: pt.workoutId,
      inWindow: pt.timestampMs >= domainMinMs && pt.timestampMs <= domainMaxMs
    }));
  });

  // Value labels: every point of the selected series, and the end (lift + value) of each grey line that is inside the
  // frame. Labels whose boxes would overlap aren't all drawn: the latest point's label wins (then the selected one).
  const LABEL_CHAR_W = 6.9;
  const LABEL_H = 13;
  const labelCandidates = [];
  drawOrder.forEach(liftId => {
    const coords = coordsById[liftId];
    const lastInWindow = coords.reduce((last, c, i) => (c.inWindow ? i : last), -1);
    const isHighlighted = liftId === highlightId;
    coords.forEach((c, cIdx) => {
      if (!c.inWindow || c.y < padT - 2 || c.y > padT + plotH + 2) return;
      const isEnd = cIdx === lastInWindow;
      if (!isHighlighted && !isEnd) return;
      const text = isEnd ? `${liftMeta[liftId]?.short || ''} ${c.label}`.trim() : c.label;
      const anchor = c.x > padL + plotW - 40 ? 'end' : 'middle';
      const w = text.length * LABEL_CHAR_W;
      const left = anchor === 'end' ? c.x - w : c.x - w / 2;
      labelCandidates.push({
        key: c.key,
        text,
        anchor,
        isHighlighted,
        timestampMs: c.timestampMs,
        box: { left, right: left + w, top: c.y - 8 - LABEL_H + 3, bottom: c.y - 8 + 3 }
      });
    });
  });
  const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const shownLabels = new Map();
  [...labelCandidates]
    .sort((a, b) => b.timestampMs - a.timestampMs || Number(b.isHighlighted) - Number(a.isHighlighted))
    .forEach(cand => {
      if ([...shownLabels.values()].some(kept => overlaps(kept.box, cand.box))) return;
      shownLabels.set(cand.key, cand);
    });

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
    backgroundColor: '#1C1C1C',
    color: '#FFFFFF',
    border: 'none',
    fontSize: '11px',
    fontWeight: 500,
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
        {/* One tile for the chart and the lift rows; it doesn't clip (the CUSTOM row's exercise search can open) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            backgroundColor: '#1C1C1C',
            ...SHARED_PICKER_GROUP
          }}
        >
          {/* The chart block (time frame, chart, EARLIER / LATER) sits in the page, and pins under the header once the
              page scrolls past it, so the lift rows scroll underneath with the chart still in view; it lets go at the
              end of the list (sticky inside this tile) */}
          <div
            style={{
              position: 'sticky',
              top: `${stickyTop}px`,
              zIndex: 5,
              // Black behind the rounded top corners: when pinned, rows scrolling underneath don't show through them
              backgroundColor: '#000000'
            }}
          >
          {/* TIME FRAME: 30 DAYS | 90 DAYS | 1 YEAR | ALL — the chart's zoom */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 0,
              borderRadius: '14px 14px 0 0',
              overflow: 'hidden'
            }}
          >
            {TIME_FRAME_OPTIONS.map(tf => (
              <SegmentButton
                active={timeFrame === tf.id}
                inactiveColor="#9A9A9A"
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
              backgroundColor: '#1C1C1C',
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
                backgroundColor: '#000000',
                border: 'none', borderRadius: '10px',
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
                      stroke="#2E2E2E"
                      strokeWidth="1"
                    />
                    <text x={padL - 6} y={y + 3} textAnchor="end" fill="#9A9A9A" fontSize="12.5" fontWeight="400">
                      {tickVal}
                    </text>
                  </g>
                );
              })}

              {xDateTicks.map(tick => (
                <g key={tick.key}>
                  <line x1={tick.x} y1={padT} x2={tick.x} y2={padT + plotH} stroke="#2E2E2E" strokeWidth="1" />
                  <text
                    x={tick.x}
                    y={svgH - 9}
                    textAnchor={tick.anchor}
                    fill="#9A9A9A"
                    fontSize="12.5"
                    fontWeight="400"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}

              <g clipPath="url(#progress-plot-clip)">
                {/* Grey lines first, the selected (red) one on top */}
                {drawOrder.map(liftId => {
                  const series = seriesByLift[liftId] || [];
                  if (series.length === 0) return null;
                  const isHighlighted = liftId === highlightId;
                  const color = isHighlighted ? '#E20612' : '#8A8A8A';
                  const coords = coordsById[liftId];
                  const polylinePoints = coords.map(c => `${c.x},${c.y}`).join(' ');
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
                      <polyline
                        fill="none"
                        stroke={color}
                        strokeWidth={isHighlighted ? 2.5 : 1.5}
                        strokeOpacity={isHighlighted ? 0.75 : 0.55}
                        points={polylinePoints}
                      />
                      {avgPath && (
                        <path
                          d={avgPath}
                          fill="none"
                          stroke={color}
                          strokeWidth={isHighlighted ? 3 : 1.5}
                          strokeDasharray="7 4"
                          strokeLinecap="square"
                        />
                      )}
                      {coords.map(c => {
                        // Only points inside the frame get a marker (the lines still run off the edges)
                        if (!c.inWindow || c.y < padT - 4 || c.y > padT + plotH + 4) return null;
                        const lbl = shownLabels.get(c.key);
                        return (
                          <g key={c.key}>
                            <rect
                              x={c.x - 4}
                              y={c.y - 4}
                              width="8"
                              height="8"
                              fill="#000000"
                              stroke={color}
                              strokeWidth={isHighlighted ? 2.2 : 1.5}
                            />
                            {/* Value label, unless it would overlap a later point's label */}
                            {lbl && (
                              <text
                                x={c.x}
                                y={c.y - 8}
                                textAnchor={lbl.anchor}
                                fill={isHighlighted ? '#FFFFFF' : '#9A9A9A'}
                                fontSize="12.5"
                                fontWeight={isHighlighted ? 500 : 400}
                              >
                                {lbl.text}
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
                                aria-label={`${liftMeta[liftId]?.short || ''} ${c.label} lb on ${c.dateLabel}: open in History`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => openPoint(c.workoutId)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') openPoint(c.workoutId);
                                }}
                              />
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </g>
              {drawnLifts.every(id => (inWindowByLift[id] || []).length === 0) && (
                <text
                  x={padL + plotW / 2}
                  y={padT + plotH / 2}
                  textAnchor="middle"
                  fill="#9A9A9A"
                  fontSize="14"
                  fontWeight="400"
                >
                  {(seriesByLift[highlightId] || []).length === 0 && highlightId === GOAL_SERIES_ID
                    ? 'LOG A LIFT TO SEE YOUR DISTANCE TO GOAL'
                    : 'NO SESSIONS IN THIS RANGE'}
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
                  border: 'none', borderRadius: '10px'
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
                <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 500, color: '#9A9A9A' }}>
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
          </div>
          </div>

          {/* DISTANCE TO GOAL: the default view. START = how far below the goals you were when the line starts, LATEST =
              how far now, CLOSED = start − latest, REACHED = lifts at or past their goal */}
          {hasGoalView && (() => {
            const dist = seriesByLift[GOAL_SERIES_ID] || [];
            const tracked = CORE_LIFT_IDS.filter(id => goalStatsById[id]?.logged && Number(goalsById[id]) > 0);
            const reached = tracked.filter(id => goalStatsById[id].pr >= goalsById[id]).length;
            const start = dist.length ? dist[0].weight : null;
            const latest = dist.length ? dist[dist.length - 1].weight : null;
            const startWorkoutId = dist[0]?.workoutId || null;
            const latestWorkoutId = dist[dist.length - 1]?.workoutId || null;
            const isHighlighted = highlightId === GOAL_SERIES_ID;
            const classLabel = String(targetStandardClass || 'Intermediate').toUpperCase();
            return (
              <GoalDistanceRow
                className={classLabel}
                selected={isHighlighted}
                onTitleClick={() => soloLift(GOAL_SERIES_ID)}
                onOpenWorkout={onOpenHistoryWorkout}
                cells={[
                  { label: 'START', value: start, workoutId: startWorkoutId },
                  { label: 'LATEST', value: latest, unit: latest === 0 ? null : 'LB', workoutId: latestWorkoutId },
                  { label: 'CLOSED', value: start !== null && latest !== null ? Math.max(0, start - latest) : null },
                  { label: 'REACHED', value: tracked.length ? `${reached}/${tracked.length}` : null }
                ]}
              />
            );
          })()}

          {/* LEGEND + VALUES: one row per lift. Tap a row to select it (red line, chart framed on it); tap the selected
              row to go back to the default view (DISTANCE TO GOAL). */}
          {legendLiftIds.map(liftId => {
            const ex = EXERCISE_MAP[liftId];
            if (!ex) return null;
            const isCustom = liftId === activeCustomId && !CORE_LIFT_IDS.includes(liftId);
            const color = liftMeta[liftId]?.color || CUSTOM_COLOR;
            const isHighlighted = liftId === highlightId;
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
                selected={isHighlighted}
                showGoal={showGoalDistance}
                onTitleClick={() => soloLift(liftId)}
                titlePressed={isHighlighted}
                titleAriaLabel={`${label}: ${isHighlighted ? 'selected; tap to go back to the default view' : 'show on the chart'}`}
                onOpenWorkout={onOpenHistoryWorkout}
                onEditGoal={
                  showGoalDistance && openPlateCalculatorForGoal
                    ? () => openPlateCalculatorForGoal(liftId, ex.name, stats.goal)
                    : undefined
                }
              >
                {/* CUSTOM's exercise, while it is shown: the standard exercise picker */}
                {isCustom && (
                  <ExercisePicker
                    exerciseId={activeCustomId}
                    types={['Compound', 'Accessory']}
                    excludeIds={CORE_LIFT_IDS}
                    onChange={nextId => {
                      const prevId = activeCustomId;
                      setCustomExerciseId(nextId);
                      // CUSTOM was selected: keep it selected under its new exercise
                      setSelectedChartLifts?.(prev => (Array.isArray(prev) && prev.includes(prevId) ? [nextId] : prev));
                    }}
                  />
                )}
              </LiftGoalRow>
            );
          })}
        </div>

        {/* The asterisk's key, only when a number above has one */}
        {legendLiftIds.some(id => (seriesByLift[id] || []).some(pt => pt?.calculated)) && (
          <CalculatedOneRepMaxKey style={{ marginTop: '8px' }} />
        )}

        {/* Shortcut to Configuration → GOALS (training goal, increment, custom goals) */}
        {onOpenGoals && (
          <div style={{ marginTop: '16px' }}>
            <Button variant="secondary" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={onOpenGoals}>
              <span>SET GOALS</span>
              <span>→</span>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
