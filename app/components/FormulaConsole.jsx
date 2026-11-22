'use client';

// CONSOLE: a collapsible console at the bottom of the workout editors (and the Routines page). It spells out what the
// app just did — loading a routine or a friend's workout (and how their weights were converted to yours), saving a
// routine (weights removed, effort kept), finishing a session, saving History edits — and the formulas behind it.
// Collapsed it is a small tab; open it is a panel (5 lines; drag the bar on top to make it taller, double-tap it to
// toggle between 5 lines and the most; ⤢ makes it full screen) showing the formulas behind the last calculations
// (an added exercise, AUTO SESSION, a program / week / day change, an exercise swap, RESET, a set edit).
// Lines come from utils/calcTrace.js and are shown organised (utils/traceFormat.js): each action, then each exercise
// it touched (its 1RM and notes), then each set as a row — SET 3 · WORKING and the value it ended on — with its steps
// labelled (Scheme default, Warm-up ramp, Weight from 1RM, Intensity…) beside the formula. COPY copies the plain lines.

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { subscribeTrace, getTraceLog, clearTrace } from '../utils/calcTrace';
import { formatTrace, setFinal } from '../utils/traceFormat';

const OPEN_KEY = 'yccih_formula_console_open_v1';
const HEIGHT_KEY = 'yccih_formula_console_lines_v1';
const MAX_SHARE_OF_SCREEN = 0.75;
const LINE_PX = 16;
const VISIBLE_LINES = 5;
const HEADER_PX = 36;
const EMPTY = [];

const readOpen = () => {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
};

const readLines = () => {
  try {
    const n = Number(typeof window !== 'undefined' && window.localStorage.getItem(HEIGHT_KEY));
    return n >= VISIBLE_LINES ? n : VISIBLE_LINES;
  } catch {
    return VISIBLE_LINES;
  }
};

const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const caps = {
  fontFamily: 'var(--cr-face-display)',
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#9A9A9A',
  lineHeight: '16px'
};
const formulaText = { fontFamily: mono, fontSize: '11px', lineHeight: '16px', color: '#BDBDBD', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
const stepRow = { display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', gap: '8px', marginTop: '4px' };
const timeOf = ms => {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** One action: its title and time, its own notes, then each exercise with its 1RM, notes and sets. */
function TraceBlock({ trace }) {
  const t = useMemo(() => formatTrace(trace), [trace]);
  return (
    <div style={{ padding: '10px 0 12px', borderTop: '1px solid #2E2E2E' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
        <span style={{ ...caps, color: '#FFFFFF', fontSize: '11px' }}>{t.title}</span>
        {t.at ? <span style={{ ...caps, flexShrink: 0 }}>{timeOf(t.at)}</span> : null}
      </div>
      {t.notes.map((n, i) => (
        <div key={`n${i}`} style={{ ...formulaText, marginTop: '4px' }}>
          {n}
        </div>
      ))}
      {t.exercises.map(ex => (
        <div key={ex.name} style={{ marginTop: '10px', background: '#161616', borderRadius: '10px', padding: '10px 10px 8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#FFFFFF' }}>{ex.name}</div>
          {ex.oneRM.map((line, i) => (
            <div key={`r${i}`} style={stepRow}>
              <span style={caps}>1RM</span>
              <span style={formulaText}>{line}</span>
            </div>
          ))}
          {ex.notes.map((line, i) => (
            <div key={`x${i}`} style={stepRow}>
              <span style={caps}>Note</span>
              <span style={formulaText}>{line}</span>
            </div>
          ))}
          {ex.sets.map(set => {
            // The value the set ended on: its last weight (× reps when they were worked out after it)
            const final = setFinal(set);
            return (
              <div key={set.n} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #2E2E2E' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                  <span style={{ ...caps, color: '#FFFFFF' }}>
                    SET {set.n}
                    {set.type ? ` · ${set.type === 'Warmup' ? 'WARM-UP' : set.type}` : ''}
                  </span>
                  {final && <span style={{ fontFamily: mono, fontSize: '12px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>{final}</span>}
                </div>
                {set.steps.map((step, i) => (
                  <div key={i} style={stepRow}>
                    <span style={caps}>{step.label}</span>
                    <span style={formulaText}>{step.text}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function FormulaConsole() {
  const log = useSyncExternalStore(subscribeTrace, getTraceLog, () => EMPTY);
  const [open, setOpen] = useState(readOpen);
  const [copied, setCopied] = useState(false);
  // Full screen: the whole viewport, for reading long traces
  const [full, setFull] = useState(false);
  // Visible lines: 5 by default; drag the bar at the top to show more (remembered on this device)
  const [lines, setLines] = useState(readLines);
  const dragRef = useRef(null);
  const bodyRef = useRef(null);

  const maxLines = () =>
    Math.max(VISIBLE_LINES, Math.floor(((typeof window !== 'undefined' ? window.innerHeight : 800) * MAX_SHARE_OF_SCREEN - HEADER_PX - 12) / LINE_PX));
  const onDragStart = e => {
    e.preventDefault();
    dragRef.current = { y: e.clientY, lines };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDragMove = e => {
    if (!dragRef.current) return;
    const dy = dragRef.current.y - e.clientY; // up = taller
    const next = Math.min(maxLines(), Math.max(VISIBLE_LINES, Math.round(dragRef.current.lines + dy / LINE_PX)));
    setLines(next);
  };
  const onDragEnd = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      window.localStorage.setItem(HEIGHT_KEY, String(lines));
    } catch {
      // not remembered
    }
  };

  const toggle = () => {
    setFull(false);
    setOpen(prev => {
      const next = !prev;
      try {
        window.localStorage.setItem(OPEN_KEY, next ? '1' : '0');
      } catch {
        // private mode: just not remembered
      }
      return next;
    });
  };

  // Newest at the bottom, like a terminal
  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [open, full, log]);

  const text = log.map(t => [`▸ ${t.title}`, ...t.lines.map(l => `  ${l}`)].join('\n')).join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  const latest = log[log.length - 1];
  const panelHeight = HEADER_PX + LINE_PX * lines + 12 + 14;
  const isFull = open && full;

  const headerBtn = {
    height: '32px',
    minWidth: '36px',
    padding: '0 10px',
    backgroundColor: '#1C1C1C',
    color: '#BDBDBD',
    border: 'none',
    borderRadius: '8px',
    fontFamily: 'inherit',
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    flexShrink: 0
  };

  return (
    <>
      {/* Keeps the page's last rows clear of the console */}
      <div aria-hidden="true" style={{ height: open ? `${panelHeight + 8}px` : '44px' }} />
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          top: isFull ? 0 : 'auto',
          zIndex: isFull ? 1000 : 60,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          ...(isFull ? { backgroundColor: '#000000' } : {})
        }}
      >
        <div style={{ width: '100%', maxWidth: '480px', pointerEvents: 'auto', ...(isFull ? { height: '100%' } : {}) }}>
          {!open ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px calc(8px + env(safe-area-inset-bottom, 0px))' }}>
              <button
                type="button"
                className="kinetic-btn"
                onClick={toggle}
                aria-expanded="false"
                aria-label="Show the formulas behind the last calculation"
                style={{
                  height: '30px',
                  padding: '0 12px',
                  backgroundColor: '#1C1C1C',
                  color: '#BDBDBD',
                  border: '1px solid #3A3A3A',
                  borderRadius: '999px',
                  fontFamily: mono,
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                CONSOLE ▴
              </button>
            </div>
          ) : (
            <section
              aria-label="Console"
              style={{
                backgroundColor: '#0A0A0A',
                borderTop: isFull ? 'none' : '1px solid #2E2E2E',
                borderRadius: isFull ? 0 : '12px 12px 0 0',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                ...(isFull ? { height: '100%', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top, 0px)' } : {})
              }}
            >
              {/* Drag this bar up or down to resize (pointer events: works with touch and a mouse); not in full screen */}
              {!isFull && (
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label="Drag to resize the formulas"
                  aria-valuenow={lines}
                  onPointerDown={onDragStart}
                  onPointerMove={onDragMove}
                  onPointerUp={onDragEnd}
                  onPointerCancel={onDragEnd}
                  onDoubleClick={() => setLines(prev => (prev > VISIBLE_LINES ? VISIBLE_LINES : maxLines()))}
                  style={{
                    height: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'ns-resize',
                    touchAction: 'none'
                  }}
                >
                  <span aria-hidden="true" style={{ width: '40px', height: '4px', borderRadius: '2px', backgroundColor: '#3A3A3A' }} />
                </div>
              )}
              <div style={{ height: `${HEADER_PX + (isFull ? 8 : 0)}px`, display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px 0 12px', flexShrink: 0 }}>
                <span style={{ fontFamily: mono, fontSize: '11px', color: '#FFFFFF', flexShrink: 0 }}>&gt;_</span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: mono,
                    fontSize: '11px',
                    color: '#9A9A9A',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {latest ? latest.title : 'Nothing yet'}
                </span>
                <button type="button" className="kinetic-btn" onClick={copy} disabled={!log.length} style={headerBtn}>
                  {copied ? 'COPIED' : 'COPY'}
                </button>
                <button type="button" className="kinetic-btn" onClick={clearTrace} disabled={!log.length} style={headerBtn}>
                  CLEAR
                </button>
                <button
                  type="button"
                  className="kinetic-btn"
                  onClick={() => setFull(v => !v)}
                  aria-pressed={full}
                  aria-label={full ? 'Exit full screen' : 'Full screen'}
                  style={{ ...headerBtn, fontSize: '14px' }}
                >
                  {full ? '⤡' : '⤢'}
                </button>
                <button type="button" className="kinetic-btn" onClick={toggle} aria-expanded="true" aria-label="Hide the formulas" style={{ ...headerBtn, fontSize: '12px' }}>
                  ▾
                </button>
              </div>
              <div
                ref={bodyRef}
                role="log"
                aria-live="polite"
                style={{
                  ...(isFull ? { flex: 1, minHeight: 0 } : { height: `${LINE_PX * lines}px` }),
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  padding: '0 12px 12px',
                  color: '#BDBDBD',
                  userSelect: 'text',
                  WebkitUserSelect: 'text'
                }}
              >
                {log.length === 0 ? (
                  <div style={{ ...formulaText, color: '#8A8A8A', paddingTop: '4px' }}>Add an exercise or change a set to see the formulas behind its numbers.</div>
                ) : (
                  log.map(t => <TraceBlock key={`${t.id}_${t.at}`} trace={t} />)
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export default FormulaConsole;
