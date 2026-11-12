// ============================================================================
// 1. CRYING DESIGN SYSTEM TOKENS & GLOBAL STYLES
// (black ground, graphite tiles, caps labels over light numerals, one red accent: see
// .claude/skills/crying-interface-design/SKILL.md)
// ============================================================================

// Crying colour tokens. Red is a FILL (white text on it) for the one primary action / selected row per screen;
// RED_TEXT is red as text on black or graphite (destructive actions, warnings). No other hues.
export const CRY = {
  ground: '#000000',
  tile: '#1C1C1C',
  tileRaised: '#2A2A2A',
  hairline: '#2E2E2E',
  outline: '#3A3A3A',
  text: '#FFFFFF',
  textSecondary: '#BDBDBD',
  textLabel: '#9A9A9A',
  textDim: '#8A8A8A',
  red: '#E20612',
  redText: '#FF4A3D',
  // Radii: small tiles / icon buttons, large tiles / list groups, pills
  radiusSm: '10px',
  radiusLg: '14px',
  radiusPill: '999px'
};

export const IOS_DARK = {
  background: CRY.ground,
  secondaryBackground: CRY.tile,
  label: CRY.text,
  secondaryLabel: CRY.textLabel,
  separator: CRY.hairline,
  systemOrange: CRY.text,
  systemGreen: CRY.text,
  systemRed: CRY.redText,
  systemYellow: CRY.textDim,
  systemBlue: CRY.text,
  systemIndigo: CRY.text
};

export const KINETIC_CSS = `
  /* Chakra Petch (Google Fonts, SIL Open Font License): a squared, technical sans used across the whole app */
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&display=swap');

  :root {
    /* Crying tokens (see CRY above). --dp-color-accent is the "selected / actionable" colour: white (the active pill
       is a white fill with black text); red is only --cr-red (fill) and --cr-red-text (text). */
    --dp-color-ground: #000000;
    --dp-color-ink: #ffffff;
    --dp-color-accent: #ffffff;
    --dp-color-decorative: #2a2a2a;
    --dp-color-rule: #2e2e2e;
    --cr-tile: #1c1c1c;
    --cr-tile-raised: #2a2a2a;
    --cr-hairline: #2e2e2e;
    --cr-outline: #3a3a3a;
    --cr-text-secondary: #bdbdbd;
    --cr-text-label: #9a9a9a;
    --cr-text-dim: #8a8a8a;
    --cr-red: #e20612;
    --cr-red-text: #ff4a3d;
    /* One face everywhere: Chakra Petch. Two variables are kept (text vs labels / numbers) so a second face can be
       brought back for one role by changing a single line. */
    --dp-typography-face: "Chakra Petch", "Helvetica Neue", Arial, sans-serif;
    --cr-face-display: "Chakra Petch", "Helvetica Neue", Arial, sans-serif;
    --dp-spacing-gutter: 16px;
    --dp-motion-marquee-easing: linear;
  }

  html {
    scrollbar-gutter: stable;
    overflow-y: scroll;
    background-color: #000000;
  }

  /* Tabular figures everywhere so numbers line up like an instrument readout. Corners: cells inside a group stay
     square (the group is rounded and clips them); buttons, inputs and groups set their own radius. */
  .kinetic-app, .kinetic-app * {
    font-feature-settings: 'tnum' 1;
    font-variant-numeric: tabular-nums;
    box-sizing: border-box;
  }
  /* The text face is inherited (so a caps-label container passes the label face down to its spans); form controls
     don't inherit fonts by default, so they are told to */
  .kinetic-app {
    font-family: var(--dp-typography-face);
  }
  .kinetic-app button,
  .kinetic-app input,
  .kinetic-app select,
  .kinetic-app textarea,
  .kinetic-app option {
    font-family: inherit;
  }
  /* The label / number face (--cr-face-display, currently also Chakra Petch): anything set in capitals (caps labels,
     buttons, pills, tabs, the ticker), light readout values (weight 300), number fields, chart text and elements
     marked .cr-num (set values, stat cells). Sentences, list titles and typed text use --dp-typography-face. */
  .kinetic-app [style*="text-transform:uppercase"],
  .kinetic-app [style*="text-transform: uppercase"],
  .kinetic-app [style*="font-weight:300"],
  .kinetic-app [style*="font-weight: 300"],
  .kinetic-app .cr-num,
  .kinetic-app input[inputmode="numeric"],
  .kinetic-app input[inputmode="decimal"],
  .kinetic-app input[type="number"],
  .kinetic-app svg text {
    font-family: var(--cr-face-display);
  }
  .kinetic-app {
    background-color: #000000;
    color: #ffffff;
  }
  .kinetic-app button:focus-visible,
  .kinetic-app a:focus-visible,
  .kinetic-app input:focus-visible,
  .kinetic-app select:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .kinetic-app * { transition: none !important; }
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
    background-color: #1C1C1C;
    color: #FFFFFF;
  }
  .kinetic-app select option {
    background-color: #1C1C1C !important;
    color: #FFFFFF !important;
  }

  /* Exercise filters (slot editor header, History filters): the raised graphite control surface, centred text and
     a grey ▾ caret */
  /* Set row type dropdown: the row's own background with the grey caret */
  .kinetic-app select.kinetic-set-type-select {
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0h10L5 6z' fill='%239A9A9A'/%3E%3C/svg%3E");
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
    background-color: #2A2A2A !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0h10L5 6z' fill='%239A9A9A'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 6px center;
    background-size: 9px 6px;
    text-align: center;
    text-align-last: center;
    padding-left: 4px !important;
    padding-right: 18px !important;
    text-overflow: ellipsis;
  }

  /* Configuration: the fields and selections the athlete answers are red fills with white text (each answer is
     its component's one red; NEXT / DONE is white). Pop-ups opened from there (.cr-config-off) keep the usual look. */
  .kinetic-app .cr-config :is(input[type="number"], input[type="text"], select.kinetic-filter-select, button[aria-pressed="true"], .cr-answer-on):not(.cr-config-off *) {
    background-color: var(--cr-red) !important;
    border-color: var(--cr-red) !important;
    color: #FFFFFF !important;
  }
  .kinetic-app .cr-config select.kinetic-filter-select:not(.cr-config-off *) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0h10L5 6z' fill='%23FFFFFF'/%3E%3C/svg%3E");
  }

  /* Pressed: lighten one step (no scale or bounce); short ease-out fades only */
  .kinetic-btn {
    transition: background-color 0.14s ease-out, color 0.14s ease-out, filter 0.14s ease-out;
  }
  .kinetic-btn:active {
    filter: brightness(1.35);
  }
  .kinetic-btn:disabled {
    opacity: 0.4;
  }
  .kinetic-btn:focus-visible {
    outline: 2px solid #FFFFFF;
    outline-offset: 2px;
  }

  .kinetic-row-interactive {
    transition: background-color 0.14s ease-out;
  }
  .kinetic-row-interactive:hover,
  .kinetic-row-interactive:active {
    background-color: #2A2A2A !important;
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
// Zero-gap shared dividers inside a group: the outer group draws top/left, each cell draws right/bottom. In the
// Crying style these are 1px hairlines inside a graphite tile (never a border around a tile).
export const SHARED_CELL_BORDER = {
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: '1px solid var(--dp-color-rule)',
  borderBottom: '1px solid var(--dp-color-rule)'
};

// A group of cells is one rounded graphite tile (14 px) that clips its cells' corners; the cells keep their
// right / bottom hairlines between them. No border is drawn around the group.
export const SHARED_GROUP_OUTER = {
  borderRadius: '14px',
  overflow: 'hidden'
};

// A group holding an exercise picker: the same tile, but it never clips, so the picker's search results can spill
// past its edge (its corner cells stay square while the list is open)
export const SHARED_PICKER_GROUP = {
  borderRadius: '14px'
};

// Type roles (Crying): caps labels small and grey with tracking; values large and light; titles 500
const CAPS_LABEL = {
  fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: CRY.textLabel
};

export const UI = {
  pagePad: { paddingTop: '14px' },
  gutterWrap: { padding: '0 var(--dp-spacing-gutter)' },
  gutterBottom: { padding: '0 var(--dp-spacing-gutter) 16px' },
  capsLabel: CAPS_LABEL,
  // Session names, everywhere they show (session header, History rows and editor, save pop-up): bold, all capitals.
  // Display only: the name is stored as typed.
  sessionName: { fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },
  // The one primary action on a screen: red fill, white 600 caps label, 52px, 12px radius
  primaryBtn: {
    width: '100%', minHeight: '52px', padding: '14px 16px', backgroundColor: 'var(--cr-red)', color: '#FFFFFF',
    border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
  },
  primaryBtnCenter: {
    width: '100%', minHeight: '52px', padding: '14px', backgroundColor: 'var(--cr-red)', color: '#FFFFFF',
    border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', cursor: 'pointer'
  },
  // Raised graphite: reads as a button both on the black ground and inside a tile or pop-up
  secondaryBtnCenter: {
    width: '100%', minHeight: '52px', padding: '14px', backgroundColor: CRY.tileRaised, color: '#FFFFFF',
    border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.08em',
    textTransform: 'uppercase', cursor: 'pointer'
  },
  dashedBtn: {
    width: '100%', minHeight: '52px', padding: '14px', backgroundColor: 'transparent', color: CRY.textLabel,
    border: `1px dashed ${CRY.outline}`, borderRadius: '12px', fontSize: '13px', fontWeight: 500,
    letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer'
  },
  drawerBtn: (active = false) => ({
    width: '100%', minHeight: '56px', padding: '14px 16px', backgroundColor: active ? 'var(--cr-red)' : 'transparent',
    color: '#FFFFFF', border: 'none', borderBottom: `1px solid ${CRY.hairline}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontWeight: 500, fontSize: '17px', cursor: 'pointer'
  }),
  // Pill: outlined, caps; active = white fill, black text (pills never use red)
  pillBtn: (active = false) => ({
    minHeight: '32px', padding: '6px 12px', backgroundColor: active ? '#FFFFFF' : 'transparent',
    color: active ? '#000000' : '#FFFFFF', border: `1px solid ${active ? '#FFFFFF' : CRY.outline}`, borderRadius: CRY.radiusPill,
    fontSize: '12px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer'
  }),
  badge: (active = false) => ({
    padding: '4px 10px', backgroundColor: active ? '#FFFFFF' : 'transparent',
    color: active ? '#000000' : CRY.textLabel, border: `1px solid ${active ? '#FFFFFF' : CRY.outline}`, borderRadius: CRY.radiusPill,
    fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
    whiteSpace: 'nowrap', flexShrink: 0
  }),
  // A field you type into: raised graphite, 10 px corners, the text face, shown as typed (never forced to capitals)
  field: {
    width: '100%', minHeight: '44px', boxSizing: 'border-box', backgroundColor: CRY.tileRaised, color: '#FFFFFF',
    border: 'none', borderRadius: CRY.radiusSm, padding: '10px 14px', fontSize: '16px', fontWeight: 400, outline: 'none'
  },
  // A full sentence (notices, errors, help text): the text face, sentence case
  sentence: { fontSize: '13px', fontWeight: 400, color: CRY.textLabel, lineHeight: 1.45 },
  select: {
    width: '100%', backgroundColor: CRY.tileRaised, color: '#FFFFFF',
    border: 'none', borderRadius: CRY.radiusSm, padding: '10px', fontSize: '13px', fontWeight: 500
  },
  textInputBare: {
    width: '100%', backgroundColor: 'transparent', border: 'none',
    color: '#FFFFFF', fontSize: '17px', fontWeight: 500, outline: 'none'
  },
  numInput: (width = '58px', color = '#FFFFFF') => ({
    width, backgroundColor: CRY.tileRaised, color, border: 'none', borderRadius: CRY.radiusSm,
    padding: '6px', textAlign: 'center', fontSize: '17px', fontWeight: 400, minHeight: '44px', boxSizing: 'border-box'
  }),
  modalBackdrop: {
    position: 'fixed', inset: 0, zIndex: 70, backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: `calc(16px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px))`
  },
  modalCard: (maxWidth = '420px') => ({
    width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto',
    backgroundColor: CRY.tile, border: 'none', borderRadius: CRY.radiusLg, padding: '18px'
  }),
  modalHeader: {
    fontSize: '15px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
    borderBottom: `1px solid ${CRY.hairline}`, paddingBottom: '12px', marginBottom: '14px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  closeXBtn: {
    background: CRY.tileRaised, color: '#FFFFFF', border: 'none', borderRadius: CRY.radiusSm,
    minWidth: '44px', minHeight: '44px', padding: '2px 8px', fontWeight: 400, cursor: 'pointer'
  },
  stepLabel: { ...CAPS_LABEL, marginBottom: '6px' },
  fieldLabel: CAPS_LABEL,
  // Every section heading (STATS, EXERCISES, PERSONAL RECORDS, ...): a caps label with a 4px inset, sitting
  // directly above the group it names
  sectionTitle: { ...CAPS_LABEL, fontSize: '11px', paddingLeft: '4px', lineHeight: 1.3 },
  rowTitle: { fontSize: '17px', fontWeight: 500 },
  rowSub: { fontSize: '13px', color: CRY.textLabel, fontWeight: 400 },
  deleteXBtn: {
    width: '44px', height: '44px', border: 'none', borderRadius: CRY.radiusSm,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 400, fontSize: '15px', backgroundColor: 'transparent', color: CRY.redText,
    cursor: 'pointer', flexShrink: 0, padding: 0
  }
};
