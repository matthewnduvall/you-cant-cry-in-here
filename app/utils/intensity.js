// Set intensity for programs other than Crying: %1RM, RIR (reps in reserve) or RPE (rate of perceived exertion,
// 1–10). They convert into one another through the set's reps:
//   RPE = 10 − RIR
//   %1RM = 100 / (1 + (reps + RIR − 1) / 30)
// The %1RM line is the app's own rep estimate (getSetOneRepMaxFactor's rep part: a single at RIR 0 = 100 %): a set
// of `reps` with RIR left in the tank is as hard as a set of reps + RIR taken to failure.

// A set type's intensity (RPE), set when the type is picked: Warm-up 5, Working 8, Top Out 9, Burn Out 7, 1 Rep Max 10
export const SET_TYPE_RPE = { Warmup: 5, Working: 8, 'Top Out': 9, 'Burn Out': 7, '1 Rep Max': 10 };

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
  if (intensity.mode === 'rir') return Math.max(0, v);
  if (intensity.mode === 'rpe') return Math.max(0, 10 - v);
  // %1RM → the reps that weight allows to failure, minus the set's reps
  const pct = clamp(v, 1, 100);
  const repsToFailure = 1 + 30 * (100 / pct - 1);
  return Math.max(0, repsToFailure - n);
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
//   reps for a weight at an RIR / RPE = reps to failure − RIR   (a %1RM fixes the weight, not the reps)
// ---------------------------------------------------------------------------------------------------------------

/** Reps a weight allows to failure for a 1RM (unrounded; null when unknown). */
export const repsToFailure = (oneRM, weight) => {
  const m = Number(oneRM);
  const w = Number(weight);
  if (!(m > 0) || !(w > 0)) return null;
  return 1 + 30 * (m / Math.min(w, m) - 1);
};

/**
 * The intensity of a set from its weight and reps (`auto: true` = worked out, not set by hand), in `mode` (the set's
 * own scale if it has one, else RPE); null when the 1RM or weight is unknown.
 */
export const deriveIntensity = (oneRM, weight, reps, mode = 'rpe') => {
  const rtf = repsToFailure(oneRM, weight);
  if (rtf === null) return null;
  const n = Math.max(1, Number(reps) || 1);
  if (mode === 'pct') {
    const pct = (Number(weight) / Number(oneRM)) * 100;
    const value = INTENSITY_OPTIONS.pct.reduce((b, o) => (Math.abs(o - pct) < Math.abs(b - pct) ? o : b), 100);
    return { mode: 'pct', value, auto: true };
  }
  const rir = Math.max(0, rtf - n);
  return { mode, value: convertIntensity({ mode: 'rir', value: rir }, mode, n), auto: true };
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

/** The reps a weight allows at an RIR / RPE (null for %1RM or when unknown). */
export const repsForIntensity = (oneRM, weight, intensity) => {
  if (!intensity || intensity.mode === 'pct') return null;
  const rtf = repsToFailure(oneRM, weight);
  const rir = intensityToRir(intensity, 1);
  if (rtf === null || rir === null) return null;
  return Math.max(1, Math.round(rtf - rir));
};

/**
 * One set with the unlocked value worked out from the locked ones (lockWeight / lockReps / lockIntensity):
 *   intensity locked → weight from it (or, weight locked too, the reps from both; all three locked = unchanged)
 *   intensity not locked → it is worked out from the weight and reps (keeping the set's scale)
 * `step` rounds weights. Completed sets, Timer sets and sets without a 1RM are returned unchanged.
 */
export const solveSet = (st, oneRM, { step = 2.5, keepIntensity = false } = {}) => {
  if (!st || st.completed || !(Number(oneRM) > 0)) return st;
  const hasIntensity = st.intensity && st.intensity.value !== null && st.intensity.value !== undefined && st.intensity.value !== '';
  if (st.lockIntensity && hasIntensity) {
    if (!st.lockWeight) {
      const w = weightForIntensity(oneRM, st.reps, st.intensity);
      return w === null ? st : { ...st, weight: Math.max(0, Math.round(w / step) * step) };
    }
    if (!st.lockReps) {
      const r = repsForIntensity(oneRM, st.weight, st.intensity);
      return r === null ? st : { ...st, reps: r };
    }
    return st;
  }
  // keepIntensity: a planned intensity (a program's week) that set the weight stays as it is
  if (keepIntensity && hasIntensity) return st;
  const mode = st.intensity?.mode || 'rpe';
  const derived = deriveIntensity(oneRM, st.weight, st.reps, mode);
  return derived ? { ...st, intensity: derived } : st;
};
