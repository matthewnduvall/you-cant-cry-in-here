'use client';

import React from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  DEFAULT_ROUTINES,
  DEFAULT_GYM_EQUIPMENT_PRESETS,
  GYM_EQUIPMENT_OPTIONS
} from '../../data/exerciseLibrary';

// ============================================================================
// VIEWS: ROUTINES, GYMS/EQUIPMENT & GYM EDITOR
// ============================================================================

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

export function GymsView({
  colors,
  gyms,
  selectedGymId,
  setSelectedGymId,
  setGymDraft,
  setCurrentView
}) {
  return (
    <div style={UI.pagePad}>
      <div style={UI.gutterBottom}>
        <button
          type="button"
          onClick={() => {
            setGymDraft({
              id: `gym_${Date.now()}`,
              name: 'New Gyms/Equipment Setup',
              equipment: ['Barbell', 'Dumbbell', 'Flat / Incline Bench', 'Weight Plates'],
              isNew: true
            });
            setCurrentView('gym_editor');
          }}
          className="kinetic-btn"
          style={UI.primaryBtn}
        >
          <span>+ CREATE GYMS/EQUIPMENT</span>
          <span>→</span>
        </button>
      </div>

      <IOSListSection
        header="DEFAULT GYMS/EQUIPMENT PRESETS"
        footer="Tap any preset to set it as your active Gyms/Equipment filter for Exercises and Auto."
        colors={colors}
      >
        {DEFAULT_GYM_EQUIPMENT_PRESETS.map((preset, i) => {
          const isSelected = (selectedGymId || '') === preset.id;
          return (
            <IOSListRow
              key={preset.id || 'full_gym'}
              isLast={i === DEFAULT_GYM_EQUIPMENT_PRESETS.length - 1}
              colors={colors}
              onClick={() => setSelectedGymId(preset.id)}
            >
              <div>
                <div style={UI.rowTitle}>{preset.name}</div>
                <div className="kinetic-sub" style={UI.rowSub}>
                  {preset.id === 'preset_barbells_only'
                    ? 'FILTERS BARBELL EXERCISES ONLY'
                    : preset.id === 'preset_dumbbells_only'
                      ? 'FILTERS DUMBELL EXERCISES ONLY'
                      : preset.id === 'preset_bodyweight_only'
                        ? 'FILTERS BODYWEIGHT EXERCISES ONLY'
                        : 'ALL EXERCISES & EQUIPMENT ENABLED'}
                </div>
              </div>
              <span style={UI.badge(isSelected)}>{isSelected ? 'ACTIVE ✓' : 'SELECT'}</span>
            </IOSListRow>
          );
        })}
      </IOSListSection>

      <IOSListSection header="SAVED GYMS/EQUIPMENT" colors={colors}>
        {gyms.length === 0 ? (
          <IOSListRow isLast={true} colors={colors}>
            <span style={UI.rowSub}>No custom Gyms/Equipment profiles saved yet.</span>
          </IOSListRow>
        ) : (
          gyms.map((g, i) => (
            <IOSListRow
              key={g.id}
              isLast={i === gyms.length - 1}
              colors={colors}
              onClick={() => {
                setGymDraft({ ...g, isNew: false });
                setCurrentView('gym_editor');
              }}
            >
              <div>
                <div style={UI.rowTitle}>{g.name}</div>
                <div className="kinetic-sub" style={UI.rowSub}>
                  {g.equipment.length} EQUIPMENT ITEMS AVAILABLE
                </div>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>
                EDIT →
              </span>
            </IOSListRow>
          ))
        )}
      </IOSListSection>
    </div>
  );
}

export function GymEditorView({
  colors,
  gymDraft,
  setGymDraft,
  setGyms,
  setSelectedGymId,
  setCurrentView
}) {
  if (!gymDraft) return null;

  return (
    <div style={UI.pagePad}>
      <IOSListSection header="GYMS/EQUIPMENT PROFILE" colors={colors}>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>GYMS/EQUIPMENT NAME</div>
            <input
              type="text"
              value={gymDraft.name}
              onChange={e => setGymDraft(prev => ({ ...prev, name: e.target.value }))}
              style={{ ...UI.textInputBare, fontSize: '18px', textTransform: 'uppercase', marginTop: '4px' }}
            />
          </div>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="AVAILABLE EQUIPMENT" colors={colors}>
        {GYM_EQUIPMENT_OPTIONS.map((eq, i) => {
          const hasEq = gymDraft.equipment.includes(eq);
          return (
            <IOSListRow
              key={eq}
              isLast={i === GYM_EQUIPMENT_OPTIONS.length - 1}
              colors={colors}
              onClick={() => {
                setGymDraft(prev => ({
                  ...prev,
                  equipment: hasEq ? prev.equipment.filter(x => x !== eq) : [...prev.equipment, eq]
                }));
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase' }}>{eq}</span>
              <span style={UI.badge(hasEq)}>{hasEq ? 'INCLUDED ✓' : 'OFF'}</span>
            </IOSListRow>
          );
        })}
      </IOSListSection>

      <div style={UI.gutterWrap}>
        <button
          type="button"
          onClick={() => {
            setGyms(prev => {
              const exists = prev.some(g => g.id === gymDraft.id);
              return exists ? prev.map(g => (g.id === gymDraft.id ? gymDraft : g)) : [...prev, gymDraft];
            });
            setSelectedGymId(gymDraft.id);
            setCurrentView('gyms');
          }}
          className="kinetic-btn"
          style={UI.primaryBtnCenter}
        >
          SAVE GYMS/EQUIPMENT SETUP
        </button>
      </div>
    </div>
  );
}

