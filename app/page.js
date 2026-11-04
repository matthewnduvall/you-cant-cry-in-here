'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';

// ============================================================================
// 1. KINETIC DESIGN SYSTEM TOKENS & GLOBAL STYLES
// ============================================================================

const IOS_DARK = {
  background: '#101010',
  secondaryBackground: '#161616',
  label: '#FFFFFF',
  secondaryLabel: '#A0A0A0',
  separator: '#5C5C5C',
  systemOrange: '#FF6B00',
  systemGreen: '#30D158',
  systemRed: '#FF3B30',
  systemYellow: '#FFD60A',
  systemBlue: '#FF6B00',
  systemIndigo: '#FFFFFF'
};

const KINETIC_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;600;700;800&display=swap');

  :root {
    --dp-color-ground: #101010;
    --dp-color-ink: #ffffff;
    --dp-color-accent: #ff6b00;
    --dp-color-decorative: #343434;
    --dp-color-rule: #5c5c5c;
    --dp-typography-face: "Kinetic Host Grotesk", "Host Grotesk", -apple-system, BlinkMacSystemFont, sans-serif;
    --dp-spacing-gutter: max(14px, 2.2cqw);
    --dp-motion-marquee-easing: linear;
  }

  .kinetic-app, .kinetic-app * {
    font-family: var(--dp-typography-face);
    border-radius: 0px !important;
    box-sizing: border-box;
  }

  .kinetic-app select,
  .kinetic-app select option {
    background-color: #101010 !important;
    color: #FFFFFF !important;
  }

  .kinetic-btn {
    transition: transform 0.08s ease, background-color 0.12s ease, color 0.12s ease;
  }
  .kinetic-btn:active {
    transform: scale(0.98);
  }
  .kinetic-btn:focus-visible {
    outline: 2px solid var(--dp-color-accent);
    outline-offset: 2px;
  }

  .kinetic-row-interactive {
    transition: background-color 0.12s ease, color 0.12s ease;
  }
  .kinetic-row-interactive:hover {
    background-color: var(--dp-color-accent) !important;
    color: #101010 !important;
  }
  .kinetic-row-interactive:hover .kinetic-sub {
    color: #101010 !important;
  }

  @keyframes kinetic-marquee {
    0% { transform: translateX(0%); }
    100% { transform: translateX(-50%); }
  }

  .kinetic-marquee-track {
    display: flex;
    width: max-content;
    white-space: nowrap;
    animation: kinetic-marquee 28s var(--dp-motion-marquee-easing) infinite;
  }

  .kinetic-marquee-paused .kinetic-marquee-track {
    animation-play-state: paused !important;
  }
`;

const UI = {
  pagePad: { paddingTop: '14px' },
  gutterWrap: { padding: '0 var(--dp-spacing-gutter)' },
  gutterBottom: { padding: '0 var(--dp-spacing-gutter) 16px' },
  primaryBtn: {
    width: '100%', padding: '14px', backgroundColor: 'var(--dp-color-accent)', color: '#101010',
    border: '2px solid #FFFFFF', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
  },
  primaryBtnCenter: {
    width: '100%', padding: '14px', backgroundColor: 'var(--dp-color-accent)', color: '#101010',
    border: '2px solid #FFFFFF', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
  },
  secondaryBtnCenter: {
    width: '100%', padding: '14px', backgroundColor: '#161616', color: '#FFFFFF',
    border: '2px solid var(--dp-color-rule)', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
  },
  dashedBtn: {
    width: '100%', padding: '14px', backgroundColor: '#161616', color: 'var(--dp-color-accent)',
    border: '2px dashed var(--dp-color-rule)', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
  },
  drawerBtn: (active = false) => ({
    width: '100%', padding: '14px', backgroundColor: active ? 'var(--dp-color-accent)' : '#161616',
    color: active ? '#101010' : '#FFFFFF', border: '2px solid var(--dp-color-rule)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontWeight: 800, fontSize: '15px', textTransform: 'uppercase', cursor: 'pointer'
  }),
  pillBtn: (active = false) => ({
    padding: '8px', backgroundColor: active ? 'var(--dp-color-accent)' : '#101010',
    color: active ? '#101010' : '#FFFFFF', border: '2px solid var(--dp-color-rule)',
    fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
  }),
  badge: (active = false) => ({
    padding: '4px 10px', backgroundColor: active ? 'var(--dp-color-accent)' : '#101010',
    color: active ? '#101010' : '#888888', border: '2px solid var(--dp-color-rule)',
    fontSize: '11px', fontWeight: 800, textTransform: 'uppercase'
  }),
  select: {
    width: '100%', backgroundColor: '#101010', color: '#FFFFFF',
    border: '2px solid var(--dp-color-rule)', padding: '10px', fontSize: '12px', fontWeight: 800
  },
  textInputBare: {
    width: '100%', backgroundColor: 'transparent', border: 'none',
    color: '#FFFFFF', fontSize: '16px', fontWeight: 800, outline: 'none'
  },
  numInput: (width = '58px', color = '#FFFFFF') => ({
    width, backgroundColor: '#101010', color, border: '2px solid var(--dp-color-rule)',
    padding: '6px', textAlign: 'center', fontSize: '13px', fontWeight: 800
  }),
  modalBackdrop: {
    position: 'fixed', inset: 0, zIndex: 70, backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
  },
  modalCard: (maxWidth = '420px') => ({
    width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto',
    backgroundColor: '#141414', border: '2px solid var(--dp-color-rule)', padding: '18px'
  }),
  modalHeader: {
    fontSize: '18px', fontWeight: 800, textTransform: 'uppercase',
    borderBottom: '2px solid var(--dp-color-rule)', paddingBottom: '10px', marginBottom: '14px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  closeXBtn: {
    background: 'var(--dp-color-accent)', color: '#101010', border: 'none',
    padding: '2px 8px', fontWeight: 800, cursor: 'pointer'
  },
  stepLabel: {
    fontSize: '11px', fontWeight: 800, color: 'var(--dp-color-accent)', marginBottom: '6px', textTransform: 'uppercase'
  },
  fieldLabel: {
    fontSize: '10px', fontWeight: 800, color: 'var(--dp-color-accent)', textTransform: 'uppercase'
  },
  rowTitle: { fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' },
  rowSub: { fontSize: '11px', color: '#A0A0A0', fontWeight: 600 },
  deleteXBtn: {
    width: '26px', height: '26px', border: '2px solid var(--dp-color-rule)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: '13px', backgroundColor: '#101010', color: '#FF3B30',
    cursor: 'pointer', flexShrink: 0, padding: 0
  }
};

// ============================================================================
// 2. SF SYMBOL / VECTOR ICON PRIMITIVE & RULED LIST COMPONENTS
// ============================================================================

function SFSymbol({ name, size = 18, color = 'currentColor' }) {
  switch (name) {
    case 'line.3.horizontal':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      );
    case 'chevron.backward':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.8">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      );
    case 'clock':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15.5 14" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );
  }
}

function IOSListSection({ header, headerRight, footer, children, style }) {
  return (
    <section style={{ marginBottom: '22px', padding: '0 var(--dp-spacing-gutter)', ...style }}>
      {(header || headerRight) && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '8px', marginBottom: '8px'
          }}
        >
          {header && (
            <div
              style={{
                fontSize: '20px', fontWeight: 800, letterSpacing: '-0.04em',
                textTransform: 'uppercase', color: '#FFFFFF', lineHeight: 1.05
              }}
            >
              {header}
            </div>
          )}
          {headerRight}
        </div>
      )}
      <div
        style={{
          border: '2px solid var(--dp-color-rule)',
          backgroundColor: '#141414'
        }}
      >
        {children}
      </div>
      {footer && (
        <div style={{ fontSize: '12px', color: '#9A9A9A', marginTop: '6px', lineHeight: 1.35, fontWeight: 600 }}>
          {footer}
        </div>
      )}
    </section>
  );
}

function IOSListRow({ children, onClick, isLast = false, indexLabel, bgNumeral, style }) {
  const interactive = typeof onClick === 'function';
  const childArray = React.Children.toArray(children);
  const firstChild = childArray[0] ?? null;
  const restChildren = childArray.length > 1 ? childArray.slice(1) : null;

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick(e);
            }
          }
          : undefined
      }
      className={interactive ? 'kinetic-row-interactive' : ''}
      style={{
        position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '12px', padding: '14px 16px',
        borderBottom: isLast ? 'none' : '2px solid var(--dp-color-rule)',
        backgroundColor: '#141414', color: '#FFFFFF',
        cursor: interactive ? 'pointer' : 'default',
        ...style
      }}
    >
      {bgNumeral && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', right: '36px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '54px', fontWeight: 800, color: 'var(--dp-color-decorative)',
            lineHeight: 1, pointerEvents: 'none', userSelect: 'none', zIndex: 0
          }}
        >
          {bgNumeral}
        </span>
      )}
      <div
        style={{
          position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '12px', width: '100%'
        }}
      >
        {indexLabel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <span
              className="kinetic-sub"
              style={{
                fontSize: '11px', fontWeight: 800, color: 'var(--dp-color-accent)',
                letterSpacing: '0.06em', flexShrink: 0
              }}
            >
              {indexLabel}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>{firstChild}</div>
          </div>
        ) : (
          firstChild
        )}
        {restChildren}
      </div>
    </div>
  );
}

// ============================================================================
// 3. EXERCISE LIBRARY, GYM EQUIPMENT & EXRX STANDARDS
// ============================================================================

const GYM_EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbell', 'EZ Bar', 'Landmine', 'Pull-Up Bar',
  'Resistance Bands', 'Weight Plates', 'Flat / Incline Bench',
  'Squat Rack', 'Cable Machine', 'Kettlebells'
];

const DEFAULT_GYM_EQUIPMENT_PRESETS = [
  { id: '', name: 'Full Gym (All)' },
  { id: 'preset_barbells_only', name: 'Barbells Only' },
  { id: 'preset_dumbbells_only', name: 'Dumbells Only' },
  { id: 'preset_bodyweight_only', name: 'Bodyweight Only' }
];

const formatTodayYMD = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
};

const getDefaultSessionName = () => `${formatTodayYMD()} - Session`;
const getDefaultAutoSessionName = () => `${formatTodayYMD()} - Auto Session`;

const formatTodayShortDate = () =>
  new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const formatTitleWithDate = baseTitle => {
  if (!baseTitle || baseTitle.trim() === 'SESSION' || baseTitle.trim() === 'Custom Kinetic Routine') {
    return getDefaultSessionName();
  }
  const ymd = formatTodayYMD();
  const dateStr = formatTodayShortDate();
  const clean = baseTitle.trim();
  if (clean.includes(ymd) || clean.toUpperCase().includes(dateStr.toUpperCase())) return clean;
  return `${ymd} - ${clean}`;
};

const isExerciseCompatibleWithGymSelection = (ex, gymSelectionId, customGyms = []) => {
  if (!ex) return false;
  if (!gymSelectionId) return true;
  const eqText = (ex.equipment || '').toLowerCase();
  const reqEq = ex.requiredEquipment || [];

  if (gymSelectionId === 'preset_barbells_only') {
    return eqText.includes('barbell') || reqEq.includes('Barbell');
  }
  if (gymSelectionId === 'preset_dumbbells_only') {
    return eqText.includes('dumbbell') || reqEq.includes('Dumbbell');
  }
  if (gymSelectionId === 'preset_bodyweight_only') {
    return eqText.includes('bodyweight') || reqEq.length === 0;
  }

  const foundGym = (customGyms || []).find(g => g.id === gymSelectionId);
  if (!foundGym) return true;
  const availEq = new Set(foundGym.equipment || GYM_EQUIPMENT_OPTIONS);
  if (reqEq.length === 0) return true;
  return reqEq.every(req => availEq.has(req));
};

const getGymSelectionLabel = (gymSelectionId, customGyms = []) => {
  const preset = DEFAULT_GYM_EQUIPMENT_PRESETS.find(p => p.id === (gymSelectionId || ''));
  if (preset) return preset.name;
  const custom = (customGyms || []).find(g => g.id === gymSelectionId);
  return custom ? custom.name : 'Full Gym (All)';
};

const mkEx = (id, name, equipment, requiredEquipment, category, muscleGroup, specificMuscles, isPriority, default1RM, alternatives) => ({
  id, name, equipment, requiredEquipment, category, muscleGroup, specificMuscles, isPriority, default1RM, alternatives
});

const EXERCISE_LIBRARY = [
  mkEx('barbell_bench_press', 'Barbell Bench Press', 'Barbell', ['Barbell', 'Flat / Incline Bench', 'Weight Plates'], 'Compound Lift', 'Chest', ['Mid Pectorals', 'Anterior Deltoid', 'Triceps'], true, 225, ['dumbbell_press', 'incline_bench_press', 'dumbbell_incline_press']),
  mkEx('barbell_back_squat', 'Barbell Back Squat', 'Barbell', ['Barbell', 'Squat Rack', 'Weight Plates'], 'Compound Lift', 'Legs', ['Quadriceps', 'Glutes', 'Hamstrings'], true, 285, ['front_squat', 'split_squat', 'goblet_squat']),
  mkEx('barbell_deadlift', 'Barbell Deadlift', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Back', ['Hamstrings', 'Glutes', 'Lats', 'Upper Back / Rhomboids'], true, 335, ['landmine_rdl', 'dumbbell_rdl', 'barbell_row']),
  mkEx('overhead_press', 'Barbell Overhead Press', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Shoulders', ['Anterior Deltoid', 'Lateral Deltoid', 'Triceps'], true, 145, ['dumbbell_shoulder_press', 'incline_bench_press']),
  mkEx('incline_bench_press', 'Incline Bench Press', 'Barbell', ['Barbell', 'Flat / Incline Bench', 'Weight Plates'], 'Compound Lift', 'Chest', ['Upper Pectorals', 'Anterior Deltoid', 'Triceps'], true, 195, ['dumbbell_incline_press', 'dumbbell_press', 'barbell_bench_press']),
  mkEx('chin_ups', 'Chin-Ups / Pull-Ups', 'Bodyweight / Weighted', ['Pull-Up Bar'], 'Compound Lift', 'Back', ['Lats', 'Biceps', 'Upper Back / Rhomboids'], true, 210, ['meadows_row', 'barbell_row', 'dumbbell_row']),
  mkEx('dumbbell_press', 'Dumbbell Press', 'Dumbbell', ['Dumbbell', 'Flat / Incline Bench'], 'Compound Lift', 'Chest', ['Mid Pectorals', 'Anterior Deltoid', 'Triceps'], false, 180, ['barbell_bench_press', 'incline_bench_press', 'dumbbell_incline_press']),
  mkEx('dumbbell_incline_press', 'Dumbbell Incline Press', 'Dumbbell', ['Dumbbell', 'Flat / Incline Bench'], 'Compound Lift', 'Chest', ['Upper Pectorals', 'Anterior Deltoid', 'Triceps'], false, 160, ['incline_bench_press', 'dumbbell_press', 'barbell_bench_press']),
  mkEx('meadows_row', "Meadow's Row", 'Landmine / Barbell', ['Landmine', 'Barbell', 'Weight Plates'], 'Compound Lift', 'Back', ['Lats', 'Upper Back / Rhomboids', 'Posterior Deltoid', 'Biceps'], false, 165, ['barbell_row', 'dumbbell_row', 'chin_ups']),
  mkEx('barbell_row', 'Barbell Bent-Over Row', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Back', ['Upper Back / Rhomboids', 'Lats', 'Biceps'], false, 195, ['meadows_row', 'dumbbell_row', 'chin_ups']),
  mkEx('dumbbell_row', 'Single-Arm Dumbbell Row', 'Dumbbell', ['Dumbbell'], 'Compound Lift', 'Back', ['Lats', 'Upper Back / Rhomboids', 'Biceps'], false, 110, ['meadows_row', 'barbell_row', 'chin_ups']),
  mkEx('front_squat', 'Front Squat', 'Barbell', ['Barbell', 'Squat Rack', 'Weight Plates'], 'Compound Lift', 'Legs', ['Quadriceps', 'Glutes', 'Abs / Core'], false, 225, ['barbell_back_squat', 'split_squat', 'goblet_squat']),
  mkEx('landmine_rdl', 'Landmine RDL', 'Landmine / Barbell', ['Landmine', 'Barbell', 'Weight Plates'], 'Compound Lift', 'Legs', ['Hamstrings', 'Glutes', 'Lats'], false, 215, ['barbell_deadlift', 'dumbbell_rdl']),
  mkEx('dumbbell_rdl', 'Dumbbell RDL', 'Dumbbell', ['Dumbbell'], 'Compound Lift', 'Legs', ['Hamstrings', 'Glutes'], false, 175, ['landmine_rdl', 'barbell_deadlift']),
  mkEx('split_squat', 'Split Squat', 'Dumbbell / Barbell', ['Dumbbell'], 'Compound Lift', 'Legs', ['Quadriceps', 'Glutes', 'Hamstrings'], false, 155, ['front_squat', 'reverse_lunge', 'barbell_back_squat']),
  mkEx('dumbbell_shoulder_press', 'Dumbbell Shoulder Press', 'Dumbbell', ['Dumbbell'], 'Compound Lift', 'Shoulders', ['Anterior Deltoid', 'Lateral Deltoid', 'Triceps'], false, 125, ['overhead_press', 'incline_bench_press']),
  mkEx('goblet_squat', 'Dumbbell Goblet Squat', 'Dumbbell', ['Dumbbell'], 'Compound Lift', 'Legs', ['Quadriceps', 'Glutes'], false, 120, ['front_squat', 'split_squat']),
  mkEx('reverse_lunge', 'Reverse Lunge', 'Dumbbell / Barbell', ['Dumbbell'], 'Accessories', 'Legs', ['Quadriceps', 'Glutes', 'Hamstrings'], false, 135, ['split_squat', 'pistol_squats']),
  mkEx('front_flies', 'Front Flies', 'Dumbbell', ['Dumbbell'], 'Accessories', 'Chest', ['Mid Pectorals', 'Upper Pectorals', 'Anterior Deltoid'], false, 65, ['reverse_flies', 'dumbbell_press']),
  mkEx('pistol_squats', 'Pistol Squats', 'Bodyweight / Dumbbell', [], 'Accessories', 'Legs', ['Quadriceps', 'Glutes'], false, 95, ['reverse_lunge', 'split_squat']),
  mkEx('reverse_flies', 'Reverse Flies', 'Dumbbell', ['Dumbbell'], 'Accessories', 'Shoulders', ['Posterior Deltoid', 'Upper Back / Rhomboids'], false, 55, ['band_pulldown', 'side_raise_dumbbell']),
  mkEx('band_pulldown', 'Band Pulldown', 'Band', ['Resistance Bands'], 'Accessories', 'Back', ['Lats', 'Upper Back / Rhomboids', 'Triceps'], false, 90, ['chin_ups', 'reverse_flies']),
  mkEx('front_raise_ez_bar', 'Front Raise EZ Bar', 'EZ Bar / Barbell', ['EZ Bar'], 'Accessories', 'Shoulders', ['Anterior Deltoid', 'Upper Pectorals'], false, 65, ['side_raise_dumbbell', 'dumbbell_shoulder_press']),
  mkEx('side_raise_dumbbell', 'Side Raise Dumbbell', 'Dumbbell', ['Dumbbell'], 'Accessories', 'Shoulders', ['Lateral Deltoid'], false, 45, ['front_raise_ez_bar', 'reverse_flies']),
  mkEx('barbell_bicep_curl', 'Barbell Bicep Curl', 'Barbell', ['Barbell'], 'Accessories', 'Arms', ['Biceps', 'Forearms'], false, 95, ['dumbbell_hammer_curl', 'tricep_skullcrusher']),
  mkEx('dumbbell_hammer_curl', 'Dumbbell Hammer Curl', 'Dumbbell', ['Dumbbell'], 'Accessories', 'Arms', ['Biceps', 'Forearms'], false, 80, ['barbell_bicep_curl', 'tricep_skullcrusher']),
  mkEx('tricep_skullcrusher', 'EZ-Bar Skullcrusher', 'Barbell / EZ Bar', ['EZ Bar'], 'Accessories', 'Arms', ['Triceps'], false, 95, ['dumbbell_overhead_extension', 'barbell_bicep_curl']),
  mkEx('dumbbell_overhead_extension', 'Dumbbell Tricep Extension', 'Dumbbell', ['Dumbbell'], 'Accessories', 'Arms', ['Triceps'], false, 75, ['tricep_skullcrusher', 'dumbbell_hammer_curl']),
  mkEx('hollow_holds', 'Hollow Holds (45s)', 'Bodyweight', [], 'Abs', 'Core', ['Abs / Core'], false, 45, ['hanging_leg_raises', 'weighted_plank']),
  mkEx('hanging_leg_raises', 'Hanging Leg Raises', 'Bodyweight', ['Pull-Up Bar'], 'Abs', 'Core', ['Abs / Core'], false, 50, ['hollow_holds', 'weighted_plank']),
  mkEx('weighted_plank', 'Weighted Plank (60s)', 'Plate / Bodyweight', [], 'Abs', 'Core', ['Abs / Core'], false, 60, ['hollow_holds', 'hanging_leg_raises'])
];

const EXERCISE_MAP = Object.fromEntries(EXERCISE_LIBRARY.map(ex => [ex.id, ex]));

const filterAddSlotExercises = (gymFilterId, category, customGyms = []) => {
  const byGym = EXERCISE_LIBRARY.filter(ex =>
    isExerciseCompatibleWithGymSelection(ex, gymFilterId, customGyms)
  );
  const gymBase = byGym.length > 0 ? byGym : EXERCISE_LIBRARY;
  if (!category || category === 'Supersets') {
    const nonCompound = gymBase.filter(ex => ex.category === 'Accessories' || ex.category === 'Compound Lift');
    return nonCompound.length > 0 ? nonCompound : gymBase;
  }
  const byCatAndGym = byGym.filter(ex => ex.category === category);
  if (byCatAndGym.length > 0) return byCatAndGym;
  const byCatOnly = EXERCISE_LIBRARY.filter(ex => ex.category === category);
  return byCatOnly.length > 0 ? byCatOnly : gymBase;
};

const getFilteredExercisesForSlotInline = (slot, selectedGymId, customGyms = []) => {
  const currentEx = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
  const targetFamily = slot.familyMuscleGroup || currentEx.muscleGroup || 'Chest';
  const equipmentFilteredLibrary = EXERCISE_LIBRARY.filter(ex =>
    isExerciseCompatibleWithGymSelection(ex, selectedGymId, customGyms)
  );
  const activePoolBase = equipmentFilteredLibrary.length > 0 ? equipmentFilteredLibrary : EXERCISE_LIBRARY;

  if (slot.category === 'Abs') {
    const absMatches = activePoolBase.filter(e => e.category === 'Abs');
    return absMatches.length > 0 ? absMatches : EXERCISE_LIBRARY.filter(e => e.category === 'Abs');
  }
  if (slot.category === 'Compound Lift') {
    const sameFamily = activePoolBase.filter(e => e.category === 'Compound Lift' && e.muscleGroup === targetFamily);
    const others = activePoolBase.filter(e => e.category === 'Compound Lift' && e.muscleGroup !== targetFamily);
    const combined = [...sameFamily, ...others];
    return combined.length > 0 ? combined : activePoolBase;
  }
  if (slot.category === 'Accessories') {
    const sameFamily = activePoolBase.filter(e => e.category === 'Accessories' && e.muscleGroup === targetFamily);
    const sameFamilyAll = activePoolBase.filter(e => e.muscleGroup === targetFamily);
    if (sameFamily.length > 0) return sameFamily;
    if (sameFamilyAll.length > 0) return sameFamilyAll;
    return activePoolBase;
  }
  const sameFamily = activePoolBase.filter(e => e.muscleGroup === targetFamily);
  const others = activePoolBase.filter(e => e.muscleGroup !== targetFamily);
  return [...sameFamily, ...others];
};

const getNextIncompleteSetInfo = slots => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return { topLine: 'NO EXERCISES QUEUED', bottomLine: 'ADD AN EXERCISE TO BEGIN' };
  }
  for (const slot of slots) {
    if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
      const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
      const maxLen = Math.max(0, ...slot.supersetSetsByExercise.map(l => (l ? l.length : 0)));
      for (let sIdx = 0; sIdx < maxLen; sIdx++) {
        for (let exIdx = 0; exIdx < Math.min(2, slot.supersetSetsByExercise.length); exIdx++) {
          const st = slot.supersetSetsByExercise[exIdx]?.[sIdx];
          if (st && !st.completed) {
            const exName = EXERCISE_MAP[ids[exIdx]]?.name || ids[exIdx] || 'Lift';
            return {
              topLine: `NEXT: ${exName.toUpperCase()}`,
              bottomLine: `SET #${st.setNumber} • ${st.weight} LB × ${st.reps} REPS`
            };
          }
        }
      }
    } else if (Array.isArray(slot.sets)) {
      for (const st of slot.sets) {
        if (st && !st.completed) {
          const exName = EXERCISE_MAP[slot.exerciseId]?.name || slot.exerciseId || 'Lift';
          const loadStr = slot.category === 'Abs' ? `${st.reps} SEC` : `${st.weight} LB × ${st.reps} REPS`;
          return {
            topLine: `NEXT: ${exName.toUpperCase()}`,
            bottomLine: `SET #${st.setNumber} • ${loadStr}`
          };
        }
      }
    }
  }
  return { topLine: 'ALL SETS COMPLETE ✓', bottomLine: 'READY TO SAVE SESSION' };
};

const BIG_FOUR_IDS = ['barbell_bench_press', 'barbell_back_squat', 'barbell_deadlift', 'overhead_press'];
const EXRX_CLASSES = ['Untrained', 'Novice', 'Intermediate', 'Advanced', 'Elite'];

const EXRX_RATIOS = {
  barbell_bench_press: { Untrained: 0.61, Novice: 0.79, Intermediate: 0.98, Advanced: 1.34, Elite: 1.66 },
  barbell_back_squat: { Untrained: 0.57, Novice: 1.05, Intermediate: 1.29, Advanced: 1.75, Elite: 2.27 },
  barbell_deadlift: { Untrained: 0.71, Novice: 1.31, Intermediate: 1.50, Advanced: 2.11, Elite: 2.61 },
  overhead_press: { Untrained: 0.40, Novice: 0.55, Intermediate: 0.69, Advanced: 0.87, Elite: 1.16 }
};

const roundTo5 = val => Math.max(5, Math.round(val / 5) * 5);
const roundToIncrement = val => Math.max(0, Math.round((Number(val) || 0) * 4) / 4);

const getExRxTargetForLift = (liftId, targetClass, bodyweightLbs = 220, heightInches = 70, customGoals = {}) => {
  if (targetClass === 'Custom' && customGoals && customGoals[liftId]) {
    return Number(customGoals[liftId]);
  }
  const ratios = EXRX_RATIOS[liftId] || EXRX_RATIOS.barbell_bench_press;
  const ratio = ratios[targetClass] || ratios.Intermediate;
  const heightAdj = 1 + (70 - (heightInches || 70)) * 0.003;
  return roundTo5((bodyweightLbs || 220) * ratio * heightAdj);
};

const getExRxCurrentClass = (liftId, current1RM, bodyweightLbs = 220, heightInches = 70) => {
  let matched = 'Below Untrained';
  for (const cls of EXRX_CLASSES) {
    const threshold = getExRxTargetForLift(liftId, cls, bodyweightLbs, heightInches);
    if (current1RM >= threshold) matched = cls;
  }
  return matched;
};

// ============================================================================
// 4. WORKOUT, 1RM EQUIVALENT & SUPERSET GENERATION ENGINE
// ============================================================================

const SET_TYPES_LIST = ['Warmup Set', 'Working Set', 'Top Out Set', 'Burn Out Set', '1 Rep Max'];

const getHistoricalCalculated1RM = (exerciseId, history = [], oneRepMaxes = {}) => {
  let best = Number(oneRepMaxes?.[exerciseId]) || 0;
  (history || []).forEach(w => {
    (w.slots || []).forEach(slot => {
      if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
        const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
        ids.forEach((id, idx) => {
          if (id === exerciseId) {
            (slot.supersetSetsByExercise[idx] || []).forEach(st => {
              if (st.completed && Number(st.weight) > 0) {
                const reps = Math.max(1, Number(st.reps) || 1);
                const est = reps === 1 ? Number(st.weight) : Math.round(Number(st.weight) * (1 + reps / 30));
                if (est > best) best = est;
              }
            });
          }
        });
      } else if (slot.exerciseId === exerciseId) {
        (slot.sets || []).forEach(st => {
          if (st.completed && Number(st.weight) > 0) {
            const reps = Math.max(1, Number(st.reps) || 1);
            const est = reps === 1 ? Number(st.weight) : Math.round(Number(st.weight) * (1 + reps / 30));
            if (est > best) best = est;
          }
        });
      }
    });
  });
  return best > 0 ? best : EXERCISE_MAP[exerciseId]?.default1RM ?? 135;
};

const calculateLastEquivalentWeightForSet = (base1RM, setItem, totalSetsCount = 5, category = 'Compound Lift') => {
  if (category === 'Abs') return 0;
  const max1RM = Math.max(5, Number(base1RM) || 135);
  const sType = setItem?.type || 'Working Set';
  const reps = Math.max(1, Number(setItem?.reps) || 8);

  if (sType === '1 Rep Max') return roundTo5(max1RM);

  const repPct = 1 / (1 + reps / 30);
  let typeMultiplier = 0.96;
  if (sType === 'Warmup Set') typeMultiplier = 0.72;
  else if (sType === 'Top Out Set') typeMultiplier = 1.04;
  else if (sType === 'Burn Out Set') typeMultiplier = 0.82;

  const extraSets = Math.max(0, totalSetsCount - 5);
  const fatigueDiscount = Math.max(0.74, 1 - extraSets * 0.025);

  const rawWeight = max1RM * Math.min(1, repPct * typeMultiplier * fatigueDiscount);
  return roundTo5(rawWeight);
};

const getIncrementInLbs = (goalIncrement = 1.25, goalUnit = 'lb', goalType = 'Strength') => {
  if (goalType === 'Maintain') return 0;
  const inc = Number(goalIncrement) || 0;
  return goalUnit === 'kg' ? roundToIncrement(inc * 2.20462) : roundToIncrement(inc);
};

const generateSetsForScheme = (scheme, oneRepMax, category = 'Compound Lift', exerciseId = '', incrementLbs = 0) => {
  const base1RM = oneRepMax || (EXERCISE_MAP[exerciseId]?.default1RM ?? 135);
  const ts = Date.now() + Math.floor(Math.random() * 10000);

  if (category === 'Abs' || exerciseId === 'hollow_holds') {
    return [
      { id: `set_${ts}_abs1`, setNumber: 1, type: 'Working Set', reps: 45, lastWeight: 0, weight: 0, completed: false },
      { id: `set_${ts}_abs2`, setNumber: 2, type: 'Working Set', reps: 45, lastWeight: 0, weight: 0, completed: false }
    ];
  }

  const buildWithLastAndTarget = rawSets => {
    const totalCount = rawSets.length;
    return rawSets.map((s, idx) => {
      const lastW =
        s.lastWeight !== undefined
          ? s.lastWeight
          : calculateLastEquivalentWeightForSet(base1RM, s, totalCount, category);
      const targetW =
        s.type === '1 Rep Max' ? roundTo5(base1RM) : roundToIncrement(lastW + incrementLbs);
      return {
        id: `set_${ts}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
        setNumber: idx + 1,
        type: s.type,
        reps: s.reps,
        lastWeight: lastW,
        weight: targetW,
        completed: false
      };
    });
  };

  switch (scheme) {
    case '5x5':
      return buildWithLastAndTarget(Array.from({ length: 5 }, () => ({ type: 'Working Set', reps: 5 })));
    case '8x8':
      return buildWithLastAndTarget(Array.from({ length: 8 }, () => ({ type: 'Working Set', reps: 8 })));
    case 'Pyramid':
      return buildWithLastAndTarget([
        { reps: 8, type: 'Warmup Set' },
        { reps: 5, type: 'Working Set' },
        { reps: 3, type: 'Working Set' },
        { reps: 2, type: 'Working Set' },
        { reps: 1, type: 'Top Out Set' }
      ]);
    case 'Reverse Pyramid':
      return buildWithLastAndTarget([
        { reps: 8, type: 'Warmup Set' },
        { reps: 4, type: 'Top Out Set' },
        { reps: 6, type: 'Working Set' },
        { reps: 8, type: 'Working Set' },
        { reps: 10, type: 'Working Set' }
      ]);
    case '5x8':
    default:
      return buildWithLastAndTarget(Array.from({ length: 5 }, () => ({ type: 'Working Set', reps: 8 })));
  }
};

const createWorkoutSlot = ({
  category, slotLabel, exerciseId, secondaryExerciseId = null, supersetExerciseIds = null,
  scheme = '5x8', oneRepMaxes = {}, history = [], incrementLbs = 0, restSeconds = 90
}) => {
  const uid = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (category === 'Supersets') {
    const rawIds =
      Array.isArray(supersetExerciseIds) && supersetExerciseIds.length > 0
        ? supersetExerciseIds
        : [exerciseId, secondaryExerciseId].filter(Boolean);
    const exA = rawIds[0] || 'reverse_lunge';
    const exB = rawIds[1] || (exA === 'reverse_lunge' ? 'front_flies' : 'reverse_lunge');
    const cleanIds = [exA, exB];

    const setsByExercise = cleanIds.map(id => {
      const calcMax = getHistoricalCalculated1RM(id, history, oneRepMaxes);
      return generateSetsForScheme(scheme, calcMax, 'Supersets', id, incrementLbs);
    });
    return {
      id: uid, category: 'Supersets', slotLabel: slotLabel || 'Superset', scheme, restSeconds,
      exerciseId: cleanIds[0], secondaryExerciseId: cleanIds[1], supersetExerciseIds: cleanIds,
      supersetSetsByExercise: setsByExercise, sets: setsByExercise[0] || [], secondarySets: setsByExercise[1] || []
    };
  }

  const ex1 = EXERCISE_MAP[exerciseId] || EXERCISE_LIBRARY[0];
  const calcMax1 = getHistoricalCalculated1RM(ex1.id, history, oneRepMaxes);
  const sets1 = generateSetsForScheme(scheme, calcMax1, category, ex1.id, incrementLbs);

  return {
    id: uid, category, slotLabel: slotLabel || category, scheme, restSeconds,
    exerciseId: ex1.id, secondaryExerciseId: null, supersetExerciseIds: [ex1.id],
    supersetSetsByExercise: [sets1], sets: sets1, secondarySets: []
  };
};

const normalizeSlotLabels = slots => {
  let compoundCount = 0;
  let supersetCount = 0;
  return (slots || [])
    .filter(slot => slot && slot.category !== 'Warm-Up Routine' && slot.exerciseId !== 'warmup_12_step')
    .map(slot => {
      if (slot.category === 'Compound Lift' || slot.category === 'Compound Lifts') {
        compoundCount += 1;
        return { ...slot, category: 'Compound Lift', slotLabel: `Compound Lift ${compoundCount}` };
      }
      if (slot.category === 'Supersets') {
        supersetCount += 1;
        const rawIds =
          Array.isArray(slot.supersetExerciseIds) && slot.supersetExerciseIds.length > 0
            ? slot.supersetExerciseIds
            : [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
        const exA = rawIds[0] || 'reverse_lunge';
        const exB = rawIds[1] || (exA === 'reverse_lunge' ? 'front_flies' : 'reverse_lunge');
        return {
          ...slot, slotLabel: `Superset ${supersetCount}`,
          exerciseId: exA, secondaryExerciseId: exB, supersetExerciseIds: [exA, exB]
        };
      }
      return slot;
    });
};

const DEFAULT_ROUTINES = [
  { key: 'full_body_a', label: 'Generic Full Body A' },
  { key: 'full_body_b', label: 'Generic Full Body B' },
  { key: 'arms_only', label: 'Generic Arms Only' }
];

const buildPresetSlots = (presetKey, oneRepMaxes, history = [], incrementLbs = 0) => {
  switch (presetKey) {
    case 'full_body_a':
    case 'mon_tue':
      return normalizeSlotLabels([
        createWorkoutSlot({ category: 'Compound Lift', slotLabel: 'Compound Lift 1', exerciseId: 'barbell_bench_press', scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Compound Lift', slotLabel: 'Compound Lift 2', exerciseId: 'barbell_back_squat', scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Supersets', slotLabel: 'Superset 1', supersetExerciseIds: ['reverse_lunge', 'front_flies'], scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Abs', slotLabel: 'Abs Slot', exerciseId: 'hollow_holds', oneRepMaxes, history, incrementLbs })
      ]);
    case 'full_body_b':
    case 'wed_thu':
      return normalizeSlotLabels([
        createWorkoutSlot({ category: 'Compound Lift', slotLabel: 'Compound Lift 1', exerciseId: 'barbell_deadlift', scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Compound Lift', slotLabel: 'Compound Lift 2', exerciseId: 'overhead_press', scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Supersets', slotLabel: 'Superset 1', supersetExerciseIds: ['pistol_squats', 'reverse_flies'], scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Abs', slotLabel: 'Abs Slot', exerciseId: 'hollow_holds', oneRepMaxes, history, incrementLbs })
      ]);
    case 'arms_only':
    case 'arms_pump':
      return normalizeSlotLabels([
        createWorkoutSlot({ category: 'Compound Lift', slotLabel: 'Compound Lift 1', exerciseId: 'chin_ups', scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Compound Lift', slotLabel: 'Compound Lift 2', exerciseId: 'incline_bench_press', scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Supersets', slotLabel: 'Superset 1', supersetExerciseIds: ['barbell_bicep_curl', 'tricep_skullcrusher'], scheme: '5x8', oneRepMaxes, history, incrementLbs }),
        createWorkoutSlot({ category: 'Supersets', slotLabel: 'Supersets', supersetExerciseIds: ['dumbbell_hammer_curl', 'side_raise_dumbbell'], scheme: '5x8', oneRepMaxes, history, incrementLbs })
      ]);
    default:
      return [];
  }
};

const getInitial1RMs = () => {
  const map = {};
  EXERCISE_LIBRARY.forEach(ex => {
    if (ex.default1RM > 0) map[ex.id] = ex.default1RM;
  });
  return map;
};

const checkIsWorkoutComplete = slots => {
  if (!slots || slots.length === 0) return false;
  for (const slot of slots) {
    if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
      for (const list of slot.supersetSetsByExercise) {
        if (!list || list.some(s => !s.completed)) return false;
      }
    } else {
      if (!slot.sets || slot.sets.length === 0 || slot.sets.some(s => !s.completed)) return false;
    }
  }
  return true;
};

const formatTimerSeconds = sec => {
  const isNeg = sec < 0;
  const abs = Math.abs(sec);
  const mins = Math.floor(abs / 60);
  const rem = abs % 60;
  const formatted = `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  return isNeg ? `-${formatted}` : formatted;
};

const cloneSlots = slots => {
  if (!Array.isArray(slots)) return [];
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(slots);
    } catch {
      // Fallback below
    }
  }
  return JSON.parse(JSON.stringify(slots));
};

const SessionRestTimerBar = React.memo(function SessionRestTimerBar({
  defaultRestSeconds = 90,
  timerTrigger,
  nextLiftInfo = { topLine: '', bottomLine: '' },
  onChangeDefaultRest,
  onStopTimer
}) {
  const [remaining, setRemaining] = useState(defaultRestSeconds);

  useEffect(() => {
    if (!timerTrigger.isRunning || !timerTrigger.startedAtMs) {
      setRemaining(timerTrigger.targetSeconds || defaultRestSeconds);
      return;
    }
    const update = () => {
      const elapsed = Math.floor((Date.now() - timerTrigger.startedAtMs) / 1000);
      setRemaining(timerTrigger.targetSeconds - elapsed);
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [timerTrigger, defaultRestSeconds]);

  return (
    <div
      style={{
        marginTop: '10px', paddingTop: '10px', borderTop: '2px solid var(--dp-color-rule)',
        display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'stretch', gap: '8px'
      }}
    >
      {timerTrigger.isRunning ? (
        <button
          type="button"
          onClick={onStopTimer}
          title="Tap to stop rest timer"
          className="kinetic-btn"
          style={{
            backgroundColor: '#FF3B30', color: '#FFFFFF', border: '2px solid #FFFFFF',
            padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap'
          }}
        >
          <SFSymbol name="clock" size={14} color="#FFFFFF" />
          <span>{formatTimerSeconds(remaining)}</span>
        </button>
      ) : (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            backgroundColor: '#101010', border: '2px solid var(--dp-color-rule)', padding: '4px 8px'
          }}
        >
          <SFSymbol name="clock" size={14} color="var(--dp-color-accent)" />
          <select
            value={defaultRestSeconds}
            onChange={e => onChangeDefaultRest(Number(e.target.value))}
            style={{
              backgroundColor: '#101010', color: '#FFFFFF', border: 'none',
              fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', outline: 'none', cursor: 'pointer'
            }}
          >
            <option value={60}>REST 1:00</option>
            <option value={90}>REST 1:30</option>
            <option value={120}>REST 2:00</option>
            <option value={180}>REST 3:00</option>
          </select>
        </div>
      )}

      <div
        style={{
          minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '5px 10px', backgroundColor: 'var(--dp-color-accent)', color: '#101010',
          border: '2px solid var(--dp-color-rule)'
        }}
      >
        <div
          style={{
            fontSize: '11px', fontWeight: 800, lineHeight: 1.15,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase'
          }}
        >
          {nextLiftInfo.topLine || 'NO EXERCISES QUEUED'}
        </div>
        <div
          style={{
            fontSize: '10px', fontWeight: 800, lineHeight: 1.15, opacity: 0.9,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            textTransform: 'uppercase', marginTop: '2px'
          }}
        >
          {nextLiftInfo.bottomLine || ''}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// 5. UPDATE-RESILIENT PERSISTENCE & SCHEMA MIGRATION ENGINE (V3)
// ============================================================================

const PERSISTENCE_KEY = 'yccih_app_state_v3';
const CURRENT_SCHEMA_VERSION = 3;

const DEFAULT_SETTINGS_V2 = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  bodyMetrics: { bodyweightLbs: 220, heightFeet: 5, heightInches: 10 },
  goals: {
    goalType: 'Strength', goalIncrement: 1.25, goalUnit: 'lb',
    chartMetric: 'weight', targetStandardClass: 'Intermediate', customGoalWeights: {}
  },
  stimulus: { greenDays: 2, yellowDays: 4 },
  routinePreferences: ['Compounds', 'Compounds', 'Supersets', 'Supersets', 'Abs'],
  social: { shareStatsWithFriends: true, shareRoutinesWithFriends: true },
  selectedGymId: ''
};

const normalizeSlotFromStorage = slot => {
  if (!slot || slot.category === 'Warm-Up Routine' || slot.exerciseId === 'warmup_12_step') return null;
  const ex1 = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
  const familyMuscleGroup = slot.familyMuscleGroup || ex1?.muscleGroup || 'Chest';
  const sets = Array.isArray(slot.sets) ? slot.sets : [];

  if (slot.category === 'Supersets') {
    const supIds =
      Array.isArray(slot.supersetExerciseIds) && slot.supersetExerciseIds.length > 0
        ? slot.supersetExerciseIds
        : [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
    const exA = supIds[0] || 'reverse_lunge';
    const exB = supIds[1] || (exA === 'reverse_lunge' ? 'front_flies' : 'reverse_lunge');
    const cleanSupIds = [exA, exB];
    const supSets =
      Array.isArray(slot.supersetSetsByExercise) && slot.supersetSetsByExercise.length >= 2
        ? [slot.supersetSetsByExercise[0], slot.supersetSetsByExercise[1]]
        : [sets, Array.isArray(slot.secondarySets) && slot.secondarySets.length > 0 ? slot.secondarySets : cloneSlots(sets)];

    return {
      ...slot,
      exerciseId: cleanSupIds[0],
      secondaryExerciseId: cleanSupIds[1],
      familyMuscleGroup,
      exerciseNameSnapshot: slot.exerciseNameSnapshot || ex1?.name || slot.exerciseId,
      supersetExerciseIds: cleanSupIds,
      supersetSetsByExercise: supSets,
      sets: supSets[0] || sets,
      secondarySets: supSets[1] || []
    };
  }

  return {
    ...slot,
    exerciseId: ex1.id,
    familyMuscleGroup,
    exerciseNameSnapshot: slot.exerciseNameSnapshot || ex1.name,
    supersetExerciseIds: [ex1.id],
    supersetSetsByExercise: [sets],
    sets
  };
};

const normalizeWorkoutFromStorage = workout => {
  if (!workout) return null;
  const rawSlots = Array.isArray(workout.slots) ? workout.slots : [];
  const normalizedSlots = normalizeSlotLabels(rawSlots.map(normalizeSlotFromStorage).filter(Boolean));
  return { ...workout, schemaVersion: CURRENT_SCHEMA_VERSION, slots: normalizedSlots };
};

const loadHydratedAppState = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PERSISTENCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const initialMaxes = getInitial1RMs();
    const mergedMaxes = { ...initialMaxes, ...(parsed.oneRepMaxes || {}) };

    const cleanedRoutinePrefs = Array.isArray(parsed.settings?.routinePreferences)
      ? parsed.settings.routinePreferences.filter(p => p !== 'Warmup')
      : [];

    const mergedSettings = {
      ...DEFAULT_SETTINGS_V2,
      ...(parsed.settings || {}),
      bodyMetrics: { ...DEFAULT_SETTINGS_V2.bodyMetrics, ...(parsed.settings?.bodyMetrics || {}) },
      goals: {
        ...DEFAULT_SETTINGS_V2.goals,
        ...(parsed.settings?.goals || {}),
        customGoalWeights: {
          ...DEFAULT_SETTINGS_V2.goals.customGoalWeights,
          ...(parsed.settings?.goals?.customGoalWeights || {})
        }
      },
      stimulus: { ...DEFAULT_SETTINGS_V2.stimulus, ...(parsed.settings?.stimulus || {}) },
      social: { ...DEFAULT_SETTINGS_V2.social, ...(parsed.settings?.social || {}) },
      routinePreferences: cleanedRoutinePrefs.length > 0 ? cleanedRoutinePrefs : DEFAULT_SETTINGS_V2.routinePreferences
    };

    const hydratedHistory = Array.isArray(parsed.history)
      ? parsed.history.map(normalizeWorkoutFromStorage).filter(Boolean)
      : [];

    const hydratedSavedRoutines = Array.isArray(parsed.savedRoutines)
      ? parsed.savedRoutines.map(r => ({
        ...r,
        slots: normalizeSlotLabels((r.slots || []).map(normalizeSlotFromStorage).filter(Boolean))
      }))
      : [];

    const hydratedSharedRoutines = Array.isArray(parsed.sharedRoutines)
      ? parsed.sharedRoutines.map(r => ({
        ...r,
        slots: normalizeSlotLabels((r.slots || []).map(normalizeSlotFromStorage).filter(Boolean))
      }))
      : [];

    return {
      user: parsed.user !== undefined ? parsed.user : null,
      oneRepMaxes: mergedMaxes,
      history: hydratedHistory,
      activeSession: parsed.activeSession ? normalizeWorkoutFromStorage(parsed.activeSession) : null,
      savedRoutines: hydratedSavedRoutines,
      sharedRoutines: hydratedSharedRoutines,
      gyms: Array.isArray(parsed.gyms) ? parsed.gyms : [],
      friendsList: Array.isArray(parsed.friendsList) ? parsed.friendsList : [],
      pendingIncomingRequests: Array.isArray(parsed.pendingIncomingRequests) ? parsed.pendingIncomingRequests : [],
      outgoingInvites: Array.isArray(parsed.outgoingInvites) ? parsed.outgoingInvites : [],
      settings: mergedSettings
    };
  } catch (err) {
    console.warn('State hydration warning, falling back to defaults:', err);
    return null;
  }
};

// ============================================================================
// 6. MAIN KINETIC APPLICATION COMPONENT
// ============================================================================

export default function App() {
  const colors = IOS_DARK;

  const hydratedRef = useRef(undefined);
  if (hydratedRef.current === undefined) {
    hydratedRef.current = loadHydratedAppState();
  }
  const initialHydrated = hydratedRef.current;

  // --- Navigation & Drawer State ---
  const [currentView, setCurrentView] = useState('home');
  const [showHamburgerDrawer, setShowHamburgerDrawer] = useState(false);
  const [marqueePaused, setMarqueePaused] = useState(false);
  const importBackupInputRef = useRef(null);

  // --- User & Auth State ---
  const [user, setUser] = useState(() => (initialHydrated?.user !== undefined ? initialHydrated.user : null));
  const [authMode, setAuthMode] = useState('login');
  const [authUsername, setAuthUsername] = useState(() => initialHydrated?.user?.username || '');
  const [authEmail, setAuthEmail] = useState(() => initialHydrated?.user?.email || '');
  const [authPassword, setAuthPassword] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupBetaCode, setSignupBetaCode] = useState('');
  const fileInputRef = useRef(null);

  // --- 1RM & History State ---
  const [oneRepMaxes, setOneRepMaxes] = useState(() => initialHydrated?.oneRepMaxes || getInitial1RMs());
  const [history, setHistory] = useState(() => initialHydrated?.history || []);

  // --- Active Session, Historical Entry, Routine Editor & Preview State ---
  const [activeSession, setActiveSession] = useState(() => initialHydrated?.activeSession || null);
  const [historicalDraft, setHistoricalDraft] = useState(null);
  const [routineDraft, setRoutineDraft] = useState(null);
  const [previewRoutineDraft, setPreviewRoutineDraft] = useState(null);
  const [routineSelectReturnView, setRoutineSelectReturnView] = useState(null);
  const [isCurrentEditorShared, setIsCurrentEditorShared] = useState(false);

  // --- Delete Confirmation Modal State (for Exercise Slot or Individual Set) ---
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  // --- Add Exercise Modal State ---
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [addSlotGymFilter, setAddSlotGymFilter] = useState('');
  const [newSlotCategory, setNewSlotCategory] = useState('Compound Lift');
  const [newSlotEx1, setNewSlotEx1] = useState('barbell_bench_press');
  const [newSlotSupersetIds, setNewSlotSupersetIds] = useState(['reverse_lunge', 'front_flies']);
  const [newSlotScheme, setNewSlotScheme] = useState('5x8');

  // --- Saved & Shared Routines State ---
  const [savedRoutines, setSavedRoutines] = useState(() => initialHydrated?.savedRoutines || []);
  const [sharedRoutines, setSharedRoutines] = useState(() => initialHydrated?.sharedRoutines || []);

  // --- Gyms & Gym Editor State ---
  const [gyms, setGyms] = useState(() => initialHydrated?.gyms || []);
  const [selectedGymId, setSelectedGymId] = useState(() => initialHydrated?.settings?.selectedGymId || '');
  const [gymDraft, setGymDraft] = useState(null);

  // --- Goals, Standards & Settings State ---
  const [goalType, setGoalType] = useState(() => initialHydrated?.settings?.goals?.goalType || 'Strength');
  const [goalIncrement, setGoalIncrement] = useState(() => initialHydrated?.settings?.goals?.goalIncrement || 1.25);
  const [goalUnit, setGoalUnit] = useState(() => initialHydrated?.settings?.goals?.goalUnit || 'lb');
  const [chartMetric, setChartMetric] = useState(() => initialHydrated?.settings?.goals?.chartMetric || 'weight');
  const [selectedChartLift, setSelectedChartLift] = useState('ALL');
  const [targetStandardClass, setTargetStandardClass] = useState(() => initialHydrated?.settings?.goals?.targetStandardClass || 'Intermediate');
  const [customGoalWeights, setCustomGoalWeights] = useState(() => initialHydrated?.settings?.goals?.customGoalWeights || {});

  const [userBodyweightLbs, setUserBodyweightLbs] = useState(() => initialHydrated?.settings?.bodyMetrics?.bodyweightLbs ?? 220);
  const [userHeightFeet, setUserHeightFeet] = useState(() => initialHydrated?.settings?.bodyMetrics?.heightFeet ?? 5);
  const [userHeightInches, setUserHeightInches] = useState(() => initialHydrated?.settings?.bodyMetrics?.heightInches ?? 10);
  const [stimulusGreenDays, setStimulusGreenDays] = useState(() => initialHydrated?.settings?.stimulus?.greenDays ?? 2);
  const [stimulusYellowDays, setStimulusYellowDays] = useState(() => initialHydrated?.settings?.stimulus?.yellowDays ?? 4);
  const [routinePreferences, setRoutinePreferences] = useState(
    () => initialHydrated?.settings?.routinePreferences || ['Compounds', 'Compounds', 'Supersets', 'Supersets', 'Abs']
  );
  const [shareStatsWithFriends, setShareStatsWithFriends] = useState(
    () => initialHydrated?.settings?.social?.shareStatsWithFriends ?? true
  );
  const [shareRoutinesWithFriends, setShareRoutinesWithFriends] = useState(
    () => initialHydrated?.settings?.social?.shareRoutinesWithFriends ?? true
  );

  // --- History Page Collapsible Sections State ---
  const [historySessionsExpanded, setHistorySessionsExpanded] = useState(true);
  const [historyPRsExpanded, setHistoryPRsExpanded] = useState(true);
  const [expandedHistoryWorkoutId, setExpandedHistoryWorkoutId] = useState(null);

  // --- Social & Friends State ---
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendsList, setFriendsList] = useState(() => initialHydrated?.friendsList || []);
  const [pendingIncomingRequests, setPendingIncomingRequests] = useState(() => initialHydrated?.pendingIncomingRequests || []);
  const [outgoingInvites, setOutgoingInvites] = useState(() => initialHydrated?.outgoingInvites || []);
  const [viewingFriendProfile, setViewingFriendProfile] = useState(null);

  const currentIncrementLbs = useMemo(
    () => getIncrementInLbs(goalIncrement, goalUnit, goalType),
    [goalIncrement, goalUnit, goalType]
  );

  // --- Debounced Automatic Versioned Persistence Effect (300ms) ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const debounceTimer = setTimeout(() => {
      try {
        const payload = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
          user, oneRepMaxes, history, activeSession, savedRoutines, sharedRoutines,
          gyms, friendsList, pendingIncomingRequests, outgoingInvites,
          settings: {
            schemaVersion: CURRENT_SCHEMA_VERSION,
            bodyMetrics: { bodyweightLbs: userBodyweightLbs, heightFeet: userHeightFeet, heightInches: userHeightInches },
            goals: { goalType, goalIncrement, goalUnit, chartMetric, targetStandardClass, customGoalWeights },
            stimulus: { greenDays: stimulusGreenDays, yellowDays: stimulusYellowDays },
            routinePreferences,
            social: { shareStatsWithFriends, shareRoutinesWithFriends },
            selectedGymId
          }
        };
        window.localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.warn('Failed to save state to localStorage:', err);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [
    user, oneRepMaxes, history, activeSession, savedRoutines, sharedRoutines,
    gyms, friendsList, pendingIncomingRequests, outgoingInvites, userBodyweightLbs,
    userHeightFeet, userHeightInches, goalType, goalIncrement, goalUnit, chartMetric,
    targetStandardClass, customGoalWeights, stimulusGreenDays, stimulusYellowDays,
    routinePreferences, shareStatsWithFriends, shareRoutinesWithFriends, selectedGymId
  ]);

  const handleExportBackupJSON = () => {
    try {
      const raw = window.localStorage.getItem(PERSISTENCE_KEY);
      if (!raw) return;
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `you-cant-cry-in-here-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleImportBackupJSON = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result || '{}');
        if (!parsed || typeof parsed !== 'object') return;
        window.localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(parsed));
        const rehydrated = loadHydratedAppState();
        if (rehydrated) {
          setUser(rehydrated.user);
          setOneRepMaxes(rehydrated.oneRepMaxes);
          setHistory(rehydrated.history);
          setActiveSession(rehydrated.activeSession);
          if (rehydrated.savedRoutines) setSavedRoutines(rehydrated.savedRoutines);
          if (rehydrated.sharedRoutines) setSharedRoutines(rehydrated.sharedRoutines);
          if (rehydrated.gyms) setGyms(rehydrated.gyms);
          if (rehydrated.friendsList) setFriendsList(rehydrated.friendsList);
          setUserBodyweightLbs(rehydrated.settings.bodyMetrics.bodyweightLbs);
          setUserHeightFeet(rehydrated.settings.bodyMetrics.heightFeet);
          setUserHeightInches(rehydrated.settings.bodyMetrics.heightInches);
          setGoalType(rehydrated.settings.goals.goalType);
          setGoalIncrement(rehydrated.settings.goals.goalIncrement);
          setGoalUnit(rehydrated.settings.goals.goalUnit);
          setTargetStandardClass(rehydrated.settings.goals.targetStandardClass);
          setCustomGoalWeights(rehydrated.settings.goals.customGoalWeights);
          setStimulusGreenDays(rehydrated.settings.stimulus.greenDays);
          setStimulusYellowDays(rehydrated.settings.stimulus.yellowDays);
          setRoutinePreferences(rehydrated.settings.routinePreferences);
          setShareStatsWithFriends(rehydrated.settings.social.shareStatsWithFriends);
          setShareRoutinesWithFriends(rehydrated.settings.social.shareRoutinesWithFriends);
          setSelectedGymId(rehydrated.settings.selectedGymId);
        }
      } catch {
        // ignore
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleResetToDemoDefaults = () => {
    const freshMaxes = getInitial1RMs();
    setUser(null);
    setOneRepMaxes(freshMaxes);
    setHistory([]);
    setActiveSession(null);
    setSavedRoutines([]);
    setSharedRoutines([]);
    setGyms([]);
    setFriendsList([]);
    setPendingIncomingRequests([]);
    setOutgoingInvites([]);
    setUserBodyweightLbs(220);
    setUserHeightFeet(5);
    setUserHeightInches(10);
    setGoalType('Strength');
    setGoalIncrement(1.25);
    setGoalUnit('lb');
    setTargetStandardClass('Intermediate');
    setCustomGoalWeights({});
    setStimulusGreenDays(2);
    setStimulusYellowDays(4);
    setRoutinePreferences(['Compounds', 'Compounds', 'Supersets', 'Supersets', 'Abs']);
    setShareStatsWithFriends(true);
    setShareRoutinesWithFriends(true);
    setSelectedGymId('');
  };

  // --- Plate & Weight Calculator Modal State ---
  const [plateCalcTarget, setPlateCalcTarget] = useState(null);
  const [calcUnit, setCalcUnit] = useState('lb');
  const [calcMode, setCalcMode] = useState('per_side');
  const [calcBarWeight, setCalcBarWeight] = useState(45);
  const [calcPlatesPerSide, setCalcPlatesPerSide] = useState([]);
  const [calcDirectTotal, setCalcDirectTotal] = useState(135);

  // --- Isolated Rest Timer Trigger State ---
  const [timerTrigger, setTimerTrigger] = useState({
    isRunning: false,
    targetSeconds: 90,
    startedAtMs: null
  });

  // ============================================================================
  // 7. COMPUTED TELEMETRY, STIMULUS MAP & PROGRESSION SERIES
  // ============================================================================

  const totalHeightInches = useMemo(() => {
    return (Number(userHeightFeet) || 5) * 12 + (Number(userHeightInches) || 10);
  }, [userHeightFeet, userHeightInches]);

  const [stimulusNowMs, setStimulusNowMs] = useState(null);
  useEffect(() => {
    setStimulusNowMs(Date.now());
  }, [history]);

  const muscleStimulusStatus = useMemo(() => {
    const groups = ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core'];
    const result = {};

    groups.forEach(g => {
      let minDays = 99;
      if (stimulusNowMs !== null) {
        history.forEach(w => {
          const daysAgo = Math.max(0, Math.floor((stimulusNowMs - new Date(w.startedAt).getTime()) / 86400000));
          (w.slots || []).forEach(slot => {
            const ids =
              slot.category === 'Supersets' && slot.supersetExerciseIds
                ? slot.supersetExerciseIds
                : [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
            ids.forEach(id => {
              const ex = EXERCISE_MAP[id];
              if (ex && ex.muscleGroup === g && daysAgo < minDays) {
                minDays = daysAgo;
              }
            });
          });
        });
      }

      const greenMax = Number(stimulusGreenDays) || 2;
      const yellowMax = Number(stimulusYellowDays) || 4;
      let statusColor = '#FF3B30';
      let statusLabel = `${yellowMax + 1}+ DAYS`;
      if (minDays <= greenMax) {
        statusColor = '#30D158';
        statusLabel = `${minDays}D AGO (FRESH)`;
      } else if (minDays <= yellowMax) {
        statusColor = '#FFD60A';
        statusLabel = `${minDays}D AGO (READY)`;
      } else if (minDays < 99) {
        statusLabel = `${minDays}D AGO (DUE)`;
      } else {
        statusLabel = 'UNLOGGED';
      }

      result[g] = { daysAgo: minDays, color: statusColor, label: statusLabel };
    });

    return result;
  }, [history, stimulusGreenDays, stimulusYellowDays, stimulusNowMs]);

  const progressionSeriesByLift = useMemo(() => {
    const sorted = [...history].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    const map = {};
    BIG_FOUR_IDS.forEach(liftId => {
      const points = [];
      sorted.forEach(w => {
        let topWeight = 0;
        let totalVol = 0;
        (w.slots || []).forEach(slot => {
          if (slot.exerciseId === liftId) {
            (slot.sets || []).forEach(s => {
              if (s.completed && s.weight > 0) {
                if (s.weight > topWeight) topWeight = s.weight;
                totalVol += (Number(s.weight) || 0) * (Number(s.reps) || 0);
              }
            });
          }
        });
        if (topWeight > 0 || totalVol > 0) {
          points.push({
            dateLabel: new Date(w.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            weight: topWeight,
            volume: totalVol
          });
        }
      });
      map[liftId] = points;
    });
    return map;
  }, [history]);

  // ============================================================================
  // 8. ROUTINE EDITOR & WORKOUT MUTATION HANDLERS
  // ============================================================================

  const getCurrentEditorWorkout = () => {
    if (currentView === 'historical_entry') return historicalDraft;
    if (currentView === 'routine_editor') return routineDraft;
    if (currentView === 'routine_preview') return previewRoutineDraft;
    return activeSession;
  };

  const updateCurrentWorkoutState = updater => {
    setIsCurrentEditorShared(false);
    if (currentView === 'historical_entry') {
      setHistoricalDraft(prev => {
        const next = updater(prev);
        return next ? { ...next, slots: normalizeSlotLabels(next.slots) } : next;
      });
    } else if (currentView === 'routine_editor') {
      setRoutineDraft(prev => {
        const next = updater(prev);
        return next ? { ...next, slots: normalizeSlotLabels(next.slots) } : next;
      });
    } else if (currentView === 'routine_preview') {
      setPreviewRoutineDraft(prev => {
        const next = updater(prev);
        return next ? { ...next, slots: normalizeSlotLabels(next.slots) } : next;
      });
    } else {
      setActiveSession(prev => {
        const next = updater(prev);
        return next ? { ...next, slots: normalizeSlotLabels(next.slots) } : next;
      });
    }
  };

  const buildGeneratedAutoSlots = () => {
    const compatiblePool = EXERCISE_LIBRARY.filter(ex =>
      isExerciseCompatibleWithGymSelection(ex, selectedGymId, gyms)
    );
    const fallbackPool = compatiblePool.length > 0 ? compatiblePool : EXERCISE_LIBRARY;

    const compatCompounds = compatiblePool.filter(e => e.category === 'Compound Lift');
    const compatAccessories = compatiblePool.filter(e => e.category === 'Accessories');
    const compatAbs = compatiblePool.filter(e => e.category === 'Abs');

    let compIdx = 0;
    let accIdx = 0;

    const generatedSlots = routinePreferences
      .filter(pref => pref !== 'Warmup')
      .map(pref => {
        if (pref === 'Compounds') {
          const pool = compatCompounds.length > 0 ? compatCompounds : fallbackPool;
          const pick = pool[compIdx % Math.max(1, pool.length)] || EXERCISE_MAP.dumbbell_press;
          compIdx += 1;
          return createWorkoutSlot({
            category: 'Compound Lift',
            slotLabel: `Compound Lift ${compIdx}`,
            exerciseId: pick.id,
            scheme: '5x8',
            oneRepMaxes,
            history,
            incrementLbs: currentIncrementLbs
          });
        }
        if (pref === 'Supersets') {
          const pool = compatAccessories.length > 0 ? compatAccessories : fallbackPool;
          const a1 = pool[accIdx % Math.max(1, pool.length)] || EXERCISE_MAP.reverse_lunge;
          const a2 = pool[(accIdx + 1) % Math.max(1, pool.length)] || EXERCISE_MAP.front_flies;
          accIdx += 2;
          return createWorkoutSlot({
            category: 'Supersets',
            slotLabel: 'Superset',
            supersetExerciseIds: [a1.id, a2.id],
            scheme: '5x8',
            oneRepMaxes,
            history,
            incrementLbs: currentIncrementLbs
          });
        }
        if (pref === 'Accessories') {
          const pool = compatAccessories.length > 0 ? compatAccessories : fallbackPool;
          const pick = pool[accIdx % Math.max(1, pool.length)] || EXERCISE_MAP.dumbbell_hammer_curl;
          accIdx += 1;
          return createWorkoutSlot({
            category: 'Accessories',
            slotLabel: 'Accessories',
            exerciseId: pick.id,
            scheme: '5x8',
            oneRepMaxes,
            history,
            incrementLbs: currentIncrementLbs
          });
        }
        const absPick =
          compatAbs[0] ||
          fallbackPool.find(e => e.category === 'Abs') ||
          fallbackPool[0] ||
          EXERCISE_MAP.hollow_holds;
        return createWorkoutSlot({
          category: 'Abs',
          slotLabel: 'Abs',
          exerciseId: absPick.id,
          oneRepMaxes,
          history,
          incrementLbs: currentIncrementLbs
        });
      });

    return normalizeSlotLabels(generatedSlots);
  };

  const handleOpenNewSession = () => {
    if (!activeSession) {
      setActiveSession({
        id: `session_${Date.now()}`,
        title: getDefaultSessionName(),
        loadedRoutineTitle: 'MANUAL',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        defaultRestSeconds: 90,
        gymId: selectedGymId,
        slots: []
      });
    } else {
      setActiveSession(prev => ({
        ...prev,
        title: prev.title || getDefaultSessionName(),
        loadedRoutineTitle: prev.loadedRoutineTitle || 'MANUAL'
      }));
    }
    setIsCurrentEditorShared(false);
    setCurrentView('session');
  };

  // Home Page "New Auto" shortcut: skips preview and automatically applies the generated workout
  const handleOpenNewAutoSession = () => {
    const autoSlots = buildGeneratedAutoSlots();
    const autoTitle = getDefaultAutoSessionName();
    setActiveSession({
      id: `session_${Date.now()}`,
      title: autoTitle,
      loadedRoutineTitle: 'AUTO',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      defaultRestSeconds: 90,
      gymId: selectedGymId,
      slots: autoSlots
    });
    setIsCurrentEditorShared(false);
    setCurrentView('session');
  };

  const handleOpenPreviewRoutine = (routineObj, returnToView = 'routines') => {
    setPreviewRoutineDraft({
      key: routineObj.key,
      title: formatTitleWithDate(routineObj.label),
      baseRoutineLabel: routineObj.label,
      loadedRoutineTitle: routineObj.label,
      defaultRestSeconds: 90,
      slots: normalizeSlotLabels(
        cloneSlots(
          routineObj.slots ||
          buildPresetSlots(routineObj.key, oneRepMaxes, history, currentIncrementLbs)
        )
      )
    });
    setRoutineSelectReturnView(returnToView);
    setCurrentView('routine_preview');
  };

  const handleDirectLoadRoutine = (routineObj, returnToView = 'session') => {
    const builtSlots = normalizeSlotLabels(
      cloneSlots(
        routineObj.slots ||
        buildPresetSlots(routineObj.key, oneRepMaxes, history, currentIncrementLbs)
      )
    );
    const datedTitle = formatTitleWithDate(routineObj.label);
    const routineLabel = routineObj.label || datedTitle;

    if (returnToView === 'historical_entry') {
      setHistoricalDraft(prev => ({
        ...(prev || { id: `hist_${Date.now()}`, workoutDate: new Date().toISOString().split('T')[0] }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        slots: builtSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('historical_entry');
    } else if (returnToView === 'routine_editor') {
      setRoutineDraft(prev => ({
        ...(prev || { key: `routine_${Date.now()}`, isEditingExisting: false, defaultRestSeconds: 90 }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        slots: builtSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('routine_editor');
    } else {
      setActiveSession(prev => ({
        ...(prev || { id: `session_${Date.now()}`, startedAt: new Date().toISOString(), defaultRestSeconds: 90 }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        updatedAt: new Date().toISOString(),
        slots: builtSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('session');
    }
  };

  const handleApplyPreviewRoutine = () => {
    if (!previewRoutineDraft) return;
    const clonedSlots = normalizeSlotLabels(cloneSlots(previewRoutineDraft.slots));
    const datedTitle = previewRoutineDraft.title || getDefaultSessionName();
    const routineLabel = previewRoutineDraft.baseRoutineLabel || previewRoutineDraft.title || datedTitle;

    if (routineSelectReturnView === 'historical_entry') {
      setHistoricalDraft(prev => ({
        ...(prev || { id: `hist_${Date.now()}`, workoutDate: new Date().toISOString().split('T')[0] }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        slots: clonedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('historical_entry');
    } else if (routineSelectReturnView === 'routine_editor') {
      setRoutineDraft(prev => ({
        ...(prev || { key: `routine_${Date.now()}`, isEditingExisting: false, defaultRestSeconds: 90 }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        slots: clonedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('routine_editor');
    } else {
      setActiveSession(prev => ({
        ...(prev || { id: `session_${Date.now()}`, startedAt: new Date().toISOString(), defaultRestSeconds: 90 }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        updatedAt: new Date().toISOString(),
        slots: clonedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('session');
    }
  };

  const handleAutoBuildWorkout = () => {
    const generatedSlots = buildGeneratedAutoSlots();
    const autoTitle = getDefaultAutoSessionName();
    const returnTarget =
      currentView === 'historical_entry' ||
        currentView === 'routine_editor' ||
        currentView === 'session'
        ? currentView
        : routineSelectReturnView || 'session';

    setPreviewRoutineDraft({
      key: `auto_${Date.now()}`,
      title: autoTitle,
      baseRoutineLabel: 'AUTO',
      loadedRoutineTitle: 'AUTO',
      defaultRestSeconds: 90,
      slots: generatedSlots
    });
    setRoutineSelectReturnView(returnTarget);
    setCurrentView('routine_preview');
  };

  const handleSaveCurrentEditor = () => {
    const currentWorkout = getCurrentEditorWorkout();
    if (!currentWorkout || !currentWorkout.slots || currentWorkout.slots.length === 0) {
      return;
    }

    if (currentView === 'routine_editor') {
      const routineItem = {
        key: currentWorkout.key || `routine_${Date.now()}`,
        label: currentWorkout.title || 'Saved Routine',
        author: user?.username || 'test_lifter',
        slots: normalizeSlotLabels(currentWorkout.slots)
      };
      setSavedRoutines(prev => {
        const exists = prev.some(r => r.key === routineItem.key);
        return exists ? prev.map(r => (r.key === routineItem.key ? routineItem : r)) : [routineItem, ...prev];
      });
      setCurrentView('routines');
      return;
    }

    if (currentView === 'historical_entry') {
      const iso = new Date(`${currentWorkout.workoutDate || '2026-10-28'}T12:00:00`).toISOString();
      const entry = {
        ...currentWorkout,
        id: currentWorkout.id || `hist_${Date.now()}`,
        startedAt: iso,
        updatedAt: new Date().toISOString(),
        isComplete: true,
        verifiedByUser: true,
        slots: normalizeSlotLabels(currentWorkout.slots)
      };
      setHistory(prev => [entry, ...prev]);
      setHistoricalDraft(null);
      setCurrentView('history');
      return;
    }

    const entry = {
      ...currentWorkout,
      updatedAt: new Date().toISOString(),
      isComplete: checkIsWorkoutComplete(currentWorkout.slots),
      verifiedByUser: true
    };
    setHistory(prev => {
      const exists = prev.some(w => w.id === entry.id);
      return exists ? prev.map(w => (w.id === entry.id ? entry : w)) : [entry, ...prev];
    });
    // Clear activeSession after saving so clicking "New Session" again opens a clean, empty page
    setActiveSession(null);
    setCurrentView('home');
  };

  const handleShareCurrentEditor = () => {
    const currentWorkout = getCurrentEditorWorkout();
    if (!currentWorkout || !currentWorkout.slots || currentWorkout.slots.length === 0) return;
    const sharedItem = {
      key: `shared_${currentWorkout.id || currentWorkout.key || Date.now()}`,
      label: currentWorkout.title || 'Shared Routine',
      author: user?.username || 'test_lifter',
      slots: normalizeSlotLabels(cloneSlots(currentWorkout.slots))
    };
    setSharedRoutines(prev => {
      const exists = prev.some(r => r.label === sharedItem.label);
      return exists ? prev.map(r => (r.label === sharedItem.label ? sharedItem : r)) : [sharedItem, ...prev];
    });
    setIsCurrentEditorShared(true);
  };

  const handleResetCurrentEditor = () => {
    updateCurrentWorkoutState(prev => ({
      ...prev,
      loadedRoutineTitle: 'MANUAL',
      slots: []
    }));
  };

  const handleConfirmDeleteAction = () => {
    if (!deleteConfirmTarget) return;
    if (deleteConfirmTarget.type === 'slot') {
      updateCurrentWorkoutState(prev => ({
        ...prev,
        slots: (prev?.slots || []).filter(s => s.id !== deleteConfirmTarget.slotId)
      }));
    } else if (deleteConfirmTarget.type === 'set') {
      const { slotId, exIdx, setId } = deleteConfirmTarget;
      updateCurrentWorkoutState(prev => {
        if (!prev) return prev;
        const nextSlots = prev.slots.map(slot => {
          if (slot.id !== slotId) return slot;
          if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
            const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
              idx === exIdx
                ? (list || []).filter(st => st.id !== setId).map((st, i) => ({ ...st, setNumber: i + 1 }))
                : list
            );
            return {
              ...slot,
              supersetSetsByExercise: nextMatrix,
              sets: nextMatrix[0] || [],
              secondarySets: nextMatrix[1] || []
            };
          }
          const nextSets = (slot.sets || [])
            .filter(st => st.id !== setId)
            .map((st, i) => ({ ...st, setNumber: i + 1 }));
          return { ...slot, sets: nextSets, supersetSetsByExercise: [nextSets] };
        });
        return { ...prev, slots: nextSlots };
      });
    }
    setDeleteConfirmTarget(null);
  };

  const handleUpdateSlotCategoryOrExercise = (slotId, changes) => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;
        const currentEx = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
        const targetMuscleGroup =
          changes.exerciseId && EXERCISE_MAP[changes.exerciseId]
            ? EXERCISE_MAP[changes.exerciseId].muscleGroup
            : slot.familyMuscleGroup || currentEx.muscleGroup || 'Chest';

        const nextCategory = changes.category ?? slot.category;
        const nextScheme = changes.scheme ?? slot.scheme;
        let nextExId = changes.exerciseId ?? slot.exerciseId;
        let nextSupersetIds =
          changes.supersetExerciseIds ??
          slot.supersetExerciseIds ??
          [nextExId, slot.secondaryExerciseId].filter(Boolean);

        if (
          slot.category === 'Supersets' &&
          nextCategory === 'Supersets' &&
          changes.supersetExerciseIds &&
          !changes.scheme &&
          !changes.category
        ) {
          const cleanIds = [
            changes.supersetExerciseIds[0] || slot.exerciseId || 'reverse_lunge',
            changes.supersetExerciseIds[1] || slot.secondaryExerciseId || 'front_flies'
          ];
          const prevMatrix = slot.supersetSetsByExercise || [slot.sets || [], slot.secondarySets || []];
          const updatedMatrix = cleanIds.map((id, idx) => {
            const existingList =
              Array.isArray(prevMatrix[idx]) && prevMatrix[idx].length > 0
                ? prevMatrix[idx]
                : prevMatrix[0] || [];
            const calcMax = getHistoricalCalculated1RM(id, history, oneRepMaxes);
            const totalCount = existingList.length || 5;
            return existingList.map((st, sIdx) => {
              const lastW = calculateLastEquivalentWeightForSet(calcMax, st, totalCount, 'Supersets');
              const nextW = st.type === '1 Rep Max' ? roundTo5(calcMax) : roundToIncrement(lastW + currentIncrementLbs);
              return { ...st, setNumber: sIdx + 1, lastWeight: lastW, weight: nextW };
            });
          });

          return {
            ...slot,
            exerciseId: cleanIds[0],
            secondaryExerciseId: cleanIds[1],
            supersetExerciseIds: cleanIds,
            supersetSetsByExercise: updatedMatrix,
            sets: updatedMatrix[0] || [],
            secondarySets: updatedMatrix[1] || []
          };
        }

        if (changes.category && !changes.exerciseId) {
          if (nextCategory === 'Abs') {
            const absMatch = EXERCISE_LIBRARY.find(e => e.category === 'Abs');
            nextExId = absMatch ? absMatch.id : 'hollow_holds';
          } else if (nextCategory === 'Accessories') {
            const sameFamilyAcc = EXERCISE_LIBRARY.filter(e => e.category === 'Accessories' && e.muscleGroup === targetMuscleGroup);
            const fallbackAcc = EXERCISE_LIBRARY.filter(e => e.category === 'Accessories');
            nextExId = (sameFamilyAcc[0] || fallbackAcc[0] || currentEx).id;
          } else if (nextCategory === 'Compound Lift') {
            const sameFamilyComp = EXERCISE_LIBRARY.filter(e => e.category === 'Compound Lift' && e.muscleGroup === targetMuscleGroup);
            const fallbackComp = EXERCISE_LIBRARY.filter(e => e.category === 'Compound Lift');
            nextExId = (sameFamilyComp[0] || fallbackComp[0] || currentEx).id;
          } else if (nextCategory === 'Supersets') {
            const sameFamilyPool = EXERCISE_LIBRARY.filter(e => e.muscleGroup === targetMuscleGroup);
            const secondPick =
              sameFamilyPool.find(e => e.id !== nextExId) ||
              EXERCISE_LIBRARY.find(e => e.category === 'Accessories' && e.id !== nextExId) ||
              EXERCISE_MAP.front_flies;
            nextSupersetIds = [nextExId, secondPick.id].filter(Boolean);
          }
        }

        const rebuiltSlot = createWorkoutSlot({
          category: nextCategory,
          slotLabel: nextCategory,
          exerciseId: nextExId,
          supersetExerciseIds: nextCategory === 'Supersets' ? nextSupersetIds.slice(0, 2) : [nextExId],
          scheme: nextScheme,
          oneRepMaxes,
          history,
          incrementLbs: currentIncrementLbs,
          restSeconds: slot.restSeconds || 90
        });

        return { ...rebuiltSlot, id: slot.id, familyMuscleGroup: targetMuscleGroup };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  const handleUpdateSetField = (slotId, exIndex, setId, field, rawVal) => {
    const val = Math.max(0, Number(rawVal) || 0);
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;
        if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            idx === exIndex ? list.map(st => (st.id === setId ? { ...st, [field]: val } : st)) : list
          );
          return {
            ...slot,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }
        const nextSets = (slot.sets || []).map(st => (st.id === setId ? { ...st, [field]: val } : st));
        return { ...slot, sets: nextSets };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  const handleUpdateSetType = (slotId, exIndex, setId, newType) => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;

        const updateSingleSet = (st, exId, totalCount) => {
          if (st.id !== setId) return st;
          const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
          if (newType === '1 Rep Max') {
            return {
              ...st,
              type: newType,
              reps: 1,
              lastWeight: roundTo5(calc1RM),
              weight: roundTo5(calc1RM)
            };
          }
          const updatedSet = { ...st, type: newType };
          const lastW = calculateLastEquivalentWeightForSet(calc1RM, updatedSet, totalCount, slot.category);
          return {
            ...updatedSet,
            lastWeight: lastW,
            weight: roundToIncrement(lastW + currentIncrementLbs)
          };
        };

        if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
          const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            idx === exIndex
              ? list.map(st => updateSingleSet(st, supIds[idx] || slot.exerciseId, list.length))
              : list
          );
          return {
            ...slot,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }
        const totalLen = (slot.sets || []).length;
        const nextSets = (slot.sets || []).map(st => updateSingleSet(st, slot.exerciseId, totalLen));
        return { ...slot, sets: nextSets };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  const handleInsertSetAtPosition = (slotId, position = 'bottom') => {
    const isTop = position === 'top';
    const defaultSetType = isTop ? 'Warmup Set' : 'Burn Out Set';
    const ts = Date.now() + Math.floor(Math.random() * 10000);

    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;

        const insertIntoList = (list, exId) => {
          const currentList = Array.isArray(list) ? list : [];
          const refSet = isTop ? currentList[0] : currentList[currentList.length - 1];
          const base1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
          const nextCount = currentList.length + 1;
          const newReps = refSet ? refSet.reps : slot.category === 'Abs' ? 45 : 8;
          const draftSet = {
            id: `set_${ts}_${Math.random().toString(36).slice(2, 6)}`,
            setNumber: 1,
            type: defaultSetType,
            reps: newReps,
            completed: false
          };
          const lastW =
            slot.category === 'Abs'
              ? 0
              : calculateLastEquivalentWeightForSet(base1RM, draftSet, nextCount, slot.category);
          const newSet = {
            ...draftSet,
            lastWeight: lastW,
            weight: slot.category === 'Abs' ? 0 : roundToIncrement(lastW + currentIncrementLbs)
          };
          const combined = isTop ? [newSet, ...currentList] : [...currentList, newSet];
          return combined.map((st, idx) => ({ ...st, setNumber: idx + 1 }));
        };

        if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
          const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            insertIntoList(list, supIds[idx] || slot.exerciseId)
          );
          return {
            ...slot,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }

        const nextSets = insertIntoList(slot.sets || [], slot.exerciseId);
        return { ...slot, sets: nextSets, supersetSetsByExercise: [nextSets] };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  // Recalculate weights; if the last set is "1 Rep Max", turns all previous sets into Warmup Sets ramping up to the 1RM
  const handleRecalculateSlotWeights = slotId => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;

        const recalcList = (list, exId) => {
          const currentList = Array.isArray(list) ? list : [];
          const totalCount = currentList.length;
          const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);

          if (slot.category === 'Abs') {
            return currentList.map((st, idx) => ({ ...st, setNumber: idx + 1, lastWeight: 0, weight: 0 }));
          }

          const lastSetIs1RM =
            totalCount > 1 && currentList[totalCount - 1]?.type === '1 Rep Max';

          if (lastSetIs1RM) {
            const warmupCount = totalCount - 1;
            const maxW = roundTo5(calc1RM);
            return currentList.map((st, idx) => {
              if (idx === totalCount - 1) {
                return {
                  ...st,
                  setNumber: idx + 1,
                  type: '1 Rep Max',
                  reps: 1,
                  lastWeight: maxW,
                  weight: roundToIncrement(maxW + currentIncrementLbs)
                };
              }
              const pct =
                warmupCount === 1
                  ? 0.70
                  : 0.50 + (idx / (warmupCount - 1)) * 0.35;
              const warmupReps = Math.max(1, Math.round(8 - (idx / Math.max(1, warmupCount - 1)) * 6));
              const warmupW = roundTo5(calc1RM * pct);
              return {
                ...st,
                setNumber: idx + 1,
                type: 'Warmup Set',
                reps: warmupReps,
                lastWeight: warmupW,
                weight: warmupW
              };
            });
          }

          return currentList.map((st, idx) => {
            if (st.type === '1 Rep Max') {
              const maxW = roundTo5(calc1RM);
              return { ...st, setNumber: idx + 1, reps: 1, lastWeight: maxW, weight: maxW };
            }
            const lastW = calculateLastEquivalentWeightForSet(calc1RM, st, totalCount, slot.category);
            const targetW = roundToIncrement(lastW + currentIncrementLbs);
            return { ...st, setNumber: idx + 1, lastWeight: lastW, weight: targetW };
          });
        };

        if (slot.category === 'Supersets' && Array.isArray(slot.supersetSetsByExercise)) {
          const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            recalcList(list, supIds[idx] || slot.exerciseId)
          );
          return {
            ...slot,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }

        const nextSets = recalcList(slot.sets || [], slot.exerciseId);
        return { ...slot, sets: nextSets, supersetSetsByExercise: [nextSets] };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  const handleToggleSetDone = (slot, exIndex, setItem) => {
    const markingDone = !setItem.completed;
    if (markingDone && isRoutineEditorView) {
      setTimerTrigger({
        isRunning: true,
        targetSeconds: slot.restSeconds || currentEditorWorkout?.defaultRestSeconds || 90,
        startedAtMs: Date.now()
      });
    }
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(s => {
        if (s.id !== slot.id) return s;
        if (s.category === 'Supersets' && Array.isArray(s.supersetSetsByExercise)) {
          const nextMatrix = s.supersetSetsByExercise.map((list, idx) =>
            idx === exIndex
              ? list.map(st => (st.id === setItem.id ? { ...st, completed: markingDone } : st))
              : list
          );
          return {
            ...s,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }
        return {
          ...s,
          sets: (s.sets || []).map(st => (st.id === setItem.id ? { ...st, completed: markingDone } : st))
        };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  const handleAddManualSlot = () => {
    const newSlot = createWorkoutSlot({
      category: newSlotCategory,
      slotLabel: newSlotCategory,
      exerciseId: newSlotEx1,
      supersetExerciseIds:
        newSlotCategory === 'Supersets'
          ? newSlotSupersetIds.length >= 2
            ? newSlotSupersetIds.slice(0, 2)
            : ['reverse_lunge', 'front_flies']
          : [newSlotEx1],
      scheme: newSlotScheme,
      oneRepMaxes,
      history,
      incrementLbs: currentIncrementLbs
    });
    updateCurrentWorkoutState(prev => ({
      ...(prev || { id: `session_${Date.now()}`, title: getDefaultSessionName(), slots: [] }),
      slots: [...(prev?.slots || []), newSlot]
    }));
    setShowAddSlotModal(false);
  };

  const decomposeWeightToPlates = initialWeight => {
    const defaultBar = 45;
    setCalcUnit('lb');
    setCalcBarWeight(defaultBar);
    setCalcDirectTotal(initialWeight);
    const availableLbPlates = [45, 35, 25, 10, 5, 2.5, 1.25];
    let remPerSide = Math.max(0, (initialWeight - defaultBar) / 2);
    const initialPlates = [];
    availableLbPlates.forEach(plate => {
      while (remPerSide >= plate - 0.01) {
        initialPlates.push(plate);
        remPerSide = Math.round((remPerSide - plate) * 100) / 100;
      }
    });
    setCalcPlatesPerSide(initialPlates.sort((a, b) => b - a));
    setCalcMode('per_side');
  };

  const openPlateCalculatorForSet = (slotId, exIndex, setItem, exerciseName) => {
    decomposeWeightToPlates(Number(setItem.weight) || 135);
    setPlateCalcTarget({
      mode: 'set', slotId, exIndex, setId: setItem.id, setNumber: setItem.setNumber, exerciseName
    });
  };

  const openPlateCalculatorForPR = (exerciseId, exerciseName, currentWeight) => {
    decomposeWeightToPlates(Number(currentWeight) || 225);
    setPlateCalcTarget({ mode: 'pr', exerciseId, exerciseName });
  };

  const openPlateCalculatorForGoal = (exerciseId, exerciseName, currentGoalWeight) => {
    decomposeWeightToPlates(Number(currentGoalWeight) || 225);
    setPlateCalcTarget({ mode: 'goal', exerciseId, exerciseName });
  };

  const computedPlateCalculatorTotal = useMemo(() => {
    if (calcMode === 'total') return Math.max(0, Number(calcDirectTotal) || 0);
    const oneSideSum = calcPlatesPerSide.reduce((acc, p) => acc + p, 0);
    return Math.round((calcBarWeight + oneSideSum * 2) * 100) / 100;
  }, [calcMode, calcDirectTotal, calcPlatesPerSide, calcBarWeight]);

  const handleApplyCalculatedWeight = () => {
    if (!plateCalcTarget) return;
    const finalWeightLbs =
      calcUnit === 'kg'
        ? Math.round(computedPlateCalculatorTotal * 2.20462 * 4) / 4
        : computedPlateCalculatorTotal;

    if (plateCalcTarget.mode === 'set') {
      handleUpdateSetField(
        plateCalcTarget.slotId,
        plateCalcTarget.exIndex,
        plateCalcTarget.setId,
        'weight',
        finalWeightLbs
      );
    } else if (plateCalcTarget.mode === 'pr') {
      setOneRepMaxes(prev => ({
        ...prev,
        [plateCalcTarget.exerciseId]: roundTo5(finalWeightLbs)
      }));
    } else if (plateCalcTarget.mode === 'goal') {
      setCustomGoalWeights(prev => ({
        ...prev,
        [plateCalcTarget.exerciseId]: roundTo5(finalWeightLbs)
      }));
      setTargetStandardClass('Custom');
    }
    setPlateCalcTarget(null);
  };

  // ============================================================================
  // 9. RENDER KINETIC INTERFACE
  // ============================================================================

  const isRoutineEditorView =
    currentView === 'session' ||
    currentView === 'historical_entry' ||
    currentView === 'routine_editor' ||
    currentView === 'routine_preview';

  const currentEditorWorkout = getCurrentEditorWorkout();

  return (
    <div className="kinetic-app min-h-screen flex justify-center bg-[#080808] text-white">
      <style>{KINETIC_CSS}</style>

      <div
        style={{
          width: '100%', maxWidth: '480px', minHeight: '100vh',
          backgroundColor: 'var(--dp-color-ground)',
          borderLeft: '2px solid var(--dp-color-rule)',
          borderRight: '2px solid var(--dp-color-rule)',
          display: 'flex', flexDirection: 'column', position: 'relative', containerType: 'inline-size'
        }}
      >
        {/* TOP NAVIGATION BAR */}
        <header
          style={{
            position: 'sticky', top: 0, zIndex: 30,
            backgroundColor: 'var(--dp-color-ground)',
            borderBottom: '2px solid var(--dp-color-rule)',
            padding: '12px var(--dp-spacing-gutter)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            {currentView === 'home' ? (
              <button
                type="button"
                aria-label="Open navigation menu"
                onClick={() => setShowHamburgerDrawer(true)}
                className="kinetic-btn"
                style={{
                  width: '40px', height: '40px', backgroundColor: '#161616',
                  border: '2px solid var(--dp-color-rule)', color: '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}
              >
                <SFSymbol name="line.3.horizontal" size={20} color="#FFFFFF" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (currentView === 'friend_profile') setCurrentView('social');
                  else if (currentView === 'gym_editor') setCurrentView('gyms');
                  else if (currentView === 'routine_editor') setCurrentView('routines');
                  else if (currentView === 'routine_preview') setCurrentView(routineSelectReturnView || 'routines');
                  else if (currentView === 'routines' && routineSelectReturnView) {
                    const ret = routineSelectReturnView;
                    setRoutineSelectReturnView(null);
                    setCurrentView(ret);
                  } else setCurrentView('home');
                }}
                className="kinetic-btn"
                style={{
                  padding: '8px 12px', backgroundColor: '#161616', border: '2px solid var(--dp-color-rule)',
                  color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                }}
              >
                <SFSymbol name="chevron.backward" size={16} color="var(--dp-color-accent)" />
                <span>BACK</span>
              </button>
            )}

            <div
              style={{
                fontSize: '14px', fontWeight: 800, letterSpacing: '-0.03em',
                textTransform: 'uppercase', color: '#FFFFFF', textAlign: 'center', flex: 1,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
              }}
            >
              {currentView !== 'home' ? "You Can't Cry in Here" : ''}
            </div>

            <div style={{ width: '40px' }} />
          </div>

          {isRoutineEditorView && currentEditorWorkout && (
            <SessionRestTimerBar
              defaultRestSeconds={currentEditorWorkout.defaultRestSeconds || 90}
              timerTrigger={timerTrigger}
              nextLiftInfo={getNextIncompleteSetInfo(currentEditorWorkout.slots)}
              onChangeDefaultRest={sec => {
                updateCurrentWorkoutState(prev => ({ ...prev, defaultRestSeconds: sec }));
                setTimerTrigger(prev => ({ ...prev, targetSeconds: sec }));
              }}
              onStopTimer={() => setTimerTrigger(prev => ({ ...prev, isRunning: false, startedAtMs: null }))}
            />
          )}
        </header>

        {/* SLIDE-OUT HAMBURGER DRAWER */}
        {showHamburgerDrawer && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex'
            }}
            onClick={() => setShowHamburgerDrawer(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '300px', maxWidth: '82vw', height: '100%', backgroundColor: '#101010',
                borderRight: '2px solid var(--dp-color-rule)', padding: '20px 16px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '24px', fontWeight: 800, letterSpacing: '-0.045em', textTransform: 'uppercase',
                    borderBottom: '2px solid var(--dp-color-rule)', paddingBottom: '12px', marginBottom: '16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <span>MENU</span>
                  <button
                    type="button"
                    onClick={() => setShowHamburgerDrawer(false)}
                    style={{
                      background: 'var(--dp-color-accent)', color: '#101010', border: 'none',
                      padding: '4px 8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHamburgerDrawer(false);
                      setCurrentView(user ? 'profile' : 'auth');
                    }}
                    className="kinetic-btn"
                    style={UI.drawerBtn(true)}
                  >
                    <span>{user ? `00 / PROFILE (@${user.username})` : '00 / SIGN IN'}</span>
                    <span>→</span>
                  </button>

                  {[
                    { id: 'routines', label: '01 / ROUTINES', clearReturn: true },
                    { id: 'gyms', label: '02 / GYMS/EQUIPMENT' },
                    { id: 'goals', label: '03 / GOALS' },
                    { id: 'settings', label: '04 / SETTINGS' },
                    { id: 'info', label: '05 / INFO' }
                  ].map(nav => (
                    <button
                      key={nav.id}
                      type="button"
                      onClick={() => {
                        setShowHamburgerDrawer(false);
                        if (nav.clearReturn) setRoutineSelectReturnView(null);
                        setCurrentView(nav.id);
                      }}
                      className="kinetic-btn"
                      style={UI.drawerBtn(false)}
                    >
                      <span>{nav.label}</span>
                      <span>→</span>
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  borderTop: '2px solid var(--dp-color-rule)', paddingTop: '12px',
                  fontSize: '11px', color: '#888888', fontWeight: 700, textTransform: 'uppercase'
                }}
              >
                LOGGED IN: {user ? user.email : 'OFFLINE'}
              </div>
            </div>
          </div>
        )}

        {/* PERSISTENT LOGGED-OUT ORANGE NOTIFICATION BAR */}
        {!user && (
          <div
            style={{
              margin: '12px var(--dp-spacing-gutter) 0', padding: '12px 14px',
              backgroundColor: 'var(--dp-color-accent)', color: '#101010', border: '2px solid #FFFFFF',
              fontWeight: 800, fontSize: '12px', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap'
            }}
          >
            <span>NOT SIGNED IN</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setCurrentView('auth');
                }}
                className="kinetic-btn"
                style={{
                  background: '#101010', color: '#FFFFFF', border: '2px solid #101010',
                  padding: '5px 10px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                }}
              >
                SIGN IN
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setCurrentView('auth');
                }}
                className="kinetic-btn"
                style={{
                  background: '#FFFFFF', color: '#101010', border: '2px solid #101010',
                  padding: '5px 10px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                }}
              >
                CREATE ACCOUNT
              </button>
            </div>
          </div>
        )}

        {/* MAIN VIEWPORT CONTENT */}
        <div style={{ flex: 1, paddingBottom: '48px' }}>
          {/* ================================================================== */}
          {/* VIEW: HOME SCREEN                                                  */}
          {/* ================================================================== */}
          {currentView === 'home' && (
            <div>
              <section
                style={{
                  padding: '18px var(--dp-spacing-gutter) 16px',
                  borderBottom: '2px solid var(--dp-color-rule)'
                }}
              >
                <div
                  style={{
                    fontSize: 'clamp(40px, 12.5cqw, 58px)', fontWeight: 800,
                    lineHeight: 0.92, letterSpacing: '-0.045em', textTransform: 'uppercase'
                  }}
                >
                  <div style={{ textAlign: 'left', marginBottom: '6px' }}>YOU CAN'T</div>
                  <div
                    style={{
                      backgroundColor: 'var(--dp-color-accent)', color: '#101010',
                      padding: '4px 12px', margin: '6px 0', textAlign: 'right'
                    }}
                  >
                    CRY
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <span>IN HERE</span>
                    <span style={{ color: 'var(--dp-color-accent)' }}>↘</span>
                  </div>
                </div>

                {/* Primary Actions: NEW SESSION, NEW AUTO, HISTORY */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '8px',
                    marginTop: '16px'
                  }}
                >
                  <button
                    type="button"
                    onClick={handleOpenNewSession}
                    className="kinetic-btn"
                    style={{
                      padding: '14px 10px', backgroundColor: 'var(--dp-color-accent)', color: '#101010',
                      border: '2px solid #FFFFFF', fontWeight: 800, fontSize: '13px',
                      textTransform: 'uppercase', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', cursor: 'pointer'
                    }}
                  >
                    <span>NEW SESSION</span>
                    <span>→</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenNewAutoSession}
                    className="kinetic-btn"
                    style={{
                      padding: '14px 10px', backgroundColor: '#FFFFFF', color: '#101010',
                      border: '2px solid var(--dp-color-accent)', fontWeight: 800, fontSize: '13px',
                      textTransform: 'uppercase', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', cursor: 'pointer'
                    }}
                  >
                    <span>NEW AUTO</span>
                    <span>⚡</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentView('history')}
                    className="kinetic-btn"
                    style={{
                      padding: '14px 10px', backgroundColor: '#161616', color: '#FFFFFF',
                      border: '2px solid var(--dp-color-rule)', fontWeight: 800, fontSize: '13px',
                      textTransform: 'uppercase', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', cursor: 'pointer'
                    }}
                  >
                    <span>HISTORY</span>
                    <span style={{ color: 'var(--dp-color-accent)' }}>↗</span>
                  </button>
                </div>
              </section>

              {/* REPEATED-TEXT MARQUEE BAND */}
              <div
                className={marqueePaused ? 'kinetic-marquee-paused' : ''}
                style={{
                  borderBottom: '2px solid var(--dp-color-rule)', backgroundColor: '#141414',
                  display: 'flex', alignItems: 'center', overflow: 'hidden', marginBottom: '22px'
                }}
              >
                <div style={{ flex: 1, overflow: 'hidden', padding: '8px 0' }}>
                  {(() => {
                    const friendsTickerText =
                      friendsList.length > 0
                        ? friendsList
                          .map(
                            f =>
                              `@${f.username.toUpperCase()}: BENCH 1RM ${f.prs?.barbell_bench_press || 185} LB • SQUAT 1RM ${f.prs?.barbell_back_squat || 265} LB • DEADLIFT 1RM ${f.prs?.barbell_deadlift || 315} LB • OHP 1RM ${f.prs?.overhead_press || 115} LB`
                          )
                          .join('   ///   ') + '   ///   '
                        : 'ADD FRIENDS IN SOCIAL TO STREAM LIVE 1RM UPDATES   ///   ';

                    return (
                      <div
                        className="kinetic-marquee-track"
                        style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}
                      >
                        <span style={{ paddingRight: '32px' }}>{friendsTickerText}</span>
                        <span aria-hidden="true" style={{ paddingRight: '32px' }}>{friendsTickerText}</span>
                      </div>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  onClick={() => setMarqueePaused(p => !p)}
                  style={{
                    backgroundColor: '#101010', color: '#FFFFFF', border: 'none',
                    borderLeft: '2px solid var(--dp-color-rule)', padding: '8px 10px',
                    fontSize: '10px', fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  {marqueePaused ? 'PLAY' : 'PAUSE'}
                </button>
              </div>

              {/* STATS SECTION ON HOME SCREEN */}
              <IOSListSection header="STATS" colors={colors}>
                {[
                  { id: 'progression_chart', idx: '01', title: 'PROGRESSION CHART', sub: 'Big 3 + OHP Weight & Volume Graphed Trends', num: '01' },
                  { id: 'stimulus_map', idx: '02', title: 'STIMULUS MAP', sub: 'Recovery Windows & Muscle Readiness', num: '02' },
                  { id: 'leaderboard', idx: '03', title: 'LEADERBOARD', sub: 'Big 3 + OHP Community Standings', num: '03' },
                  { id: 'social', idx: '04', title: 'SOCIAL', sub: `${friendsList.length} Friends • ${pendingIncomingRequests.length} Pending Request`, num: '04' }
                ].map((item, i, arr) => (
                  <IOSListRow
                    key={item.id}
                    indexLabel={item.idx}
                    bgNumeral={item.num}
                    isLast={i === arr.length - 1}
                    colors={colors}
                    onClick={() => {
                      setRoutineSelectReturnView(null);
                      setCurrentView(item.id);
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
                        {item.title}
                      </div>
                      <div className="kinetic-sub" style={{ fontSize: '12px', color: '#A0A0A0', fontWeight: 600 }}>
                        {item.sub}
                      </div>
                    </div>
                    <span style={{ fontSize: '20px', fontWeight: 800 }}>→</span>
                  </IOSListRow>
                ))}
              </IOSListSection>
            </div>
          )}

          {/* ================================================================== */}
          {/* VIEW: ROUTINE EDITOR (SESSION / HISTORICAL / ROUTINE / PREVIEW)    */}
          {/* ================================================================== */}
          {isRoutineEditorView && currentEditorWorkout && (
            <div style={{ paddingTop: '14px' }}>
              <IOSListSection
                header={
                  currentView === 'routine_editor'
                    ? 'ROUTINE BUILDER'
                    : currentView === 'routine_preview'
                      ? 'PREVIEW ROUTINE'
                      : currentView === 'historical_entry'
                        ? 'LOG PAST WORKOUT'
                        : 'ROUTINE EDITOR'
                }
                headerRight={
                  currentView === 'routine_preview' ? (
                    <button
                      type="button"
                      onClick={handleApplyPreviewRoutine}
                      className="kinetic-btn"
                      style={{
                        padding: '6px 10px',
                        backgroundColor: 'var(--dp-color-accent)',
                        color: '#101010',
                        border: '2px solid #FFFFFF',
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      APPLY ROUTINE TO WORKOUT →
                    </button>
                  ) : null
                }
                colors={colors}
              >
                {/* Compact Session Name Row */}
                <IOSListRow colors={colors} style={{ padding: '6px 10px' }}>
                  <div
                    style={{
                      width: '100%', backgroundColor: '#101010', border: '2px solid var(--dp-color-rule)',
                      padding: '5px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center'
                    }}
                  >
                    <div
                      style={{
                        fontSize: '9px', fontWeight: 800, color: 'var(--dp-color-accent)',
                        textTransform: 'uppercase', lineHeight: 1.1
                      }}
                    >
                      SESSION NAME
                    </div>
                    <input
                      type="text"
                      value={currentEditorWorkout.title || ''}
                      onChange={e => updateCurrentWorkoutState(prev => ({ ...prev, title: e.target.value }))}
                      style={{
                        width: '100%', backgroundColor: 'transparent', border: 'none', color: '#FFFFFF',
                        fontSize: '13px', fontWeight: 800, textTransform: 'uppercase',
                        outline: 'none', padding: 0, marginTop: '1px', lineHeight: 1.2
                      }}
                    />
                  </div>
                </IOSListRow>

                {/* Historical Date Row if logging past workout */}
                {currentView === 'historical_entry' && (
                  <IOSListRow colors={colors} style={{ padding: '6px 10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
                      WORKOUT DATE
                    </span>
                    <input
                      type="date"
                      value={currentEditorWorkout.workoutDate || ''}
                      onChange={e => setHistoricalDraft(prev => ({ ...prev, workoutDate: e.target.value }))}
                      style={{
                        backgroundColor: '#101010', color: '#FFFFFF',
                        border: '2px solid var(--dp-color-rule)', padding: '4px 8px',
                        fontSize: '11px', fontWeight: 800
                      }}
                    />
                  </IOSListRow>
                )}

                {/* Top Action Row: Retained across all editor & preview modes (Routines, Gyms/Equipment, Auto) */}
                <IOSListRow isLast={true} colors={colors} style={{ padding: '6px 10px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: '6px',
                      width: '100%',
                      alignItems: 'stretch'
                    }}
                  >
                    {/* Column 1: Routines */}
                    <button
                      type="button"
                      onClick={() => {
                        setRoutineSelectReturnView(
                          currentView === 'routine_preview' ? routineSelectReturnView || 'session' : currentView
                        );
                        setCurrentView('routines');
                      }}
                      className="kinetic-btn"
                      style={{
                        width: '100%', padding: '6px 8px', backgroundColor: '#101010',
                        border: '2px solid var(--dp-color-rule)', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        alignItems: 'flex-start', textAlign: 'left', minWidth: 0
                      }}
                    >
                      <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--dp-color-accent)', textTransform: 'uppercase', lineHeight: 1.1 }}>
                        ROUTINES ↗
                      </div>
                      <div
                        style={{
                          fontSize: '11px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', lineHeight: 1.2
                        }}
                      >
                        {currentEditorWorkout.loadedRoutineTitle || 'MANUAL'}
                      </div>
                    </button>

                    {/* Column 2: Gyms/Equipment */}
                    <div
                      style={{
                        width: '100%', position: 'relative', backgroundColor: '#101010',
                        border: '2px solid var(--dp-color-rule)', padding: '6px 8px',
                        display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0
                      }}
                    >
                      <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--dp-color-accent)', textTransform: 'uppercase', lineHeight: 1.1 }}>
                        GYMS/EQUIPMENT ▾
                      </div>
                      <div
                        style={{
                          fontSize: '11px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2
                        }}
                      >
                        {getGymSelectionLabel(selectedGymId, gyms)}
                      </div>
                      <select
                        aria-label="Select Gyms/Equipment"
                        value={selectedGymId}
                        onChange={e => setSelectedGymId(e.target.value)}
                        style={{
                          position: 'absolute', inset: 0, width: '100%', height: '100%',
                          opacity: 0, backgroundColor: '#101010', color: '#FFFFFF', cursor: 'pointer'
                        }}
                      >
                        {DEFAULT_GYM_EQUIPMENT_PRESETS.map(preset => (
                          <option key={preset.id || 'full_gym'} value={preset.id}>
                            {preset.name.toUpperCase()}
                          </option>
                        ))}
                        {gyms.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.name.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Column 3: Auto */}
                    <button
                      type="button"
                      onClick={handleAutoBuildWorkout}
                      className="kinetic-btn"
                      style={{
                        width: '100%', padding: '6px 8px', backgroundColor: 'var(--dp-color-accent)',
                        color: '#101010', border: '2px solid #FFFFFF', fontSize: '12px',
                        fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer',
                        whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0
                      }}
                    >
                      AUTO ⚡
                    </button>
                  </div>
                </IOSListRow>
              </IOSListSection>

              {/* ALWAYS-EXPANDED WORKOUT SLOTS WITH LOCKED COLUMN SIZES & SET DELETE CONFIRMATION */}
              <IOSListSection
                header={`WORKOUT SLOTS (${(currentEditorWorkout.slots || []).length})`}
                colors={colors}
              >
                {(currentEditorWorkout.slots || []).length === 0 ? null : (
                  (currentEditorWorkout.slots || []).map((slot, sIdx) => {
                    const ex1 = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
                    const isSuperset = slot.category === 'Supersets';
                    const inlineExercisePool = getFilteredExercisesForSlotInline(slot, selectedGymId, gyms);

                    const supIds = isSuperset
                      ? [
                        slot.supersetExerciseIds?.[0] || slot.exerciseId || 'reverse_lunge',
                        slot.supersetExerciseIds?.[1] || slot.secondaryExerciseId || 'front_flies'
                      ]
                      : [slot.exerciseId];

                    const alternatingSupersetRows = [];
                    if (isSuperset) {
                      const listA = slot.supersetSetsByExercise?.[0] || slot.sets || [];
                      const listB = slot.supersetSetsByExercise?.[1] || slot.secondarySets || [];
                      const maxLen = Math.max(listA.length, listB.length);
                      for (let i = 0; i < maxLen; i++) {
                        if (listA[i]) {
                          alternatingSupersetRows.push({
                            exIdx: 0, exId: supIds[0], setItem: listA[i], totalExSets: listA.length
                          });
                        }
                        if (listB[i]) {
                          alternatingSupersetRows.push({
                            exIdx: 1, exId: supIds[1], setItem: listB[i], totalExSets: listB.length
                          });
                        }
                      }
                    }

                    const renderSingleSetRow = (st, exIdx, exId, totalExSets) => {
                      const exObj = EXERCISE_MAP[exId] || EXERCISE_LIBRARY[0];
                      const curType = SET_TYPES_LIST.includes(st.type) ? st.type : 'Working Set';
                      const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
                      const lastW =
                        st.lastWeight !== undefined
                          ? st.lastWeight
                          : calculateLastEquivalentWeightForSet(calc1RM, st, totalExSets, slot.category);

                      return (
                        <div
                          key={`${exIdx}_${st.id}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) 26px',
                            gap: '6px',
                            alignItems: 'center'
                          }}
                        >
                          {/* Locked-down set containing box */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns:
                                slot.category === 'Abs'
                                  ? '36px minmax(0, 1fr) 48px 32px'
                                  : '36px minmax(0, 1fr) 44px 62px 48px 32px',
                              gap: '4px',
                              alignItems: 'center',
                              padding: '5px 6px',
                              backgroundColor: st.completed ? '#172B1C' : '#161616',
                              border: '2px solid var(--dp-color-rule)'
                            }}
                          >
                            {/* 1. Fixed Set Number */}
                            <span
                              style={{
                                width: '36px',
                                fontSize: '10px',
                                fontWeight: 800,
                                color: isSuperset
                                  ? exIdx === 0
                                    ? 'var(--dp-color-accent)'
                                    : '#FFFFFF'
                                  : '#A0A0A0',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden'
                              }}
                            >
                              {isSuperset ? `${exIdx === 0 ? 'A' : 'B'}#${st.setNumber}` : `#${st.setNumber}`}
                            </span>

                            {/* 2. Fixed/Flex Set Type Selector */}
                            <div style={{ minWidth: 0 }}>
                              {isSuperset && (
                                <div
                                  style={{
                                    fontSize: '9px', fontWeight: 800,
                                    color: exIdx === 0 ? 'var(--dp-color-accent)' : '#A0A0A0',
                                    textTransform: 'uppercase', whiteSpace: 'nowrap',
                                    overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px'
                                  }}
                                >
                                  {exObj.name}
                                </div>
                              )}
                              <select
                                aria-label="Set Type"
                                value={curType}
                                onChange={e => handleUpdateSetType(slot.id, exIdx, st.id, e.target.value)}
                                style={{
                                  width: '100%', minWidth: 0, height: '26px',
                                  backgroundColor: '#101010', color: '#FFFFFF',
                                  border: '2px solid var(--dp-color-rule)', padding: '0 4px',
                                  fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                                }}
                              >
                                {SET_TYPES_LIST.map(t => (
                                  <option key={t} value={t}>
                                    {t.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* 3. Fixed "LAST" Calculated Equivalent Weight Box */}
                            {slot.category !== 'Abs' && (
                              <div
                                style={{
                                  width: '44px', height: '26px',
                                  backgroundColor: '#101010', border: '2px solid var(--dp-color-rule)',
                                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                                  justifyContent: 'center', userSelect: 'none', pointerEvents: 'none', whiteSpace: 'nowrap'
                                }}
                              >
                                <span style={{ fontSize: '7px', fontWeight: 800, color: '#888888', lineHeight: 1 }}>
                                  LAST
                                </span>
                                <span style={{ fontSize: '10px', fontWeight: 800, color: '#A0A0A0', lineHeight: 1.1 }}>
                                  {lastW}
                                </span>
                              </div>
                            )}

                            {/* 4. Fixed Current Weight Button */}
                            {slot.category !== 'Abs' && (
                              <button
                                type="button"
                                onClick={() => openPlateCalculatorForSet(slot.id, exIdx, st, exObj.name)}
                                style={{
                                  width: '62px', height: '26px', padding: '0 4px',
                                  backgroundColor: '#101010', color: 'var(--dp-color-accent)',
                                  border: '2px solid var(--dp-color-rule)', fontSize: '10px',
                                  fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
                                  overflow: 'hidden', textOverflow: 'ellipsis'
                                }}
                              >
                                {st.weight} LB
                              </button>
                            )}

                            {/* 5. Fixed Roomy Reps Input (tiny "R" removed) */}
                            <input
                              type="number"
                              aria-label="Reps"
                              value={st.reps}
                              onChange={e => handleUpdateSetField(slot.id, exIdx, st.id, 'reps', e.target.value)}
                              style={{
                                width: '48px', height: '26px',
                                backgroundColor: '#101010', color: '#FFFFFF',
                                border: '2px solid var(--dp-color-rule)', padding: '0 4px',
                                textAlign: 'center', fontSize: '12px', fontWeight: 800
                              }}
                            />

                            {/* 6. Fixed Grey/Green Checkmark Button */}
                            <button
                              type="button"
                              aria-label="Mark set complete"
                              onClick={() => handleToggleSetDone(slot, exIdx, st)}
                              style={{
                                width: '32px', height: '26px', padding: 0,
                                backgroundColor: st.completed ? '#30D158' : '#262626',
                                color: st.completed ? '#101010' : '#777777',
                                border: '2px solid var(--dp-color-rule)', fontSize: '12px',
                                fontWeight: 800, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >
                              ✓
                            </button>
                          </div>

                          {/* Outside Red Set Delete "✕" Button aligned vertically with Exercise Delete "✕" */}
                          <button
                            type="button"
                            aria-label="Delete set"
                            onClick={() =>
                              setDeleteConfirmTarget({
                                type: 'set',
                                slotId: slot.id,
                                exIdx,
                                setId: st.id,
                                label: `${exObj.name} — Set #${st.setNumber}`
                              })
                            }
                            className="kinetic-btn"
                            style={UI.deleteXBtn}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    };

                    return (
                      <div
                        key={slot.id}
                        style={{
                          borderBottom:
                            sIdx === currentEditorWorkout.slots.length - 1
                              ? 'none'
                              : '2px solid var(--dp-color-rule)'
                        }}
                      >
                        {/* Slot Header */}
                        <div
                          style={{
                            padding: '12px 14px',
                            backgroundColor: '#1C1C1C',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <select
                                aria-label="Slot Category"
                                value={slot.category}
                                onChange={e =>
                                  handleUpdateSlotCategoryOrExercise(slot.id, { category: e.target.value })
                                }
                                style={{
                                  fontSize: '10px', fontWeight: 800, padding: '4px 8px',
                                  backgroundColor: 'var(--dp-color-accent)', color: '#101010',
                                  border: '2px solid #FFFFFF', textTransform: 'uppercase', cursor: 'pointer'
                                }}
                              >
                                {['Compound Lift', 'Supersets', 'Accessories', 'Abs'].map(cat => (
                                  <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                                ))}
                              </select>

                              {slot.category !== 'Abs' && (
                                <select
                                  aria-label="Set and Rep Scheme"
                                  value={slot.scheme || '5x8'}
                                  onChange={e =>
                                    handleUpdateSlotCategoryOrExercise(slot.id, { scheme: e.target.value })
                                  }
                                  style={{
                                    fontSize: '10px', fontWeight: 800, padding: '4px 8px',
                                    backgroundColor: '#101010', color: '#FFFFFF',
                                    border: '2px solid var(--dp-color-rule)', textTransform: 'uppercase', cursor: 'pointer'
                                  }}
                                >
                                  {['5x5', '5x8', '8x8', 'Pyramid', 'Reverse Pyramid'].map(scm => (
                                    <option key={scm} value={scm}>{scm.toUpperCase()}</option>
                                  ))}
                                </select>
                              )}
                            </div>

                            <button
                              type="button"
                              aria-label="Remove workout slot"
                              onClick={() =>
                                setDeleteConfirmTarget({
                                  type: 'slot',
                                  slotId: slot.id,
                                  label: isSuperset
                                    ? `${EXERCISE_MAP[supIds[0]]?.name || supIds[0]} / ${EXERCISE_MAP[supIds[1]]?.name || supIds[1]}`
                                    : ex1.name
                                })
                              }
                              className="kinetic-btn"
                              style={UI.deleteXBtn}
                            >
                              ✕
                            </button>
                          </div>

                          {/* Exercise Descriptor Dropdown(s) — Stars Removed */}
                          {isSuperset ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                              {[0, 1].map(idx => {
                                const exId = supIds[idx];
                                return (
                                  <select
                                    key={idx}
                                    aria-label={`Superset Exercise ${idx + 1}`}
                                    value={exId}
                                    onChange={e => {
                                      const nextIds = [...supIds];
                                      nextIds[idx] = e.target.value;
                                      handleUpdateSlotCategoryOrExercise(slot.id, { supersetExerciseIds: nextIds });
                                    }}
                                    style={{
                                      width: '100%', minWidth: 0, backgroundColor: '#101010', color: '#FFFFFF',
                                      border: '2px solid var(--dp-color-rule)', padding: '7px 8px',
                                      fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                                    }}
                                  >
                                    {inlineExercisePool.map(ex => (
                                      <option key={ex.id} value={ex.id}>
                                        {ex.name.toUpperCase()} ({ex.equipment.toUpperCase()})
                                      </option>
                                    ))}
                                  </select>
                                );
                              })}
                            </div>
                          ) : (
                            <select
                              aria-label="Select Exercise"
                              value={slot.exerciseId}
                              onChange={e =>
                                handleUpdateSlotCategoryOrExercise(slot.id, { exerciseId: e.target.value })
                              }
                              style={{
                                width: '100%', backgroundColor: '#101010', color: '#FFFFFF',
                                border: '2px solid var(--dp-color-rule)', padding: '7px 10px',
                                fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                              }}
                            >
                              {inlineExercisePool.map(ex => (
                                <option key={ex.id} value={ex.id}>
                                  {ex.name.toUpperCase()} ({ex.equipment.toUpperCase()})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Always-Expanded Sets Content */}
                        <div
                          style={{
                            padding: '12px 14px 14px',
                            backgroundColor: '#101010',
                            borderTop: '2px solid var(--dp-color-rule)'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {isSuperset
                              ? alternatingSupersetRows.map(row =>
                                renderSingleSetRow(row.setItem, row.exIdx, row.exId, row.totalExSets)
                              )
                              : (slot.sets || []).map(st =>
                                renderSingleSetRow(st, 0, slot.exerciseId, (slot.sets || []).length)
                              )}
                          </div>

                          {/* Bottom Row: + Add Set Top, + Add Set Bottom, and Recalculate */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr 1fr',
                              gap: '6px',
                              marginTop: '10px'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleInsertSetAtPosition(slot.id, 'top')}
                              className="kinetic-btn"
                              style={{
                                padding: '6px', backgroundColor: '#161616', color: '#FFFFFF',
                                border: '2px dashed var(--dp-color-rule)', fontSize: '10px',
                                fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                              }}
                            >
                              + ADD SET TOP
                            </button>
                            <button
                              type="button"
                              onClick={() => handleInsertSetAtPosition(slot.id, 'bottom')}
                              className="kinetic-btn"
                              style={{
                                padding: '6px', backgroundColor: '#161616', color: 'var(--dp-color-accent)',
                                border: '2px dashed var(--dp-color-rule)', fontSize: '10px',
                                fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                              }}
                            >
                              + ADD SET BOTTOM
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRecalculateSlotWeights(slot.id)}
                              className="kinetic-btn"
                              style={{
                                padding: '6px', backgroundColor: '#101010', color: '#30D158',
                                border: '2px solid var(--dp-color-rule)', fontSize: '10px',
                                fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                              }}
                            >
                              RECALCULATE
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </IOSListSection>

              {/* ADD EXERCISE & BOTTOM SAVE / SHARE / RESET OR APPLY ROUTINE CONTROLS */}
              {currentView !== 'routine_preview' ? (
                <div style={{ padding: '0 var(--dp-spacing-gutter)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAddSlotGymFilter(selectedGymId);
                      const avail = filterAddSlotExercises(selectedGymId, newSlotCategory, gyms);
                      if (avail.length > 0) {
                        setNewSlotEx1(avail[0].id);
                        setNewSlotSupersetIds([avail[0].id, (avail[1] || avail[0]).id]);
                      }
                      setShowAddSlotModal(true);
                    }}
                    className="kinetic-btn"
                    style={UI.dashedBtn}
                  >
                    + ADD EXERCISE
                  </button>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleSaveCurrentEditor}
                      className="kinetic-btn"
                      style={{ ...UI.primaryBtnCenter, padding: '14px 8px', fontSize: '13px' }}
                    >
                      SAVE
                    </button>

                    <button
                      type="button"
                      onClick={handleShareCurrentEditor}
                      className="kinetic-btn"
                      style={{
                        ...UI.secondaryBtnCenter, padding: '14px 8px', fontSize: '13px',
                        backgroundColor: isCurrentEditorShared ? '#30D158' : '#161616',
                        color: isCurrentEditorShared ? '#101010' : '#FFFFFF'
                      }}
                    >
                      {isCurrentEditorShared ? 'SHARED ✓' : 'SHARE'}
                    </button>

                    <button
                      type="button"
                      onClick={handleResetCurrentEditor}
                      className="kinetic-btn"
                      style={{ ...UI.secondaryBtnCenter, padding: '14px 8px', fontSize: '13px', color: '#FF3B30' }}
                    >
                      RESET
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '0 var(--dp-spacing-gutter)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAddSlotGymFilter(selectedGymId);
                      const avail = filterAddSlotExercises(selectedGymId, newSlotCategory, gyms);
                      if (avail.length > 0) {
                        setNewSlotEx1(avail[0].id);
                        setNewSlotSupersetIds([avail[0].id, (avail[1] || avail[0]).id]);
                      }
                      setShowAddSlotModal(true);
                    }}
                    className="kinetic-btn"
                    style={UI.dashedBtn}
                  >
                    + ADD EXERCISE
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyPreviewRoutine}
                    className="kinetic-btn"
                    style={UI.primaryBtnCenter}
                  >
                    APPLY ROUTINE TO WORKOUT →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ================================================================== */}
          {/* VIEW: ROUTINES (DEFAULT, SAVED, SHARED & FRIENDS' ROUTINES)        */}
          {/* ================================================================== */}
          {currentView === 'routines' && (
            <div style={UI.pagePad}>
              <IOSListSection header="DEFAULT ROUTINES" colors={colors}>
                {DEFAULT_ROUTINES.map((r, i) => (
                  <IOSListRow key={r.key} isLast={i === DEFAULT_ROUTINES.length - 1} colors={colors}>
                    <span style={UI.rowTitle}>{r.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleOpenPreviewRoutine(r, routineSelectReturnView || 'session')}
                        className="kinetic-btn"
                        style={UI.pillBtn(false)}
                      >
                        PREVIEW
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDirectLoadRoutine(r, routineSelectReturnView || 'session')}
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
                    <IOSListRow key={r.key} isLast={i === savedRoutines.length - 1} colors={colors}>
                      <div>
                        <div style={UI.rowTitle}>{r.label}</div>
                        <div className="kinetic-sub" style={UI.rowSub}>{(r.slots || []).length} SLOTS</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleOpenPreviewRoutine(r, routineSelectReturnView || 'session')}
                          className="kinetic-btn"
                          style={UI.pillBtn(false)}
                        >
                          PREVIEW
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDirectLoadRoutine(r, routineSelectReturnView || 'session')}
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
                    <span style={UI.rowSub}>No routines shared yet. Tap SHARE in Routine Editor.</span>
                  </IOSListRow>
                ) : (
                  sharedRoutines.map((r, i) => (
                    <IOSListRow key={r.key} isLast={i === sharedRoutines.length - 1} colors={colors}>
                      <span style={UI.rowTitle}>{r.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleOpenPreviewRoutine(r, routineSelectReturnView || 'session')}
                          className="kinetic-btn"
                          style={UI.pillBtn(false)}
                        >
                          PREVIEW
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDirectLoadRoutine(r, routineSelectReturnView || 'session')}
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
                {friendsList.flatMap(f => (f.sharedRoutines || []).map(r => ({ ...r, friendName: f.username }))).length === 0 ? (
                  <IOSListRow isLast={true} colors={colors}>
                    <span style={UI.rowSub}>Add friends in Social to browse their shared routines.</span>
                  </IOSListRow>
                ) : (
                  friendsList
                    .flatMap(f => (f.sharedRoutines || []).map(r => ({ ...r, friendName: f.username })))
                    .map((r, i, arr) => (
                      <IOSListRow key={`${r.key}_${i}`} isLast={i === arr.length - 1} colors={colors}>
                        <div>
                          <div style={UI.rowTitle}>{r.label}</div>
                          <div className="kinetic-sub" style={UI.rowSub}>BY @{r.friendName}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenPreviewRoutine(r, routineSelectReturnView || 'session')}
                            className="kinetic-btn"
                            style={UI.pillBtn(false)}
                          >
                            PREVIEW
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDirectLoadRoutine(r, routineSelectReturnView || 'session')}
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
          )}

          {/* ================================================================== */}
          {/* VIEW: HISTORY                                                      */}
          {/* ================================================================== */}
          {currentView === 'history' && (
            <div style={UI.pagePad}>
              <div style={UI.gutterBottom}>
                <button
                  type="button"
                  onClick={() => {
                    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                    setHistoricalDraft({
                      id: `hist_${Date.now()}`,
                      title: getDefaultSessionName(),
                      loadedRoutineTitle: 'MANUAL',
                      workoutDate: yesterday,
                      defaultRestSeconds: 90,
                      slots: []
                    });
                    setCurrentView('historical_entry');
                  }}
                  className="kinetic-btn"
                  style={UI.primaryBtn}
                >
                  <span>+ LOG PAST WORKOUT</span>
                  <span>→</span>
                </button>
              </div>

              <IOSListSection header="LOGGED SESSIONS" colors={colors}>
                <IOSListRow
                  onClick={() => setHistorySessionsExpanded(p => !p)}
                  isLast={!historySessionsExpanded || history.length === 0}
                  colors={colors}
                >
                  <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--dp-color-accent)' }}>
                    {historySessionsExpanded ? 'HIDE SESSIONS' : `SHOW SESSIONS (${history.length})`}
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 800 }}>
                    {historySessionsExpanded ? '−' : '+'}
                  </span>
                </IOSListRow>

                {historySessionsExpanded &&
                  history.map((w, idx) => {
                    const isExp = expandedHistoryWorkoutId === w.id;
                    return (
                      <div
                        key={w.id}
                        style={{
                          borderBottom: idx === history.length - 1 ? 'none' : '2px solid var(--dp-color-rule)'
                        }}
                      >
                        <div
                          onClick={() => setExpandedHistoryWorkoutId(isExp ? null : w.id)}
                          style={{
                            padding: '14px 16px', backgroundColor: '#141414',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>
                              {w.title}
                            </div>
                            <div style={{ fontSize: '11px', color: '#A0A0A0', fontWeight: 600 }}>
                              {new Date(w.startedAt).toLocaleDateString()} • {(w.slots || []).length} SLOTS
                            </div>
                          </div>
                          <span style={{ fontSize: '18px', fontWeight: 800 }}>{isExp ? '−' : '+'}</span>
                        </div>

                        {isExp && (
                          <div
                            style={{
                              padding: '12px 16px', backgroundColor: '#101010',
                              borderTop: '2px solid var(--dp-color-rule)',
                              display: 'flex', flexDirection: 'column', gap: '8px'
                            }}
                          >
                            {(w.slots || []).map(s => (
                              <div key={s.id} style={{ fontSize: '12px', fontWeight: 700 }}>
                                <span style={{ color: 'var(--dp-color-accent)' }}>{s.slotLabel}:</span>{' '}
                                {EXERCISE_MAP[s.exerciseId]?.name || s.exerciseId} ({(s.sets || []).length} sets)
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </IOSListSection>

              <IOSListSection
                header="PERSONAL RECORDS"
                footer="Tap any Personal Record weight to edit it with the Plate & Weight Calculator."
                colors={colors}
              >
                <IOSListRow
                  onClick={() => setHistoryPRsExpanded(p => !p)}
                  isLast={!historyPRsExpanded}
                  colors={colors}
                >
                  <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--dp-color-accent)' }}>
                    {historyPRsExpanded ? 'HIDE PERSONAL RECORDS' : 'SHOW PERSONAL RECORDS'}
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 800 }}>
                    {historyPRsExpanded ? '−' : '+'}
                  </span>
                </IOSListRow>

                {historyPRsExpanded &&
                  EXERCISE_LIBRARY.filter(e => e.isPriority).map((ex, idx, arr) => {
                    const currentMax = oneRepMaxes[ex.id] ?? ex.default1RM;
                    const isBigFour = BIG_FOUR_IDS.includes(ex.id);
                    const targetVal = isBigFour
                      ? getExRxTargetForLift(ex.id, targetStandardClass, userBodyweightLbs, totalHeightInches, customGoalWeights)
                      : null;
                    const diffFromGoal = targetVal !== null ? targetVal - currentMax : null;

                    return (
                      <IOSListRow
                        key={ex.id}
                        isLast={idx === arr.length - 1}
                        colors={colors}
                        onClick={() => openPlateCalculatorForPR(ex.id, ex.name, currentMax)}
                      >
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>
                            {ex.name}
                          </div>
                          {diffFromGoal !== null && (
                            <div className="kinetic-sub" style={{ fontSize: '11px', color: '#A0A0A0', fontWeight: 700 }}>
                              {diffFromGoal > 0
                                ? `${diffFromGoal} lb from ${targetStandardClass}`
                                : `Goal Achieved (+${Math.abs(diffFromGoal)} lb)`}
                            </div>
                          )}
                        </div>
                        <span
                          style={{
                            padding: '6px 10px', backgroundColor: '#101010',
                            border: '2px solid var(--dp-color-rule)', color: 'var(--dp-color-accent)',
                            fontSize: '14px', fontWeight: 800
                          }}
                        >
                          {currentMax} LB ✎
                        </span>
                      </IOSListRow>
                    );
                  })}
              </IOSListSection>
            </div>
          )}

          {/* ================================================================== */}
          {/* VIEW: GYMS/EQUIPMENT & EDITOR                                      */}
          {/* ================================================================== */}
          {currentView === 'gyms' && (
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
                footer="Tap any preset to set it as your active Gyms/Equipment filter for Workout Slots and Auto."
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
          )}

          {currentView === 'gym_editor' && gymDraft && (
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
          )}

          {/* ================================================================== */}
          {/* VIEW: GOALS                                                        */}
          {/* ================================================================== */}
          {currentView === 'goals' && (
            <div style={{ paddingTop: '14px' }}>
              <IOSListSection header="PRIMARY TRAINING GOAL" colors={colors}>
                <IOSListRow isLast={goalType === 'Maintain'} colors={colors}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', width: '100%' }}>
                    {['Strength', 'Hypertrophy', 'Maintain'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setGoalType(opt)}
                        className="kinetic-btn"
                        style={{
                          padding: '10px 6px',
                          backgroundColor: goalType === opt ? 'var(--dp-color-accent)' : '#101010',
                          color: goalType === opt ? '#101010' : '#FFFFFF',
                          border: '2px solid var(--dp-color-rule)',
                          fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </IOSListRow>

                {(goalType === 'Strength' || goalType === 'Hypertrophy') && (
                  <IOSListRow isLast={true} colors={colors}>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
                          PROGRESSION INCREMENT
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {['lb', 'kg'].map(u => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => setGoalUnit(u)}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: goalUnit === u ? 'var(--dp-color-accent)' : '#101010',
                                color: goalUnit === u ? '#101010' : '#FFFFFF',
                                border: '2px solid var(--dp-color-rule)',
                                fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                              }}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                        {[1.25, 2.5, 5, 10].map(inc => (
                          <button
                            key={inc}
                            type="button"
                            onClick={() => setGoalIncrement(inc)}
                            style={{
                              padding: '8px 4px',
                              backgroundColor: goalIncrement === inc ? 'var(--dp-color-accent)' : '#101010',
                              color: goalIncrement === inc ? '#101010' : '#FFFFFF',
                              border: '2px solid var(--dp-color-rule)',
                              fontSize: '12px', fontWeight: 800, cursor: 'pointer'
                            }}
                          >
                            +{inc} {goalUnit}
                          </button>
                        ))}
                      </div>
                    </div>
                  </IOSListRow>
                )}
              </IOSListSection>

              <IOSListSection
                header="STANDARDS (EXRX.NET)"
                footer={`Cross-referenced with your Settings metrics (${userBodyweightLbs} lbs, ${userHeightFeet}'${userHeightInches}"). Tap any goal weight to customize it.`}
                colors={colors}
              >
                <IOSListRow colors={colors}>
                  <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase' }}>
                    TARGET STANDARD GOAL
                  </span>
                  <select
                    value={targetStandardClass}
                    onChange={e => setTargetStandardClass(e.target.value)}
                    style={{
                      backgroundColor: '#101010', color: 'var(--dp-color-accent)',
                      border: '2px solid var(--dp-color-rule)', padding: '6px 10px',
                      fontSize: '12px', fontWeight: 800, textTransform: 'uppercase'
                    }}
                  >
                    {EXRX_CLASSES.map(c => (
                      <option key={c} value={c}>{c.toUpperCase()}</option>
                    ))}
                    <option value="Custom">CUSTOM</option>
                  </select>
                </IOSListRow>

                {BIG_FOUR_IDS.map((liftId, idx) => {
                  const ex = EXERCISE_MAP[liftId];
                  const cur1RM = oneRepMaxes[liftId] ?? ex.default1RM;
                  const curClass = getExRxCurrentClass(liftId, cur1RM, userBodyweightLbs, totalHeightInches);
                  const goalWeight = getExRxTargetForLift(liftId, targetStandardClass, userBodyweightLbs, totalHeightInches, customGoalWeights);
                  const distance = goalWeight - cur1RM;

                  return (
                    <IOSListRow key={liftId} isLast={idx === BIG_FOUR_IDS.length - 1} colors={colors}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>
                          {ex.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#A0A0A0', fontWeight: 700 }}>
                          1RM: <strong style={{ color: '#FFFFFF' }}>{cur1RM} LB</strong> • CLASS:{' '}
                          <strong style={{ color: 'var(--dp-color-accent)' }}>{curClass.toUpperCase()}</strong>
                        </div>
                        <div style={{ fontSize: '11px', color: '#30D158', fontWeight: 700 }}>
                          {distance > 0
                            ? `${distance} lb from ${targetStandardClass}`
                            : `Surpassed ${targetStandardClass} by ${Math.abs(distance)} lb`}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openPlateCalculatorForGoal(liftId, ex.name, goalWeight)}
                        style={{
                          padding: '6px 10px', backgroundColor: '#101010',
                          color: 'var(--dp-color-accent)', border: '2px solid var(--dp-color-rule)',
                          fontSize: '12px', fontWeight: 800, cursor: 'pointer', flexShrink: 0
                        }}
                      >
                        GOAL: {goalWeight} LB ✎
                      </button>
                    </IOSListRow>
                  );
                })}
              </IOSListSection>
            </div>
          )}

          {/* ================================================================== */}
          {/* VIEW: PROGRESSION CHART                                            */}
          {/* ================================================================== */}
          {currentView === 'progression_chart' && (
            <div style={{ paddingTop: '14px' }}>
              <IOSListSection
                header="PROGRESSION CHART (BIG 3 + OHP)"
                footer="Toggle between Top Working Weight (lb) and Workout Volume (weight × reps × sets). Filter individual lifts or view all 4 together."
                colors={colors}
              >
                <IOSListRow colors={colors}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%' }}>
                    <button
                      type="button"
                      onClick={() => setChartMetric('weight')}
                      style={UI.pillBtn(chartMetric === 'weight')}
                    >
                      WEIGHT CHANGES (LB)
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMetric('volume')}
                      style={UI.pillBtn(chartMetric === 'volume')}
                    >
                      VOLUME / WORKOUT
                    </button>
                  </div>
                </IOSListRow>

                <IOSListRow colors={colors}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', width: '100%' }}>
                    {[
                      { id: 'ALL', label: 'ALL 4' },
                      { id: 'barbell_bench_press', label: 'BENCH' },
                      { id: 'barbell_back_squat', label: 'SQUAT' },
                      { id: 'barbell_deadlift', label: 'DEAD' },
                      { id: 'overhead_press', label: 'OHP' }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedChartLift(f.id)}
                        style={{
                          padding: '6px 4px',
                          backgroundColor: selectedChartLift === f.id ? '#FFFFFF' : '#101010',
                          color: selectedChartLift === f.id ? '#101010' : '#A0A0A0',
                          border: '2px solid var(--dp-color-rule)',
                          fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </IOSListRow>

                <IOSListRow colors={colors}>
                  {(() => {
                    const liftMeta = {
                      barbell_bench_press: { short: 'BENCH', color: '#FF6B00' },
                      barbell_back_squat: { short: 'SQUAT', color: '#30D158' },
                      barbell_deadlift: { short: 'DEADLIFT', color: '#FFD60A' },
                      overhead_press: { short: 'OHP', color: '#00E5FF' }
                    };

                    const activeLifts = selectedChartLift === 'ALL' ? BIG_FOUR_IDS : [selectedChartLift];
                    const allDates = Array.from(
                      new Set(BIG_FOUR_IDS.flatMap(id => (progressionSeriesByLift[id] || []).map(pt => pt.dateLabel)))
                    );
                    const allVals = activeLifts.flatMap(id =>
                      (progressionSeriesByLift[id] || []).map(pt => (chartMetric === 'weight' ? pt.weight : pt.volume))
                    );

                    const rawMin = allVals.length ? Math.min(...allVals) : 0;
                    const rawMax = allVals.length ? Math.max(...allVals) : 300;
                    const pad = Math.max(10, Math.round((rawMax - rawMin) * 0.15));
                    const minVal = Math.max(0, rawMin - pad);
                    const maxVal = rawMax + pad;

                    const svgW = 360;
                    const svgH = 210;
                    const padL = 44;
                    const padR = 18;
                    const padT = 18;
                    const padB = 30;
                    const plotW = svgW - padL - padR;
                    const plotH = svgH - padT - padB;

                    const getX = (idx, count) => (count <= 1 ? padL + plotW / 2 : padL + (idx / (count - 1)) * plotW);
                    const getY = val => padT + plotH - ((val - minVal) / Math.max(1, maxVal - minVal)) * plotH;
                    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(minVal + t * (maxVal - minVal)));

                    return (
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
                          {activeLifts.map(id => (
                            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '10px', height: '10px', backgroundColor: liftMeta[id].color, display: 'inline-block' }} />
                              <span style={{ fontSize: '11px', fontWeight: 800, color: '#FFFFFF' }}>
                                {liftMeta[id].short}
                              </span>
                            </div>
                          ))}
                        </div>

                        <svg
                          viewBox={`0 0 ${svgW} ${svgH}`}
                          style={{
                            width: '100%', height: 'auto', backgroundColor: '#101010',
                            border: '2px solid var(--dp-color-rule)', display: 'block'
                          }}
                        >
                          {yTicks.map((tickVal, idx) => {
                            const y = getY(tickVal);
                            return (
                              <g key={idx}>
                                <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#2A2A2A" strokeWidth="1" strokeDasharray="3 3" />
                                <text x={padL - 6} y={y + 3} textAnchor="end" fill="#888888" fontSize="9" fontWeight="700">
                                  {tickVal >= 1000 && chartMetric === 'volume' ? `${(tickVal / 1000).toFixed(1)}k` : tickVal}
                                </text>
                              </g>
                            );
                          })}

                          {allDates.map((dLabel, idx) => {
                            const x = getX(idx, allDates.length);
                            return (
                              <g key={dLabel}>
                                <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke="#1E1E1E" strokeWidth="1" />
                                <text x={x} y={svgH - 9} textAnchor="middle" fill="#A0A0A0" fontSize="9" fontWeight="800">
                                  {dLabel.toUpperCase()}
                                </text>
                              </g>
                            );
                          })}

                          {activeLifts.map(liftId => {
                            const series = progressionSeriesByLift[liftId] || [];
                            if (series.length === 0) return null;
                            const color = liftMeta[liftId].color;

                            const coords = series.map((pt, sIdx) => {
                              const dateIdx = allDates.indexOf(pt.dateLabel);
                              const x = dateIdx >= 0 ? getX(dateIdx, allDates.length) : getX(sIdx, series.length);
                              const rawVal = chartMetric === 'weight' ? pt.weight : pt.volume;
                              const y = getY(rawVal);
                              return { x, y, rawVal, dateLabel: pt.dateLabel };
                            });

                            const polylinePoints = coords.map(c => `${c.x},${c.y}`).join(' ');
                            const areaPoints =
                              coords.length > 1
                                ? `${coords[0].x},${padT + plotH} ${polylinePoints} ${coords[coords.length - 1].x},${padT + plotH}`
                                : null;

                            return (
                              <g key={liftId}>
                                {selectedChartLift !== 'ALL' && areaPoints && (
                                  <polygon points={areaPoints} fill={color} fillOpacity="0.14" />
                                )}
                                <polyline fill="none" stroke={color} strokeWidth="2.75" points={polylinePoints} />
                                {coords.map((c, cIdx) => (
                                  <g key={`${liftId}_${cIdx}`}>
                                    <rect x={c.x - 4} y={c.y - 4} width="8" height="8" fill="#101010" stroke={color} strokeWidth="2.2" />
                                    {(selectedChartLift !== 'ALL' || cIdx === coords.length - 1) && (
                                      <text x={c.x} y={c.y - 8} textAnchor="middle" fill={color} fontSize="9" fontWeight="800">
                                        {c.rawVal}
                                      </text>
                                    )}
                                  </g>
                                ))}
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    );
                  })()}
                </IOSListRow>

                {BIG_FOUR_IDS.map((liftId, idx) => {
                  const ex = EXERCISE_MAP[liftId];
                  const cur1RM = oneRepMaxes[liftId] ?? ex.default1RM;
                  const goalWeight = getExRxTargetForLift(liftId, targetStandardClass, userBodyweightLbs, totalHeightInches, customGoalWeights);
                  const distance = goalWeight - cur1RM;
                  const series = progressionSeriesByLift[liftId] || [];
                  const firstVal = series.length ? (chartMetric === 'weight' ? series[0].weight : series[0].volume) : 0;
                  const latestVal = series.length
                    ? chartMetric === 'weight'
                      ? series[series.length - 1].weight
                      : series[series.length - 1].volume
                    : 0;
                  const delta = latestVal - firstVal;

                  return (
                    <IOSListRow
                      key={liftId}
                      isLast={idx === BIG_FOUR_IDS.length - 1}
                      colors={colors}
                      onClick={() => setSelectedChartLift(prev => (prev === liftId ? 'ALL' : liftId))}
                    >
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase' }}>{ex.name}</span>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>
                            1RM {cur1RM} LB ({distance > 0 ? `${distance} lb from ${targetStandardClass}` : 'Goal Met'})
                          </span>
                        </div>
                        <div
                          className="kinetic-sub"
                          style={{
                            fontSize: '11px', color: '#A0A0A0', fontWeight: 700,
                            marginTop: '3px', display: 'flex', justifyContent: 'space-between'
                          }}
                        >
                          <span>
                            START: {firstVal} {chartMetric === 'weight' ? 'LB' : 'VOL'} → LATEST: {latestVal}{' '}
                            {chartMetric === 'weight' ? 'LB' : 'VOL'}
                          </span>
                          <span style={{ color: delta >= 0 ? '#30D158' : '#FF3B30' }}>
                            {delta >= 0 ? `+${delta}` : delta} {chartMetric === 'weight' ? 'LB' : 'VOL'}
                          </span>
                        </div>
                      </div>
                    </IOSListRow>
                  );
                })}
              </IOSListSection>
            </div>
          )}

          {/* ================================================================== */}
          {/* VIEW: STIMULUS MAP                                                 */}
          {/* ================================================================== */}
          {currentView === 'stimulus_map' && (
            <div style={{ paddingTop: '14px' }}>
              <IOSListSection
                header="ANATOMICAL STIMULUS DIAGRAM"
                footer={`Green: 0–${stimulusGreenDays}d • Yellow: ${Number(stimulusGreenDays) + 1}–${stimulusYellowDays}d • Red: ${Number(stimulusYellowDays) + 1}+ days since last logged stimulus.`}
                colors={colors}
              >
                <IOSListRow isLast={true} colors={colors}>
                  <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '8px 0' }}>
                    <div
                      style={{
                        border: '2px solid var(--dp-color-rule)', backgroundColor: '#101010',
                        padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center'
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--dp-color-accent)', letterSpacing: '0.06em', marginBottom: '8px' }}>
                        ANTERIOR // FRONT
                      </div>
                      <svg viewBox="0 0 120 230" style={{ width: '100%', maxWidth: '135px', height: 'auto' }}>
                        <rect x="50" y="6" width="20" height="22" fill="#262626" stroke="#5C5C5C" strokeWidth="1.5" />
                        <rect x="54" y="28" width="12" height="8" fill="#262626" />
                        <rect x="22" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="82" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="38" y="36" width="21" height="28" fill={muscleStimulusStatus.Chest?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="61" y="36" width="21" height="28" fill={muscleStimulusStatus.Chest?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="18" y="60" width="15" height="48" fill={muscleStimulusStatus.Arms?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="87" y="60" width="15" height="48" fill={muscleStimulusStatus.Arms?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="40" y="66" width="40" height="46" fill={muscleStimulusStatus.Core?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <line x1="60" y1="66" x2="60" y2="112" stroke="#101010" strokeWidth="1.5" />
                        <line x1="40" y1="81" x2="80" y2="81" stroke="#101010" strokeWidth="1.5" />
                        <line x1="40" y1="96" x2="80" y2="96" stroke="#101010" strokeWidth="1.5" />
                        <rect x="38" y="116" width="20" height="58" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="62" y="116" width="20" height="58" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="40" y="177" width="16" height="44" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="64" y="177" width="16" height="44" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                      </svg>
                    </div>

                    <div
                      style={{
                        border: '2px solid var(--dp-color-rule)', backgroundColor: '#101010',
                        padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center'
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--dp-color-accent)', letterSpacing: '0.06em', marginBottom: '8px' }}>
                        POSTERIOR // BACK
                      </div>
                      <svg viewBox="0 0 120 230" style={{ width: '100%', maxWidth: '135px', height: 'auto' }}>
                        <rect x="50" y="6" width="20" height="22" fill="#262626" stroke="#5C5C5C" strokeWidth="1.5" />
                        <rect x="54" y="28" width="12" height="8" fill="#262626" />
                        <rect x="22" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="82" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="38" y="36" width="44" height="52" fill={muscleStimulusStatus.Back?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <line x1="60" y1="36" x2="60" y2="88" stroke="#101010" strokeWidth="1.5" />
                        <rect x="18" y="60" width="15" height="48" fill={muscleStimulusStatus.Arms?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="87" y="60" width="15" height="48" fill={muscleStimulusStatus.Arms?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="42" y="90" width="36" height="22" fill={muscleStimulusStatus.Back?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="38" y="114" width="21" height="24" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="61" y="114" width="21" height="24" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="38" y="140" width="20" height="36" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="62" y="140" width="20" height="36" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="40" y="178" width="16" height="43" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                        <rect x="64" y="178" width="16" height="43" fill={muscleStimulusStatus.Legs?.color || '#FF3B30'} stroke="#101010" strokeWidth="1.5" />
                      </svg>
                    </div>
                  </div>
                </IOSListRow>
              </IOSListSection>

              <IOSListSection header="MUSCLE GROUP TELEMETRY" colors={colors}>
                {Object.entries(muscleStimulusStatus).map(([group, info], idx, arr) => (
                  <IOSListRow key={group} isLast={idx === arr.length - 1} colors={colors}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ width: '16px', height: '16px', backgroundColor: info.color, border: '2px solid #FFFFFF', display: 'inline-block' }} />
                      <span style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>{group}</span>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: info.color, textTransform: 'uppercase' }}>
                      {info.label}
                    </span>
                  </IOSListRow>
                ))}
              </IOSListSection>
            </div>
          )}

          {/* ================================================================== */}
          {/* VIEW: LEADERBOARD                                                  */}
          {/* ================================================================== */}
          {currentView === 'leaderboard' && (
            <div style={{ paddingTop: '14px' }}>
              <IOSListSection header="COMMUNITY BIG 3 + OHP TOTAL" colors={colors}>
                {[
                  {
                    name: user?.username || 'you (logged out)',
                    total:
                      (oneRepMaxes.barbell_bench_press || 225) +
                      (oneRepMaxes.barbell_back_squat || 285) +
                      (oneRepMaxes.barbell_deadlift || 335) +
                      (oneRepMaxes.overhead_press || 145)
                  },
                  ...friendsList.map(f => ({
                    name: f.username,
                    total:
                      (f.prs?.barbell_bench_press || 185) +
                      (f.prs?.barbell_back_squat || 265) +
                      (f.prs?.barbell_deadlift || 315) +
                      (f.prs?.overhead_press || 115)
                  }))
                ]
                  .sort((a, b) => b.total - a.total)
                  .map((entry, idx, arr) => (
                    <IOSListRow key={entry.name} indexLabel={`#0${idx + 1}`} isLast={idx === arr.length - 1} colors={colors}>
                      <span style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>@{entry.name}</span>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>{entry.total} LB</span>
                    </IOSListRow>
                  ))}
              </IOSListSection>
            </div>
          )}

          {/* ================================================================== */}
          {/* VIEW: SOCIAL & PROFILE                                             */}
          {/* ================================================================== */}
          {currentView === 'social' && (
            <div style={{ paddingTop: '14px' }}>
              <IOSListSection header="FIND ATHLETES" colors={colors}>
                <IOSListRow isLast={true} colors={colors}>
                  <input
                    type="text"
                    placeholder="SEARCH USERNAME OR EMAIL..."
                    value={friendSearchQuery}
                    onChange={e => setFriendSearchQuery(e.target.value)}
                    style={{
                      width: '100%', backgroundColor: '#101010', color: '#FFFFFF',
                      border: '2px solid var(--dp-color-rule)', padding: '10px 12px',
                      fontSize: '13px', fontWeight: 800, textTransform: 'uppercase'
                    }}
                  />
                </IOSListRow>
              </IOSListSection>

              {pendingIncomingRequests.length > 0 && (
                <IOSListSection header="INCOMING REQUESTS" colors={colors}>
                  {pendingIncomingRequests.map((req, idx) => (
                    <IOSListRow key={req.id} isLast={idx === pendingIncomingRequests.length - 1} colors={colors}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>@{req.username}</div>
                        <div style={{ fontSize: '11px', color: '#A0A0A0' }}>{req.email}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFriendsList(prev => [...prev, req]);
                          setPendingIncomingRequests(prev => prev.filter(r => r.id !== req.id));
                        }}
                        style={{
                          padding: '6px 12px', backgroundColor: 'var(--dp-color-accent)',
                          color: '#101010', border: '2px solid #FFFFFF', fontSize: '11px', fontWeight: 800, cursor: 'pointer'
                        }}
                      >
                        ACCEPT
                      </button>
                    </IOSListRow>
                  ))}
                </IOSListSection>
              )}

              <IOSListSection
                header={`FRIENDS (${friendsList.length})`}
                footer="Tap any friend to open their Profile page and view their PRs and Shared Routines."
                colors={colors}
              >
                {friendsList
                  .filter(
                    f =>
                      !friendSearchQuery.trim() ||
                      f.username.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
                      f.email.toLowerCase().includes(friendSearchQuery.toLowerCase())
                  )
                  .map((friend, i, arr) => (
                    <IOSListRow
                      key={friend.id}
                      isLast={i === arr.length - 1}
                      colors={colors}
                      onClick={() => {
                        setViewingFriendProfile(friend);
                        setCurrentView('friend_profile');
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>@{friend.username}</div>
                        <div className="kinetic-sub" style={{ fontSize: '11px', color: '#A0A0A0' }}>{friend.email}</div>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>VIEW PROFILE →</span>
                    </IOSListRow>
                  ))}
              </IOSListSection>
            </div>
          )}

          {(currentView === 'profile' || currentView === 'friend_profile') && (
            <div style={{ paddingTop: '14px' }}>
              {(() => {
                const isFriend = currentView === 'friend_profile' && viewingFriendProfile;
                const profUser = isFriend
                  ? viewingFriendProfile
                  : user || { username: 'guest', email: 'Not Signed In' };
                const profPRs = isFriend ? viewingFriendProfile.prs || {} : oneRepMaxes;
                const profRoutines = isFriend ? viewingFriendProfile.sharedRoutines || [] : sharedRoutines;

                return (
                  <>
                    <IOSListSection header="ATHLETE IDENTITY" colors={colors}>
                      <IOSListRow isLast={isFriend || !user} colors={colors}>
                        <div>
                          <div style={{ fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
                            @{profUser.username}
                          </div>
                          <div style={{ fontSize: '12px', color: '#A0A0A0', fontWeight: 700 }}>{profUser.email}</div>
                        </div>

                        {!isFriend && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                              padding: '8px 12px', backgroundColor: '#101010',
                              color: 'var(--dp-color-accent)', border: '2px solid var(--dp-color-rule)',
                              fontSize: '11px', fontWeight: 800, cursor: 'pointer'
                            }}
                          >
                            PHOTO
                          </button>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} />
                      </IOSListRow>

                      {!isFriend && user && (
                        <IOSListRow isLast={true} colors={colors}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#A0A0A0' }}>ACTIVE ACCOUNT SESSION</span>
                          <button
                            type="button"
                            onClick={() => {
                              setUser(null);
                              setCurrentView('home');
                            }}
                            className="kinetic-btn"
                            style={{
                              padding: '6px 12px', backgroundColor: '#161616', color: '#FF3B30',
                              border: '2px solid var(--dp-color-rule)', fontSize: '11px',
                              fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
                            }}
                          >
                            SIGN OUT
                          </button>
                        </IOSListRow>
                      )}
                    </IOSListSection>

                    <IOSListSection header="PRS (PERSONAL RECORDS)" colors={colors}>
                      {EXERCISE_LIBRARY.filter(e => e.isPriority).map((ex, i, arr) => {
                        const val = profPRs[ex.id] ?? ex.default1RM;
                        return (
                          <IOSListRow
                            key={ex.id}
                            isLast={i === arr.length - 1}
                            colors={colors}
                            onClick={!isFriend ? () => openPlateCalculatorForPR(ex.id, ex.name, val) : undefined}
                          >
                            <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase' }}>{ex.name}</span>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>
                              {val} LB {!isFriend && '✎'}
                            </span>
                          </IOSListRow>
                        );
                      })}
                    </IOSListSection>

                    <IOSListSection header="SHARED ROUTINES" colors={colors}>
                      {profRoutines.length === 0 ? (
                        <IOSListRow isLast={true} colors={colors}>
                          <span style={{ fontSize: '12px', color: '#888888' }}>No routines shared yet.</span>
                        </IOSListRow>
                      ) : (
                        profRoutines.map((r, i) => (
                          <IOSListRow
                            key={r.key}
                            isLast={i === profRoutines.length - 1}
                            colors={colors}
                            onClick={() => handleOpenPreviewRoutine(r, 'session')}
                          >
                            <span style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>{r.label}</span>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>PREVIEW →</span>
                          </IOSListRow>
                        ))
                      )}
                    </IOSListSection>
                  </>
                );
              })()}
            </div>
          )}

          {/* ================================================================== */}
          {/* VIEW: SETTINGS                                                     */}
          {/* ================================================================== */}
          {currentView === 'settings' && (
            <div style={UI.pagePad}>
              <IOSListSection header="BODY METRICS" colors={colors}>
                <IOSListRow colors={colors}>
                  <span style={UI.rowTitle}>BODYWEIGHT (LBS)</span>
                  <input
                    type="number"
                    value={userBodyweightLbs}
                    onChange={e => setUserBodyweightLbs(Number(e.target.value) || 0)}
                    style={UI.numInput('90px', 'var(--dp-color-accent)')}
                  />
                </IOSListRow>
                <IOSListRow isLast={true} colors={colors}>
                  <span style={UI.rowTitle}>HEIGHT (FT / IN)</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={userHeightFeet}
                      onChange={e => setUserHeightFeet(Number(e.target.value) || 0)}
                      style={UI.numInput('54px')}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 800 }}>FT</span>
                    <input
                      type="number"
                      value={userHeightInches}
                      onChange={e => setUserHeightInches(Number(e.target.value) || 0)}
                      style={UI.numInput('54px')}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 800 }}>IN</span>
                  </div>
                </IOSListRow>
              </IOSListSection>

              <IOSListSection header="STIMULUS" footer="Red threshold is automatically set to Yellow + 1 day." colors={colors}>
                <IOSListRow colors={colors}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#30D158' }}>GREEN (RECOVERING)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      min="1"
                      value={stimulusGreenDays}
                      onChange={e => setStimulusGreenDays(Math.max(1, Number(e.target.value) || 1))}
                      style={UI.numInput('58px')}
                    />
                    <span style={{ fontSize: '11px', fontWeight: 800 }}>DAYS</span>
                  </div>
                </IOSListRow>

                <IOSListRow colors={colors}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFD60A' }}>YELLOW (READY)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      min={Number(stimulusGreenDays) + 1}
                      value={stimulusYellowDays}
                      onChange={e =>
                        setStimulusYellowDays(Math.max(Number(stimulusGreenDays) + 1, Number(e.target.value) || 4))
                      }
                      style={UI.numInput('58px')}
                    />
                    <span style={{ fontSize: '11px', fontWeight: 800 }}>DAYS</span>
                  </div>
                </IOSListRow>

                <IOSListRow isLast={true} colors={colors} style={{ opacity: 0.5 }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#FF3B30' }}>RED (HIGH PRIORITY)</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#A0A0A0' }}>
                    {Number(stimulusYellowDays) + 1}+ DAYS (AUTO)
                  </span>
                </IOSListRow>
              </IOSListSection>

              <IOSListSection header="GYMS/EQUIPMENT" colors={colors}>
                <IOSListRow isLast={true} colors={colors} style={{ opacity: 0.45 }}>
                  <div>
                    <div style={UI.rowTitle}>SMART LOCATIONS</div>
                    <div style={UI.rowSub}>COMING SOON</div>
                  </div>
                  <span style={UI.badge(false)}>LOCKED</span>
                </IOSListRow>
              </IOSListSection>

              <IOSListSection
                header="ROUTINE PREFERENCES"
                footer="Controls the default structure generated when you tap AUTO in Routine Editor."
                colors={colors}
              >
                {routinePreferences.map((comp, idx) => (
                  <IOSListRow key={`${comp}_${idx}`} colors={colors}>
                    <span style={UI.rowTitle}>0{idx + 1} / {comp}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          setRoutinePreferences(prev => {
                            const copy = [...prev];
                            const tmp = copy[idx - 1];
                            copy[idx - 1] = copy[idx];
                            copy[idx] = tmp;
                            return copy;
                          })
                        }
                        style={UI.pillBtn(false)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === routinePreferences.length - 1}
                        onClick={() =>
                          setRoutinePreferences(prev => {
                            const copy = [...prev];
                            const tmp = copy[idx + 1];
                            copy[idx + 1] = copy[idx];
                            copy[idx] = tmp;
                            return copy;
                          })
                        }
                        style={UI.pillBtn(false)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoutinePreferences(prev => prev.filter((_, i) => i !== idx))}
                        style={{ ...UI.pillBtn(false), color: '#FF3B30' }}
                      >
                        ✕
                      </button>
                    </div>
                  </IOSListRow>
                ))}

                <IOSListRow isLast={true} colors={colors}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', width: '100%' }}>
                    {['Compounds', 'Supersets', 'Accessories', 'Abs'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setRoutinePreferences(prev => [...prev, type])}
                        style={{ ...UI.pillBtn(false), color: 'var(--dp-color-accent)' }}
                      >
                        + {type}
                      </button>
                    ))}
                  </div>
                </IOSListRow>
              </IOSListSection>

              <IOSListSection header="SOCIAL" colors={colors}>
                <IOSListRow colors={colors} onClick={() => setShareStatsWithFriends(p => !p)}>
                  <span style={UI.rowTitle}>SHARE STATS WITH FRIENDS</span>
                  <span style={UI.badge(shareStatsWithFriends)}>{shareStatsWithFriends ? 'ON' : 'OFF'}</span>
                </IOSListRow>

                <IOSListRow isLast={true} colors={colors} onClick={() => setShareRoutinesWithFriends(p => !p)}>
                  <span style={UI.rowTitle}>SHARE ROUTINES WITH FRIENDS</span>
                  <span style={UI.badge(shareRoutinesWithFriends)}>{shareRoutinesWithFriends ? 'ON' : 'OFF'}</span>
                </IOSListRow>
              </IOSListSection>

              <IOSListSection
                header="DATA & BACKUP (SCHEMA V3)"
                footer="Your workout history, PRs, routines, gyms, and settings are automatically saved to versioned local storage and retained across app updates."
                colors={colors}
              >
                <IOSListRow colors={colors} onClick={handleExportBackupJSON}>
                  <span style={UI.rowTitle}>EXPORT DATA BACKUP (.JSON)</span>
                  <span style={UI.badge(true)}>DOWNLOAD ↓</span>
                </IOSListRow>

                <IOSListRow colors={colors} onClick={() => importBackupInputRef.current?.click()}>
                  <span style={UI.rowTitle}>IMPORT DATA BACKUP (.JSON)</span>
                  <span style={{ ...UI.badge(false), color: 'var(--dp-color-accent)' }}>UPLOAD ↑</span>
                  <input
                    ref={importBackupInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportBackupJSON}
                    style={{ display: 'none' }}
                  />
                </IOSListRow>

                <IOSListRow isLast={true} colors={colors} onClick={handleResetToDemoDefaults}>
                  <span style={{ ...UI.rowTitle, color: '#FF3B30' }}>CLEAR & RESET ALL LOCAL DATA</span>
                  <span style={{ ...UI.badge(false), color: '#FF3B30' }}>RESET ↺</span>
                </IOSListRow>
              </IOSListSection>
            </div>
          )}

          {/* ================================================================== */}
          {/* VIEW: INFO                                                         */}
          {/* ================================================================== */}
          {currentView === 'info' && (
            <div style={UI.pagePad}>
              <IOSListSection header="01 // SETUP: METRICS, GOALS & PRS" colors={colors}>
                <IOSListRow isLast={true} colors={colors}>
                  <div style={{ lineHeight: 1.5, fontSize: '14px', color: '#E0E0E0' }}>
                    <p style={{ marginBottom: '10px' }}>
                      <strong style={{ color: 'var(--dp-color-accent)' }}>1. BODY METRICS:</strong> Open{' '}
                      <strong>MENU → SETTINGS</strong> to enter your current bodyweight and height.
                    </p>
                    <p style={{ marginBottom: '10px' }}>
                      <strong style={{ color: 'var(--dp-color-accent)' }}>2. GOALS & STANDARDS:</strong> Open{' '}
                      <strong>MENU → GOALS</strong> to choose your focus and select your target ExRx.net strength class.
                    </p>
                    <p>
                      <strong style={{ color: 'var(--dp-color-accent)' }}>3. PERSONAL RECORDS:</strong> Open{' '}
                      <strong>HISTORY → PERSONAL RECORDS</strong> and tap any lift to enter your current 1RM.
                    </p>
                  </div>
                </IOSListRow>
              </IOSListSection>

              <IOSListSection header="02 // LOGGING & AUTO-BUILDING SESSIONS" colors={colors}>
                <IOSListRow isLast={true} colors={colors}>
                  <div style={{ lineHeight: 1.5, fontSize: '14px', color: '#E0E0E0' }}>
                    <p style={{ marginBottom: '10px' }}>
                      <strong style={{ color: 'var(--dp-color-accent)' }}>NEW AUTO SHORTCUT:</strong> Tap{' '}
                      <strong>NEW AUTO</strong> on the Home screen to immediately start an automatically generated workout with calculated weight levels.
                    </p>
                    <p>
                      <strong style={{ color: 'var(--dp-color-accent)' }}>MANUAL OVERRIDES:</strong> Tap any slot's category, scheme, or exercise dropdown to customize it, use <strong>RECALCULATE</strong> to scale weights to your set count or build warmups to a 1 Rep Max, or tap <strong>✕</strong> to delete a set or exercise.
                    </p>
                  </div>
                </IOSListRow>
              </IOSListSection>

              <div style={UI.gutterWrap}>
                <button
                  type="button"
                  onClick={() => setCurrentView('home')}
                  className="kinetic-btn"
                  style={UI.primaryBtnCenter}
                >
                  ENTER WORKSPACE →
                </button>
              </div>
            </div>
          )}

          {/* ================================================================== */}
          {/* VIEW: AUTH / SIGN IN & SIGN UP (BETA CODE: "imnotcrying")          */}
          {/* ================================================================== */}
          {currentView === 'auth' && (
            <div style={UI.pagePad}>
              <IOSListSection header="SIGN IN // EXISTING ACCOUNT" colors={colors}>
                <IOSListRow colors={colors}>
                  <div style={{ width: '100%' }}>
                    <div style={UI.fieldLabel}>USERNAME</div>
                    <input
                      type="text"
                      placeholder="YOUR USERNAME"
                      value={authUsername}
                      onChange={e => setAuthUsername(e.target.value)}
                      style={UI.textInputBare}
                    />
                  </div>
                </IOSListRow>
                <IOSListRow colors={colors}>
                  <div style={{ width: '100%' }}>
                    <div style={UI.fieldLabel}>EMAIL</div>
                    <input
                      type="email"
                      placeholder="YOU@DOMAIN.COM"
                      value={authEmail}
                      onChange={e => setAuthEmail(e.target.value)}
                      style={UI.textInputBare}
                    />
                  </div>
                </IOSListRow>
                <IOSListRow isLast={true} colors={colors}>
                  <div style={{ width: '100%' }}>
                    <div style={UI.fieldLabel}>PASSWORD</div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      style={UI.textInputBare}
                    />
                  </div>
                </IOSListRow>
              </IOSListSection>

              <div style={{ padding: '0 var(--dp-spacing-gutter) 24px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const cleanEmail = authEmail.trim();
                    const cleanUser = authUsername.trim() || cleanEmail.split('@')[0];
                    if (!cleanEmail) return;
                    setUser({ id: `usr_${Date.now()}`, username: cleanUser, email: cleanEmail });
                    setCurrentView('home');
                  }}
                  className="kinetic-btn"
                  style={UI.secondaryBtnCenter}
                >
                  SIGN IN →
                </button>
              </div>

              <IOSListSection
                header="SIGN UP // CREATE ACCOUNT"
                footer="Beta tester access code is required to register a new account."
                colors={colors}
              >
                <IOSListRow colors={colors}>
                  <div style={{ width: '100%' }}>
                    <div style={UI.fieldLabel}>CHOOSE USERNAME</div>
                    <input
                      type="text"
                      placeholder="E.G. IRON_LIFTER"
                      value={signupUsername}
                      onChange={e => setSignupUsername(e.target.value)}
                      style={UI.textInputBare}
                    />
                  </div>
                </IOSListRow>

                <IOSListRow colors={colors}>
                  <div style={{ width: '100%' }}>
                    <div style={UI.fieldLabel}>EMAIL ADDRESS</div>
                    <input
                      type="email"
                      placeholder="YOU@DOMAIN.COM"
                      value={signupEmail}
                      onChange={e => setSignupEmail(e.target.value)}
                      style={UI.textInputBare}
                    />
                  </div>
                </IOSListRow>

                <IOSListRow colors={colors}>
                  <div style={{ width: '100%' }}>
                    <div style={UI.fieldLabel}>CREATE PASSWORD</div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={e => setSignupPassword(e.target.value)}
                      style={UI.textInputBare}
                    />
                  </div>
                </IOSListRow>

                <IOSListRow isLast={true} colors={colors}>
                  <div style={{ width: '100%' }}>
                    <div style={UI.fieldLabel}>BETA TESTER CODE (REQUIRED)</div>
                    <input
                      type="text"
                      placeholder="ENTER BETA CODE"
                      value={signupBetaCode}
                      onChange={e => setSignupBetaCode(e.target.value)}
                      style={UI.textInputBare}
                    />
                  </div>
                </IOSListRow>
              </IOSListSection>

              <div style={UI.gutterWrap}>
                <button
                  type="button"
                  onClick={() => {
                    if (signupBetaCode.trim().toLowerCase() !== 'imnotcrying') return;
                    const cleanEmail = signupEmail.trim();
                    const cleanUser = signupUsername.trim() || (cleanEmail ? cleanEmail.split('@')[0] : '');
                    if (!cleanEmail || !cleanUser) return;
                    const newUser = { id: `usr_${Date.now()}`, username: cleanUser, email: cleanEmail };
                    setUser(newUser);
                    setAuthUsername(cleanUser);
                    setAuthEmail(cleanEmail);
                    setSignupPassword('');
                    setSignupBetaCode('');
                    setCurrentView('info');
                  }}
                  className="kinetic-btn"
                  style={UI.primaryBtnCenter}
                >
                  CREATE ACCOUNT →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* MODAL: DELETE CONFIRMATION (EXERCISE SLOT OR INDIVIDUAL SET)         */}
        {/* ==================================================================== */}
        {deleteConfirmTarget && (
          <div style={{ ...UI.modalBackdrop, zIndex: 90 }} onClick={() => setDeleteConfirmTarget(null)}>
            <div onClick={e => e.stopPropagation()} style={UI.modalCard('360px')}>
              <div style={UI.modalHeader}>
                <span>
                  {deleteConfirmTarget.type === 'slot' ? 'DELETE EXERCISE?' : 'DELETE SET?'}
                </span>
                <button type="button" onClick={() => setDeleteConfirmTarget(null)} style={UI.closeXBtn}>
                  ✕
                </button>
              </div>

              <div style={{ fontSize: '13px', fontWeight: 700, color: '#E0E0E0', marginBottom: '16px', lineHeight: 1.4 }}>
                Are you sure you want to delete{' '}
                <strong style={{ color: 'var(--dp-color-accent)' }}>{deleteConfirmTarget.label}</strong>?
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTarget(null)}
                  className="kinetic-btn"
                  style={{ ...UI.secondaryBtnCenter, padding: '12px', fontSize: '12px' }}
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAction}
                  className="kinetic-btn"
                  style={{
                    ...UI.primaryBtnCenter,
                    padding: '12px',
                    fontSize: '12px',
                    backgroundColor: '#FF3B30',
                    color: '#FFFFFF'
                  }}
                >
                  DELETE ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: "+" ADD EXERCISE MODAL                                        */}
        {/* ==================================================================== */}
        {showAddSlotModal &&
          (() => {
            const modalPool = filterAddSlotExercises(addSlotGymFilter, newSlotCategory, gyms);

            return (
              <div style={UI.modalBackdrop} onClick={() => setShowAddSlotModal(false)}>
                <div onClick={e => e.stopPropagation()} style={UI.modalCard('400px')}>
                  <div style={UI.modalHeader}>
                    <span>ADD WORKOUT SLOT</span>
                    <button type="button" onClick={() => setShowAddSlotModal(false)} style={UI.closeXBtn}>
                      ✕
                    </button>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={UI.stepLabel}>1. GYMS/EQUIPMENT</div>
                    <select
                      value={addSlotGymFilter}
                      onChange={e => {
                        const nextFilter = e.target.value;
                        setAddSlotGymFilter(nextFilter);
                        const nextAvail = filterAddSlotExercises(nextFilter, newSlotCategory, gyms);
                        if (nextAvail.length > 0) {
                          if (!nextAvail.some(x => x.id === newSlotEx1)) setNewSlotEx1(nextAvail[0].id);
                          setNewSlotSupersetIds(prev => [
                            nextAvail.some(x => x.id === prev[0]) ? prev[0] : nextAvail[0].id,
                            nextAvail.some(x => x.id === prev[1]) ? prev[1] : (nextAvail[1] || nextAvail[0]).id
                          ]);
                        }
                      }}
                      style={{ ...UI.select, textTransform: 'uppercase' }}
                    >
                      {DEFAULT_GYM_EQUIPMENT_PRESETS.map(preset => (
                        <option key={preset.id || 'full_gym'} value={preset.id}>
                          {preset.name.toUpperCase()}
                        </option>
                      ))}
                      {gyms.map(g => (
                        <option key={g.id} value={g.id}>{g.name.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={UI.stepLabel}>2. SLOT CATEGORY</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      {['Compound Lift', 'Supersets', 'Accessories', 'Abs'].map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setNewSlotCategory(cat);
                            const nextAvail = filterAddSlotExercises(addSlotGymFilter, cat, gyms);
                            if (nextAvail.length > 0) {
                              if (!nextAvail.some(x => x.id === newSlotEx1)) setNewSlotEx1(nextAvail[0].id);
                              setNewSlotSupersetIds(prev => [
                                nextAvail.some(x => x.id === prev[0]) ? prev[0] : nextAvail[0].id,
                                nextAvail.some(x => x.id === prev[1]) ? prev[1] : (nextAvail[1] || nextAvail[0]).id
                              ]);
                            }
                          }}
                          style={UI.pillBtn(newSlotCategory === cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {newSlotCategory !== 'Supersets' ? (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={UI.stepLabel}>3. SELECT EXERCISE</div>
                      <select
                        value={newSlotEx1}
                        onChange={e => setNewSlotEx1(e.target.value)}
                        style={UI.select}
                      >
                        {modalPool.map(ex => (
                          <option key={ex.id} value={ex.id}>
                            {ex.name} ({ex.equipment})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={UI.stepLabel}>3. SELECT TWO SUPERSET EXERCISES</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {[0, 1].map(idx => (
                          <select
                            key={idx}
                            value={newSlotSupersetIds[idx] || modalPool[0]?.id}
                            onChange={e => {
                              const val = e.target.value;
                              setNewSlotSupersetIds(prev => {
                                const copy = [...prev];
                                copy[idx] = val;
                                return copy;
                              });
                            }}
                            style={{ ...UI.select, padding: '8px' }}
                          >
                            {modalPool.map(ex => (
                              <option key={ex.id} value={ex.id}>
                                {ex.name} ({ex.equipment})
                              </option>
                            ))}
                          </select>
                        ))}
                      </div>
                    </div>
                  )}

                  {newSlotCategory !== 'Abs' && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={UI.stepLabel}>4. SET/REP SCHEME</div>
                      <select
                        value={newSlotScheme}
                        onChange={e => setNewSlotScheme(e.target.value)}
                        style={UI.select}
                      >
                        <option value="5x5">5X5</option>
                        <option value="5x8">5X8</option>
                        <option value="8x8">8X8</option>
                        <option value="Pyramid">PYRAMID</option>
                        <option value="Reverse Pyramid">REVERSE PYRAMID</option>
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddManualSlot}
                    className="kinetic-btn"
                    style={{ ...UI.primaryBtnCenter, padding: '12px', fontSize: '13px' }}
                  >
                    ADD SLOT TO WORKOUT →
                  </button>
                </div>
              </div>
            );
          })()}

        {/* ==================================================================== */}
        {/* MODAL: PLATE & WEIGHT CALCULATOR                                     */}
        {/* ==================================================================== */}
        {plateCalcTarget && (
          <div style={{ ...UI.modalBackdrop, zIndex: 80 }} onClick={() => setPlateCalcTarget(null)}>
            <div onClick={e => e.stopPropagation()} style={UI.modalCard('390px')}>
              <div style={UI.modalHeader}>
                <div>
                  <div style={UI.fieldLabel}>
                    {plateCalcTarget.mode === 'pr'
                      ? 'EDIT PERSONAL RECORD'
                      : plateCalcTarget.mode === 'goal'
                        ? 'EDIT CUSTOM GOAL WEIGHT'
                        : `SET #${plateCalcTarget.setNumber} WEIGHT`}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>
                    {plateCalcTarget.exerciseName}
                  </div>
                </div>
                <button type="button" onClick={() => setPlateCalcTarget(null)} style={UI.closeXBtn}>
                  ✕
                </button>
              </div>

              <div
                style={{
                  backgroundColor: '#101010', border: '2px solid var(--dp-color-rule)',
                  padding: '12px', textAlign: 'center', marginBottom: '12px'
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#A0A0A0' }}>TOTAL WEIGHT</div>
                <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>
                  {computedPlateCalculatorTotal} {calcUnit.toUpperCase()}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                <button
                  type="button"
                  onClick={() => setCalcMode('per_side')}
                  style={UI.pillBtn(calcMode === 'per_side')}
                >
                  PLATES PER SIDE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCalcDirectTotal(computedPlateCalculatorTotal);
                    setCalcMode('total');
                  }}
                  style={UI.pillBtn(calcMode === 'total')}
                >
                  DIRECT TOTAL
                </button>
              </div>

              {calcMode === 'per_side' ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '6px' }}>
                    {[45, 35, 25].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCalcPlatesPerSide(prev => [...prev, p].sort((a, b) => b - a))}
                        style={{ ...UI.pillBtn(false), padding: '10px 4px', fontSize: '12px' }}
                      >
                        +{p} LB
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '10px' }}>
                    {[10, 5, 2.5, 1.25].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCalcPlatesPerSide(prev => [...prev, p].sort((a, b) => b - a))}
                        style={{ ...UI.pillBtn(false), padding: '10px 2px', fontSize: '11px' }}
                      >
                        +{p} LB
                      </button>
                    ))}
                  </div>

                  <div
                    style={{
                      padding: '8px', backgroundColor: '#101010', border: '2px solid var(--dp-color-rule)',
                      marginBottom: '12px', minHeight: '38px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center'
                    }}
                  >
                    {calcPlatesPerSide.length === 0 ? (
                      <span style={{ fontSize: '11px', color: '#888888' }}>
                        Barbell ({calcBarWeight} lb) — tap plates above
                      </span>
                    ) : (
                      [...calcPlatesPerSide]
                        .sort((a, b) => b - a)
                        .map((p, idx) => (
                          <button
                            key={`${p}_${idx}`}
                            type="button"
                            onClick={() =>
                              setCalcPlatesPerSide(prev => {
                                const sorted = [...prev].sort((a, b) => b - a);
                                return sorted.filter((_, i) => i !== idx);
                              })
                            }
                            style={{
                              padding: '2px 6px', backgroundColor: 'var(--dp-color-accent)',
                              color: '#101010', border: 'none', fontSize: '11px', fontWeight: 800, cursor: 'pointer'
                            }}
                          >
                            {p} ✕
                          </button>
                        ))
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '12px' }}>
                  <input
                    type="number"
                    step="1.25"
                    value={calcDirectTotal}
                    onChange={e => setCalcDirectTotal(e.target.value)}
                    style={{ ...UI.numInput('100%'), padding: '10px', fontSize: '18px' }}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleApplyCalculatedWeight}
                className="kinetic-btn"
                style={{ ...UI.primaryBtnCenter, padding: '12px', fontSize: '13px' }}
              >
                APPLY WEIGHT →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}