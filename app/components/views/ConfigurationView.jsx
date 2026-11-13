'use client';

// ============================================================================
// VIEW: 01 / CONFIGURATION (view id 'configuration'; replaces Onboarding and the Routines, Equipment and
// Goals menu pages). One tab per topic, each showing the same content as the page it replaced:
// BODY METRICS · GOALS (GoalsView) · EQUIPMENT (GymsView) · ROUTINES (ROUTINE + EXERCISE SET PREFERENCES).
// Routines themselves (default, saved, shared, friends') are only reached from a blank session's LOAD ROUTINE.
// New athletes land here after signing up; NEXT → steps through the tabs and DONE → goes Home.
// ============================================================================

import React, { useSyncExternalStore } from 'react';
import { TabBar, Button } from '../Controls';
import { BodyMetricsSection, RoutinePreferencesSection, SetPreferencesSection } from './SettingsView';
import { GoalsView } from './GoalsView';
import { GymsView } from './GymsView';
import {
  PROGRAMS,
  getProgram,
  getAutoProgramWeek,
  WEEKDAYS,
  WEEKDAY_NAMES,
  weekdayOf,
  getProgramSchedule,
  getScheduledDayId,
  describeSchedule
} from '../../data/programs';
import { formatDateYMD } from '../../data/exerciseLibrary';
import { IOSListSection } from '../Primitives';
import { UI, SHARED_CELL_BORDER } from '../../styles/kineticTokens';

/**
 * PROGRAM: which training program plans the sessions (settings.program). The chosen program is a red row (an answer
 * on Configuration) with its description under the list. Programs other than Crying are listed as coming soon.
 */
// Today, read on the client only (never Date.now() in render: cacheComponents prerendering); refreshed each minute
const subscribeMinute = cb => {
  const id = setInterval(cb, 60 * 1000);
  return () => clearInterval(id);
};
const minuteNowIso = () => new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
const noNowOnServer = () => null;

function ProgramSection({
  colors,
  trainingProgram = 'crying',
  setTrainingProgram,
  programCycleStart = null,
  history = [],
  programSchedules = {},
  setProgramSchedule,
  onRestartCycle
}) {
  const chosen = getProgram(trainingProgram);
  const nowIso = useSyncExternalStore(subscribeMinute, minuteNowIso, noNowOnServer);
  const runsWeeks = Boolean(chosen.weekPlan || chosen.days);
  const schedule = getProgramSchedule(chosen, programSchedules);
  const ownSchedule = Array.isArray(programSchedules?.[chosen.id]) && programSchedules[chosen.id].length > 0;
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
  const next = runsWeeks && nextDateIso ? getAutoProgramWeek(chosen, history, nextDateIso, programCycleStart) : null;
  const currentWeek = next?.week || null;
  const nextDayId = runsWeeks && nextDateIso ? getScheduledDayId(chosen, programSchedules, nextDateIso, next?.week) || next?.day : null;
  const nextDayName = nextDayId ? (chosen.days || []).find(d => d.id === nextDayId)?.name : null;
  const nextWeekday = nextDateIso && schedule.length > 0 ? WEEKDAY_NAMES[weekdayOf(nextDateIso)] : null;
  const toggleDay = day => {
    const nextDays = schedule.includes(day) ? schedule.filter(d => d !== day) : [...schedule, day];
    if (nextDays.length === 0) return; // at least one training day
    setProgramSchedule?.(chosen.id, WEEKDAYS.filter(d => nextDays.includes(d)));
  };
  return (
    <IOSListSection header="PROGRAM" colors={colors}>
      <div role="group" aria-label="Training program" style={{ display: 'flex', flexDirection: 'column' }}>
        {PROGRAMS.map(p => {
          const on = p.id === chosen.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              className="kinetic-btn"
              onClick={() => setTrainingProgram?.(p.id)}
              style={{
                minHeight: '52px',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                backgroundColor: '#1C1C1C',
                color: '#FFFFFF',
                border: 'none',
                ...SHARED_CELL_BORDER,
                borderLeft: 'none',
                borderRight: 'none',
                borderTop: 'none',
                fontFamily: 'inherit',
                fontSize: '16px',
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <span>{p.label}</span>
              {p.comingSoon && (
                <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em', opacity: 0.75, whiteSpace: 'nowrap' }}>
                  COMING SOON
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ ...UI.sentence, color: '#BDBDBD', padding: '14px 16px 16px' }}>{chosen.description}</div>
      {/* The program's variables (sets, reps, intensity, increment, trigger, cycle, rest, equipment) */}
      {Array.isArray(chosen.variables) && chosen.variables.length > 0 && (
        <dl style={{ margin: 0, padding: '0 16px 12px', display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', columnGap: '12px', rowGap: '8px' }}>
          {chosen.variables.map(([label, value]) => (
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
                onClick={() => setProgramSchedule?.(chosen.id, [])}
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
          <div style={{ ...UI.sentence, fontSize: '12px', marginTop: '8px', color: '#BDBDBD' }}>{describeSchedule(chosen, programSchedules)}</div>
          {chosen.dayAssignment === 'weekday' && schedule.length !== (chosen.schedule || []).length && (
            <div style={{ ...UI.sentence, fontSize: '12px', marginTop: '4px' }}>
              This program is built for {(chosen.schedule || []).length} days a week; its days wrap round the ones you pick.
            </div>
          )}
        </div>
      )}

      {/* Where the cycle stands; RESTART puts today at week 1 */}
      {runsWeeks && (
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
              {currentWeek ? `${chosen.weekName(currentWeek)} of ${chosen.cycleWeeks}` : `Week 1 of ${chosen.cycleWeeks}`}
              {nextDayName ? ` · ${nextDayName}` : ''}
            </div>
            <div style={{ ...UI.sentence, fontSize: '12px', marginTop: '2px' }}>
              Moves on a week the first time you train in a new week (Monday to Sunday)
              {chosen.days
                ? chosen.dayAssignment === 'weekday'
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

export const CONFIGURATION_TABS = [
  { id: 'body', label: 'BODY METRICS' },
  { id: 'goals', label: 'GOALS' },
  { id: 'equipment', label: 'EQUIPMENT' },
  // id stays 'routines' (saved tab choice); the tab is called PROGRAM
  { id: 'routines', label: 'PROGRAM' }
];

export function ConfigurationView({
  colors,
  tab,
  setTab,
  setCurrentView,
  bodyMetricsProps,
  goalsProps,
  equipmentProps,
  routinePreferencesProps,
  setPreferencesProps,
  programProps
}) {
  const tabIndex = Math.max(
    0,
    CONFIGURATION_TABS.findIndex(t => t.id === tab)
  );
  const activeTab = CONFIGURATION_TABS[tabIndex].id;
  const isLastTab = tabIndex === CONFIGURATION_TABS.length - 1;

  return (
    <div style={{ paddingBottom: '24px' }}>
      <div style={{ padding: '12px var(--dp-spacing-gutter) 0' }}>
        <TabBar ariaLabel="Configuration" tabs={CONFIGURATION_TABS} value={activeTab} onChange={setTab} />
      </div>

      {/* The answers on each tab (number boxes, dropdowns, selected pills, ON) are red: .cr-config in KINETIC_CSS */}
      <div className="cr-config">
      {activeTab === 'body' && (
        <div style={{ paddingTop: '16px' }}>
          <BodyMetricsSection colors={colors} {...bodyMetricsProps} />
        </div>
      )}
      {activeTab === 'goals' && <GoalsView colors={colors} {...goalsProps} />}
      {activeTab === 'equipment' && (
        <GymsView colors={colors} setCurrentView={setCurrentView} {...equipmentProps} />
      )}
      {activeTab === 'routines' && (
        <div style={{ paddingTop: '16px' }}>
          <ProgramSection colors={colors} {...programProps} />
          <RoutinePreferencesSection colors={colors} {...routinePreferencesProps} />
          <SetPreferencesSection colors={colors} {...setPreferencesProps} />
        </div>
      )}

      </div>

      {/* NEXT / DONE is white: the red is on the answers above */}
      <div style={{ padding: '0 var(--dp-spacing-gutter)' }}>
        <Button
          variant="primary-row"
          style={{ backgroundColor: '#FFFFFF', color: '#000000' }}
          onClick={() => (isLastTab ? setCurrentView('home') : setTab(CONFIGURATION_TABS[tabIndex + 1].id))}
        >
          <span>{isLastTab ? 'DONE' : `NEXT: ${CONFIGURATION_TABS[tabIndex + 1].label}`}</span>
          <span>→</span>
        </Button>
      </div>
    </div>
  );
}

export default ConfigurationView;
