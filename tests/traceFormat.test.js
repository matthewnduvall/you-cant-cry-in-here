import { describe, it, expect } from 'vitest';
import { formatTrace, setFinal, stepLabel } from '../app/utils/traceFormat';

const trace = lines => formatTrace({ id: 't', title: 'ADD EXERCISE', at: 0, lines });

describe('console grouping', () => {
  it('splits a superset’s lines by exercise and groups steps by set', () => {
    const t = trace([
      '1RM Band Lat Pulldown (never logged) = Untrained standard = 55 lb',
      '1RM Band Standing / Seated Hip Abduction (never logged) = Untrained standard = 35 lb',
      'Exercise: Band Lat Pulldown · Superset · scheme 5x8',
      'Band Lat Pulldown set 1 Working × 8: 1RM 55 × reps 0.81 [1 ÷ (1 + (8 − 1) ÷ 30)] × type 0.98 × fatigue 0.88 [5 sets] = 40 lb + increment 1.25 → 41.25 lb',
      'Band Standing / Seated Hip Abduction set 1 Working × 8: 1RM 35 × reps 0.81 [1 ÷ (1 + (8 − 1) ÷ 30)] × type 0.98 × fatigue 0.88 [5 sets] = 25 lb + increment 1.25 → 26.25 lb',
      'Band Lat Pulldown set 1 Working · RIR 2: load 41.25 lb → reps to failure 11 − 2 = 9'
    ]);
    const names = t.exercises.map(e => e.name);
    expect(names).toEqual(['Band Lat Pulldown', 'Band Standing / Seated Hip Abduction']);
    const [a, b] = t.exercises;
    expect(a.sets).toHaveLength(1);
    expect(a.sets[0].type).toBe('Working');
    expect(a.sets[0].steps.map(s => s.label)).toEqual(['Scheme default', 'Reps from load']);
    expect(b.sets[0].steps).toHaveLength(1);
    expect(a.oneRM[0]).toMatch(/^\(never logged\)/);
  });

  it('keeps a bracketed name whole when stripping it from a 1RM line', () => {
    const t = trace(['1RM Bodyweight Inverse (Nordic) Leg Curl (never logged) = bodyweight 220 × 100% moved = 300 lb']);
    expect(t.exercises[0].name).toBe('Bodyweight Inverse (Nordic) Leg Curl');
    expect(t.exercises[0].oneRM[0]).toBe('(never logged) = bodyweight 220 × 100% moved = 300 lb');
  });

  it('unnamed set lines join the exercise being worked on; other lines are notes', () => {
    const t = trace([
      'Session rebuilt for the program: 2 exercises',
      'Barbell Bench Press: recent sessions’ 1RM 250',
      'set 3: weight 200 lb locked → reps it allows = 7'
    ]);
    expect(t.notes).toEqual(['Session rebuilt for the program: 2 exercises']);
    expect(t.exercises[0].notes[0]).toMatch(/recent sessions/);
    expect(t.exercises[0].sets[0].n).toBe(3);
    expect(t.exercises[0].sets[0].steps[0].label).toBe('Lock');
  });

  it('reads "× 8" in a set’s header as "8 reps"', () => {
    const t = trace(['Barbell Bench Press set 2 Working · RIR 2 × 8: 250 ÷ (1 + (8 + 2 − 1) ÷ 30) = 192.31 → 192.5 lb']);
    expect(t.exercises[0].sets[0].steps[0].text.startsWith('RIR 2 · 8 reps: ')).toBe(true);
    expect(t.exercises[0].sets[0].steps[0].label).toBe('Weight from 1RM');
  });
});

describe('set headline', () => {
  it('is the last weight, × reps when they were worked out after it', () => {
    expect(setFinal({ steps: [{ label: 'Scheme default', result: '41.25 lb' }, { label: 'Reps from load', result: '9' }] })).toBe('41.25 lb × 9 reps');
    expect(setFinal({ steps: [{ label: 'Reps from load', result: '9' }, { label: 'Weight from 1RM', result: '103.75 lb' }] })).toBe('103.75 lb');
    expect(setFinal({ steps: [] })).toBe('');
  });
});

describe('step labels', () => {
  it('names each kind of line', () => {
    expect(stepLabel('50% of the first working weight 103.85 → 52.5 lb × 8')).toBe('Warm-up ramp');
    expect(stepLabel('RIR 2 × 8: 135 ÷ (1 + (8 + 2 − 1) ÷ 30) = 103.85 → 103.75 lb')).toBe('Weight from 1RM');
    expect(stepLabel('200 lb removed; its RIR 2 kept')).toBe('Routine');
    expect(stepLabel('bodyweight 220 lb')).toBe('Bodyweight');
  });
});
