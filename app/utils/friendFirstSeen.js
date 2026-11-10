// ============================================================================
// When each friend first appeared on this device (per account), for the Home ticker's "NEW FRIEND" entries.
// The server doesn't send when a friendship started, so this is kept locally: the first time an account is
// seen on a device, its existing friends are recorded as not new; later arrivals get today's date.
// Stored in localStorage `yccih_friend_first_seen_v1`: { [accountId]: { [friendId]: 'YYYY/MM/DD' | '' } }.
// ============================================================================

const STORAGE_KEY = 'yccih_friend_first_seen_v1';
export const NEW_FRIEND_DAYS = 7;

const readAll = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

/** Read-only: { [friendId]: 'YYYY/MM/DD' | '' } for this account, or null when the account hasn't been seen yet. */
export const readFriendFirstSeen = accountId => {
  if (typeof window === 'undefined' || !accountId) return null;
  const forAccount = readAll()[String(accountId)];
  return forAccount && typeof forAccount === 'object' ? forAccount : null;
};

/** Records friends not seen before. First visit for an account: all current friends count as old (''). */
export const recordFriendFirstSeen = (accountId, friendIds, todayYMD) => {
  if (typeof window === 'undefined' || !accountId) return;
  const all = readAll();
  const key = String(accountId);
  const isFirstVisit = !all[key] || typeof all[key] !== 'object';
  const forAccount = isFirstVisit ? {} : { ...all[key] };
  let changed = isFirstVisit;
  (friendIds || []).forEach(id => {
    const fid = String(id || '');
    if (!fid || fid in forAccount) return;
    forAccount[fid] = isFirstVisit ? '' : todayYMD;
    changed = true;
  });
  if (!changed) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [key]: forAccount }));
  } catch {
    // ignore storage errors (private mode etc.)
  }
};

/** Whole days between two 'YYYY/MM/DD' dates (b − a), or Infinity when either is missing. */
export const daysBetweenYMD = (a, b) => {
  const toMs = s => Date.parse(String(s || '').replace(/\//g, '-') + 'T00:00:00');
  const ms = toMs(b) - toMs(a);
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : Infinity;
};
