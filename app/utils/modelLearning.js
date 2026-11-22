// What the engine learns about the lifter from History, and how well it predicts them.
//
//   learnRepCurves      each lift's rep curve k (1RM = weight × (1 + (reps + RIR − 1) ÷ k), 30 by default)
//   learnRestEffect     how much rest length changes fatigue (restFatigueFactor's exponent)
//   backtestPredictions the prediction replay: walks History in order and, before each session, forecasts it from
//                       only the sessions before it — then scores the forecasts against what happened
//   planFollowThrough   the prediction log: how often the sets you did matched what the app planned (set.plan)
//
// All of it is plain arithmetic over History, recomputed when History changes (page.js memos). Nothing is stored.

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
  REST_REFERENCE_SECONDS
} from './workoutEngine';
import { DEFAULT_REP_CURVE } from './intensity';

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
 * failure (reps + RIR + the fatigue of the sets before it) at its weight. [{ exId, t, w, e }]
 */
const curveObservations = history => {
  const obs = [];
  chronological(history).forEach(w => {
    const t = workoutTimeMs(w);
    exercisesOf(w).forEach(({ exId, sets }) => {
      const done = (sets || []).filter(st => st?.completed && Number(st.weight) > 0);
      done.forEach((st, i) => {
        if (normalizeSetType(st.type) === 'Warmup' || !ratedByHand(st)) return;
        const fatigue = fatigueRateFor(exId) * priorHardSets(done, i) * restFatigueFactor(st.restSec);
        const e = Math.max(1, Number(st.reps) || 1) + setReportedRir(st) + fatigue;
        obs.push({ exId, t, w: Number(st.weight), e });
      });
    });
  });
  return obs;
};

// k for one exercise from its observations: pairs within 14 days whose effective reps differ by 3+ should give the
// same 1RM; k is the value that makes them agree best (a 1-D search), shrunk toward 30 as if there were
// REP_CURVE_PRIOR_PAIRS more pairs at 30. Under 3 pairs: none.
const REP_CURVE_PRIOR_PAIRS = 8;
const REP_CURVE_WINDOW_DAYS = 14;
const fitRepCurve = list => {
  const recent = list.slice(-200);
  const pairs = [];
  for (let i = 0; i < recent.length; i++) {
    for (let j = i + 1; j < recent.length; j++) {
      const a = recent[i];
      const b = recent[j];
      if (Math.abs(b.t - a.t) > REP_CURVE_WINDOW_DAYS * DAY_MS) continue;
      if (Math.abs(a.e - b.e) < 3) continue;
      pairs.push([a, b]);
    }
  }
  if (pairs.length < 3) return null;
  const cost = k =>
    pairs.reduce((sum, [a, b]) => {
      const d = Math.log(a.w * (1 + (a.e - 1) / k)) - Math.log(b.w * (1 + (b.e - 1) / k));
      return sum + d * d;
    }, 0);
  let best = DEFAULT_REP_CURVE;
  let bestCost = Infinity;
  for (let k = 12; k <= 60; k += 0.5) {
    const c = cost(k);
    if (c < bestCost) {
      bestCost = c;
      best = k;
    }
  }
  const n = pairs.length;
  const k = (n * best + REP_CURVE_PRIOR_PAIRS * DEFAULT_REP_CURVE) / (n + REP_CURVE_PRIOR_PAIRS);
  return { k: Math.round(k * 10) / 10, fitted: best, pairs: n };
};

/** Each lift's rep curve from History: { [exerciseId]: { k, fitted, pairs } } (only lifts with enough data). */
export const learnRepCurves = (history = []) => {
  const byEx = {};
  curveObservations(history).forEach(o => (byEx[o.exId] = byEx[o.exId] || []).push(o));
  const out = {};
  Object.entries(byEx).forEach(([exId, list]) => {
    const fit = fitRepCurve(list);
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
 * differ (longest ≥ 1.5 × shortest). { exponent, pairs } or null.
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
  if (n === 0) return { n: 0, mae: null, bias: null, within: null };
  const mae = errors.reduce((s, e) => s + Math.abs(e), 0) / n;
  const bias = errors.reduce((s, e) => s + e, 0) / n;
  return { n, mae, bias };
};

/**
 * The prediction replay. For every logged session of every exercise after its first, forecast its 1RM from only the
 * sessions before it, by each estimator (last / smooth / kalman), and compare with the 1RM the session really showed:
 * error = (actual − forecast) ÷ forecast. And for every set you rated by hand, predict the reps you had to failure at
 * its weight from that forecast (standard curve k = 30 vs your learned k, learned only from earlier sets), and compare
 * with reps + RIR. Returns:
 *   { forecasts: { last | smooth | kalman: { n, mae, bias } }  (shares of the 1RM)
 *     best: the estimator with the lowest error, once there are MIN_FORECASTS forecasts (else null)
 *     reps: { standard: { n, mae, bias }, personal: { n, mae, bias } }  (reps)
 *     byLift: { [exerciseId]: { name, n, mae (best estimator), k } } }
 */
export const MIN_FORECASTS = 20;
export const backtestPredictions = (history = [], repCurves = {}) => {
  const errs = Object.fromEntries(ESTIMATORS.map(m => [m, []]));
  const repErr = { standard: [], personal: [] };
  const byLift = {};
  const ids = new Set();
  chronological(history).forEach(w => exercisesOf(w).forEach(({ exId }) => ids.add(exId)));
  // Rated sets per exercise in time order, for the leave-the-future-out rep curve
  const obsByEx = {};
  curveObservations(history).forEach(o => (obsByEx[o.exId] = obsByEx[o.exId] || []).push(o));

  ids.forEach(exId => {
    const sessions = exerciseSession1RMs(exId, history)
      .filter(s => !s.deload)
      .reverse(); // oldest first
    if (sessions.length < 2) return;
    const liftErr = Object.fromEntries(ESTIMATORS.map(m => [m, []]));
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
      // Reps: each set you rated in this session, predicted from the smoothed forecast
      const forecast = estimateFromSessions(newestFirst, 'smooth');
      if (!(forecast > 0)) continue;
      const rated = (obsByEx[exId] || []).filter(o => o.t === target.timeMs);
      if (rated.length === 0) continue;
      // (the last 60 rated sets before it, so the replay stays quick)
      const fit = fitRepCurve((obsByEx[exId] || []).filter(o => o.t < target.timeMs).slice(-60));
      const kMine = fit ? fit.k : DEFAULT_REP_CURVE;
      rated.forEach(o => {
          const share = Math.min(1.5, o.w / forecast);
          repErr.standard.push(o.e - repsAtShare(share, DEFAULT_REP_CURVE));
          repErr.personal.push(o.e - repsAtShare(share, kMine));
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
};

/**
 * The prediction log: done working sets that carry the app's plan (set.plan, kept when a set is first changed or
 * ticked) against what was done. { n, asPlanned, moreReps, fewerReps, heavier, lighter } (counts).
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

export { REST_REFERENCE_SECONDS };
