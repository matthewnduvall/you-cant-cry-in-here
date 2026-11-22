import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getBodyweightShare } from '../app/utils/workoutEngine';
import { EXERCISE_LIBRARY } from '../app/data/exerciseLibrary';

// Editing scripts have twice written a regex word boundary (\b) as a real backspace character, which silently breaks
// the regex. No source file may contain a control character other than newline, carriage return and tab.
const sourceFiles = dir =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(js|jsx|mjs)$/.test(name) ? [path] : [];
  });

describe('source files', () => {
  it('contain no stray control characters', () => {
    const bad = [];
    [...sourceFiles('app'), ...sourceFiles('tests')].forEach(path => {
      const text = readFileSync(path, 'utf8');
      [...text].forEach((c, i) => {
        const code = c.charCodeAt(0);
        if (code < 32 && c !== '\n' && c !== '\r' && c !== '\t') bad.push(`${path} @${i} (code ${code})`);
      });
    });
    expect(bad).toEqual([]);
  });
});

describe('bodyweight share', () => {
  it('dips move 95 % of bodyweight, bench dips 55 %', () => {
    const dip = EXERCISE_LIBRARY.find(ex => /^triceps dip$/i.test(ex.name) || /^dips?$/i.test(ex.name));
    if (dip) expect(getBodyweightShare(dip.id)).toBe(0.95);
    expect(getBodyweightShare('bench_dip')).toBe(0.55);
    const assisted = EXERCISE_LIBRARY.find(ex => /assisted machine triceps dip/i.test(ex.name));
    expect(getBodyweightShare(assisted.id)).toBe(0.95);
  });
});
