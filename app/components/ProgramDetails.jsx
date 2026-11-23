'use client';

// ============================================================================
// A built-in program's details on the Programs page (moved from Configuration → PROGRAM): its description and
// variables, Crying's VARIETY, the training days (the athlete's own per program, settings.programSchedules) and, for
// the program you follow, where its cycle stands (NEXT SESSION) with RESTART AT WEEK 1.
// ============================================================================

import React, { useSyncExternalStore } from 'react';
import { getAutoProgramWeek, WEEKDAYS, WEEKDAY_NAMES, weekdayOf, getProgramSchedule, getScheduledDayId, describeSchedule } from '../data/programs';
import { IOSListSection } from './Primitives';
import { UI } from '../styles/kineticTokens';

// Today, read on the client only (never Date.now() in render: cacheComponents prerendering); refreshed each minute
const subscribeMinute = cb => {
  const id = setInterval(cb, 60 * 1000);
  return () => clearInterval(id);
};
const minuteNowIso = () => new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
const noNowOnServer = () => null;

const varietySentence = v =>
  v === 0
    ? 'the fewest different exercises that still train every muscle evenly: the ones you already do keep coming back.'
    : v < 5
      ? 'leans towards exercises you already do.'
      : v === 5
        ? 'the default mix.'
        : v < 10
          ? 'leans away from exercises you did in your last sessions.'
          : 'no exercise repeats within 20 sessions while there is another that fits.';

export function ProgramDetails({
  colors,
  program,
  // The program you follow: NEXT SESSION and RESTART AT WEEK 1 are shown for it only
  isActive = false,
  programCycleStart = null,
  history = [],
  programSchedules = {},
  setProgramSchedule,
  onRestartCycle,
  cryingVariety = 5,
  setCryingVariety
}) {
  const nowIso = useSyncExternalStore(subscribeMinute, minuteNowIso, noNowOnServer);
  if (!program) return null;
  const runsWeeks = Boolean(program.weekPlan || program.days);
  const schedule = getProgramSchedule(program, programSchedules);
  const ownSchedule = Array.isArray(programSchedules?.[program.id]) && programSchedules[program.id].length > 0;
  // The next training day on the schedule (today if it is one), its week and its day
  const nextDateIso = (() => {
    if (!nowIso) return null;
    if (schedule.length === 0) return nowIso;
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(new Date(nowIso).getTime() + i * 24 * 60 * 60 * 1000).toISOString();
      if (schedule.includes(weekdayOf(d))) return d;
    }
    return nowIso;
  })();
  const next = runsWeeks && isActive && nextDateIso ? getAutoProgramWeek(program, history, nextDateIso, programCycleStart) : null;
  const currentWeek = next?.week || null;
  const nextDayId = next && nextDateIso ? getScheduledDayId(program, programSchedules, nextDateIso, next.week) || next.day : null;
  const nextDayName = nextDayId ? (program.days || []).find(d => d.id === nextDayId)?.name : null;
  const nextWeekday = nextDateIso && schedule.length > 0 ? WEEKDAY_NAMES[weekdayOf(nextDateIso)] : null;
  const toggleDay = day => {
    const nextDays = schedule.includes(day) ? schedule.filter(d => d !== day) : [...schedule, day];
    if (nextDays.length === 0) return; // at least one training day
    setProgramSchedule?.(program.id, WEEKDAYS.filter(d => nextDays.includes(d)));
  };

  return (
    <IOSListSection header="ABOUT" colors={colors}>
      <div style={{ ...UI.sentence, color: '#BDBDBD', padding: '14px 16px 12px' }}>{program.description}</div>

      {/* Crying's VARIETY: 0 = the fewest different exercises that still train every muscle evenly, 10 = no exercise
          repeats within 20 sessions, 5 = the default */}
      {program.id === 'crying' && (
        <div style={{ padding: '4px 16px 14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={UI.capsLabel}>VARIETY</span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={cryingVariety}
              aria-label="Variety: 0 = the fewest different exercises, 10 = no exercise repeats within 20 sessions"
              aria-valuetext={`${cryingVariety} of 10`}
              onChange={e => setCryingVariety?.(Number(e.target.value))}
              style={{ flex: '1 1 auto', height: '44px', accentColor: '#FFFFFF', margin: 0, cursor: 'pointer' }}
            />
            <span style={{ fontSize: '17px', fontWeight: 500, color: '#FFFFFF', width: '22px', textAlign: 'right' }}>{cryingVariety}</span>
          </label>
          <div style={{ ...UI.sentence, fontSize: '12px', color: '#BDBDBD' }}>
            Variety {cryingVariety}: {varietySentence(cryingVariety)}
          </div>
        </div>
      )}

      {/* The program's variables (sets, reps, intensity, increment, trigger, cycle, rest, equipment) */}
      {Array.isArray(program.variables) && program.variables.length > 0 && (
        <dl
          style={{
            margin: 0,
            padding: '12px 16px',
            borderTop: '1px solid var(--dp-color-rule)',
            display: 'grid',
            gridTemplateColumns: '96px minmax(0, 1fr)',
            columnGap: '12px',
            rowGap: '8px'
          }}
        >
          {program.variables.map(([label, value]) => (
            <React.Fragment key={label}>
              <dt style={{ ...UI.capsLabel, margin: 0, paddingTop: '2px' }}>{label.toUpperCase()}</dt>
              <dd style={{ margin: 0, fontSize: '13px', color: '#FFFFFF', lineHeight: 1.4 }}>{value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}

      {/* Training days: the program's own, or the athlete's pick; day-specific programs map their days onto them */}
      {runsWeeks && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--dp-color-rule)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
            <div style={UI.capsLabel}>TRAINING DAYS</div>
            {ownSchedule && (
              <button
                type="button"
                className="kinetic-btn"
                onClick={() => setProgramSchedule?.(program.id, [])}
                style={{ background: 'none', border: 'none', color: '#9A9A9A', fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', cursor: 'pointer', minHeight: '32px' }}
              >
                USE THE PROGRAM&apos;S
              </button>
            )}
          </div>
          <div role="group" aria-label="Training days" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px', marginTop: '8px' }}>
            {WEEKDAYS.map(day => {
              const on = schedule.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  className="kinetic-btn"
                  aria-pressed={on}
                  aria-label={`${WEEKDAY_NAMES[day]}: ${on ? 'training day' : 'rest day'}`}
                  onClick={() => toggleDay(day)}
                  style={{
                    height: '40px',
                    borderRadius: '10px',
                    border: on ? 'none' : '1px solid #3A3A3A',
                    backgroundColor: on ? '#FFFFFF' : 'transparent',
                    color: on ? '#000000' : '#9A9A9A',
                    fontFamily: 'inherit',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {day.toUpperCase()}
                </button>
              );
            })}
          </div>
          <div style={{ ...UI.sentence, fontSize: '12px', marginTop: '8px', color: '#BDBDBD' }}>{describeSchedule(program, programSchedules)}</div>
          {program.dayAssignment === 'weekday' && schedule.length !== (program.schedule || []).length && (
            <div style={{ ...UI.sentence, fontSize: '12px', marginTop: '4px' }}>
              This program is built for {(program.schedule || []).length} days a week; its days wrap round the ones you pick.
            </div>
          )}
        </div>
      )}

      {/* Where the cycle stands (the program you follow); RESTART puts today at week 1 */}
      {runsWeeks && isActive && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 16px 16px',
            borderTop: '1px solid var(--dp-color-rule)'
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={UI.capsLabel}>NEXT SESSION</div>
            <div style={{ fontSize: '17px', fontWeight: 500, color: '#FFFFFF', marginTop: '2px' }}>
              {nextWeekday ? `${nextWeekday} · ` : ''}
              {currentWeek ? `${program.weekName(currentWeek)} of ${program.cycleWeeks}` : `Week 1 of ${program.cycleWeeks}`}
              {nextDayName ? ` · ${nextDayName}` : ''}
            </div>
            <div style={{ ...UI.sentence, fontSize: '12px', marginTop: '2px' }}>
              Moves on a week the first time you train in a new week (Monday to Sunday)
              {program.days
                ? program.dayAssignment === 'weekday'
                  ? '; each training day has its own workout (off-schedule sessions take the next one).'
                  : '; the workouts alternate from your last logged session.'
                : '.'}
            </div>
          </div>
          <button
            type="button"
            className="kinetic-btn"
            onClick={onRestartCycle}
            style={{ ...UI.secondaryBtnCenter, width: 'auto', minHeight: '44px', padding: '0 14px', flexShrink: 0 }}
          >
            RESTART AT WEEK 1
          </button>
        </div>
      )}
    </IOSListSection>
  );
}

export default ProgramDetails;
