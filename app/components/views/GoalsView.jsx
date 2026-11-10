'use client';

import React, { useState } from 'react';
import { UI, SHARED_CELL_BORDER, SHARED_GROUP_OUTER } from '../../styles/kineticTokens';
import {
  CORE_PR_EXERCISE_IDS,
  EXERCISE_MAP,
  STRENGTH_GOAL_CLASSES,
  THOUSAND_LB_CLUB,
  THOUSAND_LB_CLUB_TOTAL,
  getThousandLbClubGoals,
  getExRxTargetForLift
} from '../../data/exerciseLibrary';
import { Button, CloseButton, SegmentButton } from '../Controls';
import { ExercisePicker, resolvePickerExerciseId } from '../ExercisePicker';

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
              className="kinetic-filter-select"
              aria-label="Strength class goal"
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
              {STRENGTH_GOAL_CLASSES.map(c => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
              <option value="Custom">CUSTOM</option>
            </select>
          </div>

          {/* 1000 LB CLUB: Big 3 total so far; the rest is split evenly across the bench / squat / deadlift goals */}
          {targetStandardClass === THOUSAND_LB_CLUB &&
            (() => {
              const club = getThousandLbClubGoals(oneRepMaxes);
              return (
                <div
                  style={{
                    padding: '0 12px',
                    minHeight: '44px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    backgroundColor: '#141416',
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    ...SHARED_CELL_BORDER
                  }}
                >
                  <span style={{ color: '#FFFFFF' }}>
                    BIG 3 TOTAL: {club.total} / {THOUSAND_LB_CLUB_TOTAL} LB
                  </span>
                  <span style={{ color: club.remaining > 0 ? '#A0A0A0' : '#30D158', whiteSpace: 'nowrap' }}>
                    {club.remaining > 0 ? `${club.remaining} LB TO GO` : 'REACHED ✓'}
                  </span>
                </div>
              );
            })()}

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
              customGoalWeights,
              oneRepMaxes
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
                      color: isTBD ? '#8E8E93' : '#30D158',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    {isTBD ? 'NOT LOGGED YET' : distance === 0 ? 'GOAL REACHED ✓' : `${distance} LB FROM GOAL`}
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
          onClick={() => setShowAddGoalExerciseModal(true)}
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

            {/* The standard exercise picker (same as the session editor header) */}
            <div style={{ marginBottom: '16px', ...SHARED_GROUP_OUTER }}>
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
