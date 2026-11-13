'use client';

// FORMULAS: a collapsible debugging console at the bottom of the workout editor. Collapsed it is a small tab; open it
// is a 5-line terminal showing the formulas behind the last calculations (RECALCULATE, an added exercise, AUTO
// SESSION, a program / week / day change, an exercise swap): the 1RM everything is based on, then each value worked
// out from it, with the numbers used, so a result can be checked by hand. Lines come from utils/calcTrace.js.

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { subscribeTrace, getTraceLog, clearTrace } from '../utils/calcTrace';

const OPEN_KEY = 'yccih_formula_console_open_v1';
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

const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

export function FormulaConsole() {
  const log = useSyncExternalStore(subscribeTrace, getTraceLog, () => EMPTY);
  const [open, setOpen] = useState(readOpen);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef(null);

  const toggle = () => {
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
  }, [open, log]);

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
  const panelHeight = HEADER_PX + LINE_PX * VISIBLE_LINES + 12;

  const headerBtn = {
    height: '28px',
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
          zIndex: 60,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}
      >
        <div style={{ width: '100%', maxWidth: '480px', pointerEvents: 'auto' }}>
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
                ƒx FORMULAS ▴
              </button>
            </div>
          ) : (
            <section
              aria-label="Formulas"
              style={{
                backgroundColor: '#0A0A0A',
                borderTop: '1px solid #2E2E2E',
                borderRadius: '12px 12px 0 0',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)'
              }}
            >
              <div style={{ height: `${HEADER_PX}px`, display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px 0 12px' }}>
                <span style={{ fontFamily: mono, fontSize: '11px', color: '#FFFFFF', flexShrink: 0 }}>ƒx</span>
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
                  {latest ? latest.title : 'No calculations yet'}
                </span>
                <button type="button" className="kinetic-btn" onClick={copy} disabled={!log.length} style={headerBtn}>
                  {copied ? 'COPIED' : 'COPY'}
                </button>
                <button type="button" className="kinetic-btn" onClick={clearTrace} disabled={!log.length} style={headerBtn}>
                  CLEAR
                </button>
                <button type="button" className="kinetic-btn" onClick={toggle} aria-expanded="true" aria-label="Hide the formulas" style={headerBtn}>
                  ▾
                </button>
              </div>
              <div
                ref={bodyRef}
                role="log"
                aria-live="polite"
                style={{
                  height: `${LINE_PX * VISIBLE_LINES}px`,
                  overflowY: 'auto',
                  padding: '0 12px 12px',
                  fontFamily: mono,
                  fontSize: '11px',
                  lineHeight: `${LINE_PX}px`,
                  color: '#BDBDBD',
                  userSelect: 'text',
                  WebkitUserSelect: 'text'
                }}
              >
                {log.length === 0 ? (
                  <div style={{ color: '#8A8A8A' }}>Tap RECALCULATE or add an exercise to see the formulas behind its numbers.</div>
                ) : (
                  log.map(t => (
                    <div key={`${t.id}_${t.at}`} style={{ marginBottom: '4px' }}>
                      <div style={{ color: '#FFFFFF' }}>▸ {t.title}</div>
                      {t.lines.map((line, i) => (
                        <div key={i} style={{ paddingLeft: '12px', textIndent: '-8px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  ))
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
