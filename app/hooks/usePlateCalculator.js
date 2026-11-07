'use client';

import { useState, useMemo } from 'react';
import {
  EXERCISE_MAP,
  formatTodayYMD,
  formatDateYMD,
  roundTo5
} from '../data/exerciseLibrary';
import { buildPersonalRecordHistoryEntry, insertHistoryEntrySorted } from '../utils/workoutEngine';

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

  const openPlateCalculatorForPR = (exerciseId, exerciseName, currentWeight, loggedDate = '') => {
    const startW =
      Number(currentWeight) > 0
        ? Number(currentWeight)
        : EXERCISE_MAP[exerciseId]?.default1RM || 135;
    decomposeWeightToPlates(startW);
    setPrRecordDate(loggedDate && String(loggedDate).trim() ? formatDateYMD(loggedDate) : formatTodayYMD());
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
      setOneRepMaxes(prev => ({
        ...prev,
        [exId]: roundedPR
      }));

      // Always log an individual History entry when a Personal Record is entered (chosen date or today)
      const cleanDate =
        prRecordDate && String(prRecordDate).trim() ? formatDateYMD(prRecordDate) : formatTodayYMD();
      const entry = buildPersonalRecordHistoryEntry({ exerciseId: exId, oneRepMax: roundedPR, dateYMD: cleanDate });
      setHistory(prev => insertHistoryEntrySorted(prev, entry));
      appendSessionLog?.(
        'PR_HISTORY_CREATE',
        `Created PR History entry for ${EXERCISE_MAP[exId]?.name || plateCalcTarget.exerciseName || exId} (${roundedPR} LB on ${cleanDate})`
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

