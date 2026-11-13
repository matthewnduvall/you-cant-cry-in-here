// Applies a training program's week (app/data/programs.js) to an exercise: its scheme, sets, reps, intensity and
// weights. Only the slot types the program covers (`appliesTo`, e.g. Compound) are changed. A slot whose scheme the
// athlete picked by hand (`programOff`) keeps its scheme and sets, but still gets the week's intensity and weights.
//
// Weights come from the cycle's target 1RM: the best 1RM logged before the cycle began (else the best logged at all,
// else the starting 1RM — a related logged lift, else the strength standard one class below the goal; see
// utils/starting1RM.js) + the goal increment (Society adds it once per cycle). Each working set then weighs
// target × %1RM for its reps and the week's RIR (utils/intensity.js: %1RM = 100 / (1 + (reps + RIR − 1) / 30)).
// Warm-ups weigh about three quarters of that (the app's usual warm-up step); the 1RM day ramps 50 → 85 % before
// the single at 100 %. Completed sets, and locked types / weights / reps / intensities, are kept; a locked intensity
// sets its set's weight instead of the week's plan.

import { EXERCISE_MAP, isBodyweightExercise, isSupersetCategory, normalizeSlotCategory } from '../data/exerciseLibrary';
import { generateSetsForScheme, getBestHistory1RM, normalizeSetType, DEFAULT_SET_PREFERENCES } from './workoutEngine';
import { INTENSITY_OPTIONS, intensityToRir, solveSet, deriveIntensity } from './intensity';
import { getStarting1RM } from './starting1RM';

const WARMUP_SHARE = 0.755; // the app's warm-up step (× 0.74 / 0.98 of the working weight)
const roundTo = (value, step = 2.5) => Math.max(0, Math.round(value / step) * step);
const nearestPct = pct =>
  INTENSITY_OPTIONS.pct.reduce((best, opt) => (Math.abs(opt - pct) < Math.abs(best - pct) ? opt : best), 100);
/** %1RM for a set of `reps` reps with `rir` reps in reserve. */
export const pctFor = (reps, rir) => 100 / (1 + (Math.max(1, Number(reps) || 1) + Math.max(0, Number(rir) || 0) - 1) / 30);

/** The 1RM the cycle builds to for an exercise. */
export const getCycleTarget1RM = ({
  exerciseId,
  history = [],
  cycleStartMs = null,
  incrementLbs = 0,
  excludeWorkoutId = null,
  // For an exercise never logged: { targetStandardClass, bodyweightLbs, heightInches } (utils/starting1RM.js)
  startOpts = {}
}) => {
  const pool = (history || []).filter(w => w && w.id !== excludeWorkoutId);
  const before = Number.isFinite(cycleStartMs)
    ? pool.filter(w => new Date(w.startedAt || 0).getTime() < cycleStartMs)
    : pool;
  const base =
    getBestHistory1RM(exerciseId, before) ||
    getBestHistory1RM(exerciseId, pool) ||
    getStarting1RM(exerciseId, { ...startOpts, history: pool }) ||
    EXERCISE_MAP[exerciseId]?.default1RM ||
    135;
  return base + (isBodyweightExercise(exerciseId) ? 0 : Math.max(0, Number(incrementLbs) || 0));
};

/** Does the program change this slot? */
export const isProgrammedSlot = (slot, ctx) =>
  Boolean(
    ctx?.program?.weekPlan &&
      slot &&
      // A hand-picked Timer has no reps to give an intensity to
      !(slot.programOff && slot.scheme === 'Timer') &&
      !isSupersetCategory(slot.category) &&
      (ctx.program.appliesTo || []).includes(normalizeSlotCategory(slot.category))
  );

/**
 * The slot with the program's week applied (unchanged when the program doesn't cover it).
 * ctx = getProgramContext(...); opts = { history, incrementLbs, userBodyweightLbs, setPreferences, workoutId,
 *   targetStandardClass, heightInches }
 */
export const applyProgramToSlot = (slot, ctx, opts = {}) => {
  if (!isProgrammedSlot(slot, ctx)) return slot;
  const { program, week, cycleStartMs } = ctx;
  const {
    history = [],
    incrementLbs = 0,
    userBodyweightLbs = 220,
    setPreferences = DEFAULT_SET_PREFERENCES,
    workoutId = null,
    targetStandardClass = 'Intermediate',
    heightInches = 70
  } = opts;
  const weekPlan = program.weekPlan(week);
  const old = Array.isArray(slot.sets) ? slot.sets : [];
  // Scheme picked by hand: keep it (and its sets and reps); the week still sets the intensity (its RIR, or RIR 0 on a
  // 1RM week unless the scheme is the 1RM pyramid)
  const handPicked = Boolean(slot.programOff);
  const plan = handPicked
    ? { scheme: slot.scheme, rir: weekPlan.maxOut ? 0 : weekPlan.rir, maxOut: slot.scheme === 'Pyramid 1RM' }
    : weekPlan;
  const exId = slot.exerciseId;
  const isBw = isBodyweightExercise(exId);
  const target1RM = getCycleTarget1RM({
    exerciseId: exId,
    history,
    cycleStartMs,
    incrementLbs,
    excludeWorkoutId: workoutId,
    startOpts: { targetStandardClass, bodyweightLbs: userBodyweightLbs, heightInches }
  });
  const fresh =
    handPicked && old.length > 0
      ? old.map(st => ({ ...st }))
      : generateSetsForScheme(plan.scheme, target1RM, 'Compound', exId, 0, userBodyweightLbs, setPreferences);
  const total = fresh.length;
  // The working sets' %1RM at the week's RIR (warm-ups are a step below the first working set)
  const firstWorkingReps = Number(fresh.find(st => normalizeSetType(st.type) !== 'Warmup')?.reps) || 8;

  const sets = fresh.map((st, idx) => {
    const prev = old[idx];
    if (prev?.completed) return prev;
    const type = prev?.lockType ? prev.type : st.type;
    const reps = prev?.lockReps ? prev.reps : st.reps;
    let pct;
    let intensity;
    const lockedIntensity = prev?.lockIntensity ? prev.intensity : null;
    const lockedRir = lockedIntensity ? intensityToRir(lockedIntensity, reps) : null;
    if (lockedIntensity && lockedRir !== null) {
      // Locked intensity: kept, and the weight follows it
      intensity = lockedIntensity;
      pct = lockedIntensity.mode === 'pct' ? Number(lockedIntensity.value) : pctFor(reps, lockedRir);
    } else if (lockedIntensity) {
      intensity = lockedIntensity;
      pct = pctFor(reps, plan.rir ?? 0);
    } else if (plan.maxOut) {
      pct = idx === total - 1 ? 100 : 50 + (35 * idx) / Math.max(1, total - 2);
      intensity = { mode: 'pct', value: nearestPct(pct) };
    } else if (normalizeSetType(type) === 'Warmup') {
      pct = pctFor(firstWorkingReps, plan.rir) * WARMUP_SHARE;
      intensity = { mode: 'pct', value: nearestPct(pct) };
    } else {
      pct = pctFor(reps, plan.rir);
      intensity = { mode: 'rir', value: plan.rir };
    }
    const weight = prev?.lockWeight ? prev.weight : isBw ? st.weight : roundTo((target1RM * pct) / 100);
    const planned = {
      ...st,
      ...(prev?.id ? { id: prev.id } : {}),
      setNumber: idx + 1,
      type,
      reps,
      weight,
      lastWeight: weight,
      increment: 0,
      intensity,
      ...(prev
        ? { lockType: prev.lockType, lockWeight: prev.lockWeight, lockReps: prev.lockReps, lockIntensity: prev.lockIntensity }
        : {})
    };
    if (isBw) return planned;
    // Locked weight: the unlocked value follows it — with a locked intensity, the reps; otherwise the intensity
    // (worked out from the weight and reps, in the planned scale)
    if (prev?.lockWeight && lockedIntensity && !prev?.lockReps) return solveSet(planned, target1RM);
    if (prev?.lockWeight && !lockedIntensity) {
      const derived = deriveIntensity(target1RM, planned.weight, planned.reps, intensity?.mode || 'rir');
      return derived ? { ...planned, intensity: derived } : planned;
    }
    return planned;
  });

  return {
    ...slot,
    scheme: plan.scheme,
    targetReps: handPicked ? slot.targetReps ?? null : null,
    restSeconds: program.restSeconds || slot.restSeconds || 90,
    programmed: { program: program.id, week },
    supersetSetsByExercise: [sets],
    sets
  };
};

/** Exercises the program picks from: the equipment it names (empty = any). */
export const fitsProgramEquipment = (ex, ctx, getOptions) => {
  const list = ctx?.program?.equipment;
  if (!Array.isArray(list) || list.length === 0) return true;
  return getOptions(ex).some(opt => list.includes(opt));
};
