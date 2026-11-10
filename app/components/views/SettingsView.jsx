'use client';

import React from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import { Button } from '../Controls';

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
  profileIsPublic = true,
  setProfileIsPublic,
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
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFD60A' }}>YELLOW (RECOVERED)</span>
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
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#FF3B30' }}>RED (OVERDUE)</span>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#A0A0A0' }}>
            {Number(stimulusYellowDays) + 1}+ DAYS (AUTO)
          </span>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection
        header="ROUTINE PREFERENCES"
        footer="The order of exercise types used by AUTO SESSION and + ADD EXERCISE."
        colors={colors}
      >
        {routinePreferences.map((comp, idx) => (
          <IOSListRow key={`${comp}_${idx}`} colors={colors}>
            <span style={UI.rowTitle}>0{idx + 1} / {comp}</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <Button
                variant="toggle"
                style={{ width: '40px', height: '40px', padding: 0 }}
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
              >
                ↑
              </Button>
              <Button
                variant="toggle"
                style={{ width: '40px', height: '40px', padding: 0 }}
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
              >
                ↓
              </Button>
              <Button
                variant="toggle"
                onClick={() => setRoutinePreferences(prev => prev.filter((_, i) => i !== idx))}
                style={{ width: '40px', height: '40px', padding: 0, color: '#FF3B30' }}
              >
                ✕
              </Button>
            </div>
          </IOSListRow>
        ))}

        <IOSListRow isLast={true} colors={colors}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', width: '100%' }}>
            {['Compound', 'Accessory', 'Superset'].map(type => (
              <Button
                variant="toggle"
                key={type}
                onClick={() => setRoutinePreferences(prev => [...prev, type])}
                style={{ color: 'var(--dp-color-accent)', minHeight: '40px' }}
              >
                + {type}
              </Button>
            ))}
          </div>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection
        header="SOCIAL"
        footer={
          profileIsPublic
            ? 'PUBLIC: friends can see your friends list on your profile, and you appear in your friends\x27 lists so their friends can send you requests.'
            : 'PRIVATE: your friends list is hidden and you don\x27t appear in other athletes\x27 friend lists.'
        }
        colors={colors}
      >
        <IOSListRow colors={colors} onClick={() => setProfileIsPublic?.(p => !p)}>
          <span style={UI.rowTitle}>PROFILE VISIBILITY</span>
          <span style={UI.badge(profileIsPublic)}>{profileIsPublic ? 'PUBLIC' : 'PRIVATE'}</span>
        </IOSListRow>

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

