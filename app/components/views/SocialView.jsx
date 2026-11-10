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
import { UI } from '../../styles/kineticTokens';
import { SocialSettingsSection } from './SettingsView';

const isEmailAddress = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

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
  setCurrentView,
  // PRIVACY & SHARING settings (moved here from Settings)
  socialSettingsProps
}) {
  const [searchedAthletes, setSearchedAthletes] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  // null | 'signed_out' | 'session' | 'network'
  const [searchError, setSearchError] = useState(null);

  // The query the last search ran for (the SEARCH button becomes SEND INVITE when it was an email
  // with no matching athlete)
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');
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
    const cleanEmail = (friendSearchQuery || '').trim().toLowerCase();
    if (!isEmailAddress(cleanEmail)) {
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
      setFriendSearchQuery('');
      setHasSearched(false);
      setSearchedAthletes([]);
      setLastSearchedQuery('');
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
    setInviteEmailFeedback(null);
    setLastSearchedQuery(q);
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

  // An email with no matching athlete (from a search that actually ran) can be invited instead
  const currentQuery = (friendSearchQuery || '').trim();
  const canSendInvite =
    Boolean(user) &&
    hasSearched &&
    !isSearching &&
    !searchError &&
    searchedAthletes.length === 0 &&
    currentQuery === lastSearchedQuery &&
    isEmailAddress(currentQuery);

  return (
    <div style={{ paddingTop: '14px' }}>
      {/* FIND ATHLETES: the search bar sits straight under the heading (no surrounding box); results and invite
          feedback appear in a list box below it */}
      <section style={{ marginBottom: '22px', padding: '0 var(--dp-spacing-gutter)' }}>
        <div style={{ ...UI.sectionTitle, marginBottom: '8px' }}>FIND ATHLETES</div>
          <div style={{ display: 'flex', width: '100%', gap: 0, height: '52px' }}>
            <input
              type="text"
              placeholder="SEARCH USERNAME OR EMAIL..."
              value={friendSearchQuery}
              onChange={e => {
                setFriendSearchQuery(e.target.value);
                if (inviteEmailFeedback) setInviteEmailFeedback(null);
                if (!e.target.value.trim()) {
                  setHasSearched(false);
                  setSearchedAthletes([]);
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (canSendInvite) handleSendServerEmailInvite();
                  else handleRunAthleteSearch();
                }
              }}
              style={{
                flex: 1,
                minWidth: 0,
                height: '100%',
                boxSizing: 'border-box',
                backgroundColor: '#141414',
                color: '#FFFFFF',
                border: '2px solid var(--dp-color-rule)',
                borderRight: 'none',
                padding: '0 14px',
                fontSize: '15px',
                fontWeight: 800,
                textTransform: 'uppercase',
                outline: 'none'
              }}
            />
            <button
              type="button"
              disabled={isSearching || isSendingInviteEmail}
              onClick={canSendInvite ? handleSendServerEmailInvite : handleRunAthleteSearch}
              className="kinetic-btn"
              style={{
                height: '100%',
                boxSizing: 'border-box',
                padding: '0 18px',
                backgroundColor: canSendInvite ? '#30D158' : 'var(--dp-color-accent)',
                color: '#101010',
                border: '2px solid var(--dp-color-rule)',
                fontSize: '13px',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
            >
              {isSearching
                ? 'SEARCHING...'
                : isSendingInviteEmail
                  ? 'SENDING...'
                  : canSendInvite
                    ? 'SEND INVITE'
                    : 'SEARCH'}
            </button>
          </div>

        {(inviteEmailFeedback || hasSearched) && (
        <div style={{ marginTop: '8px', border: '2px solid var(--dp-color-rule)', backgroundColor: '#141414' }}>
        {inviteEmailFeedback && (
          <IOSListRow isLast={!hasSearched} colors={colors}>
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

        {hasSearched && (
          searchedAthletes.length === 0 ? (
            <IOSListRow isLast={true} colors={colors}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#A0A0A0' }}>
                {!user || searchError === 'signed_out'
                  ? 'Sign in to search for athletes.'
                  : searchError === 'session'
                    ? 'Your session ended. Sign out and sign in again, then retry.'
                    : searchError === 'network'
                      ? 'Search failed. Check your connection and try again.'
                      : canSendInvite
                        ? <>No athlete uses {currentQuery} yet. Tap SEND INVITE to email them an invite.</>
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
        </div>
        )}
      </section>

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
        colors={colors}
      >
        {friendsList.length === 0 && (
          <IOSListRow isLast={true} colors={colors}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#A0A0A0', textTransform: 'uppercase' }}>NO FRIENDS YET</span>
          </IOSListRow>
        )}
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

      <SocialSettingsSection colors={colors} {...socialSettingsProps} />
    </div>
  );
}


