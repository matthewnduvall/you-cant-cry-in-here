'use client';

import React, { useState, useEffect } from 'react';
import { formatTimerSeconds } from '../utils/workoutEngine';

// ============================================================================
// SF SYMBOL / VECTOR ICON PRIMITIVE, RULED LIST & TIMER BAR COMPONENTS
// ============================================================================

export function SFSymbol({ name, size = 18, color = 'currentColor' }) {
  switch (name) {
    case 'line.3.horizontal':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      );
    case 'chevron.backward':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.8">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      );
    case 'clock':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15.5 14" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );
  }
}

export function IOSListSection({ header, headerRight, footer, children, style }) {
  return (
    <section style={{ marginBottom: '22px', padding: '0 var(--dp-spacing-gutter)', ...style }}>
      {(header || headerRight) && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '8px', marginBottom: '8px'
          }}
        >
          {header && (
            <div
              style={{
                fontSize: '20px', fontWeight: 800, letterSpacing: '-0.04em',
                textTransform: 'uppercase', color: '#FFFFFF', lineHeight: 1.05
              }}
            >
              {header}
            </div>
          )}
          {headerRight}
        </div>
      )}
      <div
        style={{
          border: '2px solid var(--dp-color-rule)',
          backgroundColor: '#141414'
        }}
      >
        {children}
      </div>
      {footer && (
        <div style={{ fontSize: '12px', color: '#9A9A9A', marginTop: '6px', lineHeight: 1.35, fontWeight: 600 }}>
          {footer}
        </div>
      )}
    </section>
  );
}

export function IOSListRow({ children, onClick, isLast = false, indexLabel, bgNumeral, style }) {
  const interactive = typeof onClick === 'function';
  const childArray = React.Children.toArray(children);
  const firstChild = childArray[0] ?? null;
  const restChildren = childArray.length > 1 ? childArray.slice(1) : null;

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick(e);
            }
          }
          : undefined
      }
      className={interactive ? 'kinetic-row-interactive' : ''}
      style={{
        position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '12px', padding: '14px 16px',
        borderBottom: isLast ? 'none' : '2px solid var(--dp-color-rule)',
        backgroundColor: '#141414', color: '#FFFFFF',
        cursor: interactive ? 'pointer' : 'default',
        ...style
      }}
    >
      {bgNumeral && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', right: '36px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '54px', fontWeight: 800, color: 'var(--dp-color-decorative)',
            lineHeight: 1, pointerEvents: 'none', userSelect: 'none', zIndex: 0
          }}
        >
          {bgNumeral}
        </span>
      )}
      <div
        style={{
          position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '12px', width: '100%'
        }}
      >
        {indexLabel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <span
              className="kinetic-sub"
              style={{
                fontSize: '11px', fontWeight: 800, color: 'var(--dp-color-accent)',
                letterSpacing: '0.06em', flexShrink: 0
              }}
            >
              {indexLabel}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>{firstChild}</div>
          </div>
        ) : (
          firstChild
        )}
        {restChildren}
      </div>
    </div>
  );
}

export const SessionRestTimerBar = React.memo(function SessionRestTimerBar({
  defaultRestSeconds = 90,
  timerTrigger,
  nextLiftInfo = { topLine: '', bottomLine: '' },
  onChangeDefaultRest,
  onStopTimer,
  // Optional: shows a ✓ cell on the right that finishes the session (opens the save confirmation).
  // Grey like an unchecked set until markDoneActive (the athlete tapped it), then green.
  onMarkDone,
  markDoneActive = false
}) {
  const [remaining, setRemaining] = useState(defaultRestSeconds);

  useEffect(() => {
    if (!timerTrigger.isRunning || !timerTrigger.startedAtMs) {
      setRemaining(timerTrigger.targetSeconds || defaultRestSeconds);
      return;
    }
    const update = () => {
      const elapsed = Math.floor((Date.now() - timerTrigger.startedAtMs) / 1000);
      setRemaining(timerTrigger.targetSeconds - elapsed);
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [timerTrigger, defaultRestSeconds]);

  return (
    <div
      style={{
        marginTop: '10px',
        display: 'grid',
        gridTemplateColumns: onMarkDone ? '120px minmax(0, 1fr) 52px' : '120px minmax(0, 1fr)',
        alignItems: 'stretch',
        gap: 0,
        height: '46px',
        boxSizing: 'border-box',
        borderTop: '1px solid var(--dp-color-rule)',
        borderLeft: '1px solid var(--dp-color-rule)'
      }}
    >
      {timerTrigger.isRunning ? (
        <button
          type="button"
          onClick={onStopTimer}
          title="Tap to stop rest timer"
          className="kinetic-btn"
          style={{
            width: '100%',
            height: '45px',
            minHeight: '45px',
            maxHeight: '45px',
            boxSizing: 'border-box',
            backgroundColor: '#FF3B30',
            color: '#FFFFFF',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: '1px solid var(--dp-color-rule)',
            borderBottom: '1px solid var(--dp-color-rule)',
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 800,
            textTransform: 'uppercase',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden'
          }}
        >
          <SFSymbol name="clock" size={14} color="#FFFFFF" />
          <span>{formatTimerSeconds(remaining)}</span>
        </button>
      ) : (
        <div
          style={{
            width: '100%',
            height: '45px',
            minHeight: '45px',
            maxHeight: '45px',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: '#141416',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: '1px solid var(--dp-color-rule)',
            borderBottom: '1px solid var(--dp-color-rule)',
            padding: '0 8px',
            overflow: 'hidden'
          }}
        >
          <SFSymbol name="clock" size={14} color="var(--dp-color-accent)" />
          <select
            value={defaultRestSeconds}
            onChange={e => onChangeDefaultRest(Number(e.target.value))}
            style={{
              backgroundColor: 'transparent',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '12px',
              fontWeight: 800,
              textTransform: 'uppercase',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value={60} style={{ backgroundColor: '#101010' }}>REST 1:00</option>
            <option value={90} style={{ backgroundColor: '#101010' }}>REST 1:30</option>
            <option value={120} style={{ backgroundColor: '#101010' }}>REST 2:00</option>
            <option value={180} style={{ backgroundColor: '#101010' }}>REST 3:00</option>
          </select>
        </div>
      )}

      <div
        style={{
          minWidth: 0,
          width: '100%',
          height: '45px',
          minHeight: '45px',
          maxHeight: '45px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 12px',
          backgroundColor: 'var(--dp-color-accent)',
          color: '#101010',
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: '1px solid var(--dp-color-rule)',
          borderBottom: '1px solid var(--dp-color-rule)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 800,
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textTransform: 'uppercase'
          }}
        >
          {nextLiftInfo.topLine || 'NO EXERCISES QUEUED'}
        </div>
        {nextLiftInfo.bottomLine ? (
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: 800,
              lineHeight: 1.15,
              opacity: 0.9,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textTransform: 'uppercase',
              marginTop: '2px'
            }}
          >
            {nextLiftInfo.bottomLine}
          </div>
        ) : null}
      </div>

      {onMarkDone ? (
        <button
          type="button"
          onClick={onMarkDone}
          aria-label="Finish session"
          aria-pressed={markDoneActive}
          title="Finish session"
          className="kinetic-btn"
          style={{
            width: '100%',
            height: '45px',
            boxSizing: 'border-box',
            backgroundColor: markDoneActive ? '#30D158' : '#242428',
            color: markDoneActive ? '#101010' : '#9A9A9A',
            border: 'none',
            borderRight: '1px solid var(--dp-color-rule)',
            borderBottom: '1px solid var(--dp-color-rule)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            fontWeight: 800,
            cursor: 'pointer',
            padding: 0
          }}
        >
          ✓
        </button>
      ) : null}
    </div>
  );
});

