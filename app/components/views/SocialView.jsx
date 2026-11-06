'use client';

import React, { useState } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';

export function SocialView({
  colors,
  user,
  friendSearchQuery,
  setFriendSearchQuery,
  pendingIncomingRequests,
  setPendingIncomingRequests,
  outgoingInvites = [],
  setOutgoingInvites,
  onSendEmailInvite,
  friendsList,
  setFriendsList,
  setViewingFriendProfile,
  setCurrentView
}) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const buildInviteMailtoUrl = targetEmail => {
    const cleanTarget = (targetEmail || '').trim().toLowerCase();
    const inviterUsername = user?.username || 'athlete';
    const inviterEmail = user?.email || '';
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://you-cant-cry-in-here.vercel.app';

    const joinParams = new URLSearchParams({
      invite_from: inviterUsername,
      ...(inviterEmail ? { invite_from_email: inviterEmail } : {}),
      invited_email: cleanTarget,
      beta_code: 'imnotcrying'
    });
    const joinUrl = `${origin}/?${joinParams.toString()}`;

    const subject = `Join me on You Can't Cry in Here (Beta Invite from @${inviterUsername})`;
    const body = [
      `Hey!`,
      ``,
      `I'm inviting you to join me on You Can't Cry in Here so we can track lifts, share routines, and compare PRs.`,
      ``,
      `BETA TESTER CODE: imnotcrying`,
      ``,
      `Click the link below to create your account (the beta code is included and we'll automatically be added as friends when you join):`,
      joinUrl,
      ``,
      `— @${inviterUsername}`
    ].join('\r\n');

    return `mailto:${encodeURIComponent(cleanTarget)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const triggerInviteEmail = targetEmail => {
    const cleanTarget = (targetEmail || '').trim().toLowerCase();
    if (!cleanTarget || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTarget)) {
      setInviteError('PLEASE ENTER A VALID EMAIL ADDRESS TO INVITE.');
      setInviteSuccess('');
      return;
    }

    setInviteError('');
    if (onSendEmailInvite) {
      onSendEmailInvite(cleanTarget);
    }

    const mailtoUrl = buildInviteMailtoUrl(cleanTarget);
    if (typeof window !== 'undefined') {
      const a = document.createElement('a');
      a.href = mailtoUrl;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    setInviteEmail('');
    setInviteSuccess(
      `INVITE EMAIL PROMPTED FOR ${cleanTarget.toUpperCase()} WITH BETA CODE "IMNOTCRYING". THEY WILL AUTOMATICALLY BECOME YOUR FRIEND WHEN THEY JOIN.`
    );
  };

  return (
    <div style={{ paddingTop: '14px' }}>
      <IOSListSection
        header="INVITE FRIEND VIA EMAIL"
        footer="Prompts an email with the beta tester code (imnotcrying) and your invite link. When they join, they are automatically added as your friend."
        colors={colors}
      >
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                placeholder="FRIEND@EMAIL.COM"
                value={inviteEmail}
                onChange={e => {
                  setInviteEmail(e.target.value);
                  if (inviteError) setInviteError('');
                  if (inviteSuccess) setInviteSuccess('');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') triggerInviteEmail(inviteEmail);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: '#101010',
                  color: '#FFFFFF',
                  border: '2px solid var(--dp-color-rule)',
                  padding: '10px 12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  textTransform: 'uppercase'
                }}
              />
              <button
                type="button"
                onClick={() => triggerInviteEmail(inviteEmail)}
                className="kinetic-btn"
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--dp-color-accent)',
                  color: '#101010',
                  border: '2px solid #FFFFFF',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
                }}
              >
                INVITE VIA EMAIL ↗
              </button>
            </div>

            {inviteError && (
              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#1A0A0A',
                  border: '2px solid #FF3B30',
                  color: '#FF3B30',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase'
                }}
              >
                ⚠ {inviteError}
              </div>
            )}

            {inviteSuccess && (
              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#0A1A0E',
                  border: '2px solid #30D158',
                  color: '#30D158',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  lineHeight: 1.35
                }}
              >
                ✓ {inviteSuccess}
              </div>
            )}
          </div>
        </IOSListRow>
      </IOSListSection>

      {Array.isArray(outgoingInvites) && outgoingInvites.length > 0 && (
        <IOSListSection
          header={`PENDING EMAIL INVITES (${outgoingInvites.length})`}
          footer="Invited athletes are automatically added to your Friends list once they create an account."
          colors={colors}
        >
          {outgoingInvites.map((inv, idx) => {
            const emailStr = typeof inv === 'string' ? inv : inv?.email || '';
            return (
              <IOSListRow key={emailStr || idx} isLast={idx === outgoingInvites.length - 1} colors={colors}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {emailStr}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#A0A0A0', textTransform: 'uppercase' }}>
                    BETA CODE: IMNOTCRYING • AUTO-FRIEND ON JOIN
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => triggerInviteEmail(emailStr)}
                    style={{
                      padding: '5px 8px',
                      backgroundColor: '#161616',
                      color: 'var(--dp-color-accent)',
                      border: '2px solid var(--dp-color-accent)',
                      fontSize: '10px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer'
                    }}
                  >
                    RESEND ↗
                  </button>
                  {setOutgoingInvites && (
                    <button
                      type="button"
                      onClick={() =>
                        setOutgoingInvites(prev =>
                          (Array.isArray(prev) ? prev : []).filter(
                            item => (typeof item === 'string' ? item : item?.email) !== emailStr
                          )
                        )
                      }
                      style={{
                        width: '26px',
                        height: '26px',
                        backgroundColor: '#FF3B30',
                        color: '#FFFFFF',
                        border: '2px solid #FF3B30',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </IOSListRow>
            );
          })}
        </IOSListSection>
      )}

      <IOSListSection header="FIND ATHLETES" colors={colors}>
        <IOSListRow isLast={true} colors={colors}>
          <input
            type="text"
            placeholder="SEARCH USERNAME OR EMAIL..."
            value={friendSearchQuery}
            onChange={e => setFriendSearchQuery(e.target.value)}
            style={{
              width: '100%', backgroundColor: '#101010', color: '#FFFFFF',
              border: '2px solid var(--dp-color-rule)', padding: '10px 12px',
              fontSize: '13px', fontWeight: 800, textTransform: 'uppercase'
            }}
          />
        </IOSListRow>
      </IOSListSection>

      {pendingIncomingRequests.length > 0 && (
        <IOSListSection header="INCOMING REQUESTS" colors={colors}>
          {pendingIncomingRequests.map((req, idx) => (
            <IOSListRow key={req.id} isLast={idx === pendingIncomingRequests.length - 1} colors={colors}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>@{req.username}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFriendsList(prev => [...prev, req]);
                  setPendingIncomingRequests(prev => prev.filter(r => r.id !== req.id));
                }}
                style={{
                  padding: '6px 12px', backgroundColor: 'var(--dp-color-accent)',
                  color: '#101010', border: '2px solid #FFFFFF', fontSize: '11px', fontWeight: 800, cursor: 'pointer'
                }}
              >
                ACCEPT
              </button>
            </IOSListRow>
          ))}
        </IOSListSection>
      )}

      <IOSListSection
        header={`FRIENDS (${friendsList.length})`}
        footer="Tap any friend to open their Profile page and view their Personal Records and Shared Routines."
        colors={colors}
      >
        {friendsList
          .filter(
            f =>
              !friendSearchQuery.trim() ||
              f.username.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
              (f.email || '').toLowerCase().includes(friendSearchQuery.toLowerCase())
          )
          .map((friend, i, arr) => (
            <IOSListRow
              key={friend.id}
              isLast={i === arr.length - 1}
              colors={colors}
              onClick={() => {
                setViewingFriendProfile(friend);
                setCurrentView('friend_profile');
              }}
            >
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>@{friend.username}</div>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--dp-color-accent)' }}>VIEW PROFILE →</span>
            </IOSListRow>
          ))}
      </IOSListSection>
    </div>
  );
}

