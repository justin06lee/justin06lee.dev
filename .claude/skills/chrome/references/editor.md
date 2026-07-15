# editor suite & site furniture

this file covers the markdown-editing suite (desk, editor, editor-toolbar, asset-sidebar, drawing-window) and a handful of standalone site-furniture components (inline-edit, manager-table, now-playing-bar, socials). the editing suite is a composition tree: `desk` is the full workbench that wires `editor-toolbar` (which owns floating `drawing-window`s), `asset-sidebar`, and the `editor` panes together over one `useLineSync` engine. everything is dark-only, controlled, and callback-driven — the components never own persistence; you bring your own state, markdown renderer, and backend calls. sources live in `packages/registry/<name>/`.

## asset-sidebar

**Role:** scrollable image/asset sidebar with per-row insert/delete buttons and an optional drag-and-drop upload zone
**Install:** `bunx @justin06lee/chrome@latest add asset-sidebar`
**Composes:** nothing beyond utils

renders an `<aside>` (bordered, `bg-white/[0.02]`) with three stacked regions: a header (title + optional description), a scrollable list of asset cards, and — only when `onUpload` is passed — a dashed drop zone footer reading "drop images here to upload". each card shows the image in a fixed `aspect-video` frame on a light `#efede7` background (so light drawings and diagrams stay readable against the dark ui), the asset name, its `markdownPath` in mono, and insert/delete buttons.

every card is `draggable`; on drag start it writes `![name](markdownPath)` to the drag data as `text/plain`, so dropping a row into any textarea pastes a ready-made markdown image reference. clicking insert fires `onInsert(asset)` instead — the sidebar does not splice text itself, the parent does (desk uses this to insert at the caret). delete just fires `onDelete(asset)`; the parent owns any confirmation flow. the drop zone tracks drag-enter depth with a ref so nested drag events don't flicker the highlight, and calls `onUpload(files)` with the dropped `File[]`.

the `Asset` type is `{ id, url, name, markdownPath }` — `url` is what the `<img>` renders (can be a data url or object url), `markdownPath` is what gets written into markdown. the list region is `min-h-0 flex-1 overflow-y-auto`, so the sidebar must be given a height by its container (the demo wraps it in `h-[28rem] w-72`); inside a grid, the track needs `minmax(0,1fr)` or the internal scroll will not engage.

**Key props:**
- `assets: Asset[]` — rows to render.
- `onInsert: (asset: Asset) => void` — fired by the insert button.
- `onDelete: (asset: Asset) => void` — fired by the delete button; parent owns confirm.
- `onUpload: (files: File[]) => void` — files dropped on the drop zone. omit to hide it.
- `title: string = 'images'`
- `description: string`
- `className: string`
- `emptyLabel: string = 'no images yet.'`

**Example:**
```tsx
<div className="h-[28rem] w-72">
  <AssetSidebar
    assets={assets}
    description="drag into the editor or click insert."
    onInsert={(asset) => insertAtCaret(`![${asset.name}](${asset.markdownPath})`)}
    onDelete={(asset) => removeAsset(asset.id)}
  />
</div>
```

## desk

**Role:** the full markdown workbench — toolbar, image sidebar, and split editor with a two-way synced preview, all wired together
**Install:** `bunx @justin06lee/chrome@latest add desk`
**Composes:** editor, asset-sidebar, editor-toolbar, drawing-window

the highest-level piece of the suite, a port of justin06lee.dev/desk. it renders an `EditorToolbar` on top (title/subtitle, an edit/preview/split mode toggle, the default markdown format buttons, a "new drawing" button, a "save: cmd/ctrl+s" status hint, and a built-in white save button), an `AssetSidebar` on the left (18rem column at `xl:`, stacked with `max-h-[20rem]` below that), and the editing area on the right — `EditorTextarea` and/or `EditorPreview` depending on the current mode, sharing one `useLineSync` engine so selection sync works both ways (see the editor section). mode state (`edit | preview | split`) is internal; it starts in `split`.

desk owns the text-splicing glue the leaf components deliberately don't: format buttons wrap the current selection (or the action's placeholder) with the action's `before`/`after` and restore focus + selection via `requestAnimationFrame`; the sidebar's insert button (and `onInsertAsset`) splices `\n![name](markdownPath)\n` at the caret. cmd/ctrl+s calls `onSave(value)` — the listener binds once on `window` and reads the latest value from a ref, and it only calls `preventDefault` when an `onSave` handler exists, so the browser save dialog is untouched otherwise. the save button renders disabled without `onSave`. drawing windows are managed by the toolbar: `onSaveDrawing` gets `{ dataUrl, darkDataUrl? }` and the window closes after it resolves; `drawingDarkMapping` switches the windows to the light-to-dark mapping mode.

markdown rendering is injected: `renderMarkdown(md, { highlightLine })` must return a renderer that stamps `data-source-line` on top-level blocks — in this registry that's `<Prose lineSync highlightLine={highlightLine}>{md}</Prose>` (prose is a separate registry component, not a dependency of desk). sizing uses the shared `EditorSize` presets via `editorSizeClass` — `screen` (default) fills the container at viewport height; `sm` through `2xl` step from 20x32rem to 52x88rem; `auto` opts out. `className` merges after the preset through tailwind-merge, so `h-*`/`w-*` classes there win. note the internal layout leans on `minmax(0,1fr)` grid tracks and `min-h-0` everywhere — if you rebuild a custom desk from the pieces, replicate that or the panes will grow instead of scrolling.

**Key props:**
- `title: ReactNode`
- `subtitle: ReactNode`
- `value: string` (required) — markdown source (controlled).
- `onChange: (value: string) => void` (required)
- `renderMarkdown: (markdown: string, state: { highlightLine: number | null }) => ReactNode` (required) — renders the preview with line-sync — typically a `<Prose lineSync />` call.
- `assets: Asset[] = []`
- `onInsertAsset: (asset: Asset) => void` — the markdown ref is also spliced at the caret.
- `onDeleteAsset: (asset: Asset) => void` — parent owns any confirm flow.
- `onUploadAssets: (files: File[]) => void` — omit to hide the sidebar drop zone.
- `onSave: (value: string) => void | Promise<void>` — fired by the built-in save button and cmd/ctrl+s; the button renders disabled without it.
- `onSaveDrawing: (result: { dataUrl: string; darkDataUrl?: string }) => void | Promise<void>`
- `drawingDarkMapping: boolean` — use the drawing window's light-to-dark mapping mode.
- `actions: ReactNode` — extra toolbar actions before Save.
- `size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'screen' | 'auto' = 'screen'` — size preset setting height and width (width clamped to the container). 'screen' fills the container at viewport height; sm-2xl step from 20x32rem up to 52x88rem; 'auto' opts out so className owns the sizing.
- `className: string` — extra classes; h-*/w-* classes here override size.

**Example:**
```tsx
const [md, setMd] = useState(INITIAL);

<Desk
  title="the desk"
  subtitle="guides / the-desk"
  value={md}
  onChange={setMd}
  size="xl"
  assets={assets}
  onSave={(value) => save(value)}
  onSaveDrawing={({ dataUrl, darkDataUrl }) => addAsset(darkDataUrl ?? dataUrl)}
  renderMarkdown={(source, { highlightLine }) => (
    <Prose lineSync highlightLine={highlightLine}>{source}</Prose>
  )}
/>
```

## drawing-window

**Role:** floating, draggable, resizable paint window with brush/eraser, undo/redo, zoom/pan, and canvas-size presets
**Install:** `bunx @justin06lee/chrome@latest add drawing-window`
**Composes:** nothing beyond utils

renders a `position: fixed` window (inside a pointer-events-none fullscreen layer at the given `zIndex`) with a draggable title bar, a close button, the canvas area on the left, a tool rail on the right, and a resize handle in the bottom-right corner. the window clamps itself to the viewport with a 16px margin, enforces a 620x520 minimum, and re-clamps on browser resize. it stamps `data-drawing-window="true"` on its root — editor-toolbar's outside-click deactivation keys on that attribute. `active` highlights the border and gates wheel-zoom; `onFocus` fires on any pointer-down inside so a parent can manage a z-order.

drawing uses two canvases: an offscreen source canvas holding the true pixels, and the visible display canvas. in the default direct mode both are black-backed and you draw in dark-friendly colors (`#ffffff`, greens/reds/blues). with `darkMapping` on — the /desk behavior — the source canvas is white and you pick "light" colors (`#000000`, dark greens/reds/blues); every stroke and swatch is remapped per-pixel through an hsl transform (near-white becomes black, near-black becomes white, everything else gets a saturation/lightness lift) so the display shows the dark variant live while the light master is preserved. save then emits `{ dataUrl }` (the source png) plus `darkDataUrl` only when darkMapping is on; with no `onSave`, it downloads the png (the dark variant when available) named after the title.

the tool rail offers a canvas-size preset select (square 1024x1024, wide 1280x720, tall 720x1280 by default — changing preset resets the canvas and history), brush/eraser toggle, color swatches plus a native custom color input, three brush sizes, and undo/redo/clear backed by a 24-snapshot data-url history. snapshot restores are async (`Image.onload`), so rapid undo/redo clicks are ignored until the restore lands. zoom runs 0.5x-4x via the +/- buttons or the wheel (only while `active`); pan with space-drag or middle-drag. `saving` (controlled) and `disableSave` exist so a parent can serialize concurrent saves across windows — editor-toolbar uses them for its one-at-a-time save lock, rendering "Another window is saving..." on the locked buttons.

gotchas: pass `presets`/`colors` as stable references or module constants — the canvas-reset effect keys on the preset's key/width/height rather than object identity to survive inline arrays, but stable props are still the safe pattern. usually you don't render this directly: `editor-toolbar` with `enableDrawing` manages numbered, cascading, focus-ordered windows for you.

**Key props:**
- `title: string = 'drawing'`
- `subtitle: string`
- `initialPosition: { x: number; y: number } = { x: 72, y: 120 }`
- `initialSize: { width: number; height: number } = { width: 780, height: 720 }`
- `active: boolean = true` — highlights the border and enables wheel-zoom.
- `zIndex: number = 80`
- `onClose: () => void`
- `onFocus: () => void`
- `saving: boolean` — controlled saving flag.
- `disableSave: boolean = false`
- `darkMapping: boolean = false` — draw in light colors remapped to a dark variant.
- `presets: DrawingPreset[]`
- `colors: string[]` — hex swatches; defaults depend on darkMapping.
- `brushSizes: number[] = [4, 10, 18]`
- `onSave: (result: { dataUrl: string; darkDataUrl?: string }) => void | Promise<void>` — omit to download the png instead.
- `className: string`

**Example:**
```tsx
{open && (
  <DrawingWindow
    title="drawing #1"
    active
    onClose={() => setOpen(false)}
    onSave={({ dataUrl }) => {
      uploadPng(dataUrl);
      setOpen(false);
    }}
  />
)}
```

## editor

**Role:** split-pane markdown editor whose live preview scrolls and highlights in sync, both ways
**Install:** `bunx @justin06lee/chrome@latest add editor`
**Composes:** nothing beyond utils; npm: lucide-react

installs three files: `editor.tsx` (the `Editor` split-pane plus the standalone `EditorTextarea`), `editor-preview.tsx` (`EditorPreview`), and the `use-line-sync.ts` hook. `Editor` is the turnkey form: a textarea beside a preview, sharing one `useLineSync({ value })` engine. select text in the textarea and a floating "preview" button appears next to the selection; clicking it scrolls the matching preview block level with the selection (viewport-coordinate aligned, clamped below the sticky label bar) and highlights it, leaving a persistent gray streak over the editor lines. clicking a block in the preview goes the other way: the editor scrolls so the matching text lines up center-to-center with the clicked block (mono text is denser than prose, so centers — not top edges — keep the two highlights visually level) and the streak covers the block's lines with trailing blanks trimmed. the pane the user is looking at never moves; only the other one scrolls.

the sync engine (`useLineSync`) owns all the machinery: caret-offset-to-line math, pixel measurement of selections via the classic mirror-div technique (a hidden div styled to wrap exactly like the textarea), an overlay layer translated on scroll so the streak and button track the text 1:1, and re-measurement on window resize. because alignment happens in viewport coordinates, an `EditorTextarea` and `EditorPreview` sharing one engine stay in sync even in separate, non-adjacent containers — this is how desk uses them, and how you build custom layouts: call `useLineSync` yourself, pass `sync` to `EditorTextarea`, and wire `sync.previewRef` + `sync.onPreviewSelectBlock` to `EditorPreview`. `EditorTextarea` also takes a passthrough `onKeyDown` as an escape hatch for layering your own keymap (e.g. a vim mode) over it.

the renderer contract is the load-bearing part: `renderMarkdown(md, { highlightLine })` must stamp `data-source-line` (1-based) on top-level blocks and `data-sync-highlight` on the highlighted one, or sync silently does nothing. the registry's `prose` component does this via `<Prose lineSync highlightLine={highlightLine}>`. the highlight is driven declaratively — the preview holds the line number in state and hands it back to the renderer — because an imperatively-toggled class would be wiped when the renderer rebuilds its dom. `EditorPreview` is memoized so unrelated editor state changes (like clearing a selection on blur) don't reflow the preview mid-click; keep `onSelectBlock` referentially stable if you wire it manually.

sizing: `EDITOR_SIZE_CLASS` maps the presets — `sm: h-80 w-[32rem]`, `md: h-[28rem] w-[44rem]`, `lg: h-[36rem] w-[56rem]`, `xl: h-[44rem] w-[72rem]`, `2xl: h-[52rem] w-[88rem]` (all `max-w-full mx-auto`), and `screen: h-[calc(100dvh-10rem)] min-h-[24rem] w-full`. `editorSizeClass(size)` returns undefined for `auto`. the preset merges before `className` in `cn`, so tailwind-merge lets your `h-*`/`w-*` classes override it. the component draws no outer border — add `className="border border-white/10"` if you want the framed look from the demo.

**Key props:**
- `value: string` (required) — markdown source (controlled).
- `onChange: (value: string) => void` (required) — called with the next source on edit.
- `renderMarkdown: (markdown: string, state: { highlightLine: number | null }) => ReactNode` (required) — renders the markdown with line-sync — typically `(md, { highlightLine }) => <Prose lineSync highlightLine={highlightLine}>{md}</Prose>`.
- `label: ReactNode = 'live preview'` — sticky label over the preview pane.
- `placeholder: string` — editor textarea placeholder.
- `size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'screen' | 'auto' = 'screen'` — size preset setting height and width (width clamped to the container). 'screen' fills the container at viewport height; sm-2xl step from 20x32rem up to 52x88rem; 'auto' opts out so className owns the sizing.
- `className: string` — extra classes; h-*/w-* classes here override size.

**Example:**
```tsx
const [md, setMd] = useState("# hello");

<Editor
  value={md}
  onChange={setMd}
  size="lg"
  className="border border-white/10"
  renderMarkdown={(source, { highlightLine }) => (
    <Prose lineSync highlightLine={highlightLine}>{source}</Prose>
  )}
/>
```

## editor-toolbar

**Role:** the bar above a markdown editor — mode toggle, format buttons, action cluster, and (optionally) the floating drawing windows
**Install:** `bunx @justin06lee/chrome@latest add editor-toolbar`
**Composes:** drawing-window

renders up to two rows. the top row holds the title/subtitle block and an action cluster: a "new drawing" button (when `enableDrawing`), a segmented mode toggle (rendered only when `onModeChange` is passed; the modes default to `["edit", "preview", "split"]` and the active one inverts to white-on-black), and your `actions` node (save buttons, links). the second row appears when there are format buttons or a `status`: each `EditorFormatAction` (`{ label, before, after?, placeholder? }`) renders as a small button with its label lowercased, and `status` right-aligns as a hint (e.g. "save: cmd/ctrl+s"). the exported `MARKDOWN_FORMAT_ACTIONS` default covers H2, Bold, List, Code, Link, and Math. the toolbar is presentational — `onFormat(action)` hands you the action and you do the text splicing (desk shows the canonical implementation); omit `onFormat` to hide the buttons, or pass `formatActions={[]}`.

the exception to "presentational" is drawing: with `enableDrawing`, the toolbar owns a list of `DrawingWindow`s. new windows get the lowest free 1-based number (closing #1 frees the number for reuse) and cascade 28px per open window; titles read "drawing #N" with `drawingSubtitle` underneath. focusing a window moves it to the end of the array so its `zIndex` (80 + index) puts it on top; a capture-phase pointerdown listener deactivates the active window when you click anywhere outside `[data-drawing-window]`. saves are serialized with a lock — while one window's `onSaveDrawing` is in flight, every other window's save button is disabled — and a window closes itself after its save resolves.

`drawingDarkMapping` forwards to each window's light-to-dark mode. note the drawing windows are fixed-position portals in the layout sense (rendered as siblings after the toolbar div, but `position: fixed`), so the toolbar can live inside any container without clipping them.

**Key props:**
- `title: ReactNode`
- `subtitle: ReactNode`
- `mode: string` — current view mode; pass onModeChange to render the toggle.
- `onModeChange: (mode: string) => void`
- `modes: string[] = ['edit','preview','split']`
- `actions: ReactNode` — right-hand button cluster.
- `formatActions: EditorFormatAction[] = MARKDOWN_FORMAT_ACTIONS`
- `onFormat: (action: EditorFormatAction) => void` — fired on a format button; omit to hide them.
- `status: ReactNode` — right-aligned hint in the format row.
- `enableDrawing: boolean = false` — show 'new drawing' and own the numbered drawing windows.
- `onSaveDrawing: (result: { dataUrl: string; darkDataUrl?: string }) => void | Promise<void>` — fired when a drawing window saves; it then closes.
- `drawingSubtitle: string` — subtitle under each window's 'drawing #N' title.
- `drawingDarkMapping: boolean` — use the drawing window's light-to-dark mapping mode.
- `className: string`

**Example:**
```tsx
const [mode, setMode] = useState("split");

<EditorToolbar
  title="getting started"
  subtitle="guides / getting-started"
  mode={mode}
  onModeChange={setMode}
  onFormat={(action) => wrapSelection(action)}
  status="save: cmd/ctrl+s"
  enableDrawing
  onSaveDrawing={({ dataUrl }) => uploadPng(dataUrl)}
  actions={<button className="bg-white px-4 py-1.5 text-sm font-medium text-black">save</button>}
/>
```

## inline-edit

**Role:** blur-to-save editable text field with pending state, error rollback, and escape-to-cancel
**Install:** `bunx @justin06lee/chrome@latest add inline-edit`
**Composes:** nothing beyond utils

a controlled `<input>` that looks like plain text until hovered (transparent bottom border that fades in on hover, brightens on focus — matching the input primitive's language). it holds a local draft over the caller-owned `value` and commits through `onCommit` on blur or Enter. while the commit promise is in flight the field disables itself; if `onCommit` throws, the draft rolls back to the previous `value`. Escape discards the draft and blurs — a transient flag suppresses the commit the blur would otherwise trigger. commits are no-ops when the draft is unchanged or empty (it just snaps back), and the draft is trimmed first unless `trim={false}`.

the behavior lives in a headless `useInlineEdit({ value, onCommit, trim })` hook installed alongside (`use-inline-edit.ts`), returning `{ draft, setDraft, pending, commit, cancel, onKeyDown }` — use it directly to build inline-editable elements that aren't a bare input. the hook is careful about races: a generation token means an external `value` change supersedes any in-flight commit, an in-flight counter guarantees `pending` always resolves, and the draft re-syncs to `value` when it changes externally but never mid-edit.

the component spreads the remaining input props (aria-label, placeholder, onBlur/onKeyDown are chained after the internal handlers), so it drops into forms and table cells directly — manager-table uses it for row renaming. installed to `components/ui/inline-edit.tsx` and `hooks/use-inline-edit.ts`.

**Key props:**
- `value: string` — controlled source of truth, owned by the caller.
- `onCommit: (next: string) => void | Promise<void>` — commit handler (onblur / enter). throw to roll back to the previous value.
- `trim: boolean = true` — trim the draft before comparing / committing.

**Example:**
```tsx
const [name, setName] = useState("untitled");

<InlineEdit
  value={name}
  onCommit={async (next) => {
    await api.rename(next); // throw to roll back
    setName(next);
  }}
/>
```

## manager-table

**Role:** admin table of rows you can inline-rename, recolor, archive, and delete (with confirm)
**Install:** `bunx @justin06lee/chrome@latest add manager-table`
**Composes:** inline-edit, color-swatch, dialog

renders a plain `<table>` with four columns — Name, Color, Status, Actions — over a `ManagerRow[]` model: `{ id, name, color?, archived? }`. the name cell is an `InlineEdit` (blur/Enter commits through `onRename(id, name)`), the color cell is a `ColorSwatchPicker` over the `palette` hexes committing through `onRecolor(id, hex)`, status is an archive/unarchive toggle firing `onArchive(id, !archived)`, and the delete action first asks for confirmation through the dialog provider (`useDialog().confirm` with a danger button) before firing `onDelete(id)`. archived rows render at 40% opacity.

every mutation is a callback and the rows array is the source of truth — the table holds no row state, so the parent applies each change (or persists it and re-renders). because it calls `useDialog`, it must be rendered inside a `DialogProvider` (installed with the `dialog` registry dependency); forgetting the provider is the most common integration failure. the exported `DEFAULT_MANAGER_PALETTE` provides eight muted hexes; a custom `palette` should be a stable reference since the swatch list is memoized on it.

**Key props:**
- `rows: ManagerRow[]` (required) — rows to render; the source of truth, owned by the caller.
- `palette: string[] = DEFAULT_MANAGER_PALETTE` — hex colors offered by the recolor swatch picker.
- `onRename: (id: string, name: string) => void` — commit a renamed row.
- `onRecolor: (id: string, color: string) => void` — commit a recolored row.
- `onArchive: (id: string, archived: boolean) => void` — toggle a row's archived flag.
- `onDelete: (id: string) => void` — delete a row (already confirmed).
- `className: string`

**Example:**
```tsx
<DialogProvider>
  <ManagerTable
    rows={rows}
    onRename={(id, name) => update(id, { name })}
    onRecolor={(id, color) => update(id, { color })}
    onArchive={(id, archived) => update(id, { archived })}
    onDelete={(id) => remove(id)}
  />
</DialogProvider>
```

## now-playing-bar

**Role:** pinned bottom "now playing" bar for a running activity, with a live elapsed timer and an action slot
**Install:** `bunx @justin06lee/chrome@latest add now-playing-bar`
**Composes:** nothing beyond utils

a thin black bar pinned to the bottom edge (`fixed` to the viewport by default, or `sticky` inside a scroll container via `position`), matching the upstream calendar bar on the source site. the left side is a button (clickable only when `onClick` is set) stacking a tiny "NOW PLAYING" label, the title line, and an optional subtitle. when `startedAt` is set the title line shows the activity with a live elapsed timer appended (` · 1h 2m` / `2m 3s` / `4s`, tabular-nums, mirroring the upstream format); omit `startedAt` for the idle state, which renders "Nothing running" in muted text. `actions` is a right-side slot, typically a stop button.

the timer ticks every second only while running and visible, and it is hydration-safe: `now` starts as null (a `Date.now()` initial state would differ between server render and hydration) and the elapsed string renders from `startedAt` itself until the clock starts client-side. `visible={false}` returns null and tears the interval down. `accent` adds a small colored dot before the running title — the source bar has no accent, so omit it for the faithful look. all data is props/callbacks; there is no built-in activity state.

when using `position="fixed"` (the default), remember it overlays page content — give the page bottom padding, or use `position="sticky"` as the last child of an `overflow-hidden`/scrolling container as the demo does.

**Key props:**
- `title: ReactNode` (required)
- `startedAt: number | Date` — when set, shows a live elapsed timer ticking every second; omit for the idle state.
- `accent: string` — optional css color for a small dot before the running title. omit for the source-faithful look.
- `subtitle: ReactNode`
- `actions: ReactNode` — right-side slot, e.g. a Stop button.
- `onClick: () => void`
- `visible: boolean = true` — hide the bar and tear down the timer.
- `position: 'fixed' | 'sticky' = 'fixed'`
- `className: string`

**Example:**
```tsx
<NowPlayingBar
  position="sticky"
  title="Deep work — writing"
  subtitle="focus session"
  startedAt={startedAt}
  actions={<Button size="sm" variant="outline" onClick={stop}>Stop</Button>}
/>
```

## socials

**Role:** row of social icon links driven by a links map — only supplied platforms render
**Install:** `bunx @justin06lee/chrome@latest add socials`
**Composes:** nothing beyond utils; npm: lucide-react

renders a `<nav aria-label="Social links">` of square icon buttons in a fixed platform order: github, linkedin, x, email, youtube, instagram, website. you pass a `links` map (`Partial<Record<SocialKey, string>>`); entries that are missing or empty strings are skipped, and if nothing remains the component renders null. every non-email entry is a plain `<a target="_blank" rel="noopener noreferrer">` — framework-agnostic, no router involved. icons come from lucide-react except the x glyph, which is shipped inline (lucide has no x/twitter icon) wrapped to match the `LucideIcon` interface.

the email entry is special: its `links.email` value is a bare address (not a mailto url), and clicking copies it to the clipboard, flipping the hover tooltip to "Copied!" for 1.5s; if the clipboard api is unavailable (e.g. an insecure context) it falls back to navigating to `mailto:`. every button shows a white slide-up tooltip on hover and keyboard focus.

`size` (sm/md/lg maps to 9/10/11 tailwind squares with 16/18/20px icons) and `gap` (tight/normal/loose) tune density; the row wraps with `flex-wrap`. the component also accepts `className` on the nav for placement, though it's not listed in the meta props.

**Key props:**
- `links: Partial<Record<'github' | 'linkedin' | 'x' | 'email' | 'youtube' | 'instagram' | 'website', string>>` (required) — platform to url (or bare email address for `email`); empty entries are skipped.
- `size: 'sm' | 'md' | 'lg' = 'md'`
- `gap: 'tight' | 'normal' | 'loose' = 'normal'`

**Example:**
```tsx
<Socials
  links={{
    github: "https://github.com/justin06lee",
    x: "https://x.com/justin06lee",
    email: "hi@justin06lee.dev",
    website: "https://justin06lee.dev",
  }}
/>
```
