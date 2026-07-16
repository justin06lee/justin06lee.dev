# MISSING — chrome-registry gaps found migrating justin06lee.dev

Status after the second pass. The chrome registry was updated mid-migration and
that release closed almost every gap the first pass found. This file now records
**what's resolved** (and how) and the **few items still open**.

Where an entry says **(patched installed copy)**, the owned copy under
`src/components/chrome/` was edited; upstream the same change so a fresh `add`
ships it.

---

## ✅ Resolved by the chrome update + rewire

Each former gap and the new prop/component that closed it:

| gap | closed by | where |
|-----|-----------|-------|
| navbar: independent left/right link groups, ReactNode labels, button items, mobile-panel union | `navbar` native `leftLinks` + `NavLink { label: ReactNode, href?, onClick? }` | `src/components/Navbar.tsx` (dropped the old `mobilePanelExtras` patch) |
| socials needs lucide brand icons (github/linkedin/…) that lucide 1.24 dropped | `socials` now **inlines** the brand glyphs (copied from lucide 0.540) — version-independent | lucide unpinned back to `^1.24.0` |
| prose: no client-side routing for internal links | `prose` `linkComponent` | `src/app/articles/[slug]/article-view.tsx` (`linkComponent={Link}`) |
| prose: no light/dark theme image swap | `prose` `resolveImageSrc` | article-view (`resolveImageSrc` reuses `lib/theme-images`) |
| article-list: no entrance stagger | `article-list` `stagger` (default true) | already on; verified |
| calendar: month grid needs rich day cells (task list, heatmap tint, counters) | `calendar` `renderCell` + `cellClassName` | `src/components/calendar/MonthView.tsx` (now chrome `Calendar`) |
| heatmap: month labels not linkable | `heatmap` `monthHref` + `linkComponent` | `src/components/calendar/YearView.tsx` |
| manager-table: no protected/system rows or in-use delete guard | `manager-table` `locked` rows + async `onDelete` (reject → inline error) | `src/components/calendar/CategoriesManager.tsx` (Sleep = locked; in-use delete rejects) |
| timeline: streamed marker slot (prayer times behind `<Suspense>`) | `timeline` `markersSlot` + exported `TimelineMarker` | `src/components/calendar/DayView.tsx` + `PrayerMarkers.tsx` (deleted `PrayerTimeMarker.tsx`) |
| timeline: display-only blocks (no interactivity) | `timeline` `onEventClick` / `tracks` / `onEventChange` exist now | day view keeps its richer bespoke overlay blocks by choice (dashed/pulse/alt-count visuals); the native path is available if wanted |
| desk: no editor `onKeyDown` → vim lost | `desk`/`editor` `textareaProps` (composes) | `src/app/desk/OperatorArticleEditor.tsx` + new `useVimKeymap.ts` (full keymap recovered from git `6e90aaf`) |
| desk: preview shows raw front-matter (line-sync 1:1) | `desk`/`editor` `transformSource` → `{ body, lineOffset }` | OperatorArticleEditor (reuses `lib/article-draft` + `bodyLineOffset`) |
| file browser / grid (drag-to-trash + type-name confirm) | new `file-grid` component | `src/app/desk/OperatorFileGrid.tsx` → chrome `FileGrid` |
| stacked-paper download card | new `file-card` component | available (bespoke `article/file-card.tsx` deleted) |
| breadcrumb for the desk header | `breadcrumb` (+ `crumbsFromPath`) | `src/app/desk/OperatorHeader.tsx` |
| sprite-scrubber: edge dead-zones froze frames; no load state | full-width mapping + `onEdge` (per-sweep) + `onLoad` + `renderLoading` | `src/app/cat/page.tsx` |
| calendar: built-in header duplicated the external nav | added `showHeader` prop **(patched installed copy)** | `src/components/chrome/calendar.tsx` + MonthView `showHeader={false}` |

---

## ⚠️ Still open

### prerequisites-sidebar — genuinely app-specific, not a component gap
`src/components/article/prerequisites-sidebar.tsx` parses a `prerequisites:`
front-matter list, fetches each referenced article's title from GitHub, and maps
it to a route. This is domain logic (content model + GitHub coupling), not a
reusable UI primitive, so it stays bespoke by design. No registry action needed.

### CLI / toolchain issues (still reproduce)
1. **`add` writes to the repo root, not `src/`.** Even with `aliasBase: "src"`
   in `chrome.json`, the CLI wrote `components/chrome/…`, `hooks/…`, `lib/…` and
   a stray `components/chrome/app/not-found.tsx` at the repo root. Worked around
   by moving files into `src/` each run. Layout detection should be deterministic
   and honor `aliasBase`.
2. **Internal imports aren't rewritten to the configured alias.** Installed files
   still import `@/components/ui/<name>` even though `chrome.json`'s components
   alias is `@/components/chrome`. Worked around by rewriting them. The SKILL doc
   says the CLI does this on install — it didn't here.

### small registry bug (patched locally)
- `file-grid` shipped with an unescaped apostrophe ("this can't be undone") that
  fails Next's build-time `react/no-unescaped-entities` lint. Fixed locally to
  `can&apos;t`; upstream the escape. **(patched installed copy)**

### minor cosmetic residuals (acceptable; noted for completeness)
- `manager-table` recolor swatch derives its tooltip from the hex string, so the
  category color tooltip shows the hex rather than the palette color's friendly
  name. Its `onRecolor`/`onArchive` are `void` (no error channel), so those two
  failures still use the page's top-level banner; rename/delete surface inline.
- `breadcrumb` has no `linkComponent`, so the desk header trail navigates with
  full page loads. A `linkComponent` prop (like `sidebar`/`prose` have) would fix
  it.
- `/me`: gallery items (title/tech/year/repo/live/pin) don't fit `manager-table`'s
  name/color/archive row model, so the item list stays `Card`+`Badge`+`Button`;
  the item "move" popover stays bespoke. These are correct fits, not gaps.
- `calendar` header arrows use `‹`/`›` glyphs rather than lucide chevrons — a
  small deviation from the "no ascii arrows" design rule in the registry itself.

### upstream suggestions worth filing
- `calendar`: land a `showHeader` prop (done locally) so agenda grids under an
  external nav don't double up.
- `breadcrumb`: add `linkComponent`.
- CLI: honor `aliasBase` and rewrite internal imports on `add`.
