# MISSING — gaps found migrating justin06lee.dev onto the chrome registry

This file tracks components (or props) the site needed that the chrome registry
(`@justin06lee/chrome`) does not yet cover, or covers only partially. Each entry
notes what the site does today, why the existing chrome component can't express
it as-is, and a suggested addition to the library.

Where an entry says **(patched installed copy)**, the site's owned copy under
`src/components/chrome/` was edited to unblock the migration; the same change
should be upstreamed into the registry so a fresh `add` ships it.

---

## navbar — independent left/right link groups + ReactNode labels + mobile extras  (patched installed copy)

**Site need:** the top nav has links on *both* sides — a left cluster
(`justin06lee.dev`, an **intro** replay *button*, and a `^cat^` rainbow link) and
a right cluster (`calendar`, `articles`, `gallery`). On mobile, the slide-in panel
must list the union of both clusters. The `^cat^` link renders through `<Rainbow>`
(a ReactNode, not a string) and the intro control is a `<button>` (router push),
not an `<a href>`.

**Chrome today:** `Navbar` takes `brand` (left ReactNode), `links: {label: string,
href: string}[]` (right side + mobile panel), and `actions` (desktop-only right
extras). Labels are plain strings, there is only one link group, and the mobile
panel renders only `links` — so a left-side button/rainbow link can't appear in
the panel.

**Patched installed copy:** added an optional `mobilePanelExtras?: ReactNode` slot
to `src/components/chrome/navbar.tsx`, rendered above `links` inside the mobile
panel. The site passes the intro button + rainbow cat there.

**Suggested library addition:** either (a) allow `NavLink.label: ReactNode` and add
a `leftLinks` group that also flows into the mobile panel, or (b) formalize a
`mobilePanelExtras` slot. Option (a) is the more general fix.

---

## CLI / registry issues found during install (not component gaps, but worth fixing)

These are toolchain problems that had to be worked around by hand; they aren't
about a missing component but they blocked the migration.

1. **`lucide-react` pinned to `^1.24.0` dropped all brand icons.** `socials`
   imports `Github`, `Linkedin`, `Youtube`, `Instagram` from `lucide-react`, but
   1.24 removed brand glyphs — so chrome's own `socials` fails to compile against
   the version the CLI installs. Worked around by pinning `lucide-react` to
   `^0.540.0`. The registry should either pin a lucide version that still ships
   brand icons or inline the brand glyphs (as it already does for the X icon).

2. **Cross-component imports use a hard-coded `@/components/ui/` alias.** Every
   multi-part component (`gallery`, `desk`, `prose`, `manager-table`,
   `article-list`, `calendar-nav`, `editor`, `tag-input`, `image-cropper`,
   `login-form`, `not-found`, plus `use-line-sync`) imports its siblings from
   `@/components/ui/<name>`, ignoring the `components` alias in `chrome.json`
   (here `@/components/chrome`). The CLI should rewrite these to the configured
   alias on `add`. Worked around by rewriting all `@/components/ui/` →
   `@/components/chrome/` in the installed copies.

3. **Layout misdetection on later `add`s.** The first install landed files under
   `src/components/chrome/`, but a subsequent `add` wrote to `./components/chrome/`
   and `./lib/` at the repo root instead of `src/`. Worked around by moving the
   files into `src/` and deleting the root strays. The CLI's src-layout detection
   should be deterministic across runs.

---

# Component gaps by surface

Everything below is a place where a chrome component either doesn't exist or
can't (yet) express what the site needed, so a bit of bespoke code was kept.
The affected surface still builds and works; these are registry wishlist items.

## desk (article CMS) — the biggest gaps

### desk / editor — no editor `onKeyDown` escape hatch → vim mode lost
**Site need:** the old editor had an optional vim keymap (hjkl / w / b / e / dd …)
toggled via localStorage. **Chrome:** `Desk` fully owns its textarea and exposes
no `onKeyDown`, so the keymap can't be layered on. (`EditorTextarea` *does* expose
`onKeyDown` per the docs, but composing `EditorTextarea` + `EditorToolbar` +
`AssetSidebar` + `EditorPreview` + `useLineSync` by hand means re-implementing all
of Desk's splice/save glue.) **Suggested:** let `Desk` forward an
`editorProps.onKeyDown` (or a `textareaProps`) down to its `EditorTextarea`.
**Status:** vim mode dropped in the migration — flag for the site owner.

### desk / prose line-sync assumes preview === editor value 1:1 → front-matter shows in preview
**Site need:** the editor value carries front-matter (`# title`, `cover:`,
`excerpt:`, `tags:`, `prerequisites:`) that the old preview parsed out, rendering
only the styled body. **Chrome:** `useLineSync` maps editor line N ↔ preview block
N with no offset, so the preview must render exactly what the textarea holds — the
front-matter lines now appear in the preview. **Suggested:** a `bodyLineOffset` (or
a `transformSource`) on `Editor`/`Desk`/`Prose lineSync` so a host can strip/skip a
front-matter region while keeping line mapping correct.

### breadcrumb — not installed / not in registry set used here
`OperatorHeader` (breadcrumb trail + new-article / sign-out links) stayed bespoke.
A `breadcrumb` component exists in the registry docs but wasn't needed elsewhere;
if adopted, the header could use it.

### file browser / grid — no chrome equivalent
`OperatorFileGrid` (a grid of `file-card`s with drag-to-trash delete and a
type-the-name-to-confirm modal) has no chrome counterpart. Kept bespoke.
**Suggested:** a `file-grid` / asset-manager component (distinct from
`asset-sidebar`, which is an in-editor insert rail, not a browser).

### asset upload — drop-onto-textarea path lost
Chrome `AssetSidebar` uploads via its own dashed drop zone; the old
drop-a-file-directly-onto-the-editor upload path is gone (dragging a sidebar row
into the textarea still inserts the markdown ref). Minor.

## articles

### prose — no theme-managed (light/dark) image variant swap
The old `markdown-renderer` swapped `foo-light.png` ↔ `foo-dark.png` via
`theme-images.ts`. Chrome `Prose` renders images as-is. The site is dark-only so
impact is limited, but an article authored with light/dark variants won't swap.
**Suggested:** an optional image `srcResolver`/`onResolveImage` hook on `Prose`.

### prose — no `linkComponent` for client-side internal routing
Chrome `Prose` renders every link as a plain `<a>` (external → `target=_blank`).
Internal `/…` links and `#` anchors that used `next/link` now do full navigations.
**Suggested:** a `linkComponent` prop like `sidebar` already has.

### article-list — no per-card entrance stagger
The bespoke index staggered each card's fade-in; chrome `ArticleList` renders the
grid with no stagger (top-level heading/grid fade is still present). Cosmetic.

### prerequisites-sidebar & file-card — no chrome equivalent
Prerequisite parsing/resolution (async GitHub title fetch + route mapping) and the
animated stacked-paper download card have no chrome counterparts. Both are used by
`/desk`, so they were kept regardless. (chrome `stack` could be the visual base for
a `file-card`-style component.)

## calendar

### calendar — month grid needs rich day cells
Chrome `Calendar` is a compact `size-9` date *picker*; the site's `MonthView` has
tall cells (`min-h-28`) listing each day's task titles, a done/total counter, a
per-cell heatmap background, and "+N more". `renderDay` only injects small content
under the day number and can't restructure the cell. **Kept `MonthView` bespoke.**
**Suggested:** a `month-grid` variant (or a `cellClassName` + full-cell
`renderDay` replacement) for schedule/agenda month views.

### manager-table — no protected/system rows or in-use delete guards
Chrome `ManagerTable`'s row model `{ id, name, color?, archived? }` has no
`isSystem` concept, so it would offer rename/delete on the built-in **Sleep**
category (which must be protected), and it can't express "block delete because the
category is in use" or the optimistic name-draft/rollback. **Kept
`CategoriesManager` bespoke** (it does use chrome `Select` + `ColorSwatchPicker`).
**Suggested:** `ManagerRow.locked`/`protected` flags + an async `onDelete` that can
reject with a surfaced error.

### timeline — display-only; no interactive/editable blocks
Chrome `Timeline` renders positioned blocks but they aren't clickable/editable, and
it's single-track. The site's day view is a **dual-track** (plan + actuals)
interactive editor. Resolution: render chrome `Timeline` for the visual track
(border, hour grid, now-line) in both columns and overlay the bespoke
`PlanBlock`/`ActualBlock` interaction layer on top. **Suggested:** an
`onEventClick` (and optional editable/drag) affordance, plus a multi-track mode.

### timeline markers — can't consume a streamed/server slot
The site streams prayer-time markers in via `<Suspense>` (a deliberate
architecture so a slow Aladhan API never blocks day render). Timeline's `markers`
prop needs the data client-side up front, which would break the streaming, so
`PrayerMarkers`/`PrayerTimeMarker` stayed bespoke (their markup already matches
Timeline's marker lines). **Suggested:** allow `markers` to accept a React node /
children slot that can be `<Suspense>`-streamed.

### heatmap — month labels aren't linkable
The old year view linked each month name to that month's view; chrome `Heatmap`
renders plain month labels. Minor navigation affordance lost.

## cat

### sprite-scrubber — edge dead-zones double as frame dead-zones
`edgeLeft`/`edgeRight` clamp *both* the pointer-to-pat detection and the frame
mapping, so within the outer ~22% margins the sprite now freezes on the first/last
frame instead of continuing to sweep. The old code mapped the full width to frames
and used the edges only for pat detection. Also `SpriteScrubber` has no load state,
so the "loading…" overlay stayed bespoke. **Suggested:** decouple the pat/callback
dead-zones from the frame-mapping range (or expose a full-range mode with a
separate `onEdge` callback).

## me

### Minor
- `ManagerTable` didn't fit gallery items (title/tech/year/repo/live/pin/move), so
  the item list was rebuilt from `Card` + `Badge` + `Button`. (Same root cause as
  the calendar entry — `ManagerTable` is name/color/archive only.)
- The item **move** dropdown popover stayed bespoke; chrome `menu` exists but the
  underline-style **tab bar** was kept over chrome `Tabs` (pill look) for fidelity.

