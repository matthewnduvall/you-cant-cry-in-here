'use client';

import React, { useState, useEffect } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  searchAthletesByQuery,
  sendFriendRequestToAthlete,
  acceptFriendRequestFromAthlete,
  removeFriendshipWithAthlete,
  syncFriendshipsForUser,
  getValidSupabaseAccessToken
} from '../../utils/supabaseAuth';
import { isSameFriend, applyFriendshipSync, applyOutgoingInvitesSync } from '../../utils/storageMigration';
import { DeleteButton } from '../Controls';

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
  setDeleteConfirmTarget,
  appendSessionLog,
  setViewingFriendProfile,
  setCurrentView
}) {
  const [searchedAthletes, setSearchedAthletes] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  // null | 'signed_out' | 'session' | 'network'
  const [searchError, setSearchError] = useState(null);

  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [isSendingInviteEmail, setIsSendingInviteEmail] = useState(false);
  const [inviteEmailFeedback, setInviteEmailFeedback] = useState(null);

  // Re-reads friendships from the server (the source of truth) and updates the cached lists.
  const refreshFriendships = async (isCancelled = () => false) => {
    if (!user) return;
    const result = await syncFriendshipsForUser(user);
    if (isCancelled() || !result.ok) return;
    setFriendsList(prev => applyFriendshipSync(prev, result));
    setPendingIncomingRequests(result.incomingRequests);
    setOutgoingInvites?.(prev => applyOutgoingInvitesSync(prev, result));
  };

  const handleSendServerEmailInvite = async () => {
    const cleanEmail = (inviteEmailInput || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setInviteEmailFeedback({
        ok: false,
        message: 'PLEASE ENTER A VALID EMAIL ADDRESS.'
      });
      return;
    }

    setIsSendingInviteEmail(true);
    setInviteEmailFeedback(null);
    try {
      // The invite is recorded as coming from the signed-in account (verified server-side)
      const accessToken = user ? await getValidSupabaseAccessToken(user) : null;
      if (!accessToken) {
        setInviteEmailFeedback({ ok: false, message: 'SIGN IN TO SEND INVITES.' });
        return;
      }
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ targetEmail: cleanEmail })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        setInviteEmailFeedback({
          ok: false,
          message: (data?.error || 'FAILED TO SEND INVITE EMAIL.').toUpperCase()
        });
        return;
      }

      onSendEmailInvite?.(cleanEmail);
      setInviteEmailInput('');
      setInviteEmailFeedback({
        ok: true,
        message: `INVITE SENT TO ${cleanEmail.toUpperCase()}!`
      });
    } catch {
      setInviteEmailFeedback({
        ok: false,
        message: 'NETWORK ERROR SENDING INVITE EMAIL.'
      });
    } finally {
      setIsSendingInviteEmail(false);
    }
  };

  // Sync friendships whenever Social opens
  useEffect(() => {
    let cancelled = false;
    refreshFriendships(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Removing a friend deletes the friendship on the server, which revokes access both ways.
  const handleRemoveFriend = friend => {
    setDeleteConfirmTarget?.({
      type: 'friend',
      title: 'REMOVE FRIEND?',
      verb: 'remove',
      label: `@${friend.username}`,
      confirmLabel: 'REMOVE ✕',
      onConfirm: async () => {
        setFriendsList(prev => (Array.isArray(prev) ? prev : []).filter(f => !isSameFriend(f, friend)));
        const ok = await removeFriendshipWithAthlete(user, friend);
        appendSessionLog?.('FRIEND_REMOVED', `Removed friend @${friend.username}${ok ? '' : ' (server delete failed)'}`);
        if (!ok) await refreshFriendships();
      }
    });
  };

  const handleSendFriendInvite = async athlete => {
    if (!athlete) return;
    setOutgoingInvites?.(prev => {
      const existing = Array.isArray(prev) ? prev : [];
      if (existing.some(item => typeof item === 'object' && isSameFriend(item, athlete))) return existing;
      return [
        ...existing,
        { id: athlete.id, username: athlete.username, invitedAt: new Date().toISOString() }
      ];
    });
    const result = await sendFriendRequestToAthlete(user, athlete);
    if (!result.ok) {
      setOutgoingInvites?.(prev => (Array.isArray(prev) ? prev : []).filter(item => !isSameFriend(item, athlete)));
      return;
    }
    if (result.status !== 'requested') await refreshFriendships();
  };

  const handleAcceptFriendInvite = async req => {
    if (!req) return;
    setPendingIncomingRequests(prev => (Array.isArray(prev) ? prev : []).filter(r => r.id !== req.id));
    await acceptFriendRequestFromAthlete(user, req);
    await refreshFriendships();
  };

  const handleDeclineFriendInvite = async req => {
    if (!req) return;
    setPendingIncomingRequests(prev => (Array.isArray(prev) ? prev : []).filter(r => r.id !== req.id));
    await removeFriendshipWithAthlete(user, req);
  };

  const handleRunAthleteSearch = async () => {
    const q = (friendSearchQuery || '').trim();
    if (!q) {
      setSearchedAthletes([]);
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);
    try {
      const search = await searchAthletesByQuery(q, user);
      if (!search.ok) setSearchError(search.error);
      const remoteMatches = search.results;
      const lowerQ = q.toLowerCase().replace(/^@/, '');
      const friendMatches = (friendsList || []).filter(f => (f.username || '').toLowerCase().includes(lowerQ));
      const byId = new Map();
      [...friendMatches, ...remoteMatches].forEach(item => {
        if (item?.id && !byId.has(item.id)) byId.set(item.id, item);
      });
      setSearchedAthletes(Array.from(byId.values()));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div style={{ paddingTop: '14px' }}>
      <IOSListSection
        header="INVITE FRIEND VIA EMAIL"
        footer="Sends an official invitation from invites@youcantcryinhere.com with the beta access code (imnotcrying) and a direct sign-up link."
        colors={colors}
      >
        <IOSListRow isLast={!inviteEmailFeedback} colors={colors}>
          <div style={{ display: 'flex', width: '100%', gap: 0 }}>
            <input
              type="email"
              placeholder="ENTER FRIEND'S EMAIL ADDRESS..."
              value={inviteEmailInput}
              onChange={e => {
                setInviteEmailInput(e.target.value);
                if (inviteEmailFeedback) setInviteEmailFeedback(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !isSendingInviteEmail) {
                  handleSendServerEmailInvite();
                }
              }}
              style={{
                flex: 1,
                minWidth: 0,
                backgroundColor: '#101010',
                color: '#FFFFFF',
                border: '2px solid var(--dp-color-rule)',
                borderRight: 'none',
                padding: '10px 12px',
                fontSize: '13px',
                fontWeight: 800,
                textTransform: 'uppercase',
                outline: 'none'
              }}
            />
            <button
              type="button"
              disabled={isSendingInviteEmail}
              onClick={handleSendServerEmailInvite}
              className="kinetic-btn"
              style={{
                padding: '10px 16px',
                backgroundColor: 'var(--dp-color-accent)',
                color: '#101010',
                border: '2px solid var(--dp-color-rule)',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: isSendingInviteEmail ? 'default' : 'pointer',
                opacity: isSendingInviteEmail ? 0.6 : 1,
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
            >
              {isSendingInviteEmail ? 'SENDING...' : 'SEND INVITE'}
            </button>
          </div>
        </IOSListRow>
        {inviteEmailFeedback && (
          <IOSListRow isLast={true} colors={colors}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: inviteEmailFeedback.ok ? '#30D158' : '#FF3B30',
                textTransform: 'uppercase'
              }}
            >
              {inviteEmailFeedback.message}
            </span>
          </IOSListRow>
        )}
      </IOSListSection>

      <IOSListSection header="FIND ATHLETES" colors={colors}>
        <IOSListRow
          isLast={!hasSearched}
          colors={colors}
        >
          <div style={{ display: 'flex', width: '100%', gap: 0 }}>
            <input
              type="text"
              placeholder="SEARCH USERNAME OR EMAIL..."
              value={friendSearchQuery}
              onChange={e => {
                setFriendSearchQuery(e.target.value);
                if (!e.target.value.trim()) {
                  setHasSearched(false);
                  setSearchedAthletes([]);
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleRunAthleteSearch();
                }
              }}
              style={{
                flex: 1,
                minWidth: 0,
                backgroundColor: '#101010',
                color: '#FFFFFF',
                border: '2px solid var(--dp-color-rule)',
                borderRight: 'none',
                padding: '10px 12px',
                fontSize: '13px',
                fontWeight: 800,
                textTransform: 'uppercase',
                outline: 'none'
              }}
            />
            <button
              type="button"
              onClick={handleRunAthleteSearch}
              className="kinetic-btn"
              style={{
                padding: '10px 16px',
                backgroundColor: 'var(--dp-color-accent)',
                color: '#101010',
                border: '2px solid var(--dp-color-rule)',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
            >
              {isSearching ? 'SEARCHING...' : 'SEARCH'}
            </button>
          </div>
        </IOSListRow>

        {hasSearched && (
          searchedAthletes.length === 0 ? (
            <IOSListRow isLast={true} colors={colors}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#888888', textTransform: 'uppercase' }}>
                {!user || searchError === 'signed_out'
                  ? 'SIGN IN TO SEARCH FOR ATHLETES.'
                  : searchError === 'session'
                    ? 'YOUR SESSION ENDED. SIGN OUT AND SIGN IN AGAIN, THEN RETRY.'
                    : searchError === 'network'
                      ? 'SEARCH FAILED. CHECK YOUR CONNECTION AND TRY AGAIN.'
                      : <>NO ATHLETES FOUND FOR &quot;{friendSearchQuery.trim().toUpperCase()}&quot;. SEARCH A USERNAME OR AN EXACT EMAIL.</>}
              </span>
            </IOSListRow>
          ) : (
            searchedAthletes.map((athlete, idx) => {
              const existingFriend = (friendsList || []).find(f => isSameFriend(f, athlete));
              const isAlreadyFriend = Boolean(existingFriend);
              const incomingRequestMatch = (pendingIncomingRequests || []).find(r => r.id === athlete.id);
              const isInviteSent = (outgoingInvites || []).some(
                inv => typeof inv === 'object' && isSameFriend(inv, athlete)
              );

              return (
                <IOSListRow
                  key={athlete.id || athlete.username || idx}
                  isLast={idx === searchedAthletes.length - 1}
                  colors={colors}
                >
                  <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>
                    @{athlete.username}
                  </div>
                  {isAlreadyFriend ? (
                    <button
                      type="button"
                      onClick={() => {
                        setViewingFriendProfile(existingFriend);
                        setCurrentView('friend_profile');
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#161618',
                        color: 'var(--dp-color-accent)',
                        border: '2px solid var(--dp-color-rule)',
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        cursor: 'pointer'
                      }}
                    >
                      VIEW PROFILE →
                    </button>
                  ) : incomingRequestMatch ? (
                    <button
                      type="button"
                      onClick={() => handleAcceptFriendInvite(incomingRequestMatch)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'var(--dp-color-accent)',
                        color: '#101010',
                        border: '2px solid #FFFFFF',
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        cursor: 'pointer'
                      }}
                    >
                      ACCEPT
                    </button>
                  ) : isInviteSent ? (
                    <span
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#18181B',
                        color: '#A0A0A0',
                        border: '2px solid var(--dp-color-rule)',
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        userSelect: 'none'
                      }}
                    >
                      REQUEST SENT
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendFriendInvite(athlete)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'var(--dp-color-accent)',
                        color: '#101010',
                        border: '2px solid #FFFFFF',
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        cursor: 'pointer'
                      }}
                    >
                      + ADD FRIEND
                    </button>
                  )}
                </IOSListRow>
              );
            })
          )
        )}
      </IOSListSection>

      {pendingIncomingRequests.length > 0 && (
        <IOSListSection header="INCOMING REQUESTS" colors={colors}>
          {pendingIncomingRequests.map((req, idx) => (
            <IOSListRow key={req.id || req.username || idx} isLast={idx === pendingIncomingRequests.length - 1} colors={colors}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>@{req.username}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => handleAcceptFriendInvite(req)}
                  style={{
                    padding: '6px 12px', backgroundColor: 'var(--dp-color-accent)',
                    color: '#101010', border: '2px solid #FFFFFF', fontSize: '11px', fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  ACCEPT
                </button>
                <DeleteButton label={`Decline @${req.username}`} onClick={() => handleDeclineFriendInvite(req)} />
              </div>
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
              (f.username || '').toLowerCase().includes(friendSearchQuery.toLowerCase().replace(/^@/, ''))
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <DeleteButton
                  label={`Remove @${friend.username} from friends`}
                  onClick={() => handleRemoveFriend(friend)}
                />
                <div style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>@{friend.username}</div>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--dp-color-accent)', flexShrink: 0 }}>
                VIEW PROFILE →
              </span>
            </IOSListRow>
          ))}
      </IOSListSection>
    </div>
  );
}


