'use client';

import React, { useState } from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  registerUserAccount,
  signInUserAccount,
  requestPasswordRecoveryEmail,
  completePasswordRecoveryWithToken,
  accountHasSavedData
} from '../../utils/supabaseAuth';
import { Button } from '../Controls';

export function AuthView({
  colors,
  authUsername,
  setAuthUsername,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  signupUsername,
  setSignupUsername,
  signupEmail,
  setSignupEmail,
  signupPassword,
  setSignupPassword,
  signupBetaCode,
  setSignupBetaCode,
  recoveryAccessToken,
  setRecoveryAccessToken,
  pendingInviter,
  onInviteAccepted,
  setUser,
  setCurrentView,
  // Workout History already on this device (then a first sign-in skips Configuration)
  hasLocalHistory = false,
  // A brand-new account is sent through Configuration from its first tab
  onStartSetup
}) {
  const [loginError, setLoginError] = useState('');
  // Set by useCloudAndStorageSync when a session ends (revoked/expired or never saved on this device)
  const [sessionEnded] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.sessionStorage.getItem('yccih_session_expired') === '1';
    } catch {
      return false;
    }
  });
  const [signupError, setSignupError] = useState('');
  const [signupNotice, setSignupNotice] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(null);

  // Password visibility toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);

  // Account recovery state
  const [showRecoveryPanel, setShowRecoveryPanel] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');

  // SHOW / HIDE: a 44 px pill (white fill while the password is shown)
  const showHideBtnStyle = isShown => ({
    minHeight: '44px',
    minWidth: '64px',
    padding: '0 12px',
    backgroundColor: isShown ? '#FFFFFF' : 'transparent',
    color: isShown ? '#000000' : '#FFFFFF',
    border: `1px solid ${isShown ? '#FFFFFF' : 'var(--cr-outline)'}`,
    borderRadius: '999px',
    letterSpacing: '0.06em',
    fontSize: '11px',
    fontWeight: 500,
    textTransform: 'uppercase',
    cursor: 'pointer',
    flexShrink: 0
  });

  const handleSignInSubmit = async () => {
    if (authSubmitting) return;
    setLoginError('');
    setSignupError('');
    setAuthSubmitting('login');
    try {
      const result = await signInUserAccount({
        identifier: authEmail || authUsername,
        username: authUsername,
        email: authEmail,
        password: authPassword
      });
      try {
        window.sessionStorage.removeItem('yccih_session_expired');
      } catch {
        // ignore storage error
      }
      // Configuration only on a brand-new account's very first sign-in: any saved History, routines, PRs,
      // equipment setups or settings (on the server, or History on this device) go straight Home.
      // Checked before setUser so the app's own first sync can't make a new account look used.
      const savedOnServer = await accountHasSavedData(result.user);
      let hasOnboarded = false;
      try {
        const map = JSON.parse(window.localStorage.getItem('yccih_onboarded_users_v1') || '{}');
        const uKey = (result.user.email || result.user.username || result.user.id || '').toLowerCase();
        hasOnboarded = Boolean(map[uKey]);
        map[uKey] = true;
        window.localStorage.setItem('yccih_onboarded_users_v1', JSON.stringify(map));
      } catch {
        hasOnboarded = true;
      }
      // Couldn't reach the server: fall back to "already set up on this device"
      // Workouts on this device only count if they are this account's (or made signed out): another account's data
      // left on the device is cleared on sign-in and says nothing about this one
      let localIsTheirs = hasLocalHistory;
      try {
        const owner = window.localStorage.getItem('yccih_data_owner_v1');
        if (owner && owner !== result.user.id) localIsTheirs = false;
      } catch {
        // storage unavailable: keep hasLocalHistory
      }
      const isBrandNew = savedOnServer === false ? !localIsTheirs : savedOnServer === null && !hasOnboarded && !localIsTheirs;
      setUser(result.user);
      if (onInviteAccepted) onInviteAccepted(result.user);
      setAuthUsername(result.user.username);
      setAuthEmail(result.user.email);
      setAuthPassword('');
      if (isBrandNew) onStartSetup?.();
      setCurrentView(isBrandNew ? 'configuration' : 'home');
    } catch (err) {
      setLoginError(err?.message || 'SIGN IN FAILED. CHECK YOUR USERNAME/EMAIL AND PASSWORD.');
    } finally {
      setAuthSubmitting(null);
    }
  };

  const handleSignUpSubmit = async () => {
    if (authSubmitting) return;
    setSignupError('');
    setSignupNotice('');
    setLoginError('');
    setAuthSubmitting('signup');
    try {
      const result = await registerUserAccount({
        username: signupUsername,
        email: signupEmail,
        password: signupPassword,
        betaCode: signupBetaCode
      });
      if (result.requiresEmailConfirmation) {
        // No session until the email is confirmed; the invite/default friendships are created
        // server-side when the account is created, so nothing is lost by signing in afterwards.
        setSignupPassword('');
        setAuthEmail(result.user.email);
        setSignupNotice(
          `Account created. Open the confirmation link sent to ${result.user.email}, then sign in above.`
        );
        return;
      }
      setUser(result.user);
      if (onInviteAccepted) onInviteAccepted(result.user);
      setAuthUsername(result.user.username);
      setAuthEmail(result.user.email);
      setSignupPassword('');
      setSignupBetaCode('');
      if (typeof window !== 'undefined' && result.user) {
        try {
          const map = JSON.parse(window.localStorage.getItem('yccih_onboarded_users_v1') || '{}');
          const uKey = (result.user.email || result.user.username || result.user.id || '').toLowerCase();
          map[uKey] = true;
          window.localStorage.setItem('yccih_onboarded_users_v1', JSON.stringify(map));
        } catch {
          // ignore
        }
      }
      onStartSetup?.();
      setCurrentView('configuration');
    } catch (err) {
      setSignupError(err?.message || 'Account creation failed. Check every field and the beta code.');
    } finally {
      setAuthSubmitting(null);
    }
  };

  const handleSendRecoveryEmail = async () => {
    if (authSubmitting) return;
    setRecoveryError('');
    setRecoverySuccess('');
    setAuthSubmitting('recover_email');
    try {
      const targetEmail = (recoveryEmail || authEmail).trim();
      const res = await requestPasswordRecoveryEmail({ email: targetEmail });
      setRecoverySuccess(res.message);
    } catch (err) {
      setRecoveryError(err?.message || 'Failed to send the recovery email.');
    } finally {
      setAuthSubmitting(null);
    }
  };

  const handleCompleteTokenReset = async () => {
    if (authSubmitting) return;
    setRecoveryError('');
    setRecoverySuccess('');
    setAuthSubmitting('recover_token');
    try {
      const result = await completePasswordRecoveryWithToken({
        accessToken: recoveryAccessToken?.accessToken,
        refreshToken: recoveryAccessToken?.refreshToken || null,
        newPassword: recoveryNewPassword
      });
      if (setRecoveryAccessToken) setRecoveryAccessToken(null);
      setUser(result.user);
      setAuthUsername(result.user.username);
      setAuthEmail(result.user.email);
      setRecoveryNewPassword('');
      setCurrentView('home');
    } catch (err) {
      setRecoveryError(err?.message || 'Failed to update the password.');
    } finally {
      setAuthSubmitting(null);
    }
  };

  return (
    <div style={UI.pagePad}>
      {pendingInviter && pendingInviter.username && (
        <div
          style={{
            margin: '0 var(--dp-spacing-gutter) 16px',
            padding: '10px 12px',
            backgroundColor: '#1C1C1C',
            border: 'none',
              borderRadius: '10px',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 400,
            textTransform: 'none',
            lineHeight: 1.4
          }}
        >
          ✓ Invited by @{pendingInviter.username}. The beta code &quot;imnotcrying&quot; is filled in; create your account below to become friends automatically.
        </div>
      )}
      {/* EMAIL LINK RECOVERY COMPLETION BANNER (SHOWN WHEN USER ARRIVES FROM EMAIL RESET LINK) */}
      {recoveryAccessToken && (
        <div style={{ marginBottom: '20px' }}>
          <IOSListSection
            header="PASSWORD RECOVERY // SET NEW PASSWORD"
            footer="Your email recovery link is verified. Enter your new password below to restore access."
            colors={colors}
          >
            <IOSListRow isLast={true} colors={colors}>
              <div style={{ width: '100%' }}>
                <div style={UI.fieldLabel}>NEW PASSWORD</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type={showRecoveryPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={recoveryNewPassword}
                    onChange={e => {
                      setRecoveryNewPassword(e.target.value);
                      if (recoveryError) setRecoveryError('');
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleCompleteTokenReset();
                    }}
                    style={{ ...UI.textInputBare, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRecoveryPassword(prev => !prev)}
                    style={showHideBtnStyle(showRecoveryPassword)}
                  >
                    {showRecoveryPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>
            </IOSListRow>
          </IOSListSection>

          <div style={{ padding: '0 var(--dp-spacing-gutter)' }}>
            {recoveryError && (
              <div
                style={{
                  marginBottom: '10px',
                  padding: '10px 12px',
                  backgroundColor: '#1C1C1C',
                  border: 'none',
              borderRadius: '10px',
                  color: '#FF4A3D',
                  fontSize: '14px',
                  fontWeight: 400,
                  textTransform: 'none',
                  lineHeight: 1.4
                }}
              >
                ⚠ {recoveryError}
              </div>
            )}
            <Button
              variant="primary"
              disabled={authSubmitting === 'recover_token'}
              onClick={handleCompleteTokenReset}
            >
              {authSubmitting === 'recover_token' ? 'SAVING NEW PASSWORD...' : 'SAVE NEW PASSWORD & SIGN IN →'}
            </Button>
          </div>
        </div>
      )}

      {sessionEnded && (
        <div
          style={{
            margin: '0 var(--dp-spacing-gutter) 16px',
            padding: '10px 12px',
            backgroundColor: '#1C1C1C',
            border: 'none',
            borderRadius: '10px',
            color: '#BDBDBD',
            fontSize: '14px',
            fontWeight: 400,
            lineHeight: 1.4
          }}
        >
          Your session ended. Sign in again to resume syncing; your workouts on this device are safe.
        </div>
      )}
      <IOSListSection header="SIGN IN // EXISTING ACCOUNT" colors={colors}>
        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>USERNAME OR EMAIL</div>
            <input
              type="text"
              placeholder="Username or you@domain.com"
              value={authEmail}
              onChange={e => {
                setAuthEmail(e.target.value);
                setAuthUsername(e.target.value);
                if (loginError) setLoginError('');
              }}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>PASSWORD</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type={showLoginPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={authPassword}
                onChange={e => {
                  setAuthPassword(e.target.value);
                  if (loginError) setLoginError('');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSignInSubmit();
                }}
                style={{ ...UI.textInputBare, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(prev => !prev)}
                style={showHideBtnStyle(showLoginPassword)}
              >
                {showLoginPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>
        </IOSListRow>
      </IOSListSection>

      <div style={{ padding: '0 var(--dp-spacing-gutter) 20px' }}>
        {loginError && (
          <div
            style={{
              marginBottom: '10px',
              padding: '10px 12px',
              backgroundColor: '#1C1C1C',
              border: 'none',
              borderRadius: '10px',
              color: '#FF4A3D',
              fontSize: '14px',
              fontWeight: 400,
              textTransform: 'none',
              lineHeight: 1.4
            }}
          >
            ⚠ {loginError}
          </div>
        )}
        <Button
          variant="primary"
          disabled={authSubmitting === 'login'}
          onClick={handleSignInSubmit}
          style={{ opacity: authSubmitting === 'login' ? 0.6 : 1 }}
        >
          {authSubmitting === 'login' ? 'VERIFYING CREDENTIALS...' : 'SIGN IN →'}
        </Button>

        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              setShowRecoveryPanel(prev => !prev);
              setRecoveryError('');
              setRecoverySuccess('');
              if (!recoveryEmail && authEmail) setRecoveryEmail(authEmail);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: showRecoveryPanel ? 'var(--dp-color-accent)' : '#9A9A9A',
              fontSize: '11px',
              fontWeight: 500,
              textTransform: 'uppercase',
              cursor: 'pointer',
              padding: '4px 0',
              textDecoration: 'underline'
            }}
          >
            {showRecoveryPanel ? 'HIDE ACCOUNT RECOVERY ▲' : 'FORGOT PASSWORD? RECOVER ACCOUNT ▼'}
          </button>
        </div>
      </div>

      {/* EXPANDABLE ACCOUNT RECOVERY // FORGOT PASSWORD PANEL */}
      {showRecoveryPanel && (
        <div style={{ marginBottom: '24px' }}>
          <IOSListSection
            header="ACCOUNT RECOVERY // FORGOT PASSWORD"
            footer="We'll email you a secure link to set a new password."
            colors={colors}
          >
            <IOSListRow colors={colors}>
              <div style={{ width: '100%' }}>
                <div style={UI.fieldLabel}>REGISTERED EMAIL ADDRESS</div>
                <input
                  type="email"
                  placeholder="you@domain.com"
                  value={recoveryEmail}
                  onChange={e => {
                    setRecoveryEmail(e.target.value);
                    if (recoveryError) setRecoveryError('');
                  }}
                  style={UI.textInputBare}
                />
              </div>
            </IOSListRow>

            <IOSListRow isLast={true} colors={colors}>
              <div style={{ width: '100%' }}>
                <Button
                  variant="secondary"
                  disabled={authSubmitting === 'recover_email'}
                  onClick={handleSendRecoveryEmail}
                  style={{ padding: '10px', fontSize: '12px', opacity: authSubmitting === 'recover_email' ? 0.6 : 1 }}
                >
                  {authSubmitting === 'recover_email' ? 'SENDING RECOVERY LINK...' : 'SEND RECOVERY EMAIL LINK ↗'}
                </Button>
              </div>
            </IOSListRow>

          </IOSListSection>

          <div style={{ padding: '0 var(--dp-spacing-gutter)' }}>
            {recoveryError && (
              <div
                style={{
                  marginBottom: '10px',
                  padding: '10px 12px',
                  backgroundColor: '#1C1C1C',
                  border: 'none',
              borderRadius: '10px',
                  color: '#FF4A3D',
                  fontSize: '14px',
                  fontWeight: 400,
                  textTransform: 'none',
                  lineHeight: 1.4
                }}
              >
                ⚠ {recoveryError}
              </div>
            )}
            {recoverySuccess && (
              <div
                style={{
                  marginBottom: '10px',
                  padding: '10px 12px',
                  backgroundColor: '#1C1C1C',
                  border: 'none',
              borderRadius: '10px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 400,
                  textTransform: 'none',
                  lineHeight: 1.4
                }}
              >
                ✓ {recoverySuccess}
              </div>
            )}
          </div>
        </div>
      )}

      <IOSListSection
        header="SIGN UP // CREATE ACCOUNT"
        footer="Beta tester access code is required to register a new account."
        colors={colors}
      >
        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>CHOOSE USERNAME</div>
            <input
              type="text"
              placeholder="e.g. iron_lifter"
              value={signupUsername}
              onChange={e => {
                setSignupUsername(e.target.value);
                if (signupError) setSignupError('');
              }}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>

        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>EMAIL ADDRESS</div>
            <input
              type="email"
              placeholder="you@domain.com"
              value={signupEmail}
              onChange={e => {
                setSignupEmail(e.target.value);
                if (signupError) setSignupError('');
              }}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>

        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>CREATE PASSWORD</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type={showSignupPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={signupPassword}
                onChange={e => {
                  setSignupPassword(e.target.value);
                  if (signupError) setSignupError('');
                }}
                style={{ ...UI.textInputBare, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowSignupPassword(prev => !prev)}
                style={showHideBtnStyle(showSignupPassword)}
              >
                {showSignupPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>
        </IOSListRow>

        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>BETA TESTER CODE (REQUIRED)</div>
            <input
              type="text"
              placeholder="Beta code"
              value={signupBetaCode}
              onChange={e => {
                setSignupBetaCode(e.target.value);
                if (signupError) setSignupError('');
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSignUpSubmit();
              }}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>
      </IOSListSection>

      <div style={UI.gutterWrap}>
        {signupNotice && (
          <div
            style={{
              marginBottom: '10px',
              padding: '10px 12px',
              backgroundColor: '#1C1C1C',
              border: 'none',
              borderRadius: '10px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 400,
              textTransform: 'none',
              lineHeight: 1.4
            }}
          >
            ✓ {signupNotice}
          </div>
        )}
        {signupError && (
          <div
            style={{
              marginBottom: '10px',
              padding: '10px 12px',
              backgroundColor: '#1C1C1C',
              border: 'none',
              borderRadius: '10px',
              color: '#FF4A3D',
              fontSize: '14px',
              fontWeight: 400,
              textTransform: 'none',
              lineHeight: 1.4
            }}
          >
            ⚠ {signupError}
          </div>
        )}
        <Button
          variant="success"
          disabled={authSubmitting === 'signup'}
          onClick={handleSignUpSubmit}
          style={{ opacity: authSubmitting === 'signup' ? 0.6 : 1 }}
        >
          {authSubmitting === 'signup' ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT →'}
        </Button>
      </div>
    </div>
  );
}

