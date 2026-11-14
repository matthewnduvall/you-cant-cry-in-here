'use client';

import { useState, useMemo } from 'react';
import { roundTo5 } from '../data/exerciseLibrary';
import { getLoadSetup, platesForLoad, plateLimitsFor } from '../utils/loading';

// Bars, plates and the weights they can make live in utils/loading.js (shared with the workout engine, which snaps
// suggested weights to them)
export { getLoadSetup };

export function usePlateCalculator({
  handleUpdateSetField,
  setCustomGoalWeights,
  setTargetStandardClass
}) {
  const [plateCalcTarget, setPlateCalcTarget] = useState(null);
  const [calcUnit, setCalcUnit] = useState('lb');
  // Bar-style loads: bar + plates on both sides. Dumbbells/kettlebells: the picked weights ARE the total.
  const [calcLoad, setCalcLoad] = useState(() => getLoadSetup(null, 'Barbell'));
  const calcIsSingleLoad = calcLoad.singleLoad;
  const [calcPlatesPerSide, setCalcPlatesPerSideRaw] = useState([]);

  const calcBarWeight = calcLoad.barWeight;
  const calcBarLabel = calcLoad.barLabel;
  const sideMultiplier = calcIsSingleLoad ? 1 : 2;

  const setCalcPlatesPerSide = updater => setCalcPlatesPerSideRaw(updater);

  // Weight → bar + standard plates (largest first, down to 1.25 lb). A weight the plates can't make is snapped to
  // the nearest one they can (both-sided loads move in 2.5 lb steps); there is no leftover. 0 = the empty bar.
  const decomposeWeightToPlates = (initialWeight, exerciseId, equipment) => {
    const load = getLoadSetup(exerciseId, equipment);
    setCalcUnit('lb');
    setCalcLoad(load);
    const weight = Math.max(0, Number(initialWeight) || 0);
    setCalcPlatesPerSideRaw(weight > 0 ? platesForLoad(weight, load) : []);
  };

  // TOTAL WEIGHT typed in by hand: the plates for the nearest weight they can make
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
      prWorkoutId: setInfo.prWorkoutId,
      // The exercise's later sets the ALSO SETS toggle may write the weight to
      laterSets: (setInfo.laterSets || []).map(l => ({ id: l.id, number: l.number })),
      applyToLater: false
    });
  };

  const openPlateCalculatorForGoal = (exerciseId, exerciseName, currentGoalWeight) => {
    decomposeWeightToPlates(Number(currentGoalWeight) || 225, exerciseId);
    setPlateCalcTarget({ mode: 'goal', exerciseId, exerciseName });
  };

  // The plate buttons: the athlete's counted plates on both-sided loads ({ size, left } = pairs still free for each
  // side), else the standard sizes with no limit (left: null)
  const plateLimits = plateLimitsFor(calcLoad);
  const calcPlateOptions = plateLimits
    ? plateLimits.map(p => ({ size: p.size, left: p.perSide - calcPlatesPerSide.filter(x => x === p.size).length }))
    : [45, 35, 25, 10, 5, 2.5, 1.25].map(size => ({ size, left: null }));

  const computedPlateCalculatorTotal = useMemo(() => {
    const oneSideSum = calcPlatesPerSide.reduce((acc, p) => acc + p, 0);
    return Math.max(0, Math.round((calcBarWeight + oneSideSum * sideMultiplier) * 100) / 100);
  }, [calcPlatesPerSide, calcBarWeight, sideMultiplier]);

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
        const ids = [
          plateCalcTarget.setId,
          ...(plateCalcTarget.applyToLater ? (plateCalcTarget.laterSets || []).map(l => l.id) : [])
        ];
        ids.forEach(id => handleUpdateSetField(plateCalcTarget.slotId, plateCalcTarget.exIndex, id, 'weight', finalWeightLbs));
      }
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
    calcPlateOptions,
    setCalcTotalFromInput,
    openPlateCalculatorForSet,
    openPlateCalculatorForGoal,
    computedPlateCalculatorTotal,
    handleApplyCalculatedWeight
  };
}

