// Set intensity for programs other than Crying: %1RM, RIR (reps in reserve) or RPE (rate of perceived exertion,
// 1–10). They convert into one another through the set's reps:
//   RPE = 10 − RIR
//   %1RM = 100 / (1 + (reps + RIR − 1) / 30)
// The %1RM line is the app's own rep estimate (getSetOneRepMaxFactor's rep part: a single at RIR 0 = 100 %): a set
// of `reps` with RIR left in the tank is as hard as a set of reps + RIR taken to failure.

import { traceLine, isTracing, fmt } from './calcTrace';

// A set type's intensity in RIR (the default scale), set when the type is picked: Warm-up RIR 5, Working RIR 2,
// Top Out RIR 1, Burn Out RIR 3, 1 Rep Max RIR 0 (= RPE 5 / 8 / 9 / 7 / 10)
export const SET_TYPE_RIR = { Warmup: 3, Working: 2, 'Top Out': 1, 'Burn Out': 3, '1 Rep Max': 0 };

// The effort each set is planned at, from its type (Exercise Set Preferences decide the types, so they decide the
// effort everywhere): a warm-up leaves RIR 3; working sets wave down from RIR 2 toward 0 across the exercise's working
// sets (round(2 × (1 − k ÷ n)) for the k-th of n: 3 working sets = 2, 1, 1; 5 = 2, 2, 1, 1, 0); Top Out RIR 1,
// Burn Out RIR 3, a 1 Rep Max RIR 0. With the default preferences (2 warm-ups, 3 working) a 5-set exercise is
// 3, 3, 2, 1, 1. `types` = the exercise's normalized set types in order.
// Since the fatigue model (2026/11) this is the FRESH effort by type — every working set is planned at the same weight;
// the RIR shown then falls by the fatigue allowance per earlier working set (2, 1.5, 1 at 0.5 per set; shown rounded up
// to whole reps: 2, 2, 1).
export const plannedRirForSet = (types, idx) => SET_TYPE_RIR[types[idx]] ?? SET_TYPE_RIR.Working;
// The uniform rep schemes whose sets come from Exercise Set Preferences: these are planned by effort
export const EFFORT_PLANNED_SCHEMES = ['3x5', '3x8', '3x12', '5x5', '5x6', '5x8', '5x8w', '5x10', '8x8', 'Cluster'];
// The scale a set's intensity is shown in when nothing else picked one
export const DEFAULT_INTENSITY_MODE = 'rir';

export const INTENSITY_MODES = [
  { id: 'pct', label: '%1RM' },
  { id: 'rir', label: 'RIR' },
  { id: 'rpe', label: 'RPE' }
];

const range = (from, to, step) => {
  const out = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 10) / 10);
  return out;
};

// The values each scale offers (the closest one is picked after converting)
export const INTENSITY_OPTIONS = {
  pct: range(40, 100, 2.5),
  rir: range(0, 10, 1),
  rpe: range(1, 10, 0.5)
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const nearest = (mode, v) =>
  INTENSITY_OPTIONS[mode].reduce((best, opt) => (Math.abs(opt - v) < Math.abs(best - v) ? opt : best), INTENSITY_OPTIONS[mode][0]);

/** Reps in reserve for an intensity on a set of `reps` reps (unrounded; null = unknown). */
export const intensityToRir = (intensity, reps) => {
  if (!intensity || intensity.value === null || intensity.value === undefined || intensity.value === '') return null;
  const v = Number(intensity.value);
  if (!Number.isFinite(v)) return null;
  const n = Math.max(1, Number(reps) || 1);
  // RIR can be below 0: more reps than the load allows (RPE above 10, %1RM above 100)
  if (intensity.mode === 'rir') return v;
  if (intensity.mode === 'rpe') return 10 - v;
  // %1RM → the reps that weight allows to failure, minus the set's reps
  const pct = clamp(v, 1, 200);
  const repsToFailure = 1 + 30 * (100 / pct - 1);
  return repsToFailure - n;
};

/** The same intensity in another scale (rounded to that scale's options); null when unknown. */
export const convertIntensity = (intensity, toMode, reps) => {
  const rir = intensityToRir(intensity, reps);
  if (rir === null) return null;
  const n = Math.max(1, Number(reps) || 1);
  if (toMode === 'rir') return nearest('rir', rir);
  if (toMode === 'rpe') return nearest('rpe', clamp(10 - rir, 1, 10));
  return nearest('pct', 100 / (1 + (n + rir - 1) / 30));
};

/** Display: "80%", "RIR 2", "RPE 8". */
export const formatIntensity = (mode, value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (mode === 'pct') return `${value}%`;
  return `${mode === 'rir' ? 'RIR' : 'RPE'} ${value}`;
};

/** The other two scales for a set's intensity, e.g. "≈ RIR 2 · RPE 8" (empty when unknown). */
export const intensityEquivalents = (intensity, reps) => {
  if (!intensity || intensityToRir(intensity, reps) === null) return '';
  return INTENSITY_MODES.filter(m => m.id !== intensity.mode)
    .map(m => formatIntensity(m.id, convertIntensity(intensity, m.id, reps)))
    .join(' · ');
};

// ---------------------------------------------------------------------------------------------------------------
// Solving a set: any two of weight, reps and intensity give the third, through the exercise's calculated 1RM.
//   reps to failure at a weight:  1 + 30 × (1RM / weight − 1)      (the app's rep estimate, inverted)
//   RIR = reps to failure − reps;  RPE = 10 − RIR;  %1RM = weight / 1RM × 100
//   weight for reps at an intensity = 1RM × 100 / (1 + (reps + RIR − 1) / 30) / 100
//   reps for a weight at an RIR / RPE = reps to failure − RIR; at a %1RM (weight locked) = that % of reps to failure
// ---------------------------------------------------------------------------------------------------------------

/** Reps a weight allows to failure for a 1RM (unrounded; null when unknown). */
export const repsToFailure = (oneRM, weight) => {
  const m = Number(oneRM);
  const w = Number(weight);
  if (!(m > 0) || !(w > 0)) return null;
  // Above the 1RM this goes below 1 (and the RIR below 0)
  return 1 + 30 * (m / w - 1);
};

/**
 * The intensity of a set from its weight and reps (`auto: true` = worked out, not set by hand), in `mode` (the set's
 * own scale if it has one, else RIR); null when the 1RM or weight is unknown. Not held to the pop-up's options, so it
 * stays true: RIR can go past 10 (an easy set), %1RM below 40 (in 2.5 steps).
 */
export const deriveIntensity = (oneRM, weight, reps, mode = DEFAULT_INTENSITY_MODE) => {
  const rtf = repsToFailure(oneRM, weight);
  if (rtf === null) return null;
  const n = Math.max(1, Number(reps) || 1);
  if (mode === 'pct') {
    const pct = (Number(weight) / Number(oneRM)) * 100;
    const value = Math.max(2.5, Math.round(pct / 2.5) * 2.5);
    return { mode: 'pct', value, auto: true };
  }
  // Below 0 when the set asks more reps than the load allows
  const rir = rtf - n;
  // Whole reps, rounded up (fractional RIR is hard to read; up = the cautious side: 1.5 reads RIR 2)
  const wholeRir = Math.ceil(rir - 1e-6);
  // exactRir: the unrounded RIR, kept so a set's 1RM (setReportedRir) isn't moved by the rounding
  if (mode === 'rir') return { mode, value: wholeRir, auto: true, exactRir: rir };
  return { mode, value: Math.max(1, 10 - wholeRir), auto: true, exactRir: rir };
};

/** The weight for `reps` at an intensity (null when unknown). */
export const weightForIntensity = (oneRM, reps, intensity) => {
  const m = Number(oneRM);
  if (!(m > 0) || !intensity) return null;
  if (intensity.mode === 'pct') {
    const pct = Number(intensity.value);
    return pct > 0 ? (m * pct) / 100 : null;
  }
  const rir = intensityToRir(intensity, reps);
  if (rir === null) return null;
  return m / (1 + (Math.max(1, Number(reps) || 1) + rir - 1) / 30);
};

/**
 * The reps a weight allows at an intensity (null when unknown):
 *   RIR / RPE → reps to failure − RIR
 *   %1RM with the weight locked → that share of the reps to failure (100 % = to failure, 80 % = 80 % of them): the
 *   weight is fixed, so the percentage is read as how hard the set is
 */
export const repsForIntensity = (oneRM, weight, intensity) => {
  if (!intensity) return null;
  const rtf = repsToFailure(oneRM, weight);
  if (rtf === null) return null;
  if (intensity.mode === 'pct') {
    const pct = Number(intensity.value);
    return pct > 0 ? Math.max(1, Math.round((rtf * Math.min(100, pct)) / 100)) : null;
  }
  const rir = intensityToRir(intensity, 1);
  if (rir === null) return null;
  return Math.max(1, Math.round(rtf - rir));
};

/**
 * One set with the unlocked value worked out from the locked ones (lockWeight / lockReps / lockIntensity):
 *   intensity locked → weight from it (or, weight locked too, the reps from both; all three locked = unchanged)
 *   intensity not locked → it is worked out from the weight and reps (keeping the set's scale)
 * `step` rounds weights. Completed sets, Timer sets and sets without a 1RM are returned unchanged.
 */
// fatigueReps: the fatigue allowance of the working sets before this one — the set is solved as the same set done
// fresh with that many more reps (its locked RIR is what is left after the fatigue)
export const solveSet = (st, oneRM, { step = 2.5, keepIntensity = false, fatigueReps = 0 } = {}) => {
  const f = Math.max(0, Number(fatigueReps) || 0);
  if (f > 0 && st && st.intensity?.mode !== 'pct') {
    const fresh = solveSet({ ...st, reps: (Number(st.reps) || 1) + f }, oneRM, { step, keepIntensity });
    return fresh === st || !fresh ? st : { ...fresh, reps: fresh.reps === (Number(st.reps) || 1) + f ? st.reps : Math.max(1, Math.round(fresh.reps - f)), intensity: fresh.intensity };
  }
  if (!st || st.completed || !(Number(oneRM) > 0)) return st;
  const hasIntensity = st.intensity && st.intensity.value !== null && st.intensity.value !== undefined && st.intensity.value !== '';
  const label = `set ${st.setNumber ?? ''}`.trim();
  const m = Number(oneRM);
  const tag = formatIntensity(st.intensity?.mode, st.intensity?.value);
  if (st.lockIntensity && hasIntensity) {
    if (!st.lockWeight) {
      const w = weightForIntensity(oneRM, st.reps, st.intensity);
      if (w === null) return st;
      const weight = Math.max(0, Math.round(w / step) * step);
      if (isTracing()) {
        const rir = intensityToRir(st.intensity, st.reps);
        traceLine(
          st.intensity.mode === 'pct'
            ? `${label}: ${tag} locked → weight = 1RM ${fmt(m)} × ${fmt(st.intensity.value)}% = ${fmt(w)} → ${fmt(weight)} lb`
            : `${label}: ${tag} locked (RIR ${fmt(rir)}) × ${st.reps} reps → weight = ${fmt(m)} ÷ (1 + (${st.reps} + ${fmt(rir)} − 1) ÷ 30) = ${fmt(w)} → ${fmt(weight)} lb`
        );
      }
      return { ...st, weight };
    }
    if (!st.lockReps) {
      const r = repsForIntensity(oneRM, st.weight, st.intensity);
      if (r === null) return st;
      if (isTracing()) {
        const rtf = repsToFailure(oneRM, st.weight);
        const how =
          st.intensity.mode === 'pct'
            ? `× ${fmt(st.intensity.value)}% effort`
            : `− RIR ${fmt(intensityToRir(st.intensity, 1))}`;
        traceLine(
          `${label}: ${fmt(st.weight)} lb and ${tag} locked → reps to failure = 1 + 30 × (${fmt(m)} ÷ ${fmt(st.weight)} − 1) = ${fmt(rtf)}; ${how} → ${r} reps`
        );
      }
      return { ...st, reps: r };
    }
    if (isTracing()) traceLine(`${label}: weight, reps and intensity all locked — unchanged`);
    return st;
  }
  // keepIntensity: a planned intensity (a program's week) that set the weight stays as it is
  if (keepIntensity && hasIntensity) return st;
  const mode = st.intensity?.mode || DEFAULT_INTENSITY_MODE;
  const derived = deriveIntensity(oneRM, st.weight, st.reps, mode);
  if (derived && isTracing()) {
    const rtf = repsToFailure(oneRM, st.weight);
    traceLine(
      mode === 'pct'
        ? `${label}: intensity = ${fmt(st.weight)} ÷ ${fmt(m)} = ${fmt((Number(st.weight) / m) * 100)}% → ${formatIntensity(derived.mode, derived.value)}`
        : `${label}: intensity from ${fmt(st.weight)} × ${st.reps}: reps to failure = 1 + 30 × (${fmt(m)} ÷ ${fmt(st.weight)} − 1) = ${fmt(rtf)}; RIR = ${fmt(rtf)} − ${st.reps} = ${fmt(Math.max(0, rtf - st.reps))} → ${formatIntensity(derived.mode, derived.value)}`
    );
  }
  return derived ? { ...st, intensity: derived } : st;
};
