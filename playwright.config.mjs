// Playwright: the web app's feature smoke tests (e2e/*.spec.js), one per feature in WEB_FEATURES.md.
// `npm run test:e2e` — locally it reuses the dev server on :3000 when it's running, else starts one; in CI it builds and
// serves the production app. Every test starts on a fresh, signed-out browser profile at phone width.
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.CI ? 3100 : 3000;

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Pixel 7'],
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: process.env.CI ? `npm run build && npx next start -p ${PORT}` : 'npm run dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000
  }
});
