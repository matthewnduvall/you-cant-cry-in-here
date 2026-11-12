---
name: crying-interface-design
description: The Crying design language for interfaces: black ground, graphite tiles, caps labels over light numerals, one red accent. Use when building or restyling UI in the Crying style.
---

# Crying interface design

Crying is a design language modeled on the menus of high-end digital rangefinder cameras: a black screen, a few graphite tiles, quiet gray labels, large light numerals, and a single red accent. The interface behaves like an instrument readout. It shows the current values, highlights one thing, and stays out of the way.

This is an homage to camera menus, not a copy of any one maker. Never use a camera maker's logo, badge, name or proprietary typeface in the UI.

## Principles

1. **Black is the material.** The ground is pure black, as on an OLED camera screen. Surfaces are lifted with one graphite step, never with shadows, gradients or blur.
2. **One red thing per screen.** Red marks the selected item or the single primary action. If two things are red, one of them is wrong.
3. **Values over chrome.** The number is the content. Each setting is a small caps label over a large value. Borders, icons and decoration are kept to the minimum that makes the grid legible.
4. **Everything is a setting.** Model screens as a grid of readout tiles, plus grouped lists for navigation. Avoid marketing-style heroes, cards with imagery, and decorative illustration.
5. **Calm and exact.** No exclamation marks, no emoji, no playful copy in controls. Labels are one or two words.

## Color tokens

```css
:root {
  --ground: #000000;        /* page background */
  --tile: #1C1C1C;          /* tiles, list groups, secondary buttons */
  --tile-raised: #2A2A2A;   /* a control sitting inside a tile */
  --hairline: #2E2E2E;      /* dividers inside tiles */
  --outline: #3A3A3A;       /* pill and dashed outlines */
  --text: #FFFFFF;          /* values, titles */
  --text-secondary: #BDBDBD;/* info lines */
  --text-label: #9A9A9A;    /* caps labels, units, subtitles */
  --text-dim: #8A8A8A;      /* completed or inactive rows, footers */
  --red: #E20612;           /* fills only: selected row, primary button */
  --red-text: #FF4A3D;      /* red as text on black or graphite */
}
```

Rules:
- `--red` is a fill with white text on it. For red text on a dark surface use `--red-text`, which keeps contrast above 4.5:1.
- No other hues. Success, warning and info states are expressed with white, gray and position, not green, yellow or blue. Destructive actions use `--red-text` as text, never as a second red fill.
- The primary physical action (the equivalent of the shutter) is a white circle with a black icon.
- A light theme is not part of this language. If one is required, invert to a white ground with `#F2F2F2` tiles and keep the same red.

## Typography

- Typeface: `'Inter Tight', 'Helvetica Neue', Arial, sans-serif`. A tight neutral grotesk. Do not substitute a geometric or rounded face.
- Always set `font-feature-settings: 'tnum' 1` so numerals align in readouts.
- Weights: 300 for large values, 400 for body, 500 for titles and selected values, 600 only for the primary button label.

| Role | Size | Weight | Tracking | Case | Color |
|---|---|---|---|---|---|
| Caps label | 10-11px | 400-500 | 0.10-0.12em | UPPER | `--text-label` |
| Button or pill label | 12-13px | 500 | 0.06-0.08em | UPPER | `--text` |
| Subtitle | 13px | 400 | 0 | Sentence | `--text-label` |
| List title | 17px | 500 | 0 | Sentence | `--text` |
| Tile value | 16-20px | 500 | 0 | As is | `--text` |
| Readout value | 22-26px | 300 | 0 | As is | `--text` |
| Hero value | 40-44px | 300 | -0.01 to -0.02em | As is | `--text` |
| Screen title | 15px | 500 | 0.10em | UPPER | `--text` |

Rules:
- Tracked uppercase is for labels and controls only. Values, titles and sentences are never letter-spaced.
- Units sit beside the value in label style (`172.5` large, `LB` small gray), never at the same size.
- Dates and times use compact numeric forms: `11.11.26`, `2:00`.

## Layout

- Spacing scale: 4, 8, 12, 16, 24. Screen padding 16px. Gap between tiles 8px. Gap between sections 12-14px.
- Radii: 10px for small tiles and icon buttons, 12-14px for large tiles and list groups, fully round for pills and the circular action. Nothing is square-cornered and nothing exceeds 14px except pills.
- Grids: readout tiles in equal columns of 2 or 3 (`repeat(N, minmax(0, 1fr))`). Do not mix tile heights within a row.
- Dividers: 1px `--hairline` inside a tile or list group. Never draw a border around a tile; the graphite fill is the edge.
- Minimum touch target 44px.
- Section headings are caps labels with 4px left inset, sitting directly above the group they name.

## Components

**Readout tile.** Graphite tile, 56px tall for compact, 92px for mode tiles. Caps label top left, value bottom left. If tappable it is a real `<button>`.

**Readout strip.** One tile divided into 2-4 equal cells by vertical hairlines, each a caps label over a 26px light value. Use for comparable numbers (last, now, record). At most one cell may use `--red-text` at weight 500.

**Hero panel.** Graphite tile with a caps info line (preceded by a 6px red dot when it is live), a 40px light value, and the white circular action at the right (60px, black check or icon). A goal or total may add a 4px progress bar: white fill on an `--outline` track.

**List group.** Graphite tile with rows 56-72px tall separated by hairlines. Left: title, optional gray subtitle. Right: current value in gray, then a thin chevron. This mirrors a camera menu page.

**Set or item row.** 56px row: index, caps type label, right-aligned value, trailing 44px circular check.
- Default: white text, check has a 1.5px `#4A4A4A` outline.
- Selected or next: the whole row fills `--red`, text white, check outlined white.
- Done: text `--text-dim`, check filled white with a black tick.

**Pill.** 32px tall (44px when used as top-level tabs), 1px `--outline` border, transparent, caps label. The active pill is filled white with black text. Pills never use red.

**Buttons.**
- Primary: `--red` fill, white 600 caps label, 52px tall, 12px radius. One per screen.
- Secondary: `--tile` fill, white caps label.
- Destructive: `--tile` fill or transparent, `--red-text` label.
- Add or empty slot: transparent, 1px dashed `--outline`, gray caps label.
- Icon button: 44px square, 10px radius, `--tile` fill, 1.5px stroke icon.

**Info line.** A single 36px row between two hairlines, caps text in `--text-secondary`, segments separated by a gray `|`, with a 6px red dot at the start when something needs attention.

**Chart.** Sits inside a graphite tile. Gridlines are `--hairline`, axis labels 10px `--text-label`. Every series is gray (`--text-dim`, 1.5px) except the selected one, which is `--red` at 2.5px with a white end label. Never assign a hue per series; label line ends directly instead of using a color legend. Selecting an item in the list below the chart moves the red to that series and fills that list row red; this pair counts as the screen's one red thing.

**Icons.** Inline stroke SVG, 1.5px stroke, square caps, no fills, 16-18px. Only functional icons: menu, back, search, check, chevron, plus.

## States and motion

- Selection is shown by fill (red row, white pill), never by a glow, underline or colored border.
- Pressed: lighten the tile one step (`--tile` to `--tile-raised`). No scale or bounce.
- Disabled: 40% opacity, no other change.
- Focus: 2px white outline with 2px offset.
- Motion is minimal: 120-160ms linear or ease-out fades and fills. No springs, no parallax, no animated gradients. Respect `prefers-reduced-motion`.

## Copy

- Controls: one or two words, uppercase where the table says so: `FINISH SESSION`, `RESET`, `+ SET`.
- Titles and descriptions: sentence case, short, no terminal punctuation in lists.
- Headlines, when a screen has one: light weight, sentence case, with at most one word set in a red block (white 600 text on `--red`, 6px radius).

## Checklist before finishing a screen

- Ground is `#000000` and every surface is `--tile` or `--tile-raised`.
- Exactly one red fill is visible (or one linked chart-and-row pair), plus at most one or two uses of `--red-text`.
- Every number uses tabular figures and has a caps label.
- No shadows, gradients, borders around tiles, emoji, or colors outside the tokens.
- All interactive elements are real buttons or links, at least 44px, with `aria-label` on icon-only controls.
- No camera maker's logo, name, badge or proprietary font appears anywhere.
