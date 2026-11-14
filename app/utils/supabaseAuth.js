// ============================================================================
// SUPABASE & LOCAL ACCOUNT AUTHENTICATION ENGINE
// ============================================================================

import { buildHistoryPRs, withEngineBodyweight } from './workoutEngine';
import { canonicalExerciseData } from '../data/exerciseLibrary';

const LOCAL_ACCOUNTS_KEY = 'yccih_registered_accounts_v1';
const SUPABASE_TOKENS_KEY = 'yccih_supabase_tokens_v1';
const BETA_ACCESS_CODE = 'imnotcrying';

export const getSupabaseConfig = () => {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  // Strip accidental '/rest/v1' or trailing slashes from NEXT_PUBLIC_SUPABASE_URL
  const baseUrl = rawUrl
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/auth\/v1\/?$/i, '')
    .replace(/\/+$/, '');

  return {
    baseUrl,
    anonKey: anonKey.trim(),
    isConfigured: Boolean(baseUrl && anonKey)
  };
};

/**
 * Builds headers compatible with both legacy JWT anon keys (`eyJ...`) and
 * Supabase publishable API keys (`sb_publishable_...`).
 * When `anonKey` is a publishable key and no user JWT `accessToken` is present,
 * omitting `Authorization: Bearer sb_publishable_...` allows Supabase's gateway
 * to inject the `anon` JWT role instead of PostgREST rejecting a 1-part token.
 */
export const buildSupabaseHeaders = (anonKey, accessToken = null, extraHeaders = {}) => {
  const headers = {
    apikey: anonKey,
    ...extraHeaders
  };
  if (accessToken && String(accessToken).startsWith('eyJ')) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (anonKey && String(anonKey).startsWith('eyJ')) {
    headers.Authorization = `Bearer ${anonKey}`;
  }
  return headers;
};

// ---------------------------------------------------------------------------
// LOCAL ACCOUNT REGISTRY
// Remembers which accounts have signed in on this device (id, username, email). Passwords are never
// stored. Only in offline/dev mode (no Supabase configured) is a salted password hash kept, since
// there is no server to check passwords against.
// ---------------------------------------------------------------------------

export const getLocalRegisteredAccounts = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    // Migration: older builds stored plain-text passwords here. Remove them on first read.
    let purged = false;
    Object.values(parsed).forEach(acc => {
      if (acc && typeof acc === 'object' && ('password' in acc || 'passwordResetLocally' in acc)) {
        delete acc.password;
        delete acc.passwordResetLocally;
        purged = true;
      }
    });
    if (purged) window.localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    return {};
  }
};

/** Removes plain-text passwords saved by older builds. Called once when the app starts. */
export const purgeLegacyStoredPasswords = () => {
  getLocalRegisteredAccounts();
};

const saveLocalRegisteredAccount = account => {
  if (typeof window === 'undefined' || !account?.email) return;
  try {
    const existing = getLocalRegisteredAccounts();
    const key = account.email.trim().toLowerCase();
    existing[key] = {
      id: account.id || existing[key]?.id || `usr_${Date.now()}`,
      username: account.username || existing[key]?.username || key.split('@')[0],
      email: key,
      ...(account.passwordHash
        ? { passwordHash: account.passwordHash, passwordSalt: account.passwordSalt }
        : existing[key]?.passwordHash
          ? { passwordHash: existing[key].passwordHash, passwordSalt: existing[key].passwordSalt }
          : {}),
      createdAt: existing[key]?.createdAt || account.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    window.localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(existing));
  } catch {
    // ignore storage errors
  }
};

// Salted SHA-256 for offline/dev-mode accounts only (Supabase handles passwords otherwise).
const hashLocalPassword = async (password, salt) => {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const newLocalSalt = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

export const isLocallyVerifiedUser = user => {
  if (!user || !user.email) return false;
  // Valid UUID from Supabase Auth
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(user.id || ''))) {
    return true;
  }
  // Check local registered accounts registry
  const accounts = getLocalRegisteredAccounts();
  return Boolean(accounts[user.email.trim().toLowerCase()]);
};

// ---------------------------------------------------------------------------
// SUPABASE SESSION TOKENS (access + refresh). The refresh token keeps the athlete signed in.
// ---------------------------------------------------------------------------

const saveSupabaseSessionTokens = ({ userId, email, accessToken, refreshToken }) => {
  if (typeof window === 'undefined' || !accessToken) return;
  try {
    window.localStorage.setItem(
      SUPABASE_TOKENS_KEY,
      JSON.stringify({
        userId,
        email: (email || '').trim().toLowerCase(),
        accessToken,
        refreshToken: refreshToken || null,
        savedAt: Date.now()
      })
    );
  } catch {
    // ignore storage errors
  }
};

const getSavedSupabaseSessionTokens = email => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SUPABASE_TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (email && parsed.email && parsed.email !== email.trim().toLowerCase()) return null;
    return parsed;
  } catch {
    return null;
  }
};

const clearSupabaseSessionTokens = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SUPABASE_TOKENS_KEY);
  } catch {
    // ignore storage errors
  }
};

// Claims from a JWT payload (no verification; for diagnostics), or null
const readJwtClaims = token => {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
};

/**
 * Works out why the database answered as a signed-out visitor. Returns { recognised, summary },
 * where summary is a short code shown in the sync banner, e.g.
 * "AUTH 200 · DB 401 · ROLE AUTHENTICATED · SUB OK · EXP 58M · LEN 900".
 */
async function diagnoseSession(user, accessToken) {
  const { baseUrl, anonKey } = getSupabaseConfig();
  const headers = buildSupabaseHeaders(anonKey, accessToken, { 'Content-Type': 'application/json' });
  const claims = readJwtClaims(accessToken);
  const statusOf = async (url, init) => {
    try {
      return (await fetch(url, { headers, cache: 'no-store', ...init })).status;
    } catch {
      return 'NET';
    }
  };
  const [authStatus, dbStatus] = await Promise.all([
    statusOf(`${baseUrl}/auth/v1/user`),
    // Callable only by signed-in users, so a 2xx proves the database accepted the token
    statusOf(`${baseUrl}/rest/v1/rpc/my_friendships`, { method: 'POST', body: '{}' })
  ]);
  const minutesLeft = claims?.exp ? Math.round((claims.exp * 1000 - Date.now()) / 60000) : null;
  const summary = [
    `AUTH ${authStatus}`,
    `DB ${dbStatus}`,
    `ROLE ${claims?.role || '?'}`,
    `SUB ${!claims?.sub ? '?' : claims.sub === String(user?.id) ? 'OK' : 'MISMATCH'}`,
    `EXP ${minutesLeft === null ? '?' : `${minutesLeft}M`}`,
    `LEN ${String(accessToken || '').length}`
  ]
    .join(' · ')
    .toUpperCase();
  return { recognised: typeof dbStatus === 'number' && dbStatus >= 200 && dbStatus < 300, summary };
}

// Expiry time (ms) from a JWT's `exp` claim, or 0 if it can't be read.
const getJwtExpiryMs = token => {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) return 0;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return Number(json?.exp) > 0 ? Number(json.exp) * 1000 : 0;
  } catch {
    return 0;
  }
};

export const SESSION_EXPIRED_EVENT = 'yccih:session-expired';

// Ends the session on this device and tells the app (useCloudAndStorageSync) to show the athlete as
// signed out, so a cloud account is never "signed in" without a working session.
const endSessionOnDevice = () => {
  clearSupabaseSessionTokens();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
};

const isCloudAccountId = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));

/**
 * Registers a new user account via Supabase Auth (or the offline local registry when Supabase isn't
 * configured). Enforces beta code, email, username, and password validation.
 * Returns { user, requiresEmailConfirmation }; when confirmation is required there is no session yet,
 * so the athlete should confirm their email and then sign in.
 */
export async function registerUserAccount({ username, email, password, betaCode }) {
  const cleanUser = (username || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = password || '';
  const cleanCode = (betaCode || '').trim().toLowerCase();

  if (!cleanUser || cleanUser.length < 2) {
    throw new Error('PLEASE ENTER A USERNAME (AT LEAST 2 CHARACTERS).');
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('PLEASE ENTER A VALID EMAIL ADDRESS.');
  }
  if (!cleanPass || cleanPass.length < 6) {
    throw new Error('PASSWORD MUST BE AT LEAST 6 CHARACTERS.');
  }
  if (cleanCode !== BETA_ACCESS_CODE) {
    throw new Error('INVALID BETA TESTER CODE. ACCESS DENIED.');
  }

  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();

  if (isConfigured) {
    const res = await fetch(`${baseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: cleanEmail,
        password: cleanPass,
        data: { username: cleanUser }
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg =
        data?.msg ||
        data?.error_description ||
        data?.message ||
        'FAILED TO CREATE ACCOUNT.';
      throw new Error(String(errMsg).toUpperCase());
    }

    const authUser = data?.user || data;
    const userId = authUser?.id || `usr_${Date.now()}`;
    const accessToken = data?.access_token || data?.session?.access_token || null;

    // Supabase returns an obfuscated user with empty identities array if the email is already registered
    if (Array.isArray(authUser?.identities) && authUser.identities.length === 0) {
      throw new Error('AN ACCOUNT WITH THIS EMAIL ALREADY EXISTS. PLEASE SIGN IN ABOVE.');
    }

    // Best-effort upsert into public.user_profiles when session token is active
    if (accessToken && authUser?.id) {
      try {
        await fetch(`${baseUrl}/rest/v1/user_profiles`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            id: authUser.id,
            email: cleanEmail,
            username: cleanUser
          })
        });
      } catch {
        // non-blocking if RLS or table setup is pending
      }
    }

    const createdUser = {
      id: userId,
      username: cleanUser,
      email: cleanEmail
    };

    if (accessToken) {
      saveSupabaseSessionTokens({
        userId,
        email: cleanEmail,
        accessToken,
        refreshToken: data?.refresh_token || data?.session?.refresh_token || null
      });
      saveLocalRegisteredAccount(createdUser);
    }

    return {
      user: createdUser,
      requiresEmailConfirmation: !accessToken
    };
  }

  // Offline/dev fallback when Supabase env vars are not present
  const existing = getLocalRegisteredAccounts();
  if (existing[cleanEmail]) {
    throw new Error('AN ACCOUNT WITH THIS EMAIL ALREADY EXISTS. PLEASE SIGN IN ABOVE.');
  }

  const createdUser = {
    id: `usr_${Date.now()}`,
    username: cleanUser,
    email: cleanEmail
  };
  const passwordSalt = newLocalSalt();
  saveLocalRegisteredAccount({
    ...createdUser,
    passwordSalt,
    passwordHash: await hashLocalPassword(cleanPass, passwordSalt)
  });

  return {
    user: createdUser,
    requiresEmailConfirmation: false
  };
}

/**
 * Authenticates an existing user account via Supabase Auth (or the offline local registry).
 * Supports signing in with EITHER Username OR Email Address in a single field.
 */
export async function signInUserAccount({ identifier, username, email, password }) {
  const rawIdentifier = (identifier || email || username || '').trim();
  const cleanPass = password || '';

  if (!rawIdentifier) {
    throw new Error('PLEASE ENTER YOUR USERNAME OR EMAIL ADDRESS.');
  }
  if (!cleanPass) {
    throw new Error('PLEASE ENTER YOUR PASSWORD TO SIGN IN.');
  }

  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  const localAccounts = getLocalRegisteredAccounts();
  const lowerInput = rawIdentifier.toLowerCase();

  // Match against local registry by email OR by username
  const localMatch =
    localAccounts[lowerInput] ||
    Object.values(localAccounts).find(
      acc => (acc?.username || '').trim().toLowerCase() === lowerInput
    ) ||
    null;

  // Resolve email if user entered a username instead of an email
  let resolvedEmail = rawIdentifier.includes('@') ? lowerInput : localMatch?.email || '';
  const resolvedUsernameFromLookup = localMatch?.username || (!rawIdentifier.includes('@') ? rawIdentifier : '');

  if (!resolvedEmail && isConfigured) {
    try {
      // Profiles aren't publicly readable, so resolve the username through the database function
      const lookupRes = await fetch(`${baseUrl}/rest/v1/rpc/resolve_login_email`, {
        method: 'POST',
        headers: buildSupabaseHeaders(anonKey, null, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ identifier: rawIdentifier })
      });
      if (lookupRes.ok) {
        const foundEmail = await lookupRes.json();
        if (typeof foundEmail === 'string' && foundEmail) {
          resolvedEmail = foundEmail.trim().toLowerCase();
        }
      }
    } catch {
      // ignore lookup error
    }
  }

  if (isConfigured) {
    if (!resolvedEmail) {
      throw new Error(
        'ACCOUNT NOT FOUND OR INVALID PASSWORD. IF YOU FORGOT YOUR PASSWORD, USE "FORGOT PASSWORD?" BELOW.'
      );
    }
    const res = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: buildSupabaseHeaders(anonKey, null, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        email: resolvedEmail,
        password: cleanPass
      })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.user) {
      const authUser = data.user;
      const accessToken = data.access_token;
      let resolvedUsername =
        authUser.user_metadata?.username ||
        resolvedUsernameFromLookup ||
        localMatch?.username ||
        resolvedEmail.split('@')[0];

      // Fetch username from public.user_profiles if available, and sync metadata PRs/history into user_profiles
      if (accessToken && authUser.id) {
        try {
          const profRes = await fetch(
            `${baseUrl}/rest/v1/user_profiles?id=eq.${authUser.id}&select=id,username,email,one_rep_maxes,settings`,
            {
              headers: buildSupabaseHeaders(anonKey, accessToken)
            }
          );
          let existingProfileRow = null;
          if (profRes.ok) {
            const rows = await profRes.json();
            if (Array.isArray(rows) && rows.length > 0) {
              existingProfileRow = rows[0];
              if (rows[0]?.username) {
                resolvedUsername = rows[0].username;
              }
            }
          }
          const metaSnap = authUser.user_metadata?.yccih_cloud_state_v3 || null;
          const mergedMaxes = {
            ...(metaSnap?.oneRepMaxes || {}),
            ...(existingProfileRow?.one_rep_maxes || {})
          };
          const mergedSettings = {
            ...(metaSnap?.settings || {}),
            ...(existingProfileRow?.settings || {}),
            oneRepMaxes: mergedMaxes,
            recentHistory:
              Array.isArray(metaSnap?.history) && metaSnap.history.length > 0
                ? metaSnap.history.slice(0, 30)
                : existingProfileRow?.settings?.recentHistory || []
          };
          await fetch(`${baseUrl}/rest/v1/user_profiles?on_conflict=id`, {
            method: 'POST',
            headers: buildSupabaseHeaders(anonKey, accessToken, {
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates'
            }),
            body: JSON.stringify({
              id: authUser.id,
              email: (authUser.email || resolvedEmail).toLowerCase(),
              username: resolvedUsername,
              one_rep_maxes: mergedMaxes,
              settings: mergedSettings
            })
          }).catch(() => {});
        } catch {
          // ignore profile lookup error
        }
      }

      const signedInUser = {
        id: authUser.id,
        username: resolvedUsername,
        email: authUser.email || resolvedEmail
      };

      if (accessToken) {
        saveSupabaseSessionTokens({
          userId: authUser.id,
          email: signedInUser.email,
          accessToken,
          refreshToken: data.refresh_token || null
        });
      }

      saveLocalRegisteredAccount(signedInUser);

      return { user: signedInUser };
    }

    const errCode = data?.error_code || '';
    const errMsg = String(data?.msg || data?.error_description || data?.message || '');
    if (errCode === 'email_not_confirmed' || errMsg.toLowerCase().includes('email not confirmed')) {
      throw new Error('EMAIL NOT CONFIRMED YET. OPEN THE CONFIRMATION LINK IN YOUR INBOX, THEN SIGN IN.');
    }

    throw new Error(
      'ACCOUNT NOT FOUND OR INVALID PASSWORD. IF YOU FORGOT YOUR PASSWORD, USE "FORGOT PASSWORD?" BELOW.'
    );
  }

  // Offline/dev fallback: verify against the salted hash stored at sign-up
  const validLocal =
    localMatch?.passwordHash &&
    localMatch?.passwordSalt &&
    (await hashLocalPassword(cleanPass, localMatch.passwordSalt)) === localMatch.passwordHash;
  if (!validLocal) {
    throw new Error(
      'ACCOUNT NOT FOUND OR INVALID PASSWORD. IF YOU FORGOT YOUR PASSWORD, USE "FORGOT PASSWORD?" BELOW.'
    );
  }

  return {
    user: {
      id: localMatch.id,
      username: localMatch.username || resolvedUsernameFromLookup || localMatch.email.split('@')[0],
      email: localMatch.email
    }
  };
}

/**
 * Signs out: revokes the session with Supabase (best effort) and forgets the tokens on this device.
 */
export async function signOutUser() {
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  const saved = getSavedSupabaseSessionTokens();
  clearSupabaseSessionTokens();
  if (!isConfigured || !saved?.accessToken) return;
  try {
    await fetch(`${baseUrl}/auth/v1/logout`, {
      method: 'POST',
      headers: buildSupabaseHeaders(anonKey, saved.accessToken)
    });
  } catch {
    // the local tokens are already gone
  }
}

/**
 * Sends a Supabase password recovery email link to the user's registered email address.
 */
export async function requestPasswordRecoveryEmail({ email }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('PLEASE ENTER A VALID REGISTERED EMAIL ADDRESS.');
  }

  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    throw new Error('SUPABASE CLOUD NOT CONFIGURED. USE THE BETA CODE PASSWORD RESET BELOW.');
  }

  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/` : 'https://youcantcryinhere.com/';

  const res = await fetch(
    `${baseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: cleanEmail })
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const errMsg =
      data?.msg ||
      data?.error_description ||
      data?.message ||
      'FAILED TO SEND RECOVERY EMAIL.';
    throw new Error(String(errMsg).toUpperCase());
  }

  return {
    sent: true,
    message: `RECOVERY LINK SENT TO ${cleanEmail.toUpperCase()}. CHECK YOUR EMAIL INBOX & SPAM FOLDER.`
  };
}

/**
 * Completes a password update using the Supabase recovery session from the email link
 * (access_token + refresh_token in the URL hash). Signs the athlete in with that session.
 */
export async function completePasswordRecoveryWithToken({ accessToken, refreshToken = null, newPassword }) {
  const cleanPass = newPassword || '';
  if (!accessToken) {
    throw new Error('MISSING OR EXPIRED RECOVERY TOKEN. REQUEST A NEW RESET LINK.');
  }
  if (cleanPass.length < 6) {
    throw new Error('NEW PASSWORD MUST BE AT LEAST 6 CHARACTERS.');
  }

  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    throw new Error('SUPABASE CONFIGURATION MISSING.');
  }

  const res = await fetch(`${baseUrl}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password: cleanPass })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg =
      data?.msg ||
      data?.error_description ||
      data?.message ||
      'FAILED TO UPDATE PASSWORD.';
    throw new Error(String(errMsg).toUpperCase());
  }

  const authUser = data?.user || data;
  const cleanEmail = (authUser?.email || '').toLowerCase();
  const localAccounts = getLocalRegisteredAccounts();
  const localMatch = localAccounts[cleanEmail];
  const resolvedUsername =
    authUser?.user_metadata?.username ||
    localMatch?.username ||
    (cleanEmail ? cleanEmail.split('@')[0] : 'athlete');

  const updatedUser = {
    id: authUser?.id || localMatch?.id || `usr_${Date.now()}`,
    username: resolvedUsername,
    email: cleanEmail
  };

  if (cleanEmail) {
    saveSupabaseSessionTokens({
      userId: updatedUser.id,
      email: cleanEmail,
      accessToken,
      refreshToken
    });
    saveLocalRegisteredAccount(updatedUser);
  }

  return { user: updatedUser };
}

// ============================================================================
// CROSS-DEVICE SUPABASE CLOUD SYNC ENGINE (PROFILES, HISTORY, ROUTINES & METADATA)
// ============================================================================

let inFlightTokenRefreshPromise = null;

/**
 * Returns a valid access token for the signed-in athlete, refreshing it with the saved refresh
 * token when it is about to expire. Never uses a password. If Supabase rejects the refresh token
 * (revoked or expired session), the tokens are cleared and SESSION_EXPIRED_EVENT is dispatched so
 * the app can ask the athlete to sign in again.
 */
export async function getValidSupabaseAccessToken(user, { forceRefresh = false } = {}) {
  if (!user || (!user.email && !user.username)) return null;
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  const cleanEmail = (user.email || '').trim().toLowerCase();
  const saved = getSavedSupabaseSessionTokens(cleanEmail);
  if (!saved?.accessToken) {
    // A cloud account with no saved session (e.g. signed in with an older build) can't sync
    if (isCloudAccountId(user.id)) endSessionOnDevice();
    return null;
  }

  // Use the current token until a minute before it expires
  const expiresAt = getJwtExpiryMs(saved.accessToken) || (saved.savedAt || 0) + 45 * 60 * 1000;
  if (!forceRefresh && Date.now() < expiresAt - 60 * 1000) {
    return saved.accessToken;
  }
  if (!saved.refreshToken) {
    endSessionOnDevice();
    return null;
  }

  if (inFlightTokenRefreshPromise) {
    return inFlightTokenRefreshPromise;
  }

  inFlightTokenRefreshPromise = (async () => {
    try {
      const res = await fetch(`${baseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: buildSupabaseHeaders(anonKey, null, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ refresh_token: saved.refreshToken })
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.access_token) {
          saveSupabaseSessionTokens({
            userId: data.user?.id || user.id,
            email: cleanEmail || data.user?.email || '',
            accessToken: data.access_token,
            refreshToken: data.refresh_token || saved.refreshToken
          });
          return data.access_token;
        }
      }
      // 4xx: the refresh token was rejected → the session is over on this device.
      // 5xx: Supabase hiccup → keep the session and retry later.
      if (res.status >= 400 && res.status < 500) endSessionOnDevice();
      return null;
    } catch {
      // Network error: keep the session and try again later
      return null;
    } finally {
      inFlightTokenRefreshPromise = null;
    }
  })();

  return inFlightTokenRefreshPromise;
}

/**
 * Pulls the signed-in user's state from Supabase Cloud (both relational tables and Auth user_metadata snapshot).
 */
export async function fetchCloudStateForUser(user) {
  if (!user || !user.email) return null;
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  const accessToken = await getAccessTokenForSync(user);
  if (!accessToken) return { error: 'NO ACTIVE SESSION ON THIS DEVICE' };

  const headers = buildSupabaseHeaders(anonKey, accessToken);

  let metadataSnapshot = null;
  let profileRow = null;
  let historyRows = null;
  let routineRows = null;
  let firstError = null;

  // Resolves to parsed JSON, or null after recording why the request failed
  const getJson = async url => {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        if (!firstError) firstError = await describeFailedResponse(res);
        return null;
      }
      return await res.json();
    } catch {
      if (!firstError) firstError = 'NETWORK ERROR';
      return null;
    }
  };

  await Promise.allSettled([
    // Legacy: older builds stored a snapshot in the sign-in account's metadata. Read-only now, and a
    // failure here doesn't count as a sync error.
    fetch(`${baseUrl}/auth/v1/user`, { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(u => {
        if (u?.user_metadata?.yccih_cloud_state_v3) {
          metadataSnapshot = u.user_metadata.yccih_cloud_state_v3;
        }
      })
      .catch(() => {}),
    user.id
      ? getJson(
          `${baseUrl}/rest/v1/user_profiles?id=eq.${encodeURIComponent(user.id)}&select=id,username,email,one_rep_maxes,settings`
        ).then(rows => {
          if (Array.isArray(rows) && rows[0]) profileRow = rows[0];
        })
      : Promise.resolve(),
    user.id
      ? getJson(
          `${baseUrl}/rest/v1/workout_history?user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,title,preset_used,started_at,slots&order=started_at.desc`
        ).then(rows => {
          if (Array.isArray(rows)) historyRows = rows;
        })
      : Promise.resolve(),
    user.id
      ? getJson(
          `${baseUrl}/rest/v1/routines?user_id=eq.${encodeURIComponent(user.id)}&select=key,user_id,author_username,label,is_shared,slots,created_at,updated_at`
        ).then(rows => {
          if (Array.isArray(rows)) routineRows = rows;
        })
      : Promise.resolve()
  ]);

  // Without the History table we can't tell what the server has, so report the failure instead of
  // merging a partial picture.
  if (!historyRows) {
    return { error: firstError || 'COULD NOT LOAD WORKOUT HISTORY' };
  }
  // When the database doesn't accept the sign-in token it answers as a signed-out visitor: 200 with
  // no rows, which looks exactly like an empty account. Every account has its own profile row, so
  // a missing one means the session wasn't recognised.
  if (!profileRow) {
    const diag = await diagnoseSession(user, accessToken);
    // Session recognised but no profile row yet: carry on; the next push creates the row
    if (!diag.recognised) {
      return { error: `THE DATABASE DID NOT RECOGNISE YOUR SIGN-IN. SIGN OUT AND SIGN IN AGAIN [${diag.summary}]` };
    }
  }

  // If metadataSnapshot has PRs or history not yet reflected in public.user_profiles, immediately backfill user_profiles
  if (metadataSnapshot && user.id) {
    const metaMaxes = metadataSnapshot.oneRepMaxes || {};
    const profMaxes = profileRow?.one_rep_maxes || {};
    const mergedMaxes = { ...metaMaxes, ...profMaxes };
    Object.entries(metaMaxes).forEach(([k, v]) => {
      if ((Number(v) || 0) > (Number(mergedMaxes[k]) || 0)) {
        mergedMaxes[k] = Number(v);
      }
    });
    const metaHist = Array.isArray(metadataSnapshot.history) ? metadataSnapshot.history : [];
    const profHist = Array.isArray(profileRow?.settings?.recentHistory)
      ? profileRow.settings.recentHistory
      : [];
    const needsBackfill =
      Object.keys(mergedMaxes).length > Object.keys(profMaxes).length ||
      (metaHist.length > 0 && profHist.length === 0);

    if (needsBackfill) {
      const backfillSettings = {
        ...(metadataSnapshot.settings || {}),
        ...(profileRow?.settings || {}),
        oneRepMaxes: mergedMaxes,
        recentHistory: metaHist.length > 0 ? metaHist.slice(0, 30) : profHist
      };
      fetch(`${baseUrl}/rest/v1/user_profiles?on_conflict=id`, {
        method: 'POST',
        headers: buildSupabaseHeaders(anonKey, accessToken, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        }),
        body: JSON.stringify({
          id: String(user.id),
          email: (user.email || '').trim().toLowerCase() || undefined,
          username: user.username || undefined,
          one_rep_maxes: mergedMaxes,
          settings: backfillSettings
        })
      }).catch(() => {});
    }
  }

  const mappedHistoryFromTable = Array.isArray(historyRows)
    ? historyRows.map(row => ({
        id: row.id,
        title: row.title,
        loadedRoutineTitle: row.preset_used || 'MANUAL',
        gymId: row.gym_id || '',
        startedAt: row.started_at,
        updatedAt: row.updated_at || row.started_at,
        defaultRestSeconds: row.default_rest_seconds || 90,
        isComplete: row.is_complete !== undefined ? Boolean(row.is_complete) : true,
        verifiedByUser: row.verified_by_user !== undefined ? Boolean(row.verified_by_user) : true,
        slots: canonicalExerciseData(Array.isArray(row.slots) ? row.slots : [])
      }))
    : [];

  const mappedSavedRoutinesFromTable = Array.isArray(routineRows)
    ? routineRows
        .filter(r => !r.is_shared)
        .map(r => ({
          key: r.key,
          label: r.label,
          author: r.author_username || user.username,
          savedAt: r.updated_at || r.created_at || null,
          slots: canonicalExerciseData(Array.isArray(r.slots) ? r.slots : [])
        }))
    : [];

  const mappedSharedRoutinesFromTable = Array.isArray(routineRows)
    ? routineRows
        .filter(r => r.is_shared)
        .map(r => ({
          key: r.key,
          label: r.label,
          author: r.author_username || user.username,
          savedAt: r.updated_at || r.created_at || null,
          slots: canonicalExerciseData(Array.isArray(r.slots) ? r.slots : [])
        }))
    : [];

  return {
    // 'table' = the authoritative workout_history rows; 'fallback' = older snapshots used only when
    // the table is still empty for this account
    historySource: mappedHistoryFromTable.length > 0 ? 'table' : 'fallback',
    tableHistoryIds: mappedHistoryFromTable.map(w => String(w.id)),
    updatedAt: profileRow?.updated_at || profileRow?.settings?.updatedAt || metadataSnapshot?.updatedAt || null,
    oneRepMaxes: {
      ...(metadataSnapshot?.oneRepMaxes || {}),
      ...(profileRow?.settings?.oneRepMaxes || {}),
      ...(profileRow?.one_rep_maxes || {})
    },
    history:
      mappedHistoryFromTable.length > 0
        ? mappedHistoryFromTable
        : Array.isArray(profileRow?.settings?.recentHistory) && profileRow.settings.recentHistory.length > 0
          ? profileRow.settings.recentHistory
          : Array.isArray(metadataSnapshot?.history)
            ? metadataSnapshot.history
            : [],
    activeSession:
      profileRow?.settings?.activeSession !== undefined
        ? profileRow.settings.activeSession
        : metadataSnapshot?.activeSession ?? null,
    savedRoutines:
      mappedSavedRoutinesFromTable.length > 0
        ? mappedSavedRoutinesFromTable
        : Array.isArray(metadataSnapshot?.savedRoutines)
          ? metadataSnapshot.savedRoutines
          : [],
    sharedRoutines:
      mappedSharedRoutinesFromTable.length > 0
        ? mappedSharedRoutinesFromTable
        : Array.isArray(metadataSnapshot?.sharedRoutines)
          ? metadataSnapshot.sharedRoutines
          : [],
    gyms:
      Array.isArray(profileRow?.gyms) && profileRow.gyms.length > 0
        ? profileRow.gyms
        : Array.isArray(profileRow?.settings?.gyms) && profileRow.settings.gyms.length > 0
          ? profileRow.settings.gyms
          : Array.isArray(metadataSnapshot?.gyms)
            ? metadataSnapshot.gyms
            : [],
    friendsList:
      Array.isArray(profileRow?.settings?.friendsList) && profileRow.settings.friendsList.length > 0
        ? profileRow.settings.friendsList
        : Array.isArray(metadataSnapshot?.friendsList)
          ? metadataSnapshot.friendsList
          : [],
    outgoingInvites:
      Array.isArray(profileRow?.settings?.outgoingInvites) && profileRow.settings.outgoingInvites.length > 0
        ? profileRow.settings.outgoingInvites
        : Array.isArray(metadataSnapshot?.outgoingInvites)
          ? metadataSnapshot.outgoingInvites
          : [],
    settings: profileRow?.settings || metadataSnapshot?.settings || null
  };
}

// Supabase copies a sign-in account's metadata into every access token. Older builds stored the whole
// app state (including all History) there, which made tokens too large to send, so requests failed.
// A token this long means that old snapshot is still attached.
const OVERSIZED_ACCESS_TOKEN_CHARS = 6000;
const HISTORY_UPSERT_BATCH_SIZE = 25;

// Short, user-facing reason for a failed Supabase response, e.g. "SERVER 400: INVALID INPUT ..."
async function describeFailedResponse(res) {
  let detail = '';
  try {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.message || parsed?.msg || parsed?.error_description || parsed?.error || '';
    } catch {
      detail = text;
    }
  } catch {
    // ignore unreadable body
  }
  detail = String(detail || '').trim().slice(0, 120);
  return `SERVER ${res.status}${detail ? `: ${detail}` : ''}`.toUpperCase();
}

// The snapshot itself is moved into workout_history and removed server-side by
// supabase/migrations/2026-11-08_move_metadata_snapshots.sql. After that, an oversized token on a
// device is stale: refresh it once so the device gets a small one without signing in again.
let attemptedOversizedTokenRefresh = false;
async function getAccessTokenForSync(user) {
  const token = await getValidSupabaseAccessToken(user);
  if (token && token.length > OVERSIZED_ACCESS_TOKEN_CHARS && !attemptedOversizedTokenRefresh) {
    attemptedOversizedTokenRefresh = true;
    return (await getValidSupabaseAccessToken(user, { forceRefresh: true })) || token;
  }
  return token;
}

const toWorkoutHistoryRow = (w, userId) => ({
  id: String(w.id),
  user_id: userId,
  title: w.title || 'Workout Session',
  preset_used: w.loadedRoutineTitle || 'MANUAL',
  started_at: w.startedAt && !Number.isNaN(new Date(w.startedAt).getTime())
    ? new Date(w.startedAt).toISOString()
    : w.workoutDate && !Number.isNaN(new Date(w.workoutDate).getTime())
      ? new Date(w.workoutDate).toISOString()
      : new Date().toISOString(),
  // Only new or changed workouts are uploaded, so this marks a real change (friends' apps watch it)
  updated_at: new Date().toISOString(),
  slots: Array.isArray(w.slots) ? w.slots : []
});

/**
 * A cheap "has any friend logged or changed a workout?" check: the newest workout_history row that isn't yours (RLS
 * only returns friends' rows). Returns { ok, stamp } where stamp changes whenever a friend saves a workout.
 */
export async function fetchLatestFriendWorkoutStamp(user) {
  if (!user || !isUuid(user.id)) return { ok: false, stamp: null };
  const me = encodeURIComponent(user.id);
  const res = await authedRequest(
    user,
    `/rest/v1/workout_history?select=id,updated_at&user_id=neq.${me}&order=updated_at.desc&limit=1`
  );
  if (!res.ok || !Array.isArray(res.data)) return { ok: false, stamp: null };
  const row = res.data[0];
  return { ok: true, stamp: row ? `${row.id}|${row.updated_at}` : '' };
}

/**
 * Pushes the signed-in athlete's state to Supabase: the profile row (PRs + settings), History
 * workouts as workout_history rows (only `historyToUpload` when given, else all), and routines. Returns
 * { ok, error, syncedWorkoutIds, failedWorkoutCount } so the app can show failures and retry.
 * History is uploaded in batches; a batch the server rejects is retried row by row so one bad
 * workout can't block the rest.
 */
export async function pushCloudStateForUser(user, payload, { historyToUpload } = {}) {
  if (!user || !payload) return { ok: false, error: 'NOT SIGNED IN', syncedWorkoutIds: [], failedWorkoutCount: 0 };
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return { ok: true, error: null, syncedWorkoutIds: [], failedWorkoutCount: 0 };
  if (!isUuid(user.id)) {
    return { ok: false, error: 'THIS ACCOUNT IS NOT A CLOUD ACCOUNT', syncedWorkoutIds: [], failedWorkoutCount: 0 };
  }

  const accessToken = await getAccessTokenForSync(user);
  if (!accessToken) {
    return { ok: false, error: 'NO ACTIVE SESSION ON THIS DEVICE', syncedWorkoutIds: [], failedWorkoutCount: 0 };
  }

  const userId = String(user.id);
  const errors = [];
  const send = async (path, method, body, prefer) => {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: buildSupabaseHeaders(anonKey, accessToken, {
          'Content-Type': 'application/json',
          ...(prefer ? { Prefer: prefer } : {})
        }),
        body: JSON.stringify(body)
      });
      if (!res.ok) return { ok: false, error: await describeFailedResponse(res), status: res.status };
      return { ok: true, error: null, status: res.status };
    } catch {
      return { ok: false, error: 'NETWORK ERROR', status: 0 };
    }
  };
  // Refused by row-level security: the row's id / key already exists under another account (the data on this device
  // came from that account, e.g. after switching accounts). Such rows aren't this athlete's to upload.
  // Only that exact refusal counts: an upsert that turned into an UPDATE of a row this athlete can't see fails its
  // USING check ("new row violates row-level security policy (USING expression)"). Any other 403 (e.g. "permission
  // denied for table", a server misconfiguration) stays an ordinary error, so it can never delete local data.
  const isForeignRow = result =>
    !result.ok && result.status === 403 && /row-level security policy \(USING expression\)/i.test(String(result.error || ''));
  const foreignWorkoutIds = [];
  const foreignRoutineKeys = [];

  // 1. Profile row: PRs + settings (and a short recent-History copy that friend profiles read)
  const profileUpdateBody = {
    one_rep_maxes: payload.oneRepMaxes || {},
    settings: {
      ...(payload.settings || {}),
      schemaVersion: payload.schemaVersion || 3,
      updatedAt: payload.updatedAt || new Date().toISOString(),
      oneRepMaxes: payload.oneRepMaxes || {},
      gyms: payload.gyms || [],
      activeSession: payload.activeSession || null,
      outgoingInvites: payload.outgoingInvites || [],
      savedRoutines: payload.savedRoutines || [],
      sharedRoutines: payload.sharedRoutines || [],
      recentHistory: Array.isArray(payload.history) ? payload.history.slice(0, 50) : []
    }
  };
  const profileTask = (async () => {
    const upsert = await send(
      '/rest/v1/user_profiles?on_conflict=id',
      'POST',
      {
        id: userId,
        email: (user.email || '').trim().toLowerCase() || undefined,
        username: user.username || undefined,
        ...profileUpdateBody
      },
      'resolution=merge-duplicates'
    );
    if (upsert.ok) return;
    // An existing row can still be updated if the upsert trips a unique email/username constraint
    const patch = await send(`/rest/v1/user_profiles?id=eq.${encodeURIComponent(userId)}`, 'PATCH', profileUpdateBody);
    if (!patch.ok) errors.push(upsert.error);
  })();

  // 2. Every History workout as a workout_history row
  const syncedWorkoutIds = [];
  let failedWorkoutCount = 0;
  const historyTask = (async () => {
    const source = Array.isArray(historyToUpload) ? historyToUpload : payload.history;
    const rows = (Array.isArray(source) ? source : [])
      .filter(w => w && w.id)
      .map(w => toWorkoutHistoryRow(w, userId));
    for (let i = 0; i < rows.length; i += HISTORY_UPSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + HISTORY_UPSERT_BATCH_SIZE);
      const result = await send('/rest/v1/workout_history?on_conflict=id', 'POST', batch, 'resolution=merge-duplicates');
      if (result.ok) {
        batch.forEach(r => syncedWorkoutIds.push(r.id));
        continue;
      }
      if (result.error === 'NETWORK ERROR') {
        errors.push(result.error);
        failedWorkoutCount += rows.length - i;
        return;
      }
      // Find the row(s) the server rejects and upload the rest
      for (const row of batch) {
        const single = await send('/rest/v1/workout_history?on_conflict=id', 'POST', [row], 'resolution=merge-duplicates');
        if (single.ok) {
          syncedWorkoutIds.push(row.id);
        } else if (isForeignRow(single)) {
          foreignWorkoutIds.push(row.id);
        } else {
          failedWorkoutCount += 1;
          if (!errors.includes(single.error)) errors.push(single.error);
        }
      }
    }
  })();

  // 3. Saved & shared routines
  const routinesTask = (async () => {
    const allRoutines = [
      ...(Array.isArray(payload.savedRoutines) ? payload.savedRoutines.map(r => ({ ...r, isShared: false })) : []),
      ...(Array.isArray(payload.sharedRoutines) ? payload.sharedRoutines.map(r => ({ ...r, isShared: true })) : [])
    ].filter(r => r && r.key);
    if (allRoutines.length === 0) return;
    // One row per key (a key twice in one upsert is rejected); the last one wins
    const byKey = new Map();
    allRoutines.forEach(r => byKey.set(String(r.key), r));
    const rowOf = r => ({
      key: String(r.key),
      user_id: userId,
      author_username: r.author || user.username || 'athlete',
      label: r.label || 'Custom Routine',
      is_shared: Boolean(r.isShared),
      slots: canonicalExerciseData(Array.isArray(r.slots) ? r.slots : []),
      // The saved date (routines saved before dates were kept keep the server's own)
      ...(r.savedAt ? { updated_at: r.savedAt } : {})
    });
    // Every row in one request must have the same keys (PostgREST: "All object keys must match"), so routines with a
    // saved date and older ones without go up in separate requests
    const rows = [...byKey.values()].map(rowOf);
    const groups = [rows.filter(row => 'updated_at' in row), rows.filter(row => !('updated_at' in row))].filter(g => g.length > 0);
    for (const group of groups) {
      const result = await send('/rest/v1/routines?on_conflict=key', 'POST', group, 'resolution=merge-duplicates');
      if (result.ok) continue;
      if (result.error === 'NETWORK ERROR') {
        errors.push(result.error);
        return;
      }
      // Find the routine(s) the server rejects and upload the rest
      for (const row of group) {
        const single = await send('/rest/v1/routines?on_conflict=key', 'POST', [row], 'resolution=merge-duplicates');
        if (single.ok) continue;
        if (isForeignRow(single)) foreignRoutineKeys.push(row.key);
        else if (!errors.includes(single.error)) errors.push(single.error);
      }
    }
  })();

  await Promise.allSettled([profileTask, historyTask, routinesTask]);
  // Rows that belong to another account aren't failures: the caller removes them from this device
  return { ok: errors.length === 0, error: errors[0] || null, syncedWorkoutIds, failedWorkoutCount, foreignWorkoutIds, foreignRoutineKeys };
}

/**
 * Deletes History workouts from public.workout_history by id (RLS limits it to the athlete's own
 * rows). Returns { ok, error }.
 */
export async function deleteCloudWorkoutsByIds(user, workoutIds) {
  const ids = (workoutIds || []).map(String).filter(Boolean);
  if (!user || ids.length === 0) return { ok: true, error: null };
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return { ok: true, error: null };
  const accessToken = await getValidSupabaseAccessToken(user);
  if (!accessToken) return { ok: false, error: 'NO ACTIVE SESSION ON THIS DEVICE' };
  const list = ids.map(id => `"${id.replace(/"/g, '')}"`).join(',');
  try {
    const res = await fetch(`${baseUrl}/rest/v1/workout_history?id=in.(${encodeURIComponent(list)})`, {
      method: 'DELETE',
      headers: buildSupabaseHeaders(anonKey, accessToken)
    });
    if (!res.ok) return { ok: false, error: await describeFailedResponse(res) };
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: 'NETWORK ERROR' };
  }
}

const mapHistoryTableRow = h => ({
  id: h.id,
  title: h.title,
  loadedRoutineTitle: h.preset_used || 'MANUAL',
  startedAt: h.started_at,
  slots: canonicalExerciseData(Array.isArray(h.slots) ? h.slots : [])
});

const mapRoutineTableRow = r => ({
  key: r.key,
  label: r.label,
  author: r.author_username,
  isShared: Boolean(r.is_shared),
  savedAt: r.updated_at || r.created_at || null,
  slots: canonicalExerciseData(Array.isArray(r.slots) ? r.slots : [])
});

/**
 * Builds a friend/athlete object (PRs, history, shared routines) from a user_profiles row plus
 * optional workout_history / routines table rows. PRs merge stored 1RMs with estimates from every
 * logged set, so a profile shows records even when only part of the cloud data is available.
 */
function buildAthleteFromProfileRow(
  row,
  { tableHistory = [], sharedRoutines = null, allUserRoutines = [] } = {},
  friendshipId = null
) {
  const uname = (row?.username || '').trim() || (row?.email || '').split('@')[0];
  const email = (row?.email || '').trim().toLowerCase();
  const sharedFromSettings = Array.isArray(row?.settings?.sharedRoutines)
    ? row.settings.sharedRoutines
    : [];
  const shared = sharedRoutines && sharedRoutines.length ? sharedRoutines : sharedFromSettings;
  const settingsHistory = Array.isArray(row?.settings?.recentHistory) ? row.settings.recentHistory : [];
  const embeddedMetaHistory = Array.isArray(row?.settings?.yccih_cloud_state_v3?.history)
    ? row.settings.yccih_cloud_state_v3.history
    : [];
  const historyMap = new Map();
  [...tableHistory, ...settingsHistory, ...embeddedMetaHistory].forEach(w => {
    if (w && w.id && !historyMap.has(w.id)) {
      historyMap.set(w.id, w);
    }
  });
  const rowHistory = Array.from(historyMap.values()).sort(
    (a, b) => new Date(b?.startedAt || 0).getTime() - new Date(a?.startedAt || 0).getTime()
  );

  // PRs come only from logged History (no data = no PR), with the same scanner as the rest of the app: saved 1RM
  // numbers in settings / one_rep_maxes can be left over from old imports or removed workouts
  // Share stats with friends off (Social → Privacy): their history and PRs aren't used anywhere (profile, leaderboards,
  // ticker). On by default.
  const statsShared = row?.settings?.social?.shareStatsWithFriends !== false;
  const sharedHistory = statsShared ? rowHistory : [];
  // Their bodyweight-type lifts count their own bodyweight (unknown = as stored), never the viewer's
  const mergedPrs = withEngineBodyweight(Number(row?.settings?.bodyMetrics?.bodyweightLbs) || 0, () => buildHistoryPRs(sharedHistory));

  return {
    id: row?.id || `friend_${uname.toLowerCase()}`,
    friendshipId: friendshipId || undefined,
    username: uname,
    email,
    // Only when they share it (Social → Privacy; off unless turned on): null = not shared
    bodyweightLbs:
      row?.settings?.social?.shareBodyweightWithFriends === true
        ? Number(row?.settings?.bodyMetrics?.bodyweightLbs) || null
        : null,
    // For the BW leaderboards' ratios only (BIG 3 / BW, OHP / BW, MOST IMPROVED), whether or not they share it:
    // the boards show the ratio, never the bodyweight itself
    rankingBodyweightLbs: Number(row?.settings?.bodyMetrics?.bodyweightLbs) || null,
    // Their training goal (type, increment) and set preferences: the friend's session tab works out
    // suggested weights from these, their history and their PRs
    goals: row?.settings?.goals && typeof row.settings.goals === 'object' ? row.settings.goals : null,
    setPreferences: Array.isArray(row?.settings?.setPreferences) ? row.settings.setPreferences : null,
    profilePhoto: typeof row?.settings?.profilePhoto === 'string' ? row.settings.profilePhoto : null,
    statsShared,
    prs: mergedPrs,
    history: sharedHistory,
    sharedRoutines: shared
  };
}

/**
 * Deletes a routine from Supabase `public.routines` by its `key`.
 */
export async function deleteCloudRoutineByKey(user, routineKey) {
  if (!user || !routineKey) return false;
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return false;
  const accessToken = await getValidSupabaseAccessToken(user);
  if (!accessToken) return false;
  try {
    const res = await fetch(
      `${baseUrl}/rest/v1/routines?key=eq.${encodeURIComponent(String(routineKey))}`,
      {
        method: 'DELETE',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// SOCIAL: FRIENDSHIPS, SEARCH & FRIEND PROFILES
// Friendships live only in public.friendships, keyed by Supabase account ids. Row-level security
// (supabase_schema.sql) lets an athlete read a profile, history, or shared routines only when they
// own it or have an accepted friendship with its owner, so removing a friend revokes access both
// ways. Every call below uses the signed-in user's token.
// ============================================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = value => UUID_RE.test(String(value || ''));

const LEGACY_LOCAL_FRIEND_REQUESTS_KEY = 'yccih_local_friend_requests_v1';

// Device-only friend requests from older builds; friendships are server-side now.
function clearLegacyLocalFriendRequests() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEGACY_LOCAL_FRIEND_REQUESTS_KEY);
  } catch {
    // ignore storage error
  }
}

// Authenticated PostgREST request as the signed-in athlete. Returns { ok, status, data }.
async function authedRequest(user, path, { method = 'GET', body, prefer } = {}) {
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured || !user) return { ok: false, status: 0, data: null };
  const accessToken = await getValidSupabaseAccessToken(user);
  if (!accessToken) return { ok: false, status: 401, data: null };
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: buildSupabaseHeaders(anonKey, accessToken, {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(prefer ? { Prefer: prefer } : {})
      }),
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/**
 * Does this account already have anything saved on the server? true = any workout History, saved routine,
 * PR, saved equipment setup, or settings the app has saved (the app's pushes stamp `settings.updatedAt`;
 * the database's default settings for a new account don't have it). false = brand-new account.
 * null = couldn't tell (not configured / network / session problem).
 */
export async function accountHasSavedData(user) {
  if (!user || !isUuid(user.id)) return null;
  const id = encodeURIComponent(user.id);
  const [profile, history, routines] = await Promise.all([
    authedRequest(user, `/rest/v1/user_profiles?id=eq.${id}&select=settings,one_rep_maxes,gyms`),
    authedRequest(user, `/rest/v1/workout_history?user_id=eq.${id}&select=id&limit=1`),
    authedRequest(user, `/rest/v1/routines?user_id=eq.${id}&select=key&limit=1`)
  ]);
  if (!profile.ok || !history.ok || !routines.ok) return null;
  const row = Array.isArray(profile.data) ? profile.data[0] : null;
  // An unrecognised token reads as signed-out (200 + no rows): don't treat that as a new account
  if (!row) return null;
  const hasPrs = Object.values(row.one_rep_maxes || {}).some(v => Number(v) > 0);
  const hasGyms = Array.isArray(row.gyms) && row.gyms.length > 0;
  const hasSavedSettings = Boolean(row.settings && row.settings.updatedAt);
  const hasHistory = Array.isArray(history.data) && history.data.length > 0;
  const hasRoutines = Array.isArray(routines.data) && routines.data.length > 0;
  return hasHistory || hasRoutines || hasPrs || hasGyms || hasSavedSettings;
}

/**
 * Loads full profiles (PRs, history, shared routines) for the given friend ids. RLS returns only
 * athletes who are accepted friends. Returns null if the request failed (so callers keep cached data).
 */
async function fetchFriendProfiles(user, ids) {
  const cleanIds = Array.from(new Set((ids || []).filter(isUuid)));
  if (cleanIds.length === 0) return [];
  const inList = `(${cleanIds.map(encodeURIComponent).join(',')})`;
  const [profilesRes, historyRes, routinesRes] = await Promise.all([
    authedRequest(user, `/rest/v1/user_profiles?id=in.${inList}&select=id,username,email,one_rep_maxes,settings`),
    authedRequest(
      user,
      `/rest/v1/workout_history?user_id=in.${inList}&select=id,user_id,title,preset_used,started_at,slots&order=started_at.desc`
    ),
    authedRequest(
      user,
      `/rest/v1/routines?user_id=in.${inList}&is_shared=eq.true&select=key,user_id,author_username,label,is_shared,slots,created_at,updated_at`
    )
  ]);
  if (!profilesRes.ok || !Array.isArray(profilesRes.data)) return null;

  const historyByUser = new Map();
  (Array.isArray(historyRes.data) ? historyRes.data : []).forEach(h => {
    const list = historyByUser.get(h.user_id) || [];
    list.push(mapHistoryTableRow(h));
    historyByUser.set(h.user_id, list);
  });
  const routinesByUser = new Map();
  (Array.isArray(routinesRes.data) ? routinesRes.data : []).forEach(r => {
    const list = routinesByUser.get(r.user_id) || [];
    list.push(mapRoutineTableRow(r));
    routinesByUser.set(r.user_id, list);
  });

  return profilesRes.data.map(row =>
    buildAthleteFromProfileRow(row, {
      tableHistory: historyByUser.get(row.id) || [],
      sharedRoutines: routinesByUser.get(row.id) || null
    })
  );
}

/**
 * Fetches one friend's profile snapshot by account id. Returns null if they aren't (or are no
 * longer) an accepted friend, or the request failed.
 */
export async function fetchAthleteProfileSnapshot(athlete, currentUser = null) {
  if (!currentUser || !isUuid(athlete?.id)) return null;
  const profiles = await fetchFriendProfiles(currentUser, [athlete.id]);
  return Array.isArray(profiles) && profiles[0] ? profiles[0] : null;
}

/**
 * Reads the signed-in athlete's friendships from the server.
 * Returns { ok, friends, incomingRequests, outgoingRequests, profilesLoaded }:
 * - friends: accepted friendships with full profile data (when profilesLoaded)
 * - incomingRequests / outgoingRequests: pending requests ({ id, username, friendshipId })
 * When ok is false (offline, signed out), callers should keep what they already have.
 */
const PENDING_INVITER_KEY = 'yccih_pending_inviter_v1';

/**
 * Joined through an invite link (?invite_id=...): becomes friends with the inviter whatever email was
 * used to sign up (claim_invite_link). The stored invite is cleared once the server has answered.
 */
async function claimPendingInviteLink(user) {
  if (typeof window === 'undefined') return;
  let pending = null;
  try {
    pending = JSON.parse(window.localStorage.getItem(PENDING_INVITER_KEY) || 'null');
  } catch {
    pending = null;
  }
  if (!isUuid(pending?.inviteId)) return;
  const res = await authedRequest(user, '/rest/v1/rpc/claim_invite_link', {
    method: 'POST',
    body: { invite: pending.inviteId }
  });
  // 404 = the database function isn't installed yet: keep the invite and try again on the next sync
  if (res.status === 404 || res.status === 0 || res.status === 401) return;
  try {
    window.localStorage.removeItem(PENDING_INVITER_KEY);
  } catch {
    // ignore storage error
  }
}

export async function syncFriendshipsForUser(user) {
  const empty = { ok: false, friends: [], incomingRequests: [], outgoingRequests: [], profilesLoaded: false };
  if (!user || !isUuid(user.id)) return empty;
  // Invite link first (any email), then invites addressed to this account's email
  await claimPendingInviteLink(user);
  // Accept any email invites addressed to this account before reading friendships
  await authedRequest(user, '/rest/v1/rpc/claim_my_invites', { method: 'POST', body: {} });
  const res = await authedRequest(user, '/rest/v1/rpc/my_friendships', { method: 'POST', body: {} });
  if (!res.ok || !Array.isArray(res.data)) return empty;
  clearLegacyLocalFriendRequests();

  const rows = res.data.filter(r => isUuid(r?.other_id));
  const accepted = rows.filter(r => r.status === 'accepted');
  const profiles = await fetchFriendProfiles(
    user,
    accepted.map(r => r.other_id)
  );
  const profileById = new Map((profiles || []).map(p => [p.id, p]));

  const friends = accepted.map(r => {
    const profile = profileById.get(r.other_id);
    return {
      prs: {},
      history: [],
      sharedRoutines: [],
      ...(profile || {}),
      id: r.other_id,
      friendshipId: r.friendship_id,
      username: profile?.username || r.other_username || 'athlete'
    };
  });
  const toRequest = r => ({
    id: r.other_id,
    friendshipId: r.friendship_id,
    username: r.other_username || 'athlete',
    prs: {},
    sharedRoutines: []
  });

  return {
    ok: true,
    friends,
    incomingRequests: rows.filter(r => r.status === 'pending' && r.direction === 'incoming').map(toRequest),
    outgoingRequests: rows.filter(r => r.status === 'pending' && r.direction === 'outgoing').map(toRequest),
    profilesLoaded: profiles !== null
  };
}

/**
 * Sends a friend request to an athlete found through search. If they already sent you one, this
 * accepts it instead. Returns { ok, status: 'requested' | 'accepted' | 'exists' | 'error' }.
 */
export async function sendFriendRequestToAthlete(user, targetAthlete) {
  if (!user || !isUuid(user.id) || !isUuid(targetAthlete?.id) || user.id === targetAthlete.id) {
    return { ok: false, status: 'error' };
  }
  const existing = await authedRequest(user, '/rest/v1/rpc/my_friendships', { method: 'POST', body: {} });
  const row = Array.isArray(existing.data) ? existing.data.find(r => r.other_id === targetAthlete.id) : null;
  if (row) {
    if (row.status === 'pending' && row.direction === 'incoming') {
      const accepted = await acceptFriendRequestFromAthlete(user, { ...targetAthlete, friendshipId: row.friendship_id });
      return { ok: accepted, status: accepted ? 'accepted' : 'error' };
    }
    return { ok: true, status: 'exists' };
  }
  const res = await authedRequest(user, '/rest/v1/friendships', {
    method: 'POST',
    body: { requester_id: user.id, addressee_id: targetAthlete.id, status: 'pending' }
  });
  return { ok: res.ok, status: res.ok ? 'requested' : 'error' };
}

/**
 * Email invites this athlete sent that nobody has joined from yet (friend_invites still 'pending'; joining
 * through the link or with that email marks them 'accepted'). One entry per email, newest first.
 * Returns { ok, invites: [{ email, sentAt }] }; RLS only returns the signed-in athlete's own invites.
 */
export async function fetchMyPendingEmailInvites(user) {
  if (!user || !isUuid(user.id)) return { ok: false, invites: [] };
  const me = encodeURIComponent(user.id);
  const res = await authedRequest(
    user,
    `/rest/v1/friend_invites?select=invited_email,created_at&inviter_user_id=eq.${me}&status=eq.pending&order=created_at.desc&limit=100`
  );
  if (!res.ok || !Array.isArray(res.data)) return { ok: false, invites: [] };
  const byEmail = new Map();
  res.data.forEach(row => {
    const email = String(row?.invited_email || '').trim().toLowerCase();
    if (email && !byEmail.has(email)) byEmail.set(email, { email, sentAt: row.created_at || null });
  });
  return { ok: true, invites: Array.from(byEmail.values()) };
}

/**
 * A friend's friends for their profile page (friends_of_athlete RPC). Empty when that friend's
 * profile is private. Returns { ok, friends: [{ id, username, relation }] } where relation is
 * 'friends' | 'requested' | 'incoming' | 'none' (your own relationship with each).
 */
export async function fetchFriendsOfAthlete(user, targetAthleteId) {
  if (!user || !isUuid(targetAthleteId)) return { ok: false, friends: [] };
  const res = await authedRequest(user, '/rest/v1/rpc/friends_of_athlete', {
    method: 'POST',
    body: { target: targetAthleteId }
  });
  if (!res.ok || !Array.isArray(res.data)) return { ok: false, friends: [] };
  return {
    ok: true,
    friends: res.data
      .filter(r => isUuid(r?.athlete_id))
      .map(r => ({ id: r.athlete_id, username: r.username || 'athlete', relation: r.relation || 'none' }))
  };
}

// ---------------------------------------------------------------------------
// Live session sync (public.shared_sessions). One row per sync between two friends; both apps poll it.
// `structure` holds the shared exercise structure (see app/utils/sessionSync.js), never weights/reps.
// ---------------------------------------------------------------------------

const SHARED_SESSION_COLUMNS =
  'id,owner_id,participant_id,owner_username,status,structure,structure_version,updated_by,updated_at';

/** Invites an accepted friend to sync the current session. Returns { ok, row }. */
export async function createSessionSyncInvite(user, friendId, structure) {
  if (!user || !isUuid(user.id) || !isUuid(friendId) || friendId === user.id) return { ok: false, row: null };
  const res = await authedRequest(user, `/rest/v1/shared_sessions?select=${SHARED_SESSION_COLUMNS}`, {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      owner_id: user.id,
      participant_id: friendId,
      owner_username: user.username || null,
      status: 'pending',
      structure: structure || {},
      structure_version: 1,
      updated_by: user.id
    }
  });
  const row = Array.isArray(res.data) ? res.data[0] : null;
  return { ok: res.ok && Boolean(row), row, status: res.status };
}

/** Open syncs (pending or accepted) the athlete is part of, newest first. Returns { ok, rows }. */
export async function fetchMySessionSyncs(user) {
  if (!user || !isUuid(user.id)) return { ok: false, rows: [] };
  const me = encodeURIComponent(user.id);
  const res = await authedRequest(
    user,
    `/rest/v1/shared_sessions?select=${SHARED_SESSION_COLUMNS}&or=(owner_id.eq.${me},participant_id.eq.${me})&status=in.(pending,accepted)&order=updated_at.desc&limit=20`
  );
  return { ok: res.ok && Array.isArray(res.data), rows: Array.isArray(res.data) ? res.data : [], status: res.status };
}

/** One sync row by id (any status). Returns { ok, row }. */
export async function fetchSessionSync(user, syncId) {
  if (!user || !isUuid(syncId)) return { ok: false, row: null };
  const res = await authedRequest(
    user,
    `/rest/v1/shared_sessions?select=${SHARED_SESSION_COLUMNS}&id=eq.${encodeURIComponent(syncId)}`
  );
  const row = Array.isArray(res.data) ? res.data[0] || null : null;
  return { ok: res.ok, row, status: res.status };
}

/** Patches a sync row (status, structure, structure_version, updated_by). Returns { ok, row }. */
export async function updateSessionSync(user, syncId, changes) {
  if (!user || !isUuid(syncId)) return { ok: false, row: null };
  const res = await authedRequest(
    user,
    `/rest/v1/shared_sessions?id=eq.${encodeURIComponent(syncId)}&select=${SHARED_SESSION_COLUMNS}`,
    { method: 'PATCH', prefer: 'return=representation', body: { ...changes, updated_by: user.id } }
  );
  const row = Array.isArray(res.data) ? res.data[0] || null : null;
  return { ok: res.ok && Boolean(row), row, status: res.status };
}

/**
 * Syncs (any status) whose row carries History updates — exercises one athlete added to their saved copy of the
 * synced workout (structure.historyUpdates, see app/utils/syncedHistory.js). Returns { ok, rows }.
 */
export async function fetchSyncsWithHistoryUpdates(user) {
  if (!user || !isUuid(user.id)) return { ok: false, rows: [] };
  const me = encodeURIComponent(user.id);
  const res = await authedRequest(
    user,
    `/rest/v1/shared_sessions?select=${SHARED_SESSION_COLUMNS}&or=(owner_id.eq.${me},participant_id.eq.${me})&structure->historyUpdates=not.is.null&order=updated_at.desc&limit=30`
  );
  return { ok: res.ok && Array.isArray(res.data), rows: Array.isArray(res.data) ? res.data : [], status: res.status };
}

/**
 * Tells the friend in a sync that exercises were added to this athlete's saved copy of the synced workout:
 * reads the row and writes structure.historyUpdates[myId] = buildUpdate(previousUpdate) (the rest of the row's
 * structure is kept). Returns { ok }.
 */
export async function postSyncHistoryUpdate(user, syncId, buildUpdate) {
  if (!user || !isUuid(user.id) || !isUuid(syncId) || typeof buildUpdate !== 'function') return { ok: false };
  const current = await fetchSessionSync(user, syncId);
  if (!current.ok || !current.row) return { ok: false };
  const structure = current.row.structure && typeof current.row.structure === 'object' ? current.row.structure : {};
  const updates = structure.historyUpdates && typeof structure.historyUpdates === 'object' ? structure.historyUpdates : {};
  const next = buildUpdate(updates[user.id] || null);
  const res = await updateSessionSync(user, syncId, {
    structure: { ...structure, historyUpdates: { ...updates, [user.id]: next } }
  });
  return { ok: res.ok };
}

/** Accepts or declines an incoming sync invite. */
export const respondToSessionSync = (user, syncId, accept) =>
  updateSessionSync(user, syncId, { status: accept ? 'accepted' : 'declined' });

/** Ends a sync (either athlete); the other app notices on its next poll. */
export const endSessionSync = (user, syncId) => updateSessionSync(user, syncId, { status: 'ended' });

/** Accepts an incoming friend request (by its friendship row id). */
export async function acceptFriendRequestFromAthlete(user, requesterAthlete) {
  if (!user || !isUuid(requesterAthlete?.friendshipId)) return false;
  const res = await authedRequest(
    user,
    `/rest/v1/friendships?id=eq.${encodeURIComponent(requesterAthlete.friendshipId)}`,
    { method: 'PATCH', body: { status: 'accepted' } }
  );
  return res.ok;
}

/**
 * Removes a friendship (or cancels/declines a request) with an athlete, in either direction.
 * Once the row is gone neither athlete can read the other's profile, history, or routines.
 */
export async function removeFriendshipWithAthlete(user, athlete) {
  if (!user || !isUuid(user.id) || !isUuid(athlete?.id)) return false;
  const a = encodeURIComponent(user.id);
  const b = encodeURIComponent(athlete.id);
  const res = await authedRequest(
    user,
    `/rest/v1/friendships?or=(and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a}))`,
    { method: 'DELETE' }
  );
  return res.ok;
}

/**
 * Searches athletes by partial username or exact email. Results contain only id + username;
 * emails and stats of non-friends are never returned.
 * Returns { ok, results, error } so a failed search isn't shown as "no athletes found".
 */
export async function searchAthletesByQuery(query, currentUser = null) {
  const q = (query || '').trim();
  if (!currentUser) return { ok: false, results: [], error: 'signed_out' };
  if (q.length < 2) return { ok: true, results: [] };
  const res = await authedRequest(currentUser, '/rest/v1/rpc/search_athletes', { method: 'POST', body: { q } });
  if (!res.ok || !Array.isArray(res.data)) {
    return { ok: false, results: [], error: res.status === 401 ? 'session' : 'network' };
  }
  return {
    ok: true,
    results: res.data
      .filter(row => isUuid(row?.id) && row.id !== currentUser.id)
      .map(row => ({ id: row.id, username: row.username || 'athlete', prs: {}, sharedRoutines: [] }))
  };
}

/**
 * Permanently deletes the signed-in athlete's account: the delete_my_account database function
 * removes their profile, workout history, routines, friendships, invites and sign-in account.
 * On success this device also forgets the session and the account. Returns { ok, error }.
 */
export async function deleteMyAccount(user) {
  if (!user?.email) return { ok: false, error: 'NOT SIGNED IN.' };
  const { isConfigured } = getSupabaseConfig();

  if (isConfigured) {
    if (!isUuid(user.id)) return { ok: false, error: 'SIGN IN AGAIN, THEN RETRY.' };
    const res = await authedRequest(user, '/rest/v1/rpc/delete_my_account', { method: 'POST', body: {} });
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 401
            ? 'YOUR SESSION EXPIRED. SIGN IN AGAIN, THEN RETRY.'
            : 'COULD NOT DELETE YOUR ACCOUNT. CHECK YOUR CONNECTION AND TRY AGAIN.'
      };
    }
  }

  clearSupabaseSessionTokens();
  if (typeof window !== 'undefined') {
    try {
      const accounts = getLocalRegisteredAccounts();
      delete accounts[user.email.trim().toLowerCase()];
      window.localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {
      // ignore storage errors
    }
  }
  return { ok: true };
}

// ============================================================================
// Routines sent straight to a friend (public.routine_shares; migration 2026-11-12_routine_shares.sql)
// ============================================================================

const ROUTINE_SHARE_COLUMNS = 'id,sender_id,recipient_id,sender_username,label,routine,status,created_at,answered_at';

/** What a sent routine carries: its name and exercises (never the sender's done marks or locks). */
const routinePayloadForShare = routine => ({
  label: routine?.label || 'Routine',
  // One send to several friends shares a batch id (the sender's SHARED tab shows it as one row)
  ...(routine?.batchId ? { batchId: String(routine.batchId) } : {}),
  slots: (Array.isArray(routine?.slots) ? routine.slots : []).map(slot => {
    // Routines carry no weights (the recipient's app works them out from reps and effort); older saved routines may
    // still have them, so they are dropped here too
    const clean = sets =>
      Array.isArray(sets)
        ? sets.map(st => (st ? { ...st, completed: false, weight: 0, lockWeight: false, lastWeight: undefined } : st))
        : sets;
    return {
      ...slot,
      sets: clean(slot.sets),
      ...(Array.isArray(slot.secondarySets) ? { secondarySets: clean(slot.secondarySets) } : {}),
      ...(Array.isArray(slot.supersetSetsByExercise) ? { supersetSetsByExercise: slot.supersetSetsByExercise.map(clean) } : {})
    };
  })
});

/** Sends a copy of a routine to an accepted friend. Returns { ok, row, error }. */
export async function sendRoutineToFriend(user, friendId, routine) {
  if (!user || !isUuid(user.id) || !isUuid(friendId) || friendId === user.id) return { ok: false, row: null, error: 'NOT SIGNED IN' };
  const payload = routinePayloadForShare(routine);
  if (payload.slots.length === 0) return { ok: false, row: null, error: 'EMPTY ROUTINE' };
  const res = await authedRequest(user, `/rest/v1/routine_shares?select=${ROUTINE_SHARE_COLUMNS}`, {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      sender_id: user.id,
      recipient_id: friendId,
      sender_username: user.username || null,
      label: payload.label,
      routine: payload,
      status: 'pending'
    }
  });
  const row = Array.isArray(res.data) ? res.data[0] : null;
  const error = res.ok ? null : res.status === 404 ? 'NOT SET UP ON THE SERVER YET' : res.data?.message || `SERVER ${res.status}`;
  return { ok: res.ok && Boolean(row), row, error, status: res.status };
}

/** Routines friends sent this athlete that are still waiting for an answer, oldest first. Returns { ok, rows }. */
export async function fetchIncomingRoutineShares(user) {
  if (!user || !isUuid(user.id)) return { ok: false, rows: [] };
  const me = encodeURIComponent(user.id);
  const res = await authedRequest(
    user,
    `/rest/v1/routine_shares?select=${ROUTINE_SHARE_COLUMNS}&recipient_id=eq.${me}&status=eq.pending&order=created_at.asc&limit=20`
  );
  const rows = Array.isArray(res.data)
    ? res.data.map(row => ({
        ...row,
        routine: {
          ...(row.routine || {}),
          slots: canonicalExerciseData(Array.isArray(row.routine?.slots) ? row.routine.slots : [])
        }
      }))
    : [];
  return { ok: res.ok && Array.isArray(res.data), rows, status: res.status };
}

/** The recipient's answer to a sent routine: 'saved' | 'loaded' | 'dismissed'. Returns { ok }. */
export async function answerRoutineShare(user, shareId, status) {
  if (!user || !isUuid(user.id) || !isUuid(shareId) || !['saved', 'loaded', 'dismissed'].includes(status)) return { ok: false };
  const res = await authedRequest(user, `/rest/v1/routine_shares?id=eq.${encodeURIComponent(shareId)}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: { status }
  });
  return { ok: res.ok, status: res.status };
}

/** Routines this athlete sent to friends (any answer), newest first: the Routines page's SHARED tab. Returns { ok, rows }. */
export async function fetchSentRoutineShares(user) {
  if (!user || !isUuid(user.id)) return { ok: false, rows: [] };
  const me = encodeURIComponent(user.id);
  const res = await authedRequest(
    user,
    `/rest/v1/routine_shares?select=${ROUTINE_SHARE_COLUMNS}&sender_id=eq.${me}&order=created_at.desc&limit=60`
  );
  const rows = Array.isArray(res.data)
    ? res.data.map(row => ({
        ...row,
        routine: {
          ...(row.routine || {}),
          slots: canonicalExerciseData(Array.isArray(row.routine?.slots) ? row.routine.slots : [])
        }
      }))
    : [];
  return { ok: res.ok && Array.isArray(res.data), rows, status: res.status };
}

/** Withdraws routines this athlete sent (deletes the rows; RLS lets either athlete delete). Returns { ok }. */
export async function deleteSentRoutineShares(user, shareIds = []) {
  const ids = (shareIds || []).filter(isUuid);
  if (!user || !isUuid(user.id) || ids.length === 0) return { ok: false };
  const res = await authedRequest(user, `/rest/v1/routine_shares?id=in.(${ids.map(encodeURIComponent).join(',')})&sender_id=eq.${encodeURIComponent(user.id)}`, {
    method: 'DELETE',
    prefer: 'return=minimal'
  });
  return { ok: res.ok, status: res.status };
}
