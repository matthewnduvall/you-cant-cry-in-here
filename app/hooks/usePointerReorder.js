'use client';

// ============================================================================
// Drag-to-reorder with pointer events (works with touch on iPhone, unlike HTML5 drag-and-drop, and with a mouse).
// Put `handleProps(key)` on each row's grippy handle (DragNumberBadge) and the row attribute on each row
// (default `data-reorder-index={key}`). While dragging, `dragKey` is the row being moved and `overKey` the row it
// would land on (as strings). On release, `onMove(fromKey, overKey)` runs if they differ; numeric keys come
// back as numbers.
// Options:
// - attribute: the row attribute to look for (use different ones for nested lists, e.g. exercises vs sets)
// - canDrop(fromKey, overKey): only allow some targets (e.g. sets within the same superset exercise)
// - edgeTop / edgeBottom: px from the screen top / bottom where holding the handle scrolls the page (so a row can
//   be dragged past rows that are off screen; edgeTop should clear any sticky header)
// ============================================================================

import { useEffect, useRef, useState } from 'react';

export function usePointerReorder(onMove, { attribute = 'data-reorder-index', canDrop, edgeTop = 90, edgeBottom = 70 } = {}) {
  const [drag, setDrag] = useState(null); // { from, over } (strings) while a handle is held
  const pointerY = useRef(null);
  const fromIsNumber = useRef(false);

  // Auto-scroll while the finger / cursor rests near the top or bottom edge
  useEffect(() => {
    if (!drag || typeof window === 'undefined') return undefined;
    // A ~60 fps timer rather than requestAnimationFrame, which some browsers pause in background / embedded views
    const timer = window.setInterval(() => {
      const y = pointerY.current;
      if (y === null) return;
      if (y < edgeTop) window.scrollBy(0, -Math.ceil((edgeTop - y) / 6));
      else if (y > window.innerHeight - edgeBottom) window.scrollBy(0, Math.ceil((y - (window.innerHeight - edgeBottom)) / 6));
    }, 16);
    return () => window.clearInterval(timer);
  }, [drag, edgeTop, edgeBottom]);

  const reset = () => {
    pointerY.current = null;
    setDrag(null);
  };

  const rowKeyAt = (x, y) => {
    const row = document.elementFromPoint(x, y)?.closest?.(`[${attribute}]`);
    return row ? row.getAttribute(attribute) : null;
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
      pointerY.current = e.clientY;
      setDrag({ from: String(key), over: String(key) });
    },
    onPointerMove: e => {
      if (!drag) return;
      pointerY.current = e.clientY;
      const over = rowKeyAt(e.clientX, e.clientY);
      if (over === null || over === drag.over) return;
      if (canDrop && !canDrop(drag.from, over)) return;
      setDrag(prev => (prev ? { ...prev, over } : prev));
    },
    onPointerUp: () => {
      if (drag && drag.over !== drag.from) {
        const cast = v => (fromIsNumber.current ? Number(v) : v);
        onMove?.(cast(drag.from), cast(drag.over));
      }
      reset();
    },
    onPointerCancel: reset,
    // Holding the handle drags the row instead of scrolling the page
    style: { touchAction: 'none', cursor: drag ? 'grabbing' : 'grab' }
  });

  return { dragKey: drag?.from ?? null, overKey: drag?.over ?? null, dragIndex: drag ? Number(drag.from) : null, overIndex: drag ? Number(drag.over) : null, handleProps };
}

export default usePointerReorder;
