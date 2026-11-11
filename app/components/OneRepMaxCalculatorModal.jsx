'use client';

// ============================================================================
// 1RM CALCULATOR POP-UP
// Same exercise editor as the session page (SlotEditor + the shared set-value / plate pop-ups),
// with a PR date and a bright green CALCULATE 1RM button that hands the estimate to `onSave`.
// Used by History (Personal Records).
// ============================================================================

import React, { useState } from 'react';
import { SHARED_CELL_BORDER, SHARED_GROUP_OUTER } from '../styles/kineticTokens';
import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  SLOT_CATEGORIES,
  normalizeSlotCategory,
  getFilteredExercisesForSlotInline,
  formatTodayYMD
} from '../data/exerciseLibrary';
import {
  normalizeSetType,
  createWorkoutSlot,
  generateSetsForScheme,
  parseTimerDurationSeconds,
  estimate1RMFromSet
} from '../utils/workoutEngine';
import { SlotEditor } from './SlotEditor';
import { CloseButton } from './Controls';

const CALC_CATEGORIES = SLOT_CATEGORIES.filter(c => c !== 'Superset');

const renumber = sets => sets.map((s, i) => ({ ...s, setNumber: i + 1 }));

/**
 * Props: exerciseId (starting exercise), onClose, onSave({ exerciseId, oneRepMax, dateYMD, scheme }),
 * oneRepMaxes, history, currentIncrementLbs, userBodyweightLbs,
 * setSetValueTarget, openPlateCalculatorForSet.
 * Mount with `key={exerciseId}` so reopening starts fresh.
 */
export function OneRepMaxCalculatorModal({
  exerciseId,
  onClose,
  onSave,
  oneRepMaxes = {},
  history = [],
  currentIncrementLbs = 0,
  userBodyweightLbs = 220,
  setSetValueTarget,
  openPlateCalculatorForSet
}) {
  const [slot, setSlot] = useState(() => {
    const exObj = EXERCISE_MAP[exerciseId] || EXERCISE_LIBRARY[0];
    return createWorkoutSlot({
      category: normalizeSlotCategory(exObj.category || 'Compound'),
      slotLabel: normalizeSlotCategory(exObj.category || 'Compound'),
      exerciseId: exObj.id,
      scheme: '5x5',
      oneRepMaxes,
      history,
      incrementLbs: currentIncrementLbs,
      userBodyweightLbs
    });
  });
  const [prDate, setPrDate] = useState(() => formatTodayYMD());
  const [lastEditedSetId, setLastEditedSetId] = useState(null);

  const base1RMFor = exId => Number(oneRepMaxes?.[exId]) || EXERCISE_MAP[exId]?.default1RM || 135;

  const setSets = updater => {
    setSlot(prev => {
      const nextSets = updater(prev.sets || []);
      return { ...prev, sets: nextSets, supersetSetsByExercise: [nextSets] };
    });
  };

  const handleHeaderChange = changes => {
    // SETS / REPS boxes: add (copies of the last set) or remove sets at the bottom; give every set those reps
    if (changes.setCount !== undefined || changes.targetReps !== undefined) {
      setSlot(prev => {
        let sets = [...(prev.sets || [])];
        if (changes.setCount !== undefined) {
          const n = Math.max(1, Math.min(20, Number(changes.setCount) || 1));
          const ref = sets[sets.length - 1] || { type: 'Working', reps: 5, weight: 135 };
          while (sets.length < n) {
            sets.push({ ...ref, id: `calc_set_${Date.now()}_${sets.length}_${Math.random().toString(36).slice(2, 6)}`, completed: false });
          }
          sets = sets.slice(0, n);
        }
        const next = { ...prev };
        if (changes.targetReps !== undefined) {
          next.targetReps = changes.targetReps;
          sets = sets.map(st => (st.type === '1 Rep Max' ? st : { ...st, reps: changes.targetReps }));
        }
        sets = renumber(sets);
        return { ...next, sets, supersetSetsByExercise: [sets] };
      });
      return;
    }
    setSlot(prev => {
      // Equipment filter only (the exercise already allows it): keep the sets as they are
      if (Object.keys(changes).every(key => key === 'equipmentFilter')) return { ...prev, ...changes };
      const next = { ...prev, ...changes };
      next.category = normalizeSlotCategory(next.category);

      if (changes.category && !changes.exerciseId && !changes.muscleGroupFilter) {
        const pool = getFilteredExercisesForSlotInline({ ...next, muscleGroupFilter: 'All Muscles' }, '', []);
        if (pool.length > 0 && !pool.some(e => e.id === next.exerciseId)) next.exerciseId = pool[0].id;
        next.muscleGroupFilter = EXERCISE_MAP[next.exerciseId]?.muscleGroup || 'All Muscles';
      } else if (changes.muscleGroupFilter !== undefined && !changes.exerciseId) {
        const pool = getFilteredExercisesForSlotInline(next, '', []);
        if (pool.length > 0 && !pool.some(e => e.id === next.exerciseId)) next.exerciseId = pool[0].id;
        if (EXERCISE_MAP[next.exerciseId]?.category) {
          next.category = normalizeSlotCategory(EXERCISE_MAP[next.exerciseId].category);
        }
      } else if (changes.exerciseId && EXERCISE_MAP[changes.exerciseId]?.muscleGroup) {
        next.muscleGroupFilter = EXERCISE_MAP[changes.exerciseId].muscleGroup;
      }

      const exObj = EXERCISE_MAP[next.exerciseId] || EXERCISE_LIBRARY[0];
      next.supersetExerciseIds = [exObj.id];
      const newSets = generateSetsForScheme(
        next.scheme || '5x5',
        base1RMFor(exObj.id),
        next.category,
        exObj.id,
        currentIncrementLbs,
        userBodyweightLbs
      );
      next.sets = newSets;
      next.supersetSetsByExercise = [newSets];
      return next;
    });
    setLastEditedSetId(null);
  };

  const updateSet = (setId, field, value) => {
    setLastEditedSetId(setId);
    setSets(sets =>
      sets.map(st => {
          if (st.id !== setId) return st;
          if (field === 'type') {
            const nextType = normalizeSetType(value);
            return { ...st, type: nextType, reps: nextType === '1 Rep Max' ? 1 : st.reps };
          }
          if (field === 'increment') {
            const numInc = Number(value) || 0;
            return {
              ...st,
              increment: value,
              weight: Math.max(0, Math.round(((Number(st.lastWeight) || 0) + numInc) * 4) / 4)
            };
          }
          if (field === 'timer') {
            const rawStr = String(value ?? '');
            const sec = parseTimerDurationSeconds(rawStr);
            return { ...st, timerStr: rawStr, durationSeconds: sec, reps: sec };
          }
          if (field === 'reps') return { ...st, reps: Math.max(1, Number(value) || 1) };
          if (field === 'weight') return { ...st, weight: Math.max(0, Number(value) || 0) };
          return { ...st, [field]: value };
        })
    );
  };

  const insertSet = position =>
    setSets(curSets => {
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
      return renumber(position === 'top' ? [newSet, ...curSets] : [...curSets, newSet]);
    });

  const deleteSet = setId =>
    setSets(curSets => {
      const filtered = curSets.filter(s => s.id !== setId);
      return filtered.length === 0 ? curSets : renumber(filtered);
    });

  const reorderSets = (fromIdx, toIdx) =>
    setSets(curSets => {
      const arr = [...curSets];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return renumber(arr);
    });

  // Estimate: the last edited set, else the best completed set, else the best set overall.
  const estimated1RM = (() => {
    const sets = slot.sets || [];
    if (sets.length === 0) return 0;
    const edited = lastEditedSetId && sets.find(s => s.id === lastEditedSetId);
    if (edited && Number(edited.weight) > 0) return estimate1RMFromSet(edited, sets.length);
    const completed = sets.filter(s => s.completed && Number(s.weight) > 0);
    return (completed.length > 0 ? completed : sets).reduce(
      (best, s) => Math.max(best, estimate1RMFromSet(s, sets.length)),
      0
    );
  })();

  const handleCalculate = () => {
    if (estimated1RM <= 0) return;
    onSave?.({ exerciseId: slot.exerciseId, oneRepMax: estimated1RM, dateYMD: prDate, scheme: slot.scheme || '5x5' });
    onClose?.();
  };

  const dateRow = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        alignItems: 'stretch',
        backgroundColor: '#18181B',
        ...SHARED_CELL_BORDER
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          fontSize: '11px',
          fontWeight: 800,
          color: '#A0A0A0',
          textTransform: 'uppercase'
        }}
      >
        PR DATE
      </span>
      <input
        type="text"
        aria-label="Personal Record Date (YYYY/MM/DD)"
        placeholder="YYYY/MM/DD"
        value={prDate}
        onChange={e => setPrDate(e.target.value.replace(/-/g, '/'))}
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
          padding: '0 4px',
          borderRight: 'none',
          borderBottom: 'none',
          borderLeft: '1px solid var(--dp-color-rule)'
        }}
      />
    </div>
  );

  const estimateRow = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        backgroundColor: '#18181B',
        ...SHARED_CELL_BORDER
      }}
    >
      <span style={{ fontSize: '11px', fontWeight: 800, color: '#A0A0A0', textTransform: 'uppercase' }}>
        ESTIMATED 1 REP MAX
      </span>
      <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--dp-color-accent)', fontVariantNumeric: 'tabular-nums' }}>
        {estimated1RM > 0 ? `${estimated1RM} LB` : 'TBD'}
      </span>
    </div>
  );

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
        padding: `calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px))`
      }}
      onClick={() => onClose?.()}
    >
      <div
        role="dialog"
        aria-label="1RM Calculator"
        style={{ width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#121214' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            ...SHARED_GROUP_OUTER,
            borderRight: '1px solid var(--dp-color-rule)',
            padding: '6px 6px 6px 12px',
            fontSize: '15px',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: 'var(--dp-color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <span>CALCULATE 1RM PERSONAL RECORD</span>
          <CloseButton onClick={() => onClose?.()} />
        </div>
        <SlotEditor
          slot={slot}
          number={1}
          headerTitle="Exercise 1RM Calculator"
          categories={CALC_CATEGORIES}
          history={history}
          onHeaderChange={handleHeaderChange}
          onEditSetValue={({ mode, set, exercise, currentValue }) =>
            setSetValueTarget?.({
              mode,
              slotId: slot.id,
              exIdx: 0,
              setId: set.id,
              setNumber: set.setNumber,
              exerciseName: exercise.name,
              currentValue,
              isAbs: false,
              onApply: value => updateSet(set.id, mode, value)
            })
          }
          onEditWeight={({ set, exercise, exIdx: _exIdx, ...setInfo }) =>
            openPlateCalculatorForSet?.(
              slot.id,
              0,
              set,
              exercise.name,
              weight => updateSet(set.id, 'weight', weight),
              setInfo
            )
          }
          onSetBandColor={({ set, color }) => updateSet(set.id, 'bandColor', color)}
          onToggleDone={({ set }) => updateSet(set.id, 'completed', !set.completed)}
          onDeleteSet={({ set }) => deleteSet(set.id)}
          onReorderSets={(_, fromIdx, toIdx) => reorderSets(fromIdx, toIdx)}
          onInsertSet={insertSet}
          footer={
            <>
              {dateRow}
              {estimateRow}
            </>
          }
          actionLabel="CALCULATE 1RM"
          actionTone="calculate"
          onAction={handleCalculate}
        />
      </div>
    </div>
  );
}
