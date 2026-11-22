'use client';

import React, { useState } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import { StimulusSettingsSection } from './SettingsView';
import { SPECIFIC_MUSCLES_BY_REGION } from '../../data/exerciseLibrary';

// Status is shown by pattern as well as colour (red / green alone is hard to tell apart with colour blindness):
// OVERDUE = diagonal stripes, RECOVERED = dots, RECOVERING = solid, never logged = solid grey.
const statusPattern = label =>
  /OVERDUE/.test(label || '') ? 'url(#stim-stripes)' : /RECOVERED/.test(label || '') ? 'url(#stim-dots)' : null;

// Extra tap area around each body part, in map units (a wide transparent stroke on the same shape)
const HIT_PAD = 6;

// Mirror a path across the body's centre line (x = 60), so each side is drawn once
const mirror = d => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${120 - Number(x)} ${y}`);

// One body part on the map: an organic outline (path), not a box. Tapping (or Enter / Space) selects its muscle
// group: the readout under the map names it, says when it was last trained, lists its muscles and suggests a
// compound and an accessory; every part of that group fills solid white.
function MusclePart({ group, statusMap, selected, dimmed, onSelect, d }) {
  const status = statusMap?.[group];
  const pattern = statusPattern(status?.label);
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${group}: ${status?.label || 'UNLOGGED'}`}
      aria-pressed={selected}
      onClick={() => onSelect?.(group)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(group);
        }
      }}
      // While another muscle is selected this one steps back (the selected one is solid white, which recovering muscles
      // are close to)
      style={{ cursor: 'pointer', outline: 'none', opacity: dimmed ? 0.3 : 1, transition: 'opacity 140ms ease-out' }}
    >
      {/* A bigger, invisible tap area around the part (small parts like the neck are hard to hit) */}
      <path d={d} fill="transparent" stroke="transparent" strokeWidth={HIT_PAD * 2} strokeLinejoin="round" />
      {/* Selected: the whole group fills solid white (no pattern); otherwise its status colour + pattern */}
      <path d={d} fill={selected ? '#FFFFFF' : status?.color || '#3A3A3A'} stroke="#000000" strokeWidth={1.5} strokeLinejoin="round" />
      {pattern && !selected && <path d={d} fill={pattern} stroke="none" pointerEvents="none" />}
    </g>
  );
}

function StimulusPatternDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="stim-stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2.5" height="6" fill="rgba(0, 0, 0, 0.5)" />
        </pattern>
        <pattern id="stim-dots" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="1.1" fill="rgba(0, 0, 0, 0.55)" />
        </pattern>
      </defs>
    </svg>
  );
}

// Small swatch with the same colour + pattern as the map (the selected group's readout)
function StatusSwatch({ color, pattern, size = 12 }) {
  return (
    <svg width={size} height={size} style={{ display: 'inline-block', verticalAlign: '-1px', flexShrink: 0 }} aria-hidden="true">
      <rect width={size} height={size} rx={size / 4} fill={color} />
      {pattern && <rect width={size} height={size} rx={size / 4} fill={pattern} />}
    </svg>
  );
}

// ---- Body outlines (viewBox 0 0 120 230; left side written, right side mirrored) ----
const HEAD = 'M60 5 C67 5 71 10 71 17 C71 25 66 30 60 30 C54 30 49 25 49 17 C49 10 53 5 60 5 Z';
const NECK = 'M54 28 C56 31 64 31 66 28 L67 36 C63 38 57 38 53 36 Z';
const BICEP_L = 'M23 62 C26 60 30 58 33 54 C35 62 35 72 33 84 C30 86 25 86 21 84 C19 76 20 68 23 62 Z';
const FOREARM_L = 'M21 87 C25 89 30 89 33 87 C33 96 31 106 28 114 C25 116 22 116 19 114 C18 105 19 95 21 87 Z';
const PEC_L = 'M59 38 L59 60 C52 64 43 63 38 57 C35 52 36 45 40 41 C45 38 52 37 59 38 Z';
// Delts split in two: the inner piece is the front delt (front view) or the rear delt (back view), the outer cap the side
const DELT_INNER_L = 'M44 38 C40 37 35 37 32 38 C30 44 28 51 27 57 C29 56 32 53 34 50 C37 46 41 42 44 40 Z';
const DELT_SIDE_L = 'M32 38 C26 39 23 42 22 46 C20 52 21 58 24 61 C25 60 26 58 27 57 C28 51 30 44 32 38 Z';
const ABS_L = [
  'M47 65 L58 66 L58 79 L46 79 L46 67 C46 66 46 65 47 65 Z',
  'M46 82 L58 82 L58 95 L46 95 Z',
  'M46 98 L58 98 L58 112 C54 113 50 112 47 110 L46 109 Z'
];
const OBLIQUE_L = 'M38 64 C40 64 42 65 44 66 L44 108 C41 106 39 101 38 95 C37 85 37 74 38 64 Z';
const QUAD_L = 'M40 116 C44 115 48 115 52 116 C52 132 54 148 56 164 C56 168 56 170 56 172 C52 175 46 175 43 172 C38 155 37 132 40 116 Z';
const ADDUCTOR_L = 'M53 116 C55 116 57 116 58 117 C59 128 58 140 56 152 C54 142 53 130 53 116 Z';
const CALF_FRONT_L = 'M44 178 C48 176 52 176 55 178 C57 190 56 205 53 220 C51 222 47 222 45 220 C41 205 41 190 44 178 Z';
const TRAPS = 'M52 34 C56 37 64 37 68 34 C72 38 76 41 80 44 C72 47 66 49 60 49 C54 49 48 47 40 44 C44 41 48 38 52 34 Z';
const LAT_L = 'M40 47 C46 50 53 52 59 52 L59 88 C54 89 49 88 46 85 C41 76 38 62 40 47 Z';
const LOW_BACK = 'M46 90 C51 92 69 92 74 90 C76 97 76 104 74 111 C68 113 52 113 46 111 C44 104 44 97 46 90 Z';
const GLUTE_L = 'M59 114 L59 137 C52 141 44 140 40 134 C37 128 37 120 40 115 C45 113 52 113 59 114 Z';
const HAM_L = 'M40 140 C46 143 53 143 58 141 C60 152 59 163 56 176 C52 178 46 178 43 176 C39 164 38 151 40 140 Z';
const CALF_BACK_L = 'M43 180 C47 178 53 178 56 180 C58 192 57 206 53 220 C51 222 47 222 45 220 C40 206 40 192 43 180 Z';

const both = d => [d, mirror(d)];
// [muscle region (MUSCLE_REGIONS), its outlines] per view: the front shows biceps, quads, front delts, abs and obliques;
// the back triceps, hamstrings, rear delts, lats, upper and lower back and glutes
const FRONT_PARTS = [
  ['Neck', [NECK]],
  ['Front Delts', both(DELT_INNER_L)],
  ['Side Delts', both(DELT_SIDE_L)],
  ['Chest', both(PEC_L)],
  ['Biceps', both(BICEP_L)],
  ['Forearms', both(FOREARM_L)],
  ['Abs', ABS_L.flatMap(both)],
  ['Obliques', both(OBLIQUE_L)],
  ['Quads', both(QUAD_L)],
  ['Adductors', both(ADDUCTOR_L)],
  ['Calves', both(CALF_FRONT_L)]
];
const BACK_PARTS = [
  ['Neck', [NECK]],
  ['Upper Back', [TRAPS]],
  ['Lats', both(LAT_L)],
  ['Rear Delts', both(DELT_INNER_L)],
  ['Side Delts', both(DELT_SIDE_L)],
  ['Triceps', both(BICEP_L)],
  ['Forearms', both(FOREARM_L)],
  ['Lower Back', [LOW_BACK]],
  ['Glutes', both(GLUTE_L)],
  ['Hamstrings', both(HAM_L)],
  ['Calves', both(CALF_BACK_L)]
];

// Friendlier names for the ExRx muscle names listed under a group
const MUSCLE_LABELS = {
  'Deltoid - Anterior': 'Front delts',
  'Deltoid - Lateral': 'Side delts',
  'Deltoid - Posterior': 'Rear delts',
  'Trapezius - Upper': 'Upper traps',
  'Trapezius - Middle': 'Middle traps',
  'Trapezius - Lower': 'Lower traps',
  'Pectoralis Major - Clavicular': 'Upper chest',
  'Pectoralis Major - Sternal': 'Mid and lower chest',
  'Pectoralis Minor': 'Pec minor',
  'Biceps Brachii': 'Biceps',
  'Triceps Brachii': 'Triceps (all three heads)',
  'Hip Flexors': 'Hip flexors (rectus femoris)',
  'Hip Adductors': 'Adductors',
  'Hip Abductors': 'Glute medius and minimus (abductors)',
  'Latissimus Dorsi': 'Lats',
  'Gluteus Maximus': 'Glutes',
  'Infraspinatus & Teres Minor': 'Infraspinatus and teres minor'
};
const musclesOf = region =>
  (SPECIFIC_MUSCLES_BY_REGION[region] || [])
    .filter(m => m !== region && m !== 'General Back')
    .map(m => MUSCLE_LABELS[m] || m);

function BodyFigure({ label, parts, part }) {
  return (
    <div
      style={{
        border: 'none', borderRadius: '10px', backgroundColor: '#000000',
        padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 500, color: '#9A9A9A', letterSpacing: '0.1em', marginBottom: '8px' }}>{label}</div>
      <svg viewBox="0 0 120 230" style={{ width: '100%', maxWidth: '160px', height: 'auto' }}>
        <path d={HEAD} fill="#262626" />
        {parts.map(([group, paths]) => paths.map((d, i) => <MusclePart key={`${group}_${i}`} d={d} {...part(group)} />))}
      </svg>
    </div>
  );
}

export function StimulusMapView({
  colors,
  stimulusGreenDays,
  stimulusYellowDays,
  setStimulusGreenDays,
  setStimulusYellowDays,
  muscleStimulusStatus,
  // The shared value pop-up (STIMULUS THRESHOLDS day boxes)
  setSetValueTarget,
  // The exercise + ADD EXERCISE would pick next for a muscle group (useWorkoutMutations)
  suggestExerciseForMuscleGroup
}) {
  // Tapped muscle group (null = none yet)
  const [selectedGroup, setSelectedGroup] = useState(null);
  const part = group => ({
    group,
    statusMap: muscleStimulusStatus,
    selected: selectedGroup === group,
    dimmed: selectedGroup !== null && selectedGroup !== group,
    onSelect: g => setSelectedGroup(prev => (prev === g ? null : g))
  });
  const selectedStatus = selectedGroup ? muscleStimulusStatus?.[selectedGroup] : null;
  const muscles = selectedGroup ? musclesOf(selectedGroup) : [];
  const capsLabel = { fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em', color: '#9A9A9A' };
  // { compound, accessory } for the selected group (the + ADD EXERCISE picker's choice of each type)
  const suggested = selectedGroup ? suggestExerciseForMuscleGroup?.(selectedGroup) : null;
  const suggestionRow = (label, ex) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
      <span style={{ ...capsLabel, width: '84px', flexShrink: 0 }}>{label}</span>
      {ex ? (
        <span style={{ fontSize: '15px', fontWeight: 500, color: '#FFFFFF', minWidth: 0 }}>
          {ex.name}
          {ex.equipment ? <span style={{ color: '#9A9A9A', fontWeight: 400 }}> · {ex.equipment}</span> : null}
        </span>
      ) : (
        <span style={{ fontSize: '13px', color: '#9A9A9A' }}>None in the library</span>
      )}
    </div>
  );
  return (
    <div style={{ paddingTop: '14px' }}>
      <StimulusPatternDefs />
      <IOSListSection colors={colors}>
        <IOSListRow colors={colors}>
          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '8px 0' }}>
            <BodyFigure label="FRONT" parts={FRONT_PARTS} part={part} />
            <BodyFigure label="BACK" parts={BACK_PARTS} part={part} />
          </div>
        </IOSListRow>
        <IOSListRow isLast={true} colors={colors}>
          <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '24px', width: '100%', padding: '4px 0' }}>
            {selectedGroup ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <StatusSwatch color={selectedStatus?.color || '#3A3A3A'} pattern={statusPattern(selectedStatus?.label)} size={14} />
                  <span style={{ fontSize: '15px', fontWeight: 500, textTransform: 'uppercase' }}>{selectedGroup}</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '12px',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      color: !selectedStatus || selectedStatus.label === 'UNLOGGED' ? '#9A9A9A' : selectedStatus.color
                    }}
                  >
                    {selectedStatus?.label === 'UNLOGGED' || !selectedStatus ? 'NOT LOGGED YET' : selectedStatus.label}
                  </span>
                  {/* Hard sets in the last 7 days (secondary work counts half) */}
                  <span style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A', whiteSpace: 'nowrap' }}>
                    · {selectedStatus?.weeklySets || 0} {selectedStatus?.weeklySets === 1 ? 'SET' : 'SETS'} / 7D
                  </span>
                </div>
                {muscles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={capsLabel}>MUSCLES</span>
                    <span style={{ fontSize: '13px', color: '#BDBDBD', lineHeight: 1.4 }}>{muscles.join(', ')}</span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={capsLabel}>SUGGESTED</span>
                  {suggestionRow('COMPOUND', suggested?.compound)}
                  {suggestionRow('ACCESSORY', suggested?.accessory)}
                </div>
              </>
            ) : (
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A' }}>
                Tap a muscle to see when you last trained it, its muscles and exercises for it.
              </span>
            )}
          </div>
        </IOSListRow>
      </IOSListSection>

      <StimulusSettingsSection
        colors={colors}
        stimulusGreenDays={stimulusGreenDays}
        setStimulusGreenDays={setStimulusGreenDays}
        stimulusYellowDays={stimulusYellowDays}
        setStimulusYellowDays={setStimulusYellowDays}
        setSetValueTarget={setSetValueTarget}
      />
    </div>
  );
}
