'use client';

// ============================================================================
// PROGRAM BUILDER GRID (Programs page → one of your programs, COACH): weeks down, days across, one routine per cell
// (utils/programGrid.js). Week 1 is the base: each later week is week 1 with its WEEK RULE (effort change in RIR,
// reps, working sets) unless a cell has a routine of its own. Tap a cell: pick one of your routines, make a new one,
// edit it, or put a later week's cell back on week 1's rule. Tap a week's label: its rule. WEEKS / DAYS − + resize.
// The cell up next (START NEXT) has a white outline.
// ============================================================================

import React, { useState } from 'react';
import { UI } from '../styles/kineticTokens';
import { Button, CloseButton } from './Controls';
import { PickList, PickRow } from './PickList';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { stripDateFromTitle } from '../data/exerciseLibrary';
import {
  GRID_MAX_DAYS,
  GRID_MAX_WEEKS,
  cellKey,
  cellRoutine,
  describeWeekRule,
  isPlainRule,
  resizeGrid,
  weekRuleOf
} from '../utils/programGrid';

const nameOf = r => stripDateFromTitle(r?.label) || r?.label || 'Routine';
const stepBtn = {
  width: '44px',
  height: '44px',
  border: 'none',
  borderRadius: '10px',
  backgroundColor: '#2A2A2A',
  color: '#FFFFFF',
  fontSize: '18px',
  cursor: 'pointer'
};

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ ...UI.capsLabel, marginRight: '2px' }}>{label}</span>
      <button type="button" className="kinetic-btn" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)} style={{ ...stepBtn, opacity: value <= min ? 0.4 : 1 }}>
        −
      </button>
      <span style={{ minWidth: '22px', textAlign: 'center', fontSize: '17px', fontWeight: 500, color: '#FFFFFF' }}>{value}</span>
      <button type="button" className="kinetic-btn" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)} style={{ ...stepBtn, opacity: value >= max ? 0.4 : 1 }}>
        +
      </button>
    </div>
  );
}

const pillRow = { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', marginBottom: '14px' };
const pill = on => ({ ...UI.pillBtn(on), minWidth: '44px', minHeight: '40px', padding: '4px 10px', letterSpacing: 0 });

// A week's rule: effort change (RIR), reps and working sets for every exercise of that week
function WeekRuleModal({ week, rule, onApply, onClose }) {
  const [draft, setDraft] = useState(rule);
  useModalScrollLock(true);
  const set = patch => setDraft(d => ({ ...d, ...patch }));
  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 1300 }}>
      <div style={UI.modalCard('400px')} role="dialog" aria-label={`Week ${week} rule`}>
        <div style={UI.modalHeader}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={UI.fieldLabel}>WEEK RULE</div>
            <div style={{ fontSize: '16px', fontWeight: 500 }}>WEEK {week}</div>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <div style={{ ...UI.sentence, fontSize: '13px', color: '#BDBDBD' }}>
          Week {week} is week 1 with these changes, on every exercise (cells with a routine of their own keep theirs).
        </div>
        <div style={{ ...UI.capsLabel, marginTop: '14px' }}>EFFORT · REPS IN RESERVE</div>
        <div role="group" aria-label="Effort change" style={pillRow}>
          {[-3, -2, -1, 0, 1, 2, 3].map(v => (
            <button key={v} type="button" className="kinetic-btn" aria-pressed={draft.rir === v} onClick={() => set({ rir: v })} style={pill(draft.rir === v)}>
              {v === 0 ? 'SAME' : `${v > 0 ? '+' : '−'}${Math.abs(v)}`}
            </button>
          ))}
        </div>
        <div style={{ ...UI.sentence, fontSize: '12px', marginTop: '-8px', marginBottom: '12px' }}>
          − is harder (fewer reps left in the tank), + is easier.
        </div>
        <div style={UI.capsLabel}>REPS ON WORKING SETS</div>
        <div role="group" aria-label="Reps" style={pillRow}>
          {[null, 1, 3, 5, 6, 8, 10, 12, 15].map(v => (
            <button key={String(v)} type="button" className="kinetic-btn" aria-pressed={draft.reps === v} onClick={() => set({ reps: v })} style={pill(draft.reps === v)}>
              {v === null ? 'SAME' : v}
            </button>
          ))}
        </div>
        <div style={UI.capsLabel}>WORKING SETS</div>
        <div role="group" aria-label="Working sets" style={pillRow}>
          {[null, 1, 2, 3, 4, 5, 6].map(v => (
            <button key={String(v)} type="button" className="kinetic-btn" aria-pressed={draft.sets === v} onClick={() => set({ sets: v })} style={pill(draft.sets === v)}>
              {v === null ? 'SAME' : v}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <Button variant="secondary" onClick={onClose} style={{ minHeight: '48px' }}>
            CANCEL
          </Button>
          <Button variant="primary" onClick={() => onApply(draft)} style={{ minHeight: '48px' }}>
            APPLY
          </Button>
        </div>
      </div>
    </div>
  );
}

// A cell: pick a routine, a new one, edit it, or (a later week) back on week 1's rule
function CellModal({ week, day, current, savedRoutines, onPick, onNew, onEdit, onUseRule, onClear, onClose }) {
  const [picking, setPicking] = useState(!current.routine);
  useModalScrollLock(true);
  const ownKey = current.source === 'own' ? current.routine?.key : null;
  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 1300 }}>
      <div style={UI.modalCard('400px')} role="dialog" aria-label={`Week ${week}, ${day.name}`}>
        <div style={UI.modalHeader}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={UI.fieldLabel}>
              WEEK {week} · {day.name.toUpperCase()}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 500, ...UI.sessionName }}>{current.routine ? nameOf(current.routine) : 'Empty'}</div>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        {current.source === 'rule' && (
          <div style={{ ...UI.sentence, fontSize: '13px', color: '#BDBDBD', marginBottom: '12px' }}>
            Week 1&apos;s routine with this week&apos;s rule. Pick a routine to give this week one of its own.
          </div>
        )}
        <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
          <Button variant="secondary" onClick={() => setPicking(p => !p)} style={{ minHeight: '48px' }}>
            {picking ? 'HIDE YOUR ROUTINES ▴' : 'PICK ONE OF YOUR ROUTINES ▾'}
          </Button>
          {picking && (
            <PickList label="Your routines" multiselect={false} maxHeight="260px">
              {(savedRoutines || []).length === 0 ? (
                <div style={{ ...UI.sentence, fontSize: '13px', padding: '8px 4px' }}>No saved routines yet: make one with + NEW ROUTINE.</div>
              ) : (
                savedRoutines.map(r => (
                  <PickRow key={r.key} on={r.key === ownKey} showCheck={false} label={nameOf(r)} onClick={() => onPick(r.key)} />
                ))
              )}
            </PickList>
          )}
          <Button variant="dashed" onClick={onNew} style={{ minHeight: '48px' }}>
            + NEW ROUTINE FOR THIS CELL
          </Button>
          {current.routine && (
            <Button variant="secondary" onClick={() => onEdit(current.source === 'own' ? current.routine : null)} style={{ minHeight: '48px' }}>
              {current.source === 'own' ? 'EDIT THIS ROUTINE' : "EDIT WEEK 1'S ROUTINE"}
            </Button>
          )}
          {ownKey && week > 1 && (
            <Button variant="secondary" onClick={onUseRule} style={{ minHeight: '48px' }}>
              BACK TO WEEK 1 + RULE
            </Button>
          )}
          {ownKey && week === 1 && (
            <Button variant="danger" onClick={onClear} style={{ minHeight: '48px' }}>
              EMPTY THIS CELL
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProgramGrid({ grid, savedRoutines = [], upNextKey = null, onChange, onNewRoutineForCell, onEditRoutine }) {
  const [cellOpen, setCellOpen] = useState(null); // { week, dayId }
  const [ruleOpen, setRuleOpen] = useState(null); // week
  const days = grid.days || [];
  const weeks = Array.from({ length: grid.weeks }, (_, i) => i + 1);
  const setCell = (week, dayId, key) => {
    const cells = { ...(grid.cells || {}) };
    if (key) cells[cellKey(week, dayId)] = key;
    else delete cells[cellKey(week, dayId)];
    onChange({ ...grid, cells });
  };
  const cols = `44px repeat(${days.length}, minmax(0, 1fr))`;
  const openCell = cellOpen ? { ...cellOpen, day: days.find(d => d.id === cellOpen.dayId) } : null;
  const week1Of = dayId => (savedRoutines || []).find(r => r.key === grid.cells?.[cellKey(1, dayId)]) || null;

  return (
    <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '16px' }}>
      <div style={{ ...UI.sectionTitle, marginBottom: '8px' }}>PROGRAM GRID</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
        <Stepper label="WEEKS" value={grid.weeks} min={1} max={GRID_MAX_WEEKS} onChange={v => onChange(resizeGrid(grid, { weeks: v }))} />
        <Stepper label="DAYS" value={days.length} min={1} max={GRID_MAX_DAYS} onChange={v => onChange(resizeGrid(grid, { dayCount: v }))} />
      </div>
      <div role="grid" aria-label="Program grid: weeks down, days across" style={{ borderRadius: '14px', overflow: 'hidden', backgroundColor: '#1C1C1C' }}>
        <div role="row" style={{ display: 'grid', gridTemplateColumns: cols }}>
          <div role="columnheader" style={{ ...UI.capsLabel, padding: '8px 4px', textAlign: 'center', borderBottom: '1px solid var(--dp-color-rule)' }}>
            WK
          </div>
          {days.map(d => (
            <div key={d.id} role="columnheader" style={{ ...UI.capsLabel, padding: '8px 2px', textAlign: 'center', borderBottom: '1px solid var(--dp-color-rule)', borderLeft: '1px solid var(--dp-color-rule)' }}>
              {d.id}
            </div>
          ))}
        </div>
        {weeks.map(week => {
          const rule = weekRuleOf(grid, week);
          return (
            <div key={week} role="row" style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: week < grid.weeks ? '1px solid var(--dp-color-rule)' : 'none' }}>
              <button
                type="button"
                className="kinetic-btn"
                role="rowheader"
                aria-label={week === 1 ? 'Week 1: the base week' : `Week ${week} rule: ${describeWeekRule(rule)}`}
                disabled={week === 1}
                onClick={() => setRuleOpen(week)}
                style={{
                  minHeight: '60px',
                  border: 'none',
                  backgroundColor: '#1C1C1C',
                  color: '#FFFFFF',
                  fontFamily: 'inherit',
                  cursor: week === 1 ? 'default' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  padding: '2px'
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 500 }}>{week}</span>
                <span style={{ fontSize: '9px', fontWeight: 500, color: '#9A9A9A', letterSpacing: '0.04em' }}>
                  {week === 1 ? 'BASE' : isPlainRule(rule) ? 'RULE ▾' : rule.rir ? `${rule.rir > 0 ? '+' : '−'}${Math.abs(rule.rir)} RIR` : 'RULE ✓'}
                </span>
              </button>
              {days.map(day => {
                const { routine, source } = cellRoutine(grid, week, day.id, savedRoutines);
                const isNext = upNextKey === `grid_${week}_${day.id}`;
                return (
                  <button
                    key={day.id}
                    type="button"
                    className="kinetic-btn"
                    role="gridcell"
                    aria-label={`Week ${week}, ${day.name}: ${routine ? `${nameOf(routine)}${source === 'rule' ? " (week 1's, with this week's rule)" : ''}` : 'empty'}${isNext ? ', up next' : ''}`}
                    onClick={() => setCellOpen({ week, dayId: day.id })}
                    style={{
                      minHeight: '60px',
                      minWidth: 0,
                      border: 'none',
                      borderLeft: '1px solid var(--dp-color-rule)',
                      boxShadow: isNext ? 'inset 0 0 0 2px #FFFFFF' : 'none',
                      backgroundColor: source === 'own' ? '#262626' : '#1C1C1C',
                      color: source === 'own' ? '#FFFFFF' : '#8A8A8A',
                      fontFamily: 'inherit',
                      fontSize: '10px',
                      fontWeight: 500,
                      lineHeight: 1.2,
                      padding: '4px 3px',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textTransform: 'uppercase',
                      overflowWrap: 'anywhere'
                    }}
                  >
                    {routine ? (
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{nameOf(routine)}</span>
                    ) : (
                      <span style={{ fontSize: '16px', color: '#3A3A3A' }}>+</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={{ ...UI.sentence, fontSize: '12px', padding: '8px 4px 0' }}>
        Week 1 is the base: later weeks repeat it with their rule (tap a week&apos;s number) unless a cell has a routine of its
        own (lighter). Tap a cell to fill it.
      </div>

      {openCell && openCell.day && (
        <CellModal
          week={openCell.week}
          day={openCell.day}
          current={cellRoutine(grid, openCell.week, openCell.dayId, savedRoutines)}
          savedRoutines={savedRoutines}
          onPick={key => {
            setCell(openCell.week, openCell.dayId, key);
            setCellOpen(null);
          }}
          onNew={() => {
            setCellOpen(null);
            onNewRoutineForCell?.(openCell.week, openCell.dayId);
          }}
          onEdit={own => {
            const target = own || week1Of(openCell.dayId);
            setCellOpen(null);
            if (target) onEditRoutine?.(target);
          }}
          onUseRule={() => {
            setCell(openCell.week, openCell.dayId, null);
            setCellOpen(null);
          }}
          onClear={() => {
            setCell(openCell.week, openCell.dayId, null);
            setCellOpen(null);
          }}
          onClose={() => setCellOpen(null)}
        />
      )}
      {ruleOpen && (
        <WeekRuleModal
          week={ruleOpen}
          rule={weekRuleOf(grid, ruleOpen)}
          onApply={rule => {
            onChange({ ...grid, weekRules: { ...(grid.weekRules || {}), [ruleOpen]: rule } });
            setRuleOpen(null);
          }}
          onClose={() => setRuleOpen(null)}
        />
      )}
    </div>
  );
}

export default ProgramGrid;
