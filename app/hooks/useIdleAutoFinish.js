'use client';

import { useEffect, useRef } from 'react';

// After this long without the athlete touching the app, a live session with completed sets is finished and saved
export const IDLE_AUTO_FINISH_MS = 15 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'yccih_last_activity_v1';
const CHECK_EVERY_MS = 30 * 1000;

const readStoredActivity = () => {
  try {
    return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
};
const storeActivity = ms => {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(ms));
  } catch {
    // storage unavailable: the in-memory time still works while the app is open
  }
};

/**
 * Idle auto-finish: touches, clicks and key presses count as activity at all times (kept in localStorage, so a closed
 * or suspended app is checked when it comes back). Every 30 s, and when the app returns to the foreground, a live
 * session idle for 15 minutes is handed to onAutoFinish (which saves it if it has completed sets).
 * Activity is recorded even with no session open, so starting one (NEW SESSION, LOAD ROUTINE…) never inherits the
 * idle time from before it: the tap that started it counts.
 */
export function useIdleAutoFinish({ hasLiveSession, onAutoFinish }) {
  const lastActivityRef = useRef(0);
  const lastWriteRef = useRef(0);
  const onAutoFinishRef = useRef(onAutoFinish);
  useEffect(() => {
    onAutoFinishRef.current = onAutoFinish;
  });

  const markActive = () => {
    const t = Date.now();
    lastActivityRef.current = t;
    if (t - lastWriteRef.current > 10 * 1000) {
      lastWriteRef.current = t;
      storeActivity(t);
    }
  };

  // Activity, always
  useEffect(() => {
    const stored = readStoredActivity();
    lastActivityRef.current = stored > 0 ? stored : Date.now();
    if (!stored) storeActivity(lastActivityRef.current);
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, markActive, { passive: true, capture: true }));
    return () => events.forEach(evt => window.removeEventListener(evt, markActive, { capture: true }));
  }, []);

  // The idle check, while a session is live
  useEffect(() => {
    if (!hasLiveSession) return undefined;
    const check = () => {
      const last = Math.max(lastActivityRef.current, readStoredActivity());
      if (Date.now() - last < IDLE_AUTO_FINISH_MS) return;
      const saved = onAutoFinishRef.current?.();
      // Nothing to save (no completed sets): start the idle clock again
      if (!saved) markActive();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [hasLiveSession]);
}
