'use client';

import React from 'react';
import { Button } from './Controls';

/**
 * Red strip under the header when cloud sync fails (from useCloudAndStorageSync's
 * `cloudSyncStatus`), with the server's reason and a RETRY button. Hidden while sync is healthy.
 */
export function CloudSyncBanner({ status, onRetry }) {
  if (status?.state !== 'error' && !(status?.state === 'syncing' && status?.error)) return null;
  const retrying = status.state === 'syncing';
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '2px solid var(--dp-color-rule)',
        backgroundColor: '#1A0B0A'
      }}
    >
      <div
        style={{
          flex: 1,
          padding: '10px 12px',
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '0.02em',
          lineHeight: 1.35,
          textTransform: 'uppercase',
          color: '#FF3B30'
        }}
      >
        CLOUD SYNC FAILED: {status.error}. YOUR DATA IS STILL SAVED ON THIS DEVICE.
      </div>
      <Button
        variant="danger"
        onClick={onRetry}
        disabled={retrying}
        style={{ width: '92px', flexShrink: 0, border: 'none', borderLeft: '2px solid var(--dp-color-rule)', fontSize: '12px', opacity: retrying ? 0.6 : 1 }}
      >
        {retrying ? 'SYNCING…' : 'RETRY'}
      </Button>
    </div>
  );
}
