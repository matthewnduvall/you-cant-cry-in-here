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
  * **Database & Auth:** Supabase (`supabase_schema.sql` in repo root defines `user_profiles`, `workout_history`, `routines`, `friendships`, and `friend_invites` with Row-Level Security, plus the friendship functions/triggers; safe to re-run). One-time data migrations live in `supabase/migrations/`.
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
  * `app/components/views/OnboardingView.jsx` — `04 / ONBOARDING` 6-step paged wizard (sent to first-time users after account creation/login, with `SKIP →`, `BACK`, `NEXT`, `START →`, and the shared `OneRepMaxCalculatorModal` on Page 3).
  * `app/components/views/InfoView.jsx` — `05 / INFO` documentation of the app's 1RM logic, automatic scheme conversions, gym/equipment & muscle group filters, and Data Policies.
  * `app/components/views/SettingsView.jsx` — `06 / SETTINGS` body metrics, stimulus thresholds, routine preferences, social sharing toggles, and data backup controls.
  * `app/components/views/AuthView.jsx` — Sign In, Sign Up (with beta code `imnotcrying` and invite banner), and Forgot Password recovery; routes new/first-time logins to `onboarding`.
* **Modals & Primitives (`app/components/`):**
  * `app/components/Modals.jsx` — `DeleteConfirmModal` (generic targets may pass `title`/`verb`/`confirmLabel`/`onConfirm`), `AddSlotModal`, `PlateCalculatorModal` (set targets may pass `onApplyCustom`), `SetValueEditorModal` (targets may pass `onApply`), `SaveConfirmModal`, `HistoricalEditConfirmModal`, and `FeedbackModal`.
  * `app/components/SlotEditor.jsx` — **The one exercise slot editor** (header with category/muscle/scheme/exercise pickers, set rows with Type/LAST/INC/CURRENT/REPS/✓/✕, add-set and action buttons). Set values are edited through the shared pop-ups via callbacks (`onEditSetValue`, `onEditWeight`, ...), so each host decides where edits are written. Used by `RoutineEditorView` and `OneRepMaxCalculatorModal`; don't build another set-row UI.
  * `app/components/OneRepMaxCalculatorModal.jsx` — 1RM calculator pop-up (SlotEditor + PR date + live `ESTIMATED 1 REP MAX` + green `CALCULATE 1RM`). Used by History Personal Records and Onboarding Page 3; hosts log the PR with `buildPersonalRecordHistoryEntry` (`workoutEngine.js`).
  * `app/components/Primitives.jsx` — `SFSymbol`, `IOSListSection`, `IOSListRow`, and `SessionRestTimerBar`.
  * `app/components/CloudSyncBanner.jsx` — Red `CLOUD SYNC FAILED: <reason>` strip + `RETRY` under the header (driven by `cloudSyncStatus` from `useCloudAndStorageSync`).
  * `app/components/Controls.jsx` — **Shared controls; use these instead of hand-styled `<button>`/`<select>`:** `Button` (`variant`: `primary`, `primary-row`, `secondary`, `dashed`, `success`, `danger`, `toggle`, `drawer`), `SegmentButton` (segmented choices in a shared-border grid; `activeColor` `accent`/`ink`), `DeleteButton` (red ✕; `solid` for list rows, `outline` + `fill` for editor rows), `CloseButton` (orange modal ✕), `DragNumberBadge` (grippy drag handle), and `GymSelect` (`variant`: `field`, `cell`, `tile`). Pass `style` only for one-off sizing.
  * `app/styles/kineticTokens.js` — `IOS_DARK`, `KINETIC_CSS`, `UI` style tokens, and the shared-border tokens `SHARED_CELL_BORDER` / `SHARED_GROUP_OUTER` (import these; don't redefine them per file).
* **Utilities, Data & API (`app/utils/`, `app/data/`, `app/api/`):**
  * `app/data/exerciseLibrary.js` — Exercise catalog, schemes (`5x5`, `5x8`, `5x8w`, `Pyramid`, `Pyramid 1RM`, `Drop Sets`), equipment filters, and ExRx tables.
  * `app/utils/workoutEngine.js` — 1RM math (`getBestHistory1RM`, `getPersonalRecord1RM`, `getHistoricalCalculated1RM`, `calculateLastEquivalentWeightForSet`, `createWorkoutSlot`).
  * `app/utils/supabaseAuth.js` — Supabase Auth, cloud state sync, and the social API (`syncFriendshipsForUser`, `sendFriendRequestToAthlete`, `acceptFriendRequestFromAthlete`, `removeFriendshipWithAthlete`, `searchAthletesByQuery`, `fetchAthleteProfileSnapshot`), all as the signed-in user so RLS applies.
  * `app/utils/storageMigration.js` — Schema V3 local storage hydration and migration.
  * `app/utils/cloudSyncLedger.js` — Per-account record (`yccih_cloud_sync_ledger_v1`) of History workouts confirmed on the server (`synced`: id → `workoutSyncSignature`) and deletes not yet sent (`deleted`).
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
  * **Gym/Equipment Swap (`handleChangeGymSelection`):** Changing the `GYMS/EQUIPMENT` dropdown in the session/routine editor swaps every slot with no completed sets to its closest equivalent for that equipment (`findEquivalentExerciseForGym`, e.g. Barbell Bench Press → Dumbbell Bench Press). Weights come from the new exercise's history + increment, else the old 1RM converted by `convertEquivalent1RM` (dumbbell ≈ 0.65× barbell), stored on the slot as `estimated1RMs` so repeated swaps don't drift.
  * **Muscle Group Filters:** Includes an umbrella **`Legs`** filter matching all lower-body exercises (Thighs, Hips, Calves, Quadriceps, Hamstrings, Glutes, Adductors, Abductors).
* **Save Confirmation Modal (`SaveConfirmModal`):**
  * Clicking `SAVE` opens a confirmation popup to confirm the workout/routine name and whether to share it with friends.

### C. History & Personal Records (`HistoryView.jsx` & `usePlateCalculator.js`)
* **Personal Records Section (Placed Above History):**
  * **Core 4 Default Exercises (`CORE_PR_EXERCISE_IDS`):** Defaults to **Barbell Bench Press**, **Barbell Back Squat**, **Barbell Deadlift**, and **Barbell Military Overhead Press** (synced with Onboarding Page 3 of 6). Chin-ups/pull-ups are not defaults; they are bodyweight exercises (`ex.isBodyweight`, set from `computeIsBodyweight` in `exerciseLibrary.js`), plus any user-added exercises (`customPrExerciseIds`). Never auto-populate `Object.keys(oneRepMaxes)` into the displayed list.
  * **Strictly `TBD` Until Logged in History:** `getPersonalRecord1RM` derives Personal Records strictly from logged `history` (`getBestHistory1RM`). Unlogged exercises always show **`TBD ✎`** in red (`#FF3B30`).
  * **Logging PRs to History:** Entering a PR via `PlateCalculatorModal` (`mode: 'pr'`) or via the **`CALCULATE`** popup always creates a `PERSONAL RECORD` entry in `history` (using `prRecordDate` or today's date).
  * **`CALCULATE` Popup Interface:** Uses the same exercise slot editor interface as the New/Current Session page, replacing the `"RECALCULATE"` button with a bright green (`#30D158`) **`"CALCULATE 1RM"`** button.
* **History Section:**
  * Displays the **last 10 sessions** initially, with a **`SEE ALL (<TOTAL>)`** button at the bottom that paginates in pages of **100**.
  * Each History row has an expand indicator (`+` / `−`) and a **Red Delete (`✕`) button** (`type: 'history_workout'`) next to it.
  * Expanding a History entry renders the full `RoutineEditorView` inline; editing any field triggers `HistoricalEditConfirmModal` once per session before mutating historical data.

### D. Social Invites, Friend Profiles & Feedback
* **Friendships (single source of truth: `public.friendships`):**
  * A friend is an `accepted` friendships row (either direction) keyed by Supabase account ids. RLS lets an athlete read a profile, workout history, or shared routines only if they own it or are accepted friends with the owner (`are_friends`). Never add another friendship source (local stores, settings lists, name matching).
  * Removing a friend (red `✕` on Social, confirmed via `DeleteConfirmModal`) deletes the row, which revokes access **both ways**; the other athlete's app drops the cached friend on its next sync (`applyFriendshipSync`), and an open friend profile shows `PROFILE UNAVAILABLE`.
  * Requests: search → `+ ADD FRIEND` inserts a `pending` row; only the recipient can accept (UPDATE policy) or decline (`✕`, deletes the row). Requesting someone who already requested you accepts theirs.
  * Search (`search_athletes` RPC, signed-in only): partial username or exact email; returns id + username only (never emails or stats).
  * Default friend: a database trigger (`handle_new_profile_friendships`) makes every new account friends with `@matt` (matthew.n.duvall@gmail.com) and with anyone who emailed them an invite. Nothing re-adds a removed friend.
  * Match friend records with `isSameFriend` (account id only). The local `friendsList` is just a cache of the server list and is cleared on sign-out.
* **Email Invites (`SocialView.jsx` → `/api/invite`):**
  * The inviter must be signed in; the route verifies their Supabase session and records `friend_invites` as them (RLS: `inviter_user_id = auth.uid()`), then emails the beta code **`imnotcrying`** and a join link (`/?invite_from=<username>&invited_email=<target>&beta_code=imnotcrying`).
  * New accounts are friended by the trigger above; existing accounts claim invites to their verified email on their next sync (`claim_my_invites`).
* **Friend Profiles (`ProfileView.jsx`):**
  * Never display a friend's email address—only display `@<username>`.
  * PRs load from the friend's `user_profiles` row + `workout_history` by account id (`fetchAthleteProfileSnapshot`); RLS returns nothing once the friendship is removed.
  * Profile PR lists show the top 10 (heaviest first) with a `SEE ALL (<N>)` toggle.
* **Footer:** Every view renders `Copyright © 2026 MaNoDuV LLC` at the bottom of the app column (`app/page.js`).
* **Feedback Delivery (`FeedbackModal` & `app/api/feedback/route.js`):**
  * Prompts `ENTER YOUR FEEDBACK BELOW. IT WILL BE AUTOMATICALLY SENT WITH DIAGNOSTIC LOGS FROM THIS SESSION (<N> LOG EVENTS).`
  * Sends via `/api/feedback` + client-side `formsubmit.co/ajax/matthew.n.duvall@gmail.com`, and automatically triggers a pre-filled `mailto:matthew.n.duvall@gmail.com` fallback if active delivery is not confirmed.

### F. Cloud Sync (`useCloudAndStorageSync.js` + `supabaseAuth.js`)
* **`workout_history` is the source of truth for History.** A new device or iOS home-screen app (which gets its own empty storage) shows only what is in that table.
* **Pull** (sign-in, startup, `RETRY`, app returning to the foreground, network back online; at most every 30s): retries queued deletes, then merges. A workout the ledger marked `synced` that is missing from the server was deleted elsewhere and is removed locally; unconfirmed local workouts are kept and uploaded. Uploads are held until the pull finishes.
* **Push** (debounced after every change): uploads only workouts that are new or changed since confirmed (signature mismatch), in batches of 25; a rejected batch is retried row by row so one bad workout can't block the rest. Returns `{ ok, error, syncedWorkoutIds, failedWorkoutCount }`.
* **Deleting** a History session deletes its `workout_history` row; until that succeeds the id stays queued in the ledger.
* **Never store app state in auth `user_metadata`.** Supabase embeds it in every access token; older builds did (`yccih_cloud_state_v3`), which bloated tokens. `supabase/migrations/2026-11-08_move_metadata_snapshots.sql` moves those workouts into `workout_history` and strips the key, and the `strip_app_state_from_user_metadata` trigger on `auth.users` (also in `supabase_schema.sql`) drops it on every write so outdated clients can't re-add it.
* **An unrecognised token reads as signed-out:** PostgREST answers it with 200 + no rows, not 401. The pull therefore treats a missing own `user_profiles` row as a session error rather than an empty account.
* Failures are never silent: `cloudSyncStatus` (`idle`/`syncing`/`ok`/`error`) drives `CloudSyncBanner`.

### E. Authentication & Beta Access
* Beta sign-up requires the beta tester code: **`imnotcrying`** (case-insensitive). This is only checked in the browser today.
* **Never store passwords.** Sessions are Supabase access + refresh tokens (`yccih_supabase_tokens_v1`); `getValidSupabaseAccessToken` refreshes using the JWT `exp` and never re-sends a password. A rejected refresh token clears the tokens and dispatches `SESSION_EXPIRED_EVENT`, which signs the athlete out on that device (local workout data stays).
* The local account registry (`yccih_registered_accounts_v1`) holds only id/username/email; `purgeLegacyStoredPasswords` deletes passwords saved by older builds at startup. Only offline/dev mode (no Supabase env) keeps a salted SHA-256 hash.
* Sign-out goes through `signOutUser` (revokes the session with Supabase and clears tokens).
* **Delete account** (Profile, next to SIGN OUT, confirmed via `DeleteConfirmModal`): `deleteMyAccount` calls the `delete_my_account` RPC, which deletes the athlete's invites (sent and received), friendships, workout history, routines, profile and `auth.users` row; then `handleDeleteAccount` erases this account's data from the device and resets the app. Any new table holding user data must be added to that function.
* Sign-up with email confirmation enabled does not sign in; the athlete confirms, then signs in. Password resets use the Supabase email recovery link only (its access + refresh tokens sign the athlete in after setting the new password).
