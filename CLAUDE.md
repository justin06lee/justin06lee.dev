# CLAUDE.md

## Project Overview
Personal site for justin06lee.dev. Three surfaces share one Next.js app:
1. **Public portfolio** — animated home, ASCII donut, scramble text, gallery, articles, a pet-the-cat page.
2. **Personal calendar / time tracker** — day/month/year views, plans + "actuals" with a one-running-per-track invariant (parallel activity lanes), plan/actual overlap heatmap, prayer-time markers.
3. **Two admin surfaces** — `/me` (item CRUD + site config) and `/desk/*` (article CMS that writes back to a GitHub repo).

Dark-only theme, minimal black/white aesthetic, motion-driven, ASCII flourishes. Lowercase voice everywhere.

## Commands
- `bun run dev` — Next dev server (Turbopack)
- `bun run build` — Production build. **It writes into the same `.next` the dev server reads** (Next 15.5 has no separate dev output dir), so a running `bun run dev` answers 500 on every page afterwards until it is restarted.
- `bun run start` — Start production server
- `bun run lint` — ESLint
- `bun run test` — Vitest run
- `bun run test:watch` — Vitest watch

## Tech Stack
- **Framework**: Next.js 15.5 (App Router), React 19, TypeScript 5
- **Bundler / package manager**: Turbopack, **Bun**
- **Styling**: Tailwind CSS 4 (no shadcn). Custom CSS vars in `globals.css`. **Poppins is the site's one typeface** — self-hosted in `public/` in four weights via `next/font/local` (`--font-poppins`, also `--font-sans`). Geist Mono (`font-mono`) survives only where the glyph grid is the point: ASCII art, the donut, code blocks, and the markdown editors. Don't put `font-mono` on UI text — labels, times, and section headings are Poppins (letterspaced uppercase where a label is wanted). The one exception in the nav is the `^cat^` wordmark: mono on purpose (ascii carets, leading to an ascii page), and `text-sm` so it sits at the links' size rather than the body's 16px. There is no `@font-face` for Poppins in CSS on purpose; a second declaration for the same family once won over the local file and dropped the body to the system sans.
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
    apps/[slug]/                  # App-store style product page per project
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
    gallery/                      # MangaPages, CrtMonitor (+crt-gl, crt-dial),
                                  # AppStoreList, ProjectWall, WallEditor
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
    app-store.ts, app-store-parse.ts  # store listing: README screenshots, releases, repo record
    project-images.ts, project-images-parse.ts  # hero image + site-icon resolution

public/
  crt/monitor.webp                # cut-out Macintosh Color Display bezel (transparent glass, apple cloned out)
  ascii/ascii{1,3,4,9}.txt        # responsive ASCII swap on small screens
  cat-sprite.jpg                  # 12x10 cat sprite sheet
  Poppins-{Regular,Medium,SemiBold,Bold}.ttf  # the site's typeface, self-hosted (OG images read Regular)
```

## Projects gallery
`/gallery?tab=projects` renders one of two hangs, chosen by the `wallMode` site-config key:
- **`auto`** (default) — projects are split into **themes** and each theme gets its own layout: `panels` → composed manga pages, `terminal` → one photographed CRT monitor (`CrtMonitor`), `icons` → an App Store clone (`AppStore`) with a product page per app at `/apps/[id]`.
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

### CRT monitor (`components/gallery/CrtMonitor.tsx`, `crt-gl.ts`, `crt-dial.ts`)
The terminal pieces play on a photograph of an Apple Macintosh Color Display (`public/crt/monitor.webp`, 1200x991, a cut-out with a transparent hole where the glass was; the apple on the bezel was cloned out). The glass is a WebGL canvas **behind** the photo: the photo's alpha does the masking, so the shader never knows the hole's shape. Positions in the component are shares of the photo, measured off its alpha channel — the hole spans x 14.9–87.4%, y 17.2–82.4% and tapers toward the bottom; the two controls sit at the ends of the bezel's bottom band (which runs x 9.4–92.4%), the knob at x 19.6% and the power button on the LED slot at x 82.1%, both at y 91.8%. Nothing is printed on the bezel; the on-screen display names the channel for a moment. Re-cutting the photo means re-measuring those numbers.
- **The controls are tilted to the band, not laid flat on it.** The front of the case is convex and was shot from a little above, so the band's bottom edge climbs about 6° from the middle to either end and each end recedes; a flat circle there read as a sticker. `--tilt` on the knob and the power button is a 2D rotate by that slope, then a perspective turn away, mirrored between the two. Their centring lives in the `translate` *property* and the tilt in `transform`, so `:active` extends one without touching the other — restating the offset in `transform` on top of Tailwind's `translate` utilities jumped the power button half its width on every press.
- **The picture fills the glass.** `pictureSpan` covers the canvas, stretching the picture off its own aspect by up to 15% on the long axis and cropping the rest evenly, so none of the picture's own background is left showing beside black. With the barrel and the keystone, overscan 1.0 already covers every pixel of the hole — checked numerically against the alpha channel; re-check if the curve, the keystone, or the `SCREEN` box changes.
- **The shader (`crt-gl.ts`) is the effect, not CSS.** Barrel curvature, a keystone (the set was shot slightly from above, so the raster is wider at the top), aperture grille, scanlines, rolling bar, coarse and fine grain, mains flicker, chromatic fringing, two faults (the vertical hold slipping so the picture rolls every ~11s, horizontal sync tearing a band sideways every ~5s), and three states the cabinet drives per frame: grey off-station static (`snow`), colour bars torn sideways (`glitch`), and inverted colours (`invert`).
- **The knob is a rotary channel selector that turns all the way round.** `crt-dial.ts` is pure: one detent per channel spread over 360°, so the last channel clicks on to the first in either direction. The knob's angle is one unbounded number of degrees and the channel is read off it (`channelAt`); nothing else stores which channel is on. Dragging shows static between detents (`staticAmount`: the picture holds for 22% of a step either side of a detent, then static ramps in over a few degrees) and flips to the next project past each midpoint — clockwise is next, anticlockwise previous. Release snaps to the nearest detent; a plain click steps one clockwise; arrow keys step once it has focus. It is a `role="slider"`.
- **Hovering the glass kicks the set**: ~260ms of colour bars sheared by band, a 340ms shake of the whole cabinet (CSS), then the picture with inverted colours until the pointer leaves — and leaving just restores the colours, no effect. Mouse pointers only (a tap is the click), and only while the set is on. The glass stays a real `<a>` to the project (middle-click, open-in-new-tab work); when the set is off it is a button that switches it on.
- **The set lights the room.** `loadPicture` returns a luminance-weighted `tint` of the picture; the component lifts it toward white into `--crt-glow`, which colours a glow behind the cabinet (`.crt-room`), light on the plastic (`.crt-bezel-light`, masked with the photo itself so it never spills into the hole), and a pool on the floor in front with a contact shadow under the foot (`.crt-floor`). Static throws grey, the inverted picture throws the inverted tint, and switching off fades it all (`--crt-lit`). The pool is a lobe centred on the set's foot, faded in with a mask over the set's lower quarter so it meets the wall's glow without a seam — a lobe that began at the band drew a hard horizontal line either side of the set. The room below it is a `pt-[31%]` spacer *inside* the stage: a percentage padding resolves against the containing block's width, and on the stage itself that was the section, which reserved three times the pool's height and pushed the store away. The set is small on purpose (`max-w-[480px]`): a little lit screen in a dark room, not a hero.
- **The render loop runs only while the set is on, on screen, and something is changing.** Under `prefers-reduced-motion` it draws one still frame per state (no roll, tear, flicker, glitch, shake, or collapse; static and inversion still show). No WebGL → a flat `<img>` with CSS scanlines, grain for the static, and `filter: invert` on hover.
- **Pictures are rasterised through a 2D canvas before upload (`loadPicture`).** SVGs are fetched as text and drawn at the size the glass wants, since a sizeless SVG reports 300x150 to an `<img>` and uploaded as a blur. An SVG that animates (CSS `animation` or SMIL — the bmo and alpaca sprites bob their letters) is sampled into up to 30 frames at 10fps: drawing an `<img>` to a canvas always renders time zero of its animations, so each frame is the same document with every delay and `begin` shifted back by that frame's time (`shiftAnimations`, pure and tested), and the shader swaps textures by the clock. One texture per frame, never an atlas — thirty frames stacked outgrow the guaranteed texture size on phones. Reduced motion takes one frame; a fetch that fails (no CORS, blocked by the CSP) falls back to the plain image path. Cross-origin images need CORS; GitHub raw sends it.

### App store (`lib/app-store.ts`, `components/gallery/AppStoreList.tsx`, `app/apps/[slug]`)
**This is the one surface that is deliberately not in the site's design language.** It is styled as the App Store — continuous-corner squircle icons via a CSS mask, grey pills with blue capitals, hairlines inset to the text, `#8e8e93` secondary text, `#0a84ff` links, Title Case section names. Nothing here should pick up the site's uppercase letterspaced labels or 1px square borders, and nothing elsewhere should pick this up; the store's CSS is scoped under `.appstore`. The one store trait it doesn't copy is the type: it is set in Poppins like everything else on the site.

Everything the store shows past the item row is **read from the project's own repo** — screenshots are the README's non-icon images, "What's New" is GitHub releases (falling back to version tags without notes), the information block is the repository record. Nothing is stored twice: add a screenshot to the README or cut a release and the page follows.
- **One button, one word: OPEN.** It opens the site when the project has one and the source when it doesn't (`openTarget`); it never says which. Both are real anchors; the row's own link to `/apps/[id]` is a stretched overlay behind the text so nothing nests.
- A project whose only URL is a deployed site (no repo) gets its icon from the site's `apple-touch-icon` / largest `rel=icon` (`getSiteIcon`) — this is how `thehifzproject.com` stopped being a placard.
- `/apps/[id]` works for any project item, not just icon-theme ones; the store list only links the icon ones. Pure parsing (`readmeIntro`, `pickScreenshots`, `siteIconCandidates`, `platformsFor`) is in `app-store-parse.ts` and tested.

### Hero images (`lib/project-images.ts`)
`probeImage` keeps `exists` separate from `dims` on purpose: a **404 means try the next README candidate**, while a 200 whose bytes can't be measured is still a good image and is kept at a default aspect. Collapsing the two is what put broken frames on the wall — a renamed asset left the dead URL rendering anyway. `heroImageCandidates` returns *all* non-badge refs so that fall-through has somewhere to go.

`probeImage` fetches a **32KB byte range**, not the file: every format keeps its size in the header, and a whole-file read of a large screenshot inside the render overflowed the dev server's response stream (React serialises awaited values into its dev-only debug payload) and truncated the gallery on every cold start. A server that ignores `Range` answers 200 with the whole body and is measured the same way.

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
