'use client';

import React from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import { DEFAULT_ROUTINES } from '../../data/exerciseLibrary';

export function RoutinesView({
  colors,
  savedRoutines,
  sharedRoutines,
  friendsList,
  routineSelectReturnView,
  handleDirectLoadRoutine,
  handleCancelRoutineSelection
}) {
  const friendRoutines = friendsList.flatMap(f =>
    (f.sharedRoutines || []).map(r => ({ ...r, friendName: f.username }))
  );

  return (
    <div style={UI.pagePad}>
      <div style={UI.gutterBottom}>
        <button
          type="button"
          onClick={() => handleCancelRoutineSelection?.()}
          className="kinetic-btn"
          style={{
            ...UI.secondaryBtnCenter,
            width: '100%',
            padding: '12px 14px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <span>CANCEL</span>
        </button>
      </div>

      <IOSListSection header="DEFAULT ROUTINES" colors={colors}>
        {DEFAULT_ROUTINES.map((r, i) => (
          <IOSListRow
            key={r.key}
            isLast={i === DEFAULT_ROUTINES.length - 1}
            colors={colors}
            onClick={() => handleDirectLoadRoutine(r, routineSelectReturnView || 'session')}
          >
            <span style={UI.rowTitle}>{r.label}</span>
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
        ))}
      </IOSListSection>

      <IOSListSection header={`SAVED ROUTINES (${savedRoutines.length})`} colors={colors}>
        {savedRoutines.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={UI.rowSub}>No custom routines saved yet.</span>
          </IOSListRow>
        ) : (
          savedRoutines.map((r, i) => (
            <IOSListRow
              key={r.key}
              isLast={i === savedRoutines.length - 1}
              colors={colors}
              onClick={() => handleDirectLoadRoutine(r, routineSelectReturnView || 'session')}
            >
              <div>
                <div style={UI.rowTitle}>{r.label}</div>
                <div className="kinetic-sub" style={UI.rowSub}>{(r.slots || []).length} EXERCISES</div>
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
          ))
        )}
      </IOSListSection>

      <IOSListSection header={`SHARED ROUTINES (${sharedRoutines.length})`} colors={colors}>
        {sharedRoutines.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={UI.rowSub}>No routines shared yet. Tap SHARE in a workout session.</span>
          </IOSListRow>
        ) : (
          sharedRoutines.map((r, i) => (
            <IOSListRow
              key={r.key}
              isLast={i === sharedRoutines.length - 1}
              colors={colors}
              onClick={() => handleDirectLoadRoutine(r, routineSelectReturnView || 'session')}
            >
              <span style={UI.rowTitle}>{r.label}</span>
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
          ))
        )}
      </IOSListSection>

      <IOSListSection header="FRIENDS' ROUTINES" colors={colors}>
        {friendRoutines.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={UI.rowSub}>Add friends in Social to browse their shared routines.</span>
          </IOSListRow>
        ) : (
          friendRoutines.map((r, i, arr) => (
            <IOSListRow
              key={`${r.key}_${i}`}
              isLast={i === arr.length - 1}
              colors={colors}
              onClick={() => handleDirectLoadRoutine(r, routineSelectReturnView || 'session')}
            >
              <div>
                <div style={UI.rowTitle}>{r.label}</div>
                <div className="kinetic-sub" style={UI.rowSub}>BY @{r.friendName}</div>
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
          ))
        )}
      </IOSListSection>
    </div>
  );
}

