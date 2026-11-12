'use client';

import React, { useState } from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  DEFAULT_ROUTINES,
  getRoutineGymCategory,
  doesRoutineMatchGymFilter
} from '../../data/exerciseLibrary';
import { Button, DeleteButton, GymSelect, TabBar } from '../Controls';

// The routine lists, one per tab (in this order)
const ROUTINE_LISTS = [
  { id: 'default', tab: 'DEFAULT', title: 'DEFAULT ROUTINES', empty: 'No default routines match this equipment filter.' },
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
  sections = ['default', 'saved', 'shared', 'friends'],
  // A friend's routines: LOAD only, no delete
  readOnly = false
}) {
  const [tabChoice, setTabChoice] = useState(null);
  const fallbackAuthor = (user?.username || 'athlete').replace(/^@/, '');
  const matches = r => doesRoutineMatchGymFilter(r, selectedGymId, gyms);

  const routinesByList = {
    default: DEFAULT_ROUTINES.filter(matches),
    saved: (savedRoutines || []).filter(matches),
    shared: (sharedRoutines || []).filter(matches),
    friends: (friendsList || [])
      .flatMap(f => (f.sharedRoutines || []).map(r => ({ ...r, friendName: f.username })))
      .filter(matches)
  };
  const lists = ROUTINE_LISTS.filter(l => sections.includes(l.id));
  const useTabs = lists.length > 1;
  const activeList = lists.find(l => l.id === tabChoice) || lists[0];

  const load = r => handleDirectLoadRoutine(r, routineSelectReturnView || 'session');
  const subtitleFor = (listId, r) => {
    const gymCat = getRoutineGymCategory(r).toUpperCase();
    if (listId === 'default') return `EQUIPMENT: ${gymCat}`;
    const author = listId === 'friends' ? r.friendName : (r.author || fallbackAuthor).replace(/^@/, '');
    return `BY @${author} • EQUIPMENT: ${gymCat}`;
  };

  const renderList = list => {
    const routines = routinesByList[list.id];
    return (
      <IOSListSection key={list.id} header={useTabs ? null : `${list.title} (${routines.length})`} colors={colors}>
        {routines.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={UI.rowSub}>{list.empty}</span>
          </IOSListRow>
        ) : (
          routines.map((r, i) => (
            <IOSListRow
              key={`${r.key}_${i}`}
              isLast={i === routines.length - 1}
              colors={colors}
              onClick={() => load(r)}
            >
              <div>
                <div style={UI.rowTitle}>{r.label}</div>
                <div className="kinetic-sub" style={UI.rowSub}>
                  {subtitleFor(list.id, r)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <Button
                  variant="toggle"
                  active
                  onClick={e => {
                    e.stopPropagation();
                    load(r);
                  }}
                >
                  LOAD →
                </Button>
                {!readOnly && list.deleteType && (
                  <DeleteButton
                    label={`Delete ${r.label}`}
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
            </IOSListRow>
          ))
        )}
      </IOSListSection>
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
          value={selectedGymId}
          onChange={id => setSelectedGymId?.(id)}
          gyms={gyms}
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
