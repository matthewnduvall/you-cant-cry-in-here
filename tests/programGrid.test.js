import { describe, it, expect } from 'vitest';
import { newGrid, resizeGrid, cellKey, cellRoutine, gridItems, applyWeekRule, weekRuleOf, describeWeekRule } from '../app/utils/programGrid';

const set = (type, reps, extra = {}) => ({ id: `${type}_${reps}_${Math.random()}`, type, reps, weight: 0, ...extra });
const routine = (key, label) => ({
  key,
  label,
  slots: [
    {
      id: `${key}_s`,
      category: 'Compound',
      exerciseId: 'barbell_bench_press',
      sets: [set('Warmup', 8), set('Working', 8, { intensity: { mode: 'rir', value: 3 } }), set('Working', 8)]
    }
  ]
});
const saved = [routine('rA', 'Push'), routine('rB', 'Pull'), routine('rX', 'Deload push')];

describe('program grid', () => {
  it('plays week by week, day by day; later weeks repeat week 1 unless a cell has its own routine', () => {
    let grid = newGrid(3, 2);
    grid = { ...grid, cells: { [cellKey(1, 'A')]: 'rA', [cellKey(1, 'B')]: 'rB', [cellKey(3, 'A')]: 'rX' } };
    const items = gridItems(grid, saved);
    expect(items.map(i => `${i.gridWeek}${i.gridDay}:${i.sourceKey}:${i.gridSource}`)).toEqual([
      '1A:rA:own',
      '1B:rB:own',
      '2A:rA:rule',
      '2B:rB:rule',
      '3A:rX:own',
      '3B:rB:rule'
    ]);
    expect(items[2]).toMatchObject({ key: 'grid_2_A', label: 'Push · Week 2' });
  });

  it('a week rule moves effort, reps and the number of working sets; warm-ups stay', () => {
    const r = applyWeekRule(routine('rA', 'Push'), { rir: -1, reps: 5, sets: 3 });
    const sets = r.slots[0].sets;
    expect(sets).toHaveLength(4); // 1 warm-up + 3 working
    expect(sets[0]).toMatchObject({ type: 'Warmup', reps: 8 });
    expect(sets[1]).toMatchObject({ reps: 5, intensity: { mode: 'rir', value: 2 }, lockIntensity: true });
    // no intensity of its own: the Working type's RIR 2, one harder
    expect(sets[2].intensity).toEqual({ mode: 'rir', value: 1 });
    expect(sets[3].reps).toBe(5);
  });

  it('rules are read with defaults and described', () => {
    const grid = { ...newGrid(), weekRules: { 2: { rir: -1, reps: 5 } } };
    expect(weekRuleOf(grid, 2)).toEqual({ rir: -1, reps: 5, sets: null });
    expect(describeWeekRule(weekRuleOf(grid, 2))).toBe('−1 RIR · 5 reps');
    expect(describeWeekRule(weekRuleOf(grid, 3))).toBe('Same as week 1');
    expect(cellRoutine(grid, 2, 'A', saved).routine).toBeNull();
  });

  it('resizing drops cells and rules outside the grid', () => {
    const grid = { ...newGrid(4, 3), cells: { '4:C': 'rA', '1:A': 'rA' }, weekRules: { 4: { rir: -2 } } };
    const smaller = resizeGrid(grid, { weeks: 3, dayCount: 2 });
    expect(smaller.cells).toEqual({ '1:A': 'rA' });
    expect(smaller.weekRules).toEqual({});
    expect(smaller.days.map(d => d.id)).toEqual(['A', 'B']);
  });
});
