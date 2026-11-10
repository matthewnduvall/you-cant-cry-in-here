'use client';

import React from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import { StimulusSettingsSection } from './SettingsView';

// Status is shown by pattern as well as colour (red / green alone is hard to tell apart with colour blindness):
// OVERDUE = diagonal stripes, RECOVERED = dots, RECOVERING = solid, never logged = solid grey.
const statusPattern = label =>
  /OVERDUE/.test(label || '') ? 'url(#stim-stripes)' : /RECOVERED/.test(label || '') ? 'url(#stim-dots)' : null;

function MuscleRect({ status, strokeWidth, ...rect }) {
  const pattern = statusPattern(status?.label);
  return (
    <g>
      <rect {...rect} fill={status?.color || '#4A4A50'} stroke="#101010" strokeWidth={strokeWidth} />
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
  muscleStimulusStatus
}) {
  return (
    <div style={{ paddingTop: '14px' }}>
      <StimulusPatternDefs />
      <IOSListSection
        header="STIMULUS"
        footer={
          // Vertical legend: swatch (colour + pattern) | status | days since last trained
          <span
            style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', columnGap: '6px', rowGap: '4px', alignItems: 'center', lineHeight: 1.4 }}
          >
            {[
              { color: '#30D158', label: 'RECOVERING', text: '#30D158', range: `0–${stimulusGreenDays} DAYS` },
              {
                color: '#FFD60A',
                pattern: 'url(#stim-dots)',
                label: 'RECOVERED',
                text: '#FFD60A',
                range: `${Number(stimulusGreenDays) + 1}–${stimulusYellowDays} DAYS`
              },
              {
                color: '#FF3B30',
                pattern: 'url(#stim-stripes)',
                label: 'OVERDUE',
                text: '#FF3B30',
                range: `${Number(stimulusYellowDays) + 1}+ DAYS`
              },
              { color: '#4A4A50', label: 'UNLOGGED', text: '#8E8E93', range: 'NOT LOGGED YET' }
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
        }
        colors={colors}
      >
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '8px 0' }}>
            <div
              style={{
                border: '2px solid var(--dp-color-rule)', backgroundColor: '#101010',
                padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--dp-color-accent)', letterSpacing: '0.06em', marginBottom: '8px' }}>
                ANTERIOR // FRONT
              </div>
              <svg viewBox="0 0 120 230" style={{ width: '100%', maxWidth: '135px', height: 'auto' }}>
                <rect x="50" y="6" width="20" height="22" fill="#262626" stroke="#5C5C5C" strokeWidth="1.5" />
                <MuscleRect x="54" y="28" width="12" height="8" status={muscleStimulusStatus.Neck} strokeWidth="1" />
                <MuscleRect x="22" y="36" width="16" height="22" status={muscleStimulusStatus.Shoulders} strokeWidth="1.5" />
                <MuscleRect x="82" y="36" width="16" height="22" status={muscleStimulusStatus.Shoulders} strokeWidth="1.5" />
                <MuscleRect x="38" y="36" width="21" height="28" status={muscleStimulusStatus.Chest} strokeWidth="1.5" />
                <MuscleRect x="61" y="36" width="21" height="28" status={muscleStimulusStatus.Chest} strokeWidth="1.5" />
                <MuscleRect x="18" y="60" width="15" height="24" status={muscleStimulusStatus['Upper Arms']} strokeWidth="1.5" />
                <MuscleRect x="87" y="60" width="15" height="24" status={muscleStimulusStatus['Upper Arms']} strokeWidth="1.5" />
                <MuscleRect x="18" y="85" width="15" height="23" status={muscleStimulusStatus.Forearms} strokeWidth="1.5" />
                <MuscleRect x="87" y="85" width="15" height="23" status={muscleStimulusStatus.Forearms} strokeWidth="1.5" />
                <MuscleRect x="40" y="66" width="40" height="46" status={muscleStimulusStatus.Waist} strokeWidth="1.5" />
                <line x1="60" y1="66" x2="60" y2="112" stroke="#101010" strokeWidth="1.5" />
                <line x1="40" y1="81" x2="80" y2="81" stroke="#101010" strokeWidth="1.5" />
                <line x1="40" y1="96" x2="80" y2="96" stroke="#101010" strokeWidth="1.5" />
                <MuscleRect x="38" y="116" width="20" height="58" status={muscleStimulusStatus.Thighs} strokeWidth="1.5" />
                <MuscleRect x="62" y="116" width="20" height="58" status={muscleStimulusStatus.Thighs} strokeWidth="1.5" />
                <MuscleRect x="40" y="177" width="16" height="44" status={muscleStimulusStatus.Calves} strokeWidth="1.5" />
                <MuscleRect x="64" y="177" width="16" height="44" status={muscleStimulusStatus.Calves} strokeWidth="1.5" />
              </svg>
            </div>

            <div
              style={{
                border: '2px solid var(--dp-color-rule)', backgroundColor: '#101010',
                padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--dp-color-accent)', letterSpacing: '0.06em', marginBottom: '8px' }}>
                POSTERIOR // BACK
              </div>
              <svg viewBox="0 0 120 230" style={{ width: '100%', maxWidth: '135px', height: 'auto' }}>
                <rect x="50" y="6" width="20" height="22" fill="#262626" stroke="#5C5C5C" strokeWidth="1.5" />
                <MuscleRect x="54" y="28" width="12" height="8" status={muscleStimulusStatus.Neck} strokeWidth="1" />
                <MuscleRect x="22" y="36" width="16" height="22" status={muscleStimulusStatus.Shoulders} strokeWidth="1.5" />
                <MuscleRect x="82" y="36" width="16" height="22" status={muscleStimulusStatus.Shoulders} strokeWidth="1.5" />
                <MuscleRect x="38" y="36" width="44" height="52" status={muscleStimulusStatus.Back} strokeWidth="1.5" />
                <line x1="60" y1="36" x2="60" y2="88" stroke="#101010" strokeWidth="1.5" />
                <MuscleRect x="18" y="60" width="15" height="24" status={muscleStimulusStatus['Upper Arms']} strokeWidth="1.5" />
                <MuscleRect x="87" y="60" width="15" height="24" status={muscleStimulusStatus['Upper Arms']} strokeWidth="1.5" />
                <MuscleRect x="18" y="85" width="15" height="23" status={muscleStimulusStatus.Forearms} strokeWidth="1.5" />
                <MuscleRect x="87" y="85" width="15" height="23" status={muscleStimulusStatus.Forearms} strokeWidth="1.5" />
                <MuscleRect x="42" y="90" width="36" height="22" status={muscleStimulusStatus.Waist} strokeWidth="1.5" />
                <MuscleRect x="38" y="114" width="21" height="24" status={muscleStimulusStatus.Hips} strokeWidth="1.5" />
                <MuscleRect x="61" y="114" width="21" height="24" status={muscleStimulusStatus.Hips} strokeWidth="1.5" />
                <MuscleRect x="38" y="140" width="20" height="36" status={muscleStimulusStatus.Thighs} strokeWidth="1.5" />
                <MuscleRect x="62" y="140" width="20" height="36" status={muscleStimulusStatus.Thighs} strokeWidth="1.5" />
                <MuscleRect x="40" y="178" width="16" height="43" status={muscleStimulusStatus.Calves} strokeWidth="1.5" />
                <MuscleRect x="64" y="178" width="16" height="43" status={muscleStimulusStatus.Calves} strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="MUSCLE GROUP TELEMETRY" colors={colors}>
        {Object.entries(muscleStimulusStatus).map(([group, info], idx, arr) => (
          <IOSListRow key={group} isLast={idx === arr.length - 1} colors={colors}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ border: '2px solid #FFFFFF', display: 'inline-flex', lineHeight: 0 }}>
                <svg width="14" height="14" aria-hidden="true">
                  <rect width="14" height="14" fill={info.color} />
                  {statusPattern(info.label) && <rect width="14" height="14" fill={statusPattern(info.label)} />}
                </svg>
              </span>
              <span style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>{group}</span>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 800, color: info.label === 'UNLOGGED' ? '#8E8E93' : info.color, textTransform: 'uppercase' }}>
              {info.label}
            </span>
          </IOSListRow>
        ))}
      </IOSListSection>

      <StimulusSettingsSection
        colors={colors}
        stimulusGreenDays={stimulusGreenDays}
        setStimulusGreenDays={setStimulusGreenDays}
        stimulusYellowDays={stimulusYellowDays}
        setStimulusYellowDays={setStimulusYellowDays}
      />
    </div>
  );
}

