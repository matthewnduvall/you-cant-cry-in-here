'use client';

import React from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import { GYM_EQUIPMENT_OPTIONS } from '../../data/exerciseLibrary';
import { Button, DeleteButton } from '../Controls';
import { EquipmentToggleList } from '../EquipmentToggleList';

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
  fontSize: '11px',
  fontWeight: 800,
  flexShrink: 0
});

// Saved setup is "active" when its equipment is exactly what is ON in the list above it
const sameEquipment = (a = [], b = []) => {
  const setA = new Set(a);
  return setA.size === new Set(b).size && [...setA].every(item => b.includes(item));
};

/**
 * EQUIPMENT page (view id 'gyms'): the athlete's equipment ON/OFF list (`availableEquipment`, the same
 * GYM_EQUIPMENT_OPTIONS list as the setup editor) and their saved equipment setups. Tapping a saved
 * setup turns exactly its equipment on.
 */
export function GymsView({
  colors,
  gyms,
  setGyms,
  selectedGymId,
  setSelectedGymId,
  availableEquipment,
  setAvailableEquipment,
  setGymDraft,
  setCurrentView
}) {
  const currentEquipment = Array.isArray(availableEquipment) ? availableEquipment : GYM_EQUIPMENT_OPTIONS;
  return (
    <div style={UI.pagePad}>
      <EquipmentToggleList colors={colors} value={availableEquipment} onChange={setAvailableEquipment} />

      <IOSListSection header="SAVED SETUPS" colors={colors}>
        {gyms.length === 0 ? (
          <IOSListRow colors={colors}>
            <span style={UI.rowSub}>No saved setups yet.</span>
          </IOSListRow>
        ) : (
          gyms.map(g => {
            const isActive = sameEquipment(g.equipment || [], currentEquipment);
            return (
              <IOSListRow
                key={g.id}
                colors={colors}
                onClick={() => setAvailableEquipment?.(GYM_EQUIPMENT_OPTIONS.filter(eq => (g.equipment || []).includes(eq)))}
              >
                <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                  <div style={UI.rowTitle}>{g.name}</div>
                  <div className="kinetic-sub" style={UI.rowSub}>
                    {(g.equipment || []).length} OF {GYM_EQUIPMENT_OPTIONS.length} ON
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
                      fontSize: '11px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer'
                    }}
                  >
                    EDIT
                  </button>

                  <span style={GYM_STATUS_BTN_STYLE(isActive)}>{isActive ? 'ACTIVE ✓' : 'USE'}</span>

                  <DeleteButton
                    label={`Delete ${g.name}`}
                    onClick={e => {
                      e?.stopPropagation?.();
                      setGyms?.(prev => prev.filter(item => item.id !== g.id));
                      if (selectedGymId === g.id) setSelectedGymId?.('');
                    }}
                  />
                </div>
              </IOSListRow>
            );
          })
        )}
        <IOSListRow
          isLast={true}
          colors={colors}
          onClick={() => {
            // A new setup starts from what is ON now
            setGymDraft({
              id: `gym_${Date.now()}`,
              name: 'New Equipment Setup',
              equipment: [...currentEquipment],
              isNew: true
            });
            setCurrentView('gym_editor');
          }}
        >
          <span style={{ ...UI.rowTitle, color: 'var(--dp-color-accent)' }}>+ SAVE A NEW SETUP</span>
          <span style={{ ...UI.rowTitle, color: 'var(--dp-color-accent)' }}>→</span>
        </IOSListRow>
      </IOSListSection>
    </div>
  );
}

export function GymEditorView({
  colors,
  gymDraft,
  setGymDraft,
  setGyms,
  setAvailableEquipment,
  setCurrentView
}) {
  if (!gymDraft) return null;

  return (
    <div style={UI.pagePad}>
      <div style={UI.gutterBottom}>
        <Button variant="secondary" onClick={() => setCurrentView('gyms')}>
          ← BACK
        </Button>
      </div>

      <IOSListSection header="SETUP" colors={colors}>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>SETUP NAME</div>
            <input
              type="text"
              value={gymDraft.name}
              onChange={e => setGymDraft(prev => ({ ...prev, name: e.target.value }))}
              style={{ ...UI.textInputBare, fontSize: '18px', textTransform: 'uppercase', marginTop: '4px' }}
            />
          </div>
        </IOSListRow>
      </IOSListSection>

      {/* Same component as the EQUIPMENT page list (TURN ALL ON/OFF + one ON/OFF row per item) */}
      <EquipmentToggleList
        colors={colors}
        header="AVAILABLE EQUIPMENT"
        footer={null}
        value={gymDraft.equipment}
        onChange={equipment => setGymDraft(prev => ({ ...prev, equipment }))}
      />

      <div style={UI.gutterWrap}>
        <Button
          variant="primary"
          onClick={() => {
            setGyms(prev => {
              const exists = prev.some(g => g.id === gymDraft.id);
              return exists ? prev.map(g => (g.id === gymDraft.id ? gymDraft : g)) : [...prev, gymDraft];
            });
            // Saving a setup also makes it the active equipment
            setAvailableEquipment?.(GYM_EQUIPMENT_OPTIONS.filter(eq => gymDraft.equipment.includes(eq)));
            setCurrentView('gyms');
          }}
        >
          SAVE SETUP
        </Button>
      </div>
    </div>
  );
}
