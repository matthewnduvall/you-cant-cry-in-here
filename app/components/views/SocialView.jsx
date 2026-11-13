'use client';

import React, { useState, useEffect } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  searchAthletesByQuery,
  sendFriendRequestToAthlete,
  acceptFriendRequestFromAthlete,
  removeFriendshipWithAthlete,
  syncFriendshipsForUser,
  fetchMyPendingEmailInvites,
  getValidSupabaseAccessToken
} from '../../utils/supabaseAuth';
import { isSameFriend, applyFriendshipSync, applyOutgoingInvitesSync } from '../../utils/storageMigration';
import { formatDateYMD } from '../../data/exerciseLibrary';
import { DeleteButton, TabBar } from '../Controls';
import { ProfileAvatar } from '../ProfileAvatar';
import { UI } from '../../styles/kineticTokens';
import { SocialSettingsSection } from './SettingsView';

// The Friends page (view id 'social'): FRIENDS (find athletes, requests, friends list) · PRIVACY. Leaderboards are
// their own page now (view 'leaderboards').
const SOCIAL_TABS = [
  { id: 'friends', label: 'FRIENDS' },
  { id: 'privacy', label: 'PRIVACY' }
];

// One red per component: a list's ✕ buttons are grey (they still ask first, or are reversible)
const GREY_X = { color: '#9A9A9A' };

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
  socialSettingsProps,
  // Opens on this tab (e.g. 'privacy' from your profile's PRIVACY →); onInitialTabUsed lets the page reset it
  initialTab = 'friends',
  onInitialTabUsed
}) {
  const [socialTab, setSocialTab] = useState(initialTab);
  useEffect(() => {
    if (initialTab !== 'friends') onInitialTabUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on opening the page
  }, []);
  // A photo for any athlete who is your friend (search results and requests only carry a username)
  const photoOf = id => (friendsList || []).find(f => f.id === id)?.profilePhoto || null;
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
  // Email invites nobody has joined from yet (server: friend_invites still pending), for SENT REQUESTS
  const [pendingEmailInvites, setPendingEmailInvites] = useState([]);

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
        message: 'Please enter a valid email address.'
      });
      return;
    }

    setIsSendingInviteEmail(true);
    setInviteEmailFeedback(null);
    try {
      // The invite is recorded as coming from the signed-in account (verified server-side)
      const accessToken = user ? await getValidSupabaseAccessToken(user) : null;
      if (!accessToken) {
        setInviteEmailFeedback({ ok: false, message: 'Sign in to send invites.' });
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
          message: data?.error || 'Failed to send the invite email.'
        });
        return;
      }

      onSendEmailInvite?.(cleanEmail);
      setPendingEmailInvites(prev =>
        prev.some(inv => inv.email === cleanEmail) ? prev : [{ email: cleanEmail, sentAt: new Date().toISOString() }, ...prev]
      );
      setFriendSearchQuery('');
      setHasSearched(false);
      setSearchedAthletes([]);
      setLastSearchedQuery('');
      setInviteEmailFeedback({
        ok: true,
        message: data?.warning
          ? `Invite sent to ${cleanEmail}. ${String(data.warning)}`
          : `Invite sent to ${cleanEmail}.`
      });
    } catch {
      setInviteEmailFeedback({
        ok: false,
        message: 'Network error sending the invite email.'
      });
    } finally {
      setIsSendingInviteEmail(false);
    }
  };

  // Email invites nobody has joined from yet, read whenever Social opens (SENT REQUESTS)
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    fetchMyPendingEmailInvites(user).then(result => {
      if (!cancelled && result.ok) setPendingEmailInvites(result.invites);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Sync friendships whenever Social opens
  useEffect(() => {
    let cancelled = false;
    refreshFriendships(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Removing a friend happens on their profile (REMOVE FRIEND), not in this list

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

  // Cancelling a sent request deletes the pending friendship row (either athlete may delete it)
  const handleCancelSentRequest = request => {
    setDeleteConfirmTarget?.({
      type: 'friend',
      title: 'WITHDRAW REQUEST?',
      verb: 'withdraw your friend request to',
      label: `@${request.username}`,
      confirmLabel: 'WITHDRAW ✕',
      onConfirm: async () => {
        setOutgoingInvites?.(prev => (Array.isArray(prev) ? prev : []).filter(item => !isSameFriend(item, request)));
        const ok = await removeFriendshipWithAthlete(user, request);
        appendSessionLog?.('FRIEND_REQUEST_CANCELLED', `Cancelled request to @${request.username}${ok ? '' : ' (server delete failed)'}`);
        if (!ok) await refreshFriendships();
      }
    });
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

  // SENT REQUESTS: in-app friend requests still waiting (kept in step with the server by applyOutgoingInvitesSync)
  // and email invites nobody has joined from yet. Signed in only; not counted anywhere else.
  const sentFriendRequests = user
    ? (outgoingInvites || []).filter(
        inv =>
          inv && typeof inv === 'object' && inv.id && inv.username && !(friendsList || []).some(f => isSameFriend(f, inv))
      )
    : [];
  const sentEmailInvites = user ? pendingEmailInvites : [];
  const sentCount = sentFriendRequests.length + sentEmailInvites.length;
  const sentSubStyle = { fontSize: '11px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase', marginTop: '2px' };

  return (
    <div style={{ paddingTop: '12px' }}>
      <div style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '14px' }}>
        <TabBar
          ariaLabel="Friends"
          // Waiting friend requests show on the FRIENDS tab, e.g. FRIENDS (2)
          tabs={SOCIAL_TABS.map(t =>
            t.id === 'friends' && pendingIncomingRequests.length > 0 ? { ...t, label: `FRIENDS (${pendingIncomingRequests.length})` } : t
          )}
          value={socialTab}
          onChange={setSocialTab}
        />
      </div>

      {socialTab === 'privacy' && <SocialSettingsSection colors={colors} collapsible={false} {...socialSettingsProps} />}

      {socialTab === 'friends' && (
      <>
      {/* FIND ATHLETES: the search bar sits straight under the heading (no surrounding box); results and invite
          feedback appear in a list box below it */}
      <section style={{ marginBottom: '22px', padding: '0 var(--dp-spacing-gutter)' }}>
        <div style={{ ...UI.sectionTitle, marginBottom: '8px' }}>FIND ATHLETES</div>
          <div style={{ display: 'flex', width: '100%', gap: 0, height: '52px' }}>
            <input
              type="text"
              placeholder="Username or email"
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
                backgroundColor: '#1C1C1C',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px 0 0 12px',
                padding: '0 14px',
                fontSize: '15px',
                fontWeight: 400,
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
                // SEND INVITE (an email with no athlete yet) is the action: red; SEARCH is white
                backgroundColor: canSendInvite ? 'var(--cr-red)' : '#FFFFFF',
                color: canSendInvite ? '#FFFFFF' : '#000000',
                border: 'none',
                borderRadius: '0 12px 12px 0',
                fontSize: '12px',
                letterSpacing: '0.08em',
                fontWeight: 600,
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
        <div style={{ marginTop: '8px', backgroundColor: '#1C1C1C', borderRadius: '14px', overflow: 'hidden' }}>
        {inviteEmailFeedback && (
          <IOSListRow isLast={!hasSearched} colors={colors}>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 400,
                lineHeight: 1.4,
                color: inviteEmailFeedback.ok ? '#FFFFFF' : '#FF4A3D'
              }}
            >
              {inviteEmailFeedback.message}
            </span>
          </IOSListRow>
        )}

        {hasSearched && (
          searchedAthletes.length === 0 ? (
            <IOSListRow isLast={true} colors={colors}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <ProfileAvatar photo={photoOf(athlete.id)} username={athlete.username} size={32} />
                    <span style={{ fontSize: '15px', fontWeight: 500 }}>@{athlete.username}</span>
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
                        backgroundColor: '#1C1C1C',
                        color: 'var(--dp-color-accent)',
                        border: 'none', borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 500,
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
                        color: '#000000',
                        border: '2px solid #FFFFFF',
                        fontSize: '11px',
                        fontWeight: 500,
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
                        backgroundColor: '#1C1C1C',
                        color: '#9A9A9A',
                        border: 'none', borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 500,
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
                        color: '#000000',
                        border: '2px solid #FFFFFF',
                        fontSize: '11px',
                        fontWeight: 500,
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <ProfileAvatar photo={photoOf(req.id)} username={req.username} size={32} />
                <div style={{ fontSize: '15px', fontWeight: 500 }}>@{req.username}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => handleAcceptFriendInvite(req)}
                  style={{
                    padding: '6px 12px', backgroundColor: 'var(--dp-color-accent)',
                    color: '#000000', border: '2px solid #FFFFFF', fontSize: '11px', fontWeight: 500, cursor: 'pointer'
                  }}
                >
                  ACCEPT
                </button>
                <DeleteButton label={`Decline @${req.username}`} onClick={() => handleDeclineFriendInvite(req)} style={GREY_X} />
              </div>
            </IOSListRow>
          ))}
        </IOSListSection>
      )}

      {sentCount > 0 && (
        <IOSListSection header={`SENT REQUESTS (${sentCount})`} colors={colors}>
          {sentFriendRequests.map((req, idx) => (
            <IOSListRow
              key={`req_${req.id}`}
              isLast={idx === sentCount - 1}
              colors={colors}
            >
              <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ProfileAvatar photo={photoOf(req.id)} username={req.username} size={32} />
                <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 500 }}>@{req.username}</div>
                <div style={sentSubStyle}>
                  FRIEND REQUEST{req.invitedAt ? ` • SENT ${formatDateYMD(req.invitedAt)}` : ''} • WAITING
                </div>
                </div>
              </div>
              <DeleteButton label={`Withdraw friend request to @${req.username}`} onClick={() => handleCancelSentRequest(req)} style={GREY_X} />
            </IOSListRow>
          ))}
          {sentEmailInvites.map((inv, idx) => (
            <IOSListRow
              key={`email_${inv.email}`}
              isLast={sentFriendRequests.length + idx === sentCount - 1}
              colors={colors}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 500, overflowWrap: 'anywhere' }}>{inv.email}</div>
                <div style={sentSubStyle}>
                  EMAIL INVITE{inv.sentAt ? ` • SENT ${formatDateYMD(inv.sentAt)}` : ''} • NOT JOINED YET
                </div>
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
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase' }}>NO FRIENDS YET</span>
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
                <ProfileAvatar photo={friend.profilePhoto} username={friend.username} size={36} />
                <div style={{ fontSize: '16px', fontWeight: 500 }}>@{friend.username}</div>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--dp-color-accent)', flexShrink: 0 }}>
                VIEW PROFILE →
              </span>
            </IOSListRow>
          ))}
      </IOSListSection>
      </>
      )}
    </div>
  );
}


