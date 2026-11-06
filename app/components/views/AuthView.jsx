'use client';

import React, { useState } from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  registerUserAccount,
  signInUserAccount,
  requestPasswordRecoveryEmail,
  completePasswordRecoveryWithToken,
  resetPasswordWithBetaCode
} from '../../utils/supabaseAuth';

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
  setCurrentView
}) {
  const [loginError, setLoginError] = useState('');
  const [signupError, setSignupError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(null);

  // Password visibility toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);

  // Account recovery state
  const [showRecoveryPanel, setShowRecoveryPanel] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryBetaCode, setRecoveryBetaCode] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');

  const showHideBtnStyle = isShown => ({
    padding: '5px 10px',
    backgroundColor: isShown ? 'var(--dp-color-accent)' : '#101010',
    color: isShown ? '#101010' : '#FFFFFF',
    border: '2px solid var(--dp-color-rule)',
    fontSize: '10px',
    fontWeight: 800,
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
      setUser(result.user);
      if (onInviteAccepted) onInviteAccepted(result.user);
      setAuthUsername(result.user.username);
      setAuthEmail(result.user.email);
      setAuthPassword('');
      let hasOnboarded = false;
      if (typeof window !== 'undefined' && result.user) {
        try {
          const map = JSON.parse(window.localStorage.getItem('yccih_onboarded_users_v1') || '{}');
          const uKey = (result.user.email || result.user.username || result.user.id || '').toLowerCase();
          hasOnboarded = Boolean(map[uKey]);
          if (!hasOnboarded) {
            map[uKey] = true;
            window.localStorage.setItem('yccih_onboarded_users_v1', JSON.stringify(map));
          }
        } catch {
          hasOnboarded = true;
        }
      }
      setCurrentView(hasOnboarded ? 'home' : 'onboarding');
    } catch (err) {
      setLoginError(err?.message || 'SIGN IN FAILED. CHECK YOUR USERNAME/EMAIL AND PASSWORD.');
    } finally {
      setAuthSubmitting(null);
    }
  };

  const handleSignUpSubmit = async () => {
    if (authSubmitting) return;
    setSignupError('');
    setLoginError('');
    setAuthSubmitting('signup');
    try {
      const result = await registerUserAccount({
        username: signupUsername,
        email: signupEmail,
        password: signupPassword,
        betaCode: signupBetaCode
      });
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
      setCurrentView('onboarding');
    } catch (err) {
      setSignupError(err?.message || 'ACCOUNT CREATION FAILED. VERIFY ALL FIELDS AND BETA CODE.');
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
      setRecoveryError(err?.message || 'FAILED TO SEND RECOVERY EMAIL.');
    } finally {
      setAuthSubmitting(null);
    }
  };

  const handleResetWithBetaCode = async () => {
    if (authSubmitting) return;
    setRecoveryError('');
    setRecoverySuccess('');
    setAuthSubmitting('recover_beta');
    try {
      const result = await resetPasswordWithBetaCode({
        email: recoveryEmail || authEmail,
        username: recoveryUsername || authUsername,
        betaCode: recoveryBetaCode,
        newPassword: recoveryNewPassword
      });
      setUser(result.user);
      setAuthUsername(result.user.username);
      setAuthEmail(result.user.email);
      setRecoveryNewPassword('');
      setRecoveryBetaCode('');
      setShowRecoveryPanel(false);
      setCurrentView('home');
    } catch (err) {
      setRecoveryError(err?.message || 'PASSWORD RESET FAILED.');
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
        accessToken: recoveryAccessToken,
        newPassword: recoveryNewPassword
      });
      if (setRecoveryAccessToken) setRecoveryAccessToken(null);
      setUser(result.user);
      setAuthUsername(result.user.username);
      setAuthEmail(result.user.email);
      setRecoveryNewPassword('');
      setCurrentView('home');
    } catch (err) {
      setRecoveryError(err?.message || 'FAILED TO UPDATE PASSWORD.');
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
            backgroundColor: '#0A1A0E',
            border: '2px solid #30D158',
            color: '#30D158',
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            lineHeight: 1.4
          }}
        >
          ✓ INVITED BY @{pendingInviter.username} — BETA CODE &quot;IMNOTCRYING&quot; APPLIED. CREATE YOUR ACCOUNT BELOW TO AUTOMATICALLY BECOME FRIENDS.
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
                    placeholder="MIN 6 CHARACTERS"
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
                  backgroundColor: '#1A0A0A',
                  border: '2px solid #FF3B30',
                  color: '#FF3B30',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  lineHeight: 1.4
                }}
              >
                ⚠ {recoveryError}
              </div>
            )}
            <button
              type="button"
              disabled={authSubmitting === 'recover_token'}
              onClick={handleCompleteTokenReset}
              className="kinetic-btn"
              style={UI.primaryBtnCenter}
            >
              {authSubmitting === 'recover_token' ? 'SAVING NEW PASSWORD...' : 'SAVE NEW PASSWORD & SIGN IN →'}
            </button>
          </div>
        </div>
      )}

      <IOSListSection header="SIGN IN // EXISTING ACCOUNT" colors={colors}>
        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>USERNAME OR EMAIL</div>
            <input
              type="text"
              placeholder="USERNAME OR YOU@DOMAIN.COM"
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
              backgroundColor: '#1A0A0A',
              border: '2px solid #FF3B30',
              color: '#FF3B30',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              lineHeight: 1.4
            }}
          >
            ⚠ {loginError}
          </div>
        )}
        <button
          type="button"
          disabled={authSubmitting === 'login'}
          onClick={handleSignInSubmit}
          className="kinetic-btn"
          style={{
            ...UI.secondaryBtnCenter,
            opacity: authSubmitting === 'login' ? 0.6 : 1
          }}
        >
          {authSubmitting === 'login' ? 'VERIFYING CREDENTIALS...' : 'SIGN IN →'}
        </button>

        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              setShowRecoveryPanel(prev => !prev);
              setRecoveryError('');
              setRecoverySuccess('');
              if (!recoveryEmail && authEmail) setRecoveryEmail(authEmail);
              if (!recoveryUsername && authUsername) setRecoveryUsername(authUsername);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: showRecoveryPanel ? 'var(--dp-color-accent)' : '#A0A0A0',
              fontSize: '11px',
              fontWeight: 800,
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
            footer="Recover via an email reset link (cross-device) OR reset immediately on this device using your Username and Beta Tester Code."
            colors={colors}
          >
            <IOSListRow colors={colors}>
              <div style={{ width: '100%' }}>
                <div style={UI.fieldLabel}>REGISTERED EMAIL ADDRESS</div>
                <input
                  type="email"
                  placeholder="YOU@DOMAIN.COM"
                  value={recoveryEmail}
                  onChange={e => {
                    setRecoveryEmail(e.target.value);
                    if (recoveryError) setRecoveryError('');
                  }}
                  style={UI.textInputBare}
                />
              </div>
            </IOSListRow>

            <IOSListRow colors={colors}>
              <div style={{ width: '100%' }}>
                <div style={UI.fieldLabel}>OPTION 1: EMAIL RECOVERY LINK</div>
                <button
                  type="button"
                  disabled={authSubmitting === 'recover_email'}
                  onClick={handleSendRecoveryEmail}
                  className="kinetic-btn"
                  style={{
                    ...UI.secondaryBtnCenter,
                    padding: '10px',
                    fontSize: '12px',
                    opacity: authSubmitting === 'recover_email' ? 0.6 : 1
                  }}
                >
                  {authSubmitting === 'recover_email' ? 'SENDING RECOVERY LINK...' : 'SEND RECOVERY EMAIL LINK ↗'}
                </button>
              </div>
            </IOSListRow>

            <IOSListRow colors={colors}>
              <div style={{ width: '100%' }}>
                <div style={UI.fieldLabel}>OPTION 2: INSTANT RESET — ACCOUNT USERNAME</div>
                <input
                  type="text"
                  placeholder="YOUR REGISTERED USERNAME"
                  value={recoveryUsername}
                  onChange={e => {
                    setRecoveryUsername(e.target.value);
                    if (recoveryError) setRecoveryError('');
                  }}
                  style={UI.textInputBare}
                />
              </div>
            </IOSListRow>

            <IOSListRow colors={colors}>
              <div style={{ width: '100%' }}>
                <div style={UI.fieldLabel}>BETA TESTER CODE (REQUIRED FOR INSTANT RESET)</div>
                <input
                  type="text"
                  placeholder="ENTER BETA CODE"
                  value={recoveryBetaCode}
                  onChange={e => {
                    setRecoveryBetaCode(e.target.value);
                    if (recoveryError) setRecoveryError('');
                  }}
                  style={UI.textInputBare}
                />
              </div>
            </IOSListRow>

            <IOSListRow isLast={true} colors={colors}>
              <div style={{ width: '100%' }}>
                <div style={UI.fieldLabel}>NEW PASSWORD</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type={showRecoveryPassword ? 'text' : 'password'}
                    placeholder="MIN 6 CHARACTERS"
                    value={recoveryNewPassword}
                    onChange={e => {
                      setRecoveryNewPassword(e.target.value);
                      if (recoveryError) setRecoveryError('');
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleResetWithBetaCode();
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
                  backgroundColor: '#1A0A0A',
                  border: '2px solid #FF3B30',
                  color: '#FF3B30',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
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
                  backgroundColor: '#0A1A0E',
                  border: '2px solid #30D158',
                  color: '#30D158',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  lineHeight: 1.4
                }}
              >
                ✓ {recoverySuccess}
              </div>
            )}
            <button
              type="button"
              disabled={authSubmitting === 'recover_beta'}
              onClick={handleResetWithBetaCode}
              className="kinetic-btn"
              style={{
                ...UI.primaryBtnCenter,
                opacity: authSubmitting === 'recover_beta' ? 0.6 : 1
              }}
            >
              {authSubmitting === 'recover_beta' ? 'RESETTING PASSWORD...' : 'RESET PASSWORD NOW →'}
            </button>
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
              placeholder="E.G. IRON_LIFTER"
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
              placeholder="YOU@DOMAIN.COM"
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
                placeholder="MIN 6 CHARACTERS"
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
              placeholder="ENTER BETA CODE"
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
        {signupError && (
          <div
            style={{
              marginBottom: '10px',
              padding: '10px 12px',
              backgroundColor: '#1A0A0A',
              border: '2px solid #FF3B30',
              color: '#FF3B30',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              lineHeight: 1.4
            }}
          >
            ⚠ {signupError}
          </div>
        )}
        <button
          type="button"
          disabled={authSubmitting === 'signup'}
          onClick={handleSignUpSubmit}
          className="kinetic-btn"
          style={{
            ...UI.primaryBtnCenter,
            opacity: authSubmitting === 'signup' ? 0.6 : 1
          }}
        >
          {authSubmitting === 'signup' ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT →'}
        </button>
      </div>
    </div>
  );
}

