'use client';

// History tab search & filters: the same SEARCH / TYPE / MUSCLE + EQUIPMENT / EXERCISE layout as the
// exercise slot editor (SlotEditor), applied to the exercises the athlete has logged, so they can find
// the last time they did a specific exercise.

import React, { useState } from 'react';
import {
  EXERCISE_MAP,
  MUSCLE_GROUP_OPTIONS,
  normalizeSlotCategory,
  doesExerciseInteractWithMuscleGroup,
  getExerciseEquipmentOptions,
  stripEquipmentFromExerciseName
} from '../data/exerciseLibrary';
import { headerSelectStyle, searchExercises, SearchGlyph } from './SlotEditor';

// Five shared columns, as in the slot editor: row 1 = SEARCH | TYPE | MUSCLE, row 2 = EQUIPMENT | EXERCISE
const FILTER_GRID_COLUMNS = '80px minmax(0, 15fr) minmax(0, 85fr) minmax(0, 17fr) minmax(0, 108fr)';

export const EMPTY_HISTORY_FILTER = { category: 'All', muscle: 'All Muscles', equipment: 'All', exerciseId: '' };

export const isHistoryFilterActive = filter =>
  Boolean(
    filter &&
      (filter.category !== 'All' || filter.muscle !== 'All Muscles' || filter.equipment !== 'All' || filter.exerciseId)
  );

/** Exercise ids logged in one History workout (superset halves included). */
export const getWorkoutExerciseIds = workout => {
  const ids = [];
  (workout?.slots || []).forEach(slot => {
    const slotIds =
      Array.isArray(slot?.supersetExerciseIds) && slot.supersetExerciseIds.length > 0
        ? slot.supersetExerciseIds.slice(0, 2)
        : [slot?.exerciseId];
    slotIds.forEach(id => {
      if (id && !ids.includes(id)) ids.push(id);
    });
  });
  return ids;
};

/** Sets logged for `exerciseId` in one History workout. */
export const getWorkoutSetsForExercise = (workout, exerciseId) => {
  const sets = [];
  (workout?.slots || []).forEach(slot => {
    if (Array.isArray(slot?.supersetExerciseIds) && slot.supersetExerciseIds.length > 0) {
      slot.supersetExerciseIds.slice(0, 2).forEach((id, idx) => {
        if (id === exerciseId) sets.push(...(slot.supersetSetsByExercise?.[idx] || (idx === 0 ? slot.sets : slot.secondarySets) || []));
      });
    } else if (slot?.exerciseId === exerciseId) {
      sets.push(...(slot.sets || []));
    }
  });
  return sets;
};

/** Does an exercise pass the TYPE / MUSCLE / EQUIPMENT / EXERCISE filters? */
export const exerciseMatchesHistoryFilter = (exerciseId, filter) => {
  const ex = EXERCISE_MAP[exerciseId];
  if (!ex) return false;
  if (filter.exerciseId) return exerciseId === filter.exerciseId;
  if (filter.category !== 'All' && normalizeSlotCategory(ex.category) !== filter.category) return false;
  if (!doesExerciseInteractWithMuscleGroup(ex, filter.muscle)) return false;
  if (filter.equipment !== 'All' && !getExerciseEquipmentOptions(ex).includes(filter.equipment)) return false;
  return true;
};

export const workoutMatchesHistoryFilter = (workout, filter) =>
  !isHistoryFilterActive(filter) || getWorkoutExerciseIds(workout).some(id => exerciseMatchesHistoryFilter(id, filter));

const SEARCH_LABEL = 'SEARCH';

export function HistoryExerciseFilter({ history = [], filter, onChange }) {
  const [query, setQuery] = useState(null); // null = search box closed

  // Only exercises that appear in History can be picked
  const loggedExercises = (() => {
    const seen = new Set();
    (history || []).forEach(w => getWorkoutExerciseIds(w).forEach(id => seen.add(id)));
    return [...seen].map(id => EXERCISE_MAP[id]).filter(Boolean);
  })();

  const equipmentOptions = [...new Set(loggedExercises.flatMap(getExerciseEquipmentOptions))].sort((a, b) =>
    a.localeCompare(b)
  );
  const exerciseOptions = loggedExercises
    .filter(ex => exerciseMatchesHistoryFilter(ex.id, { ...filter, exerciseId: '' }))
    .sort((a, b) => stripEquipmentFromExerciseName(a.name).localeCompare(stripEquipmentFromExerciseName(b.name)));
  // The picked exercise stays listed even if a later filter change would hide it
  if (filter.exerciseId && !exerciseOptions.some(ex => ex.id === filter.exerciseId) && EXERCISE_MAP[filter.exerciseId]) {
    exerciseOptions.unshift(EXERCISE_MAP[filter.exerciseId]);
  }
  const exerciseLabel = ex => {
    const short = stripEquipmentFromExerciseName(ex.name);
    const sameShort = exerciseOptions.filter(o => stripEquipmentFromExerciseName(o.name) === short).length > 1;
    return sameShort ? `${short} (${ex.equipment || 'Bodyweight'})` : short;
  };

  const results = query ? searchExercises(query, loggedExercises) : [];

  // Search pick → that exercise, with its type, muscle group and equipment shown in the filters
  const pickExercise = ex => {
    setQuery(null);
    if (!ex) return;
    onChange({
      category: normalizeSlotCategory(ex.category),
      muscle: ex.muscleGroup || 'All Muscles',
      equipment: getExerciseEquipmentOptions(ex)[0] || 'All',
      exerciseId: ex.id
    });
  };

  const hintStyle = { padding: '12px', fontSize: '11px', fontWeight: 800, color: '#A0A0A0' };

  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: FILTER_GRID_COLUMNS,
        gridAutoRows: '40px',
        gap: 0
      }}
    >
      {query === null ? (
        <button
          type="button"
          aria-label="Search logged exercises"
          onClick={() => setQuery('')}
          style={{
            ...headerSelectStyle,
            gridColumn: '1 / 3',
            gridRow: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            color: '#A0A0A0',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden'
          }}
        >
          <SearchGlyph />
          {SEARCH_LABEL}
        </button>
      ) : (
        <input
          type="search"
          aria-label="Search logged exercises"
          placeholder={SEARCH_LABEL}
          autoFocus
          enterKeyHint="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onBlur={() => setQuery(null)}
          onKeyDown={e => {
            if (e.key === 'Escape') setQuery(null);
            if (e.key === 'Enter' && results[0]) pickExercise(results[0]);
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
      )}

      <select
        className="kinetic-filter-select"
        aria-label="Filter by exercise type"
        value={filter.category}
        onChange={e => onChange({ ...filter, category: e.target.value, exerciseId: '' })}
        style={{ ...headerSelectStyle, gridColumn: '3 / 5', gridRow: 1 }}
      >
        <option value="All">ALL TYPES</option>
        <option value="Compound">COMPOUND</option>
        <option value="Accessory">ACCESSORY</option>
      </select>

      <select
        className="kinetic-filter-select"
        aria-label="Filter by muscle group"
        value={filter.muscle}
        onChange={e => onChange({ ...filter, muscle: e.target.value, exerciseId: '' })}
        style={{ ...headerSelectStyle, gridColumn: '5 / 6', gridRow: 1 }}
      >
        {MUSCLE_GROUP_OPTIONS.map(m => (
          <option key={m} value={m}>
            {m.toUpperCase()}
          </option>
        ))}
      </select>

      <select
        className="kinetic-filter-select"
        aria-label="Filter by equipment"
        value={filter.equipment}
        onChange={e => onChange({ ...filter, equipment: e.target.value, exerciseId: '' })}
        style={{ ...headerSelectStyle, gridColumn: '1 / 3', gridRow: 2 }}
      >
        <option value="All">ALL EQUIPMENT</option>
        {equipmentOptions.map(eq => (
          <option key={eq} value={eq}>
            {eq.toUpperCase()}
          </option>
        ))}
      </select>

      <select
        className="kinetic-filter-select"
        aria-label="Filter by exercise"
        value={filter.exerciseId}
        onChange={e => onChange({ ...filter, exerciseId: e.target.value })}
        style={{ ...headerSelectStyle, gridColumn: '3 / 6', gridRow: 2 }}
      >
        <option value="">ALL EXERCISES ({exerciseOptions.length})</option>
        {exerciseOptions.map(ex => (
          <option key={ex.id} value={ex.id}>
            {exerciseLabel(ex).toUpperCase()}
          </option>
        ))}
      </select>

      {query !== null && (
        <div
          role="listbox"
          aria-label="Logged exercise search results"
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
          {query.trim() === '' ? (
            <div style={hintStyle}>TYPE AN EXERCISE, EQUIPMENT OR MUSCLE YOU HAVE LOGGED</div>
          ) : results.length === 0 ? (
            <div style={hintStyle}>NO LOGGED EXERCISES MATCH</div>
          ) : (
            results.map(ex => (
              <button
                key={ex.id}
                type="button"
                role="option"
                aria-selected={ex.id === filter.exerciseId}
                onClick={() => pickExercise(ex)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 12px',
                  backgroundColor: ex.id === filter.exerciseId ? '#1E1E22' : 'transparent',
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
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#A0A0A0',
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
      )}
    </div>
  );
}

export default HistoryExerciseFilter;
