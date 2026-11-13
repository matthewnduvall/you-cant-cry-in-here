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
      <Section header="THE IDEA: EVERYTHING IS A 1 REP MAX" colors={colors}>
        <P>
          A set of 3, a set of 12 and a pyramid can’t be compared as they are. So every set you log is converted to
          the same unit: an estimated 1 rep max (1RM), the most you could lift once. Progress, records, suggested weights,
          goals and leaderboards are all measured in it.
        </P>
        <P title="The conversion.">Each set’s weight and reps, plus the reps you had left (RIR):</P>
        <code style={formula}>1RM = weight × (1 + (reps + RIR) ÷ 30)</code>
        <P>
          For example, 225 lb × 5 with 2 reps left = 225 × (1 + 7 ÷ 30) ≈ 278 lb. A single with nothing left is just its
          weight. A 1RM worked out this way shows with an asterisk (278*); one you actually lifted for 1 rep shows plain.
        </P>
        <P title="An exercise’s 1RM" last>
          in a session is the average of its working sets (warm-ups left out), so changing any one set’s weight, reps or
          intensity moves it. Your personal record is the best single set you have ever logged.
        </P>
      </Section>

      <Section header="WHAT THE 1RM DRIVES" colors={colors}>
        <P title="Suggested weights.">
          The app turns your 1RM back into a weight for each set’s reps, set type and number of sets. It takes the lower of
          last session’s weight + your increment, and your best 1RM + your increment, so the weights climb steadily
          without jumping ahead of you. RECALCULATE redoes this for an exercise.
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
          rank friends by Big 3 total, by Big 3 and overhead press divided by bodyweight, and by most improved. The
          ratios use each athlete’s bodyweight, but the bodyweight itself is never shown.
        </P>
      </Section>

      <Section header="INTENSITY" colors={colors}>
        <P title="Reps in reserve.">
          Under a program, each set has an intensity: RIR by default (reps you could still do), or RPE (10 − RIR), or
          percent of your 1RM. They convert into each other through the set’s reps, and a set type sets one for you
          (warm-up RIR 5, working RIR 2, top out RIR 1, burn out RIR 3, 1 rep max RIR 0).
        </P>
        <P title="Locks.">
          Lock any of a set’s weight, reps or intensity and RECALCULATE works out the rest around them.
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
          Each logged set marks its muscles as trained. The Stimulus page shows each muscle group as recovering,
          recovered or overdue, from the day thresholds you set.
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
