'use client';

// ============================================================================
// SHARED EXERCISE SLOT EDITOR
// One exercise slot (or superset) with its set rows, used by the session/routine editor, the
// History 1RM calculator. Set values are edited through the shared pop-ups
// (SetValueEditorModal + PlateCalculatorModal) via callbacks, so each host decides where the
// edits are written.
// ============================================================================

import { INTENSITY_MODES, formatIntensity } from '../utils/intensity';
import { IntensityEditorModal } from './IntensityEditorModal';
import { SchemeEditorModal, schemeButtonLabel } from './SchemeEditorModal';
import { getProgram } from '../data/programs';
import React, { useState } from 'react';
import { SHARED_CELL_BORDER } from '../styles/kineticTokens';
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
  getBandParts,
  getExerciseEquipmentOptions,
  getAllEquipmentFilterOptions,
  getUniqueShortExerciseNames,
  findClosestExerciseInPool,
  normalizeMuscleGroupName
} from '../data/exerciseLibrary';
import {
  normalizeSetType,
  getBestHistory1RMInfo,
  exercise1RMInfoOfSets,
  oneRepMaxLabel,
  getLastLoggedSetsForExercise,
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
  fontWeight: 500,
  padding: '0 4px 0 6px',
  // Filter surface (see .kinetic-filter-select): lighter than the set rows below
  backgroundColor: '#2A2A2A',
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

const cellLabelStyle = { fontSize: '11px', fontWeight: 500, color: '#9A9A9A', lineHeight: 1 };
// Set values (weight, reps, timer, band) are readouts: the label / number face (--cr-face-display)
const cellValueStyle = (color = '#FFFFFF', size = '15px') => ({
  fontFamily: 'var(--cr-face-display)',
  fontSize: size,
  fontWeight: 500,
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
  fontWeight: 500,
  textTransform: 'uppercase',
  cursor: 'pointer'
});

const equipmentOf = ex => ex?.equipment || 'Bodyweight';

// Calculated 1RM of a list of sets: the best weight × (1 + reps / 30) (1 rep = the weight), the estimate History
// uses for Personal Records and the weight pop-up uses for its 1RM box; 0 = no weights
// ({ value, calculated }: calculated = from a multi-rep set, shown with *)
// The exercise's calculated 1RM: the average over its working sets (each with its own reps and intensity)
const best1RM = sets => exercise1RMInfoOfSets(Array.isArray(sets) ? sets : []);

// Set type dropdown labels (short enough for the set row's type column)
const SET_TYPE_LABELS = { Warmup: 'WARMUP', Working: 'WORKING', 'Top Out': 'TOP OUT', 'Burn Out': 'BURN OUT', '1 Rep Max': '1RM' };

// The results list scrolls, so it can hold plenty
const SEARCH_RESULT_LIMIT = 40;

// Each superset exercise is a Compound or Accessory pick; this value in its type menu ends the superset
const SUPERSET_HALF_CATEGORIES = ['Compound', 'Accessory'];

// Width of the lock button at the left of a set's type / weight / reps cell (6 px gap before the padlock)
const LOCK_COL_PX = 20;

// Four equal set cells (intensity shown) leave the type ~38 px beside its padlock: the cell shows a short form (the
// dropdown still lists the full names)
const SET_TYPE_SHORT_LABELS = { Warmup: 'WARM', Working: 'WORK', 'Top Out': 'TOP', 'Burn Out': 'BURN', '1 Rep Max': '1RM' };

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
        backgroundColor: '#FFFFFF',
        color: '#000000',
        fontSize: '11px',
        fontWeight: 500,
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
 * - onRemove / removeLabel: grey DELETE button at the end of the bottom row (omit to hide it)
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
 * - showIntensity + onChangeSetIntensity({ exIdx, set, intensity: { mode, value } }): programs other than Crying add
 *   an INTENSITY cell after reps (with its own lock, field 'intensity'); tapping it opens IntensityEditorModal (scale
 *   %1RM / RIR / RPE + value; changing the scale converts the value, see utils/intensity.js)
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
  onChangeSetType,
  showIntensity = false,
  onChangeSetIntensity
}) {
  // The INTENSITY pop-up: { exIdx, set, label } while open
  const [intensityTarget, setIntensityTarget] = useState(null);
  // The SCHEME pop-up (scheme + sets + reps) is open
  const [schemeOpen, setSchemeOpen] = useState(false);
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

  // Each exercise's scheme, set count and reps (the athlete's REPS choice, else the scheme's) for the SCHEME pop-up
  const schemeHalf = half => {
    const scheme = schemes[half] || schemes[0];
    const sets = ((isSuperset ? slot.supersetSetsByExercise?.[half] : slot.sets) || []).length;
    const typedReps = isSuperset ? slot.supersetTargetReps?.[half] : slot.targetReps;
    const reps = Number(typedReps) > 0 ? Number(typedReps) : getSchemeUniformReps(scheme);
    return { name: stripEquipmentFromExerciseName(EXERCISE_MAP[supIds[half]]?.name || ''), scheme, sets, reps };
  };
  // The scheme button: "5 × 8" / "PYRAMID"; a superset with different schemes shows both
  const schemeSummary = (() => {
    // A program day's exercise shows its plan ("3 × 5", "5 / 3 / 1+", "4 × 6–8")
    if (slot.programmed?.label && slot.programRef && !slot.programOff && !isSuperset) return slot.programmed.label;
    const labels = halves.map(h => {
      const { scheme, sets, reps } = schemeHalf(h);
      return schemeButtonLabel(scheme, sets, reps);
    });
    return labels.length > 1 && labels[0] !== labels[1] ? `A ${labels[0]} · B ${labels[1]}` : labels[0];
  })();

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
      const statCell = (label, value, color = '#BDBDBD', calculated = false) => (
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
          <span style={{ fontSize: '11px', fontWeight: 500, color: '#9A9A9A', lineHeight: 1 }}>{label}</span>
          {/* The asterisk hangs off the number's corner so three values still fit side by side */}
          <span
            aria-label={value > 0 ? oneRepMaxLabel(value, calculated) : 'none'}
            style={{ position: 'relative', fontSize: '13px', fontWeight: 500, color: value > 0 ? color : '#8A8A8A', lineHeight: 1.2, marginTop: '2px' }}
          >
            {value > 0 ? value : '—'}
            {value > 0 && calculated && (
              <span aria-hidden="true" style={{ position: 'absolute', left: '100%', top: '-3px', fontSize: '11px', lineHeight: 1 }}>
                *
              </span>
            )}
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
                wordBreak: 'break-word',
                // The exercise's title is the card's one red element (red is one per component)
                color: 'var(--cr-red-text)'
              }}
            >
              {title.toUpperCase()}
              {showEquipment && <span style={{ color: '#9A9A9A', fontSize: '11px' }}> · {equipment.toUpperCase()}</span>}
            </span>
            {prFlags[half] && <PrBadge marginRight="0" />}
            <span style={{ color: '#9A9A9A', display: 'flex', flexShrink: 0 }}>
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
              backgroundColor: '#1C1C1C',
              ...SHARED_CELL_BORDER,
              display: 'flex',
              alignItems: 'stretch'
            }}
          >
            {statCell('LAST', last1RM, undefined, lastInfo.calculated)}
            {/* NOW turns green once it beats the record */}
            {statCell('NOW', now1RM, pr1RM > 0 && now1RM > pr1RM ? '#FFFFFF' : '#FFFFFF', nowInfo.calculated)}
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
    const hintStyle = { padding: '12px', fontSize: '11px', fontWeight: 500, color: '#9A9A9A' };
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
          backgroundColor: '#000000',
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
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#FFFFFF', textTransform: 'uppercase' }}>
                {typed ? stripEquipmentFromExerciseName(ex.name) : nameOf(ex)}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#9A9A9A',
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
    return (
      <div
        key={half}
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gridTemplateRows: '44px 40px',
          gap: 0,
          minWidth: 0,
          ...(half === 1 ? { borderTop: '1px solid var(--dp-color-rule)' } : {}),
          ...(half === supIds.length - 1 ? { borderBottom: '1px solid var(--dp-color-rule)' } : {})
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



        {renderSearchResults(half)}
      </div>
    );
  };


  // A set's type, weight or reps cell with its own lock on the LEFT (set.lockType / lockWeight / lockReps).
  // RECALCULATE never changes a locked value; see handleRecalculateSlotWeights. Without onToggleSetLock the cell is
  // just the value.
  const withSetLock = (exIdx, st, field, cellBg, valueEl) => {
    if (!onToggleSetLock) return valueEl;
    const locked = Boolean({ weight: st.lockWeight, reps: st.lockReps, type: st.lockType, intensity: st.lockIntensity }[field]);
    const label = field === 'weight' ? 'weight' : field === 'reps' ? 'reps' : field === 'intensity' ? 'intensity' : 'set type';
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
          <LockIcon locked={locked} color={locked ? 'var(--dp-color-accent)' : '#8A8A8A'} />
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
    // Done sets recede (a step darker than the tile); the ✓ circle fills white
    // Sets still to do sit darker; a done set lights up a step (the whole card mutes once every set is done)
    const cellBg = st.completed ? '#262626' : '#121212';
    // The sets after this one in the exercise that a pop-up's "ALSO SETS" may write to: not done, not locked
    const laterSetsFor = field => {
      const list = (isSuperset ? slot.supersetSetsByExercise?.[exIdx] : slot.sets) || [];
      const idx = list.findIndex(x => x?.id === st.id);
      if (idx < 0) return [];
      const lockKey = { weight: 'lockWeight', reps: 'lockReps', intensity: 'lockIntensity' }[field];
      return list
        .map((x, i) => ({ x, number: i + 1 }))
        .slice(idx + 1)
        .filter(({ x }) => x && !x.completed && !(lockKey && x[lockKey]))
        .map(({ x, number }) => ({ id: x.id, number, set: x }));
    };
    const editValue = (mode, currentValue) =>
      onEditSetValue?.({
        mode,
        exIdx,
        set: st,
        exercise: exObj,
        currentValue,
        laterSets: mode === 'reps' || mode === 'timer' ? laterSetsFor('reps') : []
      });

    return (
      <div
        key={`${exIdx}_${st.id}`}
        data-set-reorder={`${exIdx}:${setIdx}`}
        style={{
          display: 'grid',
          gridTemplateColumns: '34px minmax(0, 1fr) 34px',
          gap: 0,
          alignItems: 'stretch',
          backgroundColor: '#1C1C1C',
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
                fontWeight: 500,
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
              // + an INTENSITY cell after reps when the program uses intensity (not on Timer sets)
              // Every value cell is the same width, with a caps label over its value (TYPE, LB, REPS, the scale)
              gridTemplateColumns: `repeat(${showIntensity && !isTimerScheme ? 4 : 3}, minmax(0, 1fr)) ${
                onToggleSetLock ? '40px' : '52px'
              }`,
              gap: 0,
              alignItems: 'stretch'
            }}
          >
            {/* Set type dropdown (with its lock): picking a type re-works the set's weight and reps
                (handleUpdateSetType); a locked type is kept by RECALCULATE */}
            {withSetLock(exIdx, st, 'type', cellBg,
            <div style={{ ...setCellStyle(cellBg), position: 'relative', overflow: 'hidden' }}>
              <span style={cellLabelStyle}>TYPE</span>
              <span
                style={{
                  ...cellValueStyle('#FFFFFF', '11px'),
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textTransform: 'uppercase'
                }}
              >
                {(showIntensity && !isTimerScheme ? SET_TYPE_SHORT_LABELS[curType] : SET_TYPE_LABELS[curType]) ||
                  String(curType).toUpperCase()}
              </span>
              {/* The dropdown covers the whole cell (invisible), so the cell itself is the tap target */}
              <select
                aria-label={`Set ${setNumText} type`}
                value={curType}
                onChange={e =>
                  onChangeSetType
                    ? onChangeSetType({ exIdx, set: st, type: e.target.value })
                    : editValue('type', e.target.value)
                }
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                  fontSize: '16px',
                  border: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
              >
                {SET_TYPES_LIST.map(type => (
                  <option key={type} value={type}>
                    {SET_TYPE_LABELS[type] || type.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
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
              <span style={cellLabelStyle}>{getBandParts(bandColor).length > 1 ? 'BANDS' : 'BAND'}</span>
              {/* Each band in its own colour; two bands sit side by side ("RED+PURPLE") */}
              <span style={{ ...cellValueStyle('#FFFFFF', getBandParts(bandColor).length > 1 ? '11px' : '15px'), whiteSpace: 'nowrap' }}>
                {getBandParts(bandColor).map((part, i) => (
                  <React.Fragment key={part}>
                    {i > 0 && <span style={{ color: '#9A9A9A' }}>+</span>}
                    <span style={{ color: BAND_COLOR_HEX[part] || '#FFFFFF' }}>{part.toUpperCase()}</span>
                  </React.Fragment>
                ))}
              </span>
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
                  lastDisplay: isTimerScheme ? lastTimerDisplay : lastSet ? lastW : '—', // never logged: a dash, like PR
                  showOneRepMax: !isTimerScheme,
                  setReps: st.reps,
                  // This exercise's sets in the session, for the pop-up's CURRENT (session) 1RM
                  sessionSets: (isSuperset ? slot.supersetSetsByExercise?.[exIdx] : slot.sets) || [],
                  prValue: prInfo.best,
                  prCalculated: prInfo.calculated,
                  prWorkoutId: prInfo.workoutId,
                  laterSets: laterSetsFor('weight')
                })
              }
              style={{ ...setCellStyle(cellBg), cursor: 'pointer', overflow: 'hidden' }}
            >
              {/* The weight under its unit */}
              <span style={cellLabelStyle}>LB</span>
              <span style={cellValueStyle('var(--dp-color-accent)', onToggleSetLock ? '13px' : '15px')}>{st.weight}</span>
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
                  <span style={cellValueStyle('#FFFFFF', onToggleSetLock ? '13px' : '15px')}>{isTimerScheme ? timerMMSS : st.reps}</span>
                </button>
              );
              // Timers aren't recalculated, so they get no lock
              return isTimerScheme ? repsButton : withSetLock(exIdx, st, 'reps', cellBg, repsButton);
            })()}

            {/* INTENSITY (programs other than Crying): the scale as its label, the value under it; tap = the pop-up
                (scale + value), the lock keeps it through RECALCULATE */}
            {showIntensity && !isTimerScheme && (() => {
              const intensity = st.intensity && st.intensity.mode ? st.intensity : null;
              const hasValue = intensity && intensity.value !== null && intensity.value !== undefined && intensity.value !== '';
              const modeLabel = (INTENSITY_MODES.find(m => m.id === intensity?.mode) || { label: 'INTENSITY' }).label;
              const intensityButton = (
                <button
                  type="button"
                  aria-label={`Intensity: ${hasValue ? formatIntensity(intensity.mode, intensity.value) : 'not set'}. Tap to change`}
                  onClick={() => setIntensityTarget({ exIdx, set: st, label: setNumText, laterSets: laterSetsFor('intensity') })}
                  style={{ ...setCellStyle(cellBg), color: '#FFFFFF', cursor: 'pointer', overflow: 'hidden' }}
                >
                  <span style={{ ...cellLabelStyle, whiteSpace: 'nowrap' }}>{hasValue ? modeLabel : 'INT.'}</span>
                  <span style={{ ...cellValueStyle('#FFFFFF', onToggleSetLock ? '13px' : '15px'), whiteSpace: 'nowrap' }}>
                    {hasValue ? (intensity.mode === 'pct' ? `${intensity.value}%` : intensity.value) : '—'}
                  </span>
                </button>
              );
              return withSetLock(exIdx, st, 'intensity', cellBg, intensityButton);
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
                backgroundColor: cellBg,
                ...SHARED_CELL_BORDER,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* Circular check: outlined until done, then a white fill with a black tick */}
              <span
                aria-hidden="true"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  boxSizing: 'border-box',
                  border: st.completed ? 'none' : '1.5px solid #4A4A4A',
                  backgroundColor: st.completed ? '#FFFFFF' : 'transparent',
                  color: st.completed ? '#000000' : '#8A8A8A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  fontWeight: 500
                }}
              >
                ✓
              </span>
            </button>
          </div>

        </div>

        <DeleteButton
          label="Delete set"
          variant="outline"
          fill
          style={{ color: '#9A9A9A' }}
          onClick={() => onDeleteSet?.({ exIdx, set: st, exercise: exObj })}
        />
      </div>
    );
  };

  // Every set of the exercise done: the card mutes (grey, faded) so the session's remaining work stands out.
  // Not while a pop-up inside it is open (a filter would also catch the fixed-position pop-up).
  const allSetsDone = (() => {
    const lists = isSuperset ? slot.supersetSetsByExercise || [] : [slot.sets || []];
    const sets = lists.flat().filter(Boolean);
    return sets.length > 0 && sets.every(st => st.completed);
  })();
  const muted = allSetsDone && !search && !schemeOpen;

  return (
    // The exercise card: one graphite tile (14 px corners, no outer border); its cells are divided by hairlines
    // While the exercise search is open the card doesn't clip, so the results list can spill past its bottom edge
    <div
      style={{
        backgroundColor: '#1C1C1C',
        borderRadius: '14px',
        overflow: search ? 'visible' : 'hidden',
        ...(muted ? { filter: 'grayscale(1)', opacity: 0.5 } : {}),
        transition: 'opacity 160ms ease-out'
      }}
    >
      {schemeOpen && (
        <SchemeEditorModal
          isSuperset={isSuperset}
          halves={halves.map(schemeHalf)}
          programNote={
            slot.programmed
              ? `${getProgram(slot.programmed.program).label} · Week ${slot.programmed.week}`
              : null
          }
          onClose={() => setSchemeOpen(false)}
          onApply={changes => {
            // In order: the scheme (rebuilds the sets), then the set count, then the reps
            changes.forEach(c => {
              if (c.scheme) sendHeaderChange(c.half, { scheme: c.scheme });
              if (c.setCount) sendHeaderChange(c.half, { setCount: c.setCount });
              if (c.targetReps) sendHeaderChange(c.half, { targetReps: c.targetReps });
            });
            setSchemeOpen(false);
          }}
        />
      )}
      {intensityTarget && (
        <IntensityEditorModal
          title={`SET ${intensityTarget.label} INTENSITY`}
          reps={intensityTarget.set.reps}
          intensity={intensityTarget.set.intensity}
          onClose={() => setIntensityTarget(null)}
          laterSets={intensityTarget.laterSets}
          onApply={(next, alsoLater) => {
            onChangeSetIntensity?.({ exIdx: intensityTarget.exIdx, set: intensityTarget.set, intensity: next });
            if (alsoLater) {
              (intensityTarget.laterSets || []).forEach(later =>
                onChangeSetIntensity?.({ exIdx: intensityTarget.exIdx, set: later.set, intensity: next })
              );
            }
            setIntensityTarget(null);
          }}
        />
      )}
      {/* Header: drag handle + exercise picker(s), full width */}
      <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr)', gap: 0, alignItems: 'stretch' }}>
        <DragNumberBadge
          label={number}
          color="var(--dp-color-accent)"
          height="100%"
          bg="#1C1C1C"
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

        {/* SCHEME ▾ · RECALCULATE · DELETE (sets are added / removed in the scheme pop-up) — white text, DELETE grey (DELETE still asks first) */}
        <div
          style={{
            display: 'grid',
            // Equal-width buttons: SCHEME | RECALCULATE | DELETE
            gridTemplateColumns: `repeat(${onRemove ? 3 : 2}, minmax(0, 1fr))`,
            gap: 0
          }}
        >
          {/* The scheme (sets × reps, or its name): opens the SCHEME pop-up */}
          <button
            type="button"
            className="kinetic-btn"
            aria-label={`Scheme: ${schemeSummary}. Tap to change scheme, sets and reps`}
            onClick={() => setSchemeOpen(true)}
            style={{ ...bottomBtnStyle('#1C1C1C', '#FFFFFF'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{schemeSummary}</span>
            <span aria-hidden="true" style={{ color: '#9A9A9A', fontSize: '10px' }}>▾</span>
          </button>
          <button
            type="button"
            className="kinetic-btn"
            onClick={() => onAction?.()}
            style={actionTone === 'calculate' ? bottomBtnStyle('#FFFFFF', '#000000') : bottomBtnStyle('#1C1C1C', '#FFFFFF')}
          >
            {actionLabel}
          </button>
          {onRemove && (
            <button
              type="button"
              className="kinetic-btn"
              aria-label={removeLabel}
              onClick={() => onRemove()}
              style={bottomBtnStyle('#1C1C1C', '#9A9A9A')}
            >
              DELETE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
