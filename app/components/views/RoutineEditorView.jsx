'use client';

import React, { useState } from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  DEFAULT_GYM_EQUIPMENT_PRESETS,
  SLOT_CATEGORIES,
  normalizeSlotCategory,
  isSupersetCategory,
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  filterAddSlotExercises,
  getFilteredExercisesForSlotInline,
  getAvailableMuscleGroupsForCategory,
  getGymSelectionLabel
} from '../../data/exerciseLibrary';
import {
  normalizeSetType,
  calculateLastEquivalentWeightForSet,
  getHistoricalCalculated1RM
} from '../../utils/workoutEngine';

// ============================================================================
// DRAG HANDLE WITH GRIPPY DOTS FILLING BOX BEHIND NUMBER
// ============================================================================

function DragNumberBadge({ label, color = 'var(--dp-color-accent)', height = '34px', title = 'Click and drag to rearrange' }) {
  return (
    <div
      title={title}
      style={{
        position: 'relative',
        width: '28px',
        height,
        minHeight: height,
        boxSizing: 'border-box',
        backgroundColor: '#101010',
        border: '2px solid var(--dp-color-rule)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        userSelect: 'none',
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      {/* Grippy Dots Pattern Filling the Box Behind the Number */}
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

      {/* Foreground Number Pill */}
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          backgroundColor: 'rgba(16, 16, 16, 0.86)',
          padding: '1px 3px',
          fontSize: '12px',
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

// ============================================================================
// VIEW: WORKOUT SESSION / ROUTINE / HISTORICAL ENTRY
// ============================================================================

export function RoutineEditorView({
  colors,
  currentView,
  currentEditorWorkout,
  setRoutineSelectReturnView,
  setCurrentView,
  selectedGymId,
  setSelectedGymId,
  gyms,
  history,
  oneRepMaxes,
  currentIncrementLbs = 1.25,
  newSlotCategory,
  newSlotMuscleGroup = 'All Muscles',
  setAddSlotGymFilter,
  setNewSlotEx1,
  setNewSlotSupersetIds,
  setShowAddSlotModal,
  setHistoricalDraft,
  setDeleteConfirmTarget,
  isCurrentEditorShared,
  updateCurrentWorkoutState,
  handleAutoBuildWorkout,
  handleSaveCurrentEditor,
  handleShareCurrentEditor,
  handleResetCurrentEditor,
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
  isEmbeddedHistorySession = false,
  onAddExerciseCustom
}) {
  const [draggedSlotIndex, setDraggedSlotIndex] = useState(null);
  const [draggedSetInfo, setDraggedSetInfo] = useState(null);

  if (!currentEditorWorkout) return null;

  const hasExercises = (currentEditorWorkout.slots || []).length > 0;

  const renderSaveShareResetRow = () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '6px',
        width: '100%',
        alignItems: 'stretch'
      }}
    >
      <button
        type="button"
        onClick={handleSaveCurrentEditor}
        className="kinetic-btn"
        style={{
          ...UI.primaryBtnCenter,
          height: '38px',
          padding: '0 8px',
          fontSize: '12px',
          boxSizing: 'border-box'
        }}
      >
        SAVE
      </button>

      <button
        type="button"
        onClick={handleShareCurrentEditor}
        className="kinetic-btn"
        style={{
          ...UI.secondaryBtnCenter,
          height: '38px',
          padding: '0 8px',
          fontSize: '12px',
          boxSizing: 'border-box',
          backgroundColor: isCurrentEditorShared ? '#30D158' : '#161616',
          color: isCurrentEditorShared ? '#101010' : '#FFFFFF'
        }}
      >
        {isCurrentEditorShared ? 'SHARED ✓' : 'SHARE'}
      </button>

      <button
        type="button"
        onClick={handleResetCurrentEditor}
        className="kinetic-btn"
        style={{
          ...UI.secondaryBtnCenter,
          height: '38px',
          padding: '0 8px',
          fontSize: '12px',
          boxSizing: 'border-box',
          color: '#FF3B30'
        }}
      >
        RESET
      </button>
    </div>
  );

  return (
    <div style={{ paddingTop: isEmbeddedHistorySession ? '8px' : '14px' }}>
      <IOSListSection
        header={currentView === 'historical_entry' ? 'LOG PAST WORKOUT' : null}
        colors={colors}
      >
        {/* Compact Session Name Row */}
        <IOSListRow colors={colors} style={{ padding: '6px 10px' }}>
          <div
            style={{
              width: '100%', backgroundColor: '#101010', border: '2px solid var(--dp-color-rule)',
              padding: '5px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center'
            }}
          >
            <div
              style={{
                fontSize: '9px', fontWeight: 800, color: 'var(--dp-color-accent)',
                textTransform: 'uppercase', lineHeight: 1.1
              }}
            >
              SESSION NAME
            </div>
            <input
              type="text"
              value={currentEditorWorkout.title || ''}
              onChange={e => updateCurrentWorkoutState(prev => ({ ...prev, title: e.target.value }))}
              style={{
                width: '100%', backgroundColor: 'transparent', border: 'none', color: '#FFFFFF',
                fontSize: '13px', fontWeight: 800, textTransform: 'uppercase',
                outline: 'none', padding: 0, marginTop: '1px', lineHeight: 1.2
              }}
            />
          </div>
        </IOSListRow>

        {/* Historical Date Row if logging past workout or editing in History */}
        {(currentView === 'historical_entry' || isEmbeddedHistorySession) && (
          <IOSListRow colors={colors} style={{ padding: '6px 10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
              WORKOUT DATE
            </span>
            <input
              type="date"
              value={
                currentEditorWorkout.workoutDate ||
                (currentEditorWorkout.startedAt
                  ? new Date(currentEditorWorkout.startedAt).toISOString().split('T')[0]
                  : '')
              }
              onChange={e => {
                const nextDate = e.target.value;
                if (isEmbeddedHistorySession) {
                  updateCurrentWorkoutState(prev => ({
                    ...prev,
                    workoutDate: nextDate,
                    startedAt: nextDate ? new Date(`${nextDate}T12:00:00`).toISOString() : prev.startedAt
                  }));
                } else {
                  setHistoricalDraft?.(prev => ({ ...prev, workoutDate: nextDate }));
                }
              }}
              style={{
                backgroundColor: '#101010', color: '#FFFFFF',
                border: '2px solid var(--dp-color-rule)', padding: '4px 8px',
                fontSize: '11px', fontWeight: 800
              }}
            />
          </IOSListRow>
        )}

        {/* Top Action Row (Gyms/Equipment, Load, Auto) + Save/Share/Reset (hidden when empty) */}
        <IOSListRow isLast={true} colors={colors} style={{ padding: '6px 10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '6px',
                width: '100%',
                alignItems: 'stretch'
              }}
            >
              {/* Column 1: Gyms/Equipment (Dual-Line Format) */}
              <div
                style={{
                  width: '100%', height: '38px', boxSizing: 'border-box',
                  position: 'relative', backgroundColor: '#101010',
                  border: '2px solid var(--dp-color-rule)', padding: '0 8px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  alignItems: 'flex-start', textAlign: 'left', minWidth: 0
                }}
              >
                <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--dp-color-accent)', textTransform: 'uppercase', lineHeight: 1.1 }}>
                  GYMS/EQUIPMENT ▾
                </div>
                <div
                  style={{
                    fontSize: '11px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    width: '100%', lineHeight: 1.2
                  }}
                >
                  {getGymSelectionLabel(selectedGymId, gyms)}
                </div>
                <select
                  aria-label="Select Gyms/Equipment"
                  value={selectedGymId || ''}
                  onChange={e => setSelectedGymId(e.target.value)}
                  style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    opacity: 0, backgroundColor: '#101010', color: '#FFFFFF', cursor: 'pointer'
                  }}
                >
                  {DEFAULT_GYM_EQUIPMENT_PRESETS.map(preset => (
                    <option key={preset.id || 'full_gym'} value={preset.id}>
                      {preset.name.toUpperCase()}
                    </option>
                  ))}
                  {gyms.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Column 2: Routines / Load (Dual-Line Format) */}
              <button
                type="button"
                onClick={() => {
                  setRoutineSelectReturnView(currentView);
                  setCurrentView('routines');
                }}
                className="kinetic-btn"
                style={{
                  width: '100%', height: '38px', boxSizing: 'border-box',
                  padding: '0 8px', backgroundColor: '#101010',
                  border: '2px solid var(--dp-color-rule)', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  alignItems: 'flex-start', textAlign: 'left', minWidth: 0
                }}
              >
                <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--dp-color-accent)', textTransform: 'uppercase', lineHeight: 1.1 }}>
                  ROUTINES
                </div>
                <div
                  style={{
                    fontSize: '11px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', lineHeight: 1.2
                  }}
                >
                  LOAD
                </div>
              </button>

              {/* Column 3: Routines / Auto (Dual-Line Format, Text Only) */}
              <button
                type="button"
                onClick={handleAutoBuildWorkout}
                className="kinetic-btn"
                style={{
                  width: '100%', height: '38px', boxSizing: 'border-box',
                  padding: '0 8px', backgroundColor: 'var(--dp-color-accent)',
                  color: '#101010', border: '2px solid #FFFFFF', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  alignItems: 'flex-start', textAlign: 'left', minWidth: 0
                }}
              >
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#101010', textTransform: 'uppercase', lineHeight: 1.1, opacity: 0.85 }}>
                  ROUTINES
                </div>
                <div
                  style={{
                    fontSize: '11px', fontWeight: 800, color: '#101010', textTransform: 'uppercase',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', lineHeight: 1.2
                  }}
                >
                  AUTO
                </div>
              </button>
            </div>

            {/* Save / Share / Reset Row (hidden when session is empty) */}
            {hasExercises && renderSaveShareResetRow()}
          </div>
        </IOSListRow>
      </IOSListSection>

      {/* ALWAYS-EXPANDED EXERCISES WITH STANDARDIZED CONTENT WIDTHS & DRAG-AND-DROP */}
      <IOSListSection
        header={`EXERCISES (${(currentEditorWorkout.slots || []).length})`}
        colors={colors}
      >
        {!hasExercises ? null : (
          (currentEditorWorkout.slots || []).map((slot, sIdx) => {
            const normCat = normalizeSlotCategory(slot.category);
            const ex1 = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
            const isSuperset = isSupersetCategory(normCat);
            const availMuscleGroups = getAvailableMuscleGroupsForCategory(normCat, selectedGymId, gyms);
            const rawSlotMuscle = slot.muscleGroupFilter || ex1?.muscleGroup || 'All Muscles';
            const activeMuscleFilter = availMuscleGroups.includes(rawSlotMuscle)
              ? rawSlotMuscle
              : 'All Muscles';
            const inlineExercisePool = getFilteredExercisesForSlotInline(
              { ...slot, muscleGroupFilter: activeMuscleFilter },
              selectedGymId,
              gyms
            );

            const supIds = isSuperset
              ? [
                slot.supersetExerciseIds?.[0] || slot.exerciseId || 'reverse_lunge',
                slot.supersetExerciseIds?.[1] || slot.secondaryExerciseId || 'front_flies'
              ]
              : [slot.exerciseId];

            const alternatingSupersetRows = [];
            if (isSuperset) {
              const listA = slot.supersetSetsByExercise?.[0] || slot.sets || [];
              const listB = slot.supersetSetsByExercise?.[1] || slot.secondarySets || [];
              const maxLen = Math.max(listA.length, listB.length);
              for (let i = 0; i < maxLen; i++) {
                if (listA[i]) {
                  alternatingSupersetRows.push({
                    exIdx: 0, exId: supIds[0], setItem: listA[i], setIdxInEx: i, totalExSets: listA.length
                  });
                }
                if (listB[i]) {
                  alternatingSupersetRows.push({
                    exIdx: 1, exId: supIds[1], setItem: listB[i], setIdxInEx: i, totalExSets: listB.length
                  });
                }
              }
            }

            const renderSingleSetRow = (st, exIdx, exId, setIdxInEx, totalExSets) => {
              const exObj = EXERCISE_MAP[exId] || EXERCISE_LIBRARY[0];
              const curType = normalizeSetType(st.type);
              const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
              const lastW =
                st.lastWeight !== undefined
                  ? st.lastWeight
                  : calculateLastEquivalentWeightForSet(calc1RM, st, totalExSets, normCat);
              const setIncValue =
                st.increment !== undefined
                  ? st.increment
                  : curType === '1 Rep Max'
                    ? 0
                    : Math.round(((Number(st.weight) || 0) - (Number(lastW) || 0)) * 100) / 100 || currentIncrementLbs;
              const displayIncValue =
                setIncValue === '' || setIncValue === '-' || setIncValue === '.' || setIncValue === '-.'
                  ? setIncValue
                  : Number(setIncValue) < 0
                    ? `${setIncValue}`
                    : `+${setIncValue}`;

              const setNumText = isSuperset
                ? `${exIdx === 0 ? 'A' : 'B'}${st.setNumber}`
                : `${st.setNumber}`;

              return (
                <div
                  key={`${exIdx}_${st.id}`}
                  draggable={true}
                  onDragStart={e => {
                    e.stopPropagation();
                    setDraggedSetInfo({ slotId: slot.id, exIdx, setIdx: setIdxInEx });
                  }}
                  onDragOver={e => {
                    if (
                      draggedSetInfo &&
                      draggedSetInfo.slotId === slot.id &&
                      draggedSetInfo.exIdx === exIdx
                    ) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onDrop={e => {
                    e.stopPropagation();
                    if (
                      draggedSetInfo &&
                      draggedSetInfo.slotId === slot.id &&
                      draggedSetInfo.exIdx === exIdx &&
                      draggedSetInfo.setIdx !== setIdxInEx
                    ) {
                      handleReorderSets?.(slot.id, exIdx, draggedSetInfo.setIdx, setIdxInEx);
                    }
                    setDraggedSetInfo(null);
                  }}
                  onDragEnd={() => setDraggedSetInfo(null)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px minmax(0, 1fr) 26px',
                    gap: '6px',
                    alignItems: 'stretch',
                    opacity:
                      draggedSetInfo &&
                      draggedSetInfo.slotId === slot.id &&
                      draggedSetInfo.exIdx === exIdx &&
                      draggedSetInfo.setIdx === setIdxInEx
                        ? 0.55
                        : 1
                  }}
                >
                  {/* Left Set Number + 3 Horizontal Bars Drag Handle (No "#" Symbol) */}
                  <DragNumberBadge
                    label={setNumText}
                    color={isSuperset ? (exIdx === 0 ? 'var(--dp-color-accent)' : '#FFFFFF') : '#E0E0E0'}
                    height="100%"
                    title="Click and drag to rearrange set"
                  />

                  {/* Standardized Set Content Box */}
                  <div
                    style={{
                      padding: '5px 6px',
                      backgroundColor: st.completed ? '#172B1C' : '#161616',
                      border: '2px solid var(--dp-color-rule)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      minWidth: 0
                    }}
                  >
                    {isSuperset && (
                      <div
                        style={{
                          fontSize: '9px',
                          fontWeight: 800,
                          color: exIdx === 0 ? 'var(--dp-color-accent)' : '#A0A0A0',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.1
                        }}
                      >
                        {exIdx === 0 ? 'A: ' : 'B: '}
                        {exObj.name}
                      </div>
                    )}

                    {/* Horizontally aligned row: Set Type (Pop-up), LAST, INC (Pop-up), CURRENT (Pop-up), REPS (Pop-up), and Checkmark */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          normCat === 'Abs'
                            ? 'minmax(0, 1fr) 56px 34px'
                            : '72px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.15fr) 42px 34px',
                        gap: '4px',
                        alignItems: 'center'
                      }}
                    >
                      {/* 1. Compact Set Type Pop-up Button (No Arrow) */}
                      <button
                        type="button"
                        aria-label="Set Type"
                        onClick={() =>
                          setSetValueTarget?.({
                            mode: 'type',
                            slotId: slot.id,
                            exIdx,
                            setId: st.id,
                            setNumber: st.setNumber,
                            exerciseName: exObj.name,
                            currentValue: curType,
                            isAbs: normCat === 'Abs'
                          })
                        }
                        style={{
                          width: '100%', minWidth: 0, height: '34px', boxSizing: 'border-box',
                          backgroundColor: '#101010', color: '#FFFFFF',
                          border: '2px solid var(--dp-color-rule)', padding: '0 3px',
                          fontSize: '11px', fontWeight: 800, textTransform: 'uppercase',
                          cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          textAlign: 'center'
                        }}
                      >
                        {curType.toUpperCase()}
                      </button>

                      {/* 2. "LAST" Calculated Equivalent Weight Box */}
                      {normCat !== 'Abs' && (
                        <div
                          style={{
                            width: '100%', minWidth: 0, height: '34px', boxSizing: 'border-box',
                            backgroundColor: '#101010', border: '2px solid var(--dp-color-rule)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', userSelect: 'none', pointerEvents: 'none', whiteSpace: 'nowrap'
                          }}
                        >
                          <span style={{ fontSize: '7.5px', fontWeight: 800, color: '#888888', lineHeight: 1 }}>
                            LAST
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#A0A0A0', lineHeight: 1.15 }}>
                            {lastW}
                          </span>
                        </div>
                      )}

                      {/* 3. "INC" Weight Increment Pop-up Button */}
                      {normCat !== 'Abs' && (
                        <button
                          type="button"
                          aria-label="Weight Increment"
                          onClick={() =>
                            setSetValueTarget?.({
                              mode: 'increment',
                              slotId: slot.id,
                              exIdx,
                              setId: st.id,
                              setNumber: st.setNumber,
                              exerciseName: exObj.name,
                              currentValue: setIncValue,
                              isAbs: false
                            })
                          }
                          style={{
                            width: '100%', minWidth: 0, height: '34px', boxSizing: 'border-box',
                            backgroundColor: '#101010', border: '2px solid var(--dp-color-rule)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', padding: '0 2px', cursor: 'pointer', whiteSpace: 'nowrap'
                          }}
                        >
                          <span style={{ fontSize: '7.5px', fontWeight: 800, color: '#888888', lineHeight: 1 }}>
                            INC
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.15 }}>
                            {displayIncValue}
                          </span>
                        </button>
                      )}

                      {/* 4. "CURRENT" Weight Pop-up Button (no "LB" suffix) */}
                      {normCat !== 'Abs' && (
                        <button
                          type="button"
                          onClick={() => openPlateCalculatorForSet(slot.id, exIdx, st, exObj.name)}
                          style={{
                            width: '100%', minWidth: 0, height: '34px', boxSizing: 'border-box', padding: '0 2px',
                            backgroundColor: '#101010',
                            border: '2px solid var(--dp-color-rule)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', cursor: 'pointer', whiteSpace: 'nowrap',
                            overflow: 'hidden'
                          }}
                        >
                          <span style={{ fontSize: '7.5px', fontWeight: 800, color: '#888888', lineHeight: 1 }}>
                            CURRENT
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--dp-color-accent)', lineHeight: 1.15 }}>
                            {st.weight}
                          </span>
                        </button>
                      )}

                      {/* 5. Compact Reps Pop-up Button (No Arrows) */}
                      <button
                        type="button"
                        aria-label="Reps"
                        onClick={() =>
                          setSetValueTarget?.({
                            mode: 'reps',
                            slotId: slot.id,
                            exIdx,
                            setId: st.id,
                            setNumber: st.setNumber,
                            exerciseName: exObj.name,
                            currentValue: st.reps,
                            isAbs: normCat === 'Abs'
                          })
                        }
                        style={{
                          width: '100%', minWidth: 0, height: '34px', boxSizing: 'border-box',
                          backgroundColor: '#101010', color: '#FFFFFF',
                          border: '2px solid var(--dp-color-rule)', padding: '0 2px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          justifyContent: 'center', cursor: 'pointer', whiteSpace: 'nowrap'
                        }}
                      >
                        <span style={{ fontSize: '7.5px', fontWeight: 800, color: '#888888', lineHeight: 1 }}>
                          {normCat === 'Abs' ? 'SEC' : 'REPS'}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.15 }}>
                          {st.reps}
                        </span>
                      </button>

                      {/* 6. Grey/Green Checkmark Button */}
                      <button
                        type="button"
                        aria-label="Mark set complete"
                        onClick={() => handleToggleSetDone(slot, exIdx, st)}
                        style={{
                          width: '34px', height: '34px', boxSizing: 'border-box', padding: 0,
                          backgroundColor: st.completed ? '#30D158' : '#262626',
                          color: st.completed ? '#101010' : '#777777',
                          border: '2px solid var(--dp-color-rule)', fontSize: '14px',
                          fontWeight: 800, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        ✓
                      </button>
                    </div>
                  </div>

                  {/* Outside Red Set Delete "✕" Button aligned vertically with Exercise Delete "✕" */}
                  <button
                    type="button"
                    aria-label="Delete set"
                    onClick={() =>
                      setDeleteConfirmTarget({
                        type: 'set',
                        slotId: slot.id,
                        exIdx,
                        setId: st.id,
                        label: `${exObj.name} — Set ${st.setNumber}`
                      })
                    }
                    className="kinetic-btn"
                    style={{
                      ...UI.deleteXBtn,
                      width: '26px',
                      height: '100%',
                      minHeight: '34px',
                      fontSize: '12px',
                      boxSizing: 'border-box'
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            };

            const slot1RMText =
              normCat === 'Abs'
                ? '1RM: --'
                : isSuperset
                  ? `1RM: ${getHistoricalCalculated1RM(supIds[0], history, oneRepMaxes)}/${getHistoricalCalculated1RM(supIds[1], history, oneRepMaxes)} LB`
                  : `1RM: ${getHistoricalCalculated1RM(slot.exerciseId, history, oneRepMaxes)} LB`;

            const singleSelectPool =
              inlineExercisePool.some(e => e.id === slot.exerciseId) || !ex1
                ? inlineExercisePool
                : [ex1, ...inlineExercisePool];

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
                  borderBottom:
                    sIdx === currentEditorWorkout.slots.length - 1
                      ? 'none'
                      : '2px solid var(--dp-color-rule)',
                  opacity: draggedSlotIndex === sIdx ? 0.55 : 1
                }}
              >
                {/* Exercise Header: Standardized 28px Left Drag/Number + Content Box + 26px Right Alignment */}
                <div
                  style={{
                    padding: '10px 12px',
                    backgroundColor: '#1C1C1C',
                    display: 'grid',
                    gridTemplateColumns: '28px minmax(0, 1fr)',
                    gap: '6px',
                    alignItems: 'stretch'
                  }}
                >
                  {/* Left Exercise Number + 3 Horizontal Bars Drag Handle */}
                  <DragNumberBadge
                    label={sIdx + 1}
                    color="var(--dp-color-accent)"
                    height="100%"
                    title="Click and drag to rearrange exercise"
                  />

                  {/* Two Equal-Height Rows Describing Exercise */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                    {/* Row 1: Category Slot + Muscle Group Filter + Scheme Selection */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: '6px',
                        height: '32px'
                      }}
                    >
                      <select
                        aria-label="Exercise Category"
                        value={normCat}
                        onChange={e =>
                          handleUpdateSlotCategoryOrExercise(slot.id, { category: e.target.value })
                        }
                        style={{
                          width: '100%', minWidth: 0, height: '32px', boxSizing: 'border-box',
                          fontSize: '11px', fontWeight: 800, padding: '0 6px',
                          backgroundColor: 'var(--dp-color-accent)', color: '#101010',
                          border: '2px solid #FFFFFF', textTransform: 'uppercase', cursor: 'pointer'
                        }}
                      >
                        {SLOT_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>
                            {cat.toUpperCase()}
                          </option>
                        ))}
                      </select>

                      <select
                        aria-label="Muscle Group Filter"
                        value={activeMuscleFilter}
                        onChange={e =>
                          handleUpdateSlotCategoryOrExercise(slot.id, { muscleGroupFilter: e.target.value })
                        }
                        style={{
                          width: '100%', minWidth: 0, height: '32px', boxSizing: 'border-box',
                          fontSize: '11px', fontWeight: 800, padding: '0 6px',
                          backgroundColor: '#101010', color: '#FFFFFF',
                          border: '2px solid var(--dp-color-rule)', textTransform: 'uppercase', cursor: 'pointer'
                        }}
                      >
                        {availMuscleGroups.map(mg => (
                          <option key={mg} value={mg}>
                            {mg.toUpperCase()}
                          </option>
                        ))}
                      </select>

                      {normCat !== 'Abs' ? (
                        <select
                          aria-label="Set and Rep Scheme"
                          value={slot.scheme || '5x8'}
                          onChange={e =>
                            handleUpdateSlotCategoryOrExercise(slot.id, { scheme: e.target.value })
                          }
                          style={{
                            width: '100%', minWidth: 0, height: '32px', boxSizing: 'border-box',
                            fontSize: '11px', fontWeight: 800, padding: '0 6px',
                            backgroundColor: '#101010', color: '#FFFFFF',
                            border: '2px solid var(--dp-color-rule)', textTransform: 'uppercase', cursor: 'pointer'
                          }}
                        >
                          {['5x5', '5x8', '8x8', 'Pyramid', 'Pyramid 1RM', 'Reverse Pyramid'].map(scm => (
                            <option key={scm} value={scm}>{scm.toUpperCase()}</option>
                          ))}
                        </select>
                      ) : (
                        <div
                          style={{
                            width: '100%', minWidth: 0, height: '32px', boxSizing: 'border-box',
                            backgroundColor: '#101010', border: '2px solid var(--dp-color-rule)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 800, color: '#888888', textTransform: 'uppercase',
                            userSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                          }}
                        >
                          TIMED
                        </div>
                      )}
                    </div>

                    {/* Row 2: Exercise Selection (Aligned with Muscle Group Box), 1RM Readout, and Red X */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: '6px',
                        height: '32px'
                      }}
                    >
                      {isSuperset ? (
                        [0, 1].map(idx => {
                          const exId = supIds[idx];
                          const exObj = EXERCISE_MAP[exId];
                          const supSelectPool =
                            inlineExercisePool.some(e => e.id === exId) || !exObj
                              ? inlineExercisePool
                              : [exObj, ...inlineExercisePool];
                          return (
                            <select
                              key={idx}
                              aria-label={`Superset Exercise ${idx + 1}`}
                              value={exId}
                              onChange={e => {
                                const nextIds = [...supIds];
                                nextIds[idx] = e.target.value;
                                handleUpdateSlotCategoryOrExercise(slot.id, { supersetExerciseIds: nextIds });
                              }}
                              style={{
                                width: '100%', minWidth: 0, height: '32px', boxSizing: 'border-box',
                                backgroundColor: '#101010', color: '#FFFFFF',
                                border: '2px solid var(--dp-color-rule)', padding: '0 6px',
                                fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                              }}
                            >
                              {supSelectPool.map(ex => (
                                <option key={ex.id} value={ex.id}>
                                  {ex.name.toUpperCase()} ({ex.equipment.toUpperCase()})
                                </option>
                              ))}
                            </select>
                          );
                        })
                      ) : (
                        <select
                          aria-label="Select Exercise"
                          value={slot.exerciseId}
                          onChange={e =>
                            handleUpdateSlotCategoryOrExercise(slot.id, { exerciseId: e.target.value })
                          }
                          style={{
                            gridColumn: 'span 2',
                            width: '100%', minWidth: 0, height: '32px', boxSizing: 'border-box',
                            backgroundColor: '#101010', color: '#FFFFFF',
                            border: '2px solid var(--dp-color-rule)', padding: '0 6px',
                            fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                          }}
                        >
                          {singleSelectPool.map(ex => (
                            <option key={ex.id} value={ex.id}>
                              {ex.name.toUpperCase()} ({ex.equipment.toUpperCase()})
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Column 3: Greyed-Out Calculated 1RM Box + Red Remove Exercise Button */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) 26px',
                          gap: '6px',
                          height: '32px',
                          minWidth: 0
                        }}
                      >
                        <div
                          style={{
                            width: '100%', minWidth: 0, height: '32px', boxSizing: 'border-box',
                            backgroundColor: '#101010',
                            border: '2px solid var(--dp-color-rule)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 800,
                            color: '#A0A0A0',
                            textTransform: 'uppercase',
                            userSelect: 'none',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            padding: '0 4px'
                          }}
                        >
                          {slot1RMText}
                        </div>

                        <button
                          type="button"
                          aria-label="Remove exercise"
                          onClick={() =>
                            setDeleteConfirmTarget({
                              type: 'slot',
                              slotId: slot.id,
                              label: isSuperset
                                ? `${EXERCISE_MAP[supIds[0]]?.name || supIds[0]} / ${EXERCISE_MAP[supIds[1]]?.name || supIds[1]}`
                                : ex1.name
                            })
                          }
                          className="kinetic-btn"
                          style={{
                            ...UI.deleteXBtn,
                            width: '26px',
                            height: '32px',
                            fontSize: '12px',
                            boxSizing: 'border-box'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Always-Expanded Sets Content (Standardized Horizontal Padding) */}
                <div
                  style={{
                    padding: '10px 12px 12px',
                    backgroundColor: '#101010',
                    borderTop: '2px solid var(--dp-color-rule)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {isSuperset
                      ? alternatingSupersetRows.map(row =>
                        renderSingleSetRow(row.setItem, row.exIdx, row.exId, row.setIdxInEx, row.totalExSets)
                      )
                      : (slot.sets || []).map((st, sIdxInEx) =>
                        renderSingleSetRow(st, 0, slot.exerciseId, sIdxInEx, (slot.sets || []).length)
                      )}
                  </div>

                  {/* Bottom Row: + Add Set Top, + Add Set Bottom, and Recalculate */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: '6px',
                      marginTop: '10px'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleInsertSetAtPosition(slot.id, 'top')}
                      className="kinetic-btn"
                      style={{
                        height: '34px', boxSizing: 'border-box', padding: '0 6px',
                        backgroundColor: '#161616', color: '#FFFFFF',
                        border: '2px dashed var(--dp-color-rule)', fontSize: '11px',
                        fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                      }}
                    >
                      + ADD SET TOP
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertSetAtPosition(slot.id, 'bottom')}
                      className="kinetic-btn"
                      style={{
                        height: '34px', boxSizing: 'border-box', padding: '0 6px',
                        backgroundColor: '#161616', color: 'var(--dp-color-accent)',
                        border: '2px dashed var(--dp-color-rule)', fontSize: '11px',
                        fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                      }}
                    >
                      + ADD SET BOTTOM
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRecalculateSlotWeights(slot.id)}
                      className="kinetic-btn"
                      style={{
                        height: '34px', boxSizing: 'border-box', padding: '0 6px',
                        backgroundColor: '#101010', color: '#30D158',
                        border: '2px solid var(--dp-color-rule)', fontSize: '11px',
                        fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                      }}
                    >
                      RECALCULATE
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </IOSListSection>

      {/* ADD EXERCISE BUTTON AT BOTTOM (Save/Share/Reset removed from bottom) */}
      <div style={{ padding: '0 var(--dp-spacing-gutter)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          type="button"
          onClick={() => {
            if (onAddExerciseCustom) {
              onAddExerciseCustom();
              return;
            }
            setAddSlotGymFilter(selectedGymId);
            const avail = filterAddSlotExercises(selectedGymId, newSlotCategory, gyms, newSlotMuscleGroup);
            if (avail.length > 0) {
              setNewSlotEx1(avail[0].id);
              setNewSlotSupersetIds([avail[0].id, (avail[1] || avail[0]).id]);
            }
            setShowAddSlotModal(true);
          }}
          className="kinetic-btn"
          style={UI.dashedBtn}
        >
          + ADD EXERCISE
        </button>
      </div>
    </div>
  );
}

export default RoutineEditorView;
