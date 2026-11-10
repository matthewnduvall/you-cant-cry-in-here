'use client';

import { useState, useMemo } from 'react';
import {
  EXERCISE_MAP,
  formatTodayYMD,
  formatDateYMD,
  roundTo5
} from '../data/exerciseLibrary';
import { buildPersonalRecordHistoryEntry, insertHistoryEntrySorted } from '../utils/workoutEngine';

const BARBELL_WEIGHT_LBS = 45;
const AVAILABLE_LB_PLATES = [45, 35, 25, 10, 5, 2.5, 1.25];

// Dumbbells and kettlebells are picked by their own weight: no bar, no x2 for two sides.
const isSingleLoadExercise = exerciseId => {
  const eq = (EXERCISE_MAP[exerciseId]?.equipment || '').toLowerCase();
  return eq.includes('dumbbell') || eq.includes('kettlebell');
};

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
  // Barbell-style loads: bar + plates on both sides. Dumbbells/kettlebells: the picked weights ARE the total.
  const [calcIsSingleLoad, setCalcIsSingleLoad] = useState(false);
  const [calcPlatesPerSide, setCalcPlatesPerSideRaw] = useState([]);
  // A total typed into TOTAL WEIGHT that the plates can't represent exactly (cleared when plates change)
  const [calcTypedTotal, setCalcTypedTotal] = useState(null);
  const [prRecordDate, setPrRecordDate] = useState('');

  const calcBarWeight = calcIsSingleLoad ? 0 : BARBELL_WEIGHT_LBS;
  const sideMultiplier = calcIsSingleLoad ? 1 : 2;

  const setCalcPlatesPerSide = updater => {
    setCalcTypedTotal(null);
    setCalcPlatesPerSideRaw(updater);
  };

  const platesForWeight = (weight, singleLoad) => {
    const bar = singleLoad ? 0 : BARBELL_WEIGHT_LBS;
    let remaining = Math.max(0, (weight - bar) / (singleLoad ? 1 : 2));
    const plates = [];
    AVAILABLE_LB_PLATES.forEach(plate => {
      while (remaining >= plate - 0.01) {
        plates.push(plate);
        remaining = Math.round((remaining - plate) * 100) / 100;
      }
    });
    return plates.sort((a, b) => b - a);
  };

  const decomposeWeightToPlates = (initialWeight, exerciseId) => {
    const singleLoad = isSingleLoadExercise(exerciseId);
    setCalcUnit('lb');
    setCalcIsSingleLoad(singleLoad);
    const plates = platesForWeight(initialWeight, singleLoad);
    setCalcPlatesPerSideRaw(plates);
    const platesTotal = plates.reduce((a, p) => a + p, 0);
    const exact =
      Math.abs((singleLoad ? 0 : BARBELL_WEIGHT_LBS) + platesTotal * (singleLoad ? 1 : 2) - initialWeight) < 0.01;
    setCalcTypedTotal(exact ? null : Math.max(0, Number(initialWeight) || 0));
  };

  // TOTAL WEIGHT typed in by hand: show the plates for it, keeping the typed number if they can't match it
  const setCalcTotalFromInput = value => {
    const weight = Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
    decomposeWeightToPlates(weight, plateCalcTarget?.exerciseId);
  };

  // setInfo: { lastDisplay, incrementDisplay, onEditIncrement } from SlotEditor, shown in the TOTAL WEIGHT box
  const openPlateCalculatorForSet = (slotId, exIndex, setItem, exerciseName, onApplyCustom = null, setInfo = {}) => {
    decomposeWeightToPlates(Number(setItem.weight) || 135, setInfo.exerciseId);
    setPlateCalcTarget({
      mode: 'set',
      slotId,
      exIndex,
      setId: setItem.id,
      setNumber: setItem.setNumber,
      exerciseId: setInfo.exerciseId,
      exerciseName,
      onApplyCustom,
      lastDisplay: setInfo.lastDisplay,
      incrementDisplay: setInfo.incrementDisplay,
      onEditIncrement: setInfo.onEditIncrement
    });
  };

  const openPlateCalculatorForPR = (exerciseId, exerciseName, currentWeight, loggedDate = '') => {
    const startW =
      Number(currentWeight) > 0
        ? Number(currentWeight)
        : EXERCISE_MAP[exerciseId]?.default1RM || 135;
    decomposeWeightToPlates(startW, exerciseId);
    setPrRecordDate(loggedDate && String(loggedDate).trim() ? formatDateYMD(loggedDate) : formatTodayYMD());
    setPlateCalcTarget({ mode: 'pr', exerciseId, exerciseName });
  };

  const openPlateCalculatorForGoal = (exerciseId, exerciseName, currentGoalWeight) => {
    decomposeWeightToPlates(Number(currentGoalWeight) || 225, exerciseId);
    setPlateCalcTarget({ mode: 'goal', exerciseId, exerciseName });
  };

  const computedPlateCalculatorTotal = useMemo(() => {
    if (calcTypedTotal !== null) return calcTypedTotal;
    const oneSideSum = calcPlatesPerSide.reduce((acc, p) => acc + p, 0);
    return Math.round((calcBarWeight + oneSideSum * sideMultiplier) * 100) / 100;
  }, [calcTypedTotal, calcPlatesPerSide, calcBarWeight, sideMultiplier]);

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
    calcIsSingleLoad,
    calcBarWeight,
    calcPlatesPerSide,
    setCalcPlatesPerSide,
    setCalcTotalFromInput,
    prRecordDate,
    setPrRecordDate,
    openPlateCalculatorForSet,
    openPlateCalculatorForPR,
    openPlateCalculatorForGoal,
    computedPlateCalculatorTotal,
    handleApplyCalculatedWeight
  };
}

