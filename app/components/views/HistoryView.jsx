'use client';

import React, { useState, useEffect } from 'react';
import { UI } from '../../styles/kineticTokens';
import { RoutineEditorView } from './RoutineEditorView';
import {
  BIG_FOUR_IDS,
  CORE_PR_EXERCISE_IDS,
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  DEFAULT_GYM_EQUIPMENT_PRESETS,
  SLOT_CATEGORIES,
  normalizeSlotCategory,
  filterAddSlotExercises,
  getAvailableMuscleGroupsForCategory,
  getFilteredExercisesForSlotInline,
  getDefaultSessionName,
  getExRxTargetForLift,
  formatTodayYMD,
  formatDateYMD,
  parseYMDToISO,
  roundTo5
} from '../../data/exerciseLibrary';
import {
  SCHEME_OPTIONS,
  SET_TYPES_LIST,
  normalizeSetType,
  createWorkoutSlot,
  generateSetsForScheme,
  calculateLastEquivalentWeightForSet,
  getEffectiveIncrementForExercise,
  getBestHistory1RMInfo,
  normalizeSlotLabels
} from '../../utils/workoutEngine';

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

const SET_TYPE_MULTIPLIER_MAP = {
  Warmup: 0.74,
  Working: 0.98,
  'Top Out': 1.04,
  'Burn Out': 0.84,
  '1 Rep Max': 1.0
};

function CalcModalDragBadge({ label, color = '#FFFFFF', height = '100%', bg = '#121214', title = 'Drag to reorder' }) {
  return (
    <div
      title={title}
      style={{
        position: 'relative',
        width: '34px',
        height,
        minHeight: '40px',
        boxSizing: 'border-box',
        backgroundColor: bg,
        ...SHARED_CELL_BORDER,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        userSelect: 'none',
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '2px',
          backgroundImage: 'radial-gradient(#9A9A9A 1.35px, transparent 1.35px)',
          backgroundSize: '5px 5px',
          backgroundPosition: 'center',
          opacity: 0.62,
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          backgroundColor: 'rgba(16, 16, 16, 0.88)',
          padding: '2px 4px',
          fontSize: '14px',
          fontWeight: 800,
          color,
          lineHeight: 1,
          whiteSpace: 'nowrap'
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function HistoryView({
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
  setDeleteConfirmTarget,
  buildHistoryWorkoutEditorProps
}) {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);

  // --- Shared / Local Custom PR Exercise List & Add Exercise Filter State ---
  const [localCustomPrIds, setLocalCustomPrIds] = useState([]);
  const customPrExerciseIds = externalCustomPrIds || localCustomPrIds;
  const setCustomPrExerciseIds = setExternalCustomPrIds || setLocalCustomPrIds;
  const [showAddPrExercisePanel, setShowAddPrExercisePanel] = useState(false);
  const [addPrGymFilter, setAddPrGymFilter] = useState(selectedGymId || '');
  const [addPrCategory, setAddPrCategory] = useState('Compound Lift');
  const [addPrMuscleGroup, setAddPrMuscleGroup] = useState('All Muscles');
  const [addPrSelectedExId, setAddPrSelectedExId] = useState('barbell_row');

  // --- 1RM Converter Popup Slot State (Matches New/Current Session Exercise Editor) ---
  const [calcSlot, setCalcSlot] = useState(null);
  const [calcPrDate, setCalcPrDate] = useState('');
  const [lastEditedCalcSetId, setLastEditedCalcSetId] = useState(null);
  const [draggedCalcSetIdx, setDraggedCalcSetIdx] = useState(null);

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
      setImportCsvStatus('PLEASE UPLOAD OR PASTE A .CSV FILE FIRST.');
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
      setImportCsvStatus('COULD NOT PARSE ANY VALID (DATE, EXERCISE, SET, WEIGHT, REPS) ROWS.');
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
          category: normalizeSlotCategory(exercise.category || 'Compound Lift'),
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

  // Strictly display the 5 Core PR exercises + any explicitly user-added custom exercises
  const displayedPrExerciseIds = Array.from(
    new Set([
      ...CORE_PR_EXERCISE_IDS,
      ...(Array.isArray(customPrExerciseIds) ? customPrExerciseIds : [])
    ])
  );
  const displayedPrExercises = displayedPrExerciseIds
    .map(id => EXERCISE_MAP[id])
    .filter(Boolean);

  const availAddPrMuscleGroups = getAvailableMuscleGroupsForCategory(
    addPrCategory,
    addPrGymFilter,
    gyms
  );
  const activeAddPrMuscle = availAddPrMuscleGroups.includes(addPrMuscleGroup)
    ? addPrMuscleGroup
    : 'All Muscles';
  const filteredAddPrExercises = filterAddSlotExercises(
    addPrGymFilter,
    addPrCategory,
    gyms,
    activeAddPrMuscle
  );
  const resolvedAddPrExId = filteredAddPrExercises.some(e => e.id === addPrSelectedExId)
    ? addPrSelectedExId
    : filteredAddPrExercises[0]?.id || 'incline_bench_press';

  const allGymOptions = [
    ...DEFAULT_GYM_EQUIPMENT_PRESETS,
    ...(gyms || []).map(g => ({ id: g.id, name: g.name }))
  ];

  const compute1RMFromSet = (st, totalSetsCount) => {
    const w = Math.max(0, Number(st?.weight) || 0);
    if (w <= 0) return 0;
    const r = Math.max(1, Number(st?.reps) || 1);
    const sType = normalizeSetType(st?.type);
    if (sType === '1 Rep Max' || (r === 1 && totalSetsCount <= 1)) {
      return roundTo5(w);
    }
    const repPct = 1 / (1 + Math.max(0, r - 1) / 30);
    const typeMultiplier = SET_TYPE_MULTIPLIER_MAP[sType] || 0.98;
    const setStressFactor = 1 / (1 + Math.max(0, totalSetsCount - 1) * 0.035);
    const factor = Math.min(1, repPct * typeMultiplier * setStressFactor);
    if (factor <= 0) return roundTo5(w);
    return Math.max(w, roundTo5(w / factor));
  };

  const open1RMConverterModal = exerciseId => {
    const exId = exerciseId || BIG_FOUR_IDS[0] || 'barbell_bench_press';
    const exObj = EXERCISE_MAP[exId] || EXERCISE_LIBRARY[0];
    const initialSlot = createWorkoutSlot({
      category: normalizeSlotCategory(exObj.category || 'Compound Lift'),
      slotLabel: normalizeSlotCategory(exObj.category || 'Compound Lift'),
      exerciseId: exObj.id,
      scheme: '5x5',
      oneRepMaxes,
      history,
      incrementLbs: currentIncrementLbs
    });
    setLastEditedCalcSetId(null);
    setCalcPrDate(formatTodayYMD());
    setCalcSlot(initialSlot);
  };

  const handleUpdateCalcSlotHeader = changes => {
    setCalcSlot(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...changes };
      const normCat = normalizeSlotCategory(next.category);
      next.category = normCat;

      if (changes.category && !changes.exerciseId && !changes.muscleGroupFilter) {
        const pool = getFilteredExercisesForSlotInline(
          { ...next, muscleGroupFilter: 'All Muscles' },
          selectedGymId,
          gyms
        );
        if (pool.length > 0 && !pool.some(e => e.id === next.exerciseId)) {
          next.exerciseId = pool[0].id;
        }
        next.muscleGroupFilter = EXERCISE_MAP[next.exerciseId]?.muscleGroup || 'All Muscles';
      } else if (changes.muscleGroupFilter !== undefined && !changes.exerciseId) {
        const pool = getFilteredExercisesForSlotInline(next, selectedGymId, gyms);
        if (pool.length > 0 && !pool.some(e => e.id === next.exerciseId)) {
          next.exerciseId = pool[0].id;
        }
        if (EXERCISE_MAP[next.exerciseId]?.category) {
          next.category = normalizeSlotCategory(EXERCISE_MAP[next.exerciseId].category);
        }
      } else if (changes.exerciseId) {
        const chosenEx = EXERCISE_MAP[changes.exerciseId];
        if (chosenEx?.muscleGroup) {
          next.muscleGroupFilter = chosenEx.muscleGroup;
        }
      }

      if (changes.category || changes.exerciseId || changes.scheme || changes.muscleGroupFilter !== undefined) {
        const exObj = EXERCISE_MAP[next.exerciseId] || EXERCISE_LIBRARY[0];
        const base1RM = Number(oneRepMaxes?.[exObj.id]) || exObj.default1RM || 135;
        const newSets = generateSetsForScheme(
          next.scheme || '5x5',
          base1RM,
          normCat,
          exObj.id,
          currentIncrementLbs
        );
        next.sets = newSets;
        next.supersetSetsByExercise = [newSets];
        setLastEditedCalcSetId(null);
      }
      return next;
    });
  };

  const handleUpdateCalcSet = (setId, field, value) => {
    setLastEditedCalcSetId(setId);
    setCalcSlot(prev => {
      if (!prev) return prev;
      const nextSets = (prev.sets || []).map(st => {
        if (st.id !== setId) return st;
        if (field === 'type') {
          const nextType = normalizeSetType(value);
          return {
            ...st,
            type: nextType,
            reps: nextType === '1 Rep Max' ? 1 : st.reps
          };
        }
        if (field === 'increment') {
          const numInc = Number(value) || 0;
          return {
            ...st,
            increment: value,
            weight: Math.max(0, Math.round(((Number(st.lastWeight) || 0) + numInc) * 4) / 4)
          };
        }
        return { ...st, [field]: value };
      });
      return { ...prev, sets: nextSets, supersetSetsByExercise: [nextSets] };
    });
  };

  const handleInsertCalcSet = position => {
    setCalcSlot(prev => {
      if (!prev) return prev;
      const curSets = prev.sets || [];
      const refSet =
        position === 'top'
          ? curSets[0] || { type: 'Warmup', reps: 8, lastWeight: 95, increment: 0, weight: 95 }
          : curSets[curSets.length - 1] || { type: 'Working', reps: 5, lastWeight: 135, increment: 0, weight: 135 };
      const newSet = {
        ...refSet,
        id: `calc_set_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: position === 'top' ? 'Warmup' : refSet.type,
        completed: false
      };
      const merged = position === 'top' ? [newSet, ...curSets] : [...curSets, newSet];
      const renumbered = merged.map((s, i) => ({ ...s, setNumber: i + 1 }));
      return { ...prev, sets: renumbered, supersetSetsByExercise: [renumbered] };
    });
  };

  const handleDeleteCalcSet = setId => {
    setCalcSlot(prev => {
      if (!prev) return prev;
      const filtered = (prev.sets || []).filter(s => s.id !== setId);
      if (filtered.length === 0) return prev;
      const renumbered = filtered.map((s, i) => ({ ...s, setNumber: i + 1 }));
      return { ...prev, sets: renumbered, supersetSetsByExercise: [renumbered] };
    });
  };

  const handleReorderCalcSets = (fromIdx, toIdx) => {
    setCalcSlot(prev => {
      if (!prev) return prev;
      const arr = [...(prev.sets || [])];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      const renumbered = arr.map((s, i) => ({ ...s, setNumber: i + 1 }));
      return { ...prev, sets: renumbered, supersetSetsByExercise: [renumbered] };
    });
  };

  const convertedOneRepMax = (() => {
    if (!calcSlot || !Array.isArray(calcSlot.sets) || calcSlot.sets.length === 0) return 0;
    const totalCount = calcSlot.sets.length;
    if (lastEditedCalcSetId) {
      const editedSet = calcSlot.sets.find(s => s.id === lastEditedCalcSetId);
      if (editedSet && Number(editedSet.weight) > 0) {
        return compute1RMFromSet(editedSet, totalCount);
      }
    }
    const completedSets = calcSlot.sets.filter(s => s.completed && Number(s.weight) > 0);
    const pool = completedSets.length > 0 ? completedSets : calcSlot.sets;
    let best = 0;
    pool.forEach(s => {
      const est = compute1RMFromSet(s, totalCount);
      if (est > best) best = est;
    });
    return best;
  })();

  const handleSaveConvertedPR = () => {
    if (!calcSlot || convertedOneRepMax <= 0) return;
    const exId = calcSlot.exerciseId;
    const exObj = EXERCISE_MAP[exId] || EXERCISE_LIBRARY[0];
    if (setCustomPrExerciseIds && !displayedPrExerciseIds.includes(exId)) {
      setCustomPrExerciseIds(prev => (prev.includes(exId) ? prev : [...prev, exId]));
    }
    setOneRepMaxes?.(prev => ({
      ...prev,
      [exId]: convertedOneRepMax
    }));

    // Log Personal Record entry to History so Personal Records reflect logged history
    if (setHistory) {
      const cleanDate =
        calcPrDate && String(calcPrDate).trim()
          ? formatDateYMD(calcPrDate)
          : formatTodayYMD();
      const ts = Date.now();
      const prSet = {
        id: `set_pr_${ts}`,
        setNumber: 1,
        type: '1 Rep Max',
        reps: 1,
        lastWeight: convertedOneRepMax,
        increment: 0,
        weight: convertedOneRepMax,
        completed: true
      };
      const prSlot = {
        id: `slot_pr_${ts}`,
        category: normalizeSlotCategory(exObj.category || 'Compound Lift'),
        slotLabel: normalizeSlotCategory(exObj.category || 'Compound Lift'),
        scheme: calcSlot.scheme || '5x5',
        restSeconds: 90,
        muscleGroupFilter: exObj.muscleGroup || 'All Muscles',
        familyMuscleGroup: exObj.muscleGroup || 'Chest',
        exerciseId: exObj.id,
        secondaryExerciseId: null,
        supersetExerciseIds: [exObj.id],
        supersetSetsByExercise: [[prSet]],
        sets: [prSet],
        secondarySets: []
      };
      const newHistEntry = {
        id: `hist_pr_${exObj.id}_${ts}`,
        title: `${cleanDate} - ${exObj.name} PR (${convertedOneRepMax} LB)`,
        loadedRoutineTitle: 'PERSONAL RECORD',
        startedAt: parseYMDToISO(cleanDate),
        updatedAt: new Date().toISOString(),
        isComplete: true,
        verifiedByUser: true,
        defaultRestSeconds: 90,
        slots: normalizeSlotLabels([prSlot])
      };
      setHistory(prev =>
        [newHistEntry, ...(prev || [])].sort(
          (a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime()
        )
      );
    }

    setCalcSlot(null);
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
    <div style={{ paddingTop: '12px', paddingBottom: '36px' }}>
      {/* =================================================================== */}
      {/* 1. PERSONAL RECORDS SECTION (STANDARDIZED WITH ONBOARDING PAGE 3) */}
      {/* =================================================================== */}
      <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: colors?.secondaryLabel || '#A0A0A0',
            marginBottom: '6px',
            textTransform: 'uppercase'
          }}
        >
          PERSONAL RECORDS
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            ...SHARED_GROUP_OUTER
          }}
        >
          {/* + ADD WORKOUT / EXERCISE TO PERSONAL RECORDS (TOP OF STACK, MATCHING + LOG PAST WORKOUT) */}
          {!showAddPrExercisePanel ? (
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
                  height: '38px'
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
                <button
                  type="button"
                  onClick={() => setShowAddPrExercisePanel(false)}
                  style={{
                    backgroundColor: '#FF3B30',
                    color: '#101010',
                    ...SHARED_CELL_BORDER,
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Row 1 Filters: Gym/Equipment, Workout Type, Muscle Group */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 0,
                  height: '40px'
                }}
              >
                <select
                  aria-label="Filter by Gyms/Equipment"
                  value={addPrGymFilter}
                  onChange={e => {
                    const nextGym = e.target.value;
                    setAddPrGymFilter(nextGym);
                    const nextAvailMgs = getAvailableMuscleGroupsForCategory(addPrCategory, nextGym, gyms);
                    const nextMg = nextAvailMgs.includes(activeAddPrMuscle) ? activeAddPrMuscle : 'All Muscles';
                    setAddPrMuscleGroup(nextMg);
                    const nextAvail = filterAddSlotExercises(nextGym, addPrCategory, gyms, nextMg);
                    if (nextAvail.length > 0) setAddPrSelectedExId(nextAvail[0].id);
                  }}
                  style={{
                    width: '100%',
                    height: '40px',
                    backgroundColor: '#141416',
                    color: '#FFFFFF',
                    ...SHARED_CELL_BORDER,
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '0 8px'
                  }}
                >
                  {allGymOptions.map(g => (
                    <option key={g.id || 'full_gym'} value={g.id}>
                      {g.name.toUpperCase()}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by Workout Type"
                  value={addPrCategory}
                  onChange={e => {
                    const nextCat = e.target.value;
                    setAddPrCategory(nextCat);
                    const nextAvailMgs = getAvailableMuscleGroupsForCategory(nextCat, addPrGymFilter, gyms);
                    const nextMg = nextAvailMgs.includes(activeAddPrMuscle) ? activeAddPrMuscle : 'All Muscles';
                    setAddPrMuscleGroup(nextMg);
                    const nextAvail = filterAddSlotExercises(addPrGymFilter, nextCat, gyms, nextMg);
                    if (nextAvail.length > 0) setAddPrSelectedExId(nextAvail[0].id);
                  }}
                  style={{
                    width: '100%',
                    height: '40px',
                    backgroundColor: '#141416',
                    color: '#FFFFFF',
                    ...SHARED_CELL_BORDER,
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '0 8px'
                  }}
                >
                  {['Compound Lift', 'Accessory'].map(cat => (
                    <option key={cat} value={cat}>
                      {cat.toUpperCase()}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by Muscle Group"
                  value={activeAddPrMuscle}
                  onChange={e => {
                    const nextMg = e.target.value;
                    setAddPrMuscleGroup(nextMg);
                    const nextAvail = filterAddSlotExercises(addPrGymFilter, addPrCategory, gyms, nextMg);
                    if (nextAvail.length > 0) setAddPrSelectedExId(nextAvail[0].id);
                  }}
                  style={{
                    width: '100%',
                    height: '40px',
                    backgroundColor: '#141416',
                    color: '#FFFFFF',
                    ...SHARED_CELL_BORDER,
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '0 8px'
                  }}
                >
                  {availAddPrMuscleGroups.map(mg => (
                    <option key={mg} value={mg}>
                      {mg.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 2: Exercise Selector + Add Button */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 96px',
                  gap: 0,
                  height: '42px'
                }}
              >
                <select
                  aria-label="Select Exercise"
                  value={resolvedAddPrExId}
                  onChange={e => setAddPrSelectedExId(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    backgroundColor: '#141416',
                    color: '#FFFFFF',
                    ...SHARED_CELL_BORDER,
                    fontSize: '13px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '0 8px'
                  }}
                >
                  {filteredAddPrExercises.map(ex => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name.toUpperCase()} ({ex.equipment.toUpperCase()})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (resolvedAddPrExId) {
                      setCustomPrExerciseIds(prev =>
                        prev.includes(resolvedAddPrExId)
                          ? prev
                          : [...prev, resolvedAddPrExId]
                      );
                      setShowAddPrExercisePanel(false);
                    }
                  }}
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    backgroundColor: 'var(--dp-color-accent)',
                    color: '#000000',
                    ...SHARED_CELL_BORDER,
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  + ADD
                </button>
              </div>
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
                  gridTemplateColumns: 'minmax(0, 1fr) 96px 96px',
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
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {ex.name}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: colors?.secondaryLabel || '#A0A0A0',
                      marginTop: '1px'
                    }}
                  >
                    {isTBD
                      ? `${targetStandardClass.toUpperCase()} GOAL: ${goal1RM} LB`
                      : diffFromGoal > 0
                        ? `${targetStandardClass.toUpperCase()} GOAL: ${goal1RM} LB (${diffFromGoal} LB TO GOAL)`
                        : `${targetStandardClass.toUpperCase()} GOAL: ${goal1RM} LB (ACHIEVED +${Math.abs(diffFromGoal)} LB)`}
                  </div>
                </div>

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
                      ? '#FF3B30'
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
                        fontSize: '9px',
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
              </div>
            );
          })}
        </div>
      </section>

      {/* =================================================================== */}
      {/* 2. HISTORY SECTION (STANDARDIZED SIZE, FONT & SHARED BORDERS) */}
      {/* =================================================================== */}
      <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: colors?.secondaryLabel || '#A0A0A0',
            marginBottom: '6px',
            textTransform: 'uppercase'
          }}
        >
          HISTORY ({totalSessions})
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            ...SHARED_GROUP_OUTER
          }}
        >
          {/* + LOG PAST WORKOUT & IMPORT BUTTONS (SPLIT INTO 2 COLUMNS) */}
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
              NO SESSIONS LOGGED YET.
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
                        gridTemplateColumns: 'minmax(0, 1fr) 48px 48px',
                        gap: 0,
                        alignItems: 'stretch',
                        backgroundColor: isExp ? '#1C1C20' : '#141416'
                      }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedHistoryWorkoutId(isExp ? null : w.id)}
                        onKeyDown={e => {
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
                          cursor: 'pointer',
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
                                fontSize: '10px',
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
                            fontSize: '10px',
                            fontWeight: 700,
                            color: colors?.secondaryLabel || '#A0A0A0',
                            marginTop: '1px'
                          }}
                        >
                          {formatDateYMD(w.startedAt)} • {(w.slots || []).length} EXERCISES
                        </div>
                      </div>

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
                        style={{
                          width: '48px',
                          minHeight: '48px',
                          boxSizing: 'border-box',
                          backgroundColor: '#FF3B30',
                          color: '#101010',
                          ...SHARED_CELL_BORDER,
                          fontSize: '13px',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    {isExp && editorProps && (
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
                      fontSize: '10px',
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

      {/* =================================================================== */}
      {/* 1RM CONVERTER POPUP MODAL (NEW/CURRENT SESSION EXERCISE INTERFACE) */}
      {/* =================================================================== */}
      {calcSlot && (() => {
        const normCat = normalizeSlotCategory(calcSlot.category);
        const ex1 = EXERCISE_MAP[calcSlot.exerciseId] || EXERCISE_LIBRARY[0];
        const availMuscleGroups = getAvailableMuscleGroupsForCategory(normCat, selectedGymId, gyms);
        const rawSlotMuscle = calcSlot.muscleGroupFilter || ex1?.muscleGroup || 'All Muscles';
        const activeMuscleFilter = availMuscleGroups.includes(rawSlotMuscle)
          ? rawSlotMuscle
          : 'All Muscles';
        const inlineExercisePool = getFilteredExercisesForSlotInline(
          { ...calcSlot, muscleGroupFilter: activeMuscleFilter },
          selectedGymId,
          gyms
        );
        const singleSelectPool =
          inlineExercisePool.some(e => e.id === calcSlot.exerciseId) || !ex1
            ? inlineExercisePool
            : [ex1, ...inlineExercisePool];
        const slot1RMText =
          convertedOneRepMax > 0
            ? `1RM: ${convertedOneRepMax} LB`
            : '1RM: TBD';

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1200,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px'
            }}
            onClick={() => setCalcSlot(null)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '460px',
                maxHeight: '90vh',
                overflowY: 'auto',
                backgroundColor: '#121214',
                ...SHARED_GROUP_OUTER
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Exercise Header: 34px Left Drag/Number + 2-Row Controls + 34px Full-Height Red X */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '34px minmax(0, 1fr) 34px',
                  gap: 0,
                  alignItems: 'stretch'
                }}
              >
                <CalcModalDragBadge
                  label={1}
                  color="var(--dp-color-accent)"
                  height="100%"
                  bg="#18181B"
                  title="Exercise 1RM Calculator"
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
                  {/* Row 1: Category Slot + Muscle Group Filter + Scheme Selection */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: 0,
                      height: '40px'
                    }}
                  >
                    <select
                      aria-label="Exercise Category"
                      value={normCat}
                      onChange={e => handleUpdateCalcSlotHeader({ category: e.target.value })}
                      style={{
                        width: '100%',
                        minWidth: 0,
                        height: '40px',
                        boxSizing: 'border-box',
                        fontSize: '13px',
                        fontWeight: 800,
                        padding: '0 8px',
                        backgroundColor: 'var(--dp-color-accent)',
                        color: '#101010',
                        ...SHARED_CELL_BORDER,
                        textTransform: 'uppercase',
                        cursor: 'pointer'
                      }}
                    >
                      {SLOT_CATEGORIES.filter(c => c !== 'Superset').map(cat => (
                        <option key={cat} value={cat}>
                          {cat.toUpperCase()}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Muscle Group Filter"
                      value={activeMuscleFilter}
                      onChange={e => handleUpdateCalcSlotHeader({ muscleGroupFilter: e.target.value })}
                      style={{
                        width: '100%',
                        minWidth: 0,
                        height: '40px',
                        boxSizing: 'border-box',
                        fontSize: '13px',
                        fontWeight: 800,
                        padding: '0 8px',
                        backgroundColor: '#161618',
                        color: '#FFFFFF',
                        ...SHARED_CELL_BORDER,
                        textTransform: 'uppercase',
                        cursor: 'pointer'
                      }}
                    >
                      {availMuscleGroups.map(mg => (
                        <option key={mg} value={mg}>
                          {mg.toUpperCase()}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Set and Rep Scheme"
                      value={calcSlot.scheme || '5x5'}
                      onChange={e => handleUpdateCalcSlotHeader({ scheme: e.target.value })}
                      style={{
                        width: '100%',
                        minWidth: 0,
                        height: '40px',
                        boxSizing: 'border-box',
                        fontSize: '13px',
                        fontWeight: 800,
                        padding: '0 8px',
                        backgroundColor: '#161618',
                        color: '#FFFFFF',
                        ...SHARED_CELL_BORDER,
                        textTransform: 'uppercase',
                        cursor: 'pointer'
                      }}
                    >
                      {SCHEME_OPTIONS.map(scm => (
                        <option key={scm} value={scm}>
                          {scm.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Row 2: Exercise Selection + Date Entry Box */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: 0,
                      height: '40px'
                    }}
                  >
                    <select
                      aria-label="Select Exercise"
                      value={calcSlot.exerciseId}
                      onChange={e => handleUpdateCalcSlotHeader({ exerciseId: e.target.value })}
                      style={{
                        gridColumn: 'span 2',
                        width: '100%',
                        minWidth: 0,
                        height: '40px',
                        boxSizing: 'border-box',
                        backgroundColor: '#141416',
                        color: '#FFFFFF',
                        ...SHARED_CELL_BORDER,
                        padding: '0 8px',
                        fontSize: '13px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        cursor: 'pointer'
                      }}
                    >
                      {singleSelectPool.map(ex => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name.toUpperCase()} ({ex.equipment.toUpperCase()})
                        </option>
                      ))}
                    </select>

                    {/* Column 3: Date Entry Box */}
                    <input
                      type="text"
                      aria-label="Personal Record Date (YYYY/MM/DD)"
                      placeholder="YYYY/MM/DD"
                      value={calcPrDate}
                      onChange={e => setCalcPrDate(e.target.value.replace(/-/g, '/'))}
                      style={{
                        width: '100%',
                        minWidth: 0,
                        height: '40px',
                        boxSizing: 'border-box',
                        backgroundColor: '#18181B',
                        ...SHARED_CELL_BORDER,
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: 800,
                        color: 'var(--dp-color-accent)',
                        textTransform: 'uppercase',
                        outline: 'none',
                        padding: '0 4px'
                      }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Close calculator"
                  onClick={() => setCalcSlot(null)}
                  className="kinetic-btn"
                  style={{
                    ...UI.deleteXBtn,
                    width: '34px',
                    height: '100%',
                    minHeight: '80px',
                    fontSize: '14px',
                    ...SHARED_CELL_BORDER,
                    boxSizing: 'border-box'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Always-Expanded Sets Content (Same as Session Page) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {(calcSlot.sets || []).map((st, sIdxInEx) => {
                  const totalExSets = (calcSlot.sets || []).length;
                  const curType = normalizeSetType(st.type);
                  const effInc = getEffectiveIncrementForExercise(calcSlot.exerciseId, currentIncrementLbs);
                  const base1RM = Number(oneRepMaxes?.[calcSlot.exerciseId]) || ex1?.default1RM || 135;
                  const lastW =
                    st.lastWeight !== undefined
                      ? st.lastWeight
                      : calculateLastEquivalentWeightForSet(base1RM, st, totalExSets, normCat, sIdxInEx, calcSlot.scheme);
                  const setIncValue =
                    st.increment !== undefined
                      ? st.increment
                      : curType === '1 Rep Max' && calcSlot.scheme !== 'Pyramid 1RM'
                        ? 0
                        : Math.round(((Number(st.weight) || 0) - (Number(lastW) || 0)) * 100) / 100 || effInc;
                  const cellBg = st.completed ? '#16291B' : '#141416';

                  return (
                    <div
                      key={st.id}
                      draggable={true}
                      onDragStart={() => setDraggedCalcSetIdx(sIdxInEx)}
                      onDragOver={e => {
                        if (draggedCalcSetIdx !== null) e.preventDefault();
                      }}
                      onDrop={e => {
                        e.preventDefault();
                        if (draggedCalcSetIdx !== null && draggedCalcSetIdx !== sIdxInEx) {
                          handleReorderCalcSets(draggedCalcSetIdx, sIdxInEx);
                        }
                        setDraggedCalcSetIdx(null);
                      }}
                      onDragEnd={() => setDraggedCalcSetIdx(null)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '34px minmax(0, 1fr) 34px',
                        gap: 0,
                        alignItems: 'stretch',
                        opacity: draggedCalcSetIdx === sIdxInEx ? 0.55 : 1
                      }}
                    >
                      <CalcModalDragBadge
                        label={st.setNumber}
                        color="#FFFFFF"
                        height="100%"
                        bg={cellBg}
                        title="Click and drag to rearrange set"
                      />

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            '78px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.15fr) 50px 44px',
                          gap: 0,
                          alignItems: 'stretch'
                        }}
                      >
                        {/* 1. Set Type Selector */}
                        <select
                          aria-label="Set Type"
                          value={curType}
                          onChange={e => handleUpdateCalcSet(st.id, 'type', e.target.value)}
                          style={{
                            width: '100%',
                            minWidth: 0,
                            height: '44px',
                            boxSizing: 'border-box',
                            backgroundColor: cellBg,
                            color: '#FFFFFF',
                            ...SHARED_CELL_BORDER,
                            padding: '0 4px',
                            fontSize: '11px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            cursor: 'pointer'
                          }}
                        >
                          {SET_TYPES_LIST.map(t => (
                            <option key={t} value={t}>
                              {t.toUpperCase()}
                            </option>
                          ))}
                        </select>

                        {/* 2. LAST Weight Box */}
                        <div
                          style={{
                            width: '100%',
                            minWidth: 0,
                            height: '44px',
                            boxSizing: 'border-box',
                            backgroundColor: cellBg,
                            ...SHARED_CELL_BORDER,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            userSelect: 'none'
                          }}
                        >
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#9A9A9A', lineHeight: 1 }}>
                            LAST
                          </span>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#C8C8C8', lineHeight: 1.2, marginTop: '1px' }}>
                            {lastW}
                          </span>
                        </div>

                        {/* 3. INC Box */}
                        <div
                          style={{
                            width: '100%',
                            minWidth: 0,
                            height: '44px',
                            boxSizing: 'border-box',
                            backgroundColor: cellBg,
                            ...SHARED_CELL_BORDER,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 2px'
                          }}
                        >
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#9A9A9A', lineHeight: 1 }}>
                            INC
                          </span>
                          <input
                            type="number"
                            step="2.5"
                            value={setIncValue}
                            onChange={e => handleUpdateCalcSet(st.id, 'increment', e.target.value)}
                            style={{
                              width: '100%',
                              textAlign: 'center',
                              fontSize: '14px',
                              fontWeight: 800,
                              color: '#FFFFFF',
                              backgroundColor: 'transparent',
                              border: 'none',
                              outline: 'none',
                              padding: 0,
                              marginTop: '1px'
                            }}
                          />
                        </div>

                        {/* 4. CURRENT Weight Button (Opens Weight Selection Pop-Up) */}
                        <button
                          type="button"
                          onClick={() => {
                            if (openPlateCalculatorForSet) {
                              openPlateCalculatorForSet(
                                calcSlot.id,
                                0,
                                st,
                                ex1.name,
                                newWeight =>
                                  handleUpdateCalcSet(
                                    st.id,
                                    'weight',
                                    Math.max(0, Number(newWeight) || 0)
                                  )
                              );
                            }
                          }}
                          style={{
                            width: '100%',
                            minWidth: 0,
                            height: '44px',
                            boxSizing: 'border-box',
                            padding: '0 2px',
                            backgroundColor: cellBg,
                            ...SHARED_CELL_BORDER,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden'
                          }}
                        >
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#9A9A9A', lineHeight: 1 }}>
                            CURRENT
                          </span>
                          <span
                            style={{
                              fontSize: '15px',
                              fontWeight: 800,
                              color: 'var(--dp-color-accent)',
                              lineHeight: 1.2,
                              marginTop: '1px'
                            }}
                          >
                            {st.weight}
                          </span>
                        </button>

                        {/* 5. REPS Input */}
                        <div
                          style={{
                            width: '100%',
                            minWidth: 0,
                            height: '44px',
                            boxSizing: 'border-box',
                            backgroundColor: cellBg,
                            color: '#FFFFFF',
                            ...SHARED_CELL_BORDER,
                            padding: '0 2px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#9A9A9A', lineHeight: 1 }}>
                            REPS
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={st.reps}
                            onChange={e => handleUpdateCalcSet(st.id, 'reps', Math.max(1, Number(e.target.value) || 1))}
                            style={{
                              width: '100%',
                              textAlign: 'center',
                              fontSize: '15px',
                              fontWeight: 800,
                              color: '#FFFFFF',
                              backgroundColor: 'transparent',
                              border: 'none',
                              outline: 'none',
                              padding: 0,
                              marginTop: '1px'
                            }}
                          />
                        </div>

                        {/* 6. Grey/Green Checkmark Button */}
                        <button
                          type="button"
                          aria-label="Mark set complete"
                          onClick={() => handleUpdateCalcSet(st.id, 'completed', !st.completed)}
                          style={{
                            width: '44px',
                            height: '44px',
                            boxSizing: 'border-box',
                            padding: 0,
                            backgroundColor: st.completed ? '#30D158' : '#242428',
                            color: st.completed ? '#101010' : '#9A9A9A',
                            ...SHARED_CELL_BORDER,
                            fontSize: '17px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          ✓
                        </button>
                      </div>

                      {/* Outside Red Set Delete "✕" Button */}
                      <button
                        type="button"
                        aria-label="Delete set"
                        onClick={() => handleDeleteCalcSet(st.id)}
                        className="kinetic-btn"
                        style={{
                          ...UI.deleteXBtn,
                          width: '34px',
                          height: '100%',
                          minHeight: '44px',
                          fontSize: '14px',
                          ...SHARED_CELL_BORDER,
                          boxSizing: 'border-box'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}

                {/* Bottom Row: + Add Set Top, + Add Set Bottom, and Bright Green CALCULATE 1RM */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 0
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleInsertCalcSet('top')}
                    className="kinetic-btn"
                    style={{
                      height: '40px',
                      boxSizing: 'border-box',
                      padding: '0 8px',
                      backgroundColor: '#161618',
                      color: '#FFFFFF',
                      ...SHARED_CELL_BORDER,
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer'
                    }}
                  >
                    + ADD SET TOP
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertCalcSet('bottom')}
                    className="kinetic-btn"
                    style={{
                      height: '40px',
                      boxSizing: 'border-box',
                      padding: '0 8px',
                      backgroundColor: '#161618',
                      color: 'var(--dp-color-accent)',
                      ...SHARED_CELL_BORDER,
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer'
                    }}
                  >
                    + ADD SET BOTTOM
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveConvertedPR}
                    className="kinetic-btn"
                    style={{
                      height: '40px',
                      boxSizing: 'border-box',
                      padding: '0 8px',
                      backgroundColor: '#30D158',
                      color: '#000000',
                      ...SHARED_CELL_BORDER,
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer'
                    }}
                  >
                    CALCULATE 1RM
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
            padding: '12px'
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
                    fontSize: '10px',
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
              <button
                type="button"
                onClick={() => setShowImportCsvModal(false)}
                className="kinetic-btn"
                style={{
                  ...UI.deleteXBtn,
                  width: '34px',
                  height: '34px',
                  fontSize: '14px'
                }}
              >
                ✕
              </button>
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
                fontSize: '10px',
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
                  marginBottom: '10px',
                  textTransform: 'uppercase'
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
