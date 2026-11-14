'use client';

import React, { useState } from 'react';
import { SHARED_CELL_BORDER, SHARED_GROUP_OUTER, SHARED_PICKER_GROUP, UI } from '../../styles/kineticTokens';
import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  normalizeSlotCategory,
  getDefaultSessionName,
  stripDateFromTitle,
  formatDateYMD,
  parseYMDToISO,
  stripEquipmentFromExerciseName
} from '../../data/exerciseLibrary';
import {
  getBestHistory1RMInfo,
  normalizeSlotLabels
} from '../../utils/workoutEngine';
import { CloseButton, DeleteButton } from '../Controls';
import { getWorkoutSyncInfo } from '../../utils/syncedHistory';
import {
  HistoryExerciseFilter,
  EMPTY_HISTORY_FILTER,
  isHistoryFilterActive,
  workoutMatchesHistoryFilter,
  getWorkoutSetsForExercise,
  getWorkoutExerciseIds
} from '../HistoryExerciseFilter';


// DATE filter row under the exercise filters: a preset (ANY TIME / LAST 7 DAYS / LAST 30 DAYS / LAST 90 DAYS /
// THIS YEAR / CUSTOM) and FROM | TO boxes (YYYY/MM/DD, applied when the box loses focus or on Enter; a box left empty
// is open-ended). "Today" is read when a preset is picked, never during render.
const DATE_PRESETS = [
  { id: 'any', label: 'ANY TIME' },
  { id: 'week', label: 'LAST 7 DAYS', days: 7 },
  { id: 'month', label: 'LAST 30 DAYS', days: 30 },
  { id: 'quarter', label: 'LAST 90 DAYS', days: 90 },
  { id: 'year', label: 'THIS YEAR' },
  { id: 'custom', label: 'CUSTOM' }
];
const ymdOf = d => formatDateYMD(d);
/** { from, to, preset } for a preset id, counted back from today (local). */
export const historyDateRangeFor = presetId => {
  const preset = DATE_PRESETS.find(p => p.id === presetId);
  if (!preset || preset.id === 'any') return null;
  const today = new Date();
  if (preset.id === 'year') return { from: `${today.getFullYear()}/01/01`, to: ymdOf(today), preset: 'year' };
  if (preset.days) {
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (preset.days - 1));
    return { from: ymdOf(from), to: ymdOf(today), preset: preset.id };
  }
  return { from: '', to: '', preset: 'custom' };
};
const validYMD = text => {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(String(text || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? ymdOf(d) : null;
};
function HistoryDateFilter({ range, onChange }) {
  const presetId = range ? range.preset || 'custom' : 'any';
  const box = (key, label) => (
    <input
      key={`${key}_${range?.[key] || ''}`}
      type="text"
      inputMode="numeric"
      aria-label={`${label} date (YYYY/MM/DD)`}
      placeholder={label}
      defaultValue={range?.[key] || ''}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onBlur={e => {
        const text = e.target.value.trim();
        if (!text) {
          const next = { from: range?.from || '', to: range?.to || '', preset: 'custom', [key]: '' };
          onChange(next.from || next.to ? next : null);
          return;
        }
        const ymd = validYMD(text);
        if (!ymd) {
          e.target.value = range?.[key] || '';
          return;
        }
        onChange({ from: range?.from || '', to: range?.to || '', preset: 'custom', [key]: ymd });
      }}
      style={{
        ...SHARED_CELL_BORDER,
        minWidth: 0,
        height: '44px',
        boxSizing: 'border-box',
        padding: '0 8px',
        backgroundColor: '#2A2A2A',
        color: '#FFFFFF',
        border: 'none',
        fontFamily: 'inherit',
        fontSize: '13px',
        textAlign: 'center',
        outline: 'none'
      }}
    />
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 0 }}>
      <select
        className="kinetic-filter-select"
        aria-label="Filter by date"
        value={presetId}
        onChange={e => onChange(historyDateRangeFor(e.target.value))}
        style={{ ...SHARED_CELL_BORDER, height: '44px', minWidth: 0, fontSize: '12px', fontWeight: 500 }}
      >
        {DATE_PRESETS.map(p => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {box('from', 'FROM')}
      {box('to', 'TO')}
    </div>
  );
}

export function HistoryView({
  // PROGRESS page tab this renders: 'history' (logged sessions; the Personal Records tab was removed)
  section = 'history',
  // A friend's profile: their records and sessions, view only (no adding, editing, importing or deleting)
  readOnly = false,
  colors,
  history,
  setHistory,
  currentIncrementLbs = 0,
  // Opens a workout as a full editor page (onOpenWorkout(id), page.js openHistoryWorkout)
  onOpenWorkout,
  oneRepMaxes,
  selectedGymId = '',
  gyms = [],
  userBodyweightLbs,
  setHistoricalDraft,
  setCurrentView,
  openPlateCalculatorForSet,
  setSetValueTarget,
  setDeleteConfirmTarget,
  // A friend's profile: tapping a row opens that workout as a locked preview page (onLoadWorkout(workout)), whose
  // START loads it as your session at your weights
  onLoadWorkout = null,
  // Date range filter ({ from, to, preset } with YYYY/MM/DD, or null). Your own History passes it from page.js (so
  // Home's THIS WEEK can open it filtered); a friend's keeps its own
  dateRange: dateRangeProp,
  setDateRange: setDateRangeProp
}) {
  const [localDateRange, setLocalDateRange] = useState(null);
  const dateRange = setDateRangeProp ? dateRangeProp || null : localDateRange;
  const setDateRange = setDateRangeProp || setLocalDateRange;
  const [showAllHistory, setShowAllHistory] = useState(false);
  // HISTORY tab search & filters (type / muscle / equipment / exercise)
  const [historyFilter, setHistoryFilter] = useState(EMPTY_HISTORY_FILTER);
  const [historyPage, setHistoryPage] = useState(0);

  // --- CSV Import Modal State ---
  const [showImportCsvModal, setShowImportCsvModal] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importCsvFileName, setImportCsvFileName] = useState('');
  const [importCsvStatus, setImportCsvStatus] = useState('');

  const resolveCsvExercise = rawName => {
    const raw = String(rawName || '').trim();
    if (!raw) return EXERCISE_MAP.barbell_bench_press || EXERCISE_LIBRARY[0];
    if (EXERCISE_MAP[raw]) return EXERCISE_MAP[raw];

    const norm = raw
      .toLowerCase()
      .replace(/dumbell/g, 'dumbbell')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const ALIAS_MAP = {
      'barbell squats': 'barbell_back_squat',
      'barbell squat': 'barbell_back_squat',
      'back squat': 'barbell_back_squat',
      'squat': 'barbell_back_squat',
      'squats': 'barbell_back_squat',
      'barbell bench': 'barbell_bench_press',
      'barbell bench press': 'barbell_bench_press',
      'bench press': 'barbell_bench_press',
      'bench': 'barbell_bench_press',
      'barbell ohp': 'overhead_press',
      'ohp': 'overhead_press',
      'overhead press': 'overhead_press',
      'military press': 'overhead_press',
      'barbell military press': 'overhead_press',
      'barbell deadlifts': 'barbell_deadlift',
      'barbell deadlift': 'barbell_deadlift',
      'deadlift': 'barbell_deadlift',
      'deadlifts': 'barbell_deadlift',
      'barbell incline bench': 'incline_bench_press',
      'incline bench': 'incline_bench_press',
      'incline bench press': 'incline_bench_press',
      'chin ups': 'chin_ups',
      'chin up': 'chin_ups',
      'chinups': 'chin_ups',
      'chinup': 'chin_ups',
      'pull ups': 'chin_ups',
      'pull up': 'chin_ups',
      'dumbbell skull crushers': 'dumbbell_lying_tricep_extension',
      'dumbbell skull crusher': 'dumbbell_lying_tricep_extension',
      'barbell skull crusher': 'tricep_skullcrusher',
      'barbell skull crushers': 'tricep_skullcrusher',
      'skull crusher': 'tricep_skullcrusher',
      'skull crushers': 'tricep_skullcrusher',
      'barbell curls': 'barbell_bicep_curl',
      'barbell curl': 'barbell_bicep_curl',
      'dumbbell curls': 'dumbbell_bicep_curl',
      'dumbbell curl': 'dumbbell_bicep_curl',
      'barbell sumo': 'barbell_sumo_deadlift',
      'sumo deadlift': 'barbell_sumo_deadlift',
      'barbell sumo deadlift': 'barbell_sumo_deadlift',
      'dumbbell flies': 'front_flies',
      'dumbbell fly': 'front_flies',
      'dumbbell chest flies': 'front_flies',
      'dumbbell chest flies 1 0 5': 'front_flies',
      'pushups': 'push_up',
      'pushup': 'push_up',
      'push ups': 'push_up',
      'push up': 'push_up',
      'barbell front squat': 'front_squat',
      'barbell front squats': 'front_squat',
      'front squat': 'front_squat',
      'front squats': 'front_squat',
      'barbell split squats': 'barbell_split_squat',
      'barbell split squat': 'barbell_split_squat',
      'split squat': 'barbell_split_squat',
      'split squats': 'barbell_split_squat',
      'barbell push press': 'push_press',
      'push press': 'push_press',
      'barbell bent over rows': 'barbell_row',
      'barbell bent over row': 'barbell_row',
      'bent over rows': 'barbell_row',
      'bent over row': 'barbell_row',
      'barbell rows': 'barbell_row',
      'barbell row': 'barbell_row'
    };

    if (ALIAS_MAP[norm] && EXERCISE_MAP[ALIAS_MAP[norm]]) {
      return EXERCISE_MAP[ALIAS_MAP[norm]];
    }

    // Another name the exercise goes by (EXERCISE_NAME_ALIASES: "RDL", "Situps", "Dips")
    const toNorm = text =>
      String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const byAlias = EXERCISE_LIBRARY.find(ex => (ex.aliases || []).some(alias => toNorm(alias) === norm));
    if (byAlias) return byAlias;

    // Check if norm starts with any alias (e.g. "dumbbell chest flies 1+0.5")
    for (const [aliasKey, exId] of Object.entries(ALIAS_MAP)) {
      if (norm.startsWith(aliasKey) && EXERCISE_MAP[exId]) {
        return EXERCISE_MAP[exId];
      }
    }

    // Exact normalized name match in EXERCISE_LIBRARY
    const exactLib = EXERCISE_LIBRARY.find(
      ex =>
        ex.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .trim() === norm
    );
    if (exactLib) return exactLib;

    // Singularized token scoring match across EXERCISE_LIBRARY
    const tokens = norm
      .split(' ')
      .map(t => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t))
      .filter(Boolean);

    let bestEx = null;
    let bestScore = 0;
    for (const ex of EXERCISE_LIBRARY) {
      const exNorm = ex.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      let score = 0;
      for (const tok of tokens) {
        if (exNorm.includes(tok)) score += 2;
      }
      if (score > bestScore) {
        bestScore = score;
        bestEx = ex;
      }
    }

    return bestEx || EXERCISE_MAP.barbell_bench_press || EXERCISE_LIBRARY[0];
  };

  const handleDownloadCsvTemplate = () => {
    const templateRows = [
      'Date,Exercise,Set,Weight,Reps',
      '9/23/2026,Barbell Squats,1,185,8',
      '9/23/2026,Barbell Squats,2,185,5',
      '9/23/2026,Barbell Squats,3,205,3',
      '9/23/2026,Barbell Squats,4,255,2',
      '9/23/2026,Barbell Squats,5,275,2',
      '9/23/2026,Barbell Bench,1,155,8',
      '9/23/2026,Barbell Bench,2,185,5',
      '9/23/2026,Barbell Bench,3,225,3',
      '9/23/2026,Barbell Bench,4,235,2',
      '9/23/2026,Barbell Bench,5,240,2'
    ].join('\n');

    const blob = new Blob([templateRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'workout_history_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCsvFileSelect = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportCsvFileName(file.name);
    setImportCsvStatus('');
    const reader = new FileReader();
    reader.onload = ev => {
      const content = String(ev.target?.result || '');
      setImportCsvText(content);
    };
    reader.readAsText(file);
  };

  const handleConfirmImportCsv = () => {
    const raw = String(importCsvText || '').trim();
    if (!raw) {
      setImportCsvStatus('Upload or paste a .csv file first.');
      return;
    }

    const lines = raw
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setImportCsvStatus('No valid rows found in the CSV.');
      return;
    }

    // Group rows by normalized Date (YYYY/MM/DD) -> ordered exercises -> sets
    const sessionsByDate = new Map();
    const bestImported1RMs = {};
    let importedSetsCount = 0;

    // One CSV line → its fields (quoted fields may hold commas, "" is a quote)
    const splitCsvLine = line => {
      const out = [];
      let cur = '';
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
          if (ch === '"' && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (ch === '"') quoted = false;
          else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') {
          out.push(cur.trim());
          cur = '';
        } else cur += ch;
      }
      out.push(cur.trim());
      return out;
    };

    // Fitbod's export (Date, Exercise, Reps, Weight(kg), Duration(s), Distance(m), Incline, Resistance, isWarmup,
    // Note, multiplier): read by its header; kg become lb, isWarmup sets are warm-ups, timed sets keep their time
    const header = splitCsvLine(lines[0]).map(h => h.toLowerCase());
    const isFitbod = header.some(h => h.startsWith('weight(kg)') || h === 'iswarmup');
    const col = name => header.findIndex(h => h === name || h.startsWith(`${name}(`));
    const fitbod = isFitbod
      ? { date: col('date'), exercise: col('exercise'), reps: col('reps'), weight: col('weight'), duration: col('duration'), warmup: col('iswarmup') }
      : null;
    const KG_TO_LB = 2.20462;

    lines.forEach((line, idx) => {
      const cols = splitCsvLine(line);
      let rawDate;
      let rawExName;
      let weightVal;
      let repsVal;
      let isWarmup = false;
      let durationSec = 0;
      if (fitbod) {
        if (idx === 0) return;
        // "2023-01-15 08:30:00 +0000" → its date
        rawDate = String(cols[fitbod.date] || '').slice(0, 10);
        rawExName = cols[fitbod.exercise];
        const kg = Number(cols[fitbod.weight]) || 0;
        // Nearest quarter pound (Fitbod stores lb workouts converted to kg)
        weightVal = Math.round(kg * KG_TO_LB * 4) / 4;
        repsVal = Number(cols[fitbod.reps]) || 0;
        durationSec = fitbod.duration >= 0 ? Number(cols[fitbod.duration]) || 0 : 0;
        isWarmup = fitbod.warmup >= 0 && /^true$/i.test(String(cols[fitbod.warmup] || ''));
        // A timed set (plank): one "rep" of its duration
        if (repsVal <= 0 && durationSec > 0) repsVal = 1;
      } else {
        if (cols.length < 4) return;
        // Skip header row
        if (idx === 0 && (cols[0].toLowerCase() === 'date' || cols[1]?.toLowerCase() === 'exercise')) return;
        rawDate = cols[0];
        rawExName = cols[1];
        // Support both 5-column (Date,Exercise,Set,Weight,Reps) and 4-column (Date,Exercise,Weight,Reps)
        const hasSetCol = cols.length >= 5;
        weightVal = Number(hasSetCol ? cols[3] : cols[2]);
        repsVal = Number(hasSetCol ? cols[4] : cols[3]);
      }

      if (!rawDate || !rawExName || !Number.isFinite(weightVal) || !Number.isFinite(repsVal) || repsVal <= 0) {
        return;
      }

      const ymd = formatDateYMD(rawDate);
      const exObj = resolveCsvExercise(rawExName);
      if (!exObj) return;

      if (!sessionsByDate.has(ymd)) {
        sessionsByDate.set(ymd, new Map());
      }
      const exMapForDate = sessionsByDate.get(ymd);
      if (!exMapForDate.has(exObj.id)) {
        exMapForDate.set(exObj.id, {
          exercise: exObj,
          sets: []
        });
      }

      const group = exMapForDate.get(exObj.id);
      const setNumber = group.sets.length + 1;
      group.sets.push({
        id: `csv_set_${ymd.replace(/\//g, '')}_${exObj.id}_${setNumber}_${Math.random().toString(36).slice(2, 6)}`,
        setNumber,
        setType: isWarmup ? 'Warmup' : 'Working',
        type: isWarmup ? 'Warmup' : 'Working',
        reps: Math.max(1, Math.round(repsVal)),
        weight: Math.max(0, weightVal),
        ...(durationSec > 0 ? { durationSeconds: Math.round(durationSec) } : {}),
        completed: true,
        rpe: 8
      });

      const est1RM =
        durationSec > 0 ? 0 : repsVal === 1 ? Math.round(weightVal) : Math.round(weightVal * (1 + repsVal / 30));
      if (est1RM > (bestImported1RMs[exObj.id] || 0)) {
        bestImported1RMs[exObj.id] = est1RM;
      }
      importedSetsCount += 1;
    });

    if (importedSetsCount === 0 || sessionsByDate.size === 0) {
      setImportCsvStatus('No valid rows found. Each row needs a date, exercise, set, weight and reps.');
      return;
    }

    const nowStamp = Date.now();
    const newSessions = [];
    let sessionIdx = 0;

    for (const [ymd, exMapForDate] of sessionsByDate.entries()) {
      sessionIdx += 1;
      const rawSlots = [];
      let slotIdx = 0;
      for (const { exercise, sets } of exMapForDate.values()) {
        slotIdx += 1;
        rawSlots.push({
          id: `csv_slot_${nowStamp}_${sessionIdx}_${slotIdx}`,
          category: normalizeSlotCategory(exercise.category || 'Compound'),
          muscleGroupFilter: exercise.muscleGroup || 'All Muscles',
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          scheme: '5x5',
          restSeconds: 90,
          sets
        });
      }

      newSessions.push({
        id: `hist_csv_${ymd.replace(/\//g, '')}_${nowStamp}_${sessionIdx}`,
        title: getDefaultSessionName(),
        presetUsed: 'CSV IMPORT',
        gymId: selectedGymId || '',
        workoutDate: ymd,
        startedAt: parseYMDToISO(ymd),
        defaultRestSeconds: 90,
        isComplete: true,
        verifiedByUser: true,
        slots: normalizeSlotLabels(rawSlots)
      });
    }

    if (typeof setHistory === 'function') {
      setHistory(prev => {
        const merged = [...newSessions, ...(Array.isArray(prev) ? prev : [])];
        return merged.sort((a, b) =>
          String(b?.startedAt || '').localeCompare(String(a?.startedAt || ''))
        );
      });
    }

    // The imported workouts are the record (PRs come only from logged History); no separate saved 1RM numbers

    setShowImportCsvModal(false);
    setImportCsvText('');
    setImportCsvFileName('');
    setImportCsvStatus('');
  };

  const PAGE_SIZE = 100;
  const INITIAL_LIMIT = 10;
  // A workout's local date as YYYY/MM/DD (startedAt, else its typed date), for the date range
  const workoutYMD = w => {
    const t = typeof w?.startedAt === 'number' ? w.startedAt : Date.parse(w?.startedAt || '');
    return Number.isFinite(t) && t > 0 ? formatDateYMD(new Date(t)) : formatDateYMD(w?.workoutDate || '');
  };
  const inDateRange = w => {
    if (!dateRange) return true;
    const ymd = workoutYMD(w);
    return (!dateRange.from || ymd >= dateRange.from) && (!dateRange.to || ymd <= dateRange.to);
  };
  const filterActive = isHistoryFilterActive(historyFilter) || Boolean(dateRange);
  const filteredHistory = filterActive
    ? (history || []).filter(w => workoutMatchesHistoryFilter(w, historyFilter) && inDateRange(w))
    : history || [];
  const allSessionsCount = (history || []).length;
  // Most recent matching session (History is newest first, but don't rely on it)
  const lastMatchStartedAt = filteredHistory.reduce((latest, w) => {
    const t = Date.parse(w?.startedAt || '') || 0;
    return t > (Date.parse(latest || '') || 0) ? w.startedAt : latest;
  }, null);
  // View-only rows list the exercises, e.g. "BENCH PRESS · SQUAT"
  const getWorkoutExerciseNames = workout =>
    getWorkoutExerciseIds(workout)
      .map(id => EXERCISE_MAP[id]?.name)
      .filter(Boolean)
      .map(name => stripEquipmentFromExerciseName(name))
      .join(' · ');
  // With one exercise picked, each row also shows what was done for it, e.g. "3 SETS • TOP 225 LB × 5"
  const describeExerciseInWorkout = workout => {
    if (!historyFilter.exerciseId) return '';
    const sets = getWorkoutSetsForExercise(workout, historyFilter.exerciseId);
    if (sets.length === 0) return '';
    const top = sets.reduce((best, st) => {
      const w = Number(st?.weight) || 0;
      const r = Number(st?.reps) || 0;
      if (!best || w > best.w || (w === best.w && r > best.r)) return { w, r };
      return best;
    }, null);
    const topText = top && top.w > 0 ? ` • TOP ${top.w} LB × ${top.r}` : top && top.r > 0 ? ` • TOP ${top.r} REPS` : '';
    return `${sets.length} SET${sets.length === 1 ? '' : 'S'}${topText}`;
  };
  const totalSessions = filteredHistory.length;
  const totalPages = Math.max(1, Math.ceil(totalSessions / PAGE_SIZE));


  const visibleHistory = showAllHistory
    ? filteredHistory.slice(historyPage * PAGE_SIZE, (historyPage + 1) * PAGE_SIZE)
    : filteredHistory.slice(0, INITIAL_LIMIT);

  // Track which History workout IDs store the all-time highest 1RM / calculated 1RM for any exercise
  const prWorkoutIds = (() => {
    const ids = new Set();
    const exerciseIdsInHistory = new Set(EXERCISE_LIBRARY.map(e => e.id));
    (history || []).forEach(w => {
      (w?.slots || []).forEach(slot => {
        if (slot?.exerciseId) exerciseIdsInHistory.add(slot.exerciseId);
        if (slot?.secondaryExerciseId) exerciseIdsInHistory.add(slot.secondaryExerciseId);
        if (Array.isArray(slot?.supersetExerciseIds)) {
          slot.supersetExerciseIds.forEach(id => {
            if (id) exerciseIdsInHistory.add(id);
          });
        }
      });
    });
    exerciseIdsInHistory.forEach(exId => {
      const info = getBestHistory1RMInfo(exId, history);
      if (info.best > 0 && info.workoutId) {
        ids.add(info.workoutId);
      }
    });
    return ids;
  })();

  const stdActionBtnStyle = {
    width: '96px',
    height: '44px',
    boxSizing: 'border-box',
    padding: '0 6px',
    fontSize: '12px',
    fontWeight: 500,
    textTransform: 'uppercase',
    ...SHARED_CELL_BORDER,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0
  };

  return (
    <div style={{ paddingTop: '16px', paddingBottom: '36px' }}>
      {/* =================================================================== */}
      {/* HISTORY TAB: SEARCH & FILTERS, THEN LOGGED SESSIONS */}
      {/* =================================================================== */}
      {section === 'history' && (
      <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
        {allSessionsCount > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={SHARED_PICKER_GROUP}>
              <HistoryExerciseFilter
                history={history}
                filter={historyFilter}
                onChange={next => {
                  setHistoryFilter(next);
                  setShowAllHistory(false);
                  setHistoryPage(0);
                }}
              />
              <HistoryDateFilter
                range={dateRange}
                onChange={next => {
                  setDateRange(next);
                  setShowAllHistory(false);
                  setHistoryPage(0);
                }}
              />
            </div>
            {filterActive && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '8px'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase', minWidth: 0 }}>
                  {totalSessions === 0
                    ? 'NO SESSIONS MATCH'
                    : historyFilter.exerciseId
                      ? <>LAST DONE: <span style={{ color: '#FFFFFF' }}>{formatDateYMD(lastMatchStartedAt)}</span> • {totalSessions} OF {allSessionsCount} SESSIONS</>
                      : `${totalSessions} OF ${allSessionsCount} SESSIONS`}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryFilter(EMPTY_HISTORY_FILTER);
                    setDateRange(null);
                    setShowAllHistory(false);
                    setHistoryPage(0);
                  }}
                  className="kinetic-btn"
                  style={{
                    height: '40px',
                    padding: '0 14px',
                    backgroundColor: '#1C1C1C',
                    color: '#FFFFFF',
                    border: 'none', borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  CLEAR
                </button>
              </div>
            )}
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
          {/* + LOG PAST WORKOUT & IMPORT BUTTONS (SPLIT INTO 2 COLUMNS) */}
          {!readOnly && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0,
              width: '100%'
            }}
          >
            <button
              type="button"
              onClick={() => {
                const yesterday = formatDateYMD(new Date(Date.now() - 86400000));
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
              style={{
                width: '100%',
                height: '52px',
                padding: '0 16px',
                // An "add" row: graphite with a grey caps label (not a fill)
                backgroundColor: '#1C1C1C',
                color: '#9A9A9A',
                ...SHARED_CELL_BORDER,
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
            >
              <span>+ LOG PAST WORKOUT</span>
              <span>→</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setImportCsvStatus('');
                setShowImportCsvModal(true);
              }}
              className="kinetic-btn"
              style={{
                width: '100%',
                height: '46px',
                padding: '0 12px',
                backgroundColor: '#1C1C1C',
                color: '#FFFFFF',
                ...SHARED_CELL_BORDER,
                fontSize: '12px',
                fontWeight: 500,
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
            >
              <span>IMPORT</span>
              <span>↑</span>
            </button>
          </div>
          )}

          {totalSessions === 0 ? (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#1C1C1C',
                ...SHARED_CELL_BORDER,
                fontSize: '14px',
                color: '#9A9A9A',
                fontWeight: 400
              }}
            >
              {filterActive ? 'No sessions match these filters.' : 'No sessions logged yet.'}
            </div>
          ) : (
            <>
              {visibleHistory.map(w => {
                // Tapping a row opens the workout as a full page: yours to edit, a friend's as a locked preview
                const open = () => (readOnly ? onLoadWorkout?.(w) : onOpenWorkout?.(w.id));
                const tappable = !readOnly || Boolean(onLoadWorkout);

                return (
                  <div id={`history-entry-${w.id}`} key={w.id}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: readOnly
                          ? onLoadWorkout
                            ? 'minmax(0, 1fr) 48px'
                            : 'minmax(0, 1fr)'
                          : 'minmax(0, 1fr) 48px 48px',
                        gap: 0,
                        alignItems: 'stretch',
                        backgroundColor: '#1C1C1C'
                      }}
                    >
                      <div
                        role={tappable ? 'button' : undefined}
                        tabIndex={tappable ? 0 : undefined}
                        aria-label={tappable ? `Open ${stripDateFromTitle(w.title) || getDefaultSessionName()}, ${formatDateYMD(w.startedAt)}` : undefined}
                        onClick={tappable ? open : undefined}
                        onKeyDown={!tappable ? undefined : e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            open();
                          }
                        }}
                        style={{
                          padding: '8px 12px',
                          minWidth: 0,
                          minHeight: '48px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          cursor: tappable ? 'pointer' : 'default',
                          ...SHARED_CELL_BORDER
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            minWidth: 0
                          }}
                        >
                          <div
                            style={{
                              fontSize: '15px',
                              ...UI.sessionName,
                              // White: a red name on every row made red mean nothing in the list
                              color: '#FFFFFF',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              minWidth: 0
                            }}
                          >
                            {stripDateFromTitle(w.title) || getDefaultSessionName()}
                          </div>
                          {prWorkoutIds.has(w.id) && (
                            <span
                              style={{
                                backgroundColor: '#FFFFFF',
                                color: '#000000',
                                fontSize: '11px',
                                fontWeight: 500,
                                padding: '1px 5px',
                                lineHeight: 1.2,
                                letterSpacing: '0.02em',
                                flexShrink: 0
                              }}
                            >
                              PR
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: colors?.secondaryLabel || '#9A9A9A',
                            marginTop: '1px'
                          }}
                        >
                          {/* Names carry no date, so the date is always here */}
                          {`${formatDateYMD(w.startedAt)} • `}
                          {(w.slots || []).length} {(w.slots || []).length === 1 ? 'EXERCISE' : 'EXERCISES'}
                        </div>
                        {/* Done together with a friend (synced session) */}
                        {getWorkoutSyncInfo(w) && (
                          <div style={{ fontSize: '11px', fontWeight: 500, color: '#BDBDBD', marginTop: '1px', textTransform: 'uppercase' }}>
                            SYNCED WITH @{getWorkoutSyncInfo(w).partnerName || 'FRIEND'}
                          </div>
                        )}
                        {/* The exercises done, so rows with the same name are easy to tell apart */}
                        {!historyFilter.exerciseId && getWorkoutExerciseNames(w) && (
                          <div
                            style={{
                              ...UI.rowContents,
                              marginTop: '2px',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {getWorkoutExerciseNames(w)}
                          </div>
                        )}
                        {historyFilter.exerciseId && describeExerciseInWorkout(w) && (
                          <div style={{ fontSize: '11px', fontWeight: 500, color: '#FFFFFF', marginTop: '1px' }}>
                            {describeExerciseInWorkout(w)}
                          </div>
                        )}
                      </div>

                      {/* A friend's workout: › opens it as a locked preview (START there loads it at your weights) */}
                      {readOnly && onLoadWorkout && (
                        <button
                          type="button"
                          className="kinetic-btn"
                          aria-label={`Preview ${stripDateFromTitle(w.title) || getDefaultSessionName()}, ${formatDateYMD(w.startedAt)}`}
                          onClick={open}
                          style={{
                            width: '48px',
                            minHeight: '48px',
                            boxSizing: 'border-box',
                            backgroundColor: '#1C1C1C',
                            color: '#9A9A9A',
                            border: 'none',
                            ...SHARED_CELL_BORDER,
                            fontSize: '20px',
                            fontWeight: 300,
                            cursor: 'pointer'
                          }}
                        >
                          ›
                        </button>
                      )}

                      {!readOnly && (
                      <>
                      <button
                        type="button"
                        aria-label={`Edit ${stripDateFromTitle(w.title) || getDefaultSessionName()}, ${formatDateYMD(w.startedAt)}`}
                        onClick={open}
                        style={{
                          width: '48px',
                          minHeight: '48px',
                          boxSizing: 'border-box',
                          backgroundColor: '#1C1C1C',
                          color: '#9A9A9A',
                          ...SHARED_CELL_BORDER,
                          fontSize: '20px',
                          fontWeight: 300,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        ›
                      </button>

                      <DeleteButton
                        label={`Delete ${stripDateFromTitle(w.title) || getDefaultSessionName()}, ${formatDateYMD(w.startedAt)}`}
                        variant="outline"
                        fill
                        minHeight="48px"
                        style={{ width: '48px', height: 'auto', color: '#9A9A9A' }}
                        onClick={() =>
                          setDeleteConfirmTarget?.({
                            type: 'history_workout',
                            workoutId: w.id,
                            label: `${stripDateFromTitle(w.title) || getDefaultSessionName()} (${formatDateYMD(w.startedAt)})`
                          })
                        }
                      />
                      </>
                      )}
                    </div>

                  </div>
                );
              })}

              {!showAllHistory && totalSessions > INITIAL_LIMIT && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAllHistory(true);
                    setHistoryPage(0);
                  }}
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 12px',
                    backgroundColor: '#1C1C1C',
                    color: 'var(--dp-color-accent)',
                    ...SHARED_CELL_BORDER,
                    fontSize: '12px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  SEE ALL ({totalSessions})
                </button>
              )}

              {showAllHistory && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '96px minmax(0, 1fr) 96px',
                    gap: 0,
                    height: '44px',
                    backgroundColor: '#1C1C1C'
                  }}
                >
                  <button
                    type="button"
                    disabled={historyPage <= 0}
                    onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                    style={{
                      ...stdActionBtnStyle,
                      height: '44px',
                      backgroundColor: '#1C1C1C',
                      color: '#FFFFFF',
                      opacity: historyPage <= 0 ? 0.4 : 1,
                      cursor: historyPage <= 0 ? 'default' : 'pointer'
                    }}
                  >
                    ← PREV 100
                  </button>
                  <div
                    style={{
                      ...SHARED_CELL_BORDER,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 6px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: '#9A9A9A',
                      textTransform: 'uppercase',
                      textAlign: 'center'
                    }}
                  >
                    PAGE {historyPage + 1} OF {totalPages} ({historyPage * PAGE_SIZE + 1}–
                    {Math.min(totalSessions, (historyPage + 1) * PAGE_SIZE)} OF {totalSessions})
                  </div>
                  <button
                    type="button"
                    disabled={historyPage >= totalPages - 1}
                    onClick={() => setHistoryPage(p => Math.min(totalPages - 1, p + 1))}
                    style={{
                      ...stdActionBtnStyle,
                      height: '44px',
                      backgroundColor: '#1C1C1C',
                      color: '#FFFFFF',
                      opacity: historyPage >= totalPages - 1 ? 0.4 : 1,
                      cursor: historyPage >= totalPages - 1 ? 'default' : 'pointer'
                    }}
                  >
                    NEXT 100 →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
      )}

      {/* =================================================================== */}
      {/* 4. IMPORT WORKOUT HISTORY (.CSV) MODAL */}
      {/* =================================================================== */}
      {showImportCsvModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 430,
            padding: `calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px))`
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#121214',
              border: '2px solid var(--dp-color-accent)',
              padding: '12px'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
                borderBottom: '1px solid #2A2A2A',
                paddingBottom: '8px'
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--dp-color-accent)',
                    textTransform: 'uppercase'
                  }}
                >
                  WORKOUT HISTORY CSV IMPORT
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#FFFFFF',
                    textTransform: 'uppercase'
                  }}
                >
                  IMPORT .CSV DATA
                </div>
              </div>
              <CloseButton label="Close import" onClick={() => setShowImportCsvModal(false)} />
            </div>

            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: '#9A9A9A',
                lineHeight: 1.4,
                marginBottom: '10px',
                textTransform: 'uppercase'
              }}
            >
              FORMAT: <span style={{ color: '#FFFFFF' }}>Date,Exercise,Set,Weight,Reps</span> (E.G.{' '}
              <span style={{ color: '#FFFFFF' }}>9/23/2026,Barbell Squats,1,185,8</span>). DOWNLOAD THE
              TEMPLATE OR UPLOAD YOUR .CSV FILE BELOW. A <span style={{ color: '#FFFFFF' }}>FITBOD</span> EXPORT
              (SETTINGS → EXPORT WORKOUT DATA) IMPORTS AS IT IS: KG BECOME LB, WARM-UPS STAY WARM-UPS.
            </div>

            {/* Download Template & Upload File Buttons */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 0,
                ...SHARED_GROUP_OUTER,
                marginBottom: '10px'
              }}
            >
              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="kinetic-btn"
                style={{
                  height: '42px',
                  padding: '0 10px',
                  backgroundColor: '#1C1C1C',
                  color: '#FFFFFF',
                  ...SHARED_CELL_BORDER,
                  fontSize: '11px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                DOWNLOAD .CSV TEMPLATE ↓
              </button>

              <label
                className="kinetic-btn"
                style={{
                  height: '42px',
                  padding: '0 10px',
                  backgroundColor: 'var(--dp-color-accent)',
                  color: '#000000',
                  ...SHARED_CELL_BORDER,
                  fontSize: '11px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  boxSizing: 'border-box'
                }}
              >
                <span>{importCsvFileName ? `FILE: ${importCsvFileName}` : 'UPLOAD .CSV FILE ↑'}</span>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleCsvFileSelect}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* CSV Preview / Direct Paste Area */}
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: '#9A9A9A',
                marginBottom: '4px',
                textTransform: 'uppercase'
              }}
            >
              CSV PREVIEW / PASTE DATA DIRECTLY:
            </div>
            <textarea
              value={importCsvText}
              onChange={e => {
                setImportCsvText(e.target.value);
                setImportCsvStatus('');
              }}
              placeholder={
                'Date,Exercise,Set,Weight,Reps\n9/23/2026,Barbell Squats,1,185,8\n9/23/2026,Barbell Bench,1,155,8'
              }
              rows={7}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: '#1C1C1C',
                color: '#FFFFFF',
                border: 'none', borderRadius: '10px',
                padding: '8px',
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 500,
                outline: 'none',
                resize: 'vertical',
                marginBottom: '10px'
              }}
            />

            {importCsvStatus && (
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#FF4A3D',
                  marginBottom: '10px'
                }}
              >
                {importCsvStatus}
              </div>
            )}

            {/* Cancel / Confirm Import Actions */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 0,
                ...SHARED_GROUP_OUTER
              }}
            >
              <button
                type="button"
                onClick={() => setShowImportCsvModal(false)}
                className="kinetic-btn"
                style={{
                  height: '42px',
                  padding: '0 10px',
                  backgroundColor: '#1C1C1C',
                  color: '#9A9A9A',
                  ...SHARED_CELL_BORDER,
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleConfirmImportCsv}
                className="kinetic-btn"
                style={{
                  height: '42px',
                  padding: '0 10px',
                  backgroundColor: '#FFFFFF',
                  color: '#000000',
                  ...SHARED_CELL_BORDER,
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                IMPORT INTO HISTORY →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default HistoryView;
