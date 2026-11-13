'use client';

import React from 'react';
import { PROGRAMS, getProgram, getProgramContext } from '../data/programs';
import { SFSymbol, SessionRestTimerBar, SessionTitleBar } from './Primitives';
import { ProfileAvatar } from './ProfileAvatar';
import { getNextIncompleteSetInfo } from '../utils/workoutEngine';
import { formatDateYMD, parseYMDToISO } from '../data/exerciseLibrary';
import { Button } from './Controls';

// Page name per view, shown at the top of the page itself (PageTitle, under the locked header); the header's
// centre is the app title, a link to Home from every page
export const PAGE_TITLES = {
  history: 'PERFORMANCE',
  stimulus_map: 'STIMULUS',
  social: 'SOCIAL',
  configuration: 'CONFIGURATION',
  info: 'INFO',
  auth: 'SIGN IN',
  profile: 'PROFILE',
  friend_profile: 'PROFILE',
  routines: 'ROUTINES',
  gym_editor: 'EQUIPMENT SETUP',
  // The live session has no page title: its locked header already names it, and the space goes to the sets
  routine_editor: 'ROUTINE',
  historical_entry: 'PAST WORKOUT'
};

/** The page's name at the top of the page, under the locked header (not on Home, which has its own big title). */
export function PageTitle({ view }) {
  const title = PAGE_TITLES[view];
  if (!title) return null;
  return (
    <h1
      style={{
        margin: 0,
        padding: '16px var(--dp-spacing-gutter) 0',
        fontSize: '28px',
        fontWeight: 300,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        textTransform: 'uppercase',
        color: '#FFFFFF'
      }}
    >
      {title}
    </h1>
  );
}

// The count of routines friends sent you that are still waiting (menu's ROUTINES row)
function CountBadge({ count }) {
  if (!(count > 0)) return null;
  return (
    <span
      aria-label={`${count} new`}
      style={{
        minWidth: '22px',
        height: '22px',
        padding: '0 7px',
        boxSizing: 'border-box',
        borderRadius: '11px',
        backgroundColor: 'var(--cr-red)',
        color: '#FFFFFF',
        fontSize: '12px',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function AppHeaderAndDrawer({
  currentView,
  setCurrentView,
  setRoutineSelectReturnView,
  showHamburgerDrawer,
  setShowHamburgerDrawer,
  setShowFeedbackModal,
  isRoutineEditorView,
  currentEditorWorkout,
  // Training program id (Configuration → PROGRAM): programs other than Crying add a PROGRAM / WEEK row
  trainingProgram = 'crying',
  programCycleStart = null,
  programSchedules = null,
  // The WEEK box: saves the week and re-plans the program's exercises (useWorkoutMutations.handleChangeProgramWeek)
  onChangeProgramWeek,
  // The PROGRAM box: this session's program (useWorkoutMutations.handleChangeSessionProgram)
  onChangeSessionProgram,
  // The DAY box (programs with set days): useWorkoutMutations.handleChangeProgramDay
  onChangeProgramDay,
  // Logged workouts: the program's week keeps track of itself from them (getAutoProgramWeek)
  history = [],
  onFinishSession,
  // RESET in the locked session header
  onResetSession,
  // SYNC in the locked session header (live session sync): { status, onClick } or null to hide it
  sessionSync = null,
  // true while the save confirmation opened by the ✓ is showing (the ✓ turns green)
  finishSessionPending = false,
  timerTrigger,
  setTimerTrigger,
  updateCurrentWorkoutState,
  user,
  // Your profile photo (shown on the menu's PROFILE button) and SIGN OUT at the bottom of the menu
  profilePhoto,
  onSignOut,
  isStorageHydrated,
  setAuthMode,
  // ← next to the page title: back to the previous page (page.js keeps the history)
  onBack,
  // Routines friends sent you, still waiting (ROUTINES row's count)
  receivedRoutineCount = 0,
  // The session page's EASY / ADVANCED mode (EASY hides the PROGRAM / WEEK / DAY row)
  sessionMode = 'advanced'
}) {
  return (
    <>
      {/* TOP NAVIGATION BAR */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          backgroundColor: 'var(--dp-color-ground)',
          borderBottom: '1px solid var(--dp-color-rule)',
          // Clears the iPhone notch / Dynamic Island and status bar (0 elsewhere); the header's dark
          // background fills that strip so content never scrolls visibly behind it
          padding: `calc(8px + env(safe-area-inset-top, 0px)) var(--dp-spacing-gutter) 8px`
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '6px' }}>
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setShowHamburgerDrawer(true)}
              className="kinetic-btn"
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#1C1C1C',
                border: 'none',
                borderRadius: '10px',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <SFSymbol name="line.3.horizontal" size={20} color="#FFFFFF" />
            </button>
            {/* ← BACK, just right of the menu button (not on Home) */}
            {currentView !== 'home' && (
              <button
                type="button"
                aria-label="Back to the previous page"
                onClick={() => onBack?.()}
                className="kinetic-btn"
                style={{
                  width: '40px',
                  height: '40px',
                  flexShrink: 0,
                  backgroundColor: '#1C1C1C',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#FFFFFF',
                  fontSize: '18px',
                  fontWeight: 500,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                ←
              </button>
            )}
          </div>

          {/* App title: a link to Home from every page (the page's own name sits at the top of the page) */}
          <button
            type="button"
            aria-label="You Can't Cry in Here: go to Home"
            onClick={() => {
              setRoutineSelectReturnView(null);
              setCurrentView('home');
            }}
            className="kinetic-btn"
            style={{
              minWidth: 0,
              minHeight: '40px',
              justifySelf: 'center',
              padding: '0 2px',
              background: 'none',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              lineHeight: 1.05,
              textTransform: 'uppercase',
              textAlign: 'center',
              cursor: 'pointer'
            }}
          >
            YOU CAN&apos;T CRY IN <span style={{ color: 'var(--dp-color-accent)' }}>HERE</span>
          </button>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              aria-label="Send Feedback"
              onClick={() => setShowFeedbackModal(true)}
              className="kinetic-btn"
              style={{
                height: '40px',
                padding: '0 10px',
                backgroundColor: '#1C1C1C',
                border: 'none',
                borderRadius: '10px',
                letterSpacing: '0.08em',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              FEEDBACK
            </button>
          </div>
        </div>

        {isRoutineEditorView && currentEditorWorkout && (
          <SessionTitleBar
            title={currentEditorWorkout.title || ''}
            onChangeTitle={value => updateCurrentWorkoutState(prev => ({ ...prev, title: value }))}
            onSave={onFinishSession}
            onReset={onResetSession}
            showActions={(currentEditorWorkout.slots || []).length > 0 && Boolean(onFinishSession)}
            sync={currentView === 'session' ? sessionSync : null}
            saveLabel={currentView === 'session' ? 'FINISH' : 'SAVE'}
            dateValue={
              currentView === 'session' && currentEditorWorkout.startedAt
                ? formatDateYMD(currentEditorWorkout.startedAt)
                : null
            }
            onChangeDate={ymd => updateCurrentWorkoutState(prev => ({ ...prev, startedAt: parseYMDToISO(ymd) }))}
            programRow={(() => {
              // EASY mode (live session): no PROGRAM / WEEK / DAY row
              if (currentView === 'session' && sessionMode === 'easy') return null;
              // Shown while a program other than Crying is chosen, or this session has one
              const sessionProgramId = currentEditorWorkout.program || trainingProgram;
              const program = getProgram(sessionProgramId);
              if (!getProgram(trainingProgram).usesWeeks && !program.usesWeeks) return null;
              // The session's week, else the automatic one from the logged sessions
              const ctx = getProgramContext(trainingProgram, programCycleStart, currentEditorWorkout, history, programSchedules);
              return {
                label: program.label,
                programId: program.id,
                programOptions: PROGRAMS.map(p => ({ id: p.id, label: p.label, note: p.comingSoon ? 'COMING SOON' : '' })),
                onChangeProgram: id =>
                  onChangeSessionProgram
                    ? onChangeSessionProgram(id)
                    : updateCurrentWorkoutState(prev => ({ ...prev, program: id, programWeek: '' })),
                week: currentEditorWorkout.programWeek || (ctx ? ctx.program.weekName(ctx.week) : ''),
                autoWeek: ctx ? ctx.program.weekName(ctx.week) : '',
                // A program with a cycle offers its weeks; others take a typed week
                weekOptions: program.cycleWeeks
                  ? Array.from({ length: program.cycleWeeks }, (_, i) => program.weekName(i + 1))
                  : null,
                onChangeWeek: week =>
                  onChangeProgramWeek
                    ? onChangeProgramWeek(week)
                    : updateCurrentWorkoutState(prev => ({ ...prev, program: prev.program || trainingProgram, programWeek: week })),
                // Programs with set days: the session's day (Workout A / B, push / pull / legs…)
                dayOptions: program.days ? program.days.map(d => ({ id: d.id, label: d.name })) : null,
                dayId: ctx?.day?.id || null,
                // The header's DAY box is narrow: a day's short name when it has one (Society's 'Wed & Thu')
                dayLabel: ctx?.day?.shortName || ctx?.day?.name || '',
                onChangeDay: id => onChangeProgramDay?.(id)
              };
            })()}
          />
        )}
        {isRoutineEditorView && currentEditorWorkout && (
          <SessionRestTimerBar
            flushTop
            defaultRestSeconds={currentEditorWorkout.defaultRestSeconds || 90}
            timerTrigger={timerTrigger}
            nextLiftInfo={getNextIncompleteSetInfo(currentEditorWorkout.slots)}
            onChangeDefaultRest={sec => {
              updateCurrentWorkoutState(prev => ({ ...prev, defaultRestSeconds: sec }));
              setTimerTrigger(prev => ({ ...prev, targetSeconds: sec }));
            }}
            onStopTimer={() => setTimerTrigger(prev => ({ ...prev, isRunning: false, startedAtMs: null }))}
            onMarkDone={
              onFinishSession && (currentEditorWorkout.slots || []).length > 0 ? onFinishSession : undefined
            }
            markDoneActive={finishSessionPending}
          />
        )}
      </header>

      {/* SLIDE-OUT HAMBURGER DRAWER */}
      {showHamburgerDrawer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex'
          }}
          onClick={() => setShowHamburgerDrawer(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '300px',
              maxWidth: '82vw',
              height: '100%',
              backgroundColor: '#000000',
              borderRight: '1px solid var(--dp-color-rule)',
              padding: `calc(20px + env(safe-area-inset-top, 0px)) 16px calc(20px + env(safe-area-inset-bottom, 0px))`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 500,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--dp-color-rule)',
                  paddingBottom: '12px',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>MENU</span>
                <button
                  type="button"
                  onClick={() => setShowHamburgerDrawer(false)}
                  style={{
                    background: '#1C1C1C',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '10px',
                    minWidth: '44px',
                    minHeight: '44px',
                    padding: '4px 8px',
                    fontSize: '15px',
                    fontWeight: 400,
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* The page you're on is the white row (aria-current); SIGN OUT at the bottom is the menu's one red */}
                <Button
                  variant="drawer"
                  active={currentView === (user ? 'profile' : 'auth')}
                  aria-current={currentView === (user ? 'profile' : 'auth') ? 'page' : undefined}
                  onClick={() => {
                    setShowHamburgerDrawer(false);
                    setCurrentView(user ? 'profile' : 'auth');
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    {user && <ProfileAvatar photo={profilePhoto} username={user.username} size={28} />}
                    <span>{user ? `PROFILE (@${user.username})` : 'SIGN IN'}</span>
                  </span>
                  <span>→</span>
                </Button>

                {[
                  { id: 'home', label: 'HOME', clearReturn: true },
                  { id: 'history', label: 'PERFORMANCE', clearReturn: true },
                  { id: 'routines', label: 'ROUTINES', clearReturn: true, badge: receivedRoutineCount },
                  { id: 'stimulus_map', label: 'STIMULUS', clearReturn: true },
                  { id: 'social', label: 'SOCIAL', clearReturn: true },
                  { id: 'configuration', label: 'CONFIGURATION', clearReturn: true },
                  { id: 'info', label: 'INFO' }
                ].map(nav => (
                  <Button
                    variant="drawer"
                    key={nav.id}
                    active={currentView === nav.id}
                    aria-current={currentView === nav.id ? 'page' : undefined}
                    onClick={() => {
                      setShowHamburgerDrawer(false);
                      if (nav.clearReturn) setRoutineSelectReturnView(null);
                      setCurrentView(nav.id);
                    }}
                  >
                    <span>{nav.label}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                      <CountBadge count={nav.badge} />
                      <span>→</span>
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            <div
              style={{
                borderTop: '1px solid var(--dp-color-rule)',
                paddingTop: '12px',
                fontSize: '11px',
                color: '#9A9A9A',
                fontWeight: 500,
                textTransform: 'uppercase'
              }}
            >
              {user ? (
                <div>LOGGED IN: {user.email}</div>
              ) : (
                <div style={{ textTransform: 'none' }}>Not signed in: saved on this device only.</div>
              )}
              {/* SIGN OUT shortcut */}
              {user && (
                <button
                  type="button"
                  onClick={() => onSignOut?.()}
                  className="kinetic-btn"
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    height: '44px',
                    backgroundColor: '#1C1C1C',
                    color: 'var(--cr-red-text)',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  SIGN OUT
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SIGNED-OUT NOTICE: one slim grey line under the header. Hidden in the session / routine editor (it would
          sit between the locked header and the exercises) and on the sign-in page itself. */}
      {isStorageHydrated && !user && !isRoutineEditorView && currentView !== 'auth' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            minHeight: '44px',
            padding: '0 var(--dp-spacing-gutter)',
            backgroundColor: '#1C1C1C',
            borderBottom: '1px solid var(--dp-color-rule)'
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A', minWidth: 0 }}>
            Not signed in: saved on this device only.
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
            {[
              { mode: 'login', label: 'SIGN IN', color: 'var(--dp-color-accent)' },
              { mode: 'signup', label: 'JOIN', color: '#FFFFFF' }
            ].map(item => (
              <button
                key={item.mode}
                type="button"
                onClick={() => {
                  setAuthMode(item.mode);
                  setCurrentView('auth');
                }}
                className="kinetic-btn"
                style={{
                  minHeight: '40px',
                  padding: '0 10px',
                  background: 'none',
                  border: 'none',
                  color: item.color,
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  cursor: 'pointer'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

