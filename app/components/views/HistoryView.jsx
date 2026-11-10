'use client';

import React, { useState, useEffect } from 'react';
import { SHARED_CELL_BORDER, SHARED_GROUP_OUTER } from '../../styles/kineticTokens';
import { RoutineEditorView } from './RoutineEditorView';
import {
  BIG_FOUR_IDS,
  CORE_PR_EXERCISE_IDS,
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  normalizeSlotCategory,
  getDefaultSessionName,
  getExRxTargetForLift,
  formatDateYMD,
  parseYMDToISO,
  stripEquipmentFromExerciseName
} from '../../data/exerciseLibrary';
import {
  getBestHistory1RMInfo,
  normalizeSlotLabels,
  buildPersonalRecordHistoryEntry,
  insertHistoryEntrySorted
} from '../../utils/workoutEngine';
import { CloseButton, DeleteButton } from '../Controls';
import { ExercisePicker, resolvePickerExerciseId } from '../ExercisePicker';
import {
  HistoryExerciseFilter,
  EMPTY_HISTORY_FILTER,
  isHistoryFilterActive,
  workoutMatchesHistoryFilter,
  getWorkoutSetsForExercise,
  getWorkoutExerciseIds
} from '../HistoryExerciseFilter';
import { OneRepMaxCalculatorModal } from '../OneRepMaxCalculatorModal';


export function HistoryView({
  // PROGRESS page tab this renders: 'records' (Personal Records) or 'history' (logged sessions)
  section = 'history',
  // A friend's profile: their records and sessions, view only (no adding, editing, importing or deleting)
  readOnly = false,
  colors,
  history,
  setHistory,
  currentIncrementLbs = 0,
  expandedHistoryWorkoutId,
  setExpandedHistoryWorkoutId,
  oneRepMaxes,
  setOneRepMaxes,
  customPrExerciseIds: externalCustomPrIds,
  setCustomPrExerciseIds: setExternalCustomPrIds,
  selectedGymId = '',
  gyms = [],
  targetStandardClass,
  userBodyweightLbs,
  totalHeightInches,
  customGoalWeights,
  setHistoricalDraft,
  setCurrentView,
  openPlateCalculatorForPR,
  openPlateCalculatorForSet,
  setSetValueTarget,
  setDeleteConfirmTarget,
  buildHistoryWorkoutEditorProps
}) {
  const [showAllHistory, setShowAllHistory] = useState(false);
  // HISTORY tab search & filters (type / muscle / equipment / exercise)
  const [historyFilter, setHistoryFilter] = useState(EMPTY_HISTORY_FILTER);
  const [historyPage, setHistoryPage] = useState(0);

  // --- Shared / Local Custom PR Exercise List & Add Exercise Filter State ---
  const [localCustomPrIds, setLocalCustomPrIds] = useState([]);
  const customPrExerciseIds = externalCustomPrIds || localCustomPrIds;
  const setCustomPrExerciseIds = setExternalCustomPrIds || setLocalCustomPrIds;
  const [showAddPrExercisePanel, setShowAddPrExercisePanel] = useState(false);
  const [addPrSelectedExId, setAddPrSelectedExId] = useState('barbell_row');

  // --- 1RM Converter Popup Slot State (Matches New/Current Session Exercise Editor) ---
  // Exercise the 1RM calculator pop-up is open for (null = closed)
  const [calcExerciseId, setCalcExerciseId] = useState(null);

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
      setImportCsvStatus('NO VALID ROWS FOUND IN CSV.');
      return;
    }

    // Group rows by normalized Date (YYYY/MM/DD) -> ordered exercises -> sets
    const sessionsByDate = new Map();
    const bestImported1RMs = {};
    let importedSetsCount = 0;

    lines.forEach((line, idx) => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 4) return;
      // Skip header row
      if (
        idx === 0 &&
        (cols[0].toLowerCase() === 'date' || cols[1]?.toLowerCase() === 'exercise')
      ) {
        return;
      }

      const rawDate = cols[0];
      const rawExName = cols[1];
      // Support both 5-column (Date,Exercise,Set,Weight,Reps) and 4-column (Date,Exercise,Weight,Reps)
      const hasSetCol = cols.length >= 5;
      const weightVal = Number(hasSetCol ? cols[3] : cols[2]);
      const repsVal = Number(hasSetCol ? cols[4] : cols[3]);

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
        setType: 'Working',
        reps: Math.max(1, Math.round(repsVal)),
        weight: Math.max(0, weightVal),
        completed: true,
        rpe: 8
      });

      const est1RM =
        repsVal === 1 ? Math.round(weightVal) : Math.round(weightVal * (1 + repsVal / 30));
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
        title: `${ymd} - Session`,
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

    if (typeof setOneRepMaxes === 'function' && Object.keys(bestImported1RMs).length > 0) {
      setOneRepMaxes(prev => {
        const next = { ...(prev || {}) };
        for (const [exId, val] of Object.entries(bestImported1RMs)) {
          if (val > (Number(next[exId]) || 0)) {
            next[exId] = val;
          }
        }
        return next;
      });
    }

    setShowImportCsvModal(false);
    setImportCsvText('');
    setImportCsvFileName('');
    setImportCsvStatus('');
  };

  const PAGE_SIZE = 100;
  const INITIAL_LIMIT = 10;
  const filterActive = isHistoryFilterActive(historyFilter);
  const filteredHistory = filterActive
    ? (history || []).filter(w => workoutMatchesHistoryFilter(w, historyFilter))
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

  // If a linked workout is beyond the initial 10, automatically switch to See All and its 100-item page
  useEffect(() => {
    if (!expandedHistoryWorkoutId) return;
    const idx = filteredHistory.findIndex(w => w?.id === expandedHistoryWorkoutId);
    if (idx >= INITIAL_LIMIT) {
      setShowAllHistory(true);
      setHistoryPage(Math.floor(idx / PAGE_SIZE));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedHistoryWorkoutId, history]);

  const visibleHistory = showAllHistory
    ? filteredHistory.slice(historyPage * PAGE_SIZE, (historyPage + 1) * PAGE_SIZE)
    : filteredHistory.slice(0, INITIAL_LIMIT);

  // Strictly display the 5 Core PR exercises + any explicitly user-added custom exercises
  const displayedPrExerciseIds = Array.from(
    new Set([
      ...CORE_PR_EXERCISE_IDS,
      ...(readOnly
        ? Object.keys(oneRepMaxes || {}).filter(id => Number(oneRepMaxes[id]) > 0)
        : Array.isArray(customPrExerciseIds)
          ? customPrExerciseIds
          : [])
    ])
  );
  // + ADD panel: always a real exercise that isn't already listed
  const addPrExerciseId = resolvePickerExerciseId(addPrSelectedExId, displayedPrExerciseIds);
  const displayedPrExercises = displayedPrExerciseIds
    .map(id => EXERCISE_MAP[id])
    .filter(Boolean);


  const open1RMConverterModal = exerciseId => {
    setCalcExerciseId(exerciseId || BIG_FOUR_IDS[0] || 'barbell_bench_press');
  };

  const handleSaveCalculatedPR = ({ exerciseId, oneRepMax, dateYMD, scheme }) => {
    if (!exerciseId || oneRepMax <= 0) return;
    if (setCustomPrExerciseIds && !displayedPrExerciseIds.includes(exerciseId)) {
      setCustomPrExerciseIds(prev => (prev.includes(exerciseId) ? prev : [...prev, exerciseId]));
    }
    setOneRepMaxes?.(prev => ({ ...prev, [exerciseId]: oneRepMax }));
    // Log a PERSONAL RECORD entry so Personal Records reflect logged history
    setHistory?.(prev =>
      insertHistoryEntrySorted(prev, buildPersonalRecordHistoryEntry({ exerciseId, oneRepMax, dateYMD, scheme }))
    );
  };

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
    fontWeight: 800,
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
      {/* PERSONAL RECORDS TAB */}
      {/* =================================================================== */}
      {section === 'records' && (
      <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            ...SHARED_GROUP_OUTER
          }}
        >
          {/* + ADD WORKOUT / EXERCISE TO PERSONAL RECORDS (TOP OF STACK, MATCHING + LOG PAST WORKOUT) */}
          {readOnly ? null : !showAddPrExercisePanel ? (
            <button
              type="button"
              onClick={() => setShowAddPrExercisePanel(true)}
              className="kinetic-btn"
              style={{
                width: '100%',
                height: '46px',
                padding: '0 12px',
                backgroundColor: 'var(--dp-color-accent)',
                color: '#101010',
                ...SHARED_CELL_BORDER,
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
            >
              <span>+ ADD WORKOUT / EXERCISE TO PERSONAL RECORDS</span>
              <span>→</span>
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Header row of Add Exercise Panel */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 40px',
                  gap: 0,
                  height: '40px'
                }}
              >
                <div
                  style={{
                    backgroundColor: '#18181B',
                    padding: '0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '11px',
                    fontWeight: 800,
                    color: 'var(--dp-color-accent)',
                    textTransform: 'uppercase',
                    ...SHARED_CELL_BORDER
                  }}
                >
                  ADD EXERCISE TO PERSONAL RECORDS
                </div>
                <DeleteButton
                  label="Close panel"
                  fill
                  minHeight="0"
                  style={{ width: '100%' }}
                  onClick={() => setShowAddPrExercisePanel(false)}
                />
              </div>

              {/* The standard exercise picker (same as the session editor header) */}
              <ExercisePicker
                exerciseId={addPrExerciseId}
                onChange={setAddPrSelectedExId}
                excludeIds={displayedPrExerciseIds}
              />

              <button
                type="button"
                onClick={() => {
                  if (addPrExerciseId && !displayedPrExerciseIds.includes(addPrExerciseId)) {
                    setCustomPrExerciseIds(prev => (prev.includes(addPrExerciseId) ? prev : [...prev, addPrExerciseId]));
                  }
                  setShowAddPrExercisePanel(false);
                }}
                className="kinetic-btn"
                style={{
                  height: '44px',
                  padding: '0 12px',
                  backgroundColor: 'var(--dp-color-accent)',
                  color: '#101010',
                  ...SHARED_CELL_BORDER,
                  fontSize: '12px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  cursor: 'pointer'
                }}
              >
                + ADD TO PERSONAL RECORDS
              </button>
            </div>
          )}

          {displayedPrExercises.map(ex => {
            const prInfo = getBestHistory1RMInfo(ex.id, history);
            const rawVal = Number(oneRepMaxes?.[ex.id]) || prInfo.best || 0;
            const isTBD = rawVal <= 0;
            const current1RM = isTBD ? 0 : rawVal;
            const loggedDateLabel = prInfo.dateLabel || '';
            const goal1RM = getExRxTargetForLift(
              ex.id,
              targetStandardClass,
              userBodyweightLbs,
              totalHeightInches,
              customGoalWeights
            );
            const diffFromGoal = !isTBD && goal1RM ? goal1RM - current1RM : null;

            return (
              <div
                key={ex.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: readOnly ? 'minmax(0, 1fr) 110px' : 'minmax(0, 1fr) 96px 96px',
                  gap: 0,
                  alignItems: 'stretch',
                  backgroundColor: '#141416'
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    ...SHARED_CELL_BORDER
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      textTransform: 'uppercase',
                      lineHeight: 1.15,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {ex.name}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: colors?.secondaryLabel || '#A0A0A0',
                      marginTop: '1px'
                    }}
                  >
                    {readOnly
                      ? isTBD
                        ? 'Not logged yet'
                        : loggedDateLabel
                          ? `Logged ${loggedDateLabel}`
                          : 'Logged'
                      : isTBD
                      ? `${targetStandardClass} goal: ${goal1RM}\u00A0lb`
                      : diffFromGoal > 0
                        ? `${targetStandardClass} goal: ${goal1RM}\u00A0lb (${diffFromGoal}\u00A0lb to go)`
                        : `${targetStandardClass} goal: ${goal1RM}\u00A0lb ${diffFromGoal === 0 ? '(reached)' : `(beaten by ${Math.abs(diffFromGoal)}\u00A0lb)`}`}
                  </div>
                </div>

                {readOnly ? (
                  <div
                    style={{
                      ...stdActionBtnStyle,
                      width: 'auto',
                      height: '100%',
                      minHeight: '48px',
                      cursor: 'default',
                      backgroundColor: isTBD ? '#2A2A2E' : 'var(--dp-color-accent)',
                      color: isTBD ? '#FFFFFF' : '#000000'
                    }}
                  >
                    {isTBD ? 'TBD' : `${current1RM}\u00A0LB`}
                  </div>
                ) : (
                <>
                <button
                  type="button"
                  onClick={() => open1RMConverterModal(ex.id)}
                  style={{
                    ...stdActionBtnStyle,
                    height: '100%',
                    minHeight: '48px',
                    backgroundColor: '#1C1C20',
                    color: '#FFFFFF'
                  }}
                >
                  CALCULATE
                </button>

                <button
                  type="button"
                  onClick={() => openPlateCalculatorForPR(ex.id, ex.name, current1RM, loggedDateLabel)}
                  style={{
                    ...stdActionBtnStyle,
                    height: '100%',
                    minHeight: '48px',
                    flexDirection: 'column',
                    backgroundColor: isTBD
                      ? '#2A2A2E'
                      : 'var(--dp-color-accent)',
                    color: isTBD ? '#FFFFFF' : '#000000'
                  }}
                >
                  <span style={{ lineHeight: 1.1 }}>
                    {isTBD ? 'TBD ✎' : `${current1RM} LB ✎`}
                  </span>
                  {!isTBD && loggedDateLabel && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        lineHeight: 1.1,
                        marginTop: '2px',
                        opacity: 0.85
                      }}
                    >
                      {loggedDateLabel}
                    </span>
                  )}
                </button>
                </>
                )}
              </div>
            );
          })}
        </div>
      </section>
      )}

      {/* =================================================================== */}
      {/* HISTORY TAB: SEARCH & FILTERS, THEN LOGGED SESSIONS */}
      {/* =================================================================== */}
      {section === 'history' && (
      <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
        {allSessionsCount > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={SHARED_GROUP_OUTER}>
              <HistoryExerciseFilter
                history={history}
                filter={historyFilter}
                onChange={next => {
                  setHistoryFilter(next);
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
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#A0A0A0', textTransform: 'uppercase', minWidth: 0 }}>
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
                    setShowAllHistory(false);
                    setHistoryPage(0);
                  }}
                  className="kinetic-btn"
                  style={{
                    height: '40px',
                    padding: '0 14px',
                    backgroundColor: '#161618',
                    color: '#FFFFFF',
                    border: '1px solid var(--dp-color-rule)',
                    fontSize: '12px',
                    fontWeight: 800,
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
                  title: `${yesterday} - Session`,
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
                height: '46px',
                padding: '0 12px',
                backgroundColor: 'var(--dp-color-accent)',
                color: '#101010',
                ...SHARED_CELL_BORDER,
                fontSize: '12px',
                fontWeight: 800,
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
                backgroundColor: '#161618',
                color: '#FFFFFF',
                ...SHARED_CELL_BORDER,
                fontSize: '12px',
                fontWeight: 800,
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
                backgroundColor: '#141416',
                ...SHARED_CELL_BORDER,
                fontSize: '12px',
                color: '#888888',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}
            >
              {filterActive ? 'NO SESSIONS MATCH THESE FILTERS.' : 'NO SESSIONS LOGGED YET.'}
            </div>
          ) : (
            <>
              {visibleHistory.map(w => {
                const isExp = expandedHistoryWorkoutId === w.id;
                const editorProps =
                  isExp && buildHistoryWorkoutEditorProps
                    ? buildHistoryWorkoutEditorProps(w)
                    : null;

                return (
                  <div id={`history-entry-${w.id}`} key={w.id}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: readOnly ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 48px 48px',
                        gap: 0,
                        alignItems: 'stretch',
                        backgroundColor: isExp ? '#1C1C20' : '#141416'
                      }}
                    >
                      <div
                        role={readOnly ? undefined : 'button'}
                        tabIndex={readOnly ? undefined : 0}
                        onClick={readOnly ? undefined : () => setExpandedHistoryWorkoutId(isExp ? null : w.id)}
                        onKeyDown={readOnly ? undefined : e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExpandedHistoryWorkoutId(isExp ? null : w.id);
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
                          cursor: readOnly ? 'default' : 'pointer',
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
                              fontSize: '13px',
                              fontWeight: 800,
                              color: '#FFFFFF',
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              minWidth: 0
                            }}
                          >
                            {w.title}
                          </div>
                          {prWorkoutIds.has(w.id) && (
                            <span
                              style={{
                                backgroundColor: '#30D158',
                                color: '#101010',
                                fontSize: '11px',
                                fontWeight: 900,
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
                            fontWeight: 700,
                            color: colors?.secondaryLabel || '#A0A0A0',
                            marginTop: '1px'
                          }}
                        >
                          {formatDateYMD(w.startedAt)} • {(w.slots || []).length} EXERCISES
                        </div>
                        {readOnly && !historyFilter.exerciseId && (
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF', marginTop: '1px', textTransform: 'uppercase' }}>
                            {getWorkoutExerciseNames(w)}
                          </div>
                        )}
                        {historyFilter.exerciseId && describeExerciseInWorkout(w) && (
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#FFFFFF', marginTop: '1px' }}>
                            {describeExerciseInWorkout(w)}
                          </div>
                        )}
                      </div>

                      {!readOnly && (
                      <>
                      <button
                        type="button"
                        aria-label={isExp ? `Collapse ${w.title}` : `Expand ${w.title}`}
                        onClick={() => setExpandedHistoryWorkoutId(isExp ? null : w.id)}
                        style={{
                          width: '48px',
                          minHeight: '48px',
                          boxSizing: 'border-box',
                          backgroundColor: '#1C1C20',
                          color: isExp ? 'var(--dp-color-accent)' : '#FFFFFF',
                          ...SHARED_CELL_BORDER,
                          fontSize: '16px',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        {isExp ? '−' : '+'}
                      </button>

                      <DeleteButton
                        label={`Delete ${w.title}`}
                        fill
                        minHeight="48px"
                        style={{ width: '48px', height: 'auto' }}
                        onClick={() =>
                          setDeleteConfirmTarget?.({
                            type: 'history_workout',
                            workoutId: w.id,
                            label: w.title
                          })
                        }
                      />
                      </>
                      )}
                    </div>

                    {!readOnly && isExp && editorProps && (
                      <div
                        style={{
                          paddingBottom: '12px',
                          backgroundColor: '#101010',
                          ...SHARED_CELL_BORDER
                        }}
                      >
                        <RoutineEditorView {...editorProps} />
                      </div>
                    )}
                  </div>
                );
              })}

              {!showAllHistory && totalSessions > 0 && (
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
                    backgroundColor: '#18181B',
                    color: 'var(--dp-color-accent)',
                    ...SHARED_CELL_BORDER,
                    fontSize: '12px',
                    fontWeight: 800,
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
                    backgroundColor: '#141416'
                  }}
                >
                  <button
                    type="button"
                    disabled={historyPage <= 0}
                    onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                    style={{
                      ...stdActionBtnStyle,
                      height: '44px',
                      backgroundColor: '#18181B',
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
                      fontWeight: 800,
                      color: '#A0A0A0',
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
                      backgroundColor: '#18181B',
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
      {/* 1RM CONVERTER POPUP MODAL (NEW/CURRENT SESSION EXERCISE INTERFACE) */}
      {/* =================================================================== */}
      {calcExerciseId && (
        <OneRepMaxCalculatorModal
          key={calcExerciseId}
          exerciseId={calcExerciseId}
          onClose={() => setCalcExerciseId(null)}
          onSave={handleSaveCalculatedPR}
          oneRepMaxes={oneRepMaxes}
          history={history}
          currentIncrementLbs={currentIncrementLbs}
          userBodyweightLbs={userBodyweightLbs}
          selectedGymId={selectedGymId}
          gyms={gyms}
          setSetValueTarget={setSetValueTarget}
          openPlateCalculatorForSet={openPlateCalculatorForSet}
        />
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
                borderBottom: '1px solid #2A2A2E',
                paddingBottom: '8px'
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: 'var(--dp-color-accent)',
                    textTransform: 'uppercase'
                  }}
                >
                  WORKOUT HISTORY CSV IMPORT
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 800,
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
                fontWeight: 700,
                color: '#A0A0A0',
                lineHeight: 1.4,
                marginBottom: '10px',
                textTransform: 'uppercase'
              }}
            >
              FORMAT: <span style={{ color: '#FFFFFF' }}>Date,Exercise,Set,Weight,Reps</span> (E.G.{' '}
              <span style={{ color: '#FFFFFF' }}>9/23/2026,Barbell Squats,1,185,8</span>). DOWNLOAD THE
              TEMPLATE OR UPLOAD YOUR .CSV FILE BELOW.
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
                  backgroundColor: '#161618',
                  color: '#FFFFFF',
                  ...SHARED_CELL_BORDER,
                  fontSize: '11px',
                  fontWeight: 800,
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
                  color: '#101010',
                  ...SHARED_CELL_BORDER,
                  fontSize: '11px',
                  fontWeight: 800,
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
                fontWeight: 800,
                color: '#A0A0A0',
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
                backgroundColor: '#161618',
                color: '#FFFFFF',
                border: '1px solid var(--dp-color-rule)',
                padding: '8px',
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 700,
                outline: 'none',
                resize: 'vertical',
                marginBottom: '10px'
              }}
            />

            {importCsvStatus && (
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#FF3B30',
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
                  backgroundColor: '#161618',
                  color: '#A0A0A0',
                  ...SHARED_CELL_BORDER,
                  fontSize: '12px',
                  fontWeight: 800,
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
                  backgroundColor: '#30D158',
                  color: '#000000',
                  ...SHARED_CELL_BORDER,
                  fontSize: '12px',
                  fontWeight: 800,
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
