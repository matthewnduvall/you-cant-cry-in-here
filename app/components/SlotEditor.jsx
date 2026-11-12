'use client';

// ============================================================================
// SHARED EXERCISE SLOT EDITOR
// One exercise slot (or superset) with its set rows, used by the session/routine editor, the
// History 1RM calculator. Set values are edited through the shared pop-ups
// (SetValueEditorModal + PlateCalculatorModal) via callbacks, so each host decides where the
// edits are written.
// ============================================================================

import React, { useState } from 'react';
import { SHARED_CELL_BORDER, SHARED_GROUP_OUTER } from '../styles/kineticTokens';
import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  SLOT_CATEGORIES,
  normalizeSlotCategory,
  isSupersetCategory,
  getFilteredExercisesForSlotInline,
  getAvailableMuscleGroupsForCategory,
  doesExerciseInteractWithMuscleGroup,
  stripEquipmentFromExerciseName,
  isBandEquipment,
  getSetBandColor,
  BAND_COLORS,
  BAND_COLOR_HEX,
  getExerciseEquipmentOptions,
  getAllEquipmentFilterOptions,
  getUniqueShortExerciseNames,
  findClosestExerciseInPool,
  normalizeMuscleGroupName
} from '../data/exerciseLibrary';
import {
  SCHEME_OPTIONS,
  isClusterScheme,
  normalizeSetType,
  getBestHistory1RMInfo,
  best1RMInfoOfSets,
  oneRepMaxLabel,
  getLastLoggedSetsForExercise,
  PYRAMID_SCHEMES,
  getSchemeUniformReps,
  getSetTimerMMSS,
  getLastLoggedTimerDisplay,
  getSupersetSchemes,
  SET_TYPES_LIST
} from '../utils/workoutEngine';
import { DeleteButton, DragNumberBadge } from './Controls';
import { usePointerReorder } from '../hooks/usePointerReorder';


export const headerSelectStyle = {
  width: '100%',
  minWidth: 0,
  height: '40px',
  boxSizing: 'border-box',
  fontSize: '12px',
  fontWeight: 800,
  padding: '0 4px 0 6px',
  // Filter surface (see .kinetic-filter-select): lighter than the set rows below
  backgroundColor: '#26262B',
  color: '#FFFFFF',
  ...SHARED_CELL_BORDER,
  textTransform: 'uppercase',
  cursor: 'pointer'
};

const setCellStyle = cellBg => ({
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
  padding: '0 2px',
  whiteSpace: 'nowrap'
});

const cellLabelStyle = { fontSize: '11px', fontWeight: 800, color: '#9A9A9A', lineHeight: 1 };
const cellValueStyle = (color = '#FFFFFF', size = '15px') => ({
  fontSize: size,
  fontWeight: 800,
  color,
  lineHeight: 1.2,
  marginTop: '1px'
});

const bottomBtnStyle = (bg, color) => ({
  height: '40px',
  boxSizing: 'border-box',
  padding: '0 4px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  backgroundColor: bg,
  color,
  ...SHARED_CELL_BORDER,
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  cursor: 'pointer'
});

const equipmentOf = ex => ex?.equipment || 'Bodyweight';

// Calculated 1RM of a list of sets: the best weight × (1 + reps / 30) (1 rep = the weight), the estimate History
// uses for Personal Records and the weight pop-up uses for its 1RM box; 0 = no weights
// ({ value, calculated }: calculated = from a multi-rep set, shown with *)
const best1RM = sets => best1RMInfoOfSets(Array.isArray(sets) ? sets : []);

// Set type dropdown labels (short enough for the set row's type column)
const SET_TYPE_LABELS = { Warmup: 'WARMUP', Working: 'WORKING', 'Top Out': 'TOP OUT', 'Burn Out': 'BURN OUT', '1 Rep Max': '1RM' };

// The results list scrolls, so it can hold plenty
const SEARCH_RESULT_LIMIT = 40;

// Each superset exercise is a Compound or Accessory pick; this value in its type menu ends the superset
const SUPERSET_HALF_CATEGORIES = ['Compound', 'Accessory'];

// Width of the lock button at the left of a set's type / weight / reps cell (6 px gap before the padlock)
const LOCK_COL_PX = 20;

// Padlock for the set type / weight / reps lock buttons (closed shackle = locked)
const LockIcon = ({ locked, color }) => (
  <svg width="10" height="12" viewBox="0 0 12 14" aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x="1" y="6" width="10" height="7.5" fill={color} />
    <path
      d={locked ? 'M3.5 6V4.2a2.5 2.5 0 0 1 5 0V6' : 'M3.5 6V4.2a2.5 2.5 0 0 1 5 0'}
      fill="none"
      stroke={color}
      strokeWidth="1.6"
    />
  </svg>
);

/**
 * Exercises whose name / equipment / muscle group contain every word typed, best matches first: a name that starts
 * with the text, then one with a word starting with it, then one containing it, then equipment / muscle matches.
 * Within each, the plainest names first (shortest name without the equipment word: "Lateral Raise" before
 * "Hanging Pike (Toes-to-Bar) Leg Raise"), then priority / hand-picked exercises. Searches the whole library (the
 * Equipment page list only drives the exercises picked automatically); up to SEARCH_RESULT_LIMIT, in a scrolling list.
 */
export const searchExercises = (query, pool = EXERCISE_LIBRARY) => {
  const words = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const phrase = words.join(' ');
  const rank = ex => {
    const name = ex.name.toLowerCase();
    const short = stripEquipmentFromExerciseName(ex.name).toLowerCase();
    // Exactly another name it goes by ("squat" = Barbell Back Squat): first
    if ((ex.aliases || []).some(alias => alias.toLowerCase() === phrase)) return -1;
    if (name.startsWith(phrase) || short.startsWith(phrase)) return 0;
    // Another name it goes by ("RDL", "Dips")
    if ((ex.aliases || []).some(alias => alias.toLowerCase().startsWith(phrase))) return 0;
    // A word in the name starts with the text ("raise" in "Lateral Raise")
    const at = name.indexOf(phrase);
    if (at > 0 && name.split(/[^a-z0-9]+/).some(word => word.startsWith(words[0]))) return 1;
    if (name.includes(phrase)) return 2;
    return 3;
  };
  const plainLength = ex => stripEquipmentFromExerciseName(ex.name).length;
  const curated = ex => (String(ex.id).startsWith('exrx_') ? 0 : 1);
  return pool
    .filter(ex => {
      const hay = `${ex.name} ${(ex.aliases || []).join(' ')} ${ex.equipment || ''} ${ex.muscleGroup || ''}`.toLowerCase();
      return words.every(w => hay.includes(w));
    })
    .map(ex => ({ ex, r: rank(ex), len: plainLength(ex) }))
    .sort(
      (a, b) =>
        a.r - b.r ||
        a.len - b.len ||
        Number(Boolean(b.ex.isPriority)) - Number(Boolean(a.ex.isPriority)) ||
        curated(b.ex) - curated(a.ex) ||
        a.ex.name.localeCompare(b.ex.name)
    )
    .slice(0, SEARCH_RESULT_LIMIT)
    .map(item => item.ex);
};

export function SearchGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="10.2" y1="10.2" x2="15" y2="15" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function PrBadge({ marginRight = '6px' }) {
  return (
    <span
      style={{
        backgroundColor: '#30D158',
        color: '#101010',
        fontSize: '11px',
        fontWeight: 900,
        padding: '1px 5px',
        lineHeight: 1.2,
        marginRight,
        flexShrink: 0
      }}
    >
      PR
    </span>
  );
}

/**
 * Props
 * - slot: the workout slot ({ category, scheme, exerciseId, sets, supersetExerciseIds, ... })
 * - number: label on the header drag handle; headerTitle: its tooltip
 * - categories: category options (default all; the 1RM calculator excludes Superset)
 * - The pickers, equipment filter and search always cover the whole exercise library; the athlete's
 *   the Equipment page list only drives the default picks made by the hosts (see useWorkoutMutations).
 * - history: LAST in the weight pop-up (that set's weight in the last logged session of the exercise, 0 if never
 *   logged) and the 1RM box (PR). workoutId: the workout being edited, left out of LAST
 * - prFlags: [bool, bool] shows PR badges next to the exercise picker(s)
 * - onHeaderChange(changes): { category | muscleGroupFilter | scheme | exerciseId }. Supersets add
 *   supersetHalf (0 = A, 1 = B) to say which exercise changed. A half's type menu reads SUPERSET; picking another
 *   type sends { endSuperset: otherHalf, category } (that exercise stays, as that type; the other is removed).
 * - onRemove / removeLabel: red DELETE button at the end of the bottom row (omit to hide it)
 * - onEditSetValue({ mode, exIdx, set, exercise, currentValue }): mode = type | increment | reps | timer
 * - onEditWeight({ exIdx, set, exercise, exerciseId, equipment, lastDisplay, showOneRepMax, setReps, prValue,
 *   prWorkoutId }): CURRENT weight pop-up; LAST and the 1RM box (PR / CURRENT, links to the PR's History entry)
 *   are shown there; no 1RM box for Timer sets
 * - onSetBandColor({ exIdx, set, color }): band exercises show RED / PURPLE instead of a weight; tapping the
 *   cell switches colour
 * - onChangeSetType({ exIdx, set, type }): the set row's type dropdown (without it: onEditSetValue mode 'type')
 * - onToggleDone({ exIdx, set }), onDeleteSet({ exIdx, set, exercise })
 * - onReorderSets(exIdx, fromIdx, toIdx), onInsertSet('top' | 'bottom')
 * - actionLabel / onAction / actionTone ('recalculate' | 'calculate'): third bottom button
 * - footer: optional node rendered between the sets and the bottom row
 * - onToggleSetLock({ exIdx, set, field: 'type' | 'weight' | 'reps' }): a lock at the left of each set's type, weight
 *   and reps (shown only with this callback). RECALCULATE never changes a locked value
 */
export function SlotEditor({
  slot,
  number = 1,
  headerTitle = 'Drag to rearrange exercise',
  // Pointer-drag props for the exercise's numbered handle (from the host's usePointerReorder)
  dragHandleProps,
  categories = SLOT_CATEGORIES,
  history = [],
  workoutId = null,
  prFlags = [false, false],
  onHeaderChange,
  onRemove,
  removeLabel = 'Remove exercise',
  onEditSetValue,
  onEditWeight,
  onSetBandColor,
  onToggleDone,
  onDeleteSet,
  onReorderSets,
  onInsertSet,
  actionLabel = 'RECALCULATE',
  onAction,
  actionTone = 'recalculate',
  footer = null,
  onToggleSetLock,
  onChangeSetType
}) {
  // Drag a set's numbered handle to reorder sets (pointer events: works with touch). Keys are 'exIdx:setIdx';
  // superset sets only move within their own exercise.
  const { handleProps: setHandleProps, rowDragStyle: setDragStyle } = usePointerReorder(
    (from, to) => {
      const [fromEx, fromIdx] = String(from).split(':').map(Number);
      const [toEx, toIdx] = String(to).split(':').map(Number);
      if (fromEx === toEx && fromIdx !== toIdx) onReorderSets?.(fromEx, fromIdx, toIdx);
    },
    { attribute: 'data-set-reorder', canDrop: (from, to) => from.split(':')[0] === to.split(':')[0], edgeTop: 190 }
  );
  // null = search closed; { half, query } = the search box of that exercise (0 = A / single, 1 = B) is open
  const [search, setSearch] = useState(null);

  const normCat = normalizeSlotCategory(slot.category);
  const isSuperset = isSupersetCategory(normCat);
  const halves = isSuperset ? [0, 1] : [0];

  const supIds = isSuperset
    ? [
        slot.supersetExerciseIds?.[0] || slot.exerciseId || 'reverse_lunge',
        slot.supersetExerciseIds?.[1] || slot.secondaryExerciseId || 'front_flies'
      ]
    : [slot.exerciseId];
  const schemes = isSuperset ? getSupersetSchemes(slot) : [slot.scheme || '5x8'];

  // One picker per exercise. A superset is two full pickers (type, muscle, equipment, exercise, scheme).
  const pickerState = half => {
    const exId = supIds[half];
    const exObj = EXERCISE_MAP[exId] || EXERCISE_LIBRARY[0];
    let category = normCat;
    if (isSuperset) {
      const cat = normalizeSlotCategory(slot.supersetCategories?.[half] || exObj.category || 'Accessory');
      category = isSupersetCategory(cat) ? 'Accessory' : cat;
    }
    const availMuscles = getAvailableMuscleGroupsForCategory(category, '', []);
    const rawMuscle =
      normalizeMuscleGroupName(
        (isSuperset ? slot.supersetMuscleFilters?.[half] : slot.muscleGroupFilter) || exObj.muscleGroup || 'All Muscles'
      );
    const muscle = availMuscles.includes(rawMuscle) ? rawMuscle : 'All Muscles';
    const basePool = getFilteredExercisesForSlotInline({ category, muscleGroupFilter: muscle }, '', []).filter(
      ex => !isSuperset || ex.id !== supIds[1 - half]
    );
    const pool = basePool.some(ex => ex.id === exId) ? basePool : [exObj, ...basePool];
    // The athlete's equipment choice for this exercise; must be one the exercise allows ("A / B" = either)
    const exEquipment = equipmentOptionsOf(exObj);
    const savedEquipment = isSuperset ? slot.supersetEquipmentFilters?.[half] : slot.equipmentFilter;
    const equipment = exEquipment.includes(savedEquipment) ? savedEquipment : exEquipment[0];
    return { exId, exObj, category, availMuscles, muscle, pool, equipment, scheme: schemes[half] };
  };

  // Equipment options of an exercise ("A / B" = either works)
  const equipmentOptionsOf = ex => getExerciseEquipmentOptions(ex);

  const sendHeaderChange = (half, changes) =>
    onHeaderChange?.(isSuperset ? { ...changes, supersetHalf: half } : changes);

  // Superset sets alternate A1, B1, A2, B2, ...
  const rows = [];
  if (isSuperset) {
    const listA = slot.supersetSetsByExercise?.[0] || slot.sets || [];
    const listB = slot.supersetSetsByExercise?.[1] || slot.secondarySets || [];
    for (let i = 0; i < Math.max(listA.length, listB.length); i++) {
      if (listA[i]) rows.push({ exIdx: 0, exId: supIds[0], set: listA[i], setIdx: i, total: listA.length });
      if (listB[i]) rows.push({ exIdx: 1, exId: supIds[1], set: listB[i], setIdx: i, total: listB.length });
    }
  } else {
    (slot.sets || []).forEach((st, i, arr) =>
      rows.push({ exIdx: 0, exId: slot.exerciseId, set: st, setIdx: i, total: arr.length })
    );
  }

  // Search result → that exercise, its muscle group and its type (Compound / Accessory)
  const handleSearchPick = (half, ex) => {
    setSearch(null);
    if (!ex) return;
    const current = pickerState(half);
    const exEquipment = equipmentOptionsOf(ex);
    // Equipment named in the search ("landmine row", "ez curl") wins, then the current choice, then the
    // exercise's first. A typed word counts when it is the whole equipment name or its first word ("ez").
    const lettersOnly = text => String(text || '').toLowerCase().replace(/[^a-z]/g, '');
    const typed = lettersOnly(search?.query);
    const typedWords = String(search?.query || '')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(word => word.length >= 2);
    const namedInSearch = exEquipment.find(
      eq =>
        (typed && typed.includes(lettersOnly(eq))) ||
        typedWords.includes(lettersOnly(String(eq).split(/[\s/-]+/)[0]))
    );
    const changes = {
      exerciseId: ex.id,
      muscleGroupFilter: ex.muscleGroup || 'All Muscles',
      equipmentFilter:
        namedInSearch || (exEquipment.includes(current.equipment) ? current.equipment : exEquipment[0])
    };
    const exCategory = normalizeSlotCategory(ex.category);
    const allowed = isSuperset ? SUPERSET_HALF_CATEGORIES : categories;
    if (allowed.includes(exCategory) && exCategory !== current.category) changes.category = exCategory;
    sendHeaderChange(half, changes);
  };

  const searchResults = search?.query ? searchExercises(search.query) : [];

  // The exercises the filters (type, muscle group, equipment) allow for one half, with their short names
  const filteredExercises = half => {
    const { pool, equipment } = pickerState(half);
    const list = pool.filter(ex => equipmentOptionsOf(ex).includes(equipment));
    const shortNames = getUniqueShortExerciseNames(list, equipment);
    return { list, nameOf: ex => shortNames[ex.id] || stripEquipmentFromExerciseName(ex.name) };
  };

  // Row 1: the exercise's name, which is also the search box. Tapping it lists the exercises the filters allow;
  // typing searches the whole library.
  const renderTitleCell = half => {
    const tag = isSuperset ? (half === 0 ? 'A' : 'B') : '';
    const ariaLabel = isSuperset ? `Exercise ${tag}: tap to search or change` : 'Exercise: tap to search or change';
    const { exObj, equipment } = pickerState(half);
    const { list, nameOf } = filteredExercises(half);
    const title = (list.some(ex => ex.id === exObj.id) ? nameOf(exObj) : stripEquipmentFromExerciseName(exObj.name)) || exObj.name;
    const showEquipment = equipment && equipment !== 'Bodyweight' && !isBandEquipment(equipment);
    const cellBase = {
      ...headerSelectStyle,
      gridColumn: '1 / 7',
      gridRow: 1,
      height: '44px',
      padding: '0 10px',
      fontSize: '14px'
    };
    if (search?.half !== half) {
      // 1RM box on the right of the row (same estimate as History's PRs and the weight pop-up's 1RM box):
      // LAST = last logged session of the exercise; NOW = this exercise's sets here; PR = best ever logged
      const exSets = (isSuperset ? slot.supersetSetsByExercise?.[half] : slot.sets) || [];
      const lastSession = getLastLoggedSetsForExercise(exObj.id, history, workoutId);
      const lastDone = lastSession.filter(st => st && st.completed && Number(st.weight) > 0);
      const lastInfo = best1RM(lastDone.length > 0 ? lastDone : lastSession);
      // Timer sets count seconds, not reps
      const nowInfo = schemes[half] === 'Timer' ? { value: 0, calculated: false } : best1RM(exSets);
      const prInfoHeader = getBestHistory1RMInfo(exObj.id, history);
      const last1RM = lastInfo.value;
      const now1RM = nowInfo.value;
      const pr1RM = prInfoHeader.best;
      // * = calculated from reps (not lifted for 1 rep)
      const statCell = (label, value, color = '#C8C8C8', calculated = false) => (
        <div
          style={{
            flex: '1 1 0',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderLeft: '1px solid var(--dp-color-rule)'
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#8E8E93', lineHeight: 1 }}>{label}</span>
          <span style={{ fontSize: '13px', fontWeight: 800, color: value > 0 ? color : '#6E6E73', lineHeight: 1.2, marginTop: '2px' }}>
            {value > 0 ? oneRepMaxLabel(value, calculated) : '—'}
          </span>
        </div>
      );
      return (
        <>
          <button
            type="button"
            aria-label={ariaLabel}
            onClick={() => setSearch({ half, query: '' })}
            style={{
              ...cellBase,
              gridColumn: '1 / 5',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 8px',
              fontSize: '13px',
              textAlign: 'left',
              overflow: 'hidden'
            }}
          >
            {tag && <span style={{ color: half === 0 ? 'var(--dp-color-accent)' : '#C0C0C0', flexShrink: 0 }}>{tag}</span>}
            {/* Up to two lines, then … */}
            <span
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.15,
                wordBreak: 'break-word'
              }}
            >
              {title.toUpperCase()}
              {showEquipment && <span style={{ color: '#8E8E93', fontSize: '11px' }}> · {equipment.toUpperCase()}</span>}
            </span>
            {prFlags[half] && <PrBadge marginRight="0" />}
            <span style={{ color: '#A0A0A0', display: 'flex', flexShrink: 0 }}>
              <SearchGlyph />
            </span>
          </button>
          <div
            role="group"
            aria-label={`1 rep max (an asterisk means calculated from reps): last session ${last1RM ? oneRepMaxLabel(last1RM, lastInfo.calculated) : 'none'}, now ${now1RM ? oneRepMaxLabel(now1RM, nowInfo.calculated) : 'none'}, record ${pr1RM ? oneRepMaxLabel(pr1RM, prInfoHeader.calculated) : 'none'}`}
            style={{
              gridColumn: '5 / 7',
              gridRow: 1,
              height: '44px',
              boxSizing: 'border-box',
              backgroundColor: '#1C1C20',
              ...SHARED_CELL_BORDER,
              display: 'flex',
              alignItems: 'stretch'
            }}
          >
            {statCell('LAST', last1RM, undefined, lastInfo.calculated)}
            {/* NOW turns green once it beats the record */}
            {statCell('NOW', now1RM, pr1RM > 0 && now1RM > pr1RM ? '#30D158' : '#FFFFFF', nowInfo.calculated)}
            {statCell('PR', pr1RM, 'var(--dp-color-accent)', prInfoHeader.calculated)}
          </div>
        </>
      );
    }
    return (
      <input
        type="search"
        aria-label={isSuperset ? `Search exercises (${tag})` : 'Search exercises'}
        placeholder={`SEARCH · ${title.toUpperCase()}`}
        autoFocus
        enterKeyHint="search"
        value={search.query}
        onChange={e => setSearch({ half, query: e.target.value })}
        onBlur={() => setSearch(null)}
        onKeyDown={e => {
          if (e.key === 'Escape') setSearch(null);
          const first = search.query.trim() ? searchResults[0] : list[0];
          if (e.key === 'Enter' && first) handleSearchPick(half, first);
        }}
        style={{
          ...cellBase,
          cursor: 'text',
          outline: 'none',
          border: '2px solid var(--dp-color-accent)',
          textTransform: 'none',
          fontFamily: 'inherit',
          // 16 px so iOS doesn't zoom into the field
          fontSize: '16px'
        }}
      />
    );
  };

  const renderSearchResults = half => {
    if (search?.half !== half) return null;
    const currentId = supIds[half];
    const hintStyle = { padding: '12px', fontSize: '11px', fontWeight: 800, color: '#A0A0A0' };
    const typed = search.query.trim() !== '';
    const { list, nameOf } = filteredExercises(half);
    const results = typed ? searchResults : list;
    return (
      <div
        role="listbox"
        aria-label={typed ? 'Exercise search results' : 'Exercises matching the filters'}
        // Keep focus in the search box while a result is tapped
        onMouseDown={e => e.preventDefault()}
        style={{
          position: 'absolute',
          top: '44px',
          left: 0,
          right: 0,
          zIndex: 40,
          maxHeight: '300px',
          overflowY: 'auto',
          backgroundColor: '#101010',
          border: '2px solid var(--dp-color-accent)',
          boxShadow: '0 12px 24px rgba(0, 0, 0, 0.6)'
        }}
      >
        {!typed && <div style={{ ...hintStyle, padding: '8px 12px' }}>MATCHING YOUR FILTERS · TYPE TO SEARCH ALL</div>}
        {results.length === 0 ? (
          <div style={hintStyle}>NO MATCHING EXERCISES</div>
        ) : (
          results.map(ex => (
            <button
              key={ex.id}
              type="button"
              role="option"
              aria-selected={ex.id === currentId}
              onClick={() => handleSearchPick(half, ex)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '9px 12px',
                backgroundColor: ex.id === currentId ? '#1E1E22' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--dp-color-rule)',
                cursor: 'pointer'
              }}
            >
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase' }}>
                {typed ? stripEquipmentFromExerciseName(ex.name) : nameOf(ex)}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#A0A0A0',
                  textTransform: 'uppercase',
                  marginTop: '2px'
                }}
              >
                {[equipmentOf(ex), ex.muscleGroup, ex.category].filter(Boolean).join(' · ')}
              </span>
            </button>
          ))
        )}
      </div>
    );
  };

  // A SETS or REPS box in the scheme row: type a number (applied when the box loses focus, or on Enter).
  // Pyramids (and Timer reps) read a grey NA.
  const renderNumberCell = ({ label, value, na, column, ariaLabel, onCommit }) => (
    <label
      style={{
        ...headerSelectStyle,
        gridColumn: column,
        gridRow: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '4px',
        padding: '0 8px',
        cursor: na ? 'default' : 'text'
      }}
    >
      <span style={{ fontSize: '11px', fontWeight: 800, color: '#A0A0A0' }}>{label}</span>
      {na ? (
        <span aria-label={`${ariaLabel}: not used by this scheme`} style={{ fontSize: '14px', fontWeight: 800, color: '#6E6E73' }}>
          NA
        </span>
      ) : (
        <input
          key={`${label}_${value}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={ariaLabel}
          defaultValue={value}
          onFocus={e => e.target.select()}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              e.currentTarget.value = String(value);
              e.currentTarget.blur();
            }
          }}
          onBlur={e => {
            const next = Math.round(Number(e.target.value));
            if (!Number.isFinite(next) || next < 1) {
              e.target.value = String(value);
              return;
            }
            if (next !== Number(value)) onCommit(next);
          }}
          style={{
            width: '44px',
            minWidth: 0,
            height: '100%',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#FFFFFF',
            // 16 px so iOS doesn't zoom into the field
            fontSize: '16px',
            fontWeight: 800,
            textAlign: 'right',
            outline: 'none',
            padding: 0,
            fontFamily: 'inherit'
          }}
        />
      )}
    </label>
  );

  // Row 1: exercise name / search. Row 2: TYPE | MUSCLE GROUP | EQUIPMENT. Row 3: SCHEME | SETS | REPS.
  // Supersets render this twice (A, B); their SETS count is for both exercises.
  const renderHeaderBlock = half => {
    const { exId, category, availMuscles, muscle, pool, equipment, scheme } = pickerState(half);
    // Every equipment type is always offered, whatever the type / muscle filters say
    const equipmentOptions = getAllEquipmentFilterOptions().includes(equipment)
      ? getAllEquipmentFilterOptions()
      : [equipment, ...getAllEquipmentFilterOptions()];
    const hasEquipment = (ex, eq) => equipmentOptionsOf(ex).includes(eq);
    const typeOptionsForPick = isSuperset ? SUPERSET_HALF_CATEGORIES : categories;

    // New equipment → keep the exercise if it allows it; otherwise the most similar exercise that uses it.
    // The muscle group is kept whenever possible: same type + same muscle group, then the same muscle group in
    // another type, then whatever the filters show, and only if none of those has the equipment, anywhere.
    const handleEquipmentChange = nextEquipment => {
      const current = EXERCISE_MAP[exId];
      if (hasEquipment(current, nextEquipment)) {
        sendHeaderChange(half, { equipmentFilter: nextEquipment });
        return;
      }
      const otherId = isSuperset ? supIds[1 - half] : null;
      const withEquipment = EXERCISE_LIBRARY.filter(
        ex =>
          ex.id !== otherId &&
          hasEquipment(ex, nextEquipment) &&
          typeOptionsForPick.includes(normalizeSlotCategory(ex.category))
      );
      const currentGroup = current?.muscleGroup;
      const tiers = [
        withEquipment.filter(ex => ex.muscleGroup === currentGroup && normalizeSlotCategory(ex.category) === category),
        withEquipment.filter(ex => ex.muscleGroup === currentGroup),
        pool.filter(ex => ex.id !== otherId && hasEquipment(ex, nextEquipment)),
        withEquipment
      ];
      const candidates = tiers.find(tier => tier.length > 0) || [];
      const next = EXERCISE_MAP[findClosestExerciseInPool(exId, candidates)];
      if (!next) return;
      const changes = { equipmentFilter: nextEquipment, exerciseId: next.id };
      // Keep the muscle filter (incl. umbrellas like Legs / All Muscles) unless the new exercise falls outside it
      if (!doesExerciseInteractWithMuscleGroup(next, muscle)) changes.muscleGroupFilter = next.muscleGroup || 'All Muscles';
      else changes.muscleGroupFilter = muscle;
      const nextCategory = normalizeSlotCategory(next.category);
      if (nextCategory !== category && typeOptionsForPick.includes(nextCategory)) changes.category = nextCategory;
      sendHeaderChange(half, changes);
    };
    const tag = isSuperset ? (half === 0 ? 'A ' : 'B ') : '';
    // A superset's type menus read SUPERSET; picking any other type ends the superset: this exercise stays as a
    // normal exercise of that type and the other one is removed
    const typeOptions = isSuperset ? ['Superset', ...SUPERSET_HALF_CATEGORIES] : categories;
    // SETS / REPS: the exercise's set count and the scheme's reps (or the athlete's REPS choice)
    const halfSets = (isSuperset ? slot.supersetSetsByExercise?.[half] : slot.sets) || [];
    const isPyramid = PYRAMID_SCHEMES.includes(scheme);
    const typedReps = isSuperset ? slot.supersetTargetReps?.[half] : slot.targetReps;
    const repsValue = Number(typedReps) > 0 ? Number(typedReps) : getSchemeUniformReps(scheme);
    return (
      <div
        key={half}
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gridTemplateRows: '44px 40px 40px',
          gap: 0,
          minWidth: 0,
          ...(half === 1 ? { borderTop: '2px solid var(--dp-color-rule)' } : {}),
          ...(half === supIds.length - 1 ? { borderBottom: '2px solid var(--dp-color-rule)' } : {})
        }}
      >
        {renderTitleCell(half)}

        <select
          aria-label={`${tag}Exercise Category`.trim()}
          value={isSuperset ? 'Superset' : category}
          onChange={e => {
            if (isSuperset) {
              if (!isSupersetCategory(e.target.value)) onHeaderChange?.({ endSuperset: 1 - half, category: e.target.value });
              return;
            }
            sendHeaderChange(half, { category: e.target.value });
          }}
          className="kinetic-filter-select"
          style={{ ...headerSelectStyle, gridColumn: '1 / 3', gridRow: 2 }}
        >
          {typeOptions.map(cat => (
            <option key={cat} value={cat}>
              {cat.toUpperCase()}
            </option>
          ))}
        </select>

        <select
          aria-label={`${tag}Muscle Group Filter`.trim()}
          value={muscle}
          onChange={e => sendHeaderChange(half, { muscleGroupFilter: e.target.value })}
          className="kinetic-filter-select"
          style={{ ...headerSelectStyle, gridColumn: '3 / 5', gridRow: 2 }}
        >
          {availMuscles.map(mg => (
            <option key={mg} value={mg}>
              {mg.toUpperCase()}
            </option>
          ))}
        </select>

        <select
          aria-label={isSuperset ? `Superset Exercise ${half + 1} Equipment` : 'Exercise Equipment'}
          value={equipment}
          onChange={e => handleEquipmentChange(e.target.value)}
          className="kinetic-filter-select"
          style={{ ...headerSelectStyle, gridColumn: '5 / 7', gridRow: 2 }}
        >
          {equipmentOptions.map(eq => (
            <option key={eq} value={eq}>
              {eq.toUpperCase()}
            </option>
          ))}
        </select>

        <select
          aria-label={`${tag}Set and Rep Scheme`.trim()}
          value={scheme}
          onChange={e => sendHeaderChange(half, { scheme: e.target.value })}
          className="kinetic-filter-select"
          style={{ ...headerSelectStyle, gridColumn: '1 / 3', gridRow: 3 }}
        >
          {/* CLUSTER is a scheme for a single exercise (not offered in a superset) */}
          {SCHEME_OPTIONS.filter(scm => !isSuperset || !isClusterScheme(scm)).map(scm => (
            <option key={scm} value={scm}>
              {scm.toUpperCase()}
            </option>
          ))}
        </select>

        {renderNumberCell({
          label: 'SETS',
          value: halfSets.length,
          na: isPyramid,
          column: '3 / 5',
          ariaLabel: isSuperset ? 'Sets (both exercises)' : 'Number of sets',
          onCommit: n => sendHeaderChange(half, { setCount: n })
        })}
        {renderNumberCell({
          label: 'REPS',
          value: repsValue || '',
          na: isPyramid || scheme === 'Timer' || !repsValue,
          column: '5 / 7',
          ariaLabel: `${tag}Reps per set`.trim(),
          onCommit: n => sendHeaderChange(half, { targetReps: n })
        })}

        {renderSearchResults(half)}
      </div>
    );
  };


  // A set's type, weight or reps cell with its own lock on the LEFT (set.lockType / lockWeight / lockReps).
  // RECALCULATE never changes a locked value; see handleRecalculateSlotWeights. Without onToggleSetLock the cell is
  // just the value.
  const withSetLock = (exIdx, st, field, cellBg, valueEl) => {
    if (!onToggleSetLock) return valueEl;
    const locked = Boolean({ weight: st.lockWeight, reps: st.lockReps, type: st.lockType }[field]);
    const label = field === 'weight' ? 'weight' : field === 'reps' ? 'reps' : 'set type';
    // One box (the cell's border and background): the padlock sits inside on the left, the value fills the rest
    const innerValue = React.cloneElement(valueEl, {
      style: {
        ...valueEl.props.style,
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        backgroundColor: 'transparent',
        width: 'auto',
        minWidth: 0,
        flex: '1 1 auto',
        paddingLeft: 0
      }
    });
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          minWidth: 0,
          height: '44px',
          boxSizing: 'border-box',
          backgroundColor: cellBg,
          ...SHARED_CELL_BORDER
        }}
      >
        <button
          type="button"
          aria-pressed={locked}
          aria-label={`${locked ? 'Unlock' : 'Lock'} ${label} of set ${st.setNumber}`}
          title={locked ? `${label} locked: RECALCULATE won't change it` : `Lock ${label}`}
          onClick={() => onToggleSetLock({ exIdx, set: st, field })}
          style={{
            flex: `0 0 ${LOCK_COL_PX}px`,
            height: '100%',
            boxSizing: 'border-box',
            padding: '0 0 0 6px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start'
          }}
        >
          <LockIcon locked={locked} color={locked ? 'var(--dp-color-accent)' : '#6E6E73'} />
        </button>
        {innerValue}
      </div>
    );
  };

  const renderSetRow = ({ exIdx, exId, set: st, setIdx }) => {
    const rowScheme = schemes[exIdx] || schemes[0];
    const isTimerScheme = rowScheme === 'Timer';
    // Band exercises are loaded by band colour (RED / PURPLE) instead of weight
    const isBandSet = isBandEquipment(pickerState(exIdx).equipment);
    const bandColor = getSetBandColor(st);
    const exObj = EXERCISE_MAP[exId] || EXERCISE_LIBRARY[0];
    const curType = normalizeSetType(st.type);
    // LAST = what this set weighed in the last logged session of the exercise (completed sets when there were
    // any; the same set number, else that session's last set). Never logged = 0.
    const lastSessionSets = getLastLoggedSetsForExercise(exId, history, workoutId);
    const lastDoneSets = lastSessionSets.filter(s => s && s.completed && Number(s.weight) > 0);
    const lastPool = lastDoneSets.length > 0 ? lastDoneSets : lastSessionSets;
    const lastSet = lastPool[Math.min(setIdx, lastPool.length - 1)];
    const lastW = lastSet ? Math.max(0, Number(lastSet.weight) || 0) : 0;
    const timerMMSS = isTimerScheme ? st.timerStr ?? getSetTimerMMSS(st, true) : '';
    const lastTimerDisplay = isTimerScheme ? getLastLoggedTimerDisplay(exId, st, setIdx, lastW, history) : '';
    // Logged PR for the weight pop-up's 1RM box (and the History workout it came from)
    const prInfo = getBestHistory1RMInfo(exId, history);
    const setNumText = isSuperset ? `${exIdx === 0 ? 'A' : 'B'}${st.setNumber}` : `${st.setNumber}`;
    const cellBg = st.completed ? '#16291B' : '#141416';
    const editValue = (mode, currentValue) => onEditSetValue?.({ mode, exIdx, set: st, exercise: exObj, currentValue });

    return (
      <div
        key={`${exIdx}_${st.id}`}
        data-set-reorder={`${exIdx}:${setIdx}`}
        style={{
          display: 'grid',
          gridTemplateColumns: '34px minmax(0, 1fr) 34px',
          gap: 0,
          alignItems: 'stretch',
          backgroundColor: '#141416',
          // Held set lifts and follows the finger; the landing set is outlined
          ...setDragStyle(`${exIdx}:${setIdx}`)
        }}
      >
        <DragNumberBadge
          label={setNumText}
          color={isSuperset && exIdx === 0 ? 'var(--dp-color-accent)' : '#FFFFFF'}
          height="100%"
          bg={cellBg}
          title="Drag to rearrange set"
          aria-label={`Drag to reorder set ${setNumText}`}
          {...setHandleProps(`${exIdx}:${setIdx}`)}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
          {/* Superset: every set is labelled with its exercise (shortened name) so A and B sets are easy to tell apart */}
          {isSuperset && (
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: exIdx === 0 ? 'var(--dp-color-accent)' : '#C0C0C0',
                backgroundColor: cellBg,
                ...SHARED_CELL_BORDER,
                padding: '3px 8px',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.15
              }}
            >
              {`SUPERSET ${setIdx + 1} · ${exIdx === 0 ? 'A' : 'B'}: `}
              {stripEquipmentFromExerciseName(exObj.name)}
            </div>
          )}

          {/* Set Type, weight, REPS/TIMER, ✓ (LAST and the 1RM box live in the weight pop-up) */}
          <div
            style={{
              display: 'grid',
              // Set type, weight and reps share the width equally; with locks the ✓ is 40 px (13 px weights, 11 px types
              // so they fit beside their padlocks), else 52 px
              gridTemplateColumns: onToggleSetLock
                ? 'repeat(3, minmax(0, 1fr)) 40px'
                : 'repeat(3, minmax(0, 1fr)) 52px',
              gap: 0,
              alignItems: 'stretch'
            }}
          >
            {/* Set type dropdown (with its lock): picking a type re-works the set's weight and reps
                (handleUpdateSetType); a locked type is kept by RECALCULATE */}
            {withSetLock(exIdx, st, 'type', cellBg,
            <select
              aria-label={`Set ${setNumText} type`}
              className={onToggleSetLock ? 'kinetic-set-type-select no-caret' : 'kinetic-set-type-select'}
              value={curType}
              onChange={e =>
                onChangeSetType
                  ? onChangeSetType({ exIdx, set: st, type: e.target.value })
                  : editValue('type', e.target.value)
              }
              style={{
                width: '100%',
                minWidth: 0,
                height: '44px',
                boxSizing: 'border-box',
                backgroundColor: cellBg,
                ...SHARED_CELL_BORDER,
                color: '#FFFFFF',
                fontSize: onToggleSetLock ? '11px' : '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              {SET_TYPES_LIST.map(type => (
                <option key={type} value={type}>
                  {SET_TYPE_LABELS[type] || type.toUpperCase()}
                </option>
              ))}
            </select>
            )}

            {isBandSet ? (
            <button
              type="button"
              aria-label={`Band colour: ${bandColor}. Tap to switch`}
              onClick={() =>
                onSetBandColor?.({
                  exIdx,
                  set: st,
                  color: BAND_COLORS[(BAND_COLORS.indexOf(bandColor) + 1) % BAND_COLORS.length]
                })
              }
              style={{ ...setCellStyle(cellBg), cursor: 'pointer', overflow: 'hidden' }}
            >
              <span style={cellLabelStyle}>BAND</span>
              <span style={cellValueStyle(BAND_COLOR_HEX[bandColor])}>{bandColor.toUpperCase()}</span>
            </button>
            ) : withSetLock(exIdx, st, 'weight', cellBg,
            <button
              type="button"
              aria-label={`Weight ${st.weight} lb. Tap to change`}
              onClick={() =>
                onEditWeight?.({
                  exIdx,
                  set: st,
                  exercise: exObj,
                  exerciseId: exObj.id,
                  equipment: pickerState(exIdx).equipment,
                  lastDisplay: isTimerScheme ? lastTimerDisplay : lastW,
                  showOneRepMax: !isTimerScheme,
                  setReps: st.reps,
                  // This exercise's sets in the session, for the pop-up's CURRENT (session) 1RM
                  sessionSets: (isSuperset ? slot.supersetSetsByExercise?.[exIdx] : slot.sets) || [],
                  prValue: prInfo.best,
                  prCalculated: prInfo.calculated,
                  prWorkoutId: prInfo.workoutId
                })
              }
              style={{ ...setCellStyle(cellBg), cursor: 'pointer', overflow: 'hidden' }}
            >
              {/* Just the weight, centred in the cell (no CURRENT label) */}
              <span style={{ ...cellValueStyle('var(--dp-color-accent)', onToggleSetLock ? '13px' : '15px'), marginTop: 0 }}>
                {st.weight}
              </span>
            </button>
            )}

            {(() => {
              const repsButton = (
                <button
                  type="button"
                  aria-label={isTimerScheme ? 'Timer' : 'Reps'}
                  onClick={() => editValue(isTimerScheme ? 'timer' : 'reps', isTimerScheme ? timerMMSS : st.reps)}
                  style={{ ...setCellStyle(cellBg), color: '#FFFFFF', cursor: 'pointer' }}
                >
                  <span style={cellLabelStyle}>{isTimerScheme ? 'TIMER' : 'REPS'}</span>
                  <span style={cellValueStyle()}>{isTimerScheme ? timerMMSS : st.reps}</span>
                </button>
              );
              // Timers aren't recalculated, so they get no lock
              return isTimerScheme ? repsButton : withSetLock(exIdx, st, 'reps', cellBg, repsButton);
            })()}

            <button
              type="button"
              aria-label="Mark set complete"
              aria-pressed={Boolean(st.completed)}
              onClick={() => onToggleDone?.({ exIdx, set: st })}
              style={{
                width: '100%',
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
        </div>

        <DeleteButton
          label="Delete set"
          variant="outline"
          fill
          style={{ color: '#8E8E93' }}
          onClick={() => onDeleteSet?.({ exIdx, set: st, exercise: exObj })}
        />
      </div>
    );
  };

  return (
    <div style={SHARED_GROUP_OUTER}>
      {/* Header: drag handle + exercise picker(s), full width */}
      <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr)', gap: 0, alignItems: 'stretch' }}>
        <DragNumberBadge
          label={number}
          color="var(--dp-color-accent)"
          height="100%"
          bg="#18181B"
          title={headerTitle}
          aria-label={`Drag to reorder exercise ${number}`}
          {...(dragHandleProps || {})}
        />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>{halves.map(renderHeaderBlock)}</div>
      </div>

      {/* Sets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {rows.map(renderSetRow)}

        {footer}

        {/* + SET ^ · + SET ⌄ · RECALCULATE (widest label gets the most room) · DELETE — white text, DELETE red */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: onRemove
              ? 'minmax(0, 0.9fr) minmax(0, 0.9fr) minmax(0, 1.3fr) minmax(0, 0.9fr)'
              : 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr)',
            gap: 0
          }}
        >
          <button
            type="button"
            className="kinetic-btn"
            aria-label="Add set at top"
            onClick={() => onInsertSet?.('top')}
            style={bottomBtnStyle('#161618', '#FFFFFF')}
          >
            + SET ^
          </button>
          <button
            type="button"
            className="kinetic-btn"
            aria-label="Add set at bottom"
            onClick={() => onInsertSet?.('bottom')}
            style={bottomBtnStyle('#161618', '#FFFFFF')}
          >
            + SET ⌄
          </button>
          <button
            type="button"
            className="kinetic-btn"
            onClick={() => onAction?.()}
            style={actionTone === 'calculate' ? bottomBtnStyle('#30D158', '#000000') : bottomBtnStyle('#161618', '#FFFFFF')}
          >
            {actionLabel}
          </button>
          {onRemove && (
            <button
              type="button"
              className="kinetic-btn"
              aria-label={removeLabel}
              onClick={() => onRemove()}
              style={bottomBtnStyle('#1E1214', '#FF3B30')}
            >
              DELETE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
