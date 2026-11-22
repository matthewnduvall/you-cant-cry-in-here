import { describe, it, expect, afterEach } from 'vitest';
import {
  DEFAULT_REP_CURVE,
  repCurveFor,
  setRepCurves,
  withRepCurves,
  getRepCurves,
  repsToFailure,
  deriveIntensity,
  weightForIntensity,
  repsForIntensity,
  intensityToRir,
  convertIntensity,
  solveSet
} from '../app/utils/intensity';
import { BENCH, SQUAT } from './helpers';

afterEach(() => setRepCurves({}));

describe('rep curve', () => {
  it('is 30 unless a curve was learned', () => {
    expect(repCurveFor(BENCH)).toBe(DEFAULT_REP_CURVE);
    expect(repCurveFor(null)).toBe(30);
    setRepCurves({ [BENCH]: { k: 38 } });
    expect(repCurveFor(BENCH)).toBe(38);
    expect(repCurveFor(SQUAT)).toBe(30);
  });

  it('withRepCurves scopes curves and puts the previous ones back, even when fn throws', () => {
    setRepCurves({ [BENCH]: { k: 38 } });
    expect(withRepCurves({}, () => repCurveFor(BENCH))).toBe(30);
    expect(withRepCurves({ [BENCH]: { k: 22 } }, () => repCurveFor(BENCH))).toBe(22);
    expect(() =>
      withRepCurves({}, () => {
        throw new Error('boom');
      })
    ).toThrow('boom');
    expect(repCurveFor(BENCH)).toBe(38);
    expect(getRepCurves()[BENCH].k).toBe(38);
  });
});

describe('solving a set', () => {
  it('weight for an intensity and the intensity of that weight are inverses (standard and learned curves)', () => {
    for (const k of [30, 40]) {
      setRepCurves(k === 30 ? {} : { [BENCH]: { k } });
      const w = weightForIntensity(250, 8, { mode: 'rir', value: 2 }, BENCH);
      const back = deriveIntensity(250, w, 8, 'rir', BENCH);
      expect(back.exactRir).toBeCloseTo(2, 6);
    }
  });

  it('a learned curve with more reps per % gives a heavier planned weight', () => {
    const standard = weightForIntensity(250, 10, { mode: 'rir', value: 2 }, BENCH);
    setRepCurves({ [BENCH]: { k: 40 } });
    const mine = weightForIntensity(250, 10, { mode: 'rir', value: 2 }, BENCH);
    expect(mine).toBeGreaterThan(standard);
  });

  it('reps to failure at the 1RM is 1 and goes below 1 above it', () => {
    expect(repsToFailure(200, 200)).toBe(1);
    expect(repsToFailure(200, 220)).toBeLessThan(1);
    expect(repsToFailure(0, 100)).toBeNull();
  });

  it('shows RIR rounded up but keeps the exact value', () => {
    // 200 lb 1RM, 160 lb: reps to failure = 1 + 30 × 0.25 = 8.5; × 7 → RIR 1.5 shown as 2
    const d = deriveIntensity(200, 160, 7, 'rir');
    expect(d.value).toBe(2);
    expect(d.exactRir).toBeCloseTo(1.5, 6);
    expect(d.auto).toBe(true);
  });

  it('reps for a weight at a RIR follow the curve', () => {
    expect(repsForIntensity(200, 160, { mode: 'rir', value: 1 })).toBe(8); // 8.5 − 1 → 8
  });

  it('converts %1RM and RIR on the lift’s own curve', () => {
    expect(intensityToRir({ mode: 'rpe', value: 8 }, 5)).toBe(2);
    const pct = convertIntensity({ mode: 'rir', value: 2 }, 'pct', 8);
    setRepCurves({ [BENCH]: { k: 40 } });
    const pctMine = convertIntensity({ mode: 'rir', value: 2 }, 'pct', 8, BENCH);
    expect(pctMine).toBeGreaterThan(pct);
  });

  it('solveSet keeps the fatigue allowance a worked-out intensity was planned with', () => {
    const solved = solveSet({ weight: 180, reps: 8, intensity: { mode: 'rir', value: 2 }, lockIntensity: false }, 250, {
      fatigueReps: 1,
      exerciseId: BENCH
    });
    expect(solved.intensity.auto).toBe(true);
    expect(solved.intensity.fatigueReps).toBe(1);
  });

  it('a locked intensity sets the weight; all three locked change nothing', () => {
    const st = { weight: 100, reps: 8, intensity: { mode: 'rir', value: 2 }, lockIntensity: true };
    expect(solveSet(st, 250).weight).toBe(Math.round(weightForIntensity(250, 8, st.intensity) / 2.5) * 2.5);
    const all = { ...st, lockWeight: true, lockReps: true };
    expect(solveSet(all, 250)).toBe(all);
  });
});
