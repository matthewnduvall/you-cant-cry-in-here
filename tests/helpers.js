// Builders for test History: workouts and sets shaped like the app's.

let nextId = 0;
const id = prefix => `${prefix}_${++nextId}`;

/** A set: { weight, reps, type, completed, intensity, … } with an id. */
export const set = (weight, reps, extra = {}) => ({
  id: id('set'),
  type: 'Working',
  weight,
  reps,
  completed: true,
  ...extra
});

/** A set with an effort rated by hand (RIR). */
export const rated = (weight, reps, rir, extra = {}) => set(weight, reps, { intensity: { mode: 'rir', value: rir }, ...extra });

/** A workout on a date (Date or ms) with one exercise per [exerciseId, sets] entry. */
export const workout = (when, exercises, extra = {}) => {
  const t = when instanceof Date ? when : new Date(when);
  return {
    id: id('w'),
    title: 'Test',
    startedAt: t.toISOString(),
    workoutDate: `${t.getFullYear()}/${t.getMonth() + 1}/${t.getDate()}`,
    slots: exercises.map(([exerciseId, sets]) => ({ id: id('slot'), category: 'Compound', exerciseId, scheme: '5x5', sets })),
    ...extra
  };
};

/** A superset slot workout: two exercises' sets side by side. */
export const supersetWorkout = (when, [idA, setsA], [idB, setsB]) => {
  const t = when instanceof Date ? when : new Date(when);
  return {
    id: id('w'),
    title: 'Test',
    startedAt: t.toISOString(),
    slots: [
      {
        id: id('slot'),
        category: 'Superset',
        exerciseId: idA,
        supersetExerciseIds: [idA, idB],
        supersetSetsByExercise: [setsA, setsB],
        sets: setsA,
        secondarySets: setsB
      }
    ]
  };
};

/** Days after a fixed start (local noon), so dates never depend on when the tests run. */
export const day = n => new Date(2026, 0, 5 + n, 12);

/** A seeded random number generator (0–1). */
export const rng = (seed = 7) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
};

/** The weight for reps at a RIR on a curve k: 1RM ÷ (1 + (reps + RIR − 1) ÷ k). */
export const weightOn = (oneRM, reps, rir, k = 30) => oneRM / (1 + (reps + rir - 1) / k);

export const BENCH = 'barbell_bench_press';
export const SQUAT = 'barbell_back_squat';
