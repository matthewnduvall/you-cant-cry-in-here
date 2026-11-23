'use client';

// ============================================================================
// The Programs page's PROGRAMS tab: exercises → routines → programs, none of them storing weights (each routine keeps
// reps, set types and effort; weights are worked out for whoever loads it).
// - BUILT-IN: the app's programs (app/data/programs.js). One opens to its details (ProgramDetails: description,
//   variables, training days, NEXT SESSION / RESTART for the one you follow), USE THIS PROGRAM (settings.program),
//   its routines — each day as the session it would build for you today, with LOAD — and COPY TO MY PROGRAMS (its
//   days saved as your routines, in a program of your own). Crying has no fixed routines: it builds each session from
//   your stimulus map, so it shows its ROUTINE PREFERENCES instead.
// - YOUR PROGRAMS (formerly playlists; still stored as settings.routinePlaylists, local + cloud):
//   [{ id, name, routineKeys: [savedRoutines key…], nextKey, updatedAt }]. One opens to its name (typed), USE THIS
//   PROGRAM (chosen as 'custom:<id>', shown as CUSTOM · name), START NEXT (its one red: loads the routine up next), its
//   routines in order (drag to reorder; UP NEXT pill; SET NEXT; LOAD; ✕ takes one out), + ADD ROUTINES, DELETE PROGRAM.
//   Loading one moves UP NEXT to the routine after it (the first again after the last). Routines deleted from
//   ROUTINES drop out.
// ============================================================================

import React, { useMemo, useState } from 'react';
import { UI, SHARED_CELL_BORDER } from '../styles/kineticTokens';
import { IOSListSection, IOSListRow } from './Primitives';
import { Button, DeleteButton, DragNumberBadge } from './Controls';
import { usePointerReorder } from '../hooks/usePointerReorder';
import { EXERCISE_MAP, stripDateFromTitle, stripEquipmentFromExerciseName } from '../data/exerciseLibrary';
import { getWorkoutExerciseIds } from './HistoryExerciseFilter';
import { ProgramDetails } from './ProgramDetails';
import { ProgramGrid } from './ProgramGrid';
import { gridItems, newGrid } from '../utils/programGrid';
import { customProgramId, hasProgramDays } from '../data/programs';
import { reviewCycle, previousCycle, programCycleLoad } from '../utils/programCycles';

export { programCycleLoad };
import { formatDateYMD } from '../data/exerciseLibrary';

const newId = () => `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const nameOf = r => stripDateFromTitle(r?.label) || r?.label || 'Routine';
const exerciseNamesOf = r =>
  getWorkoutExerciseIds(r)
    .map(id => EXERCISE_MAP[id]?.name)
    .filter(Boolean)
    .map(name => stripEquipmentFromExerciseName(name))
    .join(' · ');

/** A program's routines that still exist, in order, and the index of the one up next (its own routines — a saved
 * cycle's — first, then your saved routines). */
export function resolvePlaylist(playlist, savedRoutines = []) {
  // A grid program (weeks × days): its cells in play order, later weeks from week 1 + their rule (utils/programGrid.js)
  if (playlist?.grid) {
    const items = gridItems(playlist.grid, savedRoutines);
    const found = items.findIndex(r => r.key === playlist.nextKey);
    return { items, nextIndex: items.length === 0 ? -1 : found >= 0 ? found : 0 };
  }
  const byKey = new Map([...(savedRoutines || []), ...(playlist?.routines || [])].map(r => [r.key, r]));
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

const cycleDates = c => `${formatDateYMD(c.startMs)} – ${formatDateYMD(c.endMs)}`;
const pctOf = (n, d) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');
const effortText = gap => (gap === null || gap === undefined ? '—' : Math.abs(gap) < 0.25 ? 'AS PLANNED' : `${Math.abs(gap)} ${gap < 0 ? 'HARDER' : 'EASIER'}`);

/**
 * A logged cycle week by week (planned vs done), with the cycle before it under each value: SESSIONS · AS PLANNED
 * (share of planned working sets done at the planned weight and reps) · FEWER REPS · EFFORT (reported RIR against
 * the planned RIR, from sets whose effort you entered).
 */
function CycleReview({ cycle, before }) {
  const rows = reviewCycle(cycle);
  const prevByWeek = new Map(before ? reviewCycle(before).map(r => [r.week, r]) : []);
  const cell = { padding: '8px 4px', textAlign: 'center', ...SHARED_CELL_BORDER, fontSize: '13px', color: '#FFFFFF' };
  const head = { ...cell, ...UI.capsLabel, fontSize: '10px', color: '#9A9A9A' };
  const prevLine = text => <div style={{ fontSize: '10px', color: '#8A8A8A', marginTop: '2px' }}>{text}</div>;
  const anyPlanned = rows.some(r => r.planned > 0 || r.rated > 0);
  return (
    <div style={{ backgroundColor: '#000000' }}>
      <div role="table" aria-label="Cycle review, week by week" style={{ display: 'grid', gridTemplateColumns: '0.8fr 0.9fr 1fr 1fr 1.3fr' }}>
        {['WEEK', 'SESS.', 'AS PLANNED', 'FEWER REPS', 'EFFORT'].map(h => (
          <div key={h} role="columnheader" style={head}>
            {h}
          </div>
        ))}
        {rows.map(r => {
          const p = prevByWeek.get(r.week);
          return (
            <React.Fragment key={r.week}>
              <div role="cell" style={cell}>{r.week}</div>
              <div role="cell" style={cell}>
                {r.sessions}
                {p && prevLine(`WAS ${p.sessions}`)}
              </div>
              <div role="cell" style={cell}>
                {pctOf(r.asPlanned, r.planned)}
                {p && prevLine(`WAS ${pctOf(p.asPlanned, p.planned)}`)}
              </div>
              <div role="cell" style={cell}>
                {pctOf(r.fewerReps, r.planned)}
                {p && prevLine(`WAS ${pctOf(p.fewerReps, p.planned)}`)}
              </div>
              <div role="cell" style={cell}>
                {effortText(r.rirGap)}
                {p && prevLine(`WAS ${effortText(p.rirGap)}`)}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ ...UI.sentence, fontSize: '12px', padding: '10px 12px' }}>
        {anyPlanned
          ? `AS PLANNED and FEWER REPS count working sets done against the app's plan; EFFORT compares the effort you entered with the planned one${before ? `; WAS is the cycle before (${cycleDates(before)})` : ''}.`
          : 'No planned sets to compare yet: sessions record the plan when you train with them live, and EFFORT needs the effort you entered on a set.'}
      </div>
    </div>
  );
}

export function RoutinePlaylists({
  colors,
  playlists = [],
  setPlaylists,
  savedRoutines = [],
  // onLoad(routine, onLoaded): loads a routine (asking first when it replaces a session); onLoaded runs once it is
  onLoad,
  setDeleteConfirmTarget,
  readOnly = false,
  // BUILT-IN programs (PROGRAMS) and the one you follow (settings.program; yours are 'custom:<id>')
  builtInPrograms = [],
  activeProgramId = 'crying',
  onUseProgram,
  // ProgramDetails' props (schedules, cycle, Crying's variety)
  programDetailProps = {},
  // buildProgramDay(programId, dayId) → { slots }: a day as the session it would build today
  buildProgramDay,
  // onStartProgramDay(programId, dayId): LOAD on a built-in program's day
  onStartProgramDay,
  // onCopyProgram(programId) → the new routines (in order): COPY TO MY PROGRAMS
  onCopyProgram,
  // Crying's ROUTINE PREFERENCES (a node), shown on its page; onAutoSession: its START A SESSION
  cryingSettings = null,
  onAutoSession,
  // Cycles logged under each program (utils/programCycles.js findLoggedCycles) and SAVE AS PROGRAM:
  // onSaveCycle(cycle) → the cycle's sessions as routines (useWorkoutMutations.cycleToRoutines)
  loggedCycles = [],
  onSaveCycle,
  // The program open ('builtin:<id>' | 'own:<id>' | null). Controlled by page.js so an open program is a step of its
  // own in the back history (← and the phone's back gesture return to the list); uncontrolled when not passed.
  openRef: controlledRef,
  onOpenRef,
  // ATHLETE mode: no variables, cycle reviews, COPY, cycle setting or routine preferences (just choosing and loading)
  athleteMode = false,
  // The program grid: a new routine for a cell (onNewRoutineForCell(programId, week, dayId)) and editing one
  onNewRoutineForCell,
  onEditRoutine
}) {
  // The logged cycle opened on a built-in program's page (its review)
  const [openCycleId, setOpenCycleId] = useState(null);
  const [localRef, setLocalRef] = useState(null);
  const openRef = onOpenRef ? controlledRef || null : localRef;
  const setOpenRef = onOpenRef || setLocalRef;
  const openId = openRef?.startsWith('own:') ? openRef.slice(4) : null;
  const builtInId = openRef?.startsWith('builtin:') ? openRef.slice(8) : null;
  const setOpenId = id => setOpenRef(id ? `own:${id}` : null);
  const closeBuiltIn = () => setOpenRef(null);
  const [adding, setAdding] = useState(false);
  const open = (playlists || []).find(p => p.id === openId) || null;
  const openBuiltIn = (builtInPrograms || []).find(p => p.id === builtInId) || null;
  // The open built-in program's days as routines: worked out once each time a program is opened
  const builtInDays = useMemo(
    () =>
      openBuiltIn && hasProgramDays(openBuiltIn)
        ? openBuiltIn.days.map(day => {
            const slots = buildProgramDay?.(openBuiltIn.id, day.id)?.slots || [];
            return { id: day.id, name: day.name, exercises: exerciseNamesOf({ slots }), count: getWorkoutExerciseIds({ slots }).length };
          })
        : [],
    [builtInId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const openProgram = program => {
    setOpenRef(`builtin:${program.id}`);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const copyProgram = program => {
    const routines = onCopyProgram?.(program.id) || [];
    if (routines.length === 0) return;
    const p = {
      id: newId(),
      name: program.label,
      routineKeys: routines.map(r => r.key),
      nextKey: routines[0].key,
      fromProgram: program.id,
      updatedAt: new Date().toISOString()
    };
    setPlaylists?.(prev => [...(prev || []), p]);
    setOpenId(p.id);
    setAdding(false);
  };

  // SAVE AS PROGRAM: a logged cycle, week by week as it was done, as a program of your own (its routines inside it)
  const saveCycle = cycle => {
    const routines = onSaveCycle?.(cycle) || [];
    if (routines.length === 0) return;
    const p = {
      id: newId(),
      name: `${cycle.programLabel} · ${formatDateYMD(cycle.startMs)}`,
      routineKeys: routines.map(r => r.key),
      nextKey: routines[0].key,
      routines,
      source: { programId: cycle.programId, startMs: cycle.startMs, endMs: cycle.endMs, sessions: cycle.sessions.length },
      updatedAt: new Date().toISOString()
    };
    setPlaylists?.(prev => [...(prev || []), p]);
    setOpenId(p.id);
    setAdding(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // USE THIS PROGRAM (white) / FOLLOWING ✓ (the program you follow)
  const programChoiceButton = id => {
    const on = id === activeProgramId;
    return (
      <Button
        variant={on ? 'secondary' : 'success'}
        disabled={on}
        aria-pressed={on}
        onClick={() => onUseProgram?.(id)}
        style={{ minHeight: '48px', width: '100%', ...(on ? { opacity: 1, color: '#BDBDBD' } : {}) }}
      >
        {on ? 'YOUR PROGRAM ✓' : 'USE THIS PROGRAM'}
      </Button>
    );
  };
  const rowStyle = {
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
  };
  const backButton = onClick => (
    <button
      type="button"
      className="kinetic-btn"
      onClick={onClick}
      style={{ justifySelf: 'start', height: '44px', padding: '0 4px', background: 'none', border: 'none', color: '#FFFFFF', fontFamily: 'inherit', fontSize: '12px', fontWeight: 500, letterSpacing: '0.08em', cursor: 'pointer' }}
    >
      ‹ ALL PROGRAMS
    </button>
  );

  const update = (id, change) =>
    setPlaylists?.(prev =>
      (prev || []).map(p => (p.id === id ? { ...p, ...(typeof change === 'function' ? change(p) : change), updatedAt: new Date().toISOString() } : p))
    );

  const createPlaylist = () => {
    // COACH: a program grid (4 weeks × 3 days) to build week by week; ATHLETE: a simple list of routines
    const p = {
      id: newId(),
      name: `Program ${(playlists || []).length + 1}`,
      routineKeys: [],
      nextKey: null,
      ...(athleteMode ? {} : { grid: newGrid(4, 3) }),
      updatedAt: new Date().toISOString()
    };
    setPlaylists?.(prev => [...(prev || []), p]);
    setOpenId(p.id);
    setAdding(!p.grid);
  };

  // Loading a routine from a playlist: the one after it is up next (the first again after the last)
  const loadFrom = (playlist, items, index) => {
    const routine = items[index];
    if (!routine) return;
    const { patch, programCycle } = programCycleLoad(playlist, index);
    onLoad?.({ ...routine, programCycle }, () =>
      update(playlist.id, { ...patch, nextKey: items[(index + 1) % items.length]?.key || null })
    );
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

  // YOUR LOGGED CYCLES on a built-in program's page: each cycle (dates, sessions, weeks), its week-by-week review
  // against the cycle before it, and SAVE AS PROGRAM
  const renderCycles = program => {
    if (athleteMode) return null;
    const cycles = (loggedCycles || []).filter(c => c.programId === program.id);
    if (cycles.length === 0) {
      return (
        <IOSListSection header="YOUR LOGGED CYCLES" colors={colors}>
          <IOSListRow isLast colors={colors}>
            <span style={UI.rowSub}>
              None yet. Each session you log on this program is kept with its week and day; once a cycle is logged you can
              review it here and save it as a program of your own, exactly as you did it.
            </span>
          </IOSListRow>
        </IOSListSection>
      );
    }
    return (
      <IOSListSection header={`YOUR LOGGED CYCLES (${cycles.length})`} colors={colors}>
        {cycles.map(c => {
          const isOpen = openCycleId === c.id;
          return (
            <div key={c.id}>
              <button
                type="button"
                className="kinetic-btn"
                aria-expanded={isOpen}
                aria-label={`Cycle ${cycleDates(c)}: ${isOpen ? 'hide' : 'show'} its review`}
                onClick={() => setOpenCycleId(isOpen ? null : c.id)}
                style={rowStyle}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '15px', ...UI.sessionName, color: '#FFFFFF' }}>{cycleDates(c)}</span>
                  <span style={{ ...subLine, display: 'block' }}>
                    {c.sessions.length} {c.sessions.length === 1 ? 'SESSION' : 'SESSIONS'} • WEEKS {c.weeks.join(', ')} •{' '}
                    {c.complete ? 'COMPLETE' : 'IN PROGRESS'}
                  </span>
                </span>
                <span aria-hidden="true" style={{ color: '#9A9A9A', fontSize: '14px' }}>
                  {isOpen ? '▴' : '▾'}
                </span>
              </button>
              {isOpen && (
                <>
                  <CycleReview cycle={c} before={previousCycle(loggedCycles, c)} />
                  {!readOnly && onSaveCycle && (
                    <div style={{ padding: '10px 12px 12px', backgroundColor: '#000000', ...SHARED_CELL_BORDER }}>
                      <Button variant="success" onClick={() => saveCycle(c)} style={{ minHeight: '48px', width: '100%' }}>
                        SAVE AS PROGRAM
                      </Button>
                      <div style={{ ...UI.sentence, fontSize: '12px', paddingTop: '8px' }}>
                        Makes a program of your own from these {c.sessions.length} sessions, week by week as you did them
                        (your edits included). Each keeps its reps and effort; the weights are worked out for whoever loads
                        it.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </IOSListSection>
    );
  };

  // ── A built-in program ──────────────────────────────────────────────────────────────────────────────────────
  if (openBuiltIn) {
    const days = builtInDays;
    return (
      <div>
        <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '12px', display: 'grid', gap: '8px' }}>
          {backButton(closeBuiltIn)}
          <div style={{ fontSize: '22px', fontWeight: 300, color: '#FFFFFF', padding: '0 4px' }}>{openBuiltIn.label}</div>
          {!readOnly && programChoiceButton(openBuiltIn.id)}
        </div>
        <ProgramDetails colors={colors} program={openBuiltIn} isActive={openBuiltIn.id === activeProgramId} showVariables={!athleteMode} {...programDetailProps} />
        {openBuiltIn.id === 'crying' ? (
          <>
            {!athleteMode && cryingSettings}
            {onAutoSession && !readOnly && (
              <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '16px' }}>
                <div style={{ ...UI.sentence, padding: '0 4px 8px' }}>
                  Crying has no fixed routines: each session is built from your stimulus map, your equipment and the
                  routine preferences above.
                </div>
                <Button variant="secondary" onClick={onAutoSession} style={{ minHeight: '52px', width: '100%' }}>
                  START A CRYING SESSION
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <IOSListSection header={`ROUTINES (${days.length})`} colors={colors}>
              {days.map((day, i) => (
                <div key={day.id} style={{ display: 'grid', gridTemplateColumns: `34px minmax(0, 1fr)${readOnly ? '' : ' 60px'}`, alignItems: 'stretch', backgroundColor: '#1C1C1C' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A9A9A', fontSize: '13px', ...SHARED_CELL_BORDER }}>{i + 1}</div>
                  <div style={{ padding: '8px 12px', minWidth: 0, minHeight: '56px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', ...SHARED_CELL_BORDER }}>
                    <div style={{ fontSize: '15px', ...UI.sessionName, color: '#FFFFFF', overflowWrap: 'anywhere' }}>{day.name}</div>
                    <div style={subLine}>
                      {day.count} {day.count === 1 ? 'EXERCISE' : 'EXERCISES'}
                    </div>
                    {day.exercises && (
                      <div style={{ ...UI.rowContents, marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {day.exercises}
                      </div>
                    )}
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      className="kinetic-btn"
                      aria-label={`Load ${openBuiltIn.label}: ${day.name}`}
                      onClick={() => onStartProgramDay?.(openBuiltIn.id, day.id)}
                      style={{ ...cellBtn, backgroundColor: '#2A2A2A', color: '#FFFFFF' }}
                    >
                      LOAD
                    </button>
                  )}
                </div>
              ))}
            </IOSListSection>
            <div style={{ ...UI.sentence, padding: '0 calc(var(--dp-spacing-gutter) + 4px)', margin: '-4px 0 12px' }}>
              Each routine is shown as it would be built for you today: the program keeps reps and effort, and works out
              the weights from your own 1RMs.
            </div>
            {renderCycles(openBuiltIn)}
            {!readOnly && !athleteMode && onCopyProgram && (
              <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '16px' }}>
                <Button variant="dashed" onClick={() => copyProgram(openBuiltIn)} style={{ width: '100%', minHeight: '48px' }}>
                  COPY TO MY PROGRAMS
                </Button>
                <div style={{ ...UI.sentence, padding: '8px 4px 0' }}>
                  Saves its {days.length} routines to your ROUTINES and makes a program of your own from them, to change
                  as you like. The copy repeats its routines in order; it doesn&apos;t move through the weeks.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── The list: built-in programs, then yours ─────────────────────────────────────────────────────────────────
  if (!open) {
    const activeTag = <span style={{ ...pill, marginLeft: 0, marginRight: '6px' }}>YOURS</span>;
    return (
      <>
        {(builtInPrograms || []).length > 0 && (
          <IOSListSection header="BUILT-IN" colors={colors}>
            {builtInPrograms.map(p => (
              <button key={p.id} type="button" className="kinetic-btn" aria-label={`Open program ${p.label}`} onClick={() => openProgram(p)} style={rowStyle}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '15px', ...UI.sessionName, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.label}
                  </span>
                  <span style={{ ...subLine, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.id === activeProgramId && activeTag}
                    {hasProgramDays(p) ? `${p.days.length} ROUTINES` : 'BUILT FROM YOUR STIMULUS MAP'}
                    {p.cycleWeeks ? ` • ${p.cycleWeeks} WEEKS` : ''}
                  </span>
                </span>
                <span aria-hidden="true" style={{ color: '#9A9A9A', fontSize: '20px' }}>
                  ›
                </span>
              </button>
            ))}
          </IOSListSection>
        )}
        <IOSListSection header="YOUR PROGRAMS" colors={colors}>
          {(playlists || []).length === 0 ? (
            <IOSListRow isLast colors={colors}>
              <span style={UI.rowSub}>
                No programs of your own yet. A program keeps saved routines in order and remembers which one is next; COPY a
                built-in one to start from it.
              </span>
            </IOSListRow>
          ) : (
            playlists.map(p => {
              const { items, nextIndex } = resolvePlaylist(p, savedRoutines);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="kinetic-btn"
                  aria-label={`Open program ${p.name}`}
                  onClick={() => {
                    setOpenId(p.id);
                    setAdding(false);
                  }}
                  style={rowStyle}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '15px', ...UI.sessionName, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name || 'Program'}
                    </span>
                    <span style={{ ...subLine, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {customProgramId(p.id) === activeProgramId && activeTag}
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
        {!readOnly && (
          <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '12px' }}>
            <Button variant="dashed" onClick={createPlaylist} style={{ minHeight: '48px', width: '100%' }}>
              + NEW PROGRAM
            </Button>
          </div>
        )}
      </>
    );
  }

  // ── One of your programs ────────────────────────────────────────────────────────────────────────────────────────────
  const { items, nextIndex } = resolvePlaylist(open, savedRoutines);
  const inPlaylist = new Set(items.map(r => r.key));
  const addable = (savedRoutines || []).filter(r => !inPlaylist.has(r.key));
  // A grid program's routines come from its grid: as a list (ATHLETE) they can't be reordered, removed or added to
  const listLocked = readOnly || Boolean(open.grid);

  return (
    <div>
      <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '12px', display: 'grid', gap: '8px' }}>
        {backButton(() => setOpenId(null))}
        <label style={{ display: 'grid', gap: '4px' }}>
          <span style={{ ...UI.capsLabel, paddingLeft: '4px' }}>PROGRAM NAME</span>
          <input
            type="text"
            value={open.name}
            readOnly={readOnly}
            maxLength={60}
            placeholder="Name this program"
            onChange={e => update(open.id, { name: e.target.value })}
            onBlur={e => {
              if (!e.target.value.trim()) update(open.id, { name: 'Program' });
            }}
            style={{ ...UI.field, width: '100%', boxSizing: 'border-box' }}
          />
        </label>
        {open.source && (
          <div style={{ ...UI.sentence, padding: '0 4px' }}>
            From your {(builtInPrograms || []).find(b => b.id === open.source.programId)?.label || 'program'} cycle,{' '}
            {formatDateYMD(open.source.startMs)} – {formatDateYMD(open.source.endMs)}: {open.source.sessions} sessions as you
            did them.
          </div>
        )}
        {!readOnly && items.length > 0 && programChoiceButton(customProgramId(open.id))}
        {/* CYCLE INCREMENT (on unless turned off): the same reps and effort every cycle, the weights a step up each one */}
        {!athleteMode && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#1C1C1C', borderRadius: '14px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 500, color: '#FFFFFF' }}>Cycle increment</div>
            <div style={{ ...UI.sentence, fontSize: '12px', marginTop: '2px' }}>
              {open.cycleIncrement === false
                ? 'Off: each routine works from your 1RM as it stands when you load it.'
                : 'Reps and effort stay as they are; each cycle works from your 1RM before it plus your increment, so the weights go up a step every cycle.'}
              {open.cycle ? ` Cycle ${open.cycle}, started ${formatDateYMD(open.cycleStartMs)}.` : ''}
            </div>
          </div>
          <button
            type="button"
            className="kinetic-btn"
            aria-pressed={open.cycleIncrement !== false}
            aria-label={`Cycle increment: ${open.cycleIncrement === false ? 'off' : 'on'}`}
            disabled={readOnly}
            onClick={() => update(open.id, p => ({ cycleIncrement: p.cycleIncrement === false }))}
            style={{ ...UI.pillBtn(open.cycleIncrement !== false), minWidth: '64px', minHeight: '44px' }}
          >
            {open.cycleIncrement === false ? 'OFF' : 'ON'}
          </button>
        </div>
        )}
        {items.length > 0 && (
          <Button variant="primary" onClick={() => loadFrom(open, items, nextIndex)} style={{ minHeight: '52px', width: '100%' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              START NEXT: {nameOf(items[nextIndex]).toUpperCase()}
            </span>
          </Button>
        )}
      </div>

      {open.grid && !athleteMode && (
        <ProgramGrid
          grid={open.grid}
          savedRoutines={savedRoutines}
          upNextKey={items[nextIndex]?.key || null}
          onChange={grid => update(open.id, { grid })}
          onNewRoutineForCell={(week, dayId) => onNewRoutineForCell?.(open.id, week, dayId)}
          onEditRoutine={onEditRoutine}
        />
      )}
      {!(open.grid && !athleteMode) && (
      <>
      <IOSListSection header={`ROUTINES (${items.length})`} colors={colors}>
        {items.length === 0 ? (
          <IOSListRow isLast colors={colors}>
            <span style={UI.rowSub}>
              {open.grid ? 'No routines in this program yet.' : 'No routines in this program yet. Add your saved routines below.'}
            </span>
          </IOSListRow>
        ) : (
          items.map((r, i) => {
            const isNext = i === nextIndex;
            const count = getWorkoutExerciseIds(r).length;
            // A saved cycle's routines carry their week: a WEEK n heading where the week changes
            const weekHeading = r.week && r.week !== items[i - 1]?.week;
            return (
              <React.Fragment key={r.key}>
              {weekHeading && (
                <div style={{ ...UI.capsLabel, padding: '10px 12px 6px', backgroundColor: '#000000' }}>WEEK {r.week}</div>
              )}
              <div
                data-playlist-index={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `34px minmax(0, 1fr)${isNext ? '' : ' 56px'} 60px${listLocked ? '' : ' 44px'}`,
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
                  {...handleProps(i, { disabled: listLocked })}
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
                {!listLocked && (
                  <DeleteButton
                    label={`Take ${nameOf(r)} out of the program`}
                    variant="outline"
                    fill
                    minHeight="56px"
                    style={{ width: '44px', height: 'auto', color: '#9A9A9A' }}
                    onClick={() =>
                      update(open.id, p => ({
                        routineKeys: (p.routineKeys || []).filter(k => k !== r.key),
                        ...(Array.isArray(p.routines) ? { routines: p.routines.filter(x => x.key !== r.key) } : {}),
                        // Up next moves on to the routine after it (none left: nothing)
                        nextKey: p.nextKey === r.key ? (items.length > 1 ? items[(i + 1) % items.length].key : null) : p.nextKey
                      }))
                    }
                  />
                )}
              </div>
              </React.Fragment>
            );
          })
        )}
      </IOSListSection>
      {items.length > 1 && !listLocked && (
        <div style={{ ...UI.sentence, padding: '0 calc(var(--dp-spacing-gutter) + 4px)', margin: '-4px 0 12px' }}>
          Hold a number, then drag to reorder. Loading a routine moves UP NEXT to the one after it.
        </div>
      )}

      {!listLocked && (
        <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '12px' }}>
          <Button variant="dashed" onClick={() => setAdding(a => !a)} style={{ width: '100%', minHeight: '48px' }}>
            {adding ? 'HIDE SAVED ROUTINES ▴' : '+ ADD ROUTINES'}
          </Button>
        </div>
      )}
      {!listLocked && adding && (
        <IOSListSection header={`ADD FROM SAVED (${addable.length})`} colors={colors}>
          {addable.length === 0 ? (
            <IOSListRow isLast colors={colors}>
              <span style={UI.rowSub}>
                {(savedRoutines || []).length === 0
                  ? 'No saved routines yet. Save a session as a routine, or SAVE one a friend sent you, to add it here.'
                  : 'Every saved routine is already in this program.'}
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
                  aria-label={`Add ${nameOf(r)} to the program`}
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
      </>
      )}

      {!readOnly && (
        <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '16px' }}>
          <Button
            variant="danger"
            onClick={() =>
              setDeleteConfirmTarget?.({
                type: 'generic',
                title: 'DELETE PROGRAM?',
                verb: 'delete',
                label: `${open.name || 'this program'} ${Array.isArray(open.routines) && open.routines.length ? '(its saved sessions are deleted with it; your History stays)' : '(the routines stay in ROUTINES)'}`,
                confirmLabel: 'DELETE',
                onConfirm: () => {
                  setPlaylists?.(prev => (prev || []).filter(p => p.id !== open.id));
                  // The program you follow is gone: back to Crying
                  if (customProgramId(open.id) === activeProgramId) onUseProgram?.('crying');
                  setOpenId(null);
                }
              })
            }
            style={{ width: '100%', minHeight: '48px' }}
          >
            DELETE PROGRAM
          </Button>
        </div>
      )}
    </div>
  );
}
