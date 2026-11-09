// Per-account record of what this device knows about the server's History, kept apart from the app
// state so that bookkeeping never triggers another save/push.
//
// - synced:  { workoutId: signature } for workouts confirmed in public.workout_history (by a pull or
//            a successful push). Pushes upload only workouts that are new or changed since then.
//            A synced workout missing from a later pull was deleted on another device, so the pull
//            removes it here too instead of uploading it again.
// - deleted: workout ids deleted on this device whose server delete hasn't succeeded yet. They are
//            hidden from pulls and retried on every sync.

const LEDGER_KEY = 'yccih_cloud_sync_ledger_v1';

const readAll = () => {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEDGER_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeAll = all => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
};

const ledgerKeyFor = user => String(user?.id || '').trim();

// Short hash of the fields uploaded to workout_history, so edits are detected
export function workoutSyncSignature(workout) {
  const text = JSON.stringify([
    workout?.title || '',
    workout?.loadedRoutineTitle || '',
    workout?.startedAt || workout?.workoutDate || '',
    Array.isArray(workout?.slots) ? workout.slots : []
  ]);
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return `${text.length}:${(hash >>> 0).toString(36)}`;
}

export function getCloudSyncLedger(user) {
  const key = ledgerKeyFor(user);
  const entry = key ? readAll()[key] : null;
  const synced = entry?.synced && typeof entry.synced === 'object' && !Array.isArray(entry.synced) ? entry.synced : {};
  return {
    synced: { ...synced },
    deleted: new Set(Array.isArray(entry?.deleted) ? entry.deleted.map(String) : [])
  };
}

const updateLedger = (user, mutate) => {
  const key = ledgerKeyFor(user);
  if (!key) return;
  const ledger = getCloudSyncLedger(user);
  mutate(ledger);
  const all = readAll();
  all[key] = { synced: ledger.synced, deleted: Array.from(ledger.deleted) };
  writeAll(all);
};

// Replace the synced record with exactly what the server returned: { workoutId: signature }
export function setSyncedWorkouts(user, signaturesById) {
  updateLedger(user, ledger => {
    ledger.synced = { ...(signaturesById || {}) };
  });
}

export function markWorkoutsSynced(user, signaturesById) {
  updateLedger(user, ledger => {
    Object.assign(ledger.synced, signaturesById || {});
  });
}

export function markWorkoutIdDeleted(user, id) {
  if (!id) return;
  updateLedger(user, ledger => {
    ledger.deleted.add(String(id));
    delete ledger.synced[String(id)];
  });
}

export function clearDeletedWorkoutIds(user, ids) {
  updateLedger(user, ledger => {
    (ids || []).forEach(id => ledger.deleted.delete(String(id)));
  });
}

export function forgetCloudSyncLedger(user) {
  const key = ledgerKeyFor(user);
  if (!key) return;
  const all = readAll();
  delete all[key];
  writeAll(all);
}
