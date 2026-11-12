'use client';

import React, { useState } from 'react';
import { UI, SHARED_CELL_BORDER, SHARED_GROUP_OUTER, SHARED_PICKER_GROUP } from '../../styles/kineticTokens';
import { CORE_PR_EXERCISE_IDS, EXERCISE_MAP, getExRxTargetForLift } from '../../data/exerciseLibrary';
import { Button, CloseButton, SegmentButton } from '../Controls';
import { ExercisePicker, resolvePickerExerciseId } from '../ExercisePicker';
import {
  CORE_LIFT_META,
  LiftGoalRow,
  StrengthClassGoalPicker,
  formatLiftLabel,
  getLiftGoalStats
} from '../LiftGoals';

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
  // START / LATEST per lift (the same rows as the PROGRESS page)
  progressionSeriesByLift = {},
  openPlateCalculatorForGoal,
  customPrExerciseIds = [],
  setCustomPrExerciseIds
}) {
  const [showAddGoalExerciseModal, setShowAddGoalExerciseModal] = useState(false);
  const [addGoalExerciseId, setAddGoalExerciseId] = useState('dumbbell_bench_press');

  const displayedGoalIds = Array.from(
    new Set([
      ...CORE_PR_EXERCISE_IDS,
      ...(Array.isArray(customPrExerciseIds) ? customPrExerciseIds : []),
      ...Object.keys(customGoalWeights || {})
    ])
  );

  // Always a real exercise that isn't already in the goals list
  const selectedExId = resolvePickerExerciseId(addGoalExerciseId, displayedGoalIds);

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
        customGoalWeights,
        oneRepMaxes
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
            fontWeight: 500,
            color: colors?.secondaryLabel || '#9A9A9A',
            marginBottom: '6px',
            textTransform: 'uppercase'
          }}
        >
          PRIMARY TRAINING GOAL
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 0,
            ...SHARED_GROUP_OUTER
          }}
        >
          {['Strength', 'Balanced', 'Hypertrophy', 'Maintain'].map(opt => (
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

        {goalType !== 'Maintain' && (
          <div style={{ marginTop: '14px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: colors?.secondaryLabel || '#9A9A9A',
                marginBottom: '6px',
                textTransform: 'uppercase'
              }}
            >
              PROGRESSION INCREMENT (ADDED TO THE TOTAL WEIGHT)
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
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    backgroundColor: goalUnit === u ? 'var(--dp-color-accent)' : '#1C1C1C',
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
            fontWeight: 500,
            color: colors?.secondaryLabel || '#9A9A9A',
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
          {/* STRENGTH CLASS GOAL (+ 1000 LB CLUB total), then one row per tracked lift — the same rows as the
              PROGRESS page: START | PR | LATEST | TO GO | GOAL ✎ */}
          <StrengthClassGoalPicker
            targetStandardClass={targetStandardClass}
            setTargetStandardClass={setTargetStandardClass}
            oneRepMaxes={oneRepMaxes}
          />
          {displayedGoalIds.map(liftId => {
            const ex = EXERCISE_MAP[liftId];
            if (!ex) return null;
            const stats = getLiftGoalStats({
              liftId,
              series: progressionSeriesByLift?.[liftId],
              oneRepMaxes,
              targetStandardClass,
              userBodyweightLbs,
              totalHeightInches,
              customGoalWeights
            });
            return (
              <LiftGoalRow
                key={liftId}
                name={formatLiftLabel(liftId, ex.name)}
                color={CORE_LIFT_META[liftId]?.color || '#FFFFFF'}
                stats={stats}
                onEditGoal={() => openPlateCalculatorForGoal(liftId, ex.name, stats.goal)}
              />
            );
          })}
        </div>
      </section>

      {/* ADD EXERCISE BUTTON AT BOTTOM (SAME AS SESSION PAGE) */}
      <div style={{ padding: '0 var(--dp-spacing-gutter)', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <Button
          variant="dashed"
          onClick={() => setShowAddGoalExerciseModal(true)}
          style={{ height: '48px', fontSize: '14px', border: 'none', borderRadius: '10px', backgroundColor: '#1C1C1C' }}
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

            {/* The standard exercise picker (same as the session editor header) */}
            <div style={{ marginBottom: '16px', ...SHARED_PICKER_GROUP }}>
              <ExercisePicker
                exerciseId={selectedExId}
                onChange={setAddGoalExerciseId}
                excludeIds={displayedGoalIds}
              />
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
