'use client';

// The Social page's INBOX tab: everything waiting on you from friends, as messages — friend requests (ACCEPT / ✕) and
// routines friends sent you (SAVE moves it to your SAVED routines, LOAD makes it your session, ✕ dismisses it). Each
// answer is written back, so a message never shows again. Requests first, then routines newest first.

import React from 'react';
import { SHARED_CELL_BORDER, SHARED_GROUP_OUTER, UI } from '../../styles/kineticTokens';
import { EXERCISE_MAP, formatDateYMD, stripDateFromTitle, stripEquipmentFromExerciseName } from '../../data/exerciseLibrary';
import { getWorkoutExerciseIds } from '../HistoryExerciseFilter';
import { DeleteButton } from '../Controls';
import { ProfileAvatar } from '../ProfileAvatar';

const cellBtn = (bg, color) => ({
  minHeight: '56px',
  boxSizing: 'border-box',
  backgroundColor: bg,
  color,
  border: 'none',
  ...SHARED_CELL_BORDER,
  fontFamily: 'inherit',
  fontSize: '12px',
  fontWeight: 500,
  letterSpacing: '0.08em',
  cursor: 'pointer'
});
const kindLine = { ...UI.capsLabel, fontSize: '10px', marginBottom: '2px' };
const subLine = { fontSize: '11px', fontWeight: 500, color: '#9A9A9A', marginTop: '1px', textTransform: 'uppercase' };

/** Number of messages waiting (Home's INBOX tile, the menu's Social row). */
export const inboxCount = (requests, received) => (requests || []).length + (received || []).length;

export function InboxSection({
  // Friend requests waiting for you: [{ id, username }]
  requests = [],
  onAcceptRequest,
  onDeclineRequest,
  // Routines friends sent you (routine_shares rows): SAVE / LOAD / ✕
  received = [],
  onSaveReceived,
  onLoadReceived,
  onDismissReceived,
  // A photo for an athlete who is your friend (requests only carry a username)
  photoOf = () => null
}) {
  const routines = [...(received || [])].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const total = (requests || []).length + routines.length;

  if (total === 0) {
    return (
      <div style={{ padding: '0 var(--dp-spacing-gutter)' }}>
        <div style={{ ...SHARED_GROUP_OUTER, backgroundColor: '#1C1C1C', padding: '16px', ...UI.sentence }}>
          Nothing new. Friend requests and routines your friends send you show up here.
        </div>
      </div>
    );
  }

  const row = (key, avatar, body, buttons, columns) => (
    <div key={key} style={{ display: 'grid', gridTemplateColumns: `minmax(0, 1fr) ${columns}`, alignItems: 'stretch', backgroundColor: '#1C1C1C' }}>
      <div style={{ ...SHARED_CELL_BORDER, display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', minWidth: 0, minHeight: '56px', boxSizing: 'border-box' }}>
        {avatar}
        <div style={{ minWidth: 0 }}>{body}</div>
      </div>
      {buttons}
    </div>
  );

  return (
    <section style={{ padding: '0 var(--dp-spacing-gutter)', marginBottom: '22px' }}>
      <div style={{ ...UI.sectionTitle, marginBottom: '8px' }}>{`INBOX (${total})`}</div>
      <div style={{ ...SHARED_GROUP_OUTER, display: 'flex', flexDirection: 'column' }}>
        {(requests || []).map((req, idx) =>
          row(
            `req_${req.id || req.username || idx}`,
            <ProfileAvatar photo={photoOf(req.id)} username={req.username} size={32} />,
            <>
              <div style={kindLine}>FRIEND REQUEST</div>
              <div style={{ fontSize: '15px', fontWeight: 500, color: '#FFFFFF' }}>@{req.username}</div>
            </>,
            <>
              <button type="button" className="kinetic-btn" aria-label={`Accept @${req.username}'s friend request`} onClick={() => onAcceptRequest?.(req)} style={cellBtn('#FFFFFF', '#000000')}>
                ACCEPT
              </button>
              <DeleteButton
                label={`Decline @${req.username}'s friend request`}
                variant="outline"
                fill
                minHeight="56px"
                style={{ width: '44px', height: 'auto', color: '#9A9A9A' }}
                onClick={() => onDeclineRequest?.(req)}
              />
            </>,
            '76px 44px'
          )
        )}
        {routines.map(share => {
          const label = stripDateFromTitle(share.label || share.routine?.label) || 'Routine';
          const slots = Array.isArray(share.routine?.slots) ? share.routine.slots : [];
          const ids = getWorkoutExerciseIds({ slots });
          const names = ids.map(id => EXERCISE_MAP[id]?.name).filter(Boolean).map(stripEquipmentFromExerciseName).join(' · ');
          const from = share.sender_username || 'friend';
          return row(
            `routine_${share.id}`,
            <ProfileAvatar photo={photoOf(share.sender_id)} username={from} size={32} />,
            <>
              <div style={kindLine}>ROUTINE FROM @{from}</div>
              <div style={{ fontSize: '15px', ...UI.sessionName, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
              <div style={subLine}>
                {[share.created_at ? formatDateYMD(share.created_at) : null, `${ids.length} ${ids.length === 1 ? 'EXERCISE' : 'EXERCISES'}`].filter(Boolean).join(' • ')}
              </div>
              {names && (
                <div style={{ ...UI.rowContents, marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{names}</div>
              )}
            </>,
            <>
              {/* SAVE: into your SAVED routines (the message leaves the inbox) */}
              <button type="button" className="kinetic-btn" aria-label={`Save ${label} to your routines`} onClick={() => onSaveReceived?.(share)} style={cellBtn('#FFFFFF', '#000000')}>
                SAVE
              </button>
              <button type="button" className="kinetic-btn" aria-label={`Load ${label} into your session`} onClick={() => onLoadReceived?.(share)} style={cellBtn('#2A2A2A', '#FFFFFF')}>
                LOAD
              </button>
              <DeleteButton
                label={`Dismiss ${label}`}
                variant="outline"
                fill
                minHeight="56px"
                style={{ width: '44px', height: 'auto', color: '#9A9A9A' }}
                onClick={() => onDismissReceived?.(share)}
              />
            </>,
            '60px 60px 44px'
          );
        })}
      </div>
    </section>
  );
}

export default InboxSection;
