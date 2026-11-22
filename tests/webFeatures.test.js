import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Keeps the web feature inventory (WEB_FEATURES.md) and the browser smoke tests (e2e/web-features.spec.js) in step:
// every automated feature has a test titled with its [id], and every test's id is in the inventory. Removing a feature
// therefore means removing its line and its test together — a deliberate change the owner has agreed to.
const inventory = readFileSync('WEB_FEATURES.md', 'utf8');
const automated = inventory.split('## Not yet automated')[0];
const listedIds = [...automated.matchAll(/^- \*\*([a-z0-9.-]+)\*\*/gm)].map(m => m[1]);
const spec = readFileSync('e2e/web-features.spec.js', 'utf8');
const testedIds = [...spec.matchAll(/test\('\[([a-z0-9.-]+)\]/g)].map(m => m[1]);

describe('web feature inventory', () => {
  it('lists features', () => {
    expect(listedIds.length).toBeGreaterThan(20);
  });

  it('every listed feature has a browser smoke test', () => {
    expect(listedIds.filter(id => !testedIds.includes(id))).toEqual([]);
  });

  it('every smoke test is for a listed feature', () => {
    expect(testedIds.filter(id => !listedIds.includes(id))).toEqual([]);
  });

  it('ids are unique', () => {
    expect(new Set(listedIds).size).toBe(listedIds.length);
    expect(new Set(testedIds).size).toBe(testedIds.length);
  });
});
