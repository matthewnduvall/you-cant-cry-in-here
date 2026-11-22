import { describe, it, expect, afterEach } from 'vitest';
import {
  createRepCurveFitter,
  learnRepCurves,
  learnRestEffect,
  backtestPredictions,
  planFollowThrough,
  withAthleteModel,
  athleteModelOf,
  historySignature,
  repsAtShare,
  REP_CURVE_PRIOR_SETS,
  MIN_FORECASTS
} from '../app/utils/modelLearning';
import { setRepCurves, repCurveFor } from '../app/utils/intensity';
import { setEngineFatigue, setEngineFatigueByExercise, fatigueRateFor, getEngineFatigueByExercise } from '../app/utils/workoutEngine';
import { BENCH, SQUAT, day, rated, rng, set, weightOn, workout } from './helpers';

afterEach(() => {
  setRepCurves({});
  setEngineFatigue(0.5);
  setEngineFatigueByExercise({});
});

/**
 * A lifter on curve k: every `every` days a bench session of 5- and 10-rep sets rated by hand, 1RM rising `gain` lb
 * a session with ±noise lb of day-to-day swing. Fatigue 0 so effective reps = reps + RIR exactly.
 */
const lifterHistory = ({ k = 38, sessions = 24, every = 4, gain = 1, noise = 8, seed = 7 } = {}) => {
  const rand = rng(seed);
  return Array.from({ length: sessions }, (_, i) => {
    const oneRM = 200 + i * gain + (rand() - 0.5) * noise;
    const sets = [
      [5, 2],
      [5, 1],
      [10, 2],
      [10, 1]
    ].map(([r, q]) => rated(Math.round(weightOn(oneRM, r, q, k) / 2.5) * 2.5, r, q));
    return workout(day(i * every), [[BENCH, sets]]);
  });
};

describe('rep curve fit', () => {
  it('recovers a planted curve from plenty of rated sets', () => {
    setEngineFatigue(0);
    const curves = learnRepCurves(lifterHistory({ k: 38, sessions: 30, noise: 0 }));
    expect(curves[BENCH].fitted).toBeGreaterThan(35);
    expect(curves[BENCH].fitted).toBeLessThan(41);
    expect(curves[BENCH].k).toBeGreaterThan(30); // shrunk toward 30, but not all the way
  });

  it('a standard lifter stays near 30', () => {
    setEngineFatigue(0);
    const curves = learnRepCurves(lifterHistory({ k: 30, sessions: 30, noise: 0 }));
    expect(Math.abs(curves[BENCH].k - 30)).toBeLessThan(2);
  });

  it('needs 3 pairs, and shrinks by the number of sets (not pairs)', () => {
    const f = createRepCurveFitter();
    f.add({ t: 0, w: 180, e: 6 });
    f.add({ t: 0, w: 150, e: 11 });
    expect(f.result()).toBeNull();
    f.add({ t: 0, w: 140, e: 13 });
    f.add({ t: 0, w: 185, e: 5 });
    const r = f.result();
    expect(r.pairs).toBeGreaterThanOrEqual(3);
    expect(r.sets).toBe(4);
    // 4 sets against a 12-set prior: at most a quarter of the way from 30 to the fit
    expect(Math.abs(r.k - 30)).toBeLessThanOrEqual(Math.abs(r.fitted - 30) * (4 / (4 + REP_CURVE_PRIOR_SETS)) + 0.05);
  });

  it('only pairs sets within 14 days', () => {
    const f = createRepCurveFitter();
    f.add({ t: 0, w: 180, e: 6 });
    f.add({ t: 30 * 86400000, w: 150, e: 11 });
    f.add({ t: 60 * 86400000, w: 140, e: 13 });
    expect(f.result()).toBeNull();
  });

  it('reps at a share of the 1RM follow the curve', () => {
    expect(repsAtShare(0.8, 30)).toBeCloseTo(8.5, 6);
    expect(repsAtShare(0.8, 40)).toBeCloseTo(11, 6);
  });
});

describe('prediction replay', () => {
  it('your curve predicts reps better than the standard for a lifter who is not on it', () => {
    setEngineFatigue(0);
    const r = backtestPredictions(lifterHistory({ k: 38, sessions: 30 }));
    expect(r.reps.standard.n).toBeGreaterThan(0);
    expect(r.reps.personal.mae).toBeLessThan(r.reps.standard.mae);
  });

  it('for a lifter on the standard curve, your curve is no better than the standard', () => {
    setEngineFatigue(0);
    const r = backtestPredictions(lifterHistory({ k: 30, sessions: 30 }));
    expect(r.reps.personal.mae).toBeGreaterThanOrEqual(r.reps.standard.mae - 0.15);
  });

  it('never sees the learned model: the same result whatever curves and fatigue are in use', () => {
    setEngineFatigue(0);
    const history = lifterHistory({ k: 38, sessions: 30 });
    const plain = backtestPredictions(history);
    setRepCurves({ [BENCH]: { k: 55 } });
    setEngineFatigueByExercise({ [BENCH]: 1.5 });
    const withModel = backtestPredictions(history);
    expect(withModel.reps).toEqual(plain.reps);
    expect(withModel.forecasts).toEqual(plain.forecasts);
    // …and it put the app's model back afterwards
    expect(repCurveFor(BENCH)).toBe(55);
    expect(fatigueRateFor(BENCH)).toBe(1.5);
  });

  it('a session is forecast only from sessions before it: changing a later session leaves earlier forecasts alone', () => {
    setEngineFatigue(0);
    const history = lifterHistory({ k: 30, sessions: 10, noise: 0 });
    const a = backtestPredictions(history);
    const changed = history.map((w, i) => (i === 9 ? { ...w, slots: [{ ...w.slots[0], sets: w.slots[0].sets.map(s => ({ ...s, weight: s.weight + 40 })) }] } : w));
    const b = backtestPredictions(changed);
    // 9 forecasts each; only the last one's actual moved, so only the error total differs, by that one forecast
    expect(b.forecasts.smooth.n).toBe(a.forecasts.smooth.n);
    const diff = Math.abs(b.forecasts.smooth.mae - a.forecasts.smooth.mae) * a.forecasts.smooth.n;
    expect(diff).toBeGreaterThan(0.1);
  });

  it('picks an estimator only once there are enough forecasts', () => {
    setEngineFatigue(0);
    expect(backtestPredictions(lifterHistory({ sessions: 8 })).best).toBeNull();
    const many = backtestPredictions(lifterHistory({ sessions: MIN_FORECASTS + 2 }));
    expect(['last', 'smooth', 'kalman']).toContain(many.best);
  });

  it('is empty for an exercise logged once', () => {
    const r = backtestPredictions([workout(day(0), [[SQUAT, [set(200, 5)]]])]);
    expect(r.forecasts.smooth.n).toBe(0);
    expect(r.best).toBeNull();
  });
});

describe('rest effect', () => {
  it('learns a strong rest effect from pairs that drop more after short rests', () => {
    setEngineFatigueByExercise({ [BENCH]: 1 });
    const history = [];
    [40, 60, 90, 150, 240, 40, 60, 90, 150, 240].forEach((rest, i) => {
      const drop = Math.min(3, Math.pow(90 / rest, 1.2)); // planted exponent 1.2
      history.push(
        workout(day(i), [
          [BENCH, [rated(200, 5, 3), rated(200, 5, Math.round((3 - drop) * 10) / 10, { restSec: rest })]]
        ])
      );
    });
    const r = learnRestEffect(history);
    expect(r.pairs).toBe(10);
    expect(r.fitted).toBeGreaterThan(0.9);
    expect(r.exponent).toBeGreaterThan(0.5);
  });

  it('needs 4 pairs with varied rests', () => {
    const history = [0, 1, 2, 3, 4].map(i => workout(day(i), [[BENCH, [rated(200, 5, 3), rated(200, 5, 2, { restSec: 90 })]]]));
    expect(learnRestEffect(history)).toBeNull();
  });
});

describe('planned vs done', () => {
  it('counts done working sets against their plan', () => {
    const history = [
      workout(day(0), [
        [
          BENCH,
          [
            set(200, 5, { plan: { weight: 200, reps: 5 } }),
            set(200, 6, { plan: { weight: 200, reps: 5 } }),
            set(205, 4, { plan: { weight: 200, reps: 5 } }),
            set(100, 5, { type: 'Warmup', plan: { weight: 100, reps: 5 } }),
            set(200, 5)
          ]
        ]
      ])
    ];
    expect(planFollowThrough(history)).toEqual({ n: 3, asPlanned: 1, moreReps: 1, fewerReps: 1, heavier: 1, lighter: 0 });
  });
});

describe('friends on their own model', () => {
  it('runs on the friend’s curves and fatigue, then puts yours back', () => {
    setEngineFatigue(0);
    setRepCurves({ [BENCH]: { k: 25 } });
    const friend = lifterHistory({ k: 38, sessions: 30, noise: 0 });
    const theirK = withAthleteModel(friend, () => repCurveFor(BENCH));
    expect(theirK).toBeGreaterThan(30);
    expect(repCurveFor(BENCH)).toBe(25);
    expect(getEngineFatigueByExercise()).toEqual({});
  });

  it('learns each friend’s model once per History', () => {
    const friend = lifterHistory({ sessions: 6 });
    expect(athleteModelOf(friend)).toBe(athleteModelOf(friend));
    expect(athleteModelOf(null)).toEqual({ fatigue: {}, curves: {} });
  });
});

describe('History signature', () => {
  it('is the same for a copy and changes when a set changes', () => {
    const history = lifterHistory({ sessions: 4 });
    const copy = JSON.parse(JSON.stringify(history));
    expect(historySignature(copy)).toBe(historySignature(history));
    copy[2].slots[0].sets[1].reps += 1;
    expect(historySignature(copy)).not.toBe(historySignature(history));
    const rated2 = JSON.parse(JSON.stringify(history));
    rated2[0].slots[0].sets[0].intensity = { mode: 'rir', value: 4 };
    expect(historySignature(rated2)).not.toBe(historySignature(history));
  });
});
