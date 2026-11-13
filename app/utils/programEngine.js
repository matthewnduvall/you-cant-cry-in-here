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
import { INTENSITY_OPTIONS, intensityToRir, solveSet, deriveIntensity, weightForIntensity } from './intensity';
import { getStarting1RM, describe1RM } from './starting1RM';
import { traceLine, isTracing, fmt } from './calcTrace';

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
export const isProgrammedSlot = (slot, ctx) => {
  if (!ctx?.program || !slot || isSupersetCategory(slot.category)) return false;
  // A slot a program day created (programRef): planned by its day's rule, unless its scheme was picked by hand
  if (slot.programRef) return Boolean(ctx.program.days && slot.programRef.program === ctx.program.id && !slot.programOff);
  // Society's stimulus sessions: the week plan covers its compound lifts (a hand-picked Timer has no reps to plan)
  return Boolean(
    ctx.program.weekPlan &&
      !(slot.programOff && slot.scheme === 'Timer') &&
      (ctx.program.appliesTo || []).includes(normalizeSlotCategory(slot.category))
  );
};

/**
 * The slot with the program's week applied (unchanged when the program doesn't cover it).
 * ctx = getProgramContext(...); opts = { history, incrementLbs, userBodyweightLbs, setPreferences, workoutId,
 *   targetStandardClass, heightInches }
 */
export const applyProgramToSlot = (slot, ctx, opts = {}) => {
  if (!isProgrammedSlot(slot, ctx)) return slot;
  if (slot.programRef) return applyDayProgramToSlot(slot, ctx, opts);
  const { program, week, cycleStartMs } = ctx;
  const {
    history = [],
    incrementLbs = 0,
    userBodyweightLbs = 220,
    setPreferences = DEFAULT_SET_PREFERENCES,
    workoutId = null,
    targetStandardClass = 'Novice',
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
  if (isTracing()) {
    traceLine(describe1RM(exId, { history, targetStandardClass, bodyweightLbs: userBodyweightLbs, heightInches }));
    const inc = isBw ? 0 : Math.max(0, Number(incrementLbs) || 0);
    traceLine(
      `${program.label} · week ${week}: ${plan.scheme}${plan.maxOut ? ' (1RM day)' : `, RIR ${plan.rir}`}${handPicked ? ' (scheme picked by hand)' : ''} · cycle target 1RM = ${fmt(target1RM - inc)} + increment ${fmt(inc)} = ${fmt(target1RM)} lb`
    );
  }
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
    if (isTracing() && !prev?.lockWeight && !isBw) {
      const why = lockedIntensity
        ? `locked ${intensity.mode === 'pct' ? `${fmt(intensity.value)}%` : `${intensity.mode.toUpperCase()} ${fmt(intensity.value)}`}`
        : plan.maxOut
          ? idx === total - 1
            ? 'the single at 100 %'
            : `ramp 50 → 85 % (${fmt(pct)}%)`
          : normalizeSetType(type) === 'Warmup'
            ? `warm-up ${fmt(WARMUP_SHARE)} × the first working set's ${fmt(pctFor(firstWorkingReps, plan.rir))}%`
            : `100 ÷ (1 + (${reps} + RIR ${plan.rir} − 1) ÷ 30) = ${fmt(pct)}%`;
      traceLine(`set ${idx + 1} ${normalizeSetType(type)} × ${reps}: ${fmt(target1RM)} × ${why} → ${fmt(weight)} lb`);
    }
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

// ===============================================================================================================
// Day programs (Starting Strength, StrongLifts, 5/3/1, Texas Method, PPL, Upper / Lower): each slot of a session
// carries `programRef: { program, day, key }` pointing at its SlotSpec in the program's day; its sets are planned by
// the spec's rule from what you logged before (the planned slot stores `programmed: { program, week, day, key, rule,
// base, tm, role, plan, cycleStartMs }`, which is kept in History and read back next time).
// ===============================================================================================================

const toTime = w => new Date(w?.startedAt || 0).getTime();
const isWarmupSet = st => normalizeSetType(st?.type) === 'Warmup';
const doneWorkingSets = slot => (slot?.sets || []).filter(st => st && st.completed && !isWarmupSet(st) && Number(st.reps) > 0);

/** Logged slots of an exercise (newest first), optionally only those a rule of this program planned. */
const loggedSlotsFor = (history, exerciseId, { programId = null, match = null, excludeWorkoutId = null } = {}) =>
  (history || [])
    .filter(w => w && w.id !== excludeWorkoutId)
    .sort((a, b) => toTime(b) - toTime(a))
    .flatMap(w =>
      (w.slots || [])
        .filter(slot => slot && slot.exerciseId === exerciseId)
        .filter(slot => !programId || slot.programmed?.program === programId)
        .filter(slot => !match || match(slot))
        .map(slot => ({ slot, workout: w }))
    );

/** Did a logged slot get every planned rep ({ sets, reps } = its plan)? */
const hitPlan = (slot, plan) => {
  const done = doneWorkingSets(slot);
  const need = Math.max(1, Number(plan?.sets) || 1);
  const reps = Math.max(1, Number(plan?.reps) || 1);
  return done.length >= need && done.slice(0, need).every(st => Number(st.reps) >= reps);
};
const topWeight = slot => Math.max(0, ...doneWorkingSets(slot).map(st => Number(st.weight) || 0));

// Warm-up ramp before the working weight: 1 → 60 %; 2 → 50 / 75 %; 3 → 40 / 60 / 80 %
const WARMUP_RAMPS = { 1: [[0.6, 5]], 2: [[0.5, 5], [0.75, 3]], 3: [[0.4, 5], [0.6, 5], [0.8, 3]] };
const warmupsFor = (weight, n) => (WARMUP_RAMPS[n] || []).map(([pct, reps]) => ({ type: 'Warmup', reps, weight: roundTo(weight * pct) }));

// 5/3/1: [percent of the training max, reps, as-many-as-possible] by week; warm-ups 40 / 50 / 60 % × 5 / 5 / 3
const WAVE = {
  1: [[0.65, 5], [0.75, 5], [0.85, 5, true]],
  2: [[0.7, 3], [0.8, 3], [0.9, 3, true]],
  3: [[0.75, 5], [0.85, 3], [0.95, 1, true]],
  4: [[0.4, 5], [0.5, 5], [0.6, 5]]
};
const WAVE_LABELS = { 1: '5 / 5 / 5+', 2: '3 / 3 / 3+', 3: '5 / 3 / 1+', 4: 'DELOAD' };

/**
 * The plan of one day slot: { sets: [{ type, reps, weight, intensity? }], scheme, label, programmed, est1RM }.
 * o = { history, workoutId, userBodyweightLbs, startOpts, week, cycleStartMs, programId }
 */
const planDaySlot = (spec, exerciseId, o) => {
  const { history, workoutId, programId, week, cycleStartMs } = o;
  const isBw = isBodyweightExercise(exerciseId);
  const bw = Math.max(0, Number(o.userBodyweightLbs) || 220);
  const est1RM = getBestHistory1RM(exerciseId, history) || getStarting1RM(exerciseId, { ...o.startOpts, history });
  const inc = Number(spec.inc) || 5;
  const base = { program: programId, week, key: spec.key, rule: spec.rule, role: spec.role || null };

  if (spec.rule === 'linear') {
    const plan = { sets: spec.sets, reps: spec.reps };
    const past = loggedSlotsFor(history, exerciseId, { programId, match: s => s.programmed?.rule === 'linear', excludeWorkoutId: workoutId });
    let weight;
    if (isBw) weight = bw;
    else if (past.length === 0) {
      // First session: a weight with about 3 reps in reserve
      weight = roundTo(weightForIntensity(est1RM, spec.reps, { mode: 'rir', value: 3 }) || est1RM * 0.7);
      traceLine(`linear · first session: ${fmt(est1RM)} ÷ (1 + (${spec.reps} + RIR 3 − 1) ÷ 30) → ${fmt(weight)} lb`);
    } else {
      const last = past[0].slot;
      const lastWeight = Number(last.programmed?.base) || topWeight(last);
      if (hitPlan(last, last.programmed?.plan || plan)) {
        weight = lastWeight + inc;
        traceLine(`linear · last session ${fmt(lastWeight)} lb, every rep done → ${fmt(lastWeight)} + ${fmt(inc)} = ${fmt(weight)} lb`);
      } else {
        // Misses in a row at this weight: 3 → deload 10 %
        let misses = 0;
        for (const { slot } of past) {
          if ((Number(slot.programmed?.base) || topWeight(slot)) !== lastWeight || hitPlan(slot, slot.programmed?.plan || plan)) break;
          misses += 1;
        }
        weight = misses >= 3 ? roundTo(lastWeight * 0.9) : lastWeight;
        traceLine(
          misses >= 3
            ? `linear · ${misses} missed sessions at ${fmt(lastWeight)} lb → deload ${fmt(lastWeight)} × 0.9 = ${fmt(weight)} lb`
            : `linear · last session ${fmt(lastWeight)} lb missed a rep (${misses} in a row) → repeat ${fmt(weight)} lb`
        );
      }
    }
    const sets = [
      ...(isBw ? [] : warmupsFor(weight, spec.warmups || 0)),
      ...Array.from({ length: spec.sets }, () => ({ type: 'Working', reps: spec.reps, weight }))
    ];
    return { sets, scheme: spec.sets >= 5 ? '5x5' : '3x5', label: `${spec.sets} × ${spec.reps}`, est1RM, programmed: { ...base, base: weight, plan } };
  }

  if (spec.rule === '531' || spec.rule === 'bbb') {
    // Training max: last cycle's + the increment, the same within a cycle, else 90 % of the 1RM
    const past = loggedSlotsFor(history, exerciseId, { programId, match: s => Number(s.programmed?.tm) > 0, excludeWorkoutId: workoutId });
    const last = past[0]?.slot?.programmed;
    const tm = last
      ? last.cycleStartMs === cycleStartMs
        ? Number(last.tm)
        : Number(last.tm) + inc
      : roundTo(est1RM * 0.9);
    const oneRM = tm / 0.9;
    const w = Math.min(4, Math.max(1, Number(week) || 1));
    traceLine(
      last
        ? last.cycleStartMs === cycleStartMs
          ? `training max = this cycle's ${fmt(tm)} lb`
          : `training max = last cycle's ${fmt(last.tm)} + ${fmt(inc)} = ${fmt(tm)} lb`
        : `training max = 90 % × 1RM ${fmt(est1RM)} = ${fmt(tm)} lb`
    );
    if (spec.rule === 'bbb') {
      const weight = roundTo(tm * (w === 4 ? 0.4 : 0.5));
      return {
        sets: Array.from({ length: 5 }, () => ({ type: 'Working', reps: w === 4 ? 5 : 10, weight })),
        scheme: '5x10',
        label: w === 4 ? '5 × 5 @ 40 %' : '5 × 10 @ 50 %',
        est1RM: oneRM,
        programmed: { ...base, tm, cycleStartMs, plan: { sets: 5, reps: w === 4 ? 5 : 10 } }
      };
    }
    const working = WAVE[w].map(([pct, reps, amrap]) => ({
      type: amrap ? 'Top Out' : 'Working',
      reps,
      weight: roundTo(tm * pct),
      ...(amrap ? { intensity: { mode: 'rir', value: 0 } } : {})
    }));
    const warm = w === 4 ? [] : [[0.4, 5], [0.5, 5], [0.6, 3]].map(([pct, reps]) => ({ type: 'Warmup', reps, weight: roundTo(tm * pct) }));
    return {
      sets: [...warm, ...working],
      scheme: 'Pyramid',
      label: WAVE_LABELS[w],
      est1RM: oneRM,
      programmed: { ...base, tm, cycleStartMs, plan: { sets: 3, reps: WAVE[w][2][1] } }
    };
  }

  if (spec.rule === 'texas') {
    // This week's 5-rep max: last intensity day's + the increment when all 5 reps were done, else repeated
    const past = loggedSlotsFor(history, exerciseId, {
      programId,
      match: s => s.programmed?.rule === 'texas' && s.programmed?.role === 'intensity',
      excludeWorkoutId: workoutId
    });
    let fiveRM;
    if (past.length === 0) fiveRM = roundTo(weightForIntensity(est1RM, 5, { mode: 'rir', value: 1 }) || est1RM * 0.82);
    else {
      const last = past[0].slot;
      const lastFive = Number(last.programmed?.base) || topWeight(last);
      fiveRM = hitPlan(last, { sets: 1, reps: 5 }) ? lastFive + inc : lastFive;
    }
    const volume = roundTo(fiveRM * 0.9);
    traceLine(
      past.length === 0
        ? `5-rep max = ${fmt(est1RM)} ÷ (1 + (5 + RIR 1 − 1) ÷ 30) → ${fmt(fiveRM)} lb · volume 90 % = ${fmt(volume)} lb`
        : `5-rep max = last intensity day ${fmt(Number(past[0].slot.programmed?.base) || topWeight(past[0].slot))} lb${fiveRM > (Number(past[0].slot.programmed?.base) || topWeight(past[0].slot)) ? ` + ${fmt(inc)}` : ' (missed: repeated)'} = ${fmt(fiveRM)} lb · volume 90 % = ${fmt(volume)} lb`
    );
    const programmed = { ...base, base: fiveRM };
    if (spec.role === 'volume') {
      return { sets: [...warmupsFor(volume, 2), ...Array.from({ length: 5 }, () => ({ type: 'Working', reps: 5, weight: volume }))], scheme: '5x5', label: '5 × 5 @ 90 %', est1RM, programmed: { ...programmed, plan: { sets: 5, reps: 5 } } };
    }
    if (spec.role === 'recovery') {
      const isSquat = spec.key === 'squat';
      const weight = roundTo(volume * (isSquat ? 0.8 : 0.9));
      const n = isSquat ? 2 : 3;
      return { sets: [...warmupsFor(weight, 1), ...Array.from({ length: n }, () => ({ type: 'Working', reps: 5, weight }))], scheme: '3x5', label: `${n} × 5 light`, est1RM, programmed: { ...programmed, plan: { sets: n, reps: 5 } } };
    }
    return {
      sets: [...warmupsFor(fiveRM, 3), { type: 'Top Out', reps: 5, weight: fiveRM, intensity: { mode: 'rir', value: 0 } }],
      scheme: '5x5',
      label: '1 × 5 (5RM)',
      est1RM,
      programmed: { ...programmed, plan: { sets: 1, reps: 5 } }
    };
  }

  // 'double': reps climb to the top of the range, then the weight goes up and the reps start again at the bottom
  const [lo, hi] = Array.isArray(spec.reps) ? spec.reps : [spec.reps, spec.reps];
  const rir = Number(spec.rir) || 0;
  // Only a session this rule planned carries on (another scheme's sets start again from the 1RM at the RIR)
  const past = loggedSlotsFor(history, exerciseId, { match: s => s.programmed?.rule === 'double', excludeWorkoutId: workoutId });
  let weight;
  let reps = lo;
  if (isBw) {
    weight = bw;
    const done = past[0] ? doneWorkingSets(past[0].slot) : [];
    if (done.length) reps = Math.min(hi, Math.max(lo, Math.min(...done.map(st => Number(st.reps) || lo)) + 1));
  } else if (past.length === 0) {
    weight = roundTo(weightForIntensity(est1RM, lo, { mode: 'rir', value: rir }) || est1RM * 0.7);
  } else {
    const done = doneWorkingSets(past[0].slot);
    const lastWeight = topWeight(past[0].slot);
    const allTop = done.length >= spec.sets && done.every(st => Number(st.reps) >= hi);
    if (allTop) {
      weight = lastWeight + inc;
      reps = lo;
    } else {
      weight = lastWeight;
      reps = Math.min(hi, Math.max(lo, Math.min(...done.map(st => Number(st.reps) || lo)) + 1));
    }
  }
  traceLine(
    past.length === 0
      ? isBw
        ? `double · ${lo}–${hi} reps, bodyweight: start at ${reps} reps`
        : `double · first time on this plan: ${fmt(est1RM)} ÷ (1 + (${lo} + RIR ${rir} − 1) ÷ 30) → ${fmt(weight)} lb × ${lo}`
      : `double · last ${fmt(topWeight(past[0].slot))} lb: ${reps === lo && weight > topWeight(past[0].slot) ? `every set at ${hi} → + ${fmt(inc)} = ${fmt(weight)} lb × ${lo}` : `top of ${lo}–${hi} not reached → ${fmt(weight)} lb × ${reps}`}`
  );
  return {
    sets: [
      ...(isBw ? [] : warmupsFor(weight, spec.warmups || 0)),
      ...Array.from({ length: spec.sets }, () => ({ type: 'Working', reps, weight, intensity: { mode: 'rir', value: rir } }))
    ],
    scheme: '5x8',
    label: `${spec.sets} × ${lo === hi ? lo : `${lo}–${hi}`}`,
    est1RM,
    programmed: { ...base, base: weight, plan: { sets: spec.sets, reps: hi } }
  };
};

/** The slot with its program day's plan (unchanged when it has no programRef in this program). */
export const applyDayProgramToSlot = (slot, ctx, opts = {}) => {
  const program = ctx?.program;
  const ref = slot?.programRef;
  if (!program || !ref || ref.program !== program.id || slot.programOff) return slot;
  const day = (program.days || []).find(d => d.id === ref.day) || ctx.day;
  const spec = day?.slots?.find(s => s.key === ref.key);
  if (!spec) return slot;
  const exId = slot.exerciseId;
  const { history = [], userBodyweightLbs = 220, workoutId = null, targetStandardClass = 'Novice', heightInches = 70 } = opts;
  if (isTracing()) {
    traceLine(describe1RM(exId, { history: opts.history || [], targetStandardClass: opts.targetStandardClass, bodyweightLbs: opts.userBodyweightLbs, heightInches: opts.heightInches }));
    traceLine(`${program.label} · ${day?.name || ''} · week ${ctx.week}: ${spec.key} (${spec.rule}${spec.role ? `, ${spec.role}` : ''})`);
  }
  const planned = planDaySlot(spec, exId, {
    history,
    workoutId,
    userBodyweightLbs,
    startOpts: { targetStandardClass, bodyweightLbs: userBodyweightLbs, heightInches },
    programId: program.id,
    week: ctx.week,
    cycleStartMs: ctx.cycleStartMs
  });
  const old = Array.isArray(slot.sets) ? slot.sets : [];
  const ts = Date.now();
  const sets = planned.sets.map((p, idx) => {
    const prev = old[idx];
    if (prev?.completed) return prev;
    const type = prev?.lockType ? prev.type : p.type;
    const reps = prev?.lockReps ? prev.reps : p.reps;
    const weight = prev?.lockWeight ? prev.weight : p.weight;
    // Percentage programs (5/3/1, Boring But Big) show %1RM; the rest RIR
    const mode = spec.rule === '531' || spec.rule === 'bbb' ? 'pct' : 'rir';
    const intensity =
      p.intensity || (isBodyweightExercise(exId) ? null : deriveIntensity(planned.est1RM, weight, reps, mode)) || null;
    let out = {
      id: prev?.id || `set_${ts}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
      setNumber: idx + 1,
      type,
      reps,
      weight,
      lastWeight: weight,
      increment: 0,
      completed: false,
      ...(intensity ? { intensity } : {}),
      ...(prev ? { lockType: prev.lockType, lockWeight: prev.lockWeight, lockReps: prev.lockReps, lockIntensity: prev.lockIntensity } : {})
    };
    if (isTracing()) traceLine(`set ${idx + 1} ${normalizeSetType(type)} × ${reps} @ ${fmt(weight)} lb${prev?.lockWeight ? ' (locked)' : ''}`);
    if (isBodyweightExercise(exId)) return out;
    if (prev?.lockIntensity && prev.intensity) out = solveSet({ ...out, intensity: prev.intensity }, planned.est1RM);
    else if (prev?.lockWeight) {
      const derived = deriveIntensity(planned.est1RM, out.weight, out.reps, out.intensity?.mode || 'rir');
      if (derived) out = { ...out, intensity: derived };
    }
    return out;
  });
  return {
    ...slot,
    scheme: planned.scheme,
    targetReps: null,
    restSeconds: day?.restSeconds || program.restSeconds || slot.restSeconds || 90,
    programmed: { ...planned.programmed, day: ref.day, label: planned.label },
    supersetSetsByExercise: [sets],
    sets
  };
};
