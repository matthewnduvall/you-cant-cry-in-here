'use client';

import React from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  DEFAULT_GYM_EQUIPMENT_PRESETS,
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  filterAddSlotExercises,
  getFilteredExercisesForSlotInline,
  getGymSelectionLabel
} from '../../data/exerciseLibrary';
import {
  SET_TYPES_LIST,
  calculateLastEquivalentWeightForSet,
  getHistoricalCalculated1RM
} from '../../utils/workoutEngine';

// ============================================================================
// VIEW: ROUTINE EDITOR (SESSION / HISTORICAL / ROUTINE / PREVIEW)
// ============================================================================

export function RoutineEditorView({
  colors,
  currentView,
  currentEditorWorkout,
  routineSelectReturnView,
  setRoutineSelectReturnView,
  setCurrentView,
  selectedGymId,
  setSelectedGymId,
  gyms,
  history,
  oneRepMaxes,
  newSlotCategory,
  setAddSlotGymFilter,
  setNewSlotEx1,
  setNewSlotSupersetIds,
  setShowAddSlotModal,
  setHistoricalDraft,
  setDeleteConfirmTarget,
  isCurrentEditorShared,
  updateCurrentWorkoutState,
  handleApplyPreviewRoutine,
  handleAutoBuildWorkout,
  handleSaveCurrentEditor,
  handleShareCurrentEditor,
  handleResetCurrentEditor,
  handleUpdateSlotCategoryOrExercise,
  handleUpdateSetField,
  handleUpdateSetType,
  handleInsertSetAtPosition,
  handleRecalculateSlotWeights,
  handleToggleSetDone,
  openPlateCalculatorForSet
}) {
  if (!currentEditorWorkout) return null;

  return (
    <div style={{ paddingTop: '14px' }}>
      <IOSListSection
        header={
          currentView === 'routine_editor'
            ? 'ROUTINE BUILDER'
            : currentView === 'routine_preview'
              ? 'PREVIEW ROUTINE'
              : currentView === 'historical_entry'
                ? 'LOG PAST WORKOUT'
                : 'ROUTINE EDITOR'
        }
        headerRight={
          currentView === 'routine_preview' ? (
            <button
              type="button"
              onClick={handleApplyPreviewRoutine}
              className="kinetic-btn"
              style={{
                padding: '6px 10px',
                backgroundColor: 'var(--dp-color-accent)',
                color: '#101010',
                border: '2px solid #FFFFFF',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              APPLY ROUTINE TO WORKOUT →
            </button>
          ) : null
        }
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

        {/* Historical Date Row if logging past workout */}
        {currentView === 'historical_entry' && (
          <IOSListRow colors={colors} style={{ padding: '6px 10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
              WORKOUT DATE
            </span>
            <input
              type="date"
              value={currentEditorWorkout.workoutDate || ''}
              onChange={e => setHistoricalDraft(prev => ({ ...prev, workoutDate: e.target.value }))}
              style={{
                backgroundColor: '#101010', color: '#FFFFFF',
                border: '2px solid var(--dp-color-rule)', padding: '4px 8px',
                fontSize: '11px', fontWeight: 800
              }}
            />
          </IOSListRow>
        )}

        {/* Top Action Row: Retained across all editor & preview modes (Routines, Gyms/Equipment, Auto) */}
        <IOSListRow isLast={true} colors={colors} style={{ padding: '6px 10px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '6px',
              width: '100%',
              alignItems: 'stretch'
            }}
          >
            {/* Column 1: Routines */}
            <button
              type="button"
              onClick={() => {
                setRoutineSelectReturnView(
                  currentView === 'routine_preview' ? routineSelectReturnView || 'session' : currentView
                );
                setCurrentView('routines');
              }}
              className="kinetic-btn"
              style={{
                width: '100%', padding: '6px 8px', backgroundColor: '#101010',
                border: '2px solid var(--dp-color-rule)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                alignItems: 'flex-start', textAlign: 'left', minWidth: 0
              }}
            >
              <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--dp-color-accent)', textTransform: 'uppercase', lineHeight: 1.1 }}>
                ROUTINES ↗
              </div>
              <div
                style={{
                  fontSize: '11px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', lineHeight: 1.2
                }}
              >
                {currentEditorWorkout.loadedRoutineTitle || 'MANUAL'}
              </div>
            </button>

            {/* Column 2: Gyms/Equipment */}
            <div
              style={{
                width: '100%', position: 'relative', backgroundColor: '#101010',
                border: '2px solid var(--dp-color-rule)', padding: '6px 8px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0
              }}
            >
              <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--dp-color-accent)', textTransform: 'uppercase', lineHeight: 1.1 }}>
                GYMS/EQUIPMENT ▾
              </div>
              <div
                style={{
                  fontSize: '11px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2
                }}
              >
                {getGymSelectionLabel(selectedGymId, gyms)}
              </div>
              <select
                aria-label="Select Gyms/Equipment"
                value={selectedGymId}
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

            {/* Column 3: Auto */}
            <button
              type="button"
              onClick={handleAutoBuildWorkout}
              className="kinetic-btn"
              style={{
                width: '100%', padding: '6px 8px', backgroundColor: 'var(--dp-color-accent)',
                color: '#101010', border: '2px solid #FFFFFF', fontSize: '12px',
                fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer',
                whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0
              }}
            >
              AUTO ⚡
            </button>
          </div>
        </IOSListRow>
      </IOSListSection>

      {/* ALWAYS-EXPANDED WORKOUT SLOTS WITH LOCKED COLUMN SIZES & SET DELETE CONFIRMATION */}
      <IOSListSection
        header={`WORKOUT SLOTS (${(currentEditorWorkout.slots || []).length})`}
        colors={colors}
      >
        {(currentEditorWorkout.slots || []).length === 0 ? null : (
          (currentEditorWorkout.slots || []).map((slot, sIdx) => {
            const ex1 = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
            const isSuperset = slot.category === 'Supersets';
            const inlineExercisePool = getFilteredExercisesForSlotInline(slot, selectedGymId, gyms);

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
                    exIdx: 0, exId: supIds[0], setItem: listA[i], totalExSets: listA.length
                  });
                }
                if (listB[i]) {
                  alternatingSupersetRows.push({
                    exIdx: 1, exId: supIds[1], setItem: listB[i], totalExSets: listB.length
                  });
                }
              }
            }

            const renderSingleSetRow = (st, exIdx, exId, totalExSets) => {
              const exObj = EXERCISE_MAP[exId] || EXERCISE_LIBRARY[0];
              const curType = SET_TYPES_LIST.includes(st.type) ? st.type : 'Working Set';
              const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
              const lastW =
                st.lastWeight !== undefined
                  ? st.lastWeight
                  : calculateLastEquivalentWeightForSet(calc1RM, st, totalExSets, slot.category);

              return (
                <div
                  key={`${exIdx}_${st.id}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 26px',
                    gap: '6px',
                    alignItems: 'center'
                  }}
                >
                  {/* Locked-down set containing box */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        slot.category === 'Abs'
                          ? '36px minmax(0, 1fr) 48px 32px'
                          : '36px minmax(0, 1fr) 44px 62px 48px 32px',
                      gap: '4px',
                      alignItems: 'center',
                      padding: '5px 6px',
                      backgroundColor: st.completed ? '#172B1C' : '#161616',
                      border: '2px solid var(--dp-color-rule)'
                    }}
                  >
                    {/* 1. Fixed Set Number */}
                    <span
                      style={{
                        width: '36px',
                        fontSize: '10px',
                        fontWeight: 800,
                        color: isSuperset
                          ? exIdx === 0
                            ? 'var(--dp-color-accent)'
                            : '#FFFFFF'
                          : '#A0A0A0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden'
                      }}
                    >
                      {isSuperset ? `${exIdx === 0 ? 'A' : 'B'}#${st.setNumber}` : `#${st.setNumber}`}
                    </span>

                    {/* 2. Fixed/Flex Set Type Selector */}
                    <div style={{ minWidth: 0 }}>
                      {isSuperset && (
                        <div
                          style={{
                            fontSize: '9px', fontWeight: 800,
                            color: exIdx === 0 ? 'var(--dp-color-accent)' : '#A0A0A0',
                            textTransform: 'uppercase', whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px'
                          }}
                        >
                          {exObj.name}
                        </div>
                      )}
                      <select
                        aria-label="Set Type"
                        value={curType}
                        onChange={e => handleUpdateSetType(slot.id, exIdx, st.id, e.target.value)}
                        style={{
                          width: '100%', minWidth: 0, height: '26px',
                          backgroundColor: '#101010', color: '#FFFFFF',
                          border: '2px solid var(--dp-color-rule)', padding: '0 4px',
                          fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                        }}
                      >
                        {SET_TYPES_LIST.map(t => (
                          <option key={t} value={t}>
                            {t.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Fixed "LAST" Calculated Equivalent Weight Box */}
                    {slot.category !== 'Abs' && (
                      <div
                        style={{
                          width: '44px', height: '26px',
                          backgroundColor: '#101010', border: '2px solid var(--dp-color-rule)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          justifyContent: 'center', userSelect: 'none', pointerEvents: 'none', whiteSpace: 'nowrap'
                        }}
                      >
                        <span style={{ fontSize: '7px', fontWeight: 800, color: '#888888', lineHeight: 1 }}>
                          LAST
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#A0A0A0', lineHeight: 1.1 }}>
                          {lastW}
                        </span>
                      </div>
                    )}

                    {/* 4. Fixed Current Weight Button */}
                    {slot.category !== 'Abs' && (
                      <button
                        type="button"
                        onClick={() => openPlateCalculatorForSet(slot.id, exIdx, st, exObj.name)}
                        style={{
                          width: '62px', height: '26px', padding: '0 4px',
                          backgroundColor: '#101010', color: 'var(--dp-color-accent)',
                          border: '2px solid var(--dp-color-rule)', fontSize: '10px',
                          fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
                          overflow: 'hidden', textOverflow: 'ellipsis'
                        }}
                      >
                        {st.weight} LB
                      </button>
                    )}

                    {/* 5. Fixed Roomy Reps Input */}
                    <input
                      type="number"
                      aria-label="Reps"
                      value={st.reps}
                      onChange={e => handleUpdateSetField(slot.id, exIdx, st.id, 'reps', e.target.value)}
                      style={{
                        width: '48px', height: '26px',
                        backgroundColor: '#101010', color: '#FFFFFF',
                        border: '2px solid var(--dp-color-rule)', padding: '0 4px',
                        textAlign: 'center', fontSize: '12px', fontWeight: 800
                      }}
                    />

                    {/* 6. Fixed Grey/Green Checkmark Button */}
                    <button
                      type="button"
                      aria-label="Mark set complete"
                      onClick={() => handleToggleSetDone(slot, exIdx, st)}
                      style={{
                        width: '32px', height: '26px', padding: 0,
                        backgroundColor: st.completed ? '#30D158' : '#262626',
                        color: st.completed ? '#101010' : '#777777',
                        border: '2px solid var(--dp-color-rule)', fontSize: '12px',
                        fontWeight: 800, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      ✓
                    </button>
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
                        label: `${exObj.name} — Set #${st.setNumber}`
                      })
                    }
                    className="kinetic-btn"
                    style={UI.deleteXBtn}
                  >
                    ✕
                  </button>
                </div>
              );
            };

            return (
              <div
                key={slot.id}
                style={{
                  borderBottom:
                    sIdx === currentEditorWorkout.slots.length - 1
                      ? 'none'
                      : '2px solid var(--dp-color-rule)'
                }}
              >
                {/* Slot Header */}
                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: '#1C1C1C',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <select
                        aria-label="Slot Category"
                        value={slot.category}
                        onChange={e =>
                          handleUpdateSlotCategoryOrExercise(slot.id, { category: e.target.value })
                        }
                        style={{
                          fontSize: '10px', fontWeight: 800, padding: '4px 8px',
                          backgroundColor: 'var(--dp-color-accent)', color: '#101010',
                          border: '2px solid #FFFFFF', textTransform: 'uppercase', cursor: 'pointer'
                        }}
                      >
                        {['Compound Lift', 'Supersets', 'Accessories', 'Abs'].map(cat => (
                          <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                        ))}
                      </select>

                      {slot.category !== 'Abs' && (
                        <select
                          aria-label="Set and Rep Scheme"
                          value={slot.scheme || '5x8'}
                          onChange={e =>
                            handleUpdateSlotCategoryOrExercise(slot.id, { scheme: e.target.value })
                          }
                          style={{
                            fontSize: '10px', fontWeight: 800, padding: '4px 8px',
                            backgroundColor: '#101010', color: '#FFFFFF',
                            border: '2px solid var(--dp-color-rule)', textTransform: 'uppercase', cursor: 'pointer'
                          }}
                        >
                          {['5x5', '5x8', '8x8', 'Pyramid', 'Reverse Pyramid'].map(scm => (
                            <option key={scm} value={scm}>{scm.toUpperCase()}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <button
                      type="button"
                      aria-label="Remove workout slot"
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
                      style={UI.deleteXBtn}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Exercise Descriptor Dropdown(s) */}
                  {isSuperset ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      {[0, 1].map(idx => {
                        const exId = supIds[idx];
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
                              width: '100%', minWidth: 0, backgroundColor: '#101010', color: '#FFFFFF',
                              border: '2px solid var(--dp-color-rule)', padding: '7px 8px',
                              fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                            }}
                          >
                            {inlineExercisePool.map(ex => (
                              <option key={ex.id} value={ex.id}>
                                {ex.name.toUpperCase()} ({ex.equipment.toUpperCase()})
                              </option>
                            ))}
                          </select>
                        );
                      })}
                    </div>
                  ) : (
                    <select
                      aria-label="Select Exercise"
                      value={slot.exerciseId}
                      onChange={e =>
                        handleUpdateSlotCategoryOrExercise(slot.id, { exerciseId: e.target.value })
                      }
                      style={{
                        width: '100%', backgroundColor: '#101010', color: '#FFFFFF',
                        border: '2px solid var(--dp-color-rule)', padding: '7px 10px',
                        fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                      }}
                    >
                      {inlineExercisePool.map(ex => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name.toUpperCase()} ({ex.equipment.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Always-Expanded Sets Content */}
                <div
                  style={{
                    padding: '12px 14px 14px',
                    backgroundColor: '#101010',
                    borderTop: '2px solid var(--dp-color-rule)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {isSuperset
                      ? alternatingSupersetRows.map(row =>
                        renderSingleSetRow(row.setItem, row.exIdx, row.exId, row.totalExSets)
                      )
                      : (slot.sets || []).map(st =>
                        renderSingleSetRow(st, 0, slot.exerciseId, (slot.sets || []).length)
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
                        padding: '6px', backgroundColor: '#161616', color: '#FFFFFF',
                        border: '2px dashed var(--dp-color-rule)', fontSize: '10px',
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
                        padding: '6px', backgroundColor: '#161616', color: 'var(--dp-color-accent)',
                        border: '2px dashed var(--dp-color-rule)', fontSize: '10px',
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
                        padding: '6px', backgroundColor: '#101010', color: '#30D158',
                        border: '2px solid var(--dp-color-rule)', fontSize: '10px',
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

      {/* ADD EXERCISE & BOTTOM SAVE / SHARE / RESET OR APPLY ROUTINE CONTROLS */}
      {currentView !== 'routine_preview' ? (
        <div style={{ padding: '0 var(--dp-spacing-gutter)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            type="button"
            onClick={() => {
              setAddSlotGymFilter(selectedGymId);
              const avail = filterAddSlotExercises(selectedGymId, newSlotCategory, gyms);
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={handleSaveCurrentEditor}
              className="kinetic-btn"
              style={{ ...UI.primaryBtnCenter, padding: '14px 8px', fontSize: '13px' }}
            >
              SAVE
            </button>

            <button
              type="button"
              onClick={handleShareCurrentEditor}
              className="kinetic-btn"
              style={{
                ...UI.secondaryBtnCenter, padding: '14px 8px', fontSize: '13px',
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
              style={{ ...UI.secondaryBtnCenter, padding: '14px 8px', fontSize: '13px', color: '#FF3B30' }}
            >
              RESET
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 var(--dp-spacing-gutter)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            type="button"
            onClick={() => {
              setAddSlotGymFilter(selectedGymId);
              const avail = filterAddSlotExercises(selectedGymId, newSlotCategory, gyms);
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

          <button
            type="button"
            onClick={handleApplyPreviewRoutine}
            className="kinetic-btn"
            style={UI.primaryBtnCenter}
          >
            APPLY ROUTINE TO WORKOUT →
          </button>
        </div>
      )}
    </div>
  );
}

export default RoutineEditorView;

