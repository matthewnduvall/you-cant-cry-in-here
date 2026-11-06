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
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`
          }
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
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
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

      // Fetch username from public.user_profiles if available, or backfill row on sign-in
      if (accessToken && authUser.id) {
        try {
          const profRes = await fetch(
            `${baseUrl}/rest/v1/user_profiles?id=eq.${authUser.id}&select=username,email`,
            {
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${accessToken}`
              }
            }
          );
          let hasExistingProfile = false;
          if (profRes.ok) {
            const rows = await profRes.json();
            if (Array.isArray(rows) && rows.length > 0) {
              hasExistingProfile = true;
              if (rows[0]?.username) {
                resolvedUsername = rows[0].username;
              }
            }
          }
          if (!hasExistingProfile) {
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
                email: (authUser.email || resolvedEmail).toLowerCase(),
                username: resolvedUsername,
                updated_at: new Date().toISOString()
              })
            }).catch(() => {});
          }
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

export async function getValidSupabaseAccessToken(user) {
  if (!user || !user.email) return null;
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  const cleanEmail = user.email.trim().toLowerCase();
  const saved = getSavedSupabaseSessionTokens(cleanEmail);

  // Use existing token if saved within the last 45 minutes
  if (saved?.accessToken && Date.now() - (saved.savedAt || 0) < 45 * 60 * 1000) {
    return saved.accessToken;
  }

  // Try refreshing via refresh_token if available
  if (saved?.refreshToken) {
    try {
      const res = await fetch(`${baseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: saved.refreshToken })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.access_token) {
          saveSupabaseSessionTokens({
            userId: data.user?.id || user.id,
            email: cleanEmail,
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
  const localMatch = localAccounts[cleanEmail];
  if (localMatch?.password) {
    try {
      const res = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: cleanEmail, password: localMatch.password })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.access_token) {
          saveSupabaseSessionTokens({
            userId: data.user?.id || user.id,
            email: cleanEmail,
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

  return saved?.accessToken || null;
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

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`
  };

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
      ? fetch(`${baseUrl}/rest/v1/user_profiles?id=eq.${encodeURIComponent(user.id)}&select=*`, { headers })
          .then(r => (r.ok ? r.json() : null))
          .then(rows => {
            if (Array.isArray(rows) && rows[0]) profileRow = rows[0];
          })
      : Promise.resolve(),
    user.id
      ? fetch(
          `${baseUrl}/rest/v1/workout_history?user_id=eq.${encodeURIComponent(user.id)}&order=started_at.desc`,
          { headers }
        )
          .then(r => (r.ok ? r.json() : null))
          .then(rows => {
            if (Array.isArray(rows)) historyRows = rows;
          })
      : Promise.resolve(),
    user.id
      ? fetch(
          `${baseUrl}/rest/v1/routines?user_id=eq.${encodeURIComponent(user.id)}&order=updated_at.desc`,
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

  const mappedHistoryFromTable = Array.isArray(historyRows)
    ? historyRows.map(row => ({
        id: row.id,
        title: row.title,
        loadedRoutineTitle: row.preset_used || 'MANUAL',
        gymId: row.gym_id || '',
        startedAt: row.started_at,
        updatedAt: row.updated_at,
        defaultRestSeconds: row.default_rest_seconds || 90,
        isComplete: Boolean(row.is_complete),
        verifiedByUser: Boolean(row.verified_by_user),
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
    updatedAt: profileRow?.updated_at || metadataSnapshot?.updatedAt || null,
    oneRepMaxes: {
      ...(metadataSnapshot?.oneRepMaxes || {}),
      ...(profileRow?.one_rep_maxes || {})
    },
    history:
      mappedHistoryFromTable.length > 0
        ? mappedHistoryFromTable
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
  if (!user || !user.email || !payload) return false;
  const { baseUrl, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return false;

  const accessToken = await getValidSupabaseAccessToken(user);
  if (!accessToken) return false;

  const jsonHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates'
  };

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(user.id || '')
  );

  const tasks = [
    // 1. Always sync compact cloud state snapshot into Supabase Auth user_metadata (works even without custom tables)
    fetch(`${baseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          username: user.username,
          yccih_cloud_state_v3: payload
        }
      })
    })
  ];

  if (isUuid) {
    // 2. Sync user_profiles row
    tasks.push(
      fetch(`${baseUrl}/rest/v1/user_profiles`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          username: user.username,
          schema_version: payload.schemaVersion || 3,
          one_rep_maxes: payload.oneRepMaxes || {},
          settings: {
            ...(payload.settings || {}),
            activeSession: payload.activeSession || null,
            friendsList: payload.friendsList || [],
            outgoingInvites: payload.outgoingInvites || []
          },
          gyms: payload.gyms || [],
          updated_at: payload.updatedAt || new Date().toISOString()
        })
      })
    );

    // 3. Sync workout_history rows
    if (Array.isArray(payload.history) && payload.history.length > 0) {
      const historyRows = payload.history.map(w => ({
        id: String(w.id),
        user_id: user.id,
        schema_version: 3,
        title: w.title || 'Workout Session',
        preset_used: w.loadedRoutineTitle || 'MANUAL',
        gym_id: w.gymId || '',
        started_at: w.startedAt || new Date().toISOString(),
        updated_at: w.updatedAt || new Date().toISOString(),
        default_rest_seconds: Number(w.defaultRestSeconds) || 90,
        is_complete: Boolean(w.isComplete),
        verified_by_user: Boolean(w.verifiedByUser),
        slots: Array.isArray(w.slots) ? w.slots : []
      }));
      tasks.push(
        fetch(`${baseUrl}/rest/v1/workout_history`, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(historyRows)
        })
      );
    }

    // 4. Sync routines rows (saved & shared)
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
        user_id: user.id,
        author_username: r.author || user.username || 'athlete',
        label: r.label || 'Custom Routine',
        is_shared: Boolean(r.isShared),
        schema_version: 3,
        slots: Array.isArray(r.slots) ? r.slots : [],
        updated_at: new Date().toISOString()
      }));
      tasks.push(
        fetch(`${baseUrl}/rest/v1/routines`, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(routinePayload)
        })
      );
    }
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
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken || anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    };

    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let requesterUuid = uuidRegex.test(String(user.id || '')) ? String(user.id) : null;
      let addresseeUuid = uuidRegex.test(String(targetAthlete.id || '')) ? String(targetAthlete.id) : null;

      if (!requesterUuid || !addresseeUuid) {
        const profRes = await fetch(
          `${baseUrl}/rest/v1/user_profiles?select=id,username,email`,
          { headers: { apikey: anonKey, Authorization: `Bearer ${accessToken || anonKey}` } }
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
      const headers = {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
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
  const matchedFriends = [];
  const resolvedInviteEmails = [];

  const currentEmail = (user?.email || '').trim().toLowerCase();
  const currentUsername = (user?.username || '').trim().toLowerCase();
  if (!currentEmail && !currentUsername) {
    return { incomingRequests, matchedFriends, resolvedInviteEmails };
  }

  const inviteMatchers = (Array.isArray(outgoingInvites) ? outgoingInvites : [])
    .map(inv => ({
      email: (typeof inv === 'string' ? inv : inv?.email || '').trim().toLowerCase(),
      username: (typeof inv === 'object' && inv?.username ? inv.username : '').trim().toLowerCase()
    }))
    .filter(x => x.email || x.username);

  const isAlreadyInFriends = (uname, email) => {
    const u = (uname || '').trim().toLowerCase();
    const e = (email || '').trim().toLowerCase();
    return (Array.isArray(currentFriendsList) ? currentFriendsList : []).some(
      f =>
        (u && (f?.username || '').trim().toLowerCase() === u) ||
        (e && (f?.email || '').trim().toLowerCase() === e)
    );
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
      matchedFriends.push({
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
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken || anonKey}`
    };

    try {
      const [profilesRes, routinesRes, friendshipsRes, friendInvitesRes] = await Promise.all([
        fetch(`${baseUrl}/rest/v1/user_profiles?select=id,username,email,one_rep_maxes,settings`, { headers }).catch(() => null),
        fetch(`${baseUrl}/rest/v1/routines?is_shared=eq.true&select=key,user_id,author_username,label,slots`, { headers }).catch(() => null),
        user?.id
          ? fetch(
              `${baseUrl}/rest/v1/friendships?or=(requester_id.eq.${encodeURIComponent(user.id)},addressee_id.eq.${encodeURIComponent(user.id)})&select=*`,
              { headers }
            ).catch(() => null)
          : Promise.resolve(null),
        currentEmail
          ? fetch(
              `${baseUrl}/rest/v1/friend_invites?or=(invited_email.eq.${encodeURIComponent(currentEmail)},inviter_email.eq.${encodeURIComponent(currentEmail)})&select=*`,
              { headers }
            ).catch(() => null)
          : Promise.resolve(null)
      ]);

      const profileRows = profilesRes && profilesRes.ok ? await profilesRes.json() : [];
      const sharedRoutineRows = routinesRes && routinesRes.ok ? await routinesRes.json() : [];
      const friendshipRows = friendshipsRes && friendshipsRes.ok ? await friendshipsRes.json() : [];
      const friendInviteRows = friendInvitesRes && friendInvitesRes.ok ? await friendInvitesRes.json() : [];

      const routinesByUserId = new Map();
      const routinesByUsername = new Map();
      if (Array.isArray(sharedRoutineRows)) {
        sharedRoutineRows.forEach(r => {
          const item = {
            key: r.key,
            label: r.label,
            author: r.author_username,
            slots: Array.isArray(r.slots) ? r.slots : []
          };
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
        });
      }

      const profileById = new Map();
      if (Array.isArray(profileRows)) {
        profileRows.forEach(row => {
          if (row?.id) profileById.set(row.id, row);
        });
      }

      const buildFriendObjFromProfile = (row, friendshipId = null) => {
        const uname = (row?.username || '').trim() || (row?.email || '').split('@')[0];
        const email = (row?.email || '').trim().toLowerCase();
        const shared =
          routinesByUserId.get(row?.id) ||
          routinesByUsername.get(uname.toLowerCase()) ||
          [];
        return {
          id: row?.id || `friend_${uname.toLowerCase()}`,
          friendshipId: friendshipId || undefined,
          username: uname,
          email,
          bodyweightLbs: row?.settings?.bodyMetrics?.bodyweightLbs || 200,
          prs: row?.one_rep_maxes || {},
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
            matchedFriends.push(friendObj);
            if (friendObj.email) resolvedInviteEmails.push(friendObj.email);
            if (friendObj.username) resolvedInviteEmails.push(friendObj.username.toLowerCase());
          } else if (fr.status === 'pending' && !isRequester) {
            if (!isAlreadyInFriends(friendObj.username, friendObj.email)) {
              incomingRequests.push(friendObj);
            }
          }
        });
      }

      // A2) Process rows from public.friend_invites table
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
              if (inv.status === 'accepted') {
                matchedFriends.push(friendObj);
              } else if (!isAlreadyInFriends(friendObj.username, friendObj.email)) {
                incomingRequests.push(friendObj);
              }
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

          if (currentInvitedThisRow && hasCurrentUserInTheirFriends) {
            // Recipient accepted the invite! Move to friendsList
            const friendObj = buildFriendObjFromProfile(row);
            matchedFriends.push(friendObj);
            if (rowEmail) resolvedInviteEmails.push(rowEmail);
            if (rowUnameLower) resolvedInviteEmails.push(rowUnameLower);
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
          } else if (isAlreadyInFriends(rowUname, rowEmail)) {
            // Refresh existing accepted friend's PRs and shared routines
            matchedFriends.push(buildFriendObjFromProfile(row));
          }
        });
      }
    } catch {
      // ignore network error
    }
  }

  return {
    incomingRequests,
    matchedFriends,
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
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken || anonKey}`
    };
    try {
      const res = await fetch(
        `${baseUrl}/rest/v1/user_profiles?select=id,username,email,one_rep_maxes,settings`,
        { headers }
      );
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
              resultsByKey.set(key, {
                id: row.id || `friend_${uname.toLowerCase()}`,
                username: uname || email.split('@')[0],
                email,
                bodyweightLbs: row?.settings?.bodyMetrics?.bodyweightLbs || 200,
                prs: row.one_rep_maxes || {},
                sharedRoutines: []
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


