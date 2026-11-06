'use client';

import React from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  DEFAULT_ROUTINES,
  DEFAULT_GYM_EQUIPMENT_PRESETS,
  getGymSelectionLabel,
  getRoutineGymCategory,
  doesRoutineMatchGymFilter
} from '../../data/exerciseLibrary';

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
  setDeleteConfirmTarget
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
          gridTemplateColumns: '1fr 1fr',
          gap: 0,
          borderTop: '1px solid var(--dp-color-rule)',
          borderLeft: '1px solid var(--dp-color-rule)'
        }}
      >
        {/* GYMS/EQUIPMENT DROPDOWN AT TOP OF ROUTINES SELECTION */}
        <div
          style={{
            width: '100%',
            height: '48px',
            boxSizing: 'border-box',
            position: 'relative',
            backgroundColor: '#161618',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: '1px solid var(--dp-color-rule)',
            borderBottom: '1px solid var(--dp-color-rule)',
            padding: '0 8px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            minWidth: 0
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 800,
              color: 'var(--dp-color-accent)',
              textTransform: 'uppercase',
              lineHeight: 1.15
            }}
          >
            GYMS/EQUIPMENT ▾
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 800,
              color: '#FFFFFF',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: '100%',
              lineHeight: 1.25,
              marginTop: '1px',
              textAlign: 'center'
            }}
          >
            {getGymSelectionLabel(selectedGymId, gyms)}
          </div>
          <select
            aria-label="Filter Routines by Gyms/Equipment"
            value={selectedGymId || ''}
            onChange={e => setSelectedGymId?.(e.target.value)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              backgroundColor: '#101010',
              color: '#FFFFFF',
              cursor: 'pointer'
            }}
          >
            {DEFAULT_GYM_EQUIPMENT_PRESETS.map(preset => (
              <option key={preset.id || 'full_gym'} value={preset.id}>
                {preset.name.toUpperCase()}
              </option>
            ))}
            {(gyms || []).map(g => (
              <option key={g.id} value={g.id}>
                {g.name.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => handleCancelRoutineSelection?.()}
          className="kinetic-btn"
          style={{
            ...UI.secondaryBtnCenter,
            width: '100%',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 14px',
            fontSize: '12px',
            backgroundColor: '#3B1818',
            color: '#FF8585',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: '1px solid var(--dp-color-rule)',
            borderBottom: '1px solid var(--dp-color-rule)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <span>CANCEL</span>
        </button>
      </div>

      <IOSListSection header={`DEFAULT ROUTINES (${filteredDefaultRoutines.length})`} colors={colors}>
        {filteredDefaultRoutines.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={UI.rowSub}>No default routines match this gym/equipment filter.</span>
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
                  <div className="kinetic-sub" style={UI.rowSub}>GYM: {gymCat}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleDirectLoadRoutine(r, routineSelectReturnView || 'session');
                    }}
                    className="kinetic-btn"
                    style={UI.pillBtn(true)}
                  >
                    LOAD →
                  </button>
                </div>
              </IOSListRow>
            );
          })
        )}
      </IOSListSection>

      <IOSListSection header={`SAVED ROUTINES (${filteredSavedRoutines.length})`} colors={colors}>
        {filteredSavedRoutines.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={UI.rowSub}>No saved routines match this gym/equipment filter.</span>
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
                  <div className="kinetic-sub" style={UI.rowSub}>BY @{authorHandle} • GYM: {gymCat}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleDirectLoadRoutine(r, routineSelectReturnView || 'session');
                    }}
                    className="kinetic-btn"
                    style={UI.pillBtn(true)}
                  >
                    LOAD →
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${r.label}`}
                    onClick={e => {
                      e.stopPropagation();
                      setDeleteConfirmTarget?.({
                        type: 'saved_routine',
                        routineKey: r.key,
                        routineLabel: r.label,
                        label: r.label
                      });
                    }}
                    className="kinetic-btn"
                    style={{
                      ...UI.deleteXBtn,
                      width: '32px',
                      height: '30px',
                      fontSize: '12px'
                    }}
                  >
                    ✕
                  </button>
                </div>
              </IOSListRow>
            );
          })
        )}
      </IOSListSection>

      <IOSListSection header={`SHARED ROUTINES (${filteredSharedRoutines.length})`} colors={colors}>
        {filteredSharedRoutines.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={UI.rowSub}>No shared routines match this gym/equipment filter.</span>
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
                  <div className="kinetic-sub" style={UI.rowSub}>BY @{authorHandle} • GYM: {gymCat}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleDirectLoadRoutine(r, routineSelectReturnView || 'session');
                    }}
                    className="kinetic-btn"
                    style={UI.pillBtn(true)}
                  >
                    LOAD →
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${r.label}`}
                    onClick={e => {
                      e.stopPropagation();
                      setDeleteConfirmTarget?.({
                        type: 'shared_routine',
                        routineKey: r.key,
                        routineLabel: r.label,
                        label: r.label
                      });
                    }}
                    className="kinetic-btn"
                    style={{
                      ...UI.deleteXBtn,
                      width: '32px',
                      height: '30px',
                      fontSize: '12px'
                    }}
                  >
                    ✕
                  </button>
                </div>
              </IOSListRow>
            );
          })
        )}
      </IOSListSection>

      <IOSListSection header={`FRIENDS' ROUTINES (${filteredFriendRoutines.length})`} colors={colors}>
        {filteredFriendRoutines.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={UI.rowSub}>No friend routines match this gym/equipment filter.</span>
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
                  <div className="kinetic-sub" style={UI.rowSub}>BY @{r.friendName} • GYM: {gymCat}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleDirectLoadRoutine(r, routineSelectReturnView || 'session');
                    }}
                    className="kinetic-btn"
                    style={UI.pillBtn(true)}
                  >
                    LOAD →
                  </button>
                </div>
              </IOSListRow>
            );
          })
        )}
      </IOSListSection>
    </div>
  );
}

