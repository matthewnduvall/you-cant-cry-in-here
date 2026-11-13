'use client';

// The SCHEME pop-up for an exercise (the scheme button at the left of its bottom row): pick a scheme, then — for the
// sets × reps schemes — the number of sets and the reps. Picking a scheme starts from its own sets and reps; changing
// either makes a custom shape (the button then reads e.g. "6 × 10"). Pyramids have no SETS / REPS; Timer has no
// REPS. A superset edits A and B in turn (their sets are shared). Under a program (Society) a note says the scheme
// comes from its week; another one is kept, with the week's intensity and weights. APPLY is the pop-up's one red.

import React, { useState } from 'react';
import { UI, SHARED_GROUP_OUTER } from '../styles/kineticTokens';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { SegmentButton } from './Controls';
import { SCHEME_OPTIONS, isClusterScheme, getSchemeUniformReps, PYRAMID_SCHEMES } from '../utils/workoutEngine';

const SET_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];
const REP_CHOICES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25];

/** Sets a scheme starts with ("5x8" → 5; Cluster → 3; supersets always 3); null = the scheme sets it. */
export const schemeDefaultSets = (scheme, isSuperset = false) => {
  if (isSuperset) return 3;
  if (isClusterScheme(scheme)) return 3;
  const match = /^(\d+)x/.exec(String(scheme || ''));
  if (match) return Number(match[1]);
  return scheme === 'Timer' ? 5 : null;
};

/** What the scheme button shows: "5 × 8" for sets × reps schemes, else the scheme's name. */
export const schemeButtonLabel = (scheme, sets, reps) => {
  if (PYRAMID_SCHEMES.includes(scheme) || scheme === 'Timer' || isClusterScheme(scheme)) {
    return String(scheme).toUpperCase();
  }
  return `${sets} × ${reps || getSchemeUniformReps(scheme) || ''}`.trim();
};

const showsSets = scheme => !PYRAMID_SCHEMES.includes(scheme);
const showsReps = scheme => !PYRAMID_SCHEMES.includes(scheme) && scheme !== 'Timer';

/**
 * halves: [{ name, scheme, sets, reps }] (one, or A and B for a superset)
 * programNote: e.g. 'Society · Week 3' when the program sets this exercise's scheme (null otherwise)
 * onApply(changesByHalf): [{ half, scheme?, setCount?, targetReps? }] — only what changed
 */
export function SchemeEditorModal({ halves = [], isSuperset = false, programNote = null, onApply, onClose }) {
  const [half, setHalf] = useState(0);
  useModalScrollLock(true);
  const [drafts, setDrafts] = useState(() => halves.map(h => ({ scheme: h.scheme, sets: h.sets, reps: h.reps })));
  const draft = drafts[half] || drafts[0];
  const update = patch => setDrafts(prev => prev.map((d, i) => (i === half ? { ...d, ...patch } : d)));
  const pickScheme = scheme => {
    if (scheme === draft.scheme) return;
    // A new scheme starts from its own sets and reps
    update({
      scheme,
      sets: schemeDefaultSets(scheme, isSuperset) ?? draft.sets,
      reps: getSchemeUniformReps(scheme) || draft.reps
    });
  };
  const options = SCHEME_OPTIONS.filter(scm => !isSuperset || !isClusterScheme(scm));

  const apply = () => {
    const changes = [];
    drafts.forEach((d, i) => {
      const orig = halves[i];
      const c = { half: i };
      if (d.scheme !== orig.scheme) c.scheme = d.scheme;
      // A new scheme rebuilds the sets: compare against what that scheme gives, else against what was there
      const baseSets = c.scheme ? schemeDefaultSets(d.scheme, isSuperset) : orig.sets;
      const baseReps = c.scheme ? getSchemeUniformReps(d.scheme) : orig.reps;
      if (showsSets(d.scheme) && Number(d.sets) > 0 && Number(d.sets) !== Number(baseSets)) c.setCount = Number(d.sets);
      if (showsReps(d.scheme) && Number(d.reps) > 0 && Number(d.reps) !== Number(baseReps)) c.targetReps = Number(d.reps);
      if (Object.keys(c).length > 1) changes.push(c);
    });
    onApply?.(changes);
  };

  const pillGrid = (values, current, onPick, cols, format = v => v) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, ...SHARED_GROUP_OUTER }}>
      {values.map(v => (
        <SegmentButton
          key={v}
          active={String(current) === String(v)}
          onClick={() => onPick(v)}
          style={{ height: '44px', padding: 0, letterSpacing: 0 }}
        >
          {format(v)}
        </SegmentButton>
      ))}
    </div>
  );

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 90 }} onClick={onClose}>
      <div role="dialog" aria-label="Scheme" onClick={e => e.stopPropagation()} style={UI.modalCard('420px')}>
        <div style={UI.modalHeader}>
          <span>SCHEME</span>
          <button type="button" aria-label="Close" onClick={onClose} style={UI.closeXBtn}>
            ✕
          </button>
        </div>

        {/* Superset: A / B (each has its own scheme; the sets are shared) */}
        {isSuperset ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ...SHARED_GROUP_OUTER, marginBottom: '10px' }}>
            {halves.map((h, i) => (
              <SegmentButton key={i} active={half === i} onClick={() => setHalf(i)} style={{ height: '44px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {`${i === 0 ? 'A' : 'B'}: ${h.name}`}
              </SegmentButton>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '15px', fontWeight: 500, color: '#FFFFFF', marginBottom: '10px' }}>{halves[0]?.name}</div>
        )}

        {programNote && (
          <div style={{ ...UI.sentence, marginBottom: '10px' }}>
            Set by {programNote}. Another scheme is kept as you pick it; the program still sets its intensity and weights.
          </div>
        )}

        <div style={{ ...UI.capsLabel, margin: '0 0 6px 4px' }}>SCHEME</div>
        {pillGrid(options, draft.scheme, pickScheme, 3, v => String(v).toUpperCase())}

        {showsSets(draft.scheme) && (
          <>
            <div style={{ ...UI.capsLabel, margin: '14px 0 6px 4px' }}>
              SETS{isSuperset ? ' (BOTH EXERCISES)' : ''}
            </div>
            {pillGrid(SET_CHOICES, draft.sets, v => setDrafts(prev => prev.map((d, i) => (i === half || isSuperset ? { ...d, sets: v } : d))), 5)}
          </>
        )}

        {showsReps(draft.scheme) && (
          <>
            <div style={{ ...UI.capsLabel, margin: '14px 0 6px 4px' }}>REPS</div>
            {pillGrid(REP_CHOICES, draft.reps, v => update({ reps: v }), 6)}
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px' }}>
          <button type="button" className="kinetic-btn" onClick={onClose} style={UI.secondaryBtnCenter}>
            CANCEL
          </button>
          <button type="button" className="kinetic-btn" onClick={apply} style={UI.primaryBtnCenter}>
            APPLY {schemeButtonLabel(draft.scheme, draft.sets, draft.reps)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SchemeEditorModal;
