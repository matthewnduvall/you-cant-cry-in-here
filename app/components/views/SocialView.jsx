'use client';

import React, { useState, useEffect } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  searchAthletesByQuery,
  sendFriendRequestToAthlete,
  acceptFriendRequestFromAthlete,
  removeFriendshipWithAthlete,
  resolveInviteFriendshipsForUser
} from '../../utils/supabaseAuth';
import { isSameFriend, mergeFriendsIntoList } from '../../utils/storageMigration';
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
  removedFriends = [],
  setRemovedFriends,
  setDeleteConfirmTarget,
  appendSessionLog,
  setViewingFriendProfile,
  setCurrentView
}) {
  const [searchedAthletes, setSearchedAthletes] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [isSendingInviteEmail, setIsSendingInviteEmail] = useState(false);
  const [inviteEmailFeedback, setInviteEmailFeedback] = useState(null);

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
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail: cleanEmail,
          inviterUsername: user?.username || 'athlete',
          inviterEmail: user?.email || '',
          inviterUserId: user?.id || null
        })
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

  // Sync incoming requests & accepted friendships whenever SocialView opens
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { incomingRequests, matchedFriends, resolvedInviteEmails } =
          await resolveInviteFriendshipsForUser(user, outgoingInvites, friendsList);
        if (cancelled) return;

        if (Array.isArray(incomingRequests)) {
          setPendingIncomingRequests(prev => {
            const byKey = new Map();
            (Array.isArray(prev) ? prev : []).forEach(r => {
              if (!r) return;
              const k = String(r.username || r.email || r.id).toLowerCase();
              byKey.set(k, r);
            });
            incomingRequests.forEach(r => {
              if (!r) return;
              const k = String(r.username || r.email || r.id).toLowerCase();
              byKey.set(k, r);
            });
            const friendKeys = new Set(
              (Array.isArray(friendsList) ? friendsList : []).map(f =>
                String(f?.username || f?.email || f?.id).toLowerCase()
              )
            );
            return Array.from(byKey.values()).filter(
              r => !friendKeys.has(String(r?.username || r?.email || r?.id).toLowerCase())
            );
          });
        }

        if (Array.isArray(matchedFriends) && matchedFriends.length > 0) {
          setFriendsList(prev =>
            mergeFriendsIntoList(prev, matchedFriends, removedFriends, { preferIncoming: true })
          );
        }

        if (Array.isArray(resolvedInviteEmails) && resolvedInviteEmails.length > 0 && setOutgoingInvites) {
          setOutgoingInvites(prev =>
            (Array.isArray(prev) ? prev : []).filter(inv => {
              const em = (typeof inv === 'string' ? inv : inv?.email || '').trim().toLowerCase();
              const un = (typeof inv === 'object' && inv?.username ? inv.username : '').trim().toLowerCase();
              return !resolvedInviteEmails.includes(em) && (!un || !resolvedInviteEmails.includes(un));
            })
          );
        }
      } catch {
        // ignore sync error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, user?.username]);

  // Re-friending someone takes them back off the removed list.
  const unremoveFriend = athlete => setRemovedFriends?.(prev => (prev || []).filter(r => !isSameFriend(r, athlete)));

  const handleRemoveFriend = friend => {
    setDeleteConfirmTarget?.({
      type: 'friend',
      title: 'REMOVE FRIEND?',
      verb: 'remove',
      label: `@${friend.username}`,
      confirmLabel: 'REMOVE ✕',
      onConfirm: () => {
        const record = { id: friend.id, username: friend.username, email: friend.email };
        setRemovedFriends?.(prev => [...(prev || []).filter(r => !isSameFriend(r, record)), record]);
        setFriendsList(prev => (Array.isArray(prev) ? prev : []).filter(f => !isSameFriend(f, record)));
        removeFriendshipWithAthlete(user, friend);
        appendSessionLog?.('FRIEND_REMOVED', `Removed friend @${friend.username}`);
      }
    });
  };

  const handleSendFriendInvite = async athlete => {
    if (!athlete) return;
    unremoveFriend(athlete);
    const cleanEmail = (athlete.email || '').trim().toLowerCase();
    const cleanUsername = (athlete.username || '').trim();
    if (setOutgoingInvites) {
      setOutgoingInvites(prev => {
        const existing = Array.isArray(prev) ? prev : [];
        const already = existing.some(item => {
          const em = (typeof item === 'string' ? item : item?.email || '').trim().toLowerCase();
          const un = (typeof item === 'object' && item?.username ? item.username : '').trim().toLowerCase();
          return (cleanEmail && em === cleanEmail) || (cleanUsername && un === cleanUsername.toLowerCase());
        });
        if (already) return existing;
        return [
          ...existing,
          {
            id: athlete.id,
            username: cleanUsername,
            email: cleanEmail,
            invitedAt: new Date().toISOString(),
            inviterUsername: user?.username || 'athlete'
          }
        ];
      });
    }
    await sendFriendRequestToAthlete(user, athlete);
  };

  const handleAcceptFriendInvite = async req => {
    if (!req) return;
    unremoveFriend(req);
    setFriendsList(prev => {
      const list = Array.isArray(prev) ? prev : [];
      const exists = list.some(
        f =>
          (f.username || '').toLowerCase() === (req.username || '').toLowerCase() ||
          (req.email && (f.email || '').toLowerCase() === req.email.toLowerCase())
      );
      return exists ? list : [...list, req];
    });
    setPendingIncomingRequests(prev =>
      (Array.isArray(prev) ? prev : []).filter(
        r =>
          (r.username || '').toLowerCase() !== (req.username || '').toLowerCase() &&
          (!req.email || (r.email || '').toLowerCase() !== req.email.toLowerCase())
      )
    );
    await acceptFriendRequestFromAthlete(user, req);
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
    try {
      const remoteMatches = await searchAthletesByQuery(q, user);
      const lowerQ = q.toLowerCase().replace(/^@/, '');
      const localFriendMatches = (friendsList || []).filter(
        f =>
          f &&
          ((f.username || '').toLowerCase().includes(lowerQ) ||
            (f.email || '').toLowerCase().includes(lowerQ))
      );
      const mergedMap = new Map();
      [...localFriendMatches, ...remoteMatches].forEach(item => {
        if (!item) return;
        const key = (item.username || item.email || item.id || '').toLowerCase();
        if (key && !mergedMap.has(key)) {
          mergedMap.set(key, item);
        }
      });
      setSearchedAthletes(Array.from(mergedMap.values()));
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
                NO ATHLETES FOUND FOR &quot;{friendSearchQuery.trim().toUpperCase()}&quot;.
              </span>
            </IOSListRow>
          ) : (
            searchedAthletes.map((athlete, idx) => {
              const isAlreadyFriend = (friendsList || []).some(
                f =>
                  (f.username || '').toLowerCase() === (athlete.username || '').toLowerCase() ||
                  (athlete.email && (f.email || '').toLowerCase() === athlete.email.toLowerCase())
              );
              const incomingRequestMatch = (pendingIncomingRequests || []).find(
                r =>
                  (r.username || '').toLowerCase() === (athlete.username || '').toLowerCase() ||
                  (athlete.email && (r.email || '').toLowerCase() === athlete.email.toLowerCase())
              );
              const isInviteSent = (outgoingInvites || []).some(inv => {
                const em = (typeof inv === 'string' ? inv : inv?.email || '').trim().toLowerCase();
                const un = (typeof inv === 'object' && inv?.username ? inv.username : '').trim().toLowerCase();
                return (
                  (athlete.email && em === athlete.email.toLowerCase()) ||
                  (athlete.username &&
                    (un === athlete.username.toLowerCase() || em === athlete.username.toLowerCase()))
                );
              });

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
                        const existingFriend =
                          (friendsList || []).find(
                            f => (f.username || '').toLowerCase() === (athlete.username || '').toLowerCase()
                          ) || athlete;
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
                      INVITE SENT
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


