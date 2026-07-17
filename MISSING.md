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
| calendar: built-in header duplicated the external nav | `calendar` now ships a native `showHeader` prop (upstreamed; also switched to lucide chevrons, fixing the ascii-arrow deviation) | MonthView `showHeader={false}` |
| breadcrumb: no client-side routing (full page loads) | `breadcrumb` now has `linkComponent` | `src/app/desk/OperatorHeader.tsx` (`linkComponent={Link}`) |
| manager-table: swatch tooltip showed hex, not friendly name | `palette` now accepts `ManagerPaletteEntry = { value, name }` | `CategoriesManager.tsx` (named `CATEGORY_PALETTE`) |
| manager-table: recolor/archive had no inline error channel | `onRecolor`/`onArchive` now `=> void \| Promise<void>` and reject inline | `CategoriesManager.tsx` (throw on failure; dropped the top-level banner) |
| file-grid: unescaped apostrophe broke the build lint | escape fixed upstream | pulled via `add --overwrite` |

---

## ⚠️ Still open

### prerequisites-sidebar — genuinely app-specific, not a component gap
`src/components/article/prerequisites-sidebar.tsx` parses a `prerequisites:`
front-matter list, fetches each referenced article's title from GitHub, and maps
it to a route. This is domain logic (content model + GitHub coupling), not a
reusable UI primitive, so it stays bespoke by design. No registry action needed.

### CLI / toolchain — fixed upstream, but not yet published
The root-write + unrewritten-import behavior is **fixed in CLI 0.2.0+** (the SKILL
now says so: aliasBase, import rewriting, and page-file placement all require
0.2.0+, and an older cached/global install "writes to the repo root with
unrewritten `@/components/ui/…` imports"). But the latest version **published to
npm is 0.1.1**, so `bunx @justin06lee/chrome@latest` still resolves a pre-0.2.0
CLI here — every `add` still lands in the repo root with `@/components/ui/…`
imports. Workaround each run: move `components/chrome/*`→`src/components/chrome/`,
`hooks/*`→`src/hooks/`, delete the root `components/`,`hooks/`,`lib/` strays and
the stray `components/chrome/app/not-found.tsx`, then rewrite `@/components/ui/`
→ `@/components/chrome/`. **Retire this workaround once chrome CLI 0.2.0 ships to
npm** — then a plain `add`/`add --overwrite` will place files correctly.

### `/me` — not a gap
Gallery items (title/tech/year/repo/live/pin) don't fit `manager-table`'s
name/color/archive row model, so the item list is `Card`+`Badge`+`Button` and the
item "move" popover is bespoke. Correct fits, not gaps.

### upstream suggestions still worth filing
- CLI: publish 0.2.0 to npm so `aliasBase` + import rewriting actually reach
  installs (the code is done; it's a release gap).
