<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# AGENTS.md — Project Context & Rules for "You Can't Cry in Here"

> **Note for coding agents (Claude Code, etc.):** This file contains the complete product, design, architectural, and domain context for *You Can't Cry in Here*. Always follow these rules and target the specific modular files listed in Section 2 when making edits.

---

## 1. Project Overview & Tech Stack
* **App Name:** *You Can't Cry in Here*
* **Framework:** Next.js 16.4+ (App Router, Turbopack, `cacheComponents: true` & `partialPrefetching: true` enabled in `next.config.mjs`).
* **Hosting & Backend:**
  * **Frontend Hosting:** Vercel (linked to GitHub repo `matthewnduvall/you-cant-cry-in-here`).
  * **Database & Auth:** Supabase (`supabase_schema.sql` in repo root defines `user_profiles`, `workout_history`, `routines`, and `friendships` with Row-Level Security).
  * **Local Persistence:** Update-resilient `localStorage` engine (`yccih_app_state_v3`, Schema Version 3) with debounced 300ms auto-save and `.json` backup export/import.

---

## 2. Modular File Architecture (Read/Edit Only the Target File)
To keep agent edits fast and focused, views and state hooks are split into dedicated files:

* **App Shell & Header:**
  * `app/page.js` — Top-level state wiring, view router, and modal mounts (~900 lines).
  * `app/components/AppHeaderAndDrawer.jsx` — Sticky top navigation bar (Menu `☰`, title, `FEEDBACK` button, `SessionRestTimerBar`) and slide-out Hamburger Drawer.
* **Custom State & Domain Hooks (`app/hooks/`):**
  * `app/hooks/useCloudAndStorageSync.js` — `localStorage` hydration, password recovery hash & email invite URL param detection (`?invite_from=...&beta_code=imnotcrying`), Supabase cloud pull/push, automatic invite-to-friend resolution, and `.json` backup export/import/reset.
  * `app/hooks/useWorkoutMutations.js` — Workout/slot/set creation, auto workout generation, routine loading, drag-and-drop reordering, weight recalculation, saving, and deleting.
  * `app/hooks/usePlateCalculator.js` — Plate & Weight Calculator modal state and handlers for set weights, Personal Records (with optional `prRecordDate` that logs an individual History entry), and custom goal weights.
  * `app/hooks/useTelemetryAndAnalytics.js` — Computes `effectiveOneRepMaxes` (highest calculated 1RM from History + manual overrides), `muscleStimulusStatus`, and `progressionSeriesByLift`.
* **Individual Screen Views (`app/components/views/`):**
  * `app/components/views/HomeView.jsx` — Home screen (`NEW SESSION` / `CURRENT SESSION`, `AUTO SESSION`, `HISTORY`, telemetry tiles, single-entry-per-friend social scroller).
  * `app/components/views/RoutineEditorView.jsx` — Active workout session, routine editor, historical entry editor, and embedded History session editor.
  * `app/components/views/HistoryView.jsx` — `PERSONAL RECORDS` section (top) and paginated `HISTORY` list (initial 10 sessions + `SEE ALL` in pages of 100, inline expand `+`/`−` and red `✕` delete button).
  * `app/components/views/RoutinesView.jsx` — Routine browser (subdued red `CANCEL` button at top, Default, Saved, Shared, and Friends' routines).
  * `app/components/views/GymsView.jsx` — `GymsView` and `GymEditorView` for equipment presets and custom gyms.
  * `app/components/views/GoalsView.jsx` — Primary training goal (`Strength`, `Hypertrophy`, `Maintain`), progression increments (barbell lifts × 2), single-line ExRx.net standards (`<Exercise> | <X LB FROM GOAL> | GOAL: <W> LB ✎`), and `+ ADD EXERCISE` custom goals button.
  * `app/components/views/ProgressionChartView.jsx` — `PROGRESS` SVG chart (`1 REP MAX` vs. `VOLUME`) with `ALL`, `BENCH`, `SQUAT`, `DEAD`, and `CUSTOM` (any exercise) filters, plus `<X LB FROM GOAL>` summary rows.
  * `app/components/views/StimulusMapView.jsx` — `STIMULUS` Anterior/Posterior SVG muscle stimulus diagram and telemetry list.
  * `app/components/views/LeaderboardView.jsx` — `BIG 3 TOTAL`, `BIG 3 NORMALIZED` (`Total / BW` literal ratio + averaged Big 3 standing), `OVERHEAD PRESS NORMALIZED` (`OHP / BW`), and `MOST IMPROVED` (`Delta(High - Low) / BW` literal ratio) leaderboards.
  * `app/components/views/SocialView.jsx` — `INVITE FRIEND VIA EMAIL` (prompts email with beta code `imnotcrying` and join link), `PENDING EMAIL INVITES`, athlete search, incoming requests, and friends list.
  * `app/components/views/ProfileView.jsx` — User & Friend profile view (friend profiles hide email addresses and only show `@username`, PRs, and shared routines).
  * `app/components/views/OnboardingView.jsx` — `04 / ONBOARDING` 6-step paged wizard (sent to first-time users after account creation/login, with `SKIP →`, `BACK`, `NEXT`, `START →`, and a 1RM Scheme/Sets/Reps Converter popup on Page 3).
  * `app/components/views/InfoView.jsx` — `05 / INFO` documentation of the app's 1RM logic, automatic scheme conversions, gym/equipment & muscle group filters, and Data Policies.
  * `app/components/views/SettingsView.jsx` — `06 / SETTINGS` body metrics, stimulus thresholds, routine preferences, social sharing toggles, and data backup controls.
  * `app/components/views/AuthView.jsx` — Sign In, Sign Up (with beta code `imnotcrying` and invite banner), and Forgot Password recovery; routes new/first-time logins to `onboarding`.
* **Modals & Primitives (`app/components/`):**
  * `app/components/Modals.jsx` — `DeleteConfirmModal`, `AddSlotModal`, `PlateCalculatorModal`, `SetValueEditorModal`, `SaveConfirmModal`, `HistoricalEditConfirmModal`, and `FeedbackModal`.
  * `app/components/Primitives.jsx` — `SFSymbol`, `IOSListSection`, `IOSListRow`, and `SessionRestTimerBar`.
* **Utilities, Data & API (`app/utils/`, `app/data/`, `app/api/`):**
  * `app/data/exerciseLibrary.js` — Exercise catalog, schemes (`5x5`, `5x8`, `5x8w`, `Pyramid`, `Pyramid 1RM`, `Drop Sets`), equipment filters, and ExRx tables.
  * `app/utils/workoutEngine.js` — 1RM math (`getBestHistory1RM`, `getPersonalRecord1RM`, `getHistoricalCalculated1RM`, `calculateLastEquivalentWeightForSet`, `createWorkoutSlot`).
  * `app/utils/supabaseAuth.js` — Supabase Auth, cloud state sync, and `resolveInviteFriendshipsForUser`.
  * `app/utils/storageMigration.js` — Schema V3 local storage hydration and migration.
  * `app/api/feedback/route.js` — Serverless endpoint for sending user feedback + session logs to `matthew.n.duvall@gmail.com`.
  * `app/api/invite/route.js` — Server-sent email invites via Resend (`RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`); setup steps in `EMAIL_INVITE_SETUP.md`.
  * `app/data/exercises.csv` + `app/data/csvRawLoader.cjs` — Raw exercise data, imported as a string via the custom Turbopack `*.csv` rule in `next.config.mjs`.
  * `app/styles/kineticTokens.js` — `IOS_DARK` palette and `KINETIC_CSS` global style string.
* **Environment (`.env.local`, gitignored):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`.

---

## 3. Critical Next.js 16 & Environment Rules
1. **No Unstable `Date.now()` in Client Prerender:** Because Next.js 16 `cacheComponents` is enabled, **never** call `Date.now()` directly inside a `useMemo` or top-level render body of a `'use client'` component. Always read `Date.now()` inside a `useEffect` (e.g., `stimulusNowMs`) or event handler.
2. **Verifying Changes:** Run `npm run lint` after edits. `npm run build` is the full check (it surfaces prerender errors like the `Date.now()` rule above). If a sandboxed terminal blocks Turbopack worker sockets on Windows, ask the user to run the command in their own PowerShell window instead.

---

## 4. Visual & UI Design System ("Kinetic Brutalist / iOS 18 Dark")
* **Color Palette (`IOS_DARK` & CSS Variables):**
  * Ground / Background: `#101010` (`--dp-color-ground`)
  * Secondary Surface: `#141414` / `#161616`
  * Primary Ink / Text: `#FFFFFF` (`--dp-color-ink`)
  * Secondary Label: `#A0A0A0`
  * Accent Orange: `#FF6B00` (`--dp-color-accent`)
  * Structural Rule / Border: `#5C5C5C` (`--dp-color-rule`), always `2px solid`
  * Semantic Status Colors: Green `#30D158`, Yellow `#FFD60A`, Red `#FF3B30`
* **Typography & Geometry:**
  * Font Family: `"Host Grotesk"`, uppercase headers, `fontWeight: 800`, tight tracking (`-0.03em` to `-0.045em`).
  * **Zero Border Radius:** Every element enforces `border-radius: 0px !important` (sharp brutalist edges).
  * **Zero-Gap Shared Borders (`SHARED_GROUP_OUTER` & `SHARED_CELL_BORDER`):** Adjacent buttons, inputs, and rows sit flush against one another (`gap: 0`) sharing single `1px solid var(--dp-color-rule)` edges (`borderTop`/`borderLeft` on the outer group, `borderRight`/`borderBottom` on each cell) without extra bounding boxes or gaps.
  * **Mobile-First Viewport:** Centered `480px` max-width container with `2px solid #5C5C5C` left/right borders.

---

## 5. Core Features & Domain Logic Decisions

### A. Home Screen, Header & Navigation
* **3 Primary Action Buttons on Home Screen (Single-line, Centered, Equal Size):**
  1. **`NEW SESSION →` / `CURRENT SESSION →`**: Shows `CURRENT SESSION →` **only** when `activeSession?.slots?.length > 0`; otherwise shows `NEW SESSION →`. Saving a session clears `activeSession`.
  2. **`AUTO SESSION`**: White text (`#FFFFFF`) on orange background; immediately generates a full workout using `routinePreferences` and `selectedGymId`, and opens straight into `session` view.
  3. **`HISTORY ↗`**: Opens the `HistoryView` (Personal Records on top, logged History below).
* **Social Scroller on Home Screen:**
  * Limits scrolling entries to a **single most-recent entry per friend user** across Squat, Bench, and Deadlift.
* **Top Header (`AppHeaderAndDrawer`):**
  * Left: Hamburger Menu button (`☰`). Center: `You Can't Cry in Here` home link (when not on Home). Right: **`FEEDBACK`** button (`FeedbackModal`).
* **Sticky Rest Timer Bar (`SessionRestTimerBar`):**
  * Left box: `REST 1:00 / 1:30 / 2:00 / 3:00` selector; turns into a live **Red Countdown Timer (`#FF3B30`)** when any set is marked complete.
  * Right orange box (`var(--dp-color-accent)`): Fixed height (`56px`) across blank and populated sessions so layout never jumps.

### B. Routine Editor & Workout Slots (`RoutineEditorView.jsx`)
* **Top Action Row (3 Equal Dual-Line Columns):**
  1. `GYMS/EQUIPMENT` (top) / `<ACTIVE SELECTION>` (bottom, defaults to user's setting).
  2. `ROUTINES` (top) / `LOAD ↗` (bottom).
  3. `ROUTINES` (top) / `AUTO` (bottom, no lightning icon).
* **Always-Expanded Workout Slots & Grippy Drag Handles:**
  * Slots are never collapsed; exercise and set number badges display **grippy dot patterns** (`GrippyDotGrid`) and support drag-and-drop / touch reordering.
  * Row 1 has 3 columns (`Category`, `Muscle Group`, `Scheme`) + right-aligned Red Delete (`✕`).
  * Row 2 Exercise Selection dropdown spans all 3 columns so its right edge aligns flush with the `Scheme` box above it.
  * Auto-completed and loaded routines populate `muscleGroupFilter` accurately based on the selected exercise.
  * Schemes include `5x5`, `5x8`, `8x8`, `Pyramid`, **`Pyramid 1RM`** (last set is `1 Rep Max`, preceding sets are `Warmup`s ramping from $50\%$ to $85\%$ of 1RM), and `Reverse Pyramid`.
  * **Barbell Increment Multiplier:** When set to a barbell exercise (`equipment === 'Barbell'`), the progression increment is automatically multiplied by `2` (`getEffectiveIncrementForExercise`).
  * **Smart `RECALCULATE` Priority:** Ignores completed sets (`st.completed`). Prioritizes the last-edited field (`weight` adjusts reps; `reps` adjusts weight). If the final set is edited (e.g., changed to `1 Rep Max`), adjusts both weights and reps across incomplete sets so the final set is achievable (matching `Pyramid 1RM` when the last set is `1 Rep Max`).
  * **Muscle Group Filters:** Includes an umbrella **`Legs`** filter matching all lower-body exercises (Thighs, Hips, Calves, Quadriceps, Hamstrings, Glutes, Adductors, Abductors).
* **Save Confirmation Modal (`SaveConfirmModal`):**
  * Clicking `SAVE` opens a confirmation popup to confirm the workout/routine name and whether to share it with friends.

### C. History & Personal Records (`HistoryView.jsx` & `usePlateCalculator.js`)
* **Personal Records Section (Placed Above History):**
  * **Core 5 Default Exercises (`CORE_PR_EXERCISE_IDS`):** Defaults to **Barbell Bench Press**, **Barbell Back Squat**, **Barbell Deadlift**, **Barbell Military Overhead Press**, and **Chin-Up / Pull-Up** (synced with Onboarding Page 3 of 6), plus any user-added exercises (`customPrExerciseIds`). Never auto-populate `Object.keys(oneRepMaxes)` into the displayed list.
  * **Strictly `TBD` Until Logged in History:** `getPersonalRecord1RM` derives Personal Records strictly from logged `history` (`getBestHistory1RM`). Unlogged exercises always show **`TBD ✎`** in red (`#FF3B30`).
  * **Logging PRs to History:** Entering a PR via `PlateCalculatorModal` (`mode: 'pr'`) or via the **`CALCULATE`** popup always creates a `PERSONAL RECORD` entry in `history` (using `prRecordDate` or today's date).
  * **`CALCULATE` Popup Interface:** Uses the same exercise slot editor interface as the New/Current Session page, replacing the `"RECALCULATE"` button with a bright green (`#30D158`) **`"CALCULATE 1RM"`** button.
* **History Section:**
  * Displays the **last 10 sessions** initially, with a **`SEE ALL (<TOTAL>)`** button at the bottom that paginates in pages of **100**.
  * Each History row has an expand indicator (`+` / `−`) and a **Red Delete (`✕`) button** (`type: 'history_workout'`) next to it.
  * Expanding a History entry renders the full `RoutineEditorView` inline; editing any field triggers `HistoricalEditConfirmModal` once per session before mutating historical data.

### D. Social Invites, Friend Profiles & Feedback
* **Email Invites with Auto-Friendship (`SocialView.jsx` & `supabaseAuth.js`):**
  * Under Social, users can enter an email address and click **`INVITE VIA EMAIL ↗`**, which prompts an email containing the beta code **`imnotcrying`** and a join link (`/?invite_from=<username>&invite_from_email=<email>&invited_email=<target>&beta_code=imnotcrying`).
  * When the invited user joins, both users automatically become friends.
* **Friend Profiles (`ProfileView.jsx`):**
  * Never display a friend's email address—only display `@<username>`.
* **Feedback Delivery (`FeedbackModal` & `app/api/feedback/route.js`):**
  * Prompts `ENTER YOUR FEEDBACK BELOW. IT WILL BE AUTOMATICALLY SENT WITH DIAGNOSTIC LOGS FROM THIS SESSION (<N> LOG EVENTS).`
  * Sends via `/api/feedback` + client-side `formsubmit.co/ajax/matthew.n.duvall@gmail.com`, and automatically triggers a pre-filled `mailto:matthew.n.duvall@gmail.com` fallback if active delivery is not confirmed.

### E. Authentication & Beta Access
* Beta sign-up requires the beta tester code: **`imnotcrying`** (case-insensitive).
