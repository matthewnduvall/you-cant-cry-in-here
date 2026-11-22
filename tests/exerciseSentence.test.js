import { describe, it, expect } from 'vitest';
import { parseExerciseSentence, describeSentence, resolveExerciseChunk } from '../app/utils/exerciseSentence';

const ids = p => p.exercises.map(e => e.id);

describe('exercise sentences', () => {
  it('"5 sets of 6 reps of bench press"', () => {
    const p = parseExerciseSentence('5 sets of 6 reps of bench press');
    expect(p).toMatchObject({ sets: 5, reps: 6, restSeconds: null, superset: false });
    expect(p.exercises[0].name).toMatch(/bench press/i);
  });

  it('"bench press for 6 reps in 5 sets with 1:30 rest"', () => {
    const p = parseExerciseSentence('bench press for 6 reps in 5 sets with 1:30 rest');
    expect(p).toMatchObject({ sets: 5, reps: 6, restSeconds: 90, superset: false });
    expect(p.exercises[0].name).toMatch(/bench press/i);
  });

  it('"superset triceps pushdowns and curls 12 reps 3 sets"', () => {
    const p = parseExerciseSentence('superset triceps pushdowns and curls 12 reps 3 sets');
    expect(p.superset).toBe(true);
    expect(p).toMatchObject({ sets: 3, reps: 12 });
    expect(p.exercises).toHaveLength(2);
    expect(p.exercises[0].name).toMatch(/pushdown/i);
    expect(p.exercises[1].name).toMatch(/curl/i);
  });

  it('reads 5x5, word numbers and rest in minutes or seconds', () => {
    expect(parseExerciseSentence('squat 5x5')).toMatchObject({ sets: 5, reps: 5 });
    expect(parseExerciseSentence('three sets of ten curls')).toMatchObject({ sets: 3, reps: 10 });
    expect(parseExerciseSentence('deadlift 3 sets rest 2 minutes')).toMatchObject({ sets: 3, restSeconds: 120 });
    expect(parseExerciseSentence('lateral raise 4 sets 15 reps rest 45 seconds')).toMatchObject({ sets: 4, reps: 15, restSeconds: 45 });
  });

  it('a bare number next to a set count is the reps', () => {
    expect(parseExerciseSentence('rows 3 sets 12')).toMatchObject({ sets: 3, reps: 12 });
  });

  it('plain names, or sentences naming no exercise, are not sentences', () => {
    expect(parseExerciseSentence('bench press')).toBeNull();
    expect(parseExerciseSentence('5 sets of 6 reps')).toBeNull();
    expect(parseExerciseSentence('')).toBeNull();
  });

  it('keeps values within the editor’s limits', () => {
    expect(parseExerciseSentence('bench press 40 sets of 6')).toMatchObject({ sets: 12 });
    expect(parseExerciseSentence('bench press 5x5 rest 5 seconds')).toMatchObject({ restSeconds: 15 });
  });

  it('resolves plural and longer phrases to a library exercise', () => {
    expect(resolveExerciseChunk('triceps pushdowns')).not.toBeNull();
    expect(resolveExerciseChunk('flat barbell bench press')).not.toBeNull();
  });

  it('describes what it will set up', () => {
    const p = parseExerciseSentence('bench press for 6 reps in 5 sets with 1:30 rest');
    expect(describeSentence(p, () => 'Bench Press')).toBe('Bench Press · 5 × 6 · 1:30 rest');
    const s = parseExerciseSentence('superset triceps pushdowns and curls 12 reps 3 sets');
    expect(describeSentence(s, () => 'X')).toBe('Superset: X + X · 3 × 12');
    expect(ids(s)[0]).not.toBe(ids(s)[1]);
  });
});
