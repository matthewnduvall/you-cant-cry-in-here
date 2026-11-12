'use client';

// ============================================================================
// EXERCISE PICKER — the standard way to choose one exercise outside a workout (Personal Records → + ADD,
// Goals → + ADD EXERCISE, Progress chart → CUSTOM). Same layout, styles and rules as the session editor's
// header (SlotEditor): row 1 = the exercise's name, which is also the search box (tap: the exercises the filters
// allow; type: the whole library), row 2 TYPE | MUSCLE | EQUIPMENT; equipment *options* ("A / B" equipment =
// either), short names (getUniqueShortExerciseNames), orange ▾ filter selects.
// Also exports the shared search box pieces (ExerciseSearchCell, ExerciseSearchResults) used by
// HistoryExerciseFilter.
// ============================================================================

import React, { useState } from 'react';
import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  normalizeSlotCategory,
  getAvailableMuscleGroupsForCategory,
  doesExerciseInteractWithMuscleGroup,
  getExerciseEquipmentOptions,
  getAllEquipmentFilterOptions,
  getUniqueShortExerciseNames,
  stripEquipmentFromExerciseName,
  findClosestExerciseInPool
} from '../data/exerciseLibrary';
import { headerSelectStyle, searchExercises, SearchGlyph } from './SlotEditor';

// Five shared columns, as in the slot editor
export const PICKER_GRID_COLUMNS = '80px minmax(0, 15fr) minmax(0, 85fr) minmax(0, 17fr) minmax(0, 108fr)';
export const EXERCISE_TYPES = ['Compound', 'Accessory'];

const hintStyle = { padding: '12px', fontSize: '11px', fontWeight: 500, color: '#9A9A9A' };

/** SEARCH cell: a button until tapped, then a text box (grid row 1, columns 1–2). */
export function ExerciseSearchCell({ query, setQuery, onEnter, ariaLabel = 'Search exercises', label = 'SEARCH' }) {
  if (query === null) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setQuery('')}
        style={{
          ...headerSelectStyle,
          gridColumn: '1 / 3',
          gridRow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          color: '#9A9A9A',
          textAlign: 'center',
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
      value={query}
      onChange={e => setQuery(e.target.value)}
      onBlur={() => setQuery(null)}
      onKeyDown={e => {
        if (e.key === 'Escape') setQuery(null);
        if (e.key === 'Enter') onEnter?.();
      }}
      style={{
        ...headerSelectStyle,
        gridColumn: '1 / 3',
        gridRow: 1,
        cursor: 'text',
        outline: 'none',
        border: '2px solid var(--dp-color-accent)',
        textTransform: 'none',
        fontFamily: 'inherit'
      }}
    />
  );
}

/**
 * Results list under the search box (name, then equipment · muscle · type). With `filterList`, an empty query shows
 * those exercises (named by `nameOf`) under MATCHING YOUR FILTERS, as in the session editor; `top` = the box height.
 */
export function ExerciseSearchResults({
  query,
  results,
  selectedId,
  onPick,
  emptyHint,
  noMatchHint = 'NO MATCHING EXERCISES',
  filterList = null,
  onPickFromList,
  nameOf,
  top = '40px'
}) {
  if (query === null) return null;
  const listMode = query.trim() === '' && Array.isArray(filterList);
  const shown = listMode ? filterList : results;
  return (
    <div
      role="listbox"
      aria-label="Exercise search results"
      // Keep focus in the search box while a result is tapped
      onMouseDown={e => e.preventDefault()}
      style={{
        position: 'absolute',
        top,
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
      {listMode && <div style={{ ...hintStyle, padding: '8px 12px' }}>MATCHING YOUR FILTERS · TYPE TO SEARCH ALL</div>}
      {query.trim() === '' && !listMode ? (
        <div style={hintStyle}>{emptyHint || 'TYPE AN EXERCISE, EQUIPMENT OR MUSCLE'}</div>
      ) : shown.length === 0 ? (
        <div style={hintStyle}>{noMatchHint}</div>
      ) : (
        shown.map(ex => (
          <button
            key={ex.id}
            type="button"
            role="option"
            aria-selected={ex.id === selectedId}
            onClick={() => (listMode && onPickFromList ? onPickFromList(ex) : onPick(ex))}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '9px 12px',
              backgroundColor: ex.id === selectedId ? '#1E1E22' : 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--dp-color-rule)',
              cursor: 'pointer'
            }}
          >
            <span style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#FFFFFF', textTransform: 'uppercase' }}>
              {listMode && nameOf ? nameOf(ex) : stripEquipmentFromExerciseName(ex.name)}
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
              {[ex.equipment || 'Bodyweight', ex.muscleGroup, normalizeSlotCategory(ex.category)].filter(Boolean).join(' · ')}
            </span>
          </button>
        ))
      )}
    </div>
  );
}

/** The equipment option named in a search ("landmine row" → Landmine, "ez curl" → EZ Bar), if any. */
export const equipmentNamedInSearch = (query, options) => {
  const lettersOnly = text => String(text || '').toLowerCase().replace(/[^a-z]/g, '');
  const typed = lettersOnly(query);
  const words = String(query || '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(word => word.length >= 2);
  return options.find(
    eq => (typed && typed.includes(lettersOnly(eq))) || words.includes(lettersOnly(String(eq).split(/[\s/-]+/)[0]))
  );
};

/**
 * A valid starting exercise for a picker: `exerciseId` when it exists, has an offered type and isn't excluded;
 * otherwise the first priority Compound exercise that fits, then anything that fits.
 */
export const resolvePickerExerciseId = (exerciseId, excludeIds = [], types = EXERCISE_TYPES) => {
  const fits = ex => ex && !excludeIds.includes(ex.id) && types.includes(normalizeSlotCategory(ex.category));
  if (fits(EXERCISE_MAP[exerciseId])) return exerciseId;
  const priority = EXERCISE_LIBRARY.find(ex => fits(ex) && ex.isPriority && normalizeSlotCategory(ex.category) === types[0]);
  return (priority || EXERCISE_LIBRARY.find(fits) || EXERCISE_LIBRARY[0])?.id;
};

/**
 * Props
 * - exerciseId / onChange(exerciseId): the chosen exercise (resolve it first with resolvePickerExerciseId)
 * - types: exercise types offered in TYPE (default Compound, Accessory)
 * - excludeIds: exercises not offered (e.g. already in the list)
 */
export function ExercisePicker({ exerciseId, onChange, types = EXERCISE_TYPES, excludeIds = [] }) {
  const current = EXERCISE_MAP[exerciseId] || EXERCISE_LIBRARY[0];
  const typeOf = ex => {
    const t = normalizeSlotCategory(ex?.category);
    return types.includes(t) ? t : types[0];
  };
  // The filters start from the exercise and then keep the athlete's choices (e.g. MUSCLE = All Muscles)
  const [filters, setFilters] = useState(() => ({
    category: typeOf(current),
    muscle: current?.muscleGroup || 'All Muscles',
    equipment: getExerciseEquipmentOptions(current)[0]
  }));
  const [query, setQuery] = useState(null);

  const muscles = getAvailableMuscleGroupsForCategory(filters.category, '', []);
  const muscle = muscles.includes(filters.muscle) ? filters.muscle : 'All Muscles';
  const exEquipment = getExerciseEquipmentOptions(current);
  const equipment = exEquipment.includes(filters.equipment) ? filters.equipment : exEquipment[0];
  const equipmentOptions = getAllEquipmentFilterOptions().includes(equipment)
    ? getAllEquipmentFilterOptions()
    : [equipment, ...getAllEquipmentFilterOptions()];

  const allowed = ex => ex && !excludeIds.includes(ex.id) && types.includes(normalizeSlotCategory(ex.category));
  const hasEquipment = (ex, eq) => getExerciseEquipmentOptions(ex).includes(eq);
  const poolFor = (category, muscleFilter) =>
    EXERCISE_LIBRARY.filter(
      ex => allowed(ex) && normalizeSlotCategory(ex.category) === category && doesExerciseInteractWithMuscleGroup(ex, muscleFilter)
    );

  // Pick the exercise most like the current one among the first non-empty candidate list
  const choose = (tiers, nextFilters) => {
    const candidates = tiers.find(tier => tier.length > 0) || [];
    const nextId = findClosestExerciseInPool(current?.id, candidates);
    const next = EXERCISE_MAP[nextId];
    if (!next) {
      setFilters(nextFilters);
      return;
    }
    const nextEquipmentOptions = getExerciseEquipmentOptions(next);
    setFilters({
      ...nextFilters,
      equipment: nextEquipmentOptions.includes(nextFilters.equipment) ? nextFilters.equipment : nextEquipmentOptions[0]
    });
    if (next.id !== exerciseId) onChange?.(next.id);
  };

  const handleTypeChange = category => {
    const pool = poolFor(category, muscle);
    choose([pool.filter(ex => hasEquipment(ex, equipment)), pool, poolFor(category, 'All Muscles')], {
      category,
      muscle,
      equipment
    });
  };
  const handleMuscleChange = nextMuscle => {
    const pool = poolFor(filters.category, nextMuscle);
    choose([pool.filter(ex => hasEquipment(ex, equipment)), pool], { ...filters, muscle: nextMuscle, equipment });
  };
  // Same rules as the session editor: keep the exercise if it allows the equipment; otherwise the most similar
  // exercise that does — same type + muscle group first, then the same muscle group, then anywhere
  const handleEquipmentChange = nextEquipment => {
    if (hasEquipment(current, nextEquipment)) {
      setFilters({ ...filters, muscle, equipment: nextEquipment });
      return;
    }
    const withEquipment = EXERCISE_LIBRARY.filter(ex => allowed(ex) && hasEquipment(ex, nextEquipment));
    const group = current?.muscleGroup;
    const pool = poolFor(filters.category, muscle);
    choose(
      [
        withEquipment.filter(ex => ex.muscleGroup === group && normalizeSlotCategory(ex.category) === filters.category),
        withEquipment.filter(ex => ex.muscleGroup === group),
        pool.filter(ex => hasEquipment(ex, nextEquipment)),
        withEquipment
      ],
      { ...filters, muscle, equipment: nextEquipment }
    );
  };

  const results = query ? searchExercises(query).filter(allowed) : [];
  const pickFromSearch = ex => {
    setQuery(null);
    if (!ex) return;
    const options = getExerciseEquipmentOptions(ex);
    setFilters({
      category: typeOf(ex),
      muscle: ex.muscleGroup || 'All Muscles',
      equipment: equipmentNamedInSearch(query, options) || options[0]
    });
    onChange?.(ex.id);
  };

  // Tapping the name lists the exercises the filters allow; picking one keeps the filters as they are
  const pickFromList = ex => {
    setQuery(null);
    if (ex && ex.id !== exerciseId) onChange?.(ex.id);
  };

  const listed = poolFor(filters.category, muscle).filter(ex => hasEquipment(ex, equipment));
  if (current && !listed.some(ex => ex.id === current.id)) listed.unshift(current);
  const shortNames = getUniqueShortExerciseNames(listed, equipment);
  const nameOf = ex => shortNames[ex.id] || stripEquipmentFromExerciseName(ex.name);

  const showEquipment = equipment && equipment !== 'Bodyweight';
  const titleCell = {
    ...headerSelectStyle,
    gridColumn: '1 / 7',
    gridRow: 1,
    height: '44px',
    padding: '0 10px',
    fontSize: '14px'
  };

  // Row 1: the exercise's name / search box. Row 2: TYPE | MUSCLE | EQUIPMENT (as in the session editor)
  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        gridTemplateRows: '44px 40px',
        gap: 0
      }}
    >
      {query === null ? (
        <button
          type="button"
          aria-label="Exercise: tap to search or change"
          onClick={() => setQuery('')}
          style={{
            ...titleCell,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'left',
            whiteSpace: 'nowrap',
            overflow: 'hidden'
          }}
        >
          <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nameOf(current).toUpperCase()}
            {showEquipment && <span style={{ color: '#9A9A9A', fontSize: '11px' }}> · {equipment.toUpperCase()}</span>}
          </span>
          <span style={{ color: '#9A9A9A', display: 'flex', flexShrink: 0 }}>
            <SearchGlyph />
          </span>
        </button>
      ) : (
        <input
          type="search"
          aria-label="Search exercises"
          placeholder={`SEARCH · ${nameOf(current).toUpperCase()}`}
          autoFocus
          enterKeyHint="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onBlur={() => setQuery(null)}
          onKeyDown={e => {
            if (e.key === 'Escape') setQuery(null);
            if (e.key !== 'Enter') return;
            if (query.trim()) {
              if (results[0]) pickFromSearch(results[0]);
            } else if (listed[0]) {
              pickFromList(listed[0]);
            }
          }}
          style={{
            ...titleCell,
            cursor: 'text',
            outline: 'none',
            border: '2px solid var(--dp-color-accent)',
            textTransform: 'none',
            fontFamily: 'inherit',
            // 16 px so iOS doesn't zoom into the field
            fontSize: '16px'
          }}
        />
      )}

      <select
        className="kinetic-filter-select"
        aria-label="Exercise type"
        value={filters.category}
        onChange={e => handleTypeChange(e.target.value)}
        style={{ ...headerSelectStyle, gridColumn: '1 / 3', gridRow: 2 }}
      >
        {types.map(t => (
          <option key={t} value={t}>
            {t.toUpperCase()}
          </option>
        ))}
      </select>

      <select
        className="kinetic-filter-select"
        aria-label="Muscle group"
        value={muscle}
        onChange={e => handleMuscleChange(e.target.value)}
        style={{ ...headerSelectStyle, gridColumn: '3 / 5', gridRow: 2 }}
      >
        {muscles.map(m => (
          <option key={m} value={m}>
            {m.toUpperCase()}
          </option>
        ))}
      </select>

      <select
        className="kinetic-filter-select"
        aria-label="Equipment"
        value={equipment}
        onChange={e => handleEquipmentChange(e.target.value)}
        style={{ ...headerSelectStyle, gridColumn: '5 / 7', gridRow: 2 }}
      >
        {equipmentOptions.map(eq => (
          <option key={eq} value={eq}>
            {eq.toUpperCase()}
          </option>
        ))}
      </select>

      <ExerciseSearchResults
        query={query}
        results={results}
        selectedId={current?.id}
        onPick={pickFromSearch}
        filterList={listed}
        onPickFromList={pickFromList}
        nameOf={nameOf}
        top="44px"
      />
    </div>
  );
}

export default ExercisePicker;
