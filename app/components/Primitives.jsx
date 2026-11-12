'use client';

import React, { useState, useEffect } from 'react';
import { UI } from '../styles/kineticTokens';
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
            <div style={UI.sectionTitle}>{header}</div>
          )}
          {headerRight}
        </div>
      )}
      {/* List group: a graphite tile (no border around it), rows divided by hairlines; it clips its rows' corners */}
      <div
        style={{
          backgroundColor: '#1C1C1C',
          borderRadius: '14px',
          overflow: 'hidden'
        }}
      >
        {children}
      </div>
      {footer && (
        <div style={{ fontSize: '13px', color: '#9A9A9A', marginTop: '6px', paddingLeft: '4px', lineHeight: 1.35, fontWeight: 400 }}>
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
        justifyContent: 'space-between', gap: '12px', padding: '14px 16px', minHeight: '56px',
        borderBottom: isLast ? 'none' : '1px solid var(--dp-color-rule)',
        backgroundColor: '#1C1C1C', color: '#FFFFFF',
        cursor: interactive ? 'pointer' : 'default',
        ...style
      }}
    >
      {bgNumeral && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', right: '36px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '54px', fontWeight: 300, color: 'var(--dp-color-decorative)',
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
                fontSize: '11px', fontWeight: 500, color: '#9A9A9A',
                letterSpacing: '0.1em', flexShrink: 0
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

/**
 * Locked header row above the rest timer: editable session name + SYNC + green SAVE (`saveLabel`; FINISH in a live
 * session) + red RESET.
 * SAVE / RESET appear only when the workout has exercises (showActions); SYNC only when `sync` is given:
 * { status: 'idle' | 'pending' | 'synced', onClick }.
 */
// Width of the header's SYNC / SAVE / RESET cells and the rest-timer bar's ✓ cell. They share it so the orange
// NEXT bar ends exactly under the SAVE | RESET divider.
const SESSION_ACTION_COL = '58px';
// DATE box beside the session name (fits YYYY/MM/DD)
const SESSION_DATE_COL = '100px';

export function SessionTitleBar({
  title = '',
  onChangeTitle,
  onSave,
  onReset,
  showActions = false,
  sync = null,
  saveLabel = 'SAVE',
  // Live session: the session's date (YYYY/MM/DD, from startedAt) in its own box; typing a date moves the session
  dateValue = null,
  onChangeDate
}) {
  const cellBorder = {
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: '1px solid var(--dp-color-rule)',
    borderBottom: '1px solid var(--dp-color-rule)'
  };
  const actionStyle = (bg, color) => ({
    width: '100%',
    height: '40px',
    boxSizing: 'border-box',
    backgroundColor: bg,
    color,
    ...cellBorder,
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    padding: 0
  });
  return (
    <div
      style={{
        marginTop: '8px',
        display: 'grid',
        gridTemplateColumns: [
          'minmax(0, 1fr)',
          dateValue ? SESSION_DATE_COL : null,
          sync ? SESSION_ACTION_COL : null,
          showActions ? `${SESSION_ACTION_COL} ${SESSION_ACTION_COL}` : null
        ]
          .filter(Boolean)
          .join(' '),
        alignItems: 'stretch',
        gap: 0,
        // Top half of the session tile (the rest-timer bar is the bottom half)
        backgroundColor: '#1C1C1C',
        borderRadius: '12px 12px 0 0',
        overflow: 'hidden'
      }}
    >
      <label
        style={{
          minWidth: 0,
          height: '40px',
          boxSizing: 'border-box',
          backgroundColor: '#1C1C1C',
          ...cellBorder,
          padding: '0 10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em', color: '#9A9A9A', lineHeight: 1.1 }}>
          SESSION NAME
        </span>
        <input
          type="text"
          aria-label="Session name"
          value={title}
          onChange={e => onChangeTitle?.(e.target.value)}
          style={{
            width: '100%',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: 500,
            outline: 'none',
            padding: 0,
            marginTop: '2px',
            lineHeight: 1.2,
            textOverflow: 'ellipsis'
          }}
        />
      </label>
      {dateValue && (
        <label
          style={{
            minWidth: 0,
            height: '40px',
            boxSizing: 'border-box',
            backgroundColor: '#1C1C1C',
            ...cellBorder,
            padding: '0 6px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em', color: '#9A9A9A', lineHeight: 1.1 }}>DATE</span>
          <input
            key={dateValue}
            type="text"
            inputMode="numeric"
            aria-label="Session date (YYYY/MM/DD)"
            placeholder="YYYY/MM/DD"
            defaultValue={dateValue}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            onBlur={e => {
              const next = e.target.value.trim().replace(/-/g, '/');
              const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(next);
              const valid = match && !Number.isNaN(new Date(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}T12:00:00`).getTime());
              if (!valid) {
                e.target.value = dateValue;
                return;
              }
              if (next !== dateValue) onChangeDate?.(next);
            }}
            style={{
              width: '100%',
              minWidth: 0,
              backgroundColor: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 500,
              outline: 'none',
              padding: 0,
              marginTop: '2px',
              lineHeight: 1.2,
              fontFamily: 'inherit'
            }}
          />
        </label>
      )}
      {sync && (
        <button
          type="button"
          className="kinetic-btn"
          aria-label={sync.status === 'synced' ? 'Session synced with a friend' : 'Sync session with a friend'}
          onClick={sync.onClick}
          style={{
            // Linked: white fill, black text (selected), like an active pill
            ...actionStyle(sync.status === 'synced' ? '#FFFFFF' : '#2A2A2A', sync.status === 'synced' ? '#000000' : '#FFFFFF'),
            fontSize: sync.status === 'synced' ? '10px' : '11px'
          }}
        >
          {sync.status === 'synced' ? 'SYNCED' : sync.status === 'pending' ? 'SYNC…' : 'SYNC'}
        </button>
      )}
      {showActions && (
        <>
          {/* FINISH / SAVE: the screen's one red action; RESET: destructive red text on graphite */}
          <button
            type="button"
            className="kinetic-btn"
            onClick={onSave}
            style={{ ...actionStyle('var(--cr-red)', '#FFFFFF'), fontWeight: 600 }}
          >
            {saveLabel}
          </button>
          <button type="button" className="kinetic-btn" onClick={onReset} style={actionStyle('#1C1C1C', 'var(--cr-red-text)')}>
            RESET
          </button>
        </>
      )}
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
  markDoneActive = false,
  // Sits flush under SessionTitleBar (no gap, shares its bottom border)
  flushTop = false
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
        marginTop: flushTop ? 0 : '10px',
        display: 'grid',
        gridTemplateColumns: onMarkDone ? `120px minmax(0, 1fr) ${SESSION_ACTION_COL}` : '120px minmax(0, 1fr)',
        alignItems: 'stretch',
        gap: 0,
        height: flushTop ? '40px' : '41px',
        boxSizing: 'border-box',
        // Bottom half of the session tile under SessionTitleBar (a tile of its own when not flush)
        backgroundColor: '#1C1C1C',
        borderRadius: flushTop ? '0 0 12px 12px' : '12px',
        overflow: 'hidden'
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
            height: '40px',
            minHeight: '40px',
            maxHeight: '40px',
            boxSizing: 'border-box',
            // Counting down: the time in red text on the tile (the red fill is kept for FINISH)
            backgroundColor: '#1C1C1C',
            color: 'var(--cr-red-text)',
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
            fontWeight: 500,
            textTransform: 'uppercase',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden'
          }}
        >
          <SFSymbol name="clock" size={14} color="var(--cr-red-text)" />
          <span style={{ fontSize: '17px', fontWeight: 400 }}>{formatTimerSeconds(remaining)}</span>
        </button>
      ) : (
        <div
          style={{
            width: '100%',
            height: '40px',
            minHeight: '40px',
            maxHeight: '40px',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: '#1C1C1C',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: '1px solid var(--dp-color-rule)',
            borderBottom: '1px solid var(--dp-color-rule)',
            padding: '0 8px',
            overflow: 'hidden'
          }}
        >
          <SFSymbol name="clock" size={14} color="#9A9A9A" />
          <select
            value={defaultRestSeconds}
            onChange={e => onChangeDefaultRest(Number(e.target.value))}
            style={{
              // Fills the whole timer cell so the full 40 px box is the tap target
              flex: 1,
              alignSelf: 'stretch',
              minWidth: 0,
              backgroundColor: 'transparent',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '12px',
              fontWeight: 500,
              textTransform: 'uppercase',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value={60} style={{ backgroundColor: '#000000' }}>REST 1:00</option>
            <option value={90} style={{ backgroundColor: '#000000' }}>REST 1:30</option>
            <option value={120} style={{ backgroundColor: '#000000' }}>REST 2:00</option>
            <option value={180} style={{ backgroundColor: '#000000' }}>REST 3:00</option>
          </select>
        </div>
      )}

      <div
        style={{
          minWidth: 0,
          width: '100%',
          height: '40px',
          minHeight: '40px',
          maxHeight: '40px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 12px 0 22px',
          position: 'relative',
          // NEXT: an info line on graphite, with a red dot while there is a set to do
          backgroundColor: '#1C1C1C',
          color: '#FFFFFF',
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: '1px solid var(--dp-color-rule)',
          borderBottom: '1px solid var(--dp-color-rule)',
          overflow: 'hidden'
        }}
      >
        {nextLiftInfo.topLine ? (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', left: '10px', top: '50%', width: '6px', height: '6px', marginTop: '-3px',
              borderRadius: '50%', backgroundColor: 'var(--cr-red)'
            }}
          />
        ) : null}
        <div
          style={{
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.06em',
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
              fontSize: '11px',
              fontWeight: 400,
              lineHeight: 1.15,
              color: '#BDBDBD',
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
            height: '40px',
            boxSizing: 'border-box',
            backgroundColor: markDoneActive ? '#FFFFFF' : '#2A2A2A',
            color: markDoneActive ? '#000000' : '#9A9A9A',
            border: 'none',
            borderRight: '1px solid var(--dp-color-rule)',
            borderBottom: '1px solid var(--dp-color-rule)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            fontWeight: 500,
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

