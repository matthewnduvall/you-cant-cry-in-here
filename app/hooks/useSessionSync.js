'use client';

// ============================================================================
// LIVE SESSION SYNC (SYNC button in the session header)
// One athlete invites a friend; once the friend accepts, both apps share the session's exercise structure
// through public.shared_sessions. Each app polls the row (every 3 s while synced, 10 s otherwise for
// invites) and pushes its own structural edits a moment after they happen. The latest edit wins.
// Weights, reps and checkmarks are never shared. Saving, RESET or UNSYNC ends the sync.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isUuid,
  createSessionSyncInvite,
  fetchMySessionSyncs,
  fetchSessionSync,
  updateSessionSync,
  respondToSessionSync,
  endSessionSync
} from '../utils/supabaseAuth';
import { buildSessionSyncStructure, sessionSyncSignature, mergeSessionSyncStructure } from '../utils/sessionSync';
import { getDefaultSessionName } from '../data/exerciseLibrary';

const INVITE_POLL_MS = 10000;
const SYNC_POLL_MS = 3000;
const PUSH_DELAY_MS = 700;

const timeOf = iso => {
  const ms = new Date(iso || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const isPageVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

export function useSessionSync({
  user,
  friendsList = [],
  activeSession,
  setActiveSession,
  setCurrentView,
  history,
  oneRepMaxes,
  currentIncrementLbs,
  userBodyweightLbs,
  appendSessionLog
}) {
  const canSync = Boolean(user && isUuid(user.id));
  const myId = canSync ? user.id : null;
  const syncId = activeSession?.syncId || null;

  // Invite I sent that hasn't been answered: { id, friendId, friendName }
  const [outgoingInvite, setOutgoingInviteState] = useState(null);
  const outgoingRef = useRef(null);
  const setOutgoingInvite = value => {
    outgoingRef.current = value;
    setOutgoingInviteState(value);
  };
  // Invite I received: the shared_sessions row
  const [incomingInvite, setIncomingInvite] = useState(null);
  // One-line message for the athlete (declined / ended / errors)
  const [syncNotice, setSyncNotice] = useState('');
  const [isSyncBusy, setIsSyncBusy] = useState(false);

  // Last structure this device sent or applied, and the server time of the last row it has seen
  const lastSignatureRef = useRef('');
  const lastSeenUpdatedAtRef = useRef(0);
  const versionRef = useRef(1);
  const dismissedInviteIdsRef = useRef(new Set());
  const endedRemotelyRef = useRef(new Set());
  const previousSyncIdRef = useRef(syncId);
  // Latest values for the polling callbacks
  const latestRef = useRef({});
  useEffect(() => {
    latestRef.current = { activeSession, history, oneRepMaxes, currentIncrementLbs, userBodyweightLbs, friendsList };
  });

  const log = useCallback((type, msg) => appendSessionLog?.(type, msg), [appendSessionLog]);

  // Display name for a friend's account id (the cached friends list, else the name stored on the invite)
  const friendNameFor = (id, fallback) => {
    const f = (friendsList || []).find(x => x?.id === id);
    return f?.username || fallback || 'friend';
  };

  const mergeCtx = () => ({
    history: latestRef.current.history,
    oneRepMaxes: latestRef.current.oneRepMaxes,
    incrementLbs: latestRef.current.currentIncrementLbs,
    userBodyweightLbs: latestRef.current.userBodyweightLbs
  });

  const rememberRow = row => {
    lastSeenUpdatedAtRef.current = Math.max(lastSeenUpdatedAtRef.current, timeOf(row?.updated_at));
    versionRef.current = Math.max(versionRef.current, Number(row?.structure_version) || 1);
  };

  const detachSync = useCallback(
    (message = '') => {
      setActiveSession(prev =>
        prev && prev.syncId ? { ...prev, syncId: undefined, syncPartnerId: undefined, syncPartnerName: undefined } : prev
      );
      if (message) setSyncNotice(message);
    },
    [setActiveSession]
  );

  // ---- Invite a friend ---------------------------------------------------
  const inviteFriendToSync = async friend => {
    if (!canSync || !friend?.id || !activeSession) return false;
    setIsSyncBusy(true);
    const structure = buildSessionSyncStructure(activeSession);
    const res = await createSessionSyncInvite(user, friend.id, structure);
    setIsSyncBusy(false);
    if (!res.ok) {
      setSyncNotice(
        res.status === 404
          ? 'SYNC ISN’T SET UP YET: RUN supabase/migrations/2026-11-09_shared_sessions.sql IN SUPABASE.'
          : 'COULDN’T SEND THE SYNC INVITE. CHECK YOUR CONNECTION AND TRY AGAIN.'
      );
      return false;
    }
    lastSignatureRef.current = sessionSyncSignature(structure);
    rememberRow(res.row);
    setOutgoingInvite({ id: res.row.id, friendId: friend.id, friendName: friend.username || 'friend' });
    log('SYNC_INVITE', `Invited @${friend.username || friend.id} to sync`);
    return true;
  };

  const cancelOutgoingInvite = async () => {
    const pending = outgoingInvite;
    setOutgoingInvite(null);
    if (pending?.id) await endSessionSync(user, pending.id);
  };

  // ---- Answer an invite --------------------------------------------------
  const acceptIncomingInvite = async () => {
    const row = incomingInvite;
    if (!row) return;
    setIsSyncBusy(true);
    const res = await respondToSessionSync(user, row.id, true);
    setIsSyncBusy(false);
    setIncomingInvite(null);
    if (!res.ok) {
      setSyncNotice('COULDN’T JOIN THE SESSION. IT MAY HAVE BEEN CANCELLED.');
      return;
    }
    const shared = res.row || row;
    const slots = mergeSessionSyncStructure([], shared.structure, mergeCtx());
    const partnerName = friendNameFor(shared.owner_id, shared.owner_username);
    const nowIso = new Date().toISOString();
    const session = {
      id: `session_${Date.now()}`,
      title: shared.structure?.title || getDefaultSessionName(),
      startedAt: nowIso,
      updatedAt: nowIso,
      defaultRestSeconds: 90,
      loadedRoutineTitle: 'SYNC',
      slots,
      syncId: shared.id,
      syncPartnerId: shared.owner_id,
      syncPartnerName: partnerName
    };
    lastSignatureRef.current = sessionSyncSignature(buildSessionSyncStructure(session));
    rememberRow(shared);
    previousSyncIdRef.current = shared.id;
    setActiveSession(session);
    setCurrentView?.('session');
    log('SYNC_ACCEPT', `Joined @${partnerName}'s session`);
  };

  const declineIncomingInvite = async () => {
    const row = incomingInvite;
    setIncomingInvite(null);
    if (!row) return;
    dismissedInviteIdsRef.current.add(row.id);
    await respondToSessionSync(user, row.id, false);
  };

  // ---- Stop syncing (this athlete) ---------------------------------------
  const unsync = async () => {
    const id = activeSession?.syncId;
    detachSync();
    if (id) {
      previousSyncIdRef.current = null;
      await endSessionSync(user, id);
      log('SYNC_END', 'Stopped syncing the session');
    }
  };

  // ---- Poll for invites and answers (every 10 s, 3 s while waiting for an answer) -------------
  useEffect(() => {
    if (!canSync) return undefined;
    let cancelled = false;
    const poll = async () => {
      if (cancelled || !isPageVisible()) return;
      const res = await fetchMySessionSyncs(user);
      if (cancelled || !res.ok) return;
      const rows = res.rows;

      // Someone invited me
      const incoming = rows.find(
        r => r.status === 'pending' && r.participant_id === myId && !dismissedInviteIdsRef.current.has(r.id)
      );
      setIncomingInvite(prev => (prev?.id === incoming?.id ? prev : incoming || null));

      // My invite was answered (accepted → link my session; gone → declined or cancelled)
      const pending = outgoingRef.current;
      if (pending) {
        const row = rows.find(r => r.id === pending.id);
        if (row?.status === 'accepted') {
          rememberRow(row);
          // Empty signature: my current structure is pushed once so both sides start from it
          lastSignatureRef.current = '';
          previousSyncIdRef.current = row.id;
          setOutgoingInvite(null);
          setActiveSession(s =>
            s ? { ...s, syncId: row.id, syncPartnerId: pending.friendId, syncPartnerName: pending.friendName } : s
          );
          setSyncNotice('');
          log('SYNC_LINKED', `@${pending.friendName} joined the session`);
        } else if (!row) {
          setOutgoingInvite(null);
          setSyncNotice(`@${String(pending.friendName).toUpperCase()} DECLINED THE SYNC.`);
        }
      }
    };
    poll();
    const id = setInterval(poll, outgoingInvite ? SYNC_POLL_MS : INVITE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSync, myId, Boolean(outgoingInvite)]);

  // ---- While synced: pull the partner's changes every 3 s ----------------
  useEffect(() => {
    if (!canSync || !syncId) return undefined;
    let cancelled = false;
    const poll = async () => {
      if (cancelled || !isPageVisible()) return;
      const res = await fetchSessionSync(user, syncId);
      if (cancelled || !res.ok || !res.row) return;
      const row = res.row;
      if (row.status === 'ended' || row.status === 'declined') {
        endedRemotelyRef.current.add(row.id);
        const partner = latestRef.current.activeSession?.syncPartnerName || 'Your friend';
        detachSync(`@${String(partner).toUpperCase()} ENDED THE SYNC. YOUR SESSION IS UNCHANGED.`);
        return;
      }
      const rowTime = timeOf(row.updated_at);
      if (row.updated_by === myId || rowTime <= lastSeenUpdatedAtRef.current) return;
      // My own unsent change wins: skip this round, the push below overwrites it
      const local = latestRef.current.activeSession;
      if (sessionSyncSignature(buildSessionSyncStructure(local)) !== lastSignatureRef.current) return;
      const merged = mergeSessionSyncStructure(local?.slots || [], row.structure, mergeCtx());
      rememberRow(row);
      // Signature of what this device now holds, so applying the partner's change never pushes it back
      lastSignatureRef.current = sessionSyncSignature(buildSessionSyncStructure({ slots: merged }));
      setActiveSession(prev => (prev && prev.syncId === row.id ? { ...prev, slots: merged } : prev));
    };
    poll();
    const id = setInterval(poll, SYNC_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSync, syncId, myId]);

  // ---- While synced: push my structural edits ---------------------------
  useEffect(() => {
    if (!canSync || !syncId || !activeSession) return undefined;
    const structure = buildSessionSyncStructure(activeSession);
    const signature = sessionSyncSignature(structure);
    if (signature === lastSignatureRef.current) return undefined;
    const timer = setTimeout(async () => {
      const res = await updateSessionSync(user, syncId, {
        structure,
        structure_version: versionRef.current + 1
      });
      if (res.ok) {
        rememberRow(res.row);
        lastSignatureRef.current = signature;
      }
    }, PUSH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSync, syncId, activeSession]);

  // ---- Session saved, reset or replaced while synced: end the sync ------
  useEffect(() => {
    const previous = previousSyncIdRef.current;
    if (previous && previous !== syncId && canSync && !endedRemotelyRef.current.has(previous)) {
      endSessionSync(user, previous);
      log('SYNC_END', 'Session saved or replaced; sync ended');
    }
    previousSyncIdRef.current = syncId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncId]);

  // ---- Session saved while my invite is unanswered: cancel the invite ----
  const hasSession = Boolean(activeSession);
  useEffect(() => {
    const pending = outgoingRef.current;
    if (!hasSession && pending?.id && canSync) {
      setOutgoingInvite(null);
      endSessionSync(user, pending.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession]);

  return {
    canSync,
    syncId,
    syncPartnerName: activeSession?.syncPartnerName || null,
    outgoingInvite,
    incomingInvite,
    incomingInviteFromName: incomingInvite ? friendNameFor(incomingInvite.owner_id, incomingInvite.owner_username) : '',
    syncNotice,
    clearSyncNotice: () => setSyncNotice(''),
    isSyncBusy,
    inviteFriendToSync,
    cancelOutgoingInvite,
    acceptIncomingInvite,
    declineIncomingInvite,
    unsync
  };
}

export default useSessionSync;
