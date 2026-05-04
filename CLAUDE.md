# CLAUDE.md

## Project Overview
Personal site for justin06lee.dev. Three surfaces share one Next.js app:
1. **Public portfolio** — animated home, ASCII donut, scramble text, gallery, articles, a pet-the-cat page.
2. **Personal calendar / time tracker** — day/month/year views, plans + "actuals" with a single-running invariant, plan/actual overlap heatmap, prayer-time markers.
3. **Two admin surfaces** — `/me` (item CRUD + site config) and `/author/*` (article CMS that writes back to a GitHub repo).

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
- **Sanitization**: `isomorphic-dompurify`
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
    author/                       # Article CMS (admin) — writes to GitHub
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
      operator/upload/  # admin image upload to GitHub
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
    sanitize.ts, theme-images.ts

public/
  ascii/ascii1..9.txt             # responsive ASCII swap on small screens
  cat-sprite.jpg                  # 12x10 cat sprite sheet
  Poppins-Regular.ttf             # body font
  justin06leefav.png              # favicon
```

## Calendar
Most substantial piece of recent work. Three primitives:
- **Plans** (`calendar_tasks`) — what was planned. Optionally timed, optionally "uncertain" with up to 16 `PlanFallback` alternatives (each with its own `categoryId`, `title`, `startTime`, `endTime`).
- **Actuals** (`calendar_actuals`) — what happened. Closed (start+end) or running (`end_at IS NULL`).
- **Categories** (`calendar_categories`) — palette-restricted (8 fixed hexes in `colors.ts`), with a built-in "Sleep" system row.

Invariants worth knowing before changing this code:
- **At most one running actual.** Enforced by partial UNIQUE index `idx_calendar_actuals_running ON calendar_actuals(end_at) WHERE end_at IS NULL`. App code does an optimistic check, then catches `SQLITE_CONSTRAINT_UNIQUE` to surface `concurrent-start` / `would-overlap-running` errors.
- **`startActual` is atomic** — stop-prior + insert-new in a single `db.batch`.
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
- `/me` is in `robots.ts` `disallow`. `/author/*` is metadata `noindex, nofollow`.

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
- Admin endpoints gated by `requireAdmin*` middleware. User HTML sanitized with `isomorphic-dompurify`.
- Security headers (CSP, X-Frame-Options DENY, Permissions-Policy, Referrer-Policy) configured in `next.config.ts`.
- No emojis in product copy or UI.

## Tests
Vitest, Node env, `tests/**/*.test.ts` and `src/**/*.test.ts`. Currently covers `calendar-dates`, `calendar-validate`, and `colors`. Add tests when touching calendar invariants or date math.
