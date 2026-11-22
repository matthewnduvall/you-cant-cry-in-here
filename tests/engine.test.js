import { describe, it, expect, afterEach } from 'vitest';
import {
  estimateSet1RM,
  exercise1RMInfoOfSets,
  kalman1RM,
  estimateFromSessions,
  setEngineEstimator,
  getLastSession1RM,
  restFatigueFactor,
  setRestSeconds,
  plannedRestSeconds,
  setEngineFatigueByExercise,
  withEngineFatigueByExercise,
  fatigueRateFor,
  getSetOneRepMaxFactor,
  calculateLastEquivalentWeightForSet
} from '../app/utils/workoutEngine';
import { setRepCurves, weightForIntensity } from '../app/utils/intensity';
import { BENCH, day, rated, rng, set, workout } from './helpers';

afterEach(() => {
  setRepCurves({});
  setEngineEstimator('smooth');
  setEngineFatigueByExercise({});
});

describe('a set’s 1RM', () => {
  it('is the exact inverse of planning, on the standard and on a learned curve', () => {
    for (const curves of [{}, { [BENCH]: { k: 38 } }]) {
      setRepCurves(curves);
      const w = weightForIntensity(250, 8, { mode: 'rir', value: 2 }, BENCH);
      expect(estimateSet1RM({ weight: w, reps: 8, type: 'Working', intensity: { mode: 'rir', value: 2 } }, 0, BENCH)).toBeCloseTo(250, 6);
    }
  });

  it('never reads the rest it had (rest only changes planning)', () => {
    const base = { weight: 200, reps: 8, type: 'Working', intensity: { mode: 'rir', value: 2 }, completed: true };
    const short = estimateSet1RM({ ...base, restSec: 20 }, 2, BENCH);
    const long = estimateSet1RM({ ...base, restSec: 300 }, 2, BENCH);
    const none = estimateSet1RM(base, 2, BENCH);
    expect(short).toBe(none);
    expect(long).toBe(none);
  });

  it('a worked-out intensity reads back the fatigue it was planned with', () => {
    const planned = { weight: 200, reps: 8, type: 'Working', intensity: { mode: 'rir', value: 1, auto: true, exactRir: 1.2, fatigueReps: 1.4 } };
    // reps + exactRir + its own fatigue = 8 + 1.2 + 1.4, whatever the earlier sets or rest
    expect(estimateSet1RM(planned, 2, BENCH)).toBeCloseTo(200 * (1 + (8 + 1.2 + 1.4 - 1) / 30), 6);
    expect(estimateSet1RM({ ...planned, restSec: 15 }, 5, BENCH)).toBeCloseTo(200 * (1 + (8 + 1.2 + 1.4 - 1) / 30), 6);
  });

  it('a set rated by hand counts fatigue × the working sets before it', () => {
    setEngineFatigueByExercise({ [BENCH]: 0.5 });
    const st = { weight: 200, reps: 8, type: 'Working', intensity: { mode: 'rir', value: 1 } };
    expect(estimateSet1RM(st, 2, BENCH)).toBeCloseTo(200 * (1 + (8 + 1 + 1 - 1) / 30), 6);
  });

  it('a real single is the exercise’s 1RM by itself', () => {
    const info = exercise1RMInfoOfSets([set(200, 5, { intensity: { mode: 'rir', value: 2 } }), set(250, 1, { intensity: { mode: 'rir', value: 0 } })], BENCH);
    expect(info.value).toBe(250);
    expect(info.calculated).toBe(false);
  });
});

describe('rest', () => {
  it('is neutral at 1:30, heavier when short, lighter when long, and capped', () => {
    expect(restFatigueFactor(90)).toBeCloseTo(1, 6);
    expect(restFatigueFactor(45)).toBeGreaterThan(1);
    expect(restFatigueFactor(180)).toBeLessThan(1);
    expect(restFatigueFactor(1)).toBeLessThanOrEqual(2.5);
    expect(restFatigueFactor(undefined)).toBe(1);
  });

  it('is measured from the previous set of the same exercise, less ~3 s a rep', () => {
    const t0 = 1_000_000;
    const list = [
      { id: 'a', completed: true, completedAt: t0 },
      { id: 'b', completed: true, completedAt: t0 + 60_000 },
      { id: 'c', reps: 8 }
    ];
    expect(setRestSeconds(list[2], list, t0 + 60_000 + 150_000)).toBe(150 - 24);
  });

  it('is unknown without an earlier set, or outside 10 s – 10 min', () => {
    const t0 = 1_000_000;
    expect(setRestSeconds({ id: 'x', reps: 5 }, [], t0)).toBeNull();
    const list = [{ id: 'a', completed: true, completedAt: t0 }];
    expect(setRestSeconds({ id: 'x', reps: 8 }, list, t0 + 20_000)).toBeNull(); // 20 − 24 < 10
    expect(setRestSeconds({ id: 'x', reps: 1 }, list, t0 + 700_000)).toBeNull();
  });

  it('a planned set rests for the exercise’s REST, else the session’s', () => {
    expect(plannedRestSeconds({ customRestSeconds: 60 }, { defaultRestSeconds: 120 })).toBe(60);
    expect(plannedRestSeconds({}, { defaultRestSeconds: 120 })).toBe(120);
    expect(plannedRestSeconds({}, {})).toBe(90);
  });
});

describe('estimators', () => {
  it('Kalman settles on a steady 1RM', () => {
    const sessions = Array.from({ length: 20 }, (_, i) => ({ value: 200, timeMs: day(i * 3).getTime() }));
    const k = kalman1RM(sessions);
    expect(k.value).toBeCloseTo(200, 1);
    expect(Math.abs(k.trendPerDay)).toBeLessThan(0.05);
  });

  it('Kalman learns a rising trend and stays close to a steadily rising lift', () => {
    const sessions = Array.from({ length: 20 }, (_, i) => ({ value: 200 + i * 2, timeMs: day(i * 3).getTime() }));
    const k = kalman1RM(sessions);
    expect(k.trendPerDay).toBeGreaterThan(0);
    // within 1 % of the latest (238); it is tuned for noisy days, so it trails a perfectly clean rise slightly
    expect(Math.abs(238 - k.value)).toBeLessThan(2.4);
  });

  it('on a noisy rising lift, Kalman forecasts the next session about as well as the smoothed average or better', () => {
    const rand = rng(11);
    const sessions = Array.from({ length: 60 }, (_, i) => ({
      value: 200 + i * 0.8 + (rand() - 0.5) * 16,
      timeMs: day(i * 3).getTime()
    }));
    let errK = 0;
    let errS = 0;
    for (let i = 5; i < sessions.length; i++) {
      const before = sessions.slice(0, i);
      errK += Math.abs(sessions[i].value - kalman1RM(before).value);
      errS += Math.abs(sessions[i].value - estimateFromSessions([...before].reverse(), 'smooth'));
    }
    expect(errK).toBeLessThanOrEqual(errS * 1.05);
  });

  it('a long gap lets one new session move the estimate more', () => {
    const steady = Array.from({ length: 10 }, (_, i) => ({ value: 200, timeMs: day(i * 3).getTime() }));
    const soon = kalman1RM([...steady, { value: 180, timeMs: day(30).getTime() }]).value;
    const later = kalman1RM([...steady, { value: 180, timeMs: day(150).getTime() }]).value;
    expect(later).toBeLessThan(soon);
  });

  it('last / smooth / kalman read History newest first', () => {
    const sessions = [{ value: 210 }, { value: 200 }, { value: 190 }];
    expect(estimateFromSessions(sessions, 'last')).toBe(210);
    expect(estimateFromSessions(sessions, 'smooth')).toBeCloseTo(0.6 * 210 + 0.25 * 200 + 0.15 * 190, 6);
    expect(estimateFromSessions([], 'smooth')).toBe(0);
  });

  it('getLastSession1RM follows the estimator in use', () => {
    const history = [100, 110, 120].map((v, i) => workout(day(i * 4), [[BENCH, [set(v, 1, { intensity: { mode: 'rir', value: 0 } })]]]));
    setEngineEstimator('last');
    expect(getLastSession1RM(BENCH, history)).toBe(120);
    setEngineEstimator('smooth');
    expect(getLastSession1RM(BENCH, history)).toBeCloseTo(0.6 * 120 + 0.25 * 110 + 0.15 * 100, 6);
  });
});

describe('scoped fatigue', () => {
  it('withEngineFatigueByExercise puts the previous rates back', () => {
    setEngineFatigueByExercise({ [BENCH]: 0.8 });
    expect(withEngineFatigueByExercise({ [BENCH]: 0.2 }, () => fatigueRateFor(BENCH))).toBe(0.2);
    expect(fatigueRateFor(BENCH)).toBe(0.8);
  });
});

describe('older weight paths use the lift’s curve', () => {
  it('the set factor and equivalent weight change with a learned curve', () => {
    const st = { reps: 10, type: 'Working' };
    const std = getSetOneRepMaxFactor(st, 5, BENCH);
    const stdW = calculateLastEquivalentWeightForSet(250, st, 5, 'Compound', 2, '5x10', BENCH);
    setRepCurves({ [BENCH]: { k: 40 } });
    expect(getSetOneRepMaxFactor(st, 5, BENCH)).toBeGreaterThan(std);
    expect(calculateLastEquivalentWeightForSet(250, st, 5, 'Compound', 2, '5x10', BENCH)).toBeGreaterThanOrEqual(stdW);
  });

  it('rated() helper builds sets the engine reads', () => {
    expect(estimateSet1RM(rated(200, 5, 0), 0, BENCH)).toBeCloseTo(200 * (1 + 4 / 30), 6);
  });
});
