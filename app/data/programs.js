// Training programs (Configuration → PROGRAM). `settings.program` holds the chosen id and `settings.programCycleStart`
// the date its current cycle began (local + cloud); Crying is the default. Programs other than Crying use a week per
// session (the session header's PROGRAM / WEEK row) and an intensity per set (%1RM / RIR / RPE); Crying uses neither.
//
// A program is described by a set of variables (shown on Configuration → PROGRAM as `variables`):
//   appliesTo    slot types it programs (others keep the app's defaults), e.g. ['Compound']
//   sets         sets per programmed exercise
//   weekPlan(w)  week w's { scheme, rir } (rir = reps in reserve on working sets) or { scheme, maxOut: true } (1RM day)
//   increment    'cycle' = the goal increment is added to the 1RM once per cycle (the target the cycle builds to)
//   trigger      what moves the program on early (null = none)
//   cycleWeeks   weeks per cycle; weekName(w) its label ("Week 3")
//   restSeconds  default rest timer
//   equipment    equipment options its exercises are picked from (getExerciseEquipmentOptions names)
// Society and Crying are built; the rest are listed as coming soon.

export const DEFAULT_PROGRAM_ID = 'crying';

export const PROGRAMS = [
  {
    id: 'crying',
    label: 'Crying',
    description:
      'Automatically selects exercises based on muscle stimulus needs, and pushes you to your max every time, because you’re not a baby. Offers flexibility on goals, sets and reps. Is not bound by a weekly schedule, work out as much as you can and it will plan the exercise you need based on your history and goals.',
    comingSoon: false,
    usesWeeks: false,
    usesIntensity: false
  },
  {
    id: 'society',
    label: 'Society',
    description:
      'An 8 week program, each week is a routine of 2x compound lifts, 2x supersets and an accessory. It starts mellow by determining a baseline with 6 RIR (reps in reserve) and ramps up to a new personal record 1RM (1 rep max) on week 8. Varies in scheme from 5x8 to Pyramid. Driven by muscle stimulus needs, but offers more variety in lifts than Crying.',
    // The session's exercise types (AUTO SESSION / + ADD EXERCISE use this instead of Routine Preferences)
    routine: ['Compound', 'Compound', 'Superset', 'Superset', 'Accessory'],
    // Compound picks: the first is one of the Big 3, every other one a Big 3 variant (still by muscle stimulus)
    compoundPicks: 'big3-then-variants',
    comingSoon: false,
    usesWeeks: true,
    usesIntensity: true,
    appliesTo: ['Compound'],
    sets: 5,
    // Weeks 1–2: 5×8; weeks 3–7: Pyramid; week 8: 1RM Pyramid. RIR 6 in week 1, one less each week (0 in week 7)
    weekPlan: week =>
      week >= 8
        ? { scheme: 'Pyramid 1RM', maxOut: true }
        : { scheme: week >= 3 ? 'Pyramid' : '5x8', rir: Math.max(0, 7 - week) },
    increment: 'cycle',
    trigger: null,
    cycleWeeks: 8,
    weekName: week => `Week ${week}`,
    restSeconds: 90,
    equipment: ['Barbell', 'Dumbbell', 'Band', 'Landmine', 'EZ Bar'],
    variables: [
      ['Routine', '2 compound lifts, 2 supersets, 1 accessory'],
      ['Compounds', 'One of the Big 3, then Big 3 variants (by muscle stimulus)'],
      ['Applies to', 'Compound exercises (accessories and supersets keep the defaults)'],
      ['Sets', '5'],
      ['Reps', '8 in weeks 1–2, Pyramid in weeks 3–7, 1RM Pyramid in week 8'],
      ['Intensity', 'RIR 6 in week 1, one less each week, 1RM in week 8'],
      ['Increment', 'Added to your 1RM once per 8-week cycle'],
      ['Trigger', 'None'],
      ['Cycle', '8 weeks'],
      ['Week name', 'Week #'],
      ['Rest timer', '1:30'],
      ['Equipment', 'Barbells, dumbbells, bands, landmine, EZ bar']
    ]
  },
  { id: 'linear_3x5', label: 'Linear 3x5 Foundation' },
  { id: 'linear_5x5', label: 'Linear 5x5 Foundation' },
  { id: 'wave_percentage', label: 'Wave Percentage Strength' },
  { id: 'weekly_undulating', label: 'Weekly Undulating Strength' },
  { id: 'bro_split', label: 'Bro Split' },
  { id: 'upper_lower_4day', label: '4-Day Upper/Lower Balance' }
].map(p => ({
  description: 'Coming soon.',
  comingSoon: true,
  usesWeeks: true,
  usesIntensity: true,
  weekPlan: null,
  appliesTo: [],
  ...p
}));

export const PROGRAM_IDS = PROGRAMS.map(p => p.id);

export const getProgram = id => PROGRAMS.find(p => p.id === id) || PROGRAMS[0];

export const normalizeProgramId = id => (PROGRAM_IDS.includes(id) ? id : DEFAULT_PROGRAM_ID);

/**
 * A History entry keeps its program and week (`program`, `programWeek`) on the workout and on each exercise: the
 * cloud's workout_history keeps only the exercises, so the copy on them is what reaches other devices.
 */
export const withProgramInfo = entry => {
  const program = entry?.program || null;
  const programWeek = entry?.programWeek || '';
  if (!program || program === DEFAULT_PROGRAM_ID) return entry;
  return {
    ...entry,
    slots: (entry.slots || []).map(slot => ({ ...slot, programInfo: { program, programWeek } }))
  };
};

/** The program and week a workout was logged under ({ program, programWeek }), or null. */
export const getWorkoutProgramInfo = workout => {
  if (!workout) return null;
  if (workout.program && workout.program !== DEFAULT_PROGRAM_ID) {
    return { program: workout.program, programWeek: workout.programWeek || '' };
  }
  return (workout.slots || []).find(slot => slot?.programInfo?.program)?.programInfo || null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
// Local calendar day number (so a cycle's weeks turn over at midnight, whatever the hour)
const localDayNumber = ms => {
  const d = new Date(ms);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime() / DAY_MS);
};

// Calendar weeks run Monday to Sunday (local time). Day 0 (1970-01-01) was a Thursday, so +3 starts weeks on Monday.
const calendarWeekIndex = ms => Math.floor((localDayNumber(ms) + 3) / 7);
const toMs = iso => new Date(iso || NaN).getTime();

/**
 * The week a session falls in, from the program's logged sessions (they keep track of themselves):
 *   - nothing logged under the program since its cycle (re)started → week 1
 *   - the last logged session was in an earlier calendar week (Mon–Sun) → its week + 1 (after the last week, week 1
 *     of a new cycle). A gap of several weeks still moves on by one: a paused program carries on where it left off.
 *   - the same calendar week → the same week
 * Also returns when the current cycle began (its first week-1 session), which the 1RM target is built from.
 * `restartIso` (settings.programCycleStart: picking the program or RESTART AT WEEK 1) ignores everything before it.
 */
export const getAutoProgramWeek = (program, history = [], dateIso, restartIso = null, excludeWorkoutId = null) => {
  const weeks = Number(program?.cycleWeeks) || 1;
  const at = Number.isFinite(toMs(dateIso)) ? toMs(dateIso) : null;
  const restart = toMs(restartIso);
  const logged = (history || [])
    .filter(w => w && w.id !== excludeWorkoutId)
    .map(w => ({ t: toMs(w.startedAt), info: getWorkoutProgramInfo(w) }))
    .filter(
      x =>
        x.info?.program === program?.id &&
        Number.isFinite(x.t) &&
        (at === null || x.t < at) &&
        (!Number.isFinite(restart) || x.t >= restart)
    )
    .map(x => ({ t: x.t, week: parseProgramWeek(x.info.programWeek, program) || 1 }))
    .sort((a, b) => a.t - b.t);
  if (logged.length === 0) return { week: 1, cycleStartMs: at ?? (Number.isFinite(restart) ? restart : null) };

  // The current cycle began at the first session of the latest run of week-1 sessions
  let cycleStartMs = logged[0].t;
  logged.forEach((x, i) => {
    if (x.week === 1 && (i === 0 || logged[i - 1].week !== 1)) cycleStartMs = x.t;
  });
  const last = logged[logged.length - 1];
  const newWeek = at !== null && calendarWeekIndex(at) > calendarWeekIndex(last.t);
  let week = newWeek ? last.week + 1 : last.week;
  if (week > weeks) week = 1;
  if (week === 1 && last.week !== 1) cycleStartMs = at;
  return { week, cycleStartMs };
};

/** A typed week ("Week 3", "3") as a number within the cycle, or null. */
export const parseProgramWeek = (text, program) => {
  const match = /(\d+)/.exec(String(text || ''));
  if (!match) return null;
  const n = Number(match[1]);
  const weeks = Number(program?.cycleWeeks) || 1;
  return n >= 1 && n <= weeks ? n : null;
};

/**
 * What programs a workout: { program, week, cycleStartMs } for a program with a week plan, else null. The workout's
 * own program (once stamped) wins over the chosen one; its WEEK (set when the session starts, or picked) wins over
 * the automatic week from the logged sessions (getAutoProgramWeek).
 */
export const getProgramContext = (programId, restartIso, workout, history = []) => {
  const program = getProgram(workout?.program || programId);
  if (!program.weekPlan) return null;
  const auto = getAutoProgramWeek(program, history, workout?.startedAt || null, restartIso, workout?.id || null);
  const picked = parseProgramWeek(workout?.programWeek, program);
  const week = picked || auto.week;
  // A week 1 picked by hand mid-cycle starts a new cycle with this session
  const cycleStartMs = picked === 1 && auto.week !== 1 ? toMs(workout?.startedAt) : auto.cycleStartMs;
  return { program, week, cycleStartMs: Number.isFinite(cycleStartMs) ? cycleStartMs : null };
};

// The Big 3 and their variants (Society's compound picks)
export const BIG3_IDS = ['barbell_bench_press', 'barbell_back_squat', 'barbell_deadlift'];
const BIG3_NAMES = new Set(['barbell bench press', 'barbell back squat', 'barbell squat', 'barbell deadlift']);
const BIG3_VARIANT_PATTERN = /bench press|squat|deadlift|\brdl\b|romanian|good morning/i;
/** A compound variant of the Big 3 (incline / close-grip bench, front / split squat, RDL, sumo…), not a Big 3 lift. */
export const isBig3Variant = ex =>
  Boolean(ex) &&
  !BIG3_IDS.includes(ex.id) &&
  !BIG3_NAMES.has(String(ex.name || '').toLowerCase()) &&
  !/guillotine/i.test(ex.name || '') &&
  BIG3_VARIANT_PATTERN.test(ex.name || '');
