'use client';

// ============================================================================
// ROUTINES SENT STRAIGHT TO A FRIEND (see useRoutineShares, public.routine_shares)
// - SendRoutineModal: SEND on a routine → pick a friend → red SEND TO @x → "Sent to @x."
// - IncomingRoutineModal: a friend sent you a routine → SAVE (to your routines) / LOAD (into your session) / DISMISS
// Text and button labels centred like the sync pop-ups; each pop-up's one red is its confirm button.
// ============================================================================

import React, { useState } from 'react';
import { UI } from '../styles/kineticTokens';
import { Button, CloseButton } from './Controls';
import { ProfileAvatar } from './ProfileAvatar';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { isUuid } from '../utils/supabaseAuth';

const bodyText = { ...UI.sentence, fontSize: '13px', color: '#BDBDBD', lineHeight: 1.45, marginBottom: '12px', textAlign: 'center' };
const centredButton = { display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' };
const titleBlock = { flex: 1, minWidth: 0, textAlign: 'center' };

/** The routine's exercises as one line ("Bench Press · Squat · …"). */
const exerciseLine = (routine, nameOf) =>
  (routine?.slots || [])
    .map(slot => {
      const ids = Array.isArray(slot.supersetExerciseIds) && slot.supersetExerciseIds.length > 1 && /superset/i.test(slot.category || '')
        ? slot.supersetExerciseIds
        : [slot.exerciseId];
      return ids.filter(Boolean).map(nameOf).join(' + ');
    })
    .filter(Boolean)
    .join(' · ');

export function SendRoutineModal({ routine, friends = [], busy = false, sentTo = null, error = '', onSend, onClose }) {
  const [picked, setPicked] = useState(null);
  useModalScrollLock(Boolean(routine));
  if (!routine) return null;
  const sendable = (friends || []).filter(f => isUuid(f?.id));
  const pickedFriend = sendable.find(f => f.id === picked) || null;

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 1300 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('390px')} role="dialog" aria-label="Send routine">
        <div style={UI.modalHeader}>
          <div style={{ ...titleBlock, paddingLeft: '40px' }}>
            <div style={UI.fieldLabel}>SEND ROUTINE</div>
            <div style={{ fontSize: '16px', fontWeight: 500, ...UI.sessionName }}>{routine.label || 'Routine'}</div>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {sentTo ? (
          <>
            <div style={{ ...bodyText, color: '#FFFFFF' }}>
              Sent to @{sentTo}. It shows up the next time they open the app, and they can save it or load it.
            </div>
            <Button variant="secondary" onClick={onClose} style={{ ...centredButton, width: '100%', height: '46px' }}>
              DONE
            </Button>
          </>
        ) : sendable.length === 0 ? (
          <>
            <div style={bodyText}>Add a friend on the Social page to send them routines.</div>
            <Button variant="secondary" onClick={onClose} style={{ ...centredButton, width: '100%', height: '46px' }}>
              CLOSE
            </Button>
          </>
        ) : (
          <>
            <div style={bodyText}>Pick a friend. They get a copy, worked out to their own weights when they load it.</div>
            <div
              role="listbox"
              aria-label="Friends"
              style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto', marginBottom: '12px' }}
            >
              {sendable.map(f => {
                const on = f.id === picked;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className="kinetic-btn"
                    onClick={() => setPicked(f.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      minHeight: '52px',
                      padding: '6px 12px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: on ? '#FFFFFF' : '#2A2A2A',
                      color: on ? '#000000' : '#FFFFFF',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      fontWeight: 500,
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <ProfileAvatar photo={f.profilePhoto} username={f.username} size={32} />
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{f.username}</span>
                  </button>
                );
              })}
            </div>
            {error && <div style={{ ...bodyText, color: 'var(--cr-red-text)' }}>Couldn’t send: {error.toLowerCase()}.</div>}
            <Button
              variant="primary"
              disabled={!pickedFriend || busy}
              onClick={() => pickedFriend && onSend?.(pickedFriend)}
              style={{ ...centredButton, width: '100%', height: '52px' }}
            >
              {busy ? 'SENDING…' : pickedFriend ? `SEND TO @${String(pickedFriend.username).toUpperCase()}` : 'PICK A FRIEND'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function IncomingRoutineModal({ share, exerciseName = id => id, willReplaceSession = false, busy = false, onSave, onLoad, onDismiss }) {
  useModalScrollLock(Boolean(share));
  if (!share) return null;
  const routine = share.routine || {};
  const count = (routine.slots || []).length;
  const line = exerciseLine(routine, exerciseName);
  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 1400 }}>
      <div style={UI.modalCard('390px')} role="dialog" aria-label="Routine received">
        <div style={UI.modalHeader}>
          <div style={titleBlock}>
            <div style={UI.fieldLabel}>@{String(share.sender_username || 'friend').toUpperCase()} SENT YOU A ROUTINE</div>
            <div style={{ fontSize: '16px', fontWeight: 500, ...UI.sessionName }}>{share.label || routine.label || 'Routine'}</div>
          </div>
        </div>
        <div style={{ ...bodyText, fontSize: '12px', fontWeight: 500, color: '#9A9A9A', textTransform: 'uppercase' }}>
          {count} {count === 1 ? 'EXERCISE' : 'EXERCISES'}
        </div>
        {line && <div style={{ ...bodyText, color: '#FFFFFF' }}>{line}</div>}
        <div style={bodyText}>
          Save it to your routines, or load it now. Its weights are worked out from your own history.
          {willReplaceSession ? ' Loading replaces the session you have open (it isn’t saved).' : ''}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
          <Button variant="secondary" disabled={busy} onClick={onLoad} style={{ ...centredButton, height: '46px' }}>
            LOAD NOW
          </Button>
          <Button variant="primary" disabled={busy} onClick={onSave} style={{ ...centredButton, height: '46px' }}>
            SAVE
          </Button>
        </div>
        <Button variant="secondary" disabled={busy} onClick={onDismiss} style={{ ...centredButton, width: '100%', height: '44px', color: '#9A9A9A' }}>
          DISMISS
        </Button>
      </div>
    </div>
  );
}
