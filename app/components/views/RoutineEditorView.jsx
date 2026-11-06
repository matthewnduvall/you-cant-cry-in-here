'use client';

import React, { useState } from 'react';
import { UI } from '../../styles/kineticTokens';
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
  getGymSelectionLabel,
  formatDateYMD,
  parseYMDToISO
} from '../../data/exerciseLibrary';
import {
  normalizeSetType,
  calculateLastEquivalentWeightForSet,
  getEffectiveIncrementForExercise,
  getHistoricalCalculated1RM,
  getPersonalRecord1RM
} from '../../utils/workoutEngine';

const SHARED_CELL_BORDER = {
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: '1px solid var(--dp-color-rule)',
  borderBottom: '1px solid var(--dp-color-rule)'
};

const SHARED_GROUP_OUTER = {
  borderTop: '1px solid var(--dp-color-rule)',
  borderLeft: '1px solid var(--dp-color-rule)'
};

// ============================================================================
// DRAG HANDLE WITH GRIPPY DOTS FILLING BOX BEHIND NUMBER (SHARED BORDER)
// ============================================================================

function DragNumberBadge({
  label,
  color = 'var(--dp-color-accent)',
  height = '44px',
  bg = '#121212',
  title = 'Click and drag to rearrange'
}) {
  return (
    <div
      title={title}
      style={{
        position: 'relative',
        width: '34px',
        height,
        minHeight: height,
        boxSizing: 'border-box',
        backgroundColor: bg,
        ...SHARED_CELL_BORDER,
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
          backgroundColor: 'rgba(16, 16, 16, 0.88)',
          padding: '2px 4px',
          fontSize: '14px',
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
        gap: 0,
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
          height: '44px',
          padding: '0 10px',
          fontSize: '14px',
          ...SHARED_CELL_BORDER,
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
          height: '44px',
          padding: '0 10px',
          fontSize: '14px',
          ...SHARED_CELL_BORDER,
          boxSizing: 'border-box',
          backgroundColor: isCurrentEditorShared ? '#30D158' : '#18181A',
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
          height: '44px',
          padding: '0 10px',
          fontSize: '14px',
          ...SHARED_CELL_BORDER,
          boxSizing: 'border-box',
          backgroundColor: '#141416',
          color: '#FF3B30'
        }}
      >
        RESET
      </button>
    </div>
  );

  return (
    <div style={{ paddingTop: isEmbeddedHistorySession ? '8px' : '14px' }}>
      {/* TOP SESSION HEADER BLOCK — SHARED BORDERS, LARGER TEXT, ZERO GAPS */}
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
          {/* Row 1: Session Name */}
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

          {/* Row 2: Top Action Row (Gyms/Equipment, Load, Auto — Shared Border, Larger Text) */}
          {!isEmbeddedHistorySession && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 0,
                width: '100%',
                alignItems: 'stretch'
              }}
            >
              {/* Column 1: Gyms/Equipment */}
              <div
                style={{
                  width: '100%',
                  height: '48px',
                  boxSizing: 'border-box',
                  position: 'relative',
                  backgroundColor: '#161618',
                  ...SHARED_CELL_BORDER,
                  padding: '0 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  minWidth: 0
                }}
              >
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: 'var(--dp-color-accent)',
                    textTransform: 'uppercase',
                    lineHeight: 1.15
                  }}
                >
                  GYMS/EQUIPMENT ▾
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '100%',
                    lineHeight: 1.25,
                    marginTop: '1px',
                    textAlign: 'center'
                  }}
                >
                  {getGymSelectionLabel(selectedGymId, gyms)}
                </div>
                <select
                  aria-label="Select Gyms/Equipment"
                  value={selectedGymId || ''}
                  onChange={e => setSelectedGymId(e.target.value)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    backgroundColor: '#101010',
                    color: '#FFFFFF',
                    cursor: 'pointer'
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

              {/* Column 2: Routines / Load */}
              <button
                type="button"
                onClick={() => {
                  setRoutineSelectReturnView(currentView);
                  setCurrentView('routines');
                }}
                className="kinetic-btn"
                style={{
                  width: '100%',
                  height: '48px',
                  boxSizing: 'border-box',
                  padding: '0 8px',
                  backgroundColor: '#161618',
                  ...SHARED_CELL_BORDER,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  minWidth: 0
                }}
              >
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: 'var(--dp-color-accent)',
                    textTransform: 'uppercase',
                    lineHeight: 1.15
                  }}
                >
                  ROUTINES
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '100%',
                    lineHeight: 1.25,
                    marginTop: '1px',
                    textAlign: 'center'
                  }}
                >
                  LOAD
                </div>
              </button>

              {/* Column 3: Routines / Auto */}
              <button
                type="button"
                onClick={handleAutoBuildWorkout}
                className="kinetic-btn"
                style={{
                  width: '100%',
                  height: '48px',
                  boxSizing: 'border-box',
                  padding: '0 8px',
                  backgroundColor: 'var(--dp-color-accent)',
                  color: '#101010',
                  ...SHARED_CELL_BORDER,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  minWidth: 0
                }}
              >
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: '#101010',
                    textTransform: 'uppercase',
                    lineHeight: 1.15,
                    opacity: 0.85
                  }}
                >
                  ROUTINES
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#101010',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '100%',
                    lineHeight: 1.25,
                    marginTop: '1px',
                    textAlign: 'center'
                  }}
                >
                  AUTO
                </div>
              </button>
            </div>
          )}

          {/* Row 3: Save / Share / Reset Row (Shared Borders, hidden when session is empty or embedded in History) */}
          {!isEmbeddedHistorySession && hasExercises && renderSaveShareResetRow()}
        </div>
      </section>

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
                const effInc = getEffectiveIncrementForExercise(exId, currentIncrementLbs);
                const lastW =
                  st.lastWeight !== undefined
                    ? st.lastWeight
                    : calculateLastEquivalentWeightForSet(calc1RM, st, totalExSets, normCat, setIdxInEx, slot.scheme);
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

                const setNumText = isSuperset
                  ? `${exIdx === 0 ? 'A' : 'B'}${st.setNumber}`
                  : `${st.setNumber}`;

                const cellBg = st.completed ? '#16291B' : '#141416';

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
                      gridTemplateColumns: '34px minmax(0, 1fr) 34px',
                      gap: 0,
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
                    {/* Left Set Number + Grippy Drag Handle */}
                    <DragNumberBadge
                      label={setNumText}
                      color={isSuperset ? (exIdx === 0 ? 'var(--dp-color-accent)' : '#FFFFFF') : '#FFFFFF'}
                      height="100%"
                      bg={cellBg}
                      title="Click and drag to rearrange set"
                    />

                    {/* Set Row Content (Shared Borders, Larger Text) */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0,
                        minWidth: 0
                      }}
                    >
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

                      {/* Horizontally flush row: Set Type, LAST, INC, CURRENT, REPS, and Checkmark */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            normCat === 'Abs'
                              ? 'minmax(0, 1fr) 64px 44px'
                              : '78px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.15fr) 50px 44px',
                          gap: 0,
                          alignItems: 'stretch'
                        }}
                      >
                        {/* 1. Set Type Pop-up Button */}
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
                            width: '100%',
                            minWidth: 0,
                            height: '44px',
                            boxSizing: 'border-box',
                            backgroundColor: cellBg,
                            color: '#FFFFFF',
                            ...SHARED_CELL_BORDER,
                            padding: '0 4px',
                            fontSize: '12px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            textAlign: 'center'
                          }}
                        >
                          {curType.toUpperCase()}
                        </button>

                        {/* 2. "LAST" Calculated Equivalent Weight Box */}
                        {normCat !== 'Abs' && (
                          <div
                            style={{
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
                              userSelect: 'none',
                              pointerEvents: 'none',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#9A9A9A', lineHeight: 1 }}>
                              LAST
                            </span>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: '#C8C8C8', lineHeight: 1.2, marginTop: '1px' }}>
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
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#9A9A9A', lineHeight: 1 }}>
                              INC
                            </span>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2, marginTop: '1px' }}>
                              {displayIncValue}
                            </span>
                          </button>
                        )}

                        {/* 4. "CURRENT" Weight Pop-up Button */}
                        {normCat !== 'Abs' && (
                          <button
                            type="button"
                            onClick={() => openPlateCalculatorForSet(slot.id, exIdx, st, exObj.name)}
                            style={{
                              width: '100%',
                              minWidth: 0,
                              height: '44px',
                              boxSizing: 'border-box',
                              padding: '0 2px',
                              backgroundColor: cellBg,
                              ...SHARED_CELL_BORDER,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden'
                            }}
                          >
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#9A9A9A', lineHeight: 1 }}>
                              CURRENT
                            </span>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--dp-color-accent)', lineHeight: 1.2, marginTop: '1px' }}>
                              {st.weight}
                            </span>
                          </button>
                        )}

                        {/* 5. Reps Pop-up Button */}
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
                            width: '100%',
                            minWidth: 0,
                            height: '44px',
                            boxSizing: 'border-box',
                            backgroundColor: cellBg,
                            color: '#FFFFFF',
                            ...SHARED_CELL_BORDER,
                            padding: '0 2px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#9A9A9A', lineHeight: 1 }}>
                            {normCat === 'Abs' ? 'SEC' : 'REPS'}
                          </span>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2, marginTop: '1px' }}>
                            {st.reps}
                          </span>
                        </button>

                        {/* 6. Grey/Green Checkmark Button */}
                        <button
                          type="button"
                          aria-label="Mark set complete"
                          onClick={() => handleToggleSetDone(slot, exIdx, st)}
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

                    {/* Outside Red Set Delete "✕" Button */}
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
                        width: '34px',
                        height: '100%',
                        minHeight: '44px',
                        fontSize: '14px',
                        ...SHARED_CELL_BORDER,
                        boxSizing: 'border-box'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              };

              const prValA = getPersonalRecord1RM(supIds[0], history, oneRepMaxes);
              const prValB = isSuperset ? getPersonalRecord1RM(supIds[1], history, oneRepMaxes) : 0;
              const slot1RMText =
                normCat === 'Abs'
                  ? '1RM: --'
                  : isSuperset
                    ? `1RM: ${prValA > 0 ? prValA : 'TBD'}/${prValB > 0 ? prValB : 'TBD'}`
                    : prValA > 0
                      ? `1RM: ${prValA} LB`
                      : '1RM: TBD';

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
                    borderBottom: '2px solid var(--dp-color-rule)',
                    padding: '12px 0',
                    opacity: draggedSlotIndex === sIdx ? 0.55 : 1
                  }}
                >
                  <div style={SHARED_GROUP_OUTER}>
                    {/* Exercise Header: 34px Left Drag/Number + 2-Row Controls */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '34px minmax(0, 1fr)',
                        gap: 0,
                        alignItems: 'stretch'
                      }}
                    >
                      {/* Left Exercise Number + Grippy Drag Handle */}
                      <DragNumberBadge
                        label={sIdx + 1}
                        color="var(--dp-color-accent)"
                        height="100%"
                        bg="#18181B"
                        title="Click and drag to rearrange exercise"
                      />

                      {/* Two Equal-Height Flush Rows Describing Exercise */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
                        {/* Row 1: Category Slot + Muscle Group Filter + Scheme Selection */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                            gap: 0,
                            height: '40px'
                          }}
                        >
                          <select
                            aria-label="Exercise Category"
                            value={normCat}
                            onChange={e =>
                              handleUpdateSlotCategoryOrExercise(slot.id, { category: e.target.value })
                            }
                            style={{
                              width: '100%',
                              minWidth: 0,
                              height: '40px',
                              boxSizing: 'border-box',
                              fontSize: '13px',
                              fontWeight: 800,
                              padding: '0 8px',
                              backgroundColor: 'var(--dp-color-accent)',
                              color: '#101010',
                              ...SHARED_CELL_BORDER,
                              textTransform: 'uppercase',
                              cursor: 'pointer'
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
                              }}
                            >
                              {['5x5', '5x8', '8x8', 'Pyramid', 'Pyramid 1RM', 'Reverse Pyramid'].map(scm => (
                                <option key={scm} value={scm}>{scm.toUpperCase()}</option>
                              ))}
                            </select>
                          ) : (
                            <div
                              style={{
                                width: '100%',
                                minWidth: 0,
                                height: '40px',
                                boxSizing: 'border-box',
                                backgroundColor: '#161618',
                                ...SHARED_CELL_BORDER,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '13px',
                                fontWeight: 800,
                                color: '#888888',
                                textTransform: 'uppercase',
                                userSelect: 'none',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              TIMED
                            </div>
                          )}
                        </div>

                        {/* Row 2: Exercise Selection, 1RM Readout, and Red X */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                            gap: 0,
                            height: '40px'
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
                                    width: '100%',
                                    minWidth: 0,
                                    height: '40px',
                                    boxSizing: 'border-box',
                                    backgroundColor: '#141416',
                                    color: '#FFFFFF',
                                    ...SHARED_CELL_BORDER,
                                    padding: '0 8px',
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    cursor: 'pointer'
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
                                width: '100%',
                                minWidth: 0,
                                height: '40px',
                                boxSizing: 'border-box',
                                backgroundColor: '#141416',
                                color: '#FFFFFF',
                                ...SHARED_CELL_BORDER,
                                padding: '0 8px',
                                fontSize: '13px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                cursor: 'pointer'
                              }}
                            >
                              {singleSelectPool.map(ex => (
                                <option key={ex.id} value={ex.id}>
                                  {ex.name.toUpperCase()} ({ex.equipment.toUpperCase()})
                                </option>
                              ))}
                            </select>
                          )}

                          {/* Column 3: Calculated 1RM Box + Red Remove Exercise Button */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(0, 1fr) 34px',
                              gap: 0,
                              height: '40px',
                              minWidth: 0
                            }}
                          >
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
                                width: '34px',
                                height: '40px',
                                fontSize: '14px',
                                ...SHARED_CELL_BORDER,
                                boxSizing: 'border-box'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Always-Expanded Sets Content (Shared Borders, Flush Right Below Exercise Header) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {isSuperset
                        ? alternatingSupersetRows.map(row =>
                          renderSingleSetRow(row.setItem, row.exIdx, row.exId, row.setIdxInEx, row.totalExSets)
                        )
                        : (slot.sets || []).map((st, sIdxInEx) =>
                          renderSingleSetRow(st, 0, slot.exerciseId, sIdxInEx, (slot.sets || []).length)
                        )}

                      {/* Bottom Row: + Add Set Top, + Add Set Bottom, and Recalculate (Shared Borders) */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: 0
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleInsertSetAtPosition(slot.id, 'top')}
                          className="kinetic-btn"
                          style={{
                            height: '40px',
                            boxSizing: 'border-box',
                            padding: '0 8px',
                            backgroundColor: '#161618',
                            color: '#FFFFFF',
                            ...SHARED_CELL_BORDER,
                            fontSize: '12px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            cursor: 'pointer'
                          }}
                        >
                          + ADD SET TOP
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertSetAtPosition(slot.id, 'bottom')}
                          className="kinetic-btn"
                          style={{
                            height: '40px',
                            boxSizing: 'border-box',
                            padding: '0 8px',
                            backgroundColor: '#161618',
                            color: 'var(--dp-color-accent)',
                            ...SHARED_CELL_BORDER,
                            fontSize: '12px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            cursor: 'pointer'
                          }}
                        >
                          + ADD SET BOTTOM
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRecalculateSlotWeights(slot.id)}
                          className="kinetic-btn"
                          style={{
                            height: '40px',
                            boxSizing: 'border-box',
                            padding: '0 8px',
                            backgroundColor: '#121E15',
                            color: '#30D158',
                            ...SHARED_CELL_BORDER,
                            fontSize: '12px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            cursor: 'pointer'
                          }}
                        >
                          RECALCULATE
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ADD EXERCISE BUTTON AT BOTTOM */}
      <div style={{ padding: '0 var(--dp-spacing-gutter)', display: 'flex', flexDirection: 'column', gap: 0 }}>
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
          style={{
            ...UI.dashedBtn,
            height: '48px',
            fontSize: '14px',
            border: '1px solid var(--dp-color-rule)',
            backgroundColor: '#161618'
          }}
        >
          + ADD EXERCISE
        </button>
      </div>
    </div>
  );
}

export default RoutineEditorView;
