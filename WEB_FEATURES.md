# Web app features (parity inventory)

The web app must keep every feature below as the native iOS / Apple Watch app grows. Each line is one feature with an
id; `e2e/web-features.spec.js` has a browser smoke test titled with that id, and `tests/webFeatures.test.js` fails
`npm test` when a listed feature has no test or a test isn't listed.

**Rule:** removing, hiding or narrowing any feature here needs the owner's explicit yes in chat first — say which
feature, what changes and why. Then remove its line here and its test in the same change. Adding a feature: add a line
and a test.

Signed-in features (friends, feed, challenges, sync, cloud backup, leaderboards with data) need a test account and
aren't in the smoke tests yet; they are listed under "Not yet automated" and still fall under the rule.

## Automated

### Home
- **home.session-buttons** — NEW SESSION / CURRENT SESSION and AUTO SESSION
- **home.readout-tiles** — TO GOAL, OVERDUE, LAST SESSION, THIS WEEK, FRIENDS and RANK tiles, each opening its page
- **home.body-reminder** — brand-new accounts are reminded to set bodyweight and height (opens BODY METRICS)
- **home.feed** — CHALLENGES and FEED below the tiles (signed out: a sign-in prompt)

### Navigation
- **nav.menu** — the menu reaches every page: Session, Programs, Performance, History, Stimulus, Friends, Leaderboards, Privacy, Configuration, Info
- **nav.back** — the ← BACK button and the phone's back gesture follow the pages visited
- **app.mode** — ATHLETE / COACH toggle in the footer of every page (kept; new accounts start in ATHLETE): ATHLETE simplifies the whole app, COACH shows every setting
- **nav.feedback** — FEEDBACK sends feedback with session logs

### Session (live workout)
- **session.add-exercise** — + ADD EXERCISE adds a planned exercise (weights, reps, intensity worked out)
- **session.tick-set** — ticking a set marks it done and starts the rest timer
- **session.simple-effort** — ATHLETE mode asks "how many more reps" after a working set and saves it as RIR
- **session.simple-rows-superset** — ATHLETE mode's + 1 ROW, SUPERSET and UNPAIR
- **session.advanced-scheme** — COACH mode's scheme pop-up (scheme, sets, reps)
- **session.reset-exercise** — RESET puts an exercise back as it was loaded
- **session.delete-exercise** — the ✕ at an exercise card's top right deletes it (after asking)
- **session.search** — the exercise search finds and picks an exercise
- **session.sentence-search** — typed or spoken sentences set up exercise, sets, reps and rest
- **session.sentence-superset** — a superset sentence pairs two exercises
- **session.one-rep-max** — "1 rep max bench" makes one max single
- **session.sentence-scheme** — scheme words in a sentence ("bench press pyramid one rep max")
- **session.sentence-reps-stay** — said reps stay as said, bodyweight exercises included ("12 sets of 10 pushups")
- **session.search-clear** — the ✕ in the search box clears it
- **session.spoken-enter** — a complete spoken request enters itself after 2 s with no new words (typed ones wait for a tap)
- **session.typo-search** — the search forgives typos
- **session.microphone** — the microphone in the search box and beside the exercise name (where the browser has speech recognition), lit white while listening
- **session.mic-no-keyboard** — the mic shortcut listens without opening the keyboard; tapping outside closes the search
- **session.mic-blocked** — when the browser or phone refuses the mic, the search says so
- **session.console** — the CONSOLE explains the maths, and goes full screen
- **session.finish** — FINISH logs the done sets to History

### History and progress
- **history.list-and-editor** — History lists sessions and opens one as a full editor
- **performance.chart-and-accuracy** — Performance: the 1RM chart, lift rows, ACCURACY and REP CURVE
- **stimulus.map** — Stimulus: the body map, thresholds and suggested exercises

### Programs
- **routines.page** — the Programs page: PROGRAMS / ROUTINES / SHARED; ROUTINES has + NEW ROUTINE, AUTO ROUTINE, LOAD
- **programs.built-in** — built-in programs: details, training days, next session, their routines at your weights, LOAD; ← from a program returns to the list
- **programs.cycles** — cycles logged under a program: reviewed week by week (planned vs done, effort, against the cycle before) and SAVE AS PROGRAM (week by week as done)
- **programs.cycle-increment** — your own programs: CYCLE INCREMENT (on by default) keeps reps and effort and steps the weights up each cycle
- **programs.choose** — USE THIS PROGRAM chooses the program you follow (moved from Configuration); COPY TO MY PROGRAMS makes one of your own, chosen as CUSTOM, whose next routine AUTO SESSION loads

### Settings and data
- **configuration.tabs** — Configuration: BODY METRICS, GOALS, EQUIPMENT (and plates), TRAINING (set preferences, fatigue)
- **privacy.page** — Privacy: profile and sharing settings, sharing defaults, voice input
- **info.backup** — Info: the explanation of the system, and DATA & BACKUP (export / import / reset)
- **app.state-saves** — everything is saved on the device and survives a reload

### Social and account
- **social.signed-out** — Friends and Leaderboards ask a signed-out athlete to sign in
- **auth.sign-in** — sign in, sign up (beta code) and password reset

## Not yet automated (signed in; still covered by the rule)

- Friends: find athletes, requests, friend profiles (PROGRESS / HISTORY / ROUTINES / FRIENDS), INBOX
- Feed: posts, reactions, comments; challenges (all kinds, repeating, personal, chosen friends) and their emails
- Leaderboards with friends (BIG 3 / BW, BIG 3 LB, OHP / BW, IMPROVED, CHALLENGES)
- Live session sync with a friend, and synced History updates
- Routines sent to friends; playlists
- Cloud backup and sync across devices; delete account
- Programs (Society, day programs), weeks and days; deloads and SKIP
- Drag-to-fill and drag-to-reorder (gestures)
- Plate calculator and weight pop-up; band exercises; History .csv import; routine .csv export
- Idle auto-finish; app update banner
