'use client';

import { useState, useMemo } from 'react';
import {
  EXERCISE_MAP,
  formatTodayYMD,
  formatDateYMD,
  roundTo5,
  getExerciseEquipmentOptions
} from '../data/exerciseLibrary';
import { buildPersonalRecordHistoryEntry, insertHistoryEntrySorted } from '../utils/workoutEngine';

const BARBELL_WEIGHT_LBS = 45;
const EZ_BAR_WEIGHT_LBS = 17;
const AVAILABLE_LB_PLATES = [45, 35, 25, 10, 5, 2.5, 1.25];

/**
 * How a weight is loaded for the exercise's equipment: dumbbells / kettlebells are picked by their own weight
 * (no bar, no x2 for two sides); an EZ bar weighs 17 lb; everything else is a 45 lb bar + plates per side.
 * `equipment` is the athlete's equipment choice for an exercise that allows several ("Barbell / EZ Bar");
 * without one, the exercise's first equipment option is used.
 */
const getLoadSetup = (exerciseId, equipment) => {
  const eq = String(equipment || getExerciseEquipmentOptions(EXERCISE_MAP[exerciseId])[0] || '').toLowerCase();
  if (eq.includes('dumbbell') || eq.includes('kettlebell')) {
    return { singleLoad: true, barWeight: 0, barLabel: eq.includes('kettlebell') ? 'Kettlebell' : 'Dumbbell' };
  }
  if (/\bez\b|ez[- ]?bar/.test(eq)) return { singleLoad: false, barWeight: EZ_BAR_WEIGHT_LBS, barLabel: 'EZ bar' };
  return { singleLoad: false, barWeight: BARBELL_WEIGHT_LBS, barLabel: 'Barbell' };
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
  // Bar-style loads: bar + plates on both sides. Dumbbells/kettlebells: the picked weights ARE the total.
  const [calcLoad, setCalcLoad] = useState(() => getLoadSetup(null, 'Barbell'));
  const calcIsSingleLoad = calcLoad.singleLoad;
  const [calcPlatesPerSide, setCalcPlatesPerSideRaw] = useState([]);
  // A total typed into TOTAL WEIGHT that the plates can't represent exactly (cleared when plates change)
  const [calcTypedTotal, setCalcTypedTotal] = useState(null);
  const [prRecordDate, setPrRecordDate] = useState('');

  const calcBarWeight = calcLoad.barWeight;
  const calcBarLabel = calcLoad.barLabel;
  const sideMultiplier = calcIsSingleLoad ? 1 : 2;

  const setCalcPlatesPerSide = updater => {
    setCalcTypedTotal(null);
    setCalcPlatesPerSideRaw(updater);
  };

  const platesForWeight = (weight, { singleLoad, barWeight }) => {
    let remaining = Math.max(0, (weight - barWeight) / (singleLoad ? 1 : 2));
    const plates = [];
    AVAILABLE_LB_PLATES.forEach(plate => {
      while (remaining >= plate - 0.01) {
        plates.push(plate);
        remaining = Math.round((remaining - plate) * 100) / 100;
      }
    });
    return plates.sort((a, b) => b - a);
  };

  const decomposeWeightToPlates = (initialWeight, exerciseId, equipment) => {
    const load = getLoadSetup(exerciseId, equipment);
    setCalcUnit('lb');
    setCalcLoad(load);
    const plates = platesForWeight(initialWeight, load);
    setCalcPlatesPerSideRaw(plates);
    const platesTotal = plates.reduce((a, p) => a + p, 0);
    const exact = Math.abs(load.barWeight + platesTotal * (load.singleLoad ? 1 : 2) - initialWeight) < 0.01;
    setCalcTypedTotal(exact ? null : Math.max(0, Number(initialWeight) || 0));
  };

  // TOTAL WEIGHT typed in by hand: show the plates for it, keeping the typed number if they can't match it
  const setCalcTotalFromInput = value => {
    const weight = Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
    decomposeWeightToPlates(weight, plateCalcTarget?.exerciseId, plateCalcTarget?.equipment);
  };

  // setInfo from SlotEditor, shown around TOTAL WEIGHT:
  // { lastDisplay, showOneRepMax, setReps, sessionSets, prValue, prWorkoutId }
  const openPlateCalculatorForSet = (slotId, exIndex, setItem, exerciseName, onApplyCustom = null, setInfo = {}) => {
    decomposeWeightToPlates(Number(setItem.weight) || 135, setInfo.exerciseId, setInfo.equipment);
    setPlateCalcTarget({
      mode: 'set',
      slotId,
      exIndex,
      setId: setItem.id,
      setNumber: setItem.setNumber,
      exerciseId: setInfo.exerciseId,
      equipment: setInfo.equipment,
      exerciseName,
      onApplyCustom,
      lastDisplay: setInfo.lastDisplay,
      showOneRepMax: setInfo.showOneRepMax,
      setReps: setInfo.setReps,
      sessionSets: setInfo.sessionSets,
      prValue: setInfo.prValue,
      prWorkoutId: setInfo.prWorkoutId
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
    calcBarLabel,
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

