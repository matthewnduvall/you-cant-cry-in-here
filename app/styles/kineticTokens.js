// ============================================================================
// 1. KINETIC DESIGN SYSTEM TOKENS & GLOBAL STYLES
// ============================================================================

export const IOS_DARK = {
  background: '#101010',
  secondaryBackground: '#161616',
  label: '#FFFFFF',
  secondaryLabel: '#A0A0A0',
  separator: '#5C5C5C',
  systemOrange: '#FF6B00',
  systemGreen: '#30D158',
  systemRed: '#FF3B30',
  systemYellow: '#FFD60A',
  systemBlue: '#FF6B00',
  systemIndigo: '#FFFFFF'
};

export const KINETIC_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;600;700;800&display=swap');

  :root {
    --dp-color-ground: #101010;
    --dp-color-ink: #ffffff;
    --dp-color-accent: #ff6b00;
    --dp-color-decorative: #343434;
    --dp-color-rule: #5c5c5c;
    --dp-typography-face: "Kinetic Host Grotesk", "Host Grotesk", -apple-system, BlinkMacSystemFont, sans-serif;
    --dp-spacing-gutter: max(14px, 2.2cqw);
    --dp-motion-marquee-easing: linear;
  }

  html {
    scrollbar-gutter: stable;
    overflow-y: scroll;
    background-color: #101010;
  }

  .kinetic-app, .kinetic-app * {
    font-family: var(--dp-typography-face);
    border-radius: 0px !important;
    box-sizing: border-box;
  }

  /* No text selection or iOS long-press callout (the "highlighter") in the app UI: holding a drag handle or a
     button should never start selecting text. Fields you type into keep normal selection. */
  .kinetic-app {
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  .kinetic-app input,
  .kinetic-app textarea,
  .kinetic-app [contenteditable="true"] {
    -webkit-user-select: text;
    user-select: text;
    -webkit-touch-callout: default;
  }

  /* Fallback colours for dropdowns; each dropdown uses .kinetic-filter-select (below) or its own inline style.
     Options keep a dark list on every platform. */
  .kinetic-app select {
    background-color: #101010;
    color: #FFFFFF;
  }
  .kinetic-app select option {
    background-color: #101010 !important;
    color: #FFFFFF !important;
  }

  /* Exercise filters (slot editor header, History filters): own lighter surface so they read apart from the
     set rows, centred text and an orange ▾ caret (orange = something you can act on) */
  /* Set row type dropdown: the row's own background (green once done) with the orange caret */
  .kinetic-app select.kinetic-set-type-select {
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0h10L5 6z' fill='%23FF6B00'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 3px center;
    background-size: 7px 4px;
    text-align: center;
    text-align-last: center;
    padding: 0 11px 0 1px !important;
    text-overflow: ellipsis;
  }

  /* Beside its padlock the type cell has no room for the caret: full width for the label */
  .kinetic-app select.kinetic-set-type-select.no-caret {
    background-image: none;
    padding: 0 1px !important;
  }

  .kinetic-app select.kinetic-filter-select {
    -webkit-appearance: none;
    appearance: none;
    background-color: #26262B !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0h10L5 6z' fill='%23FF6B00'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 6px center;
    background-size: 9px 6px;
    text-align: center;
    text-align-last: center;
    padding-left: 4px !important;
    padding-right: 18px !important;
    text-overflow: ellipsis;
  }

  .kinetic-btn {
    transition: transform 0.08s ease, background-color 0.12s ease, color 0.12s ease;
  }
  .kinetic-btn:active {
    transform: scale(0.98);
  }
  .kinetic-btn:focus-visible {
    outline: 2px solid var(--dp-color-accent);
    outline-offset: 2px;
  }

  .kinetic-row-interactive {
    transition: background-color 0.12s ease, color 0.12s ease;
  }
  .kinetic-row-interactive:hover {
    background-color: var(--dp-color-accent) !important;
    color: #101010 !important;
  }
  .kinetic-row-interactive:hover .kinetic-sub {
    color: #101010 !important;
  }

  @keyframes kinetic-marquee {
    0% { transform: translateX(0%); }
    100% { transform: translateX(-50%); }
  }

  .kinetic-marquee-track {
    display: flex;
    width: max-content;
    white-space: nowrap;
    animation: kinetic-marquee var(--dp-marquee-duration, 28s) var(--dp-motion-marquee-easing) infinite;
  }

  .kinetic-marquee-paused .kinetic-marquee-track {
    animation-play-state: paused !important;
  }
`;

// Zero-gap shared borders: the outer group draws top/left, each cell draws right/bottom.
export const SHARED_CELL_BORDER = {
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: '1px solid var(--dp-color-rule)',
  borderBottom: '1px solid var(--dp-color-rule)'
};

export const SHARED_GROUP_OUTER = {
  borderTop: '1px solid var(--dp-color-rule)',
  borderLeft: '1px solid var(--dp-color-rule)'
};

export const UI = {
  pagePad: { paddingTop: '14px' },
  gutterWrap: { padding: '0 var(--dp-spacing-gutter)' },
  gutterBottom: { padding: '0 var(--dp-spacing-gutter) 16px' },
  primaryBtn: {
    width: '100%', padding: '14px', backgroundColor: 'var(--dp-color-accent)', color: '#101010',
    border: '2px solid #FFFFFF', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
  },
  primaryBtnCenter: {
    width: '100%', padding: '14px', backgroundColor: 'var(--dp-color-accent)', color: '#101010',
    border: '2px solid #FFFFFF', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
  },
  secondaryBtnCenter: {
    width: '100%', padding: '14px', backgroundColor: '#161616', color: '#FFFFFF',
    border: '2px solid var(--dp-color-rule)', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
  },
  dashedBtn: {
    width: '100%', padding: '14px', backgroundColor: '#161616', color: 'var(--dp-color-accent)',
    border: '2px dashed var(--dp-color-rule)', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
  },
  drawerBtn: (active = false) => ({
    width: '100%', padding: '14px', backgroundColor: active ? 'var(--dp-color-accent)' : '#161616',
    color: active ? '#101010' : '#FFFFFF', border: '2px solid var(--dp-color-rule)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontWeight: 800, fontSize: '15px', textTransform: 'uppercase', cursor: 'pointer'
  }),
  pillBtn: (active = false) => ({
    padding: '8px', backgroundColor: active ? 'var(--dp-color-accent)' : '#101010',
    color: active ? '#101010' : '#FFFFFF', border: '2px solid var(--dp-color-rule)',
    fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer'
  }),
  badge: (active = false) => ({
    padding: '4px 10px', backgroundColor: active ? 'var(--dp-color-accent)' : '#101010',
    color: active ? '#101010' : '#888888', border: '2px solid var(--dp-color-rule)',
    fontSize: '11px', fontWeight: 800, textTransform: 'uppercase'
  }),
  select: {
    width: '100%', backgroundColor: '#101010', color: '#FFFFFF',
    border: '2px solid var(--dp-color-rule)', padding: '10px', fontSize: '12px', fontWeight: 800
  },
  textInputBare: {
    width: '100%', backgroundColor: 'transparent', border: 'none',
    color: '#FFFFFF', fontSize: '16px', fontWeight: 800, outline: 'none'
  },
  numInput: (width = '58px', color = '#FFFFFF') => ({
    width, backgroundColor: '#101010', color, border: '2px solid var(--dp-color-rule)',
    padding: '6px', textAlign: 'center', fontSize: '13px', fontWeight: 800, minHeight: '40px', boxSizing: 'border-box'
  }),
  modalBackdrop: {
    position: 'fixed', inset: 0, zIndex: 70, backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: `calc(16px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px))`
  },
  modalCard: (maxWidth = '420px') => ({
    width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto',
    backgroundColor: '#141414', border: '2px solid var(--dp-color-rule)', padding: '18px'
  }),
  modalHeader: {
    fontSize: '18px', fontWeight: 800, textTransform: 'uppercase',
    borderBottom: '2px solid var(--dp-color-rule)', paddingBottom: '10px', marginBottom: '14px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  closeXBtn: {
    background: 'var(--dp-color-accent)', color: '#101010', border: 'none',
    padding: '2px 8px', fontWeight: 800, cursor: 'pointer'
  },
  stepLabel: {
    fontSize: '11px', fontWeight: 800, color: 'var(--dp-color-accent)', marginBottom: '6px', textTransform: 'uppercase'
  },
  fieldLabel: {
    fontSize: '11px', fontWeight: 800, color: 'var(--dp-color-accent)', textTransform: 'uppercase'
  },
  // Every page section heading (STATS, EXERCISES, PERSONAL RECORDS, SOCIAL, ...): one size and colour
  sectionTitle: {
    fontSize: '20px', fontWeight: 800, letterSpacing: '-0.04em', textTransform: 'uppercase',
    color: '#FFFFFF', lineHeight: 1.05
  },
  rowTitle: { fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' },
  rowSub: { fontSize: '11px', color: '#A0A0A0', fontWeight: 600 },
  deleteXBtn: {
    width: '26px', height: '26px', border: '2px solid var(--dp-color-rule)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: '13px', backgroundColor: '#101010', color: '#FF3B30',
    cursor: 'pointer', flexShrink: 0, padding: 0
  }
};

