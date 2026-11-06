<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# AGENTS.md — Project Context & Rules for "You Can't Cry in Here"

> **Note for Antigravity Agent:** This file contains the complete product, design, architectural, and domain context for *You Can't Cry in Here*. Always follow these rules and target the specific modular files listed in Section 2 when making edits.

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
  * `app/page.js` — Top-level state wiring, view router, and modal mounts (~640 lines).
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
  * `app/components/views/RoutinesView.jsx` — Routine browser (`CANCEL` button at top, Default, Saved, Shared, and Friends' routines).
  * `app/components/views/GymsView.jsx` — `GymsView` and `GymEditorView` for equipment presets and custom gyms.
  * `app/components/views/GoalsView.jsx` — Primary training goal (`Strength`, `Hypertrophy`, `Maintain`), progression increments, and ExRx.net standards.
  * `app/components/views/ProgressionChartView.jsx` — SVG progression chart for Big 3 + OHP (Weight vs. Volume).
  * `app/components/views/StimulusMapView.jsx` — Anterior/Posterior SVG muscle stimulus diagram and telemetry list.
  * `app/components/views/LeaderboardView.jsx` — `BIG 3 TOTAL`, `BIG 3 NORMALIZED` (`Total / BW` literal ratio + averaged Big 3 standing), and `MOST IMPROVED` (`Delta(High - Low) / BW` literal ratio) leaderboards.
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

---

## 3. Critical Next.js 16 & Environment Rules
1. **No Unstable `Date.now()` in Client Prerender:** Because Next.js 16 `cacheComponents` is enabled, **never** call `Date.now()` directly inside a `useMemo` or top-level render body of a `'use client'` component. Always read `Date.now()` inside a `useEffect` (e.g., `stimulusNowMs`) or event handler.
2. **Do Not Run `npm run build` in the Sandboxed Terminal:** On Windows, Antigravity's terminal sandbox blocks Next.js 16 Turbopack worker sockets from spawning. Make code edits directly and let the user run `npm run dev` / `npm run build` in their external PowerShell window unless terminal sandbox permissions are disabled.

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
  * **Mobile-First Viewport:** Centered `480px` max-width container with `2px solid #5C5C5C` left/right borders.

---

## 5. Core Features & Domain Logic Decisions

### A. Home Screen, Header & Navigation
* **3 Primary Action Buttons on Home Screen (Single-line, Centered, Equal Size):**
  1. **`NEW SESSION →` / `CURRENT SESSION →`**: Shows `CURRENT SESSION →` **only** when `activeSession?.slots?.length > 0`; otherwise shows `NEW SESSION →`. Saving a session clears `activeSession`.
  2. **`AUTO SESSION`**: Immediately generates a full workout using `routinePreferences` and `selectedGymId`, and opens straight into `session` view.
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
  * Schemes include `5x5`, `5x8`, `5x8w`, `Pyramid`, **`Pyramid 1RM`** (last set is `1 Rep Max`, preceding sets are `Warmup`s ramping from $50\%$ to $85\%$ of 1RM), and `Drop Sets`.
* **Save Confirmation Modal (`SaveConfirmModal`):**
  * Clicking `SAVE` opens a confirmation popup to confirm the workout/routine name and whether to share it with friends.

### C. History & Personal Records (`HistoryView.jsx` & `usePlateCalculator.js`)
* **Personal Records Section (Placed Above History):**
  * Defaults to **`TBD`** until a user logs a workout containing that exercise or manually overrides the PR.
  * Automatically updates from the **highest calculated 1RM** across all logged History entries (`getPersonalRecord1RM`).
  * Tapping a PR opens `PlateCalculatorModal` (`mode: 'pr'`), which includes an optional **`RECORD DATE`** picker; entering a date creates an individual History entry just for that Personal Record.
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
