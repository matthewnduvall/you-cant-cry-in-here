'use client';

import React from 'react';
import { Button } from './Controls';

/** Strip under the header when a newer version of the app is live (useAppUpdateCheck), with a RELOAD button. */
export function UpdateBanner({ show, onReload }) {
  if (!show) return null;
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '2px solid var(--dp-color-rule)',
        backgroundColor: '#161618'
      }}
    >
      <div
        style={{
          flex: 1,
          padding: '10px 12px',
          fontSize: '12px',
          fontWeight: 700,
          lineHeight: 1.35,
          color: '#FFFFFF'
        }}
      >
        A new version of the app is ready. Your workout is saved.
      </div>
      <Button
        variant="primary"
        onClick={onReload}
        style={{ width: '92px', flexShrink: 0, border: 'none', borderLeft: '2px solid var(--dp-color-rule)', fontSize: '12px' }}
      >
        RELOAD
      </Button>
    </div>
  );
}
