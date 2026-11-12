'use client';

import React, { useState } from 'react';
import { UI } from '../styles/kineticTokens';
import { formatTodayYMD } from '../data/exerciseLibrary';
import { SET_TYPES_LIST, best1RMInfoOfSets, oneRepMaxLabel as oneRepMaxText } from '../utils/workoutEngine';
import { Button, CloseButton } from './Controls';

// ============================================================================
// MODAL COMPONENTS: DELETE CONFIRMATION, PLATE CALCULATOR, SET VALUES, SAVE, HISTORY EDIT, FEEDBACK
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

        <div style={{ fontSize: '13px', fontWeight: 500, color: '#BDBDBD', marginBottom: '16px', lineHeight: 1.4 }}>
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

// TOTAL WEIGHT readout that turns into a number field when tapped (replaces the old DIRECT TOTAL mode)
function EditableTotalWeight({ value, unit, onCommit }) {
  const [draft, setDraft] = useState(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== '' && !Number.isNaN(Number(draft))) onCommit?.(draft);
    setDraft(null);
  };
  // Hero value: large and light, with the unit small and grey beside it
  const bigText = { fontSize: '40px', fontWeight: 300, letterSpacing: '-0.02em', color: '#FFFFFF', whiteSpace: 'nowrap', lineHeight: 1.1 };
  return (
    <div style={{ textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em', color: '#9A9A9A' }}>TOTAL WEIGHT ✎</div>
      {draft === null ? (
        <button
          type="button"
          aria-label="Edit total weight"
          onClick={() => setDraft(String(value))}
          style={{ ...bigText, background: 'none', border: 'none', padding: 0, cursor: 'text', width: '100%' }}
        >
          {value}
          <span style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', color: '#9A9A9A', marginLeft: '4px' }}>
            {unit.toUpperCase()}
          </span>
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
            backgroundColor: '#2A2A2A',
            border: 'none',
            borderRadius: '10px',
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
  calcExtraLbs = 0,
  clearCalcExtra,
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
            <div style={{ fontSize: '16px', fontWeight: 500, textTransform: 'uppercase' }}>
              {plateCalcTarget.exerciseName}
            </div>
          </div>
          <CloseButton onClick={() => setPlateCalcTarget(null)} />
        </div>

        {(() => {
          const hasLast = plateCalcTarget.mode === 'set' && plateCalcTarget.lastDisplay !== undefined;
          const hasOneRepMax = plateCalcTarget.mode === 'set' && Boolean(plateCalcTarget.showOneRepMax);
          const sideLabel = { fontSize: '11px', fontWeight: 500, color: '#9A9A9A', lineHeight: 1 };
          const sideValue = color => ({ fontSize: '16px', fontWeight: 500, color, marginTop: '4px', lineHeight: 1.1 });
          // 1RM box: PR = best 1RM logged in History; CURRENT = best 1RM across this exercise's sets in the
          // session, with this set at the weight being picked. Same estimate History uses to find PRs, so
          // CURRENT above PR means the session would log a new PR.
          const prValue = Number(plateCalcTarget.prValue) || 0;
          const prCalculated = Boolean(plateCalcTarget.prCalculated);
          const prWorkoutId = plateCalcTarget.prWorkoutId || null;
          const currentTotal = Number(computedPlateCalculatorTotal) || 0;
          const sessionSets = Array.isArray(plateCalcTarget.sessionSets) ? plateCalcTarget.sessionSets : [];
          // * = calculated from reps (not lifted for 1 rep)
          const { value: current1RM, calculated: currentCalculated } = best1RMInfoOfSets([
            { weight: currentTotal, reps: plateCalcTarget.setReps },
            ...sessionSets.filter(st => st && st.id !== plateCalcTarget.setId)
          ]);
          const oneRepMaxLabel = color => ({ fontSize: '11px', fontWeight: 500, color, lineHeight: 1, whiteSpace: 'nowrap' });
          const oneRepMaxValue = {
            fontSize: '14px',
            fontWeight: 500,
            color: '#BDBDBD',
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
                  backgroundColor: '#000000', border: 'none', borderRadius: '10px',
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
                backgroundColor: '#000000', border: 'none', borderRadius: '10px',
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
                    <span style={sideValue('#BDBDBD')}>{plateCalcTarget.lastDisplay}</span>
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
                    padding: '8px 2px', cursor: prWorkoutId ? 'pointer' : 'default', color: '#BDBDBD', opacity: 1
                  }}
                >
                  <span style={oneRepMaxLabel('var(--dp-color-accent)')}>{prWorkoutId ? 'PR ↗' : 'PR'}</span>
                  <span style={oneRepMaxValue}>{prValue > 0 ? oneRepMaxText(prValue, prCalculated) : 'TBD'}</span>
                  <span style={{ ...oneRepMaxLabel('#9A9A9A'), marginTop: '6px' }}>CURRENT</span>
                  <span style={oneRepMaxValue}>{current1RM > 0 ? oneRepMaxText(current1RM, currentCalculated) : '—'}</span>
                </button>
              ) : (
                <div style={{ borderLeft: '1px solid var(--dp-color-rule)' }} />
              )}
            </div>
          );
        })()}

        <div>
            {/* Always says how the buttons load (the empty-bar hint below disappears once plates are added) */}
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase', marginBottom: '6px' }}>
              {calcIsSingleLoad
                ? `${calcBarLabel} weight (not doubled, no bar)`
                : calcBarWeight > 0
                  ? `Plates per side (added to both sides) · ${calcBarLabel} ${calcBarWeight} lb bar`
                  : `Plates per side (added to both sides) · ${calcBarLabel}, no bar`}
            </div>
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
                padding: '8px', backgroundColor: '#000000', border: 'none', borderRadius: '10px',
                marginBottom: '12px', minHeight: '38px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center'
              }}
            >
              {/* Bar + these plates + the leftover chip always add up to TOTAL WEIGHT */}
              {calcExtraLbs !== 0 && (
                <button
                  type="button"
                  aria-label={`Remove the ${Math.abs(calcExtraLbs)} lb that plates can't make up`}
                  onClick={() => clearCalcExtra?.()}
                  style={{
                    padding: '2px 6px', backgroundColor: '#3A3A3E',
                    color: '#FFFFFF', border: 'none', fontSize: '11px', fontWeight: 500, cursor: 'pointer'
                  }}
                >
                  {calcExtraLbs > 0 ? '+' : '−'}{Math.abs(calcExtraLbs)} LB OTHER ✕
                </button>
              )}
              {calcPlatesPerSide.length === 0 ? (
                calcExtraLbs === 0 && (
                  <span style={{ fontSize: '11px', color: '#9A9A9A' }}>
                    {calcIsSingleLoad
                      ? `${calcBarLabel}: tap weights above (no bar, not doubled)`
                      : calcBarWeight > 0
                        ? `${calcBarLabel} (${calcBarWeight} lb): tap plates above (per side)`
                        : `${calcBarLabel}: tap plates above (per side)`}
                  </span>
                )
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
                        color: '#000000', border: 'none', fontSize: '11px', fontWeight: 500, cursor: 'pointer'
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
              backgroundColor: '#000000',
              border: 'none', borderRadius: '10px'
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
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase' }}>
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
                    fontWeight: 500,
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
                      color: '#FF4A3D',
                      fontSize: '11px',
                      fontWeight: 500,
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
              style={UI.field}
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
  // Editors outside a workout (e.g. the Stimulus page's day thresholds) can relabel the pop-up and give their own
  // preset numbers: title, subtitle, valueLabel, presets, applyLabel (with onApply)
  const { title, subtitle, valueLabel, presets, applyLabel } = setValueTarget;

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
              {title || (mode === 'type'
                ? `SET ${setNumber} TYPE`
                : mode === 'increment'
                  ? `SET ${setNumber} WEIGHT INCREMENT`
                  : mode === 'timer'
                    ? `SET ${setNumber} TIMER (MM:SS)`
                    : `SET ${setNumber} ${isAbs ? 'DURATION (SEC)' : 'REPS'}`)}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 500, textTransform: 'uppercase' }}>
              {subtitle ?? exerciseName}
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
                backgroundColor: '#000000',
                border: 'none', borderRadius: '10px',
                padding: '10px',
                textAlign: 'center',
                marginBottom: '12px'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 500, color: '#9A9A9A' }}>
                {valueLabel || (mode === 'increment'
                  ? 'INCREMENT FROM LAST'
                  : mode === 'timer'
                    ? 'TARGET TIME (MM:SS)'
                    : isAbs
                      ? 'SECONDS'
                      : 'TARGET REPS')}
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
                  fontWeight: 500,
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
                {(presets || (isAbs ? [15, 30, 45, 60, 90, 120] : [1, 2, 3, 4, 5, 6, 8, 10, 12, 15])).map(r => (
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
              {applyLabel || `APPLY ${mode === 'increment' ? 'INCREMENT' : mode === 'timer' ? 'TIME' : isAbs ? 'SECONDS' : 'REPS'}`} →
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

  const { name = '', shareWithFriends = true, saveAsRoutine = false, gymType = 'all', sourceView } = saveConfirmTarget;
  // The routine editor always saves a routine, so the ROUTINE toggle only shows for sessions/History.
  const showRoutineToggle = sourceView !== 'routine_editor';
  const toggleCellStyle = {
    padding: '10px 8px',
    minHeight: '44px',
    fontSize: '12px',
    textAlign: 'center',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: '1px solid var(--dp-color-rule)',
    borderBottom: '1px solid var(--dp-color-rule)'
  };

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 92 }} onClick={() => setSaveConfirmTarget(null)}>
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('390px')}>
        <div style={UI.modalHeader}>
          <span>CONFIRM SAVE</span>
          <CloseButton onClick={() => setSaveConfirmTarget(null)} />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={UI.stepLabel}>NAME TO SAVE UNDER</div>
          <input
            type="text"
            value={name}
            onChange={e =>
              setSaveConfirmTarget(prev => (prev ? { ...prev, name: e.target.value } : null))
            }
            placeholder="Session or routine name"
            style={UI.field}
          />
          <div
            style={{
              marginTop: '6px',
              fontSize: '11px',
              fontWeight: 500,
              color: '#9A9A9A',
              textTransform: 'uppercase',
              letterSpacing: '0.03em'
            }}
          >
            EQUIPMENT DETECTED:{' '}
            <span style={{ color: 'var(--dp-color-accent)' }}>{String(gymType || 'all').toUpperCase()}</span>
          </div>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <div style={UI.stepLabel}>SHARING</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: showRoutineToggle ? '1fr 1fr' : '1fr',
              gap: 0,
              borderTop: '1px solid var(--dp-color-rule)',
              borderLeft: '1px solid var(--dp-color-rule)'
            }}
          >
            <Button
              variant="toggle"
              active={Boolean(shareWithFriends)}
              aria-pressed={Boolean(shareWithFriends)}
              onClick={() =>
                setSaveConfirmTarget(prev => (prev ? { ...prev, shareWithFriends: !prev.shareWithFriends } : null))
              }
              style={toggleCellStyle}
            >
              {shareWithFriends ? 'PUBLIC' : 'PRIVATE'}
            </Button>
            {showRoutineToggle && (
              <Button
                variant="toggle"
                active={Boolean(saveAsRoutine)}
                aria-pressed={Boolean(saveAsRoutine)}
                onClick={() =>
                  setSaveConfirmTarget(prev => (prev ? { ...prev, saveAsRoutine: !prev.saveAsRoutine } : null))
                }
                style={toggleCellStyle}
              >
                {saveAsRoutine ? 'ROUTINE ✓' : 'ROUTINE'}
              </Button>
            )}
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
            fontWeight: 500,
            color: '#BDBDBD',
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
        // Only the app's server sends it (Resend, falling back to FormSubmit there): no direct browser send
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            message: trimmed,
            user,
            sessionLogs: logsCopy,
            appSnapshot: snapshotCopy
          })
        });
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

        <div style={{ ...UI.sentence, marginBottom: '10px' }}>
          Enter your feedback below. It is sent with the diagnostic logs from this session ({sessionLogs.length} log events).
        </div>

        <textarea
          rows={5}
          value={message}
          onChange={e => {
            setMessage(e.target.value);
            if (errorText) setErrorText('');
          }}
          placeholder="Describe your experience, a bug, or a feature request"
          style={{
            ...UI.field,
            fontSize: '15px',
            resize: 'vertical',
            marginBottom: '12px',
            fontFamily: 'inherit'
          }}
        />

        {errorText && (
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: '#1C1C1C',
              border: 'none',
              borderRadius: '10px',
              color: '#FF4A3D',
              fontSize: '14px',
              fontWeight: 400,
              textTransform: 'none',
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
              backgroundColor: '#1C1C1C',
              border: 'none',
              borderRadius: '10px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 400,
              textAlign: 'center',
              textTransform: 'none'
            }}
          >
            <div>FEEDBACK & SESSION LOGS SENT ✓</div>
            {deliveryNote && (
              <div style={{ fontSize: '11px', color: '#BDBDBD', marginTop: '6px', lineHeight: 1.35 }}>
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


