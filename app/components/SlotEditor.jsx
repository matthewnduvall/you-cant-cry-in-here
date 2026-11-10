'use client';

// ============================================================================
// SHARED EXERCISE SLOT EDITOR
// One exercise slot (or superset) with its set rows, used by the session/routine editor, the
// History 1RM calculator, and Onboarding. Set values are edited through the shared pop-ups
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
  getExerciseEquipmentOptions,
  getAllEquipmentFilterOptions,
  getUniqueShortExerciseNames,
  findClosestExerciseInPool
} from '../data/exerciseLibrary';
import {
  SCHEME_OPTIONS,
  normalizeSetType,
  calculateLastEquivalentWeightForSet,
  getBestHistory1RMInfo,
  getHistoricalCalculated1RM,
  getSetTimerMMSS,
  getLastLoggedTimerDisplay,
  getSupersetSchemes
} from '../utils/workoutEngine';
import { DeleteButton, DragNumberBadge } from './Controls';

const headerSelectStyle = {
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
};

const exerciseSelectStyle = {
  flex: 1,
  width: '100%',
  minWidth: 0,
  height: '100%',
  boxSizing: 'border-box',
  backgroundColor: '#141416',
  color: '#FFFFFF',
  border: 'none',
  padding: '0 8px',
  fontSize: '13px',
  fontWeight: 800,
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

const cellLabelStyle = { fontSize: '9px', fontWeight: 800, color: '#9A9A9A', lineHeight: 1 };
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
  padding: '0 8px',
  backgroundColor: bg,
  color,
  ...SHARED_CELL_BORDER,
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  cursor: 'pointer'
});

const equipmentOf = ex => ex?.equipment || 'Bodyweight';

const SEARCH_RESULT_LIMIT = 12;

// Each superset exercise is a Compound or Accessory pick; this value in its type menu ends the superset
const SUPERSET_HALF_CATEGORIES = ['Compound', 'Accessory'];
const END_SUPERSET = '__end_superset__';

/**
 * Exercises whose name / equipment / muscle group contain every word typed, best name matches first.
 * Searches the whole library (Settings → Equipment only drives the exercises picked automatically).
 */
const searchExercises = query => {
  const words = String(query || '').toLowerCase().trim().split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const pool = EXERCISE_LIBRARY;
  const phrase = words.join(' ');
  const rank = ex => {
    const name = ex.name.toLowerCase();
    if (name.startsWith(phrase) || stripEquipmentFromExerciseName(ex.name).toLowerCase().startsWith(phrase)) return 0;
    if (name.includes(phrase)) return 1;
    return 2;
  };
  return pool
    .filter(ex => {
      const hay = `${ex.name} ${ex.equipment || ''} ${ex.muscleGroup || ''}`.toLowerCase();
      return words.every(w => hay.includes(w));
    })
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(Boolean(b.isPriority)) - Number(Boolean(a.isPriority)) ||
        a.name.localeCompare(b.name)
    )
    .slice(0, SEARCH_RESULT_LIMIT);
};

function SearchGlyph() {
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
        fontSize: '10px',
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
 *   Settings → Equipment only drives the default picks made by the hosts (see useWorkoutMutations).
 * - history, oneRepMaxes: used for LAST values and the 1RM box (PR) in the weight pop-up
 * - getBase1RM(exId): optional override of the 1RM used for LAST when a set has no lastWeight
 * - prFlags: [bool, bool] shows PR badges next to the exercise picker(s)
 * - onHeaderChange(changes): { category | muscleGroupFilter | scheme | exerciseId }. Supersets add
 *   supersetHalf (0 = A, 1 = B) to say which exercise changed, or send { endSuperset: half } to drop one.
 * - onRemove / removeLabel: red DELETE button at the end of the bottom row (omit to hide it)
 * - onEditSetValue({ mode, exIdx, set, exercise, currentValue }): mode = type | increment | reps | timer
 * - onEditWeight({ exIdx, set, exercise, exerciseId, equipment, lastDisplay, showOneRepMax, setReps, prValue,
 *   prWorkoutId }): CURRENT weight pop-up; LAST and the 1RM box (PR / CURRENT, links to the PR's History entry)
 *   are shown there; no 1RM box for Timer sets
 * - onToggleDone({ exIdx, set }), onDeleteSet({ exIdx, set, exercise })
 * - onReorderSets(exIdx, fromIdx, toIdx), onInsertSet('top' | 'bottom')
 * - actionLabel / onAction / actionTone ('recalculate' | 'calculate'): third bottom button
 * - footer: optional node rendered between the sets and the bottom row
 */
export function SlotEditor({
  slot,
  number = 1,
  headerTitle = 'Click and drag to rearrange exercise',
  categories = SLOT_CATEGORIES,
  history = [],
  oneRepMaxes = {},
  getBase1RM,
  prFlags = [false, false],
  onHeaderChange,
  onRemove,
  removeLabel = 'Remove exercise',
  onEditSetValue,
  onEditWeight,
  onToggleDone,
  onDeleteSet,
  onReorderSets,
  onInsertSet,
  actionLabel = 'RECALCULATE',
  onAction,
  actionTone = 'recalculate',
  footer = null
}) {
  const [draggedSet, setDraggedSet] = useState(null);
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
      (isSuperset ? slot.supersetMuscleFilters?.[half] : slot.muscleGroupFilter) || exObj.muscleGroup || 'All Muscles';
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
    // Equipment named in the search ("landmine row") wins, then the current choice, then the exercise's first
    const lettersOnly = text => String(text || '').toLowerCase().replace(/[^a-z]/g, '');
    const typed = lettersOnly(search?.query);
    const namedInSearch = exEquipment.find(eq => typed && typed.includes(lettersOnly(eq)));
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

  const renderSearchCell = half => {
    const label = isSuperset ? (half === 0 ? 'A · SEARCH' : 'B · SEARCH') : 'SEARCH';
    const ariaLabel = isSuperset ? `Search exercises (${half === 0 ? 'A' : 'B'})` : 'Search exercises';
    if (search?.half !== half) {
      return (
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={() => setSearch({ half, query: '' })}
          style={{
            ...headerSelectStyle,
            gridColumn: 1,
            gridRow: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#A0A0A0',
            textAlign: 'left',
            whiteSpace: 'nowrap',
            overflow: 'hidden'
          }}
        >
          <SearchGlyph />
          {label}
        </button>
      );
    }
    return (
      <input
        type="search"
        aria-label={ariaLabel}
        placeholder={label}
        autoFocus
        enterKeyHint="search"
        value={search.query}
        onChange={e => setSearch({ half, query: e.target.value })}
        onBlur={() => setSearch(null)}
        onKeyDown={e => {
          if (e.key === 'Escape') setSearch(null);
          if (e.key === 'Enter' && searchResults[0]) handleSearchPick(half, searchResults[0]);
        }}
        style={{
          ...headerSelectStyle,
          gridColumn: 1,
          gridRow: 1,
          cursor: 'text',
          outline: 'none',
          border: '2px solid var(--dp-color-accent)',
          textTransform: 'none',
          fontFamily: 'inherit'
        }}
      />
    );
  };

  const renderSearchResults = half => {
    if (search?.half !== half) return null;
    const currentId = supIds[half];
    const hintStyle = { padding: '12px', fontSize: '11px', fontWeight: 800, color: '#A0A0A0' };
    return (
      <div
        role="listbox"
        aria-label="Exercise search results"
        // Keep focus in the search box while a result is tapped
        onMouseDown={e => e.preventDefault()}
        style={{
          position: 'absolute',
          top: '40px',
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
        {search.query.trim() === '' ? (
          <div style={hintStyle}>TYPE AN EXERCISE, EQUIPMENT OR MUSCLE</div>
        ) : searchResults.length === 0 ? (
          <div style={hintStyle}>NO MATCHING EXERCISES</div>
        ) : (
          searchResults.map(ex => (
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
                {stripEquipmentFromExerciseName(ex.name)}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '10px',
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

  // Row 1: Search, Type, Muscle Group. Row 2: Scheme, Equipment, Exercise. Supersets render this twice (A, B).
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
    const exercisesForEquipment = pool.filter(ex => hasEquipment(ex, equipment));
    // Short names; where two would read the same, the dropped equipment word is added in brackets
    const shortNames = getUniqueShortExerciseNames(exercisesForEquipment, equipment);
    const displayName = ex => shortNames[ex.id] || stripEquipmentFromExerciseName(ex.name);
    const tag = isSuperset ? (half === 0 ? 'A ' : 'B ') : '';
    const typeOptions = isSuperset ? SUPERSET_HALF_CATEGORIES : categories;
    return (
      <div
        key={half}
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gridAutoRows: '40px',
          gap: 0,
          minWidth: 0,
          ...(half === 1 ? { borderTop: '2px solid var(--dp-color-rule)' } : {})
        }}
      >
        {renderSearchCell(half)}

        <select
          aria-label={`${tag}Exercise Category`.trim()}
          value={category}
          onChange={e => {
            if (e.target.value === END_SUPERSET) {
              onHeaderChange?.({ endSuperset: half });
              return;
            }
            sendHeaderChange(half, { category: e.target.value });
          }}
          style={{
            ...headerSelectStyle,
            gridColumn: 2,
            gridRow: 1,
            backgroundColor: 'var(--dp-color-accent)',
            color: '#101010'
          }}
        >
          {typeOptions.map(cat => (
            <option key={cat} value={cat}>
              {cat.toUpperCase()}
            </option>
          ))}
          {isSuperset && <option value={END_SUPERSET}>✕ REMOVE FROM SUPERSET</option>}
        </select>

        <select
          aria-label={`${tag}Muscle Group Filter`.trim()}
          value={muscle}
          onChange={e => sendHeaderChange(half, { muscleGroupFilter: e.target.value })}
          style={{ ...headerSelectStyle, gridColumn: 3, gridRow: 1 }}
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
          style={{ ...headerSelectStyle, gridColumn: 2, gridRow: 2 }}
        >
          {equipmentOptions.map(eq => (
            <option key={eq} value={eq}>
              {eq.toUpperCase()}
            </option>
          ))}
        </select>

        <div
          style={{
            gridColumn: 3,
            gridRow: 2,
            width: '100%',
            minWidth: 0,
            height: '40px',
            boxSizing: 'border-box',
            backgroundColor: '#141416',
            ...SHARED_CELL_BORDER,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <select
            aria-label={isSuperset ? `Superset Exercise ${half + 1}` : 'Select Exercise'}
            value={exId}
            onChange={e => sendHeaderChange(half, { exerciseId: e.target.value })}
            style={exerciseSelectStyle}
          >
            {exercisesForEquipment.map(ex => (
              <option key={ex.id} value={ex.id}>
                {displayName(ex).toUpperCase()}
              </option>
            ))}
          </select>
          {prFlags[half] && <PrBadge marginRight="6px" />}
        </div>

        <select
          aria-label={`${tag}Set and Rep Scheme`.trim()}
          value={scheme}
          onChange={e => sendHeaderChange(half, { scheme: e.target.value })}
          style={{ ...headerSelectStyle, gridColumn: 1, gridRow: 2 }}
        >
          {SCHEME_OPTIONS.map(scm => (
            <option key={scm} value={scm}>
              {scm.toUpperCase()}
            </option>
          ))}
        </select>

        {renderSearchResults(half)}
      </div>
    );
  };

  const isDragging = (exIdx, setIdx) =>
    draggedSet && draggedSet.exIdx === exIdx && (setIdx === undefined || draggedSet.setIdx === setIdx);

  const renderSetRow = ({ exIdx, exId, set: st, setIdx, total }) => {
    const rowScheme = schemes[exIdx] || schemes[0];
    const isTimerScheme = rowScheme === 'Timer';
    const exObj = EXERCISE_MAP[exId] || EXERCISE_LIBRARY[0];
    const curType = normalizeSetType(st.type);
    const base1RM = getBase1RM ? getBase1RM(exId) : getHistoricalCalculated1RM(exId, history, oneRepMaxes);
    const lastW =
      st.lastWeight !== undefined
        ? st.lastWeight
        : calculateLastEquivalentWeightForSet(base1RM, st, total, normCat, setIdx, rowScheme);
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
        draggable={true}
        onDragStart={e => {
          e.stopPropagation();
          setDraggedSet({ exIdx, setIdx });
        }}
        onDragOver={e => {
          if (isDragging(exIdx)) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onDrop={e => {
          e.stopPropagation();
          if (isDragging(exIdx) && draggedSet.setIdx !== setIdx) {
            onReorderSets?.(exIdx, draggedSet.setIdx, setIdx);
          }
          setDraggedSet(null);
        }}
        onDragEnd={() => setDraggedSet(null)}
        style={{
          display: 'grid',
          gridTemplateColumns: '34px minmax(0, 1fr) 34px',
          gap: 0,
          alignItems: 'stretch',
          opacity: isDragging(exIdx, setIdx) ? 0.55 : 1
        }}
      >
        <DragNumberBadge
          label={setNumText}
          color={isSuperset && exIdx === 0 ? 'var(--dp-color-accent)' : '#FFFFFF'}
          height="100%"
          bg={cellBg}
          title="Click and drag to rearrange set"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
          {isSuperset && (
            <div
              style={{
                fontSize: '10px',
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
              {exIdx === 0 ? 'A: ' : 'B: '}
              {exObj.name}
            </div>
          )}

          {/* Set Type, CURRENT, REPS/TIMER, ✓ (LAST / INC live in the CURRENT weight pop-up) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '96px minmax(0, 1fr) minmax(0, 1fr) 44px',
              gap: 0,
              alignItems: 'stretch'
            }}
          >
            <button
              type="button"
              aria-label="Set Type"
              onClick={() => editValue('type', curType)}
              style={{
                ...setCellStyle(cellBg),
                padding: '0 4px',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              <span
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  lineHeight: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'center'
                }}
              >
                {curType.toUpperCase()}
              </span>
            </button>

            <button
              type="button"
              aria-label="Current Weight"
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
                  prWorkoutId: prInfo.workoutId
                })
              }
              style={{ ...setCellStyle(cellBg), cursor: 'pointer', overflow: 'hidden' }}
            >
              <span style={cellLabelStyle}>CURRENT</span>
              <span style={cellValueStyle('var(--dp-color-accent)')}>{st.weight}</span>
            </button>

            <button
              type="button"
              aria-label={isTimerScheme ? 'Timer' : 'Reps'}
              onClick={() => editValue(isTimerScheme ? 'timer' : 'reps', isTimerScheme ? timerMMSS : st.reps)}
              style={{ ...setCellStyle(cellBg), color: '#FFFFFF', cursor: 'pointer' }}
            >
              <span style={cellLabelStyle}>{isTimerScheme ? 'TIMER' : 'REPS'}</span>
              <span style={cellValueStyle()}>{isTimerScheme ? timerMMSS : st.reps}</span>
            </button>

            <button
              type="button"
              aria-label="Mark set complete"
              aria-pressed={Boolean(st.completed)}
              onClick={() => onToggleDone?.({ exIdx, set: st })}
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
        </div>

        <DeleteButton
          label="Delete set"
          variant="outline"
          fill
          onClick={() => onDeleteSet?.({ exIdx, set: st, exercise: exObj })}
        />
      </div>
    );
  };

  return (
    <div style={SHARED_GROUP_OUTER}>
      {/* Header: drag handle + exercise picker(s), full width */}
      <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr)', gap: 0, alignItems: 'stretch' }}>
        <DragNumberBadge label={number} color="var(--dp-color-accent)" height="100%" bg="#18181B" title={headerTitle} />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>{halves.map(renderHeaderBlock)}</div>
      </div>

      {/* Sets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {rows.map(renderSetRow)}

        {footer}

        <div style={{ display: 'grid', gridTemplateColumns: onRemove ? 'repeat(4, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 0 }}>
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
            style={bottomBtnStyle('#161618', 'var(--dp-color-accent)')}
          >
            + SET ⌄
          </button>
          <button
            type="button"
            className="kinetic-btn"
            onClick={() => onAction?.()}
            style={actionTone === 'calculate' ? bottomBtnStyle('#30D158', '#000000') : bottomBtnStyle('#121E15', '#30D158')}
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
