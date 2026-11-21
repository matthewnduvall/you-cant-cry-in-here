'use client';

// ============================================================================
// Routine playlists (the Routines page's PLAYLISTS tab): named, ordered groups of your saved routines, e.g. a run of
// Society workouts done one after another. Stored in settings.routinePlaylists (local + cloud):
//   [{ id, name, routineKeys: [savedRoutines key…], nextKey, updatedAt }]
// - The list: one row per playlist (name, N routines, UP NEXT) → opens it.
// - A playlist: its name (typed), START NEXT (the playlist's one red: loads the routine up next), its routines in
//   order (drag the handle to reorder; the one up next carries an UP NEXT pill; LOAD; ✕ takes it out of the
//   playlist), + ADD ROUTINES (your saved routines not in it yet), DELETE PLAYLIST.
// - Loading a routine from a playlist moves UP NEXT to the routine after it (back to the first after the last), so
//   the playlist keeps your place; SET NEXT on a row moves it by hand.
// Routines deleted from SAVED simply drop out of the playlist.
// ============================================================================

import React, { useState } from 'react';
import { UI, SHARED_CELL_BORDER } from '../styles/kineticTokens';
import { IOSListSection, IOSListRow } from './Primitives';
import { Button, DeleteButton, DragNumberBadge } from './Controls';
import { usePointerReorder } from '../hooks/usePointerReorder';
import { EXERCISE_MAP, stripDateFromTitle, stripEquipmentFromExerciseName } from '../data/exerciseLibrary';
import { getWorkoutExerciseIds } from './HistoryExerciseFilter';

const newId = () => `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const nameOf = r => stripDateFromTitle(r?.label) || r?.label || 'Routine';
const exerciseNamesOf = r =>
  getWorkoutExerciseIds(r)
    .map(id => EXERCISE_MAP[id]?.name)
    .filter(Boolean)
    .map(name => stripEquipmentFromExerciseName(name))
    .join(' · ');

/** A playlist's routines that still exist, in order, and the index of the one up next. */
export function resolvePlaylist(playlist, savedRoutines = []) {
  const byKey = new Map((savedRoutines || []).map(r => [r.key, r]));
  const items = (playlist?.routineKeys || []).map(k => byKey.get(k)).filter(Boolean);
  const found = items.findIndex(r => r.key === playlist?.nextKey);
  return { items, nextIndex: items.length === 0 ? -1 : found >= 0 ? found : 0 };
}

const cellBtn = {
  minHeight: '48px',
  boxSizing: 'border-box',
  border: 'none',
  ...SHARED_CELL_BORDER,
  fontFamily: 'inherit',
  fontSize: '12px',
  fontWeight: 500,
  letterSpacing: '0.08em',
  cursor: 'pointer'
};
const subLine = { fontSize: '11px', fontWeight: 500, color: '#9A9A9A', marginTop: '1px', textTransform: 'uppercase' };
const pill = {
  ...UI.badge,
  display: 'inline-block',
  marginLeft: '8px',
  padding: '2px 8px',
  borderRadius: '999px',
  backgroundColor: '#FFFFFF',
  color: '#000000',
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '0.1em',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap'
};

export function RoutinePlaylists({
  colors,
  playlists = [],
  setPlaylists,
  savedRoutines = [],
  // onLoad(routine, onLoaded): loads a routine (asking first when it replaces a session); onLoaded runs once it is
  onLoad,
  setDeleteConfirmTarget,
  readOnly = false
}) {
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const open = (playlists || []).find(p => p.id === openId) || null;

  const update = (id, change) =>
    setPlaylists?.(prev =>
      (prev || []).map(p => (p.id === id ? { ...p, ...(typeof change === 'function' ? change(p) : change), updatedAt: new Date().toISOString() } : p))
    );

  const createPlaylist = () => {
    const p = { id: newId(), name: `Playlist ${(playlists || []).length + 1}`, routineKeys: [], nextKey: null, updatedAt: new Date().toISOString() };
    setPlaylists?.(prev => [...(prev || []), p]);
    setOpenId(p.id);
    setAdding(true);
  };

  // Loading a routine from a playlist: the one after it is up next (the first again after the last)
  const loadFrom = (playlist, items, index) => {
    const routine = items[index];
    if (!routine) return;
    onLoad?.(routine, () => update(playlist.id, { nextKey: items[(index + 1) % items.length]?.key || null }));
  };

  const { handleProps, rowDragStyle } = usePointerReorder(
    (from, to) => {
      if (!open) return;
      const { items } = resolvePlaylist(open, savedRoutines);
      const keys = items.map(r => r.key);
      const [moved] = keys.splice(from, 1);
      keys.splice(to, 0, moved);
      update(open.id, { routineKeys: keys });
    },
    { attribute: 'data-playlist-index' }
  );

  // ── The list of playlists ───────────────────────────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <>
        {!readOnly && (
          <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '12px' }}>
            <Button variant="secondary" onClick={createPlaylist} style={{ minHeight: '52px', width: '100%' }}>
              + NEW PLAYLIST
            </Button>
          </div>
        )}
        <IOSListSection colors={colors}>
          {(playlists || []).length === 0 ? (
            <IOSListRow isLast colors={colors}>
              <span style={UI.rowSub}>No playlists yet. A playlist keeps saved routines in order and remembers which one is next.</span>
            </IOSListRow>
          ) : (
            playlists.map(p => {
              const { items, nextIndex } = resolvePlaylist(p, savedRoutines);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="kinetic-btn"
                  aria-label={`Open playlist ${p.name}`}
                  onClick={() => {
                    setOpenId(p.id);
                    setAdding(false);
                  }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    minHeight: '56px',
                    padding: '8px 12px',
                    boxSizing: 'border-box',
                    backgroundColor: '#1C1C1C',
                    color: '#FFFFFF',
                    border: 'none',
                    ...SHARED_CELL_BORDER,
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '15px', ...UI.sessionName, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name || 'Playlist'}
                    </span>
                    <span style={{ ...subLine, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {items.length} {items.length === 1 ? 'ROUTINE' : 'ROUTINES'}
                      {nextIndex >= 0 ? ` • NEXT: ${nextIndex + 1}. ${nameOf(items[nextIndex]).toUpperCase()}` : ''}
                    </span>
                  </span>
                  <span aria-hidden="true" style={{ color: '#9A9A9A', fontSize: '20px' }}>
                    ›
                  </span>
                </button>
              );
            })
          )}
        </IOSListSection>
      </>
    );
  }

  // ── One playlist ────────────────────────────────────────────────────────────────────────────────────────────
  const { items, nextIndex } = resolvePlaylist(open, savedRoutines);
  const inPlaylist = new Set(items.map(r => r.key));
  const addable = (savedRoutines || []).filter(r => !inPlaylist.has(r.key));

  return (
    <div>
      <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '12px', display: 'grid', gap: '8px' }}>
        <button
          type="button"
          className="kinetic-btn"
          onClick={() => setOpenId(null)}
          style={{ justifySelf: 'start', height: '44px', padding: '0 4px', background: 'none', border: 'none', color: '#FFFFFF', fontFamily: 'inherit', fontSize: '12px', fontWeight: 500, letterSpacing: '0.08em', cursor: 'pointer' }}
        >
          ‹ ALL PLAYLISTS
        </button>
        <label style={{ display: 'grid', gap: '4px' }}>
          <span style={{ ...UI.capsLabel, paddingLeft: '4px' }}>PLAYLIST NAME</span>
          <input
            type="text"
            value={open.name}
            readOnly={readOnly}
            maxLength={60}
            placeholder="Name this playlist"
            onChange={e => update(open.id, { name: e.target.value })}
            onBlur={e => {
              if (!e.target.value.trim()) update(open.id, { name: 'Playlist' });
            }}
            style={{ ...UI.field, width: '100%', boxSizing: 'border-box' }}
          />
        </label>
        {items.length > 0 && (
          <Button variant="primary" onClick={() => loadFrom(open, items, nextIndex)} style={{ minHeight: '52px', width: '100%' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              START NEXT: {nameOf(items[nextIndex]).toUpperCase()}
            </span>
          </Button>
        )}
      </div>

      <IOSListSection header={`ROUTINES (${items.length})`} colors={colors}>
        {items.length === 0 ? (
          <IOSListRow isLast colors={colors}>
            <span style={UI.rowSub}>No routines in this playlist yet. Add your saved routines below.</span>
          </IOSListRow>
        ) : (
          items.map((r, i) => {
            const isNext = i === nextIndex;
            const count = getWorkoutExerciseIds(r).length;
            return (
              <div
                key={r.key}
                data-playlist-index={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `34px minmax(0, 1fr)${isNext ? '' : ' 56px'} 60px${readOnly ? '' : ' 44px'}`,
                  alignItems: 'stretch',
                  backgroundColor: isNext ? '#262626' : '#1C1C1C',
                  ...rowDragStyle(i)
                }}
              >
                <DragNumberBadge
                  label={i + 1}
                  height="auto"
                  minHeight="56px"
                  title="Hold, then drag to reorder"
                  aria-label={`Drag to reorder ${nameOf(r)}`}
                  {...handleProps(i, { disabled: readOnly })}
                />
                <div style={{ padding: '8px 12px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', ...SHARED_CELL_BORDER }}>
                  {/* The name wraps (two lines at most) so similar names, e.g. Society's days, stay tellable apart */}
                  <div style={{ fontSize: '15px', ...UI.sessionName, color: '#FFFFFF', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
                    {nameOf(r)}
                  </div>
                  <div style={subLine}>
                    {isNext && <span style={{ ...pill, marginLeft: 0, marginRight: '6px' }}>UP NEXT</span>}
                    {count} {count === 1 ? 'EXERCISE' : 'EXERCISES'}
                  </div>
                  {exerciseNamesOf(r) && (
                    <div style={{ ...UI.rowContents, marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {exerciseNamesOf(r)}
                    </div>
                  )}
                </div>
                {!isNext && (
                  <button
                    type="button"
                    className="kinetic-btn"
                    aria-label={`Make ${nameOf(r)} up next`}
                    onClick={() => update(open.id, { nextKey: r.key })}
                    style={{ ...cellBtn, backgroundColor: '#1C1C1C', color: '#BDBDBD', lineHeight: 1.2 }}
                  >
                    SET
                    <br />
                    NEXT
                  </button>
                )}
                <button
                  type="button"
                  className="kinetic-btn"
                  aria-label={`Load ${nameOf(r)}`}
                  onClick={() => loadFrom(open, items, i)}
                  style={{ ...cellBtn, backgroundColor: '#2A2A2A', color: '#FFFFFF' }}
                >
                  LOAD
                </button>
                {!readOnly && (
                  <DeleteButton
                    label={`Take ${nameOf(r)} out of the playlist`}
                    variant="outline"
                    fill
                    minHeight="56px"
                    style={{ width: '44px', height: 'auto', color: '#9A9A9A' }}
                    onClick={() =>
                      update(open.id, p => ({
                        routineKeys: (p.routineKeys || []).filter(k => k !== r.key),
                        // Up next moves on to the routine after it (none left: nothing)
                        nextKey: p.nextKey === r.key ? (items.length > 1 ? items[(i + 1) % items.length].key : null) : p.nextKey
                      }))
                    }
                  />
                )}
              </div>
            );
          })
        )}
      </IOSListSection>
      {items.length > 1 && (
        <div style={{ ...UI.sentence, padding: '0 calc(var(--dp-spacing-gutter) + 4px)', margin: '-4px 0 12px' }}>
          Hold a number, then drag to reorder. Loading a routine moves UP NEXT to the one after it.
        </div>
      )}

      {!readOnly && (
        <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '12px' }}>
          <Button variant="dashed" onClick={() => setAdding(a => !a)} style={{ width: '100%', minHeight: '48px' }}>
            {adding ? 'HIDE SAVED ROUTINES ▴' : '+ ADD ROUTINES'}
          </Button>
        </div>
      )}
      {!readOnly && adding && (
        <IOSListSection header={`ADD FROM SAVED (${addable.length})`} colors={colors}>
          {addable.length === 0 ? (
            <IOSListRow isLast colors={colors}>
              <span style={UI.rowSub}>
                {(savedRoutines || []).length === 0
                  ? 'No saved routines yet. Save a session as a routine, or SAVE one a friend sent you, to add it here.'
                  : 'Every saved routine is already in this playlist.'}
              </span>
            </IOSListRow>
          ) : (
            addable.map(r => (
              <div key={r.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 64px', alignItems: 'stretch', backgroundColor: '#1C1C1C' }}>
                <div style={{ padding: '8px 12px', minWidth: 0, minHeight: '48px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', ...SHARED_CELL_BORDER }}>
                  <div style={{ fontSize: '15px', ...UI.sessionName, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(r)}</div>
                  {exerciseNamesOf(r) && (
                    <div style={{ ...UI.rowContents, marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {exerciseNamesOf(r)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="kinetic-btn"
                  aria-label={`Add ${nameOf(r)} to the playlist`}
                  onClick={() =>
                    update(open.id, p => ({
                      routineKeys: [...(p.routineKeys || []).filter(k => k !== r.key), r.key],
                      nextKey: p.nextKey || r.key
                    }))
                  }
                  style={{ ...cellBtn, backgroundColor: '#2A2A2A', color: '#FFFFFF' }}
                >
                  + ADD
                </button>
              </div>
            ))
          )}
        </IOSListSection>
      )}

      {!readOnly && (
        <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '16px' }}>
          <Button
            variant="danger"
            onClick={() =>
              setDeleteConfirmTarget?.({
                type: 'generic',
                title: 'DELETE PLAYLIST?',
                verb: 'delete',
                label: `${open.name || 'this playlist'} (the routines stay in SAVED)`,
                confirmLabel: 'DELETE',
                onConfirm: () => {
                  setPlaylists?.(prev => (prev || []).filter(p => p.id !== open.id));
                  setOpenId(null);
                }
              })
            }
            style={{ width: '100%', minHeight: '48px' }}
          >
            DELETE PLAYLIST
          </Button>
        </div>
      )}
    </div>
  );
}
