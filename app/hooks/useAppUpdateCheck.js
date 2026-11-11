'use client';

import { useEffect, useState } from 'react';

const CHECK_EVERY_MS = 5 * 60 * 1000;
const MY_BUILD = process.env.APP_BUILD_ID || null;

/**
 * Keeps an open app on the latest deployment. Checks /api/version when the app comes back to the foreground,
 * when the network returns, and every 5 minutes. Coming back to the foreground on an old build reloads straight
 * away (app state is already saved on the device); while the app is in use it only reports `updateAvailable`
 * so the page can offer a RELOAD button instead of interrupting.
 */
export function useAppUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!MY_BUILD) return undefined;
    let cancelled = false;
    const check = async ({ reloadIfNewer = false } = {}) => {
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.build || data.build === MY_BUILD) return;
        if (reloadIfNewer) window.location.reload();
        else setUpdateAvailable(true);
      } catch {
        // Offline: try again on the next check
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check({ reloadIfNewer: true });
    };
    const onOnline = () => check();
    const timer = setInterval(() => check(), CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const first = setTimeout(() => check(), 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(first);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return { updateAvailable, reloadNow: () => window.location.reload() };
}
