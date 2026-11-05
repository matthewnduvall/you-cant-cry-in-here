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
  }

  .kinetic-app, .kinetic-app * {
    font-family: var(--dp-typography-face);
    border-radius: 0px !important;
    box-sizing: border-box;
  }

  .kinetic-app select,
  .kinetic-app select option {
    background-color: #101010 !important;
    color: #FFFFFF !important;
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
    animation: kinetic-marquee 14s var(--dp-motion-marquee-easing) infinite;
  }

  .kinetic-marquee-paused .kinetic-marquee-track {
    animation-play-state: paused !important;
  }
`;

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
    padding: '6px', textAlign: 'center', fontSize: '13px', fontWeight: 800
  }),
  modalBackdrop: {
    position: 'fixed', inset: 0, zIndex: 70, backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
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
    fontSize: '10px', fontWeight: 800, color: 'var(--dp-color-accent)', textTransform: 'uppercase'
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

