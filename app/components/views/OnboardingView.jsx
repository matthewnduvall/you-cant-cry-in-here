'use client';

import React, { useState } from 'react';
import {
  BIG_FOUR_IDS,
  CORE_PR_EXERCISE_IDS,
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  DEFAULT_GYM_EQUIPMENT_PRESETS,
  SLOT_CATEGORIES,
  normalizeSlotCategory,
  filterAddSlotExercises,
  getAvailableMuscleGroupsForCategory,
  getExRxTargetForLift,
  formatTodayYMD,
  parseYMDToISO,
  roundTo5
} from '../../data/exerciseLibrary';
import {
  SCHEME_OPTIONS,
  SET_TYPES_LIST,
  normalizeSlotLabels
} from '../../utils/workoutEngine';

const SHARED_CELL_BORDER = {
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: '1px solid var(--dp-color-rule)',
  borderBottom: '1px solid var(--dp-color-rule)'
};

const SHARED_GROUP_OUTER = {
  borderTop: '1px solid var(--dp-color-rule)',
  borderLeft: '1px solid var(--dp-color-rule)'
};

const STRENGTH_CLASS_DESCRIPTIONS = [
  {
    name: 'Untrained',
    description:
      'An individual who has not trained on the exercises before, but can perform them correctly.'
  },
  {
    name: 'Novice',
    description: 'An individual who has trained regularly for up to several months.'
  },
  {
    name: 'Intermediate',
    description: 'An individual who has trained regularly for up to a couple years.'
  },
  {
    name: 'Advanced',
    description: 'An individual who has trained multiple years.'
  },
  {
    name: 'Elite',
    description:
      'An athlete competing in strength sports. Keep in mind, the standards shown in the tables do not represent the highest level of strength performance possible.'
  }
];

const SET_TYPE_MULTIPLIER_MAP = {
  Warmup: 0.74,
  Working: 0.98,
  'Top Out': 1.04,
  'Burn Out': 0.84,
  '1 Rep Max': 1.0
};

const SCHEME_DEFAULT_CONFIG = {
  '5x5': { sets: 5, reps: 5, setType: 'Working' },
  '5x8': { sets: 5, reps: 8, setType: 'Working' },
  '8x8': { sets: 8, reps: 8, setType: 'Working' },
  Pyramid: { sets: 5, reps: 4, setType: 'Top Out' },
  'Pyramid 1RM': { sets: 5, reps: 1, setType: '1 Rep Max' },
  'Reverse Pyramid': { sets: 5, reps: 6, setType: 'Working' },
  Timer: { sets: 5, reps: 8, setType: 'Working' }
};

function OnboardingDragBadge({ label, color = 'var(--dp-color-accent)', height = '42px' }) {
  return (
    <div
      title="Click and drag to rearrange"
      style={{
        position: 'relative',
        width: '34px',
        height,
        minHeight: height,
        boxSizing: 'border-box',
        backgroundColor: '#121214',
        ...SHARED_CELL_BORDER,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        userSelect: 'none',
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '2px',
          backgroundImage: 'radial-gradient(#9A9A9A 1.35px, transparent 1.35px)',
          backgroundSize: '5px 5px',
          backgroundPosition: 'center',
          opacity: 0.62,
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          backgroundColor: 'rgba(16, 16, 16, 0.88)',
          padding: '2px 4px',
          fontSize: '14px',
          fontWeight: 800,
          color,
          lineHeight: 1,
          whiteSpace: 'nowrap'
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function OnboardingView({
  colors,
  setCurrentView,
  userBodyweightLbs,
  setUserBodyweightLbs,
  userHeightFeet,
  setUserHeightFeet,
  userHeightInches,
  setUserHeightInches,
  totalHeightInches,
  goalType,
  setGoalType,
  goalIncrement,
  setGoalIncrement,
  goalUnit,
  setGoalUnit,
  targetStandardClass,
  setTargetStandardClass,
  oneRepMaxes,
  setOneRepMaxes,
  setHistory,
  customPrExerciseIds: externalCustomPrIds,
  setCustomPrExerciseIds: setExternalCustomPrIds,
  customGoalWeights,
  openPlateCalculatorForPR,
  selectedGymId,
  setSelectedGymId,
  gyms = [],
  routinePreferences = [],
  setRoutinePreferences
}) {
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  // --- Custom Added Exercises on Page 3 (Bench, Squat, Deadlift, OHP, Pull Up by default) ---
  const [localCustomPrIds, setLocalCustomPrIds] = useState([]);
  const customPrExerciseIds = externalCustomPrIds || localCustomPrIds;
  const setCustomPrExerciseIds = setExternalCustomPrIds || setLocalCustomPrIds;
  const [showAddPrExercisePanel, setShowAddPrExercisePanel] = useState(false);
  const [addPrGymFilter, setAddPrGymFilter] = useState(selectedGymId || '');
  const [addPrCategory, setAddPrCategory] = useState('Compound');
  const [addPrMuscleGroup, setAddPrMuscleGroup] = useState('All Muscles');
  const [addPrSelectedExId, setAddPrSelectedExId] = useState('barbell_row');

  // --- Drag & Drop State for Page 4 Routine Preferences ---
  const [draggedPrefIndex, setDraggedPrefIndex] = useState(null);

  const displayedPrExerciseIds = Array.from(
    new Set([
      ...CORE_PR_EXERCISE_IDS,
      ...(Array.isArray(customPrExerciseIds) ? customPrExerciseIds : [])
    ])
  );
  const displayedPrExercises = displayedPrExerciseIds
    .map(id => EXERCISE_MAP[id])
    .filter(Boolean);

  const availAddPrMuscleGroups = getAvailableMuscleGroupsForCategory(
    addPrCategory,
    addPrGymFilter,
    gyms
  );
  const activeAddPrMuscle = availAddPrMuscleGroups.includes(addPrMuscleGroup)
    ? addPrMuscleGroup
    : 'All Muscles';
  const filteredAddPrExercises = filterAddSlotExercises(
    addPrGymFilter,
    addPrCategory,
    gyms,
    activeAddPrMuscle
  );
  const resolvedAddPrExId = filteredAddPrExercises.some(e => e.id === addPrSelectedExId)
    ? addPrSelectedExId
    : filteredAddPrExercises[0]?.id || 'incline_bench_press';

  const allGymOptions = [
    ...DEFAULT_GYM_EQUIPMENT_PRESETS,
    ...(gyms || []).map(g => ({ id: g.id, name: g.name }))
  ];

  // --- 1RM Converter Popup State (Page 3) ---
  const [calcPopupExerciseId, setCalcPopupExerciseId] = useState(null);
  const [calcScheme, setCalcScheme] = useState('5x5');
  const [calcSetType, setCalcSetType] = useState('Working');
  const [calcSets, setCalcSets] = useState(5);
  const [calcReps, setCalcReps] = useState(5);
  const [calcWeight, setCalcWeight] = useState(135);

  const open1RMConverterModal = exerciseId => {
    const exId = exerciseId || BIG_FOUR_IDS[0] || 'barbell_bench_press';
    const existingPR = Number(oneRepMaxes?.[exId] || 0);
    setCalcPopupExerciseId(exId);
    setCalcScheme('5x5');
    setCalcSetType('Working');
    setCalcSets(5);
    setCalcReps(5);
    setCalcWeight(existingPR > 0 ? roundTo5(existingPR * 0.75) : 135);
  };

  const handleSelectConverterScheme = schemeKey => {
    setCalcScheme(schemeKey);
    const defaults = SCHEME_DEFAULT_CONFIG[schemeKey];
    if (defaults) {
      setCalcSets(defaults.sets);
      setCalcReps(defaults.reps);
      setCalcSetType(defaults.setType);
    }
  };

  const convertedOneRepMax = (() => {
    const w = Math.max(0, Number(calcWeight) || 0);
    if (w <= 0) return 0;
    const r = Math.max(1, Number(calcReps) || 1);
    const s = Math.max(1, Number(calcSets) || 1);

    if (calcSetType === '1 Rep Max' || (r === 1 && s === 1)) {
      return roundTo5(w);
    }

    const repPct = 1 / (1 + Math.max(0, r - 1) / 30);
    const typeMultiplier = SET_TYPE_MULTIPLIER_MAP[calcSetType] || 0.98;
    const setStressFactor = 1 / (1 + Math.max(0, s - 1) * 0.035);
    const factor = Math.min(1, repPct * typeMultiplier * setStressFactor);

    if (factor <= 0) return roundTo5(w);
    return Math.max(w, roundTo5(w / factor));
  })();

  const handleSaveConvertedPR = () => {
    if (!calcPopupExerciseId || convertedOneRepMax <= 0) return;
    const exObj = EXERCISE_MAP[calcPopupExerciseId] || EXERCISE_LIBRARY[0];
    setOneRepMaxes(prev => ({
      ...prev,
      [calcPopupExerciseId]: convertedOneRepMax
    }));
    if (setHistory) {
      const cleanDate = formatTodayYMD();
      const ts = Date.now();
      const prSet = {
        id: `set_pr_${ts}`,
        setNumber: 1,
        type: '1 Rep Max',
        reps: 1,
        lastWeight: convertedOneRepMax,
        increment: 0,
        weight: convertedOneRepMax,
        completed: true
      };
      const prSlot = {
        id: `slot_pr_${ts}`,
        category: normalizeSlotCategory(exObj.category || 'Compound'),
        slotLabel: normalizeSlotCategory(exObj.category || 'Compound'),
        scheme: calcScheme || '5x5',
        restSeconds: 90,
        muscleGroupFilter: exObj.muscleGroup || 'All Muscles',
        familyMuscleGroup: exObj.muscleGroup || 'Chest',
        exerciseId: exObj.id,
        secondaryExerciseId: null,
        supersetExerciseIds: [exObj.id],
        supersetSetsByExercise: [[prSet]],
        sets: [prSet],
        secondarySets: []
      };
      const newHistEntry = {
        id: `hist_pr_${exObj.id}_${ts}`,
        title: `${cleanDate} - ${exObj.name} PR (${convertedOneRepMax} LB)`,
        loadedRoutineTitle: 'PERSONAL RECORD',
        startedAt: parseYMDToISO(cleanDate),
        updatedAt: new Date().toISOString(),
        isComplete: true,
        verifiedByUser: true,
        defaultRestSeconds: 90,
        slots: normalizeSlotLabels([prSlot])
      };
      setHistory(prev =>
        [newHistEntry, ...(prev || [])].sort(
          (a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime()
        )
      );
    }
    setCalcPopupExerciseId(null);
  };

  const handleReorderRoutinePref = (fromIdx, toIdx) => {
    if (fromIdx === null || toIdx === null || fromIdx === toIdx) return;
    setRoutinePreferences(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const goNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setCurrentView('home');
    }
  };

  const goPrev = () => {
    if (step > 1) {
      setStep(step - 1);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const stdActionBtnStyle = {
    width: '96px',
    height: '44px',
    boxSizing: 'border-box',
    padding: '0 6px',
    fontSize: '12px',
    fontWeight: 800,
    textTransform: 'uppercase',
    ...SHARED_CELL_BORDER,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0
  };

  return (
    <div style={{ paddingTop: '12px', paddingBottom: '36px' }}>
      {/* TOP BAR: PAGE X OF 6 + SKIP + PROGRESS SEGMENTS (SHARED BORDER, ZERO GAP) */}
      <section style={{ marginBottom: '18px', padding: '0 var(--dp-spacing-gutter)' }}>
        <div style={SHARED_GROUP_OUTER}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 88px',
              gap: 0,
              alignItems: 'stretch'
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: '#141416',
                ...SHARED_CELL_BORDER
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: 'var(--dp-color-accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}
              >
                04 / ONBOARDING — PAGE {step} OF {totalSteps}
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  textTransform: 'uppercase',
                  letterSpacing: '-0.03em',
                  marginTop: '2px',
                  lineHeight: 1.15
                }}
              >
                {step === 1 && 'BODY METRICS'}
                {step === 2 && 'GOALS AND STANDARDS'}
                {step === 3 && 'PERSONAL RECORDS'}
                {step === 4 && 'GYMS, EQUIPMENT & ROUTINES'}
                {step === 5 && 'PROGRESS & STIMULUS'}
                {step === 6 && 'SOCIAL FEATURES & LEADERBOARD'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentView('home')}
              style={{
                backgroundColor: '#18181B',
                color: colors.secondaryLabel,
                ...SHARED_CELL_BORDER,
                padding: '0 10px',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              SKIP →
            </button>
          </div>

          {/* 6-STEP PROGRESS SEGMENTS (FLUSH, SHARED BORDERS) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0 }}>
            {[1, 2, 3, 4, 5, 6].map(idx => (
              <button
                key={idx}
                type="button"
                onClick={() => setStep(idx)}
                title={`Go to Page ${idx} of 6`}
                style={{
                  height: '12px',
                  padding: 0,
                  cursor: 'pointer',
                  ...SHARED_CELL_BORDER,
                  backgroundColor:
                    idx === step
                      ? 'var(--dp-color-accent)'
                      : idx < step
                      ? '#30D158'
                      : '#1C1C1F'
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* PAGE 1 OF 6: BODY METRICS */}
      {/* ===================================================================== */}
      {step === 1 && (
        <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
          <div
            style={{
              fontSize: '13px',
              color: colors.secondaryLabel,
              lineHeight: 1.45,
              marginBottom: '12px',
              fontWeight: 600
            }}
          >
            Enter your current bodyweight and height below to calibrate strength
            standards and normalized leaderboard scores, then press{' '}
            <strong style={{ color: '#FFFFFF' }}>NEXT →</strong>.
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 0,
              ...SHARED_GROUP_OUTER
            }}
          >
            <div
              style={{
                backgroundColor: '#141416',
                padding: '10px 12px',
                ...SHARED_CELL_BORDER
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: 'var(--dp-color-accent)',
                  marginBottom: '6px'
                }}
              >
                BODYWEIGHT (LBS)
              </div>
              <input
                type="number"
                min={60}
                max={500}
                value={userBodyweightLbs}
                onChange={e =>
                  setUserBodyweightLbs(Math.max(60, Number(e.target.value) || 0))
                }
                style={{
                  width: '100%',
                  padding: '6px 0',
                  fontSize: '20px',
                  fontWeight: 800,
                  backgroundColor: 'transparent',
                  color: '#FFFFFF',
                  border: 'none',
                  outline: 'none'
                }}
              />
            </div>

            <div
              style={{
                backgroundColor: '#141416',
                padding: '10px 12px',
                ...SHARED_CELL_BORDER
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: 'var(--dp-color-accent)',
                  marginBottom: '6px'
                }}
              >
                HEIGHT (FT)
              </div>
              <input
                type="number"
                min={4}
                max={7}
                value={userHeightFeet}
                onChange={e =>
                  setUserHeightFeet(
                    Math.min(7, Math.max(4, Number(e.target.value) || 4))
                  )
                }
                style={{
                  width: '100%',
                  padding: '6px 0',
                  fontSize: '20px',
                  fontWeight: 800,
                  backgroundColor: 'transparent',
                  color: '#FFFFFF',
                  border: 'none',
                  outline: 'none'
                }}
              />
            </div>

            <div
              style={{
                backgroundColor: '#141416',
                padding: '10px 12px',
                ...SHARED_CELL_BORDER
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: 'var(--dp-color-accent)',
                  marginBottom: '6px'
                }}
              >
                HEIGHT (IN)
              </div>
              <input
                type="number"
                min={0}
                max={11}
                value={userHeightInches}
                onChange={e =>
                  setUserHeightInches(
                    Math.min(11, Math.max(0, Number(e.target.value) || 0))
                  )
                }
                style={{
                  width: '100%',
                  padding: '6px 0',
                  fontSize: '20px',
                  fontWeight: 800,
                  backgroundColor: 'transparent',
                  color: '#FFFFFF',
                  border: 'none',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* PAGE 2 OF 6: GOALS AND STANDARDS (SHARED BORDERS, NO GAPS) */}
      {/* ===================================================================== */}
      {step === 2 && (
        <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
          {/* PRIMARY FOCUS */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: colors.secondaryLabel,
                marginBottom: '6px',
                textTransform: 'uppercase'
              }}
            >
              PRIMARY TRAINING FOCUS
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 0,
                ...SHARED_GROUP_OUTER
              }}
            >
              {['Strength', 'Hypertrophy', 'Maintain'].map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoalType(g)}
                  style={{
                    height: '44px',
                    padding: '0 8px',
                    fontSize: '13px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    backgroundColor:
                      goalType === g ? 'var(--dp-color-accent)' : '#141416',
                    color: goalType === g ? '#000000' : '#FFFFFF',
                    ...SHARED_CELL_BORDER,
                    cursor: 'pointer'
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* PROGRESSION INCREMENT */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: colors.secondaryLabel,
                marginBottom: '6px',
                textTransform: 'uppercase'
              }}
            >
              PROGRESSION INCREMENT (BARBELL LIFTS AUTOMATICALLY × 2)
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr)) 52px 52px',
                gap: 0,
                ...SHARED_GROUP_OUTER
              }}
            >
              {[1.25, 2.5, 5, 10].map(inc => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => setGoalIncrement(inc)}
                  style={{
                    height: '44px',
                    padding: '0 4px',
                    fontSize: '13px',
                    fontWeight: 800,
                    backgroundColor:
                      goalIncrement === inc ? '#FFFFFF' : '#141416',
                    color: goalIncrement === inc ? '#000000' : '#FFFFFF',
                    ...SHARED_CELL_BORDER,
                    cursor: 'pointer'
                  }}
                >
                  +{inc} {goalUnit.toUpperCase()}
                </button>
              ))}
              {['lb', 'kg'].map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setGoalUnit(u)}
                  style={{
                    height: '44px',
                    padding: '0 6px',
                    fontSize: '13px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    backgroundColor:
                      goalUnit === u ? 'var(--dp-color-accent)' : '#18181B',
                    color: goalUnit === u ? '#000000' : '#FFFFFF',
                    ...SHARED_CELL_BORDER,
                    cursor: 'pointer'
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* STRENGTH CLASS GOAL — VERTICAL DESCRIPTIVE SELECTOR (SHARED BORDERS) */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: colors.secondaryLabel,
                marginBottom: '6px',
                textTransform: 'uppercase'
              }}
            >
              STRENGTH CLASS GOAL (TAP TO SELECT)
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                ...SHARED_GROUP_OUTER
              }}
            >
              {STRENGTH_CLASS_DESCRIPTIONS.map(item => {
                const isSelected = targetStandardClass === item.name;
                return (
                  <div
                    key={item.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => setTargetStandardClass(item.name)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setTargetStandardClass(item.name);
                      }
                    }}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: isSelected ? '#1C1C20' : '#141416',
                      ...SHARED_CELL_BORDER,
                      cursor: 'pointer'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 800,
                          color: isSelected ? 'var(--dp-color-accent)' : '#FFFFFF',
                          textTransform: 'uppercase'
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          width: '86px',
                          height: '26px',
                          boxSizing: 'border-box',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: 800,
                          backgroundColor: isSelected
                            ? 'var(--dp-color-accent)'
                            : '#101012',
                          color: isSelected ? '#000000' : '#9A9A9A',
                          border: '1px solid var(--dp-color-rule)'
                        }}
                      >
                        {isSelected ? 'SELECTED ✓' : 'SELECT'}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: colors.secondaryLabel,
                        lineHeight: 1.4
                      }}
                    >
                      {item.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* PAGE 3 OF 6: PERSONAL RECORDS (SHARED BORDERS, ZERO GAPS) */}
      {/* ===================================================================== */}
      {step === 3 && (
        <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
          <div
            style={{
              fontSize: '13px',
              color: colors.secondaryLabel,
              lineHeight: 1.45,
              marginBottom: '12px',
              fontWeight: 600
            }}
          >
            Set your core <strong style={{ color: '#FFFFFF' }}>Personal Records</strong>{' '}
            below (missing records are highlighted in{' '}
            <strong style={{ color: '#FF3B30' }}>RED</strong>), or add any other
            exercise using the filters below.
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              ...SHARED_GROUP_OUTER
            }}
          >
            {displayedPrExercises.map(ex => {
              const rawVal = Number(oneRepMaxes?.[ex.id]) || 0;
              const isTBD = rawVal <= 0;
              const current1RM = isTBD ? 0 : rawVal;
              const goal1RM = getExRxTargetForLift(
                ex.id,
                targetStandardClass,
                userBodyweightLbs,
                totalHeightInches,
                customGoalWeights
              );
              const diffFromGoal = !isTBD && goal1RM ? goal1RM - current1RM : null;
              return (
                <div
                  key={ex.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 96px 96px',
                    gap: 0,
                    alignItems: 'stretch',
                    backgroundColor: '#141416'
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      ...SHARED_CELL_BORDER
                    }}
                  >
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 800,
                        color: '#FFFFFF',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {ex.name}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: colors.secondaryLabel,
                        marginTop: '1px'
                      }}
                    >
                      {isTBD
                        ? `${targetStandardClass.toUpperCase()} GOAL: ${goal1RM} LB`
                        : diffFromGoal > 0
                          ? `${targetStandardClass.toUpperCase()} GOAL: ${goal1RM} LB (${diffFromGoal} LB TO GOAL)`
                          : `${targetStandardClass.toUpperCase()} GOAL: ${goal1RM} LB (ACHIEVED +${Math.abs(diffFromGoal)} LB)`}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => open1RMConverterModal(ex.id)}
                    style={{
                      ...stdActionBtnStyle,
                      height: '100%',
                      minHeight: '48px',
                      backgroundColor: '#1C1C20',
                      color: '#FFFFFF'
                    }}
                  >
                    CALCULATE
                  </button>

                  <button
                    type="button"
                    onClick={() => openPlateCalculatorForPR(ex.id, ex.name, current1RM)}
                    style={{
                      ...stdActionBtnStyle,
                      height: '100%',
                      minHeight: '48px',
                      backgroundColor: isTBD
                        ? '#FF3B30'
                        : 'var(--dp-color-accent)',
                      color: isTBD ? '#FFFFFF' : '#000000'
                    }}
                  >
                    {isTBD ? 'TBD ✎' : `${current1RM} LB ✎`}
                  </button>
                </div>
              );
            })}

            {/* ADD USER-SELECTED EXERCISE WITH FILTERS (SHARED BORDERS) */}
            {!showAddPrExercisePanel ? (
              <button
                type="button"
                onClick={() => setShowAddPrExercisePanel(true)}
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '0 12px',
                  backgroundColor: '#18181B',
                  color: 'var(--dp-color-accent)',
                  ...SHARED_CELL_BORDER,
                  fontSize: '12px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  cursor: 'pointer'
                }}
              >
                + ADD WORKOUT / EXERCISE TO PERSONAL RECORDS
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Header row of Add Exercise Panel */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 40px',
                    gap: 0,
                    height: '38px'
                  }}
                >
                  <div
                    style={{
                      backgroundColor: '#18181B',
                      padding: '0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '11px',
                      fontWeight: 800,
                      color: 'var(--dp-color-accent)',
                      textTransform: 'uppercase',
                      ...SHARED_CELL_BORDER
                    }}
                  >
                    ADD EXERCISE TO PERSONAL RECORDS
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddPrExercisePanel(false)}
                    style={{
                      backgroundColor: '#FF3B30',
                      color: '#101010',
                      ...SHARED_CELL_BORDER,
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Row 1 Filters: Gym/Equipment, Workout Type, Muscle Group */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 0,
                    height: '40px'
                  }}
                >
                  <select
                    aria-label="Filter by Gyms/Equipment"
                    value={addPrGymFilter}
                    onChange={e => {
                      const nextGym = e.target.value;
                      setAddPrGymFilter(nextGym);
                      const nextAvailMgs = getAvailableMuscleGroupsForCategory(addPrCategory, nextGym, gyms);
                      const nextMg = nextAvailMgs.includes(activeAddPrMuscle) ? activeAddPrMuscle : 'All Muscles';
                      setAddPrMuscleGroup(nextMg);
                      const nextAvail = filterAddSlotExercises(nextGym, addPrCategory, gyms, nextMg);
                      if (nextAvail.length > 0) setAddPrSelectedExId(nextAvail[0].id);
                    }}
                    style={{
                      width: '100%',
                      height: '40px',
                      backgroundColor: '#141416',
                      color: '#FFFFFF',
                      ...SHARED_CELL_BORDER,
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '0 8px'
                    }}
                  >
                    {allGymOptions.map(g => (
                      <option key={g.id || 'full_gym'} value={g.id}>
                        {g.name.toUpperCase()}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by Workout Type"
                    value={addPrCategory}
                    onChange={e => {
                      const nextCat = e.target.value;
                      setAddPrCategory(nextCat);
                      const nextAvailMgs = getAvailableMuscleGroupsForCategory(nextCat, addPrGymFilter, gyms);
                      const nextMg = nextAvailMgs.includes(activeAddPrMuscle) ? activeAddPrMuscle : 'All Muscles';
                      setAddPrMuscleGroup(nextMg);
                      const nextAvail = filterAddSlotExercises(addPrGymFilter, nextCat, gyms, nextMg);
                      if (nextAvail.length > 0) setAddPrSelectedExId(nextAvail[0].id);
                    }}
                    style={{
                      width: '100%',
                      height: '40px',
                      backgroundColor: '#141416',
                      color: '#FFFFFF',
                      ...SHARED_CELL_BORDER,
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '0 8px'
                    }}
                  >
                    {['Compound', 'Accessory'].map(cat => (
                      <option key={cat} value={cat}>
                        {cat.toUpperCase()}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by Muscle Group"
                    value={activeAddPrMuscle}
                    onChange={e => {
                      const nextMg = e.target.value;
                      setAddPrMuscleGroup(nextMg);
                      const nextAvail = filterAddSlotExercises(addPrGymFilter, addPrCategory, gyms, nextMg);
                      if (nextAvail.length > 0) setAddPrSelectedExId(nextAvail[0].id);
                    }}
                    style={{
                      width: '100%',
                      height: '40px',
                      backgroundColor: '#141416',
                      color: '#FFFFFF',
                      ...SHARED_CELL_BORDER,
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '0 8px'
                    }}
                  >
                    {availAddPrMuscleGroups.map(mg => (
                      <option key={mg} value={mg}>
                        {mg.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Row 2: Exercise Selector + Add Button */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 96px',
                    gap: 0,
                    height: '42px'
                  }}
                >
                  <select
                    aria-label="Select Exercise"
                    value={resolvedAddPrExId}
                    onChange={e => setAddPrSelectedExId(e.target.value)}
                    style={{
                      width: '100%',
                      height: '42px',
                      backgroundColor: '#141416',
                      color: '#FFFFFF',
                      ...SHARED_CELL_BORDER,
                      fontSize: '13px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '0 8px'
                    }}
                  >
                    {filteredAddPrExercises.map(ex => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name.toUpperCase()} ({ex.equipment.toUpperCase()})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      if (resolvedAddPrExId) {
                        setCustomPrExerciseIds(prev =>
                          prev.includes(resolvedAddPrExId)
                            ? prev
                            : [...prev, resolvedAddPrExId]
                        );
                        setShowAddPrExercisePanel(false);
                      }
                    }}
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      backgroundColor: 'var(--dp-color-accent)',
                      color: '#000000',
                      ...SHARED_CELL_BORDER,
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer'
                    }}
                  >
                    + ADD
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* PAGE 4 OF 6: GYMS, EQUIPMENT & ROUTINES (SHARED BORDERS, DRAG SLOTS) */}
      {/* ===================================================================== */}
      {step === 4 && (
        <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
          {/* ACTIVE GYM SELECTOR */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: colors.secondaryLabel,
                marginBottom: '6px',
                textTransform: 'uppercase'
              }}
            >
              ACTIVE GYMS / EQUIPMENT FILTER
            </div>
            <div style={SHARED_GROUP_OUTER}>
              <select
                value={selectedGymId || ''}
                onChange={e => setSelectedGymId(e.target.value)}
                style={{
                  width: '100%',
                  height: '46px',
                  backgroundColor: '#141416',
                  color: '#FFFFFF',
                  ...SHARED_CELL_BORDER,
                  padding: '0 12px',
                  fontSize: '14px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  cursor: 'pointer'
                }}
              >
                {allGymOptions.map(g => (
                  <option key={g.id || 'full_gym'} value={g.id}>
                    {g.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* DEFAULT ROUTINE STRUCTURE WITH GRIPPY DRAG HANDLES */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: colors.secondaryLabel,
                marginBottom: '6px',
                textTransform: 'uppercase'
              }}
            >
              DEFAULT ROUTINE STRUCTURE ({routinePreferences.length} SLOTS — DRAG TO REORDER)
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                ...SHARED_GROUP_OUTER
              }}
            >
              {routinePreferences.map((prefType, idx) => (
                <div
                  key={`${prefType}_${idx}`}
                  draggable={true}
                  onDragStart={() => setDraggedPrefIndex(idx)}
                  onDragOver={e => {
                    if (draggedPrefIndex !== null) {
                      e.preventDefault();
                    }
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    if (draggedPrefIndex !== null && draggedPrefIndex !== idx) {
                      handleReorderRoutinePref(draggedPrefIndex, idx);
                    }
                    setDraggedPrefIndex(null);
                  }}
                  onDragEnd={() => setDraggedPrefIndex(null)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '34px minmax(0, 1fr) 34px',
                    gap: 0,
                    alignItems: 'stretch',
                    opacity: draggedPrefIndex === idx ? 0.55 : 1
                  }}
                >
                  <OnboardingDragBadge
                    label={idx + 1}
                    color="var(--dp-color-accent)"
                    height="42px"
                  />

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 12px',
                      height: '42px',
                      boxSizing: 'border-box',
                      backgroundColor: '#141416',
                      ...SHARED_CELL_BORDER,
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      textTransform: 'uppercase',
                      cursor: 'grab'
                    }}
                  >
                    {prefType}
                  </div>

                  <button
                    type="button"
                    disabled={routinePreferences.length <= 1}
                    onClick={() =>
                      setRoutinePreferences(prev =>
                        prev.filter((_, i) => i !== idx)
                      )
                    }
                    style={{
                      width: '34px',
                      height: '42px',
                      boxSizing: 'border-box',
                      padding: 0,
                      fontSize: '14px',
                      fontWeight: 800,
                      backgroundColor: '#FF3B30',
                      color: '#101010',
                      ...SHARED_CELL_BORDER,
                      cursor:
                        routinePreferences.length <= 1 ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* ADD SLOT CATEGORY ROW (FLUSH, SHARED BORDERS) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 0
                }}
              >
                {SLOT_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setRoutinePreferences(prev => [...prev, cat])}
                    style={{
                      height: '42px',
                      padding: '0 4px',
                      fontSize: '11px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      backgroundColor: '#18181B',
                      color: 'var(--dp-color-accent)',
                      ...SHARED_CELL_BORDER,
                      cursor: 'pointer'
                    }}
                  >
                    + {cat.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* PAGE 5 OF 6: PROGRESS & STIMULUS (SUMMARY + EXAMPLE IMAGES) */}
      {/* ===================================================================== */}
      {step === 5 && (
        <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
          <div style={SHARED_GROUP_OUTER}>
            {/* 1. PROGRESS SUMMARY + EXAMPLE CHART IMAGE */}
            <div
              style={{
                padding: '14px',
                backgroundColor: '#141416',
                ...SHARED_CELL_BORDER
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  color: 'var(--dp-color-accent)',
                  textTransform: 'uppercase',
                  marginBottom: '6px'
                }}
              >
                1. PROGRESS
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: colors.secondaryLabel,
                  lineHeight: 1.45,
                  marginBottom: '10px'
                }}
              >
                Tracks your <strong style={{ color: '#FFFFFF' }}>Big 3 + OHP</strong>{' '}
                top working weights and total workout volume over time against your
                dashed{' '}
                <strong style={{ color: 'var(--dp-color-accent)' }}>
                  {targetStandardClass.toUpperCase()}
                </strong>{' '}
                strength goal line.
              </div>

              <div
                style={{
                  backgroundColor: '#101012',
                  border: '1px solid var(--dp-color-rule)',
                  padding: '10px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'DEADLIFT', color: '#FFD60A' },
                      { label: 'SQUAT', color: '#30D158' },
                      { label: 'BENCH', color: '#FF6B00' },
                      { label: 'OHP', color: '#00E5FF' }
                    ].map(item => (
                      <span
                        key={item.label}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10px',
                          fontWeight: 800,
                          color: '#FFFFFF'
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            backgroundColor: item.color,
                            display: 'inline-block'
                          }}
                        />
                        {item.label}
                      </span>
                    ))}
                  </div>
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      color: '#888888'
                    }}
                  >
                    EXAMPLE PREVIEW
                  </span>
                </div>

                <svg
                  viewBox="0 0 340 140"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    backgroundColor: '#0C0C0C'
                  }}
                >
                  {[25, 55, 85, 115].map((y, i) => (
                    <line
                      key={i}
                      x1="34"
                      y1={y}
                      x2="326"
                      y2={y}
                      stroke="#222222"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  ))}
                  <text x="28" y="28" textAnchor="end" fill="#777" fontSize="8" fontWeight="700">405</text>
                  <text x="28" y="58" textAnchor="end" fill="#777" fontSize="8" fontWeight="700">315</text>
                  <text x="28" y="88" textAnchor="end" fill="#777" fontSize="8" fontWeight="700">225</text>
                  <text x="28" y="118" textAnchor="end" fill="#777" fontSize="8" fontWeight="700">135</text>

                  <line
                    x1="34"
                    y1="42"
                    x2="326"
                    y2="42"
                    stroke="#FF6B00"
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                  />
                  <text x="322" y="38" textAnchor="end" fill="#FF6B00" fontSize="8" fontWeight="800">
                    GOAL
                  </text>

                  <polyline
                    fill="none"
                    stroke="#FFD60A"
                    strokeWidth="2.2"
                    points="45,58 115,50 185,42 255,34 315,26"
                  />
                  <polyline
                    fill="none"
                    stroke="#30D158"
                    strokeWidth="2.2"
                    points="45,78 115,70 185,63 255,55 315,48"
                  />
                  <polyline
                    fill="none"
                    stroke="#FF6B00"
                    strokeWidth="2.2"
                    points="45,96 115,90 185,84 255,78 315,72"
                  />
                  <polyline
                    fill="none"
                    stroke="#00E5FF"
                    strokeWidth="2.2"
                    points="45,116 115,112 185,108 255,103 315,98"
                  />

                  {[
                    [45, 58, '#FFD60A'], [115, 50, '#FFD60A'], [185, 42, '#FFD60A'], [255, 34, '#FFD60A'], [315, 26, '#FFD60A'],
                    [45, 78, '#30D158'], [115, 70, '#30D158'], [185, 63, '#30D158'], [255, 55, '#30D158'], [315, 48, '#30D158'],
                    [45, 96, '#FF6B00'], [115, 90, '#FF6B00'], [185, 84, '#FF6B00'], [255, 78, '#FF6B00'], [315, 72, '#FF6B00'],
                    [45, 116, '#00E5FF'], [115, 112, '#00E5FF'], [185, 108, '#00E5FF'], [255, 103, '#00E5FF'], [315, 98, '#00E5FF']
                  ].map(([cx, cy, c], idx) => (
                    <circle key={idx} cx={cx} cy={cy} r="3" fill={c} stroke="#101010" strokeWidth="1" />
                  ))}

                  <text x="45" y="133" textAnchor="middle" fill="#888" fontSize="8" fontWeight="800">WK 1</text>
                  <text x="115" y="133" textAnchor="middle" fill="#888" fontSize="8" fontWeight="800">WK 2</text>
                  <text x="185" y="133" textAnchor="middle" fill="#888" fontSize="8" fontWeight="800">WK 3</text>
                  <text x="255" y="133" textAnchor="middle" fill="#888" fontSize="8" fontWeight="800">WK 4</text>
                  <text x="315" y="133" textAnchor="middle" fill="#888" fontSize="8" fontWeight="800">NOW</text>
                </svg>
              </div>
            </div>

            {/* 2. STIMULUS SUMMARY + EXAMPLE DIAGRAM IMAGE */}
            <div
              style={{
                padding: '14px',
                backgroundColor: '#141416',
                ...SHARED_CELL_BORDER
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  color: 'var(--dp-color-accent)',
                  textTransform: 'uppercase',
                  marginBottom: '6px'
                }}
              >
                2. STIMULUS
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: colors.secondaryLabel,
                  lineHeight: 1.45,
                  marginBottom: '10px'
                }}
              >
                Color-codes Anterior and Posterior muscle recovery:{' '}
                <strong style={{ color: '#30D158' }}>GREEN</strong> (recently
                trained), <strong style={{ color: '#FFD60A' }}>YELLOW</strong>{' '}
                (recovering), and <strong style={{ color: '#FF3B30' }}>RED</strong>{' '}
                (fresh &amp; prioritized by <strong style={{ color: '#FFFFFF' }}>AUTO</strong>).
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 0,
                  ...SHARED_GROUP_OUTER
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    backgroundColor: '#101012',
                    padding: '10px',
                    ...SHARED_CELL_BORDER
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      color: 'var(--dp-color-accent)',
                      marginBottom: '6px'
                    }}
                  >
                    ANTERIOR // FRONT
                  </div>
                  <svg viewBox="0 0 120 230" style={{ width: '100%', maxWidth: '105px', height: 'auto' }}>
                    <rect x="50" y="6" width="20" height="22" fill="#262626" stroke="#5C5C5C" strokeWidth="1.5" />
                    <rect x="54" y="28" width="12" height="8" fill="#FFD60A" stroke="#101010" strokeWidth="1" />
                    <rect x="22" y="36" width="16" height="22" fill="#30D158" stroke="#101010" strokeWidth="1.5" />
                    <rect x="82" y="36" width="16" height="22" fill="#30D158" stroke="#101010" strokeWidth="1.5" />
                    <rect x="38" y="36" width="21" height="28" fill="#30D158" stroke="#101010" strokeWidth="1.5" />
                    <rect x="61" y="36" width="21" height="28" fill="#30D158" stroke="#101010" strokeWidth="1.5" />
                    <rect x="18" y="60" width="15" height="24" fill="#FFD60A" stroke="#101010" strokeWidth="1.5" />
                    <rect x="87" y="60" width="15" height="24" fill="#FFD60A" stroke="#101010" strokeWidth="1.5" />
                    <rect x="18" y="85" width="15" height="23" fill="#FFD60A" stroke="#101010" strokeWidth="1.5" />
                    <rect x="87" y="85" width="15" height="23" fill="#FFD60A" stroke="#101010" strokeWidth="1.5" />
                    <rect x="40" y="66" width="40" height="46" fill="#30D158" stroke="#101010" strokeWidth="1.5" />
                    <line x1="60" y1="66" x2="60" y2="112" stroke="#101010" strokeWidth="1.5" />
                    <line x1="40" y1="81" x2="80" y2="81" stroke="#101010" strokeWidth="1.5" />
                    <line x1="40" y1="96" x2="80" y2="96" stroke="#101010" strokeWidth="1.5" />
                    <rect x="38" y="116" width="20" height="58" fill="#FF3B30" stroke="#101010" strokeWidth="1.5" />
                    <rect x="62" y="116" width="20" height="58" fill="#FF3B30" stroke="#101010" strokeWidth="1.5" />
                    <rect x="40" y="177" width="16" height="44" fill="#FF3B30" stroke="#101010" strokeWidth="1.5" />
                    <rect x="64" y="177" width="16" height="44" fill="#FF3B30" stroke="#101010" strokeWidth="1.5" />
                  </svg>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    backgroundColor: '#101012',
                    padding: '10px',
                    ...SHARED_CELL_BORDER
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      color: 'var(--dp-color-accent)',
                      marginBottom: '6px'
                    }}
                  >
                    POSTERIOR // BACK
                  </div>
                  <svg viewBox="0 0 120 230" style={{ width: '100%', maxWidth: '105px', height: 'auto' }}>
                    <rect x="50" y="6" width="20" height="22" fill="#262626" stroke="#5C5C5C" strokeWidth="1.5" />
                    <rect x="54" y="28" width="12" height="8" fill="#FFD60A" stroke="#101010" strokeWidth="1" />
                    <rect x="22" y="36" width="16" height="22" fill="#30D158" stroke="#101010" strokeWidth="1.5" />
                    <rect x="82" y="36" width="16" height="22" fill="#30D158" stroke="#101010" strokeWidth="1.5" />
                    <rect x="38" y="36" width="44" height="52" fill="#FFD60A" stroke="#101010" strokeWidth="1.5" />
                    <line x1="60" y1="36" x2="60" y2="88" stroke="#101010" strokeWidth="1.5" />
                    <rect x="18" y="60" width="15" height="24" fill="#FFD60A" stroke="#101010" strokeWidth="1.5" />
                    <rect x="87" y="60" width="15" height="24" fill="#FFD60A" stroke="#101010" strokeWidth="1.5" />
                    <rect x="18" y="85" width="15" height="23" fill="#FFD60A" stroke="#101010" strokeWidth="1.5" />
                    <rect x="87" y="85" width="15" height="23" fill="#FFD60A" stroke="#101010" strokeWidth="1.5" />
                    <rect x="42" y="90" width="36" height="22" fill="#30D158" stroke="#101010" strokeWidth="1.5" />
                    <rect x="38" y="114" width="21" height="24" fill="#FF3B30" stroke="#101010" strokeWidth="1.5" />
                    <rect x="61" y="114" width="21" height="24" fill="#FF3B30" stroke="#101010" strokeWidth="1.5" />
                    <rect x="38" y="140" width="20" height="36" fill="#FF3B30" stroke="#101010" strokeWidth="1.5" />
                    <rect x="62" y="140" width="20" height="36" fill="#FF3B30" stroke="#101010" strokeWidth="1.5" />
                    <rect x="40" y="178" width="16" height="43" fill="#FF3B30" stroke="#101010" strokeWidth="1.5" />
                    <rect x="64" y="178" width="16" height="43" fill="#FF3B30" stroke="#101010" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* PAGE 6 OF 6: SOCIAL FEATURES & LEADERBOARD (SINGLE-SENTENCE SUMMARIES) */}
      {/* ===================================================================== */}
      {step === 6 && (
        <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
          <div style={SHARED_GROUP_OUTER}>
            {/* 1. SOCIAL FEATURES (SINGLE SENTENCE) */}
            <div
              style={{
                padding: '16px 14px',
                backgroundColor: '#141416',
                ...SHARED_CELL_BORDER
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  color: 'var(--dp-color-accent)',
                  textTransform: 'uppercase',
                  marginBottom: '6px'
                }}
              >
                1. SOCIAL &amp; SHARED ROUTINES
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: colors.secondaryLabel,
                  lineHeight: 1.5
                }}
              >
                Invite training partners via email (pre-loaded with beta code{' '}
                <strong style={{ color: 'var(--dp-color-accent)' }}>imnotcrying</strong>{' '}
                for automatic friendship) to stream their latest Big 3 lifts on the
                Home ticker and load their shared routines.
              </div>
            </div>

            {/* 2. LEADERBOARD (SINGLE SENTENCE) */}
            <div
              style={{
                padding: '16px 14px',
                backgroundColor: '#141416',
                ...SHARED_CELL_BORDER
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  color: 'var(--dp-color-accent)',
                  textTransform: 'uppercase',
                  marginBottom: '6px'
                }}
              >
                2. LEADERBOARDS
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: colors.secondaryLabel,
                  lineHeight: 1.5
                }}
              >
                Compete with friends across <strong style={{ color: '#FFFFFF' }}>Big 3 Total</strong>,{' '}
                <strong style={{ color: '#FFFFFF' }}>Big 3 Normalized</strong>,{' '}
                <strong style={{ color: '#FFFFFF' }}>Overhead Press Normalized</strong>, and{' '}
                <strong style={{ color: '#FFFFFF' }}>Most Improved</strong> rankings
                with live Strength Standard standings.
              </div>
            </div>

            <div
              style={{
                padding: '16px 14px',
                backgroundColor: '#141416',
                ...SHARED_CELL_BORDER
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  color: 'var(--dp-color-accent)',
                  textTransform: 'uppercase',
                  marginBottom: '6px'
                }}
              >
                3. FEEDBACK
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: colors.secondaryLabel,
                  lineHeight: 1.5
                }}
              >
                This app is in constant development, if you have any suggestions, requests, or issues please tap the{' '}
                <strong style={{ color: '#FFFFFF' }}>FEEDBACK</strong> button on the top right and relay the info. Thanks!
              </div>
            </div>
          </div>
        </section>
      )}

      {/* BOTTOM PAGER CONTROLS: BACK / NEXT OR START (SHARED BORDERS, ZERO GAP) */}
      <section style={{ padding: '0 var(--dp-spacing-gutter)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: step > 1 ? '1fr 2fr' : '1fr',
            gap: 0,
            ...SHARED_GROUP_OUTER
          }}
        >
          {step > 1 && (
            <button
              type="button"
              onClick={goPrev}
              style={{
                height: '48px',
                backgroundColor: '#18181B',
                color: '#FFFFFF',
                ...SHARED_CELL_BORDER,
                fontSize: '14px',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              ← BACK
            </button>
          )}

          <button
            type="button"
            onClick={goNext}
            style={{
              height: '48px',
              backgroundColor: 'var(--dp-color-accent)',
              color: '#000000',
              ...SHARED_CELL_BORDER,
              fontSize: '14px',
              fontWeight: 800,
              textTransform: 'uppercase',
              cursor: 'pointer'
            }}
          >
            {step < totalSteps
              ? `NEXT (${step + 1} OF ${totalSteps}) →`
              : 'START →'}
          </button>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* POPUP MODAL: CONVERT SETS, REPS & SCHEME INTO 1RM PERSONAL RECORD */}
      {/* ===================================================================== */}
      {calcPopupExerciseId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 350,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setCalcPopupExerciseId(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#161618',
              border: '2px solid var(--dp-color-rule)',
              padding: '16px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}
            >
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: 'var(--dp-color-accent)'
                }}
              >
                CALCULATE 1RM PERSONAL RECORD
              </div>
              <button
                type="button"
                onClick={() => setCalcPopupExerciseId(null)}
                style={{
                  backgroundColor: '#FF3B30',
                  color: '#101010',
                  border: '1px solid var(--dp-color-rule)',
                  width: '28px',
                  height: '28px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                fontSize: '12px',
                color: colors.secondaryLabel,
                lineHeight: 1.4,
                marginBottom: '12px'
              }}
            >
              Convert any exercise scheme, set count, rep count, and weight into a
              calibrated 1 Rep Max Personal Record.
            </div>

            {/* EXERCISE SELECTOR */}
            <div style={{ marginBottom: '10px' }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: colors.secondaryLabel,
                  marginBottom: '4px'
                }}
              >
                EXERCISE
              </div>
              <div style={SHARED_GROUP_OUTER}>
                <select
                  value={calcPopupExerciseId}
                  onChange={e => setCalcPopupExerciseId(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    backgroundColor: '#141416',
                    color: '#FFFFFF',
                    ...SHARED_CELL_BORDER,
                    padding: '0 10px',
                    fontSize: '13px',
                    fontWeight: 800,
                    textTransform: 'uppercase'
                  }}
                >
                  {EXERCISE_LIBRARY.map(ex => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* SCHEME SELECTOR */}
            <div style={{ marginBottom: '10px' }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: colors.secondaryLabel,
                  marginBottom: '4px'
                }}
              >
                SCHEME PRESET
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 0,
                  ...SHARED_GROUP_OUTER
                }}
              >
                {SCHEME_OPTIONS.map(schemeKey => (
                  <button
                    key={schemeKey}
                    type="button"
                    onClick={() => handleSelectConverterScheme(schemeKey)}
                    style={{
                      height: '38px',
                      padding: '0 4px',
                      fontSize: '11px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      backgroundColor:
                        calcScheme === schemeKey
                          ? 'var(--dp-color-accent)'
                          : '#141416',
                      color: calcScheme === schemeKey ? '#000000' : '#FFFFFF',
                      ...SHARED_CELL_BORDER,
                      cursor: 'pointer'
                    }}
                  >
                    {schemeKey}
                  </button>
                ))}
              </div>
            </div>

            {/* SET TYPE SELECTOR */}
            <div style={{ marginBottom: '10px' }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: colors.secondaryLabel,
                  marginBottom: '4px'
                }}
              >
                SET TYPE
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: 0,
                  ...SHARED_GROUP_OUTER
                }}
              >
                {SET_TYPES_LIST.map(sType => (
                  <button
                    key={sType}
                    type="button"
                    onClick={() => setCalcSetType(sType)}
                    style={{
                      height: '36px',
                      padding: '0 2px',
                      fontSize: '10px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      backgroundColor:
                        calcSetType === sType ? '#FFFFFF' : '#141416',
                      color: calcSetType === sType ? '#000000' : '#FFFFFF',
                      ...SHARED_CELL_BORDER,
                      cursor: 'pointer'
                    }}
                  >
                    {sType}
                  </button>
                ))}
              </div>
            </div>

            {/* SETS, REPS & WEIGHT INPUTS */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1.2fr',
                gap: 0,
                marginBottom: '12px',
                ...SHARED_GROUP_OUTER
              }}
            >
              <div
                style={{
                  backgroundColor: '#141416',
                  padding: '6px 10px',
                  ...SHARED_CELL_BORDER
                }}
              >
                <div
                  style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    color: colors.secondaryLabel,
                    marginBottom: '2px'
                  }}
                >
                  SETS
                </div>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={calcSets}
                  onChange={e =>
                    setCalcSets(Math.max(1, Number(e.target.value) || 1))
                  }
                  style={{
                    width: '100%',
                    padding: '2px 0',
                    fontSize: '16px',
                    fontWeight: 800,
                    backgroundColor: 'transparent',
                    color: '#FFFFFF',
                    border: 'none',
                    outline: 'none'
                  }}
                />
              </div>

              <div
                style={{
                  backgroundColor: '#141416',
                  padding: '6px 10px',
                  ...SHARED_CELL_BORDER
                }}
              >
                <div
                  style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    color: colors.secondaryLabel,
                    marginBottom: '2px'
                  }}
                >
                  REPS
                </div>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={calcReps}
                  onChange={e =>
                    setCalcReps(Math.max(1, Number(e.target.value) || 1))
                  }
                  style={{
                    width: '100%',
                    padding: '2px 0',
                    fontSize: '16px',
                    fontWeight: 800,
                    backgroundColor: 'transparent',
                    color: '#FFFFFF',
                    border: 'none',
                    outline: 'none'
                  }}
                />
              </div>

              <div
                style={{
                  backgroundColor: '#141416',
                  padding: '6px 10px',
                  ...SHARED_CELL_BORDER
                }}
              >
                <div
                  style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    color: colors.secondaryLabel,
                    marginBottom: '2px'
                  }}
                >
                  WEIGHT (LBS)
                </div>
                <input
                  type="number"
                  min={0}
                  max={1500}
                  step={5}
                  value={calcWeight}
                  onChange={e =>
                    setCalcWeight(Math.max(0, Number(e.target.value) || 0))
                  }
                  style={{
                    width: '100%',
                    padding: '2px 0',
                    fontSize: '16px',
                    fontWeight: 800,
                    backgroundColor: 'transparent',
                    color: '#FFFFFF',
                    border: 'none',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* CONVERTED 1RM READOUT */}
            <div
              style={{
                padding: '12px',
                backgroundColor: '#101012',
                border: '1px solid var(--dp-color-accent)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: colors.secondaryLabel,
                    textTransform: 'uppercase'
                  }}
                >
                  CONVERTED 1 REP MAX PR
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: colors.secondaryLabel,
                    marginTop: '2px'
                  }}
                >
                  {calcSets}×{calcReps} @ {calcWeight} LB ({calcScheme} /{' '}
                  {calcSetType})
                </div>
              </div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: 'var(--dp-color-accent)',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {convertedOneRepMax} LB
              </div>
            </div>

            {/* MODAL ACTIONS (SHARED BORDER, ZERO GAP) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.5fr',
                gap: 0,
                ...SHARED_GROUP_OUTER
              }}
            >
              <button
                type="button"
                onClick={() => setCalcPopupExerciseId(null)}
                style={{
                  height: '44px',
                  fontSize: '13px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  backgroundColor: '#18181B',
                  color: '#FFFFFF',
                  ...SHARED_CELL_BORDER,
                  cursor: 'pointer'
                }}
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleSaveConvertedPR}
                style={{
                  height: '44px',
                  fontSize: '13px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  backgroundColor: 'var(--dp-color-accent)',
                  color: '#000000',
                  ...SHARED_CELL_BORDER,
                  cursor: 'pointer'
                }}
              >
                SAVE AS PERSONAL RECORD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
