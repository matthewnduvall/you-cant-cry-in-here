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
  * **Database & Auth:** Supabase (`supabase_schema.sql` in repo root defines `user_profiles`, `workout_history`, `routines`, `friendships`, `friend_invites`, and `shared_sessions` with Row-Level Security, plus the friendship functions/triggers; safe to re-run). One-time data migrations live in `supabase/migrations/`.
  * **Local Persistence:** Update-resilient `localStorage` engine (`yccih_app_state_v3`, Schema Version 3) with debounced 300ms auto-save and `.json` backup export/import.

---

## 2. Modular File Architecture (Read/Edit Only the Target File)
To keep agent edits fast and focused, views and state hooks are split into dedicated files:

* **App Shell & Header:**
  * `app/page.js` — Top-level state wiring, view router, and modal mounts (~900 lines).
  * `app/components/AppHeaderAndDrawer.jsx` — Sticky top navigation bar (Menu `☰`, title, `FEEDBACK` button; in the session/routine editor also `SessionTitleBar` — session name + green `SAVE` + red `RESET` — and `SessionRestTimerBar` flush beneath it) and slide-out Hamburger Drawer.
* **Custom State & Domain Hooks (`app/hooks/`):**
  * `app/hooks/useCloudAndStorageSync.js` — `localStorage` hydration, password recovery hash & email invite URL param detection (`?invite_from=...&beta_code=imnotcrying`), Supabase cloud pull/push, automatic invite-to-friend resolution, and `.json` backup export/import/reset.
  * `app/hooks/useWorkoutMutations.js` — Workout/slot/set creation, auto workout generation (`handleAutoBuildWorkout` for AUTO SESSION, `handleAddAutoSlot` for `+ ADD EXERCISE`), routine loading, drag-and-drop reordering, weight recalculation, saving, and deleting.
  * `app/hooks/usePlateCalculator.js` — Plate & Weight Calculator modal state (plates only; no DIRECT TOTAL mode — tap `TOTAL WEIGHT ✎` to type a number, which re-splits into plates and keeps the typed value if plates can't match it; dumbbell/kettlebell exercises add picked weights directly with no bar and no ×2; the EZ bar counts as 17 lb, other bars 45 lb) and handlers for set weights, Personal Records (with optional `prRecordDate` that logs an individual History entry), and custom goal weights.
  * `app/hooks/useSessionSync.js` — Live session sync with a friend: invites (polled every 10 s), accept/decline, pulling the partner's structure every 3 s while synced, pushing own structural edits 0.7 s after they happen (latest edit wins, compared by `updated_at`), and ending the sync on UNSYNC / RESET / save. The shared session is marked by `activeSession.syncId` (+ `syncPartnerId`, `syncPartnerName`).
  * `app/hooks/useTelemetryAndAnalytics.js` — Computes `effectiveOneRepMaxes` (highest calculated 1RM from History + manual overrides), `muscleStimulusStatus`, and `progressionSeriesByLift`.
* **Individual Screen Views (`app/components/views/`):**
  * `app/components/views/HomeView.jsx` — Home screen (`NEW SESSION` / `CURRENT SESSION`, `AUTO SESSION`, telemetry tiles — `PROGRESS` opens the combined Progress/History page — and the single-entry-per-friend social scroller).
  * `app/components/views/RoutineEditorView.jsx` — Active workout session, routine editor, historical entry editor, and embedded History session editor.
  * `app/components/views/HistoryView.jsx` — The **PROGRESS page**'s `PERSONAL RECORDS` and `HISTORY` tabs (prop `section`: `'records'` | `'history'`). The PROGRESS page (view id `'history'`) has a `TabBar` — `PROGRESS` (chart) / `PERSONAL RECORDS` / `HISTORY` — whose choice lives in `page.js` (`progressTabChoice`); an open History workout (`expandedHistoryWorkoutId`, e.g. from the 1RM box's PR link) always shows the HISTORY tab, and leaving that tab closes it. The HISTORY tab starts with `HistoryExerciseFilter` (`app/components/HistoryExerciseFilter.jsx`: the slot editor's SEARCH / TYPE / MUSCLE + EQUIPMENT / EXERCISE layout over the exercises logged in History; search picks an exercise and fills its filters), then `LAST DONE: <date> • N OF M SESSIONS` + `CLEAR` and, with one exercise picked, `N SETS • TOP W LB × R` on each row; then the paginated list (initial 10 sessions + `SEE ALL` in pages of 100, inline expand `+`/`−` and red `✕` delete button).
  * `app/components/views/RoutinesView.jsx` — Routine browser (subdued red `CANCEL` button at top, Default, Saved, Shared, and Friends' routines).
  * `app/components/views/GymsView.jsx` — `GymsView` and `GymEditorView` for equipment presets and custom gyms.
  * `app/components/views/GoalsView.jsx` — Primary training goal (`Strength`, `Hypertrophy`, `Maintain`), progression increments (barbell lifts × 2), single-line ExRx.net standards (`<Exercise> | <X LB FROM GOAL> | GOAL: <W> LB ✎`), and `+ ADD EXERCISE` custom goals button.
  * `app/components/views/ProgressionChartView.jsx` — The PROGRESS page's `PROGRESS` tab: SVG chart (`1 REP MAX` vs. `VOLUME`, time frame defaults to `30 DAYS`) with multi-select lift toggles `BENCH`, `SQUAT`, `DEAD`, `OHP` (all on by default, `DEFAULT_CHART_LIFTS`) and `CUSTOM` (any exercise; each toggle is underlined in its line colour), plus `<X LB FROM GOAL>` summary rows.
  * `app/components/views/StimulusMapView.jsx` — `STIMULUS` Anterior/Posterior SVG muscle stimulus diagram and telemetry list. Status labels (from `useTelemetryAndAnalytics`, also used in Settings → STIMULUS): green `RECOVERING` (solid), yellow `RECOVERED` (dotted), red `OVERDUE` (striped), or grey `UNLOGGED` (`UNLOGGED_STIMULUS_COLOR`). The legend is a vertical list (swatch | status | days) without the pattern words. The map, legend and list carry the pattern as well as the colour (`MuscleRect`, `statusPattern`) so status never depends on telling red from green.
  * `app/components/views/LeaderboardView.jsx` — `BIG 3 TOTAL`, `BIG 3 NORMALIZED` (`Total / BW` literal ratio + averaged Big 3 standing), `OVERHEAD PRESS NORMALIZED` (`OHP / BW`), and `MOST IMPROVED` (`Delta(High - Low) / BW` literal ratio) leaderboards, one per tab (`TabBar`: `BIG 3 TOTAL` / `BIG 3 / BW` / `OHP / BW` / `MOST IMPROVED`).
  * `app/components/views/SocialView.jsx` — `FIND ATHLETES` search — a 52 px search bar straight under the heading, no surrounding box or help text; results/invite feedback appear in a list box below it (username or exact email; when an email matches no athlete the button turns into a green `SEND INVITE` that emails the beta code `imnotcrying` and join link), incoming requests, and friends list (no footer text; `NO FRIENDS YET` when empty).
  * `app/components/views/ProfileView.jsx` — User & Friend profile view (friend profiles hide email addresses and only show `@username`, PRs, shared routines, and `@<friend>'S FRIENDS` with `REQUEST`/`ACCEPT` buttons; loaded once per friend id — `isFriend` must stay a boolean, because the profile object is replaced after each server refresh and using it as an effect dependency looped the refresh and the friends list). Your own profile keeps `SIGN OUT` at the top and `DELETE ACCOUNT` in an `ACCOUNT` section at the very bottom.
  * `app/components/views/OnboardingView.jsx` — `04 / ONBOARDING` 6-step paged wizard (sent to first-time users after account creation/login, with `SKIP →`, `BACK`, `NEXT`, `START →`, and the shared `OneRepMaxCalculatorModal` on Page 3). Every page has the same layout: header (`PAGE N OF 6` + title: BODY METRICS, GOALS & STANDARDS, PERSONAL RECORDS, EQUIPMENT & ROUTINE, PROGRESS & STIMULUS, FRIENDS, SYNC & LEADERBOARDS), one intro line (`ONBOARDING_INTRO`), then numbered sections headed with `ONBOARDING_SECTION_TITLE` (orange 14 px). Page 6 covers friends & invites, live session sync, leaderboards and feedback.
  * `app/components/views/InfoView.jsx` — `05 / INFO` documentation of the app's 1RM logic, automatic scheme conversions, gym/equipment & muscle group filters, and Data Policies.
  * `app/components/views/SettingsView.jsx` — `06 / SETTINGS` body metrics, stimulus thresholds, `EQUIPMENT` ON/OFF toggles (`EquipmentToggleList` → `availableEquipment`), routine preferences, social settings (`PROFILE VISIBILITY` public/private, sharing toggles), and data backup controls.
  * `app/components/views/AuthView.jsx` — Sign In, Sign Up (with beta code `imnotcrying` and invite banner), and Forgot Password recovery; routes new/first-time logins to `onboarding`.
* **Modals & Primitives (`app/components/`):**
  * `app/components/Modals.jsx` — `DeleteConfirmModal` (generic targets may pass `title`/`verb`/`confirmLabel`/`onConfirm`), `AddSlotModal`, `PlateCalculatorModal` (set targets may pass `onApplyCustom`), `SetValueEditorModal` (targets may pass `onApply`), `SaveConfirmModal`, `HistoricalEditConfirmModal`, and `FeedbackModal`.
  * `app/components/SlotEditor.jsx` — **The one exercise slot editor** (header row 1: `SEARCH` / type / muscle group; row 2: scheme / equipment / exercise, full width, on one five-column grid sized to content (`HEADER_GRID_COLUMNS`: ≈ 95/102/108 px and 80/100/125 px at phone width; long schemes shortened via `SCHEME_SHORT_LABELS`) — no header ✕. A **superset is two complete pickers** (A and B, each with its own search, type (Compound/Accessory), muscle group, equipment, exercise and scheme) whose sets interleave A1, B1, A2…; the slot stores `supersetCategories`, `supersetMuscleFilters` and `supersetSchemes` (`getSupersetSchemes` in `workoutEngine.js`), changes carry `supersetHalf`, and `✕ REMOVE FROM SUPERSET` in a half's type menu sends `{ endSuperset: half }` (the other exercise stays, sets kept). `SEARCH` opens a text box with a results list (name, equipment, muscle; whole library, up to 12); picking one sets that exercise, its muscle group and its type. The equipment picker lists equipment **options**: an `"A / B"` equipment value means either works, so the exercise is listed under both A and B (`getExerciseEquipmentOptions`; `Lever / Machine` stays whole). The choice is stored per slot as `equipmentFilter` (supersets: `supersetEquipmentFilters`); changing it keeps the exercise if it allows that option (sets untouched), else jumps to the closest same-movement exercise (`findClosestExerciseInPool`). Search picks the option named in the query, by full name or first word ("landmine row" → Landmine, "ez preacher" → EZ Bar). The weight pop-up loads by the chosen option: dumbbell/kettlebell = picked weights only, EZ bar = 17 lb bar + plates per side, otherwise a 45 lb bar (`getLoadSetup` in `usePlateCalculator.js`). The exercise picker lists that option's exercises with Barbell, Dumbbell(s), EZ-Bar and Landmine (and their joining slashes) stripped from names (`stripEquipmentFromExerciseName`); names that would collide get the dropped word in brackets (`getUniqueShortExerciseNames`, e.g. "Romanian Deadlift (Landmine)"). Search still matches the full name and equipment; no 1RM readout in the header; set rows with Type/CURRENT/REPS/✓/✕ — for band exercises (equipment choice Band / Band-Assisted, `getSlotEquipmentChoice` + `isBandEquipment`) CURRENT is a `BAND` cell showing RED or PURPLE (`set.bandColor`, default Red, `BAND_COLORS`) that switches colour on tap instead of opening the weight pop-up; the next-set line reads e.g. `PURPLE BAND × 8 REPS` — (the CURRENT weight pop-up shows grey `LAST` and a four-row `1RM` box beside `TOTAL WEIGHT` — orange `PR` label, grey best logged 1RM (`getBestHistory1RMInfo`), `CURRENT` label, grey best 1RM across this exercise's sets in the session with this set at the weight being picked (same estimate); when a PR exists, tapping the box opens that History workout via `openHistoryWorkout` in `page.js`), bottom row `+ SET ^` (add set at top) / `+ SET ⌄` (add set at bottom) / action (`RECALCULATE`) / red `DELETE` (deletes the exercise; shown when the host passes `onRemove`)). Set values are edited through the shared pop-ups via callbacks (`onEditSetValue`, `onEditWeight`, ...), so each host decides where edits are written. Used by `RoutineEditorView` and `OneRepMaxCalculatorModal`; don't build another set-row UI.
  * `app/components/OneRepMaxCalculatorModal.jsx` — 1RM calculator pop-up (SlotEditor + `PR DATE` row under the sets + live `ESTIMATED 1 REP MAX` + green `CALCULATE 1RM`). Used by History Personal Records and Onboarding Page 3; hosts log the PR with `buildPersonalRecordHistoryEntry` (`workoutEngine.js`).
  * `app/components/Primitives.jsx` — `SFSymbol`, `IOSListSection`, `IOSListRow`, `SessionTitleBar`, and `SessionRestTimerBar`.
  * `app/components/EquipmentToggleList.jsx` — Settings → `EQUIPMENT` (also Onboarding page 4): one ON/OFF row per `GYM_EQUIPMENT_OPTIONS` item plus `TURN ALL ON/OFF`, stored as `settings.availableEquipment` (local + cloud; `null` = not chosen yet, derived once from the old `selectedGymId` via `getEquipmentListForGymSelection`).
  * `app/components/SessionSyncModals.jsx` — `SessionSyncModal` (friend picker → invite / waiting / synced + UNSYNC; closes itself 1 s after the sync connects), `IncomingSyncInviteModal` (ACCEPT / DECLINE; warns when it replaces the open session), `SyncNoticeModal`.
  * `app/components/CloudSyncBanner.jsx` — Red `CLOUD SYNC FAILED: <reason>` strip + `RETRY` under the header (driven by `cloudSyncStatus` from `useCloudAndStorageSync`).
  * `app/components/Controls.jsx` — **Shared controls; use these instead of hand-styled `<button>`/`<select>`:** `Button` (`variant`: `primary`, `primary-row`, `secondary`, `dashed`, `success`, `danger`, `toggle`, `drawer`), `TabBar` (page tabs: one row of `SegmentButton`s, `tabs=[{ id, label }]`; Progress and Leaderboard), `SegmentButton` (segmented choices in a shared-border grid; `activeColor` `accent`/`ink`), `DeleteButton` (red ✕; `solid` for list rows, `outline` + `fill` for editor rows), `CloseButton` (orange modal ✕), `DragNumberBadge` (grippy drag handle), and `GymSelect` (`variant`: `field`, `cell`, `tile`). Pass `style` only for one-off sizing.
  * `app/styles/kineticTokens.js` — `IOS_DARK`, `KINETIC_CSS`, `UI` style tokens, and the shared-border tokens `SHARED_CELL_BORDER` / `SHARED_GROUP_OUTER` (import these; don't redefine them per file).
* **Utilities, Data & API (`app/utils/`, `app/data/`, `app/api/`):**
  * `app/data/exerciseLibrary.js` — Exercise catalog, schemes (`5x5`, `5x8`, `5x8w`, `Pyramid`, `Pyramid 1RM`, `Drop Sets`), equipment filters, and ExRx tables.
  * `app/utils/workoutEngine.js` — 1RM math (`getBestHistory1RM`, `getPersonalRecord1RM`, `getHistoricalCalculated1RM`, `calculateLastEquivalentWeightForSet`, `createWorkoutSlot`).
  * `app/utils/supabaseAuth.js` — Supabase Auth, cloud state sync, and the social API (`syncFriendshipsForUser`, `sendFriendRequestToAthlete`, `acceptFriendRequestFromAthlete`, `removeFriendshipWithAthlete`, `searchAthletesByQuery`, `fetchAthleteProfileSnapshot`), all as the signed-in user so RLS applies.
  * `app/utils/storageMigration.js` — Schema V3 local storage hydration and migration.
  * `app/utils/sessionSync.js` — Pure session-sync rules: `buildSessionSyncStructure` (exercises, order, type/muscle/equipment, schemes, set ids + types; reps only as defaults for new sets; never weights or checkmarks), `sessionSyncSignature` (what counts as a structural change), `mergeSessionSyncStructure` (matches slots/sets by id: existing sets keep this athlete's weight/reps/checkmark and take the partner's set type; new exercises/sets get weights from this athlete's own history).
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
* **Readability & colour rules (from the UX review):**
  * Minimum text size **11 px** (labels included); SVG text is sized so it renders at ≥ 11 px after the chart scales down (e.g. chart text 12.5 in a 360-wide viewBox).
  * Text must meet WCAG contrast (4.5:1, or 3:1 for bold ≥ 14 px): dark text on orange, never white on orange or white on red.
  * Tap targets at least 40 × 40 px (selects fill their whole cell). Section headings all use `UI.sectionTitle` (20 px white). Every segmented toggle shows "selected" the same way: orange fill (`SegmentButton` default; chart lift toggles add a colour square for the legend). The session header (nav + `SessionTitleBar` + `SessionRestTimerBar`, 40 px rows) is ≈ 146 px at phone width.
  * Full sentences (errors, notices, goal lines) are in sentence case; capitals are for labels and buttons.
  * One meaning per colour: orange = action / selected / you; red = destructive or warning (delete, reset, overdue); green = done / success / recovering; grey = empty or not logged yet. Empty states say so in words (e.g. `LOG A SESSION TO SEE PROGRESS`, `NOT LOGGED YET`) instead of showing zeros.
* **Typography & Geometry:**
  * Font Family: `"Host Grotesk"`, uppercase headers, `fontWeight: 800`, tight tracking (`-0.03em` to `-0.045em`).
  * **Zero Border Radius:** Every element enforces `border-radius: 0px !important` (sharp brutalist edges).
  * **Zero-Gap Shared Borders (`SHARED_GROUP_OUTER` & `SHARED_CELL_BORDER`):** Adjacent buttons, inputs, and rows sit flush against one another (`gap: 0`) sharing single `1px solid var(--dp-color-rule)` edges (`borderTop`/`borderLeft` on the outer group, `borderRight`/`borderBottom` on each cell) without extra bounding boxes or gaps.
  * **Mobile-First Viewport:** Centered `480px` max-width container with `2px solid #5C5C5C` left/right borders.
  * **iPhone safe areas:** the app draws edge to edge (`viewportFit: 'cover'`, black-translucent status bar), so the sticky header adds `env(safe-area-inset-top)` to its top padding (clears the notch / Dynamic Island), the footer adds `env(safe-area-inset-bottom)` (home indicator), and every full-screen overlay (drawer, `UI.modalBackdrop`, 1RM calculator, CSV import) pads both. New fixed/full-screen elements must do the same.

---

## 5. Core Features & Domain Logic Decisions

### A. Home Screen, Header & Navigation
* **2 Primary Action Buttons on Home Screen (Single-line, Centered, Equal Size)** — History is no longer a Home button; it lives on the PROGRESS page:
  1. **`NEW SESSION →` / `CURRENT SESSION →`**: Shows `CURRENT SESSION →` **only** when `activeSession?.slots?.length > 0`; otherwise shows `NEW SESSION →`. Saving a session clears `activeSession`.
  2. **`AUTO SESSION`**: Dark text (`#101010`) on orange background (white on orange fails contrast); immediately generates a full workout using `routinePreferences` and `selectedGymId`, and opens straight into `session` view.
* **Social Scroller on Home Screen:**
  * Friends only (never your own lifts), limited to a **single most-recent entry per friend user** across Squat, Bench, and Deadlift. With no friends it reads `INVITE FRIENDS TO KEEP TRACK OF PROGRESS!`.
  * The whole ticker bar is one button: tapping anywhere on it pauses / plays it (no separate PAUSE button).
* **App icon:** `app/icon.svg` (copied to `public/icon.svg`) is just the white teardrop and the orange prohibition ring + slash on a transparent background — no outer badge circle. `app/apple-icon.png` (copy in `public/`) is the same artwork on a plain `#101010` square (iOS rounds the corners), rendered from the SVG with `sharp` at 1024 × 1024.
* **Locked interface:** no pinch/double-tap zoom or text reflow (`viewport` export in `app/layout.js`, `touch-action`/`text-size-adjust` in `globals.css`, and an iOS `gesturestart` blocker in `page.js`).
* **Top Header (`AppHeaderAndDrawer`):**
  * Left: Hamburger Menu button (`☰`). Center: `You Can't Cry in Here` home link (when not on Home). Right: **`FEEDBACK`** button (`FeedbackModal`).
* **Set rows:** the ✓ is 52 px wide; the per-set delete ✕ beside it is grey (it still asks before deleting) so it doesn't compete with the ✓. In supersets every set row has its exercise name strip above it (shortened name, orange for A, grey for B) so the interleaved sets are easy to tell apart.
* **Sticky Rest Timer Bar (`SessionRestTimerBar`):**
  * Left box: `REST 1:00 / 1:30 / 2:00 / 3:00` selector; turns into a live **Red Countdown Timer (`#FF3B30`)** when any set is marked complete.
  * Right orange box (`var(--dp-color-accent)`): Fixed height (`56px`) across blank and populated sessions so layout never jumps.

### B. Routine Editor & Workout Slots (`RoutineEditorView.jsx`)
* **No top action row (for now):** the `GYMS/EQUIPMENT` selector and `ROUTINES / LOAD` button are hidden from the session/routine editor.
* **Equipment (Settings → `EQUIPMENT`, multi-select `availableEquipment`) drives defaults only:** exercises picked for the athlete (`+ ADD EXERCISE`, AUTO SESSION, the default exercise after changing a slot's type or muscle group) need only ON equipment (`isExerciseAvailableWithEquipment`: every `requiredEquipment` item ON; bodyweight always fits; Big 3 + OHP map to `findEquivalentExerciseForEquipment`). The per-exercise filters, exercise lists and search always use the whole library.
* **Default scheme follows the goal** (`getDefaultSchemeForGoal`): Strength `5x5`, Hypertrophy `5x10`, Maintain `5x8`, for every exercise picked automatically.
* **`LOAD ROUTINE`:** a blank live session (no exercises yet) shows `+ ADD EXERCISE` | `LOAD ROUTINE` side by side; LOAD ROUTINE opens the routine browser (`setRoutineSelectReturnView('session')`), which loads the picked routine back into the session. Once the session has an exercise only `+ ADD EXERCISE` remains.
* **`+ ADD EXERCISE`** (the button under the slots) appends one auto-guessed slot (`handleAddAutoSlot` → `buildGeneratedAutoSlots(slots, { addOne: true })`: the next unfilled `routinePreferences` category, cycling once the routine is full). The exercise is chosen by `pickBest` in `buildGeneratedAutoSlots` (shared with AUTO SESSION): only exercises that fit `selectedGymId` and aren't already in the workout; score = days the muscle group is behind on the stimulus map (`muscleStimulusStatus`, capped at 14, weighted by `MUSCLE_GROUP_WEIGHT` so neck/forearms/calves rank low) + `BIG4_BONUS_DAYS` for the Big 3 + OHP (or their gym equivalents) on Compound picks − a penalty for a muscle group already in the workout; curated (non-`exrx_`) and `isPriority` exercises break ties; stretches/isometrics are skipped. The athlete edits it in place; there is no add-exercise pop-up or `AUTO COMPLETE` button in the editor.
* **Always-Expanded Workout Slots & Grippy Drag Handles:**
  * Slots are never collapsed; exercise and set number badges display **grippy dot patterns** (`GrippyDotGrid`) and support drag-and-drop / touch reordering.
  * Row 1 has 3 columns (`Search`, `Category`, `Muscle Group`); Row 2: `Scheme`, `Equipment`, `Exercise`. The equipment filter always lists every equipment type in the library (`getAllEquipmentFilterOptions`); picking one the exercise doesn't use switches to the most similar exercise that does, keeping the muscle group whenever possible: same type + same muscle group, then same muscle group in another type, then what the filters show, and only then anywhere (the only case where the muscle group changes; the muscle filter is otherwise left as it was). The rows span the full width; deleting an exercise is the red `DELETE` at the end of its bottom button row.
  * Supersets show the same two rows twice (A, B), each fully independent, with interleaved sets; RECALCULATE and set edits use each half's own scheme.
  * Auto-completed and loaded routines populate `muscleGroupFilter` accurately based on the selected exercise.
  * Schemes include `5x5`, `5x8`, `5x10`, `8x8`, `Pyramid`, **`Pyramid 1RM`** (last set is `1 Rep Max`, preceding sets are `Warmup`s ramping from $50\%$ to $85\%$ of 1RM), and `Reverse Pyramid`.
  * **Barbell Increment Multiplier:** When set to a barbell exercise (`equipment === 'Barbell'`), the progression increment is automatically multiplied by `2` (`getEffectiveIncrementForExercise`).
  * **Smart `RECALCULATE` Priority:** Ignores completed sets (`st.completed`). Prioritizes the last-edited field (`weight` adjusts reps; `reps` adjusts weight). If the final set is edited (e.g., changed to `1 Rep Max`), adjusts both weights and reps across incomplete sets so the final set is achievable (matching `Pyramid 1RM` when the last set is `1 Rep Max`).
  * **Gym/Equipment Swap (`handleChangeGymSelection`):** Changing the `GYMS/EQUIPMENT` dropdown in the session/routine editor swaps every slot with no completed sets to its closest equivalent for that equipment (`findEquivalentExerciseForGym`, e.g. Barbell Bench Press → Dumbbell Bench Press). Weights come from the new exercise's history + increment, else the old 1RM converted by `convertEquivalent1RM` (dumbbell ≈ 0.65× barbell), stored on the slot as `estimated1RMs` so repeated swaps don't drift.
  * **Muscle Group Filters:** Includes an umbrella **`Legs`** filter matching all lower-body exercises (Thighs, Hips, Calves, Quadriceps, Hamstrings, Glutes, Adductors, Abductors).
* **Locked session header:** the session name, `SYNC` (signed-in, live session only; `SYNC…` while an invite waits, green `SYNCED` once linked), green `SAVE` and red `RESET` live in the sticky header (`SessionTitleBar`, SAVE/RESET only once the workout has exercises) directly above the rest timer; the editor body has no name or SAVE/RESET rows (the History inline editor, which has no locked header, keeps its name row).
* **Finishing a session:** the `✓` at the right of the sticky rest-timer bar (`SessionRestTimerBar` `onMarkDone`; grey like an unchecked set until tapped, green while its save confirmation is open via `markDoneActive`) and the header `SAVE` open the save confirmation. `NEW SESSION` replaces an empty leftover session so the name/date are today's; `formatDateYMD` shows timestamps in local time (never the UTC date).
* **Save Confirmation Modal (`SaveConfirmModal`):**
  * Clicking `SAVE` opens a confirmation popup: `1. NAME TO SAVE UNDER`, then `2. SHARING` with two toggles — `PUBLIC`/`PRIVATE` (one button that flips; public = added to `sharedRoutines` so friends can load it) and `ROUTINE` (on/off, `saveAsRoutine`; on = also saved to your `savedRoutines`). Sessions and History default ROUTINE off; the routine editor hides the toggle and always saves a routine.

### C. History & Personal Records (`HistoryView.jsx` & `usePlateCalculator.js`)
* **Personal Records Section (Placed Above History):**
  * **Core 4 Default Exercises (`CORE_PR_EXERCISE_IDS`):** Defaults to **Barbell Bench Press**, **Barbell Back Squat**, **Barbell Deadlift**, and **Barbell Military Overhead Press** (synced with Onboarding Page 3 of 6). Chin-ups/pull-ups are not defaults; they are bodyweight exercises (`ex.isBodyweight`, set from `computeIsBodyweight` in `exerciseLibrary.js`), plus any user-added exercises (`customPrExerciseIds`). Never auto-populate `Object.keys(oneRepMaxes)` into the displayed list.
  * **Strictly `TBD` Until Logged in History:** `getPersonalRecord1RM` derives Personal Records strictly from logged `history` (`getBestHistory1RM`). Unlogged exercises always show **`TBD ✎`** on neutral grey (`#2A2A2E`) — "not logged yet" is not a warning. Names wrap to two lines instead of being cut off; numbers and units stay together (non-breaking space).
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
  * Default friend: a database trigger (`handle_new_profile_friendships`) makes every new account friends with `@matt` — found by `default_friend_id()` via the sign-in account email matthew.n.duvall@gmail.com in `auth.users`, falling back to username `matt` — and with anyone who emailed an invite to that address. Nothing re-adds a removed friend.
  * Match friend records with `isSameFriend` (account id only). The local `friendsList` is just a cache of the server list and is cleared on sign-out.
* **Email Invites (`SocialView.jsx` → `/api/invite`):**
  * The inviter must be signed in; the route verifies their Supabase session and records `friend_invites` as them (RLS: `inviter_user_id = auth.uid()`), then emails the beta code **`imnotcrying`** and a join link (`/?invite_from=<username>&invited_email=<target>&beta_code=imnotcrying`).
  * The join link also carries `invite_id`. The app keeps it (`yccih_pending_inviter_v1`) until signed in, and the next friendship sync calls `claim_invite_link(invite)`: whoever joins through the link becomes friends with the inviter **whatever email they use**; each unused invite can be claimed once. Email matching still works too: new accounts via the trigger above, existing accounts via `claim_my_invites`. Migration: `supabase/migrations/2026-11-09_invite_links_default_friend.sql`.
* **Public/private profiles:** `settings.social.profileIsPublic` (default true, synced in `user_profiles.settings`). The `friends_of_athlete(target)` RPC lists a friend's friends only while you are friends with them and they are public, includes only public athletes (never you), and returns your relation to each (`friends`/`requested`/`incoming`/`none`).
* **Friend Profiles (`ProfileView.jsx`):**
  * Never display a friend's email address—only display `@<username>`.
  * PRs load from the friend's `user_profiles` row + `workout_history` by account id (`fetchAthleteProfileSnapshot`); RLS returns nothing once the friendship is removed.
  * Profile PR lists show the top 10 (heaviest first) with a `SEE ALL (<N>)` toggle.
* **Footer:** Every view renders `Copyright © 2026 MaNoDuV LLC` at the bottom of the app column (`app/page.js`).
* **Feedback Delivery (`FeedbackModal` & `app/api/feedback/route.js`):**
  * Prompts `ENTER YOUR FEEDBACK BELOW. IT WILL BE AUTOMATICALLY SENT WITH DIAGNOSTIC LOGS FROM THIS SESSION (<N> LOG EVENTS).`
  * Sends via `/api/feedback` + client-side `formsubmit.co/ajax/matthew.n.duvall@gmail.com`, and automatically triggers a pre-filled `mailto:matthew.n.duvall@gmail.com` fallback if active delivery is not confirmed.

### G. Live Session Sync (`useSessionSync.js`, `sessionSync.js`, `public.shared_sessions`)
* One `shared_sessions` row per sync (owner, participant, status `pending`/`accepted`/`declined`/`ended`, `structure` JSONB). RLS: only the two athletes can read/update/delete; only an accepted friend can be invited (`are_friends`); a trigger stops the athletes being swapped. Migration: `supabase/migrations/2026-11-09_shared_sessions.sql`; `delete_my_account` deletes the athlete's rows.
* Mirrored: exercises added/removed/reordered, exercise/type/muscle/equipment/scheme, sets added/removed/retyped. Not mirrored: weights, reps, checkmarks, session name. Each athlete saves their own copy.
* RESET while synced ends the sync first (it would otherwise empty the partner's session); saving or replacing the session ends it; UNSYNC ends it for both. Invites only reach an open app (no push notifications).

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
