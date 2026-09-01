# CLAUDE.md

## Project Overview
Personal site for justin06lee.dev. Three surfaces share one Next.js app:
1. **Public portfolio** — animated home, ASCII donut, scramble text, gallery, articles, a pet-the-cat page.
2. **Personal calendar / time tracker** — day/month/year views, plans + "actuals" with a one-running-per-track invariant (parallel activity lanes), plan/actual overlap heatmap, prayer-time markers.
3. **Two admin surfaces** — `/me` (item CRUD + site config) and `/desk/*` (article CMS that writes back to a GitHub repo).

Dark-only theme, minimal black/white aesthetic, motion-driven, ASCII flourishes. Lowercase voice everywhere.

## Commands
- `bun run dev` — Next dev server (Turbopack)
- `bun run build` — Production build
- `bun run start` — Start production server
- `bun run lint` — ESLint
- `bun run test` — Vitest run
- `bun run test:watch` — Vitest watch

## Tech Stack
- **Framework**: Next.js 15.5 (App Router), React 19, TypeScript 5
- **Bundler / package manager**: Turbopack, **Bun**
- **Styling**: Tailwind CSS 4 (no shadcn). Custom CSS vars in `globals.css`. Geist sans + mono via `next/font`, Poppins for body.
- **Animation**: `motion` v12 (`motion/react-client`) — staggered fade/slide patterns
- **Theme**: `next-themes`, dark mode forced
- **Database**: **Turso / libSQL** via `@libsql/client` (raw SQL, no ORM)
- **Markdown**: `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` + `rehype-slug`
- **Sanitization**: markdown is rendered with `react-markdown` + `skipHtml` (raw HTML is dropped, not sanitized); there is no `dangerouslySetInnerHTML` anywhere
- **Auth**: hand-rolled DB-backed sessions + httpOnly cookie + ADMIN_KEY env
- **Content source**: GitHub Contents API (read for articles, read+write for the operator/CMS)
- **Analytics**: `@vercel/analytics`
- **Tests**: Vitest (Node env)

## Project Structure
```
src/
  app/
    page.tsx, home-client.tsx     # Hero (intro animation, donut, scramble text, socials)
    layout.tsx, globals.css       # Root layout, Tailwind theme vars, keyframes
    not-found.tsx                 # 404 with random ASCII
    opengraph-image.tsx, twitter-image.tsx, robots.ts, sitemap.ts, manifest.ts

    gallery/                      # Tabbed grid (projects | hobbies | in-development)
    articles/                     # GitHub-backed markdown articles
      [slug]/                     # Per-article view + parsed prerequisites
    cat/                          # Sprite-sheet petting + global pat counter
    calendar/                     # Personal calendar — see "Calendar" section
      day/[date], month/[yyyymm], year/[yyyy], categories/
    me/                           # Item + site-config CMS (admin)
      wall/                       # Free-form projects-wall editor (admin)
    desk/                         # Article CMS (admin) — writes to GitHub
      [slug]/, new-article/, content-actions.ts (server actions)
    oddjobs/                      # Placeholder

    api/
      auth/             # session login/logout
      config/           # site config (description, socials, pfp, prayerLocation)
      items/            # gallery item CRUD + /move
      uploads/          # binary uploads stored in Turso
      pats/             # global cat-pat counter (origin-gated)
      pats/, calendar/  # calendar tasks/actuals/categories/prayer-times CRUD
      geocode/reverse/  # reverse-geocode helper for prayer location detect
      desk/upload/      # admin image upload to GitHub
      articles/revalidate/

  components/
    Navbar.tsx, HomePage.tsx, AsciiDonut.tsx, PfpTile.tsx, Socials.tsx
    ItemGallery.tsx, GalleryTabs.tsx
    ArticleList.tsx, article/{markdown-renderer,table-of-contents,...}.tsx
    Dialog.tsx, Select.tsx, theme-provider.tsx
    calendar/                     # DayView, MonthView, YearView, CalendarShell,
                                  # PlanBlock, ActualBlock, ActualsEditor,
                                  # TaskEditor, NowPlayingBar, PlannedTodaySheet,
                                  # CategoriesManager, CategoryPicker, PrayerMarkers
    author/                       # OperatorArticleEditor, OperatorFileGrid,
                                  # OperatorDrawingWindow, OperatorLoginForm, ...

  lib/
    utils.ts                      # cn() = clsx + tailwind-merge
    db.ts                         # Turso client, schema bootstrap (initDb), migrations
    auth.ts, auth-server.ts       # session, rate limits, requireAdmin*()
    site-config.ts                # SiteConfig, getSiteConfig (cached), prayer location
    items.ts                      # gallery items query
    calendar.ts                   # tasks + actuals CRUD, overlap heatmap scoring
    calendar-categories.ts        # category CRUD + palette validation
    calendar-dates.ts             # tz-aware date helpers, intervals, heatmap buckets
    calendar-validate.ts          # API input validation + bounds
    calendar-constants.ts         # shared IDs (e.g. SLEEP_CATEGORY_ID)
    colors.ts                     # 8-color category palette + tint helpers
    prayer-times.ts               # Aladhan API client w/ 3-tier cache
    github.ts, github-paths.ts    # public article reader (Contents API)
    operator-content.ts           # admin: write articles/images back to GitHub
    article-draft.ts, article-sections.ts  # markdown parsing/serializing
    theme-images.ts

public/
  ascii/ascii{1,3,4,9}.txt        # responsive ASCII swap on small screens
  cat-sprite.jpg                  # 12x10 cat sprite sheet
  Poppins-Regular.ttf             # body font
```

## Projects gallery
`/gallery?tab=projects` renders one of two hangs, chosen by the `wallMode` site-config key:
- **`auto`** (default) — projects are split into **themes** and each theme gets its own layout: `panels` → composed manga pages, `terminal` → pixel-art cards, `icons` → a uniform grid.
- **`manual`** — the hand-arranged wall from `/me/wall` (`ProjectWall` + `lib/gallery-wall.ts`).

### Themes (`lib/gallery-themes.ts`)
Classification is a deliberate ladder of cheap heuristics, most explicit first: the item's `collection` column → the hero image's **filename** (`*-panel.*`, `icon.*`/`logo.*`, `*pixel*`/`*tui*`) → a hardcoded slug seed → aspect ratio. Lean on the filename rule going forward: rename the asset in the repo and the gallery re-sorts itself with no code change. The slug seed is a bandage for today's projects and rows can be deleted as repos are renamed.

### Manga pages (`lib/manga-layout.ts`)
The material is already-composed manga panels — someone framed each one — so the layout's hard constraint is **never re-crop**. An earlier fixed-slot template version violated this badly (`reze` lost 47% of itself); do not reintroduce any layout that picks a panel's shape before knowing the image's.

- **A page is a split tree, not a list of rows.** `pageShapes` enumerates a deliberately narrow grammar — a page is a stack of tiers, a tier is a run of frames across, a frame is sometimes a short column of stacked panels, and nothing nests deeper. That grammar *is* the vocabulary of a printed page; widening it is how the wall drifts back into arbitrary rectangles.
- **Every node's width is affine in its height (`w = m·h + c`, `c` in px carrying only gap terms).** Panel: `m = aspect, c = 0`. Row: `m = Σmᵢ, c = Σcᵢ + g(n-1)`. Stack: `m = 1/Σ(1/mᵢ), c = (Σ(cᵢ/mᵢ) - g(n-1))/Σ(1/mᵢ)`. Solving that top-down from the container width lands every panel on its own exact aspect — no crop, no dead space — at any width. **This is the load-bearing identity; changing a node type means re-deriving both terms.**
- **What varies to absorb the images is the page's height, never a panel's shape.** A page is as tall as its panels require. Uniform page height was the thing given up, on purpose.
- **Structure is chosen by scoring, not by rule.** Every template × a bounded set of panel assignments is solved and scored; the hard terms are the page-height band and a minimum panel edge (`minPanelSize`, 200px of the 1120 reference width — a *share* of the page, since the layout scales whole, so it holds on a phone too), and the soft ones are taste — a focal frame, a per-page drawn target height, a penalty on one flat tier of bare panels. Node geometry is invariant to the order of a node's children, so assignments are sampled rather than exhausted past n=4. ~2ms for a 12-panel wall. The edge floor is squared and weighted far above the taste terms — as a linear nudge it lost to them, and a ~130px sidecar next to a full-width band was routine — but stays finite, because a 5:1 strip sharing a tier puts the floor out of reach of every candidate and the least-bad page still has to win.
- **Rendering is `width: calc(P% + Qpx)` per node plus `aspect-ratio` per panel.** Because the relation is affine, each child's width is affine in its parent's, so the browser reproduces the solve exactly — no measurement, no client JS, no first-paint reflow. `min-width: 0` and `flex: none` are load-bearing: a flex item's automatic minimum size is its content's, which would let a wide image refuse its solved slot. Rows use `align-items: flex-start`, never `stretch` — stretch overrides `aspect-ratio` and crops.
- **Panels are `object-contain`, not `object-cover`.** The box is already the image's exact aspect, so the two agree when the measured dimensions are right — but when a measurement is stale or unreadable, contain shows a sliver of black and cover silently eats the art. Only one of those is recoverable.
- Pages keep the tight 8px seam inside and a 48px black gutter between. Page splitting happens before layout, so it can never strand a single panel.
- **A fresh seed per request is the point.** The gallery re-deals every load, so a newly added project lands anywhere rather than always at the bottom. `?seed=N` pins one for comparison.

### Hero images (`lib/project-images.ts`)
`probeImage` keeps `exists` separate from `dims` on purpose: a **404 means try the next README candidate**, while a 200 whose bytes can't be measured is still a good image and is kept at a default aspect. Collapsing the two is what put broken frames on the wall — a renamed asset left the dead URL rendering anyway. `heroImageCandidates` returns *all* non-badge refs so that fall-through has somewhere to go.

The measured dimensions are what *size the panel*, so a stale measurement mis-frames the art. Two things guard that: lookups are memoised with React `cache()` (per render pass) and never a module-level Map — a Map outlives the request and pinned `toji` at a dead 599x181 while GitHub served 1234x393, cropping 5% of it off — and the image probe shares the README's 1h revalidate window, because what is really cached there is the measurement, not the bytes.

Invariants worth knowing before changing the hand-arranged wall:
- **Positions are design units, not pixels.** Desktop is authored on a 1200-unit canvas, mobile on a 390-unit one (`DESIGN_WIDTH`), and the renderer scales by `containerWidth / DESIGN_WIDTH`. This is what makes the editor WYSIWYG — there is no reflow to diverge from, only a scale factor. Never store or compare these numbers as CSS pixels.
- **The two variants are independent layouts**, stored in separate columns (`items.wall_desktop` / `wall_mobile`). Editing one must never write the other; `ProjectWall` picks between them by *measured container width*, not by a media query.
- **`seedWall` is shared by the editor and the public page, and must stay that way.** It keeps stored boxes verbatim and packs anything unplaced into a block below the hang. If only the editor seeded, a project added since the last arrangement would silently vanish from the live gallery.
- **`wall_image` is rendered into a public `<img src>`**, so `PUT /api/items/wall` allowlists its scheme (site-relative or `http(s)` only). Keep that check if the field grows new write paths — `javascript:`/`data:` must stay rejected.
- **The wall crops (`object-cover`), the salon does not (`object-contain`).** Deliberate: on a hand-arranged wall the author sized the box, so the box is the intent; in the salon the image's aspect drives the box, so cropping would be a bug.
- Alignment snapping beats grid snapping per axis (lining up with a neighbour is more deliberate than landing on an arbitrary step). Resize snapping only anchors the edges the handle drives — snapping the fixed edge makes the box escape the cursor.
- `?wall=preview` force-renders the manual wall for an admin without publishing; the param is inert for everyone else.

## Calendar
Most substantial piece of recent work. Three primitives:
- **Plans** (`calendar_tasks`) — what was planned. Optionally timed, optionally "uncertain" with up to 16 `PlanFallback` alternatives (each with its own `categoryId`, `title`, `startTime`, `endTime`).
- **Actuals** (`calendar_actuals`) — what happened. Closed (start+end) or running (`end_at IS NULL`). Each sits on a `track` (lane): 0 is primary, 1..7 are activities running in parallel with it.
- **Categories** (`calendar_categories`) — palette-restricted (8 fixed hexes in `colors.ts`), with a built-in "Sleep" system row.

Invariants worth knowing before changing this code:
- **At most one running actual _per track_.** Enforced by partial UNIQUE index `idx_calendar_actuals_running_track ON calendar_actuals(track) WHERE end_at IS NULL`. App code does an optimistic check, then catches `SQLITE_CONSTRAINT_UNIQUE` to surface `concurrent-start` / `would-overlap-running` errors. Overlapping rows on *different* tracks are legal and expected — that is what parallel tracks are for — so any overlap check must be scoped to one lane (see `updateActual`).
- **`startActual` is atomic and lane-local** — stop-prior-on-this-track + insert-new in a single `db.batch`. It never touches other lanes; use `stopAllActuals` to end everything. An omitted `track` means lane 0, never "all lanes".
- **`getRunningActual` is a lossy view** now that lanes exist — it returns the lowest occupied lane for callers that can only render one timer. Use `getRunningActuals` anywhere that can show more than one, and `GET /api/calendar/actuals/running?all=1` for the array shape (the default response stays a bare `CalendarActual` for pre-parallel clients).
- **No FK enforcement at DB level** (libsql doesn't enable `PRAGMA foreign_keys`). `SET NULL` semantics are simulated in app code. Always validate `categoryId` / `planId` via `categoryExists` / `planExists` before insert/update.
- **Cross-midnight actuals** are anchored to their start date but clamped per visible day with `clampActualToDay`. Day queries fetch yesterday too so a block that crosses midnight still renders.
- **Heatmap match rule is asymmetric**: parent plan matches actuals by `category_id` only; each alternative matches by `(category_id, lowercased trimmed title)`. Fulfilled sub-intervals are unioned to avoid double-counting overlapping candidates.
- **DST-correct datetime-local round-trips**: `localInputToEpoch` does a two-pass offset correction; never use `new Date(s)` for `<input type="datetime-local">` values.

Prayer times come from the Aladhan API, fetched per month, with a three-tier cache (in-memory → `prayer_times_cache` table → API). Streamed in via `<Suspense>` so a slow API never blocks day-view render.

## Auth Model
- `ADMIN_KEY` env var is the master password. Compared via `timingSafeEqual`.
- `POST /api/auth` → `checkRateLimit` (10 attempts / 15min, 24h lockout) → mint UUID session, set httpOnly `admin_session` cookie.
- `sessions` table is DB-backed so logins survive serverless cold starts.
- **Route Handlers**: `requireAdmin(req)` returns a 401 NextResponse or null; `requireAdminWithMutationRate(req)` also enforces 200/min per-IP write throttle.
- **Server Components / Server Actions**: `isAdminServer()` / `requireAdminServer()` (uses `cookies()` from `next/headers`).
- `/api/pats` is the only public mutation — Origin-header gated, separate token-bucket rate limit, `delta` capped per-request.
- `/me` is in `robots.ts` `disallow`. `/desk/*` is metadata `noindex, nofollow`.

## Conventions
- Path alias `@/*` → `src/*`.
- Server components by default. `"use client"` only where needed.
- Content-heavy / dynamic routes: `export const dynamic = "force-dynamic"`.
- Tailwind classes composed via `cn()`.
- CSS vars (`--background`, `--foreground`, `--surface`, `--surface-alt`, `--border`, `--muted`, `--accent`) drive the dark theme. Both `:root` and `.dark` set them — always design against these tokens, not raw colors.
- Animations: `motion/react-client` with intentional staggered delays. Keep timings consistent with existing patterns when adding components.
- **Comments explain *why*, not *what*.** Concurrency races, DST quirks, FK simulation, asymmetric match rules — these warrant comments. Mechanical descriptions don't.
- Defensive JSON parsing throughout (`try/catch` returning a safe default for malformed columns).
- DB schema is bootstrapped by `initDb()` (memoized). Idempotent column additions via `ensureColumn` use a regex allowlist for identifiers (SQLite can't parameterize them).
- Admin endpoints gated by `requireAdmin*` middleware. User-authored markdown is rendered through `react-markdown` with `skipHtml` (raw HTML never reaches the DOM); uploaded images are served with a hardened `Content-Type` allowlist + `Content-Disposition: inline` + `default-src 'none'; sandbox` CSP.
- Security headers (CSP, X-Frame-Options DENY, Permissions-Policy, Referrer-Policy) configured in `next.config.ts`.
- No emojis in product copy or UI.

## Tests
Vitest, Node env, `tests/**/*.test.ts` and `src/**/*.test.ts`. Currently covers `calendar-dates`, `calendar-validate`, and `colors`. Add tests when touching calendar invariants or date math.
