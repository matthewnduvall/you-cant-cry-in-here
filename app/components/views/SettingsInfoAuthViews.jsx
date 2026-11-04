'use client';

import React from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';

// ============================================================================
// VIEWS: SETTINGS, INFO & AUTH (SIGN IN / SIGN UP)
// ============================================================================

export function SettingsView({
  colors,
  userBodyweightLbs,
  setUserBodyweightLbs,
  userHeightFeet,
  setUserHeightFeet,
  userHeightInches,
  setUserHeightInches,
  stimulusGreenDays,
  setStimulusGreenDays,
  stimulusYellowDays,
  setStimulusYellowDays,
  routinePreferences,
  setRoutinePreferences,
  shareStatsWithFriends,
  setShareStatsWithFriends,
  shareRoutinesWithFriends,
  setShareRoutinesWithFriends,
  importBackupInputRef,
  handleExportBackupJSON,
  handleImportBackupJSON,
  handleResetToDemoDefaults
}) {
  return (
    <div style={UI.pagePad}>
      <IOSListSection header="BODY METRICS" colors={colors}>
        <IOSListRow colors={colors}>
          <span style={UI.rowTitle}>BODYWEIGHT (LBS)</span>
          <input
            type="number"
            value={userBodyweightLbs}
            onChange={e => setUserBodyweightLbs(Number(e.target.value) || 0)}
            style={UI.numInput('90px', 'var(--dp-color-accent)')}
          />
        </IOSListRow>
        <IOSListRow isLast={true} colors={colors}>
          <span style={UI.rowTitle}>HEIGHT (FT / IN)</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="number"
              value={userHeightFeet}
              onChange={e => setUserHeightFeet(Number(e.target.value) || 0)}
              style={UI.numInput('54px')}
            />
            <span style={{ fontSize: '12px', fontWeight: 800 }}>FT</span>
            <input
              type="number"
              value={userHeightInches}
              onChange={e => setUserHeightInches(Number(e.target.value) || 0)}
              style={UI.numInput('54px')}
            />
            <span style={{ fontSize: '12px', fontWeight: 800 }}>IN</span>
          </div>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="STIMULUS" footer="Red threshold is automatically set to Yellow + 1 day." colors={colors}>
        <IOSListRow colors={colors}>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#30D158' }}>GREEN (RECOVERING)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="number"
              min="1"
              value={stimulusGreenDays}
              onChange={e => setStimulusGreenDays(Math.max(1, Number(e.target.value) || 1))}
              style={UI.numInput('58px')}
            />
            <span style={{ fontSize: '11px', fontWeight: 800 }}>DAYS</span>
          </div>
        </IOSListRow>

        <IOSListRow colors={colors}>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFD60A' }}>YELLOW (READY)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="number"
              min={Number(stimulusGreenDays) + 1}
              value={stimulusYellowDays}
              onChange={e =>
                setStimulusYellowDays(Math.max(Number(stimulusGreenDays) + 1, Number(e.target.value) || 4))
              }
              style={UI.numInput('58px')}
            />
            <span style={{ fontSize: '11px', fontWeight: 800 }}>DAYS</span>
          </div>
        </IOSListRow>

        <IOSListRow isLast={true} colors={colors} style={{ opacity: 0.5 }}>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#FF3B30' }}>RED (HIGH PRIORITY)</span>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#A0A0A0' }}>
            {Number(stimulusYellowDays) + 1}+ DAYS (AUTO)
          </span>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="GYMS/EQUIPMENT" colors={colors}>
        <IOSListRow isLast={true} colors={colors} style={{ opacity: 0.45 }}>
          <div>
            <div style={UI.rowTitle}>SMART LOCATIONS</div>
            <div style={UI.rowSub}>COMING SOON</div>
          </div>
          <span style={UI.badge(false)}>LOCKED</span>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection
        header="ROUTINE PREFERENCES"
        footer="Controls the default structure generated when you tap AUTO in Routine Editor."
        colors={colors}
      >
        {routinePreferences.map((comp, idx) => (
          <IOSListRow key={`${comp}_${idx}`} colors={colors}>
            <span style={UI.rowTitle}>0{idx + 1} / {comp}</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                disabled={idx === 0}
                onClick={() =>
                  setRoutinePreferences(prev => {
                    const copy = [...prev];
                    const tmp = copy[idx - 1];
                    copy[idx - 1] = copy[idx];
                    copy[idx] = tmp;
                    return copy;
                  })
                }
                style={UI.pillBtn(false)}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={idx === routinePreferences.length - 1}
                onClick={() =>
                  setRoutinePreferences(prev => {
                    const copy = [...prev];
                    const tmp = copy[idx + 1];
                    copy[idx + 1] = copy[idx];
                    copy[idx] = tmp;
                    return copy;
                  })
                }
                style={UI.pillBtn(false)}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => setRoutinePreferences(prev => prev.filter((_, i) => i !== idx))}
                style={{ ...UI.pillBtn(false), color: '#FF3B30' }}
              >
                ✕
              </button>
            </div>
          </IOSListRow>
        ))}

        <IOSListRow isLast={true} colors={colors}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', width: '100%' }}>
            {['Compounds', 'Supersets', 'Accessories', 'Abs'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setRoutinePreferences(prev => [...prev, type])}
                style={{ ...UI.pillBtn(false), color: 'var(--dp-color-accent)' }}
              >
                + {type}
              </button>
            ))}
          </div>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="SOCIAL" colors={colors}>
        <IOSListRow colors={colors} onClick={() => setShareStatsWithFriends(p => !p)}>
          <span style={UI.rowTitle}>SHARE STATS WITH FRIENDS</span>
          <span style={UI.badge(shareStatsWithFriends)}>{shareStatsWithFriends ? 'ON' : 'OFF'}</span>
        </IOSListRow>

        <IOSListRow isLast={true} colors={colors} onClick={() => setShareRoutinesWithFriends(p => !p)}>
          <span style={UI.rowTitle}>SHARE ROUTINES WITH FRIENDS</span>
          <span style={UI.badge(shareRoutinesWithFriends)}>{shareRoutinesWithFriends ? 'ON' : 'OFF'}</span>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection
        header="DATA & BACKUP (SCHEMA V3)"
        footer="Your workout history, PRs, routines, gyms, and settings are automatically saved to versioned local storage and retained across app updates."
        colors={colors}
      >
        <IOSListRow colors={colors} onClick={handleExportBackupJSON}>
          <span style={UI.rowTitle}>EXPORT DATA BACKUP (.JSON)</span>
          <span style={UI.badge(true)}>DOWNLOAD ↓</span>
        </IOSListRow>

        <IOSListRow colors={colors} onClick={() => importBackupInputRef.current?.click()}>
          <span style={UI.rowTitle}>IMPORT DATA BACKUP (.JSON)</span>
          <span style={{ ...UI.badge(false), color: 'var(--dp-color-accent)' }}>UPLOAD ↑</span>
          <input
            ref={importBackupInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportBackupJSON}
            style={{ display: 'none' }}
          />
        </IOSListRow>

        <IOSListRow isLast={true} colors={colors} onClick={handleResetToDemoDefaults}>
          <span style={{ ...UI.rowTitle, color: '#FF3B30' }}>CLEAR & RESET ALL LOCAL DATA</span>
          <span style={{ ...UI.badge(false), color: '#FF3B30' }}>RESET ↺</span>
        </IOSListRow>
      </IOSListSection>
    </div>
  );
}

export function InfoView({ colors, setCurrentView }) {
  return (
    <div style={UI.pagePad}>
      <IOSListSection header="01 // SETUP: METRICS, GOALS & PRS" colors={colors}>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ lineHeight: 1.5, fontSize: '14px', color: '#E0E0E0' }}>
            <p style={{ marginBottom: '10px' }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>1. BODY METRICS:</strong> Open{' '}
              <strong>MENU → SETTINGS</strong> to enter your current bodyweight and height.
            </p>
            <p style={{ marginBottom: '10px' }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>2. GOALS & STANDARDS:</strong> Open{' '}
              <strong>MENU → GOALS</strong> to choose your focus and select your target ExRx.net strength class.
            </p>
            <p>
              <strong style={{ color: 'var(--dp-color-accent)' }}>3. PERSONAL RECORDS:</strong> Open{' '}
              <strong>HISTORY → PERSONAL RECORDS</strong> and tap any lift to enter your current 1RM.
            </p>
          </div>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="02 // LOGGING & AUTO-BUILDING SESSIONS" colors={colors}>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ lineHeight: 1.5, fontSize: '14px', color: '#E0E0E0' }}>
            <p style={{ marginBottom: '10px' }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>NEW AUTO SHORTCUT:</strong> Tap{' '}
              <strong>NEW AUTO</strong> on the Home screen to immediately start an automatically generated workout with calculated weight levels.
            </p>
            <p>
              <strong style={{ color: 'var(--dp-color-accent)' }}>MANUAL OVERRIDES:</strong> Tap any slot's category, scheme, or exercise dropdown to customize it, use <strong>RECALCULATE</strong> to scale weights to your set count or build warmups to a 1 Rep Max, or tap <strong>✕</strong> to delete a set or exercise.
            </p>
          </div>
        </IOSListRow>
      </IOSListSection>

      <div style={UI.gutterWrap}>
        <button
          type="button"
          onClick={() => setCurrentView('home')}
          className="kinetic-btn"
          style={UI.primaryBtnCenter}
        >
          ENTER WORKSPACE →
        </button>
      </div>
    </div>
  );
}

export function AuthView({
  colors,
  authUsername,
  setAuthUsername,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  signupUsername,
  setSignupUsername,
  signupEmail,
  setSignupEmail,
  signupPassword,
  setSignupPassword,
  signupBetaCode,
  setSignupBetaCode,
  setUser,
  setCurrentView
}) {
  return (
    <div style={UI.pagePad}>
      <IOSListSection header="SIGN IN // EXISTING ACCOUNT" colors={colors}>
        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>USERNAME</div>
            <input
              type="text"
              placeholder="YOUR USERNAME"
              value={authUsername}
              onChange={e => setAuthUsername(e.target.value)}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>
        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>EMAIL</div>
            <input
              type="email"
              placeholder="YOU@DOMAIN.COM"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>PASSWORD</div>
            <input
              type="password"
              placeholder="••••••••"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>
      </IOSListSection>

      <div style={{ padding: '0 var(--dp-spacing-gutter) 24px' }}>
        <button
          type="button"
          onClick={() => {
            const cleanEmail = authEmail.trim();
            const cleanUser = authUsername.trim() || cleanEmail.split('@')[0];
            if (!cleanEmail) return;
            setUser({ id: `usr_${Date.now()}`, username: cleanUser, email: cleanEmail });
            setCurrentView('home');
          }}
          className="kinetic-btn"
          style={UI.secondaryBtnCenter}
        >
          SIGN IN →
        </button>
      </div>

      <IOSListSection
        header="SIGN UP // CREATE ACCOUNT"
        footer="Beta tester access code is required to register a new account."
        colors={colors}
      >
        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>CHOOSE USERNAME</div>
            <input
              type="text"
              placeholder="E.G. IRON_LIFTER"
              value={signupUsername}
              onChange={e => setSignupUsername(e.target.value)}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>

        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>EMAIL ADDRESS</div>
            <input
              type="email"
              placeholder="YOU@DOMAIN.COM"
              value={signupEmail}
              onChange={e => setSignupEmail(e.target.value)}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>

        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>CREATE PASSWORD</div>
            <input
              type="password"
              placeholder="••••••••"
              value={signupPassword}
              onChange={e => setSignupPassword(e.target.value)}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>

        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>BETA TESTER CODE (REQUIRED)</div>
            <input
              type="text"
              placeholder="ENTER BETA CODE"
              value={signupBetaCode}
              onChange={e => setSignupBetaCode(e.target.value)}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>
      </IOSListSection>

      <div style={UI.gutterWrap}>
        <button
          type="button"
          onClick={() => {
            if (signupBetaCode.trim().toLowerCase() !== 'imnotcrying') return;
            const cleanEmail = signupEmail.trim();
            const cleanUser = signupUsername.trim() || (cleanEmail ? cleanEmail.split('@')[0] : '');
            if (!cleanEmail || !cleanUser) return;
            const newUser = { id: `usr_${Date.now()}`, username: cleanUser, email: cleanEmail };
            setUser(newUser);
            setAuthUsername(cleanUser);
            setAuthEmail(cleanEmail);
            setSignupPassword('');
            setSignupBetaCode('');
            setCurrentView('info');
          }}
          className="kinetic-btn"
          style={UI.primaryBtnCenter}
        >
          CREATE ACCOUNT →
        </button>
      </div>
    </div>
  );
}

