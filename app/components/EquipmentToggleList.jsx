'use client';

// ============================================================================
// Configuration → EQUIPMENT list (also the saved-setup editor's AVAILABLE EQUIPMENT)
// One ON/OFF row per GYM_EQUIPMENT_OPTIONS item. The list drives the defaults when exercises are picked
// for them (+ ADD EXERCISE, AUTO SESSION, changing an exercise's type or muscle group); the per-exercise
// filters and search always show the whole library.
// ============================================================================

import React from 'react';
import { GYM_EQUIPMENT_OPTIONS } from '../data/exerciseLibrary';
import { UI } from '../styles/kineticTokens';
import { IOSListSection, IOSListRow } from './Primitives';

export const EQUIPMENT_SETTINGS_FOOTER =
  'Exercises picked for you (+ ADD EXERCISE, AUTO SESSION) only use equipment that is ON. Bodyweight exercises always count. Searching and the per-exercise filters still show every exercise.';

export function EquipmentToggleList({
  colors,
  value,
  onChange,
  header = 'EQUIPMENT',
  footer = EQUIPMENT_SETTINGS_FOOTER,
  // Optional style override for the surrounding section
  sectionStyle
}) {
  const selected = new Set(Array.isArray(value) ? value : GYM_EQUIPMENT_OPTIONS);
  const toggle = item => {
    const next = new Set(selected);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    // Keep the library order so the stored list is stable
    onChange?.(GYM_EQUIPMENT_OPTIONS.filter(option => next.has(option)));
  };
  const allOn = GYM_EQUIPMENT_OPTIONS.every(option => selected.has(option));

  return (
    <IOSListSection header={header} footer={footer} colors={colors} style={sectionStyle}>
      <IOSListRow colors={colors} onClick={() => onChange?.(allOn ? [] : [...GYM_EQUIPMENT_OPTIONS])}>
        <span style={{ ...UI.rowTitle, color: 'var(--dp-color-accent)' }}>{allOn ? 'Turn all off' : 'Turn all on'}</span>
        <span style={UI.badge(allOn)}>
          {selected.size}/{GYM_EQUIPMENT_OPTIONS.length}
        </span>
      </IOSListRow>
      {GYM_EQUIPMENT_OPTIONS.map((item, idx) => {
        const on = selected.has(item);
        return (
          <IOSListRow
            key={item}
            colors={colors}
            isLast={idx === GYM_EQUIPMENT_OPTIONS.length - 1}
            onClick={() => toggle(item)}
          >
            <span role="switch" aria-checked={on} style={UI.rowTitle}>
              {item}
            </span>
            <span className={on ? 'cr-answer-on' : undefined} style={UI.badge(on)}>{on ? 'ON' : 'OFF'}</span>
          </IOSListRow>
        );
      })}
    </IOSListSection>
  );
}

export default EquipmentToggleList;
