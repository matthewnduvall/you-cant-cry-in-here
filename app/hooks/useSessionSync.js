'use client';

// ============================================================================
// LIVE SESSION SYNC (SYNC button in the session header)
// One athlete invites a friend; once the friend accepts, both apps share the session's exercise structure
// through public.shared_sessions. Each app polls the row (every 3 s while synced, 10 s otherwise for
// invites) and pushes its own structural edits a moment after they happen. The latest edit wins.
// Each athlete's own numbers (weights, reps, checkmarks) also travel in the row, per account, so the session
// page can show a tab for the friend's session that this athlete can view and edit (coaching). Numbers are
// merged per set (newest edit wins) and never replace the other athlete's numbers. Saving, RESET or UNSYNC
// ends the sync.
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
import {
  buildSessionSyncStructure,
  sessionSyncSignature,
  mergeSessionSyncStructure,
  collectSetValues,
  sameSetValues,
  mergeValueMaps,
  overlaySetValues,
  SESSION_SYNC_PROTOCOL
} from '../utils/sessionSync';
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

  // The friend's numbers (setId → entry), for the friend's tab; includes my unsent edits to them
  const [partnerValues, setPartnerValuesState] = useState({});
  const partnerValuesRef = useRef({});
  const setPartnerValues = value => {
    partnerValuesRef.current = value;
    setPartnerValuesState(value);
  };
  // My numbers as last sent or applied (setId → entry with `at`), my edits not yet on the server, and edits I
  // made to my friend's numbers not yet on the server
  const ownValuesRef = useRef({});
  const pendingOwnRef = useRef({});
  const pendingPartnerRef = useRef({});
  const [partnerEditTick, setPartnerEditTick] = useState(0);
  const pushingRef = useRef(false);
  const pushAgainRef = useRef(false);
  // Sync whose friend wrote with an older app (no numbers, no tabs on their side): { syncId } or null
  const [outdatedPartner, setOutdatedPartner] = useState(null);
  const notePartnerProtocol = row => {
    if (!row?.id || !row.updated_by || row.updated_by === myId) return;
    const outdated = !(Number(row.structure?.protocol) >= SESSION_SYNC_PROTOCOL);
    setOutdatedPartner(prev => (outdated ? (prev?.syncId === row.id ? prev : { syncId: row.id }) : prev?.syncId === row.id ? null : prev));
  };

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

  // Partner structure from a row (unless I have an unsent structural change: mine wins and is pushed next)
  const applyRemoteStructure = row => {
    const local = latestRef.current.activeSession;
    if (sessionSyncSignature(buildSessionSyncStructure(local)) !== lastSignatureRef.current) return;
    const merged = mergeSessionSyncStructure(local?.slots || [], row.structure, mergeCtx());
    // Signature of what this device now holds, so applying the partner's change never pushes it back
    lastSignatureRef.current = sessionSyncSignature(buildSessionSyncStructure({ slots: merged }));
    setActiveSession(prev => (prev && prev.syncId === row.id ? { ...prev, slots: merged } : prev));
  };

  // Numbers from a row: the friend's (for their tab) and any of mine the friend edited more recently
  const applyRowValues = row => {
    const values = row?.structure?.values || {};
    const partnerId = latestRef.current.activeSession?.syncPartnerId;
    if (partnerId) {
      setPartnerValues(
        mergeValueMaps(mergeValueMaps(partnerValuesRef.current, values[partnerId] || {}), pendingPartnerRef.current)
      );
    }
    const updates = {};
    Object.entries(values[myId] || {}).forEach(([id, entry]) => {
      if (!entry || entry.by === myId) return;
      const at = Number(entry.at) || 0;
      if (at <= (Number(ownValuesRef.current[id]?.at) || 0)) return;
      if (pendingOwnRef.current[id] && (Number(pendingOwnRef.current[id].at) || 0) >= at) return;
      updates[id] = entry;
    });
    if (Object.keys(updates).length > 0) {
      ownValuesRef.current = { ...ownValuesRef.current, ...updates };
      setActiveSession(prev => (prev && prev.syncId === row.id ? overlaySetValues(prev, updates) : prev));
    }
  };

  // Edits made on the friend's tab: { setId: values }
  const editPartnerValues = changes => {
    const now = Date.now();
    const entries = {};
    Object.entries(changes || {}).forEach(([id, vals]) => {
      entries[id] = { ...vals, at: now, by: myId };
    });
    if (Object.keys(entries).length === 0) return;
    pendingPartnerRef.current = { ...pendingPartnerRef.current, ...entries };
    setPartnerValues(mergeValueMaps(partnerValuesRef.current, entries));
    setPartnerEditTick(t => t + 1);
  };

  // Write my structure (when it changed) and both athletes' unsent numbers. Reads the row first so the friend's
  // latest numbers and structure are kept.
  const pushNow = async () => {
    if (pushingRef.current) {
      pushAgainRef.current = true;
      return;
    }
    pushingRef.current = true;
    try {
      const id = latestRef.current.activeSession?.syncId;
      if (!id) return;
      const fetched = await fetchSessionSync(user, id);
      const serverRow = fetched.ok ? fetched.row : null;
      if (!serverRow || serverRow.status === 'ended' || serverRow.status === 'declined') return;
      if (serverRow.updated_by !== myId && timeOf(serverRow.updated_at) > lastSeenUpdatedAtRef.current) {
        notePartnerProtocol(serverRow);
        applyRemoteStructure(serverRow);
        applyRowValues(serverRow);
      }
      const local = latestRef.current.activeSession;
      const localStructure = buildSessionSyncStructure(local);
      const localSignature = sessionSyncSignature(localStructure);
      const structureChanged = localSignature !== lastSignatureRef.current;
      const serverStructure = serverRow.structure || {};
      const ownSent = { ...pendingOwnRef.current };
      const partnerSent = { ...pendingPartnerRef.current };
      const values = { ...(serverStructure.values || {}) };
      values[myId] = mergeValueMaps(values[myId], ownSent);
      const partnerId = local?.syncPartnerId;
      if (partnerId) values[partnerId] = mergeValueMaps(values[partnerId], partnerSent);
      const base = structureChanged || !Array.isArray(serverStructure.slots) ? localStructure : serverStructure;
      const res = await updateSessionSync(user, id, {
        structure: { ...base, values, protocol: SESSION_SYNC_PROTOCOL },
        structure_version: versionRef.current + 1
      });
      if (res.ok) {
        rememberRow(res.row);
        if (structureChanged) lastSignatureRef.current = localSignature;
        Object.keys(ownSent).forEach(k => {
          if (pendingOwnRef.current[k] === ownSent[k]) delete pendingOwnRef.current[k];
        });
        Object.keys(partnerSent).forEach(k => {
          if (pendingPartnerRef.current[k] === partnerSent[k]) delete pendingPartnerRef.current[k];
        });
        if (partnerId) setPartnerValues(mergeValueMaps(values[partnerId], pendingPartnerRef.current));
      }
    } finally {
      pushingRef.current = false;
      if (pushAgainRef.current) {
        pushAgainRef.current = false;
        setPartnerEditTick(t => t + 1);
      }
    }
  };

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
          ? 'Sync isn’t set up yet: run supabase/migrations/2026-11-09_shared_sessions.sql in Supabase.'
          : 'Couldn’t send the sync invite. Check your connection and try again.'
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
      setSyncNotice('Couldn’t join the session. It may have been cancelled.');
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
    notePartnerProtocol(shared);
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
          setSyncNotice(`@${pending.friendName} declined the sync.`);
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
        detachSync(`@${partner} ended the sync. Your session is unchanged.`);
        return;
      }
      const rowTime = timeOf(row.updated_at);
      if (row.updated_by === myId || rowTime <= lastSeenUpdatedAtRef.current) return;
      // My own unsent structural change wins (the push overwrites it); numbers are merged either way
      notePartnerProtocol(row);
      applyRemoteStructure(row);
      applyRowValues(row);
      rememberRow(row);
    };
    poll();
    const id = setInterval(poll, SYNC_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSync, syncId, myId]);

  // ---- While synced: push my structural edits and both athletes' changed numbers ----
  useEffect(() => {
    if (!canSync || !syncId || !activeSession) return undefined;
    const signature = sessionSyncSignature(buildSessionSyncStructure(activeSession));
    // My numbers that changed since they were last sent or applied (stamped now, so the newest edit wins)
    const now = Date.now();
    Object.entries(collectSetValues(activeSession)).forEach(([id, vals]) => {
      const known = ownValuesRef.current[id];
      if (known && sameSetValues(known, vals)) return;
      const entry = { ...vals, at: now, by: myId };
      ownValuesRef.current = { ...ownValuesRef.current, [id]: entry };
      pendingOwnRef.current = { ...pendingOwnRef.current, [id]: entry };
    });
    const hasPending =
      Object.keys(pendingOwnRef.current).length > 0 || Object.keys(pendingPartnerRef.current).length > 0;
    if (signature === lastSignatureRef.current && !hasPending) return undefined;
    const timer = setTimeout(() => pushNow(), PUSH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSync, syncId, activeSession, partnerEditTick]);

  // ---- Session saved, reset or replaced while synced: end the sync ------
  useEffect(() => {
    const previous = previousSyncIdRef.current;
    if (previous && previous !== syncId && canSync && !endedRemotelyRef.current.has(previous)) {
      endSessionSync(user, previous);
      log('SYNC_END', 'Session saved or replaced; sync ended');
    }
    previousSyncIdRef.current = syncId;
    // Numbers belong to one sync: start clean (the first push after linking sends all of mine)
    ownValuesRef.current = {};
    pendingOwnRef.current = {};
    pendingPartnerRef.current = {};
    partnerValuesRef.current = {};
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
    syncPartnerId: activeSession?.syncPartnerId || null,
    // The friend's numbers (setId → entry) for their tab, and edits made there ({ setId: values })
    partnerValues: syncId ? partnerValues : {},
    editPartnerValues,
    // The friend's app is an older version (their saves carry no numbers): ask them to reopen the app
    partnerAppOutdated: Boolean(syncId && outdatedPartner?.syncId === syncId),
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
