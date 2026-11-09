'use client';

import React from 'react';
import { SFSymbol, SessionRestTimerBar } from './Primitives';
import { getNextIncompleteSetInfo } from '../utils/workoutEngine';
import { Button } from './Controls';

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
  timerTrigger,
  setTimerTrigger,
  updateCurrentWorkoutState,
  user,
  isStorageHydrated,
  setAuthMode
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
          padding: `calc(12px + env(safe-area-inset-top, 0px)) var(--dp-spacing-gutter) 12px`
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
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
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
          </div>

          {currentView !== 'home' ? (
            <button
              type="button"
              aria-label="Return to Home screen"
              onClick={() => {
                setRoutineSelectReturnView(null);
                setCurrentView('home');
              }}
              className="kinetic-btn"
              style={{
                fontSize: '14px',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                textTransform: 'uppercase',
                color: '#FFFFFF',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                background: 'none',
                border: 'none',
                padding: '8px 4px',
                cursor: 'pointer',
                justifySelf: 'center'
              }}
            >
              You Can&apos;t Cry in Here
            </button>
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
          <SessionRestTimerBar
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
                  <span>{user ? `00 / PROFILE (@${user.username})` : '00 / SIGN IN'}</span>
                  <span>→</span>
                </Button>

                {[
                  { id: 'routines', label: '01 / ROUTINES', clearReturn: true },
                  { id: 'gyms', label: '02 / GYMS/EQUIPMENT' },
                  { id: 'goals', label: '03 / GOALS' },
                  { id: 'onboarding', label: '04 / ONBOARDING' },
                  { id: 'info', label: '05 / INFO' },
                  { id: 'settings', label: '06 / SETTINGS' }
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

      {/* PERSISTENT LOGGED-OUT ORANGE NOTIFICATION BAR */}
      {isStorageHydrated && !user && (
        <div
          style={{
            margin: '12px var(--dp-spacing-gutter) 0',
            padding: '12px 14px',
            backgroundColor: 'var(--dp-color-accent)',
            color: '#101010',
            border: '2px solid #FFFFFF',
            fontWeight: 800,
            fontSize: '12px',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          <span>NOT SIGNED IN</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setCurrentView('auth');
              }}
              className="kinetic-btn"
              style={{
                background: '#101010',
                color: '#FFFFFF',
                border: '2px solid #101010',
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              SIGN IN
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setCurrentView('auth');
              }}
              className="kinetic-btn"
              style={{
                background: '#FFFFFF',
                color: '#101010',
                border: '2px solid #101010',
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              CREATE ACCOUNT
            </button>
          </div>
        </div>
      )}
    </>
  );
}

