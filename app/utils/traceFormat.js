// Reorganises the CONSOLE's trace (utils/calcTrace.js: [{ id, title, lines, at }]) for reading: each action is split
// into the exercises it touched, each exercise into its sets, and each set into labelled steps (Scheme default,
// Warm-up ramp, Weight from 1RM, Intensity…) with the step's result pulled out. Lines are matched by shape, not by
// a structured format, so a line it doesn't recognise is kept as a note of the exercise (or of the action).

import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';

let NAMES = null;
const exerciseNames = () => {
  if (!NAMES) NAMES = [...new Set(EXERCISE_LIBRARY.map(ex => ex.name).filter(Boolean))].sort((a, b) => b.length - a.length);
  return NAMES;
};

const SET_TYPES = ['1 Rep Max', 'Top Out', 'Burn Out', 'Warmup', 'Working'];

/** The step a set line describes, from its wording. */
export const stepLabel = text => {
  const t = String(text);
  if (/removed/.test(t)) return 'Routine';
  if (/% of the first working/.test(t)) return 'Warm-up ramp';
  if (/× type .* × fatigue/.test(t)) return 'Scheme default';
  if (/all locked|locked →|locked \(/.test(t)) return 'Lock';
  if (/last session|lower of|\+ increment|increment/.test(t) && !/÷ \(1 \+/.test(t)) return 'Progression';
  if (/reps to failure/.test(t) && /intensity|RIR =/.test(t)) return 'Intensity';
  if (/reps to failure/.test(t)) return 'Reps from load';
  if (/÷ \(1 \+ \(/.test(t)) return 'Weight from 1RM';
  if (/%1RM|% ×|× \d+(\.\d+)?%/.test(t)) return 'Weight from %1RM';
  if (/intensity|→ (RIR|RPE)/.test(t)) return 'Intensity';
  if (/bodyweight/.test(t)) return 'Bodyweight';
  return 'Step';
};

/** The value a line ends on: the text after its last → (and after its last = when that is a sum, "… = 9"). */
const resultOf = text => {
  const i = String(text).lastIndexOf('→');
  if (i < 0) return '';
  const tail = String(text).slice(i + 1).trim();
  const eq = tail.lastIndexOf('=');
  return eq >= 0 ? tail.slice(eq + 1).trim() : tail;
};

/** A set's headline value: its last weight (… lb), then × the reps when a later step worked the reps out. */
export const setFinal = set => {
  let weight = '';
  let reps = '';
  (set?.steps || []).forEach(st => {
    if (!st.result) return;
    if (/lb/.test(st.result)) {
      weight = st.result;
      reps = '';
    } else if (st.label === 'Reps from load' || /^\d+$/.test(st.result)) reps = `${st.result} reps`;
  });
  return [weight, reps].filter(Boolean).join(' × ');
};

const leadingExercise = line => {
  const m = /^Exercise: (.+?)( ·|$)/.exec(line);
  if (m) return { name: m[1], rest: line };
  if (line.startsWith('1RM ')) {
    const n1 = exerciseNames().find(n => line.startsWith(`1RM ${n} `));
    if (n1) return { name: n1, rest: line };
  }
  const name = exerciseNames().find(n => line.startsWith(n) && (line[n.length] === ' ' || line[n.length] === ':'));
  if (!name) return null;
  return { name, rest: line.slice(name.length).replace(/^:\s*/, '').trim() };
};

/**
 * One trace → { title, at, notes: [line], exercises: [{ name, oneRM: [line], notes: [line],
 * sets: [{ n, type, steps: [{ label, text, result }] }] }] }.
 */
export const formatTrace = trace => {
  const out = { title: trace.title, at: trace.at, notes: [], exercises: [] };
  let current = null;
  const exerciseFor = name => {
    let ex = out.exercises.find(e => e.name === name);
    if (!ex) {
      ex = { name, oneRM: [], notes: [], sets: [] };
      out.exercises.push(ex);
    }
    return ex;
  };
  (trace.lines || []).forEach(raw => {
    const line = String(raw);
    const lead = leadingExercise(line);
    let body = line;
    if (lead) {
      current = exerciseFor(lead.name);
      body = lead.rest;
    }
    const setMatch = /^set (\d+)\b\s*(.*)$/.exec(body);
    if (current && setMatch) {
      const n = Number(setMatch[1]);
      let rest = setMatch[2];
      // "Working · RIR 2 × 8: …" → type Working, the formula after the first ": "
      const colon = rest.indexOf(': ');
      const head = colon >= 0 ? rest.slice(0, colon) : '';
      const text = colon >= 0 ? rest.slice(colon + 2) : rest.replace(/^[:\s]+/, '');
      const type = SET_TYPES.find(t => head.startsWith(t) || head.includes(` ${t}`)) || null;
      let set = current.sets.find(s => s.n === n);
      if (!set) {
        set = { n, type, steps: [] };
        current.sets.push(set);
        current.sets.sort((a, b) => a.n - b.n);
      }
      if (!set.type && type) set.type = type;
      // The head's own detail (RIR 2 × 8) leads the formula so nothing is lost
      // ("× 8" reads as "8 reps"; "RIR 2 × 8" as "RIR 2 · 8 reps")
      const detail = head
        .replace(type || '', '')
        .replace(/^[\s·]+/, '')
        .replace(/\s*×\s*(\d+)\b/, (m, n) => ` · ${n} reps`)
        .replace(/^[\s·]+/, '')
        .trim();
      const full = detail ? `${detail}: ${text}` : text;
      set.steps.push({ label: stepLabel(full), text: full, result: resultOf(full) });
      return;
    }
    if (current && /^1RM\b/.test(line)) {
      // "1RM Barbell Bench Press (never logged) = …" → "(never logged) = …" (the exercise is the block's title)
      const prefix = `1RM ${current.name} `;
      current.oneRM.push((line.startsWith(prefix) ? line.slice(prefix.length) : line.replace(/^1RM\s*/, '')).trim());
      return;
    }
    // Anything else belongs to the exercise being worked on (its "Exercise: …" line reads as its scheme), else to the
    // action as a whole
    if (current) current.notes.push(/^Exercise: /.test(line) ? line.replace(/^Exercise: .+? · /, '') : body);
    else out.notes.push(line);
  });
  return out;
};
