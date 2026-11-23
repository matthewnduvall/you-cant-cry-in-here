// ============================================================================
// Logged program cycles: the sessions you logged under a program, split into cycles (week 1 → its last week), so a
// cycle can be saved as a program of your own (SAVE AS PROGRAM: what was actually done, edits included, week by week)
// and reviewed week by week (planned vs done), against the cycle before it.
// Pure: no React, no app state.
// ============================================================================

import { getProgram, getProgramDay, getWorkoutProgramInfo, parseProgramWeek, isCustomProgramId, DEFAULT_PROGRAM_ID } from '../data/programs';
import { workoutTimeMs, normalizeSetType } from './workoutEngine';
import { isSupersetCategory } from '../data/exerciseLibrary';
import { intensityToRir } from './intensity';

/**
 * The cycles logged under each program, newest first:
 * [{ id, programId, programLabel, startMs, endMs, sessions: [{ workout, week, dayId, dayName }], weeks: [1, 2, …],
 *    cycleWeeks, complete }]
 * A cycle starts at the first session of a program and again whenever the week number goes back (week 4 → week 1),
 * or after a gap of more than two cycles' worth of weeks. Sessions without a readable week are left out.
 */
export const findLoggedCycles = (history = []) => {
  const byProgram = new Map();
  (history || []).forEach(w => {
    if (!w || w.loadedRoutineTitle === 'PERSONAL RECORD') return;
    const info = getWorkoutProgramInfo(w);
    if (!info?.program || info.program === DEFAULT_PROGRAM_ID || isCustomProgramId(info.program)) return;
    const program = getProgram(info.program);
    if (program.id !== info.program || !program.cycleWeeks) return;
    const week = parseProgramWeek(info.programWeek, program);
    const t = workoutTimeMs(w);
    if (!week || !t) return;
    if (!byProgram.has(program.id)) byProgram.set(program.id, []);
    byProgram.get(program.id).push({ workout: w, week, t, dayId: info.programDay || null });
  });

  const cycles = [];
  byProgram.forEach((entries, programId) => {
    const program = getProgram(programId);
    const maxGapMs = (program.cycleWeeks || 4) * 2 * 7 * 24 * 60 * 60 * 1000;
    entries.sort((a, b) => a.t - b.t);
    let current = null;
    entries.forEach(e => {
      const last = current?.sessions[current.sessions.length - 1];
      const startsNew = !current || e.week < last.week || e.t - last.t > maxGapMs;
      if (startsNew) {
        current = { programId, sessions: [] };
        cycles.push(current);
      }
      const day = e.dayId ? getProgramDay(program, e.dayId) : null;
      current.sessions.push({ workout: e.workout, week: e.week, t: e.t, dayId: e.dayId, dayName: day?.name || null });
    });
  });

  return cycles
    .map(c => {
      const program = getProgram(c.programId);
      const weeks = [...new Set(c.sessions.map(s => s.week))].sort((a, b) => a - b);
      const startMs = c.sessions[0].t;
      const endMs = c.sessions[c.sessions.length - 1].t;
      return {
        id: `${c.programId}_${startMs}`,
        programId: c.programId,
        programLabel: program.label,
        startMs,
        endMs,
        sessions: c.sessions.map(({ t, ...s }) => s),
        weeks,
        cycleWeeks: program.cycleWeeks,
        complete: weeks.includes(1) && weeks.includes(program.cycleWeeks)
      };
    })
    .sort((a, b) => b.startMs - a.startMs);
};

// Every done working set in a workout (warm-ups and timed sets left out), with its exercise
const doneWorkingSets = workout => {
  const out = [];
  (workout?.slots || []).forEach(slot => {
    const lists =
      isSupersetCategory(slot?.category) && Array.isArray(slot?.supersetSetsByExercise)
        ? slot.supersetSetsByExercise.map((list, i) => ({ list, exId: (slot.supersetExerciseIds || [])[i] || slot.exerciseId }))
        : [{ list: slot?.sets || [], exId: slot?.exerciseId }];
    lists.forEach(({ list, exId }) =>
      (list || []).forEach(st => {
        if (!st?.completed || st.durationSeconds || normalizeSetType(st.type) === 'Warmup') return;
        out.push({ st, exId });
      })
    );
  });
  return out;
};

/**
 * A cycle week by week: [{ week, sessions, sets, planned, asPlanned, moreReps, fewerReps, rated, rirGap }]
 * - planned: done working sets that kept the app's plan (set.plan, live sessions since 2026/11); asPlanned / moreReps /
 *   fewerReps count them (same weight and reps / more reps / fewer reps than planned).
 * - rated: sets whose effort was entered by hand with the planned effort known (set.plannedRir); rirGap = the average
 *   of reported − planned RIR (negative = harder than planned, positive = easier). null when there are none.
 */
export const reviewCycle = cycle => {
  const weeks = new Map();
  (cycle?.sessions || []).forEach(s => {
    if (!weeks.has(s.week)) weeks.set(s.week, { week: s.week, sessions: 0, sets: 0, planned: 0, asPlanned: 0, moreReps: 0, fewerReps: 0, rated: 0, gapSum: 0 });
    const row = weeks.get(s.week);
    row.sessions += 1;
    doneWorkingSets(s.workout).forEach(({ st, exId }) => {
      row.sets += 1;
      if (st.plan) {
        row.planned += 1;
        const dr = Number(st.reps) - Number(st.plan.reps);
        const dw = Number(st.weight) - Number(st.plan.weight);
        if (dr === 0 && Math.abs(dw) < 0.01) row.asPlanned += 1;
        if (dr > 0) row.moreReps += 1;
        if (dr < 0) row.fewerReps += 1;
      }
      const reported = st.lockIntensity && st.intensity && !st.intensity.auto ? intensityToRir(st.intensity, st.reps, exId) : null;
      if (reported !== null && Number.isFinite(Number(st.plannedRir))) {
        row.rated += 1;
        row.gapSum += reported - Number(st.plannedRir);
      }
    });
  });
  return [...weeks.values()]
    .sort((a, b) => a.week - b.week)
    .map(({ gapSum, ...row }) => ({ ...row, rirGap: row.rated > 0 ? Math.round((gapSum / row.rated) * 10) / 10 : null }));
};

/** The cycle logged before this one under the same program (for comparing), or null. */
export const previousCycle = (cycles = [], cycle) =>
  (cycles || []).filter(c => c.programId === cycle?.programId && c.startMs < cycle.startMs).sort((a, b) => b.startMs - a.startMs)[0] || null;

/**
 * Loading routine `index` of one of your programs: which cycle it belongs to. A new cycle starts the first time the
 * program is used and each time its first routine is loaded after another one (repeating the first routine stays in
 * the same cycle). Returns { patch } for the program (cycleStartMs, cycle, lastIndex) and { programCycle } for the
 * routine — { startMs }, or null when the program's CYCLE INCREMENT is off.
 */
export function programCycleLoad(program, index) {
  const newCycle = !program?.cycleStartMs || (index === 0 && program.lastIndex !== 0);
  const startMs = newCycle ? Date.now() : program.cycleStartMs;
  return {
    patch: { cycleStartMs: startMs, cycle: (Number(program?.cycle) || 0) + (newCycle ? 1 : 0), lastIndex: index },
    programCycle: program?.cycleIncrement === false ? null : { startMs }
  };
}
