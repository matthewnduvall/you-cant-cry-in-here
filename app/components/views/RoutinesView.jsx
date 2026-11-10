'use client';

import React from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  DEFAULT_ROUTINES,
  getRoutineGymCategory,
  doesRoutineMatchGymFilter
} from '../../data/exerciseLibrary';
import { Button, DeleteButton, GymSelect } from '../Controls';

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
  // The Configuration page's ROUTINE tab has nothing to cancel back to
  showCancel = true,
  // Which lists to show (a friend's profile shows only the routines they share)
  sections = ['default', 'saved', 'shared', 'friends'],
  // A friend's routines: LOAD only, no delete
  readOnly = false
}) {
  const friendRoutines = (friendsList || []).flatMap(f =>
    (f.sharedRoutines || []).map(r => ({ ...r, friendName: f.username }))
  );
  const fallbackAuthor = (user?.username || 'athlete').replace(/^@/, '');

  const filteredDefaultRoutines = DEFAULT_ROUTINES.filter(r =>
    doesRoutineMatchGymFilter(r, selectedGymId, gyms)
  );
  const filteredSavedRoutines = (savedRoutines || []).filter(r =>
    doesRoutineMatchGymFilter(r, selectedGymId, gyms)
  );
  const filteredSharedRoutines = (sharedRoutines || []).filter(r =>
    doesRoutineMatchGymFilter(r, selectedGymId, gyms)
  );
  const filteredFriendRoutines = friendRoutines.filter(r =>
    doesRoutineMatchGymFilter(r, selectedGymId, gyms)
  );

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
          ariaLabel="Filter routines by equipment"
          value={selectedGymId}
          onChange={id => setSelectedGymId?.(id)}
          gyms={gyms}
        />

        {showCancel && (
        <Button
          variant="secondary"
          onClick={() => handleCancelRoutineSelection?.()}
          style={{ width: '100%', height: '48px', boxSizing: 'border-box', padding: '0 14px', fontSize: '12px', backgroundColor: '#3B1818', color: '#FF8585', borderTop: 'none', borderLeft: 'none', borderRight: '1px solid var(--dp-color-rule)', borderBottom: '1px solid var(--dp-color-rule)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <span>CANCEL</span>
        </Button>
        )}
      </div>

      {sections.includes('default') && (
      <IOSListSection header={`DEFAULT ROUTINES (${filteredDefaultRoutines.length})`} colors={colors}>
        {filteredDefaultRoutines.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={UI.rowSub}>No default routines match this equipment filter.</span>
          </IOSListRow>
        ) : (
          filteredDefaultRoutines.map((r, i) => {
            const gymCat = getRoutineGymCategory(r).toUpperCase();
            return (
              <IOSListRow
                key={r.key}
                isLast={i === filteredDefaultRoutines.length - 1}
                colors={colors}
                onClick={() => handleDirectLoadRoutine(r, routineSelectReturnView || 'session')}
              >
                <div>
                  <div style={UI.rowTitle}>{r.label}</div>
                  <div className="kinetic-sub" style={UI.rowSub}>EQUIPMENT: {gymCat}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <Button
                    variant="toggle"
                    active
                    onClick={e => {
                      e.stopPropagation();
                      handleDirectLoadRoutine(r, routineSelectReturnView || 'session');
                    }}
                  >
                    LOAD →
                  </Button>
                </div>
              </IOSListRow>
            );
          })
        )}
      </IOSListSection>
      )}

      {sections.includes('saved') && (
      <IOSListSection header={`SAVED ROUTINES (${filteredSavedRoutines.length})`} colors={colors}>
        {filteredSavedRoutines.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={UI.rowSub}>No saved routines match this equipment filter.</span>
          </IOSListRow>
        ) : (
          filteredSavedRoutines.map((r, i) => {
            const authorHandle = (r.author || fallbackAuthor).replace(/^@/, '');
            const gymCat = getRoutineGymCategory(r).toUpperCase();
            return (
              <IOSListRow
                key={r.key}
                isLast={i === filteredSavedRoutines.length - 1}
                colors={colors}
                onClick={() => handleDirectLoadRoutine(r, routineSelectReturnView || 'session')}
              >
                <div>
                  <div style={UI.rowTitle}>{r.label}</div>
                  <div className="kinetic-sub" style={UI.rowSub}>BY @{authorHandle} • EQUIPMENT: {gymCat}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <Button
                    variant="toggle"
                    active
                    onClick={e => {
                      e.stopPropagation();
                      handleDirectLoadRoutine(r, routineSelectReturnView || 'session');
                    }}
                  >
                    LOAD →
                  </Button>
                  {!readOnly && <DeleteButton
                    label={`Delete ${r.label}`}
                    onClick={() =>
                      setDeleteConfirmTarget?.({
                        type: 'saved_routine',
                        routineKey: r.key,
                        routineLabel: r.label,
                        label: r.label
                      })
                    }
                  />}
                </div>
              </IOSListRow>
            );
          })
        )}
      </IOSListSection>
      )}

      {sections.includes('shared') && (
      <IOSListSection header={`SHARED ROUTINES (${filteredSharedRoutines.length})`} colors={colors}>
        {filteredSharedRoutines.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={UI.rowSub}>No shared routines match this equipment filter.</span>
          </IOSListRow>
        ) : (
          filteredSharedRoutines.map((r, i) => {
            const authorHandle = (r.author || fallbackAuthor).replace(/^@/, '');
            const gymCat = getRoutineGymCategory(r).toUpperCase();
            return (
              <IOSListRow
                key={r.key}
                isLast={i === filteredSharedRoutines.length - 1}
                colors={colors}
                onClick={() => handleDirectLoadRoutine(r, routineSelectReturnView || 'session')}
              >
                <div>
                  <div style={UI.rowTitle}>{r.label}</div>
                  <div className="kinetic-sub" style={UI.rowSub}>BY @{authorHandle} • EQUIPMENT: {gymCat}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <Button
                    variant="toggle"
                    active
                    onClick={e => {
                      e.stopPropagation();
                      handleDirectLoadRoutine(r, routineSelectReturnView || 'session');
                    }}
                  >
                    LOAD →
                  </Button>
                  {!readOnly && <DeleteButton
                    label={`Delete ${r.label}`}
                    onClick={() =>
                      setDeleteConfirmTarget?.({
                        type: 'shared_routine',
                        routineKey: r.key,
                        routineLabel: r.label,
                        label: r.label
                      })
                    }
                  />}
                </div>
              </IOSListRow>
            );
          })
        )}
      </IOSListSection>
      )}

      {sections.includes('friends') && (
      <IOSListSection header={`FRIENDS' ROUTINES (${filteredFriendRoutines.length})`} colors={colors}>
        {filteredFriendRoutines.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={UI.rowSub}>No friend routines match this equipment filter.</span>
          </IOSListRow>
        ) : (
          filteredFriendRoutines.map((r, i, arr) => {
            const gymCat = getRoutineGymCategory(r).toUpperCase();
            return (
              <IOSListRow
                key={`${r.key}_${i}`}
                isLast={i === arr.length - 1}
                colors={colors}
                onClick={() => handleDirectLoadRoutine(r, routineSelectReturnView || 'session')}
              >
                <div>
                  <div style={UI.rowTitle}>{r.label}</div>
                  <div className="kinetic-sub" style={UI.rowSub}>BY @{r.friendName} • EQUIPMENT: {gymCat}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <Button
                    variant="toggle"
                    active
                    onClick={e => {
                      e.stopPropagation();
                      handleDirectLoadRoutine(r, routineSelectReturnView || 'session');
                    }}
                  >
                    LOAD →
                  </Button>
                </div>
              </IOSListRow>
            );
          })
        )}
      </IOSListSection>
      )}
    </div>
  );
}

