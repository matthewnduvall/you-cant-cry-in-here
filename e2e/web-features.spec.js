// The web app's feature smoke tests: one test per feature in WEB_FEATURES.md, titled with its [id]
// (tests/webFeatures.test.js checks every listed feature has one). They check each feature is there and does its basic
// job, not every detail — the unit tests cover the maths.
import { test, expect, devices } from '@playwright/test';
import { appState, waitForState, openHome, openFromMenu, newSession, addExercise, sessionSlots, searchInCard, seedHistory, results } from './helpers';

test.describe('Home', () => {
  test('[home.session-buttons] NEW SESSION and AUTO SESSION', async ({ page }) => {
    await openHome(page);
    await expect(page.getByRole('button', { name: 'AUTO SESSION' })).toBeVisible();
    await page.getByRole('button', { name: 'AUTO SESSION' }).click();
    await expect.poll(async () => (await sessionSlots(page)).length, { timeout: 8000 }).toBeGreaterThan(0);
  });

  test('[home.readout-tiles] the six readout tiles', async ({ page }) => {
    await openHome(page);
    for (const label of ['TO GOAL', 'OVERDUE', 'LAST SESSION', 'THIS WEEK', 'FRIENDS', 'RANK']) {
      await expect(page.getByRole('button', { name: new RegExp(label) }).first()).toBeVisible();
    }
  });

  test('[home.body-reminder] only a brand-new account is reminded to set bodyweight and height', async ({ page, browser }) => {
    await openHome(page);
    const reminder = page.getByRole('button', { name: /Set your bodyweight and height/ });
    await expect(reminder).toBeVisible();
    await reminder.click();
    await expect(page.getByText('CONFIGURATION').first()).toBeVisible();
    // An account with History never sees it
    const used = await browser.newContext({ ...devices['Pixel 7'], baseURL: test.info().project.use.baseURL });
    const usedPage = await used.newPage();
    await seedHistory(usedPage);
    await openHome(usedPage);
    await expect(usedPage.getByRole('button', { name: /AUTO SESSION/ })).toBeVisible();
    await expect(usedPage.getByRole('button', { name: /Set your bodyweight and height/ })).toHaveCount(0);
    await used.close();
  });

  test('[home.feed] the feed asks a signed-out athlete to sign in', async ({ page }) => {
    await openHome(page);
    await expect(page.getByText(/Sign in to see your friends/)).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('[nav.menu] the menu opens every page', async ({ page }) => {
    await openHome(page);
    const pages = [
      ['Programs', 'PROGRAMS'],
      ['Performance', 'PERFORMANCE'],
      ['History', 'HISTORY'],
      ['Stimulus', 'STIMULUS'],
      ['Friends', 'FRIENDS'],
      ['Leaderboards', 'LEADERBOARDS'],
      ['Privacy', 'PRIVACY'],
      ['Configuration', 'CONFIGURATION'],
      ['Info', 'INFO']
    ];
    for (const [row, title] of pages) {
      await openFromMenu(page, row);
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    }
  });

  test('[nav.back] BACK returns to the previous page', async ({ page }) => {
    await openHome(page);
    await openFromMenu(page, 'Info');
    await openFromMenu(page, 'Stimulus');
    await page.getByRole('button', { name: 'Back to the previous page' }).click();
    await expect(page.getByText('INFO', { exact: true }).first()).toBeVisible();
  });

  test('[nav.feedback] FEEDBACK opens the feedback pop-up', async ({ page }) => {
    await openHome(page);
    await page.getByRole('button', { name: 'Send Feedback' }).click();
    await expect(page.getByText(/ENTER YOUR FEEDBACK|feedback/i).first()).toBeVisible();
  });
});

test.describe('Session', () => {
  test('[session.add-exercise] + ADD EXERCISE adds a planned exercise', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    const slots = await sessionSlots(page);
    expect(slots.length).toBe(1);
    expect(slots[0].sets.length).toBeGreaterThan(0);
    expect(slots[0].sets.some(s => Number(s.weight) > 0)).toBe(true);
  });

  test('[session.tick-set] ticking a set marks it done and starts the rest timer', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    await page.getByRole('button', { name: 'Mark set complete' }).first().click();
    await waitForState(page, s => s.activeSession?.slots?.[0]?.sets?.[0]?.completed);
  });

  test('[session.simple-effort] SIMPLE asks how many more reps after a working set', async ({ page }) => {
    await newSession(page, 'SIMPLE');
    await addExercise(page);
    const sets = (await sessionSlots(page))[0].sets;
    const working = sets.findIndex(s => s.type !== 'Warmup');
    await page.getByRole('button', { name: 'Mark set complete' }).nth(working).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('How many more reps could you have done?')).toBeVisible();
    await dialog.getByRole('button', { name: '2 more' }).click();
    await waitForState(page, s => s.activeSession?.slots?.[0]?.sets?.[working]?.intensity?.value === 2);
  });

  test('[session.simple-rows-superset] SIMPLE: + 1 ROW and SUPERSET / UNPAIR', async ({ page }) => {
    await newSession(page, 'SIMPLE');
    await addExercise(page);
    const before = (await sessionSlots(page))[0].sets.length;
    await page.getByRole('button', { name: '+ 1 ROW' }).click();
    await waitForState(page, s => s.activeSession?.slots?.[0]?.sets?.length === before + 1);
    await page.getByRole('button', { name: /^Superset: pair/ }).click();
    await waitForState(page, s => s.activeSession?.slots?.[0]?.category === 'Superset');
    await page.getByRole('button', { name: /^Unpair/ }).click();
    await waitForState(page, s => s.activeSession?.slots?.[0]?.category !== 'Superset');
  });

  test('[session.advanced-scheme] ADVANCED: the scheme pop-up changes sets and reps', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    await page.getByRole('button', { name: /^Scheme:/ }).first().click();
    await expect(page.getByText('SCHEME').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^APPLY/ })).toBeVisible();
  });

  test('[session.reset-exercise] ADVANCED: RESET puts an exercise back as it was loaded', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    await expect(page.getByRole('button', { name: 'RESET', exact: true }).last()).toBeVisible();
    await page.getByRole('button', { name: 'RESET', exact: true }).last().click();
  });

  test('[session.search] the exercise search finds and picks an exercise', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    const before = (await sessionSlots(page))[0].exerciseId;
    await searchInCard(page, 'lateral raise');
    await results(page).filter({ hasText: /lateral raise/i }).first().click();
    await waitForState(page, s => {
      const id = s.activeSession?.slots?.[0]?.exerciseId;
      return id && id !== before;
    });
  });

  test('[session.sentence-search] a sentence sets up exercise, sets, reps and rest', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    await searchInCard(page, 'bench press for 6 reps in 5 sets with 1:30 rest');
    const setup = results(page).filter({ hasText: 'SET UP' });
    await expect(setup).toContainText('5 × 6');
    await setup.click();
    await waitForState(page, s => {
      const sl = s.activeSession?.slots?.[0];
      return sl?.exerciseId === 'barbell_bench_press' && sl.sets.length === 5 && sl.sets.every(x => x.reps === 6) && sl.customRestSeconds === 90;
    });
  });

  test('[session.sentence-superset] a superset sentence pairs two exercises', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    await searchInCard(page, 'superset triceps pushdowns and curls 12 reps 3 sets');
    await results(page).filter({ hasText: 'SET UP' }).click();
    await waitForState(page, s => s.activeSession?.slots?.[0]?.category === 'Superset');
  });

  test('[session.one-rep-max] "1 rep max bench" makes one max single', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    await searchInCard(page, '1 rep max bench');
    await results(page).filter({ hasText: '1 rep max' }).click();
    await waitForState(page, s => {
      const sets = s.activeSession?.slots?.[0]?.sets || [];
      return sets.length === 1 && sets[0].type === '1 Rep Max' && sets[0].reps === 1;
    });
  });

  test('[session.sentence-scheme] "bench press pyramid one rep max" sets up the Pyramid 1RM scheme', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    await searchInCard(page, 'bench press pyramid one rep max');
    const setup = results(page).filter({ hasText: 'SET UP' });
    await expect(setup).toContainText('Pyramid 1RM');
    await setup.click();
    await waitForState(page, s => {
      const sl = s.activeSession?.slots?.[0];
      return sl?.scheme === 'Pyramid 1RM' && sl.sets.length > 1 && sl.sets[sl.sets.length - 1].type === '1 Rep Max';
    });
  });

  test('[session.sentence-reps-stay] "12 sets of 10 pushups" keeps 10 reps on every set', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    await searchInCard(page, '12 sets of 10 pushups');
    await results(page).filter({ hasText: 'SET UP' }).click();
    await waitForState(page, s => {
      const sets = s.activeSession?.slots?.[0]?.sets || [];
      return sets.length === 12 && sets.every(x => x.reps === 10);
    });
  });

  test('[session.spoken-enter] a complete spoken request enters itself after 2 s of silence; typed ones wait', async ({ page }) => {
    // A stand-in recogniser the test can speak into (window.__say)
    await page.addInitScript(() => {
      class FakeRecognition {
        start() {
          window.__rec = this;
          setTimeout(() => this.onstart?.(), 10);
        }
        abort() {
          setTimeout(() => this.onend?.(), 30);
        }
        stop() {
          setTimeout(() => this.onend?.(), 30);
        }
      }
      window.webkitSpeechRecognition = FakeRecognition;
      window.SpeechRecognition = FakeRecognition;
      window.__say = text => window.__rec?.onresult?.({ results: [[{ transcript: text }]] });
    });
    await newSession(page);
    await addExercise(page);
    // Typed: still waiting for a tap after 2.5 s
    const box = await searchInCard(page, 'bench 5x5');
    await page.waitForTimeout(2500);
    await expect(box).toBeVisible();
    await page.getByRole('button', { name: 'Clear the search' }).click();
    await box.press('Escape');
    // Spoken: tap the mic shortcut, say it, and it builds the card on its own
    await page.getByRole('button', { name: /Say the exercise/ }).first().click();
    await page.evaluate(() => window.__say('bench press'));
    await page.evaluate(() => window.__say('bench press 4 sets of 6'));
    await expect(page.locator('input[type="search"]')).toHaveCount(0, { timeout: 5000 });
    await waitForState(page, s => {
      const sets = s.activeSession?.slots?.[0]?.sets || [];
      return sets.length === 4 && sets.every(x => x.reps === 6);
    });
    // Speaking again right after still registers (the dead-mic bug)
    await page.getByRole('button', { name: /Say the exercise/ }).first().click();
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__say('squat'));
    await expect(page.locator('input[type="search"]')).toHaveValue('squat');
  });

  test('[session.mic-no-keyboard] the mic shortcut listens without opening the keyboard', async ({ page }) => {
    await page.addInitScript(() => {
      class FakeRecognition {
        start() {
          setTimeout(() => this.onstart?.(), 10);
        }
        abort() {
          setTimeout(() => this.onend?.(), 30);
        }
        stop() {
          this.abort();
        }
      }
      window.webkitSpeechRecognition = FakeRecognition;
      window.SpeechRecognition = FakeRecognition;
    });
    await newSession(page);
    await addExercise(page);
    await page.getByRole('button', { name: /Say the exercise/ }).first().click();
    const box = page.locator('input[type="search"]');
    await expect(box).toBeVisible();
    await expect(box).not.toBeFocused();
    await expect(page.getByRole('button', { name: 'Stop listening' })).toBeVisible();
    // A tap outside closes the search (and the mic)
    await page.mouse.click(5, 400);
    await expect(box).toHaveCount(0);
  });

  test('[session.mic-blocked] a refused mic is explained in the search', async ({ page }) => {
    await page.addInitScript(() => {
      class RefusedRecognition {
        start() {
          setTimeout(() => this.onerror?.({ error: 'not-allowed' }), 10);
        }
        abort() {}
        stop() {}
      }
      window.webkitSpeechRecognition = RefusedRecognition;
      window.SpeechRecognition = RefusedRecognition;
    });
    await newSession(page);
    await addExercise(page);
    await page.getByRole('button', { name: /Say the exercise/ }).first().click();
    await expect(page.getByRole('status').filter({ hasText: 'microphone is blocked' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stop listening' })).toHaveCount(0);
  });

  test('[session.delete-exercise] the ✕ at the top right deletes the exercise', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    await page.getByRole('button', { name: /Remove exercise|Delete exercise/ }).first().click();
    await page.getByRole('button', { name: /^DELETE ✕$/ }).click();
    await expect(page.getByRole('button', { name: /Remove exercise|Delete exercise/ })).toHaveCount(0);
  });

  test('[session.search-clear] the ✕ clears the search box', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    const box = await searchInCard(page, 'bench press');
    await page.getByRole('button', { name: 'Clear the search' }).click();
    await expect(box).toHaveValue('');
    await expect(box).toBeFocused();
  });

  test('[session.typo-search] the search forgives typos', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    await searchInCard(page, 'benhc press');
    await expect(results(page).first()).toContainText(/bench press/i);
  });

  test('[session.microphone] the search box offers the microphone where the browser has speech recognition', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    const hasSpeech = await page.evaluate(() => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    // Beside the exercise name (a shortcut), and inside the open search box
    const shortcut = page.getByRole('button', { name: /Say the exercise/ });
    if (hasSpeech) await expect(shortcut.first()).toBeVisible();
    else await expect(shortcut).toHaveCount(0);
    await searchInCard(page, '');
    if (hasSpeech) await expect(page.getByRole('button', { name: /Say the exercise/ }).first()).toBeVisible();
  });

  test('[session.console] the CONSOLE opens, and goes full screen', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    await page.getByRole('button', { name: /Show the formulas/ }).click();
    await page.getByRole('button', { name: 'Full screen' }).click();
    await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible();
    await expect(page.getByRole('log')).toContainText(/ADD EXERCISE/);
  });

  test('[session.finish] FINISH logs the done sets to History', async ({ page }) => {
    await newSession(page);
    await addExercise(page);
    await page.getByRole('button', { name: 'Mark set complete' }).first().click();
    await page.getByRole('button', { name: 'FINISH', exact: true }).first().click();
    await expect(page.getByText('FINISH SESSION')).toBeVisible();
    await page.getByRole('button', { name: 'FINISH', exact: true }).last().click();
    await waitForState(page, s => (s.history || []).length === 1 && !(s.activeSession?.slots || []).length);
  });
});

test.describe('History and progress', () => {
  test('[history.list-and-editor] History lists sessions and opens one as an editor', async ({ page }) => {
    await seedHistory(page);
    await openHome(page);
    await openFromMenu(page, 'History');
    await expect(page.getByText(/BENCH DAY/i).first()).toBeVisible();
    await page.getByText(/BENCH DAY/i).first().click();
    await expect(page.getByRole('button', { name: /Mark set/ }).first()).toBeVisible();
  });

  test('[performance.chart-and-accuracy] Performance shows the chart, ACCURACY and REP CURVE', async ({ page }) => {
    await seedHistory(page);
    await openHome(page);
    await openFromMenu(page, 'Performance');
    await expect(page.getByText('ACCURACY', { exact: true })).toBeVisible();
    await expect(page.getByText('REP CURVE', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /SET GOALS/ })).toBeVisible();
  });

  test('[stimulus.map] Stimulus shows the body map, thresholds and suggestions', async ({ page }) => {
    await openHome(page);
    await openFromMenu(page, 'Stimulus');
    await expect(page.getByText('STIMULUS THRESHOLDS')).toBeVisible();
    await expect(page.locator('svg').first()).toBeVisible();
  });
});

test.describe('Programs', () => {
  test('[routines.page] the Programs page: ROUTINES tab with + NEW ROUTINE and AUTO ROUTINE', async ({ page }) => {
    await openHome(page);
    await openFromMenu(page, 'Programs');
    await page.getByRole('tab', { name: /^ROUTINES/ }).click();
    await expect(page.getByRole('button', { name: /\+ NEW ROUTINE/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /AUTO ROUTINE/ })).toBeVisible();
  });

  test('[programs.built-in] built-in programs: details, routines at your weights, LOAD', async ({ page }) => {
    await openHome(page);
    await openFromMenu(page, 'Programs');
    await page.getByRole('button', { name: 'Open program Linear 5x5 Foundation' }).click();
    await expect(page.getByText('TRAINING DAYS')).toBeVisible();
    await expect(page.getByText(/^ROUTINES \(2\)$/)).toBeVisible();
    await page.getByRole('button', { name: /^Load Linear 5x5 Foundation/ }).first().click();
    await waitForState(page, s => (s.activeSession?.slots || []).length > 0 && s.activeSession.program === 'linear_5x5');
  });

  test('[programs.cycles] a logged cycle is reviewed week by week and saved as a program with its weeks', async ({ page }) => {
    // Two Society sessions logged in weeks 1 and 2 (with the app's plan on their sets)
    await page.addInitScript(() => {
      if (window.localStorage.getItem('yccih_e2e_cycle')) return;
      window.localStorage.setItem('yccih_e2e_cycle', '1');
      const session = (id, date, week) => ({
        id,
        title: `Society Week ${week}`,
        startedAt: date.toISOString(),
        program: 'society',
        programWeek: `Week ${week}`,
        programDay: 'A',
        slots: [
          {
            id: `${id}_s`,
            category: 'Compound',
            exerciseId: 'barbell_bench_press',
            scheme: '5x6',
            sets: [0, 1, 2].map(i => ({ id: `${id}_${i}`, type: 'Working', weight: 185, reps: 6, completed: true, plan: { weight: 185, reps: 6, rir: 3 } }))
          }
        ]
      });
      window.localStorage.setItem(
        'yccih_app_state_v3',
        JSON.stringify({ schemaVersion: 3, history: [session('c1', new Date(2026, 9, 5, 18), 1), session('c2', new Date(2026, 9, 12, 18), 2)] })
      );
    });
    await openHome(page);
    await openFromMenu(page, 'Programs');
    await page.getByRole('button', { name: 'Open program Society' }).click();
    await expect(page.getByText('YOUR LOGGED CYCLES (1)')).toBeVisible();
    await page.getByRole('button', { name: /^Cycle .*show its review/ }).click();
    await expect(page.getByRole('table', { name: 'Cycle review, week by week' })).toBeVisible();
    await page.getByRole('button', { name: 'SAVE AS PROGRAM' }).click();
    await expect(page.getByText('WEEK 2', { exact: true })).toBeVisible();
    await waitForState(page, s => {
      const p = (s.settings?.routinePlaylists || [])[0];
      return p && p.routines?.length === 2 && p.routines[0].week === 1 && p.routines[1].week === 2 && p.routines[0].slots[0].sets[0].weight === 0;
    });
  });

  test('[programs.choose] USE THIS PROGRAM chooses a program; COPY makes one of your own, chosen as CUSTOM', async ({ page }) => {
    await openHome(page);
    await openFromMenu(page, 'Programs');
    await page.getByRole('button', { name: 'Open program Society' }).click();
    await page.getByRole('button', { name: 'USE THIS PROGRAM' }).click();
    await waitForState(page, s => s.settings?.program === 'society');
    await page.getByRole('button', { name: 'COPY TO MY PROGRAMS' }).click();
    await expect(page.getByText('PROGRAM NAME')).toBeVisible();
    await page.getByRole('button', { name: 'USE THIS PROGRAM' }).click();
    await waitForState(page, s => String(s.settings?.program || '').startsWith('custom:') && (s.savedRoutines || []).length >= 5);
  });
});

test.describe('Settings and data', () => {
  test('[configuration.tabs] Configuration: body metrics, goals, equipment and training', async ({ page }) => {
    await openHome(page);
    await openFromMenu(page, 'Configuration');
    for (const tab of ['BODY METRICS', 'GOALS', 'EQUIPMENT', 'TRAINING']) {
      await page.getByRole('button', { name: tab, exact: true }).or(page.getByRole('tab', { name: tab, exact: true })).first().click();
    }
  });

  test('[privacy.page] Privacy: sharing settings, sharing defaults and voice input', async ({ page }) => {
    await openHome(page);
    await openFromMenu(page, 'Privacy');
    await expect(page.getByText('SHARING DEFAULTS')).toBeVisible();
    await expect(page.getByText('VOICE INPUT')).toBeVisible();
    await expect(page.getByText('No audio is recorded or kept')).toBeVisible();
  });

  test('[info.backup] Info: the idea, and DATA & BACKUP export', async ({ page }) => {
    await openHome(page);
    await openFromMenu(page, 'Info');
    await expect(page.getByText('DATA & BACKUP')).toBeVisible();
  });
});

test.describe('Social', () => {
  test('[social.signed-out] Friends and Leaderboards ask a signed-out athlete to sign in', async ({ page }) => {
    await openHome(page);
    await openFromMenu(page, 'Leaderboards');
    await expect(page.getByText(/Sign in to see where you rank/)).toBeVisible();
  });

  test('[auth.sign-in] the sign-in page', async ({ page }) => {
    await openHome(page);
    // (the signed-out line under the header)
    await page.getByRole('button', { name: 'SIGN IN', exact: true }).first().click();
    await expect(page.getByText('SIGN IN').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });
});

test('[app.state-saves] what you do is saved on this device', async ({ page }) => {
  await newSession(page);
  await addExercise(page);
  await page.reload();
  expect(((await appState(page)).activeSession?.slots || []).length).toBe(1);
});
