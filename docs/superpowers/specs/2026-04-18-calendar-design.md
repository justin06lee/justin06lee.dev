# Calendar Feature — Design Spec

**Date:** 2026-04-18
**Status:** Approved (pending implementation plan)

## Goal

Add a personal calendar at `/calendar` with three views (day, month, year) that lets the site owner plan daily to-do lists — including future days — alongside Islamic prayer times from the Aladhan API. Public visitors see a read-only accountability view; the year view renders a GitHub-style heatmap where darker cells represent more tasks completed that day.

## Non-goals

- Multi-user calendars or sharing
- Recurring tasks / templates
- Notifications or reminders
- Calendar sync (iCal, Google Calendar)
- Per-visitor timezone localization

## Auth model

- **Public, read-only:** anyone can view all three views, heatmap, day schedules, and prayer times.
- **Admin-only edits:** task create/update/delete gated by existing `requireAdmin(req)` middleware. Admin affordances ("Add task", edit/delete buttons) render conditionally when `isAdminServer()` passes on the server.

## Routes

- `/calendar` → redirects to today's day view
- `/calendar/day/[date]` → day view, `date` is `YYYY-MM-DD`
- `/calendar/month/[yyyy-mm]` → month grid
- `/calendar/year/[yyyy]` → year heatmap
- `src/app/calendar/layout.tsx` hosts the view-switcher and date navigator
- All routes export `const dynamic = "force-dynamic"` (matching the rest of the site)
- Add a `Calendar` link to `Navbar.tsx`

## Data model

Three database concerns:

### `calendar_tasks` (new Turso table)

| Column      | Type    | Notes                                             |
| ----------- | ------- | ------------------------------------------------- |
| id          | TEXT PK | uuid                                              |
| date        | TEXT    | `YYYY-MM-DD`, indexed                             |
| title       | TEXT    | sanitized via DOMPurify                           |
| notes       | TEXT    | nullable, sanitized                               |
| start_time  | TEXT    | `HH:MM`, nullable; nullable = untimed             |
| end_time    | TEXT    | `HH:MM`, nullable                                 |
| done        | INTEGER | 0 / 1                                             |
| position    | INTEGER | manual ordering within a day, default 0           |
| created_at  | INTEGER | unix millis                                       |
| updated_at  | INTEGER | unix millis                                       |

Index: `CREATE INDEX idx_calendar_tasks_date ON calendar_tasks(date);`

### `prayer_times_cache` (new Turso table)

| Column     | Type    | Notes                                                       |
| ---------- | ------- | ----------------------------------------------------------- |
| cache_key  | TEXT PK | `"{year}-{month}\|{city}\|{method}"`                        |
| year       | INTEGER |                                                             |
| month      | INTEGER | 1–12                                                        |
| city       | TEXT    |                                                             |
| country    | TEXT    |                                                             |
| method     | INTEGER | Aladhan calculation method ID                               |
| data       | TEXT    | JSON: `{ "01": {Fajr, Dhuhr, Asr, Maghrib, Isha}, ... }`    |
| fetched_at | INTEGER | unix millis                                                 |

### `site_config` extension

Add a `prayerLocation: { city: string; country: string; method: number; timezone: string }` field to the existing JSON blob, where `timezone` is an IANA name (e.g., `"America/New_York"`) used for all date rendering/rollover. No schema migration needed — it's an existing JSON column. Editable from `/author` via the existing config editor.

## API routes

All under `/api/calendar/*`, mirroring the `/api/items/*` pattern. Admin mutations use `requireAdmin(req)` and sanitize `title`/`notes` with `isomorphic-dompurify`.

- `GET  /api/calendar/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD` — public read
- `POST /api/calendar/tasks` — admin; create
- `PATCH /api/calendar/tasks/[id]` — admin; update any field
- `DELETE /api/calendar/tasks/[id]` — admin
- `GET  /api/calendar/heatmap?year=YYYY` — public; returns `{ "YYYY-MM-DD": countDone }` for the year
- `GET  /api/calendar/prayer-times?date=YYYY-MM-DD` — public; returns `{ Fajr, Dhuhr, Asr, Maghrib, Isha }` for the date

## Prayer time fetching (Approach 2: month-level cache)

1. `getPrayerTimesForDate(date)` resolves `(year, month)` from the date and `(city, country, method)` from `site_config.prayerLocation`.
2. Looks up `cache_key = "{year}-{month}|{city}|{method}"` in `prayer_times_cache`.
3. **Hit:** parse `data` JSON, return the day's entry.
4. **Miss:** call Aladhan `GET https://api.aladhan.com/v1/calendarByCity/{year}/{month}?city={city}&country={country}&method={method}`. Store the response as a month-keyed JSON map. Return the day's entry.
5. When admin saves a new `prayerLocation` in config, the config-save endpoint issues `DELETE FROM prayer_times_cache` (simplest invalidation — cache repopulates lazily).
6. Aladhan is hit at most once per `(year, month, city, method)` across all visitors forever.

## Components (new: `src/components/calendar/`)

- **`CalendarShell.tsx`** (client) — view-switcher tabs (Day / Month / Year), date navigator (‹ Today ›). Used by `src/app/calendar/layout.tsx`.
- **`DayView.tsx`** (client) — 24-hour vertical timeline:
  - Single column axis, hour labels 00:00 → 23:00
  - Prayer times as thin horizontal marker lines with labels (Fajr, Dhuhr, Asr, Maghrib, Isha)
  - Timed tasks as filled blocks, `top = (startMinutes / 1440) * 100%`, `height` from duration
  - Right-side panel: untimed task checklist + admin "Add task" button
  - Overlapping timed tasks: stack horizontally at 50% width each (v1 handles 2 overlaps gracefully; 3+ is acceptable degradation)
- **`MonthView.tsx`** (client) — 7-column grid (Sun→Sat). Each cell: date number + `done/total` indicator. Click → day view.
- **`YearView.tsx`** (client) — GitHub-style heatmap:
  - 12 rows (months) × up to 31 cells
  - Darkness scale from capped count: `0 → white/0`, `1–2 → white/15`, `3–4 → white/30`, `5–6 → white/55`, `7+ → white/85` (exact Tailwind opacity values tuned during implementation)
  - Hover tooltip: date + "N tasks done"
  - Click → day view
- **`TaskEditor.tsx`** (client, admin-only) — inline/modal form: title, notes, optional start/end time, reorder controls, delete
- **`PrayerTimeMarker.tsx`** — presentational marker rendered inside `DayView`

Styling matches the site: `--surface` cards, `--border` strokes, white-on-black palette, motion fade-ins, `ScrambleText` hover on tabs.

## Data-fetching helpers (`src/lib/calendar.ts`)

Mirrors the shape of `src/lib/github.ts`:
- `getTasksInRange(from: string, to: string): Promise<Task[]>`
- `getHeatmapForYear(year: number): Promise<Record<string, number>>`
- `getPrayerTimesForDate(date: string): Promise<PrayerTimes | null>`
- `createTask`, `updateTask`, `deleteTask` (admin-only; API handlers enforce auth)

Page components (`page.tsx`) are thin server components that call helpers and pass data to client components.

## Heatmap intensity

- Metric: **count of tasks where `done = 1` that day, capped at 7** (approach C from brainstorming)
- Aggregated SQL: `SELECT date, SUM(done) AS count FROM calendar_tasks WHERE date BETWEEN ? AND ? GROUP BY date`

## Error handling & edge cases

- **Aladhan unreachable:** day view renders tasks normally and shows "Prayer times unavailable" in the marker area. No hard failure.
- **Invalid date param** (`/calendar/day/not-a-date`): call `notFound()` → Next.js 404.
- **Past-day edits:** allowed. Heatmap reflects current truth, not historical state — matches "catching up" use case.
- **Timezone:** `prayerLocation.timezone` (IANA) drives all date arithmetic — "today", day rollover, heatmap bucketing. Server uses it when resolving `/calendar` → `/calendar/day/[today]`. No per-visitor localization, since the log reflects the owner's day.
- **Overlapping timed tasks:** 2-up horizontal stack in v1. Documented as acceptable for 3+ overlaps.
- **Concurrent admin edits:** not relevant (single-user admin); last-write-wins is fine.

## Security

- `requireAdmin(req)` on all mutations (matches existing pattern in `/api/articles`, `/api/items`)
- DOMPurify sanitization on `title` and `notes` before DB write
- Rate limiting for public endpoints: reuse existing IP-window helper used by `/cat` if applicable; otherwise rely on Aladhan cache making repeated reads cheap
- No user-supplied HTML rendered without sanitization in day/month views

## Testing

No existing test suite in the repo. Verification strategy:
- `bun run lint` passes
- `bun run build` passes
- Manual test matrix in dev (`bun run dev`):
  1. Admin creates timed + untimed task on today; both render correctly in day view
  2. Admin checks off tasks; year heatmap updates on refresh
  3. Admin plans a task 14 days ahead; day view loads with prayer times for that future date
  4. Admin changes `prayerLocation` in config; new day views re-fetch; stale cache cleared
  5. Logged-out visitor sees read-only views, no edit affordances
  6. Invalid date URLs return 404
  7. Aladhan unreachable (simulate by blocking network): day view renders with fallback message
- Cross-view navigation: clicking a heatmap cell → day view → back arrow → year view preserves scroll

## Out of scope (future work)

- Recurring tasks
- Task templates / "copy yesterday"
- Notifications, email/push reminders
- iCal export
- Multi-user / sharing
- Per-visitor timezone
- Graceful rendering of 3+ simultaneously overlapping timed tasks
