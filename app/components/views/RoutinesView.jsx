'use client';

import React, { useState } from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  EXERCISE_MAP,
  formatDateYMD,
  stripEquipmentFromExerciseName,
  getEquipmentListForGymSelection
} from '../../data/exerciseLibrary';

// The filter option for Configuration → EQUIPMENT (the athlete's own ON list): the default when it is set
const MY_EQUIPMENT = 'my_equipment';
import { Button, DeleteButton, GymSelect, TabBar } from '../Controls';
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
  { id: 'saved', tab: 'SAVED', title: 'SAVED ROUTINES', empty: 'No saved routines match this equipment filter.', deleteType: 'saved_routine' },
  { id: 'shared', tab: 'SHARED', title: 'SHARED ROUTINES', empty: 'No shared routines match this equipment filter.', deleteType: 'shared_routine' },
  { id: 'friends', tab: 'FRIENDS', title: "FRIENDS' ROUTINES", empty: 'No friend routines match this equipment filter.' }
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
  availableEquipment = null
}) {
  const [tabChoice, setTabChoice] = useState(null);
  // The History tab's SEARCH / TYPE / MUSCLE / EQUIPMENT / EXERCISE filter, over the exercises in the routines
  const [exerciseFilter, setExerciseFilter] = useState(EMPTY_HISTORY_FILTER);
  const exerciseFilterActive = isHistoryFilterActive(exerciseFilter);
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
    shared: split(sharedRoutines),
    friends: split((friendsList || []).flatMap(f => (f.sharedRoutines || []).map(r => ({ ...r, friendName: f.username }))))
  };
  const routinesByList = Object.fromEntries(Object.entries(byList).map(([id, v]) => [id, v.fits]));
  // Every routine shown here (for the filter's exercise list) and how many pass the exercise filter
  const allRoutines = [
    ...(sections.includes('saved') ? savedRoutines || [] : []),
    ...(sections.includes('shared') ? sharedRoutines || [] : []),
    ...(sections.includes('friends') ? (friendsList || []).flatMap(f => f.sharedRoutines || []) : [])
  ];
  const matchingCount = Object.values(byList).reduce((n, v) => n + v.fits.length + v.needsMore.length, 0);
  const lists = ROUTINE_LISTS.filter(l => sections.includes(l.id));
  const useTabs = lists.length > 1;
  const activeList = lists.find(l => l.id === tabChoice) || lists[0];

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
    const top = sets.reduce((best, st) => {
      const w = Number(st?.weight) || 0;
      const reps = Number(st?.reps) || 0;
      return !best || w > best.w || (w === best.w && reps > best.r) ? { w, r: reps } : best;
    }, null);
    const topText = top && top.w > 0 ? ` • TOP ${top.w} LB × ${top.r}` : top && top.r > 0 ? ` • TOP ${top.r} REPS` : '';
    return `${sets.length} SET${sets.length === 1 ? '' : 'S'}${topText}`;
  };
  const subLine = { fontSize: '11px', fontWeight: 500, color: '#9A9A9A', marginTop: '1px', textTransform: 'uppercase' };

  // Rows laid out like History's: the name (bold capitals, the row's one red), then date • exercises • author,
  // then the exercises themselves (two lines at most); LOAD and (own lists) a grey ✕ on the right
  const renderRows = (list, routines, dim = false) =>
    routines.map((r, i) => {
      const author = list.id === 'friends' ? r.friendName : (r.author || fallbackAuthor).replace(/^@/, '');
      const count = getWorkoutExerciseIds(r).length;
      return (
        <div
          key={`${r.key}_${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: !readOnly && list.deleteType ? 'minmax(0, 1fr) 72px 48px' : 'minmax(0, 1fr) 72px',
            alignItems: 'stretch',
            backgroundColor: '#1C1C1C',
            opacity: dim ? 0.75 : 1
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => load(r)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                load(r);
              }
            }}
            style={{ padding: '8px 12px', minWidth: 0, minHeight: '48px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer', ...SHARED_CELL_BORDER }}
          >
            <div
              style={{
                fontSize: '13px',
                ...UI.sessionName,
                color: 'var(--cr-red-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0
              }}
            >
              {r.label}
            </div>
            <div style={subLine}>
              {[r.savedAt ? formatDateYMD(r.savedAt) : null, `${count} ${count === 1 ? 'EXERCISE' : 'EXERCISES'}`, `BY @${author}`]
                .filter(Boolean)
                .join(' • ')}
            </div>
            {!exerciseFilter.exerciseId && exerciseNamesOf(r) && (
              <div style={{ ...subLine, color: '#FFFFFF', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
          {!readOnly && list.deleteType && (
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
                {needsMore.length > 0
                  ? 'None fit this equipment; see below for what they need.'
                  : exerciseFilterActive
                    ? 'No routines match these filters.'
                    : list.empty}
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
            style={{ width: '100%', height: '48px', boxSizing: 'border-box', padding: '0 14px', fontSize: '12px', backgroundColor: '#1C1C1C', color: '#FF4A3D', borderTop: 'none', borderLeft: 'none', borderRight: '1px solid var(--dp-color-rule)', borderBottom: '1px solid var(--dp-color-rule)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <span>CANCEL</span>
          </Button>
        )}
      </div>

      {/* AUTO ROUTINE: an auto-built workout (same as AUTO SESSION) instead of a saved routine */}
      {onAutoRoutine && (
        <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '16px' }}>
          <Button variant="primary-row" onClick={onAutoRoutine}>
            <span>AUTO ROUTINE</span>
            <span>→</span>
          </Button>
        </div>
      )}

      {/* SEARCH / TYPE / MUSCLE / EQUIPMENT / EXERCISE: the History tab's filter, over the routines' exercises */}
      {allRoutines.length > 0 && (
        <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '12px' }}>
          <div style={SHARED_PICKER_GROUP}>
            <HistoryExerciseFilter history={allRoutines} filter={exerciseFilter} onChange={setExerciseFilter} />
          </div>
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
