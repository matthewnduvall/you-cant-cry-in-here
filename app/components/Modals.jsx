'use client';

import React, { useState } from 'react';
import { UI } from '../styles/kineticTokens';
import {
  DEFAULT_GYM_EQUIPMENT_PRESETS,
  SLOT_CATEGORIES,
  normalizeSlotCategory,
  getAvailableMuscleGroupsForCategory,
  filterAddSlotExercises
} from '../data/exerciseLibrary';
import { SET_TYPES_LIST } from '../utils/workoutEngine';

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
            {deleteConfirmTarget.type === 'slot' ? 'DELETE EXERCISE?' : 'DELETE SET?'}
          </span>
          <button type="button" onClick={() => setDeleteConfirmTarget(null)} style={UI.closeXBtn}>
            ✕
          </button>
        </div>

        <div style={{ fontSize: '13px', fontWeight: 700, color: '#E0E0E0', marginBottom: '16px', lineHeight: 1.4 }}>
          Are you sure you want to delete{' '}
          <strong style={{ color: 'var(--dp-color-accent)' }}>{deleteConfirmTarget.label}</strong>?
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setDeleteConfirmTarget(null)}
            className="kinetic-btn"
            style={{ ...UI.secondaryBtnCenter, padding: '12px', fontSize: '12px' }}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleConfirmDeleteAction}
            className="kinetic-btn"
            style={{
              ...UI.primaryBtnCenter,
              padding: '12px',
              fontSize: '12px',
              backgroundColor: '#FF3B30',
              color: '#FFFFFF'
            }}
          >
            DELETE ✕
          </button>
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
          <button type="button" onClick={() => setShowAddSlotModal(false)} style={UI.closeXBtn}>
            ✕
          </button>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={UI.stepLabel}>1. GYMS/EQUIPMENT</div>
          <select
            value={addSlotGymFilter}
            onChange={e => {
              const nextFilter = e.target.value;
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
            style={{ ...UI.select, textTransform: 'uppercase' }}
          >
            {DEFAULT_GYM_EQUIPMENT_PRESETS.map(preset => (
              <option key={preset.id || 'full_gym'} value={preset.id}>
                {preset.name.toUpperCase()}
              </option>
            ))}
            {gyms.map(g => (
              <option key={g.id} value={g.id}>{g.name.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={UI.stepLabel}>2. EXERCISE CATEGORY</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {SLOT_CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
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
                style={UI.pillBtn(normCat === cat)}
              >
                {cat}
              </button>
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
                if (!nextAvail.some(x => x.id === newSlotEx1)) setNewSlotEx1(nextAvail[0].id);
                setNewSlotSupersetIds(prev => [
                  nextAvail.some(x => x.id === prev[0]) ? prev[0] : nextAvail[0].id,
                  nextAvail.some(x => x.id === prev[1]) ? prev[1] : (nextAvail[1] || nextAvail[0]).id
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

        {normCat !== 'Abs' && (
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
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={handleAddManualSlot}
          className="kinetic-btn"
          style={{ ...UI.primaryBtnCenter, padding: '12px', fontSize: '13px' }}
        >
          ADD EXERCISE TO WORKOUT →
        </button>
      </div>
    </div>
  );
}

export function PlateCalculatorModal({
  plateCalcTarget,
  setPlateCalcTarget,
  computedPlateCalculatorTotal,
  calcUnit,
  calcMode,
  setCalcMode,
  calcBarWeight,
  calcPlatesPerSide,
  setCalcPlatesPerSide,
  calcDirectTotal,
  setCalcDirectTotal,
  handleApplyCalculatedWeight,
  handleSetPRUnknown
}) {
  if (!plateCalcTarget) return null;

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 80 }} onClick={() => setPlateCalcTarget(null)}>
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
          <button type="button" onClick={() => setPlateCalcTarget(null)} style={UI.closeXBtn}>
            ✕
          </button>
        </div>

        <div
          style={{
            backgroundColor: '#101010', border: '2px solid var(--dp-color-rule)',
            padding: '12px', textAlign: 'center', marginBottom: '12px'
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#A0A0A0' }}>TOTAL WEIGHT</div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>
            {computedPlateCalculatorTotal} {calcUnit.toUpperCase()}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
          <button
            type="button"
            onClick={() => setCalcMode('per_side')}
            style={UI.pillBtn(calcMode === 'per_side')}
          >
            PLATES PER SIDE
          </button>
          <button
            type="button"
            onClick={() => {
              setCalcDirectTotal(computedPlateCalculatorTotal);
              setCalcMode('total');
            }}
            style={UI.pillBtn(calcMode === 'total')}
          >
            DIRECT TOTAL
          </button>
        </div>

        {calcMode === 'per_side' ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '6px' }}>
              {[45, 35, 25].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCalcPlatesPerSide(prev => [...prev, p].sort((a, b) => b - a))}
                  style={{ ...UI.pillBtn(false), padding: '10px 4px', fontSize: '12px' }}
                >
                  +{p} LB
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '10px' }}>
              {[10, 5, 2.5, 1.25].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCalcPlatesPerSide(prev => [...prev, p].sort((a, b) => b - a))}
                  style={{ ...UI.pillBtn(false), padding: '10px 2px', fontSize: '11px' }}
                >
                  +{p} LB
                </button>
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
                  Barbell ({calcBarWeight} lb) — tap plates above
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
        ) : (
          <div style={{ marginBottom: '12px' }}>
            <input
              type="number"
              step="1.25"
              value={calcDirectTotal}
              onChange={e => setCalcDirectTotal(e.target.value)}
              style={{ ...UI.numInput('100%'), padding: '10px', fontSize: '18px' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={handleApplyCalculatedWeight}
            className="kinetic-btn"
            style={{ ...UI.primaryBtnCenter, padding: '12px', fontSize: '13px' }}
          >
            APPLY WEIGHT →
          </button>

          {plateCalcTarget.mode === 'pr' && (
            <button
              type="button"
              onClick={() => {
                handleSetPRUnknown?.(plateCalcTarget.exerciseId);
                setPlateCalcTarget(null);
              }}
              className="kinetic-btn"
              style={{ ...UI.secondaryBtnCenter, padding: '10px', fontSize: '12px', color: '#A0A0A0' }}
            >
              SET AS UNKNOWN
            </button>
          )}
        </div>
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
    if (mode === 'type') {
      handleUpdateSetType(slotId, exIdx, setId, nextVal);
    } else if (mode === 'increment') {
      handleUpdateSetField(slotId, exIdx, setId, 'increment', nextVal);
    } else if (mode === 'reps') {
      handleUpdateSetField(slotId, exIdx, setId, 'reps', nextVal);
    }
    setSetValueTarget(null);
  };

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 85 }} onClick={() => setSetValueTarget(null)}>
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('380px')}>
        <div style={UI.modalHeader}>
          <div>
            <div style={UI.fieldLabel}>
              {mode === 'type'
                ? `SET ${setNumber} TYPE`
                : mode === 'increment'
                  ? `SET ${setNumber} WEIGHT INCREMENT`
                  : `SET ${setNumber} ${isAbs ? 'DURATION (SEC)' : 'REPS'}`}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>
              {exerciseName}
            </div>
          </div>
          <button type="button" onClick={() => setSetValueTarget(null)} style={UI.closeXBtn}>
            ✕
          </button>
        </div>

        {mode === 'type' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {SET_TYPES_LIST.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => applyAndClose(t)}
                className="kinetic-btn"
                style={{
                  ...UI.pillBtn(currentValue === t),
                  padding: '12px',
                  fontSize: '13px',
                  textAlign: 'center'
                }}
              >
                {t.toUpperCase()}
              </button>
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
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#A0A0A0' }}>
                {mode === 'increment' ? 'INCREMENT FROM LAST' : isAbs ? 'SECONDS' : 'TARGET REPS'}
              </div>
              <input
                type="text"
                inputMode="decimal"
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

            <button
              type="button"
              onClick={() => applyAndClose(currentValue)}
              className="kinetic-btn"
              style={{ ...UI.primaryBtnCenter, padding: '12px', fontSize: '13px' }}
            >
              APPLY {mode === 'increment' ? 'INCREMENT' : isAbs ? 'SECONDS' : 'REPS'} →
            </button>
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

  const { name = '', shareWithFriends = true } = saveConfirmTarget;

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 92 }} onClick={() => setSaveConfirmTarget(null)}>
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('390px')}>
        <div style={UI.modalHeader}>
          <span>CONFIRM SAVE</span>
          <button type="button" onClick={() => setSaveConfirmTarget(null)} style={UI.closeXBtn}>
            ✕
          </button>
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
        </div>

        <div style={{ marginBottom: '18px' }}>
          <div style={UI.stepLabel}>2. SHARE WITH FRIENDS?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
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
                textAlign: 'center'
              }}
            >
              YES — SHARE ✓
            </button>
            <button
              type="button"
              onClick={() =>
                setSaveConfirmTarget(prev => (prev ? { ...prev, shareWithFriends: false } : null))
              }
              className="kinetic-btn"
              style={{
                ...UI.pillBtn(!shareWithFriends),
                padding: '10px 8px',
                fontSize: '12px',
                textAlign: 'center'
              }}
            >
              NO — PRIVATE
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setSaveConfirmTarget(null)}
            className="kinetic-btn"
            style={{ ...UI.secondaryBtnCenter, padding: '12px', fontSize: '12px' }}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={() => handleConfirmSaveWorkout(saveConfirmTarget)}
            className="kinetic-btn"
            style={{ ...UI.primaryBtnCenter, padding: '12px', fontSize: '12px' }}
          >
            SAVE WORKOUT →
          </button>
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
          <button
            type="button"
            onClick={() => setHistoricalEditConfirmTarget(null)}
            style={UI.closeXBtn}
          >
            ✕
          </button>
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
          <button
            type="button"
            onClick={() => setHistoricalEditConfirmTarget(null)}
            className="kinetic-btn"
            style={{ ...UI.secondaryBtnCenter, padding: '12px', fontSize: '12px' }}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleConfirmHistoricalEdit}
            className="kinetic-btn"
            style={{ ...UI.primaryBtnCenter, padding: '12px', fontSize: '12px' }}
          >
            CONFIRM EDIT →
          </button>
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

  if (!showFeedbackModal) return null;

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setErrorText('Please enter a feedback message before sending.');
      return;
    }
    setStatus('sending');
    setErrorText('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          user,
          sessionLogs,
          appSnapshot
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to send feedback');
      }
      setStatus('sent');
      setTimeout(() => {
        setMessage('');
        setStatus('idle');
        setShowFeedbackModal(false);
      }, 1400);
    } catch (err) {
      setStatus('error');
      setErrorText(err?.message || 'Could not send automatically.');
    }
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
          <button
            type="button"
            onClick={() => {
              setStatus('idle');
              setErrorText('');
              setShowFeedbackModal(false);
            }}
            style={UI.closeXBtn}
          >
            ✕
          </button>
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
            FEEDBACK & SESSION LOGS SENT ✓
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setStatus('idle');
                setErrorText('');
                setShowFeedbackModal(false);
              }}
              className="kinetic-btn"
              style={{ ...UI.secondaryBtnCenter, padding: '12px', fontSize: '12px' }}
            >
              CANCEL
            </button>
            <button
              type="button"
              disabled={status === 'sending'}
              onClick={handleSend}
              className="kinetic-btn"
              style={{
                ...UI.primaryBtnCenter,
                padding: '12px',
                fontSize: '12px',
                opacity: status === 'sending' ? 0.7 : 1
              }}
            >
              {status === 'sending' ? 'SENDING...' : 'SEND FEEDBACK →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


