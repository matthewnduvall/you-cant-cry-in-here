// ============================================================================
// WORKOUT, 1RM EQUIVALENT & SUPERSET GENERATION ENGINE
// ============================================================================

import { traceLine, isTracing, fmt } from './calcTrace';
import {
  getSlotEquipmentChoice,
  isBandEquipment,
  getSetBandColor,
  getBandWeightLbs,
  getBandLoadLabel,
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  normalizeSlotCategory,
  isSupersetCategory,
  isBodyweightExercise,
  formatDateYMD,
  formatTodayYMD,
  parseYMDToISO,
  roundTo5,
  roundToIncrement,
  stripEquipmentFromExerciseName,
  stripDateFromTitle,
  getDefaultSessionName,
  getDefaultAutoSessionName
} from '../data/exerciseLibrary';

export const SET_TYPES_LIST = ['Warmup', 'Working', 'Top Out', 'Burn Out', '1 Rep Max'];

// ---------------------------------------------------------------------------
// Session auto-naming: a session nobody has named ("Session", "Auto Session") is named after the two muscles its
// exercises train most, e.g. Bench + Squat → "Chest and Quads".
// ---------------------------------------------------------------------------

// An exercise's main muscle (the first of its specific muscles) → the short name used in session names
const SESSION_MUSCLE_NAMES = [
  [/^Pectoralis/, 'Chest'],
  [/^Quadriceps/, 'Quads'],
  [/^Gluteus/, 'Glutes'],
  [/^Hamstrings/, 'Hamstrings'],
  [/^Latissimus/, 'Lats'],
  [/^(General Back|Rhomboids)/, 'Back'],
  [/^Trapezius/, 'Traps'],
  [/^(Deltoid|Supraspinatus|Infraspinatus|Subscapularis)/, 'Shoulders'],
  [/^Triceps/, 'Triceps'],
  [/^(Biceps|Brachialis)/, 'Biceps'],
  [/^(Brachioradialis|Wrist|Pronators|Supinators)/, 'Forearms'],
  [/^(Rectus Abdominis|Obliques|Transverse Abdominis)/, 'Core'],
  [/^Erector Spinae/, 'Lower Back'],
  [/^(Gastrocnemius|Soleus|Tibialis)/, 'Calves'],
  [/^Hip Flexors/, 'Hip Flexors'],
  [/^Hip Abductors/, 'Abductors'],
  [/^Hip Adductors/, 'Adductors'],
  [/^(Sternocleidomastoid|Splenius)/, 'Neck'],
  [/^Serratus/, 'Serratus']
];
const sessionMuscleOf = exerciseId => {
  const ex = EXERCISE_MAP[exerciseId];
  const main = (ex?.specificMuscles || [])[0] || '';
  const hit = SESSION_MUSCLE_NAMES.find(([re]) => re.test(main));
  return hit ? hit[1] : ex?.muscleGroup || null;
};

/** "Chest and Quads": the two muscles the session's exercises train most (ties: the one added first); "" if none. */
export const getSessionMuscleName = slots => {
  const counts = new Map();
  (slots || []).forEach(slot => {
    const ids = isSupersetCategory(slot?.category)
      ? slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId]
      : [slot?.exerciseId];
    ids.filter(Boolean).forEach(id => {
      const muscle = sessionMuscleOf(id);
      if (muscle) counts.set(muscle, (counts.get(muscle) || 0) + 1);
    });
  });
  // Map keeps insertion order, so a stable sort leaves ties in the order they were added
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([m]) => m);
  return top.join(' and ');
};

const isDefaultSessionTitle = title => {
  const t = stripDateFromTitle(title || '').trim();
  return t === '' || t === getDefaultSessionName() || t === getDefaultAutoSessionName();
};
const slotIdsOf = session => (session?.slots || []).map(s => s.id).join('|');

/**
 * Applied to every change of the live session (page.js wraps setActiveSession with it). A session still called
 * "Session" / "Auto Session" — or one this named — is renamed after its two main muscles as exercises change
 * (`autoNamed: true`). Typing a name (the title changes while the exercises don't) stops it for that session
 * (`titleEdited: true`); a name set together with new exercises (a loaded routine) is kept. An auto-named session that
 * becomes empty goes back to "Session".
 */
export const withAutoSessionName = (prev, next) => {
  if (!next || next.titleEdited) return next;
  const sameSession = Boolean(prev && prev.id === next.id);
  const titleChanged = sameSession && stripDateFromTitle(next.title || '') !== stripDateFromTitle(prev.title || '');
  // A rename typed into the name box is built from the current session ({ ...prev, title }), so it carries prev's
  // autoNamed flag; a whole session put back from storage (restored at startup, possibly twice) is its own object
  // and is not a rename
  const derivedFromPrev = sameSession && Boolean(next.autoNamed) === Boolean(prev.autoNamed);
  if (titleChanged && derivedFromPrev && slotIdsOf(prev) === slotIdsOf(next)) {
    return { ...next, titleEdited: true, autoNamed: false };
  }
  if (titleChanged && !isDefaultSessionTitle(next.title)) return { ...next, autoNamed: false };
  const eligible = isDefaultSessionTitle(next.title) || (next.autoNamed && !titleChanged);
  if (!eligible) return next;
  const name = getSessionMuscleName(next.slots);
  if (!name) {
    return next.autoNamed ? { ...next, title: getDefaultSessionName(), autoNamed: false } : next;
  }
  return name === next.title && next.autoNamed ? next : { ...next, title: name, autoNamed: true };
};

// Effort multiplier per set type used when converting a logged set to a 1RM estimate.
export const SET_TYPE_MULTIPLIER_MAP = {
  Warmup: 0.74,
  Working: 0.98,
  'Top Out': 1.04,
  'Burn Out': 0.84,
  '1 Rep Max': 1.0
};

/**
 * Estimates a 1RM from one set (used by the 1RM calculator): rep percentage × set-type effort ×
 * a small fatigue factor for the number of sets in the scheme. Never returns less than the weight.
 */
export const estimate1RMFromSet = (setItem, totalSetsCount = 1) => {
  const w = Math.max(0, Number(setItem?.weight) || 0);
  if (w <= 0) return 0;
  // Reps in reserve count as reps the set could have done
  const r = Math.max(1, Number(setItem?.reps) || 1) + setReportedRir(setItem);
  const sType = normalizeSetType(setItem?.type);
  if ((sType === '1 Rep Max' && r <= 1) || (r === 1 && totalSetsCount <= 1)) return roundTo5(w);
  const repPct = 1 / (1 + Math.max(0, r - 1) / 30);
  const typeMultiplier = SET_TYPE_MULTIPLIER_MAP[sType] || 0.98;
  const setStressFactor = 1 / (1 + Math.max(0, totalSetsCount - 1) * 0.035);
  const factor = Math.min(1, repPct * typeMultiplier * setStressFactor);
  if (factor <= 0) return roundTo5(w);
  return Math.max(w, roundTo5(w / factor));
};

/**
 * Builds the single-set "PERSONAL RECORD" History entry logged whenever a PR is entered
 * (plate calculator, 1RM calculator). `dateYMD` defaults to today.
 */
// estimated: the 1RM came from the 1RM calculator (worked out from reps), so it shows with an asterisk
export const buildPersonalRecordHistoryEntry = ({ exerciseId, oneRepMax, dateYMD, scheme = 'Pyramid 1RM', estimated = false }) => {
  const exObj = EXERCISE_MAP[exerciseId] || {
    id: exerciseId,
    name: exerciseId,
    category: 'Compound',
    muscleGroup: 'All Muscles'
  };
  const cleanDate = dateYMD && String(dateYMD).trim() ? formatDateYMD(dateYMD) : formatTodayYMD();
  const ts = Date.now();
  const prSet = {
    id: `set_pr_${ts}`,
    setNumber: 1,
    type: '1 Rep Max',
    reps: 1,
    lastWeight: oneRepMax,
    increment: 0,
    weight: oneRepMax,
    completed: true,
    ...(estimated ? { estimated: true } : {})
  };
  const category = normalizeSlotCategory(exObj.category || 'Compound');
  const prSlot = {
    id: `slot_pr_${ts}`,
    category,
    slotLabel: category,
    scheme,
    restSeconds: 90,
    muscleGroupFilter: exObj.muscleGroup || 'All Muscles',
    familyMuscleGroup: exObj.muscleGroup || 'Chest',
    exerciseId: exObj.id,
    secondaryExerciseId: null,
    supersetExerciseIds: [exObj.id],
    supersetSetsByExercise: [[prSet]],
    sets: [prSet],
    secondarySets: []
  };
  return {
    id: `hist_pr_${exObj.id}_${ts}`,
    title: `${exObj.name} PR (${oneRepMax} LB)`,
    loadedRoutineTitle: 'PERSONAL RECORD',
    startedAt: parseYMDToISO(cleanDate),
    updatedAt: new Date().toISOString(),
    isComplete: true,
    verifiedByUser: true,
    defaultRestSeconds: 90,
    slots: lockAndCompleteSets(normalizeSlotLabels([prSlot]))
  };
};

/** Inserts a History entry and keeps History sorted newest first. */
export const insertHistoryEntrySorted = (history, entry) =>
  [entry, ...(history || [])].sort(
    (a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime()
  );

/** Default scheme for new exercises from the training goal: Strength 5x5, Balanced 5x8 (default), Hypertrophy 5x10, Maintain 5x8. */
export const getDefaultSchemeForGoal = goalType =>
  goalType === 'Strength' ? '5x5' : goalType === 'Hypertrophy' ? '5x10' : '5x8';

/** Planks are held for time, so they start on the Timer scheme (Bear Plank Shoulder Tap counts taps, so it doesn't). */
export const isTimedHoldExercise = exerciseId => {
  const name = EXERCISE_MAP[exerciseId]?.name || '';
  return /\bplank\b/i.test(name) && !/shoulder tap|pull.?through/i.test(name); // taps and pull-throughs count reps
};

/** Default scheme for an exercise picked for the athlete or swapped into a slot: Timer for planks, else the goal's. */
export const getDefaultSchemeForExercise = (exerciseId, goalType) =>
  isTimedHoldExercise(exerciseId) ? 'Timer' : getDefaultSchemeForGoal(goalType);

// CLUSTER scheme: 3 working sets of one exercise, 18 reps each (each set done as mini-sets with a few seconds'
// rest inside it); the usual rest between sets
export const CLUSTER_SCHEME = 'Cluster';
export const CLUSTER_SET_COUNT = 3;
export const CLUSTER_REPS = 18;
export const CLUSTER_REST_SECONDS = 6;
export const isClusterScheme = scheme => scheme === CLUSTER_SCHEME;

export const SCHEME_OPTIONS = [
  '3x5',
  '3x8',
  '3x12',
  '5x5',
  '5x6',
  '5x8',
  '5x10',
  '8x8',
  'Pyramid',
  'Pyramid 1RM',
  'Reverse Pyramid',
  'Timer',
  CLUSTER_SCHEME
];

export const parseTimerDurationSeconds = rawVal => {
  if (rawVal === null || rawVal === undefined || rawVal === '') return 120;
  if (typeof rawVal === 'string' && rawVal.includes(':')) {
    const parts = rawVal.trim().split(':');
    const mins = Math.max(0, parseInt(parts[0], 10) || 0);
    const secs = Math.max(0, parseInt(parts[1], 10) || 0);
    const total = mins * 60 + secs;
    return total > 0 ? total : 120;
  }
  const num = Number(rawVal);
  if (!Number.isFinite(num) || num <= 0) return 120;
  return Math.round(num);
};

export const formatSecondsToMMSS = (secondsOrStr, padMinutes = true) => {
  const totalSec = parseTimerDurationSeconds(secondsOrStr);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const minStr = padMinutes ? String(mins).padStart(2, '0') : String(mins);
  const secStr = String(secs).padStart(2, '0');
  return `${minStr}:${secStr}`;
};

export const getSetTimerMMSS = (setItem, padMinutes = true) => {
  if (!setItem) return padMinutes ? '02:00' : '2:00';
  if (typeof setItem.timerStr === 'string' && setItem.timerStr.includes(':')) {
    return formatSecondsToMMSS(setItem.timerStr, padMinutes);
  }
  if (Number(setItem.durationSeconds) > 0) {
    return formatSecondsToMMSS(setItem.durationSeconds, padMinutes);
  }
  if (typeof setItem.reps === 'string' && setItem.reps.includes(':')) {
    return formatSecondsToMMSS(setItem.reps, padMinutes);
  }
  const numReps = Number(setItem.reps);
  const sec = Number.isFinite(numReps) && numReps >= 15 ? numReps : 120;
  return formatSecondsToMMSS(sec, padMinutes);
};

export const getLastLoggedTimerDisplay = (
  exerciseId,
  setItem,
  setIdxInEx = 0,
  fallbackWeight = 0,
  history = []
) => {
  const sortedHistory = [...(history || [])].sort(
    (a, b) => new Date(b?.startedAt || 0).getTime() - new Date(a?.startedAt || 0).getTime()
  );

  for (const w of sortedHistory) {
    for (const slot of w?.slots || []) {
      let targetSets = null;
      if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
        const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
        const matchIdx = ids.findIndex(id => id === exerciseId);
        if (matchIdx >= 0) {
          targetSets = slot.supersetSetsByExercise[matchIdx];
        }
      } else if (slot.exerciseId === exerciseId) {
        targetSets = slot.sets;
      }

      if (Array.isArray(targetSets) && targetSets.length > 0) {
        const completedSets = targetSets.filter(s => s && s.completed);
        const pool = completedSets.length > 0 ? completedSets : targetSets;
        const picked = pool[Math.min(setIdxInEx, pool.length - 1)] || pool[0];
        if (picked) {
          const timeStr =
            slot.scheme === 'Timer' || picked.durationSeconds || picked.timerStr
              ? getSetTimerMMSS(picked, false)
              : getSetTimerMMSS(setItem, false);
          const wVal =
            Number(picked.weight) > 0
              ? Number(picked.weight)
              : Math.max(0, Number(fallbackWeight) || 0);
          return `${timeStr}@${wVal}`;
        }
      }
    }
  }

  const defaultTimeStr = getSetTimerMMSS(setItem, false);
  const defaultW = Math.max(0, Number(fallbackWeight) || 0);
  return `${defaultTimeStr}@${defaultW}`;
};

export const normalizeSetType = rawType => {
  if (!rawType) return 'Working';
  const t = String(rawType).trim();
  if (t === 'Warmup Set' || t === 'Warmup') return 'Warmup';
  if (t === 'Working Set' || t === 'Working') return 'Working';
  if (t === 'Top Out Set' || t === 'Top Out') return 'Top Out';
  if (t === 'Burn Out Set' || t === 'Burn Out') return 'Burn Out';
  if (t === '1 Rep Max') return '1 Rep Max';
  return 'Working';
};

/**
 * The reps in reserve a logged set reports: from an intensity set by hand, by the set type or by a program (RIR as
 * it is; RPE → 10 − RPE). An intensity worked out from the set's own weight (`auto`) says nothing new, and %1RM is a
 * load, not an effort, so both count as 0.
 */
export const setReportedRir = st => {
  const i = st?.intensity;
  if (!i || i.auto) return 0;
  const v = Number(i.value);
  if (!Number.isFinite(v)) return 0;
  // %1RM: the RIR that share of the 1RM leaves for these reps (%1RM = 100 / (1 + (reps + RIR - 1) / 30))
  if (i.mode === 'pct') {
    if (v <= 0 || v >= 100) return 0;
    const reps = Math.max(1, Number(st?.reps) || 1);
    return Math.max(0, Math.round((30 * (100 / v - 1) + 1 - reps) * 10) / 10);
  }
  return i.mode === 'rir' ? Math.max(0, v) : Math.max(0, 10 - v);
};

/**
 * A set's estimated 1RM (Epley), counting the reps it had left: weight × (1 + (reps + RIR) ÷ 30); a single with
 * nothing in reserve is the weight itself. E.g. 200 × 5 at RIR 2 = 200 × (1 + 7 ÷ 30) = 246.7.
 */
// ---------------------------------------------------------------------------
// Bodyweight loads. Bodyweight-type exercises (pull-ups, dips, push-ups…: isBodyweightExercise) count the athlete's
// bodyweight in their 1RM: a set's stored weight is what is added (Weighted, +25) or taken off by a band
// (Band-Assisted, −35), so the load = bodyweight + weight. Timed sets (planks) are left alone. The bodyweight is the
// signed-in athlete's (setEngineBodyweight, called by page.js on every render); 0 = not known, loads as stored.
// ---------------------------------------------------------------------------
let ENGINE_BODYWEIGHT_LBS = 0;
export const setEngineBodyweight = lbs => {
  ENGINE_BODYWEIGHT_LBS = Math.max(0, Number(lbs) || 0);
};
export const getEngineBodyweight = () => ENGINE_BODYWEIGHT_LBS;
/** Runs fn with another athlete's bodyweight (a friend's History is worked out with theirs; 0 / unknown = loads as
 * stored), then puts the signed-in athlete's back. */
export const withEngineBodyweight = (lbs, fn) => {
  const previous = ENGINE_BODYWEIGHT_LBS;
  ENGINE_BODYWEIGHT_LBS = Math.max(0, Number(lbs) || 0);
  try {
    return fn();
  } finally {
    ENGINE_BODYWEIGHT_LBS = previous;
  }
};
const isTimedSet = st => Number(st?.durationSeconds) > 0 || (typeof st?.timerStr === 'string' && st.timerStr.includes(':'));
/** Does this exercise's 1RM count bodyweight? */
export const countsBodyweight = exerciseId => ENGINE_BODYWEIGHT_LBS > 0 && isBodyweightExercise(exerciseId);
/**
 * One set's load in lb. Bodyweight-type exercises go by their equipment choice (`option`, the slot's
 * getSlotEquipmentChoice): Weighted = bodyweight + the added weight; a band (Band-Assisted) = bodyweight − the band;
 * anything else (Bodyweight) = bodyweight, whatever weight was stored. Other exercises: their weight.
 */
export const setLoadLbs = (exerciseId, st, option = null) => {
  const w = Number(st?.weight) || 0;
  if (!st || isTimedSet(st) || !countsBodyweight(exerciseId)) return w;
  if (isBandEquipment(option) || (!option && st.bandColor)) return Math.max(0, ENGINE_BODYWEIGHT_LBS - getBandWeightLbs(getSetBandColor(st)));
  if (/weighted/i.test(String(option || ''))) return Math.max(0, ENGINE_BODYWEIGHT_LBS + Math.max(0, w));
  return ENGINE_BODYWEIGHT_LBS;
};
/** The sets with `weight` = their load (see setLoadLbs), for the 1RM scanners. Other exercises come back as they are. */
export const withEffectiveLoad = (exerciseId, sets = [], option = null) =>
  countsBodyweight(exerciseId)
    ? (Array.isArray(sets) ? sets : []).map(st => (st && !isTimedSet(st) ? { ...st, weight: setLoadLbs(exerciseId, st, option) } : st))
    : Array.isArray(sets) ? sets : [];

/**
 * Bodyweight-type exercises store what is added: 0 on Bodyweight, the plate on Weighted (suggested weights come out
 * as total loads, so bodyweight is taken off them). Sets that are done or have their weight locked are left alone;
 * bands are applyBandWeights' job. Used after new sets are worked out (createWorkoutSlot, RECALCULATE).
 */
export const toAddedWeights = slot => {
  if (!slot) return slot;
  const fix = (sets, exId, half) => {
    if (!countsBodyweight(exId)) return sets;
    const option = getSlotEquipmentChoice(slot, half);
    if (isBandEquipment(option)) return sets;
    const weighted = /weighted/i.test(String(option || ''));
    return (sets || []).map(st => {
      if (!st || st.completed || st.lockWeight || isTimedSet(st)) return st;
      const w = Number(st.weight) || 0;
      const added = weighted ? Math.max(0, Math.round((w - ENGINE_BODYWEIGHT_LBS) / 2.5) * 2.5) : 0;
      return added === w ? st : { ...st, weight: added };
    });
  };
  if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
    const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
    const matrix = slot.supersetSetsByExercise.map((sets, half) => fix(sets, ids[half], half));
    return { ...slot, supersetSetsByExercise: matrix, sets: matrix[0] || [] };
  }
  return { ...slot, sets: fix(slot.sets, slot.exerciseId, 0) };
};

/**
 * Band sets carry their band's weight: on a band exercise (pushdown) weight = the band (10 / 35 / 45); on a
 * band-assisted bodyweight one (pull-up) weight = −band, so its load is bodyweight − band. Applied to every slot by
 * normalizeSlotLabels (each edit), for the halves whose equipment choice is a band.
 */
export const applyBandWeights = slot => {
  if (!slot) return slot;
  const fixSets = (sets, exId, half) => {
    if (!isBandEquipment(getSlotEquipmentChoice(slot, half))) return sets;
    const assisted = isBodyweightExercise(exId);
    let changed = false;
    const next = (sets || []).map(st => {
      if (!st || isTimedSet(st)) return st;
      const load = getBandWeightLbs(getSetBandColor(st));
      const weight = assisted ? -load : load;
      if (Number(st.weight) === weight) return st;
      changed = true;
      return { ...st, weight };
    });
    return changed ? next : sets;
  };
  if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
    const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
    const matrix = slot.supersetSetsByExercise.map((sets, half) => fixSets(sets, ids[half], half));
    if (matrix.every((m, i) => m === slot.supersetSetsByExercise[i])) return slot;
    return { ...slot, supersetSetsByExercise: matrix, sets: matrix[0] || [] };
  }
  const sets = fixSets(slot.sets, slot.exerciseId, 0);
  return sets === slot.sets ? slot : { ...slot, sets };
};

export const estimateSet1RM = st => {
  const w = Number(st?.weight) || 0;
  if (w <= 0) return 0;
  const effReps = Math.max(1, Number(st?.reps) || 1) + setReportedRir(st);
  return effReps <= 1 ? w : w * (1 + effReps / 30);
};

// A 1RM is "true" when it was actually lifted for 1 rep with nothing left; one worked out from a multi-rep set or a
// set with reps in reserve (weight × (1 + (reps + RIR) / 30)), or entered from the 1RM calculator (set.estimated), is
// "calculated" and shows with an asterisk (oneRepMaxLabel).
export const isCalculated1RMSet = set =>
  Math.max(1, Number(set?.reps) || 1) > 1 || Boolean(set?.estimated) || setReportedRir(set) > 0;
/** "225" for a true 1RM, "225*" for a calculated one. */
export const oneRepMaxLabel = (value, calculated) => `${value}${calculated ? '*' : ''}`;
/** Best 1RM over sets: { value, calculated } (on a tie a true single wins). */
export const best1RMInfoOfSets = (sets = []) => {
  let value = 0;
  let calculated = false;
  (sets || []).forEach(st => {
    const w = Number(st?.weight) || 0;
    if (w <= 0) return;
    const est = Math.round(estimateSet1RM(st));
    const calc = isCalculated1RMSet(st);
    if (est > value || (est === value && calculated && !calc)) {
      value = est;
      calculated = calc;
    }
  });
  return { value, calculated };
};

/**
 * The whole exercise's calculated 1RM from its sets (the 1RM box's LAST / NOW, the weight pop-up's CURRENT): the
 * average of its working sets' estimates (every set but warm-ups, with a weight), each counting its own reps and
 * intensity, so changing any one set's weight, reps or intensity moves it. Only warm-ups → their average.
 * { value, calculated }. History's PRs stay the best single set (best1RMInfoOfSets).
 */
export const exercise1RMInfoOfSets = (sets = []) => {
  const weighted = (sets || []).filter(st => (Number(st?.weight) || 0) > 0);
  const working = weighted.filter(st => normalizeSetType(st?.type) !== 'Warmup');
  const pool = working.length > 0 ? working : weighted;
  if (pool.length === 0) return { value: 0, calculated: false };
  const value = Math.round(pool.reduce((sum, st) => sum + estimateSet1RM(st), 0) / pool.length);
  return { value, calculated: pool.length > 1 || pool.some(isCalculated1RMSet) };
};

// How far (share) a set's calculated 1RM may sit from the rest of its exercise before saving asks to check it
export const INTENSITY_MISMATCH_TOLERANCE = 0.12;

/**
 * Sets whose calculated 1RM (weight × (1 + (reps + RIR) ÷ 30)) disagrees with the rest of their exercise by more
 * than INTENSITY_MISMATCH_TOLERANCE, e.g. a light set of few reps marked RIR 0 says the athlete is much weaker than
 * their other sets do. Checked when a session is saved (completed sets if any are done, else every set; working
 * weighted sets only, 2+ per exercise). [{ slotId, exerciseName, setNumber, weight, reps, intensityText, set1RM,
 * others1RM, direction: 'low' | 'high' }]
 */
export const findIntensityMismatches = workout => {
  const flags = [];
  (workout?.slots || []).forEach(slot => {
    const isSup = isSupersetCategory(slot?.category) && Array.isArray(slot?.supersetSetsByExercise);
    const halves = isSup
      ? slot.supersetSetsByExercise.map((sets, i) => ({ sets, exId: slot.supersetExerciseIds?.[i] }))
      : [{ sets: slot?.sets, exId: slot?.exerciseId }];
    halves.forEach(({ sets, exId }, half) => {
      const all = withEffectiveLoad(exId, sets, getSlotEquipmentChoice(slot, half));
      const done = all.filter(st => st?.completed);
      const pool = (done.length > 0 ? done : all).filter(
        st => (Number(st?.weight) || 0) > 0 && normalizeSetType(st?.type) !== 'Warmup' && !st?.timerStr && !st?.durationSeconds
      );
      if (pool.length < 2) return;
      const ests = pool.map(st => estimateSet1RM(st));
      pool.forEach((st, i) => {
        const others = ests.filter((_, j) => j !== i).sort((a, b) => a - b);
        const mid = Math.floor(others.length / 2);
        const median = others.length % 2 ? others[mid] : (others[mid - 1] + others[mid]) / 2;
        if (!(median > 0)) return;
        const off = (ests[i] - median) / median;
        if (Math.abs(off) <= INTENSITY_MISMATCH_TOLERANCE) return;
        const it = st.intensity;
        const intensityText =
          it && it.value !== null && it.value !== undefined && it.value !== ''
            ? it.mode === 'pct'
              ? `${it.value}% 1RM`
              : `${String(it.mode).toUpperCase()} ${it.value}`
            : 'no intensity';
        flags.push({
          slotId: slot.id,
          exerciseName: EXERCISE_MAP[exId]?.name || 'Exercise',
          setNumber: all.indexOf(st) + 1,
          weight: Number(st.weight) || 0,
          reps: Number(st.reps) || 0,
          intensityText,
          set1RM: Math.round(ests[i]),
          others1RM: Math.round(median),
          direction: off < 0 ? 'low' : 'high'
        });
      });
    });
  });
  return flags;
};

export const getBestHistory1RMInfo = (exerciseId, history = []) => {
  let best = 0;
  let bestCalculated = false;
  let bestWorkoutId = null;
  let bestSlotId = null;
  let bestSetId = null;
  let bestDateLabel = '';

  (history || []).forEach(w => {
    (w?.slots || []).forEach(slot => {
      const scanSets = (setsList, half = 0) => {
        // Bodyweight-type exercises: their load by the slot's equipment choice (withEffectiveLoad)
        const arr = withEffectiveLoad(exerciseId, setsList, getSlotEquipmentChoice(slot, half));
        const hasCompleted = arr.some(s => s && s.completed && Number(s.weight) > 0);
        arr.forEach(st => {
          if (!st || Number(st.weight) <= 0) return;
          if (hasCompleted && !st.completed) return;
          const est = Math.round(estimateSet1RM(st));
          const calc = isCalculated1RMSet(st);
          if (est > best || (est === best && bestCalculated && !calc)) {
            best = est;
            bestCalculated = calc;
            bestWorkoutId = w?.id || null;
            bestSlotId = slot?.id || null;
            bestSetId = st?.id || null;
            bestDateLabel = w?.startedAt ? formatDateYMD(w.startedAt) : '';
          }
        });
      };

      if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
        const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
        ids.forEach((id, idx) => {
          if (id === exerciseId) {
            scanSets(slot.supersetSetsByExercise[idx], idx);
          }
        });
      } else if (slot.exerciseId === exerciseId) {
        scanSets(slot.sets);
      }
    });
  });

  return {
    best,
    // true = worked out from a multi-rep set or the 1RM calculator, not lifted for 1 rep
    calculated: best > 0 && bestCalculated,
    workoutId: bestWorkoutId,
    slotId: bestSlotId,
    // The set it came from (History entries tag it PR)
    setId: bestSetId,
    dateLabel: bestDateLabel
  };
};

/**
 * Every exercise's best 1RM from logged History only ({ [exerciseId]: lb }), the same estimate and set rules as
 * getBestHistory1RMInfo. An exercise with nothing logged is simply absent (= 0): saved 1RM numbers in settings
 * (old imports, removed workouts) never count as PRs.
 */
export const buildHistoryPRs = (history = []) => {
  const prs = {};
  (history || []).forEach(w => {
    Object.entries(bestPerWorkout1RMs(w)).forEach(([exId, est]) => {
      if (est > (prs[exId] || 0)) prs[exId] = est;
    });
  });
  return prs;
};

/** One workout's best estimated 1RM per exercise ({ [exerciseId]: lb }), History's set rules. */
const bestPerWorkout1RMs = workout => {
  const best = {};
  const scan = (exId, rawSets, option = null) => {
    if (!exId || !Array.isArray(rawSets)) return;
    const setsList = withEffectiveLoad(exId, rawSets, option);
    const hasCompleted = setsList.some(s => s && s.completed && Number(s.weight) > 0);
    setsList.forEach(st => {
      const w = Number(st?.weight) || 0;
      if (w <= 0) return;
      if (hasCompleted && !st.completed) return;
      const est = Math.round(estimateSet1RM(st));
      if (est > (best[exId] || 0)) best[exId] = est;
    });
  };
  (workout?.slots || []).forEach(slot => {
    if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
      const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
      ids.forEach((id, idx) => scan(id, slot.supersetSetsByExercise[idx], getSlotEquipmentChoice(slot, idx)));
    } else {
      scan(slot.exerciseId, slot.sets, getSlotEquipmentChoice(slot, 0));
    }
  });
  return best;
};

/**
 * Each exercise's lowest and highest logged 1RM across workouts ({ [exerciseId]: { low, high } }, from each
 * workout's best set) — MOST IMPROVED's High − Low, from logged History only.
 */
export const buildHistoryPRRanges = (history = []) => {
  const ranges = {};
  (history || []).forEach(w => {
    Object.entries(bestPerWorkout1RMs(w)).forEach(([exId, est]) => {
      const r = ranges[exId];
      ranges[exId] = r ? { low: Math.min(r.low, est), high: Math.max(r.high, est) } : { low: est, high: est };
    });
  });
  return ranges;
};

export const getBestHistory1RM = (exerciseId, history = []) => {
  return getBestHistory1RMInfo(exerciseId, history).best;
};

export const getPersonalRecord1RM = (exerciseId, history = []) => {
  return getBestHistory1RM(exerciseId, history);
};

export const getHistoricalCalculated1RM = (exerciseId, history = [], oneRepMaxes = {}) => {
  const best = getPersonalRecord1RM(exerciseId, history, oneRepMaxes);
  return best > 0 ? best : EXERCISE_MAP[exerciseId]?.default1RM ?? 135;
};

export const calculateLastEquivalentWeightForSet = (
  base1RM,
  setItem,
  totalSetsCount = 5,
  category = 'Compound',
  setIndex = 0,
  scheme = ''
) => {
  const max1RM = Math.max(5, Number(base1RM) || 135);
  const sType = normalizeSetType(setItem?.type);
  const reps = scheme === 'Timer' ? 8 : Math.max(1, Number(setItem?.reps) || 8);

  if (sType === '1 Rep Max' || totalSetsCount <= 1) return roundTo5(max1RM);

  // For Pyramid 1RM warmup sets (unless the user explicitly edited reps), use the exact 50%..85% warmup ramp
  if (
    scheme === 'Pyramid 1RM' &&
    sType === 'Warmup' &&
    setIndex < totalSetsCount - 1 &&
    setItem?.lastEditedField !== 'reps'
  ) {
    const warmupCount = Math.max(1, totalSetsCount - 1);
    const pct = warmupCount <= 1 ? 0.70 : 0.50 + (setIndex / (warmupCount - 1)) * 0.35;
    return roundTo5(max1RM * pct);
  }

  const repPct = 1 / (1 + Math.max(0, reps - 1) / 30);
  let typeMultiplier = 0.98;
  if (sType === 'Warmup') typeMultiplier = 0.74;
  else if (sType === 'Top Out') typeMultiplier = 1.04;
  else if (sType === 'Burn Out') typeMultiplier = 0.84;

  const setStressFactor = 1 / (1 + Math.max(0, totalSetsCount - 1) * 0.035);

  const rawWeight = max1RM * Math.min(1, repPct * typeMultiplier * setStressFactor);
  return roundTo5(rawWeight);
};

export const calculateEquivalentRepsForWeight = (
  base1RM,
  targetWeightLbs,
  setItem,
  totalSetsCount = 5,
  category = 'Compound',
  incrementLbs = 0
) => {
  const max1RM = Math.max(5, Number(base1RM) || 135);
  const sType = normalizeSetType(setItem?.type);
  if (sType === '1 Rep Max' || totalSetsCount <= 1) return 1;

  let typeMultiplier = 0.98;
  if (sType === 'Warmup') typeMultiplier = 0.74;
  else if (sType === 'Top Out') typeMultiplier = 1.04;
  else if (sType === 'Burn Out') typeMultiplier = 0.84;

  const setStressFactor = 1 / (1 + Math.max(0, totalSetsCount - 1) * 0.035);
  const effectiveBaseWeight = Math.max(5, (Number(targetWeightLbs) || 0) - (Number(incrementLbs) || 0));
  const denom = max1RM * typeMultiplier * setStressFactor;
  if (denom <= 0) return 1;

  const repPct = effectiveBaseWeight / denom;
  if (repPct >= 1) return 1;
  const computedReps = Math.round(1 + 30 * (1 / repPct - 1));
  return Math.max(1, Math.min(50, computedReps));
};

export const getIncrementInLbs = (goalIncrement = 1.25, goalUnit = 'lb', goalType = 'Balanced') => {
  if (goalType === 'Maintain') return 0;
  const inc = Number(goalIncrement) || 0;
  return goalUnit === 'kg' ? roundToIncrement(inc * 2.20462) : roundToIncrement(inc);
};

// The progression increment is added once to the total weight lifted (not per side of a barbell)
export const getEffectiveIncrementForExercise = (exerciseId, baseIncrementLbs = 0) => {
  const inc = Number(baseIncrementLbs) || 0;
  return inc > 0 ? roundToIncrement(inc) : 0;
};

// Exercise Set Preferences (Configuration → ROUTINES): the type of each set, by position, for new exercises on the
// uniform rep schemes (5x5, 5x6, 5x8, 5x10, 8x8). Sets beyond the list are Working. The 3-set schemes (3x5, 3x8,
// 3x12) take the last 3 of the first 5 positions (by default Working, Working, Working), like a superset's last 3 sets.
export const DEFAULT_SET_PREFERENCES = ['Warmup', 'Warmup', 'Working', 'Working', 'Working'];
export const SET_PREFERENCE_TYPES = ['Warmup', 'Working', 'Top Out', 'Burn Out'];
const typesFromSetPreferences = (count, setPreferences) => {
  const prefs = Array.isArray(setPreferences) && setPreferences.length > 0 ? setPreferences : DEFAULT_SET_PREFERENCES;
  return Array.from({ length: count }, (_, i) => (SET_PREFERENCE_TYPES.includes(prefs[i]) ? prefs[i] : 'Working'));
};

export const generateSetsForScheme = (
  scheme,
  oneRepMax,
  category = 'Compound',
  exerciseId = '',
  incrementLbs = 0,
  userBodyweightLbs = 220,
  setPreferences = DEFAULT_SET_PREFERENCES
) => {
  const isBw = isBodyweightExercise(exerciseId);
  const bwDefault = Math.max(0, Number(userBodyweightLbs) || 220);
  const base1RM = oneRepMax || (isBw ? bwDefault : EXERCISE_MAP[exerciseId]?.default1RM ?? 135);
  const effectiveInc = isBw ? 0 : getEffectiveIncrementForExercise(exerciseId, incrementLbs);
  const ts = Date.now() + Math.floor(Math.random() * 10000);

  const buildWithLastAndTarget = rawSets => {
    const totalCount = rawSets.length;
    return rawSets.map((s, idx) => {
      const normType = normalizeSetType(s.type);
      const lastW =
        s.lastWeight !== undefined
          ? s.lastWeight
          : isBw
            ? bwDefault
            : calculateLastEquivalentWeightForSet(base1RM, { ...s, type: normType }, totalCount, category, idx, scheme);
      const setInc = isBw || scheme === 'Timer' || normType === '1 Rep Max' ? 0 : effectiveInc;
      const targetW = isBw
        ? bwDefault
        : normType === '1 Rep Max'
          ? roundTo5(base1RM)
          : roundToIncrement(lastW + setInc);
      if (isTracing() && s.lastWeight === undefined) {
        if (isBw) traceLine(`set ${idx + 1}: bodyweight ${fmt(bwDefault)} lb`);
        else if (normType === '1 Rep Max') traceLine(`set ${idx + 1} 1 Rep Max: 1RM ${fmt(base1RM)} → ${fmt(targetW)} lb`);
        else if (scheme !== 'Timer') {
          const reps = Math.max(1, Number(s.reps) || 8);
          const repPct = 1 / (1 + Math.max(0, reps - 1) / 30);
          const typeM = SET_TYPE_MULTIPLIER_MAP[normType] ?? 0.98;
          const fatigue = 1 / (1 + Math.max(0, totalCount - 1) * 0.035);
          traceLine(
            `set ${idx + 1} ${normType} × ${reps}: 1RM ${fmt(base1RM)} × reps ${fmt(repPct)} [1 ÷ (1 + (${reps} − 1) ÷ 30)] × type ${fmt(typeM)} × fatigue ${fmt(fatigue)} [${totalCount} sets] = ${fmt(lastW)} lb${setInc ? ` + increment ${fmt(setInc)}` : ''} → ${fmt(targetW)} lb`
          );
        }
      }
      return {
        id: `set_${ts}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
        setNumber: idx + 1,
        type: normType,
        reps: s.reps,
        ...(scheme === 'Timer'
          ? {
              durationSeconds: s.durationSeconds || 120,
              timerStr: s.timerStr || '02:00'
            }
          : {}),
        lastWeight: lastW,
        increment: setInc,
        weight: targetW,
        completed: false
      };
    });
  };

  switch (scheme) {
    case 'Timer':
      return buildWithLastAndTarget(
        Array.from({ length: 5 }, () => ({
          type: 'Working',
          reps: 120,
          durationSeconds: 120,
          timerStr: '02:00'
        }))
      );
    case '3x5':
    case '3x8':
    case '3x12':
      return buildWithLastAndTarget(
        typesFromSetPreferences(5, setPreferences)
          .slice(-3)
          .map(type => ({ type, reps: getSchemeUniformReps(scheme) }))
      );
    case '5x5':
      return buildWithLastAndTarget(typesFromSetPreferences(5, setPreferences).map(type => ({ type, reps: 5 })));
    case '5x6':
      return buildWithLastAndTarget(typesFromSetPreferences(5, setPreferences).map(type => ({ type, reps: 6 })));
    case '5x10':
      return buildWithLastAndTarget(typesFromSetPreferences(5, setPreferences).map(type => ({ type, reps: 10 })));
    case '8x8':
      return buildWithLastAndTarget(typesFromSetPreferences(8, setPreferences).map(type => ({ type, reps: 8 })));
    case CLUSTER_SCHEME:
      return buildWithLastAndTarget(
        Array.from({ length: CLUSTER_SET_COUNT }, () => ({ type: 'Working', reps: CLUSTER_REPS }))
      );
    case 'Pyramid':
      return buildWithLastAndTarget([
        { reps: 8, type: 'Warmup' },
        { reps: 5, type: 'Working' },
        { reps: 3, type: 'Working' },
        { reps: 2, type: 'Working' },
        { reps: 1, type: 'Top Out' }
      ]);
    case 'Pyramid 1RM': {
      const pyramidReps = [8, 5, 3, 2, 1];
      const totalCount = pyramidReps.length;
      const maxW = isBw ? bwDefault : roundTo5(base1RM);
      return pyramidReps.map((reps, idx) => {
        if (idx === totalCount - 1) {
          return {
            id: `set_${ts}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
            setNumber: idx + 1,
            type: '1 Rep Max',
            reps: 1,
            lastWeight: maxW,
            increment: isBw ? 0 : effectiveInc,
            weight: isBw ? bwDefault : roundToIncrement(maxW + effectiveInc),
            completed: false
          };
        }
        const warmupW = isBw
          ? bwDefault
          : calculateLastEquivalentWeightForSet(
              base1RM,
              { reps, type: 'Warmup' },
              totalCount,
              category,
              idx,
              'Pyramid 1RM'
            );
        return {
          id: `set_${ts}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
          setNumber: idx + 1,
          type: 'Warmup',
          reps,
          lastWeight: warmupW,
          increment: 0,
          weight: warmupW,
          completed: false
        };
      });
    }
    case 'Reverse Pyramid':
      return buildWithLastAndTarget([
        { reps: 8, type: 'Warmup' },
        { reps: 4, type: 'Top Out' },
        { reps: 6, type: 'Working' },
        { reps: 8, type: 'Working' },
        { reps: 10, type: 'Working' }
      ]);
    case '5x8':
    default:
      return buildWithLastAndTarget(typesFromSetPreferences(5, setPreferences).map(type => ({ type, reps: 8 })));
  }
};

// ============================================================================
// GOAL PROGRESS — set weights for RECALCULATE, + ADD EXERCISE and AUTO SESSION, all through ONE calculated 1RM
// for the whole exercise (the common value that converts between schemes, reps and set types).
// A set's 1RM factor = rep % × set-type effort × fatigue for the number of sets (the same estimate as the 1RM
// calculator, estimate1RMFromSet, unrounded); an exercise's calculated 1RM = the highest weight ÷ factor over its sets.
// Working sets (every set that isn't a Warm-up) each get the LOWER of:
//   A) last session: if that set's reps (and type) match last time, last weight + increment; otherwise last
//      session's calculated 1RM converted to this set, + increment
//   B) the stored 1RM + increment, converted to this set
// The increment is added once to the total weight. Warm-up sets are converted from the 1RM the working weight
// implies; on RECALCULATE, once the first set's weight is entered, the sets before the working sets ramp up from it.
// Weights round to the nearest min(2.5, increment) lb. Applies to rep schemes (not Pyramid 1RM / Timer) and
// weighted exercises (not bodyweight). Nothing known yet (no 1RM, no previous session) → the scheme defaults.
// ============================================================================

export const GOAL_PROGRESS_SCHEMES = ['3x5', '3x8', '3x12', '5x5', '5x6', '5x8', '5x10', '8x8', 'Pyramid', 'Reverse Pyramid', 'Cluster'];

const roundToStep = (val, step) => Math.round(val / step) * step;

/** 1RM factor of one set within an exercise of `totalSetsCount` sets (weight = 1RM × factor). */
export const getSetOneRepMaxFactor = (setItem, totalSetsCount = 1) => {
  const reps = Math.max(1, Number(setItem?.reps) || 1);
  const sType = normalizeSetType(setItem?.type);
  if (sType === '1 Rep Max' || (reps === 1 && totalSetsCount <= 1)) return 1;
  const repPct = 1 / (1 + Math.max(0, reps - 1) / 30);
  const typeMultiplier = SET_TYPE_MULTIPLIER_MAP[sType] || 0.98;
  const setStressFactor = 1 / (1 + Math.max(0, totalSetsCount - 1) * 0.035);
  return Math.min(1, repPct * typeMultiplier * setStressFactor);
};

/**
 * Calculated 1RM of a whole exercise from its sets (completed ones if any were completed); 0 = no weights.
 * Warm-ups only count when the exercise has no other sets: they're deliberately easy, so with their 0.74 effort
 * factor a warm-up close to the working weight would otherwise imply a higher 1RM than the working sets.
 */
export const getExerciseCalculated1RM = sets => {
  const weighted = (Array.isArray(sets) ? sets : []).filter(st => st && Number(st.weight) > 0);
  if (weighted.length === 0) return 0;
  const completed = weighted.filter(st => st.completed);
  const pool = completed.length > 0 ? completed : weighted;
  const nonWarmup = pool.filter(st => normalizeSetType(st.type) !== 'Warmup');
  const used = nonWarmup.length > 0 ? nonWarmup : pool;
  const total = (Array.isArray(sets) ? sets : []).length || used.length;
  // A set's reps in reserve count as reps it could have done
  return Math.max(
    ...used.map(st => Number(st.weight) / getSetOneRepMaxFactor({ ...st, reps: Math.max(1, Number(st.reps) || 1) + setReportedRir(st) }, total))
  );
};

/** Every logged session of an exercise, newest first: [{ workoutId, startedAt, sets }] (PR entries included). */
/** A workout's time in ms: startedAt (ISO string or ms), else its YYYY/MM/DD workoutDate (local noon); 0 if unknown. */
export const workoutTimeMs = workout => {
  const started = workout?.startedAt;
  const fromStarted = typeof started === 'number' ? started : Date.parse(started || '');
  if (Number.isFinite(fromStarted) && fromStarted > 0) return fromStarted;
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(String(workout?.workoutDate || '').trim());
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime() : 0;
};

/**
 * History as it stood when `workout` was logged: that workout plus every one logged at or before its time. A History
 * entry's 1RM box (LAST / NOW / PR), its weight pop-up and its PR badges read this, so they show the numbers of that
 * day (LAST = the session before it, PR = the best up to and including it), not today's.
 */
export const historyAsOf = (history = [], workout = null) => {
  const t = workoutTimeMs(workout);
  if (!t) return history || [];
  return (history || []).filter(w => w && (w.id === workout.id || workoutTimeMs(w) <= t));
};

const getLoggedSessionsForExercise = (exerciseId, history = [], excludeWorkoutId = null) =>
  (history || [])
    .filter(w => w && w.id !== excludeWorkoutId)
    .sort((a, b) => workoutTimeMs(b) - workoutTimeMs(a))
    .map(w => {
      const sets = [];
      (w.slots || []).forEach(slot => {
        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
          const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId];
          ids.forEach((id, idx) => {
            if (id === exerciseId) sets.push(...withEffectiveLoad(id, slot.supersetSetsByExercise[idx] || [], getSlotEquipmentChoice(slot, idx)));
          });
        } else if (slot.exerciseId === exerciseId) {
          // Bodyweight-type exercises: their load by the slot's equipment choice
          sets.push(...withEffectiveLoad(exerciseId, slot.sets || [], getSlotEquipmentChoice(slot, 0)));
        }
      });
      return { workoutId: w.id, isPersonalRecord: w.loadedRoutineTitle === 'PERSONAL RECORD', sets };
    })
    .filter(s => s.sets.some(st => st && Number(st.weight) > 0));

/** Sets of the most recent real session (not a PERSONAL RECORD entry) that logged the exercise. */
export const getLastLoggedSetsForExercise = (exerciseId, history = [], excludeWorkoutId = null) =>
  getLoggedSessionsForExercise(exerciseId, history, excludeWorkoutId).find(s => !s.isPersonalRecord)?.sets || [];

/** Stored 1RM: the highest calculated 1RM over all logged sessions (PR entries included) or a saved 1RM. */
export const getStored1RM = (exerciseId, history = [], oneRepMaxes = {}, excludeWorkoutId = null) =>
  Math.max(
    Number(oneRepMaxes?.[exerciseId]) || 0,
    ...getLoggedSessionsForExercise(exerciseId, history, excludeWorkoutId).map(s => getExerciseCalculated1RM(s.sets))
  );

/**
 * Applies goal progress to an exercise's sets. `lockedIndexes` (completed sets, weights the athlete typed) and
 * set 0 when `startWeight` is given keep their weight.
 */
export const applyGoalProgressToSets = (
  sets,
  { exerciseId, scheme, history = [], oneRepMaxes = {}, incrementLbs = 0, excludeWorkoutId = null, lockedIndexes = [], startWeight = null }
) => {
  const list = Array.isArray(sets) ? sets : [];
  if (list.length === 0 || !GOAL_PROGRESS_SCHEMES.includes(scheme) || isBodyweightExercise(exerciseId)) return list;
  const inc = getEffectiveIncrementForExercise(exerciseId, incrementLbs);
  const step = inc > 0 ? Math.min(2.5, inc) : 2.5;
  const total = list.length;
  const stored1RM = getStored1RM(exerciseId, history, oneRepMaxes, excludeWorkoutId);
  const lastSets = getLastLoggedSetsForExercise(exerciseId, history, excludeWorkoutId);
  const last1RM = getExerciseCalculated1RM(lastSets);
  if (stored1RM <= 0 && last1RM <= 0) {
    if (isTracing()) traceLine(`No logged sets yet: the scheme's own weights stand (from the 1RM above)`);
    return list;
  }
  if (isTracing()) {
    traceLine(
      `Goal progress: increment ${fmt(inc)} lb · stored 1RM ${fmt(stored1RM)} lb · last session's 1RM ${fmt(last1RM)} lb · factor(set) = 1 ÷ (1 + (reps − 1) ÷ 30) × type effort × fatigue for ${total} sets`
    );
  }

  const isWarmup = st => normalizeSetType(st?.type) === 'Warmup';
  let workingIdx = list.map((st, i) => (isWarmup(st) ? -1 : i)).filter(i => i >= 0);
  if (workingIdx.length === 0) workingIdx = list.map((_, i) => i);
  const firstWorking = workingIdx[0];
  // Last session matches when it had the same number of sets; then set i is compared with set i
  const sameShape = lastSets.length === total;

  const targetFor = (st, idx) => {
    const factor = getSetOneRepMaxFactor(st, total);
    const options = [];
    const parts = [];
    if (last1RM > 0) {
      const prev = sameShape ? lastSets[idx] : null;
      const repsMatch =
        prev && Number(prev.reps) === Number(st.reps) && normalizeSetType(prev.type) === normalizeSetType(st.type);
      const a = repsMatch ? Number(prev.weight) + inc : last1RM * factor + inc;
      options.push(a);
      parts.push(
        repsMatch
          ? `last ${fmt(prev.weight)} + ${fmt(inc)} = ${fmt(a)}`
          : `last 1RM ${fmt(last1RM)} × ${fmt(factor)} + ${fmt(inc)} = ${fmt(a)}`
      );
    }
    if (stored1RM > 0) {
      const b = (stored1RM + inc) * factor;
      options.push(b);
      parts.push(`(1RM ${fmt(stored1RM)} + ${fmt(inc)}) × ${fmt(factor)} = ${fmt(b)}`);
    }
    const result = Math.max(0, roundToStep(Math.min(...options), step));
    if (isTracing()) {
      traceLine(
        `set ${idx + 1} ${normalizeSetType(st.type)} × ${st.reps}: ${parts.length > 1 ? `lower of ${parts.join(' and ')}` : parts[0]} → ${fmt(result)} lb`
      );
    }
    return result;
  };

  const targets = {};
  workingIdx.forEach(i => {
    targets[i] = targetFor(list[i], i);
  });
  // The 1RM the first working set implies (warm-ups are converted from it)
  const implied1RM = targets[firstWorking] / getSetOneRepMaxFactor(list[firstWorking], total);

  const locked = new Set(lockedIndexes);
  const hasStart = Number(startWeight) > 0;
  if (hasStart) locked.add(0);
  const withIncrement = (st, weight) => {
    const lastWeight = Number(st.lastWeight) > 0 ? Number(st.lastWeight) : weight;
    return { ...st, weight, lastWeight, increment: Math.round((weight - lastWeight) * 100) / 100 };
  };
  return list.map((st, idx) => {
    if (locked.has(idx)) return st;
    if (targets[idx] !== undefined) return withIncrement(st, targets[idx]);
    // Sets before the first working set: ramp from the entered first weight on RECALCULATE, else convert
    if (hasStart && idx < firstWorking) {
      const ramp = Number(startWeight) + ((targets[firstWorking] - Number(startWeight)) * idx) / firstWorking;
      return withIncrement(st, Math.max(0, roundToStep(ramp, step)));
    }
    const w = Math.max(0, roundToStep(implied1RM * getSetOneRepMaxFactor(st, total), step));
    if (isTracing()) {
      traceLine(
        `set ${idx + 1} Warm-up × ${st.reps}: 1RM implied by set ${firstWorking + 1} (${fmt(targets[firstWorking])} ÷ ${fmt(getSetOneRepMaxFactor(list[firstWorking], total))} = ${fmt(implied1RM)}) × ${fmt(getSetOneRepMaxFactor(st, total))} → ${fmt(w)} lb`
      );
    }
    return withIncrement(st, w);
  });
};

// Pyramid schemes vary the reps set by set, so the editor's SETS / REPS boxes read NA for them (and for Timer reps)
export const PYRAMID_SCHEMES = ['Pyramid', 'Pyramid 1RM', 'Reverse Pyramid'];
const PYRAMID_REPS = { Pyramid: [8, 5, 3, 2, 1], 'Pyramid 1RM': [8, 5, 3, 2, 1], 'Reverse Pyramid': [8, 4, 6, 8, 10] };
// A superset has this many sets (rounds); each round is one set of exercise A and one of exercise B
export const SUPERSET_SET_COUNT = 3;

/** Reps a uniform scheme asks for ("5x8" → 8); null for pyramids and Timer. */
export const getSchemeUniformReps = scheme => {
  if (isClusterScheme(scheme)) return CLUSTER_REPS;
  const match = /^(\d+)x(\d+)/.exec(String(scheme || ''));
  return match ? Number(match[2]) : null;
};

/**
 * Target reps of set `idx` (of `total`) when RECALCULATE resets unlocked reps: the slot's own REPS box
 * (`targetReps`) on uniform schemes, else the scheme's reps; pyramids follow their pattern (stretched to the count).
 * null = leave the reps alone (Timer).
 */
export const getTargetRepsForSet = (scheme, idx, total, targetReps = null) => {
  if (scheme === 'Timer') return null;
  const pattern = PYRAMID_REPS[scheme];
  if (pattern) {
    if (total <= 1) return pattern[pattern.length - 1];
    const pos = Math.round((idx / (total - 1)) * (pattern.length - 1));
    return pattern[Math.max(0, Math.min(pattern.length - 1, pos))];
  }
  const typed = Number(targetReps);
  if (Number.isFinite(typed) && typed > 0) return Math.round(typed);
  return getSchemeUniformReps(scheme) || 8;
};

/** Keeps the last `count` sets (the working sets on the usual schemes), renumbered. */
export const trimSetsTo = (sets, count) =>
  (Array.isArray(sets) ? sets : []).slice(-count).map((st, i) => ({ ...st, setNumber: i + 1 }));

/**
 * History entries default to finished, fixed sets: every set is marked done and its type, weight and reps are
 * locked (lockType / lockWeight / lockReps), unless a lock was already turned off (false stays false). Done once per
 * exercise: the slot is marked `historyLocked` (slots sync with the workout), so later edits in the History editor —
 * e.g. unticking a set — are kept.
 */
export const lockAndCompleteSets = slots => {
  const fix = list =>
    (Array.isArray(list) ? list : []).map(st =>
      st
        ? {
            ...st,
            completed: true,
            lockType: st.lockType ?? true,
            lockWeight: st.lockWeight ?? true,
            lockReps: st.lockReps ?? true
          }
        : st
    );
  return (Array.isArray(slots) ? slots : []).map(slot => {
    if (!slot || slot.historyLocked) return slot;
    const matrix = Array.isArray(slot.supersetSetsByExercise) ? slot.supersetSetsByExercise.map(fix) : undefined;
    return {
      ...slot,
      historyLocked: true,
      sets: fix(slot.sets),
      ...(Array.isArray(slot.secondarySets) ? { secondarySets: fix(slot.secondarySets) } : {}),
      ...(matrix ? { supersetSetsByExercise: matrix } : {})
    };
  });
};

/**
 * FINISH: only the sets marked done go to History. Exercises with no done set are left out; a superset keeps both
 * halves' done sets (`sets` / `secondarySets` mirror the halves).
 */
export const keepCompletedSets = slots =>
  (Array.isArray(slots) ? slots : [])
    .map(slot => {
      if (!slot) return null;
      const done = list => (Array.isArray(list) ? list : []).filter(st => st && st.completed);
      if (Array.isArray(slot.supersetSetsByExercise) && slot.supersetSetsByExercise.length > 1) {
        const matrix = slot.supersetSetsByExercise.map(done);
        if (matrix.every(list => list.length === 0)) return null;
        return { ...slot, supersetSetsByExercise: matrix, sets: matrix[0] || [], secondarySets: matrix[1] || [] };
      }
      const sets = done(slot.sets);
      if (sets.length === 0) return null;
      return {
        ...slot,
        sets,
        ...(Array.isArray(slot.supersetSetsByExercise) ? { supersetSetsByExercise: [sets] } : {})
      };
    })
    .filter(Boolean);

/** A History workout as it is shown and edited: exercises not yet marked get their sets done and locked once. */
export const asHistoricalWorkout = workout =>
  workout && (workout.slots || []).some(slot => slot && !slot.historyLocked)
    ? { ...workout, slots: lockAndCompleteSets(workout.slots) }
    : workout;

/** [schemeA, schemeB] for a superset (each exercise may run its own scheme); falls back to slot.scheme. */
export const getSupersetSchemes = slot => [
  slot?.supersetSchemes?.[0] || slot?.scheme || '5x8',
  slot?.supersetSchemes?.[1] || slot?.scheme || '5x8'
];

export const createWorkoutSlot = ({
  category,
  slotLabel,
  exerciseId,
  secondaryExerciseId = null,
  supersetExerciseIds = null,
  scheme = '5x8',
  // Superset only: [schemeA, schemeB]; defaults to scheme for both
  supersetSchemes = null,
  oneRepMaxes = {},
  history = [],
  incrementLbs = 0,
  restSeconds = 90,
  userBodyweightLbs = 220,
  // Optional { [exerciseId]: estimated1RM } used only when the exercise has no logged history
  // (e.g. converting a barbell lift's 1RM to a dumbbell equivalent after an equipment swap).
  base1RMOverrides = null,
  // Exercise Set Preferences (types of each set on the uniform rep schemes)
  setPreferences = DEFAULT_SET_PREFERENCES
}) => {
  const uid = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const normCat = normalizeSlotCategory(category);
  const resolveBase1RM = id => {
    const override = Number(base1RMOverrides?.[id]) || 0;
    if (override > 0 && getBestHistory1RM(id, history) <= 0) return override;
    return getHistoricalCalculated1RM(id, history, oneRepMaxes);
  };

  if (normCat === 'Superset') {
    const rawIds =
      Array.isArray(supersetExerciseIds) && supersetExerciseIds.length > 0
        ? supersetExerciseIds
        : [exerciseId, secondaryExerciseId].filter(Boolean);
    const exA = rawIds[0] || 'reverse_lunge';
    const exB = rawIds[1] || (exA === 'reverse_lunge' ? 'front_flies' : 'reverse_lunge');
    const cleanIds = [exA, exB];
    const schemes = [supersetSchemes?.[0] || scheme, supersetSchemes?.[1] || scheme];

    const setsByExercise = cleanIds.map((id, idx) => {
      const calcMax = resolveBase1RM(id);
      // Working sets follow goal progress (last weight + increment, or stored 1RM + increment, whichever is lower)
      // Supersets run SUPERSET_SET_COUNT rounds: the scheme's last sets (its working sets)
      return applyGoalProgressToSets(
        trimSetsTo(
          generateSetsForScheme(schemes[idx], calcMax, 'Superset', id, incrementLbs, userBodyweightLbs, setPreferences),
          SUPERSET_SET_COUNT
        ),
        { exerciseId: id, scheme: schemes[idx], history, oneRepMaxes, incrementLbs }
      );
    });
    return {
      id: uid,
      category: 'Superset',
      slotLabel: slotLabel || 'Superset',
      scheme: schemes[0],
      supersetSchemes: schemes,
      restSeconds,
      muscleGroupFilter: EXERCISE_MAP[cleanIds[0]]?.muscleGroup || 'All Muscles',
      exerciseId: cleanIds[0],
      secondaryExerciseId: cleanIds[1],
      supersetExerciseIds: cleanIds,
      supersetSetsByExercise: setsByExercise,
      sets: setsByExercise[0] || [],
      secondarySets: setsByExercise[1] || []
    };
  }

  const ex1 = EXERCISE_MAP[exerciseId] || EXERCISE_LIBRARY[0];
  const calcMax1 = resolveBase1RM(ex1.id);
  // Working sets follow goal progress (last weight + increment, or stored 1RM + increment, whichever is lower)
  const sets1 = applyGoalProgressToSets(
    generateSetsForScheme(scheme, calcMax1, normCat, ex1.id, incrementLbs, userBodyweightLbs, setPreferences),
    { exerciseId: ex1.id, scheme, history, oneRepMaxes, incrementLbs }
  );

  return {
    id: uid,
    category: normCat,
    slotLabel: slotLabel || normCat,
    scheme,
    restSeconds,
    muscleGroupFilter: ex1.muscleGroup || 'All Muscles',
    exerciseId: ex1.id,
    secondaryExerciseId: null,
    supersetExerciseIds: [ex1.id],
    supersetSetsByExercise: [sets1],
    sets: sets1,
    secondarySets: []
  };
};

// A single exercise is only its own exercise: an earlier pick (or a superset it used to be) can leave stale ids in
// supersetExerciseIds / secondaryExerciseId, which equipment checks would otherwise count
const singleExerciseIds = slot => ({ secondaryExerciseId: null, supersetExerciseIds: slot.exerciseId ? [slot.exerciseId] : [] });

export const normalizeSlotLabels = slots => {
  let compoundCount = 0;
  let supersetCount = 0;
  let accessoryCount = 0;
  return (slots || [])
    .filter(slot => slot && slot.category !== 'Warm-Up Routine' && slot.exerciseId !== 'warmup_12_step')
    .map(applyBandWeights)
    .map(slot => {
      const normCat = normalizeSlotCategory(slot.category);
      if (normCat === 'Compound') {
        compoundCount += 1;
        return { ...slot, ...singleExerciseIds(slot), category: 'Compound', slotLabel: `Compound ${compoundCount}` };
      }
      if (normCat === 'Superset') {
        supersetCount += 1;
        const rawIds =
          Array.isArray(slot.supersetExerciseIds) && slot.supersetExerciseIds.length > 0
            ? slot.supersetExerciseIds
            : [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
        const exA = rawIds[0] || 'reverse_lunge';
        const exB = rawIds[1] || (exA === 'reverse_lunge' ? 'front_flies' : 'reverse_lunge');
        return {
          ...slot,
          category: 'Superset',
          slotLabel: `Superset ${supersetCount}`,
          exerciseId: exA,
          secondaryExerciseId: exB,
          supersetExerciseIds: [exA, exB]
        };
      }
      if (normCat === 'Accessory') {
        accessoryCount += 1;
        return { ...slot, ...singleExerciseIds(slot), category: 'Accessory', slotLabel: `Accessory ${accessoryCount}` };
      }
      return { ...slot, category: normCat };
    });
};

export const buildPresetSlots = (presetKey, oneRepMaxes, history = [], incrementLbs = 0, userBodyweightLbs = 220) => {
  switch (presetKey) {
    case 'full_body_a':
    case 'mon_tue':
      return normalizeSlotLabels([
        createWorkoutSlot({ category: 'Compound', slotLabel: 'Compound 1', exerciseId: 'barbell_bench_press', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Compound', slotLabel: 'Compound 2', exerciseId: 'barbell_back_squat', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Superset', slotLabel: 'Superset 1', supersetExerciseIds: ['reverse_lunge', 'front_flies'], scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Accessory', slotLabel: 'Accessory 1', exerciseId: 'hollow_holds', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs })
      ]);
    case 'full_body_b':
    case 'wed_thu':
      return normalizeSlotLabels([
        createWorkoutSlot({ category: 'Compound', slotLabel: 'Compound 1', exerciseId: 'barbell_deadlift', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Compound', slotLabel: 'Compound 2', exerciseId: 'overhead_press', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Superset', slotLabel: 'Superset 1', supersetExerciseIds: ['pistol_squats', 'reverse_flies'], scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Accessory', slotLabel: 'Accessory 1', exerciseId: 'hollow_holds', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs })
      ]);
    case 'arms_only':
    case 'arms_pump':
      return normalizeSlotLabels([
        createWorkoutSlot({ category: 'Compound', slotLabel: 'Compound 1', exerciseId: 'chin_ups', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Compound', slotLabel: 'Compound 2', exerciseId: 'incline_bench_press', scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Superset', slotLabel: 'Superset 1', supersetExerciseIds: ['barbell_bicep_curl', 'tricep_skullcrusher'], scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs }),
        createWorkoutSlot({ category: 'Superset', slotLabel: 'Superset 2', supersetExerciseIds: ['dumbbell_hammer_curl', 'side_raise_dumbbell'], scheme: '5x8', oneRepMaxes, history, incrementLbs, userBodyweightLbs })
      ]);
    default:
      return [];
  }
};

export const getInitial1RMs = () => {
  return {};
};

export const checkIsWorkoutComplete = slots => {
  if (!slots || slots.length === 0) return false;
  for (const slot of slots) {
    if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
      for (const list of slot.supersetSetsByExercise) {
        if (!list || list.some(s => !s.completed)) return false;
      }
    } else {
      if (!slot.sets || slot.sets.length === 0 || slot.sets.some(s => !s.completed)) return false;
    }
  }
  return true;
};

export const formatTimerSeconds = sec => {
  const isNeg = sec < 0;
  const abs = Math.abs(sec);
  const mins = Math.floor(abs / 60);
  const rem = abs % 60;
  const formatted = `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  return isNeg ? `-${formatted}` : formatted;
};

export const cloneSlots = slots => {
  if (!Array.isArray(slots)) return [];
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(slots);
    } catch {
      // Fallback below
    }
  }
  return JSON.parse(JSON.stringify(slots));
};

// Session header NEXT bar: short exercise name (no Barbell / Dumbbell…) and 'SET 1 • 172.5 LB × 5' so it fits at phone width
export const getNextIncompleteSetInfo = slots => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return {
      topLine: 'NO EXERCISES QUEUED',
      bottomLine: ''
    };
  }
  for (const slot of slots) {
    const isTimer = slot.scheme === 'Timer';
    if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
      const ids = slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
      const maxLen = Math.max(0, ...slot.supersetSetsByExercise.map(l => (l ? l.length : 0)));
      for (let sIdx = 0; sIdx < maxLen; sIdx++) {
        for (let exIdx = 0; exIdx < Math.min(2, slot.supersetSetsByExercise.length); exIdx++) {
          const st = slot.supersetSetsByExercise[exIdx]?.[sIdx];
          if (st && !st.completed) {
            const exName = stripEquipmentFromExerciseName(EXERCISE_MAP[ids[exIdx]]?.name || ids[exIdx] || 'Lift');
            const repOrTime = isTimer ? getSetTimerMMSS(st, true) : `${st.reps}`;
            const load = isBandEquipment(getSlotEquipmentChoice(slot, exIdx))
              ? getBandLoadLabel(getSetBandColor(st))
              : `${st.weight} LB`;
            return {
              topLine: `NEXT: ${exName.toUpperCase()}`,
              bottomLine: `SET ${st.setNumber} • ${load} × ${repOrTime}`
            };
          }
        }
      }
    } else if (Array.isArray(slot.sets)) {
      for (const st of slot.sets) {
        if (st && !st.completed) {
          const exName = stripEquipmentFromExerciseName(EXERCISE_MAP[slot.exerciseId]?.name || slot.exerciseId || 'Lift');
          const repOrTime = isTimer ? getSetTimerMMSS(st, true) : `${st.reps}`;
          const load = isBandEquipment(getSlotEquipmentChoice(slot, 0))
            ? getBandLoadLabel(getSetBandColor(st))
            : `${st.weight} LB`;
          const loadStr = `${load} × ${repOrTime}`;
          return {
            topLine: `NEXT: ${exName.toUpperCase()}`,
            bottomLine: `SET ${st.setNumber} • ${loadStr}`
          };
        }
      }
    }
  }
  return { topLine: 'ALL SETS COMPLETE ✓', bottomLine: 'READY TO SAVE SESSION' };
};

