'use client';

// The one way to pick friends (and @all / @me style targets) from a list: raised graphite rows, the chosen ones a
// white fill with black text and a ✓, a 28–32 px avatar or badge on the left. Used by the finish / save pop-up's SAVE
// AS ROUTINE list, SEND ROUTINE and the new-challenge pop-up's "Challenge [who ▾]". Wrap the rows in a
// `PickList` (role="listbox").

import React from 'react';
import { ProfileAvatar } from './ProfileAvatar';

/** The list: a scrolling column of PickRows. */
export function PickList({ label, multiselect = true, maxHeight = '220px', style, children }) {
  return (
    <div
      role="listbox"
      aria-multiselectable={multiselect ? 'true' : undefined}
      aria-label={label}
      style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight, overflowY: 'auto', ...style }}
    >
      {children}
    </div>
  );
}

/** A square badge in place of an avatar (@, ME): black on a chosen row, graphite otherwise. */
export function PickBadge({ on, size = 28, children }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '8px',
        backgroundColor: on ? '#000000' : '#1C1C1C',
        color: '#FFFFFF',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: '12px'
      }}
    >
      {children}
    </span>
  );
}

/** A friend's avatar for a PickRow. */
export const friendAvatar = (friend, size = 28) => (
  <ProfileAvatar photo={friend?.profilePhoto} username={friend?.username} size={size} />
);

/**
 * One row: `avatar` (a PickBadge or friendAvatar), `label` (@name), an optional grey `sub`, chosen = white with ✓
 * (`showCheck={false}` for single-choice lists, where the fill alone says it).
 */
export function PickRow({ on, onClick, avatar, label, sub, showCheck = true, minHeight = '48px' }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={on}
      className="kinetic-btn"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minHeight,
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
      {avatar}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
        {sub && <span style={{ color: on ? '#3A3A3A' : '#9A9A9A', fontSize: '12px', marginLeft: '6px' }}>{sub}</span>}
      </span>
      {showCheck && (
        <span aria-hidden="true" style={{ fontSize: '15px', width: '18px', textAlign: 'center' }}>
          {on ? '✓' : ''}
        </span>
      )}
    </button>
  );
}
