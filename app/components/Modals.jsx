'use client';

import React, { useState } from 'react';
import { UI } from '../styles/kineticTokens';
import { SET_TYPES_LIST, exercise1RMInfoOfSets, oneRepMaxLabel as oneRepMaxText,
  withEffectiveLoad
} from '../utils/workoutEngine';
import { ApplyToLaterToggle, Button, CloseButton } from './Controls';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { ProfileAvatar } from './ProfileAvatar';

// ============================================================================
// MODAL COMPONENTS: DELETE CONFIRMATION, PLATE CALCULATOR, SET VALUES, SAVE, HISTORY EDIT, FEEDBACK
// ============================================================================

export function DeleteConfirmModal({
  deleteConfirmTarget,
  setDeleteConfirmTarget,
  handleConfirmDeleteAction
}) {
  // Page held still while open (no jump after APPLY / SAVE / SEND)
  useModalScrollLock(Boolean(deleteConfirmTarget));
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
  setCalcTotalFromInput,
  // [{ size, left }]: the plate buttons (left = pairs still free when plates are counted, else null)
  calcPlateOptions = [45, 35, 25, 10, 5, 2.5, 1.25].map(size => ({ size, left: null })),
  handleApplyCalculatedWeight,
  // Opens a logged History workout (the PR's) on the PROGRESS page
  onOpenHistoryWorkout,
  // Your saved bodyweight (Configuration → BODY METRICS): the BW button enters it as the weight
  bodyweightLbs = null
}) {
  // Page held still while open (no jump after APPLY / SAVE / SEND)
  useModalScrollLock(Boolean(plateCalcTarget));
  if (!plateCalcTarget) return null;

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 1300 }} onClick={() => setPlateCalcTarget(null)}>
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('390px')}>
        <div style={UI.modalHeader}>
          <div>
            <div style={UI.fieldLabel}>
              {plateCalcTarget.mode === 'goal'
                  ? 'EDIT CUSTOM GOAL WEIGHT'
                  : `SET ${plateCalcTarget.setNumber} WEIGHT`}
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
          // The set being picked keeps its type and intensity (only its weight is the one on the pop-up)
          const pickedSet = sessionSets.find(st => st && st.id === plateCalcTarget.setId) || {};
          const { value: current1RM, calculated: currentCalculated } = exercise1RMInfoOfSets(
            // Bodyweight-type exercises count bodyweight (the picked weight is what's added)
            withEffectiveLoad(plateCalcTarget.exerciseId, [
              { ...pickedSet, weight: currentTotal, reps: plateCalcTarget.setReps ?? pickedSet.reps },
              ...sessionSets.filter(st => st && st.id !== plateCalcTarget.setId)
            ], plateCalcTarget.equipment)
          );
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
                  <span style={oneRepMaxValue}>{prValue > 0 ? oneRepMaxText(prValue, prCalculated) : '—'}</span>
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
            {/* The plate buttons: big plates on the first row, small on the second. Counted plates (Configuration →
                EQUIPMENT → PLATES) show only the sizes owned, each with the pairs still free; a size runs out at 0 */}
            {[calcPlateOptions.filter(o => o.size >= 25), calcPlateOptions.filter(o => o.size < 25)]
              .filter(row => row.length > 0)
              .map((row, r, rows) => (
                <div
                  key={r}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.max(row.length, r === 0 ? 3 : 4)}, minmax(0, 1fr))`,
                    gap: '6px',
                    marginBottom: r === rows.length - 1 ? '10px' : '6px'
                  }}
                >
                  {row.map(o => (
                    <Button
                      variant="toggle"
                      key={o.size}
                      disabled={o.left !== null && o.left <= 0}
                      aria-label={`Add ${o.size} lb${calcIsSingleLoad ? '' : ' per side'}${o.left !== null ? `, ${o.left} ${o.left === 1 ? 'pair' : 'pairs'} left` : ''}`}
                      onClick={() => setCalcPlatesPerSide(prev => [...prev, o.size].sort((a, b) => b - a))}
                      style={{
                        padding: o.left !== null ? '6px 2px' : '10px 2px',
                        fontSize: r === 0 ? '12px' : '11px',
                        opacity: o.left !== null && o.left <= 0 ? 0.4 : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1px'
                      }}
                    >
                      <span>+{o.size} LB</span>
                      {o.left !== null && <span style={{ fontSize: '10px', color: '#9A9A9A' }}>{o.left} LEFT</span>}
                    </Button>
                  ))}
                </div>
              ))}

            <div
              style={{
                padding: '8px', backgroundColor: '#000000', border: 'none', borderRadius: '10px',
                marginBottom: '12px', minHeight: '38px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center'
              }}
            >
              {/* Bar + these standard plates always add up to TOTAL WEIGHT (no leftover: weights plates can't make are
                  snapped to the nearest they can) */}
              {calcPlatesPerSide.length === 0 ? (
                <span style={{ fontSize: '11px', color: '#9A9A9A' }}>
                  {calcIsSingleLoad
                    ? `${calcBarLabel}: tap weights above (no bar, not doubled)`
                    : calcBarWeight > 0
                      ? `${calcBarLabel} (${calcBarWeight} lb): tap plates above (per side)`
                      : `${calcBarLabel}: tap plates above (per side)`}
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
                        color: '#000000', border: 'none', fontSize: '11px', fontWeight: 500, cursor: 'pointer'
                      }}
                    >
                      {p} ✕
                    </button>
                  ))
              )}
            </div>

            {/* CLEAR: no plates and nothing extra (the empty bar, or 0 with no bar). BW: your saved bodyweight as the
                total, split into plates like a typed total */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
              <button
                type="button"
                className="kinetic-btn"
                aria-label={calcBarWeight > 0 && !calcIsSingleLoad ? `Clear the weight back to the empty ${calcBarWeight} lb bar` : 'Clear the weight to 0'}
                disabled={calcPlatesPerSide.length === 0}
                onClick={() => setCalcPlatesPerSide([])}
                style={{
                  ...UI.secondaryBtnCenter,
                  minHeight: '44px',
                  opacity: calcPlatesPerSide.length === 0 ? 0.4 : 1
                }}
              >
                CLEAR
              </button>
              <button
                type="button"
                className="kinetic-btn"
                aria-label={Number(bodyweightLbs) > 0 ? `Use your bodyweight, ${bodyweightLbs} lb` : 'No bodyweight saved (Configuration, Body metrics)'}
                disabled={!(Number(bodyweightLbs) > 0)}
                onClick={() => setCalcTotalFromInput(Number(bodyweightLbs))}
                style={{ ...UI.secondaryBtnCenter, minHeight: '44px', opacity: Number(bodyweightLbs) > 0 ? 1 : 0.4 }}
              >
                BW{Number(bodyweightLbs) > 0 ? <span style={{ color: '#9A9A9A', marginLeft: '6px' }}>{Number(bodyweightLbs)} LB</span> : null}
              </button>
            </div>
        </div>

        {plateCalcTarget.mode === 'set' && !plateCalcTarget.onApplyCustom && (
          <ApplyToLaterToggle
            laterSets={plateCalcTarget.laterSets}
            on={Boolean(plateCalcTarget.applyToLater)}
            onToggle={() => setPlateCalcTarget(prev => (prev ? { ...prev, applyToLater: !prev.applyToLater } : null))}
          />
        )}
        {/* Same footer as every set pop-up: CANCEL | red APPLY … */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button type="button" className="kinetic-btn" onClick={() => setPlateCalcTarget(null)} style={UI.secondaryBtnCenter}>
            CANCEL
          </button>
          <button type="button" className="kinetic-btn" onClick={handleApplyCalculatedWeight} style={UI.primaryBtnCenter}>
            APPLY WEIGHT
          </button>
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
  // Page held still while open (no jump after APPLY / SAVE / SEND)
  useModalScrollLock(Boolean(setValueTarget));
  if (!setValueTarget) return null;

  const { mode, slotId, exIdx, setId, setNumber, exerciseName, currentValue, isAbs, laterSets = [], applyToLater = false } = setValueTarget;
  // ALSO SETS n–m: the value goes to the exercise's later sets too (not done, not locked)
  const targetSetIds = [setId, ...(applyToLater ? laterSets.map(l => l.id) : [])];
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
      targetSetIds.forEach(id => handleUpdateSetField(slotId, exIdx, id, 'timer', nextVal));
    } else if (mode === 'reps') {
      targetSetIds.forEach(id => handleUpdateSetField(slotId, exIdx, id, 'reps', nextVal));
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

            {(mode === 'reps' || mode === 'timer') && !setValueTarget.onApply && (
              <ApplyToLaterToggle
                laterSets={laterSets}
                on={applyToLater}
                onToggle={() => setSetValueTarget(prev => (prev ? { ...prev, applyToLater: !prev.applyToLater } : null))}
              />
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button type="button" className="kinetic-btn" onClick={() => setSetValueTarget(null)} style={UI.secondaryBtnCenter}>
                CANCEL
              </button>
              <button type="button" className="kinetic-btn" onClick={() => applyAndClose(currentValue)} style={UI.primaryBtnCenter}>
                {applyLabel || `APPLY ${mode === 'increment' ? 'INCREMENT' : mode === 'timer' ? 'TIME' : isAbs ? 'SECONDS' : 'REPS'}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SaveConfirmModal({
  saveConfirmTarget,
  setSaveConfirmTarget,
  handleConfirmSaveWorkout,
  // Your friends (SHARE's list); empty when signed out
  friends = []
}) {
  // SHARE's list of @all + friends (closed by default)
  const [shareOpen, setShareOpen] = useState(false);
  // Page held still while open (no jump after APPLY / SAVE / SEND)
  useModalScrollLock(Boolean(saveConfirmTarget));
  if (!saveConfirmTarget) return null;

  const {
    name = '',
    log = true,
    shareWithFriends = false,
    shareFriendIds = [],
    saveAsRoutine = false,
    sourceView,
    intensityFlags = []
  } = saveConfirmTarget;
  // LOG: a live session or a past workout being logged (a History edit is already logged; the routine editor never
  // logs). SAVE: not in the routine editor (it always saves a routine).
  const showLog = sourceView === 'session';
  const showSave = sourceView !== 'routine_editor';
  const set = changes => setSaveConfirmTarget(prev => (prev ? { ...prev, ...changes } : null));
  const sendable = (friends || []).filter(f => f?.id);
  const shareCount = (shareWithFriends ? 1 : 0) + shareFriendIds.length;
  const shareSummary =
    shareCount === 0
      ? 'OFF'
      : [shareWithFriends ? '@ALL' : null, ...shareFriendIds.map(id => `@${sendable.find(f => f.id === id)?.username || 'friend'}`.toUpperCase())]
          .filter(Boolean)
          .join(', ');
  const nothingChosen = showLog && !log && !(showSave && saveAsRoutine) && shareCount === 0;
  const toggleStyle = on => ({
    minHeight: '52px',
    padding: '6px 4px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: on ? '#FFFFFF' : '#2A2A2A',
    color: on ? '#000000' : '#FFFFFF',
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px'
  });
  const toggleLabel = { fontSize: '12px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' };
  const toggleSub = on => ({ fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', color: on ? '#3A3A3A' : '#9A9A9A', textTransform: 'uppercase' });
  const toggles = [
    showLog && { id: 'log', label: 'LOG', on: log, sub: log ? 'TO HISTORY' : 'NOT LOGGED', onClick: () => set({ log: !log }) },
    showSave && { id: 'save', label: 'SAVE', on: saveAsRoutine, sub: saveAsRoutine ? 'AS ROUTINE' : 'NOT SAVED', onClick: () => set({ saveAsRoutine: !saveAsRoutine }) },
    { id: 'share', label: shareCount > 0 ? `SHARE · ${shareCount}` : 'SHARE', on: shareCount > 0, sub: shareOpen ? 'CHOOSE ▴' : 'CHOOSE ▾', onClick: () => setShareOpen(v => !v) }
  ].filter(Boolean);
  const pickRow = (key, label, sub, on, onClick, avatar) => (
    <button
      key={key}
      type="button"
      role="option"
      aria-selected={on}
      className="kinetic-btn"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minHeight: '48px',
        padding: '6px 12px',
        borderRadius: '10px',
        border: 'none',
        backgroundColor: on ? '#FFFFFF' : '#2A2A2A',
        color: on ? '#000000' : '#FFFFFF',
        fontFamily: 'inherit',
        fontSize: '14px',
        fontWeight: 500,
        textAlign: 'left',
        cursor: 'pointer'
      }}
    >
      {avatar}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
        {sub && <span style={{ color: on ? '#3A3A3A' : '#9A9A9A', fontSize: '12px', marginLeft: '6px' }}>{sub}</span>}
      </span>
      <span aria-hidden="true" style={{ fontSize: '15px', width: '18px', textAlign: 'center' }}>{on ? '✓' : ''}</span>
    </button>
  );

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 92 }} onClick={() => setSaveConfirmTarget(null)}>
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('390px')}>
        <div style={UI.modalHeader}>
          <span>{sourceView === 'routine_editor' ? 'SAVE ROUTINE' : sourceView === 'session' ? 'FINISH SESSION' : 'SAVE WORKOUT'}</span>
          <CloseButton onClick={() => setSaveConfirmTarget(null)} />
        </div>

        {/* Sets whose intensity doesn't fit the rest of the exercise: worth a look before they skew the 1RM */}
        {intensityFlags.length > 0 && (
          <div style={{ marginBottom: '14px', backgroundColor: '#1C1C1C', borderRadius: '10px', padding: '10px 12px' }}>
            <div style={{ ...UI.stepLabel, marginBottom: '6px' }}>CHECK {intensityFlags.length === 1 ? 'THIS SET' : `THESE ${intensityFlags.length} SETS`}</div>
            <div style={{ ...UI.sentence, fontSize: '12px', color: '#BDBDBD', marginBottom: '8px' }}>
              Their weight, reps and intensity give a 1RM far from the rest of the exercise, which would skew your
              calculated 1RM. Close this to fix them, or save as they are.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {intensityFlags.map((f, i) => (
                <div key={`${f.slotId}_${f.setNumber}_${i}`} style={{ ...UI.sentence, fontSize: '12px', color: '#FFFFFF' }}>
                  <div style={{ fontWeight: 500 }}>
                    {f.exerciseName} · set {f.setNumber}: {f.weight} lb × {f.reps}, {f.intensityText}
                  </div>
                  <div style={{ color: '#9A9A9A' }}>
                    1RM {f.set1RM} lb vs about {f.others1RM} lb from the other sets
                    {f.direction === 'low' ? ' (probably more reps were left).' : ' (probably fewer reps were left).'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '14px' }}>
          <div style={UI.stepLabel}>NAME</div>
          <input
            type="text"
            value={name}
            onChange={e => set({ name: e.target.value })}
            placeholder="Session or routine name"
            style={{ ...UI.field, ...UI.sessionName }}
          />
        </div>

        {/* LOG (add to History) · SAVE (as a routine) · SHARE (@all = public to friends, or send to chosen friends) */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${toggles.length}, minmax(0, 1fr))`, gap: '6px', marginBottom: shareOpen ? '8px' : '14px' }}>
          {toggles.map(t => (
            <button
              key={t.id}
              type="button"
              className="kinetic-btn"
              aria-pressed={t.id === 'share' ? undefined : t.on}
              aria-expanded={t.id === 'share' ? shareOpen : undefined}
              onClick={t.onClick}
              style={toggleStyle(t.on)}
            >
              <span style={toggleLabel}>{t.label}</span>
              <span style={toggleSub(t.on)}>{t.sub}</span>
            </button>
          ))}
        </div>
        {shareOpen && (
          <div role="listbox" aria-multiselectable="true" aria-label="Share with" style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto', marginBottom: '14px' }}>
            {pickRow(
              'all',
              '@all',
              'public to your friends',
              shareWithFriends,
              () => set({ shareWithFriends: !shareWithFriends }),
              <span aria-hidden="true" style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: shareWithFriends ? '#000000' : '#1C1C1C', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>@</span>
            )}
            {sendable.map(f =>
              pickRow(
                f.id,
                `@${f.username}`,
                'send a copy',
                shareFriendIds.includes(f.id),
                () => set({ shareFriendIds: shareFriendIds.includes(f.id) ? shareFriendIds.filter(id => id !== f.id) : [...shareFriendIds, f.id] }),
                <ProfileAvatar photo={f.profilePhoto} username={f.username} size={28} />
              )
            )}
            {sendable.length === 0 && (
              <div style={{ ...UI.sentence, fontSize: '12px', padding: '4px 2px' }}>Add friends on the Social page to send them routines.</div>
            )}
          </div>
        )}
        {!shareOpen && shareCount > 0 && (
          <div style={{ ...UI.sentence, fontSize: '12px', marginTop: '-6px', marginBottom: '14px' }}>Sharing with {shareSummary.toLowerCase()}.</div>
        )}
        {nothingChosen && (
          <div style={{ ...UI.sentence, fontSize: '12px', marginTop: '-6px', marginBottom: '14px' }}>
            Nothing is kept: the session just closes.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button type="button" className="kinetic-btn" onClick={() => setSaveConfirmTarget(null)} style={UI.secondaryBtnCenter}>
            CANCEL
          </button>
          <button type="button" className="kinetic-btn" onClick={() => handleConfirmSaveWorkout(saveConfirmTarget)} style={UI.primaryBtnCenter}>
            {sourceView === 'session' ? 'FINISH' : 'SAVE'}
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
  // Page held still while open (no jump after APPLY / SAVE / SEND)
  useModalScrollLock(Boolean(historicalEditConfirmTarget));
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

  // Page held still while open (no jump after APPLY / SAVE / SEND)
  useModalScrollLock(Boolean(showFeedbackModal));
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


