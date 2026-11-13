// Formula trace for the FORMULAS console (app/components/FormulaConsole.jsx): while an action runs (RECALCULATE, an
// added exercise, a program / week / day change) the calculations write human-readable lines with the values that
// were used, so each result can be checked by hand. Lines are only kept while a trace is open (withTrace), so the
// same functions cost nothing the rest of the time. State updaters can run twice in development (StrictMode): each
// run opens the trace again, so the last run's lines are the ones kept.

const MAX_LINES = 400;
let active = null;
let log = []; // [{ id, title, lines, at }] oldest first
let version = 0;
const listeners = new Set();

const notify = () => {
  version += 1;
  const run = () => listeners.forEach(l => l());
  if (typeof queueMicrotask === 'function') queueMicrotask(run);
  else Promise.resolve().then(run);
};

export const isTracing = () => Boolean(active);

/** Adds a line to the open trace (ignored when none is open). */
export const traceLine = text => {
  if (active && text) active.lines.push(String(text));
};

/** Renames the open trace (e.g. once the added exercise is known). */
export const traceTitle = title => {
  if (active) active.title = title;
};

/** Runs fn with a trace open; its lines replace an earlier run of the same trace id (StrictMode's second run). */
export const withTrace = (title, fn, id = title) => {
  if (active) return fn(); // already inside a trace: its lines join that one
  active = { id, title, lines: [] };
  try {
    return fn();
  } finally {
    const done = { ...active, at: Date.now() };
    active = null;
    const last = log[log.length - 1];
    log = last && last.id === done.id && done.at - last.at < 1500 ? [...log.slice(0, -1), done] : [...log, done];
    let total = log.reduce((n, t) => n + t.lines.length + 1, 0);
    while (total > MAX_LINES && log.length > 1) {
      total -= log[0].lines.length + 1;
      log = log.slice(1);
    }
    notify();
  }
};

export const clearTrace = () => {
  log = [];
  notify();
};

export const subscribeTrace = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getTraceVersion = () => version;
export const getTraceLog = () => log;

/** A number for a formula line: whole numbers as they are, else 1–2 decimals. */
export const fmt = n => {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 100) / 100);
};
