---
id: UI-016
title: Gallery management keyboard navigation activation and focus visibility
status: completed
source: ad-hoc
area: gallery-management
priority: medium
depends_on: [UI-014]
updated: 2026-06-27
---

## Context
The gallery management grid supports arrow-key navigation, but keyboard flow currently has two UX blockers:
1. Arrow navigation does not start until a tile is clicked/focused first.
2. When navigating vertically (down then up), focused tiles can end up visually hidden behind the sticky control panel.

Both issues reduce keyboard accessibility and make batch workflows slower for admin users.

## Goal
Make gallery keyboard navigation work immediately on page interaction without requiring an initial tile click, and ensure the focused tile remains visible while moving with arrow keys in all directions.

## Acceptance Criteria
- [x] Arrow keys move the active tile even when no tile has been manually clicked yet.
- [x] Initial keyboard navigation starts from a deterministic target:
  - If there is an existing active photo, use it.
  - Otherwise use the first visible photo in the current ordering.
- [x] Keyboard handlers do not trigger while typing in form fields or editable elements.
- [x] Up/down navigation keeps the focused tile fully visible and not obscured by the sticky toolbar.
- [x] Moving down and then back up lands on expected rows/columns (no hidden-focus state).
- [x] Behavior works in list, small-grid, and grid modes.
- [x] Existing key bindings remain unchanged:
  - Arrow keys = move focus
  - Space/X = toggle selection
  - B = star focused/selected
  - Delete/Backspace = delete selected/focused
  - Esc = clear selection

## Notes
**Likely implementation surface:**
- `src/client/components/gallery-management/PhotoGrid.tsx`

**Implementation direction:**
- Add a window-level keydown listener scoped to gallery-management context so arrow keys can bootstrap focus without requiring an initial click.
- Guard global key handling when the event target is an input, textarea, select, contenteditable, or inside modal/dialog interactions.
- Reuse existing movement logic (`moveFocus`, `getColumnCount`) to avoid branching behavior between global and tile-level handlers.
- After focus moves, ensure visibility with sticky-offset-aware scrolling (for example: calculate toolbar height and adjust scroll so focused tile top is below the panel).
- Keep roving tabindex semantics (`tabIndex=0` only on active tile).

**Testing notes:**
- Add/extend component tests to verify:
  - Arrow key works before any mouse click.
  - Focus target remains visible when navigating down then up with sticky header present.
  - Keydown is ignored in text input contexts.

## Change Log
- 2026-06-27: Implemented in PhotoGrid with window-level arrow key bootstrap, editable/dialog guards, and sticky-toolbar-aware focus visibility handling; verified with `npm run test`.
- 2026-06-27: Created