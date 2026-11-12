'use client';

// ============================================================================
// SHARED CONTROLS — buttons, delete/close buttons, drag badges, gym selector.
// Use these instead of hand-styling <button>/<select> so the Crying look
// (black ground, graphite tiles, white pills, one red action) stays consistent. Every component accepts `style` for one-off overrides.
// ============================================================================

import React from 'react';
import { UI, SHARED_CELL_BORDER } from '../styles/kineticTokens';
import { DEFAULT_GYM_EQUIPMENT_PRESETS, getGymSelectionLabel } from '../data/exerciseLibrary';

// Red as text on graphite (destructive actions); red fills are only the screen's one primary action
const RED = 'var(--cr-red-text)';

const BUTTON_VARIANTS = {
  // The screen's one primary action: red fill, white caps label, 52 px, 12 px radius
  primary: () => UI.primaryBtnCenter,
  // Primary with label + trailing arrow spread apart
  'primary-row': () => UI.primaryBtn,
  // Graphite fill, white caps label
  secondary: () => UI.secondaryBtnCenter,
  // Dashed "add" button
  dashed: () => UI.dashedBtn,
  // Confirm that isn't the screen's main action (CALCULATE 1RM): white fill, black label
  success: () => ({ ...UI.primaryBtnCenter, backgroundColor: '#FFFFFF', color: '#000000' }),
  // Destructive: red text on a transparent button with an outline (never a red fill; red text only sits on black or
  // the base tile, where it keeps >= 5:1 contrast)
  danger: () => ({ ...UI.secondaryBtnCenter, backgroundColor: 'transparent', border: '1px solid var(--cr-outline)', color: RED }),
  // Small on/off pill (filters, segmented choices)
  toggle: active => UI.pillBtn(active),
  // Full-width navigation row (drawer)
  drawer: active => UI.drawerBtn(active)
};

/**
 * Standard button. `variant`: primary | primary-row | secondary | dashed | success | danger |
 * toggle | drawer. `active` applies to toggle/drawer.
 */
export function Button({ variant = 'primary', active = false, style, className = '', type = 'button', children, ...rest }) {
  const base = (BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary)(active);
  return (
    <button
      type={type}
      className={`kinetic-btn ${className}`.trim()}
      style={{ ...base, ...(rest.disabled ? { opacity: 0.4, cursor: 'default' } : null), ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Segmented-control option sitting in a hairline grid inside a graphite group. Selected = white fill, black text
 * (`activeColor` 'accent' and 'ink' are both white in the Crying style). Override height/padding/fontSize through `style`.
 */
export function SegmentButton({
  active = false,
  activeColor = 'accent',
  inactiveColor = '#FFFFFF',
  style,
  children,
  ...rest
}) {
  const activeBg = activeColor === 'ink' ? '#FFFFFF' : 'var(--dp-color-accent)';
  return (
    <button
      type="button"
      className="kinetic-btn"
      aria-pressed={active}
      style={{
        padding: '10px 6px',
        backgroundColor: active ? activeBg : '#1C1C1C',
        color: active ? '#000000' : inactiveColor,
        ...SHARED_CELL_BORDER,
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        ...style
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * A second row of tabs under a page's tabs (e.g. Profile → PERFORMANCE → PROGRESS / …, Social → LEADERBOARDS →
 * BIG 3 / BW / …): indented 28 px with a grey elbow line so it reads as the selected tab's children.
 */
export function NestedTabBar({ style, ...tabBarProps }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '12px',
          top: '-4px',
          width: '16px',
          height: '30px',
          borderLeft: '1px solid var(--dp-color-rule)',
          borderBottom: '1px solid var(--dp-color-rule)'
        }}
      />
      <TabBar {...tabBarProps} style={{ marginLeft: '28px', marginTop: '6px' }} />
    </div>
  );
}

/**
 * Page tabs: one row of 44 px pills (outlined; selected = white fill, black text). `tabs` is [{ id, label }].
 * Labels may wrap to two lines on narrow screens; every tab keeps a 44 px tap target.
 */
export function TabBar({ tabs = [], value, onChange, ariaLabel = 'Tabs', style }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(1, tabs.length)}, minmax(0, 1fr))`,
        gap: '6px',
        ...style
      }}
    >
      {tabs.map(tab => (
        <SegmentButton
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          active={value === tab.id}
          onClick={() => onChange?.(tab.id)}
          style={{
            minHeight: '44px',
            padding: '6px 4px',
            lineHeight: 1.15,
            textAlign: 'center',
            fontSize: '11px',
            borderRadius: '999px',
            border: `1px solid ${value === tab.id ? '#FFFFFF' : 'var(--cr-outline)'}`,
            backgroundColor: value === tab.id ? '#FFFFFF' : 'transparent'
          }}
        >
          {tab.label}
        </SegmentButton>
      ))}
    </div>
  );
}

/** SHOW ▾ / HIDE ▴ button for collapsible sections (44 px tap target, grey caret). */
export function CollapseToggle({ collapsed, onClick, label }) {
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-label={label ? `${collapsed ? 'Show' : 'Hide'} ${label}` : undefined}
      onClick={onClick}
      className="kinetic-btn"
      style={{
        minWidth: '76px',
        height: '44px',
        padding: '0 12px',
        backgroundColor: 'var(--cr-tile-raised)',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '10px',
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        flexShrink: 0
      }}
    >
      {collapsed ? 'SHOW' : 'HIDE'} <span style={{ color: 'var(--cr-text-label)' }}>{collapsed ? '▾' : '▴'}</span>
    </button>
  );
}

/**
 * Red ✕ delete button (red text, never a red fill).
 * - variant "solid": an outlined square (removing whole items: history entries, friends, routines).
 * - variant "outline": transparent, red ✕ (inline editor rows: sets, exercises).
 * - `fill`: stretches to the row height with shared cell borders (editor grids).
 */
export function DeleteButton({
  label = 'Delete',
  variant = 'solid',
  // 44 px: the minimum tap target
  size = 44,
  fill = false,
  minHeight,
  style,
  onClick,
  ...rest
}) {
  const solid = variant === 'solid';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={e => {
        e.stopPropagation();
        onClick?.(e);
      }}
      style={{
        width: fill ? '34px' : `${size}px`,
        height: fill ? '100%' : `${size}px`,
        minHeight: fill ? minHeight || '44px' : undefined,
        flexShrink: 0,
        padding: 0,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        color: RED,
        ...(fill
          ? SHARED_CELL_BORDER
          : { border: solid ? '1px solid var(--cr-outline)' : 'none', borderRadius: '10px' }),
        fontSize: '15px',
        fontWeight: 400,
        cursor: rest.disabled ? 'default' : 'pointer',
        opacity: rest.disabled ? 0.4 : 1,
        ...style
      }}
      {...rest}
    >
      ✕
    </button>
  );
}

/** ✕ used to close modals and panels (graphite icon button). */
export function CloseButton({ label = 'Close', style, ...rest }) {
  return (
    <button type="button" aria-label={label} title={label} style={{ ...UI.closeXBtn, ...style }} {...rest}>
      ✕
    </button>
  );
}

/** Drag handle: a number pill over a grippy dot pattern, sized to sit in a shared-border grid. */
export function DragNumberBadge({
  label,
  color = 'var(--dp-color-accent)',
  height = '44px',
  minHeight,
  bg = '#1C1C1C',
  title = 'Click and drag to rearrange',
  // Extra handlers / attributes (e.g. pointer-drag props from usePointerReorder)
  style: extraStyle,
  ...rest
}) {
  return (
    <div
      title={title}
      {...rest}
      style={{
        position: 'relative',
        width: '34px',
        height,
        minHeight: minHeight || height,
        boxSizing: 'border-box',
        backgroundColor: bg,
        ...SHARED_CELL_BORDER,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        userSelect: 'none',
        overflow: 'hidden',
        flexShrink: 0,
        ...extraStyle
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '2px',
          backgroundImage: 'radial-gradient(#9A9A9A 1.35px, transparent 1.35px)',
          backgroundSize: '5px 5px',
          backgroundPosition: 'center',
          opacity: 0.62,
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.88)',
          padding: '2px 4px',
          fontSize: '14px',
          fontWeight: 500,
          color,
          lineHeight: 1,
          whiteSpace: 'nowrap'
        }}
      >
        {label}
      </span>
    </div>
  );
}

function GymOptions({ gyms = [] }) {
  return (
    <>
      {DEFAULT_GYM_EQUIPMENT_PRESETS.map(preset => (
        <option key={preset.id || 'full_gym'} value={preset.id}>
          {preset.name.toUpperCase()}
        </option>
      ))}
      {(gyms || []).map(g => (
        <option key={g.id} value={g.id}>
          {String(g.name || '').toUpperCase()}
        </option>
      ))}
    </>
  );
}

/**
 * Equipment selector (presets + the user's saved equipment setups).
 * - variant "field": a plain bordered select (forms, modals).
 * - variant "cell": a select sitting in a shared-border grid (filter rows).
 * - variant "tile": the two-line "EQUIPMENT ▾ (orange caret) / <SELECTION>" cell with an invisible
 *   select over it (session editor, routines). `style` applies to the tile container.
 */
export function GymSelect({
  value,
  onChange,
  gyms = [],
  variant = 'field',
  tileLabel = 'EQUIPMENT',
  ariaLabel = 'Select equipment',
  style
}) {
  const select = (extraStyle = {}) => (
    <select
      className="kinetic-filter-select"
      aria-label={ariaLabel}
      value={value || ''}
      onChange={e => onChange?.(e.target.value)}
      style={extraStyle}
    >
      <GymOptions gyms={gyms} />
    </select>
  );

  if (variant === 'cell') {
    return select({
      width: '100%',
      height: '40px',
      color: '#FFFFFF',
      ...SHARED_CELL_BORDER,
      fontSize: '12px',
      fontWeight: 500,
      textTransform: 'uppercase',
      padding: '0 8px',
      cursor: 'pointer',
      ...style
    });
  }
  if (variant !== 'tile') {
    return select({ ...UI.select, textTransform: 'uppercase', ...style });
  }

  return (
    <div
      style={{
        width: '100%',
        height: '48px',
        boxSizing: 'border-box',
        position: 'relative',
        backgroundColor: '#1C1C1C',
        ...SHARED_CELL_BORDER,
        padding: '0 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        minWidth: 0,
        ...style
      }}
    >
      <div style={{ ...UI.fieldLabel, lineHeight: 1.15 }}>
        {tileLabel} <span aria-hidden="true" style={{ color: 'var(--cr-text-label)' }}>▾</span>
      </div>
      <div
        style={{
          fontSize: '13px',
          fontWeight: 500,
          color: '#FFFFFF',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          width: '100%',
          lineHeight: 1.25,
          marginTop: '1px',
          textAlign: 'center'
        }}
      >
        {getGymSelectionLabel(value, gyms)}
      </div>
      {select({
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: 0,
        backgroundColor: '#000000',
        color: '#FFFFFF',
        cursor: 'pointer'
      })}
    </div>
  );
}
