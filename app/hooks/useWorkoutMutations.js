'use client';

import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  getExerciseEquipmentOptions,
  normalizeSlotCategory,
  isSupersetCategory,
  isClusterCategory,
  isBodyweightExercise,
  inferRoutineGymCategory,
  getDefaultSessionName,
  getDefaultAutoSessionName,
  formatTitleWithDate,
  stripDateFromTitle,
  parseYMDToISO,
  formatTodayYMD,
  findEquivalentExerciseForGym,
  convertEquivalent1RM,
  getFilteredExercisesForSlotInline,
  getAvailableMuscleGroupsForCategory,
  roundTo5,
  roundToIncrement,
  CORE_PR_EXERCISE_IDS,
  isExerciseAvailableWithEquipment,
  findEquivalentExerciseForEquipment,
  getSlotEquipmentChoice,
  isBandEquipment,
  doesExerciseInteractWithMuscleGroup,
  REGION_GROUP
} from '../data/exerciseLibrary';
import {
  getBestHistory1RM,
  getHistoricalCalculated1RM as getHistoricalCalculated1RMRaw,
  calculateLastEquivalentWeightForSet,
  calculateEquivalentRepsForWeight,
  getEffectiveIncrementForExercise,
  SCHEME_OPTIONS,
  restFatigueFactor,
  plannedRestSeconds,
  setRestSeconds,
  progressionIncrement,
  lastSessionEffortGap,
  setReportedRir,
  createWorkoutSlot as createWorkoutSlotRaw,
  generateSetsForScheme,
  getDefaultSchemeForGoal,
  getDefaultSchemeForExercise,
  isTimedHoldExercise,
  CLUSTER_SCHEME,
  CLUSTER_REST_SECONDS,
  getSupersetSchemes,
  normalizeSlotLabels,
  buildPresetSlots,
  checkIsWorkoutComplete,
  cloneSlots,
  parseTimerDurationSeconds,
  formatSecondsToMMSS,
  applyGoalProgressToSets,
  GOAL_PROGRESS_SCHEMES,
  SUPERSET_SET_COUNT,
  getTargetRepsForSet,
  trimSetsTo,
  normalizeSetType,
  lockAndCompleteSets,
  keepCompletedSets,
  asHistoricalWorkout,
  findIntensityMismatches,
  toAddedWeights,
  workoutTimeMs,
  countsBodyweight,
  setLoadLbs,
  snapSlotToPlates,
  fatigueRateFor,
  exercise1RMInfoOfSets,
  withEffectiveLoad,
  getExerciseBodyweightLoad,
  priorHardSets,
  warmupRamp,
  getLastSession1RM,
  detectStall,
  DELOAD_SHARE
} from '../utils/workoutEngine';
import { deleteCloudRoutineByKey, deleteCloudWorkoutsByIds, postSyncHistoryUpdate } from '../utils/supabaseAuth';
import {
  withProgramInfo,
  getWorkoutProgramInfo,
  calendarWeekIndex,
  getProgram,
  getProgramContext,
  getSlotSpecExercise,
  hasProgramDays,
  BIG3_IDS,
  isBig3Variant
} from '../data/programs';
import { applyProgramToSlot, isProgrammedSlot, fitsProgramEquipment, solveBodyweightSet } from '../utils/programEngine';
import { SET_TYPE_RIR, solveSet, deriveIntensity, weightForIntensity, repsForIntensity, intensityToRir, formatIntensity, repsToFailure, repCurveFor, DEFAULT_INTENSITY_MODE, plannedRirForSet, EFFORT_PLANNED_SCHEMES } from '../utils/intensity';
import { getStarting1RM, describe1RM, getLiftFamilyParent } from '../utils/starting1RM';
import { withTrace, traceLine, traceTitle, isTracing, fmt, logOperation } from '../utils/calcTrace';
import { buildHistoryUpdate, findAddedSlots, getWorkoutSyncInfo, withSyncInfo } from '../utils/syncedHistory';
import { markWorkoutIdDeleted, clearDeletedWorkoutIds } from '../utils/cloudSyncLedger';

// ---------------------------------------------------------------------------
// Auto-pick scoring (+ ADD EXERCISE and AUTO SESSION). Score ≈ "days this muscle group is behind",
// weighted by how much the group matters, plus a bonus for the Big 3 + OHP on compound picks.
// ---------------------------------------------------------------------------
// A set type's weight and reps from the exercise's working set (weight, reps): used by the set type dropdown and by
// RECALCULATE for type-locked sets. Warm-up = same reps, lighter (warm-up effort 0.74 vs working 0.98);
// Top Out = same reps, heavier (1.04 vs 0.98); Burn Out = the working weight, 2 more reps.
const setTypeTarget = (type, refWeight, refReps) =>
  ({
    Working: [refWeight, refReps],
    Warmup: [refWeight * (0.74 / 0.98), refReps],
    'Top Out': [refWeight * (1.04 / 0.98), refReps],
    'Burn Out': [refWeight, refReps + 2]
  })[type] || [refWeight, refReps];

const STIMULUS_DAYS_CAP = 14; // unlogged / very stale groups count as this many days behind
const BIG4_BONUS_DAYS = 6; // Big 3 + OHP win unless their muscles were trained much more recently
const SAME_WORKOUT_PENALTY_DAYS = 10; // avoid hitting the same muscle group twice in one workout
const MUSCLE_GROUP_WEIGHT = {
  Chest: 1,
  Back: 1,
  Thighs: 1,
  Shoulders: 1,
  Hips: 0.9,
  'Upper Arms': 0.8,
  Core: 0.6,
  Calves: 0.5,
  Forearms: 0.4,
  Neck: 0.25
};
// The same by muscle region (the stimulus score uses the exercise's main region): smaller muscles that big lifts
// already train count less, so + ADD EXERCISE doesn't chase every small region
const REGION_WEIGHT = {
  Chest: 1, Lats: 1, Quads: 1, Hamstrings: 0.9, Glutes: 0.9, 'Upper Back': 0.8, 'Front Delts': 0.7, 'Side Delts': 0.7,
  'Rear Delts': 0.6, Biceps: 0.7, Triceps: 0.7, 'Lower Back': 0.5, Abs: 0.6, Obliques: 0.4, Adductors: 0.4, Calves: 0.5,
  Forearms: 0.35, Neck: 0.25
};
const NON_TRAINING_EQUIPMENT = ['stretch', 'isometric'];

// RESET snapshot: each exercise remembers how it was when it was loaded (added, picked, or swapped to another
// exercise, or re-planned for another program week / day), as slot.resetSnapshot = { key, slot }. Taken from the state just before the first change to it, or from
// the new slot when it is new or its exercise changed. Never saved to History or routines.
// The key: the exercise(s) and the session's program / week / day (a change of either re-plans it: a new start)
const resetKeyOf = (slot, workout) =>
  [(slot?.supersetExerciseIds || [slot?.exerciseId]).filter(Boolean).join('+'), workout?.program || '', workout?.programWeek || '', workout?.programDay || ''].join('|');
export const withoutResetSnapshot = slot => {
  if (!slot || !slot.resetSnapshot) return slot;
  const { resetSnapshot: _rs, ...rest } = slot;
  return rest;
};
const withResetSnapshots = (prevWorkout, nextWorkout) => {
  if (!nextWorkout || !Array.isArray(nextWorkout.slots)) return nextWorkout;
  const prevById = new Map((prevWorkout?.slots || []).filter(Boolean).map(sl => [sl.id, sl]));
  let changed = false;
  const slots = nextWorkout.slots.map(sl => {
    if (!sl) return sl;
    const key = resetKeyOf(sl, nextWorkout);
    if (sl.resetSnapshot?.key === key) return sl;
    const before = prevById.get(sl.id);
    const base = before && resetKeyOf(before, prevWorkout) === key ? before : sl;
    changed = true;
    return { ...sl, resetSnapshot: { key, slot: withoutResetSnapshot(base) } };
  });
  return changed ? { ...nextWorkout, slots } : nextWorkout;
};

export function useWorkoutMutations({
  currentView,
  setCurrentView,
  user,
  history,
  setHistory,
  oneRepMaxes,
  setOneRepMaxes,
  activeSession,
  setActiveSession,
  historicalDraft,
  setHistoricalDraft,
  routineDraft,
  setRoutineDraft,
  previewRoutineDraft,
  setPreviewRoutineDraft,
  routineSelectReturnView,
  setRoutineSelectReturnView,
  isCurrentEditorShared,
  // Privacy → SHARING DEFAULTS: what the finish / save pop-up starts with
  shareDefaults = null,
  setIsCurrentEditorShared,
  expandedHistoryWorkoutId,
  setExpandedHistoryWorkoutId,
  setConfirmedHistoryEditWorkoutId,
  // An open History workout's unsaved edits ({ ...workout } with the same id); SAVE writes it to History
  historyEditDraft = null,
  setHistoryEditDraft,
  historicalEditConfirmTarget,
  setHistoricalEditConfirmTarget,
  deleteConfirmTarget,
  setDeleteConfirmTarget,
  setSaveConfirmTarget,
  setOpenedFromRoutines,
  selectedGymId,
  setSelectedGymId,
  gyms,
  routinePreferences,
  // Exercise Set Preferences: set types by position for new exercises (uniform rep schemes)
  setPreferences,
  currentIncrementLbs,
  userBodyweightLbs = 220,
  shareRoutinesWithFriends,
  // Saved routines: a finished session updates the one it was loaded from (matched by key, never by name)
  savedRoutines = [],
  setSavedRoutines,
  setSharedRoutines,
  setTimerTrigger,
  appendSessionLog,
  // { [muscleGroup]: { daysAgo } } from useTelemetryAndAnalytics — drives which muscles are "behind"
  muscleStimulusStatus = {},
  // the Equipment page list (null = everything); drives every exercise picked for the athlete
  availableEquipment = null,
  // Training goal: sets the default scheme of new exercises (Strength 5x5, Balanced 5x8, Hypertrophy 5x10, Maintain 5x8)
  goalType = 'Balanced',
  // Synced session, friend's tab open: the friend's session (your structure + their numbers). The editor shows and
  // edits it; every change goes to onEditPartnerSession(nextSession) instead of your own session.
  partnerSession = null,
  onEditPartnerSession,
  // Training program (app/data/programs.js) and when its cycle began: a program with a week plan (Society) sets the
  // scheme, sets, intensity and weights of the exercises it covers (utils/programEngine.js)
  trainingProgram = 'crying',
  programCycleStart = null,
  // The athlete's training weekdays per program (a 'weekday' program's days follow them)
  programSchedules = null,
  // Crying's Variety 0–10 (5 = default): how much the exercise picks change from session to session
  cryingVariety = 5,
  // For exercises never logged (utils/starting1RM.js): the goal's strength class (one class below is the start)
  // and height
  targetStandardClass = 'Novice',
  heightInches = 70
}) {
  // An exercise's 1RM: its own History, else the starting 1RM (a related logged lift, else the strength standard one
  // class below the goal) — never the bare library default
  const startOpts = { history, targetStandardClass, bodyweightLbs: userBodyweightLbs, heightInches };
  const getHistoricalCalculated1RM = (id, hist = history, orms = oneRepMaxes) =>
    getBestHistory1RM(id, hist) > 0 ? getHistoricalCalculated1RMRaw(id, hist, orms, getCurrentEditorWorkout()?.id || null) : getStarting1RM(id, { ...startOpts, history: hist });
  // New exercises start from the same 1RM (createWorkoutSlot uses base1RMOverrides only when there is no History)
  const createWorkoutSlot = args => {
    const ids = (args.supersetExerciseIds || [args.exerciseId, args.secondaryExerciseId]).filter(Boolean);
    const starts = {};
    ids.forEach(id => {
      if (getBestHistory1RM(id, history) <= 0) starts[id] = getStarting1RM(id, startOpts);
      if (isTracing()) {
        traceLine(`Exercise: ${EXERCISE_MAP[id]?.name || id} · ${args.category} · scheme ${args.scheme}`);
        traceLine(describe1RM(id, startOpts));
      }
    });
    return fillIntensities(
      planEffort(
        // Bodyweight-type exercises store what is added (0 / the plate), not the total load
        toAddedWeights(createWorkoutSlotRaw({ ...args, base1RMOverrides: { ...starts, ...(args.base1RMOverrides || {}) } }))
      ),
      getCurrentEditorWorkout()
    );
  };

  // Programs that use intensity: every set shows one, and it is always TRUE TO YOU. An unlocked intensity is worked
  // out from the set's real load (setLoadLbs: bodyweight counted, + the added weight, − a band) and reps against your
  // calculated 1RM — so a program's "8 reps at RIR 6" that is easier or harder for you shows the RIR you'd really
  // have left (it can go past 10). A set asking more reps than the load allows drops to the most it allows (RIR 0),
  // unless its reps are locked. Locked intensities are targets (an intensity applied by hand locks): they set the
  // weight / reps instead and are left alone here; so are completed and timed sets. Run after every planning step
  // (new exercises, programs, RECALCULATE, set type / count / reps changes, weight / reps edits).
  const intensityOn = workout => getProgram(workout?.program || trainingProgram).usesIntensity;

  // Planning by effort (Exercise Set Preferences → set types → RIR, plannedRirForSet in utils/intensity.js): on the
  // uniform rep schemes (EFFORT_PLANNED_SCHEMES) every set not done is planned at its type's effort from the calculated
  // 1RM — weight = 1RM ÷ (1 + (reps + RIR − 1) ÷ 30). Where the load can't move (bodyweight, a band, a locked weight)
  // the reps follow instead (reps to failure − RIR); Weighted bodyweight exercises get the added weight. Locked
  // intensities are left to solveSet; locked reps / weights stay. Programs' own plans (programSlot) replace this for
  // the exercises they cover. `onlySetId`: just that set (a set type change). Slots store added weights.
  // The 1RM sets are planned and judged against, in every program: you're assumed capable of what you did last time
  // plus your goal increment — last session's 1RM of the exercise (loggedExercise1RMInfo, the workout being edited
  // left out) + the increment; never logged = the starting estimate as it is. Programs plan from the same number
  // (getCycleTarget1RM), so their planned RIR reads true.
  // (smoothed over the last three sessions, getLastSession1RM; the increment scaled to the lift)
  const effort1RM = (exId, option, workout) => {
    const calc = getHistoricalCalculated1RM(exId);
    const prev = getLastSession1RM(exId, history, workout?.id || null);
    if (!(prev > 0)) return calc;
    // The learned / scaled increment; none when the last session came in harder than you planned (a hold)
    const inc = progressionIncrement(exId, currentIncrementLbs, prev, history, workout?.id || null);
    if (isTracing() && inc === 0 && currentIncrementLbs > 0) {
      const g = lastSessionEffortGap(exId, history, workout?.id || null);
      traceLine(`${EXERCISE_MAP[exId]?.name || exId}: last session came in ${fmt(-g.gap)} RIR harder than planned → weight held (no increment)`);
    }
    if (isTracing()) traceLine(`${EXERCISE_MAP[exId]?.name || exId}: recent sessions' 1RM ${fmt(prev)} (smoothed) + increment ${fmt(inc)} (learned from your progress, else scaled to the lift) = ${fmt(prev + inc)} lb (what you're planned to be capable of)`);
    return prev + inc;
  };

  // override1RMs: { [half]: 1RM } — plan from this instead (live adjustment: what the sets done so far say)
  function planEffort(slot, onlySetId = null, workoutArg = null, override1RMs = null) {
    if (!slot) return slot;
    const workout = workoutArg || getCurrentEditorWorkout();
    const isSup = Array.isArray(slot.supersetSetsByExercise) && slot.supersetSetsByExercise.length > 1;
    const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
    const schemes = isSup ? getSupersetSchemes(slot) : [slot.scheme];
    const deloadHalves = new Set();
    const plan = (list, exId, half) => {
      const sets = Array.isArray(list) ? list : [];
      if (!EFFORT_PLANNED_SCHEMES.includes(schemes[half])) return sets;
      if (isBodyweightExercise(exId) && !countsBodyweight(exId)) return sets;
      const option = getSlotEquipmentChoice(slot, half);
      const override = Number(override1RMs?.[half]) || 0;
      const true1RM = override > 0 ? override : effort1RM(exId, option, workout);
      if (!(true1RM > 0)) return sets;
      // Stall (no new 1RM in the last 30 days, detectStall): this session is a deload — planned 10 % lighter at the
      // same reps (the intensity, judged against the real 1RM, reads easier); logging it, or SKIP, restarts the count
      const stall = override > 0 || slot.deloadSkipped ? { stalled: false } : detectStall(exId, history, workout?.id || null);
      if (stall.stalled) {
        deloadHalves.add(half);
        if (isTracing()) traceLine(`${EXERCISE_MAP[exId]?.name || exId}: no new 1RM in ${stall.days} days (best before them ${fmt(stall.peak)} lb) → deload: planned from ${Math.round(DELOAD_SHARE * 100)}% of ${fmt(true1RM)} lb`);
      }
      const oneRM = stall.stalled ? true1RM * DELOAD_SHARE : true1RM;
      const bw = countsBodyweight(exId) ? getExerciseBodyweightLoad(exId) : 0;
      const weighted = bw > 0 && /weighted/i.test(String(option || ''));
      const fixedLoad = (bw > 0 && !weighted) || isBandEquipment(option);
      const effInc = getEffectiveIncrementForExercise(exId, currentIncrementLbs);
      const step = effInc > 0 ? Math.min(2.5, effInc) : 2.5;
      const types = sets.map(st => normalizeSetType(st?.type));
      const name = EXERCISE_MAP[exId]?.name || exId;
      // Warm-ups ramp up to the first working set (warmupRamp: 50 → 80 % of its weight, at its reps)
      const firstWorkIdx = types.findIndex(t => t !== 'Warmup');
      const firstWork = firstWorkIdx >= 0 ? sets[firstWorkIdx] : null;
      const workReps = Math.max(1, Number(firstWork?.reps) || 8);
      const workLoad = firstWork ? weightForIntensity(oneRM, workReps, { mode: 'rir', value: plannedRirForSet(types, firstWorkIdx) }, exId) : null;
      const warmIdxs = types.map((t, i) => (t === 'Warmup' ? i : -1)).filter(i => i >= 0);
      const ramp = warmupRamp(warmIdxs.length, workReps);
      return sets.map((st, idx) => {
        if (!st || st.completed || st.lockIntensity || st.durationSeconds) return st;
        if (onlySetId && st.id !== onlySetId) return st;
        if (types[idx] === 'Warmup' && workLoad > 0) {
          const r = ramp[warmIdxs.indexOf(idx)] || { share: 0.65, reps: workReps };
          const reps = st.lockReps ? st.reps : r.reps;
          if (fixedLoad) return { ...st, reps };
          const weight = st.lockWeight ? st.weight : Math.max(0, Math.round((workLoad * r.share - bw) / step) * step);
          if (isTracing()) traceLine(`${name} set ${idx + 1} Warmup: ${Math.round(r.share * 100)}% of the first working weight ${fmt(workLoad)} → ${fmt(weight)} lb × ${reps}`);
          return { ...st, weight, reps };
        }
        const rir = plannedRirForSet(types, idx);
        const effort = { mode: 'rir', value: rir };
        if (types[idx] === '1 Rep Max') {
          return st.lockWeight || fixedLoad ? { ...st, reps: st.lockReps ? st.reps : 1 } : { ...st, reps: st.lockReps ? st.reps : 1, weight: Math.max(0, Math.round((oneRM - bw) / step) * step) };
        }
        if (fixedLoad || (st.lockWeight && !st.lockReps)) {
          if (st.lockReps) return st;
          const load = setLoadLbs(exId, st, option);
          const reps = repsForIntensity(oneRM, load, effort, exId);
          if (reps === null) return st;
          if (isTracing()) traceLine(`${name} set ${idx + 1} ${types[idx]} · RIR ${rir}: load ${fmt(load)} lb → reps to failure ${fmt(repsToFailure(oneRM, load, exId))} − ${rir} = ${reps}`);
          return { ...st, reps };
        }
        if (st.lockWeight) return st;
        const target = weightForIntensity(oneRM, st.reps, effort, exId);
        if (target === null) return st;
        const weight = Math.max(0, Math.round((target - bw) / step) * step);
        if (isTracing()) traceLine(`${name} set ${idx + 1} ${types[idx]} · RIR ${rir} × ${st.reps}: ${fmt(oneRM)} ÷ (1 + (${st.reps} + ${rir} − 1) ÷ ${fmt(repCurveFor(exId))}) = ${fmt(target)}${bw ? ` − bodyweight ${fmt(bw)}` : ''} → ${fmt(weight)} lb`);
        if (weighted && target < bw) {
          // Lighter than bodyweight: nothing added, and the reps follow instead
          const reps = st.lockReps ? st.reps : repsForIntensity(oneRM, bw, effort, exId) ?? st.reps;
          return { ...st, weight: 0, reps };
        }
        return { ...st, weight };
      });
    };
    if (isSup) {
      const matrix = slot.supersetSetsByExercise.map((list, i) => plan(list, ids[i] || slot.exerciseId, i));
      return { ...slot, supersetSetsByExercise: matrix, sets: matrix[0] || [], secondarySets: matrix[1] || [], deload: onlySetId ? slot.deload : deloadHalves.size > 0 };
    }
    const sets = plan(slot.sets, slot.exerciseId, 0);
    // deload: shown on the exercise card and kept with the logged session (detectStall restarts from it)
    return { ...slot, sets, supersetSetsByExercise: [sets], deload: onlySetId ? slot.deload : deloadHalves.size > 0 };
  }

  function fillIntensities(rawSlot, workout, override1RMs = null) {
    if (!rawSlot || !intensityOn(workout)) return rawSlot;
    // Weights snapped to what can be loaded first (plates, dumbbell sizes), so the intensity is the one for the
    // weight actually lifted
    const slot = snapSlotToPlates(rawSlot);
    const isSup = Array.isArray(slot.supersetSetsByExercise) && slot.supersetSetsByExercise.length > 1;
    const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
    const schemes = isSup ? getSupersetSchemes(slot) : [slot.scheme];
    const fit = (list, exId, half) => {
      if (schemes[half] === 'Timer') return list || [];
      // Bodyweight exercises need your bodyweight to know the load
      if (isBodyweightExercise(exId) && !countsBodyweight(exId)) return list || [];
      const option = getSlotEquipmentChoice(slot, half);
      const name = EXERCISE_MAP[exId]?.name || exId;
      // A program's warm-ups are weighed by percentage, not effort: their intensity is shown as %1RM (≈ 55–60 %)
      const override = Number(override1RMs?.[half]) || 0;
      // Never logged: the weights are a first guess, so the intensity isn't known yet ("—" until it is logged, or
      // until sets done today say what it is: live adjustment)
      if (!(override > 0) && !(getBestHistory1RM(exId, history) > 0)) {
        if (isTracing()) traceLine(`${name}: not logged yet, so its intensity isn't known (—)`);
        return (list || []).map(st =>
          !st || st.completed || st.lockIntensity || st.durationSeconds || !st.intensity ? st : { ...st, intensity: null }
        );
      }
      const oneRM = override > 0 ? override : effort1RM(exId, option, workout);
      return (list || []).map((st, idx) => {
        if (!st || st.completed || st.lockIntensity || st.durationSeconds) return st;
        const load = setLoadLbs(exId, st, option);
        const rtf = repsToFailure(oneRM, load, exId);
        if (rtf === null) return st;
        // More reps than the load allows reads as RIR below 0 (the reps are left as planned or typed)
        const next = st;
        // Warm-ups are a share of the working weight: their intensity is a %1RM (RIR means little that far from failure)
        const mode = normalizeSetType(st.type) === 'Warmup' ? 'pct' : st.intensity?.mode || DEFAULT_INTENSITY_MODE;
        // Fatigue: the working sets before this one leave less in reserve at the same weight and reps (shown RIR falls
        // by the allowance per set; the 1RM adds it back, so a set done as shown keeps the 1RM)
        // (scaled by the rest planned before it: restFatigueFactor)
        const fatigueReps =
          normalizeSetType(st.type) === 'Warmup' ? 0 : fatigueRateFor(exId) * priorHardSets(list, idx) * restFatigueFactor(plannedRestSeconds(slot, workout));
        const derived = deriveIntensity(oneRM, load, (Number(next.reps) || 1) + fatigueReps, mode, exId);
        if (!derived) return next;
        const same = st.intensity && st.intensity.mode === derived.mode && Number(st.intensity.value) === Number(derived.value);
        if (!same && isTracing()) {
          traceLine(`${name} set ${idx + 1}: ${fmt(load)} lb × ${next.reps} against 1RM ${fmt(oneRM)} → reps to failure ${fmt(rtf)} → ${formatIntensity(derived.mode, derived.value)}${st.intensity ? ` (was ${formatIntensity(st.intensity.mode, st.intensity.value)})` : ''}`);
        }
        // (it keeps the fatigue allowance it was worked out with: the set's 1RM reads it back, never the rest itself)
        return { ...next, intensity: { ...derived, fatigueReps } };
      });
    };
    if (isSup) {
      const matrix = slot.supersetSetsByExercise.map((list, i) => fit(list, ids[i] || slot.exerciseId, i));
      return { ...slot, supersetSetsByExercise: matrix, sets: matrix[0] || [], secondarySets: matrix[1] || [] };
    }
    const sets = fit(slot.sets, slot.exerciseId, 0);
    return { ...slot, sets, supersetSetsByExercise: [sets] };
  }
  const defaultScheme = getDefaultSchemeForGoal(goalType);
  // The program context of a workout (null = no week plan: the app's usual rules)
  const programContextFor = workout => getProgramContext(trainingProgram, programCycleStart, workout, history, programSchedules);
  // A slot with the workout's program week applied (unchanged when the program doesn't cover it)
  // Bodyweight-type exercises store what is added (0 / the plate), not the total load
  const programSlot = (slot, workout) => fillIntensities(toAddedWeights(programSlotLoads(slot, workout)), workout);
  // A program's own plan replaces the usual effort plan, deload included (Society's cycle sets its own loads), so an
  // exercise the program covers never carries the DELOAD note
  const programSlotLoads = (slot, workout) => {
    const ctx = programContextFor(workout);
    const out = applyProgramToSlot(slot, ctx, {
      history,
      incrementLbs: currentIncrementLbs,
      userBodyweightLbs,
      setPreferences,
      workoutId: workout?.id || null,
      targetStandardClass,
      heightInches
    });
    return out && out.deload && isProgrammedSlot(slot, ctx) ? { ...out, deload: false } : out;
  };
  const isAvailable = ex => isExerciseAvailableWithEquipment(ex, availableEquipment);
  // Default picks prefer exercises the athlete has the equipment for; the full list is the fallback
  const preferAvailable = pool => {
    const available = pool.filter(isAvailable);
    return available.length > 0 ? available : pool;
  };

  const getCurrentEditorWorkout = () => {
    if (currentView === 'historical_entry') return historicalDraft;
    if (currentView === 'routine_editor') return routineDraft;
    if (currentView === 'routine_preview') return previewRoutineDraft;
    if (currentView === 'history_editor' && expandedHistoryWorkoutId) {
      if (historyEditDraft?.id === expandedHistoryWorkoutId) return historyEditDraft;
      return asHistoricalWorkout(history.find(w => w.id === expandedHistoryWorkoutId)) || null;
    }
    if (currentView === 'session' && partnerSession) return partnerSession;
    return activeSession;
  };

  const updateCurrentWorkoutState = rawUpdater => {
    // Every change keeps each exercise's RESET snapshot: how it was when it was loaded (withResetSnapshots)
    const updater = prev => withResetSnapshots(prev, rawUpdater(prev));
    setIsCurrentEditorShared(false);
    // An open History workout: edits go to a draft (historyEditDraft); History changes only on SAVE
    if (currentView === 'history_editor' && expandedHistoryWorkoutId) {
      const targetHistId = expandedHistoryWorkoutId;
      setHistoryEditDraft?.(prev => {
        const base = prev?.id === targetHistId ? prev : asHistoricalWorkout(history.find(w => w.id === targetHistId));
        if (!base) return prev;
        const next = updater(base);
        return next ? { ...next, id: targetHistId, slots: normalizeSlotLabels(next.slots) } : prev;
      });
      return;
    }

    if (currentView === 'historical_entry') {
      setHistoricalDraft(prev => {
        const next = updater(prev);
        return next ? { ...next, slots: normalizeSlotLabels(next.slots) } : next;
      });
    } else if (currentView === 'routine_editor') {
      setRoutineDraft(prev => {
        const next = updater(prev);
        return next ? { ...next, slots: normalizeSlotLabels(next.slots) } : next;
      });
    } else if (currentView === 'routine_preview') {
      setPreviewRoutineDraft(prev => {
        const next = updater(prev);
        return next ? { ...next, slots: normalizeSlotLabels(next.slots) } : next;
      });
    } else if (currentView === 'session' && partnerSession && onEditPartnerSession) {
      const next = updater(partnerSession);
      if (next) onEditPartnerSession({ ...next, slots: normalizeSlotLabels(next.slots) });
    } else {
      setActiveSession(prev => {
        const next = updater(prev);
        return next ? { ...next, slots: normalizeSlotLabels(next.slots) } : next;
      });
    }
  };

  const handleConfirmHistoricalEdit = () => {
    if (!historicalEditConfirmTarget) return;
    const fn = historicalEditConfirmTarget.onConfirm;
    setHistoricalEditConfirmTarget(null);
    if (typeof fn === 'function') fn();
  };

  // addOne: return the existing slots plus just the next guessed slot (+ ADD EXERCISE)
  // peek (with addOne): just the type that slot would be ("on deck": Compound / Accessory / Superset / Cluster), nothing
  // built. category (with addOne): the type the athlete picked in + ADD EXERCISE's dropdown instead of that.
  // suggestFor (with suggestCategory): just the exercise of that type the picker would choose for that muscle group
  // (Stimulus page), by the same rules as + ADD EXERCISE; null when nothing of that type trains it
  const buildGeneratedAutoSlots = (existingSlots = [], { addOne = false, programTarget = null, peek = false, category = null, suggestFor = null, suggestCategory = 'Accessory' } = {}) => {
    const cleanExisting = Array.isArray(existingSlots) ? cloneSlots(existingSlots) : [];
    const usedIds = new Set();
    const remainingCategoryCounts = {
      Compound: 0,
      Superset: 0,
      Accessory: 0
    };

    cleanExisting.forEach(slot => {
      if (!slot) return;
      const cat = normalizeSlotCategory(slot.category);
      remainingCategoryCounts[cat] = (remainingCategoryCounts[cat] || 0) + 1;
      if (isSupersetCategory(cat)) {
        (slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId])
          .filter(Boolean)
          .forEach(id => usedIds.add(id));
      } else if (slot.exerciseId) {
        usedIds.add(slot.exerciseId);
      }
    });

    const fallbackPool = preferAvailable(EXERCISE_LIBRARY);
    const isTrainingExercise = ex =>
      !NON_TRAINING_EQUIPMENT.some(word => String(ex.equipment || '').toLowerCase().includes(word));

    // The workout these slots go into (its program week drives the exercises the program covers)
    const programWorkout = programTarget || getCurrentEditorWorkout() || { startedAt: new Date().toISOString() };
    const programCtx = programContextFor(programWorkout);

    // Big 3 + OHP, or each one's closest equivalent for the athlete's equipment
    const big4Order = CORE_PR_EXERCISE_IDS.map(id => findEquivalentExerciseForEquipment(id, availableEquipment)).filter(
      Boolean
    );
    const big4Rank = id => {
      const idx = big4Order.indexOf(id);
      return idx < 0 ? big4Order.length : idx;
    };

    // Muscle groups already in this workout (existing slots + picks made below)
    const usedGroups = new Set();
    // (by main muscle region: a bench press and a triceps extension don't count as the same)
    usedIds.forEach(id => {
      const r = EXERCISE_MAP[id]?.primaryRegion || EXERCISE_MAP[id]?.muscleGroup;
      if (r) usedGroups.add(r);
    });

    const daysBehind = group => {
      const days = Number(muscleStimulusStatus?.[group]?.daysAgo);
      return Math.min(STIMULUS_DAYS_CAP, Number.isFinite(days) ? days : STIMULUS_DAYS_CAP);
    };

    // Crying's Variety (programs with their own plan ignore it): how recently and how often each exercise was done
    // in the last VARIETY_WINDOW logged sessions (0 = the latest session)
    const usesVariety = !programCtx?.program || programCtx.program.id === 'crying';
    const variety = usesVariety ? Math.min(10, Math.max(0, Number(cryingVariety) || 0)) : 5;
    const VARIETY_WINDOW = 20;
    const recent = (() => {
      const lastAgo = new Map();
      const uses = new Map();
      [...(history || [])]
        .filter(w => w && w.loadedRoutineTitle !== 'PERSONAL RECORD')
        .sort((a, b) => workoutTimeMs(b) - workoutTimeMs(a))
        .slice(0, VARIETY_WINDOW)
        .forEach((w, ago) => {
          (w.slots || []).forEach(slot => {
            (slot.supersetExerciseIds || [slot.exerciseId]).filter(Boolean).forEach(id => {
              if (!lastAgo.has(id)) lastAgo.set(id, ago);
              uses.set(id, (uses.get(id) || 0) + 1);
            });
          });
        });
      return { lastAgo, uses };
    })();
    // Variety above 5: exercises done recently score lower (the more recent, the lower; 10 = left out entirely while
    // anything else fits, see pickBest). Below 5: exercises you already do score higher, so the same ones come back.
    const varietyAdjust = ex => {
      if (variety === 5) return 0;
      const ago = recent.lastAgo.get(ex.id);
      if (variety > 5) {
        if (ago === undefined) return 0;
        const window = Math.max(1, Math.round((VARIETY_WINDOW * (variety - 5)) / 5));
        return ago < window ? -((variety - 5) * 1.6) * (1 - ago / window) : 0;
      }
      const used = recent.uses.get(ex.id) || 0;
      return used > 0 ? (5 - variety) * 0.9 * Math.min(1, 0.4 + used / 6) : 0;
    };

    const scoreExercise = (ex, preferBig4) => {
      // Stimulus by the exercise's main muscle region (Triceps, Hamstrings…), weighted by its body part
      const region = ex.primaryRegion || ex.muscleGroup;
      let score = daysBehind(region) * (REGION_WEIGHT[region] ?? MUSCLE_GROUP_WEIGHT[REGION_GROUP[region] || ex.muscleGroup] ?? 0.7) + varietyAdjust(ex);
      if (preferBig4 && big4Order.includes(ex.id)) score += BIG4_BONUS_DAYS;
      if (usedGroups.has(region)) score -= SAME_WORKOUT_PENALTY_DAYS;
      if (ex.isPriority) score += 1;
      if (!String(ex.id).startsWith('exrx_')) score += 1.5; // hand-curated library entries first
      return score;
    };

    // Best unused exercise of a category for the gym filter: most-behind muscle group first
    // filter (optional): only exercises it accepts (a program day's muscle group, e.g. calves or biceps)
    const pickBest = (category, fallbackId, filter = null) => {
      const preferBig4 = category === 'Compound';
      let pool = fallbackPool.filter(
        ex => ex.category === category && !usedIds.has(ex.id) && isTrainingExercise(ex) && (!filter || filter(ex))
      );
      if (pool.length === 0 && filter) pool = fallbackPool.filter(ex => !usedIds.has(ex.id) && isTrainingExercise(ex) && filter(ex));
      // The program's equipment (e.g. Society: barbells, dumbbells, bands, landmine, EZ bar) for the types it covers
      if ((programCtx?.program?.appliesTo || []).includes(category)) {
        const fitting = pool.filter(ex => fitsProgramEquipment(ex, programCtx, getExerciseEquipmentOptions));
        if (fitting.length > 0) pool = fitting;
      }
      // Society: the workout's first compound is one of the Big 3 (or its equivalent for your equipment); every other
      // compound is a Big 3 variant. The stimulus score below still picks which one.
      if (category === 'Compound' && programCtx?.program?.compoundPicks === 'big3-then-variants') {
        const big3 = BIG3_IDS.map(id => findEquivalentExerciseForEquipment(id, availableEquipment) || id);
        const hasBig3 = [...usedIds].some(id => big3.includes(id) || BIG3_IDS.includes(id));
        // Variants come from a Big 3 lift (bench / squat / deadlift family) the session doesn't have yet, so a deadlift
        // isn't followed by a sumo deadlift; once all three are in, any variant
        const familiesInSession = new Set([...usedIds].map(getLiftFamilyParent).filter(Boolean));
        const variants = pool.filter(isBig3Variant);
        const freshFamily = variants.filter(ex => !familiesInSession.has(getLiftFamilyParent(ex.id)));
        const wanted = hasBig3
          ? freshFamily.length > 0
            ? freshFamily
            : variants
          : pool.filter(ex => big3.includes(ex.id) || BIG3_IDS.includes(ex.id));
        if (wanted.length > 0) pool = wanted;
      }
      if (pool.length === 0) pool = fallbackPool.filter(ex => !usedIds.has(ex.id) && isTrainingExercise(ex));
      // Variety 10: nothing done in the last 20 sessions, while anything else fits
      if (variety >= 10) {
        const fresh = pool.filter(ex => !recent.lastAgo.has(ex.id));
        if (fresh.length > 0) pool = fresh;
      }
      // Variety 0–2: the curated library (well-known exercises) only, while anything there fits
      if (variety <= 2) {
        const curated = pool.filter(ex => !String(ex.id).startsWith('exrx_'));
        if (curated.length > 0) pool = curated;
      }
      if (pool.length === 0) return EXERCISE_MAP[fallbackId] || EXERCISE_LIBRARY[0];
      const best = pool
        .map(ex => ({ ex, score: scoreExercise(ex, preferBig4) }))
        .sort(
          (a, b) =>
            b.score - a.score ||
            big4Rank(a.ex.id) - big4Rank(b.ex.id) ||
            a.ex.name.localeCompare(b.ex.name)
        )[0].ex;
      usedIds.add(best.id);
      usedGroups.add(best.primaryRegion || best.muscleGroup);
      return best;
    };

    if (suggestFor) {
      // Only that type: pickBest falls back to other types or groups when nothing fits, which isn't a suggestion
      // suggestFor: a muscle region (the exercise's main one)
      const fits = ex => ex.primaryRegion === suggestFor && ex.category === suggestCategory;
      const pick = pickBest(suggestCategory, null, fits);
      return pick && fits(pick) ? pick : null;
    }

    const createSlotForPref = rawPref => {
      const pref = normalizeSlotCategory(rawPref);
      if (pref === 'Compound') {
        const pick = pickBest('Compound', 'barbell_bench_press');
        return programSlot(createWorkoutSlot({
          category: 'Compound',
          slotLabel: 'Compound',
          exerciseId: pick.id,
          scheme: getDefaultSchemeForExercise(pick.id, goalType),
          oneRepMaxes,
          history,
          incrementLbs: currentIncrementLbs,
          setPreferences,
          userBodyweightLbs
        }), programWorkout);
      }
      if (pref === 'Cluster') {
        // Clusters (3 × 18, 15 s rest) on an accessory pick
        const pick = pickBest('Accessory', 'dumbbell_hammer_curl');
        return {
          ...createWorkoutSlot({
            category: 'Cluster',
            slotLabel: 'Cluster',
            exerciseId: pick.id,
            scheme: CLUSTER_SCHEME,
            oneRepMaxes,
            history,
            incrementLbs: currentIncrementLbs,
            setPreferences,
            userBodyweightLbs
          }),
          customRestSeconds: CLUSTER_REST_SECONDS
        };
      }
      if (pref === 'Superset') {
        const a1 = pickBest('Accessory', 'reverse_lunge');
        const a2 = pickBest('Accessory', 'front_flies');
        return createWorkoutSlot({
          category: 'Superset',
          slotLabel: 'Superset',
          supersetExerciseIds: [a1.id, a2.id],
          scheme: defaultScheme,
          oneRepMaxes,
          history,
          incrementLbs: currentIncrementLbs,
          setPreferences,
          userBodyweightLbs
        });
      }
      const pick = pickBest('Accessory', 'dumbbell_hammer_curl');
      return createWorkoutSlot({
        category: 'Accessory',
        slotLabel: 'Accessory',
        exerciseId: pick.id,
        scheme: getDefaultSchemeForExercise(pick.id, goalType),
        oneRepMaxes,
        history,
        incrementLbs: currentIncrementLbs,
          setPreferences,
        userBodyweightLbs
      });
    };

    // A program with set days (Starting Strength, 5/3/1, PPL…): the session is that day's exercises, in order; + ADD
    // EXERCISE adds the next one not in the session yet, then carries on with Routine Preferences
    // A stimulus session that pairs with another day (Society: Mon & Tue are the same session A, Wed & Thu B, Fri &
    // Sat C): the second day repeats the exercises logged for that session earlier the same week, re-planned for it
    if (programCtx?.day?.stimulus && !addOne && cleanExisting.length === 0) {
      const { program, day } = programCtx;
      const weekIdx = calendarWeekIndex; // Monday to Sunday, local time
      const at = new Date(programWorkout?.startedAt || Date.now()).getTime();
      const partner = (history || [])
        .filter(w => w && w.id !== programWorkout?.id)
        .filter(w => {
          const info = getWorkoutProgramInfo(w);
          const t = new Date(w.startedAt || 0).getTime();
          return info?.program === program.id && info?.programDay === day.id && t < at && weekIdx(t) === weekIdx(at);
        })
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
      if (partner) {
        if (isTracing()) traceLine(`${day.name}: repeating the exercises from ${String(partner.startedAt).slice(0, 10)}`);
        const repeated = (partner.slots || []).map(slot => {
          const isSup = isSupersetCategory(slot.category);
          const ids = isSup ? (slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId]).slice(0, 2) : [slot.exerciseId];
          ids.forEach(id => id && usedIds.add(id));
          const built = createWorkoutSlot({
            category: slot.category,
            slotLabel: slot.category,
            exerciseId: ids[0],
            ...(isSup ? { supersetExerciseIds: ids, supersetSchemes: getSupersetSchemes(slot) } : {}),
            scheme: slot.scheme || defaultScheme,
            oneRepMaxes,
            history,
            incrementLbs: currentIncrementLbs,
            setPreferences,
            userBodyweightLbs
          });
          return programSlot(built, programWorkout);
        });
        return normalizeSlotLabels(repeated);
      }
    }

    if (hasProgramDays(programCtx?.program) && programCtx.day?.slots) {
      const { program, day, week } = programCtx;
      const present = new Set(
        cleanExisting
          .filter(slot => slot.programRef?.program === program.id && slot.programRef?.day === day.id)
          .map(slot => slot.programRef.key)
      );
      // A lift already in the session (e.g. kept because it has done sets) isn't added twice
      const inSession = new Set(cleanExisting.map(slot => slot.exerciseId));
      const missing = day.slots.filter(spec => {
        if (present.has(spec.key)) return false;
        const id = getSlotSpecExercise(spec, week);
        return !id || !(inSession.has(id) || inSession.has(findEquivalentExerciseForEquipment(id, availableEquipment)));
      });
      const buildDaySlot = spec => {
        let exId = getSlotSpecExercise(spec, week);
        if (exId) {
          // The day's lift, or its closest equivalent for your equipment
          exId = findEquivalentExerciseForEquipment(exId, availableEquipment) || exId;
        } else {
          const pick = spec.pick || {};
          const fits = ex =>
            (!pick.muscleGroup || ex.muscleGroup === pick.muscleGroup) &&
            (!pick.specific || pick.specific.test((ex.specificMuscles || []).join(' ')));
          exId = pickBest(pick.category || spec.category, 'dumbbell_hammer_curl', fits).id;
        }
        usedIds.add(exId);
        const slot = createWorkoutSlot({
          category: spec.category,
          slotLabel: spec.category,
          exerciseId: exId,
          scheme: '5x5',
          oneRepMaxes,
          history,
          incrementLbs: currentIncrementLbs,
          setPreferences,
          userBodyweightLbs
        });
        return programSlot({ ...slot, programRef: { program: program.id, day: day.id, key: spec.key } }, programWorkout);
      };
      if (!addOne) return normalizeSlotLabels([...cleanExisting, ...missing.map(buildDaySlot)]);
      if (missing.length > 0) {
        const dayCategory = normalizeSlotCategory(missing[0].category);
        if (peek) return dayCategory;
        // Another type picked by hand: the day's next lift waits, and that type is added instead (below)
        if (!category || normalizeSlotCategory(category) === dayCategory) return [...cleanExisting, buildDaySlot(missing[0])];
      }
    }

    // A program with its own routine (Society: 2 compounds, 2 supersets, 1 accessory) replaces Routine Preferences
    const activePrefs = (programCtx?.program?.routine || routinePreferences || []).filter(pref => pref !== 'Warmup');
    const prefsToFill = [];

    activePrefs.forEach(rawPref => {
      const norm = normalizeSlotCategory(rawPref);
      if (remainingCategoryCounts[norm] > 0) {
        remainingCategoryCounts[norm] -= 1;
      } else {
        prefsToFill.push(norm);
      }
    });

    if (cleanExisting.length > 0 && prefsToFill.length === 0 && cleanExisting.length < activePrefs.length) {
      for (let i = cleanExisting.length; i < activePrefs.length; i++) {
        prefsToFill.push(normalizeSlotCategory(activePrefs[i]));
      }
    }

    if (addOne) {
      // Next unfilled routine-preference category; once the routine is full, keep cycling through it
      const nextPref =
        prefsToFill[0] ||
        (activePrefs.length > 0
          ? normalizeSlotCategory(activePrefs[cleanExisting.length % activePrefs.length])
          : 'Compound');
      if (peek) return nextPref;
      return [...cleanExisting, createSlotForPref(category ? normalizeSlotCategory(category) : nextPref)];
    }

    const generatedSlots = prefsToFill.map(pref => createSlotForPref(pref));
    return normalizeSlotLabels([...cleanExisting, ...generatedSlots]);
  };

  // A new session: under a program with a week plan it records the program, its week and the program's rest timer
  const newSessionBase = () => {
    const startedAt = new Date().toISOString();
    const ctx = programContextFor({ startedAt });
    return {
      id: `session_${Date.now()}`,
      startedAt,
      updatedAt: startedAt,
      defaultRestSeconds: ctx?.day?.restSeconds || ctx?.program?.restSeconds || 90,
      gymId: selectedGymId,
      slots: [],
      ...(ctx
        ? { program: ctx.program.id, programWeek: ctx.program.weekName(ctx.week), ...(ctx.day ? { programDay: ctx.day.id } : {}) }
        : {})
    };
  };

  const handleOpenNewSession = () => {
    // An empty leftover session (e.g. from an earlier day) is replaced so the name and start date are today's
    if (!activeSession || !(activeSession.slots || []).length) {
      setActiveSession({
        ...newSessionBase(),
        title: getDefaultSessionName(),
        loadedRoutineTitle: 'MANUAL'
      });
    } else {
      setActiveSession(prev => ({
        ...prev,
        title: stripDateFromTitle(prev.title) || getDefaultSessionName(),
        loadedRoutineTitle: prev.loadedRoutineTitle || 'MANUAL'
      }));
    }
    setOpenedFromRoutines(false);
    setIsCurrentEditorShared(false);
    setCurrentView('session');
  };

  const handleOpenNewAutoSession = () => {
    const base = newSessionBase();
    const autoSlots = withTrace('AUTO SESSION', () => buildGeneratedAutoSlots([], { programTarget: base }));
    const autoTitle = getDefaultAutoSessionName();
    setActiveSession({
      ...base,
      title: autoTitle,
      loadedRoutineTitle: 'AUTO',
      slots: autoSlots
    });
    setOpenedFromRoutines(false);
    setIsCurrentEditorShared(false);
    setCurrentView('session');
  };

  // A loaded routine starts fresh: no set done, History's locks (a routine saved from a logged workout carries them)
  // and History-only tags removed
  const freshRoutineSlot = slot => {
    if (!slot) return slot;
    const unlock = Boolean(slot.historyLocked);
    const reset = list =>
      Array.isArray(list)
        ? list.map(st =>
            st ? { ...st, completed: false, ...(unlock ? { lockType: undefined, lockWeight: false, lockReps: undefined } : {}) } : st
          )
        : list;
    const { historyLocked: _locked, syncedWith: _synced, programInfo: _program, ...rest } = slot;
    return {
      ...rest,
      sets: reset(slot.sets),
      ...(Array.isArray(slot.secondarySets) ? { secondarySets: reset(slot.secondarySets) } : {}),
      ...(Array.isArray(slot.supersetSetsByExercise) ? { supersetSetsByExercise: slot.supersetSetsByExercise.map(reset) } : {})
    };
  };

  // ---------------------------------------------------------------------------------------------------------------
  // Routines carry no weights. A routine stores each set's reps and its intensity (the effort it was done at); when it
  // is loaded (or opened to edit) every weight is worked out for the athlete loading it, from their calculated 1RM as
  // of now. So a friend's routine, or your own from months ago, starts at your numbers today.
  // ---------------------------------------------------------------------------------------------------------------
  const hasIntensityValue = st => Boolean(st?.intensity) && intensityToRir(st.intensity, st.reps) !== null;
  const slotSetLists = slot => {
    const isSup = isSupersetCategory(slot?.category) && Array.isArray(slot?.supersetSetsByExercise);
    const ids = isSup ? slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId] : [slot?.exerciseId];
    const schemes = isSup ? getSupersetSchemes(slot) : [slot?.scheme || defaultScheme];
    return { isSup, ids, schemes };
  };
  const mapSlotLists = (slot, fn) => {
    if (!slot) return slot;
    const { isSup, ids, schemes } = slotSetLists(slot);
    if (isSup) {
      const matrix = slot.supersetSetsByExercise.map((list, half) => fn(list, ids[half] || slot.exerciseId, schemes[half] || schemes[0], half));
      return { ...slot, supersetSetsByExercise: matrix, sets: matrix[0] || [], secondarySets: matrix[1] || [] };
    }
    const sets = fn(slot.sets || [], slot.exerciseId, schemes[0], 0);
    return { ...slot, sets, supersetSetsByExercise: [sets] };
  };
  const isTimedRoutineSet = (st, scheme) =>
    scheme === 'Timer' || Number(st?.durationSeconds) > 0 || (typeof st?.timerStr === 'string' && st.timerStr.includes(':'));

  /**
   * A workout's exercises as a routine to store: weights removed. A set without an intensity of its own gets the
   * effort it was done at, worked out from its weight and reps against the author's calculated 1RM
   * (RIR = reps to failure − reps; reps to failure = 1 + 30 × (1RM ÷ weight − 1)), so whoever loads it gets the same
   * effort at their own weight.
   */
  const routineSlotsForStorage = slots =>
    (slots || []).map(rawSlot =>
      mapSlotLists(withoutResetSnapshot(rawSlot), (list, exId, scheme) => {
        const oneRM = exId && !isBodyweightExercise(exId) ? getHistoricalCalculated1RM(exId, history, oneRepMaxes) : 0;
        const name = EXERCISE_MAP[exId]?.name || exId;
        return (list || []).map((st, idx) => {
          if (!st) return st;
          const { weight, lastWeight: _lw, lockWeight: _lk, ...rest } = st;
          let intensity = st.intensity;
          const w = Number(weight) || 0;
          if (!isTimedRoutineSet(st, scheme) && oneRM > 0 && w > 0 && (!hasIntensityValue(st) || st.intensity.auto)) {
            const fatigueReps = normalizeSetType(st.type) === 'Warmup' ? 0 : fatigueRateFor(exId) * priorHardSets(list, idx);
            intensity = deriveIntensity(oneRM, w, (Number(st.reps) || 1) + fatigueReps, st.intensity?.mode || 'rir', exId) || st.intensity;
            if (isTracing() && intensity) {
              traceLine(`${name} set ${idx + 1}: ${fmt(w)} lb × ${st.reps} against your 1RM ${fmt(oneRM)} → reps to failure 1 + 30 × (${fmt(oneRM)} ÷ ${fmt(w)} − 1) = ${fmt(1 + 30 * (oneRM / Math.min(w, oneRM) - 1))} → ${formatIntensity(intensity.mode, intensity.value)} kept; weight removed`);
            }
          } else if (isTracing() && w > 0) {
            traceLine(`${name} set ${idx + 1}: ${fmt(w)} lb removed; ${hasIntensityValue(st) ? `its ${formatIntensity(st.intensity.mode, st.intensity.value)} kept` : `its type (${normalizeSetType(st.type)}) sets the effort`}`);
          }
          return { ...rest, weight: 0, lockWeight: false, ...(intensity ? { intensity } : {}) };
        });
      })
    );

  /**
   * A routine's exercise with weights for the athlete loading it (now): each set = their calculated 1RM for that
   * exercise at the set's reps and intensity — weight = 1RM ÷ (1 + (reps + RIR − 1) ÷ 30), or 1RM × %1RM — where the
   * intensity is the set's own, else its type's (Warm-up RIR 5, Working 2, Top Out 1, Burn Out 3; 1 Rep Max = the
   * 1RM). Weights round to 2.5 lb; bodyweight exercises store what is added; timed sets keep their time.
   */
  const weighRoutineSlot = slot =>
    toAddedWeights(
      mapSlotLists(slot, (list, exId, scheme) => {
        const name = EXERCISE_MAP[exId]?.name || exId;
        if (list.every(st => isTimedRoutineSet(st, scheme))) {
          if (isTracing()) traceLine(`${name}: timed sets, kept as they are`);
          return list;
        }
        const oneRM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
        if (isTracing()) traceLine(describe1RM(exId, startOpts));
        return list.map((st, idx) => {
          if (!st || isTimedRoutineSet(st, scheme) || !(oneRM > 0)) return st;
          const type = normalizeSetType(st.type);
          const reps = Math.max(1, Number(st.reps) || 1);
          let load;
          let how;
          if (type === '1 Rep Max') {
            load = oneRM;
            how = `1 Rep Max = your 1RM ${fmt(oneRM)}`;
          } else {
            const own = hasIntensityValue(st);
            const intensity = own ? st.intensity : { mode: 'rir', value: SET_TYPE_RIR[type] ?? 2 };
            // A stored RIR is after fatigue: the working sets before it add the allowance back (fresh-equivalent);
            // a routine's own type effort (no intensity) is already fresh
            const fatigueReps = own && intensity.mode !== 'pct' && type !== 'Warmup' ? fatigueRateFor(exId) * priorHardSets(list, idx) : 0;
            load = weightForIntensity(oneRM, reps + fatigueReps, intensity, exId) || 0;
            const label = formatIntensity(intensity.mode, intensity.value);
            const source = own ? 'the routine\'s intensity' : `${type}'s effort`;
            how =
              intensity.mode === 'pct'
                ? `${fmt(oneRM)} × ${intensity.value}% (${source})`
                : `${fmt(oneRM)} ÷ (1 + (${reps} reps + ${fmt(intensityToRir(intensity, reps, exId))} RIR − 1) ÷ ${fmt(repCurveFor(exId))}) (${label}, ${source})`;
          }
          const weight = Math.max(0, Math.round(load / 2.5) * 2.5);
          if (isTracing()) traceLine(`${name} set ${idx + 1}: ${type} × ${reps} → ${how} = ${fmt(weight)} lb`);
          return { ...st, weight, lockWeight: false, completed: false };
        });
      })
    );

  const handleDirectLoadRoutine = (routineObj, returnToView = 'session') => {
    const wasOnRoutinesPage = currentView === 'routines';
    // A friend's routine: its structure, your weights (re-worked from your own History, as RECALCULATE would)
    const myName = String(user?.username || '').replace(/^@/, '').toLowerCase();
    const author = String(routineObj.friendName || routineObj.author || '').replace(/^@/, '').toLowerCase();
    const fromFriend = Boolean(routineObj.friendName) || Boolean(author && myName && author !== myName);
    const freshSlots = cloneSlots(
      routineObj.slots || buildPresetSlots(routineObj.key, oneRepMaxes, history, currentIncrementLbs, userBodyweightLbs)
    ).map(freshRoutineSlot);
    // Every routine's weights are worked out for you now (routines store reps and intensity, not weights)
    const authorName = String(routineObj.friendName || routineObj.author || '').replace(/^@/, '');
    const builtSlots = withTrace(
      `LOAD ${fromFriend ? `@${authorName}'S ` : ''}${routineObj.isWorkout ? 'WORKOUT' : 'ROUTINE'}: ${stripDateFromTitle(routineObj.label) || 'Routine'}`,
      () => {
        traceLine(
          fromFriend
            ? `Converting @${authorName}'s ${routineObj.isWorkout ? 'workout' : 'routine'} to your numbers: their weights are not used; each set's weight comes from YOUR calculated 1RM at the set's reps and effort.`
            : 'Routines keep reps and effort, not weights: each set\'s weight comes from your calculated 1RM as of today.'
        );
        traceLine(`${freshSlots.length} exercise${freshSlots.length === 1 ? '' : 's'}; sets start not done.`);
        return normalizeSlotLabels(freshSlots.map(weighRoutineSlot));
      },
      `load_${routineObj.key || routineObj.label}`
    );
    const datedTitle = formatTitleWithDate(routineObj.label);
    const routineLabel = routineObj.label || datedTitle;

    // (BACK from the loaded routine returns to the routine browser through page.js's back stack)
    if (wasOnRoutinesPage) setOpenedFromRoutines(true);
    appendSessionLog?.('LOAD_ROUTINE', `Loaded routine: ${routineLabel}`);

    if (returnToView === 'history_editor' && expandedHistoryWorkoutId) {
      setCurrentView('history_editor');
      updateCurrentWorkoutState(prev => ({
        ...prev,
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        slots: builtSlots
      }));
      setRoutineSelectReturnView(null);
      return;
    }

    if (returnToView === 'historical_entry') {
      setHistoricalDraft(prev => ({
        ...(prev || { id: `hist_${Date.now()}`, workoutDate: formatTodayYMD() }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        slots: builtSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('historical_entry');
    } else if (returnToView === 'routine_editor') {
      setRoutineDraft(prev => ({
        ...(prev || { key: `routine_${Date.now()}`, isEditingExisting: false, defaultRestSeconds: 90 }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        slots: builtSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('routine_editor');
    } else {
      setActiveSession(prev => ({
        ...(prev || { id: `session_${Date.now()}`, startedAt: new Date().toISOString(), defaultRestSeconds: 90 }),
        title: datedTitle,
        loadedRoutineTitle: routineLabel,
        updatedAt: new Date().toISOString(),
        slots: builtSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('session');
    }
  };

  const handleOpenPreviewRoutine = (routineObj, returnToView = 'session') => {
    handleDirectLoadRoutine(routineObj, returnToView || 'session');
  };

  const handleCancelRoutineSelection = () => {
    const returnTarget = routineSelectReturnView || 'session';
    setRoutineSelectReturnView(null);
    if (returnTarget === 'historical_entry' && historicalDraft) {
      setCurrentView('historical_entry');
    } else if (returnTarget === 'routine_editor' && routineDraft) {
      setCurrentView('routine_editor');
    } else if (returnTarget === 'history_editor' && expandedHistoryWorkoutId) {
      setCurrentView('history_editor');
    } else {
      handleOpenNewSession();
    }
  };

  const handleApplyPreviewRoutine = () => {};

  const handleAutoBuildWorkout = () => {
    const currentWorkout = getCurrentEditorWorkout();
    const existingSlots = Array.isArray(currentWorkout?.slots) ? currentWorkout.slots : [];
    const isCompletingExisting = existingSlots.length > 0;
    const generatedSlots = buildGeneratedAutoSlots(existingSlots);
    const autoTitle = isCompletingExisting
      ? currentWorkout?.title || getDefaultAutoSessionName()
      : getDefaultAutoSessionName();
    const returnTarget =
      currentView === 'historical_entry' ||
      currentView === 'routine_editor' ||
      currentView === 'session' ||
      currentView === 'history_editor'
        ? currentView
        : routineSelectReturnView || 'session';

    appendSessionLog?.(
      'AUTO_BUILD',
      isCompletingExisting
        ? `Auto-completed workout: ${autoTitle}`
        : `Generated auto workout: ${autoTitle}`
    );

    if (returnTarget === 'history_editor' && expandedHistoryWorkoutId) {
      updateCurrentWorkoutState(prev => ({
        ...prev,
        title: autoTitle,
        loadedRoutineTitle: prev?.loadedRoutineTitle || 'AUTO',
        slots: generatedSlots
      }));
      return;
    }

    if (returnTarget === 'historical_entry') {
      setHistoricalDraft(prev => ({
        ...(prev || { id: `hist_${Date.now()}`, workoutDate: formatTodayYMD() }),
        title: autoTitle,
        loadedRoutineTitle: isCompletingExisting ? prev?.loadedRoutineTitle || 'AUTO' : 'AUTO',
        slots: generatedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('historical_entry');
    } else if (returnTarget === 'routine_editor') {
      setRoutineDraft(prev => ({
        ...(prev || { key: `routine_${Date.now()}`, isEditingExisting: false, defaultRestSeconds: 90 }),
        title: autoTitle,
        loadedRoutineTitle: isCompletingExisting ? prev?.loadedRoutineTitle || 'AUTO' : 'AUTO',
        slots: generatedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('routine_editor');
    } else {
      setActiveSession(prev => ({
        ...(prev || { id: `session_${Date.now()}`, startedAt: new Date().toISOString(), defaultRestSeconds: 90 }),
        title: autoTitle,
        loadedRoutineTitle: isCompletingExisting ? prev?.loadedRoutineTitle || 'AUTO' : 'AUTO',
        updatedAt: new Date().toISOString(),
        slots: generatedSlots
      }));
      setRoutineSelectReturnView(null);
      setCurrentView('session');
    }
  };

  // + ADD EXERCISE: append one auto-guessed exercise (next routine-preference category, not already in the
  // workout, fits the gym selection) that the athlete can then change in the slot editor.
  // The type + ADD EXERCISE adds next ("on deck"): the program day's next lift, else the next Routine Preference
  const getNextAutoSlotCategory = () => {
    try {
      return buildGeneratedAutoSlots(getCurrentEditorWorkout()?.slots || [], { addOne: true, peek: true });
    } catch {
      return 'Compound';
    }
  };

  // Stimulus page: one compound and one accessory for a muscle group ({ compound, accessory }, either null when the
  // library has none), each the one + ADD EXERCISE's picker would choose for that type (stimulus, equipment, variety,
  // the program's rules), leaving out exercises already in the open session
  const suggestExerciseForMuscleGroup = group => {
    const slots = activeSession?.slots || [];
    const one = category => {
      try {
        return buildGeneratedAutoSlots(slots, { suggestFor: group, suggestCategory: category });
      } catch {
        return null;
      }
    };
    return { compound: one('Compound'), accessory: one('Accessory') };
  };

  // category: the type picked in + ADD EXERCISE's dropdown (null = the one on deck)
  const handleAddAutoSlot = (category = null) => {
    const existingSlots = getCurrentEditorWorkout()?.slots || [];
    const withNext = withTrace('ADD EXERCISE', () => {
      const built = buildGeneratedAutoSlots(existingSlots, { addOne: true, category });
      const added = built[built.length - 1];
      if (added) {
        traceTitle(
          `ADD EXERCISE · ${(added.supersetExerciseIds || [added.exerciseId]).map(id => EXERCISE_MAP[id]?.name || id).join(' + ')}`
        );
      }
      return built;
    });
    const newSlot = withNext[withNext.length - 1];
    if (!newSlot) return;
    appendSessionLog?.(
      'AUTO_ADD_SLOT',
      `Added auto-picked ${newSlot.category} slot: ${(newSlot.supersetExerciseIds || [newSlot.exerciseId]).join(' + ')}`
    );
    updateCurrentWorkoutState(prev => ({
      ...(prev || { id: `session_${Date.now()}`, title: getDefaultSessionName(), slots: [] }),
      slots: [...(prev?.slots || []), newSlot]
    }));
  };

  const handleSaveCurrentEditor = () => {
    const currentWorkout = getCurrentEditorWorkout();
    if (!currentWorkout || !currentWorkout.slots || currentWorkout.slots.length === 0) {
      return;
    }
    const detectedGymType = inferRoutineGymCategory(currentWorkout.slots);
    setSaveConfirmTarget({
      name: stripDateFromTitle(currentWorkout.title) || getDefaultSessionName(),
      // The athlete's SHARING DEFAULTS (Privacy): LOG, POST and SAVE AS ROUTINE → @me on, @all off unless changed there
      log: shareDefaults?.log !== false,
      shareWithFriends: Boolean(isCurrentEditorShared) || Boolean(shareDefaults?.routineToAll),
      shareFriendIds: [],
      saveAsRoutine: currentView === 'routine_editor' || shareDefaults?.routineToMe !== false,
      postToFeed: shareDefaults?.postToFeed !== false,
      gymType: detectedGymType,
      sourceView: currentView,
      // Sets whose intensity gives a 1RM out of line with the rest of their exercise (checked before it's logged)
      intensityFlags: currentView === 'routine_editor' ? [] : findIntensityMismatches(currentWorkout)
    });
  };

  const handleConfirmSaveWorkout = confirmed => {
    const currentWorkout = getCurrentEditorWorkout();
    if (!currentWorkout || !currentWorkout.slots || currentWorkout.slots.length === 0) {
      setSaveConfirmTarget(null);
      return;
    }

    const finalTitle =
      stripDateFromTitle(confirmed?.name) || stripDateFromTitle(currentWorkout.title) || getDefaultSessionName();
    const shouldShare = Boolean(confirmed?.shareWithFriends);
    const sourceView = confirmed?.sourceView || currentView;
    const normalizedSlots = normalizeSlotLabels(cloneSlots(currentWorkout.slots));
    const routineGymType = inferRoutineGymCategory(normalizedSlots);
    // The routine copy (saved / shared): worked out once, traced in the CONSOLE
    let routineCopy = null;
    const storedRoutineSlots = () => {
      if (!routineCopy) {
        routineCopy = withTrace(`SAVE ROUTINE: ${finalTitle}`, () => {
          traceLine('Routines are stored without weights: each set keeps its reps and the effort it was done at, so it loads at the right weight for whoever opens it.');
          return routineSlotsForStorage(normalizedSlots);
        }, `save_${currentWorkout.key || currentWorkout.id || finalTitle}`);
      }
      return routineCopy;
    };

    // Routines are matched by key, never by name: saving under a name another routine already uses must not
    // overwrite or delete that routine (renaming a workout used to wipe a same-named routine). A session (no key)
    // updates the routine it was loaded from only while it still has that routine's name; renamed, it is a new one.
    const loadedFromRoutine =
      !currentWorkout.key && currentWorkout.loadedRoutineTitle && finalTitle === currentWorkout.loadedRoutineTitle
        ? (savedRoutines || []).find(r => r.label === currentWorkout.loadedRoutineTitle)
        : null;
    const routineItem = {
      key: currentWorkout.key || loadedFromRoutine?.key || `routine_${currentWorkout.id || Date.now()}`,
      label: finalTitle,
      author: user?.username || 'test_lifter',
      gymType: routineGymType,
      // When it was saved (shown on the routine browser)
      savedAt: new Date().toISOString(),
      // Stored without weights: reps and the effort they were done at (see routineSlotsForStorage)
      slots: storedRoutineSlots()
    };
    // ROUTINE toggle: the routine editor always saves a routine; sessions/History only when it is on.
    const shouldSaveRoutine = sourceView === 'routine_editor' || Boolean(confirmed?.saveAsRoutine);
    if (shouldSaveRoutine) {
      setSavedRoutines(prev => {
        const exists = prev.some(r => r.key === routineItem.key);
        return exists ? prev.map(r => (r.key === routineItem.key ? routineItem : r)) : [routineItem, ...prev];
      });
    }

    // This workout's own shared copy (by key): PUBLIC adds or updates it, PRIVATE removes only it
    const sharedKey = `shared_${currentWorkout.id || currentWorkout.key || Date.now()}`;
    if (shouldShare) {
      const sharedItem = {
        key: sharedKey,
        label: finalTitle,
        author: user?.username || 'test_lifter',
        gymType: routineGymType,
        savedAt: new Date().toISOString(),
        slots: storedRoutineSlots()
      };
      setSharedRoutines(prev => {
        const exists = prev.some(r => r.key === sharedItem.key);
        return exists ? prev.map(r => (r.key === sharedItem.key ? sharedItem : r)) : [sharedItem, ...prev];
      });
      setIsCurrentEditorShared(true);
    } else {
      setSharedRoutines(prev => prev.filter(r => r.key !== sharedKey));
      setIsCurrentEditorShared(false);
    }

    appendSessionLog?.('SAVE_WORKOUT', `Saved "${finalTitle}" (gymType=${routineGymType}, shareWithFriends=${shouldShare}, saveAsRoutine=${shouldSaveRoutine})`);
    setSaveConfirmTarget(null);
    setOpenedFromRoutines(false);

    if (sourceView === 'routine_editor') {
      setCurrentView('routines');
      return;
    }

    if (sourceView === 'history_editor' && expandedHistoryWorkoutId) {
      // Saves the History editor's draft (name, date, exercises and sets) over the logged workout
      const original = (history || []).find(w => w.id === expandedHistoryWorkoutId) || null;
      const syncInfo = getWorkoutSyncInfo(original) || getWorkoutSyncInfo(currentWorkout);
      setHistory(prev =>
        prev.map(w =>
          w.id === expandedHistoryWorkoutId
            ? withSyncInfo({
                ...w,
                ...currentWorkout,
                id: w.id,
                title: finalTitle,
                gymType: routineGymType,
                updatedAt: new Date().toISOString(),
                ...(syncInfo ? { syncedWith: syncInfo } : {}),
                // The draft started done + locked (asHistoricalWorkout); keep what the athlete changed since
                slots: normalizedSlots
              })
            : w
        )
      );
      // A synced workout with exercises added since it was saved: the friend in it is told, and can add them too
      const addedSlots = syncInfo && original ? findAddedSlots(original.slots, normalizedSlots) : [];
      if (syncInfo && addedSlots.length > 0 && user) {
        postSyncHistoryUpdate(user, syncInfo.syncId, previous =>
          buildHistoryUpdate({ user, workout: { ...original, ...currentWorkout }, addedSlots, previous })
        ).then(res =>
          appendSessionLog?.(
            'SYNCED_HISTORY_UPDATE',
            `${res?.ok ? 'Told' : 'Could not tell'} @${syncInfo.partnerName || 'friend'} about ${addedSlots.length} added exercise(s)`
          )
        );
      }
      appendSessionLog?.('HISTORY_EDIT', `Saved edits to historical workout: ${finalTitle}`);
      logOperation(`SAVE HISTORY EDIT: ${finalTitle}`, [
        `The logged workout${currentWorkout.workoutDate ? ` (${currentWorkout.workoutDate})` : ''} was replaced by your edits: name, date, ${normalizedSlots.length} exercise${normalizedSlots.length === 1 ? '' : 's'} and their sets, exactly as shown (no weights were recalculated).`,
        'PRs, the PROGRESS chart and LAST / PR in later sessions read History, so they follow these numbers from now on.'
      ], `history_save_${expandedHistoryWorkoutId}`);
      setHistoryEditDraft?.(null);
      setConfirmedHistoryEditWorkoutId?.(null);
      return;
    }

    if (sourceView === 'historical_entry') {
      const iso = parseYMDToISO(currentWorkout.workoutDate || formatTodayYMD());
      const entry = {
        ...currentWorkout,
        id: currentWorkout.id || `hist_${Date.now()}`,
        title: finalTitle,
        gymType: routineGymType,
        startedAt: iso,
        updatedAt: new Date().toISOString(),
        isComplete: true,
        verifiedByUser: true,
        // Entering History: every set done, its type / weight / reps locked
      slots: lockAndCompleteSets(normalizedSlots)
      };
      setHistory(prev => [entry, ...prev]);
      setHistoricalDraft(null);
      // Back to the History page, where the past workout was started
      setCurrentView('history_log');
      return;
    }

    // FINISH logs only the sets marked done (exercises with none are left out); nothing done = nothing logged.
    // LOG off: nothing goes to History (SAVE / SHARE above still happened); the session closes.
    const doneSlots = confirmed?.log === false ? [] : keepCompletedSets(normalizedSlots);
    {
      const countSets = list => list.reduce((n, sl) => n + (sl.supersetSetsByExercise || [sl.sets || []]).flat().length, 0);
      logOperation(`FINISH: ${finalTitle}`, [
        confirmed?.log === false
          ? 'LOG was off: nothing was written to History; the session closed.'
          : doneSlots.length === 0
            ? 'No set was marked done, so nothing was written to History; the session closed.'
            : `Logged ${countSets(doneSlots)} done set${countSets(doneSlots) === 1 ? '' : 's'} from ${doneSlots.length} exercise${doneSlots.length === 1 ? '' : 's'} to History (sets not marked done, and exercises with none, were left out). Logged sets are marked done and their type, weight and reps locked.`,
        shouldSaveRoutine ? 'Also saved as a routine (without weights: see SAVE ROUTINE).' : null,
        shouldShare ? 'Also shared with @all your friends.' : null
      ], `finish_${currentWorkout.id || finalTitle}`);
    }
    if (doneSlots.length === 0) {
      setActiveSession(null);
      setCurrentView('home');
      return;
    }
    // A synced session remembers who it was with (syncedWith on the workout and its exercises)
    const entry = withProgramInfo(withSyncInfo({
      ...currentWorkout,
      title: finalTitle,
      gymType: inferRoutineGymCategory(doneSlots),
      updatedAt: new Date().toISOString(),
      isComplete: checkIsWorkoutComplete(doneSlots),
      verifiedByUser: true,
      // Entering History: its sets are done; type / weight / reps locked
      slots: lockAndCompleteSets(doneSlots)
    }));
    setHistory(prev => {
      const exists = prev.some(w => w.id === entry.id);
      return exists ? prev.map(w => (w.id === entry.id ? entry : w)) : [entry, ...prev];
    });
    setActiveSession(null);
    setCurrentView('home');
  };

  // Idle auto-finish (useIdleAutoFinish): saves the live session to History as it is (private, not a routine)
  // and clears it. Only a session with at least one completed set is saved; returns whether it was.
  const handleAutoFinishActiveSession = () => {
    const session = activeSession;
    const slots = session?.slots || [];
    const anyDone = slots.some(slot =>
      (slot.supersetSetsByExercise || [slot.sets || []]).some(list => (list || []).some(st => st.completed))
    );
    if (!anyDone) return false;
    // Only the sets marked done are logged
    const normalizedSlots = keepCompletedSets(normalizeSlotLabels(cloneSlots(slots)));
    const entry = withProgramInfo(withSyncInfo({
      ...session,
      title: (session.title || '').trim() || getDefaultSessionName(),
      gymType: inferRoutineGymCategory(normalizedSlots),
      updatedAt: new Date().toISOString(),
      isComplete: checkIsWorkoutComplete(normalizedSlots),
      verifiedByUser: true,
      autoFinished: true,
      // Entering History: its sets are done; type / weight / reps locked
      slots: lockAndCompleteSets(normalizedSlots)
    }));
    setHistory(prev => {
      const exists = prev.some(w => w.id === entry.id);
      return exists ? prev.map(w => (w.id === entry.id ? entry : w)) : [entry, ...prev];
    });
    appendSessionLog?.('AUTO_FINISH_SESSION', `Saved "${entry.title}" after 15 minutes idle`);
    setSaveConfirmTarget(null);
    setActiveSession(null);
    if (currentView === 'session') setCurrentView('home');
    return true;
  };

  const handleShareCurrentEditor = () => {
    const currentWorkout = getCurrentEditorWorkout();
    if (!currentWorkout || !currentWorkout.slots || currentWorkout.slots.length === 0) return;
    const normalizedSlots = normalizeSlotLabels(cloneSlots(currentWorkout.slots));
    const routineGymType = inferRoutineGymCategory(normalizedSlots);
    const sharedItem = {
      key: `shared_${currentWorkout.id || currentWorkout.key || Date.now()}`,
      label: currentWorkout.title || 'Shared Routine',
      author: user?.username || 'test_lifter',
      gymType: routineGymType,
      // Shared routines carry no weights (reps + effort)
      slots: routineSlotsForStorage(normalizedSlots)
    };
    setSharedRoutines(prev => {
      const exists = prev.some(r => r.label === sharedItem.label);
      return exists ? prev.map(r => (r.label === sharedItem.label ? sharedItem : r)) : [sharedItem, ...prev];
    });
    setIsCurrentEditorShared(true);
  };

  const handleResetCurrentEditor = () => {
    updateCurrentWorkoutState(prev => ({
      ...prev,
      loadedRoutineTitle: 'MANUAL',
      slots: []
    }));
  };

  const handleConfirmDeleteAction = () => {
    if (!deleteConfirmTarget) return;
    // Generic targets (e.g. removing a friend) carry their own confirm action.
    if (typeof deleteConfirmTarget.onConfirm === 'function') {
      deleteConfirmTarget.onConfirm();
      setDeleteConfirmTarget(null);
      return;
    }
    if (deleteConfirmTarget.type === 'history_workout') {
      const targetWorkoutId = deleteConfirmTarget.workoutId;
      const deletedWorkout = (history || []).find(w => w.id === targetWorkoutId);
      const nextHistory = (history || []).filter(w => w.id !== targetWorkoutId);
      setHistory(nextHistory);

      // Delete it on the server too; until that succeeds the id stays queued (retried on each sync)
      // so pulls don't bring the workout back.
      if (user && targetWorkoutId) {
        markWorkoutIdDeleted(user, targetWorkoutId);
        deleteCloudWorkoutsByIds(user, [targetWorkoutId]).then(result => {
          if (result.ok) clearDeletedWorkoutIds(user, [targetWorkoutId]);
        });
      }

      if (deletedWorkout) {
        const affectedIds = new Set();
        (deletedWorkout.slots || []).forEach(slot => {
          const ids = isSupersetCategory(slot.category)
            ? (slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId]).filter(Boolean)
            : [slot.exerciseId].filter(Boolean);
          ids.forEach(id => affectedIds.add(id));
        });
        if (affectedIds.size > 0) {
          setOneRepMaxes(prev => {
            const copy = { ...(prev || {}) };
            affectedIds.forEach(exId => {
              const deletedBest = getBestHistory1RM(exId, [deletedWorkout]);
              const remainingBest = getBestHistory1RM(exId, nextHistory);
              if (deletedBest > 0 && Number(copy[exId]) === deletedBest) {
                if (remainingBest > 0) {
                  copy[exId] = remainingBest;
                } else {
                  delete copy[exId];
                }
              }
            });
            return copy;
          });
        }
      }

      if (expandedHistoryWorkoutId === targetWorkoutId) {
        setExpandedHistoryWorkoutId(null);
      }
      appendSessionLog?.('DELETE_HISTORY', `Deleted history workout: ${deleteConfirmTarget.label || targetWorkoutId}`);
      setDeleteConfirmTarget(null);
      return;
    }
    if (deleteConfirmTarget.type === 'saved_routine') {
      const { routineKey, routineLabel } = deleteConfirmTarget;
      setSavedRoutines(prev =>
        (prev || []).filter(r => (routineKey ? r.key !== routineKey : r.label !== routineLabel))
      );
      if (routineKey) {
        deleteCloudRoutineByKey(user, routineKey);
      }
      appendSessionLog?.('DELETE_SAVED_ROUTINE', `Deleted saved routine: ${routineLabel || routineKey}`);
      setDeleteConfirmTarget(null);
      return;
    }
    if (deleteConfirmTarget.type === 'shared_routine') {
      const { routineKey, routineLabel } = deleteConfirmTarget;
      setSharedRoutines(prev =>
        (prev || []).filter(r => (routineKey ? r.key !== routineKey : r.label !== routineLabel))
      );
      if (routineKey) {
        deleteCloudRoutineByKey(user, routineKey);
      }
      appendSessionLog?.('DELETE_SHARED_ROUTINE', `Deleted shared routine: ${routineLabel || routineKey}`);
      setDeleteConfirmTarget(null);
      return;
    }
    if (deleteConfirmTarget.type === 'slot') {
      const deletedSlotId = deleteConfirmTarget.slotId;
      updateCurrentWorkoutState(prev => ({
        ...prev,
        slots: (prev?.slots || []).filter(s => s.id !== deletedSlotId)
      }));
      // A rest timer started by a set of the deleted exercise stops (and goes back to its full time)
      setTimerTrigger?.(prev =>
        prev?.isRunning && prev.slotId === deletedSlotId ? { ...prev, isRunning: false, startedAtMs: null, slotId: null } : prev
      );
    } else if (deleteConfirmTarget.type === 'set') {
      const { slotId, exIdx, setId } = deleteConfirmTarget;
      updateCurrentWorkoutState(prev => {
        if (!prev) return prev;
        const nextSlots = prev.slots.map(slot => {
          if (slot.id !== slotId) return slot;
          if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
            const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
              idx === exIdx
                ? (list || []).filter(st => st.id !== setId).map((st, i) => ({ ...st, setNumber: i + 1 }))
                : list
            );
            return {
              ...slot,
              supersetSetsByExercise: nextMatrix,
              sets: nextMatrix[0] || [],
              secondarySets: nextMatrix[1] || []
            };
          }
          const nextSets = (slot.sets || [])
            .filter(st => st.id !== setId)
            .map((st, i) => ({ ...st, setNumber: i + 1 }));
          return { ...slot, sets: nextSets, supersetSetsByExercise: [nextSets] };
        });
        return { ...prev, slots: nextSlots };
      });
    }
    setDeleteConfirmTarget(null);
  };

  const handleReorderExercises = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    updateCurrentWorkoutState(prev => {
      if (!prev || !Array.isArray(prev.slots)) return prev;
      const copy = [...prev.slots];
      if (fromIndex >= copy.length || toIndex >= copy.length) return prev;
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return { ...prev, slots: copy };
    });
  };

  const handleReorderSets = (slotId, exIdx, fromSetIdx, toSetIdx) => {
    if (fromSetIdx === toSetIdx || fromSetIdx < 0 || toSetIdx < 0) return;
    updateCurrentWorkoutState(prev => {
      if (!prev || !Array.isArray(prev.slots)) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;
        const reorderArray = arr => {
          const copy = [...(arr || [])];
          if (fromSetIdx >= copy.length || toSetIdx >= copy.length) return copy;
          const [moved] = copy.splice(fromSetIdx, 1);
          copy.splice(toSetIdx, 0, moved);
          return copy.map((st, i) => ({ ...st, setNumber: i + 1 }));
        };
        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            idx === exIdx ? reorderArray(list) : list
          );
          return {
            ...slot,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }
        const nextSets = reorderArray(slot.sets || []);
        return { ...slot, sets: nextSets, supersetSetsByExercise: [nextSets] };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  /**
   * Changes the equipment selection and swaps every untouched exercise in the open editor for
   * its closest equivalent with that equipment (e.g. Barbell Bench Press → Dumbbell Bench Press).
   * Slots with any set marked done are left alone. New weights come from the swapped exercise's own
   * history (+ increment), or else a conversion of the old exercise's 1RM (dumbbells ≈ 35% lower).
   */
  const handleChangeGymSelection = nextGymId => {
    setSelectedGymId(nextGymId);
    // Logged/historical workouts keep the exercises that were actually performed.
    if (currentView === 'historical_entry' || (currentView === 'history_editor' && expandedHistoryWorkoutId)) return;
    const editorWorkout = getCurrentEditorWorkout();
    if (!editorWorkout?.slots?.length) return;

    const slotHasDoneSet = slot =>
      [slot.sets, slot.secondarySets, ...(slot.supersetSetsByExercise || [])].some(
        list => Array.isArray(list) && list.some(st => st?.completed)
      );

    let swappedCount = 0;
    const swapSlot = slot => {
      if (!slot || slotHasDoneSet(slot)) return slot;
      const isSuperset = isSupersetCategory(slot.category);
      const oldIds = isSuperset
        ? (slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId]).filter(Boolean).slice(0, 2)
        : [slot.exerciseId].filter(Boolean);
      // Superset partners must stay distinct, so the second pick excludes the first.
      const newIds = [];
      oldIds.forEach(id => {
        newIds.push(findEquivalentExerciseForGym(id, nextGymId, gyms, newIds) || id);
      });
      if (newIds.every((id, i) => id === oldIds[i])) return slot;

      // Old exercise's 1RM: logged history first, then the estimate saved by a previous swap
      // (so swapping back and forth doesn't drift), then the library default.
      const getOld1RM = id =>
        getBestHistory1RM(id, history) > 0
          ? getHistoricalCalculated1RM(id, history, oneRepMaxes)
          : Number(slot.estimated1RMs?.[id]) || getHistoricalCalculated1RM(id, history, oneRepMaxes);
      const base1RMOverrides = {};
      newIds.forEach((id, i) => {
        if (id !== oldIds[i]) {
          base1RMOverrides[id] = convertEquivalent1RM(oldIds[i], id, getOld1RM(oldIds[i]));
        }
      });
      swappedCount += newIds.filter((id, i) => id !== oldIds[i]).length;

      const rebuilt = createWorkoutSlot({
        category: slot.category,
        slotLabel: slot.slotLabel,
        exerciseId: newIds[0],
        supersetExerciseIds: isSuperset ? newIds : [newIds[0]],
        scheme: slot.scheme,
        supersetSchemes: isSuperset ? getSupersetSchemes(slot) : null,
        oneRepMaxes,
        history,
        incrementLbs: currentIncrementLbs,
          setPreferences,
        restSeconds: slot.restSeconds || 90,
        userBodyweightLbs,
        base1RMOverrides
      });
      return {
        ...rebuilt,
        id: slot.id,
        estimated1RMs: { ...(slot.estimated1RMs || {}), ...base1RMOverrides },
        familyMuscleGroup: EXERCISE_MAP[newIds[0]]?.muscleGroup || slot.familyMuscleGroup,
        muscleGroupFilter: EXERCISE_MAP[newIds[0]]?.muscleGroup || slot.muscleGroupFilter
      };
    };

    const nextSlots = editorWorkout.slots.map(swapSlot);
    if (swappedCount === 0) return;
    updateCurrentWorkoutState(prev => (prev ? { ...prev, slots: prev.slots.map(swapSlot) } : prev));
    appendSessionLog?.(
      'GYM_SWAP',
      `Swapped ${swappedCount} exercise(s) for gym selection "${nextGymId || 'full_gym'}": ${nextSlots
        .map(s => s.exerciseId)
        .join(', ')}`
    );
  };

  // A superset is two full exercise pickers. Each half (0 = A, 1 = B) has its own type (Compound /
  // Accessory), muscle group, exercise and scheme; changing one half rebuilds only that half's sets.
  const supersetHalfState = slot => {
    const ids = [
      slot.supersetExerciseIds?.[0] || slot.exerciseId || 'reverse_lunge',
      slot.supersetExerciseIds?.[1] || slot.secondaryExerciseId || 'front_flies'
    ];
    const cats = ids.map((id, i) => {
      const cat = normalizeSlotCategory(slot.supersetCategories?.[i] || EXERCISE_MAP[id]?.category || 'Accessory');
      return isSupersetCategory(cat) ? 'Accessory' : cat;
    });
    const muscles = ids.map(
      (id, i) => slot.supersetMuscleFilters?.[i] || EXERCISE_MAP[id]?.muscleGroup || 'All Muscles'
    );
    const matrix = [
      slot.supersetSetsByExercise?.[0] || slot.sets || [],
      slot.supersetSetsByExercise?.[1] || slot.secondarySets || []
    ];
    return { ids, cats, muscles, schemes: getSupersetSchemes(slot), matrix };
  };

  const applySupersetHalfChange = (slot, changes) => {
    const half = changes.supersetHalf === 1 ? 1 : 0;
    const { ids, cats, muscles, schemes, matrix } = supersetHalfState(slot);
    let rebuildHalf = false;

    if (changes.category) {
      const cat = normalizeSlotCategory(changes.category);
      cats[half] = isSupersetCategory(cat) ? cats[half] : cat;
    }
    if (changes.muscleGroupFilter !== undefined) muscles[half] = changes.muscleGroupFilter;
    const equipmentFilters = [slot.supersetEquipmentFilters?.[0], slot.supersetEquipmentFilters?.[1]];
    if (changes.equipmentFilter !== undefined) equipmentFilters[half] = changes.equipmentFilter;
    if (changes.scheme && changes.scheme !== schemes[half]) {
      schemes[half] = changes.scheme;
      rebuildHalf = true;
    }
    if (changes.exerciseId && changes.exerciseId !== ids[half]) {
      ids[half] = changes.exerciseId;
      rebuildHalf = true;
      if (changes.muscleGroupFilter === undefined) {
        muscles[half] = EXERCISE_MAP[changes.exerciseId]?.muscleGroup || muscles[half];
      }
    }

    // Filters cover the whole library; only the default exercise picked below prefers the athlete's equipment
    const availMuscles = getAvailableMuscleGroupsForCategory(cats[half], '', []);
    if (!availMuscles.includes(muscles[half])) muscles[half] = 'All Muscles';

    if (!changes.exerciseId && (changes.category || changes.muscleGroupFilter !== undefined)) {
      const pool = preferAvailable(
        getFilteredExercisesForSlotInline({ category: cats[half], muscleGroupFilter: muscles[half] }, '', [])
      ).filter(ex => ex.id !== ids[1 - half]);
      if (pool.length > 0 && !pool.some(ex => ex.id === ids[half])) {
        ids[half] = pool[0].id;
        rebuildHalf = true;
      }
    }

    if (rebuildHalf) {
      // Both exercises run the same number of rounds (the other half's count, default SUPERSET_SET_COUNT)
      const rounds = (matrix[1 - half] || []).length || SUPERSET_SET_COUNT;
      matrix[half] = applyGoalProgressToSets(
        trimSetsTo(
          generateSetsForScheme(
            schemes[half],
            getHistoricalCalculated1RM(ids[half], history, oneRepMaxes),
            'Superset',
            ids[half],
            currentIncrementLbs,
            userBodyweightLbs,
            setPreferences
          ),
          rounds
        ),
        { exerciseId: ids[half], scheme: schemes[half], history, oneRepMaxes, incrementLbs: currentIncrementLbs }
      );
    }
    const targetReps = [slot.supersetTargetReps?.[0] ?? null, slot.supersetTargetReps?.[1] ?? null];
    if (changes.scheme) targetReps[half] = null;

    return {
      ...slot,
      category: 'Superset',
      exerciseId: ids[0],
      secondaryExerciseId: ids[1],
      supersetExerciseIds: ids,
      supersetCategories: cats,
      supersetMuscleFilters: muscles,
      supersetSchemes: schemes,
      supersetEquipmentFilters: equipmentFilters,
      supersetTargetReps: targetReps,
      scheme: schemes[0],
      muscleGroupFilter: muscles[0],
      supersetSetsByExercise: matrix,
      sets: matrix[0],
      secondarySets: matrix[1]
    };
  };

  // "Remove from superset" on half `removedHalf`: the slot becomes the other exercise on its own, sets kept
  const endSuperset = (slot, removedHalf) => {
    const keep = removedHalf === 1 ? 0 : 1;
    const { ids, cats, muscles, schemes, matrix } = supersetHalfState(slot);
    const rebuilt = createWorkoutSlot({
      category: cats[keep],
      slotLabel: cats[keep],
      exerciseId: ids[keep],
      scheme: schemes[keep],
      oneRepMaxes,
      history,
      incrementLbs: currentIncrementLbs,
          setPreferences,
      restSeconds: slot.restSeconds || 90,
      userBodyweightLbs
    });
    const keptSets = (matrix[keep] || []).map((st, i) => ({ ...st, setNumber: i + 1 }));
    const sets = keptSets.length > 0 ? keptSets : rebuilt.sets;
    return {
      ...rebuilt,
      id: slot.id,
      familyMuscleGroup: slot.familyMuscleGroup,
      muscleGroupFilter: muscles[keep],
      equipmentFilter: slot.supersetEquipmentFilters?.[keep],
      sets,
      supersetSetsByExercise: [sets]
    };
  };

  // One max single ("1 rep max bench" in the exercise search): the exercise becomes one 1 Rep Max set — your
  // calculated 1RM + the increment, the same as picking the 1 Rep Max set type — after any sets already done.
  // Single exercises only.
  const makeSingleMax = slotId => {
    const stamp = Date.now();
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      return withTrace('1 REP MAX', () => ({
        ...prev,
        slots: prev.slots.map(slot => {
          if (slot.id !== slotId || isSupersetCategory(slot.category)) return slot;
          const list = slot.sets || [];
          const done = list.filter(st => st?.completed);
          const base = list.find(st => st && !st.completed) || list[list.length - 1];
          if (!base) return slot;
          const exId = slot.exerciseId;
          const isBw = isBodyweightExercise(exId);
          const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
          const effInc = isBw ? 0 : getEffectiveIncrementForExercise(exId, currentIncrementLbs, calc1RM);
          const weight = isBw ? base.weight : roundToIncrement(roundTo5(calc1RM) + effInc);
          if (isTracing()) traceLine(`${EXERCISE_MAP[exId]?.name || exId} set ${done.length + 1} 1 Rep Max: 1RM ${fmt(calc1RM)} + increment ${fmt(effInc)} → ${fmt(weight)} lb × 1`);
          const single = {
            ...base,
            id: base.completed ? `set_${stamp}_max` : base.id,
            type: '1 Rep Max',
            reps: 1,
            weight,
            completed: false,
            lockWeight: false,
            lockIntensity: false,
            lockReps: undefined,
            lockType: undefined,
            intensity: intensityOn(prev) ? { mode: 'rir', value: 0 } : null,
            lastEditedField: 'type'
          };
          const sets = [...done, single].map((st, i) => ({ ...st, setNumber: i + 1 }));
          return fillIntensities({ ...slot, sets, supersetSetsByExercise: [sets], targetReps: 1 }, prev);
        })
      }), `max:${slotId}`);
    });
  };

  // A shape from a sentence in the exercise search ("bench 5 x 8", "curls 3 sets of 12"): the exercise is rebuilt
  // from scratch — the matching scheme when there is one (3x5 … 8x8), else the goal's — to that set count and those
  // reps, and its weights re-planned for them (as RESET / RECALCULATE would). Sets already done stay first.
  // A superset (both exercises already set): its set count and reps, then the weights re-planned.
  // A named scheme (Pyramid 1RM, Reverse Pyramid, Pyramid, Cluster) rebuilds on that scheme with its own sets and reps.
  // Reps you said are locked (they're what you asked for): a bodyweight exercise's reps are otherwise re-planned from
  // the load ("12 sets of 10 push-ups" must stay 10, not drift to what your bodyweight allows).
  const lockSaidReps = list => (list || []).map(st => (st && !st.completed && !st.durationSeconds ? { ...st, lockReps: true } : st));
  const applySentenceShape = (slotId, { sets = null, reps = null, scheme: saidScheme = null } = {}) => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      return withTrace('SET UP', () => ({
        ...prev,
        slots: prev.slots.map(slot => {
          if (slot.id !== slotId) return slot;
          if (isSupersetCategory(slot.category)) {
            let sup = slot;
            if (sets) sup = reshapeSlot(sup, { setCount: sets, supersetHalf: 0 });
            if (reps) {
              [0, 1].forEach(h => (sup = reshapeSlot(sup, { targetReps: reps, supersetHalf: h })));
              const matrix = (sup.supersetSetsByExercise || []).map(lockSaidReps);
              sup = { ...sup, supersetSetsByExercise: matrix, sets: matrix[0] || [], secondarySets: matrix[1] || [] };
            }
            return isProgrammedSlot(sup, programContextFor(prev)) ? programSlot(sup, prev) : recalculateSlot(sup, prev.id);
          }
          const named = saidScheme || (sets && reps && SCHEME_OPTIONS.includes(`${sets}x${reps}`) ? `${sets}x${reps}` : null);
          const scheme = named || defaultScheme;
          const fresh = createWorkoutSlot({
            category: slot.category,
            slotLabel: slot.category,
            exerciseId: slot.exerciseId,
            supersetExerciseIds: [slot.exerciseId],
            scheme,
            oneRepMaxes,
            history,
            incrementLbs: currentIncrementLbs,
            setPreferences,
            restSeconds: slot.restSeconds || 90,
            userBodyweightLbs
          });
          const done = (slot.sets || []).filter(st => st?.completed);
          let next = { ...slot, scheme, targetReps: null, programOff: true, sets: fresh.sets, supersetSetsByExercise: [fresh.sets] };
          if (sets && !named) next = reshapeSlot(next, { setCount: sets });
          if (reps && !named) next = reshapeSlot(next, { targetReps: reps });
          if (reps) {
            const locked = lockSaidReps(next.sets);
            next = { ...next, sets: locked, supersetSetsByExercise: [locked] };
          }
          next = recalculateSlot(next, prev.id);
          if (done.length > 0) {
            const all = [...done, ...(next.sets || [])].map((st, i) => ({ ...st, setNumber: i + 1 }));
            next = { ...next, sets: all, supersetSetsByExercise: [all] };
          }
          return next;
        })
      }), `shape:${slotId}`);
    });
  };

  const handleUpdateSlotCategoryOrExercise = (slotId, changes) => {
    if (changes?.singleMax) {
      makeSingleMax(slotId);
      return;
    }
    if (changes?.sentenceShape) {
      applySentenceShape(slotId, changes.sentenceShape);
      return;
    }
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const next = withTrace(`CHANGE · ${Object.keys(changes || {}).join(', ')}`, () => applySlotHeaderChange(prev, slotId, changes), `change:${slotId}`);
      // The exercise's own REST stays through exercise / type / muscle / equipment / variation changes
      const before = (prev.slots || []).find(sl => sl.id === slotId);
      // (Turning Cluster on or off sets the rest itself)
      const clusterSwitch = changes?.category && isClusterCategory(changes.category) !== isClusterCategory(before?.category);
      if (clusterSwitch || !before?.customRestSeconds || changes?.customRestSeconds !== undefined || !Array.isArray(next?.slots)) return next;
      return {
        ...next,
        slots: next.slots.map(sl => (sl.id === slotId && !sl.customRestSeconds ? { ...sl, customRestSeconds: before.customRestSeconds } : sl))
      };
    });
  };

  const applySlotHeaderChange = (prev, slotId, changes) => {
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;
        // REST box in the filter row: this exercise's own rest (null = the session's rest bar setting)
        if (changes.customRestSeconds !== undefined) return { ...slot, customRestSeconds: changes.customRestSeconds || null };
        // SETS / REPS boxes of the scheme row
        if (changes.setCount !== undefined || changes.targetReps !== undefined) return fillIntensities(reshapeSlot(slot, changes), prev);
        if (isSupersetCategory(slot.category) && changes.endSuperset !== undefined) {
          const single = endSuperset(slot, changes.endSuperset);
          const wanted = changes.category ? normalizeSlotCategory(changes.category) : null;
          if (!wanted || isSupersetCategory(wanted) || wanted === single.category) return single;
          // Ended by picking another type: the exercise stays (whatever type the library files it under), sets kept
          return { ...single, category: wanted, slotLabel: wanted };
        }
        if (isSupersetCategory(slot.category) && changes.supersetHalf !== undefined) {
          return applySupersetHalfChange(slot, changes);
        }
        // Equipment filter only (the exercise already allows it): nothing to rebuild
        if (Object.keys(changes).every(key => key === 'equipmentFilter')) {
          return { ...slot, equipmentFilter: changes.equipmentFilter };
        }
        const currentEx = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
        const targetMuscleGroup =
          changes.exerciseId && EXERCISE_MAP[changes.exerciseId]
            ? EXERCISE_MAP[changes.exerciseId].muscleGroup
            : slot.familyMuscleGroup || currentEx.muscleGroup || 'Chest';

        let nextCategory = normalizeSlotCategory(changes.category ?? slot.category);
        // Filters cover the whole library; only default exercise picks prefer the athlete's equipment
        const availMuscleGroups = getAvailableMuscleGroupsForCategory(nextCategory, '', []);
        let rawNextMuscleFilter;
        if (changes.muscleGroupFilter !== undefined) {
          rawNextMuscleFilter = changes.muscleGroupFilter;
        } else if (changes.exerciseId && EXERCISE_MAP[changes.exerciseId]?.muscleGroup) {
          rawNextMuscleFilter = EXERCISE_MAP[changes.exerciseId].muscleGroup;
        } else if (changes.category) {
          const prevMg = slot.muscleGroupFilter || currentEx.muscleGroup || 'All Muscles';
          const hasInNewCat =
            prevMg === 'All Muscles' ||
            isSupersetCategory(nextCategory) ||
            EXERCISE_LIBRARY.some(e => e.category === nextCategory && e.muscleGroup === prevMg);
          rawNextMuscleFilter = hasInNewCat ? prevMg : 'All Muscles';
        } else {
          rawNextMuscleFilter = slot.muscleGroupFilter || currentEx.muscleGroup || 'All Muscles';
        }
        let nextMuscleFilter = availMuscleGroups.includes(rawNextMuscleFilter)
          ? rawNextMuscleFilter
          : 'All Muscles';
        const nextScheme = changes.scheme ?? slot.scheme;
        let nextExId = changes.exerciseId ?? slot.exerciseId;
        let nextSupersetIds =
          changes.supersetExerciseIds ??
          slot.supersetExerciseIds ??
          [nextExId, slot.secondaryExerciseId].filter(Boolean);

        const candidatePool = preferAvailable(
          getFilteredExercisesForSlotInline({ ...slot, category: nextCategory, muscleGroupFilter: nextMuscleFilter }, '', [])
        );

        if (
          isSupersetCategory(slot.category) &&
          isSupersetCategory(nextCategory) &&
          changes.supersetExerciseIds &&
          !changes.scheme &&
          !changes.category &&
          changes.muscleGroupFilter === undefined
        ) {
          const cleanIds = [
            changes.supersetExerciseIds[0] || slot.exerciseId || 'reverse_lunge',
            changes.supersetExerciseIds[1] || slot.secondaryExerciseId || 'front_flies'
          ];
          const prevMatrix = slot.supersetSetsByExercise || [slot.sets || [], slot.secondarySets || []];
          const updatedMatrix = cleanIds.map((id, idx) => {
            const existingList =
              Array.isArray(prevMatrix[idx]) && prevMatrix[idx].length > 0
                ? prevMatrix[idx]
                : prevMatrix[0] || [];
            const isBw = isBodyweightExercise(id);
            const bwDefault = Math.max(0, Number(userBodyweightLbs) || 220);
            const calcMax = getHistoricalCalculated1RM(id, history, oneRepMaxes);
            const effInc = isBw ? 0 : getEffectiveIncrementForExercise(id, currentIncrementLbs);
            const totalCount = existingList.length || 5;
            return existingList.map((st, sIdx) => {
              const lastW = isBw
                ? bwDefault
                : calculateLastEquivalentWeightForSet(calcMax, st, totalCount, 'Superset', sIdx, slot.scheme);
              const nextW = isBw
                ? bwDefault
                : st.type === '1 Rep Max'
                  ? roundTo5(calcMax)
                  : roundToIncrement(lastW + effInc);
              return { ...st, setNumber: sIdx + 1, lastWeight: lastW, increment: isBw || st.type === '1 Rep Max' ? 0 : effInc, weight: nextW };
            });
          });

          return {
            ...slot,
            category: 'Superset',
            muscleGroupFilter: nextMuscleFilter,
            exerciseId: cleanIds[0],
            secondaryExerciseId: cleanIds[1],
            supersetExerciseIds: cleanIds,
            supersetSetsByExercise: updatedMatrix,
            sets: updatedMatrix[0] || [],
            secondarySets: updatedMatrix[1] || []
          };
        }

        // A type change alone (Compound / Accessory / Cluster / Superset) keeps the exercise picked
        const keepForType =
          Boolean(changes.category) && changes.muscleGroupFilter === undefined && Boolean(EXERCISE_MAP[slot.exerciseId]);
        if ((changes.category || changes.muscleGroupFilter !== undefined) && !changes.exerciseId) {
          if (isSupersetCategory(nextCategory)) {
            // Into a superset: A = the exercise picked, B = a partner for it
            const exA =
              keepForType && !isSupersetCategory(slot.category)
                ? slot.exerciseId
                : candidatePool.some(e => e.id === nextSupersetIds[0])
                  ? nextSupersetIds[0]
                  : (candidatePool[0] || currentEx).id;
            const exB = candidatePool.some(e => e.id === nextSupersetIds[1] && e.id !== exA)
              ? nextSupersetIds[1]
              : (candidatePool.find(e => e.id !== exA) || candidatePool[0] || EXERCISE_MAP.front_flies).id;
            nextExId = exA;
            nextSupersetIds = [exA, exB];
          } else if (keepForType) {
            nextExId = slot.exerciseId;
            const exMuscle = EXERCISE_MAP[nextExId]?.muscleGroup;
            if (exMuscle && !doesExerciseInteractWithMuscleGroup(EXERCISE_MAP[nextExId], slot.muscleGroupFilter)) {
              nextMuscleFilter = exMuscle;
            } else {
              nextMuscleFilter = slot.muscleGroupFilter || exMuscle || 'All Muscles';
            }
          } else {
            if (!candidatePool.some(e => e.id === nextExId)) {
              nextExId = (candidatePool[0] || currentEx).id;
            }
            if (
              changes.muscleGroupFilter !== undefined &&
              !changes.category &&
              EXERCISE_MAP[nextExId]?.category &&
              EXERCISE_MAP[nextExId].category !== nextCategory
            ) {
              nextCategory = normalizeSlotCategory(EXERCISE_MAP[nextExId].category);
            }
            if (changes.category && nextMuscleFilter === 'All Muscles' && EXERCISE_MAP[nextExId]?.muscleGroup) {
              nextMuscleFilter = EXERCISE_MAP[nextExId].muscleGroup;
            }
          }
        }

        // A plank swapped in starts on Timer; swapping a timed plank for another exercise goes back to the goal's
        // scheme. A scheme the athlete picks in this change always wins.
        const swappedExercise = nextExId !== slot.exerciseId && !isSupersetCategory(nextCategory);
        // Type CLUSTER: the Cluster scheme (3 × 18) and 15 s rest; leaving it goes back to the goal's scheme
        const toCluster = isClusterCategory(nextCategory) && !isClusterCategory(slot.category);
        const fromCluster = !isClusterCategory(nextCategory) && isClusterCategory(slot.category);
        const slotScheme =
          changes.scheme !== undefined
            ? nextScheme
            : toCluster
              ? CLUSTER_SCHEME
              : fromCluster && nextScheme === CLUSTER_SCHEME
                ? defaultScheme
                : !swappedExercise
                  ? nextScheme
                  : isTimedHoldExercise(nextExId)
                    ? 'Timer'
                    : nextScheme === 'Timer' && isTimedHoldExercise(slot.exerciseId)
                      ? defaultScheme
                      : nextScheme;

        const rebuiltSlot = createWorkoutSlot({
          category: nextCategory,
          slotLabel: nextCategory,
          exerciseId: nextExId,
          supersetExerciseIds: isSupersetCategory(nextCategory) ? nextSupersetIds.slice(0, 2) : [nextExId],
          scheme: slotScheme,
          oneRepMaxes,
          history,
          incrementLbs: currentIncrementLbs,
          setPreferences,
          restSeconds: slot.restSeconds || 90,
          userBodyweightLbs
        });

        const rebuiltResult = {
          ...rebuiltSlot,
          id: slot.id,
          familyMuscleGroup: targetMuscleGroup,
          muscleGroupFilter: nextMuscleFilter,
          equipmentFilter: changes.equipmentFilter ?? slot.equipmentFilter,
          ...(toCluster
            ? { customRestSeconds: CLUSTER_REST_SECONDS }
            : fromCluster
              ? { customRestSeconds: slot.customRestSeconds === CLUSTER_REST_SECONDS ? null : slot.customRestSeconds || null }
              : {}),
          // A scheme picked by hand takes the exercise off the program (it keeps that scheme)
          programOff: changes.scheme !== undefined && changes.scheme !== slot.scheme ? true : slot.programOff,
          // A program day's slot stays that slot (its rule plans the new exercise)
          ...(slot.programRef ? { programRef: slot.programRef } : {})
        };
        // Covered by the program (Society's compounds): the program week sets the scheme, sets and weights
        if (isProgrammedSlot(rebuiltResult, programContextFor(prev))) return programSlot(rebuiltResult, prev);
        // Same scheme (a new exercise, type or muscle group): keep the athlete's SETS / REPS choice
        const keepShape =
          slotScheme === slot.scheme && !isSupersetCategory(nextCategory) && !isSupersetCategory(slot.category);
        const prevCount = (slot.sets || []).length;
        if (keepShape && (slot.targetReps || (prevCount > 0 && prevCount !== rebuiltResult.sets.length))) {
          const shaped = reshapeSlot(rebuiltResult, {
            setCount: prevCount || rebuiltResult.sets.length,
            ...(slot.targetReps ? { targetReps: slot.targetReps } : {})
          });
          // A newly picked exercise: its weights are worked out for the carried-over REPS (the REPS box itself
          // never changes weights)
          return slot.targetReps ? recalculateSlot(shaped, prev.id) : shaped;
        }
        return rebuiltResult;
      });
      return { ...prev, slots: nextSlots };
  };

  /**
   * Live adjustment (live session, exercises planned by effort, not a program's): once working sets are done, what
   * they say (their 1RM, from the weight, reps and the RIR you report) replaces the plan's 1RM for the sets still to
   * do when the two differ by 2 % or more — a first set that felt easier than planned makes the rest heavier, harder
   * makes them lighter. Locked values and done sets stay.
   */
  const LIVE_ADJUST_MIN_SHARE = 0.02;
  const autoregulateSlot = (slot, workout, exIndex) => {
    if (!slot || currentView !== 'session' || isProgrammedSlot(slot, programContextFor(workout))) return slot;
    const isSup = Array.isArray(slot.supersetSetsByExercise) && slot.supersetSetsByExercise.length > 1;
    const half = isSup ? exIndex : 0;
    const schemes = isSup ? getSupersetSchemes(slot) : [slot.scheme];
    if (!EFFORT_PLANNED_SCHEMES.includes(schemes[half])) return slot;
    const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
    const exId = isSup ? ids[half] : slot.exerciseId;
    const list = (isSup ? slot.supersetSetsByExercise[half] : slot.sets) || [];
    const option = getSlotEquipmentChoice(slot, half);
    const done = list.filter(st => st?.completed && normalizeSetType(st.type) !== 'Warmup' && !st.durationSeconds);
    if (done.length === 0 || !list.some(st => st && !st.completed)) return slot;
    const observed = exercise1RMInfoOfSets(withEffectiveLoad(exId, done, option), exId).value;
    const planned = getBestHistory1RM(exId, history) > 0 ? effort1RM(exId, option, workout) : 0;
    if (!(observed > 0) || (planned > 0 && Math.abs(observed - planned) / planned < LIVE_ADJUST_MIN_SHARE)) return slot;
    return withTrace(
      'LIVE ADJUST',
      () => {
        if (isTracing()) {
          traceLine(`${EXERCISE_MAP[exId]?.name || exId}: the sets done so far say 1RM ${fmt(observed)} lb${planned > 0 ? ` (planned ${fmt(planned)})` : ''} → the sets still to do re-planned from it`);
        }
        const overrides = { [half]: observed };
        return fillIntensities(planEffort(slot, null, workout, overrides), workout, overrides);
      },
      `live:${slot.id}`
    );
  };

  /**
   * One set after a hand edit: weight, reps and intensity are tied by the 1RM, so the open one follows the locked
   * ones. A locked intensity is a target: the weight follows it (or, weight locked, the reps). With weight and reps
   * both locked it is a report of how the set went, and nothing moves (its 1RM does). An unlocked intensity is
   * worked out afterwards by fillIntensities. Done and Timer sets aren't solved.
   */
  const solveEditedSet = (slot, exIndex, setId, workout) => {
    if (!slot) return slot;
    const isSup = Array.isArray(slot.supersetSetsByExercise) && slot.supersetSetsByExercise.length > 1;
    const half = isSup ? exIndex : 0;
    const scheme = (isSup ? getSupersetSchemes(slot) : [slot.scheme])[half];
    if (scheme === 'Timer') return slot;
    const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
    const exId = isSup ? ids[half] : slot.exerciseId;
    const list = (isSup ? slot.supersetSetsByExercise[half] : slot.sets) || [];
    const idx = list.findIndex(st => st?.id === setId);
    const st = list[idx];
    if (!st || st.completed || st.durationSeconds || !st.lockIntensity || !st.intensity) return slot;
    // Reps are locked by default (not set = locked)
    const repsLocked = st.lockReps ?? true;
    if (st.lockWeight && repsLocked) return slot;
    const eff = { ...st, lockReps: repsLocked };
    const option = getSlotEquipmentChoice(slot, half);
    const oneRM = effort1RM(exId, option, workout);
    if (!(oneRM > 0)) return slot;
    const effInc = getEffectiveIncrementForExercise(exId, currentIncrementLbs, oneRM);
    const step = effInc > 0 ? Math.min(2.5, effInc) : 2.5;
    let solved;
    if (isBodyweightExercise(exId)) {
      if (!countsBodyweight(exId)) return slot;
      solved = solveBodyweightSet(eff, eff, oneRM, exId, option, step);
    } else {
      const fatigueReps =
        normalizeSetType(st.type) === 'Warmup' ? 0 : fatigueRateFor(exId) * priorHardSets(list, idx) * restFatigueFactor(plannedRestSeconds(slot, workout));
      solved = solveSet(eff, oneRM, { step, fatigueReps, exerciseId: exId });
    }
    if (!solved || solved === eff) return slot;
    solved = { ...solved, lockReps: st.lockReps };
    const nextList = list.map((x, i) => (i === idx ? solved : x));
    if (isSup) {
      const matrix = slot.supersetSetsByExercise.map((l, i) => (i === half ? nextList : l));
      return { ...slot, supersetSetsByExercise: matrix, sets: matrix[0] || [], secondarySets: matrix[1] || [] };
    }
    return { ...slot, sets: nextList, supersetSetsByExercise: [nextList] };
  };

  /**
   * RESET (the exercise card's bottom row): every box unlocked and the exercise put back as it was when it was
   * loaded (slot.resetSnapshot: its scheme, sets and plan). Sets marked done stay as they are.
   */
  const handleResetSlot = slotId => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      return withTrace(
        'RESET',
        () => ({
          ...prev,
          slots: prev.slots.map(slot => {
            if (slot.id !== slotId) return slot;
            const snap = slot.resetSnapshot?.slot || slot;
            const unlock = (list, current) => {
              const doneById = new Map((current || []).filter(st => st?.completed).map(st => [st.id, st]));
              return (list || []).map(st =>
                // Back to the default locks: type and reps locked (not set), weight and intensity open
                !st ? st : doneById.get(st.id) || { ...st, lockType: undefined, lockWeight: false, lockReps: undefined, lockIntensity: false }
              );
            };
            const isSup = Array.isArray(snap.supersetSetsByExercise) && snap.supersetSetsByExercise.length > 1;
            let restored;
            if (isSup) {
              const matrix = snap.supersetSetsByExercise.map((l, i) => unlock(l, (slot.supersetSetsByExercise || [])[i]));
              restored = { ...slot, ...snap, supersetSetsByExercise: matrix, sets: matrix[0] || [], secondarySets: matrix[1] || [] };
            } else {
              const sets = unlock(snap.sets, slot.sets);
              restored = { ...slot, ...snap, sets, supersetSetsByExercise: [sets] };
            }
            if (isTracing()) traceLine(`${EXERCISE_MAP[slot.exerciseId]?.name || slot.exerciseId}: back to how it was loaded, every box unlocked`);
            return fillIntensities({ ...restored, resetSnapshot: slot.resetSnapshot }, prev);
          })
        }),
        `reset:${slotId}`
      );
    });
  };

  // The prediction log: a set keeps what the app planned for it (weight, reps, RIR) the first time you change it or
  // tick it, so History can show how often you did what was planned (utils/modelLearning.js planFollowThrough)
  const withPlan = st => {
    // (live sessions only: a History edit or a preview has no plan to keep)
    if (currentView !== 'session' || !st || st.plan || st.completed || st.durationSeconds || !(Number(st.weight) > 0)) return st;
    const rir = st.intensity ? Math.round(setReportedRir(st) * 10) / 10 : null;
    return { ...st, plan: { weight: Number(st.weight), reps: Number(st.reps) || 0, rir } };
  };

  const handleUpdateSetField = (slotId, exIndex, setId, field, rawVal) => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;

        const applyFieldChange = (rawSt, exId, totalCount, sIdx, listScheme = slot.scheme) => {
          if (rawSt.id !== setId) return rawSt;
          // The app's plan for the set, kept the first time it is changed (the prediction log)
          const st = withPlan(rawSt);
          // Band exercises: the load is a band colour, not a weight
          if (field === 'bandColor') return { ...st, bandColor: rawVal };
          // Programs other than Crying: the set's intensity ({ mode: 'pct' | 'rir' | 'rpe', value })
          // An intensity applied by hand is a target, like a typed weight: it locks, so RECALCULATE (and the
          // program) works the weight / reps out from it instead of putting the plan back; CLEAR unlocks it
          if (field === 'intensity') {
            const hasValue = rawVal && rawVal.value !== null && rawVal.value !== undefined && rawVal.value !== '';
            // The planned RIR (the worked-out one) is kept the first time you enter your own, so the next session can
            // tell whether this one came in harder or easier than planned (lastSessionEffortGap)
            // (no worked-out intensity, e.g. SIMPLE mode's effort question: the set type's planned effort)
            const plannedRir =
              st.plannedRir ??
              (st.intensity?.auto && !st.durationSeconds
                ? Math.round(setReportedRir(st) * 10) / 10
                : !st.durationSeconds && SET_TYPE_RIR[normalizeSetType(st.type)] !== undefined
                  ? SET_TYPE_RIR[normalizeSetType(st.type)]
                  : undefined);
            return {
              ...st,
              intensity: hasValue ? rawVal : null,
              lockIntensity: Boolean(hasValue),
              ...(plannedRir !== undefined ? { plannedRir } : {})
            };
          }
          const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
          const lastW =
            st.lastWeight !== undefined
              ? st.lastWeight
              : calculateLastEquivalentWeightForSet(calc1RM, st, totalCount, slot.category, sIdx, listScheme, exId);

          if (field === 'increment') {
            const rawStr = String(rawVal ?? '');
            const cleanStr = rawStr.replace(/^\+/, '');
            if (cleanStr === '' || cleanStr === '-' || cleanStr === '.' || cleanStr === '-.') {
              return { ...st, increment: cleanStr, weight: Math.max(0, roundToIncrement(lastW)), lastEditedField: 'weight' };
            }
            const incNum = Number(cleanStr);
            const safeInc = Number.isNaN(incNum) ? 0 : incNum;
            const nextWeight = Math.max(0, roundToIncrement(lastW + safeInc));
            return {
              ...st,
              increment: cleanStr.endsWith('.') ? cleanStr : safeInc,
              weight: nextWeight,
              lastEditedField: 'weight',
              lockWeight: true
            };
          }

          if (field === 'timer') {
            const sec = parseTimerDurationSeconds(rawVal);
            const mmss = formatSecondsToMMSS(sec, true);
            return {
              ...st,
              reps: sec,
              durationSeconds: sec,
              timerStr: mmss,
              lastEditedField: 'timer',
              lockReps: true
            };
          }

          const val = Math.max(0, Number(rawVal) || 0);
          // A weight or reps entered by hand locks (solveEditedSet then works out whichever of the three is open)
          if (field === 'weight') {
            const nextInc = Math.round((val - lastW) * 100) / 100;
            return { ...st, weight: val, increment: nextInc, lastEditedField: 'weight', lockWeight: true };
          }

          if (field === 'reps') {
            return { ...st, reps: Math.max(1, val), lastEditedField: 'reps', lockReps: true };
          }

          return { ...st, [field]: val };
        };

        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
          const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            idx === exIndex
              ? list.map((st, sIdx) =>
                  applyFieldChange(st, supIds[idx] || slot.exerciseId, list.length, sIdx, getSupersetSchemes(slot)[idx])
                )
              : list
          );
          return {
            ...slot,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }
        const totalLen = (slot.sets || []).length;
        const nextSets = (slot.sets || []).map((st, sIdx) => applyFieldChange(st, slot.exerciseId, totalLen, sIdx));
        return { ...slot, sets: nextSets };
      });
      // A new weight or reps: worked-out intensities follow (hand-set ones wait for RECALCULATE). A done set's
      // weight, reps or intensity (how it really went) re-plans the sets still to do (autoregulateSlot)
      const editedDone = ['weight', 'reps', 'intensity'].includes(field) && (() => {
        const sl = nextSlots.find(x => x.id === slotId);
        const lst = (Array.isArray(sl?.supersetSetsByExercise) && sl.supersetSetsByExercise.length > 1 ? sl.supersetSetsByExercise[exIndex] : sl?.sets) || [];
        return Boolean(lst.find(st => st?.id === setId)?.completed);
      })();
      return {
        ...prev,
        slots: nextSlots.map(slot => {
          if (slot.id !== slotId) return slot;
          // The open one of weight / reps / intensity follows the locked ones (solveEditedSet), then every unlocked
          // intensity is re-worked (fillIntensities)
          const filled = fillIntensities(solveEditedSet(slot, exIndex, setId, prev), prev);
          return editedDone ? autoregulateSlot(filled, prev, exIndex) : filled;
        })
      };
    });
  };

  // Set type change (the set row's dropdown) re-works that set's weight and reps from the exercise's working set
  // (another Working set of the exercise, else the scheme's working set for this position):
  //   Working = the working weight and reps; Warm-up = same reps, lighter (× 0.74 / 0.98, the warm-up effort);
  //   Top Out = same reps, heavier (× 1.04 / 0.98); Burn Out = the working weight, 2 more reps;
  //   1 Rep Max = the calculated 1RM from History, 1 rep (+ the increment on the last set).
  // A locked weight or reps value stays; Timer sets keep their time; bodyweight exercises keep their weight.
  const handleUpdateSetType = (slotId, exIndex, setId, newType) => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      // Programs that use intensity: the new type sets the set's intensity (SET_TYPE_RIR), unless it is locked
      const typeIntensity = getProgram(prev.program || trainingProgram).usesIntensity ? SET_TYPE_RIR[newType] : undefined;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;
        const isSup = isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise);

        const retypeList = (list, exId, listScheme, targetReps) => {
          const sets = Array.isArray(list) ? list : [];
          const idx = sets.findIndex(st => st.id === setId);
          if (idx < 0) return sets;
          const st = sets[idx];
          const total = sets.length;
          const isBw = isBodyweightExercise(exId);
          const isTimer = listScheme === 'Timer';
          const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
          const effInc = getEffectiveIncrementForExercise(exId, currentIncrementLbs);
          const step = effInc > 0 ? Math.min(2.5, effInc) : 2.5;
          const roundW = w => Math.max(0, Math.round(w / step) * step);
          let weight;
          let reps;
          if (newType === '1 Rep Max') {
            const maxW = roundTo5(calc1RM);
            weight = roundToIncrement(maxW + (idx === total - 1 ? effInc : 0));
            reps = 1;
          } else {
            const ref = sets.find(o => o.id !== setId && normalizeSetType(o.type) === 'Working' && Number(o.weight) > 0);
            const refReps = ref
              ? Math.max(1, Number(ref.reps) || 1)
              : getTargetRepsForSet(listScheme, idx, total, targetReps) || Math.max(1, Number(st.reps) || 8);
            const refWeight = ref
              ? Number(ref.weight)
              : roundToIncrement(
                  calculateLastEquivalentWeightForSet(
                    calc1RM,
                    { type: 'Working', reps: refReps },
                    total,
                    slot.category,
                    idx,
                    listScheme,
                    exId
                  ) + effInc
                );
            const [w, r] = setTypeTarget(newType, refWeight, refReps);
            weight = roundW(w);
            reps = r;
          }
          if (isBw || st.lockWeight) weight = st.weight;
          if (isTimer || st.lockReps) reps = st.reps;
          const lastW = Number(st.lastWeight);
          const next = {
            ...st,
            type: newType,
            weight,
            reps,
            increment: Number.isFinite(lastW) && lastW > 0 ? Math.round((Number(weight) - lastW) * 100) / 100 : st.increment,
            lastEditedField: 'type',
            ...(typeIntensity !== undefined && !st.lockIntensity && !isTimer ? { intensity: { mode: 'rir', value: typeIntensity } } : {})
          };
          return sets.map((o, i) => (i === idx ? next : o));
        };

        if (isSup) {
          const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            idx === exIndex
              ? retypeList(list, supIds[idx] || slot.exerciseId, getSupersetSchemes(slot)[idx], slot.supersetTargetReps?.[idx])
              : list
          );
          return {
            ...slot,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }
        const nextSets = retypeList(slot.sets || [], slot.exerciseId, slot.scheme, slot.targetReps);
        return { ...slot, sets: nextSets, supersetSetsByExercise: [nextSets] };
      });
      // The new type's weight / reps, with the intensity that is true to you
      // (the changed set planned at its new type's effort)
      return { ...prev, slots: nextSlots.map(sl => (sl.id === slotId ? fillIntensities(planEffort(sl, setId, prev), prev) : sl)) };
    });
  };

  const handleInsertSetAtPosition = (slotId, position = 'bottom') => {
    const isTop = position === 'top';
    const defaultSetType = isTop ? 'Warmup' : 'Burn Out';
    const ts = Date.now() + Math.floor(Math.random() * 10000);

    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;

        const insertIntoList = (list, exId, listScheme = slot.scheme) => {
          const currentList = Array.isArray(list) ? list : [];
          const refSet = isTop ? currentList[0] : currentList[currentList.length - 1];
          const base1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
          const effInc = getEffectiveIncrementForExercise(exId, currentIncrementLbs);
          const nextCount = currentList.length + 1;
          const isTimerScheme = listScheme === 'Timer';
          const newReps = isTimerScheme
            ? refSet?.durationSeconds || 120
            : refSet
              ? refSet.reps
              : slot.category === 'Abs'
                ? 45
                : 8;
          const draftSet = {
            id: `set_${ts}_${Math.random().toString(36).slice(2, 6)}`,
            setNumber: 1,
            type: defaultSetType,
            reps: newReps,
            ...(isTimerScheme
              ? {
                  durationSeconds: newReps,
                  timerStr: formatSecondsToMMSS(newReps, true)
                }
              : {}),
            completed: false
          };
          const isBw = isBodyweightExercise(exId);
          const bwDefault = Math.max(0, Number(userBodyweightLbs) || 220);
          const lastW =
            slot.category === 'Abs'
              ? 0
              : isBw
                ? bwDefault
                : calculateLastEquivalentWeightForSet(base1RM, draftSet, nextCount, slot.category, 0, listScheme, exId);
          const newSet = {
            ...draftSet,
            lastWeight: lastW,
            increment: slot.category === 'Abs' || isTimerScheme || isBw ? 0 : effInc,
            weight: slot.category === 'Abs' ? 0 : isTimerScheme || isBw ? lastW : roundToIncrement(lastW + effInc)
          };
          const combined = isTop ? [newSet, ...currentList] : [...currentList, newSet];
          return combined.map((st, idx) => ({ ...st, setNumber: idx + 1 }));
        };

        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
          const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          const nextMatrix = slot.supersetSetsByExercise.map((list, idx) =>
            insertIntoList(list, supIds[idx] || slot.exerciseId, getSupersetSchemes(slot)[idx])
          );
          return {
            ...slot,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }

        const nextSets = insertIntoList(slot.sets || [], slot.exerciseId);
        return { ...slot, sets: nextSets, supersetSetsByExercise: [nextSets] };
      });
      return { ...prev, slots: nextSlots };
    });
  };

  // RECALCULATE for one slot (workoutId = the workout it belongs to, left out of "last session").
  // Each exercise is rebuilt from its selections, as if it had just been picked: the exercise (from the filters),
  // its scheme's set types and reps (Exercise Set Preferences on the uniform schemes; the REPS box), the SETS count
  // (the current number of sets: the scheme's last sets, extra sets copy its last one) and weights from goal progress
  // (calculated 1RM, last session + increment). Then every LOCKED value is put back (set.lockType / lockWeight /
  // lockReps) and the numbers it depends on are worked out around it: a locked weight → the reps it allows; locked
  // reps or type → the weight for them. Completed sets are never changed. Nothing else (e.g. which field was edited
  // last) is kept. Type-locked sets then follow their type's rule (setTypeTarget). Timer sets keep their times; band
  // sets keep their colour.
  // Bodyweight-type exercises store what is added (0 / the plate), not the total load
  const recalculateSlot = (slot, workoutId) =>
    fillIntensities(planEffort(toAddedWeights(recalculateSlotLoads(slot, workoutId))), getCurrentEditorWorkout());
  const recalculateSlotLoads = (slot, workoutId) => {
    const isSup = isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise);
    const schemes = isSup ? getSupersetSchemes(slot) : [slot.scheme || defaultScheme];

    const recalcList = (list, exId, half = 0) => {
      const original = Array.isArray(list) ? list : [];
      const total = original.length;
      if (total === 0) return [];
      const scheme = schemes[half];
      const category = isSup ? 'Superset' : normalizeSlotCategory(slot.category);
      const targetReps = isSup ? slot.supersetTargetReps?.[half] : slot.targetReps;
      const isBw = isBodyweightExercise(exId);
      const isTimer = scheme === 'Timer';
      if (isTracing()) {
        traceLine(describe1RM(exId, startOpts));
        traceLine(`Scheme ${scheme} · ${total} sets${targetReps ? ` · REPS ${targetReps}` : ''} · locks: ${original.map((st, i) => `${i + 1}:${[st.lockType && 'T', st.lockWeight && 'W', st.lockReps && 'R', st.lockIntensity && 'I'].filter(Boolean).join('') || '–'}`).join(' ')}`);
      }
      const calc1RM = getHistoricalCalculated1RM(exId, history, oneRepMaxes);
      const effInc = isBw ? 0 : getEffectiveIncrementForExercise(exId, currentIncrementLbs);
      const weightFor = (st, idx) => {
        if (normalizeSetType(st.type) === '1 Rep Max') return roundToIncrement(roundTo5(calc1RM) + (idx === total - 1 ? effInc : 0));
        const base = calculateLastEquivalentWeightForSet(calc1RM, { ...st, lastEditedField: 'reps' }, total, category, idx, scheme, exId);
        const isRampWarmup = scheme === 'Pyramid 1RM' && normalizeSetType(st.type) === 'Warmup';
        return Math.max(0, roundToIncrement(base + (isRampWarmup ? 0 : effInc)));
      };

      // 1. The scheme's sets, sized to the current count
      let fresh = generateSetsForScheme(scheme, calc1RM, category, exId, currentIncrementLbs, userBodyweightLbs, setPreferences);
      const sameShape = fresh.length === total;
      if (fresh.length > total) fresh = trimSetsTo(fresh, total);
      while (fresh.length < total) {
        const last = fresh[fresh.length - 1] || { type: 'Working', reps: 8 };
        fresh = [...fresh, { ...last, type: normalizeSetType(last.type) === '1 Rep Max' ? 'Working' : last.type }];
      }
      // 2. The slot's REPS box (uniform schemes), then weights for this count (pyramids as generated when unchanged)
      const repsChanged = Number(targetReps) > 0 && getTargetRepsForSet(scheme, 0, total, targetReps) !== null;
      fresh = fresh.map((st, idx) => {
        const reps =
          isTimer || normalizeSetType(st.type) === '1 Rep Max' ? st.reps : getTargetRepsForSet(scheme, idx, total, targetReps) ?? st.reps;
        const next = { ...st, reps };
        if (isBw || isTimer || (sameShape && !repsChanged)) return next;
        return { ...next, weight: weightFor(next, idx) };
      });

      // 3. Completed sets stay; locked values come back; the rest is the rebuilt set
      const merged = original.map((orig, idx) => {
        if (orig.completed) return { ...orig, setNumber: idx + 1 };
        const f = fresh[idx];
        let next = {
          ...orig,
          setNumber: idx + 1,
          type: orig.lockType ? orig.type : f.type,
          reps: isTimer ? orig.reps : orig.lockReps ? orig.reps : f.reps,
          weight: orig.lockWeight ? orig.weight : f.weight,
          lastWeight: f.lastWeight,
          increment: f.increment,
          lastEditedField: undefined
        };
        if (isBw || isTimer) return next;
        if (orig.lockWeight && !orig.lockReps) {
          const weight = Number(orig.weight) || 0;
          next.reps =
            normalizeSetType(next.type) === '1 Rep Max'
              ? 1
              : calc1RM > 0 && weight > 0
                ? calculateEquivalentRepsForWeight(calc1RM, weight, next, total, category, effInc)
                : next.reps;
          if (isTracing() && !orig.lockIntensity) {
            traceLine(`${EXERCISE_MAP[exId]?.name || exId} set ${idx + 1}: weight ${fmt(weight)} lb locked → reps it allows at this set's effort from 1RM ${fmt(calc1RM)} = ${next.reps}`);
          }
        } else if (!orig.lockWeight && (orig.lockReps || (orig.lockType && orig.type !== f.type))) {
          if (normalizeSetType(next.type) === '1 Rep Max' && !orig.lockReps) next.reps = 1;
          next.weight = weightFor(next, idx);
        }
        return next;
      });

      // 4. Goal progress for the weights that aren't completed or locked
      const keepIdx = merged.map((st, idx) => (st.completed || st.lockWeight ? idx : -1)).filter(idx => idx >= 0);
      const progressed = isBw
        ? merged
        : applyGoalProgressToSets(merged, {
            exerciseId: exId,
            scheme,
            history,
            oneRepMaxes,
            incrementLbs: currentIncrementLbs,
            excludeWorkoutId: workoutId,
            lockedIndexes: keepIdx
          });
      // 5. Type-locked sets follow their type's rule from the working set (as when the type is picked), e.g. a locked
      // Burn Out = the working weight with 2 more reps; locked weights / reps stay
      const step = effInc > 0 ? Math.min(2.5, effInc) : 2.5;
      const withTypes = progressed.map((st, idx) => {
        const orig = original[idx];
        if (!orig || orig.completed || !orig.lockType || orig.lockWeight || isBw || isTimer) return st;
        const type = normalizeSetType(st.type);
        if (type === '1 Rep Max') return st;
        const ref = progressed.find(
          (o, j) => j !== idx && normalizeSetType(o.type) === 'Working' && Number(o.weight) > 0
        );
        if (!ref) return st;
        const [w, r] = setTypeTarget(type, Number(ref.weight), Math.max(1, Number(ref.reps) || 1));
        if (isTracing()) traceLine(`${EXERCISE_MAP[exId]?.name || exId} set ${idx + 1}: ${type} locked → from the working set ${fmt(ref.weight)} × ${ref.reps}: ${fmt(w)} lb × ${orig.lockReps ? st.reps : r}`);
        return { ...st, weight: Math.max(0, Math.round(w / step) * step), reps: orig.lockReps ? st.reps : r };
      });
      // 6. Weight, reps and intensity through the calculated 1RM (utils/intensity.js solveSet): a locked intensity
      // sets the weight (or, with the weight locked too, the reps); an unlocked intensity is worked out from the
      // weight and reps (programs that use intensity)
      const showIntensity = intensityOn(getCurrentEditorWorkout());
      const withIntensity = withTypes.map((st, idx) => {
        const orig = original[idx];
        // Bodyweight exercises: the load is your bodyweight (+ the added weight on Weighted, − the band on
        // Band-Assisted). A locked intensity sets the reps for that load — on Bodyweight / Band-Assisted the load can't
        // move, so the reps always follow — or, on Weighted with the weight unlocked, the added weight
        if (orig && !orig.completed && isBw && !isTimer && calc1RM > 0 && orig.lockIntensity && orig.intensity && countsBodyweight(exId)) {
          return solveBodyweightSet(st, orig, calc1RM, exId, getSlotEquipmentChoice(slot, isSup ? half : 0), step);
        }
        if (!orig || orig.completed || isBw || isTimer || !(calc1RM > 0)) return st;
        const fatigueReps =
          normalizeSetType(st.type) === 'Warmup'
            ? 0
            : fatigueRateFor(exId) * priorHardSets(withTypes, idx) * restFatigueFactor(plannedRestSeconds(slot, getCurrentEditorWorkout()));
        if (orig.lockIntensity) return solveSet({ ...st, intensity: orig.intensity, lockIntensity: true }, calc1RM, { step, fatigueReps, exerciseId: exId });
        return showIntensity ? solveSet({ ...st, lockIntensity: false }, calc1RM, { step, fatigueReps, exerciseId: exId }) : st;
      });
      return withIntensity.map((st, idx) => ({ ...st, setNumber: idx + 1 }));
    };

    if (isSup) {
      const supIds = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
      const nextMatrix = slot.supersetSetsByExercise.map((list, idx) => recalcList(list, supIds[idx] || slot.exerciseId, idx));
      return {
        ...slot,
        supersetSetsByExercise: nextMatrix,
        sets: nextMatrix[0] || [],
        secondarySets: nextMatrix[1] || []
      };
    }
    const nextSets = recalcList(slot.sets || [], slot.exerciseId);
    return { ...slot, sets: nextSets, supersetSetsByExercise: [nextSets] };
  };

  // Program, week or day changed for the session: the session is rebuilt for it — the program's day (or its routine)
  // with that week's plan. Only exercises with a set marked done stay; everything else is replaced.
  const replanForProgram = next => {
    const started = slot =>
      [slot.sets, slot.secondarySets, ...(slot.supersetSetsByExercise || [])].some(list => (list || []).some(st => st?.completed));
    const kept = (next.slots || []).filter(started);
    if (isTracing()) {
      const dropped = (next.slots || []).length - kept.length;
      traceLine(`Session rebuilt for the program: ${kept.length} exercise${kept.length === 1 ? '' : 's'} with done sets kept, ${dropped} replaced`);
    }
    return { ...next, slots: buildGeneratedAutoSlots(kept, { programTarget: next }) };
  };

  // The session's WEEK box: the week is saved and the session follows it
  const handleChangeProgramWeek = week => {
    updateCurrentWorkoutState(prev =>
      prev
        ? withTrace(`WEEK · ${week}`, () =>
            replanForProgram({ ...prev, program: prev.program || trainingProgram, programWeek: week, programWeekPicked: true })
          )
        : prev
    );
  };

  /**
   * The live session's automatic week and day, worked out again (page.js calls this when History changes): a session
   * opened before History finished syncing, or kept open into a new week, would otherwise keep the week it started
   * with. Only while no set is done and the week / day weren't picked by hand; the session is rebuilt for the new
   * week like picking it in the WEEK box. Returns whether anything changed.
   */
  const refreshAutoProgramWeek = () => {
    const session = activeSession;
    if (!session?.program || session.programWeekPicked) return false;
    const anyDone = (session.slots || []).some(slot =>
      [slot.sets, slot.secondarySets, ...(slot.supersetSetsByExercise || [])].some(list => (list || []).some(st => st?.completed))
    );
    if (anyDone) return false;
    const ctx = programContextFor({ ...session, programWeek: '', programDay: session.programDayPicked ? session.programDay : null });
    if (!ctx) return false;
    const week = ctx.program.weekName(ctx.week);
    const day = session.programDayPicked ? session.programDay || null : ctx.day?.id || null;
    if (week === session.programWeek && (day || null) === (session.programDay || null)) return false;
    setActiveSession(prev =>
      prev && prev.id === session.id
        ? withTrace(`WEEK · ${week}`, () =>
            (prev.slots || []).length
              ? replanForProgram({ ...prev, programWeek: week, programDay: day })
              : { ...prev, programWeek: week, programDay: day }
          )
        : prev
    );
    return true;
  };

  // The session's PROGRAM box: the session runs that program from here, at its automatic week and day (from the
  // logged sessions)
  const handleChangeSessionProgram = programId => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const base = { ...prev, program: programId, programWeek: '', programDay: null, programWeekPicked: false, programDayPicked: false };
      const ctx = programContextFor(base);
      return withTrace(`PROGRAM · ${getProgram(programId).label}`, () => replanForProgram({
        ...base,
        programWeek: ctx ? ctx.program.weekName(ctx.week) : '',
        programDay: ctx?.day?.id || null,
        defaultRestSeconds: ctx?.day?.restSeconds || ctx?.program?.restSeconds || prev.defaultRestSeconds || 90
      }));
    });
  };

  // The session's DAY box (programs with set days)
  const handleChangeProgramDay = dayId => {
    updateCurrentWorkoutState(prev =>
      prev
        ? withTrace(`DAY · ${dayId}`, () =>
            replanForProgram({ ...prev, program: prev.program || trainingProgram, programDay: dayId, programDayPicked: true })
          )
        : prev
    );
  };

  // SKIP on an exercise's DELOAD note: plan it at full strength today (slot.deloadSkipped, kept when logged, so the
  // 30 days start again as they would after a deload)
  const handleSkipDeload = slotId => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      return withTrace(
        'SKIP DELOAD',
        () => ({
          ...prev,
          slots: prev.slots.map(slot => {
            if (slot.id !== slotId) return slot;
            const next = { ...slot, deload: false, deloadSkipped: true };
            return isProgrammedSlot(next, programContextFor(prev)) ? programSlot(next, prev) : recalculateSlot(next, prev.id);
          })
        }),
        `skipdeload:${slotId}`
      );
    });
  };

  const handleRecalculateSlotWeights = slotId => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const target = (prev.slots || []).find(slot => slot.id === slotId);
      const names = (target?.supersetExerciseIds || [target?.exerciseId]).filter(Boolean).map(id => EXERCISE_MAP[id]?.name || id);
      return withTrace(
        `RECALCULATE · ${names.join(' + ')}`,
        () => ({
          ...prev,
          slots: prev.slots.map(slot => {
            if (slot.id !== slotId) return slot;
            // A programmed exercise is re-worked from its program week; anything else the usual way
            return isProgrammedSlot(slot, programContextFor(prev)) ? programSlot(slot, prev) : recalculateSlot(slot, prev.id);
          })
        }),
        `recalc:${slotId}`
      );
    });
  };

  // SETS / REPS boxes in the slot editor's scheme row. setCount: sets added (copies of the last set) or removed at
  // the bottom; a superset's count is for both exercises. targetReps: every unlocked, not-done set of that exercise
  // gets those reps and the weights are recalculated (stored as slot.targetReps / supersetTargetReps[half]).
  const reshapeSlot = (slot, changes) => {
    const isSup = isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise);
    let lists = isSup ? [slot.supersetSetsByExercise[0] || [], slot.supersetSetsByExercise[1] || []] : [slot.sets || []];
    const half = isSup && changes.supersetHalf === 1 ? 1 : 0;
    if (changes.setCount !== undefined) {
      const n = Math.max(1, Math.min(20, Math.round(Number(changes.setCount) || 1)));
      lists = lists.map(list => {
        if (list.length >= n) return list.slice(0, n);
        const ref = list[list.length - 1] || { type: 'Working', reps: 8, weight: 0 };
        const extra = Array.from({ length: n - list.length }, (_, i) => ({
          ...ref,
          id: `set_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          type: ref.type === '1 Rep Max' ? 'Working' : ref.type,
          completed: false,
          lockWeight: false,
          lockReps: undefined,
          lockType: undefined,
          lastEditedField: undefined
        }));
        return [...list, ...extra];
      });
      lists = lists.map(list => list.map((st, i) => ({ ...st, setNumber: i + 1 })));
    }
    let next;
    if (isSup) {
      next = { ...slot, supersetSetsByExercise: lists, sets: lists[0], secondarySets: lists[1] };
    } else {
      next = { ...slot, sets: lists[0], supersetSetsByExercise: [lists[0]] };
    }
    if (changes.targetReps !== undefined) {
      // The scheme pop-up's REPS: every set not done gets the new count, locked reps included — they are unlocked,
      // changed and locked again (back to the default lock). A 1 Rep Max set stays at 1, timed sets keep their time;
      // weights stay (the intensities follow them).
      const reps = Math.max(1, Math.min(50, Math.round(Number(changes.targetReps) || 1)));
      const withReps = list =>
        (list || []).map(st =>
          st.completed || st.type === '1 Rep Max' || st.durationSeconds || st.timerStr
            ? st
            : { ...st, reps, lockReps: undefined }
        );
      if (isSup) {
        const targets = [slot.supersetTargetReps?.[0] ?? null, slot.supersetTargetReps?.[1] ?? null];
        targets[half] = reps;
        const matrix = next.supersetSetsByExercise.map((list, i) => (i === half ? withReps(list) : list));
        next = { ...next, supersetTargetReps: targets, supersetSetsByExercise: matrix, sets: matrix[0], secondarySets: matrix[1] };
      } else {
        const sets = withReps(next.sets);
        next = { ...next, targetReps: reps, sets, supersetSetsByExercise: [sets] };
      }
    }
    return next;
  };

  // Lock beside a set's weight or reps (see recalcList in handleRecalculateSlotWeights). exIdx = superset half.
  const handleToggleSetLock = (slotId, exIdx, setId, field) => {
    const key = { weight: 'lockWeight', reps: 'lockReps', type: 'lockType', intensity: 'lockIntensity' }[field] || null;
    if (!key) return;
    // Weight, reps and intensity: an unlocked one follows the locked ones; all three locked = a record of the set
    // as it went (nothing is worked out). Unlocking lets that value follow again (an unlocked intensity is re-worked
    // at once by fillIntensities).
    // Type and reps are locked by default (not set = locked), so the first tap on theirs opens them
    const isDefaultLocked = key === 'lockType' || key === 'lockReps';
    const toggle = list =>
      (list || []).map(st => (st.id === setId ? { ...st, [key]: !(isDefaultLocked ? st[key] ?? true : st[key]) } : st));
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        slots: prev.slots.map(slot => {
          if (slot.id !== slotId) return slot;
          if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
            const matrix = slot.supersetSetsByExercise.map((list, i) => (i === exIdx ? toggle(list) : list));
            return fillIntensities({ ...slot, supersetSetsByExercise: matrix, sets: matrix[0] || [], secondarySets: matrix[1] || [] }, prev);
          }
          const sets = toggle(slot.sets);
          return fillIntensities({ ...slot, sets, supersetSetsByExercise: [sets] }, prev);
        })
      };
    });
  };

  // A logged History workout opens as a full editor page too ('history_editor'), like a routine
  const isRoutineEditorView =
    currentView === 'session' ||
    currentView === 'history_editor' ||
    currentView === 'historical_entry' ||
    currentView === 'routine_editor' ||
    currentView === 'routine_preview';

  const currentEditorWorkout = getCurrentEditorWorkout();

  const handleToggleSetDone = (slot, exIndex, setItem) => {
    const markingDone = !setItem.completed;
    // Live session only: when it was ticked, the rest before it and the app's plan for it. The rest is since the
    // previous set ticked OF THE SAME EXERCISE (a superset's B set rests from B's last set, not from A's), less ~3 s a
    // rep for the set itself (setRestSeconds). It feeds the rest-length model only; a logged 1RM never reads it.
    const live = currentView === 'session';
    const nowMs = Date.now();
    const stampDone = (st, list) => {
      if (!markingDone) {
        const { completedAt: _c, restSec: _r, ...rest } = st;
        return { ...rest, completed: false };
      }
      if (!live) return { ...st, completed: true };
      const rest = setRestSeconds(st, list, nowMs);
      return { ...withPlan(st), completed: true, completedAt: nowMs, ...(rest !== null ? { restSec: rest } : {}) };
    };
    // No rest timer while editing a logged workout or looking at a preview
    if (markingDone && isRoutineEditorView && currentView !== 'history_editor' && currentView !== 'routine_preview') {
      setTimerTrigger({
        isRunning: true,
        // The exercise that started it (deleting that exercise stops the timer)
        slotId: slot.id,
        // The exercise's own REST if set, else the session's rest bar setting
        targetSeconds: slot.customRestSeconds || currentEditorWorkout?.defaultRestSeconds || slot.restSeconds || 90,
        startedAtMs: Date.now()
      });
    }
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(s => {
        if (s.id !== slot.id) return s;
        if (isSupersetCategory(s.category) && Array.isArray(s.supersetSetsByExercise)) {
          const nextMatrix = s.supersetSetsByExercise.map((list, idx) =>
            idx === exIndex
              ? list.map(st => (st.id === setItem.id ? stampDone(st, list) : st))
              : list
          );
          return {
            ...s,
            supersetSetsByExercise: nextMatrix,
            sets: nextMatrix[0] || [],
            secondarySets: nextMatrix[1] || []
          };
        }
        return {
          ...s,
          sets: (s.sets || []).map(st => (st.id === setItem.id ? stampDone(st, s.sets || []) : st))
        };
      });
      // Marking a set done: what the sets done so far say re-plans the ones still to do (autoregulateSlot)
      return { ...prev, slots: markingDone ? nextSlots.map(s => (s.id === slot.id ? autoregulateSlot(s, prev, exIndex) : s)) : nextSlots };
    });
  };

  return {
    weighRoutineSlot,
    routineSlotsForStorage,
    isRoutineEditorView,
    currentEditorWorkout,
    updateCurrentWorkoutState,
    handleConfirmHistoricalEdit,
    handleOpenNewSession,
    handleOpenNewAutoSession,
    handleDirectLoadRoutine,
    handleOpenPreviewRoutine,
    handleCancelRoutineSelection,
    handleApplyPreviewRoutine,
    handleAutoBuildWorkout,
    handleAddAutoSlot,
    getNextAutoSlotCategory,
    suggestExerciseForMuscleGroup,
    handleSaveCurrentEditor,
    handleConfirmSaveWorkout,
    handleAutoFinishActiveSession,
    handleShareCurrentEditor,
    handleResetCurrentEditor,
    handleConfirmDeleteAction,
    handleReorderExercises,
    handleReorderSets,
    handleUpdateSlotCategoryOrExercise,
    handleUpdateSetField,
    handleUpdateSetType,
    handleInsertSetAtPosition,
    handleRecalculateSlotWeights,
    handleSkipDeload,
    handleResetSlot,
    handleChangeProgramWeek,
    refreshAutoProgramWeek,
    handleChangeSessionProgram,
    handleChangeProgramDay,
    handleToggleSetLock,
    handleToggleSetDone,
    handleChangeGymSelection
  };
}

