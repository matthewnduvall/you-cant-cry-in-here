<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# AGENTS.md — Project Context & Rules for "You Can't Cry in Here"

> **Note for Antigravity Agent:** This file contains the complete product, design, architectural, and domain context migrated from our original design & development sessions. Always follow these rules and conventions when editing this repository.

---

## 1. Project Overview & Tech Stack
* **App Name:** *You Can't Cry in Here*
* **Framework:** Next.js 16.4+ (App Router, Turbopack, `cacheComponents: true` & `partialPrefetching: true` enabled in `next.config.mjs`).
* **Hosting & Backend:**
  * **Frontend Hosting:** Vercel (linked to GitHub repo `matthewnduvall/you-cant-cry-in-here`).
  * **Database & Auth:** Supabase (`supabase_schema.sql` in repo root defines `user_profiles`, `workout_history`, `routines`, and `friendships` with Row-Level Security).
  * **Local Persistence:** Update-resilient `localStorage` engine (`yccih_app_state_v3`, Schema Version 3) with debounced 300ms auto-save and `.json` backup export/import.

---

## 2. Critical Next.js 16 & Environment Rules
1. **No Unstable `Date.now()` in Client Prerender:** Because Next.js 16 `cacheComponents` is enabled, **never** call `Date.now()` directly inside a `useMemo` or top-level render body of a `'use client'` component. Always read `Date.now()` inside a `useEffect` (e.g., `stimulusNowMs`) or event handler.
2. **Do Not Run `npm run build` in the Sandboxed Terminal:** On Windows, Antigravity's terminal sandbox blocks Next.js 16 Turbopack worker sockets from spawning. Make code edits directly and let the user run `npm run dev` / `npm run build` in their external PowerShell window unless terminal sandbox permissions are disabled.

---

## 3. Visual & UI Design System ("Kinetic Brutalist / iOS 18 Dark")
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

## 4. Core Features & Domain Logic Decisions

### A. Home Screen & Navigation
* **3 Primary Action Buttons on Home Screen:**
  1. **`NEW SESSION →`**: Opens `session` view (creates a fresh manual session or resumes active session). Saving a session clears `activeSession` so the next `NEW SESSION` starts clean.
  2. **`NEW AUTO ⚡`**: Immediately generates a full workout using the user's `routinePreferences` and active `selectedGymId` equipment filter, skips the preview screen, and opens straight into the active `session` view with calculated working weights.
  3. **`HISTORY ↗`**: Opens past logged sessions and Personal Records (PRs).
* **Sticky Header & Rest Timer Bar (`SessionRestTimerBar`):**
  * Shows a `REST 1:00 / 1:30 / 2:00 / 3:00` selector on the left.
  * When any set's checkmark (`✓`) is tapped to mark it complete, the left box turns into a live **Red Countdown Timer (`#FF3B30`)** that counts down (and into negative overtime if exceeded) until tapped to stop.
  * The right orange box (`var(--dp-color-accent)`) displays two lines:
    * Top line: `NEXT: <EXERCISE NAME>` (or `ALL SETS COMPLETE ✓`)
    * Bottom line: `SET #<N> • <WEIGHT> LB × <REPS> REPS`

### B. Routine Editor & Workout Slots (`session`, `routine_editor`, `routine_preview`, `historical_entry`)
* **Top Action Row (3 Equal Columns):**
  1. `ROUTINES ↗` (shows currently loaded routine name or `MANUAL` / `AUTO`).
  2. `GYMS/EQUIPMENT ▾` (switches active equipment filter: `Full Gym (All)`, `Barbells Only`, `Dumbells Only`, `Bodyweight Only`, or custom user gyms).
  3. `AUTO ⚡` (builds an auto workout and opens `routine_preview`).
* **Always-Expanded Workout Slots:**
  * Slots are never collapsed; all sets are immediately visible.
  * Exercise dropdowns do **not** display star (`★`) icons.
  * **Supersets:** Pair 2 exercises (`A` and `B`) and interleave their sets in alternating order (`A#1`, `B#1`, `A#2`, `B#2`, etc.).
* **Locked Set Row Layout:**
  * Each set row has a main bordered container plus an **outside right-aligned Red Delete (`✕`) button** (`26px` wide) that aligns vertically with the slot's top-right Red Delete (`✕`) button.
  * Inside the set box, column widths are strictly locked (`36px minmax(0, 1fr) 44px 62px 48px 32px` for weighted lifts):
    1. Set Number (`#1` or `A#1` / `B#1`)
    2. Set Type dropdown (`Warmup Set`, `Working Set`, `Top Out Set`, `Burn Out Set`, `1 Rep Max`)
    3. Read-only `LAST` calculated equivalent weight box (`44px`)
    4. Interactive Weight button (`62px`, opens Plate & Weight Calculator modal)
    5. Roomy Reps numeric input (`48px`, no "R" suffix label)
    6. Completion Checkmark button (`✓`, `32px`, grey `#262626` when incomplete, green `#30D158` when complete)
* **Delete Confirmation Modal (`DeleteConfirmModal`):**
  * Tapping the red `✕` on either an entire Exercise Slot or an individual Set **must** open the confirmation modal before deleting.
* **Bottom Slot Controls (`+ ADD SET TOP`, `+ ADD SET BOTTOM`, `RECALCULATE`):**
  * `+ ADD SET TOP` inserts a `Warmup Set` at the top and renumbers sets.
  * `+ ADD SET BOTTOM` appends a `Burn Out Set` at the bottom and renumbers sets.
  * `RECALCULATE` recomputes weights for all sets based on the user's historical 1RM and goal increment. **Special 1RM Ramp Rule:** If the final set in a slot is set to `'1 Rep Max'`, `RECALCULATE` automatically turns all preceding sets into `Warmup Set`s ramping from $50\%$ to $85\%$ of 1RM leading up to the final $100\% + \text{increment}$ 1RM attempt.

### C. Workout Math & ExRx Standards
* **Estimated 1RM Formula (Epley):**
  $$\text{1RM} = \text{weight} \times \left(1 + \frac{\text{reps}}{30}\right)$$
* **Working Weight Calculation (`calculateLastEquivalentWeightForSet`):**
  * Scales from `base1RM` using inverse Epley $\frac{1}{1 + \text{reps}/30}$, a set-type multiplier (`Warmup Set` $= 0.72$, `Working Set` $= 0.96$, `Top Out Set` $= 1.04$, `Burn Out Set` $= 0.82$), and a fatigue discount for high set counts ($>5$ sets).
  * Target working weight adds the user's `goalIncrement` (`+1.25 lb`, `+2.5 lb`, `+5 lb`, `+10 lb`, or `0` if `Maintain`).
* **ExRx.net Strength Standards:**
  * Big 4 lifts (`barbell_bench_press`, `barbell_back_squat`, `barbell_deadlift`, `overhead_press`) are evaluated against `Untrained`, `Novice`, `Intermediate`, `Advanced`, `Elite`, or `Custom` using bodyweight ratios adjusted slightly for height.
* **No Warmup Slot Category:**
  * Warm-up routines were intentionally removed from slot categories and `routinePreferences`. Valid categories are `'Compound Lift'`, `'Supersets'`, `'Accessories'`, and `'Abs'`.

### D. Authentication & Beta Access
* Beta sign-up requires the beta tester code: **`imnotcrying`** (case-insensitive).