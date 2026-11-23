// ============================================================================
// Program builder grid (Programs page → one of your programs, COACH): weeks down, days across, one routine per cell.
// Week 1 is written once; every later week is week 1 with that week's rule applied (WEEK RULES: an effort change in
// RIR, and optionally the reps and the number of working sets), unless a cell has a routine of its own. Editing
// week 1 therefore carries through every week that follows it.
//
// Stored on the program (settings.routinePlaylists[i].grid):
//   { weeks, days: [{ id, name }], cells: { 'w:d': savedRoutines key }, weekRules: { [week]: { rir, reps, sets } } }
// The program plays its cells in order (week 1 day 1, week 1 day 2, … week 2 day 1 …): gridItems() turns them into
// routines with keys `grid_<week>_<dayId>`, which UP NEXT, START NEXT and the cycle increment use like any program's.
// Pure: no React, no app state.
// ============================================================================

import { normalizeSetType } from './workoutEngine';
import { SET_TYPE_RIR, intensityToRir } from './intensity';
import { stripDateFromTitle } from '../data/exerciseLibrary';

export const GRID_MAX_WEEKS = 12;
export const GRID_MAX_DAYS = 7;
const DAY_LETTERS = 'ABCDEFG';

export const newGrid = (weeks = 4, dayCount = 3) => ({
  weeks,
  days: Array.from({ length: dayCount }, (_, i) => ({ id: DAY_LETTERS[i], name: `Day ${DAY_LETTERS[i]}` })),
  cells: {},
  weekRules: {}
});

export const cellKey = (week, dayId) => `${week}:${dayId}`;

/** The grid with weeks / days added or removed (cells and rules outside it are dropped). */
export const resizeGrid = (grid, { weeks = grid.weeks, dayCount = grid.days.length } = {}) => {
  const w = Math.min(GRID_MAX_WEEKS, Math.max(1, weeks));
  const n = Math.min(GRID_MAX_DAYS, Math.max(1, dayCount));
  const days = Array.from({ length: n }, (_, i) => grid.days[i] || { id: DAY_LETTERS[i], name: `Day ${DAY_LETTERS[i]}` });
  const ids = new Set(days.map(d => d.id));
  const cells = Object.fromEntries(
    Object.entries(grid.cells || {}).filter(([k]) => {
      const [wk, d] = k.split(':');
      return Number(wk) <= w && ids.has(d);
    })
  );
  const weekRules = Object.fromEntries(Object.entries(grid.weekRules || {}).filter(([wk]) => Number(wk) <= w));
  return { ...grid, weeks: w, days, cells, weekRules };
};

/** A week's rule, filled in: { rir: change in reps in reserve (0 = same), reps: number | null, sets: number | null } */
export const weekRuleOf = (grid, week) => {
  const r = grid?.weekRules?.[week] || {};
  return {
    rir: Number.isFinite(Number(r.rir)) ? Number(r.rir) : 0,
    reps: Number(r.reps) > 0 ? Number(r.reps) : null,
    sets: Number(r.sets) > 0 ? Number(r.sets) : null
  };
};
export const isPlainRule = rule => !rule || (rule.rir === 0 && !rule.reps && !rule.sets);

/** "−1 RIR · 5 reps · 4 sets", or "Same as week 1". */
export const describeWeekRule = rule => {
  if (isPlainRule(rule)) return 'Same as week 1';
  const parts = [];
  if (rule.rir) parts.push(`${rule.rir > 0 ? '+' : '−'}${Math.abs(rule.rir)} RIR`);
  if (rule.reps) parts.push(`${rule.reps} reps`);
  if (rule.sets) parts.push(`${rule.sets} sets`);
  return parts.join(' · ');
};

const isTimedSet = st => Number(st?.durationSeconds) > 0;
const isWarmup = st => normalizeSetType(st?.type) === 'Warmup';

// One exercise's sets with a week rule: effort moves by `rir` (reps in reserve; harder = fewer), the working sets'
// reps become `reps`, and the working sets number `sets` (extra ones copy the last; fewer drop from the end).
const ruleSets = (list, rule, exId) => {
  let sets = (list || []).map(st => {
    if (!st || isWarmup(st)) return st;
    const next = { ...st };
    if (rule.reps && !isTimedSet(st)) next.reps = rule.reps;
    if (rule.rir && !isTimedSet(st)) {
      const type = normalizeSetType(st.type);
      const base =
        st.intensity && st.intensity.value !== null && st.intensity.value !== undefined && st.intensity.value !== ''
          ? intensityToRir(st.intensity, st.reps, exId)
          : SET_TYPE_RIR[type] ?? 2;
      if (type !== '1 Rep Max' && Number.isFinite(base)) {
        next.intensity = { mode: 'rir', value: Math.max(0, Math.round((base + rule.rir) * 2) / 2) };
        next.lockIntensity = true;
      }
    }
    return next;
  });
  if (rule.sets) {
    const warmups = sets.filter(isWarmup);
    let work = sets.filter(st => st && !isWarmup(st));
    if (work.length > rule.sets) work = work.slice(0, rule.sets);
    while (work.length > 0 && work.length < rule.sets) {
      const last = work[work.length - 1];
      work = [...work, { ...last, id: `${last.id || 'set'}_r${work.length}`, completed: false }];
    }
    sets = [...warmups, ...work].map((st, i) => ({ ...st, setNumber: i + 1 }));
  }
  return sets;
};

/** A routine with a week rule applied to every exercise (supersets: each half). */
export const applyWeekRule = (routine, rule) => {
  if (!routine || isPlainRule(rule)) return routine;
  return {
    ...routine,
    slots: (routine.slots || []).map(slot => {
      if (!slot) return slot;
      const next = { ...slot };
      if (Array.isArray(slot.supersetSetsByExercise)) {
        const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
        next.supersetSetsByExercise = slot.supersetSetsByExercise.map((list, i) => ruleSets(list, rule, ids[i]));
      }
      if (Array.isArray(slot.sets)) next.sets = ruleSets(slot.sets, rule, slot.exerciseId);
      if (Array.isArray(slot.secondarySets)) next.secondarySets = ruleSets(slot.secondarySets, rule, slot.secondaryExerciseId);
      return next;
    })
  };
};

/**
 * A cell's routine: its own (a saved routine in that cell), else week 1's for that day with the week's rule; null
 * when neither exists. { routine, source: 'own' | 'rule' | null }
 */
export const cellRoutine = (grid, week, dayId, savedRoutines = []) => {
  const byKey = new Map((savedRoutines || []).map(r => [r.key, r]));
  const own = byKey.get(grid?.cells?.[cellKey(week, dayId)]);
  if (own) return { routine: own, source: 'own' };
  if (week > 1) {
    const base = byKey.get(grid?.cells?.[cellKey(1, dayId)]);
    if (base) return { routine: applyWeekRule(base, weekRuleOf(grid, week)), source: 'rule' };
  }
  return { routine: null, source: null };
};

/**
 * The program's routines in play order (week by week, day by day; empty cells skipped), each as a routine to load:
 * key `grid_<week>_<dayId>`, label `<routine> · Week n`, gridWeek, gridDay.
 */
export const gridItems = (grid, savedRoutines = []) => {
  if (!grid) return [];
  const out = [];
  for (let week = 1; week <= grid.weeks; week += 1) {
    (grid.days || []).forEach(day => {
      const { routine, source } = cellRoutine(grid, week, day.id, savedRoutines);
      if (!routine) return;
      const name = stripDateFromTitle(routine.label) || routine.label || 'Routine';
      out.push({
        ...routine,
        key: `grid_${week}_${day.id}`,
        sourceKey: routine.key,
        label: `${name} · Week ${week}`,
        gridWeek: week,
        gridDay: day.id,
        gridSource: source
      });
    });
  }
  return out;
};
