'use client';

import React from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';

export function StimulusMapView({
  colors,
  stimulusGreenDays,
  stimulusYellowDays,
  muscleStimulusStatus
}) {
  return (
    <div style={{ paddingTop: '14px' }}>
      <IOSListSection
        header="STIMULUS"
        footer={
          <span>
            <span style={{ color: '#30D158' }}>RECOVERING</span> 0–{stimulusGreenDays}d •{' '}
            <span style={{ color: '#FFD60A' }}>RECOVERED</span> {Number(stimulusGreenDays) + 1}–{stimulusYellowDays}d •{' '}
            <span style={{ color: '#FF3B30' }}>OVERDUE</span> {Number(stimulusYellowDays) + 1}+ days •{' '}
            <span style={{ color: '#8E8E93' }}>GREY</span> not logged yet
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
                <rect x="54" y="28" width="12" height="8" fill={muscleStimulusStatus.Neck?.color || '#4A4A50'} stroke="#101010" strokeWidth="1" />
                <rect x="22" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="82" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="36" width="21" height="28" fill={muscleStimulusStatus.Chest?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="61" y="36" width="21" height="28" fill={muscleStimulusStatus.Chest?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="18" y="60" width="15" height="24" fill={muscleStimulusStatus['Upper Arms']?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="87" y="60" width="15" height="24" fill={muscleStimulusStatus['Upper Arms']?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="18" y="85" width="15" height="23" fill={muscleStimulusStatus.Forearms?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="87" y="85" width="15" height="23" fill={muscleStimulusStatus.Forearms?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="40" y="66" width="40" height="46" fill={muscleStimulusStatus.Waist?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <line x1="60" y1="66" x2="60" y2="112" stroke="#101010" strokeWidth="1.5" />
                <line x1="40" y1="81" x2="80" y2="81" stroke="#101010" strokeWidth="1.5" />
                <line x1="40" y1="96" x2="80" y2="96" stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="116" width="20" height="58" fill={muscleStimulusStatus.Thighs?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="62" y="116" width="20" height="58" fill={muscleStimulusStatus.Thighs?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="40" y="177" width="16" height="44" fill={muscleStimulusStatus.Calves?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="64" y="177" width="16" height="44" fill={muscleStimulusStatus.Calves?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
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
                <rect x="54" y="28" width="12" height="8" fill={muscleStimulusStatus.Neck?.color || '#4A4A50'} stroke="#101010" strokeWidth="1" />
                <rect x="22" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="82" y="36" width="16" height="22" fill={muscleStimulusStatus.Shoulders?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="36" width="44" height="52" fill={muscleStimulusStatus.Back?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <line x1="60" y1="36" x2="60" y2="88" stroke="#101010" strokeWidth="1.5" />
                <rect x="18" y="60" width="15" height="24" fill={muscleStimulusStatus['Upper Arms']?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="87" y="60" width="15" height="24" fill={muscleStimulusStatus['Upper Arms']?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="18" y="85" width="15" height="23" fill={muscleStimulusStatus.Forearms?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="87" y="85" width="15" height="23" fill={muscleStimulusStatus.Forearms?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="42" y="90" width="36" height="22" fill={muscleStimulusStatus.Waist?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="114" width="21" height="24" fill={muscleStimulusStatus.Hips?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="61" y="114" width="21" height="24" fill={muscleStimulusStatus.Hips?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="38" y="140" width="20" height="36" fill={muscleStimulusStatus.Thighs?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="62" y="140" width="20" height="36" fill={muscleStimulusStatus.Thighs?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="40" y="178" width="16" height="43" fill={muscleStimulusStatus.Calves?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
                <rect x="64" y="178" width="16" height="43" fill={muscleStimulusStatus.Calves?.color || '#4A4A50'} stroke="#101010" strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="MUSCLE GROUP TELEMETRY" colors={colors}>
        {Object.entries(muscleStimulusStatus).map(([group, info], idx, arr) => (
          <IOSListRow key={group} isLast={idx === arr.length - 1} colors={colors}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '16px', height: '16px', backgroundColor: info.color, border: '2px solid #FFFFFF', display: 'inline-block' }} />
              <span style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>{group}</span>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 800, color: info.label === 'UNLOGGED' ? '#8E8E93' : info.color, textTransform: 'uppercase' }}>
              {info.label}
            </span>
          </IOSListRow>
        ))}
      </IOSListSection>
    </div>
  );
}

