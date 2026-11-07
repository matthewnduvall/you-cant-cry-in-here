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
      const lookupRes = await fetch(
        `${baseUrl}/rest/v1/user_profiles?username=ilike.${encodeURIComponent(rawIdentifier)}&select=email,username`,
        {
          headers: buildSupabaseHeaders(anonKey)
        }
      );
      if (lookupRes.ok) {
        const rows = await lookupRes.json();
        if (Array.isArray(rows) && rows[0]?.email) {
          resolvedEmail = rows[0].email.trim().toLowerCase();
          if (rows[0].username) resolvedUsernameFromLookup = rows[0].username;
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
            yccih_cloud_state_v3: payload
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
    friendsList: payload.friendsList || [],
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

const LOCAL_FRIEND_REQUESTS_KEY = 'yccih_local_friend_requests_v1';

function getLocalFriendRequests() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_FRIEND_REQUESTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalFriendRequests(list) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_FRIEND_REQUESTS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch {
    // ignore storage error
  }
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

/**
 * Sends a friend request from `user` to `targetAthlete`.
 * Stores the pending request in Supabase `public.friendships` (and local fallback) so the recipient sees it in INCOMING REQUESTS.
 */
export async function sendFriendRequestToAthlete(user, targetAthlete) {
  if (!user || !targetAthlete) return false;
  const requesterUsername = (user.username || '').trim();
  const requesterEmail = (user.email || '').trim().toLowerCase();
  const addresseeUsername = (targetAthlete.username || '').trim();
  const addresseeEmail = (targetAthlete.email || '').trim().toLowerCase();

  // 1. Save in local requests store
  const localReqs = getLocalFriendRequests();
  const existsIdx = localReqs.findIndex(
    r =>
      ((r.requesterEmail && r.requesterEmail === requesterEmail) ||
        (r.requesterUsername && r.requesterUsername.toLowerCase() === requesterUsername.toLowerCase())) &&
      ((r.addresseeEmail && r.addresseeEmail === addresseeEmail) ||
        (r.addresseeUsername && r.addresseeUsername.toLowerCase() === addresseeUsername.toLowerCase()))
  );
  const newEntry = {
    id: `freq_${Date.now()}`,
    requesterId: user.id,
    requesterUsername,
    requesterEmail,
    addresseeId: targetAthlete.id,
    addresseeUsername,
    addresseeEmail,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  if (existsIdx >= 0) {
    localReqs[existsIdx] = { ...localReqs[existsIdx], ...newEntry };
  } else {
    localReqs.push(newEntry);
  }
  saveLocalFriendRequests(localReqs);

  // 2. Sync to Supabase public.friendships if configured
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (isConfigured) {
    const accessToken = await getValidSupabaseAccessToken(user);
    const headers = buildSupabaseHeaders(anonKey, accessToken, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    });

    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let requesterUuid = uuidRegex.test(String(user.id || '')) ? String(user.id) : null;
      let addresseeUuid = uuidRegex.test(String(targetAthlete.id || '')) ? String(targetAthlete.id) : null;

      if (!requesterUuid || !addresseeUuid) {
        const profRes = await fetch(
          `${baseUrl}/rest/v1/user_profiles?select=id,username,email`,
          { headers: buildSupabaseHeaders(anonKey, accessToken) }
        );
        if (profRes.ok) {
          const rows = await profRes.json();
          if (Array.isArray(rows)) {
            rows.forEach(r => {
              const rEmail = (r?.email || '').trim().toLowerCase();
              const rUname = (r?.username || '').trim().toLowerCase();
              if (!requesterUuid && ((requesterEmail && rEmail === requesterEmail) || (requesterUsername && rUname === requesterUsername.toLowerCase()))) {
                requesterUuid = r.id;
              }
              if (!addresseeUuid && ((addresseeEmail && rEmail === addresseeEmail) || (addresseeUsername && rUname === addresseeUsername.toLowerCase()))) {
                addresseeUuid = r.id;
              }
            });
          }
        }
      }

      if (requesterUuid && addresseeUuid) {
        await fetch(`${baseUrl}/rest/v1/friendships`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            requester_id: requesterUuid,
            addressee_id: addresseeUuid,
            status: 'pending'
          })
        });
      }
    } catch {
      // ignore network error
    }
  }
  return true;
}

/**
 * Marks an incoming friend request from `requesterAthlete` to `user` as accepted in Supabase `public.friendships` and local storage.
 */
export async function acceptFriendRequestFromAthlete(user, requesterAthlete) {
  if (!user || !requesterAthlete) return false;
  const addresseeUsername = (user.username || '').trim().toLowerCase();
  const addresseeEmail = (user.email || '').trim().toLowerCase();
  const requesterUsername = (requesterAthlete.username || '').trim().toLowerCase();
  const requesterEmail = (requesterAthlete.email || '').trim().toLowerCase();

  // 1. Update local requests store
  const localReqs = getLocalFriendRequests().map(r => {
    const matchesReq =
      (requesterEmail && (r.requesterEmail || '').toLowerCase() === requesterEmail) ||
      (requesterUsername && (r.requesterUsername || '').toLowerCase() === requesterUsername);
    const matchesAddr =
      (addresseeEmail && (r.addresseeEmail || '').toLowerCase() === addresseeEmail) ||
      (addresseeUsername && (r.addresseeUsername || '').toLowerCase() === addresseeUsername);
    if (matchesReq && matchesAddr) {
      return { ...r, status: 'accepted' };
    }
    return r;
  });
  saveLocalFriendRequests(localReqs);

  // 2. Update Supabase public.friendships
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (isConfigured) {
    const accessToken = await getValidSupabaseAccessToken(user);
    if (accessToken) {
      const headers = buildSupabaseHeaders(anonKey, accessToken, {
        'Content-Type': 'application/json'
      });
      try {
        if (requesterAthlete.friendshipId) {
          await fetch(
            `${baseUrl}/rest/v1/friendships?id=eq.${encodeURIComponent(requesterAthlete.friendshipId)}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ status: 'accepted' })
            }
          );
        } else if (requesterAthlete.id && user.id) {
          await fetch(
            `${baseUrl}/rest/v1/friendships?requester_id=eq.${encodeURIComponent(requesterAthlete.id)}&addressee_id=eq.${encodeURIComponent(user.id)}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ status: 'accepted' })
            }
          );
        }
      } catch {
        // ignore network error
      }
    }
  }
  return true;
}

/**
 * Resolves incoming friend requests and accepted friendships for `user`:
 * - Users must accept an incoming request before they are added to `friendsList` or their profile can be accessed.
 * - Returns `{ incomingRequests, matchedFriends, resolvedInviteEmails }`.
 */
export async function resolveInviteFriendshipsForUser(
  user,
  outgoingInvites = [],
  currentFriendsList = []
) {
  const incomingRequests = [];
  const rawMatchedFriends = [];
  const resolvedInviteEmails = [];

  const currentEmail = (user?.email || '').trim().toLowerCase();
  const currentUsername = (user?.username || '').trim().toLowerCase();
  if (!currentEmail && !currentUsername) {
    return { incomingRequests, matchedFriends: [], resolvedInviteEmails };
  }

  const inviteMatchers = (Array.isArray(outgoingInvites) ? outgoingInvites : [])
    .map(inv => ({
      email: (typeof inv === 'string' ? inv : inv?.email || '').trim().toLowerCase(),
      username: (typeof inv === 'object' && inv?.username ? inv.username : '').trim().toLowerCase()
    }))
    .filter(x => x.email || x.username);

  const isAlreadyInFriends = (uname, email, rowId = null) => {
    const u = (uname || '').trim().toLowerCase();
    const e = (email || '').trim().toLowerCase();
    const ePrefix = e ? e.split('@')[0] : '';
    const rId = rowId ? String(rowId).toLowerCase() : '';
    return (Array.isArray(currentFriendsList) ? currentFriendsList : []).some(f => {
      const fU = (f?.username || '').trim().toLowerCase();
      const fE = (f?.email || '').trim().toLowerCase();
      const fEPrefix = fE ? fE.split('@')[0] : '';
      const fId = String(f?.id || '').toLowerCase();
      return (
        (rId && fId === rId) ||
        (u && (fU === u || (fEPrefix && fEPrefix === u))) ||
        (e && fE === e) ||
        (ePrefix && fU === ePrefix) ||
        (u && fU && (ePrefix.startsWith(fU) || u.startsWith(fU) || fU.startsWith(u)))
      );
    });
  };

  // 1. Check local friend requests store
  const localReqs = getLocalFriendRequests();
  localReqs.forEach(req => {
    const rEmail = (req.requesterEmail || '').trim().toLowerCase();
    const rUname = (req.requesterUsername || '').trim();
    const aEmail = (req.addresseeEmail || '').trim().toLowerCase();
    const aUname = (req.addresseeUsername || '').trim();

    const isAddressedToMe =
      (currentEmail && aEmail === currentEmail) ||
      (currentUsername && aUname.toLowerCase() === currentUsername);
    const isSentByMe =
      (currentEmail && rEmail === currentEmail) ||
      (currentUsername && rUname.toLowerCase() === currentUsername);

    if (isAddressedToMe && req.status === 'pending' && !isAlreadyInFriends(rUname, rEmail)) {
      incomingRequests.push({
        id: req.requesterId || `friend_${(rUname || rEmail).toLowerCase()}`,
        username: rUname || rEmail.split('@')[0],
        email: rEmail,
        prs: {},
        sharedRoutines: []
      });
    } else if ((isAddressedToMe || isSentByMe) && req.status === 'accepted') {
      const friendUname = isSentByMe ? aUname : rUname;
      const friendEmail = isSentByMe ? aEmail : rEmail;
      const friendId = isSentByMe ? req.addresseeId : req.requesterId;
      rawMatchedFriends.push({
        id: friendId || `friend_${(friendUname || friendEmail).toLowerCase()}`,
        username: friendUname || friendEmail.split('@')[0],
        email: friendEmail,
        prs: {},
        sharedRoutines: []
      });
      if (friendEmail) resolvedInviteEmails.push(friendEmail);
      if (friendUname) resolvedInviteEmails.push(friendUname.toLowerCase());
    }
  });

  // 2. Check Supabase user_profiles, friendships, and shared routines if configured
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (isConfigured) {
    const accessToken = user ? await getValidSupabaseAccessToken(user) : null;
    const primaryHeaders = buildSupabaseHeaders(anonKey, accessToken);
    const anonOnlyHeaders = buildSupabaseHeaders(anonKey, null);
    const legacyBearerAnonHeaders = {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`
    };

    const fetchWithAnonFallback = async url => {
      try {
        let res = await fetch(url, { headers: primaryHeaders });
        if (!res.ok && accessToken) {
          res = await fetch(url, { headers: anonOnlyHeaders });
        }
        if (!res.ok && !anonOnlyHeaders.Authorization) {
          res = await fetch(url, { headers: legacyBearerAnonHeaders });
        }
        return res;
      } catch {
        return null;
      }
    };

    try {
      const [profilesRes, routinesRes, historyRes, friendshipsRes, friendInvitesRes] = await Promise.all([
        fetchWithAnonFallback(`${baseUrl}/rest/v1/user_profiles?select=id,username,email,one_rep_maxes,settings`),
        fetchWithAnonFallback(`${baseUrl}/rest/v1/routines?select=key,user_id,author_username,label,is_shared,slots`),
        fetchWithAnonFallback(
          `${baseUrl}/rest/v1/workout_history?select=id,user_id,title,preset_used,started_at,slots&order=started_at.desc&limit=300`
        ),
        user?.id
          ? fetchWithAnonFallback(
              `${baseUrl}/rest/v1/friendships?or=(requester_id.eq.${encodeURIComponent(user.id)},addressee_id.eq.${encodeURIComponent(user.id)})&select=*`
            )
          : Promise.resolve(null),
        currentEmail
          ? fetchWithAnonFallback(
              `${baseUrl}/rest/v1/friend_invites?or=(invited_email.eq.${encodeURIComponent(currentEmail)},inviter_email.eq.${encodeURIComponent(currentEmail)})&select=*`
            )
          : Promise.resolve(null)
      ]);

      const profileRows = profilesRes && profilesRes.ok ? await profilesRes.json() : [];
      const allRoutineRows = routinesRes && routinesRes.ok ? await routinesRes.json() : [];
      const allHistoryRows = historyRes && historyRes.ok ? await historyRes.json() : [];
      const friendshipRows = friendshipsRes && friendshipsRes.ok ? await friendshipsRes.json() : [];
      const friendInviteRows = friendInvitesRes && friendInvitesRes.ok ? await friendInvitesRes.json() : [];

      const routinesByUserId = new Map();
      const routinesByUsername = new Map();
      const allRoutinesByUserId = new Map();
      if (Array.isArray(allRoutineRows)) {
        allRoutineRows.forEach(r => {
          const item = {
            key: r.key,
            label: r.label,
            author: r.author_username,
            isShared: Boolean(r.is_shared),
            slots: Array.isArray(r.slots) ? r.slots : []
          };
          if (r.user_id) {
            const allList = allRoutinesByUserId.get(r.user_id) || [];
            allList.push(item);
            allRoutinesByUserId.set(r.user_id, allList);
          }
          if (r.is_shared) {
            if (r.user_id) {
              const list = routinesByUserId.get(r.user_id) || [];
              list.push(item);
              routinesByUserId.set(r.user_id, list);
            }
            if (r.author_username) {
              const uKey = r.author_username.toLowerCase();
              const list = routinesByUsername.get(uKey) || [];
              list.push(item);
              routinesByUsername.set(uKey, list);
            }
          }
        });
      }

      const historyByUserId = new Map();
      if (Array.isArray(allHistoryRows)) {
        allHistoryRows.forEach(h => {
          if (!h?.user_id) return;
          const list = historyByUserId.get(h.user_id) || [];
          list.push({
            id: h.id,
            title: h.title,
            loadedRoutineTitle: h.preset_used || 'MANUAL',
            startedAt: h.started_at,
            slots: Array.isArray(h.slots) ? h.slots : []
          });
          historyByUserId.set(h.user_id, list);
        });
      }

      const profileById = new Map();
      if (Array.isArray(profileRows)) {
        profileRows.forEach(row => {
          if (row?.id) profileById.set(row.id, row);
        });
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

      const buildFriendObjFromProfile = (row, friendshipId = null) => {
        const uname = (row?.username || '').trim() || (row?.email || '').split('@')[0];
        const email = (row?.email || '').trim().toLowerCase();
        const sharedFromSettings = Array.isArray(row?.settings?.sharedRoutines)
          ? row.settings.sharedRoutines
          : [];
        const shared =
          routinesByUserId.get(row?.id) ||
          routinesByUsername.get(uname.toLowerCase()) ||
          sharedFromSettings;
        const settingsHistory = Array.isArray(row?.settings?.recentHistory)
          ? row.settings.recentHistory
          : [];
        const embeddedMetaHistory = Array.isArray(row?.settings?.yccih_cloud_state_v3?.history)
          ? row.settings.yccih_cloud_state_v3.history
          : [];
        const tableHistory = historyByUserId.get(row?.id) || [];
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
        mergePrSource(row?.settings?.goals?.customGoalWeights);

        rowHistory.forEach(w => scanSlotsIntoPrs(w?.slots, mergedPrs));
        if (row?.settings?.activeSession?.slots) {
          scanSlotsIntoPrs(row.settings.activeSession.slots, mergedPrs);
        }
        const settingsSavedRoutines = Array.isArray(row?.settings?.savedRoutines)
          ? row.settings.savedRoutines
          : [];
        const userRoutines = [
          ...(allRoutinesByUserId.get(row?.id) || []),
          ...shared,
          ...settingsSavedRoutines
        ];
        userRoutines.forEach(r => scanSlotsIntoPrs(r?.slots, mergedPrs));

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
      };

      // A) Process explicit rows from public.friendships table
      if (Array.isArray(friendshipRows) && user?.id) {
        friendshipRows.forEach(fr => {
          const isRequester = String(fr.requester_id) === String(user.id);
          const otherId = isRequester ? fr.addressee_id : fr.requester_id;
          const otherProfile = profileById.get(otherId);
          if (!otherProfile) return;
          const friendObj = buildFriendObjFromProfile(otherProfile, fr.id);

          if (fr.status === 'accepted') {
            rawMatchedFriends.push(friendObj);
            if (friendObj.email) resolvedInviteEmails.push(friendObj.email);
            if (friendObj.username) resolvedInviteEmails.push(friendObj.username.toLowerCase());
          } else if (fr.status === 'pending' && !isRequester) {
            if (!isAlreadyInFriends(friendObj.username, friendObj.email)) {
              incomingRequests.push(friendObj);
            }
          }
        });
      }

      // A2) Process rows from public.friend_invites table (both when current user is invitee AND when current user is inviter)
      if (Array.isArray(friendInviteRows) && Array.isArray(profileRows)) {
        friendInviteRows.forEach(inv => {
          const invTargetEmail = (inv?.invited_email || '').trim().toLowerCase();
          const invSenderEmail = (inv?.inviter_email || '').trim().toLowerCase();
          const invSenderUname = (inv?.inviter_username || '').trim().toLowerCase();

          if (currentEmail && invTargetEmail === currentEmail) {
            const senderProfile = profileRows.find(
              p =>
                (inv.inviter_user_id && p.id === inv.inviter_user_id) ||
                (invSenderEmail && (p.email || '').trim().toLowerCase() === invSenderEmail) ||
                (invSenderUname && (p.username || '').trim().toLowerCase() === invSenderUname)
            );
            if (senderProfile) {
              const friendObj = buildFriendObjFromProfile(senderProfile);
              if (inv.status === 'accepted' || isAlreadyInFriends(friendObj.username, friendObj.email)) {
                rawMatchedFriends.push(friendObj);
              } else {
                incomingRequests.push(friendObj);
              }
            }
          } else if (
            (currentEmail && invSenderEmail === currentEmail) ||
            (currentUsername && invSenderUname === currentUsername)
          ) {
            // Current user sent this email invite — if the invited athlete has registered a profile, connect them!
            const targetProfile = profileRows.find(
              p => invTargetEmail && (p.email || '').trim().toLowerCase() === invTargetEmail
            );
            if (targetProfile) {
              const friendObj = buildFriendObjFromProfile(targetProfile);
              rawMatchedFriends.push(friendObj);
              if (friendObj.email) resolvedInviteEmails.push(friendObj.email);
              if (friendObj.username) resolvedInviteEmails.push(friendObj.username.toLowerCase());
            }
          }
        });
      }

      // B) Cross-check user_profiles settings (outgoingInvites & friendsList)
      if (Array.isArray(profileRows)) {
        profileRows.forEach(row => {
          const rowEmail = (row?.email || '').trim().toLowerCase();
          const rowUname = (row?.username || '').trim();
          const rowUnameLower = rowUname.toLowerCase();
          if (!rowEmail && !rowUnameLower) return;
          if (currentEmail && rowEmail === currentEmail) return;
          if (currentUsername && rowUnameLower === currentUsername) return;

          const rowInvites = Array.isArray(row?.settings?.outgoingInvites)
            ? row.settings.outgoingInvites
            : [];
          const rowFriends = Array.isArray(row?.settings?.friendsList)
            ? row.settings.friendsList
            : [];

          // Did this profile send a friend invite to the current user?
          const invitedCurrentUser = rowInvites.some(inv => {
            const invEmail = (typeof inv === 'string' ? inv : inv?.email || '').trim().toLowerCase();
            const invUname = (typeof inv === 'object' && inv?.username ? inv.username : '').trim().toLowerCase();
            return (
              (currentEmail && invEmail === currentEmail) ||
              (currentUsername && (invUname === currentUsername || invEmail === currentUsername))
            );
          });

          // Did this profile already accept the current user into their friendsList?
          const hasCurrentUserInTheirFriends = rowFriends.some(f => {
            const fEmail = (f?.email || '').trim().toLowerCase();
            const fUname = (f?.username || '').trim().toLowerCase();
            return (
              (currentEmail && fEmail === currentEmail) ||
              (currentUsername && fUname === currentUsername)
            );
          });

          // Did current user invite this profile?
          const currentInvitedThisRow = inviteMatchers.some(
            m =>
              (m.email && (m.email === rowEmail || m.email === rowUnameLower)) ||
              (m.username && m.username === rowUnameLower)
          );

          if (
            isAlreadyInFriends(rowUname, rowEmail, row?.id) ||
            hasCurrentUserInTheirFriends ||
            (currentInvitedThisRow && hasCurrentUserInTheirFriends)
          ) {
            // Mutual or accepted friend — refresh live PRs, recentHistory, and shared routines from profile
            const friendObj = buildFriendObjFromProfile(row);
            rawMatchedFriends.push(friendObj);
            if (currentInvitedThisRow) {
              if (rowEmail) resolvedInviteEmails.push(rowEmail);
              if (rowUnameLower) resolvedInviteEmails.push(rowUnameLower);
            }
          } else if (invitedCurrentUser && !isAlreadyInFriends(rowUname, rowEmail)) {
            // Incoming friend request waiting for current user to accept
            const reqObj = buildFriendObjFromProfile(row);
            if (
              !incomingRequests.some(
                r =>
                  (r.username || '').toLowerCase() === rowUnameLower ||
                  (rowEmail && (r.email || '').toLowerCase() === rowEmail)
              )
            ) {
              incomingRequests.push(reqObj);
            }
          }
        });
      }
    } catch {
      // ignore network error
    }
  }

  // Deduplicate and merge all matchedFriends so local stub entries (`prs: {}`) never shadow rich Supabase profile data
  const dedupedFriends = [];
  rawMatchedFriends.forEach(item => {
    if (!item) return;
    const itemU = (item.username || '').trim().toLowerCase();
    const itemE = (item.email || '').trim().toLowerCase();
    const itemEPrefix = itemE ? itemE.split('@')[0] : '';
    const existingIdx = dedupedFriends.findIndex(existing => {
      const exU = (existing.username || '').trim().toLowerCase();
      const exE = (existing.email || '').trim().toLowerCase();
      const exEPrefix = exE ? exE.split('@')[0] : '';
      return (
        (item.id && existing.id && String(item.id) === String(existing.id)) ||
        (itemU && (exU === itemU || exEPrefix === itemU)) ||
        (itemE && exE === itemE) ||
        (itemEPrefix && exU === itemEPrefix)
      );
    });

    if (existingIdx >= 0) {
      const existing = dedupedFriends[existingIdx];
      const mergedPrs = { ...(existing.prs || {}) };
      Object.entries(item.prs || {}).forEach(([k, v]) => {
        const num = Number(v) || 0;
        if (num > (Number(mergedPrs[k]) || 0)) {
          mergedPrs[k] = num;
        }
      });
      const historyMap = new Map();
      [...(existing.history || []), ...(item.history || [])].forEach(w => {
        if (w && w.id && !historyMap.has(w.id)) {
          historyMap.set(w.id, w);
        }
      });
      const routinesMap = new Map();
      [...(existing.sharedRoutines || []), ...(item.sharedRoutines || [])].forEach(r => {
        if (r && r.key && !routinesMap.has(r.key)) {
          routinesMap.set(r.key, r);
        }
      });
      dedupedFriends[existingIdx] = {
        ...existing,
        ...item,
        id:
          existing.id && !String(existing.id).startsWith('friend_')
            ? existing.id
            : item.id || existing.id,
        username: item.username || existing.username,
        email: item.email || existing.email,
        prs: mergedPrs,
        history: Array.from(historyMap.values()).sort(
          (a, b) => new Date(b?.startedAt || 0).getTime() - new Date(a?.startedAt || 0).getTime()
        ),
        sharedRoutines: Array.from(routinesMap.values())
      };
    } else {
      dedupedFriends.push(item);
    }
  });

  return {
    incomingRequests,
    matchedFriends: dedupedFriends,
    resolvedInviteEmails
  };
}

/**
 * Searches registered athletes by username or email across local accounts and Supabase `user_profiles`.
 */
export async function searchAthletesByQuery(query, currentUser = null) {
  const q = (query || '').trim().toLowerCase().replace(/^@/, '');
  if (!q) return [];

  const curEmail = (currentUser?.email || '').trim().toLowerCase();
  const curUsername = (currentUser?.username || '').trim().toLowerCase();
  const resultsByKey = new Map();

  // 1. Check local registered accounts
  const localAccounts = getLocalRegisteredAccounts();
  Object.values(localAccounts).forEach(acc => {
    if (!acc) return;
    const uname = (acc.username || '').trim();
    const email = (acc.email || '').trim().toLowerCase();
    if (curEmail && email === curEmail) return;
    if (curUsername && uname.toLowerCase() === curUsername) return;
    if (uname.toLowerCase().includes(q) || email.includes(q)) {
      const key = (uname || email).toLowerCase();
      resultsByKey.set(key, {
        id: acc.id || `friend_${uname.toLowerCase()}`,
        username: uname || email.split('@')[0],
        email,
        prs: {},
        sharedRoutines: []
      });
    }
  });

  // 2. Check Supabase user_profiles if configured
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (isConfigured) {
    const accessToken = currentUser ? await getValidSupabaseAccessToken(currentUser) : null;
    try {
      let res = await fetch(
        `${baseUrl}/rest/v1/user_profiles?select=id,username,email,one_rep_maxes,settings`,
        { headers: buildSupabaseHeaders(anonKey, accessToken) }
      );
      if (!res.ok && accessToken) {
        res = await fetch(
          `${baseUrl}/rest/v1/user_profiles?select=id,username,email,one_rep_maxes,settings`,
          { headers: buildSupabaseHeaders(anonKey, null) }
        );
      }
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) {
          rows.forEach(row => {
            const uname = (row?.username || '').trim();
            const email = (row?.email || '').trim().toLowerCase();
            if (!uname && !email) return;
            if (curEmail && email === curEmail) return;
            if (curUsername && uname.toLowerCase() === curUsername) return;
            if (uname.toLowerCase().includes(q) || email.includes(q)) {
              const key = (uname || email).toLowerCase();
              const mergedPrs = {
                ...(row?.settings?.oneRepMaxes || {}),
                ...(row?.one_rep_maxes || {})
              };
              const recentHist = Array.isArray(row?.settings?.recentHistory)
                ? row.settings.recentHistory
                : [];
              recentHist.forEach(w => {
                (w?.slots || []).forEach(slot => {
                  const exId = slot?.exerciseId;
                  if (!exId) return;
                  (slot?.sets || []).forEach(st => {
                    const sw = Number(st?.weight) || 0;
                    if (sw <= 0) return;
                    const sr = Math.max(1, Number(st?.reps) || 1);
                    const est = sr === 1 ? sw : Math.round(sw * (1 + sr / 30));
                    if (est > (Number(mergedPrs[exId]) || 0)) {
                      mergedPrs[exId] = est;
                    }
                  });
                });
              });
              resultsByKey.set(key, {
                id: row.id || `friend_${uname.toLowerCase()}`,
                username: uname || email.split('@')[0],
                email,
                bodyweightLbs: row?.settings?.bodyMetrics?.bodyweightLbs || 200,
                prs: mergedPrs,
                history: recentHist,
                sharedRoutines: Array.isArray(row?.settings?.sharedRoutines)
                  ? row.settings.sharedRoutines
                  : []
              });
            }
          });
        }
      }
    } catch {
      // ignore network error
    }
  }

  return Array.from(resultsByKey.values());
}


