'use client';

// ============================================================================
// Exercises a friend added to a workout you did together (synced) after it was saved.
// Checks the athlete's sync rows for History updates (fetchSyncsWithHistoryUpdates) when signed in, every 5 minutes,
// and when the app comes back to the foreground. An update for a synced workout in this athlete's History that
// adds exercises they don't have shows SyncedHistoryUpdateModal: ADD TO MY WORKOUT (the exercises join their copy,
// weights from their own history) or DISMISS. Either answer is remembered on this device (syncedHistory acks).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSyncsWithHistoryUpdates } from '../utils/supabaseAuth';
import {
  buildSlotsFromHistoryUpdate,
  findPendingHistoryUpdates,
  getWorkoutSyncInfo,
  readSyncedHistoryAcks,
  writeSyncedHistoryAck
} from '../utils/syncedHistory';
import { normalizeSlotLabels } from '../utils/workoutEngine';

const CHECK_EVERY_MS = 5 * 60 * 1000;

export function useSyncedHistoryUpdates({
  user,
  history,
  setHistory,
  oneRepMaxes,
  incrementLbs,
  userBodyweightLbs,
  appendSessionLog
}) {
  const [pending, setPending] = useState([]);
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const check = useCallback(async () => {
    if (!user?.id) return;
    // Nothing synced in History = nothing a friend could add to, so no request
    if (!(historyRef.current || []).some(w => getWorkoutSyncInfo(w))) return;
    const res = await fetchSyncsWithHistoryUpdates(user);
    if (!res.ok) return;
    setPending(
      findPendingHistoryUpdates({
        rows: res.rows,
        myId: user.id,
        history: historyRef.current,
        acks: readSyncedHistoryAcks()
      })
    );
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

  const current = pending[0] || null;

  const acceptUpdate = () => {
    if (!current) return;
    setHistory(prev =>
      prev.map(w => {
        if (w.id !== current.workoutId) return w;
        const have = new Set((w.slots || []).map(slot => slot?.id));
        const added = buildSlotsFromHistoryUpdate(current, w, {
          history: prev,
          oneRepMaxes,
          incrementLbs,
          userBodyweightLbs
        }).filter(slot => !have.has(slot.id));
        return { ...w, updatedAt: new Date().toISOString(), slots: normalizeSlotLabels([...(w.slots || []), ...added]) };
      })
    );
    writeSyncedHistoryAck(current.syncId, current.at);
    appendSessionLog?.('SYNCED_HISTORY_UPDATE', `Added ${current.slots.length} exercise(s) from @${current.partnerName}`);
    setPending(list => list.slice(1));
  };

  const dismissUpdate = () => {
    if (!current) return;
    writeSyncedHistoryAck(current.syncId, current.at);
    setPending(list => list.slice(1));
  };

  return { pendingHistoryUpdate: current, acceptUpdate, dismissUpdate };
}

export default useSyncedHistoryUpdates;
