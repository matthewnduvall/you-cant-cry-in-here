// What the engine learns about a lifter from History, and how well it predicts them.
//
//   learnRepCurves      each lift's rep curve k (1RM = weight × (1 + (reps + RIR − 1) ÷ k), 30 by default)
//   learnRestEffect     how much rest length changes fatigue (restFatigueFactor's exponent; planning only)
//   backtestPredictions the prediction replay: walks History in order and, before each session, forecasts it from
//                       only the sessions before it — then scores the forecasts against what happened
//   planFollowThrough   the prediction log: how often the sets you did matched what the app planned (set.plan)
//   withAthleteModel    runs a calculation on another athlete's own learned model (a friend's curve and fatigue)
//   historySignature    a cheap fingerprint of History's content, so page.js only relearns when it really changed
//
// All of it is plain arithmetic over History. Nothing is stored.

import { EXERCISE_MAP, isSupersetCategory, getSlotEquipmentChoice } from '../data/exerciseLibrary';
import {
  normalizeSetType,
  setReportedRir,
  fatigueRateFor,
  restFatigueFactor,
  priorHardSets,
  withEffectiveLoad,
  workoutTimeMs,
  exerciseSession1RMs,
  estimateFromSessions,
  kalman1RM,
  ESTIMATORS,
  DEFAULT_REST_EXPONENT,
  REST_REFERENCE_SECONDS,
  learnFatigueRates,
  getEngineFatigue,
  withEngineFatigueByExercise
} from './workoutEngine';
import { DEFAULT_REP_CURVE, withRepCurves } from './intensity';

const DAY_MS = 86400000;

/** Every logged exercise in a workout as [{ exId, sets (real loads) }]. */
const exercisesOf = workout => {
  const out = [];
  (workout?.slots || []).forEach(slot => {
    if (isSupersetCategory(slot?.category) && Array.isArray(slot?.supersetSetsByExercise)) {
      const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
      slot.supersetSetsByExercise.forEach((sets, i) => {
        if (ids[i]) out.push({ exId: ids[i], sets: withEffectiveLoad(ids[i], sets || [], getSlotEquipmentChoice(slot, i)) });
      });
    } else if (slot?.exerciseId) {
      out.push({ exId: slot.exerciseId, sets: withEffectiveLoad(slot.exerciseId, slot.sets || [], getSlotEquipmentChoice(slot, 0)) });
    }
  });
  return out;
};

const chronological = history =>
  [...(history || [])]
    .filter(w => w && w.loadedRoutineTitle !== 'PERSONAL RECORD' && workoutTimeMs(w) > 0)
    .sort((a, b) => workoutTimeMs(a) - workoutTimeMs(b));

// An intensity you entered yourself (RIR or RPE): the only effort that says something the plan didn't already
const ratedByHand = st =>
  st?.intensity && !st.intensity.auto && st.intensity.mode !== 'pct' && st.intensity.value !== '' && st.intensity.value !== null;

/**
 * Sets that tell us about the rep curve: done working sets with an effort you rated, each as its effective reps to
 * failure (reps + RIR + the fatigue of the working sets before it; rest is never counted) at its weight, oldest first.
 * [{ exId, t, w, e }]
 */
const curveObservations = history => {
  const obs = [];
  chronological(history).forEach(w => {
    const t = workoutTimeMs(w);
    exercisesOf(w).forEach(({ exId, sets }) => {
      const done = (sets || []).filter(st => st?.completed && Number(st.weight) > 0);
      done.forEach((st, i) => {
        if (normalizeSetType(st.type) === 'Warmup' || !ratedByHand(st)) return;
        const fatigue = fatigueRateFor(exId) * priorHardSets(done, i);
        const e = Math.max(1, Number(st.reps) || 1) + setReportedRir(st) + fatigue;
        obs.push({ exId, t, w: Number(st.weight), e });
      });
    });
  });
  return obs;
};

// ---- The rep-curve fit. Rated sets within 14 days of each other whose effective reps differ by 3+ should give the same
// 1RM; k (searched 12–60 in 0.5 steps) is the value that makes them agree best. Observations are added oldest first and
// each pair's cost is added to a running total per k, so the fit after any point in time costs nothing extra (the
// replay reads it session by session). The result is shrunk toward 30 by the number of SETS involved (pairs grow with
// the square of sets and aren't independent), as if there were REP_CURVE_PRIOR_SETS more sets on the standard curve.
export const REP_CURVE_K_GRID = Array.from({ length: 97 }, (_, i) => 12 + i * 0.5);
export const REP_CURVE_PRIOR_SETS = 12;
const REP_CURVE_WINDOW_DAYS = 14;
const MIN_PAIRS = 3;

export const createRepCurveFitter = () => {
  const costs = new Float64Array(REP_CURVE_K_GRID.length);
  const window = [];
  const used = new Set();
  let pairs = 0;
  let count = 0;
  return {
    add(o) {
      // log of the set's 1RM at every k, once per set
      const logs = REP_CURVE_K_GRID.map(k => Math.log(o.w * (1 + (o.e - 1) / k)));
      const me = { ...o, idx: count++, logs };
      while (window.length > 0 && me.t - window[0].t > REP_CURVE_WINDOW_DAYS * DAY_MS) window.shift();
      window.forEach(p => {
        if (Math.abs(p.e - me.e) < 3) return;
        for (let j = 0; j < costs.length; j++) {
          const d = me.logs[j] - p.logs[j];
          costs[j] += d * d;
        }
        pairs += 1;
        used.add(p.idx);
        used.add(me.idx);
      });
      window.push(me);
    },
    result() {
      if (pairs < MIN_PAIRS) return null;
      let bestJ = 0;
      for (let j = 1; j < costs.length; j++) if (costs[j] < costs[bestJ]) bestJ = j;
      const fitted = REP_CURVE_K_GRID[bestJ];
      const sets = used.size;
      const k = (sets * fitted + REP_CURVE_PRIOR_SETS * DEFAULT_REP_CURVE) / (sets + REP_CURVE_PRIOR_SETS);
      return { k: Math.round(k * 10) / 10, fitted, pairs, sets };
    }
  };
};

const observationsByExercise = history => {
  const byEx = {};
  curveObservations(history).forEach(o => (byEx[o.exId] = byEx[o.exId] || []).push(o));
  return byEx;
};

/** Each lift's rep curve from History: { [exerciseId]: { k, fitted, pairs, sets } } (only lifts with enough data). */
export const learnRepCurves = (history = []) => {
  const out = {};
  Object.entries(observationsByExercise(history)).forEach(([exId, list]) => {
    const fitter = createRepCurveFitter();
    list.forEach(o => fitter.add(o));
    const fit = fitter.result();
    if (fit) out[exId] = fit;
  });
  return out;
};

/** Reps to failure at a share of the 1RM on a curve k: 1 + k × (1 ÷ share − 1). */
export const repsAtShare = (share, k = DEFAULT_REP_CURVE) => 1 + k * (1 / share - 1);

/**
 * How much rest length changes fatigue, from back-to-back done working sets at the same weight and reps, both rated
 * by hand, with the rest between them known: the drop in RIR should be fatigue × (90 s ÷ rest) ^ exponent. The
 * exponent that fits best (0–1.5), shrunk toward 0.5 as if there were 6 more pairs at it. Needs 4+ pairs whose rests
 * differ (longest ≥ 1.5 × shortest). { exponent, pairs } or null. Used for planning only.
 */
export const learnRestEffect = (history = []) => {
  const pairs = [];
  chronological(history).forEach(w =>
    exercisesOf(w).forEach(({ exId, sets }) => {
      const work = (sets || []).filter(st => st?.completed && normalizeSetType(st.type) !== 'Warmup');
      for (let i = 1; i < work.length; i++) {
        const a = work[i - 1];
        const b = work[i];
        if (!ratedByHand(a) || !ratedByHand(b) || !(Number(b.restSec) > 0)) continue;
        if (Number(a.weight) !== Number(b.weight) || Number(a.reps) !== Number(b.reps)) continue;
        pairs.push({ rate: fatigueRateFor(exId), rest: Number(b.restSec), drop: setReportedRir(a) - setReportedRir(b) });
      }
    })
  );
  if (pairs.length < 4) return null;
  const rests = pairs.map(p => p.rest);
  if (Math.max(...rests) < 1.5 * Math.min(...rests)) return null;
  let best = DEFAULT_REST_EXPONENT;
  let bestCost = Infinity;
  for (let g = 0; g <= 1.5001; g += 0.05) {
    const c = pairs.reduce((sum, p) => {
      const d = Math.min(3, Math.max(-1, p.drop)) - p.rate * restFatigueFactor(p.rest, g);
      return sum + d * d;
    }, 0);
    if (c < bestCost) {
      bestCost = c;
      best = g;
    }
  }
  const n = pairs.length;
  return { exponent: Math.round(((n * best + 6 * DEFAULT_REST_EXPONENT) / (n + 6)) * 100) / 100, fitted: best, pairs: n };
};

const summarize = errors => {
  const n = errors.length;
  if (n === 0) return { n: 0, mae: null, bias: null };
  const mae = errors.reduce((s, e) => s + Math.abs(e), 0) / n;
  const bias = errors.reduce((s, e) => s + e, 0) / n;
  return { n, mae, bias };
};

/**
 * The prediction replay. Nothing it scores may see the future, so it runs on the standard curve and the FATIGUE
 * setting (not the model learned from all of History):
 *   1RM forecasts — every logged session of every exercise after its first is forecast from only the sessions before
 *   it, by each estimator (last / smooth / kalman); error = (actual − forecast) ÷ forecast.
 *   Reps — for every set you rated, the reps you had to failure (reps + RIR) are predicted from the smoothed forecast
 *   twice: on the standard curve (sessions and prediction at k = 30) and on your curve as learned ONLY from the rated
 *   sets before that session (sessions and prediction at that k).
 * Returns { forecasts: { last | smooth | kalman: { n, mae, bias } }, best (once there are MIN_FORECASTS, else null),
 *   reps: { standard, personal: { n, mae, bias } }, byLift: { [exerciseId]: { name, n, mae: {…}, k } } }.
 */
export const MIN_FORECASTS = 20;
export const backtestPredictions = (history = [], repCurves = {}) =>
  withRepCurves({}, () =>
    withEngineFatigueByExercise({}, () => {
      const errs = Object.fromEntries(ESTIMATORS.map(m => [m, []]));
      const repErr = { standard: [], personal: [] };
      const byLift = {};
      const ids = new Set();
      chronological(history).forEach(w => exercisesOf(w).forEach(({ exId }) => ids.add(exId)));
      const obsByEx = observationsByExercise(history);

      ids.forEach(exId => {
        const sessions = exerciseSession1RMs(exId, history)
          .filter(s => !s.deload)
          .reverse(); // oldest first, on the standard curve
        if (sessions.length < 2) return;
        const liftErr = Object.fromEntries(ESTIMATORS.map(m => [m, []]));
        const obs = obsByEx[exId] || [];
        const fitter = createRepCurveFitter();
        let fed = 0;
        for (let i = 1; i < sessions.length; i++) {
          const before = sessions.slice(0, i);
          const target = sessions[i];
          const newestFirst = [...before].reverse();
          ESTIMATORS.forEach(m => {
            const f = m === 'kalman' ? kalman1RM(before).value : estimateFromSessions(newestFirst, m);
            if (f > 0) {
              const e = (target.value - f) / f;
              errs[m].push(e);
              liftErr[m].push(e);
            }
          });
          // Rated sets before this session teach the curve; this session's are predicted
          while (fed < obs.length && obs[fed].t < target.timeMs) fitter.add(obs[fed++]);
          const rated = obs.filter(o => o.t === target.timeMs);
          if (rated.length === 0) continue;
          const stdForecast = estimateFromSessions(newestFirst, 'smooth');
          const kMine = fitter.result()?.k ?? DEFAULT_REP_CURVE;
          const mineForecast =
            kMine === DEFAULT_REP_CURVE
              ? stdForecast
              : withRepCurves({ [exId]: kMine }, () =>
                  estimateFromSessions(
                    exerciseSession1RMs(exId, history).filter(s => !s.deload && s.timeMs < target.timeMs),
                    'smooth'
                  )
                );
          rated.forEach(o => {
            if (stdForecast > 0) repErr.standard.push(o.e - repsAtShare(Math.min(1.5, o.w / stdForecast), DEFAULT_REP_CURVE));
            if (mineForecast > 0) repErr.personal.push(o.e - repsAtShare(Math.min(1.5, o.w / mineForecast), kMine));
          });
        }
        const n = liftErr.smooth.length;
        if (n > 0) {
          byLift[exId] = {
            name: EXERCISE_MAP[exId]?.name || exId,
            n,
            mae: Object.fromEntries(ESTIMATORS.map(m => [m, summarize(liftErr[m]).mae])),
            k: repCurves?.[exId]?.k ?? null
          };
        }
      });
      const forecasts = Object.fromEntries(ESTIMATORS.map(m => [m, summarize(errs[m])]));
      const ranked = ESTIMATORS.filter(m => forecasts[m].n > 0).sort((a, b) => forecasts[a].mae - forecasts[b].mae);
      const best = forecasts.smooth.n >= MIN_FORECASTS ? ranked[0] || null : null;
      return {
        forecasts,
        best,
        reps: { standard: summarize(repErr.standard), personal: summarize(repErr.personal) },
        byLift
      };
    })
  );

/**
 * The prediction log: done working sets that carry the app's plan (set.plan, kept in a live session when a set is
 * first changed or ticked) against what was done. { n, asPlanned, moreReps, fewerReps, heavier, lighter } (counts).
 */
export const planFollowThrough = (history = []) => {
  const out = { n: 0, asPlanned: 0, moreReps: 0, fewerReps: 0, heavier: 0, lighter: 0 };
  // (the sets as stored: set.plan holds the stored weight, not the bodyweight-inclusive load)
  (history || []).forEach(w =>
    (w?.slots || []).forEach(slot =>
      (isSupersetCategory(slot?.category) && Array.isArray(slot?.supersetSetsByExercise) ? slot.supersetSetsByExercise.flat() : slot?.sets || []).forEach(st => {
        if (!st?.completed || !st.plan || normalizeSetType(st.type) === 'Warmup') return;
        out.n += 1;
        const dw = Number(st.weight) - Number(st.plan.weight);
        const dr = Number(st.reps) - Number(st.plan.reps);
        if (Math.abs(dw) < 0.01 && dr === 0) out.asPlanned += 1;
        if (dr > 0) out.moreReps += 1;
        if (dr < 0) out.fewerReps += 1;
        if (dw > 0.01) out.heavier += 1;
        if (dw < -0.01) out.lighter += 1;
      })
    )
  );
  return out;
};

/**
 * Another athlete's own model, learned from their History (cached per History array): their fatigue rates (on your
 * FATIGUE setting as the starting point) and their rep curves. { fatigue, curves }
 */
const athleteModels = new WeakMap();
export const athleteModelOf = history => {
  if (!Array.isArray(history)) return { fatigue: {}, curves: {} };
  let model = athleteModels.get(history);
  if (!model) {
    const fatigue = learnFatigueRates(history, getEngineFatigue());
    const curves = withEngineFatigueByExercise(fatigue, () => learnRepCurves(history));
    model = { fatigue, curves };
    athleteModels.set(history, model);
  }
  return model;
};
/** Runs fn on another athlete's own learned model (their curves and fatigue), then puts yours back. */
export const withAthleteModel = (history, fn) => {
  const { fatigue, curves } = athleteModelOf(history);
  return withEngineFatigueByExercise(fatigue, () => withRepCurves(curves, fn));
};

/**
 * A fingerprint of History's content (every workout's id and time, and each set's weight, reps, done state, type,
 * intensity and rest), so learning reruns only when it really changed — not when a cloud pull rebuilds the same
 * History as new objects.
 */
export const historySignature = (history = []) => {
  let h = 2166136261;
  const mix = v => {
    const s = String(v ?? '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 124; // separator
    h = Math.imul(h, 16777619);
  };
  (history || []).forEach(w => {
    mix(w?.id);
    mix(workoutTimeMs(w));
    mix(w?.loadedRoutineTitle);
    (w?.slots || []).forEach(slot => {
      mix(slot?.exerciseId);
      mix(JSON.stringify(slot?.supersetEquipmentFilters || slot?.equipmentFilter || ''));
      mix((slot?.supersetExerciseIds || []).join(','));
      mix(slot?.deload ? 1 : slot?.deloadSkipped ? 2 : 0);
      const lists = Array.isArray(slot?.supersetSetsByExercise) ? slot.supersetSetsByExercise : [slot?.sets || []];
      lists.forEach(list =>
        (list || []).forEach(st => {
          mix(st?.weight);
          mix(st?.reps);
          mix(st?.completed ? 1 : 0);
          mix(st?.type);
          mix(st?.intensity ? `${st.intensity.mode}${st.intensity.value}${st.intensity.auto ? 'a' : ''}` : '');
          mix(st?.restSec);
          mix(st?.plan ? `${st.plan.weight}x${st.plan.reps}` : '');
        })
      );
    });
  });
  return `${(history || []).length}:${h >>> 0}`;
};

export { REST_REFERENCE_SECONDS };
