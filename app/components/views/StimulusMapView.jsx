'use client';

import React, { useState } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import { StimulusSettingsSection } from './SettingsView';
import { STIMULUS_WHITE, STIMULUS_YELLOW, STIMULUS_RED } from '../../hooks/useTelemetryAndAnalytics';

// Status is shown by pattern as well as colour (red / green alone is hard to tell apart with colour blindness):
// OVERDUE = diagonal stripes, RECOVERED = dots, RECOVERING = solid, never logged = solid grey.
const statusPattern = label =>
  /OVERDUE/.test(label || '') ? 'url(#stim-stripes)' : /RECOVERED/.test(label || '') ? 'url(#stim-dots)' : null;

// One body part on the map. Tapping (or Enter / Space) selects its muscle group: the readout under the map
// names it and says when it was last trained, and every box of that group gets a white outline.
function MuscleRect({ group, statusMap, selected, onSelect, strokeWidth, ...rect }) {
  const status = statusMap?.[group];
  const pattern = statusPattern(status?.label);
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${group}: ${status?.label || 'UNLOGGED'}`}
      aria-pressed={selected}
      onClick={() => onSelect?.(group)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(group);
        }
      }}
      style={{ cursor: 'pointer', outline: 'none' }}
    >
      <rect {...rect} fill={status?.color || '#3A3A3A'} stroke={selected ? '#FFFFFF' : '#000000'} strokeWidth={selected ? 2.5 : strokeWidth} />
      {pattern && <rect {...rect} fill={pattern} stroke="none" pointerEvents="none" />}
    </g>
  );
}

function StimulusPatternDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="stim-stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2.5" height="6" fill="rgba(0, 0, 0, 0.5)" />
        </pattern>
        <pattern id="stim-dots" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="1.1" fill="rgba(0, 0, 0, 0.55)" />
        </pattern>
      </defs>
    </svg>
  );
}

// Small legend swatch with the same colour + pattern as the map
function StatusSwatch({ color, pattern, size = 12 }) {
  return (
    <svg width={size} height={size} style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '4px' }} aria-hidden="true">
      <rect width={size} height={size} fill={color} />
      {pattern && <rect width={size} height={size} fill={pattern} />}
    </svg>
  );
}

export function StimulusMapView({
  colors,
  stimulusGreenDays,
  stimulusYellowDays,
  setStimulusGreenDays,
  setStimulusYellowDays,
  muscleStimulusStatus,
  // The shared value pop-up (STIMULUS THRESHOLDS day boxes)
  setSetValueTarget
}) {
  // Tapped muscle group (null = none yet)
  const [selectedGroup, setSelectedGroup] = useState(null);
  const part = group => ({
    group,
    statusMap: muscleStimulusStatus,
    selected: selectedGroup === group,
    onSelect: g => setSelectedGroup(prev => (prev === g ? null : g))
  });
  const selectedStatus = selectedGroup ? muscleStimulusStatus?.[selectedGroup] : null;
  return (
    <div style={{ paddingTop: '14px' }}>
      <StimulusPatternDefs />
      <IOSListSection
        footer={
          // The colour blends smoothly from white (just trained) through yellow (recovered) to red (overdue): a
          // gradient bar, then the vertical legend: swatch (colour + pattern) | status | days since last trained
          <>
          <span
            aria-hidden="true"
            style={{
              display: 'block',
              height: '8px',
              borderRadius: '4px',
              margin: '2px 0 10px',
              background: `linear-gradient(90deg, ${STIMULUS_WHITE} 0%, ${STIMULUS_YELLOW} ${Math.round(
                ((Number(stimulusGreenDays) + 1) / (Number(stimulusYellowDays) + 1)) * 100
              )}%, ${STIMULUS_RED} 100%)`
            }}
          />
          <span
            style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', columnGap: '6px', rowGap: '4px', alignItems: 'center', lineHeight: 1.4 }}
          >
            {[
              { color: STIMULUS_WHITE, label: 'RECOVERING', text: '#FFFFFF', range: `0–${stimulusGreenDays} DAYS` },
              {
                color: STIMULUS_YELLOW,
                pattern: 'url(#stim-dots)',
                label: 'RECOVERED',
                text: STIMULUS_YELLOW,
                range: `${Number(stimulusGreenDays) + 1}–${stimulusYellowDays} DAYS`
              },
              {
                color: '#FF4A3D',
                pattern: 'url(#stim-stripes)',
                label: 'OVERDUE',
                text: '#FF4A3D',
                range: `${Number(stimulusYellowDays) + 1}+ DAYS`
              },
              { color: '#3A3A3A', label: 'UNLOGGED', text: '#9A9A9A', range: 'NOT LOGGED YET' }
            ].map(item => (
              <React.Fragment key={item.label}>
                <span style={{ lineHeight: 0 }}>
                  <StatusSwatch color={item.color} pattern={item.pattern} />
                </span>
                <span style={{ color: item.text }}>{item.label}</span>
                <span>{item.range}</span>
              </React.Fragment>
            ))}
          </span>
          </>
        }
        colors={colors}
      >
        <IOSListRow colors={colors}>
          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '8px 0' }}>
            <div
              style={{
                border: 'none', borderRadius: '10px', backgroundColor: '#000000',
                padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--dp-color-accent)', letterSpacing: '0.06em', marginBottom: '8px' }}>
                ANTERIOR // FRONT
              </div>
              <svg viewBox="0 0 120 230" style={{ width: '100%', maxWidth: '135px', height: 'auto' }}>
                <rect x="50" y="6" width="20" height="22" fill="#262626" stroke="#3A3A3A" strokeWidth="1.5" />
                <MuscleRect x="54" y="28" width="12" height="8" {...part('Neck')} strokeWidth="1" />
                <MuscleRect x="22" y="36" width="16" height="22" {...part('Shoulders')} strokeWidth="1.5" />
                <MuscleRect x="82" y="36" width="16" height="22" {...part('Shoulders')} strokeWidth="1.5" />
                <MuscleRect x="38" y="36" width="21" height="28" {...part('Chest')} strokeWidth="1.5" />
                <MuscleRect x="61" y="36" width="21" height="28" {...part('Chest')} strokeWidth="1.5" />
                <MuscleRect x="18" y="60" width="15" height="24" {...part('Upper Arms')} strokeWidth="1.5" />
                <MuscleRect x="87" y="60" width="15" height="24" {...part('Upper Arms')} strokeWidth="1.5" />
                <MuscleRect x="18" y="85" width="15" height="23" {...part('Forearms')} strokeWidth="1.5" />
                <MuscleRect x="87" y="85" width="15" height="23" {...part('Forearms')} strokeWidth="1.5" />
                <MuscleRect x="40" y="66" width="40" height="46" {...part('Core')} strokeWidth="1.5" />
                <line x1="60" y1="66" x2="60" y2="112" stroke="#000000" strokeWidth="1.5" />
                <line x1="40" y1="81" x2="80" y2="81" stroke="#000000" strokeWidth="1.5" />
                <line x1="40" y1="96" x2="80" y2="96" stroke="#000000" strokeWidth="1.5" />
                <MuscleRect x="38" y="116" width="20" height="58" {...part('Thighs')} strokeWidth="1.5" />
                <MuscleRect x="62" y="116" width="20" height="58" {...part('Thighs')} strokeWidth="1.5" />
                <MuscleRect x="40" y="177" width="16" height="44" {...part('Calves')} strokeWidth="1.5" />
                <MuscleRect x="64" y="177" width="16" height="44" {...part('Calves')} strokeWidth="1.5" />
              </svg>
            </div>

            <div
              style={{
                border: 'none', borderRadius: '10px', backgroundColor: '#000000',
                padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--dp-color-accent)', letterSpacing: '0.06em', marginBottom: '8px' }}>
                POSTERIOR // BACK
              </div>
              <svg viewBox="0 0 120 230" style={{ width: '100%', maxWidth: '135px', height: 'auto' }}>
                <rect x="50" y="6" width="20" height="22" fill="#262626" stroke="#3A3A3A" strokeWidth="1.5" />
                <MuscleRect x="54" y="28" width="12" height="8" {...part('Neck')} strokeWidth="1" />
                <MuscleRect x="22" y="36" width="16" height="22" {...part('Shoulders')} strokeWidth="1.5" />
                <MuscleRect x="82" y="36" width="16" height="22" {...part('Shoulders')} strokeWidth="1.5" />
                <MuscleRect x="38" y="36" width="44" height="52" {...part('Back')} strokeWidth="1.5" />
                <line x1="60" y1="36" x2="60" y2="88" stroke="#000000" strokeWidth="1.5" />
                <MuscleRect x="18" y="60" width="15" height="24" {...part('Upper Arms')} strokeWidth="1.5" />
                <MuscleRect x="87" y="60" width="15" height="24" {...part('Upper Arms')} strokeWidth="1.5" />
                <MuscleRect x="18" y="85" width="15" height="23" {...part('Forearms')} strokeWidth="1.5" />
                <MuscleRect x="87" y="85" width="15" height="23" {...part('Forearms')} strokeWidth="1.5" />
                <MuscleRect x="42" y="90" width="36" height="22" {...part('Core')} strokeWidth="1.5" />
                <MuscleRect x="38" y="114" width="21" height="24" {...part('Hips')} strokeWidth="1.5" />
                <MuscleRect x="61" y="114" width="21" height="24" {...part('Hips')} strokeWidth="1.5" />
                <MuscleRect x="38" y="140" width="20" height="36" {...part('Thighs')} strokeWidth="1.5" />
                <MuscleRect x="62" y="140" width="20" height="36" {...part('Thighs')} strokeWidth="1.5" />
                <MuscleRect x="40" y="178" width="16" height="43" {...part('Calves')} strokeWidth="1.5" />
                <MuscleRect x="64" y="178" width="16" height="43" {...part('Calves')} strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        </IOSListRow>
        <IOSListRow isLast={true} colors={colors}>
          <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '24px', width: '100%' }}>
            {selectedGroup ? (
              <>
                <StatusSwatch color={selectedStatus?.color || '#3A3A3A'} pattern={statusPattern(selectedStatus?.label)} size={14} />
                <span style={{ fontSize: '15px', fontWeight: 500, textTransform: 'uppercase' }}>{selectedGroup}</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '12px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    color: !selectedStatus || selectedStatus.label === 'UNLOGGED' ? '#9A9A9A' : selectedStatus.color
                  }}
                >
                  {selectedStatus?.label === 'UNLOGGED' || !selectedStatus ? 'NOT LOGGED YET' : selectedStatus.label}
                </span>
              </>
            ) : (
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A' }}>
                Tap a muscle group to see when you last trained it.
              </span>
            )}
          </div>
        </IOSListRow>
      </IOSListSection>

      <StimulusSettingsSection
        colors={colors}
        stimulusGreenDays={stimulusGreenDays}
        setStimulusGreenDays={setStimulusGreenDays}
        stimulusYellowDays={stimulusYellowDays}
        setStimulusYellowDays={setStimulusYellowDays}
        setSetValueTarget={setSetValueTarget}
      />
    </div>
  );
}

