'use client';

// ============================================================================
// Routines sent straight to a friend (public.routine_shares).
// Sending: SEND on a routine (routine browser) → SendRoutineModal → sendRoutineToFriend.
// Receiving: while signed in, checks for routines friends sent (4 s after sign-in, every 2 minutes, and when the app
// comes back to the foreground) and shows them one at a time (IncomingRoutineModal): SAVE adds it to your saved
// routines (BY @sender), LOAD NOW loads it into your session (re-worked to your weights, as a friend's routine),
// DISMISS drops it. Each answer is written back (status), so it never shows again on any device.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { answerRoutineShare, fetchIncomingRoutineShares, sendRoutineToFriend } from '../utils/supabaseAuth';

const CHECK_EVERY_MS = 2 * 60 * 1000;

export function useRoutineShares({ user, setSavedRoutines, onLoadRoutine, appendSessionLog }) {
  const [incoming, setIncoming] = useState([]);
  const [busy, setBusy] = useState(false);
  // SEND: the routine being sent, and how it went
  const [sendTarget, setSendTarget] = useState(null);
  const [sendState, setSendState] = useState({ busy: false, sentTo: null, error: '' });
  // Shares answered on this device, so a check that was already on its way doesn't bring one back
  const answeredRef = useRef(new Set());

  const check = useCallback(async () => {
    if (!user?.id) return;
    const res = await fetchIncomingRoutineShares(user);
    if (!res.ok) return;
    setIncoming(res.rows.filter(row => !answeredRef.current.has(row.id)));
  }, [user]);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return undefined;
    const first = setTimeout(check, 4000);
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, check]);

  const current = incoming[0] || null;

  const answer = async (share, status) => {
    answeredRef.current.add(share.id);
    setIncoming(list => list.filter(row => row.id !== share.id));
    const res = await answerRoutineShare(user, share.id, status);
    if (!res.ok) appendSessionLog?.('ROUTINE_SHARE_ANSWER_FAILED', `Couldn't mark routine ${share.id} as ${status} (${res.status})`);
  };

  const routineOf = share => ({
    key: `received_${share.id}`,
    label: share.label || share.routine?.label || 'Routine',
    author: share.sender_username || 'friend',
    isShared: false,
    savedAt: new Date().toISOString(),
    slots: Array.isArray(share.routine?.slots) ? share.routine.slots : []
  });

  const saveIncoming = async () => {
    if (!current || busy) return;
    setBusy(true);
    const routine = routineOf(current);
    setSavedRoutines(prev => [routine, ...(prev || []).filter(r => r.key !== routine.key)]);
    appendSessionLog?.('ROUTINE_SHARE_SAVED', `Saved "${routine.label}" from @${routine.author}`);
    await answer(current, 'saved');
    setBusy(false);
  };

  const loadIncoming = async () => {
    if (!current || busy) return;
    setBusy(true);
    const routine = routineOf(current);
    onLoadRoutine?.({ key: routine.key, label: routine.label, slots: routine.slots, friendName: routine.author });
    appendSessionLog?.('ROUTINE_SHARE_LOADED', `Loaded "${routine.label}" from @${routine.author}`);
    await answer(current, 'loaded');
    setBusy(false);
  };

  const dismissIncoming = async () => {
    if (!current || busy) return;
    setBusy(true);
    await answer(current, 'dismissed');
    setBusy(false);
  };

  const openSend = routine => {
    setSendState({ busy: false, sentTo: null, error: '' });
    setSendTarget(routine || null);
  };
  const closeSend = () => setSendTarget(null);
  const sendTo = async friend => {
    if (!sendTarget || !friend) return;
    setSendState({ busy: true, sentTo: null, error: '' });
    const res = await sendRoutineToFriend(user, friend.id, sendTarget);
    if (res.ok) {
      appendSessionLog?.('ROUTINE_SHARE_SENT', `Sent "${sendTarget.label}" to @${friend.username}`);
      setSendState({ busy: false, sentTo: friend.username, error: '' });
    } else {
      setSendState({ busy: false, sentTo: null, error: res.error || 'SERVER ERROR' });
    }
  };

  return {
    incomingRoutine: current,
    incomingBusy: busy,
    saveIncoming,
    loadIncoming,
    dismissIncoming,
    sendTarget,
    sendState,
    openSend,
    closeSend,
    sendTo
  };
}

export default useRoutineShares;
