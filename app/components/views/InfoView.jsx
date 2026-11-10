'use client';

import React from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import { Button } from '../Controls';

export function InfoView({
  colors,
  setCurrentView,
  user = null,
  shareStatsWithFriends = true,
  setShareStatsWithFriends,
  shareRoutinesWithFriends = true,
  setShareRoutinesWithFriends,
  importBackupInputRef,
  handleExportBackupJSON,
  handleImportBackupJSON,
  handleResetToDemoDefaults
}) {
  const stepBoxStyle = {
    marginTop: '8px',
    marginBottom: '14px',
    padding: '10px 12px',
    backgroundColor: '#101010',
    border: '2px solid var(--dp-color-rule)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  };

  return (
    <div style={UI.pagePad}>
      <IOSListSection header="01 // APP LOGIC & 1RM APPROACH" colors={colors}>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%', lineHeight: 1.55, fontSize: '14px', color: '#E0E0E0' }}>
            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>1.1 1-REP MAX (1RM) FOUNDATION:</strong> Everything in{' '}
              <em>You Can&apos;t Cry in Here</em> is anchored to your <strong>1 Rep Max (1RM)</strong> for each lift. Your Personal Records start as{' '}
              <strong>TBD</strong> and automatically update whenever you log a set that produces a higher estimated 1RM (via the Epley formula:{' '}
              <code>Weight × (1 + Reps / 30)</code>), or whenever you manually override a Personal Record.
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
              <strong style={{ color: 'var(--dp-color-accent)' }}>1.3 GYMS &amp; EQUIPMENT FILTERS:</strong> Selecting an active{' '}
              <strong>Gyms/Equipment</strong> profile (<em>Full Gym</em>, <em>Barbells Only</em>, <em>Dumbells Only</em>,{' '}
              <em>Bodyweight Only</em>, or a custom equipment setup you build) filters both manual exercise selectors and{' '}
              <strong>AUTO</strong> routine generation so every prescribed lift matches the equipment physically available to you.
            </p>

            <p style={{ marginBottom: 0 }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>1.4 MUSCLE GROUP FILTERS &amp; STIMULUS:</strong> Every exercise slot can be filtered by target muscle group (
              <em>Legs</em>, <em>Chest</em>, <em>Back</em>, <em>Shoulders</em>, <em>Thighs</em>, <em>Hips</em>, <em>Calves</em>,{' '}
              <em>Upper Arms</em>, <em>Forearms</em>, <em>Waist</em>, or <em>Neck</em>) to isolate or swap movements on the fly. Completed sessions automatically update your Anterior/Posterior{' '}
              <strong>Stimulus</strong> view so you can see which muscle groups are recovering (Green), recovered (Yellow), or overdue for training (Red).
            </p>
          </div>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="02 // DATA POLICIES" colors={colors}>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%', lineHeight: 1.5, fontSize: '14px', color: '#E0E0E0' }}>
            {/* 2.1 CROSS-DEVICE CLOUD SYNC */}
            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>2.1 CROSS-DEVICE CLOUD SYNC:</strong> When signed in to your account, your workout history, personal records (1RMs), custom routines, gym equipment presets, active sessions, and settings automatically synchronize with Supabase Cloud so your training data seamlessly follows you across your phone, tablet, and computer.
            </p>

            {/* 2.2 ON-DEVICE RETENTION */}
            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>2.2 ON-DEVICE RETENTION:</strong> All training records and preferences are also cached locally on your device in versioned storage (Schema V3) so the app loads instantaneously and retains your progress across app updates even during offline gym sessions.
            </p>

            {/* 2.3 CLOUD AUTH & PRIVACY */}
            <div>
              <p style={{ marginBottom: '4px' }}>
                <strong style={{ color: 'var(--dp-color-accent)' }}>2.3 CLOUD AUTH &amp; PRIVACY:</strong> Registered accounts are protected by Supabase Cloud authentication and Row-Level Security (RLS) policies ensuring only you can access or modify your private records, while social stats and routines are only shared with friends if enabled below.
              </p>
              <div style={stepBoxStyle}>
                <div
                  onClick={() => setShareStatsWithFriends?.(p => !p)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
                    SHARE STATS WITH FRIENDS
                  </span>
                  <span style={UI.badge(shareStatsWithFriends)}>{shareStatsWithFriends ? 'ON' : 'OFF'}</span>
                </div>
                <div
                  onClick={() => setShareRoutinesWithFriends?.(p => !p)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
                    SHARE ROUTINES WITH FRIENDS
                  </span>
                  <span style={UI.badge(shareRoutinesWithFriends)}>{shareRoutinesWithFriends ? 'ON' : 'OFF'}</span>
                </div>
              </div>
            </div>

            {/* 2.4 PORTABLE BACKUPS & DELETION */}
            <div>
              <p style={{ marginBottom: '4px' }}>
                <strong style={{ color: 'var(--dp-color-accent)' }}>2.4 PORTABLE BACKUPS &amp; DELETION:</strong> You maintain full ownership of your data—use the controls below (or in <strong>MENU → 06 / SETTINGS</strong>) at any time to export a complete <strong>.JSON</strong> backup file, restore from a backup, or permanently clear and reset local data.
              </p>
              <div style={{ ...stepBoxStyle, marginBottom: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Button
                    variant="secondary"
                    onClick={handleExportBackupJSON}
                    style={{ padding: '10px 8px', fontSize: '11px', color: 'var(--dp-color-accent)' }}
                  >
                    EXPORT .JSON ↓
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => importBackupInputRef?.current?.click()}
                    style={{ padding: '10px 8px', fontSize: '11px' }}
                  >
                    IMPORT .JSON ↑
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleResetToDemoDefaults}
                  style={{ padding: '8px', fontSize: '11px', color: '#FF3B30' }}
                >
                  CLEAR &amp; RESET ALL LOCAL DATA ↺
                </Button>
              </div>
            </div>
          </div>
        </IOSListRow>
      </IOSListSection>

      <div style={UI.gutterWrap}>
        <Button variant="primary" onClick={() => setCurrentView('home')}>
          RETURN TO HOME →
        </Button>
      </div>
    </div>
  );
}
