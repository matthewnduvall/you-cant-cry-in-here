'use client';

import React, { useEffect, useState } from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  EXERCISE_MAP,
  formatDateYMD,
  stripEquipmentFromExerciseName,
  stripDateFromTitle,
  getEquipmentListForGymSelection
} from '../../data/exerciseLibrary';

// The filter option for Configuration → EQUIPMENT (the athlete's own ON list): the default when it is set
const MY_EQUIPMENT = 'my_equipment';
import { Button, CollapseToggle, DeleteButton, GymSelect, TabBar } from '../Controls';
import { SHARED_PICKER_GROUP, SHARED_CELL_BORDER } from '../../styles/kineticTokens';
import {
  HistoryExerciseFilter,
  EMPTY_HISTORY_FILTER,
  isHistoryFilterActive,
  workoutMatchesHistoryFilter,
  getWorkoutExerciseIds,
  getWorkoutSetsForExercise
} from '../HistoryExerciseFilter';

// The routine lists, one per tab (in this order)
const ROUTINE_LISTS = [
  { id: 'saved', tab: 'SAVED', title: 'SAVED ROUTINES', none: 'No saved routines yet. Turn on ROUTINE when you finish a session to save one.', deleteType: 'saved_routine' },
  // Everything you shared: public to friends (@all) and copies sent to chosen friends
  { id: 'shared', tab: 'SHARED', title: 'SHARED ROUTINES', none: 'Nothing shared yet. Use SHARE when you finish or save, or SEND on a saved routine.', deleteType: 'shared_routine' },
  { id: 'friends', tab: 'FRIENDS', title: "FRIENDS' ROUTINES", none: 'Your friends haven’t shared any routines yet.' },
  // Routines friends sent you (public.routine_shares, pending): SAVE / LOAD / ✕ dismiss
  { id: 'received', tab: 'INBOX', title: 'INBOX', none: 'Nothing received yet. Routines friends send you show up here.' }
];

export function RoutinesView({
  colors,
  user,
  savedRoutines,
  sharedRoutines,
  friendsList,
  selectedGymId = '',
  setSelectedGymId,
  gyms = [],
  routineSelectReturnView,
  handleDirectLoadRoutine,
  handleCancelRoutineSelection,
  setDeleteConfirmTarget,
  // AUTO ROUTINE shortcut: builds an auto workout (as AUTO SESSION) instead of loading a routine
  onAutoRoutine,
  // The Configuration page's ROUTINE tab has nothing to cancel back to
  showCancel = true,
  // Which lists to show (a friend's profile shows only the routines they share); 2+ lists = tabs
  sections = ['saved', 'shared', 'friends'],
  // A friend's routines: LOAD only, no delete
  readOnly = false,
  // Configuration → EQUIPMENT (null = not chosen yet): the filter starts on MY EQUIPMENT
  availableEquipment = null,
  // SEND on your own routines (signed in): onSendRoutine(routine) opens the friend picker
  onSendRoutine,
  // The Routines page (Home / menu): + NEW ROUTINE opens an empty routine in the session editor, and tapping one
  // of your own routines opens it there to edit (LOAD still loads it into your session)
  onNewRoutine,
  onEditRoutine,
  // RECEIVED tab: routine_shares rows friends sent you, with their answers
  received = [],
  // SHARED tab: routine_shares rows you sent (grouped per routine and minute), and withdrawing them
  sent = [],
  onWithdrawSent,
  onSaveReceived,
  onLoadReceived,
  onDismissReceived,
  // Opens on this tab (Home's INBOX tile: 'received'); onInitialTabUsed lets the page reset it
  initialTab = null,
  onInitialTabUsed
}) {
  const [tabChoice, setTabChoice] = useState(initialTab);
  useEffect(() => {
    if (initialTab) onInitialTabUsed?.();
    // Once, on opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The History tab's SEARCH / TYPE / MUSCLE / EQUIPMENT / EXERCISE filter, over the exercises in the routines
  const [exerciseFilter, setExerciseFilter] = useState(EMPTY_HISTORY_FILTER);
  const exerciseFilterActive = isHistoryFilterActive(exerciseFilter);
  // The exercise filter is tucked away until asked for (SHOW), so the routines come first
  const [exerciseFilterOpen, setExerciseFilterOpen] = useState(false);
  const hasMyEquipment = Array.isArray(availableEquipment);
  // The equipment filter: your own equipment by default, else the last preset / setup picked
  const [filterId, setFilterId] = useState(() => (hasMyEquipment ? MY_EQUIPMENT : selectedGymId));
  const fallbackAuthor = (user?.username || 'athlete').replace(/^@/, '');
  // The exercises a routine does now: a superset's two, else the slot's own exercise (never stale ids an earlier pick
  // left in supersetExerciseIds)
  const routineExerciseIds = r =>
    (r.slots || []).flatMap(slot =>
      (String(slot?.category || '').toLowerCase().startsWith('superset')
        ? [slot?.supersetExerciseIds?.[0] || slot?.exerciseId, slot?.supersetExerciseIds?.[1] || slot?.secondaryExerciseId]
        : [slot?.exerciseId]
      ).filter(Boolean)
    );
  // Every filter option stands for a list of equipment (MY EQUIPMENT = Configuration → EQUIPMENT; a preset or saved
  // setup = its list; All Equipment = everything). A routine fits when every exercise in it has all the equipment it
  // needs (`requiredEquipment`, e.g. a barbell squat needs a barbell, a squat rack and weight plates) on that list.
  // Exercises the library doesn't know don't count against it; the built-in routines adapt to any equipment.
  const filterEquipment = filterId === MY_EQUIPMENT ? availableEquipment || [] : getEquipmentListForGymSelection(filterId, gyms);
  const have = new Set(filterEquipment);
  // [{ item, exercises }]: each missing piece of equipment and the exercises that need it
  const missingFor = r => {
    if (!Array.isArray(r.slots)) return [];
    const missing = new Map();
    routineExerciseIds(r).forEach(id => {
      (EXERCISE_MAP[id]?.requiredEquipment || []).forEach(req => {
        if (!req || req === 'Bodyweight' || have.has(req)) return;
        if (!missing.has(req)) missing.set(req, new Set());
        missing.get(req).add(EXERCISE_MAP[id].name);
      });
    });
    return [...missing.entries()].map(([item, names]) => ({ item, exercises: [...names] }));
  };
  const split = routines => {
    const fits = [];
    const needsMore = [];
    (routines || []).filter(r => workoutMatchesHistoryFilter(r, exerciseFilter)).forEach(r => {
      const missing = missingFor(r);
      if (missing.length === 0) fits.push(r);
      else needsMore.push({ ...r, missingEquipment: missing });
    });
    return { fits, needsMore };
  };

  const byList = {
    saved: split(savedRoutines),
    shared: split([
      ...(sharedRoutines || []).map(r => ({ ...r, sharedTo: ['all'] })),
      ...(() => {
        // One entry per send (one row per friend, sharing the send's batch id; older sends stand alone)
        const groups = new Map();
        (sent || []).forEach(row => {
          const key = row.routine?.batchId || row.id;
          const g = groups.get(key) || {
            key: `sent_${row.id}`,
            label: row.label || row.routine?.label || 'Routine',
            slots: Array.isArray(row.routine?.slots) ? row.routine.slots : [],
            savedAt: row.created_at,
            sentIds: [],
            sharedTo: []
          };
          g.sentIds.push(row.id);
          g.sharedTo.push((friendsList || []).find(f => f.id === row.recipient_id)?.username || 'friend');
          groups.set(key, g);
        });
        return [...groups.values()];
      })()
    ]),
    friends: split((friendsList || []).flatMap(f => (f.sharedRoutines || []).map(r => ({ ...r, friendName: f.username })))),
    received: split(
      (received || []).map(share => ({
        key: `received_${share.id}`,
        label: share.label || share.routine?.label || 'Routine',
        slots: Array.isArray(share.routine?.slots) ? share.routine.slots : [],
        savedAt: share.created_at,
        friendName: share.sender_username || 'friend',
        share
      }))
    )
  };
  const routinesByList = Object.fromEntries(Object.entries(byList).map(([id, v]) => [id, v.fits]));
  // Every routine shown here (for the filter's exercise list) and how many pass the exercise filter
  const allRoutines = [
    ...(sections.includes('saved') ? savedRoutines || [] : []),
    ...(sections.includes('shared') ? sharedRoutines || [] : []),
    ...(sections.includes('friends') ? (friendsList || []).flatMap(f => f.sharedRoutines || []) : []),
    ...(sections.includes('received') ? (received || []).map(share => ({ slots: share.routine?.slots || [] })) : [])
  ];
  const matchingCount = Object.values(byList).reduce((n, v) => n + v.fits.length + v.needsMore.length, 0);
  const lists = ROUTINE_LISTS.filter(l => sections.includes(l.id));
  const useTabs = lists.length > 1;
  // How many routines each list holds before any filter (to tell "none yet" from "none match")
  const rawCount = {
    saved: (savedRoutines || []).length,
    shared: (sharedRoutines || []).length + (sent || []).length,
    friends: (friendsList || []).reduce((n, f) => n + (f.sharedRoutines || []).length, 0),
    received: (received || []).length
  };
  // Until a tab is picked: the first list that has routines (fitting first, then any), else the first list
  // (anything received comes first: that's what the count on Home / the menu points to)
  const defaultList =
    lists.find(l => l.id === 'received' && rawCount.received > 0) ||
    lists.find(l => byList[l.id].fits.length > 0) ||
    lists.find(l => byList[l.id].needsMore.length > 0) ||
    lists[0];
  const activeList = lists.find(l => l.id === tabChoice) || defaultList;

  const load = r => handleDirectLoadRoutine(r, routineSelectReturnView || 'session');

  // Each routine's exercises, e.g. "BENCH PRESS · SQUAT" (as History rows show them)
  const exerciseNamesOf = r =>
    getWorkoutExerciseIds(r)
      .map(id => EXERCISE_MAP[id]?.name)
      .filter(Boolean)
      .map(name => stripEquipmentFromExerciseName(name))
      .join(' · ');
  // With one exercise picked: what the routine does for it, e.g. "3 SETS • TOP 225 LB × 5"
  const describePickedExercise = r => {
    if (!exerciseFilter.exerciseId) return '';
    const sets = getWorkoutSetsForExercise(r, exerciseFilter.exerciseId);
    if (sets.length === 0) return '';
    // Routines carry no weights (they're worked out for you on load): the most reps a set asks for
    const topReps = sets.reduce((best, st) => Math.max(best, Number(st?.reps) || 0), 0);
    const topText = topReps > 0 ? ` • UP TO ${topReps} REPS` : '';
    return `${sets.length} SET${sets.length === 1 ? '' : 'S'}${topText}`;
  };
  const subLine = { fontSize: '11px', fontWeight: 500, color: '#9A9A9A', marginTop: '1px', textTransform: 'uppercase' };

  // Rows laid out like History's: the name (bold capitals, the row's one red), then date • exercises • author,
  // then the exercises themselves (two lines at most); LOAD and (own lists) a grey ✕ on the right
  const renderRows = (list, routines, dim = false) =>
    routines.map((r, i) => {
      const isReceived = list.id === 'received';
      const isOthers = list.id === 'friends' || isReceived;
      const author = isOthers ? r.friendName : (r.author || fallbackAuthor).replace(/^@/, '');
      const count = getWorkoutExerciseIds(r).length;
      // Your own routines (not friends', not read-only) can be sent straight to a friend
      const canSend = Boolean(onSendRoutine) && !readOnly && !isOthers && (r.slots || []).length > 0;
      // Your saved routines open in the session editor when tapped (the Routines page); the rest load
      const canEdit = Boolean(onEditRoutine) && !readOnly && list.id === 'saved';
      const openRow = () => (canEdit ? onEditRoutine(r) : isReceived ? onLoadReceived?.(r.share) : load(r));
      return (
        <div
          key={`${r.key}_${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: isReceived
              ? 'minmax(0, 1fr) 60px 60px 44px'
              : `minmax(0, 1fr)${canSend ? ' 64px' : ''} 64px${!readOnly && list.deleteType ? ' 48px' : ''}`,
            alignItems: 'stretch',
            backgroundColor: '#1C1C1C',
            opacity: dim ? 0.75 : 1
          }}
        >
          <div
            role="button"
            tabIndex={0}
            aria-label={canEdit ? `Edit ${r.label}` : `Load ${r.label}`}
            onClick={openRow}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openRow();
              }
            }}
            style={{ padding: '8px 12px', minWidth: 0, minHeight: '48px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer', ...SHARED_CELL_BORDER }}
          >
            <div
              style={{
                fontSize: '15px',
                ...UI.sessionName,
                // White: a red name on every row made red mean nothing in the list
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0
              }}
            >
              {stripDateFromTitle(r.label) || r.label}
            </div>
            <div style={subLine}>
              {[
                r.savedAt ? formatDateYMD(r.savedAt) : null,
                `${count} ${count === 1 ? 'EXERCISE' : 'EXERCISES'}`,
                isReceived ? `FROM @${author}` : r.sharedTo ? `TO ${r.sharedTo.map(u => `@${u}`).join(', ')}` : `BY @${author}`,
                canEdit ? 'EDIT ›' : null
              ]
                .filter(Boolean)
                .join(' • ')}
            </div>
            {!exerciseFilter.exerciseId && exerciseNamesOf(r) && (
              <div style={{ ...UI.rowContents, marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {exerciseNamesOf(r)}
              </div>
            )}
            {exerciseFilter.exerciseId && describePickedExercise(r) && (
              <div style={{ ...subLine, color: '#FFFFFF' }}>{describePickedExercise(r)}</div>
            )}
            {r.missingEquipment && (
              <div style={{ ...UI.rowSub, color: '#BDBDBD', textTransform: 'none', marginTop: '2px' }}>
                Needs: {r.missingEquipment.map(m => `${m.item.toLowerCase()} (${m.exercises.join(', ')})`).join('; ')}
              </div>
            )}
          </div>
          {isReceived && (
            <>
              {[
                { label: 'SAVE', aria: `Save ${r.label} to your routines`, run: () => onSaveReceived?.(r.share), bg: '#1C1C1C', color: '#BDBDBD' },
                { label: 'LOAD', aria: `Load ${r.label} into your session`, run: () => onLoadReceived?.(r.share), bg: '#2A2A2A', color: '#FFFFFF' }
              ].map(b => (
                <button
                  key={b.label}
                  type="button"
                  className="kinetic-btn"
                  aria-label={b.aria}
                  onClick={b.run}
                  style={{ minHeight: '48px', boxSizing: 'border-box', backgroundColor: b.bg, color: b.color, border: 'none', ...SHARED_CELL_BORDER, fontFamily: 'inherit', fontSize: '12px', fontWeight: 500, letterSpacing: '0.08em', cursor: 'pointer' }}
                >
                  {b.label}
                </button>
              ))}
              <DeleteButton
                label={`Dismiss ${r.label}`}
                variant="outline"
                fill
                minHeight="48px"
                style={{ width: '44px', height: 'auto', color: '#9A9A9A' }}
                onClick={() => onDismissReceived?.(r.share)}
              />
            </>
          )}
          {canSend && (
            <button
              type="button"
              className="kinetic-btn"
              aria-label={`Send ${r.label} to a friend`}
              onClick={() => onSendRoutine(r)}
              style={{
                minHeight: '48px',
                boxSizing: 'border-box',
                backgroundColor: '#1C1C1C',
                color: '#BDBDBD',
                border: 'none',
                ...SHARED_CELL_BORDER,
                fontFamily: 'inherit',
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.08em',
                cursor: 'pointer'
              }}
            >
              SEND
            </button>
          )}
          {!isReceived && (
          <button
            type="button"
            className="kinetic-btn"
            aria-label={`Load ${r.label}`}
            onClick={() => load(r)}
            style={{
              minHeight: '48px',
              boxSizing: 'border-box',
              backgroundColor: '#2A2A2A',
              color: '#FFFFFF',
              border: 'none',
              ...SHARED_CELL_BORDER,
              fontFamily: 'inherit',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.08em',
              cursor: 'pointer'
            }}
          >
            LOAD
          </button>
          )}
          {!readOnly && r.sentIds && (
            <DeleteButton
              label={`Withdraw ${r.label} from ${r.sharedTo.map(u => `@${u}`).join(', ')}`}
              variant="outline"
              fill
              minHeight="48px"
              style={{ width: '48px', height: 'auto', color: '#9A9A9A' }}
              onClick={() =>
                setDeleteConfirmTarget?.({
                  type: 'generic',
                  title: 'WITHDRAW ROUTINE?',
                  verb: 'withdraw',
                  label: `${r.label} from ${r.sharedTo.map(u => `@${u}`).join(', ')}`,
                  confirmLabel: 'WITHDRAW',
                  onConfirm: () => onWithdrawSent?.(r.sentIds)
                })
              }
            />
          )}
          {!readOnly && list.deleteType && !r.sentIds && (
            <DeleteButton
              label={`Delete ${r.label}`}
              variant="outline"
              fill
              minHeight="48px"
              style={{ width: '48px', height: 'auto', color: '#9A9A9A' }}
              onClick={() =>
                setDeleteConfirmTarget?.({
                  type: list.deleteType,
                  routineKey: r.key,
                  routineLabel: r.label,
                  label: r.label
                })
              }
            />
          )}
        </div>
      );
    });

  const renderList = list => {
    const routines = routinesByList[list.id];
    const needsMore = byList[list.id].needsMore;
    return (
      <React.Fragment key={list.id}>
        <IOSListSection header={useTabs ? null : `${list.title} (${routines.length})`} colors={colors}>
          {routines.length === 0 ? (
            <IOSListRow isLast={true} colors={colors}>
              <span style={UI.rowSub}>
                {rawCount[list.id] === 0
                  ? list.none
                  : needsMore.length > 0
                    ? 'None fit this equipment; see below for what they need.'
                    : exerciseFilterActive
                      ? 'No routines match these filters.'
                      : 'None fit this equipment filter.'}
              </span>
            </IOSListRow>
          ) : (
            renderRows(list, routines)
          )}
        </IOSListSection>
        {/* Routines that need equipment this filter doesn't have: still loadable, with what's missing */}
        {needsMore.length > 0 && (
          <IOSListSection header={`NEEDS MORE EQUIPMENT (${needsMore.length})`} colors={colors}>
            {renderRows(list, needsMore, true)}
          </IOSListSection>
        )}
      </React.Fragment>
    );
  };

  return (
    <div style={UI.pagePad}>
      <div
        style={{
          ...UI.gutterBottom,
          display: 'grid',
          gridTemplateColumns: showCancel ? '1fr 1fr' : '1fr',
          gap: 0,
          borderTop: '1px solid var(--dp-color-rule)',
          borderLeft: '1px solid var(--dp-color-rule)'
        }}
      >
        {/* EQUIPMENT DROPDOWN AT TOP OF ROUTINES SELECTION */}
        <GymSelect
          variant="tile"
          tileLabel="FILTER BY EQUIPMENT"
          ariaLabel="Filter routines by equipment"
          value={filterId}
          onChange={id => {
            setFilterId(id);
            if (id !== MY_EQUIPMENT) setSelectedGymId?.(id);
          }}
          gyms={gyms}
          extraOptions={hasMyEquipment ? [{ id: MY_EQUIPMENT, label: 'My equipment' }] : []}
        />

        {showCancel && (
          <Button
            variant="secondary"
            onClick={() => handleCancelRoutineSelection?.()}
            style={{ width: '100%', height: '48px', boxSizing: 'border-box', padding: '0 14px', fontSize: '12px', backgroundColor: '#1C1C1C', color: '#FFFFFF', borderTop: 'none', borderLeft: 'none', borderRight: '1px solid var(--dp-color-rule)', borderBottom: '1px solid var(--dp-color-rule)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <span>CANCEL</span>
          </Button>
        )}
      </div>

      {/* + NEW ROUTINE (Routines page): an empty routine in the session editor; AUTO ROUTINE: an auto-built
          workout (same as AUTO SESSION) instead of a saved routine */}
      {(onNewRoutine || onAutoRoutine) && (
        <div
          style={{
            padding: '0 var(--dp-spacing-gutter)',
            marginBottom: '16px',
            display: 'grid',
            gridTemplateColumns: onNewRoutine && onAutoRoutine ? '1fr 1fr' : '1fr',
            gap: '8px'
          }}
        >
          {onNewRoutine && (
            <Button variant="secondary" onClick={onNewRoutine} style={{ minHeight: '52px' }}>
              + NEW ROUTINE
            </Button>
          )}
          {onAutoRoutine && (
            <Button variant="primary-row" onClick={onAutoRoutine}>
              <span>AUTO ROUTINE</span>
              <span>→</span>
            </Button>
          )}
        </div>
      )}

      {/* SEARCH / TYPE / MUSCLE / EQUIPMENT / EXERCISE: the History tab's filter, over the routines' exercises */}
      {allRoutines.length > 0 && (
        <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '12px' }}>
          {/* Collapsed: one row (FILTER BY EXERCISE + SHOW). Open (or a filter set): the filter, without its own
              EQUIPMENT dropdown, since FILTER BY EQUIPMENT above already decides what fits */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: '8px',
              marginBottom: exerciseFilterOpen || exerciseFilterActive ? '8px' : 0
            }}
          >
            <div style={{ ...UI.capsLabel, paddingLeft: '4px' }}>FILTER BY EXERCISE</div>
            <CollapseToggle
              collapsed={!(exerciseFilterOpen || exerciseFilterActive)}
              label="exercise filter"
              onClick={() => {
                if (exerciseFilterOpen || exerciseFilterActive) {
                  setExerciseFilter(EMPTY_HISTORY_FILTER);
                  setExerciseFilterOpen(false);
                } else setExerciseFilterOpen(true);
              }}
            />
          </div>
          {(exerciseFilterOpen || exerciseFilterActive) && (
            <div style={SHARED_PICKER_GROUP}>
              <HistoryExerciseFilter history={allRoutines} filter={exerciseFilter} onChange={setExerciseFilter} showEquipment={false} />
            </div>
          )}
          {exerciseFilterActive && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase', minWidth: 0 }}>
                {matchingCount === 0 ? 'NO ROUTINES MATCH' : `${matchingCount} OF ${allRoutines.length} ROUTINES`}
              </div>
              <button
                type="button"
                className="kinetic-btn"
                onClick={() => setExerciseFilter(EMPTY_HISTORY_FILTER)}
                style={{ height: '40px', padding: '0 14px', backgroundColor: '#1C1C1C', color: '#FFFFFF', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
              >
                CLEAR
              </button>
            </div>
          )}
        </div>
      )}

      {useTabs && (
        <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '12px' }}>
          <TabBar
            ariaLabel="Routine lists"
            tabs={lists.map(l => ({ id: l.id, label: `${l.tab} (${routinesByList[l.id].length})` }))}
            value={activeList?.id}
            onChange={setTabChoice}
          />
        </div>
      )}

      {useTabs ? activeList && renderList(activeList) : lists.map(renderList)}
    </div>
  );
}
