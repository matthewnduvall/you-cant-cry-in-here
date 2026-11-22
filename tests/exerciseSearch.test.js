import { describe, it, expect } from 'vitest';
import { searchExercises, correctQuery, correctWord, editDistance } from '../app/utils/exerciseSearch';
import { parseExerciseSentence, describeSentence } from '../app/utils/exerciseSentence';

describe('typo-tolerant search', () => {
  it('edit distance counts a swap of neighbouring letters as one', () => {
    expect(editDistance('benhc', 'bench')).toBe(1);
    expect(editDistance('press', 'press')).toBe(0);
    expect(editDistance('abc', 'xyz', 1)).toBe(2); // stops early past the limit
  });

  it('corrects words that are not in the library, leaves good and partial words', () => {
    expect(correctWord('benhc')).toBe('bench');
    expect(correctWord('tricpes')).toBe('triceps');
    expect(correctWord('bench')).toBe('bench');
    expect(correctWord('pushd')).toBe('pushd'); // a part word: the search matches it already
    expect(correctWord('rdl')).toBe('rdl'); // short words are left alone
  });

  it('finds exercises despite typos', () => {
    expect(searchExercises('benhc press')[0]?.name).toMatch(/bench press/i);
    expect(searchExercises('tricpes pushdwon')[0]?.name).toMatch(/pushdown/i);
    expect(searchExercises('lateral raize')[0]?.name).toMatch(/lateral raise/i);
    expect(correctQuery('Benhc Presss')).toBe('bench press');
    expect(searchExercises('squatt')[0]?.name).toMatch(/squat/i);
  });

  it('exact matches are never replaced by corrections', () => {
    expect(searchExercises('bench press')[0]?.name).toMatch(/bench press/i);
  });
});

describe('scheme words', () => {
  it('"bench press pyramid one rep max" is the Pyramid 1RM scheme, not a single', () => {
    const p = parseExerciseSentence('bench press pyramid one rep max');
    expect(p).toMatchObject({ scheme: 'Pyramid 1RM', oneRepMax: false });
    expect(p.exercises[0].name).toMatch(/bench press/i);
    expect(describeSentence(p, () => 'Bench Press')).toBe('Bench Press · Pyramid 1RM');
  });

  it('reads reverse pyramid, pyramid and clusters', () => {
    expect(parseExerciseSentence('squat reverse pyramid')?.scheme).toBe('Reverse Pyramid');
    expect(parseExerciseSentence('curls pyramid')?.scheme).toBe('Pyramid');
    expect(parseExerciseSentence('lateral raise clusters')?.scheme).toBe('Cluster');
    expect(parseExerciseSentence('bench pyramid with 2 minutes rest')).toMatchObject({ scheme: 'Pyramid', restSeconds: 120 });
  });

  it('"12 sets of 10 pushups" keeps its sets and reps', () => {
    const p = parseExerciseSentence('12 sets of 10 pushups');
    expect(p).toMatchObject({ sets: 12, reps: 10, scheme: null });
    expect(p.exercises[0].name).toMatch(/push/i);
  });
});

describe('1 rep max sentences', () => {
  it('"1 rep max bench" is one max single of bench', () => {
    const p = parseExerciseSentence('1 rep max bench');
    expect(p).toMatchObject({ oneRepMax: true, sets: 1, reps: 1 });
    expect(p.exercises[0].name).toMatch(/bench/i);
    expect(describeSentence(p, () => 'Bench Press')).toBe('Bench Press · 1 rep max');
  });

  it('reads 1RM, one rep max, max single and heavy single', () => {
    ['bench 1rm', 'one rep max squat', 'max single deadlift', 'heavy single on squat'].forEach(t =>
      expect(parseExerciseSentence(t)).toMatchObject({ oneRepMax: true })
    );
  });

  it('a 5 rep max is not a single', () => {
    expect(parseExerciseSentence('bench 5 rep max')?.oneRepMax).not.toBe(true);
  });

  it('typos in the sentence still work', () => {
    const p = parseExerciseSentence('supreset tricpes pushdowns and curls 3x12');
    expect(p.superset).toBe(true);
    expect(p.exercises).toHaveLength(2);
    expect(parseExerciseSentence('benhc press 5x5')?.exercises[0].name).toMatch(/bench press/i);
  });
});
