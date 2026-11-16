'use client';

// ============================================================================
// ROUTINES SENT STRAIGHT TO A FRIEND (see useRoutineShares, public.routine_shares)
// - SendRoutineModal: SEND on a routine → @friends (every friend) or one @friend → red SEND TO @x → "Sent to @x."
// Received routines wait in the Routines page's INBOX tab (no pop-up); the count shows on Home and in the menu.
// Text and button labels centred like the sync pop-ups; each pop-up's one red is its confirm button.
// ============================================================================

import React, { useState } from 'react';
import { UI } from '../styles/kineticTokens';
import { Button, CloseButton } from './Controls';
import { PickBadge, PickList, PickRow, friendAvatar } from './PickList';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { isUuid } from '../utils/supabaseAuth';

const bodyText = { ...UI.sentence, fontSize: '13px', color: '#BDBDBD', lineHeight: 1.45, marginBottom: '12px', textAlign: 'center' };
const centredButton = { display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' };
const titleBlock = { flex: 1, minWidth: 0, textAlign: 'center' };

export function SendRoutineModal({ routine, friends = [], busy = false, sentTo = null, error = '', onSend, onClose }) {
  const [picked, setPicked] = useState(null);
  useModalScrollLock(Boolean(routine));
  if (!routine) return null;
  const sendable = (friends || []).filter(f => isUuid(f?.id));
  // '@friends' = every friend (each gets their own copy), else one friend's id
  const ALL = '@friends';
  const pickedFriend = sendable.find(f => f.id === picked) || null;
  const pickedTargets = picked === ALL ? sendable : pickedFriend ? [pickedFriend] : [];

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 1300 }}>
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
              Sent to {String(sentTo).startsWith('@') ? sentTo : `@${sentTo}`}. It shows up in their Routines INBOX the
              next time they open the app.
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
            <div style={bodyText}>
              Send to @friends (everyone) or to one friend. Each gets a copy in their Routines INBOX, worked out to
              their own weights when they load it.
            </div>
            <PickList label="Friends" multiselect={false} maxHeight="280px" style={{ marginBottom: '12px' }}>
              {[{ id: ALL, username: 'friends', all: true }, ...sendable].map(f => (
                <PickRow
                  key={f.id}
                  on={f.id === picked}
                  showCheck={false}
                  minHeight="52px"
                  label={`@${f.username}`}
                  sub={f.all ? `all ${sendable.length} ${sendable.length === 1 ? 'friend' : 'friends'}` : ''}
                  avatar={
                    f.all ? (
                      <PickBadge on={f.id === picked} size={32}>
                        @
                      </PickBadge>
                    ) : (
                      friendAvatar(f, 32)
                    )
                  }
                  onClick={() => setPicked(f.id)}
                />
              ))}
            </PickList>
            {error && <div style={{ ...bodyText, color: 'var(--cr-red-text)' }}>Couldn’t send: {error.toLowerCase()}.</div>}
            <Button
              variant="primary"
              disabled={pickedTargets.length === 0 || busy}
              onClick={() => pickedTargets.length > 0 && onSend?.(pickedTargets)}
              style={{ ...centredButton, width: '100%', height: '52px' }}
            >
              {busy
                ? 'SENDING…'
                : picked === ALL
                  ? 'SEND TO @FRIENDS'
                  : pickedFriend
                    ? `SEND TO @${String(pickedFriend.username).toUpperCase()}`
                    : 'PICK WHO GETS IT'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
