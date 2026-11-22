'use client';

// SIMPLE mode's effort question: after a working set is ticked, "How many more reps could you have done?" One tap
// answers (0 … 5, 6+) and saves it as the set's RIR — the same as entering its INTENSITY in ADVANCED, so it locks
// the intensity and feeds the set's 1RM, live adjustment, learned fatigue and the rep curve. SKIP leaves the set as
// planned. Closes only through its buttons.

import React from 'react';
import { UI, SHARED_GROUP_OUTER } from '../styles/kineticTokens';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { SegmentButton } from './Controls';

export const EFFORT_CHOICES = [0, 1, 2, 3, 4, 5, 6];

export function EffortPromptModal({ setLabel = '', exerciseName = '', reps = null, weightText = '', onAnswer, onSkip }) {
  useModalScrollLock(true);
  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 90 }}>
      <div role="dialog" aria-label={`Set ${setLabel} effort`} onClick={e => e.stopPropagation()} style={UI.modalCard('400px')}>
        <div style={UI.modalHeader}>
          <span>SET {setLabel} EFFORT</span>
          <button type="button" aria-label="Skip" onClick={onSkip} style={UI.closeXBtn}>
            ✕
          </button>
        </div>
        <div style={{ ...UI.sentence, color: '#BDBDBD' }}>
          {exerciseName}
          {weightText || reps ? ` · ${[weightText, reps ? `${reps} reps` : ''].filter(Boolean).join(' × ')}` : ''}
        </div>
        <div style={{ fontSize: '20px', fontWeight: 300, color: '#FFFFFF', margin: '14px 2px 4px', lineHeight: 1.3 }}>
          How many more reps could you have done?
        </div>
        <div style={{ ...UI.sentence, marginBottom: '12px' }}>0 = that was everything you had.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', ...SHARED_GROUP_OUTER }}>
          {EFFORT_CHOICES.map(v => (
            <SegmentButton
              key={v}
              active={false}
              onClick={() => onAnswer?.(v)}
              aria-label={v === 6 ? '6 or more' : `${v} more`}
              style={{ height: '52px', padding: 0, letterSpacing: 0, fontSize: '18px' }}
            >
              {v === 6 ? '6+' : v}
            </SegmentButton>
          ))}
        </div>
        <button type="button" className="kinetic-btn" onClick={onSkip} style={{ ...UI.secondaryBtnCenter, marginTop: '14px', width: '100%' }}>
          SKIP
        </button>
      </div>
    </div>
  );
}

export default EffortPromptModal;
