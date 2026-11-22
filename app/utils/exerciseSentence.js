// Sentence recognition for the exercise search box (typed or spoken):
//   "5 sets of 6 reps of bench press"
//   "bench press for 6 reps in 5 sets with 1:30 rest"
//   "superset triceps pushdowns and curls 12 reps 3 sets"
// → { exercises: [exercise, (second for a superset)], sets, reps, restSeconds, superset }. The slot editor offers it as
// the first search result ("SET UP: …") and applies it as exercise(s) + set count + reps + REST.

import { searchExercises, editDistance } from './exerciseSearch';

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90
};

// Words that carry no exercise name once the numbers are read
const FILLER = new Set([
  'of', 'for', 'in', 'with', 'set', 'sets', 'rep', 'reps', 'repetitions', 'rest', 'resting', 'superset', 'supersets',
  'super', 'do', 'the', 'a', 'an', 'x', 'each', 'between', 'then', 'and', 'paired', 'alternating', 'at', 'please',
  'add', 'me', 'some', 'times', 'by', 'on', 'minute', 'minutes', 'min', 'mins', 'second', 'seconds', 'sec', 'secs'
]);

// Sentence keywords that a typo shouldn't hide ("supreset" → superset); the exercise words are corrected by the search
const KEYWORDS = ['superset', 'supersets', 'alternating'];
const fixKeywords = text =>
  text
    .split(' ')
    .map(w => (w.length >= 6 ? KEYWORDS.find(k => editDistance(w, k, 2) <= 2) || w : w))
    .join(' ');

const normalize = text =>
  fixKeywords(String(text || '').toLowerCase().replace(/\s+/g, ' ').trim())
    .replace(/×/g, 'x')
    .replace(/[’']/g, '')
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|ninety)\b/g, w => String(WORD_NUMBERS[w]))
    .replace(/\s+/g, ' ')
    .trim();

const singular = word =>
  word.endsWith('sses') || word.endsWith('shes') || word.endsWith('ches') || word.endsWith('xes')
    ? word.slice(0, -2)
    : word.endsWith('ss') || word.length < 4
      ? word
      : word.endsWith('s')
        ? word.slice(0, -1)
        : word;

/** The best library match for a chunk of words ("triceps pushdowns" → Cable Triceps Pushdown), else null. */
export const resolveExerciseChunk = chunk => {
  const words = String(chunk || '')
    .split(' ')
    .map(w => w.replace(/[^a-z0-9-]/g, ''))
    .filter(w => w && !FILLER.has(w));
  if (words.length === 0) return null;
  // Singular first ("lateral raises" would otherwise match an alias like "Lu Raises"), then as said
  const attempts = [words.map(singular).join(' '), words.join(' ')];
  // Then fewer words, keeping the end (the movement usually comes last: "flat bench press")
  const sing = words.map(singular);
  for (let drop = 1; drop < sing.length; drop++) attempts.push(sing.slice(drop).join(' '));
  for (const attempt of attempts) {
    const found = searchExercises(attempt);
    if (found.length > 0) return found[0];
  }
  return null;
};

/**
 * Reads a sentence. null when it doesn't name an exercise, or names one but says nothing about sets, reps, rest or a
 * superset (then the plain search results are enough).
 */
export const parseExerciseSentence = text => {
  let t = normalize(text);
  if (!t) return null;
  const superset = /\bsuper ?sets?\b|\bpaired with\b|\balternating\b/.test(t);
  // A max single: "1 rep max bench", "bench 1rm", "max single on squat", "heavy single deadlift"
  let oneRepMax = false;
  t = t
    .replace(/\b1\s*rep\s*max(?:imum)?\b|\b1\s*rm\b|\b(?:max|heavy)\s+single\b/g, () => {
      oneRepMax = true;
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
  let sets = null;
  let reps = null;
  let restSeconds = null;
  const take = (re, fn) => {
    const m = re.exec(t);
    if (!m) return false;
    fn(m);
    t = `${t.slice(0, m.index)} ${t.slice(m.index + m[0].length)}`.replace(/\s+/g, ' ').trim();
    return true;
  };

  // Rest: "1:30 rest", "rest 90 seconds", "with 2 minutes rest", "rest of 1.5 min"
  take(/\b(\d{1,2}):(\d{2})\b(?:\s*(?:rest|resting))?/, m => {
    restSeconds = Number(m[1]) * 60 + Number(m[2]);
  });
  if (restSeconds === null && /\brest/.test(t)) {
    take(/\b(\d+(?:\.\d+)?)\s*(min|mins|minute|minutes|m)\b/, m => {
      restSeconds = Math.round(Number(m[1]) * 60);
    }) ||
      take(/\b(\d+)\s*(s|sec|secs|second|seconds)\b/, m => {
        restSeconds = Number(m[1]);
      });
  }
  // "5x6" / "5 x 6" = sets × reps
  take(/\b(\d+)\s*x\s*(\d+)\b/, m => {
    sets = Number(m[1]);
    reps = Number(m[2]);
  });
  // "5 sets of 6 (reps)"
  if (sets === null) {
    take(/\b(\d+)\s*sets?\s*(?:of|x)\s*(\d+)\b/, m => {
      sets = Number(m[1]);
      reps = Number(m[2]);
    });
  }
  if (sets === null) {
    take(/\b(\d+)\s*sets?\b/, m => {
      sets = Number(m[1]);
    });
  }
  if (reps === null) {
    take(/\b(\d+)\s*(?:reps?|repetitions?)\b/, m => {
      reps = Number(m[1]);
    });
  }
  // A bare number left over next to a sets count reads as reps ("3 sets 12" → 12 reps)
  if (reps === null && sets !== null) {
    take(/\b(\d+)\b/, m => {
      reps = Number(m[1]);
    });
  }
  // Keep each within what the editor allows
  if (sets !== null) sets = Math.min(12, Math.max(1, sets));
  if (reps !== null) reps = Math.min(50, Math.max(1, reps));
  if (restSeconds !== null) restSeconds = Math.min(600, Math.max(15, restSeconds));

  const rest = t.replace(/\b\d+(?:\.\d+)?\b/g, ' ').replace(/\s+/g, ' ').trim();
  let exercises = [];
  if (superset) {
    const parts = rest
      .replace(/\b(super ?sets?|paired|alternating)\b/g, ' ')
      .split(/\s+(?:and|&|\+|with|then)\s+|,\s*|\s*\+\s*|\s*&\s*/)
      .map(s => s.trim())
      .filter(Boolean);
    exercises = parts.slice(0, 2).map(resolveExerciseChunk).filter(Boolean);
    if (exercises.length === 2 && exercises[0].id === exercises[1].id) exercises = [exercises[0]];
  } else {
    const ex = resolveExerciseChunk(rest);
    if (ex) exercises = [ex];
  }
  if (exercises.length === 0) return null;
  const isSuperset = superset && exercises.length === 2;
  if (oneRepMax && !isSuperset) return { exercises, sets: 1, reps: 1, restSeconds, superset: false, oneRepMax: true };
  if (!isSuperset && sets === null && reps === null && restSeconds === null) return null;
  return { exercises, sets, reps, restSeconds, superset: isSuperset, oneRepMax: false };
};

const restText = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** "Bench Press · 5 × 6 · 1:30 rest", "Superset: Pushdown + Curl · 3 × 12". */
export const describeSentence = (parsed, nameOf = ex => ex.name) => {
  if (!parsed) return '';
  const names = parsed.exercises.map(nameOf);
  const shape = parsed.oneRepMax
    ? '1 rep max'
    : parsed.sets && parsed.reps
      ? `${parsed.sets} × ${parsed.reps}`
      : parsed.sets
        ? `${parsed.sets} sets`
        : parsed.reps
          ? `${parsed.reps} reps`
          : '';
  return [
    parsed.superset ? `Superset: ${names.join(' + ')}` : names[0],
    shape,
    parsed.restSeconds ? `${restText(parsed.restSeconds)} rest` : ''
  ]
    .filter(Boolean)
    .join(' · ');
};
