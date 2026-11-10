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
import { headerSelectStyle, searchExercises } from './SlotEditor';
import { ExerciseSearchCell, ExerciseSearchResults, PICKER_GRID_COLUMNS, equipmentNamedInSearch } from './ExercisePicker';


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
      equipment: equipmentNamedInSearch(query, getExerciseEquipmentOptions(ex)) || getExerciseEquipmentOptions(ex)[0] || 'All',
      exerciseId: ex.id
    });
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: PICKER_GRID_COLUMNS,
        gridAutoRows: '40px',
        gap: 0
      }}
    >
      <ExerciseSearchCell
        query={query}
        setQuery={setQuery}
        ariaLabel="Search logged exercises"
        label={SEARCH_LABEL}
        onEnter={() => results[0] && pickExercise(results[0])}
      />

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

      {/* Row 2: EQUIPMENT | EXERCISE in equal halves, so ALL EQUIPMENT / ALL EXERCISES (N) fit at phone width */}
      <div style={{ gridColumn: '1 / 6', gridRow: 2, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 0 }}>
        <select
          className="kinetic-filter-select"
          aria-label="Filter by equipment"
          value={filter.equipment}
          onChange={e => onChange({ ...filter, equipment: e.target.value, exerciseId: '' })}
          style={headerSelectStyle}
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
          style={headerSelectStyle}
        >
          <option value="">ALL EXERCISES ({exerciseOptions.length})</option>
          {exerciseOptions.map(ex => (
            <option key={ex.id} value={ex.id}>
              {exerciseLabel(ex).toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <ExerciseSearchResults
        query={query}
        results={results}
        selectedId={filter.exerciseId}
        onPick={pickExercise}
        emptyHint="TYPE AN EXERCISE, EQUIPMENT OR MUSCLE YOU HAVE LOGGED"
        noMatchHint="NO LOGGED EXERCISES MATCH"
      />
    </div>
  );
}

export default HistoryExerciseFilter;
