'use client';

// ============================================================================
// Routines sent straight to a friend (public.routine_shares).
// Sending: SEND on a routine (routine browser) → SendRoutineModal → sendRoutineToFriend.
// Sending: @friends (a copy to every friend) or @user (one friend).
// Receiving: while signed in, checks for routines friends sent (4 s after sign-in, every 2 minutes, and when the app
// comes back to the foreground). They wait in the Routines page's INBOX tab (the count shows on Home and in the
// menu): SAVE adds one to your saved routines (BY @sender), LOAD loads it into your session (re-worked to your
// weights, as a friend's routine), ✕ dismisses it. Each answer is written back (status), so it never shows again.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  answerRoutineShare,
  deleteSentRoutineShares,
  fetchIncomingRoutineShares,
  fetchSentRoutineShares,
  sendRoutineToFriend
} from '../utils/supabaseAuth';

const CHECK_EVERY_MS = 2 * 60 * 1000;

export function useRoutineShares({ user, setSavedRoutines, onLoadRoutine, appendSessionLog }) {
  const [incoming, setIncoming] = useState([]);
  // Routines you sent (SHARED tab): routine_shares rows you are the sender of
  const [sent, setSent] = useState([]);
  const [busy, setBusy] = useState(false);
  // SEND: the routine being sent, and how it went
  const [sendTarget, setSendTarget] = useState(null);
  const [sendState, setSendState] = useState({ busy: false, sentTo: null, error: '' });
  // Shares answered on this device, so a check that was already on its way doesn't bring one back
  const answeredRef = useRef(new Set());

  const refreshSent = useCallback(async () => {
    if (!user?.id) return;
    const res = await fetchSentRoutineShares(user);
    if (res.ok) setSent(res.rows);
  }, [user]);

  const check = useCallback(async () => {
    if (!user?.id) return;
    const res = await fetchIncomingRoutineShares(user);
    if (res.ok) setIncoming(res.rows.filter(row => !answeredRef.current.has(row.id)));
    refreshSent();
  }, [user, refreshSent]);

  // Withdraw a routine you sent (all its rows: one per friend)
  const withdrawSent = async shareIds => {
    setSent(list => list.filter(row => !shareIds.includes(row.id)));
    const res = await deleteSentRoutineShares(user, shareIds);
    if (!res.ok) refreshSent();
  };

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

  const saveShare = async share => {
    if (!share || busy) return;
    setBusy(true);
    const routine = routineOf(share);
    setSavedRoutines(prev => [routine, ...(prev || []).filter(r => r.key !== routine.key)]);
    appendSessionLog?.('ROUTINE_SHARE_SAVED', `Saved "${routine.label}" from @${routine.author}`);
    await answer(share, 'saved');
    setBusy(false);
  };

  const loadShare = async share => {
    if (!share || busy) return;
    setBusy(true);
    const routine = routineOf(share);
    onLoadRoutine?.({ key: routine.key, label: routine.label, slots: routine.slots, friendName: routine.author });
    appendSessionLog?.('ROUTINE_SHARE_LOADED', `Loaded "${routine.label}" from @${routine.author}`);
    await answer(share, 'loaded');
    setBusy(false);
  };

  const dismissShare = async share => {
    if (!share || busy) return;
    setBusy(true);
    await answer(share, 'dismissed');
    setBusy(false);
  };

  const openSend = routine => {
    setSendState({ busy: false, sentTo: null, error: '' });
    setSendTarget(routine || null);
  };
  const closeSend = () => setSendTarget(null);
  // friends: one friend, or several (@friends = every friend); each gets their own copy
  const sendTo = async friends => {
    const list = (Array.isArray(friends) ? friends : [friends]).filter(Boolean);
    if (!sendTarget || list.length === 0) return;
    setSendState({ busy: true, sentTo: null, error: '' });
    const batchId = `send_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const results = await Promise.all(list.map(f => sendRoutineToFriend(user, f.id, { ...sendTarget, batchId })));
    const sent = list.filter((f, i) => results[i]?.ok);
    const failed = results.find(r => !r?.ok);
    if (sent.length > 0) {
      appendSessionLog?.('ROUTINE_SHARE_SENT', `Sent "${sendTarget.label}" to ${sent.map(f => `@${f.username}`).join(', ')}`);
    }
    if (failed && sent.length === 0) {
      setSendState({ busy: false, sentTo: null, error: failed.error || 'SERVER ERROR' });
    } else {
      const label = list.length > 1 ? `@friends (${sent.length} of ${list.length})` : `@${sent[0].username}`;
      setSendState({ busy: false, sentTo: label, error: failed ? `not every friend got it (${failed.error || 'server error'})` : '' });
    }
    refreshSent();
  };

  // From the finish / save pop-up's SHARE list: a copy of the routine to each chosen friend (no pop-up state)
  const sendRoutine = async (routine, friends) => {
    const list = (friends || []).filter(f => f?.id);
    if (!user?.id || !routine || list.length === 0) return { ok: true, sent: 0 };
    const batchId = `send_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const results = await Promise.all(list.map(f => sendRoutineToFriend(user, f.id, { ...routine, batchId })));
    const sent = list.filter((f, i) => results[i]?.ok);
    appendSessionLog?.('ROUTINE_SHARE_SENT', `Sent "${routine.label}" to ${sent.map(f => `@${f.username}`).join(', ') || 'nobody'}`);
    refreshSent();
    return { ok: sent.length === list.length, sent: sent.length };
  };

  return {
    sendRoutine,
    sent,
    withdrawSent,
    incoming,
    incomingBusy: busy,
    saveShare,
    loadShare,
    dismissShare,
    sendTarget,
    sendState,
    openSend,
    closeSend,
    sendTo
  };
}

export default useRoutineShares;
