'use client';

import React, { useState } from 'react';
import { SHARED_CELL_BORDER, SHARED_GROUP_OUTER } from '../../styles/kineticTokens';
import {
  normalizeSlotCategory,
  isSupersetCategory,
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  formatDateYMD,
  parseYMDToISO
} from '../../data/exerciseLibrary';
import {
  getBestHistory1RMInfo
} from '../../utils/workoutEngine';
import { Button } from '../Controls';
import { SlotEditor } from '../SlotEditor';

// ============================================================================
// VIEW: WORKOUT SESSION / ROUTINE / HISTORICAL ENTRY
// ============================================================================

export function RoutineEditorView({
  colors,
  currentView,
  currentEditorWorkout,
  selectedGymId,
  gyms,
  history,
  oneRepMaxes,
  currentIncrementLbs = 1.25,
  setHistoricalDraft,
  setDeleteConfirmTarget,
  isCurrentEditorShared,
  updateCurrentWorkoutState,
  handleAddAutoSlot,
  handleShareCurrentEditor,
  handleUpdateSlotCategoryOrExercise,
  handleInsertSetAtPosition,
  handleRecalculateSlotWeights,
  handleToggleSetDone,
  handleReorderExercises,
  handleReorderSets,
  openPlateCalculatorForSet,
  setSetValueTarget,
  openedFromRoutines = false,
  setOpenedFromRoutines,
  isEmbeddedHistorySession = false
}) {
  const [draggedSlotIndex, setDraggedSlotIndex] = useState(null);

  if (!currentEditorWorkout) return null;

  const hasExercises = (currentEditorWorkout.slots || []).length > 0;

  return (
    <div style={{ paddingTop: isEmbeddedHistorySession ? '8px' : '14px' }}>
      {/* Session name, SAVE and RESET sit in the locked header (SessionTitleBar). This block only holds the
          past-workout title / date, and the name for the History inline editor (which has no locked header). */}
      {(currentView === 'historical_entry' || isEmbeddedHistorySession) && (
      <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
        {currentView === 'historical_entry' && (
          <div
            style={{
              fontSize: '20px',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              textTransform: 'uppercase',
              color: '#FFFFFF',
              lineHeight: 1.05,
              marginBottom: '8px'
            }}
          >
            LOG PAST WORKOUT
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            width: '100%',
            ...SHARED_GROUP_OUTER
          }}
        >
          {/* Session Name (History inline editor only) */}
          {isEmbeddedHistorySession && (
          <div
            style={{
              width: '100%',
              backgroundColor: '#141416',
              ...SHARED_CELL_BORDER,
              padding: '8px 12px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontWeight: 800,
                color: 'var(--dp-color-accent)',
                textTransform: 'uppercase',
                lineHeight: 1.15,
                letterSpacing: '0.03em'
              }}
            >
              SESSION NAME
            </div>
            <input
              type="text"
              value={currentEditorWorkout.title || ''}
              onChange={e => updateCurrentWorkoutState(prev => ({ ...prev, title: e.target.value }))}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 800,
                textTransform: 'uppercase',
                outline: 'none',
                padding: 0,
                marginTop: '2px',
                lineHeight: 1.2
              }}
            />
          </div>
          )}

          {/* Optional Row: Historical Date Row if logging past workout or editing in History */}
          {(currentView === 'historical_entry' || isEmbeddedHistorySession) && (
            <div
              style={{
                width: '100%',
                backgroundColor: '#18181A',
                ...SHARED_CELL_BORDER,
                padding: '8px 12px',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: '#E0E0E0' }}>
                WORKOUT DATE
              </span>
              <input
                type="text"
                placeholder="YYYY/MM/DD"
                value={
                  currentEditorWorkout.workoutDate
                    ? String(currentEditorWorkout.workoutDate).replace(/-/g, '/')
                    : currentEditorWorkout.startedAt
                      ? formatDateYMD(currentEditorWorkout.startedAt)
                      : ''
                }
                onChange={e => {
                  const nextDate = e.target.value.replace(/-/g, '/');
                  if (isEmbeddedHistorySession) {
                    updateCurrentWorkoutState(prev => ({
                      ...prev,
                      workoutDate: nextDate,
                      startedAt: /^\d{4}\/\d{2}\/\d{2}$/.test(nextDate.trim())
                        ? parseYMDToISO(nextDate)
                        : prev.startedAt
                    }));
                  } else {
                    setHistoricalDraft?.(prev => ({ ...prev, workoutDate: nextDate }));
                  }
                }}
                style={{
                  width: '130px',
                  textAlign: 'center',
                  backgroundColor: '#101010',
                  color: '#FFFFFF',
                  border: '1px solid var(--dp-color-rule)',
                  padding: '5px 10px',
                  fontSize: '13px',
                  fontWeight: 800,
                  outline: 'none'
                }}
              />
            </div>
          )}

        </div>
      </section>
      )}

      {/* ALWAYS-EXPANDED EXERCISES — SHARED BORDERS, LARGER CONTROLS & TEXT */}
      <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
        {!isEmbeddedHistorySession && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              marginBottom: '8px'
            }}
          >
            <div
              style={{
                fontSize: '20px',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                textTransform: 'uppercase',
                color: '#FFFFFF',
                lineHeight: 1.05
              }}
            >
              {`EXERCISES (${(currentEditorWorkout.slots || []).length})`}
            </div>
          </div>
        )}

        <div style={{ borderTop: '2px solid var(--dp-color-rule)' }}>
          {!hasExercises ? null : (
            (currentEditorWorkout.slots || []).map((slot, sIdx) => {
              const isSuperset = isSupersetCategory(normalizeSlotCategory(slot.category));
              const ex1 = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
              const supIds = isSuperset
                ? [
                  slot.supersetExerciseIds?.[0] || slot.exerciseId || 'reverse_lunge',
                  slot.supersetExerciseIds?.[1] || slot.secondaryExerciseId || 'front_flies'
                ]
                : [slot.exerciseId];

              // PR badges: in an embedded History session, flag exercises whose all-time best came from this slot
              const isPrFor = exId => {
                if (!isEmbeddedHistorySession) return false;
                const info = getBestHistory1RMInfo(exId, history);
                return Boolean(
                  info?.best > 0 &&
                    info?.workoutId === currentEditorWorkout.id &&
                    (!info?.slotId || info.slotId === slot.id)
                );
              };
              const prFlags = isSuperset ? [isPrFor(supIds[0]), isPrFor(supIds[1])] : [isPrFor(supIds[0]), false];

              return (
                <div
                  key={slot.id}
                  draggable={true}
                  onDragStart={() => setDraggedSlotIndex(sIdx)}
                  onDragOver={e => {
                    if (draggedSlotIndex !== null) {
                      e.preventDefault();
                    }
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    if (draggedSlotIndex !== null && draggedSlotIndex !== sIdx) {
                      handleReorderExercises?.(draggedSlotIndex, sIdx);
                    }
                    setDraggedSlotIndex(null);
                  }}
                  onDragEnd={() => setDraggedSlotIndex(null)}
                  style={{
                    borderBottom: '2px solid var(--dp-color-rule)',
                    padding: '12px 0',
                    opacity: draggedSlotIndex === sIdx ? 0.55 : 1
                  }}
                >
                  <SlotEditor
                    slot={slot}
                    number={sIdx + 1}
                    selectedGymId={selectedGymId}
                    gyms={gyms}
                    history={history}
                    oneRepMaxes={oneRepMaxes}
                    currentIncrementLbs={currentIncrementLbs}
                    prFlags={prFlags}
                    onHeaderChange={changes => handleUpdateSlotCategoryOrExercise(slot.id, changes)}
                    onRemove={() =>
                      setDeleteConfirmTarget({
                        type: 'slot',
                        slotId: slot.id,
                        label: isSuperset
                          ? `${EXERCISE_MAP[supIds[0]]?.name || supIds[0]} / ${EXERCISE_MAP[supIds[1]]?.name || supIds[1]}`
                          : ex1.name
                      })
                    }
                    onEditSetValue={({ mode, exIdx, set, exercise, currentValue }) =>
                      setSetValueTarget?.({
                        mode,
                        slotId: slot.id,
                        exIdx,
                        setId: set.id,
                        setNumber: set.setNumber,
                        exerciseName: exercise.name,
                        currentValue,
                        isAbs: false
                      })
                    }
                    onEditWeight={({ exIdx, set, exercise, ...setInfo }) =>
                      openPlateCalculatorForSet(slot.id, exIdx, set, exercise.name, null, setInfo)
                    }
                    onToggleDone={({ exIdx, set }) => handleToggleSetDone(slot, exIdx, set)}
                    onDeleteSet={({ exIdx, set, exercise }) =>
                      setDeleteConfirmTarget({
                        type: 'set',
                        slotId: slot.id,
                        exIdx,
                        setId: set.id,
                        label: `${exercise.name} — Set ${set.setNumber}`
                      })
                    }
                    onReorderSets={(exIdx, fromIdx, toIdx) => handleReorderSets?.(slot.id, exIdx, fromIdx, toIdx)}
                    onInsertSet={position => handleInsertSetAtPosition(slot.id, position)}
                    actionLabel="RECALCULATE"
                    onAction={() => handleRecalculateSlotWeights(slot.id)}
                  />
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* + ADD EXERCISE: appends an auto-guessed exercise the athlete can then edit */}
      <div style={{ padding: '0 var(--dp-spacing-gutter)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0, width: '100%', ...SHARED_GROUP_OUTER }}>
          <Button
            variant="dashed"
            onClick={() => handleAddAutoSlot?.()}
            style={{ height: '48px', fontSize: '13px', fontWeight: 800, ...SHARED_CELL_BORDER, backgroundColor: '#161618', color: '#FFFFFF', whiteSpace: 'nowrap', boxSizing: 'border-box' }}
          >
            + ADD EXERCISE
          </Button>
        </div>

      </div>
    </div>
  );
}

export default RoutineEditorView;
