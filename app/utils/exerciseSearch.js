// Exercise search, shared by the slot editor, the exercise picker, the History filter and the sentence parser.
import { EXERCISE_LIBRARY, stripEquipmentFromExerciseName } from '../data/exerciseLibrary';

export const SEARCH_RESULT_LIMIT = 40;

/**
 * Exercises whose name / equipment / muscle group contain every word typed, best matches first: a name that starts
 * with the text, then one with a word starting with it, then one containing it, then equipment / muscle matches.
 * Within each, the plainest names first (shortest name without the equipment word: "Lateral Raise" before
 * "Hanging Pike (Toes-to-Bar) Leg Raise"), then priority / hand-picked exercises. Searches the whole library (the
 * Equipment page list only drives the exercises picked automatically); up to SEARCH_RESULT_LIMIT, in a scrolling list.
 */
const searchExact = (query, pool = EXERCISE_LIBRARY) => {
  const words = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const phrase = words.join(' ');
  const rank = ex => {
    const name = ex.name.toLowerCase();
    const short = stripEquipmentFromExerciseName(ex.name).toLowerCase();
    // Exactly another name it goes by ("squat" = Barbell Back Squat): first
    if ((ex.aliases || []).some(alias => alias.toLowerCase() === phrase)) return -1;
    if (name.startsWith(phrase) || short.startsWith(phrase)) return 0;
    // Another name it goes by ("RDL", "Dips")
    if ((ex.aliases || []).some(alias => alias.toLowerCase().startsWith(phrase))) return 0;
    // A word in the name starts with the text ("raise" in "Lateral Raise")
    const at = name.indexOf(phrase);
    if (at > 0 && name.split(/[^a-z0-9]+/).some(word => word.startsWith(words[0]))) return 1;
    if (name.includes(phrase)) return 2;
    return 3;
  };
  const plainLength = ex => stripEquipmentFromExerciseName(ex.name).length;
  const curated = ex => (String(ex.id).startsWith('exrx_') ? 0 : 1);
  return pool
    .filter(ex => {
      const hay = `${ex.name} ${(ex.aliases || []).join(' ')} ${ex.equipment || ''} ${ex.muscleGroup || ''}`.toLowerCase();
      return words.every(w => hay.includes(w));
    })
    .map(ex => ({ ex, r: rank(ex), len: plainLength(ex) }))
    .sort(
      (a, b) =>
        a.r - b.r ||
        a.len - b.len ||
        Number(Boolean(b.ex.isPriority)) - Number(Boolean(a.ex.isPriority)) ||
        curated(b.ex) - curated(a.ex) ||
        a.ex.name.localeCompare(b.ex.name)
    )
    .slice(0, SEARCH_RESULT_LIMIT)
    .map(item => item.ex);
};

// ---- Typos. When nothing matches, each word that isn't in the library's vocabulary (the words of every exercise
// name, other name, equipment and muscle group) is replaced by the closest one that is — at most 1 edit for words up
// to 6 letters, 2 for longer ones (a swap of two neighbouring letters counts as 1) — and the search runs again.
// Words that start a vocabulary word ("pushd") are left as they are: the search already matches part words.
let VOCAB = null;
const vocabulary = () => {
  if (VOCAB) return VOCAB;
  const words = new Set();
  EXERCISE_LIBRARY.forEach(ex =>
    `${ex.name} ${(ex.aliases || []).join(' ')} ${ex.equipment || ''} ${ex.muscleGroup || ''}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .forEach(w => {
        if (w.length >= 3) words.add(w);
      })
  );
  VOCAB = [...words];
  return VOCAB;
};

/** Edit distance with adjacent swaps (optimal string alignment), stopping early past `max`. */
export const editDistance = (a, b, max = 2) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
};

/** The closest vocabulary word to a typed word (itself when it is fine, or nothing is close enough). */
export const correctWord = word => {
  const w = String(word || '').toLowerCase();
  if (w.length < 4 || /\d/.test(w)) return w;
  const vocab = vocabulary();
  if (vocab.some(v => v === w || v.startsWith(w))) return w;
  const max = w.length <= 6 ? 1 : 2;
  let best = w;
  let bestD = max + 1;
  vocab.forEach(v => {
    const dist = editDistance(w, v, max);
    if (dist < bestD || (dist === bestD && best !== w && v.length < best.length)) {
      best = v;
      bestD = dist;
    }
  });
  return bestD <= max ? best : w;
};

/** The query with each typo corrected ("tricpes pushdwon" → "triceps pushdown"); unchanged when nothing needed it. */
export const correctQuery = query =>
  String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(correctWord)
    .join(' ');

/**
 * Exercises matching the query (searchExact), and when nothing does, the same search with typos corrected
 * (correctQuery), so "benhc press" and "tricpes pushdwon" still find them.
 */
export const searchExercises = (query, pool = EXERCISE_LIBRARY) => {
  const exact = searchExact(query, pool);
  if (exact.length > 0) return exact;
  const corrected = correctQuery(query);
  return corrected && corrected !== String(query || '').toLowerCase().trim() ? searchExact(corrected, pool) : exact;
};
