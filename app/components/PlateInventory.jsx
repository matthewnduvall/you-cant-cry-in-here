'use client';

// Configuration → EQUIPMENT → PLATES: which plates the athlete owns and how many (settings.plateInventory, local +
// cloud). Off = not counted (standard plates, as many as needed). On, barbells, EZ / trap / Smith bars and
// plate-loaded machines are loaded only from these — half of each size on each side — in the weight pop-up and in
// every suggested weight (utils/loading.js). Counts go up and down in pairs (one plate for each side).

import React from 'react';
import { UI } from '../styles/kineticTokens';
import { IOSListSection, IOSListRow } from './Primitives';
import { PLATE_SIZES, DEFAULT_PLATE_INVENTORY, normalizePlateInventory } from '../utils/loading';

const stepBtn = disabled => ({
  width: '44px',
  height: '44px',
  border: 'none',
  borderRadius: '10px',
  backgroundColor: '#2A2A2A',
  color: '#FFFFFF',
  fontSize: '20px',
  fontWeight: 300,
  lineHeight: 1,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.4 : 1,
  flexShrink: 0
});

export function PlateInventorySection({ colors, value, onChange }) {
  const inventory = normalizePlateInventory(value);
  const counting = Boolean(inventory);
  const total = counting ? PLATE_SIZES.reduce((n, s) => n + (inventory[s] || 0), 0) : 0;
  const setCount = (size, next) => onChange?.({ ...inventory, [size]: Math.max(0, Math.min(98, next)) });

  return (
    <IOSListSection
      header="PLATES"
      colors={colors}
      footer={
        counting
          ? 'Bars and plate-loaded machines are loaded only from these: half of each size goes on each side. Counts go up in pairs.'
          : 'Off: weights use standard plates (45 to 1.25 lb), as many as needed. Turn on to count the plates you have.'
      }
    >
      <IOSListRow colors={colors} isLast={!counting} onClick={() => onChange?.(counting ? null : { ...DEFAULT_PLATE_INVENTORY })}>
        <span role="switch" aria-checked={counting} style={UI.rowTitle}>
          Count my plates
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {counting && <span style={UI.rowSub}>{total} plates</span>}
          <span className={counting ? 'cr-answer-on' : undefined} style={UI.badge(counting)}>
            {counting ? 'ON' : 'OFF'}
          </span>
        </span>
      </IOSListRow>
      {counting &&
        PLATE_SIZES.map((size, idx) => {
          const n = inventory[size] || 0;
          return (
            <IOSListRow key={size} colors={colors} isLast={idx === PLATE_SIZES.length - 1}>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...UI.rowTitle, color: n > 0 ? '#FFFFFF' : '#8A8A8A' }}>
                  <span className="cr-num">{size}</span> lb
                </div>
                <div className="kinetic-sub" style={UI.rowSub}>
                  {n > 0 ? `${n / 2} ${n / 2 === 1 ? 'pair' : 'pairs'}` : 'None'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button
                  type="button"
                  className="kinetic-btn"
                  aria-label={`Remove a pair of ${size} lb plates`}
                  disabled={n <= 0}
                  onClick={() => setCount(size, n - 2)}
                  style={stepBtn(n <= 0)}
                >
                  −
                </button>
                <span
                  aria-label={`${n} plates of ${size} lb`}
                  className="cr-num"
                  style={{ width: '36px', textAlign: 'center', fontSize: '20px', fontWeight: 300, color: n > 0 ? '#FFFFFF' : '#8A8A8A' }}
                >
                  {n}
                </span>
                <button
                  type="button"
                  className="kinetic-btn"
                  aria-label={`Add a pair of ${size} lb plates`}
                  onClick={() => setCount(size, n + 2)}
                  style={stepBtn(false)}
                >
                  +
                </button>
              </div>
            </IOSListRow>
          );
        })}
    </IOSListSection>
  );
}

export default PlateInventorySection;
