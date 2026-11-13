'use client';

import React, { useState, useEffect } from 'react';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
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
// DATE box beside the session name: fits YYYY/MM/DD at 12 px (59 px of text), so the SESSION NAME label keeps one line
// even with SYNC showing (name box ≈ 95 px at phone width; the label needs ≈ 93 px with its padding)
const SESSION_DATE_COL = '74px';

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
  onChangeDate,
  // Programs other than Crying: a second row with PROGRAM and WEEK, each opening a picker:
  // { label, programId, programOptions: [{ id, label, note }], onChangeProgram, week, autoWeek, weekOptions | null,
  //   onChangeWeek }; null = no row
  programRow = null
}) {
  // The name pop-up: null = closed; otherwise the name being edited (the header box is too narrow for long names)
  const [nameDraft, setNameDraft] = useState(null);
  // PROGRAM / WEEK pop-up: null | 'program' | 'week'; weekDraft = the typed week for programs without a cycle
  const [programPicker, setProgramPicker] = useState(null);
  const [weekDraft, setWeekDraft] = useState('');
  // The page holds still under the name / program / week pop-ups
  useModalScrollLock(nameDraft !== null || programPicker !== null);
  const saveName = () => {
    const next = String(nameDraft ?? '').trim();
    if (next && next !== title) onChangeTitle?.(next);
    setNameDraft(null);
  };
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
    <>
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
      <button
        type="button"
        aria-label={`Session name: ${title || 'none'}. Tap to see or edit the full name`}
        onClick={() => setNameDraft(title || '')}
        style={{
          minWidth: 0,
          height: '40px',
          boxSizing: 'border-box',
          backgroundColor: '#1C1C1C',
          ...cellBorder,
          padding: '0 8px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'stretch',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: '#FFFFFF'
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', color: '#9A9A9A', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
          SESSION NAME
        </span>
        <span
          style={{
            display: 'block',
            fontSize: '15px',
            ...UI.sessionName,
            marginTop: '2px',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {title}
        </span>
      </button>
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

    {programRow && (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: programRow.dayOptions ? 'minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)',
          backgroundColor: '#1C1C1C'
        }}
      >
        {[
          { key: 'program', label: 'PROGRAM', value: programRow.label, aria: `Program: ${programRow.label}. Tap to change` },
          { key: 'week', label: 'WEEK', value: programRow.week || '—', aria: `Week: ${programRow.week || 'not set'}. Tap to change` },
          ...(programRow.dayOptions
            ? [{ key: 'day', label: 'DAY', value: programRow.dayLabel || '—', aria: `Day: ${programRow.dayLabel || 'not set'}. Tap to change` }]
            : [])
        ].map((cell, i, cells) => (
          <button
            key={cell.key}
            type="button"
            aria-label={cell.aria}
            onClick={() => {
              setWeekDraft(programRow.week || '');
              setProgramPicker(cell.key);
            }}
            style={{
              minWidth: 0,
              height: '40px',
              boxSizing: 'border-box',
              backgroundColor: '#1C1C1C',
              ...cellBorder,
              ...(i === cells.length - 1 ? { borderRight: 'none' } : {}),
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: '#FFFFFF'
            }}
          >
            <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em', color: '#9A9A9A', lineHeight: 1.1 }}>
                {cell.label}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  marginTop: '2px',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {cell.value}
              </span>
            </span>
            <span aria-hidden="true" style={{ color: '#9A9A9A', fontSize: '10px', flexShrink: 0 }}>▾</span>
          </button>
        ))}
      </div>
    )}

    {/* PROGRAM / WEEK pop-ups (the current choice is white; tapping another applies it at once) */}
    {programRow && programPicker && (
      <div style={{ ...UI.modalBackdrop, zIndex: 90 }} onClick={() => setProgramPicker(null)}>
        <div
          role="dialog"
          aria-label={programPicker === 'program' ? 'Session program' : programPicker === 'day' ? 'Program day' : 'Program week'}
          onClick={e => e.stopPropagation()}
          style={UI.modalCard('380px')}
        >
          <div style={UI.modalHeader}>
            <span>{programPicker === 'program' ? 'PROGRAM' : programPicker === 'day' ? 'DAY' : 'WEEK'}</span>
            <button type="button" aria-label="Close" onClick={() => setProgramPicker(null)} style={UI.closeXBtn}>
              ✕
            </button>
          </div>

          {programPicker === 'day' ? (
            <>
              <div style={{ ...UI.sentence, marginBottom: '10px' }}>
                Days rotate by themselves: each session is the day after the last one you logged. Picking another day
                swaps in its exercises (any you started stay).
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(programRow.dayOptions || []).map(opt => {
                  const on = opt.id === programRow.dayId;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className="kinetic-btn"
                      aria-pressed={on}
                      onClick={() => {
                        if (!on) programRow.onChangeDay?.(opt.id);
                        setProgramPicker(null);
                      }}
                      style={{
                        minHeight: '44px',
                        padding: '0 14px',
                        backgroundColor: on ? '#FFFFFF' : '#2A2A2A',
                        color: on ? '#000000' : '#FFFFFF',
                        border: 'none',
                        borderRadius: '10px',
                        fontFamily: 'inherit',
                        fontSize: '15px',
                        fontWeight: 500,
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </>
          ) : programPicker === 'program' ? (
            <>
              <div style={{ ...UI.sentence, marginBottom: '10px' }}>
                This session&apos;s program. Its exercises are re-planned for the program&apos;s week.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(programRow.programOptions || []).map(opt => {
                  const on = opt.id === programRow.programId;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className="kinetic-btn"
                      aria-pressed={on}
                      onClick={() => {
                        if (!on) programRow.onChangeProgram?.(opt.id);
                        setProgramPicker(null);
                      }}
                      style={{
                        minHeight: '44px',
                        padding: '0 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        backgroundColor: on ? '#FFFFFF' : '#2A2A2A',
                        color: on ? '#000000' : '#FFFFFF',
                        border: 'none',
                        borderRadius: '10px',
                        fontFamily: 'inherit',
                        fontSize: '15px',
                        fontWeight: 500,
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      <span>{opt.label}</span>
                      {opt.note && (
                        <span style={{ fontSize: '10px', letterSpacing: '0.1em', opacity: 0.7, whiteSpace: 'nowrap' }}>{opt.note}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : programRow.weekOptions ? (
            <>
              <div style={{ ...UI.sentence, marginBottom: '10px' }}>
                Weeks keep track of themselves: the first session in a new week (Monday to Sunday) moves on a week.
                {programRow.autoWeek ? ` Automatic: ${programRow.autoWeek}.` : ''}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px' }}>
                {programRow.weekOptions.map(w => {
                  const on = w === programRow.week;
                  return (
                    <button
                      key={w}
                      type="button"
                      className="kinetic-btn"
                      aria-pressed={on}
                      onClick={() => {
                        if (!on) programRow.onChangeWeek?.(w);
                        setProgramPicker(null);
                      }}
                      style={{
                        height: '44px',
                        backgroundColor: on ? '#FFFFFF' : '#2A2A2A',
                        color: on ? '#000000' : '#FFFFFF',
                        border: 'none',
                        borderRadius: '10px',
                        fontFamily: 'inherit',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <input
                type="text"
                aria-label="Program week (number or name)"
                placeholder="Week # or name"
                autoFocus
                value={weekDraft}
                maxLength={40}
                onChange={e => setWeekDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    programRow.onChangeWeek?.(weekDraft.trim());
                    setProgramPicker(null);
                  }
                }}
                style={UI.field}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="kinetic-btn" onClick={() => setProgramPicker(null)} style={UI.secondaryBtnCenter}>
                  CANCEL
                </button>
                <button
                  type="button"
                  className="kinetic-btn"
                  onClick={() => {
                    programRow.onChangeWeek?.(weekDraft.trim());
                    setProgramPicker(null);
                  }}
                  style={UI.primaryBtnCenter}
                >
                  SAVE WEEK
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}

    {/* SESSION NAME pop-up: the full name, editable (SAVE NAME is this pop-up's one red) */}
    {nameDraft !== null && (
      <div style={{ ...UI.modalBackdrop, zIndex: 90 }} onClick={() => setNameDraft(null)}>
        <div
          role="dialog"
          aria-label="Session name"
          onClick={e => e.stopPropagation()}
          style={UI.modalCard('380px')}
        >
          <div style={UI.modalHeader}>
            <span>SESSION NAME</span>
            <button type="button" aria-label="Close" onClick={() => setNameDraft(null)} style={UI.closeXBtn}>
              ✕
            </button>
          </div>
          <textarea
            aria-label="Session name"
            rows={3}
            autoFocus
            value={nameDraft}
            onFocus={e => e.target.select()}
            onChange={e => setNameDraft(e.target.value.replace(/\n/g, ' '))}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveName();
              }
            }}
            style={{ ...UI.field, ...UI.sessionName, resize: 'none', lineHeight: 1.3, fontFamily: 'inherit' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
            <button type="button" className="kinetic-btn" onClick={() => setNameDraft(null)} style={UI.secondaryBtnCenter}>
              CANCEL
            </button>
            <button type="button" className="kinetic-btn" onClick={saveName} style={UI.primaryBtnCenter}>
              SAVE NAME
            </button>
          </div>
        </div>
      </div>
    )}
    </>
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
        {/* The red dot only while a set is waiting (a set line under the exercise name) */}
        {nextLiftInfo.topLine && nextLiftInfo.bottomLine ? (
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

