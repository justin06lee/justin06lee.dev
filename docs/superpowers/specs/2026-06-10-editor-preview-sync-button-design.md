# Editor→Preview sync: button trigger + highlight fix

Date: 2026-06-10
Surface: article CMS (`/desk`), `OperatorArticleEditor.tsx` + `SyncedPreview.tsx`

## Problem

The article editor has an editor↔preview line-sync. Today, selecting text in the
editor auto-scrolls and highlights the matching block in the live preview
(`onMouseUp` → `syncFromEditor()`). Two complaints:

1. **Highlight is wrong/stuck.** The preview highlights a block by imperatively
   mutating `.style` on React-rendered DOM and stashing the node in
   `highlightedRef`. Every keystroke re-renders the preview, so the ref goes
   stale; inline styles strand on detached/wrong blocks and never clear.
2. **Scrolls to the wrong spot.** Partly a knock-on of (1) (an old highlight is
   visible), partly line-mapping vs. the `zoom: 0.85` preview scaling.

Also: the sync is automatic, which is unwanted. It should be deliberate.

## Goals

- Replace automatic editor→preview sync with a **floating, button-triggered**
  action.
- Make the preview highlight robust: never stuck, always on the correct fresh
  block, and auto-clearing.

## Non-goals

- Keyboard-shortcut trigger.
- Vim-cursor-driven sync.
- Changing the preview→editor (click-a-block) direction, beyond reusing the same
  fixed highlight mechanism.

## Design

### 1. Floating "→ preview" button

- Remove `syncFromEditor()` from the textarea `onMouseUp` (keep
  `syncNormalCursorPosition()` for vim).
- Track selection with `onSelect` on the textarea. Maintain state for whether a
  non-empty selection exists and which 1-based raw line the selection ends on.
- Render a small floating button inside the editor pane's `relative` container,
  pinned to the right edge and vertically aligned to the selected line using the
  existing metrics: `top = EDITOR_PAD_TOP + (line-1)*EDITOR_LINE_HEIGHT -
  editorScrollTop`. Clamp to the visible band so it never floats off-pane.
- Hide the button when the selection collapses or the editor blurs.
- Click → run the existing sync (`setSyncLine`, `previewApiRef.scrollToLine`).
  Use the selection-end line as the target.

### 2. Robust preview highlight

- In `SyncedPreview`, drive the highlight from React state (`highlightLine`)
  rather than a node ref.
- A `useEffect` keyed on `[highlightLine, content]` re-queries the DOM for the
  matching block (`findBlockForLine`) and toggles a CSS class `.sync-highlight`,
  with cleanup removing it from the prior node. Re-running on `content` change
  re-applies to the fresh node after any re-render — this is the core fix.
- Auto-clear: a timer (~1.6s) resets `highlightLine` to null so the highlight
  fades and can never get permanently stuck.
- `scrollToLine` (imperative handle) and the preview click handler both just set
  `highlightLine` (+ bump a nonce so re-selecting the same line re-triggers) and
  do the scroll; the effect does the DOM work.
- `.sync-highlight` defined in `globals.css` with the existing visual (subtle bg
  + left accent bar) and a short fade.

### 3. Mapping / zoom verification

- During verification, confirm `rawLine - bodyOffset → findBlockForLine` lands on
  the right block under `zoom: 0.85`. If off, correct the `getBoundingClientRect`
  math for zoom. Expectation: the highlight-fix removes most perceived wrongness.

## Verification

- `bun run lint`, `bun run build`, `bun run test` clean.
- Manual: select text → button appears at the right line → click → preview
  scrolls to and highlights the correct block → highlight fades. Type after
  syncing → no stranded/stuck highlight. Click a preview block → editor caret
  moves, highlight behaves the same.
