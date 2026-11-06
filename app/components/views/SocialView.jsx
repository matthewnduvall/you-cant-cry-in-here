'use client';

import React, { useState } from 'react';
import { IOSListSection, IOSListRow } from '../Primitives';
import { searchAthletesByQuery } from '../../utils/supabaseAuth';

export function SocialView({
  colors,
  user,
  friendSearchQuery,
  setFriendSearchQuery,
  pendingIncomingRequests,
  setPendingIncomingRequests,
  friendsList,
  setFriendsList,
  setViewingFriendProfile,
  setCurrentView
}) {
  const [searchedAthletes, setSearchedAthletes] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

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
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setFriendsList(prev => [...(prev || []), athlete]);
                      }}
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


