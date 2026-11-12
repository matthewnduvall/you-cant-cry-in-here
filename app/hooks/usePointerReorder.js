'use client';

// ============================================================================
// Drag-to-reorder with pointer events (works with touch on iPhone, unlike HTML5 drag-and-drop, and with a mouse).
// Put `handleProps(key)` on each row's grippy handle (DragNumberBadge), the row attribute on each row
// (default `data-reorder-index={key}`) and `rowDragStyle(key)` in each row's style:
// - the held row lifts and follows the finger (translateY + shadow + orange outline),
// - the row it would land on gets an orange outline (an outline, not an inset box-shadow, so the row's own
//   filled cells can't cover it).
// On release, `onMove(fromKey, overKey)` runs if they differ; numeric keys come back as numbers.
// Not too sensitive: the row only lifts after the finger moves LIFT_THRESHOLD_PX, and it only lands on another row
// once the finger passes that row's middle (so a small wobble never reorders anything).
// Options:
// - attribute: the row attribute to look for (use different ones for nested lists, e.g. exercises vs sets)
// - canDrop(fromKey, overKey): only allow some targets (e.g. sets within the same superset exercise)
// - edgeTop / edgeBottom: px from the screen top / bottom where holding the handle scrolls the page (so a row can
//   be dragged past rows that are off screen; edgeTop should clear any sticky header)
// ============================================================================

import { useEffect, useRef, useState } from 'react';

const ACCENT_OUTLINE = '2px solid var(--dp-color-accent)';
const LIFT_THRESHOLD_PX = 10;

export function usePointerReorder(onMove, { attribute = 'data-reorder-index', canDrop, edgeTop = 90, edgeBottom = 70 } = {}) {
  const [drag, setDrag] = useState(null); // { from, over, offsetY, lifted } while a handle is held (keys as strings)
  const pointer = useRef(null); // { x, y } latest pointer position
  const start = useRef(null); // { y, scrollY } where the drag began
  const fromIsNumber = useRef(false);
  // The same drag state, read synchronously by the pointer handlers (state from the last render can be a move
  // behind, e.g. when the finger lifts right after moving)
  const dragRef = useRef(null);
  const updateDrag = next => {
    dragRef.current = next;
    setDrag(next);
  };

  // The held row's element (keys repeat across lists, e.g. every exercise's sets start at "0:0", so rows are found
  // by element, never by querySelector on the key)
  const ownRowEl = useRef(null);

  // The row under (x, y) in the same list, skipping the lifted row itself (it moves with the finger, so it is
  // always on top): { key, el } or null
  const rowAt = (x, y) => {
    const stack = typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)];
    const list = ownRowEl.current?.parentElement;
    for (const el of stack) {
      const row = el?.closest?.(`[${attribute}]`);
      if (!row || row === ownRowEl.current) continue;
      if (list && row.parentElement !== list) continue;
      return { key: row.getAttribute(attribute), el: row };
    }
    return null;
  };

  // Follow the pointer: lifted-row offset (incl. any auto-scroll) and the landing row
  const follow = () => {
    const prev = dragRef.current;
    const next = (() => {
      if (!prev || !pointer.current || !start.current) return prev;
      const offsetY = pointer.current.y - start.current.y + (window.scrollY - start.current.scrollY);
      // Nothing moves until the finger has really moved
      if (!prev.lifted && Math.abs(offsetY) < LIFT_THRESHOLD_PX) return prev;
      const hit = rowAt(pointer.current.x, pointer.current.y);
      let over = hit ? hit.key : null;
      if (hit && over !== prev.over) {
        // Land on another row only past its middle (on the far side from where the dragged row started)
        const target = hit.el.getBoundingClientRect();
        const own = ownRowEl.current?.getBoundingClientRect();
        if (target && own) {
          const ownTop = own.top - (prev.offsetY || 0);
          const middle = target.top + target.height / 2;
          const y = pointer.current.y;
          const pastMiddle = target.top > ownTop ? y >= middle : y <= middle;
          if (!pastMiddle) over = prev.over;
        }
      }
      if (over === null) {
        // Back over the row's own (now empty) place: landing there = no move
        const own = ownRowEl.current?.getBoundingClientRect();
        const lifted = prev.offsetY || 0;
        const y = pointer.current.y;
        over = own && y >= own.top - lifted && y <= own.bottom - lifted ? prev.from : prev.over;
      } else if (canDrop && !canDrop(prev.from, over)) {
        over = prev.over;
      }
      return { ...prev, over, offsetY, lifted: true };
    })();
    if (next !== prev) updateDrag(next);
  };

  // Auto-scroll while the finger / cursor rests near the top or bottom edge (a ~60 fps timer rather than
  // requestAnimationFrame, which some browsers pause in background / embedded views)
  useEffect(() => {
    if (!drag?.lifted || typeof window === 'undefined') return undefined;
    const timer = window.setInterval(() => {
      const y = pointer.current?.y;
      if (y === undefined || y === null) return;
      let step = 0;
      if (y < edgeTop) step = -Math.ceil((edgeTop - y) / 6);
      else if (y > window.innerHeight - edgeBottom) step = Math.ceil((y - (window.innerHeight - edgeBottom)) / 6);
      if (step !== 0) {
        window.scrollBy(0, step);
        follow();
      }
    }, 16);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(drag?.lifted), edgeTop, edgeBottom]);

  const reset = () => {
    pointer.current = null;
    start.current = null;
    ownRowEl.current = null;
    updateDrag(null);
  };

  const handleProps = key => ({
    onPointerDown: e => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore (older browsers)
      }
      fromIsNumber.current = typeof key === 'number';
      ownRowEl.current = e.currentTarget.closest?.(`[${attribute}]`) || null;
      pointer.current = { x: e.clientX, y: e.clientY };
      start.current = { y: e.clientY, scrollY: window.scrollY };
      updateDrag({ from: String(key), over: String(key), offsetY: 0, lifted: false });
    },
    onPointerMove: e => {
      if (!dragRef.current) return;
      pointer.current = { x: e.clientX, y: e.clientY };
      follow();
    },
    onPointerUp: e => {
      if (dragRef.current && Number.isFinite(e?.clientY)) {
        pointer.current = { x: e.clientX, y: e.clientY };
        follow();
      }
      const done = dragRef.current;
      if (done?.lifted && done.over !== done.from && (!canDrop || canDrop(done.from, done.over))) {
        const cast = v => (fromIsNumber.current ? Number(v) : v);
        onMove?.(cast(done.from), cast(done.over));
      }
      reset();
    },
    onPointerCancel: reset,
    // iOS: no long-press menu / text selection on the handle
    onContextMenu: e => e.preventDefault(),
    // Holding the handle drags the row instead of scrolling the page
    style: { touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', cursor: drag ? 'grabbing' : 'grab' }
  });

  // Style for a row while dragging: the held row lifts and follows; the landing row is outlined
  const rowDragStyle = key => {
    if (!drag?.lifted) return null;
    const k = String(key);
    if (k === drag.from) {
      return {
        position: 'relative',
        zIndex: 25,
        transform: `translateY(${drag.offsetY}px)`,
        boxShadow: '0 14px 30px rgba(0, 0, 0, 0.7)',
        outline: ACCENT_OUTLINE,
        outlineOffset: '-2px',
        opacity: 0.95,
        transition: 'none'
      };
    }
    if (k === drag.over) return { outline: ACCENT_OUTLINE, outlineOffset: '-2px' };
    return null;
  };

  return {
    dragKey: drag?.from ?? null,
    overKey: drag?.over ?? null,
    dragIndex: drag ? Number(drag.from) : null,
    overIndex: drag ? Number(drag.over) : null,
    handleProps,
    rowDragStyle
  };
}

export default usePointerReorder;
