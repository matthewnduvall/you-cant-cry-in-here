'use client';

// The INTENSITY pop-up for a set (programs other than Crying): pick the scale (%1RM, RIR or RPE) and the value.
// Switching the scale converts the value for the set's reps (utils/intensity.js); the line under the values shows
// the same intensity in the other two scales. APPLY is the pop-up's one red.

import React, { useState } from 'react';
import { UI, SHARED_GROUP_OUTER } from '../styles/kineticTokens';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { ApplyToLaterToggle, SegmentButton } from './Controls';
import {
  INTENSITY_MODES,
  INTENSITY_OPTIONS,
  convertIntensity,
  formatIntensity,
  intensityEquivalents
} from '../utils/intensity';

const MODE_HELP = {
  pct: 'Percent of your calculated 1 rep max.',
  rir: 'Reps in reserve: how many more reps you could still do.',
  rpe: 'Rate of perceived exertion: 1 is easiest, 10 is as hard as possible.'
};

export function IntensityEditorModal({ title = 'INTENSITY', reps = 8, intensity = null, laterSets = [], onApply, onClose }) {
  // ALSO SETS n–m: write the value to the exercise's later sets too
  const [alsoLater, setAlsoLater] = useState(false);
  useModalScrollLock(true);
  const [draft, setDraft] = useState(() =>
    intensity && intensity.mode ? { mode: intensity.mode, value: intensity.value ?? null } : { mode: 'rir', value: null }
  );
  const hasValue = draft.value !== null && draft.value !== undefined && draft.value !== '';
  const switchMode = mode => {
    if (mode === draft.mode) return;
    setDraft({ mode, value: hasValue ? convertIntensity(draft, mode, reps) : null });
  };
  const options = INTENSITY_OPTIONS[draft.mode];

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 90 }} onClick={onClose}>
      <div role="dialog" aria-label={title} onClick={e => e.stopPropagation()} style={UI.modalCard('400px')}>
        <div style={UI.modalHeader}>
          <span>{title}</span>
          <button type="button" aria-label="Close" onClick={onClose} style={UI.closeXBtn}>
            ✕
          </button>
        </div>

        {/* Scale */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', ...SHARED_GROUP_OUTER }}>
          {INTENSITY_MODES.map(m => (
            <SegmentButton key={m.id} active={draft.mode === m.id} onClick={() => switchMode(m.id)} style={{ height: '44px' }}>
              {m.label}
            </SegmentButton>
          ))}
        </div>
        <div style={{ ...UI.sentence, marginTop: '8px' }}>{MODE_HELP[draft.mode]}</div>

        {/* Current value + the same in the other scales */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', margin: '14px 2px 10px' }}>
          <span style={{ fontSize: '34px', fontWeight: 300, color: '#FFFFFF', fontFamily: 'var(--cr-face-display)' }}>
            {hasValue ? formatIntensity(draft.mode, draft.value) : '—'}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A', textAlign: 'right' }}>
            {hasValue ? `≈ ${intensityEquivalents(draft, reps)}` : ''}
            <br />
            {`FOR ${reps} REP${Number(reps) === 1 ? '' : 'S'}`}
          </span>
        </div>

        {/* Values */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${draft.mode === 'pct' ? 5 : 6}, minmax(0, 1fr))`,
            ...SHARED_GROUP_OUTER,
            maxHeight: '220px',
            overflowY: 'auto'
          }}
        >
          {options.map(v => (
            <SegmentButton
              key={v}
              active={hasValue && Number(draft.value) === v}
              onClick={() => setDraft({ mode: draft.mode, value: v })}
              style={{ height: '44px', padding: 0, letterSpacing: 0 }}
            >
              {draft.mode === 'pct' ? `${v}%` : v}
            </SegmentButton>
          ))}
        </div>

        <ApplyToLaterToggle laterSets={laterSets} on={alsoLater} onToggle={() => setAlsoLater(v => !v)} style={{ marginTop: '4px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '14px' }}>
          <button type="button" className="kinetic-btn" onClick={onClose} style={UI.secondaryBtnCenter}>
            CANCEL
          </button>
          <button
            type="button"
            className="kinetic-btn"
            onClick={() => onApply?.({ mode: draft.mode, value: null }, alsoLater)}
            style={UI.secondaryBtnCenter}
          >
            CLEAR
          </button>
          <button
            type="button"
            className="kinetic-btn"
            onClick={() => onApply?.(hasValue ? draft : { mode: draft.mode, value: null }, alsoLater)}
            style={UI.primaryBtnCenter}
          >
            APPLY
          </button>
        </div>
      </div>
    </div>
  );
}

export default IntensityEditorModal;
