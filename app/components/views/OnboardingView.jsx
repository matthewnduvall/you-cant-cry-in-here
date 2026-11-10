'use client';

import { SHARED_CELL_BORDER, SHARED_GROUP_OUTER } from '../../styles/kineticTokens';
import React, { useState } from 'react';
import {
  BIG_FOUR_IDS,
  CORE_PR_EXERCISE_IDS,
  EXERCISE_MAP,
  SLOT_CATEGORIES,
  filterAddSlotExercises,
  getAvailableMuscleGroupsForCategory,
  getExRxTargetForLift
} from '../../data/exerciseLibrary';
import {
  buildPersonalRecordHistoryEntry,
  insertHistoryEntrySorted
} from '../../utils/workoutEngine';
import { DeleteButton, DragNumberBadge, GymSelect, SegmentButton } from '../Controls';
import { EquipmentToggleList } from '../EquipmentToggleList';
import { OneRepMaxCalculatorModal } from '../OneRepMaxCalculatorModal';

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
  history = [],
  setHistory,
  currentIncrementLbs = 0,
  customPrExerciseIds: externalCustomPrIds,
  setCustomPrExerciseIds: setExternalCustomPrIds,
  customGoalWeights,
  openPlateCalculatorForPR,
  openPlateCalculatorForSet,
  setSetValueTarget,
  selectedGymId,
  gyms = [],
  availableEquipment,
  setAvailableEquipment,
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

  // --- 1RM Calculator Pop-up (Page 3): exercise it is open for (null = closed) ---
  const [calcPopupExerciseId, setCalcPopupExerciseId] = useState(null);

  const open1RMConverterModal = exerciseId => {
    setCalcPopupExerciseId(exerciseId || BIG_FOUR_IDS[0] || 'barbell_bench_press');
  };

  const handleSaveCalculatedPR = ({ exerciseId, oneRepMax, dateYMD, scheme }) => {
    if (!exerciseId || oneRepMax <= 0) return;
    setOneRepMaxes(prev => ({ ...prev, [exerciseId]: oneRepMax }));
    setHistory?.(prev =>
      insertHistoryEntrySorted(prev, buildPersonalRecordHistoryEntry({ exerciseId, oneRepMax, dateYMD, scheme }))
    );
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
                  fontSize: '11px',
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
                  fontSize: '11px',
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
                  fontSize: '11px',
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
                  fontSize: '11px',
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
                <SegmentButton
                  active={goalIncrement === inc}
                  key={inc}
                  onClick={() => setGoalIncrement(inc)}
                  style={{ height: '44px', padding: '0 4px', fontSize: '13px' }}
                >
                  +{inc} {goalUnit.toUpperCase()}
                </SegmentButton>
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
                          fontSize: '11px',
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
                        lineHeight: 1.15,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {ex.name}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: colors.secondaryLabel,
                        marginTop: '1px'
                      }}
                    >
                      {isTBD
                        ? `${targetStandardClass} goal: ${goal1RM}\u00A0lb`
                        : diffFromGoal > 0
                          ? `${targetStandardClass} goal: ${goal1RM}\u00A0lb (${diffFromGoal}\u00A0lb to go)`
                          : `${targetStandardClass} goal: ${goal1RM}\u00A0lb ${diffFromGoal === 0 ? '(reached)' : `(beaten by ${Math.abs(diffFromGoal)}\u00A0lb)`}`}
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
                        ? '#2A2A2E'
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
                  <DeleteButton
                    label="Close panel"
                    fill
                    minHeight="0"
                    style={{ width: '100%' }}
                    onClick={() => setShowAddPrExercisePanel(false)}
                  />
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
                  <GymSelect
                    variant="cell"
                    ariaLabel="Filter by Gyms/Equipment"
                    value={addPrGymFilter}
                    onChange={nextGym => {
                      setAddPrGymFilter(nextGym);
                      const nextAvailMgs = getAvailableMuscleGroupsForCategory(addPrCategory, nextGym, gyms);
                      const nextMg = nextAvailMgs.includes(activeAddPrMuscle) ? activeAddPrMuscle : 'All Muscles';
                      setAddPrMuscleGroup(nextMg);
                      const nextAvail = filterAddSlotExercises(nextGym, addPrCategory, gyms, nextMg);
                      if (nextAvail.length > 0) setAddPrSelectedExId(nextAvail[0].id);
                    }}
                    gyms={gyms}
                  />

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
          {/* EQUIPMENT (same list as Settings → Equipment) */}
          <EquipmentToggleList
            colors={colors}
            value={availableEquipment}
            onChange={setAvailableEquipment}
            footer="Turn on the equipment you have. Exercises picked for you will only use it; you can change this any time in Settings."
          />

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
                  <DragNumberBadge
                    bg="#121214"
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

                  <DeleteButton
                    label={`Remove ${prefType}`}
                    fill
                    minHeight="42px"
                    style={{ height: '42px' }}
                    disabled={routinePreferences.length <= 1}
                    onClick={() =>
                      setRoutinePreferences(prev => prev.filter((_, i) => i !== idx))
                    }
                  />
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
                          fontSize: '11px',
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
                      fontSize: '11px',
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
                <strong style={{ color: '#30D158' }}>GREEN</strong> (recovering),{' '}
                <strong style={{ color: '#FFD60A' }}>YELLOW</strong>{' '}
                (recovered), and <strong style={{ color: '#FF3B30' }}>RED</strong>{' '}
                (overdue &amp; prioritized by <strong style={{ color: '#FFFFFF' }}>AUTO</strong>).
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
                      fontSize: '11px',
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
                      fontSize: '11px',
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
        <OneRepMaxCalculatorModal
          key={calcPopupExerciseId}
          exerciseId={calcPopupExerciseId}
          onClose={() => setCalcPopupExerciseId(null)}
          onSave={handleSaveCalculatedPR}
          oneRepMaxes={oneRepMaxes}
          history={history}
          currentIncrementLbs={currentIncrementLbs}
          userBodyweightLbs={userBodyweightLbs}
          selectedGymId={selectedGymId}
          gyms={gyms}
          setSetValueTarget={setSetValueTarget}
          openPlateCalculatorForSet={openPlateCalculatorForSet}
        />
      )}
    </div>
  );
}
