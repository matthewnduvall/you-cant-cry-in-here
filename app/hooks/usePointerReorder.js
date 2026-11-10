'use client';

// ============================================================================
// Drag-to-reorder with pointer events (works with touch on iPhone, unlike HTML5 drag-and-drop).
// Put `handleProps(index)` on each row's grippy handle (DragNumberBadge) and `data-reorder-index={index}`
// on each row. While dragging, `dragIndex` is the row being moved and `overIndex` the row it would land on.
// ============================================================================

import { useState } from 'react';

export function usePointerReorder(onMove) {
  const [drag, setDrag] = useState(null); // { from, over } while a handle is held

  const reset = () => setDrag(null);

  const handleProps = index => ({
    onPointerDown: e => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore (older browsers)
      }
      setDrag({ from: index, over: index });
    },
    onPointerMove: e => {
      if (!drag) return;
      const row = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-reorder-index]');
      if (!row) return;
      const over = Number(row.getAttribute('data-reorder-index'));
      if (Number.isFinite(over) && over !== drag.over) setDrag(prev => (prev ? { ...prev, over } : prev));
    },
    onPointerUp: () => {
      if (drag && drag.over !== drag.from) onMove?.(drag.from, drag.over);
      reset();
    },
    onPointerCancel: reset,
    // Holding the handle drags the row instead of scrolling the page
    style: { touchAction: 'none' }
  });

  return { dragIndex: drag?.from ?? null, overIndex: drag?.over ?? null, handleProps };
}

export default usePointerReorder;
