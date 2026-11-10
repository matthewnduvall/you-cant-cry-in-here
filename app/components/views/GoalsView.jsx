'use client';

import React, { useState } from 'react';
import { UI, SHARED_CELL_BORDER, SHARED_GROUP_OUTER } from '../../styles/kineticTokens';
import {
  CORE_PR_EXERCISE_IDS,
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  EXRX_CLASSES,
  SLOT_CATEGORIES,
  normalizeSlotCategory,
  getAvailableMuscleGroupsForCategory,
  filterAddSlotExercises,
  getExRxTargetForLift
} from '../../data/exerciseLibrary';
import { Button, CloseButton, GymSelect, SegmentButton } from '../Controls';

const GOAL_EXERCISE_CATEGORIES = SLOT_CATEGORIES.filter(c => c !== 'Superset');

export function GoalsView({
  colors,
  goalType,
  setGoalType,
  goalUnit,
  setGoalUnit,
  goalIncrement,
  setGoalIncrement,
  userBodyweightLbs,
  userHeightFeet,
  userHeightInches,
  totalHeightInches,
  targetStandardClass,
  setTargetStandardClass,
  oneRepMaxes,
  customGoalWeights,
  openPlateCalculatorForGoal,
  customPrExerciseIds = [],
  setCustomPrExerciseIds,
  selectedGymId = '',
  gyms = []
}) {
  const [showAddGoalExerciseModal, setShowAddGoalExerciseModal] = useState(false);
  const [addGoalGymFilter, setAddGoalGymFilter] = useState(selectedGymId || '');
  const [addGoalCategory, setAddGoalCategory] = useState('Primary Compound');
  const [addGoalMuscleGroup, setAddGoalMuscleGroup] = useState('All Muscles');
  const [addGoalExerciseId, setAddGoalExerciseId] = useState('dumbbell_bench_press');

  const displayedGoalIds = Array.from(
    new Set([
      ...CORE_PR_EXERCISE_IDS,
      ...(Array.isArray(customPrExerciseIds) ? customPrExerciseIds : []),
      ...Object.keys(customGoalWeights || {})
    ])
  );

  const normCat = normalizeSlotCategory(addGoalCategory);
  const availMuscleGroups = getAvailableMuscleGroupsForCategory(normCat, addGoalGymFilter, gyms);
  const activeMuscle = availMuscleGroups.includes(addGoalMuscleGroup) ? addGoalMuscleGroup : 'All Muscles';
  const modalPool = filterAddSlotExercises(addGoalGymFilter, normCat, gyms, activeMuscle);
  const selectedExId = modalPool.some(x => x.id === addGoalExerciseId)
    ? addGoalExerciseId
    : modalPool[0]?.id || EXERCISE_LIBRARY[0]?.id;

  const handleConfirmAddGoalExercise = () => {
    if (!selectedExId) return;
    if (setCustomPrExerciseIds && !displayedGoalIds.includes(selectedExId)) {
      setCustomPrExerciseIds(prev => {
        const list = Array.isArray(prev) ? prev : [];
        return list.includes(selectedExId) ? list : [...list, selectedExId];
      });
    }
    setShowAddGoalExerciseModal(false);
    const ex = EXERCISE_MAP[selectedExId];
    if (ex && openPlateCalculatorForGoal) {
      const initialGoal = getExRxTargetForLift(
        selectedExId,
        targetStandardClass,
        userBodyweightLbs,
        totalHeightInches,
        customGoalWeights
      );
      openPlateCalculatorForGoal(selectedExId, ex.name, initialGoal);
    }
  };

  return (
    <div style={{ paddingTop: '12px', paddingBottom: '36px' }}>
      {/* =================================================================== */}
      {/* 1. PRIMARY TRAINING GOAL & PROGRESSION INCREMENT (SHARED BORDERS) */}
      {/* =================================================================== */}
      <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: colors?.secondaryLabel || '#A0A0A0',
            marginBottom: '6px',
            textTransform: 'uppercase'
          }}
        >
          PRIMARY TRAINING GOAL
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 0,
            ...SHARED_GROUP_OUTER
          }}
        >
          {['Strength', 'Hypertrophy', 'Maintain'].map(opt => (
            <SegmentButton
              active={goalType === opt}
              key={opt}
              onClick={() => setGoalType(opt)}
              style={{ height: '44px', padding: '0 8px' }}
            >
              {opt}
            </SegmentButton>
          ))}
        </div>

        {(goalType === 'Strength' || goalType === 'Hypertrophy') && (
          <div style={{ marginTop: '14px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: colors?.secondaryLabel || '#A0A0A0',
                marginBottom: '6px',
                textTransform: 'uppercase'
              }}
            >
              PROGRESSION INCREMENT (BARBELL LIFTS AUTOMATICALLY × 2)
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr)) 50px 50px',
                gap: 0,
                ...SHARED_GROUP_OUTER
              }}
            >
              {[1.25, 2.5, 5, 10].map(inc => (
                <SegmentButton
                  active={goalIncrement === inc}
                  key={inc}
                  onClick={() => setGoalIncrement(inc)}
                  style={{ height: '44px', padding: '0 4px' }}
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
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    backgroundColor: goalUnit === u ? 'var(--dp-color-accent)' : '#18181B',
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
        )}
      </section>

      {/* =================================================================== */}
      {/* 2. STANDARDS (EXRX.NET) & TARGET GOALS (SHARED BORDERS, ZERO GAPS) */}
      {/* =================================================================== */}
      <section style={{ marginBottom: '16px', padding: '0 var(--dp-spacing-gutter)' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: colors?.secondaryLabel || '#A0A0A0',
            marginBottom: '6px',
            textTransform: 'uppercase'
          }}
        >
          STANDARDS (EXRX.NET) — {userBodyweightLbs} LBS, {userHeightFeet}&apos;{userHeightInches}&quot;
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            ...SHARED_GROUP_OUTER
          }}
        >
          {/* STRENGTH CLASS GOAL SELECTOR ROW */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 150px',
              gap: 0,
              height: '44px',
              backgroundColor: '#18181B'
            }}
          >
            <div
              style={{
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                fontSize: '12px',
                fontWeight: 800,
                color: '#FFFFFF',
                textTransform: 'uppercase',
                ...SHARED_CELL_BORDER
              }}
            >
              STRENGTH CLASS GOAL
            </div>

            <select
              value={targetStandardClass}
              onChange={e => setTargetStandardClass(e.target.value)}
              style={{
                width: '100%',
                height: '44px',
                backgroundColor: '#141416',
                color: 'var(--dp-color-accent)',
                ...SHARED_CELL_BORDER,
                padding: '0 10px',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              {EXRX_CLASSES.map(c => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
              <option value="Custom">CUSTOM</option>
            </select>
          </div>

          {/* EXERCISE GOAL ROWS: EXERCISE TITLE | X FROM GOAL | GOAL WEIGHT */}
          {displayedGoalIds.map(liftId => {
            const ex = EXERCISE_MAP[liftId];
            if (!ex) return null;
            const rawVal = Number(oneRepMaxes?.[liftId]) || 0;
            const isTBD = rawVal <= 0;
            const cur1RM = isTBD ? ex.default1RM : rawVal;
            const goalWeight = getExRxTargetForLift(
              liftId,
              targetStandardClass,
              userBodyweightLbs,
              totalHeightInches,
              customGoalWeights
            );
            const distance = Math.max(0, goalWeight - cur1RM);

            return (
              <div
                key={liftId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 118px',
                  gap: 0,
                  alignItems: 'stretch',
                  backgroundColor: '#141416'
                }}
              >
                <div
                  style={{
                    padding: '0 12px',
                    minWidth: 0,
                    height: '46px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    ...SHARED_CELL_BORDER
                  }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      minWidth: 0,
                      flex: 1
                    }}
                  >
                    {ex.name}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#30D158',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    {distance} LB FROM GOAL
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openPlateCalculatorForGoal(liftId, ex.name, goalWeight)}
                  style={{
                    width: '118px',
                    height: '46px',
                    boxSizing: 'border-box',
                    padding: '0 8px',
                    backgroundColor: '#1C1C20',
                    color: 'var(--dp-color-accent)',
                    ...SHARED_CELL_BORDER,
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  GOAL: {goalWeight} LB ✎
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ADD EXERCISE BUTTON AT BOTTOM (SAME AS SESSION PAGE) */}
      <div style={{ padding: '0 var(--dp-spacing-gutter)', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <Button
          variant="dashed"
          onClick={() => {
            setAddGoalGymFilter(selectedGymId || '');
            const avail = filterAddSlotExercises(selectedGymId || '', addGoalCategory, gyms, addGoalMuscleGroup);
            if (avail.length > 0) {
              setAddGoalExerciseId(avail[0].id);
            }
            setShowAddGoalExerciseModal(true);
          }}
          style={{ height: '48px', fontSize: '14px', border: '1px solid var(--dp-color-rule)', backgroundColor: '#161618' }}
        >
          + ADD EXERCISE
        </Button>
      </div>

      {/* ADD EXERCISE MODAL FOR CUSTOM GOALS */}
      {showAddGoalExerciseModal && (
        <div style={UI.modalBackdrop} onClick={() => setShowAddGoalExerciseModal(false)}>
          <div onClick={e => e.stopPropagation()} style={UI.modalCard('400px')}>
            <div style={UI.modalHeader}>
              <span>ADD EXERCISE</span>
              <CloseButton onClick={() => setShowAddGoalExerciseModal(false)} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={UI.stepLabel}>1. GYMS/EQUIPMENT</div>
              <GymSelect
                value={addGoalGymFilter}
                onChange={nextFilter => {
                  setAddGoalGymFilter(nextFilter);
                  const nextGroups = getAvailableMuscleGroupsForCategory(normCat, nextFilter, gyms);
                  const nextMg = nextGroups.includes(activeMuscle) ? activeMuscle : 'All Muscles';
                  setAddGoalMuscleGroup(nextMg);
                  const nextAvail = filterAddSlotExercises(nextFilter, normCat, gyms, nextMg);
                  if (nextAvail.length > 0 && !nextAvail.some(x => x.id === addGoalExerciseId)) {
                    setAddGoalExerciseId(nextAvail[0].id);
                  }
                }}
                gyms={gyms}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={UI.stepLabel}>2. EXERCISE CATEGORY</div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 0,
                  borderTop: '1px solid var(--dp-color-rule)',
                  borderLeft: '1px solid var(--dp-color-rule)'
                }}
              >
                {GOAL_EXERCISE_CATEGORIES.map(cat => (
                  <Button
                    variant="toggle"
                    active={normCat === cat}
                    key={cat}
                    onClick={() => {
                      setAddGoalCategory(cat);
                      const nextGroups = getAvailableMuscleGroupsForCategory(cat, addGoalGymFilter, gyms);
                      const nextMg = nextGroups.includes(activeMuscle) ? activeMuscle : 'All Muscles';
                      setAddGoalMuscleGroup(nextMg);
                      const nextAvail = filterAddSlotExercises(addGoalGymFilter, cat, gyms, nextMg);
                      if (nextAvail.length > 0 && !nextAvail.some(x => x.id === addGoalExerciseId)) {
                        setAddGoalExerciseId(nextAvail[0].id);
                      }
                    }}
                    style={{ borderTop: 'none', borderLeft: 'none', borderRight: '1px solid var(--dp-color-rule)', borderBottom: '1px solid var(--dp-color-rule)' }}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={UI.stepLabel}>3. MUSCLE GROUP</div>
              <select
                aria-label="Filter by Muscle Group"
                value={activeMuscle}
                onChange={e => {
                  const nextMg = e.target.value;
                  setAddGoalMuscleGroup(nextMg);
                  const nextAvail = filterAddSlotExercises(addGoalGymFilter, normCat, gyms, nextMg);
                  if (nextAvail.length > 0) {
                    setAddGoalExerciseId(nextAvail[0].id);
                  }
                }}
                style={{ ...UI.select, textTransform: 'uppercase' }}
              >
                {availMuscleGroups.map(mg => (
                  <option key={mg} value={mg}>
                    {mg.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={UI.stepLabel}>4. SELECT EXERCISE</div>
              <select
                value={selectedExId}
                onChange={e => setAddGoalExerciseId(e.target.value)}
                style={UI.select}
              >
                {modalPool.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.equipment})
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="primary"
              onClick={handleConfirmAddGoalExercise}
              style={{ width: '100%' }}
            >
              + ADD EXERCISE
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GoalsView;
