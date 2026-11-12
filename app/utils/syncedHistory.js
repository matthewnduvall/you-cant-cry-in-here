// ============================================================================
// Synced workouts in History
// A session saved while synced with a friend remembers who it was with: `syncedWith` on the workout and on each
// of its exercises (the exercises are what workout_history stores, so the tag reaches the cloud and other devices
// without a new column). Exercises added to it later in History are sent to the friend through the sync's
// shared_sessions row (structure.historyUpdates), and the friend's app offers to add them to their own copy.
// ============================================================================

import { buildSessionSyncStructure, mergeSessionSyncStructure } from './sessionSync';
import { lockAndCompleteSets } from './workoutEngine';

const ACKS_KEY = 'yccih_synced_history_acks_v1';

/** { syncId, partnerId, partnerName } for a workout saved while synced, else null. */
export const getWorkoutSyncInfo = workout => {
  if (!workout) return null;
  if (workout.syncedWith?.syncId) return workout.syncedWith;
  const fromSlot = (workout.slots || []).find(slot => slot?.syncedWith?.syncId)?.syncedWith;
  if (fromSlot) return fromSlot;
  if (workout.syncId) {
    return { syncId: workout.syncId, partnerId: workout.syncPartnerId || null, partnerName: workout.syncPartnerName || '' };
  }
  return null;
};

/** A History entry from a synced session: tagged with its sync (workout + every exercise), live sync fields dropped. */
export const withSyncInfo = entry => {
  const info = getWorkoutSyncInfo(entry);
  if (!info) return entry;
  const { syncId: _syncId, syncPartnerId: _partnerId, syncPartnerName: _partnerName, ...rest } = entry;
  return {
    ...rest,
    syncedWith: info,
    slots: (entry.slots || []).map(slot => ({ ...slot, syncedWith: info }))
  };
};

/** The exercises in `nextSlots` that weren't in `previousSlots` (matched by slot id). */
export const findAddedSlots = (previousSlots = [], nextSlots = []) => {
  const before = new Set((previousSlots || []).map(slot => slot?.id));
  return (nextSlots || []).filter(slot => slot?.id && !before.has(slot.id));
};

/**
 * The update written to the sync row for the friend: who added what, when. `slots` is the shared structure of the
 * added exercises (exercise, scheme, set types and reps — never weights), the same shape a live sync sends.
 */
export const buildHistoryUpdate = ({ user, workout, addedSlots, previous }) => {
  const added = buildSessionSyncStructure({ slots: addedSlots }).slots;
  const earlier = Array.isArray(previous?.slots) ? previous.slots : [];
  const byId = new Map([...earlier, ...added].map(slot => [slot.id, slot]));
  return {
    at: Date.now(),
    by: user?.id || null,
    byName: user?.username || '',
    workoutDate: workout?.startedAt || null,
    slots: Array.from(byId.values())
  };
};

export const readSyncedHistoryAcks = () => {
  try {
    return JSON.parse(localStorage.getItem(ACKS_KEY) || '{}') || {};
  } catch {
    return {};
  }
};

export const writeSyncedHistoryAck = (syncId, at) => {
  try {
    const acks = readSyncedHistoryAcks();
    acks[syncId] = Math.max(Number(acks[syncId]) || 0, Number(at) || 0);
    localStorage.setItem(ACKS_KEY, JSON.stringify(acks));
  } catch {
    // ignore (private mode)
  }
};

/**
 * What a friend added to a synced workout that this athlete hasn't got (or answered) yet:
 * [{ syncId, workoutId, partnerName, at, slots }] (slots = the shared structure of the missing exercises).
 */
export const findPendingHistoryUpdates = ({ rows = [], myId, history = [], acks = {} }) => {
  const pending = [];
  (rows || []).forEach(row => {
    const updates = row?.structure?.historyUpdates;
    if (!updates || typeof updates !== 'object') return;
    const mine = (history || []).find(w => getWorkoutSyncInfo(w)?.syncId === row.id);
    if (!mine) return;
    const have = new Set((mine.slots || []).map(slot => slot?.id));
    Object.entries(updates).forEach(([byId, update]) => {
      if (!update || byId === myId) return;
      if ((Number(update.at) || 0) <= (Number(acks[row.id]) || 0)) return;
      const missing = (update.slots || []).filter(slot => slot?.id && !have.has(slot.id));
      if (missing.length === 0) return;
      pending.push({
        syncId: row.id,
        workoutId: mine.id,
        workoutDate: mine.startedAt || update.workoutDate || null,
        partnerName: update.byName || getWorkoutSyncInfo(mine)?.partnerName || 'your friend',
        at: Number(update.at) || 0,
        slots: missing
      });
    });
  });
  return pending.sort((a, b) => b.at - a.at);
};

/**
 * The friend's added exercises as this athlete's own: weights from their own history and increment (like a live
 * sync), every set done and locked like any History entry, tagged with the sync.
 */
export const buildSlotsFromHistoryUpdate = (pendingUpdate, workout, numbers = {}) => {
  const info = getWorkoutSyncInfo(workout);
  const slots = mergeSessionSyncStructure([], { slots: pendingUpdate.slots }, numbers);
  return lockAndCompleteSets(slots).map(slot => (info ? { ...slot, syncedWith: info } : slot));
};
