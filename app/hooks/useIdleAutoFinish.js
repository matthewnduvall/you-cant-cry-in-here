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
 * Idle auto-finish: touches, clicks and key presses count as activity (kept in localStorage, so a closed or
 * suspended app is checked when it comes back). Every 30 s, and when the app returns to the foreground, a live
 * session idle for 15 minutes is handed to onAutoFinish (which saves it if it has completed sets).
 */
export function useIdleAutoFinish({ hasLiveSession, onAutoFinish }) {
  const lastActivityRef = useRef(0);
  const onAutoFinishRef = useRef(onAutoFinish);
  useEffect(() => {
    onAutoFinishRef.current = onAutoFinish;
  });

  useEffect(() => {
    if (!hasLiveSession) return undefined;
    const now = Date.now();
    const stored = readStoredActivity();
    lastActivityRef.current = stored > 0 ? stored : now;
    if (!stored) storeActivity(now);

    let lastWrite = 0;
    const markActive = () => {
      const t = Date.now();
      lastActivityRef.current = t;
      if (t - lastWrite > 10 * 1000) {
        lastWrite = t;
        storeActivity(t);
      }
    };
    const check = () => {
      if (Date.now() - lastActivityRef.current < IDLE_AUTO_FINISH_MS) return;
      const saved = onAutoFinishRef.current?.();
      // Nothing to save (no completed sets): start the idle clock again
      if (!saved) markActive();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, markActive, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      events.forEach(evt => window.removeEventListener(evt, markActive, { capture: true }));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [hasLiveSession]);
}
