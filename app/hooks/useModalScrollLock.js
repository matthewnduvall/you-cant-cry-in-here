'use client';

import { useEffect } from 'react';

// Holds the page still while a pop-up is open. Without it, focusing a pop-up's text box (iOS scrolls the page to
// show it above the keyboard) or the page's height changing under the pop-up leaves the page somewhere else after
// SAVE / APPLY / SEND: the "page jumps". The page is pinned where it was (body fixed at -scrollY) and put back at
// exactly that scroll position when the last open pop-up closes. Several pop-ups can be open at once (a counter).
let openCount = 0;
let savedY = 0;
let savedStyle = null;

const lock = () => {
  if (typeof window === 'undefined') return;
  openCount += 1;
  if (openCount > 1) return;
  savedY = window.scrollY || 0;
  const { body } = document;
  savedStyle = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width };
  body.style.position = 'fixed';
  body.style.top = `-${savedY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
};

const unlock = () => {
  if (typeof window === 'undefined' || openCount === 0) return;
  openCount -= 1;
  if (openCount > 0) return;
  const { body } = document;
  Object.assign(body.style, savedStyle || { position: '', top: '', left: '', right: '', width: '' });
  savedStyle = null;
  window.scrollTo({ top: savedY, left: 0, behavior: 'instant' });
};

/** Pins the page while `active` (a pop-up is open); restores the scroll position when it closes. */
export function useModalScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    lock();
    return unlock;
  }, [active]);
}

export default useModalScrollLock;
