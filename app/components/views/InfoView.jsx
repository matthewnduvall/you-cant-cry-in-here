'use client';

import React from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import { Button } from '../Controls';
import { DataBackupSection } from './SettingsView';

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
      <IOSListSection header="01 // APP LOGIC & 1RM APPROACH" colors={colors}>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%', lineHeight: 1.55, fontSize: '14px', color: '#BDBDBD' }}>
            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>1.1 1-REP MAX (1RM) FOUNDATION:</strong> Everything in{' '}
              <em>You Can&apos;t Cry in Here</em> is anchored to your <strong>1 Rep Max (1RM)</strong> for each lift. Your Personal Records start as{' '}
              <strong>TBD</strong> and automatically update whenever you log a set that produces a higher estimated 1RM (via the Epley formula:{' '}
              <code>Weight × (1 + (Reps + RIR) / 30)</code>, where RIR is the reps you had left, from the set&apos;s
              intensity), or whenever you manually override a Personal Record.
            </p>

            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>1.2 AUTOMATIC SCHEME &amp; SET CONVERSIONS:</strong> Because every lift is normalized to a 1RM, the engine automatically converts your 1RM into accurate working weights across any training scheme (
              <strong>5×5</strong>, <strong>5×8</strong>, <strong>5×8w</strong>, <strong>Pyramid</strong>,{' '}
              <strong>Pyramid 1RM</strong>, and <strong>Drop Sets</strong>) and set type (
              <strong>Warmup</strong>, <strong>Working</strong>, <strong>Top Out</strong>,{' '}
              <strong>Burn Out</strong>, and <strong>1 Rep Max</strong>). Adding or removing sets and tapping{' '}
              <strong>RECALCULATE</strong> dynamically scales weights for set-count fatigue and applies your chosen goal progression increment (e.g.,{' '}
              <code>+1.25 lb</code> to <code>+10 lb</code>).
            </p>

            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>1.3 EQUIPMENT:</strong> Turn on the equipment you have in{' '}
              <strong>Configuration → Equipment</strong> (or tap a saved setup to switch to it). Exercises picked for you by{' '}
              <strong>AUTO SESSION</strong> and <strong>+ ADD EXERCISE</strong> only use equipment that is on (bodyweight exercises always
              count). Searching and the per-exercise filters still show every exercise.
            </p>

            <p style={{ marginBottom: 0 }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>1.4 MUSCLE GROUP FILTERS &amp; STIMULUS:</strong> Every exercise slot can be filtered by target muscle group (
              <em>Legs</em>, <em>Chest</em>, <em>Back</em>, <em>Shoulders</em>, <em>Thighs</em>, <em>Hips</em>, <em>Calves</em>,{' '}
              <em>Upper Arms</em>, <em>Forearms</em>, <em>Core</em>, or <em>Neck</em>) to isolate or swap movements on the fly. Completed sessions automatically update your Anterior/Posterior{' '}
              <strong>Stimulus</strong> view so you can see which muscle groups are recovering (Green), recovered (Yellow), or overdue for training (Red).
            </p>
          </div>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="02 // DATA POLICIES" colors={colors}>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%', lineHeight: 1.5, fontSize: '14px', color: '#BDBDBD' }}>
            {/* 2.1 CROSS-DEVICE CLOUD SYNC */}
            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>2.1 CROSS-DEVICE CLOUD SYNC:</strong> When signed in to your account, your workout history, personal records (1RMs), custom routines, gym equipment presets, active sessions, and settings automatically synchronize with Supabase Cloud so your training data seamlessly follows you across your phone, tablet, and computer.
            </p>

            {/* 2.2 ON-DEVICE RETENTION */}
            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>2.2 ON-DEVICE RETENTION:</strong> All training records and preferences are also cached locally on your device in versioned storage (Schema V3) so the app loads instantaneously and retains your progress across app updates even during offline gym sessions.
            </p>

            {/* 2.3 CLOUD AUTH & PRIVACY */}
            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>2.3 CLOUD AUTH &amp; PRIVACY:</strong> Registered accounts are protected by Supabase Cloud authentication and Row-Level Security (RLS) policies ensuring only you can access or modify your private records. Your stats and routines are shared with friends only if you turn that on in{' '}
              <strong>Social → Privacy &amp; Sharing</strong>.
            </p>

            {/* 2.4 PORTABLE BACKUPS & DELETION */}
            <p style={{ marginBottom: 0 }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>2.4 PORTABLE BACKUPS &amp; DELETION:</strong> You keep full ownership of your data: use <strong>DATA &amp; BACKUP</strong> below at any time to export a complete <strong>.JSON</strong> backup, restore from a backup, or clear and reset local data.
            </p>
          </div>
        </IOSListRow>
      </IOSListSection>

      {/* DATA & BACKUP (was the separate Data page) */}
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
