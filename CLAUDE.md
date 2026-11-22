@AGENTS.md

# Claude Code Notes

`AGENTS.md` (imported above) is the source of truth for product, design, and architecture context. Keep it updated when you change behavior, add files, or rename things, so it stays shared between Claude Code and any other agent. Put only Claude Code–specific workflow notes here.

## Commands
- `npm run dev` — dev server on http://localhost:3000 (preview config: `.claude/launch.json`, name `dev`).
- `npm run lint` — ESLint (flat config, `eslint-config-next`). The tree currently has known pre-existing errors (mostly `react-hooks/set-state-in-effect`); don't add new ones.
- `npm run build` — production build; run it before committing anything that touches rendering, data loading, or `next.config.mjs`.
- `npm test` — Vitest unit tests (`tests/*.test.js`, config `vitest.config.mjs`, which loads `exercises.csv` as a string like `next.config.mjs` does): the 1RM / intensity maths, rep curves, Kalman, rest, the prediction replay, friends' models, the console's grouping, and a guard that no source file contains a control character. Run it after touching `app/utils/`; add tests for new engine logic.
- `npm run test:e2e` — Playwright browser smoke tests (`e2e/web-features.spec.js`, config `playwright.config.mjs`: phone-sized Chromium, fresh signed-out profile per test; locally reuses the dev server on :3000, with `CI=true` it builds and serves production on :3100). `npm run check:web` = unit tests + smoke tests (about 10 s).
- ESLint here does not catch undefined names (`no-undef` isn't on for JS): when new code uses an import, grep that it is imported. `npm run build` and a browser check catch what slips through.
- Python patch scripts: never put a regex `\b` inside a heredoc or a non-raw Python string — it becomes a real backspace (it broke the dip bodyweight share once). Write scripts to a file with raw strings; `tests/source.test.js` catches it.

## Web app parity (the native iOS / Apple Watch work must not cost the web app anything)
- `WEB_FEATURES.md` lists every web feature; each automated one has a smoke test titled `[id]` in `e2e/web-features.spec.js`, and `tests/webFeatures.test.js` fails `npm test` if a listed feature has no test or a test isn't listed.
- **Before removing, hiding or narrowing any feature in `WEB_FEATURES.md`, stop and ask the owner in chat** — name the feature, what changes and why — and wait for a clear yes. Only then remove its line and its test in the same change. New features: add a line and a smoke test.
- Ship gate: a PreToolUse hook in `.claude/settings.json` runs `scripts/ship-gate.mjs` before any `gh pr merge` or `git push … main` and blocks it (exit 2) unless `npm run check:web` passes. Never bypass it (no `--no-verify`, no disabling hooks); if it blocks, fix the cause. CI runs the same checks on every PR (`.github/workflows/web-features.yml`).

## Workflow
- Read the matching guide in `node_modules/next/dist/docs/` before using a Next.js API you haven't verified in this codebase — this is Next.js 16.4 with `cacheComponents`.
- Edit the specific view/hook file listed in AGENTS.md Section 2 rather than growing `app/page.js`.
- Verify UI changes in the browser preview at mobile width (the app is a 480px mobile-first layout).
- Never commit `.env.local` or print its secret values.
- Pushing to `main` deploys to Vercel; work on a branch unless told otherwise.
