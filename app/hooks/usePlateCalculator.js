'use client';

import { useState, useMemo } from 'react';
import {
  EXERCISE_MAP,
  formatTodayYMD,
  formatDateYMD,
  parseYMDToISO,
  normalizeSlotCategory,
  roundTo5
} from '../data/exerciseLibrary';
import { normalizeSlotLabels } from '../utils/workoutEngine';

export function usePlateCalculator({
  handleUpdateSetField,
  setOneRepMaxes,
  setHistory,
  setCustomGoalWeights,
  setTargetStandardClass,
  appendSessionLog
}) {
  const [plateCalcTarget, setPlateCalcTarget] = useState(null);
  const [calcUnit, setCalcUnit] = useState('lb');
  const [calcMode, setCalcMode] = useState('per_side');
  const [calcBarWeight, setCalcBarWeight] = useState(45);
  const [calcPlatesPerSide, setCalcPlatesPerSide] = useState([]);
  const [calcDirectTotal, setCalcDirectTotal] = useState(135);
  const [prRecordDate, setPrRecordDate] = useState('');

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

  const openPlateCalculatorForSet = (slotId, exIndex, setItem, exerciseName, onApplyCustom = null) => {
    decomposeWeightToPlates(Number(setItem.weight) || 135);
    setPlateCalcTarget({
      mode: 'set',
      slotId,
      exIndex,
      setId: setItem.id,
      setNumber: setItem.setNumber,
      exerciseName,
      onApplyCustom
    });
  };

  const openPlateCalculatorForPR = (exerciseId, exerciseName, currentWeight) => {
    const startW =
      Number(currentWeight) > 0
        ? Number(currentWeight)
        : EXERCISE_MAP[exerciseId]?.default1RM || 135;
    decomposeWeightToPlates(startW);
    setPrRecordDate('');
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
      if (typeof plateCalcTarget.onApplyCustom === 'function') {
        plateCalcTarget.onApplyCustom(finalWeightLbs);
      } else {
        handleUpdateSetField(
          plateCalcTarget.slotId,
          plateCalcTarget.exIndex,
          plateCalcTarget.setId,
          'weight',
          finalWeightLbs
        );
      }
    } else if (plateCalcTarget.mode === 'pr') {
      const roundedPR = roundTo5(finalWeightLbs);
      const exId = plateCalcTarget.exerciseId;
      const exObj = EXERCISE_MAP[exId] || {
        id: exId,
        name: plateCalcTarget.exerciseName || exId,
        category: 'Compound Lift',
        muscleGroup: 'All Muscles'
      };
      setOneRepMaxes(prev => ({
        ...prev,
        [exId]: roundedPR
      }));

      // Always log an individual History entry when a Personal Record is entered (using chosen date or today in YYYY/MM/DD)
      const cleanDate =
        prRecordDate && String(prRecordDate).trim()
          ? formatDateYMD(prRecordDate)
          : formatTodayYMD();
      const ts = Date.now();
      const prSet = {
        id: `set_pr_${ts}`,
        setNumber: 1,
        type: '1 Rep Max',
        reps: 1,
        lastWeight: roundedPR,
        increment: 0,
        weight: roundedPR,
        completed: true
      };
      const prSlot = {
        id: `slot_pr_${ts}`,
        category: normalizeSlotCategory(exObj.category || 'Compound Lift'),
        slotLabel: normalizeSlotCategory(exObj.category || 'Compound Lift'),
        scheme: 'Pyramid 1RM',
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
      const isoDate = parseYMDToISO(cleanDate);
      const newHistEntry = {
        id: `hist_pr_${exObj.id}_${ts}`,
        title: `${cleanDate} - ${exObj.name} PR (${roundedPR} LB)`,
        loadedRoutineTitle: 'PERSONAL RECORD',
        startedAt: isoDate,
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
      appendSessionLog?.(
        'PR_HISTORY_CREATE',
        `Created PR History entry for ${exObj.name} (${roundedPR} LB on ${cleanDate})`
      );
      setPrRecordDate('');
    } else if (plateCalcTarget.mode === 'goal') {
      setCustomGoalWeights(prev => ({
        ...prev,
        [plateCalcTarget.exerciseId]: roundTo5(finalWeightLbs)
      }));
      setTargetStandardClass('Custom');
    }
    setPlateCalcTarget(null);
  };

  return {
    plateCalcTarget,
    setPlateCalcTarget,
    calcUnit,
    calcMode,
    setCalcMode,
    calcBarWeight,
    calcPlatesPerSide,
    setCalcPlatesPerSide,
    calcDirectTotal,
    setCalcDirectTotal,
    prRecordDate,
    setPrRecordDate,
    openPlateCalculatorForSet,
    openPlateCalculatorForPR,
    openPlateCalculatorForGoal,
    computedPlateCalculatorTotal,
    handleApplyCalculatedWeight
  };
}

