// ============================================================================
// Exercise variations (behind the scenes): exercises that are the same movement done a different way share a
// family (`ex.variationOf`) and carry a short variation name (`ex.variation`), e.g. Push-up → Standard, Close Grip,
// Diamond Triceps, Decline… The exercise lists show one entry per family; tapping an exercise's title offers its
// variations. Equipment stays its own filter: the same variation can exist for several equipment types.
//
// Families are found by name (first match wins, so the order matters: lunges before squats, chin-ups before curls).
// The variation name is the exercise name without its equipment words and the family's base words; nothing left
// = "Standard". VARIATION_OVERRIDES fixes single exercises (another family, another name, or null = no family).
// ============================================================================

export const VARIATION_FAMILIES = [
  { id: 'lunge', name: 'Lunge', match: /\blunges?\b|split squat/i, base: /\blunges?\b/gi },
  { id: 'push_up', name: 'Push-up', match: /push-?ups?\b/i, base: /\bpush-?ups?\b/gi },
  {
    id: 'pull_up',
    name: 'Pull-up / Chin-up',
    match: /pull-?ups?\b|chin-?ups?\b|chinup/i,
    exclude: /biceps curl/i,
    base: /\b(pull-?ups?|chin-?ups?|chinup)\b/gi
  },
  { id: 'squat', name: 'Squat', match: /\bsquats?\b/i, exclude: /thrust/i, base: /\bsquats?\b/gi },
  {
    id: 'deadlift',
    name: 'Deadlift',
    match: /deadlift|\brdl\b|romanian/i,
    exclude: /high pull/i,
    base: /\bdeadlifts?\b/gi
  },
  {
    id: 'bench_press',
    name: 'Bench press',
    match: /bench press|floor press|chest press/i,
    base: /\b(bench )?press\b/gi
  },
  { id: 'row', name: 'Row', match: /\brows?\b/i, exclude: /upright/i, base: /\brows?\b/gi },
  {
    id: 'curl',
    name: 'Curl',
    match: /\bcurls?\b/i,
    exclude: /\bleg curl|hamstring|wrist|nordic|chin-?up/i,
    base: /\b(biceps? )?curls?\b/gi
  },
  {
    id: 'triceps',
    name: 'Triceps extension',
    match: /triceps? (extension|pushdown|kickback)|skull ?crusher|overhead (triceps )?extension/i,
    base: /\btriceps?\b/gi
  },
  { id: 'plank', name: 'Plank', match: /\bplanks?\b/i, base: /\bplanks?\b/gi }
];

// One exercise at a time: { [exerciseId]: { family, variation } | null }
export const VARIATION_OVERRIDES = {
  push_up: { family: 'push_up', variation: 'Standard' },
  triceps_push_up: { family: 'push_up', variation: 'Triceps' },
  diamond_push_up: { family: 'push_up', variation: 'Diamond' },
  chin_ups: { family: 'pull_up', variation: 'Standard' },
  barbell_back_squat: { family: 'squat', variation: 'Standard' },
  barbell_deadlift: { family: 'deadlift', variation: 'Standard' },
  barbell_bench_press: { family: 'bench_press', variation: 'Standard' },
  plank: { family: 'plank', variation: 'Standard' },
  // Shoulder / scapular movements that only share a word
  handstand_push_up: null,
  pike_push_up: null,
  scapular_pull_up: null
};

// Equipment words left out of variation names (equipment is its own filter)
const EQUIPMENT_WORDS =
  /\b(barbells?|dumbbells?|ez[- ]?bar|landmine|bodyweight|lever|cable|smith|sled|plyometric|weighted|band[- ]assisted|bands?|kettlebells?|suspended|assisted machine|partner[- ]assisted|self[- ]assisted|machine|plate[- ]loaded|selectorized|isometric)\b/gi;

// Names written several ways read the same ("Close-Grip", "close grip", "[Isolateral]" → "Close Grip", "(Isolateral)")
const titleWord = w => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w);
const tidy = text =>
  String(text || '')
    .replace(/\[([^\]]*)\]/g, '($1)')
    .replace(/([A-Za-z])-([A-Za-z])/g, '$1 $2')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–·,/]+|[\s\-–·,/]+$/g, '')
    .trim()
    .split(' ')
    .map(w => (/^\(/.test(w) ? `(${titleWord(w.slice(1))}` : titleWord(w)))
    .join(' ');

/** { family, variation } for one exercise, or null when it belongs to no family. */
export const getExerciseVariation = ex => {
  if (!ex) return null;
  if (Object.prototype.hasOwnProperty.call(VARIATION_OVERRIDES, ex.id)) return VARIATION_OVERRIDES[ex.id];
  const name = String(ex.name || '');
  // Stretches never join a family
  if (/stretch/i.test(name)) return null;
  const family = VARIATION_FAMILIES.find(f => f.match.test(name) && !(f.exclude && f.exclude.test(name)));
  if (!family) return null;
  const label = tidy(name.replace(EQUIPMENT_WORDS, ' ').replace(family.base, ' '));
  return { family: family.id, variation: label || 'Standard' };
};

export const getVariationFamily = familyId => VARIATION_FAMILIES.find(f => f.id === familyId) || null;
