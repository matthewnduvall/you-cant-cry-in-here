import { describe, it, expect } from 'vitest';
import { findLoggedCycles, reviewCycle, previousCycle } from '../app/utils/programCycles';

const day = (y, m, d) => new Date(y, m - 1, d, 18).toISOString();
let n = 0;
const workout = (startedAt, week, dayId = 'A', sets = []) => ({
  id: `w${(n += 1)}`,
  startedAt,
  program: 'society',
  programWeek: `Week ${week}`,
  programDay: dayId,
  slots: [{ id: `s${n}`, category: 'Compound', exerciseId: 'barbell_bench_press', sets }]
});
const set = (extra = {}) => ({ type: 'Working', weight: 185, reps: 6, completed: true, ...extra });

describe('logged program cycles', () => {
  it('splits sessions into cycles when the week goes back, newest first', () => {
    const history = [
      workout(day(2026, 10, 5), 1),
      workout(day(2026, 10, 12), 2),
      workout(day(2026, 10, 19), 3),
      workout(day(2026, 10, 26), 4),
      workout(day(2026, 11, 2), 1),
      workout(day(2026, 11, 9), 2),
      { id: 'crying', startedAt: day(2026, 11, 10), slots: [] }
    ];
    const cycles = findLoggedCycles(history);
    expect(cycles).toHaveLength(2);
    expect(cycles[0]).toMatchObject({ programId: 'society', weeks: [1, 2], complete: false });
    expect(cycles[1]).toMatchObject({ weeks: [1, 2, 3, 4], complete: true });
    expect(cycles[1].sessions.map(s => s.week)).toEqual([1, 2, 3, 4]);
    expect(cycles[1].sessions[0].dayName).toBe('Monday & Tuesday');
    expect(previousCycle(cycles, cycles[0])).toBe(cycles[1]);
    expect(previousCycle(cycles, cycles[1])).toBeNull();
  });

  it('a long gap starts a new cycle even without the week going back', () => {
    const cycles = findLoggedCycles([workout(day(2026, 1, 5), 1), workout(day(2026, 6, 1), 2)]);
    expect(cycles).toHaveLength(2);
  });

  it('reviews a cycle week by week: planned vs done, and effort against the plan', () => {
    const history = [
      workout(day(2026, 10, 5), 1, 'A', [
        set({ plan: { weight: 185, reps: 6, rir: 6 } }),
        set({ reps: 5, plan: { weight: 185, reps: 6, rir: 6 } }),
        set({ type: 'Warmup', plan: { weight: 95, reps: 6 } })
      ]),
      workout(day(2026, 10, 12), 2, 'A', [
        set({ plannedRir: 3, lockIntensity: true, intensity: { mode: 'rir', value: 1 } }),
        set({ plannedRir: 3, lockIntensity: true, intensity: { mode: 'rpe', value: 8 } })
      ])
    ];
    const [cycle] = findLoggedCycles(history);
    const [w1, w2] = reviewCycle(cycle);
    expect(w1).toMatchObject({ week: 1, sessions: 1, sets: 2, planned: 2, asPlanned: 1, fewerReps: 1, rirGap: null });
    // reported RIR 1 and 2 against a planned 3: on average 1.5 harder
    expect(w2).toMatchObject({ week: 2, rated: 2, rirGap: -1.5 });
  });
});
