// ============================================================================
// SUPABASE & LOCAL ACCOUNT AUTHENTICATION ENGINE
// ============================================================================

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

export const getLocalRegisteredAccounts = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
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
      password: account.password,
      createdAt: existing[key]?.createdAt || account.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    window.localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(existing));
  } catch {
    // ignore storage errors
  }
};

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

/**
 * Registers a new user account via Supabase Auth (and local registry fallback).
 * Strictly enforces beta code, email, username, and password validation.
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
    }

    saveLocalRegisteredAccount({
      ...createdUser,
      password: cleanPass
    });

    return {
      user: createdUser,
      requiresEmailConfirmation: !accessToken
    };
  }

  // Fallback local registry when Supabase env vars are not present
  const existing = getLocalRegisteredAccounts();
  if (existing[cleanEmail]) {
    throw new Error('AN ACCOUNT WITH THIS EMAIL ALREADY EXISTS. PLEASE SIGN IN ABOVE.');
  }

  const createdUser = {
    id: `usr_${Date.now()}`,
    username: cleanUser,
    email: cleanEmail
  };

  saveLocalRegisteredAccount({
    ...createdUser,
    password: cleanPass
  });

  return {
    user: createdUser,
    requiresEmailConfirmation: false
  };
}

/**
 * Authenticates an existing user account via Supabase Auth (or local registry).
 * Supports signing in with EITHER Username OR Email Address in a single field.
 * Strictly rejects sign-in if the account does not exist or password is wrong.
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
  let resolvedUsernameFromLookup = localMatch?.username || (!rawIdentifier.includes('@') ? rawIdentifier : '');

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

  // If password was reset locally on this device, allow immediate sign-in with the updated local password
  if (localMatch && localMatch.passwordResetLocally && localMatch.password === cleanPass) {
    return {
      user: {
        id: localMatch.id,
        username: localMatch.username || resolvedUsernameFromLookup || localMatch.email.split('@')[0],
        email: localMatch.email
      }
    };
  }

  if (isConfigured && resolvedEmail) {
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

      saveLocalRegisteredAccount({
        ...signedInUser,
        password: cleanPass
      });

      return { user: signedInUser };
    }

    // Handle case where Supabase has 'Confirm email' enabled and user registered on this device
    const errCode = data?.error_code || '';
    const errMsg = String(data?.msg || data?.error_description || data?.message || '');

    if (
      (errCode === 'email_not_confirmed' || errMsg.toLowerCase().includes('email not confirmed')) &&
      localMatch &&
      localMatch.password === cleanPass
    ) {
      return {
        user: {
          id: localMatch.id,
          username: localMatch.username || resolvedUsernameFromLookup || localMatch.email.split('@')[0],
          email: localMatch.email
        }
      };
    }

    if (errCode === 'email_not_confirmed' || errMsg.toLowerCase().includes('email not confirmed')) {
      throw new Error(
        'EMAIL NOT CONFIRMED YET. CHECK YOUR INBOX OR DISABLE "CONFIRM EMAIL" IN SUPABASE AUTH SETTINGS.'
      );
    }

    throw new Error(
      'ACCOUNT NOT FOUND OR INVALID PASSWORD. IF YOU FORGOT YOUR PASSWORD, USE "FORGOT PASSWORD?" BELOW.'
    );
  }

  // Fallback local account verification
  if (!localMatch || localMatch.password !== cleanPass) {
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
 * Completes a password update using a Supabase recovery access_token from the URL redirect hash.
 */
export async function completePasswordRecoveryWithToken({ accessToken, newPassword }) {
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
      refreshToken: null
    });
    saveLocalRegisteredAccount({
      ...updatedUser,
      password: cleanPass
    });
  }

  return { user: updatedUser };
}

/**
 * Resets an existing account's password directly using Email + Username + Beta Tester Code.
 * Updates the local registered account registry immediately (and logs the user in).
 */
export async function resetPasswordWithBetaCode({ email, username, betaCode, newPassword }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUser = (username || '').trim();
  const cleanCode = (betaCode || '').trim().toLowerCase();
  const cleanPass = newPassword || '';

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('PLEASE ENTER YOUR REGISTERED EMAIL ADDRESS.');
  }
  if (!cleanUser) {
    throw new Error('PLEASE ENTER YOUR ACCOUNT USERNAME TO VERIFY OWNERSHIP.');
  }
  if (cleanCode !== BETA_ACCESS_CODE) {
    throw new Error('INVALID BETA TESTER CODE. ACCESS DENIED.');
  }
  if (!cleanPass || cleanPass.length < 6) {
    throw new Error('NEW PASSWORD MUST BE AT LEAST 6 CHARACTERS.');
  }

  const existing = getLocalRegisteredAccounts();
  const matched = existing[cleanEmail];

  if (!matched) {
    throw new Error(
      'ACCOUNT NOT FOUND IN LOCAL REGISTRY ON THIS DEVICE. USE "SEND RECOVERY EMAIL LINK" ABOVE TO RESET VIA EMAIL.'
    );
  }

  if ((matched.username || '').trim().toLowerCase() !== cleanUser.toLowerCase()) {
    throw new Error('USERNAME DOES NOT MATCH THE REGISTERED ACCOUNT FOR THIS EMAIL.');
  }

  const updatedAccount = {
    ...matched,
    password: cleanPass,
    passwordResetLocally: true,
    updatedAt: new Date().toISOString()
  };

  existing[cleanEmail] = updatedAccount;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(existing));
  }

  return {
    user: {
      id: updatedAccount.id,
      username: updatedAccount.username,
      email: updatedAccount.email
    }
  };
}

// ============================================================================
// CROSS-DEVICE SUPABASE CLOUD SYNC ENGINE (PROFILES, HISTORY, ROUTINES & METADATA)
// ============================================================================

let inFlightTokenRefreshPromise = null;

export async function getValidSupabaseAccessToken(user) {
  if (!user || (!user.email && !user.username)) return null;
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  const cleanEmail = (user.email || '').trim().toLowerCase();
  const cleanUsername = (user.username || '').trim().toLowerCase();
  const saved = getSavedSupabaseSessionTokens(cleanEmail);

  // Use existing token if saved within the last 45 minutes
  if (saved?.accessToken && Date.now() - (saved.savedAt || 0) < 45 * 60 * 1000) {
    return saved.accessToken;
  }

  if (inFlightTokenRefreshPromise) {
    return inFlightTokenRefreshPromise;
  }

  inFlightTokenRefreshPromise = (async () => {
    try {
      // Try refreshing via refresh_token if available
      if (saved?.refreshToken) {
        try {
          const res = await fetch(`${baseUrl}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: buildSupabaseHeaders(anonKey, null, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ refresh_token: saved.refreshToken })
          });
          if (res.ok) {
            const data = await res.json();
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
        } catch {
          // fall through to silent password re-auth
        }
      }

      // Fallback: silent token refresh using locally cached credentials on this device
      const localAccounts = getLocalRegisteredAccounts();
      const localMatch =
        (cleanEmail && localAccounts[cleanEmail]) ||
        Object.values(localAccounts).find(
          acc =>
            (cleanEmail && (acc?.email || '').trim().toLowerCase() === cleanEmail) ||
            (cleanUsername && (acc?.username || '').trim().toLowerCase() === cleanUsername)
        ) ||
        null;
      const loginEmail = cleanEmail || localMatch?.email || '';
      if (localMatch?.password && loginEmail) {
        try {
          const res = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: buildSupabaseHeaders(anonKey, null, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ email: loginEmail, password: localMatch.password })
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.access_token) {
              saveSupabaseSessionTokens({
                userId: data.user?.id || user.id,
                email: loginEmail,
                accessToken: data.access_token,
                refreshToken: data.refresh_token || null
              });
              return data.access_token;
            }
          }
        } catch {
          // ignore
        }
      }

      // Only return the cached accessToken if it is still within the 55-minute JWT validity window;
      // otherwise return null so public queries can fall back cleanly to anonKey instead of failing with 401 JWT expired.
      if (saved?.accessToken && Date.now() - (saved.savedAt || 0) < 55 * 60 * 1000) {
        return saved.accessToken;
      }
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

  const accessToken = await getValidSupabaseAccessToken(user);
  if (!accessToken) return null;

  const headers = buildSupabaseHeaders(anonKey, accessToken);

  let metadataSnapshot = null;
  let profileRow = null;
  let historyRows = null;
  let routineRows = null;

  await Promise.allSettled([
    fetch(`${baseUrl}/auth/v1/user`, { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(u => {
        if (u?.user_metadata?.yccih_cloud_state_v3) {
          metadataSnapshot = u.user_metadata.yccih_cloud_state_v3;
        }
      }),
    user.id
      ? fetch(
          `${baseUrl}/rest/v1/user_profiles?id=eq.${encodeURIComponent(user.id)}&select=id,username,email,one_rep_maxes,settings`,
          { headers }
        )
          .then(r => (r.ok ? r.json() : null))
          .then(rows => {
            if (Array.isArray(rows) && rows[0]) profileRow = rows[0];
          })
      : Promise.resolve(),
    user.id
      ? fetch(
          `${baseUrl}/rest/v1/workout_history?user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,title,preset_used,started_at,slots&order=started_at.desc`,
          { headers }
        )
          .then(r => (r.ok ? r.json() : null))
          .then(rows => {
            if (Array.isArray(rows)) historyRows = rows;
          })
      : Promise.resolve(),
    user.id
      ? fetch(
          `${baseUrl}/rest/v1/routines?user_id=eq.${encodeURIComponent(user.id)}&select=key,user_id,author_username,label,is_shared,slots`,
          { headers }
        )
          .then(r => (r.ok ? r.json() : null))
          .then(rows => {
            if (Array.isArray(rows)) routineRows = rows;
          })
      : Promise.resolve()
  ]);

  if (!metadataSnapshot && !profileRow && !historyRows && !routineRows) {
    return null;
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
        slots: Array.isArray(row.slots) ? row.slots : []
      }))
    : [];

  const mappedSavedRoutinesFromTable = Array.isArray(routineRows)
    ? routineRows
        .filter(r => !r.is_shared)
        .map(r => ({
          key: r.key,
          label: r.label,
          author: r.author_username || user.username,
          slots: Array.isArray(r.slots) ? r.slots : []
        }))
    : [];

  const mappedSharedRoutinesFromTable = Array.isArray(routineRows)
    ? routineRows
        .filter(r => r.is_shared)
        .map(r => ({
          key: r.key,
          label: r.label,
          author: r.author_username || user.username,
          slots: Array.isArray(r.slots) ? r.slots : []
        }))
    : [];

  return {
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

/**
 * Pushes the signed-in user's state to Supabase Cloud (both relational tables and Auth user_metadata snapshot).
 */
export async function pushCloudStateForUser(user, payload) {
  if (!user || (!user.email && !user.username) || !payload) return false;
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return false;

  const accessToken = await getValidSupabaseAccessToken(user);

  const jsonHeaders = buildSupabaseHeaders(anonKey, accessToken, {
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates'
  });

  const patchHeaders = buildSupabaseHeaders(anonKey, accessToken, {
    'Content-Type': 'application/json'
  });

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let resolvedUserId = uuidRegex.test(String(user.id || '')) ? String(user.id) : null;

  const tasks = [];

  if (accessToken) {
    // 1. Sync compact cloud state snapshot into Supabase Auth user_metadata
    tasks.push(
      fetch(`${baseUrl}/auth/v1/user`, {
        method: 'PUT',
        headers: buildSupabaseHeaders(anonKey, accessToken, {
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          data: {
            username: user.username,
            // Friends' data is never stored in your account; friendships come from public.friendships
            yccih_cloud_state_v3: { ...payload, friendsList: [], pendingIncomingRequests: [] }
          }
        })
      })
    );
  }

  // If user.id in local state is not a UUID yet, look up the UUID from user_profiles by email or username
  if (!resolvedUserId) {
    try {
      const cleanEmail = (user.email || '').trim().toLowerCase();
      const cleanUname = (user.username || '').trim();
      const filter = cleanEmail
        ? `email=ilike.${encodeURIComponent(cleanEmail)}`
        : `username=ilike.${encodeURIComponent(cleanUname)}`;
      const lookupRes = await fetch(`${baseUrl}/rest/v1/user_profiles?${filter}&select=id`, {
        headers: buildSupabaseHeaders(anonKey, accessToken)
      });
      if (lookupRes.ok) {
        const rows = await lookupRes.json();
        if (Array.isArray(rows) && rows[0]?.id && uuidRegex.test(String(rows[0].id))) {
          resolvedUserId = String(rows[0].id);
        }
      }
    } catch {
      // ignore lookup error
    }
  }

  const profileSettingsObj = {
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
  };

  // Send only guaranteed core columns (one_rep_maxes, settings) so PostgREST never rejects with PGRST204
  const profileUpdateBody = {
    one_rep_maxes: payload.oneRepMaxes || {},
    settings: profileSettingsObj
  };

  if (resolvedUserId) {
    // 2a. Upsert user_profiles row by primary key (id)
    tasks.push(
      fetch(`${baseUrl}/rest/v1/user_profiles?on_conflict=id`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          id: resolvedUserId,
          email: (user.email || '').trim().toLowerCase() || undefined,
          username: user.username || undefined,
          ...profileUpdateBody
        })
      })
    );
    // 2b. Also PATCH by id so existing rows always update even if unique email/username constraints exist
    tasks.push(
      fetch(`${baseUrl}/rest/v1/user_profiles?id=eq.${encodeURIComponent(resolvedUserId)}`, {
        method: 'PATCH',
        headers: patchHeaders,
        body: JSON.stringify(profileUpdateBody)
      })
    );

    // 3. Sync workout_history rows (using guaranteed core columns)
    if (Array.isArray(payload.history) && payload.history.length > 0) {
      const historyRows = payload.history.map(w => ({
        id: String(w.id),
        user_id: resolvedUserId,
        title: w.title || 'Workout Session',
        preset_used: w.loadedRoutineTitle || 'MANUAL',
        started_at: w.startedAt || new Date().toISOString(),
        slots: Array.isArray(w.slots) ? w.slots : []
      }));
      tasks.push(
        fetch(`${baseUrl}/rest/v1/workout_history?on_conflict=id`, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(historyRows)
        })
      );
    }

    // 4. Sync routines rows (saved & shared, using guaranteed core columns)
    const allRoutines = [
      ...(Array.isArray(payload.savedRoutines)
        ? payload.savedRoutines.map(r => ({ ...r, isShared: false }))
        : []),
      ...(Array.isArray(payload.sharedRoutines)
        ? payload.sharedRoutines.map(r => ({ ...r, isShared: true }))
        : [])
    ];
    if (allRoutines.length > 0) {
      const routinePayload = allRoutines.map(r => ({
        key: String(r.key),
        user_id: resolvedUserId,
        author_username: r.author || user.username || 'athlete',
        label: r.label || 'Custom Routine',
        is_shared: Boolean(r.isShared),
        slots: Array.isArray(r.slots) ? r.slots : []
      }));
      tasks.push(
        fetch(`${baseUrl}/rest/v1/routines?on_conflict=key`, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(routinePayload)
        })
      );
    }
  } else if (user.email || user.username) {
    const cleanEmail = (user.email || '').trim().toLowerCase();
    const filter = cleanEmail
      ? `email=ilike.${encodeURIComponent(cleanEmail)}`
      : `username=ilike.${encodeURIComponent((user.username || '').trim())}`;
    tasks.push(
      fetch(`${baseUrl}/rest/v1/user_profiles?${filter}`, {
        method: 'PATCH',
        headers: patchHeaders,
        body: JSON.stringify(profileUpdateBody)
      })
    );
  }

  await Promise.allSettled(tasks);
  return true;
}

const scanSetArrayIntoPrs = (exId, setsArr, targetPrs) => {
  if (!exId || !Array.isArray(setsArr)) return;
  setsArr.forEach(st => {
    const sw = Number(st?.weight) || 0;
    if (sw <= 0) return;
    const sr = Math.max(1, Number(st?.reps) || 1);
    const est = sr === 1 ? sw : Math.round(sw * (1 + sr / 30));
    if (est > (Number(targetPrs[exId]) || 0)) {
      targetPrs[exId] = est;
    }
  });
};

const scanSlotsIntoPrs = (slotsList, targetPrs) => {
  (Array.isArray(slotsList) ? slotsList : []).forEach(slot => {
    if (slot?.exerciseId) {
      scanSetArrayIntoPrs(slot.exerciseId, slot?.sets, targetPrs);
    }
    if (slot?.secondaryExerciseId) {
      scanSetArrayIntoPrs(slot.secondaryExerciseId, slot?.secondarySets, targetPrs);
    }
    if (Array.isArray(slot?.supersetExerciseIds) && Array.isArray(slot?.supersetSetsByExercise)) {
      slot.supersetExerciseIds.forEach((supExId, idx) => {
        scanSetArrayIntoPrs(supExId, slot.supersetSetsByExercise[idx], targetPrs);
      });
    }
  });
};

const mapHistoryTableRow = h => ({
  id: h.id,
  title: h.title,
  loadedRoutineTitle: h.preset_used || 'MANUAL',
  startedAt: h.started_at,
  slots: Array.isArray(h.slots) ? h.slots : []
});

const mapRoutineTableRow = r => ({
  key: r.key,
  label: r.label,
  author: r.author_username,
  isShared: Boolean(r.is_shared),
  slots: Array.isArray(r.slots) ? r.slots : []
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

  const mergedPrs = {};
  const mergePrSource = src => {
    if (!src || typeof src !== 'object') return;
    Object.entries(src).forEach(([k, v]) => {
      const num = Number(v) || 0;
      if (num > (Number(mergedPrs[k]) || 0)) {
        mergedPrs[k] = num;
      }
    });
  };

  mergePrSource(row?.one_rep_maxes);
  mergePrSource(row?.settings?.oneRepMaxes);
  mergePrSource(row?.settings?.prs);
  mergePrSource(row?.settings?.yccih_cloud_state_v3?.oneRepMaxes);

  rowHistory.forEach(w => scanSlotsIntoPrs(w?.slots, mergedPrs));

  return {
    id: row?.id || `friend_${uname.toLowerCase()}`,
    friendshipId: friendshipId || undefined,
    username: uname,
    email,
    bodyweightLbs: row?.settings?.bodyMetrics?.bodyweightLbs || 200,
    prs: mergedPrs,
    history: rowHistory,
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
      `/rest/v1/routines?user_id=in.${inList}&is_shared=eq.true&select=key,user_id,author_username,label,is_shared,slots`
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
export async function syncFriendshipsForUser(user) {
  const empty = { ok: false, friends: [], incomingRequests: [], outgoingRequests: [], profilesLoaded: false };
  if (!user || !isUuid(user.id)) return empty;
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
 */
export async function searchAthletesByQuery(query, currentUser = null) {
  const q = (query || '').trim();
  if (q.length < 2 || !currentUser) return [];
  const res = await authedRequest(currentUser, '/rest/v1/rpc/search_athletes', { method: 'POST', body: { q } });
  if (!res.ok || !Array.isArray(res.data)) return [];
  return res.data
    .filter(row => isUuid(row?.id) && row.id !== currentUser.id)
    .map(row => ({ id: row.id, username: row.username || 'athlete', prs: {}, sharedRoutines: [] }));
}
