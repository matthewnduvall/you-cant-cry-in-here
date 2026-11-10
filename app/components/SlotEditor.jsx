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
  getAvailableMuscleGroupsForCategory
} from '../data/exerciseLibrary';
import {
  SCHEME_OPTIONS,
  normalizeSetType,
  calculateLastEquivalentWeightForSet,
  getEffectiveIncrementForExercise,
  getHistoricalCalculated1RM,
  getSetTimerMMSS,
  getLastLoggedTimerDisplay
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
 * - selectedGymId, gyms: filter the exercise pickers
 * - history, oneRepMaxes, currentIncrementLbs: used to show LAST / INC values
 * - getBase1RM(exId): optional override of the 1RM used for LAST when a set has no lastWeight
 * - infoCell: node shown in the third column under the scheme (1RM readout, PR date, ...)
 * - prFlags: [bool, bool] shows PR badges next to the exercise picker(s)
 * - onHeaderChange(changes): { category | muscleGroupFilter | scheme | exerciseId | supersetExerciseIds }
 * - onRemove / removeLabel: the full-height ✕ on the header
 * - onEditSetValue({ mode, exIdx, set, exercise, currentValue }): mode = type | increment | reps | timer
 * - onEditWeight({ exIdx, set, exercise, lastDisplay, incrementDisplay, onEditIncrement }): CURRENT weight
 *   pop-up; LAST / INC are shown there (not as row columns), INC is null for Timer sets
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
  selectedGymId,
  gyms = [],
  history = [],
  oneRepMaxes = {},
  currentIncrementLbs = 0,
  getBase1RM,
  infoCell = null,
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

  const normCat = normalizeSlotCategory(slot.category);
  const ex1 = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
  const isSuperset = isSupersetCategory(normCat);
  const isTimerScheme = slot.scheme === 'Timer';
  const availMuscleGroups = getAvailableMuscleGroupsForCategory(normCat, selectedGymId, gyms);
  const rawSlotMuscle = slot.muscleGroupFilter || ex1?.muscleGroup || 'All Muscles';
  const activeMuscleFilter = availMuscleGroups.includes(rawSlotMuscle) ? rawSlotMuscle : 'All Muscles';
  const exercisePool = getFilteredExercisesForSlotInline(
    { ...slot, muscleGroupFilter: activeMuscleFilter },
    selectedGymId,
    gyms
  );
  const poolWith = exObj =>
    exercisePool.some(e => e.id === exObj?.id) || !exObj ? exercisePool : [exObj, ...exercisePool];

  const supIds = isSuperset
    ? [
        slot.supersetExerciseIds?.[0] || slot.exerciseId || 'reverse_lunge',
        slot.supersetExerciseIds?.[1] || slot.secondaryExerciseId || 'front_flies'
      ]
    : [slot.exerciseId];

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

  const isDragging = (exIdx, setIdx) =>
    draggedSet && draggedSet.exIdx === exIdx && (setIdx === undefined || draggedSet.setIdx === setIdx);

  const renderSetRow = ({ exIdx, exId, set: st, setIdx, total }) => {
    const exObj = EXERCISE_MAP[exId] || EXERCISE_LIBRARY[0];
    const curType = normalizeSetType(st.type);
    const base1RM = getBase1RM ? getBase1RM(exId) : getHistoricalCalculated1RM(exId, history, oneRepMaxes);
    const effInc = getEffectiveIncrementForExercise(exId, currentIncrementLbs);
    const lastW =
      st.lastWeight !== undefined
        ? st.lastWeight
        : calculateLastEquivalentWeightForSet(base1RM, st, total, normCat, setIdx, slot.scheme);
    const timerMMSS = isTimerScheme ? st.timerStr ?? getSetTimerMMSS(st, true) : '';
    const lastTimerDisplay = isTimerScheme ? getLastLoggedTimerDisplay(exId, st, setIdx, lastW, history) : '';
    const setIncValue =
      st.increment !== undefined
        ? st.increment
        : curType === '1 Rep Max' && slot.scheme !== 'Pyramid 1RM'
          ? 0
          : Math.round(((Number(st.weight) || 0) - (Number(lastW) || 0)) * 100) / 100 || effInc;
    const displayIncValue =
      setIncValue === '' || setIncValue === '-' || setIncValue === '.' || setIncValue === '-.'
        ? setIncValue
        : Number(setIncValue) < 0
          ? `${setIncValue}`
          : `+${setIncValue}`;
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
                  lastDisplay: isTimerScheme ? lastTimerDisplay : lastW,
                  incrementDisplay: isTimerScheme ? null : displayIncValue,
                  onEditIncrement: isTimerScheme ? null : () => editValue('increment', setIncValue)
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
      {/* Header: drag handle + two rows of controls + full-height ✕ */}
      <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr) 34px', gap: 0, alignItems: 'stretch' }}>
        <DragNumberBadge label={number} color="var(--dp-color-accent)" height="100%" bg="#18181B" title={headerTitle} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
          {/* Row 1: Category, Muscle Group, Scheme */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0, height: '40px' }}>
            <select
              aria-label="Exercise Category"
              value={normCat}
              onChange={e => onHeaderChange?.({ category: e.target.value })}
              style={{ ...headerSelectStyle, backgroundColor: 'var(--dp-color-accent)', color: '#101010' }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.toUpperCase()}
                </option>
              ))}
            </select>

            <select
              aria-label="Muscle Group Filter"
              value={activeMuscleFilter}
              onChange={e => onHeaderChange?.({ muscleGroupFilter: e.target.value })}
              style={headerSelectStyle}
            >
              {availMuscleGroups.map(mg => (
                <option key={mg} value={mg}>
                  {mg.toUpperCase()}
                </option>
              ))}
            </select>

            <select
              aria-label="Set and Rep Scheme"
              value={slot.scheme || '5x8'}
              onChange={e => onHeaderChange?.({ scheme: e.target.value })}
              style={headerSelectStyle}
            >
              {SCHEME_OPTIONS.map(scm => (
                <option key={scm} value={scm}>
                  {scm.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Row 2: Exercise picker(s) + info cell */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0, height: '40px' }}>
            {(isSuperset ? [0, 1] : [0]).map(idx => {
              const exId = supIds[idx];
              return (
                <div
                  key={idx}
                  style={{
                    gridColumn: isSuperset ? undefined : 'span 2',
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
                    aria-label={isSuperset ? `Superset Exercise ${idx + 1}` : 'Select Exercise'}
                    value={exId}
                    onChange={e => {
                      if (!isSuperset) {
                        onHeaderChange?.({ exerciseId: e.target.value });
                        return;
                      }
                      const nextIds = [...supIds];
                      nextIds[idx] = e.target.value;
                      onHeaderChange?.({ supersetExerciseIds: nextIds });
                    }}
                    style={exerciseSelectStyle}
                  >
                    {poolWith(EXERCISE_MAP[exId]).map(ex => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name.toUpperCase()} ({ex.equipment.toUpperCase()})
                      </option>
                    ))}
                  </select>
                  {prFlags[idx] && <PrBadge marginRight={isSuperset ? '6px' : '8px'} />}
                </div>
              );
            })}
            {infoCell}
          </div>
        </div>

        <DeleteButton label={removeLabel} variant="outline" fill minHeight="80px" onClick={() => onRemove?.()} />
      </div>

      {/* Sets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {rows.map(renderSetRow)}

        {footer}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
          <button
            type="button"
            className="kinetic-btn"
            onClick={() => onInsertSet?.('top')}
            style={bottomBtnStyle('#161618', '#FFFFFF')}
          >
            + ADD SET TOP
          </button>
          <button
            type="button"
            className="kinetic-btn"
            onClick={() => onInsertSet?.('bottom')}
            style={bottomBtnStyle('#161618', 'var(--dp-color-accent)')}
          >
            + ADD SET BOTTOM
          </button>
          <button
            type="button"
            className="kinetic-btn"
            onClick={() => onAction?.()}
            style={actionTone === 'calculate' ? bottomBtnStyle('#30D158', '#000000') : bottomBtnStyle('#121E15', '#30D158')}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Read-only third-column cell for the slot header (e.g. "1RM: 225 LB"). */
export function SlotInfoCell({ children }) {
  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        height: '40px',
        boxSizing: 'border-box',
        backgroundColor: '#18181B',
        ...SHARED_CELL_BORDER,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 800,
        color: '#C0C0C0',
        textTransform: 'uppercase',
        userSelect: 'none',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        padding: '0 4px'
      }}
    >
      {children}
    </div>
  );
}
