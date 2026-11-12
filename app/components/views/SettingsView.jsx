'use client';

import React, { useState } from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import { Button, CollapseToggle, DragNumberBadge } from '../Controls';
import { usePointerReorder } from '../../hooks/usePointerReorder';
import { DEFAULT_SET_PREFERENCES, SET_PREFERENCE_TYPES } from '../../utils/workoutEngine';

/** BODY METRICS: bodyweight row + height row (Settings and the Configuration page's BODY METRICS tab). */
export function BodyMetricsSection({
  colors,
  userBodyweightLbs,
  setUserBodyweightLbs,
  userHeightFeet,
  setUserHeightFeet,
  userHeightInches,
  setUserHeightInches
}) {
  return (
    // No heading: the Configuration tab above already says BODY METRICS
    <IOSListSection colors={colors}>
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
  );
}

/** STIMULUS thresholds (green / yellow days; red = yellow + 1). Shown on the Stimulus page. */
/**
 * A days box that edits like a normal text field: tapping selects the number, backspace clears it, and the typed
 * value is applied on leaving the box or Enter (clamped to at least `min`). Empty or invalid goes back to the saved
 * value. (Clamping on every keystroke put the number straight back when it was cleared and blocked typing "10".)
 */
function DayCountInput({ value, min = 1, onCommit, label }) {
  const [draft, setDraft] = useState(null);
  const commit = () => {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    setDraft(null);
    if (Number.isFinite(n)) onCommit(Math.max(min, n));
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={label}
      value={draft ?? String(value ?? '')}
      onFocus={e => {
        setDraft(String(value ?? ''));
        e.target.select();
      }}
      onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      style={UI.numInput('58px')}
    />
  );
}

export function StimulusSettingsSection({ colors, stimulusGreenDays, setStimulusGreenDays, stimulusYellowDays, setStimulusYellowDays }) {
  return (
    <IOSListSection header="STIMULUS THRESHOLDS" footer="OVERDUE starts the day after RECOVERED ends." colors={colors}>
      <IOSListRow colors={colors}>
<span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: '#30D158' }}>
          <svg width="14" height="14" aria-hidden="true"><rect width="14" height="14" fill="#30D158" /></svg>
          RECOVERING
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <DayCountInput
            label="Recovering days"
            value={stimulusGreenDays}
            min={1}
            onCommit={days => {
              setStimulusGreenDays(days);
              // RECOVERED must end after RECOVERING
              if (Number(stimulusYellowDays) <= days) setStimulusYellowDays(days + 1);
            }}
          />
          <span style={{ fontSize: '11px', fontWeight: 800 }}>DAYS</span>
        </div>
      </IOSListRow>

      <IOSListRow colors={colors}>
<span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: '#FFD60A' }}>
          <svg width="14" height="14" aria-hidden="true"><rect width="14" height="14" fill="#FFD60A" /><rect width="14" height="14" fill="url(#stim-dots)" /></svg>
          RECOVERED
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <DayCountInput
            label="Recovered days"
            value={stimulusYellowDays}
            min={Number(stimulusGreenDays) + 1}
            onCommit={setStimulusYellowDays}
          />
          <span style={{ fontSize: '11px', fontWeight: 800 }}>DAYS</span>
        </div>
      </IOSListRow>

      <IOSListRow isLast={true} colors={colors}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: '#FF3B30' }}>
          <svg width="14" height="14" aria-hidden="true"><rect width="14" height="14" fill="#FF3B30" /><rect width="14" height="14" fill="url(#stim-stripes)" /></svg>
          OVERDUE
        </span>
        <span style={{ fontSize: '13px', fontWeight: 800, color: '#A0A0A0' }}>
          {Number(stimulusYellowDays) + 1}+ DAYS (AUTO)
        </span>
      </IOSListRow>
    </IOSListSection>
  );
}

/** ROUTINE PREFERENCES: the order of exercise types AUTO SESSION / + ADD EXERCISE fill. Configuration → ROUTINES. */
export function RoutinePreferencesSection({ colors, routinePreferences, setRoutinePreferences }) {
  // Drag a row's grippy handle to reorder (same handle as exercises and sets; works with touch)
  const { handleProps, rowDragStyle } = usePointerReorder((from, to) =>
    setRoutinePreferences(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    })
  );
  return (
    <IOSListSection
      header="ROUTINE PREFERENCES"
      footer="The order of exercise types used by AUTO SESSION and + ADD EXERCISE. Drag a handle to reorder."
      colors={colors}
    >
      {routinePreferences.map((comp, idx) => (
        <div
          key={`${comp}_${idx}`}
          data-reorder-index={idx}
          style={{
            display: 'grid',
            gridTemplateColumns: '34px minmax(0, 1fr) 44px',
            alignItems: 'stretch',
            minHeight: '48px',
            borderBottom: '1px solid var(--dp-color-rule)',
            backgroundColor: '#141414',
            // Held row lifts and follows the finger; the landing row is outlined
            ...rowDragStyle(idx)
          }}
        >
          <DragNumberBadge
            label={idx + 1}
            height="48px"
            title="Drag to reorder"
            aria-label={`Drag to reorder ${comp}`}
            {...handleProps(idx)}
          />
          <span style={{ ...UI.rowTitle, display: 'flex', alignItems: 'center', padding: '0 12px' }}>{comp}</span>
          <button
            type="button"
            aria-label={`Remove ${comp}`}
            onClick={() => setRoutinePreferences(prev => prev.filter((_, i) => i !== idx))}
            className="kinetic-btn"
            style={{
              background: 'none',
              border: 'none',
              borderLeft: '1px solid var(--dp-color-rule)',
              color: '#8E8E93',
              fontSize: '16px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
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
  );
}

/**
 * EXERCISE SET PREFERENCES (Configuration → ROUTINES, under ROUTINE PREFERENCES): the type of each set, by position,
 * for new exercises on the uniform rep schemes (5x5, 5x6, 5x8, 5x10, 8x8). Working sets get the goal-progress weight;
 * warm-ups are converted from the same calculated 1RM. Default: Warm-up, Warm-up, Working, Working, Working.
 */
export function SetPreferencesSection({ colors, setPreferences, setSetPreferences }) {
  const prefs = Array.isArray(setPreferences) && setPreferences.length > 0 ? setPreferences : DEFAULT_SET_PREFERENCES;
  const { handleProps, rowDragStyle } = usePointerReorder((from, to) =>
    setSetPreferences(prev => {
      const copy = [...(Array.isArray(prev) && prev.length > 0 ? prev : DEFAULT_SET_PREFERENCES)];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    }),
    { attribute: 'data-set-pref-index' }
  );
  const isDefault = prefs.length === DEFAULT_SET_PREFERENCES.length && prefs.every((t, i) => t === DEFAULT_SET_PREFERENCES[i]);
  const labelFor = t => (t === 'Warmup' ? 'WARM-UP' : t.toUpperCase());
  return (
    <IOSListSection
      header="EXERCISE SET PREFERENCES"
      footer="The type of each set in new exercises. The scheme sets how many sets there are: 5×5, 5×8 and 5×10 use the first 5 rows, 8×8 uses 8 (sets past the end of this list are Working). Working sets get your goal weight; warm-ups are lighter. Drag a handle to reorder."
      colors={colors}
    >
      {prefs.map((type, idx) => (
        <div
          key={`set_pref_${idx}`}
          data-set-pref-index={idx}
          style={{
            display: 'grid',
            gridTemplateColumns: '34px minmax(0, 1fr) 44px',
            alignItems: 'stretch',
            minHeight: '48px',
            borderBottom: '1px solid var(--dp-color-rule)',
            backgroundColor: '#141414',
            ...rowDragStyle(idx)
          }}
        >
          <DragNumberBadge
            label={idx + 1}
            height="48px"
            title="Drag to reorder"
            aria-label={`Drag to reorder set ${idx + 1}`}
            {...handleProps(idx)}
          />
          <select
            className="kinetic-filter-select"
            aria-label={`Set ${idx + 1} type`}
            value={type}
            onChange={e => {
              const next = e.target.value;
              setSetPreferences(prev => {
                const copy = [...(Array.isArray(prev) && prev.length > 0 ? prev : DEFAULT_SET_PREFERENCES)];
                copy[idx] = next;
                return copy;
              });
            }}
            style={{
              width: '100%',
              height: '100%',
              minHeight: '48px',
              border: 'none',
              borderLeft: '1px solid var(--dp-color-rule)',
              fontSize: '14px',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: '#FFFFFF',
              cursor: 'pointer'
            }}
          >
            {SET_PREFERENCE_TYPES.map(t => (
              <option key={t} value={t}>
                {labelFor(t)}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label={`Remove set ${idx + 1}`}
            disabled={prefs.length <= 1}
            onClick={() => setSetPreferences(prev => (Array.isArray(prev) && prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))}
            className="kinetic-btn"
            style={{
              background: 'none',
              border: 'none',
              borderLeft: '1px solid var(--dp-color-rule)',
              color: '#8E8E93',
              fontSize: '16px',
              fontWeight: 800,
              cursor: prefs.length <= 1 ? 'default' : 'pointer',
              opacity: prefs.length <= 1 ? 0.4 : 1
            }}
          >
            ✕
          </button>
        </div>
      ))}

      <IOSListRow isLast={true} colors={colors}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', width: '100%' }}>
          <Button
            variant="toggle"
            onClick={() => setSetPreferences(prev => [...(Array.isArray(prev) && prev.length > 0 ? prev : DEFAULT_SET_PREFERENCES), 'Working'])}
            style={{ color: 'var(--dp-color-accent)', minHeight: '40px' }}
          >
            + ADD SET
          </Button>
          {!isDefault && (
            <Button variant="toggle" onClick={() => setSetPreferences([...DEFAULT_SET_PREFERENCES])} style={{ minHeight: '40px' }}>
              RESET TO DEFAULT
            </Button>
          )}
        </div>
      </IOSListRow>
    </IOSListSection>
  );
}

/** SOCIAL settings: profile visibility and sharing. Shown on the Social page, collapsed by default. */
export function SocialSettingsSection({
  colors,
  profileIsPublic = true,
  setProfileIsPublic,
  shareStatsWithFriends,
  setShareStatsWithFriends,
  shareRoutinesWithFriends,
  setShareRoutinesWithFriends,
  // false = always open, no SHOW / HIDE (the Social page's PRIVACY tab)
  collapsible = true
}) {
  // Starts collapsed; collapsed it shows a one-line summary of the current choices
  const [collapsedState, setCollapsed] = useState(true);
  const collapsed = collapsible && collapsedState;
  const toggle = (
    <CollapseToggle collapsed={collapsed} onClick={() => setCollapsed(v => !v)} label="privacy and sharing" />
  );
  if (collapsed) {
    return (
      <section style={{ marginBottom: '22px', padding: '0 var(--dp-spacing-gutter)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={UI.sectionTitle}>PRIVACY & SHARING</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#A0A0A0', textTransform: 'uppercase' }}>
              {profileIsPublic ? 'PUBLIC' : 'PRIVATE'} • STATS {shareStatsWithFriends ? 'SHARED' : 'NOT SHARED'} • ROUTINES{' '}
              {shareRoutinesWithFriends ? 'SHARED' : 'NOT SHARED'}
            </div>
          </div>
          {toggle}
        </div>
      </section>
    );
  }
  return (
    <IOSListSection
      header="PRIVACY & SHARING"
      headerRight={collapsible ? toggle : null}
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
  );
}

/** DATA & BACKUP: export / import a .json backup and reset local data. Shown at the bottom of the Info page. */
export function DataBackupSection({
  colors,
  importBackupInputRef,
  handleExportBackupJSON,
  handleImportBackupJSON,
  handleResetToDemoDefaults
}) {
  return (
      <IOSListSection
        header="DATA & BACKUP"
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
  );
}
