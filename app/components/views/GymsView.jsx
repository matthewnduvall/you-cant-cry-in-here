'use client';

import React from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  DEFAULT_GYM_EQUIPMENT_PRESETS,
  GYM_EQUIPMENT_OPTIONS
} from '../../data/exerciseLibrary';

const GYM_STATUS_BTN_STYLE = isSelected => ({
  ...UI.badge(isSelected),
  width: '82px',
  height: '30px',
  padding: 0,
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  fontSize: '10px',
  fontWeight: 800,
  flexShrink: 0
});

export function GymsView({
  colors,
  gyms,
  setGyms,
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
              <span style={GYM_STATUS_BTN_STYLE(isSelected)}>
                {isSelected ? 'ACTIVE ✓' : 'SELECT'}
              </span>
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
          gyms.map((g, i) => {
            const isSelected = selectedGymId === g.id;
            return (
              <IOSListRow
                key={g.id}
                isLast={i === gyms.length - 1}
                colors={colors}
                onClick={() => setSelectedGymId(g.id)}
              >
                <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                  <div style={UI.rowTitle}>{g.name}</div>
                  <div className="kinetic-sub" style={UI.rowSub}>
                    {(g.equipment || []).length} EQUIPMENT ITEMS AVAILABLE
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setGymDraft({ ...g, isNew: false });
                      setCurrentView('gym_editor');
                    }}
                    className="kinetic-btn"
                    style={{
                      height: '30px',
                      padding: '0 10px',
                      boxSizing: 'border-box',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#1C1C1E',
                      color: '#FFFFFF',
                      border: '2px solid var(--dp-color-rule)',
                      fontSize: '10px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer'
                    }}
                  >
                    EDIT
                  </button>

                  <span style={GYM_STATUS_BTN_STYLE(isSelected)}>
                    {isSelected ? 'ACTIVE ✓' : 'SELECT'}
                  </span>

                  <button
                    type="button"
                    aria-label={`Delete ${g.name}`}
                    onClick={e => {
                      e.stopPropagation();
                      setGyms?.(prev => prev.filter(item => item.id !== g.id));
                      if (selectedGymId === g.id) {
                        setSelectedGymId('');
                      }
                    }}
                    className="kinetic-btn"
                    style={{
                      ...UI.deleteXBtn,
                      width: '30px',
                      height: '30px',
                      fontSize: '12px',
                      boxSizing: 'border-box'
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
      <div style={UI.gutterBottom}>
        <button
          type="button"
          onClick={() => setCurrentView('gyms')}
          className="kinetic-btn"
          style={UI.secondaryBtnCenter}
        >
          ← BACK
        </button>
      </div>

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
