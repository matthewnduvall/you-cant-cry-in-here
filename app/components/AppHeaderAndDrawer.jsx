'use client';

import React from 'react';
import { SFSymbol, SessionRestTimerBar, SessionTitleBar } from './Primitives';
import { getNextIncompleteSetInfo } from '../utils/workoutEngine';
import { Button } from './Controls';

// Header centre title per view (the ← back button sits next to ☰ on the left)
const PAGE_TITLES = {
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
  session: 'SESSION',
  routine_editor: 'ROUTINE',
  historical_entry: 'PAST WORKOUT'
};

export function AppHeaderAndDrawer({
  currentView,
  setCurrentView,
  setRoutineSelectReturnView,
  showHamburgerDrawer,
  setShowHamburgerDrawer,
  setShowFeedbackModal,
  isRoutineEditorView,
  currentEditorWorkout,
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
  isStorageHydrated,
  setAuthMode,
  // ← next to the page title: back to the previous page (page.js keeps the history)
  onBack
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
          borderBottom: '2px solid var(--dp-color-rule)',
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
                backgroundColor: '#161616',
                border: '2px solid var(--dp-color-rule)',
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
                  backgroundColor: '#161616',
                  border: '2px solid var(--dp-color-rule)',
                  color: 'var(--dp-color-accent)',
                  fontSize: '18px',
                  fontWeight: 800,
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

          {currentView !== 'home' ? (
            <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, justifySelf: 'center' }}>
              {/* Page name (no longer a hidden Home link: HOME is in the menu, ← next to ☰ goes back) */}
              <h1
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  textTransform: 'uppercase',
                  color: '#FFFFFF',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {PAGE_TITLES[currentView] || "YOU CAN'T CRY IN HERE"}
              </h1>
            </div>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              aria-label="Send Feedback"
              onClick={() => setShowFeedbackModal(true)}
              className="kinetic-btn"
              style={{
                height: '40px',
                padding: '0 10px',
                backgroundColor: '#161616',
                border: '2px solid var(--dp-color-rule)',
                color: 'var(--dp-color-accent)',
                fontSize: '11px',
                fontWeight: 800,
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
              backgroundColor: '#101010',
              borderRight: '2px solid var(--dp-color-rule)',
              padding: `calc(20px + env(safe-area-inset-top, 0px)) 16px calc(20px + env(safe-area-inset-bottom, 0px))`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  letterSpacing: '-0.045em',
                  textTransform: 'uppercase',
                  borderBottom: '2px solid var(--dp-color-rule)',
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
                    background: 'var(--dp-color-accent)',
                    color: '#101010',
                    border: 'none',
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Button
                  variant="drawer"
                  active
                  onClick={() => {
                    setShowHamburgerDrawer(false);
                    setCurrentView(user ? 'profile' : 'auth');
                  }}
                >
                  <span>{user ? `PROFILE (@${user.username})` : 'SIGN IN'}</span>
                  <span>→</span>
                </Button>

                {[
                  { id: 'home', label: 'HOME', clearReturn: true },
                  { id: 'configuration', label: 'CONFIGURATION', clearReturn: true },
                  { id: 'info', label: 'INFO' }
                ].map(nav => (
                  <Button
                    variant="drawer"
                    key={nav.id}
                    onClick={() => {
                      setShowHamburgerDrawer(false);
                      if (nav.clearReturn) setRoutineSelectReturnView(null);
                      setCurrentView(nav.id);
                    }}
                  >
                    <span>{nav.label}</span>
                    <span>→</span>
                  </Button>
                ))}
              </div>
            </div>

            <div
              style={{
                borderTop: '2px solid var(--dp-color-rule)',
                paddingTop: '12px',
                fontSize: '11px',
                color: '#888888',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}
            >
              LOGGED IN: {user ? user.email : 'OFFLINE'}
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
            backgroundColor: '#141416',
            borderBottom: '2px solid var(--dp-color-rule)'
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#A0A0A0', minWidth: 0 }}>
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
                  fontWeight: 800,
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

