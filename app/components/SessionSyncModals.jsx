'use client';

// ============================================================================
// LIVE SESSION SYNC POP-UPS (see useSessionSync)
// - SessionSyncModal: SYNC button → pick a friend / waiting for an answer / synced with UNSYNC
// - IncomingSyncInviteModal: a friend invited you → ACCEPT / DECLINE
// - SyncNoticeModal: one-line outcome (declined, ended, errors)
// ============================================================================

import React from 'react';
import { UI } from '../styles/kineticTokens';
import { Button, CloseButton } from './Controls';
import { isUuid } from '../utils/supabaseAuth';

const bodyText = { fontSize: '12px', fontWeight: 700, color: '#C8C8C8', lineHeight: 1.45, marginBottom: '12px', textAlign: 'center' };
// Pop-up text and button labels are centred
const centredButton = { display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' };
const titleBlock = { flex: 1, minWidth: 0, textAlign: 'center' };

export function SessionSyncModal({
  open,
  onClose,
  friends = [],
  isSynced = false,
  syncPartnerName = '',
  outgoingInvite = null,
  busy = false,
  onInvite,
  onCancelInvite,
  onUnsync
}) {
  if (!open) return null;
  const syncableFriends = (friends || []).filter(f => isUuid(f?.id));

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 1300 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('390px')} role="dialog" aria-label="Sync session">
        <div style={UI.modalHeader}>
          {/* Left padding = the ✕ button's width, so the title sits in the middle of the card */}
          <div style={{ ...titleBlock, paddingLeft: '40px' }}>
            <div style={UI.fieldLabel}>SYNC SESSION</div>
            <div style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>
              {isSynced ? `SYNCED WITH @${syncPartnerName}` : outgoingInvite ? 'WAITING FOR AN ANSWER' : 'TRAIN WITH A FRIEND'}
            </div>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {isSynced ? (
          <>
            <div style={bodyText}>
              Exercises, their order, schemes and sets are mirrored between you. Your weights, reps and checkmarks stay
              your own, and each of you saves your own copy to History.
            </div>
            <Button variant="danger" onClick={onUnsync} style={{ ...centredButton, width: '100%', height: '46px' }}>
              UNSYNC
            </Button>
          </>
        ) : outgoingInvite ? (
          <>
            <div style={bodyText}>
              Invite sent to @{outgoingInvite.friendName}. Their app shows it within a few seconds while it&apos;s open.
              Once they accept, your exercises are mirrored.
            </div>
            <Button variant="secondary" onClick={onCancelInvite} style={{ ...centredButton, width: '100%', height: '46px' }}>
              CANCEL INVITE
            </Button>
          </>
        ) : syncableFriends.length === 0 ? (
          <div style={bodyText}>Add friends on the Social page to sync a session with them.</div>
        ) : (
          <>
            <div style={bodyText}>
              Pick a friend. They get a pop-up to join; once they accept, any change to the exercises is mirrored
              between you (weights and reps stay your own).
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: '320px', overflowY: 'auto' }}>
              {syncableFriends.map(friend => (
                <button
                  key={friend.id}
                  type="button"
                  className="kinetic-btn"
                  disabled={busy}
                  onClick={() => onInvite?.(friend)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#141416',
                    color: '#FFFFFF',
                    border: '1px solid var(--dp-color-rule)',
                    marginTop: '-1px',
                    fontSize: '14px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: busy ? 'wait' : 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    @{friend.username || 'athlete'}
                  </span>
                  <span style={{ color: 'var(--dp-color-accent)', fontSize: '12px', flexShrink: 0 }}>INVITE →</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function IncomingSyncInviteModal({ invite, fromName = 'friend', willReplaceSession = false, busy = false, onAccept, onDecline }) {
  if (!invite) return null;
  const exerciseCount = Array.isArray(invite.structure?.slots) ? invite.structure.slots.length : 0;
  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 1400 }}>
      <div style={UI.modalCard('390px')} role="dialog" aria-label="Session sync invite">
        <div style={UI.modalHeader}>
          <div style={titleBlock}>
            <div style={UI.fieldLabel}>SYNC INVITE</div>
            <div style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>@{fromName} WANTS TO TRAIN TOGETHER</div>
          </div>
        </div>
        <div style={bodyText}>
          Join their session{exerciseCount ? ` (${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'})` : ''}. Changes
          to the exercises are mirrored between you; your weights, reps and checkmarks stay your own.
          {willReplaceSession ? ' This replaces the session you have open now (it is not saved).' : ''}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <Button variant="secondary" disabled={busy} onClick={onDecline} style={{ ...centredButton, height: '46px' }}>
            DECLINE
          </Button>
          <Button variant="success" disabled={busy} onClick={onAccept} style={{ ...centredButton, height: '46px' }}>
            ACCEPT
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SyncNoticeModal({ message, onClose, title = 'SYNC' }) {
  if (!message) return null;
  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 1400 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={UI.modalCard('360px')} role="alertdialog" aria-label={`${title} update`}>
        <div style={{ ...UI.fieldLabel, marginBottom: '8px', textAlign: 'center' }}>{title}</div>
        <div style={{ ...bodyText, color: '#FFFFFF', fontSize: '13px', fontWeight: 800 }}>{message}</div>
        <Button variant="primary" onClick={onClose} style={{ ...centredButton, width: '100%', height: '44px' }}>
          OK
        </Button>
      </div>
    </div>
  );
}

/**
 * A friend added exercises to a workout you did together (synced) after it was saved:
 * ADD TO MY WORKOUT (they join your copy, weights from your own history) or DISMISS.
 * update: { partnerName, workoutDate, slots } from useSyncedHistoryUpdates.
 */
export function SyncedHistoryUpdateModal({ update, exerciseName = id => id, formatDate = d => d, onAdd, onDismiss }) {
  if (!update) return null;
  const names = (update.slots || [])
    .map(slot => (slot.exerciseIds || []).filter(Boolean).map(exerciseName).join(' + '))
    .filter(Boolean);
  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 1400 }}>
      <div style={UI.modalCard('390px')} role="dialog" aria-label="Synced workout updated">
        <div style={UI.modalHeader}>
          <div style={titleBlock}>
            <div style={UI.fieldLabel}>SYNCED WORKOUT UPDATED</div>
            <div style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>
              @{update.partnerName} added {names.length === 1 ? 'an exercise' : `${names.length} exercises`}
            </div>
          </div>
        </div>
        <div style={bodyText}>
          They added to the workout you did together{update.workoutDate ? ` on ${formatDate(update.workoutDate)}` : ''}:
        </div>
        <div style={{ ...bodyText, color: '#FFFFFF', fontWeight: 800, textTransform: 'uppercase' }}>{names.join(' · ')}</div>
        <div style={bodyText}>
          {names.length === 1 ? 'Add it to your copy? Its weights start' : 'Add them to your copy? Their weights start'} from
          your own history; you can edit them after.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <Button variant="secondary" onClick={onDismiss} style={{ ...centredButton, height: '46px' }}>
            DISMISS
          </Button>
          <Button variant="success" onClick={onAdd} style={{ ...centredButton, height: '46px' }}>
            ADD TO MY WORKOUT
          </Button>
        </div>
      </div>
    </div>
  );
}
