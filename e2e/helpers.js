// Shared steps for the web feature smoke tests.
import { expect } from '@playwright/test';

/** The app's saved state (localStorage yccih_app_state_v3), or {}. */
export const appState = page =>
  page.evaluate(() => {
    try {
      return JSON.parse(window.localStorage.getItem('yccih_app_state_v3') || '{}');
    } catch {
      return {};
    }
  });

/** Waits until the saved state passes a check (the app saves on a short debounce). */
export const waitForState = (page, check, timeout = 8000) =>
  expect.poll(async () => check(await appState(page)), { timeout }).toBeTruthy();

/** Opens Home on a fresh profile. */
export const openHome = async page => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /NEW SESSION|CURRENT SESSION/ })).toBeVisible();
};

/** Opens a page from the menu by its row label (Performance, History, Stimulus, …). */
export const openFromMenu = async (page, label) => {
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.locator('nav').getByText(label, { exact: true }).first().click();
};

/** Picks ATHLETE or COACH in the footer's app-mode toggle (on every page). */
export const setAppMode = async (page, mode) => {
  await page.getByRole('tablist', { name: 'App mode' }).getByRole('tab', { name: mode, exact: true }).click();
};

/** NEW SESSION in ATHLETE or COACH mode (SIMPLE / ADVANCED are the old names, still accepted). */
export const newSession = async (page, mode = 'COACH') => {
  await openHome(page);
  await setAppMode(page, mode === 'SIMPLE' ? 'ATHLETE' : mode === 'ADVANCED' ? 'COACH' : mode);
  await page.getByRole('button', { name: /NEW SESSION|CURRENT SESSION/ }).click();
};

/** + ADD EXERCISE, and waits for the card's sets and for the session to be saved with it. */
export const addExercise = async page => {
  const before = ((await appState(page)).activeSession?.slots || []).length;
  await page.getByRole('button', { name: /\+ ADD EXERCISE/ }).first().click();
  await expect(page.getByRole('button', { name: 'Mark set complete' }).first()).toBeVisible();
  await waitForState(page, st => (st.activeSession?.slots || []).length === before + 1);
};

/** The search results list's entries (not other dropdowns' options). */
export const results = page => page.getByRole('listbox').getByRole('option');

/** The live session's exercises from the saved state. */
export const sessionSlots = async page => (await appState(page)).activeSession?.slots || [];

/** Types into an exercise card's search box (opening it first). */
export const searchInCard = async (page, text, card = 0) => {
  await page.getByRole('button', { name: /tap to search or change/i }).nth(card).click();
  const box = page.locator('input[type="search"]');
  await box.fill(text);
  return box;
};

/** A minimal saved state with one logged bench session, so History, Performance and LAST have something to show. */
export const seedHistory = async page => {
  await page.addInitScript(() => {
    if (window.localStorage.getItem('yccih_e2e_seeded')) return;
    window.localStorage.setItem('yccih_e2e_seeded', '1');
    const day = new Date(2026, 9, 1, 12);
    const sets = [5, 5, 5].map((r, i) => ({
      id: `e2e_s${i}`,
      setNumber: i + 1,
      type: 'Working',
      weight: 185,
      reps: r,
      completed: true,
      intensity: { mode: 'rir', value: 2 }
    }));
    window.localStorage.setItem(
      'yccih_app_state_v3',
      JSON.stringify({
        schemaVersion: 3,
        history: [
          {
            id: 'e2e_w1',
            title: 'Bench Day',
            startedAt: day.toISOString(),
            workoutDate: '2026/10/1',
            slots: [{ id: 'e2e_sl1', category: 'Compound', exerciseId: 'barbell_bench_press', scheme: '5x5', sets }]
          }
        ]
      })
    );
  });
};
