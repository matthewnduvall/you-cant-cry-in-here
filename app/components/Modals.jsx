'use client';

import React from 'react';
import { UI } from '../styles/kineticTokens';
import {
  DEFAULT_GYM_EQUIPMENT_PRESETS,
  filterAddSlotExercises
} from '../data/exerciseLibrary';

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

  const modalPool = filterAddSlotExercises(addSlotGymFilter, newSlotCategory, gyms);

  return (
    <div style={UI.modalBackdrop} onClick={() => setShowAddSlotModal(false)}>
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('400px')}>
        <div style={UI.modalHeader}>
          <span>ADD WORKOUT SLOT</span>
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
              const nextAvail = filterAddSlotExercises(nextFilter, newSlotCategory, gyms);
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
          <div style={UI.stepLabel}>2. SLOT CATEGORY</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {['Compound Lift', 'Supersets', 'Accessories', 'Abs'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setNewSlotCategory(cat);
                  const nextAvail = filterAddSlotExercises(addSlotGymFilter, cat, gyms);
                  if (nextAvail.length > 0) {
                    if (!nextAvail.some(x => x.id === newSlotEx1)) setNewSlotEx1(nextAvail[0].id);
                    setNewSlotSupersetIds(prev => [
                      nextAvail.some(x => x.id === prev[0]) ? prev[0] : nextAvail[0].id,
                      nextAvail.some(x => x.id === prev[1]) ? prev[1] : (nextAvail[1] || nextAvail[0]).id
                    ]);
                  }
                }}
                style={UI.pillBtn(newSlotCategory === cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {newSlotCategory !== 'Supersets' ? (
          <div style={{ marginBottom: '12px' }}>
            <div style={UI.stepLabel}>3. SELECT EXERCISE</div>
            <select
              value={newSlotEx1}
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
            <div style={UI.stepLabel}>3. SELECT TWO SUPERSET EXERCISES</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {[0, 1].map(idx => (
                <select
                  key={idx}
                  value={newSlotSupersetIds[idx] || modalPool[0]?.id}
                  onChange={e => {
                    const val = e.target.value;
                    setNewSlotSupersetIds(prev => {
                      const copy = [...prev];
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
              ))}
            </div>
          </div>
        )}

        {newSlotCategory !== 'Abs' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={UI.stepLabel}>4. SET/REP SCHEME</div>
            <select
              value={newSlotScheme}
              onChange={e => setNewSlotScheme(e.target.value)}
              style={UI.select}
            >
              <option value="5x5">5X5</option>
              <option value="5x8">5X8</option>
              <option value="8x8">8X8</option>
              <option value="Pyramid">PYRAMID</option>
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
          ADD SLOT TO WORKOUT →
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
  handleApplyCalculatedWeight
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

        <button
          type="button"
          onClick={handleApplyCalculatedWeight}
          className="kinetic-btn"
          style={{ ...UI.primaryBtnCenter, padding: '12px', fontSize: '13px' }}
        >
          APPLY WEIGHT →
        </button>
      </div>
    </div>
  );
}

