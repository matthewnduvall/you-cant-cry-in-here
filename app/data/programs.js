// Training programs (Configuration → PROGRAM). `settings.program` holds the chosen id and `settings.programCycleStart`
// the date its current cycle (re)started (local + cloud); Crying is the default. Programs other than Crying use a
// week (and, for programs with set days, a day) per session — the session header's PROGRAM / WEEK / DAY row — and an
// intensity per set (%1RM / RIR / RPE); Crying uses neither.
//
// Every program is described by the same variables (shown on Configuration → PROGRAM as `variables`, in this order):
//   Based on · Frequency · Schedule · Routine · Sets · Reps · Intensity · Progression · Trigger · Cycle · Week name ·
//   Rest timer · Equipment
// Schedule: `schedule` = the program's training weekdays (['Mon', 'Wed', 'Fri']); the athlete can pick their own per
// program (settings.programSchedules). `dayAssignment`: 'weekday' = its days belong to set weekdays, in order (Texas
// Method: volume on the 1st training day, recovery the 2nd, intensity the 3rd; PPL / Upper-Lower / 5-3-1 the same,
// wrapping round); 'rotate' = the days alternate whatever the weekday (Workout A / B), and a session uses the day after
// the last logged one.
// and run by these fields:
//   Society (stimulus-driven): appliesTo, routine, compoundPicks, weekPlan(week) → { scheme, rir } | { scheme, maxOut }
//   Day programs: days = [{ id, name, slots: [SlotSpec] }] rotated from the logged sessions (getAutoProgramWeek), where
//     SlotSpec = { key, category, exerciseId | exerciseFor(week) | pick: { category, muscleGroup, specific, preferIds },
//                  rule, sets, reps, warmups, inc, rir, role, label }
//     rule 'linear'  — the same weight for every working set; + inc after a session with every rep done, repeat it
//                      after a miss, −10 % after 3 misses in a row (Starting Strength / StrongLifts)
//     rule '531'     — training max (90 % of the 1RM) × the week's percentages; + inc to the training max each cycle
//     rule 'bbb'     — Boring But Big: 5 × 10 at 50 % of the training max
//     rule 'texas'   — the weekly 5RM (role 'intensity'), 5 × 5 at 90 % of it (role 'volume'), lighter on recovery
//     rule 'double'  — double progression: reps climb to the top of the range, then + inc and back to the bottom
//   cycleWeeks, weekName(week), restSeconds, equipment (equipment options its picks may use; [] = any)
// Progression is worked out in utils/programEngine.js.

export const DEFAULT_PROGRAM_ID = 'crying';

const weekName = week => `Week ${week}`;

export const PROGRAMS = [
  {
    id: 'crying',
    label: 'Crying',
    description:
      'Automatically selects exercises based on muscle stimulus needs, and pushes you to your max every time, because you’re not a baby. Offers flexibility on goals, sets and reps. Is not bound by a weekly schedule, work out as much as you can and it will plan the exercise you need based on your history and goals.',
    comingSoon: false,
    usesWeeks: false,
    usesIntensity: false,
    variables: [
      ['Based on', 'Original: driven by muscle stimulus'],
      ['Frequency', 'As often as you like'],
      ['Schedule', 'None: train any day'],
      ['Routine', 'Your Routine Preferences (default 2 compound lifts, 2 supersets, abs), picked by muscle stimulus'],
      ['Sets', 'Your training goal’s scheme (Balanced 5 × 8), with your Exercise Set Preferences'],
      ['Reps', 'From the scheme: 5 (Strength), 8 (Balanced, Maintain), 10 (Hypertrophy)'],
      ['Intensity', 'Your last session or your stored 1RM, whichever is lower, plus the increment'],
      ['Progression', 'Your goal increment added every session'],
      ['Trigger', 'None'],
      ['Cycle', 'None'],
      ['Week name', 'None'],
      ['Rest timer', '1:30'],
      ['Equipment', 'Your Equipment list']
    ]
  },
  {
    id: 'society',
    label: 'Society',
    schedule: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    dayAssignment: 'weekday',
    // Each weekday's session: Mon/Tue the same (A), Wed/Thu (B), Fri/Sat (C); Sunday a pump session, leg and arm
    // alternating by week (odd weeks leg, even weeks arm)
    weekdayDays: { Mon: 'A', Tue: 'A', Wed: 'B', Thu: 'B', Fri: 'C', Sat: 'C', Sun: ['legpump', 'armpump'] },
    // A / B / C are Society's stimulus sessions (routine + week plan below); the second day of a pair repeats the
    // first day's exercises from that week. The pump days are fixed templates of high-rep accessories.
    days: [
      { id: 'A', name: 'Monday & Tuesday', shortName: 'Mon & Tue', stimulus: true },
      { id: 'B', name: 'Wednesday & Thursday', shortName: 'Wed & Thu', stimulus: true },
      { id: 'C', name: 'Friday & Saturday', shortName: 'Fri & Sat', stimulus: true },
      {
        id: 'legpump',
        name: 'Sunday leg pump',
        shortName: 'Sun legs',
        restSeconds: 60,
        slots: [
          { key: 'quads', category: 'Accessory', pick: { category: 'Accessory', muscleGroup: 'Thighs', specific: /quadriceps/i }, rule: 'double', sets: 3, reps: [15, 20], rir: 2, inc: 5 },
          { key: 'hamstrings', category: 'Accessory', pick: { category: 'Accessory', muscleGroup: 'Thighs', specific: /hamstring/i }, rule: 'double', sets: 3, reps: [15, 20], rir: 2, inc: 5 },
          { key: 'glutes', category: 'Accessory', pick: { category: 'Accessory', muscleGroup: 'Hips' }, rule: 'double', sets: 3, reps: [15, 20], rir: 2, inc: 5 },
          { key: 'calves', category: 'Accessory', pick: { category: 'Accessory', muscleGroup: 'Calves' }, rule: 'double', sets: 4, reps: [15, 20], rir: 2, inc: 5 }
        ]
      },
      {
        id: 'armpump',
        name: 'Sunday arm pump',
        shortName: 'Sun arms',
        restSeconds: 60,
        slots: [
          { key: 'biceps', category: 'Accessory', pick: { category: 'Accessory', muscleGroup: 'Upper Arms', specific: /biceps/i }, rule: 'double', sets: 3, reps: [12, 15], rir: 2, inc: 2.5 },
          { key: 'triceps', category: 'Accessory', pick: { category: 'Accessory', muscleGroup: 'Upper Arms', specific: /triceps/i }, rule: 'double', sets: 3, reps: [12, 15], rir: 2, inc: 2.5 },
          { key: 'delts', category: 'Accessory', pick: { category: 'Accessory', muscleGroup: 'Shoulders', specific: /lateral/i }, rule: 'double', sets: 3, reps: [15, 20], rir: 2, inc: 2.5 },
          { key: 'forearms', category: 'Accessory', pick: { category: 'Accessory', muscleGroup: 'Forearms' }, rule: 'double', sets: 3, reps: [15, 20], rir: 2, inc: 2.5 }
        ]
      }
    ],
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
    weekName,
    restSeconds: 90,
    equipment: ['Barbell', 'Dumbbell', 'Band', 'Landmine', 'EZ Bar'],
    variables: [
      ['Based on', 'Original: an 8-week peaking cycle'],
      ['Frequency', 'Every day: 6 stimulus sessions and a Sunday pump session'],
      ['Schedule', 'Monday & Tuesday: the same session · Wednesday & Thursday: the same session · Friday & Saturday: the same session · Sunday: leg pump or arm pump (alternating weeks)'],
      ['Routine', 'Monday to Saturday: 2 compound lifts (one of the Big 3, then Big 3 variants), 2 supersets, 1 accessory, picked by muscle stimulus; the second day of each pair repeats the first · Leg pump: quads, hamstrings, glutes, calves · Arm pump: biceps, triceps, side delts, forearms'],
      ['Sets', '5 on compound lifts; accessories and supersets keep the defaults; pump days 3–4 per exercise'],
      ['Reps', '8 in weeks 1–2, Pyramid in weeks 3–7, 1RM Pyramid in week 8; pump days 12–20'],
      ['Intensity', 'RIR 6 in week 1, one less each week, 1RM in week 8; pump days RIR 2'],
      ['Progression', 'Your goal increment added to your 1RM once per cycle'],
      ['Trigger', 'None'],
      ['Cycle', '8 weeks'],
      ['Week name', 'Week #'],
      ['Rest timer', '1:30 (pump days 1:00)'],
      ['Equipment', 'Barbells, dumbbells, bands, landmine, EZ bar']
    ]
  },
  {
    id: 'linear_3x5',
    label: 'Linear 3x5 Foundation',
    schedule: ['Mon', 'Wed', 'Fri'],
    dayAssignment: 'rotate',
    basedOn: 'Starting Strength',
    description:
      'A beginner strength program of 3 full-body sessions a week, alternating Workout A (squat, bench press, deadlift) and Workout B (squat, overhead press, deadlift). Three sets of 5 at the same weight on every lift but the deadlift (one set of 5), and the weight goes up every session you get all your reps. Simple, heavy and fast: the quickest way to build a strength base.',
    comingSoon: false,
    usesWeeks: true,
    usesIntensity: true,
    days: [
      {
        id: 'A',
        name: 'Workout A',
        slots: [
          { key: 'squat', category: 'Compound', exerciseId: 'barbell_back_squat', rule: 'linear', sets: 3, reps: 5, warmups: 2, inc: 5 },
          { key: 'bench', category: 'Compound', exerciseId: 'barbell_bench_press', rule: 'linear', sets: 3, reps: 5, warmups: 2, inc: 5 },
          { key: 'deadlift', category: 'Compound', exerciseId: 'barbell_deadlift', rule: 'linear', sets: 1, reps: 5, warmups: 2, inc: 10 }
        ]
      },
      {
        id: 'B',
        name: 'Workout B',
        slots: [
          { key: 'squat', category: 'Compound', exerciseId: 'barbell_back_squat', rule: 'linear', sets: 3, reps: 5, warmups: 2, inc: 5 },
          { key: 'press', category: 'Compound', exerciseId: 'overhead_press', rule: 'linear', sets: 3, reps: 5, warmups: 2, inc: 5 },
          { key: 'deadlift', category: 'Compound', exerciseId: 'barbell_deadlift', rule: 'linear', sets: 1, reps: 5, warmups: 2, inc: 10 }
        ]
      }
    ],
    cycleWeeks: 12,
    weekName,
    restSeconds: 180,
    equipment: ['Barbell'],
    variables: [
      ['Based on', 'Starting Strength'],
      ['Frequency', '3 sessions a week, alternating Workout A and B'],
      ['Schedule', 'Mon · Wed · Fri, Workout A and B alternate (A-B-A one week, B-A-B the next)'],
      ['Routine', 'A: squat, bench press, deadlift · B: squat, overhead press, deadlift'],
      ['Sets', '3 working sets (deadlift 1), after 2 warm-ups'],
      ['Reps', '5'],
      ['Intensity', 'The same weight on every working set; starts around RIR 3'],
      ['Progression', '+5 lb a session (deadlift +10 lb)'],
      ['Trigger', 'A missed rep repeats the weight; 3 misses in a row drop it 10 %'],
      ['Cycle', 'None: linear, session to session'],
      ['Week name', 'Week #'],
      ['Rest timer', '3:00'],
      ['Equipment', 'Barbell, squat rack, bench']
    ]
  },
  {
    id: 'linear_5x5',
    label: 'Linear 5x5 Foundation',
    schedule: ['Mon', 'Wed', 'Fri'],
    dayAssignment: 'rotate',
    basedOn: 'StrongLifts 5x5',
    description:
      'A beginner strength program of 3 full-body sessions a week, alternating Workout A (squat, bench press, barbell row) and Workout B (squat, overhead press, deadlift). Five sets of 5 at the same weight (deadlift one set of 5), adding weight every session you get all your reps. More volume than the 3x5, with a row for the upper back.',
    comingSoon: false,
    usesWeeks: true,
    usesIntensity: true,
    days: [
      {
        id: 'A',
        name: 'Workout A',
        slots: [
          { key: 'squat', category: 'Compound', exerciseId: 'barbell_back_squat', rule: 'linear', sets: 5, reps: 5, warmups: 2, inc: 5 },
          { key: 'bench', category: 'Compound', exerciseId: 'barbell_bench_press', rule: 'linear', sets: 5, reps: 5, warmups: 2, inc: 5 },
          { key: 'row', category: 'Compound', exerciseId: 'barbell_row', rule: 'linear', sets: 5, reps: 5, warmups: 1, inc: 5 }
        ]
      },
      {
        id: 'B',
        name: 'Workout B',
        slots: [
          { key: 'squat', category: 'Compound', exerciseId: 'barbell_back_squat', rule: 'linear', sets: 5, reps: 5, warmups: 2, inc: 5 },
          { key: 'press', category: 'Compound', exerciseId: 'overhead_press', rule: 'linear', sets: 5, reps: 5, warmups: 2, inc: 5 },
          { key: 'deadlift', category: 'Compound', exerciseId: 'barbell_deadlift', rule: 'linear', sets: 1, reps: 5, warmups: 2, inc: 10 }
        ]
      }
    ],
    cycleWeeks: 12,
    weekName,
    restSeconds: 180,
    equipment: ['Barbell'],
    variables: [
      ['Based on', 'StrongLifts 5x5'],
      ['Frequency', '3 sessions a week, alternating Workout A and B'],
      ['Schedule', 'Mon · Wed · Fri, Workout A and B alternate (A-B-A one week, B-A-B the next)'],
      ['Routine', 'A: squat, bench press, barbell row · B: squat, overhead press, deadlift'],
      ['Sets', '5 working sets (deadlift 1), after warm-ups'],
      ['Reps', '5'],
      ['Intensity', 'The same weight on every working set; starts around RIR 3'],
      ['Progression', '+5 lb a session (deadlift +10 lb)'],
      ['Trigger', 'A missed rep repeats the weight; 3 misses in a row drop it 10 %'],
      ['Cycle', 'None: linear, session to session'],
      ['Week name', 'Week #'],
      ['Rest timer', '3:00'],
      ['Equipment', 'Barbell, squat rack, bench']
    ]
  },
  {
    id: 'wave_percentage',
    label: 'Wave Percentage Strength',
    schedule: ['Mon', 'Tue', 'Thu', 'Fri'],
    dayAssignment: 'weekday',
    basedOn: 'Wendler 5/3/1 (Boring But Big)',
    description:
      'A 4-week cycle with one main lift a day, 4 days a week: overhead press, deadlift, bench press, squat. Each lift works from a training max (90 % of your 1RM): week 1 is 5s, week 2 is 3s, week 3 is 5/3/1 and week 4 is a deload. The last set of weeks 1–3 is as many reps as possible. Then 5 × 10 of the same lift at 50 % and an assistance exercise. The training max goes up every cycle: slow, steady and sustainable.',
    comingSoon: false,
    usesWeeks: true,
    usesIntensity: true,
    days: [
      {
        id: 'press',
        name: 'Press day',
        slots: [
          { key: 'main', category: 'Compound', exerciseId: 'overhead_press', rule: '531', inc: 5 },
          { key: 'bbb', category: 'Compound', exerciseId: 'overhead_press', rule: 'bbb', inc: 5 },
          { key: 'assist', category: 'Compound', exerciseId: 'chin_ups', rule: 'double', sets: 5, reps: [5, 10], rir: 1, inc: 5 }
        ]
      },
      {
        id: 'deadlift',
        name: 'Deadlift day',
        slots: [
          { key: 'main', category: 'Compound', exerciseId: 'barbell_deadlift', rule: '531', inc: 10 },
          { key: 'bbb', category: 'Compound', exerciseId: 'barbell_deadlift', rule: 'bbb', inc: 10 },
          { key: 'assist', category: 'Accessory', pick: { category: 'Accessory', muscleGroup: 'Core' }, rule: 'double', sets: 5, reps: [10, 15], rir: 1, inc: 5 }
        ]
      },
      {
        id: 'bench',
        name: 'Bench day',
        slots: [
          { key: 'main', category: 'Compound', exerciseId: 'barbell_bench_press', rule: '531', inc: 5 },
          { key: 'bbb', category: 'Compound', exerciseId: 'barbell_bench_press', rule: 'bbb', inc: 5 },
          { key: 'assist', category: 'Compound', exerciseId: 'dumbbell_row', rule: 'double', sets: 5, reps: [10, 12], rir: 1, inc: 5 }
        ]
      },
      {
        id: 'squat',
        name: 'Squat day',
        slots: [
          { key: 'main', category: 'Compound', exerciseId: 'barbell_back_squat', rule: '531', inc: 10 },
          { key: 'bbb', category: 'Compound', exerciseId: 'barbell_back_squat', rule: 'bbb', inc: 10 },
          { key: 'assist', category: 'Accessory', exerciseId: 'lying_leg_curl', rule: 'double', sets: 5, reps: [10, 12], rir: 1, inc: 5 }
        ]
      }
    ],
    cycleWeeks: 4,
    weekName,
    restSeconds: 180,
    equipment: [],
    variables: [
      ['Based on', 'Wendler 5/3/1, Boring But Big'],
      ['Frequency', '4 sessions a week, one main lift each'],
      ['Schedule', 'Mon press · Tue deadlift · Thu bench · Fri squat'],
      ['Routine', 'Press, deadlift, bench, squat days: the main lift, 5 × 10 of it, 1 assistance exercise'],
      ['Sets', '3 warm-ups + 3 working sets; then 5 × 10'],
      ['Reps', 'Week 1: 5/5/5+ · week 2: 3/3/3+ · week 3: 5/3/1+ · week 4: 5/5/5 (+ = as many as possible)'],
      ['Intensity', 'Of the training max (90 % of 1RM): 65–85 %, 70–90 %, 75–95 %, deload 40–60 %; 5 × 10 at 50 %'],
      ['Progression', 'Training max +5 lb (press, bench) / +10 lb (squat, deadlift) each cycle'],
      ['Trigger', 'None: the training max rises each cycle'],
      ['Cycle', '4 weeks'],
      ['Week name', 'Week #'],
      ['Rest timer', '3:00'],
      ['Equipment', 'Barbell, squat rack, bench, pull-up bar, dumbbells']
    ]
  },
  {
    id: 'weekly_undulating',
    label: 'Weekly Undulating Strength',
    schedule: ['Mon', 'Wed', 'Fri'],
    dayAssignment: 'weekday',
    basedOn: 'Texas Method',
    description:
      'An intermediate strength program of 3 sessions a week that cycle stress through the week: a volume day (5 × 5 at 90 % of your 5-rep max), a light recovery day, and an intensity day where you set a new 5-rep max. Bench press and overhead press swap places each week. The 5-rep max goes up every week, so progress is weekly instead of every session.',
    comingSoon: false,
    usesWeeks: true,
    usesIntensity: true,
    days: [
      {
        id: 'volume',
        name: 'Volume day',
        slots: [
          { key: 'squat', category: 'Compound', exerciseId: 'barbell_back_squat', rule: 'texas', role: 'volume', inc: 5 },
          { key: 'upper', category: 'Compound', exerciseFor: week => (week % 2 ? 'barbell_bench_press' : 'overhead_press'), rule: 'texas', role: 'volume', inc: 5 },
          { key: 'deadlift', category: 'Compound', exerciseId: 'barbell_deadlift', rule: 'linear', sets: 1, reps: 5, warmups: 2, inc: 10 }
        ]
      },
      {
        id: 'recovery',
        name: 'Recovery day',
        slots: [
          { key: 'squat', category: 'Compound', exerciseId: 'barbell_back_squat', rule: 'texas', role: 'recovery', inc: 5 },
          { key: 'upper', category: 'Compound', exerciseFor: week => (week % 2 ? 'overhead_press' : 'barbell_bench_press'), rule: 'texas', role: 'recovery', inc: 5 },
          { key: 'chins', category: 'Compound', exerciseId: 'chin_ups', rule: 'double', sets: 3, reps: [5, 10], rir: 1, inc: 5 },
          { key: 'backext', category: 'Accessory', exerciseId: 'back_extension', rule: 'double', sets: 3, reps: [10, 15], rir: 2, inc: 5 }
        ]
      },
      {
        id: 'intensity',
        name: 'Intensity day',
        slots: [
          { key: 'squat', category: 'Compound', exerciseId: 'barbell_back_squat', rule: 'texas', role: 'intensity', inc: 5 },
          { key: 'upper', category: 'Compound', exerciseFor: week => (week % 2 ? 'barbell_bench_press' : 'overhead_press'), rule: 'texas', role: 'intensity', inc: 5 },
          { key: 'clean', category: 'Compound', exerciseId: 'barbell_power_clean', rule: 'linear', sets: 5, reps: 3, warmups: 2, inc: 5 }
        ]
      }
    ],
    cycleWeeks: 12,
    weekName,
    restSeconds: 180,
    equipment: ['Barbell'],
    variables: [
      ['Based on', 'Texas Method'],
      ['Frequency', '3 sessions a week: volume, recovery, intensity'],
      ['Schedule', 'Mon volume · Wed recovery · Fri intensity (2 days’ rest before the volume day)'],
      ['Routine', 'Volume: squat, bench or press, deadlift · Recovery: light squat, press or bench, chin-ups, back extensions · Intensity: squat, bench or press, power cleans'],
      ['Sets', 'Volume 5 × 5 · recovery 2–3 × 5 · intensity 1 × 5 after warm-ups'],
      ['Reps', '5 (power cleans 3)'],
      ['Intensity', 'Intensity day = your 5-rep max; volume = 90 % of it; recovery squat 80 % of volume'],
      ['Progression', '5-rep max +5 lb a week; bench and press swap each week; power cleans +5 lb a session'],
      ['Trigger', 'A missed 5-rep max is repeated the next week'],
      ['Cycle', 'Weekly'],
      ['Week name', 'Week #'],
      ['Rest timer', '3:00'],
      ['Equipment', 'Barbell, squat rack, bench, pull-up bar']
    ]
  },
  {
    id: 'bro_split',
    label: '6-Day PPL Hypertrophy',
    schedule: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    dayAssignment: 'weekday',
    basedOn: 'Push / Pull / Legs (bro split)',
    description:
      'A hypertrophy split of 6 sessions a week: push (chest, shoulders, triceps), pull (back, biceps, rear delts) and legs, each twice. Every session opens with a heavy compound lift for 4 × 6–8, then moderate-rep accessories for the muscles of the day. Weights rise with double progression: add reps until you hit the top of the range, then add weight.',
    comingSoon: false,
    usesWeeks: true,
    usesIntensity: true,
    days: [
      {
        id: 'push',
        name: 'Push day',
        slots: [
          { key: 'bench', category: 'Compound', exerciseId: 'barbell_bench_press', rule: 'double', sets: 4, reps: [6, 8], rir: 2, warmups: 1, inc: 5 },
          { key: 'ohp', category: 'Compound', exerciseId: 'dumbbell_shoulder_press', rule: 'double', sets: 3, reps: [8, 10], rir: 2, inc: 5 },
          { key: 'chest', category: 'Compound', exerciseId: 'dumbbell_incline_press', rule: 'double', sets: 3, reps: [8, 12], rir: 2, inc: 5 },
          { key: 'lateral', category: 'Accessory', exerciseId: 'side_raise_dumbbell', rule: 'double', sets: 3, reps: [12, 15], rir: 1, inc: 2.5 },
          { key: 'triceps', category: 'Accessory', exerciseId: 'cable_tricep_pushdown', rule: 'double', sets: 3, reps: [10, 12], rir: 1, inc: 2.5 }
        ]
      },
      {
        id: 'pull',
        name: 'Pull day',
        slots: [
          { key: 'row', category: 'Compound', exerciseId: 'barbell_row', rule: 'double', sets: 4, reps: [6, 8], rir: 2, warmups: 1, inc: 5 },
          { key: 'vertical', category: 'Compound', exerciseId: 'chin_ups', rule: 'double', sets: 3, reps: [6, 10], rir: 2, inc: 5 },
          { key: 'cablerow', category: 'Compound', exerciseId: 'cable_seated_row', rule: 'double', sets: 3, reps: [10, 12], rir: 1, inc: 5 },
          { key: 'facepull', category: 'Accessory', exerciseId: 'cable_face_pull', rule: 'double', sets: 3, reps: [15, 20], rir: 1, inc: 2.5 },
          { key: 'biceps', category: 'Accessory', pick: { category: 'Accessory', muscleGroup: 'Upper Arms', specific: /biceps/i }, rule: 'double', sets: 3, reps: [10, 12], rir: 1, inc: 2.5 }
        ]
      },
      {
        id: 'legs',
        name: 'Leg day',
        slots: [
          { key: 'squat', category: 'Compound', exerciseId: 'barbell_back_squat', rule: 'double', sets: 4, reps: [6, 8], rir: 2, warmups: 1, inc: 5 },
          { key: 'rdl', category: 'Compound', exerciseId: 'barbell_rdl', rule: 'double', sets: 3, reps: [8, 10], rir: 2, inc: 5 },
          { key: 'legpress', category: 'Compound', exerciseId: 'sled_leg_press', rule: 'double', sets: 3, reps: [10, 12], rir: 1, inc: 10 },
          { key: 'legcurl', category: 'Accessory', exerciseId: 'lying_leg_curl', rule: 'double', sets: 3, reps: [10, 12], rir: 1, inc: 5 },
          { key: 'calves', category: 'Accessory', pick: { category: 'Accessory', muscleGroup: 'Calves' }, rule: 'double', sets: 4, reps: [10, 15], rir: 1, inc: 5 }
        ]
      }
    ],
    cycleWeeks: 8,
    weekName,
    restSeconds: 90,
    equipment: [],
    variables: [
      ['Based on', 'Push / Pull / Legs (bro split)'],
      ['Frequency', '6 sessions a week: push, pull, legs, twice'],
      ['Schedule', 'Mon push · Tue pull · Wed legs · Thu push · Fri pull · Sat legs · Sun rest'],
      ['Routine', 'Push: bench, shoulder press, incline press, lateral raise, triceps · Pull: row, chin-ups, cable row, face pulls, biceps · Legs: squat, RDL, leg press, leg curl, calves'],
      ['Sets', '4 on the opening lift, 3 after (calves 4)'],
      ['Reps', 'Ranges: 6–8 on the opening lift, 8–12 compounds, 10–20 accessories'],
      ['Intensity', 'RIR 2 on compound lifts, RIR 1 on accessories'],
      ['Progression', 'Double progression: reps to the top of the range, then +5 lb (+2.5 lb small muscles)'],
      ['Trigger', 'Every set at the top of the range adds weight'],
      ['Cycle', 'None: continuous'],
      ['Week name', 'Week #'],
      ['Rest timer', '1:30'],
      ['Equipment', 'Barbell, dumbbells, cables, pull-up bar, leg press, leg curl']
    ]
  },
  {
    id: 'upper_lower_4day',
    label: '4-Day Upper/Lower Balance',
    schedule: ['Mon', 'Tue', 'Thu', 'Fri'],
    dayAssignment: 'weekday',
    basedOn: 'Upper / Lower split',
    description:
      'A balanced split of 4 sessions a week: two upper-body and two lower-body days. The first upper and lower days are heavy (4 × 3–5 on the main lifts) and the second pair is for size (3–4 × 8–12). Each muscle is trained twice a week with a mix of strength and hypertrophy work, using double progression.',
    comingSoon: false,
    usesWeeks: true,
    usesIntensity: true,
    days: [
      {
        id: 'upperA',
        name: 'Upper (strength)',
        slots: [
          { key: 'bench', category: 'Compound', exerciseId: 'barbell_bench_press', rule: 'double', sets: 4, reps: [3, 5], rir: 2, warmups: 2, inc: 5 },
          { key: 'row', category: 'Compound', exerciseId: 'barbell_row', rule: 'double', sets: 4, reps: [3, 5], rir: 2, warmups: 1, inc: 5 },
          { key: 'ohp', category: 'Compound', exerciseId: 'overhead_press', rule: 'double', sets: 3, reps: [6, 8], rir: 2, inc: 5 },
          { key: 'chins', category: 'Compound', exerciseId: 'chin_ups', rule: 'double', sets: 3, reps: [6, 8], rir: 2, inc: 5 },
          { key: 'triceps', category: 'Accessory', exerciseId: 'cable_tricep_pushdown', rule: 'double', sets: 3, reps: [8, 12], rir: 1, inc: 2.5 }
        ]
      },
      {
        id: 'lowerA',
        name: 'Lower (strength)',
        slots: [
          { key: 'squat', category: 'Compound', exerciseId: 'barbell_back_squat', rule: 'double', sets: 4, reps: [3, 5], rir: 2, warmups: 2, inc: 5 },
          { key: 'deadlift', category: 'Compound', exerciseId: 'barbell_deadlift', rule: 'double', sets: 3, reps: [3, 5], rir: 2, warmups: 2, inc: 10 },
          { key: 'legpress', category: 'Compound', exerciseId: 'sled_leg_press', rule: 'double', sets: 3, reps: [10, 12], rir: 1, inc: 10 },
          { key: 'legcurl', category: 'Accessory', exerciseId: 'lying_leg_curl', rule: 'double', sets: 3, reps: [8, 12], rir: 1, inc: 5 },
          { key: 'calves', category: 'Accessory', pick: { category: 'Accessory', muscleGroup: 'Calves' }, rule: 'double', sets: 4, reps: [10, 15], rir: 1, inc: 5 }
        ]
      },
      {
        id: 'upperB',
        name: 'Upper (size)',
        slots: [
          { key: 'incline', category: 'Compound', exerciseId: 'incline_bench_press', rule: 'double', sets: 4, reps: [8, 12], rir: 2, warmups: 1, inc: 5 },
          { key: 'cablerow', category: 'Compound', exerciseId: 'cable_seated_row', rule: 'double', sets: 4, reps: [8, 12], rir: 2, inc: 5 },
          { key: 'dbpress', category: 'Compound', exerciseId: 'dumbbell_shoulder_press', rule: 'double', sets: 3, reps: [8, 12], rir: 2, inc: 5 },
          { key: 'pulldown', category: 'Compound', exerciseId: 'cable_pulldown', rule: 'double', sets: 3, reps: [10, 12], rir: 1, inc: 5 },
          { key: 'lateral', category: 'Accessory', exerciseId: 'side_raise_dumbbell', rule: 'double', sets: 3, reps: [12, 15], rir: 1, inc: 2.5 },
          { key: 'biceps', category: 'Accessory', pick: { category: 'Accessory', muscleGroup: 'Upper Arms', specific: /biceps/i }, rule: 'double', sets: 3, reps: [10, 12], rir: 1, inc: 2.5 }
        ]
      },
      {
        id: 'lowerB',
        name: 'Lower (size)',
        slots: [
          { key: 'frontsquat', category: 'Compound', exerciseId: 'front_squat', rule: 'double', sets: 4, reps: [8, 10], rir: 2, warmups: 1, inc: 5 },
          { key: 'rdl', category: 'Compound', exerciseId: 'barbell_rdl', rule: 'double', sets: 4, reps: [8, 12], rir: 2, inc: 5 },
          { key: 'split', category: 'Compound', exerciseId: 'split_squat', rule: 'double', sets: 3, reps: [10, 12], rir: 1, inc: 5 },
          { key: 'legext', category: 'Accessory', exerciseId: 'leg_extension', rule: 'double', sets: 3, reps: [10, 15], rir: 1, inc: 5 },
          { key: 'core', category: 'Accessory', pick: { category: 'Accessory', muscleGroup: 'Core' }, rule: 'double', sets: 3, reps: [10, 15], rir: 1, inc: 5 }
        ]
      }
    ],
    cycleWeeks: 8,
    weekName,
    restSeconds: 120,
    equipment: [],
    variables: [
      ['Based on', 'Upper / Lower split'],
      ['Frequency', '4 sessions a week: upper, lower, upper, lower'],
      ['Schedule', 'Mon upper (strength) · Tue lower (strength) · Thu upper (size) · Fri lower (size)'],
      ['Routine', 'Upper strength: bench, row, press, chin-ups, triceps · Lower strength: squat, deadlift, leg press, leg curl, calves · Upper size: incline, cable row, dumbbell press, pulldown, laterals, biceps · Lower size: front squat, RDL, split squat, leg extension, core'],
      ['Sets', '3–4 per exercise'],
      ['Reps', 'Strength days 3–5 on the main lifts; size days 8–12 (accessories to 15)'],
      ['Intensity', 'RIR 2 on compound lifts, RIR 1 on accessories'],
      ['Progression', 'Double progression: reps to the top of the range, then +5 lb (+2.5 lb small muscles; deadlift and leg press +10 lb)'],
      ['Trigger', 'Every set at the top of the range adds weight'],
      ['Cycle', 'None: continuous'],
      ['Week name', 'Week #'],
      ['Rest timer', '2:00'],
      ['Equipment', 'Barbell, dumbbells, cables, pull-up bar, leg press, leg curl, leg extension']
    ]
  }
].map(p => ({
  schedule: [],
  dayAssignment: 'rotate',
  comingSoon: false,
  usesWeeks: true,
  usesIntensity: true,
  weekPlan: null,
  days: null,
  appliesTo: [],
  ...p
}));

/** The day template of a program by id (or its first day). */
export const getProgramDay = (program, dayId) =>
  (program?.days || []).find(d => d.id === dayId) || (program?.days || [])[0] || null;

/** The exercise a day slot uses this week (bench / press swap weekly on the Texas Method). */
export const getSlotSpecExercise = (spec, week = 1) =>
  typeof spec?.exerciseFor === 'function' ? spec.exerciseFor(week) : spec?.exerciseId || null;

/** Does this program run on set days (Workout A / B, push / pull / legs…)? */
export const hasProgramDays = program => Array.isArray(program?.days) && program.days.length > 0;

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
  const programDay = entry?.programDay || null;
  if (!program || program === DEFAULT_PROGRAM_ID) return entry;
  return {
    ...entry,
    slots: (entry.slots || []).map(slot => ({ ...slot, programInfo: { program, programWeek, programDay } }))
  };
};

/** The program and week a workout was logged under ({ program, programWeek }), or null. */
export const getWorkoutProgramInfo = workout => {
  if (!workout) return null;
  if (workout.program && workout.program !== DEFAULT_PROGRAM_ID) {
    return { program: workout.program, programWeek: workout.programWeek || '', programDay: workout.programDay || null };
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
export const calendarWeekIndex = ms => Math.floor((localDayNumber(ms) + 3) / 7);
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
    .map(x => ({ t: x.t, week: parseProgramWeek(x.info.programWeek, program) || 1, day: x.info.programDay || null }))
    .sort((a, b) => a.t - b.t);
  // Programs with set days rotate through them: the day after the last logged one (the first day to begin with)
  const days = program?.days || [];
  const nextDay = () => {
    if (days.length === 0) return null;
    const lastWithDay = [...logged].reverse().find(x => x.day && days.some(d => d.id === x.day));
    if (!lastWithDay) return days[0].id;
    const idx = days.findIndex(d => d.id === lastWithDay.day);
    return days[(idx + 1) % days.length].id;
  };
  if (logged.length === 0) {
    return { week: 1, day: days[0]?.id || null, cycleStartMs: at ?? (Number.isFinite(restart) ? restart : null) };
  }

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
  return { week, day: nextDay(), cycleStartMs };
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
export const getProgramContext = (programId, restartIso, workout, history = [], schedules = null) => {
  const program = getProgram(workout?.program || programId);
  if (!program.weekPlan && !hasProgramDays(program)) return null;
  const auto = getAutoProgramWeek(program, history, workout?.startedAt || null, restartIso, workout?.id || null);
  const picked = parseProgramWeek(workout?.programWeek, program);
  const week = picked || auto.week;
  // A week 1 picked by hand mid-cycle starts a new cycle with this session
  const cycleStartMs = picked === 1 && auto.week !== 1 ? toMs(workout?.startedAt) : auto.cycleStartMs;
  // The session's day: picked (or set when it started), else the day its weekday belongs to on the schedule, else
  // the next day in the rotation
  const pickedDay = hasProgramDays(program) && program.days.some(d => d.id === workout?.programDay) ? workout.programDay : null;
  const dayId = hasProgramDays(program)
    ? pickedDay || getScheduledDayId(program, schedules, workout?.startedAt, week) || auto.day
    : null;
  return {
    program,
    week,
    day: hasProgramDays(program) ? getProgramDay(program, dayId) : null,
    cycleStartMs: Number.isFinite(cycleStartMs) ? cycleStartMs : null
  };
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

// ---------------------------------------------------------------------------------------------------------------
// Weekly schedule
// ---------------------------------------------------------------------------------------------------------------
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const JS_DAY_TO_WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** 'Mon' … 'Sun' for a date (local time), or null. */
export const weekdayOf = dateIso => {
  const t = new Date(dateIso || NaN);
  return Number.isFinite(t.getTime()) ? JS_DAY_TO_WEEKDAY[t.getDay()] : null;
};

/** The athlete's training weekdays for a program (their own pick, else the program's), in week order. */
export const getProgramSchedule = (program, schedules = null) => {
  const own = schedules && Array.isArray(schedules[program?.id]) ? schedules[program.id] : null;
  const list = own && own.length > 0 ? own : program?.schedule || [];
  return WEEKDAYS.filter(d => list.includes(d));
};

/**
 * The day a date's session belongs to on a 'weekday' program: its training weekdays take the program's days in order,
 * wrapping round (PPL: Mon push, Tue pull, Wed legs, Thu push…). null on a rest day or for a 'rotate' program.
 */
export const getScheduledDayId = (program, schedules, dateIso, week = 1) => {
  if (!hasProgramDays(program) || program.dayAssignment !== 'weekday') return null;
  const list = getProgramSchedule(program, schedules);
  const weekday = weekdayOf(dateIso);
  if (!list.includes(weekday)) return null;
  // A program that names each weekday's session (Society); a list alternates by week (odd weeks the first)
  if (program.weekdayDays) {
    const entry = program.weekdayDays[weekday];
    if (!entry) return null;
    return Array.isArray(entry) ? entry[(Math.max(1, Number(week) || 1) - 1) % entry.length] : entry;
  }
  return program.days[list.indexOf(weekday) % program.days.length].id;
};

/** "Mon: Volume day · Wed: Recovery day · Fri: Intensity day" (or just the weekdays for a 'rotate' program). */
export const describeSchedule = (program, schedules) => {
  const list = getProgramSchedule(program, schedules);
  if (list.length === 0) return 'Any day';
  if (hasProgramDays(program) && program.dayAssignment === 'weekday') {
    const nameOf = id => program.days.find(d => d.id === id)?.name || id;
    if (program.weekdayDays) {
      return list
        .map(d => {
          const entry = program.weekdayDays[d];
          return `${d}: ${Array.isArray(entry) ? `${entry.map(nameOf).join(' or ')} (alternating weeks)` : nameOf(entry)}`;
        })
        .join(' · ');
    }
    return list.map((d, i) => `${d}: ${program.days[i % program.days.length].name}`).join(' · ');
  }
  return list.join(' · ');
};
