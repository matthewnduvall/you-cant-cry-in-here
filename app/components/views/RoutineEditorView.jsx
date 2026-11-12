'use client';

import React from 'react';
import { usePointerReorder } from '../../hooks/usePointerReorder';
import { SHARED_CELL_BORDER, SHARED_GROUP_OUTER, UI } from '../../styles/kineticTokens';
import {
  normalizeSlotCategory,
  isSupersetCategory,
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  formatDateYMD,
  parseYMDToISO,
  stripDateFromTitle
} from '../../data/exerciseLibrary';
import {
  getBestHistory1RMInfo
} from '../../utils/workoutEngine';
import { Button } from '../Controls';
import { SlotEditor } from '../SlotEditor';

// A YYYY/MM/DD date box that only hands back a complete, real date (on blur or Enter); otherwise it shows the
// saved date again. Remounted (key) whenever the saved date changes.
const isRealYMD = text => {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(String(text || '').trim().replace(/-/g, '/'));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}/${String(mo).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
};

function WorkoutDateInput({ savedText, onCommit, style }) {
  const [text, setText] = React.useState(savedText);
  const finish = () => {
    const ymd = isRealYMD(text);
    if (ymd && ymd !== savedText) onCommit(ymd);
    else setText(savedText);
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label="Workout date (YYYY/MM/DD)"
      placeholder="YYYY/MM/DD"
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={finish}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      style={style}
    />
  );
}

// The friend's tab colour on each exercise of a synced session (orange stays "you")
// Sync explanation line: grey info text (the friend's pill is shown by fill, not by a colour)
const PARTNER_TAB_COLOR = '#BDBDBD';

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
  handleUpdateSetField,
  handleUpdateSetType,
  handleRecalculateSlotWeights,
  handleToggleSetLock,
  handleToggleSetDone,
  handleReorderExercises,
  handleReorderSets,
  openPlateCalculatorForSet,
  setSetValueTarget,
  openedFromRoutines = false,
  setOpenedFromRoutines,
  setCurrentView,
  setRoutineSelectReturnView,
  isEmbeddedHistorySession = false,
  // History editor: { dirty, onSave, onDiscard }. Edits stay a draft until SAVE (same save pop-up as FINISH)
  historyEdit = null,
  // Synced session: every exercise gets its own YOU / @FRIEND tab. { isPartner(slotId), onChange(slotId, tab),
  // partnerName, partnerWorkout (your structure + their numbers), partnerHistory, partnerNumbersLoaded,
  // partnerAppOutdated, handlers (the friend's copy of the slot handlers) }
  slotTabs = null
}) {
  // Drag an exercise's numbered grippy handle to reorder (pointer events: works with touch). The page scrolls when
  // the finger rests below the sticky session header (~146 px) or near the bottom edge.
  const { handleProps: slotHandleProps, rowDragStyle: slotDragStyle } = usePointerReorder((from, to) => handleReorderExercises?.(from, to), { attribute: 'data-slot-reorder', edgeTop: 190 });

  if (!currentEditorWorkout) return null;

  const hasExercises = (currentEditorWorkout.slots || []).length > 0;
  // Inside an open History workout the History list already has the page gutter, so the editor adds none (set rows
  // keep their full width and set types like WORKING aren't cut off)
  const sideGutter = isEmbeddedHistorySession ? '0' : '0 var(--dp-spacing-gutter)';

  const fieldLabelStyle = {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--dp-color-accent)',
    textTransform: 'uppercase',
    lineHeight: 1.15,
    letterSpacing: '0.03em'
  };
  // The workout's date (YYYY/MM/DD). Only a complete, real date is saved (on leaving the box or Enter): History
  // edits set workoutDate + startedAt on the draft, LOG PAST WORKOUT its draft's workoutDate. Anything else goes
  // back to the saved date, so a half-typed date can never be stored.
  const savedDateText = currentEditorWorkout.workoutDate
    ? formatDateYMD(currentEditorWorkout.workoutDate)
    : currentEditorWorkout.startedAt
      ? formatDateYMD(currentEditorWorkout.startedAt)
      : '';
  const commitDate = ymd => {
    if (isEmbeddedHistorySession) {
      updateCurrentWorkoutState(prev => ({ ...prev, workoutDate: ymd, startedAt: parseYMDToISO(ymd) }));
    } else {
      setHistoricalDraft?.(prev => ({ ...prev, workoutDate: ymd }));
    }
  };
  const dateInput = style => (
    <WorkoutDateInput
      key={savedDateText}
      savedText={savedDateText}
      onCommit={commitDate}
      style={{
        backgroundColor: '#000000',
        color: '#FFFFFF',
        border: 'none', borderRadius: '10px',
        padding: '5px 10px',
        fontSize: '13px',
        fontWeight: 500,
        outline: 'none',
        boxSizing: 'border-box',
        minWidth: 0,
        ...style
      }}
    />
  );

  return (
    <div style={{ paddingTop: isEmbeddedHistorySession ? '8px' : '14px' }}>
      {/* Synced with a friend: one line explains the YOU / @FRIEND pills on each exercise (so they don't each need a note) */}
      {slotTabs && !slotTabs.partnerAppOutdated && !isEmbeddedHistorySession && (currentEditorWorkout.slots || []).length > 0 && (
        <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '12px', fontSize: '13px', fontWeight: 400, color: PARTNER_TAB_COLOR, lineHeight: 1.4 }}>
          The @{slotTabs.partnerName || 'friend'} pill on an exercise shows their numbers; changes there show up on their phone.
          {slotTabs.partnerNumbersLoaded || !(currentEditorWorkout.slots || []).some(sl => slotTabs.isPartner(sl.id))
            ? ''
            : ' Suggested weights use your history until theirs loads.'}
        </div>
      )}
      {/* Their app is too old to show their numbers */}
      {slotTabs?.partnerAppOutdated && !isEmbeddedHistorySession && (
        <div role="alert" style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '16px', fontSize: '12px', fontWeight: 500, color: '#FF4A3D', lineHeight: 1.4 }}>
          @{slotTabs.partnerName || 'Your friend'} is on an older version of the app, so their numbers don’t reach you.
          Ask them to close the app and open it again.
        </div>
      )}
      {/* Session name, SAVE and RESET sit in the locked header (SessionTitleBar). This block only holds the
          past-workout title / date, and the name for the History inline editor (which has no locked header). */}
      {(currentView === 'historical_entry' || isEmbeddedHistorySession) && (
      <section style={{ marginBottom: '20px', padding: sideGutter }}>
        {currentView === 'historical_entry' && (
          <div
            style={{
              fontSize: '20px',
              fontWeight: 500,
              letterSpacing: '-0.01em',
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
          {/* History editor: SAVE writes the edits to History (save pop-up), DISCARD drops them */}
          {isEmbeddedHistorySession && historyEdit && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: historyEdit.dirty ? 'minmax(0, 1fr) 86px 86px' : 'minmax(0, 1fr) 86px',
                alignItems: 'stretch'
              }}
            >
              <div
                style={{
                  ...SHARED_CELL_BORDER,
                  backgroundColor: '#1C1C1C',
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: historyEdit.dirty ? 'var(--dp-color-accent)' : '#9A9A9A',
                  minHeight: '44px'
                }}
              >
                {historyEdit.dirty ? 'UNSAVED CHANGES' : 'EDITS SAVE WHEN YOU TAP SAVE'}
              </div>
              {historyEdit.dirty && (
                <button
                  type="button"
                  className="kinetic-btn"
                  onClick={historyEdit.onDiscard}
                  style={{
                    ...SHARED_CELL_BORDER,
                    backgroundColor: '#1C1C1C',
                    color: '#FF4A3D',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  DISCARD
                </button>
              )}
              <button
                type="button"
                className="kinetic-btn"
                disabled={!historyEdit.dirty}
                onClick={historyEdit.onSave}
                style={{
                  ...SHARED_CELL_BORDER,
                  backgroundColor: historyEdit.dirty ? '#FFFFFF' : '#2A2A2A',
                  color: historyEdit.dirty ? '#000000' : '#9A9A9A',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: historyEdit.dirty ? 'pointer' : 'default'
                }}
              >
                SAVE
              </button>
            </div>
          )}

          {/* History inline editor: SESSION NAME | DATE side by side (the name never carries the date) */}
          {isEmbeddedHistorySession && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 116px', alignItems: 'stretch' }}>
              <label
                style={{
                  backgroundColor: '#1C1C1C',
                  ...SHARED_CELL_BORDER,
                  padding: '8px 12px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minWidth: 0
                }}
              >
                <span style={fieldLabelStyle}>SESSION NAME</span>
                <input
                  type="text"
                  aria-label="Session name"
                  value={stripDateFromTitle(currentEditorWorkout.title)}
                  onChange={e => updateCurrentWorkoutState(prev => ({ ...prev, title: e.target.value }))}
                  style={{
                    width: '100%',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '16px',
                    ...UI.sessionName,
                    outline: 'none',
                    padding: 0,
                    marginTop: '2px',
                    lineHeight: 1.2
                  }}
                />
              </label>
              <label
                style={{
                  backgroundColor: '#1C1C1C',
                  ...SHARED_CELL_BORDER,
                  padding: '8px 10px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minWidth: 0
                }}
              >
                <span style={fieldLabelStyle}>DATE</span>
                {dateInput({ fontSize: '15px', textAlign: 'left', width: '100%', border: 'none', backgroundColor: 'transparent', padding: 0, marginTop: '2px' })}
              </label>
            </div>
          )}

          {/* LOG PAST WORKOUT: its date row (the name lives in the locked header) */}
          {currentView === 'historical_entry' && (
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
              <span style={{ fontSize: '13px', fontWeight: 500, textTransform: 'uppercase', color: '#BDBDBD' }}>
                WORKOUT DATE
              </span>
              {dateInput({ width: '130px', textAlign: 'center' })}
            </div>
          )}

        </div>
      </section>
      )}

      {/* ALWAYS-EXPANDED EXERCISES — SHARED BORDERS, LARGER CONTROLS & TEXT */}
      <section style={{ marginBottom: '20px', padding: sideGutter }}>
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
            <div style={UI.sectionTitle}>
              {`EXERCISES (${(currentEditorWorkout.slots || []).length})`}
            </div>
          </div>
        )}

        <div>
          {!hasExercises ? null : (
            (currentEditorWorkout.slots || []).map((ownSlot, sIdx) => {
              // Synced: this exercise on the friend's tab shows (and edits) their numbers with their handlers
              const onPartnerTab = Boolean(slotTabs?.isPartner(ownSlot.id));
              const slot = (onPartnerTab && slotTabs.partnerWorkout?.slots?.find(s => s.id === ownSlot.id)) || ownSlot;
              const partnerHandlers = onPartnerTab ? slotTabs.handlers : null;
              const ownHandlers = {
                handleUpdateSlotCategoryOrExercise,
                handleUpdateSetField,
                handleUpdateSetType,
                handleInsertSetAtPosition,
                handleRecalculateSlotWeights,
                handleToggleSetLock,
                handleToggleSetDone,
                handleReorderSets
              };
              const slotHandler = name => (partnerHandlers && partnerHandlers[name]) || ownHandlers[name];
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
                  data-slot-reorder={sIdx}
                  style={{
                    // Exercises sit 8 px apart as separate tiles (no rule between them)
                    padding: '4px 0',
                    backgroundColor: 'var(--dp-color-ground)',
                    // Held exercise lifts and follows the finger; the landing exercise is outlined
                    ...slotDragStyle(sIdx)
                  }}
                >
                  {slotTabs && (
                    <div style={{ marginBottom: '6px' }}>
                      <div
                        role="tablist"
                        aria-label="Whose numbers"
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}
                      >
                        {[
                          { id: 'me', label: 'YOU' },
                          { id: 'partner', label: `@${slotTabs.partnerName || 'FRIEND'}`.toUpperCase() }
                        ].map(tab => {
                          const active = (tab.id === 'partner') === onPartnerTab;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              role="tab"
                              aria-selected={active}
                              className="kinetic-btn"
                              onClick={() => slotTabs.onChange(ownSlot.id, tab.id)}
                              style={{
                                // Pills: the selected one is a white fill with black text, the other outlined
                                minHeight: '44px',
                                padding: '4px 6px',
                                borderRadius: '999px',
                                border: `1px solid ${active ? '#FFFFFF' : 'var(--cr-outline)'}`,
                                backgroundColor: active ? '#FFFFFF' : 'transparent',
                                color: active ? '#000000' : '#FFFFFF',
                                fontSize: '12px',
                                letterSpacing: '0.06em',
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                overflowWrap: 'anywhere',
                                cursor: 'pointer'
                              }}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <SlotEditor
                    slot={slot}
                    number={sIdx + 1}
                    dragHandleProps={slotHandleProps(sIdx)}
                    selectedGymId={selectedGymId}
                    gyms={gyms}
                    history={onPartnerTab ? slotTabs.partnerHistory || history : history}
                    workoutId={currentEditorWorkout.id}
                    prFlags={prFlags}
                    onHeaderChange={changes => slotHandler('handleUpdateSlotCategoryOrExercise')(slot.id, changes)}
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
                    onChangeSetType={({ exIdx, set, type }) => slotHandler('handleUpdateSetType')?.(slot.id, exIdx, set.id, type)}
                    onSetBandColor={({ exIdx, set, color }) =>
                      slotHandler('handleUpdateSetField')?.(slot.id, exIdx, set.id, 'bandColor', color)
                    }
                    onEditWeight={({ exIdx, set, exercise, ...setInfo }) =>
                      openPlateCalculatorForSet(slot.id, exIdx, set, exercise.name, null, setInfo)
                    }
                    onToggleDone={({ exIdx, set }) => slotHandler('handleToggleSetDone')(slot, exIdx, set)}
                    onDeleteSet={({ exIdx, set, exercise }) =>
                      setDeleteConfirmTarget({
                        type: 'set',
                        slotId: slot.id,
                        exIdx,
                        setId: set.id,
                        label: `${exercise.name} — Set ${set.setNumber}`
                      })
                    }
                    onReorderSets={(exIdx, fromIdx, toIdx) => slotHandler('handleReorderSets')?.(slot.id, exIdx, fromIdx, toIdx)}
                    onInsertSet={position => slotHandler('handleInsertSetAtPosition')(slot.id, position)}
                    actionLabel="RECALCULATE"
                    onAction={() => slotHandler('handleRecalculateSlotWeights')(slot.id)}
                    onToggleSetLock={
                      handleToggleSetLock
                        ? ({ exIdx, set, field }) => slotHandler('handleToggleSetLock')(slot.id, exIdx, set.id, field)
                        : undefined
                    }
                  />
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* + ADD EXERCISE: appends an auto-guessed exercise the athlete can then edit.
          A blank live session also offers LOAD ROUTINE (opens the routine browser, which loads back here). */}
      <div style={{ padding: sideGutter }}>
        {(() => {
          const showLoadRoutine =
            !hasExercises && currentView === 'session' && !isEmbeddedHistorySession && setCurrentView && setRoutineSelectReturnView;
          // Add / empty slot: transparent with a dashed outline and a grey caps label
          const bottomButtonStyle = { minHeight: '52px', whiteSpace: 'nowrap', boxSizing: 'border-box' };
          return (
            <div style={{ display: 'grid', gridTemplateColumns: showLoadRoutine ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: '8px', width: '100%' }}>
              {/* A blank live session: + ADD EXERCISE is the page's one red (FINISH only appears once there are
                  exercises); otherwise it's the dashed "add" button */}
              <Button
                variant={showLoadRoutine ? 'primary' : 'dashed'}
                onClick={() => handleAddAutoSlot?.()}
                style={bottomButtonStyle}
              >
                + ADD EXERCISE
              </Button>
              {showLoadRoutine && (
                <Button
                  variant="dashed"
                  onClick={() => {
                    setRoutineSelectReturnView(currentView);
                    setCurrentView('routines');
                  }}
                  style={bottomButtonStyle}
                >
                  LOAD ROUTINE
                </Button>
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
}

export default RoutineEditorView;
