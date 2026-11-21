'use client';

// Drag to fill set rows (SlotEditor), like a spreadsheet's fill handle:
// - a padlock: press and drag up or down; every set row passed gets the lock state the first padlock is turning to
//   (holdMs 0: the padlock has touch-action none, so it drags at once; a plain tap still toggles that one lock)
// - a weight / reps / timer cell: hold it still for VALUE_HOLD_MS (a short buzz), then drag; every row passed gets that
//   value. Moving before the hold ends is a scroll, and a quick tap still opens the cell's pop-up.
// Rows are found under the finger by `data-set-reorder="exIdx:setIdx"` among the source row's own siblings (the keys
// repeat in every exercise card), and only rows of the same exercise (exIdx) count. Nothing is written until release:
// the rows show a preview (`preview(exIdx, setIdx, field)`), then onCommit({ exIdx, field, kind, from, to, payload }).

import { useEffect, useRef, useState } from 'react';

export const VALUE_HOLD_MS = 350;
const MOVE_CANCEL_PX = 10;
const ROW_ATTR = 'data-set-reorder';

export function useFillDrag(onCommit) {
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const commitRef = useRef(onCommit);
  const holdTimer = useRef(null);
  const startRef = useRef(null);
  const rowRef = useRef(null);
  const suppressClickUntil = useRef(0);
  const listeners = useRef(null);

  useEffect(() => {
    commitRef.current = onCommit;
  });

  const update = next => {
    dragRef.current = next;
    setDrag(next);
  };

  const detach = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    const l = listeners.current;
    if (l) {
      window.removeEventListener('pointermove', l.move);
      window.removeEventListener('pointerup', l.up);
      window.removeEventListener('pointercancel', l.cancel);
      window.removeEventListener('touchmove', l.touch);
    }
    listeners.current = null;
  };

  // Unmounting mid-drag: drop the window listeners
  useEffect(
    () => () => {
      const l = listeners.current;
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
      if (!l) return;
      window.removeEventListener('pointermove', l.move);
      window.removeEventListener('pointerup', l.up);
      window.removeEventListener('pointercancel', l.cancel);
      window.removeEventListener('touchmove', l.touch);
    },
    []
  );

  const rowUnder = (x, y) => {
    const source = rowRef.current;
    const el = document.elementFromPoint(x, y)?.closest?.(`[${ROW_ATTR}]`);
    if (!el || !source || el.parentElement !== source.parentElement) return null;
    const [exIdx, setIdx] = String(el.getAttribute(ROW_ATTR)).split(':').map(Number);
    return Number.isFinite(exIdx) && Number.isFinite(setIdx) ? { exIdx, setIdx } : null;
  };

  /** Pointer props for a fill source. kind 'lock' (payload { target }) or 'value' (payload { value }). */
  const sourceProps = ({ exIdx, setIdx, field, kind, payload, disabled = false }) => {
    if (disabled) return {};
    const holdMs = kind === 'lock' ? 0 : VALUE_HOLD_MS;
    return {
      onContextMenu: e => e.preventDefault(),
      onPointerDown: e => {
        if (e.button !== undefined && e.button !== 0) return;
        if (kind === 'lock') e.preventDefault();
        detach();
        rowRef.current = e.currentTarget.closest?.(`[${ROW_ATTR}]`) || null;
        startRef.current = { x: e.clientX, y: e.clientY };
        update({ exIdx, field, kind, payload, from: setIdx, to: setIdx, armed: holdMs === 0 });
        const arm = () => {
          holdTimer.current = null;
          const cur = dragRef.current;
          if (!cur || cur.armed) return;
          try {
            navigator.vibrate?.(12);
          } catch {
            // ignore
          }
          update({ ...cur, armed: true });
        };
        if (holdMs > 0) holdTimer.current = window.setTimeout(arm, holdMs);

        const move = ev => {
          const cur = dragRef.current;
          if (!cur) return;
          if (!cur.armed) {
            // Moved before the hold ended: a scroll, not a fill
            const s = startRef.current;
            if (s && Math.hypot(ev.clientX - s.x, ev.clientY - s.y) > MOVE_CANCEL_PX) cancel();
            return;
          }
          const hit = rowUnder(ev.clientX, ev.clientY);
          if (hit && hit.exIdx === cur.exIdx && hit.setIdx !== cur.to) update({ ...cur, to: hit.setIdx });
        };
        const up = () => {
          const cur = dragRef.current;
          detach();
          update(null);
          if (!cur?.armed) return;
          // The click that follows a fill must not also open a pop-up / toggle again
          suppressClickUntil.current = Date.now() + 500;
          if (cur.kind === 'lock' || cur.to !== cur.from) commitRef.current?.(cur);
        };
        const cancel = () => {
          detach();
          update(null);
        };
        // While filling, the page must not scroll under the finger
        const touch = ev => {
          if (dragRef.current?.armed && ev.cancelable) ev.preventDefault();
        };
        listeners.current = { move, up, cancel, touch };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', cancel);
        window.addEventListener('touchmove', touch, { passive: false });
      }
    };
  };

  /** True (once) when a click straight after a fill should be ignored. */
  const consumeClick = () => Date.now() < suppressClickUntil.current;

  /** The fill covering this row's cell, or null: { kind, payload, isSource } */
  const preview = (exIdx, setIdx, field) => {
    const d = drag;
    if (!d || !d.armed || d.exIdx !== exIdx || d.field !== field) return null;
    const lo = Math.min(d.from, d.to);
    const hi = Math.max(d.from, d.to);
    if (setIdx < lo || setIdx > hi) return null;
    return { kind: d.kind, payload: d.payload, isSource: setIdx === d.from };
  };

  return { sourceProps, consumeClick, preview, active: Boolean(drag?.armed) };
}
