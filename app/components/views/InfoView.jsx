'use client';

import React from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import { Button } from '../Controls';
import { DataBackupSection } from './SettingsView';

// The INFO page: how the app works (everything is converted to a 1 rep max), then data & privacy, then DATA & BACKUP.
// Sentences in sentence case; a short white lead-in names each point. No red on this page.

const paragraph = { margin: '0 0 12px', lineHeight: 1.55, fontSize: '14px', color: '#BDBDBD' };
const lead = { color: '#FFFFFF', fontWeight: 500 };
const formula = {
  display: 'block',
  margin: '8px 0 12px',
  padding: '10px 12px',
  borderRadius: '10px',
  backgroundColor: '#000000',
  color: '#FFFFFF',
  fontFamily: 'var(--cr-face-display)',
  fontSize: '15px',
  textAlign: 'center',
  letterSpacing: 0
};

function Section({ header, colors, children }) {
  return (
    <IOSListSection header={header} colors={colors}>
      <IOSListRow isLast={true} colors={colors}>
        <div style={{ width: '100%' }}>{children}</div>
      </IOSListRow>
    </IOSListSection>
  );
}

function P({ title, children, last = false }) {
  return (
    <p style={{ ...paragraph, marginBottom: last ? 0 : '12px' }}>
      {title && <span style={lead}>{title} </span>}
      {children}
    </p>
  );
}

export function InfoView({
  colors,
  setCurrentView,
  importBackupInputRef,
  handleExportBackupJSON,
  handleImportBackupJSON,
  handleResetToDemoDefaults
}) {
  return (
    <div style={UI.pagePad}>
      <Section header="THE IDEA: NORMALIZE EVERYTHING" colors={colors}>
        <P>
          A set of 3, a set of 12 and a pyramid can’t be compared as they are. So every set you log is converted to
          the same unit: an estimated 1 rep max (1RM), the most you could lift once. Progress, records, suggested weights,
          goals and leaderboards are all measured in it.
        </P>
        <P title="The conversion.">Each set’s weight and reps, plus the reps you had left (RIR):</P>
        <code style={formula}>1RM = weight × (1 + (reps + RIR − 1) ÷ 30)</code>
        <P>
          For example, 225 lb × 5 with 2 reps left = 225 × (1 + 6 ÷ 30) = 270 lb. A single with nothing left is just its
          weight. It is the exact reverse of how weights are suggested, so a set done as suggested keeps your 1RM where
          it was. A 1RM worked out this way shows with an asterisk (270*); one you actually lifted for 1 rep shows plain.
        </P>
        <P title="An exercise’s 1RM">
          in a session is the average of its working sets (warm-ups left out), so changing any one set’s weight, reps or
          intensity moves it. Sets nearer failure count more (reps in reserve are easiest to misjudge far from failure),
          and sets of 15 reps or more are left out when there are lower-rep sets, since rep formulas lose accuracy past
          about 12 to 15 reps (a ! on 1RM* CURRENT explains it). Your personal record is the best session you have
          logged.
        </P>
        <P title="Bodyweight exercises" last>
          count the share of your bodyweight they actually move: a push-up about 64 %, a dip about 95 %, a pull-up all of
          it, a bodyweight squat about 88 %.
        </P>
      </Section>

      <Section header="WHAT THE 1RM DRIVES" colors={colors}>
        <P title="Suggested weights.">
          The app turns your 1RM back into a weight for each set’s reps, set type and number of sets. It works from a
          smoothed 1RM of your last three sessions of that exercise (the newest counting most, not your record) plus
          your increment, scaled to the lift (your Goals increment is for a 200 lb lift, so a curl moves less than a
          deadlift). RECALCULATE redoes this for an exercise.
        </P>
        <P title="Live adjustment.">
          As you finish working sets, what they say (weight, reps and the RIR you report) re-plans the sets still to do:
          a first set that felt easier makes the rest heavier, harder makes them lighter.
        </P>
        <P title="Stalls.">
          With no new 1RM on an exercise in 30 days, the next session is a deload: 10 % lighter at the same reps. It
          says so on the exercise, with SKIP to train at full strength instead; either way the 30 days start again.
        </P>
        <P title="Exercises you haven’t logged">
          start from a related lift you have (an RDL from your deadlift, an incline press from your bench), else from the
          strength standard one class below your goal for your bodyweight and height.
        </P>
        <P title="Performance.">
          The chart plots each lift’s 1RM over time, the distance left to your strength class goal (Novice unless you
          choose another in Configuration → Goals) and your records for every exercise.
        </P>
        <P title="Leaderboards" last>
          rank friends by Big 3 total and by DOTS, the score powerlifting federations use to compare lifters of
          different bodyweights (Big 3, overhead press and most improved). DOTS uses each athlete’s bodyweight and sex
          (Configuration → Body metrics), but neither is ever shown.
        </P>
      </Section>

      <Section header="INTENSITY" colors={colors}>
        <P title="Reps in reserve.">
          Every set has an intensity: RIR by default (reps you could still do), or RPE (10 − RIR), or percent of your
          1RM. They convert into each other through the set’s reps. Your Exercise Set Preferences set the effort: a
          working set leaves RIR 2, top out RIR 1, burn out RIR 3, a 1 rep max RIR 0. Warm-ups aren’t an effort: they
          ramp from 50 % to 80 % of your first working weight at the same reps, and show as %1RM.
        </P>
        <P title="Fatigue.">
          Each working set leaves you a little closer to failure at the same weight, so working sets keep one weight
          and the RIR shown falls by your fatigue rate (Configuration → Program; 0.5 a set by default), shown in whole reps rounded up: RIR 2, 2, 1.
          Each set’s 1RM adds that fatigue back, so slowing down over an exercise doesn’t count as getting weaker. Once
          you log RIRs by hand, the app learns your own rate for each exercise.
        </P>
        <P title="Always true to you.">
          The intensity shown is what the set’s weight and reps really are for you, from your 1RM. Where a plan and your
          numbers disagree (a bodyweight set you can do more of, a weight the plates can’t make exactly) the intensity
          says so, below RIR 0 when a set asks more than you should manage. An exercise you have never logged shows —
          until it has a session. If a set felt easier or harder, change its intensity: that moves your 1RM and
          everything after it.
        </P>
        <P title="Locks.">
          Lock any of a set’s weight, reps or intensity and RECALCULATE works out the rest around them. An intensity
          you pick locks itself.
        </P>
        <P title="Checking before saving." last>
          When you finish, sets whose 1RM is far from the rest of their exercise are listed, e.g. a light set marked RIR
          0, so a wrong intensity doesn’t skew your numbers.
        </P>
      </Section>

      <Section header="BUILDING SESSIONS" colors={colors}>
        <P title="Programs.">
          Crying, the default, picks exercises by which muscles are most overdue on the Stimulus map. Society and the
          other programs (Configuration → Program) set the weeks, days, sets, reps and intensities.
        </P>
        <P title="Equipment.">
          Turn on what you have in Configuration → Equipment. Exercises picked for you only use equipment that’s on;
          search shows everything. One exercise can take several kinds of load, e.g. a pull-up is bodyweight, weighted or
          band-assisted.
        </P>
        <P title="Stimulus." last>
          Each working set counts 1 for the exercise’s main muscle group and ½ for each secondary one (bench: chest 1,
          shoulders and arms ½), so secondary work adds up. A group counts as trained on a day once it reaches 1; the
          Stimulus page shows recovering, recovered or overdue from the day thresholds you set, and the sets in the last
          7 days.
        </P>
      </Section>

      <Section header="YOUR DATA" colors={colors}>
        <P title="On this device.">
          Everything is saved on your device as you go, so the app works offline in the gym.
        </P>
        <P title="Signed in.">
          Your History, routines and settings are also kept in your account and follow you to other devices. Only you can
          read or change them, unless you share with friends.
        </P>
        <P title="Sharing.">
          Social → Privacy decides what friends see: your stats, your shared routines, your bodyweight and your friends
          list. Your own profile shows exactly what they see.
        </P>
        <P title="Leaving." last>
          Export a .json backup below at any time. Deleting your account (Profile) removes your workouts, routines,
          friendships and profile from the server.
        </P>
      </Section>

      <DataBackupSection
        colors={colors}
        importBackupInputRef={importBackupInputRef}
        handleExportBackupJSON={handleExportBackupJSON}
        handleImportBackupJSON={handleImportBackupJSON}
        handleResetToDemoDefaults={handleResetToDemoDefaults}
      />

      <div style={UI.gutterWrap}>
        <Button variant="secondary" onClick={() => setCurrentView('home')}>
          RETURN TO HOME →
        </Button>
      </div>
    </div>
  );
}
