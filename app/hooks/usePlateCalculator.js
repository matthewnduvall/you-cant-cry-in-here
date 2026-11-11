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
 * How a weight is loaded for the exercise's equipment:
 * - barbell / Smith / trap bar: 45 lb bar + plates on both sides; EZ bar: 17 lb bar + plates on both sides
 * - plate-loaded machines (Lever / Sled "plate loaded"): plates on both sides, no bar
 * - everything else (dumbbells, kettlebells, cable and selectorized stacks, machines, landmine, plates, weighted
 *   bodyweight): the picked weights ARE the total (no bar, not doubled)
 * `equipment` is the athlete's equipment choice for an exercise that allows several ("Barbell / EZ Bar");
 * without one, the exercise's first equipment option is used.
 */
export const getLoadSetup = (exerciseId, equipment) => {
  const eq = String(equipment || getExerciseEquipmentOptions(EXERCISE_MAP[exerciseId])[0] || '').toLowerCase();
  if (eq.includes('dumbbell')) return { singleLoad: true, barWeight: 0, barLabel: 'Dumbbell' };
  if (eq.includes('kettlebell')) return { singleLoad: true, barWeight: 0, barLabel: 'Kettlebell' };
  if (/\bez\b|ez[- ]?bar/.test(eq)) return { singleLoad: false, barWeight: EZ_BAR_WEIGHT_LBS, barLabel: 'EZ bar' };
  if (eq.includes('barbell') || eq.includes('trap bar')) {
    return { singleLoad: false, barWeight: BARBELL_WEIGHT_LBS, barLabel: 'Barbell' };
  }
  if (eq.includes('smith')) return { singleLoad: false, barWeight: BARBELL_WEIGHT_LBS, barLabel: 'Smith bar' };
  if (eq.includes('plate loaded')) return { singleLoad: false, barWeight: 0, barLabel: 'Plate-loaded machine' };
  if (eq.includes('landmine')) return { singleLoad: true, barWeight: 0, barLabel: 'Landmine' };
  if (/cable|lever|machine|selectorized|sled/.test(eq)) return { singleLoad: true, barWeight: 0, barLabel: 'Machine stack' };
  return { singleLoad: true, barWeight: 0, barLabel: 'Weight' };
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
  // The part of the weight the plates can't make up exactly (e.g. 152 lb on a barbell = 45 + 2 × 52.5 + 2). It stays
  // when plates are added or removed, so TOTAL WEIGHT always equals bar + plates + this, and shows as its own chip.
  const [calcExtraLbs, setCalcExtraLbs] = useState(0);
  const [prRecordDate, setPrRecordDate] = useState('');

  const calcBarWeight = calcLoad.barWeight;
  const calcBarLabel = calcLoad.barLabel;
  const sideMultiplier = calcIsSingleLoad ? 1 : 2;

  const setCalcPlatesPerSide = updater => setCalcPlatesPerSideRaw(updater);
  const clearCalcExtra = () => setCalcExtraLbs(0);

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

  // Weight → bar + plates (largest first) + whatever is left over. 0 / no weight = the empty bar.
  const decomposeWeightToPlates = (initialWeight, exerciseId, equipment) => {
    const load = getLoadSetup(exerciseId, equipment);
    setCalcUnit('lb');
    setCalcLoad(load);
    const weight = Math.max(0, Number(initialWeight) || 0);
    if (weight <= 0) {
      setCalcPlatesPerSideRaw([]);
      setCalcExtraLbs(0);
      return;
    }
    const plates = platesForWeight(weight, load);
    setCalcPlatesPerSideRaw(plates);
    const platesTotal = plates.reduce((a, p) => a + p, 0);
    const extra = Math.round((weight - load.barWeight - platesTotal * (load.singleLoad ? 1 : 2)) * 100) / 100;
    setCalcExtraLbs(Math.abs(extra) < 0.01 ? 0 : extra);
  };

  // TOTAL WEIGHT typed in by hand: show the plates for it, keeping the typed number if they can't match it
  const setCalcTotalFromInput = value => {
    const weight = Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
    decomposeWeightToPlates(weight, plateCalcTarget?.exerciseId, plateCalcTarget?.equipment);
  };

  // setInfo from SlotEditor, shown around TOTAL WEIGHT:
  // { lastDisplay, showOneRepMax, setReps, sessionSets, prValue, prWorkoutId }
  const openPlateCalculatorForSet = (slotId, exIndex, setItem, exerciseName, onApplyCustom = null, setInfo = {}) => {
    decomposeWeightToPlates(Number(setItem.weight) || 0, setInfo.exerciseId, setInfo.equipment);
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
    const oneSideSum = calcPlatesPerSide.reduce((acc, p) => acc + p, 0);
    return Math.max(0, Math.round((calcBarWeight + oneSideSum * sideMultiplier + calcExtraLbs) * 100) / 100);
  }, [calcExtraLbs, calcPlatesPerSide, calcBarWeight, sideMultiplier]);

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
    calcExtraLbs,
    clearCalcExtra,
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

