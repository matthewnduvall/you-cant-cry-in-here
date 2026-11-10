'use client';

import React, { useState } from 'react';
import { UI } from '../styles/kineticTokens';
import {
  SLOT_CATEGORIES,
  normalizeSlotCategory,
  getAvailableMuscleGroupsForCategory,
  filterAddSlotExercises,
  formatTodayYMD
} from '../data/exerciseLibrary';
import { SET_TYPES_LIST } from '../utils/workoutEngine';
import { Button, CloseButton, GymSelect } from './Controls';

// ============================================================================
// MODAL COMPONENTS: DELETE CONFIRMATION, ADD SLOT & PLATE CALCULATOR
// ============================================================================

export function DeleteConfirmModal({
  deleteConfirmTarget,
  setDeleteConfirmTarget,
  handleConfirmDeleteAction
}) {
  if (!deleteConfirmTarget) return null;

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 90 }} onClick={() => setDeleteConfirmTarget(null)}>
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('360px')}>
        <div style={UI.modalHeader}>
          <span>
            {deleteConfirmTarget.title ||
              (deleteConfirmTarget.type === 'history_workout'
              ? 'DELETE HISTORY ENTRY?'
              : deleteConfirmTarget.type === 'saved_routine' || deleteConfirmTarget.type === 'shared_routine'
                ? 'DELETE ROUTINE?'
                : deleteConfirmTarget.type === 'slot'
                  ? 'DELETE EXERCISE?'
                  : 'DELETE SET?')}
          </span>
          <CloseButton onClick={() => setDeleteConfirmTarget(null)} />
        </div>

        <div style={{ fontSize: '13px', fontWeight: 700, color: '#E0E0E0', marginBottom: '16px', lineHeight: 1.4 }}>
          Are you sure you want to {deleteConfirmTarget.verb || 'delete'}{' '}
          <strong style={{ color: 'var(--dp-color-accent)' }}>{deleteConfirmTarget.label}</strong>?
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <Button
            variant="secondary"
            onClick={() => setDeleteConfirmTarget(null)}
            style={{ padding: '12px', fontSize: '12px' }}
          >
            CANCEL
          </Button>
          <Button variant="danger" onClick={handleConfirmDeleteAction} style={{ padding: '12px', fontSize: '12px' }}>
            {deleteConfirmTarget.confirmLabel || 'DELETE ✕'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AddSlotModal({
  showAddSlotModal,
  setShowAddSlotModal,
  addSlotGymFilter,
  setAddSlotGymFilter,
  newSlotCategory,
  setNewSlotCategory,
  newSlotMuscleGroup = 'All Muscles',
  setNewSlotMuscleGroup,
  newSlotEx1,
  setNewSlotEx1,
  newSlotSupersetIds,
  setNewSlotSupersetIds,
  newSlotScheme,
  setNewSlotScheme,
  gyms,
  handleAddManualSlot
}) {
  if (!showAddSlotModal) return null;

  const normCat = normalizeSlotCategory(newSlotCategory);
  const availMuscleGroups = getAvailableMuscleGroupsForCategory(normCat, addSlotGymFilter, gyms);
  const activeMuscle = availMuscleGroups.includes(newSlotMuscleGroup) ? newSlotMuscleGroup : 'All Muscles';
  const modalPool = filterAddSlotExercises(addSlotGymFilter, normCat, gyms, activeMuscle);
  const selectedEx1 = modalPool.some(x => x.id === newSlotEx1) ? newSlotEx1 : (modalPool[0]?.id || newSlotEx1);

  return (
    <div style={UI.modalBackdrop} onClick={() => setShowAddSlotModal(false)}>
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('400px')}>
        <div style={UI.modalHeader}>
          <span>ADD EXERCISE</span>
          <CloseButton onClick={() => setShowAddSlotModal(false)} />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={UI.stepLabel}>1. GYMS/EQUIPMENT</div>
          <GymSelect
            value={addSlotGymFilter}
            onChange={nextFilter => {
              setAddSlotGymFilter(nextFilter);
              const nextGroups = getAvailableMuscleGroupsForCategory(normCat, nextFilter, gyms);
              const nextMg = nextGroups.includes(activeMuscle) ? activeMuscle : 'All Muscles';
              setNewSlotMuscleGroup?.(nextMg);
              const nextAvail = filterAddSlotExercises(nextFilter, normCat, gyms, nextMg);
              if (nextAvail.length > 0) {
                if (!nextAvail.some(x => x.id === newSlotEx1)) setNewSlotEx1(nextAvail[0].id);
                setNewSlotSupersetIds(prev => [
                  nextAvail.some(x => x.id === prev[0]) ? prev[0] : nextAvail[0].id,
                  nextAvail.some(x => x.id === prev[1]) ? prev[1] : (nextAvail[1] || nextAvail[0]).id
                ]);
              }
            }}
            gyms={gyms}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={UI.stepLabel}>2. EXERCISE CATEGORY</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 0,
              borderTop: '1px solid var(--dp-color-rule)',
              borderLeft: '1px solid var(--dp-color-rule)'
            }}
          >
            {SLOT_CATEGORIES.map(cat => (
              <Button
                variant="toggle"
                active={normCat === cat}
                key={cat}
                onClick={() => {
                  setNewSlotCategory(cat);
                  const nextGroups = getAvailableMuscleGroupsForCategory(cat, addSlotGymFilter, gyms);
                  const nextMg = nextGroups.includes(activeMuscle) ? activeMuscle : 'All Muscles';
                  setNewSlotMuscleGroup?.(nextMg);
                  const nextAvail = filterAddSlotExercises(addSlotGymFilter, cat, gyms, nextMg);
                  if (nextAvail.length > 0) {
                    if (!nextAvail.some(x => x.id === newSlotEx1)) setNewSlotEx1(nextAvail[0].id);
                    setNewSlotSupersetIds(prev => [
                      nextAvail.some(x => x.id === prev[0]) ? prev[0] : nextAvail[0].id,
                      nextAvail.some(x => x.id === prev[1]) ? prev[1] : (nextAvail[1] || nextAvail[0]).id
                    ]);
                  }
                }}
                style={{ borderTop: 'none', borderLeft: 'none', borderRight: '1px solid var(--dp-color-rule)', borderBottom: '1px solid var(--dp-color-rule)' }}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={UI.stepLabel}>3. MUSCLE GROUP</div>
          <select
            aria-label="Filter by Muscle Group"
            value={activeMuscle}
            onChange={e => {
              const nextMg = e.target.value;
              setNewSlotMuscleGroup?.(nextMg);
              const nextAvail = filterAddSlotExercises(addSlotGymFilter, normCat, gyms, nextMg);
              if (nextAvail.length > 0) {
                setNewSlotEx1(nextAvail[0].id);
                setNewSlotSupersetIds([
                  nextAvail[0].id,
                  (nextAvail[1] || nextAvail[0]).id
                ]);
              }
            }}
            style={{ ...UI.select, textTransform: 'uppercase' }}
          >
            {availMuscleGroups.map(mg => (
              <option key={mg} value={mg}>
                {mg.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {normCat !== 'Superset' ? (
          <div style={{ marginBottom: '12px' }}>
            <div style={UI.stepLabel}>4. SELECT EXERCISE</div>
            <select
              value={selectedEx1}
              onChange={e => setNewSlotEx1(e.target.value)}
              style={UI.select}
            >
              {modalPool.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.equipment})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div style={{ marginBottom: '12px' }}>
            <div style={UI.stepLabel}>4. SELECT TWO SUPERSET EXERCISES</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {[0, 1].map(idx => {
                const fallbackId = modalPool[idx]?.id || modalPool[0]?.id;
                const valForIdx = modalPool.some(x => x.id === newSlotSupersetIds[idx])
                  ? newSlotSupersetIds[idx]
                  : fallbackId;
                return (
                  <select
                    key={idx}
                    value={valForIdx}
                    onChange={e => {
                      const val = e.target.value;
                      setNewSlotSupersetIds(prev => {
                        const copy = [
                          modalPool.some(x => x.id === prev[0]) ? prev[0] : (modalPool[0]?.id || prev[0]),
                          modalPool.some(x => x.id === prev[1]) ? prev[1] : ((modalPool[1] || modalPool[0])?.id || prev[1])
                        ];
                        copy[idx] = val;
                        return copy;
                      });
                    }}
                    style={{ ...UI.select, padding: '8px' }}
                  >
                    {modalPool.map(ex => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name} ({ex.equipment})
                      </option>
                    ))}
                  </select>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <div style={UI.stepLabel}>5. SET/REP SCHEME</div>
          <select
            value={newSlotScheme}
            onChange={e => setNewSlotScheme(e.target.value)}
            style={UI.select}
          >
            <option value="5x5">5X5</option>
            <option value="5x8">5X8</option>
            <option value="8x8">8X8</option>
            <option value="Pyramid">PYRAMID</option>
            <option value="Pyramid 1RM">PYRAMID 1RM</option>
            <option value="Reverse Pyramid">REVERSE PYRAMID</option>
            <option value="Timer">TIMER</option>
          </select>
        </div>

        <Button
          variant="primary"
          onClick={handleAddManualSlot}
          style={{ padding: '12px', fontSize: '13px' }}
        >
          ADD EXERCISE TO WORKOUT →
        </Button>
      </div>
    </div>
  );
}

// TOTAL WEIGHT readout that turns into a number field when tapped (replaces the old DIRECT TOTAL mode)
function EditableTotalWeight({ value, unit, onCommit }) {
  const [draft, setDraft] = useState(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== '' && !Number.isNaN(Number(draft))) onCommit?.(draft);
    setDraft(null);
  };
  const bigText = { fontSize: '30px', fontWeight: 800, color: 'var(--dp-color-accent)', whiteSpace: 'nowrap', lineHeight: 1.2 };
  return (
    <div style={{ textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: '#A0A0A0' }}>TOTAL WEIGHT ✎</div>
      {draft === null ? (
        <button
          type="button"
          aria-label="Edit total weight"
          onClick={() => setDraft(String(value))}
          style={{ ...bigText, background: 'none', border: 'none', padding: 0, cursor: 'text', width: '100%' }}
        >
          {value} {unit.toUpperCase()}
        </button>
      ) : (
        <input
          type="text"
          inputMode="decimal"
          aria-label="Total weight"
          autoFocus
          value={draft}
          onFocus={e => e.target.select()}
          onChange={e => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setDraft(null);
          }}
          style={{
            ...bigText,
            width: '100%',
            boxSizing: 'border-box',
            textAlign: 'center',
            backgroundColor: '#141414',
            border: '2px solid var(--dp-color-accent)',
            padding: '0 4px',
            fontFamily: 'inherit'
          }}
        />
      )}
    </div>
  );
}

export function PlateCalculatorModal({
  plateCalcTarget,
  setPlateCalcTarget,
  computedPlateCalculatorTotal,
  calcUnit,
  calcIsSingleLoad,
  calcBarWeight,
  calcBarLabel = 'Barbell',
  calcPlatesPerSide,
  setCalcPlatesPerSide,
  setCalcTotalFromInput,
  prRecordDate,
  setPrRecordDate,
  handleApplyCalculatedWeight,
  // Opens a logged History workout (the PR's) on the PROGRESS page
  onOpenHistoryWorkout
}) {
  if (!plateCalcTarget) return null;

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 1300 }} onClick={() => setPlateCalcTarget(null)}>
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('390px')}>
        <div style={UI.modalHeader}>
          <div>
            <div style={UI.fieldLabel}>
              {plateCalcTarget.mode === 'pr'
                ? 'EDIT PERSONAL RECORD'
                : plateCalcTarget.mode === 'goal'
                  ? 'EDIT CUSTOM GOAL WEIGHT'
                  : `SET #${plateCalcTarget.setNumber} WEIGHT`}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>
              {plateCalcTarget.exerciseName}
            </div>
          </div>
          <CloseButton onClick={() => setPlateCalcTarget(null)} />
        </div>

        {(() => {
          const hasLast = plateCalcTarget.mode === 'set' && plateCalcTarget.lastDisplay !== undefined;
          const hasOneRepMax = plateCalcTarget.mode === 'set' && Boolean(plateCalcTarget.showOneRepMax);
          const sideLabel = { fontSize: '11px', fontWeight: 800, color: '#A0A0A0', lineHeight: 1 };
          const sideValue = color => ({ fontSize: '16px', fontWeight: 800, color, marginTop: '4px', lineHeight: 1.1 });
          // 1RM box: PR = best 1RM logged in History; CURRENT = best 1RM across this exercise's sets in the
          // session, with this set at the weight being picked. Same estimate History uses to find PRs, so
          // CURRENT above PR means the session would log a new PR.
          const prValue = Number(plateCalcTarget.prValue) || 0;
          const prWorkoutId = plateCalcTarget.prWorkoutId || null;
          const estimate1RM = (weight, reps) => {
            const w = Number(weight) || 0;
            const r = Math.max(1, Number(reps) || 1);
            if (w <= 0) return 0;
            return r === 1 ? w : Math.round(w * (1 + r / 30));
          };
          const currentTotal = Number(computedPlateCalculatorTotal) || 0;
          const sessionSets = Array.isArray(plateCalcTarget.sessionSets) ? plateCalcTarget.sessionSets : [];
          const current1RM = Math.max(
            estimate1RM(currentTotal, plateCalcTarget.setReps),
            ...sessionSets
              .filter(st => st && st.id !== plateCalcTarget.setId)
              .map(st => estimate1RM(st.weight, st.reps))
          );
          const oneRepMaxLabel = color => ({ fontSize: '11px', fontWeight: 800, color, lineHeight: 1, whiteSpace: 'nowrap' });
          const oneRepMaxValue = {
            fontSize: '14px',
            fontWeight: 800,
            color: '#C8C8C8',
            lineHeight: 1.1,
            marginTop: '2px',
            whiteSpace: 'nowrap'
          };
          const totalBlock = (
            <EditableTotalWeight
              value={computedPlateCalculatorTotal}
              unit={calcUnit}
              onCommit={setCalcTotalFromInput}
            />
          );
          if (!hasLast && !hasOneRepMax) {
            return (
              <div
                style={{
                  backgroundColor: '#101010', border: '2px solid var(--dp-color-rule)',
                  padding: '12px', textAlign: 'center', marginBottom: '12px'
                }}
              >
                {totalBlock}
              </div>
            );
          }
          return (
            <div
              style={{
                backgroundColor: '#101010', border: '2px solid var(--dp-color-rule)',
                display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) 72px', alignItems: 'stretch',
                marginBottom: '12px'
              }}
            >
              <div
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  borderRight: '1px solid var(--dp-color-rule)', padding: '8px 2px'
                }}
              >
                {hasLast && (
                  <>
                    <span style={sideLabel}>LAST</span>
                    <span style={sideValue('#C8C8C8')}>{plateCalcTarget.lastDisplay}</span>
                  </>
                )}
              </div>
              <div style={{ padding: '12px 4px' }}>{totalBlock}</div>
              {hasOneRepMax ? (
                <button
                  type="button"
                  aria-label={prWorkoutId ? '1RM: open the Personal Record in History' : '1RM (no Personal Record logged yet)'}
                  disabled={!prWorkoutId}
                  onClick={() => {
                    setPlateCalcTarget(null);
                    onOpenHistoryWorkout?.(prWorkoutId);
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'transparent', border: 'none', borderLeft: '1px solid var(--dp-color-rule)',
                    padding: '8px 2px', cursor: prWorkoutId ? 'pointer' : 'default', color: '#C8C8C8', opacity: 1
                  }}
                >
                  <span style={oneRepMaxLabel('var(--dp-color-accent)')}>{prWorkoutId ? 'PR ↗' : 'PR'}</span>
                  <span style={oneRepMaxValue}>{prValue > 0 ? prValue : 'TBD'}</span>
                  <span style={{ ...oneRepMaxLabel('#A0A0A0'), marginTop: '6px' }}>CURRENT</span>
                  <span style={oneRepMaxValue}>{current1RM > 0 ? current1RM : '—'}</span>
                </button>
              ) : (
                <div style={{ borderLeft: '1px solid var(--dp-color-rule)' }} />
              )}
            </div>
          );
        })()}

        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '6px' }}>
              {[45, 35, 25].map(p => (
                <Button
                  variant="toggle"
                  key={p}
                  onClick={() => setCalcPlatesPerSide(prev => [...prev, p].sort((a, b) => b - a))}
                  style={{ padding: '10px 4px', fontSize: '12px' }}
                >
                  +{p} LB
                </Button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '10px' }}>
              {[10, 5, 2.5, 1.25].map(p => (
                <Button
                  variant="toggle"
                  key={p}
                  onClick={() => setCalcPlatesPerSide(prev => [...prev, p].sort((a, b) => b - a))}
                  style={{ padding: '10px 2px', fontSize: '11px' }}
                >
                  +{p} LB
                </Button>
              ))}
            </div>

            <div
              style={{
                padding: '8px', backgroundColor: '#101010', border: '2px solid var(--dp-color-rule)',
                marginBottom: '12px', minHeight: '38px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center'
              }}
            >
              {calcPlatesPerSide.length === 0 ? (
                <span style={{ fontSize: '11px', color: '#888888' }}>
                  {calcIsSingleLoad
                    ? 'Dumbbell — tap weights above (no bar, not doubled)'
                    : `${calcBarLabel} (${calcBarWeight} lb) — tap plates above (per side)`}
                </span>
              ) : (
                [...calcPlatesPerSide]
                  .sort((a, b) => b - a)
                  .map((p, idx) => (
                    <button
                      key={`${p}_${idx}`}
                      type="button"
                      onClick={() =>
                        setCalcPlatesPerSide(prev => {
                          const sorted = [...prev].sort((a, b) => b - a);
                          return sorted.filter((_, i) => i !== idx);
                        })
                      }
                      style={{
                        padding: '2px 6px', backgroundColor: 'var(--dp-color-accent)',
                        color: '#101010', border: 'none', fontSize: '11px', fontWeight: 800, cursor: 'pointer'
                      }}
                    >
                      {p} ✕
                    </button>
                  ))
              )}
            </div>
        </div>

        {plateCalcTarget.mode === 'pr' && (
          <div
            style={{
              marginBottom: '12px',
              padding: '10px',
              backgroundColor: '#101010',
              border: '2px solid var(--dp-color-rule)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '6px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#A0A0A0', textTransform: 'uppercase' }}>
                RECORD DATE (LOGS HISTORY ENTRY)
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setPrRecordDate?.(formatTodayYMD())}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--dp-color-accent)',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  TODAY
                </button>
                {prRecordDate && (
                  <button
                    type="button"
                    onClick={() => setPrRecordDate?.('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#FF3B30',
                      fontSize: '11px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>
            <input
              type="text"
              placeholder="YYYY/MM/DD"
              value={(prRecordDate || '').replace(/-/g, '/')}
              onChange={e => setPrRecordDate?.(e.target.value.replace(/-/g, '/'))}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: '#161616',
                color: '#FFFFFF',
                border: '2px solid var(--dp-color-rule)',
                padding: '8px 10px',
                fontSize: '13px',
                fontWeight: 800,
                textTransform: 'uppercase'
              }}
            />
          </div>
        )}

        <Button
          variant="primary"
          onClick={handleApplyCalculatedWeight}
          style={{ padding: '12px', fontSize: '13px' }}
        >
          APPLY WEIGHT →
        </Button>
      </div>
    </div>
  );
}

export function SetValueEditorModal({
  setValueTarget,
  setSetValueTarget,
  handleUpdateSetField,
  handleUpdateSetType
}) {
  if (!setValueTarget) return null;

  const { mode, slotId, exIdx, setId, setNumber, exerciseName, currentValue, isAbs } = setValueTarget;

  const applyAndClose = nextVal => {
    // Editors outside the current workout (e.g. the History 1RM calculator) pass their own onApply.
    if (typeof setValueTarget.onApply === 'function') {
      setValueTarget.onApply(nextVal);
    } else if (mode === 'type') {
      handleUpdateSetType(slotId, exIdx, setId, nextVal);
    } else if (mode === 'increment') {
      handleUpdateSetField(slotId, exIdx, setId, 'increment', nextVal);
    } else if (mode === 'timer') {
      handleUpdateSetField(slotId, exIdx, setId, 'timer', nextVal);
    } else if (mode === 'reps') {
      handleUpdateSetField(slotId, exIdx, setId, 'reps', nextVal);
    }
    setSetValueTarget(null);
  };

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 1250 }} onClick={() => setSetValueTarget(null)}>
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('380px')}>
        <div style={UI.modalHeader}>
          <div>
            <div style={UI.fieldLabel}>
              {mode === 'type'
                ? `SET ${setNumber} TYPE`
                : mode === 'increment'
                  ? `SET ${setNumber} WEIGHT INCREMENT`
                  : mode === 'timer'
                    ? `SET ${setNumber} TIMER (MM:SS)`
                    : `SET ${setNumber} ${isAbs ? 'DURATION (SEC)' : 'REPS'}`}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>
              {exerciseName}
            </div>
          </div>
          <CloseButton onClick={() => setSetValueTarget(null)} />
        </div>

        {mode === 'type' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {SET_TYPES_LIST.map(t => (
              <Button
                variant="toggle"
                active={currentValue === t}
                key={t}
                onClick={() => applyAndClose(t)}
                style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}
              >
                {t.toUpperCase()}
              </Button>
            ))}
          </div>
        ) : (
          <div>
            <div
              style={{
                backgroundColor: '#101010',
                border: '2px solid var(--dp-color-rule)',
                padding: '10px',
                textAlign: 'center',
                marginBottom: '12px'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#A0A0A0' }}>
                {mode === 'increment'
                  ? 'INCREMENT FROM LAST'
                  : mode === 'timer'
                    ? 'TARGET TIME (MM:SS)'
                    : isAbs
                      ? 'SECONDS'
                      : 'TARGET REPS'}
              </div>
              <input
                type="text"
                inputMode={mode === 'timer' ? 'text' : 'decimal'}
                placeholder={mode === 'timer' ? '02:00' : ''}
                value={currentValue}
                onChange={e =>
                  setSetValueTarget(prev => (prev ? { ...prev, currentValue: e.target.value } : null))
                }
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--dp-color-accent)',
                  fontSize: '28px',
                  fontWeight: 800,
                  textAlign: 'center',
                  outline: 'none',
                  marginTop: '2px'
                }}
              />
            </div>

            {mode === 'increment' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px' }}>
                {[-5, -2.5, 0, 1.25, 2.5, 5, 10, 15].map(inc => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() =>
                      setSetValueTarget(prev => (prev ? { ...prev, currentValue: inc } : null))
                    }
                    style={{
                      ...UI.pillBtn(Number(currentValue) === inc),
                      padding: '10px 4px',
                      fontSize: '12px'
                    }}
                  >
                    {inc >= 0 ? `+${inc}` : `${inc}`}
                  </button>
                ))}
              </div>
            ) : mode === 'timer' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '12px' }}>
                {['00:30', '00:45', '01:00', '01:30', '02:00', '02:30', '03:00', '04:00', '05:00', '10:00'].map(tStr => (
                  <button
                    key={tStr}
                    type="button"
                    onClick={() =>
                      setSetValueTarget(prev => (prev ? { ...prev, currentValue: tStr } : null))
                    }
                    style={{
                      ...UI.pillBtn(String(currentValue).trim() === tStr),
                      padding: '10px 4px',
                      fontSize: '11px'
                    }}
                  >
                    {tStr}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '12px' }}>
                {(isAbs ? [15, 30, 45, 60, 90, 120] : [1, 2, 3, 4, 5, 6, 8, 10, 12, 15]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      setSetValueTarget(prev => (prev ? { ...prev, currentValue: r } : null))
                    }
                    style={{
                      ...UI.pillBtn(Number(currentValue) === r),
                      padding: '10px 4px',
                      fontSize: '12px'
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            <Button
              variant="primary"
              onClick={() => applyAndClose(currentValue)}
              style={{ padding: '12px', fontSize: '13px' }}
            >
              APPLY {mode === 'increment' ? 'INCREMENT' : mode === 'timer' ? 'TIME' : isAbs ? 'SECONDS' : 'REPS'} →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SaveConfirmModal({
  saveConfirmTarget,
  setSaveConfirmTarget,
  handleConfirmSaveWorkout
}) {
  if (!saveConfirmTarget) return null;

  const { name = '', shareWithFriends = true, gymType = 'all' } = saveConfirmTarget;

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 92 }} onClick={() => setSaveConfirmTarget(null)}>
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('390px')}>
        <div style={UI.modalHeader}>
          <span>CONFIRM SAVE</span>
          <CloseButton onClick={() => setSaveConfirmTarget(null)} />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={UI.stepLabel}>1. NAME TO SAVE UNDER</div>
          <input
            type="text"
            value={name}
            onChange={e =>
              setSaveConfirmTarget(prev => (prev ? { ...prev, name: e.target.value } : null))
            }
            placeholder="ENTER SESSION / ROUTINE NAME..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: '#101010',
              color: '#FFFFFF',
              border: '2px solid var(--dp-color-rule)',
              padding: '10px 12px',
              fontSize: '14px',
              fontWeight: 800,
              textTransform: 'uppercase',
              outline: 'none'
            }}
          />
          <div
            style={{
              marginTop: '6px',
              fontSize: '11px',
              fontWeight: 800,
              color: '#A0A0A0',
              textTransform: 'uppercase',
              letterSpacing: '0.03em'
            }}
          >
            GYMS/EQUIPMENT DETECTED:{' '}
            <span style={{ color: 'var(--dp-color-accent)' }}>{String(gymType || 'all').toUpperCase()}</span>
          </div>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <div style={UI.stepLabel}>2. SHARE WITH FRIENDS?</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0,
              borderTop: '1px solid var(--dp-color-rule)',
              borderLeft: '1px solid var(--dp-color-rule)'
            }}
          >
            <button
              type="button"
              onClick={() =>
                setSaveConfirmTarget(prev => (prev ? { ...prev, shareWithFriends: true } : null))
              }
              className="kinetic-btn"
              style={{
                ...UI.pillBtn(Boolean(shareWithFriends)),
                padding: '10px 8px',
                fontSize: '12px',
                textAlign: 'center',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: '1px solid var(--dp-color-rule)',
                borderBottom: '1px solid var(--dp-color-rule)'
              }}
            >
              YES — SHARE ✓
            </button>
            <Button
              variant="toggle"
              active={!shareWithFriends}
              onClick={() =>
                setSaveConfirmTarget(prev => (prev ? { ...prev, shareWithFriends: false } : null))
              }
              style={{ padding: '10px 8px', fontSize: '12px', textAlign: 'center', borderTop: 'none', borderLeft: 'none', borderRight: '1px solid var(--dp-color-rule)', borderBottom: '1px solid var(--dp-color-rule)' }}
            >
              NO — PRIVATE
            </Button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 0,
            borderTop: '1px solid var(--dp-color-rule)',
            borderLeft: '1px solid var(--dp-color-rule)'
          }}
        >
          <Button
            variant="secondary"
            onClick={() => setSaveConfirmTarget(null)}
            style={{ padding: '12px', fontSize: '12px', borderTop: 'none', borderLeft: 'none', borderRight: '1px solid var(--dp-color-rule)', borderBottom: '1px solid var(--dp-color-rule)' }}
          >
            CANCEL
          </Button>
          <Button
            variant="primary"
            onClick={() => handleConfirmSaveWorkout(saveConfirmTarget)}
            style={{ padding: '12px', fontSize: '12px', borderTop: 'none', borderLeft: 'none', borderRight: '1px solid var(--dp-color-rule)', borderBottom: '1px solid var(--dp-color-rule)' }}
          >
            SAVE WORKOUT →
          </Button>
        </div>
      </div>
    </div>
  );
}

export function HistoricalEditConfirmModal({
  historicalEditConfirmTarget,
  setHistoricalEditConfirmTarget,
  handleConfirmHistoricalEdit
}) {
  if (!historicalEditConfirmTarget) return null;

  return (
    <div
      style={{ ...UI.modalBackdrop, zIndex: 95 }}
      onClick={() => setHistoricalEditConfirmTarget(null)}
    >
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('380px')}>
        <div style={UI.modalHeader}>
          <span>EDIT HISTORICAL DATA?</span>
          <CloseButton onClick={() => setHistoricalEditConfirmTarget(null)} />
        </div>

        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#E0E0E0',
            marginBottom: '16px',
            lineHeight: 1.45
          }}
        >
          Are you sure you want to edit this logged historical workout
          {historicalEditConfirmTarget.label ? (
            <>
              {' '}
              (<strong style={{ color: 'var(--dp-color-accent)' }}>{historicalEditConfirmTarget.label}</strong>)
            </>
          ) : null}
          ?
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <Button
            variant="secondary"
            onClick={() => setHistoricalEditConfirmTarget(null)}
            style={{ padding: '12px', fontSize: '12px' }}
          >
            CANCEL
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmHistoricalEdit}
            style={{ padding: '12px', fontSize: '12px' }}
          >
            CONFIRM EDIT →
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FeedbackModal({
  showFeedbackModal,
  setShowFeedbackModal,
  user,
  sessionLogs = [],
  appSnapshot = {}
}) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'
  const [errorText, setErrorText] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  if (!showFeedbackModal) return null;

  const buildFeedbackMailtoUrl = rawMessage => {
    const senderLabel = user?.username
      ? `@${user.username} (${user.email || 'no-email'})`
      : 'Anonymous / Logged-Out Athlete';
    const recentLogs = sessionLogs
      .slice(-25)
      .map((e, idx) => `[${idx + 1}] ${e.timestamp || ''} | ${e.type || 'LOG'}: ${e.detail || ''}`)
      .join('\n');
    const subject = `[You Can't Cry in Here] Feedback from ${senderLabel}`;
    const body = [
      `FEEDBACK MESSAGE:`,
      rawMessage,
      ``,
      `ATHLETE: ${senderLabel}`,
      `TIMESTAMP: ${new Date().toISOString()}`,
      ``,
      `SESSION SNAPSHOT:`,
      JSON.stringify(appSnapshot),
      ``,
      `DIAGNOSTIC LOGS (${sessionLogs.length} total):`,
      recentLogs
    ].join('\n');
    return `mailto:matthew.n.duvall@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setErrorText('Please enter a feedback message before sending.');
      return;
    }

    const senderLabel = user?.username
      ? `@${user.username} (${user.email || 'no-email'})`
      : 'Anonymous / Logged-Out Athlete';
    const timestamp = new Date().toISOString();
    const snapshotCopy = appSnapshot;
    const logsCopy = Array.isArray(sessionLogs) ? [...sessionLogs] : [];

    // Immediately close the modal so the user never experiences any UI hang
    setMessage('');
    setStatus('idle');
    setErrorText('');
    setDeliveryNote('');
    setShowFeedbackModal(false);

    // Continue sending in the background
    (async () => {
      try {
        await Promise.allSettled([
          fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({
              message: trimmed,
              user,
              sessionLogs: logsCopy,
              appSnapshot: snapshotCopy
            })
          }),
          fetch('https://formsubmit.co/ajax/matthew.n.duvall@gmail.com', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            keepalive: true,
            body: JSON.stringify({
              _subject: `[You Can't Cry in Here] Feedback from ${senderLabel}`,
              _captcha: 'false',
              _template: 'table',
              athlete: senderLabel,
              timestamp,
              message: trimmed,
              session_snapshot: JSON.stringify(snapshotCopy),
              session_logs: logsCopy
                .map(e => `${e.timestamp || ''} [${e.type || 'LOG'}] ${e.detail || ''}`)
                .join('\n')
            })
          })
        ]);
      } catch {
        // Silent background fallback
      }
    })();
  };

  return (
    <div
      style={{ ...UI.modalBackdrop, zIndex: 96 }}
      onClick={() => {
        setStatus('idle');
        setErrorText('');
        setShowFeedbackModal(false);
      }}
    >
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('400px')}>
        <div style={UI.modalHeader}>
          <span>SEND FEEDBACK</span>
          <CloseButton onClick={() => {
              setStatus('idle');
              setErrorText('');
              setShowFeedbackModal(false);
            }} />
        </div>

        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#A0A0A0',
            marginBottom: '10px',
            lineHeight: 1.4,
            textTransform: 'uppercase'
          }}
        >
          ENTER YOUR FEEDBACK BELOW. IT WILL BE AUTOMATICALLY SENT WITH DIAGNOSTIC LOGS FROM THIS SESSION ({sessionLogs.length} LOG EVENTS).
        </div>

        <textarea
          rows={5}
          value={message}
          onChange={e => {
            setMessage(e.target.value);
            if (errorText) setErrorText('');
          }}
          placeholder="DESCRIBE YOUR EXPERIENCE, BUG REPORT, OR FEATURE REQUEST..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            backgroundColor: '#101010',
            color: '#FFFFFF',
            border: '2px solid var(--dp-color-rule)',
            padding: '10px 12px',
            fontSize: '13px',
            fontWeight: 700,
            outline: 'none',
            resize: 'vertical',
            marginBottom: '12px',
            fontFamily: 'inherit'
          }}
        />

        {errorText && (
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: '#2A1212',
              border: '2px solid #FF3B30',
              color: '#FF3B30',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              marginBottom: '12px'
            }}
          >
            {errorText}
          </div>
        )}

        {status === 'sent' ? (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#172B1C',
              border: '2px solid #30D158',
              color: '#30D158',
              fontSize: '12px',
              fontWeight: 800,
              textAlign: 'center',
              textTransform: 'uppercase'
            }}
          >
            <div>FEEDBACK & SESSION LOGS SENT ✓</div>
            {deliveryNote && (
              <div style={{ fontSize: '11px', color: '#E0E0E0', marginTop: '6px', lineHeight: 1.35 }}>
                {deliveryNote}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setStatus('idle');
                setErrorText('');
                setShowFeedbackModal(false);
              }}
              style={{ padding: '12px', fontSize: '12px' }}
            >
              CANCEL
            </Button>
            <Button
              variant="primary"
              disabled={status === 'sending'}
              onClick={handleSend}
              style={{ padding: '12px', fontSize: '12px', opacity: status === 'sending' ? 0.7 : 1 }}
            >
              {status === 'sending' ? 'SENDING...' : 'SEND FEEDBACK →'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}


