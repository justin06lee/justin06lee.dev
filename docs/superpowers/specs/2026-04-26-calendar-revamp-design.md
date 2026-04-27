# Calendar revamp — design spec

**Date:** 2026-04-26
**Branch:** `feat/calendar-sync`
**Status:** Approved (brainstorm complete; awaiting implementation plan)

## Goal

Turn the existing single-track day planner into a dual-track day journal: a **plan** timeline of intended activities, an **actuals** timeline of what actually happened, with a categorization system that organizes both. Add a sleep tracker as a special case of actuals. Keep the dark, monochrome aesthetic; introduce a constrained muted color palette tied to categories.

## Non-goals (v1)

- External calendar sync (Google, Outlook, iCal) — punted despite the branch name
- Drag-to-resize blocks on the timeline (edits go through the modal)
- Bulk re-categorize / merge categories
- Reminders or notifications when a planned start time arrives
- Month/Year view switching to "actuals time" intensity (API is prepared; UI deferred)
- Export/import
- Multi-user / sharing

## Mental model

Three concepts, in order of dependency:

1. **Category** — a user-defined label with a color. Optional on plans and actuals. Used both as an organizing dimension and as the visual color for blocks. One built-in category, "Sleep," is seeded and cannot be deleted.
2. **Plan task** — the existing `calendar_tasks` row, now with a nullable `category_id`. Represents what you intended to do at a given time on a given day.
3. **Actual** — a new entity. A real wall-clock time block describing what you actually did. Each actual is independent; it may optionally reference a plan via `plan_id`. At most one actual is running at any time (single-active rule).

The sleep/wake button is just an affordance for "start an actual with `category = Sleep`" / "stop the running Sleep actual." No separate model.

When the user clicks "play" on a planned item, the system inserts an actual that copies the plan's category and title and stores a foreign key back to the plan. Renaming the plan later does not rewrite history; the actual keeps the snapshot.

## Data model

### `calendar_categories` (new)

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | uuid |
| `name` | TEXT NOT NULL | unique, case-insensitive |
| `color` | TEXT NOT NULL | hex, drawn from the muted palette |
| `is_system` | INTEGER NOT NULL DEFAULT 0 | 1 for built-in (Sleep) |
| `archived` | INTEGER NOT NULL DEFAULT 0 | hides from picker, preserves history |
| `position` | INTEGER NOT NULL DEFAULT 0 | sort order in dropdown |
| `created_at` | INTEGER NOT NULL | ms epoch |
| `updated_at` | INTEGER NOT NULL | ms epoch |

Seeded on first init: `{ name: "Sleep", is_system: 1, color: <muted indigo>, position: 0 }`.

### `calendar_tasks` (existing, extended)

Add one nullable column:

| column | type | notes |
|---|---|---|
| `category_id` | TEXT NULL | FK → `calendar_categories.id`, ON DELETE SET NULL |

All existing columns and behavior preserved. Old rows load with `category_id = NULL`.

### `calendar_actuals` (new)

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | uuid |
| `date` | TEXT NOT NULL | YYYY-MM-DD; computed once from `start_at` in the configured timezone, never updated |
| `plan_id` | TEXT NULL | FK → `calendar_tasks.id`, ON DELETE SET NULL |
| `category_id` | TEXT NULL | FK → `calendar_categories.id`, ON DELETE SET NULL |
| `title` | TEXT NULL | copied from plan at start, editable independently |
| `start_at` | INTEGER NOT NULL | ms epoch |
| `end_at` | INTEGER NULL | ms epoch; `NULL` ⇒ currently running |
| `notes` | TEXT NULL | |
| `created_at` | INTEGER NOT NULL | ms epoch |
| `updated_at` | INTEGER NOT NULL | ms epoch |

Indexes:
- `idx_calendar_actuals_date` on `date`
- `idx_calendar_actuals_running` partial index on `end_at IS NULL` (fast running-row lookup)

Application-enforced invariant: at most one row with `end_at IS NULL` exists at a time.

### Why epoch for actuals but HH:MM for plans

Plans are abstract slots within a day; HH:MM is sufficient and matches the existing schema. Actuals are real-world events that can cross midnight (sleep) and need timezone-correct math against `Date.now()`; epoch ms is the right primitive. The `date` field on actuals is denormalized for fast range queries and is anchored at insert time.

## Categories: UX & rules

- **Optional everywhere.** Null `category_id` is allowed on both plans and actuals.
- **Display:**
  - Both category + title → `"<Category> — <Title>"` rendered in the category color
  - Category only → just the category name
  - Title only → just the title
- **Picker** (used in plan editor and ad-hoc actuals form):
  - Search field at the top
  - First row, always: `+ Create "<query>"` (or `+ Create new category…` when empty)
  - Below: matching categories ranked by recent use, each with a color swatch
  - Click a category → select & close
  - Click create → inline form with name (pre-filled from query) and color swatch grid (8 swatches; auto-pick least-used by default; user can override)
- **Manage page** (admin-only): `/calendar/categories` (or modal entry from settings). Edit name/color, archive, attempt-delete.
- **Delete rules:**
  - Hard-delete blocked if any plan or actual references the category. API returns 409 with `{ planCount, actualCount }`. Archive is the soft alternative.
  - System categories' name cannot be edited; color and archive flag can.
- **Color palette** (8 muted, dark-theme-friendly tones — exact hexes finalized in implementation): slate-blue, taupe, sage, plum, ochre, terracotta, fog, indigo. Stored as raw hex on the category.

## Sleep & actuals tracker — behavior

### Underlying mechanism (single primitive, used by every entry point)

- **Start actual:** insert row with `start_at = now`. If a row with `end_at IS NULL` exists, set its `end_at = now` first (single-active rule, auto-stop). New row's `category_id`/`title`/`plan_id` come from the request body.
- **Stop actual:** update the running row's `end_at = now`. Idempotent: a stop with no running row returns 200 with `null` and no changes.

### Sleep button

- Always available, regardless of what else is running.
- When no Sleep actual is running → label "Sleep" → click starts an actual with `category = Sleep`, `title = null`, `plan_id = null` (auto-stops anything else).
- When a Sleep actual is running → label "Wake up" → click stops it.

### Play on planned items

- Each plan row in the side panel has a play button.
- Click → starts an actual with `plan_id = plan.id`, `category_id = plan.category_id`, `title = plan.title` (auto-stops anything else).
- We don't disable the play button on already-started plans; clicking again creates another block (this is exactly how pause-and-resume should work — multiple actuals share one `plan_id`).
- The plan row currently being executed shows a "stop" affordance instead of "play."

### "+ New activity" (ad-hoc)

- Quick form: category picker + optional title. Submit → starts an actual with `plan_id = null`.

### Editing actuals

- Click any actual block on the timeline → opens `ActualsEditor` modal: category, title, start time, end time, notes, delete.
- Editing the running actual's `end_at` to a non-null value stops it.
- Validations:
  - `start_at` past `end_at` → 400
  - Edit that would overlap the currently-running actual is rejected (single-active invariant)
  - The `date` field is computed from `start_at` once at insert and never changes (so a sleep block stays "owned" by the day you went to sleep)

### Cross-midnight rendering

A sleep block from 23:00 Apr 26 → 06:00 Apr 27 is one row, `date = "2026-04-26"`. It renders on both days' timelines: Apr 26's view shows it from 23:00 → 24:00; Apr 27's view shows it from 00:00 → 06:00. The day-view component clamps each block's render bounds to the visible day.

## API surface

All endpoints are admin-gated via `requireAdmin(req)` and use `force-dynamic`. JSON only.

### Categories

- `GET /api/calendar/categories` — list. Active first, archived after, system pinned.
- `POST /api/calendar/categories` — body `{ name, color }`. 409 on duplicate name (case-insensitive).
- `PATCH /api/calendar/categories/[id]` — body `{ name?, color?, archived? }`. Blocks editing system categories' name.
- `DELETE /api/calendar/categories/[id]` — 409 with `{ error, planCount, actualCount }` if referenced.

### Plan tasks (existing, extended)

- `GET/POST /api/calendar/tasks` and `PATCH/DELETE /api/calendar/tasks/[id]` accept optional `categoryId` in bodies.
- Response shape adds `category: { id, name, color } | null` (joined for convenience).

### Actuals

- `GET /api/calendar/actuals?from=YYYY-MM-DD&to=YYYY-MM-DD` — range query, returns rows with joined `category` and `plan` summary `{ id, title }`.
- `GET /api/calendar/actuals/running` — single running actual or 204.
- `POST /api/calendar/actuals/start` — body `{ planId?, categoryId?, title? }`. Server timestamps `start_at = Date.now()`. Auto-stops any running actual; response includes the stopped row (if any) plus the new running row.
- `POST /api/calendar/actuals/stop` — stops the running actual; 200 with the stopped row, or 200 with `null` if none was running.
- `PATCH /api/calendar/actuals/[id]` — edit `categoryId`, `title`, `startAt`, `endAt`, `notes`. Validates ordering and the single-active invariant.
- `DELETE /api/calendar/actuals/[id]` — hard delete.

### Heatmap

- `GET /api/calendar/heatmap?year=YYYY&metric=plans|actuals` — `metric` defaults to `plans` (existing behavior). `actuals` returns total tracked minutes per day. UI does not yet expose a toggle (out of scope for v1).

### Migration

`initDb()` performs additive `CREATE TABLE IF NOT EXISTS` for `calendar_categories` and `calendar_actuals`, plus `ALTER TABLE calendar_tasks ADD COLUMN category_id TEXT` (guarded by a `pragma_table_info` check). Seeds the Sleep category if absent.

## UI components

### New components (`src/components/calendar/`)

- `CategoryPicker.tsx` — searchable dropdown, "Create" pinned at top
- `CategoryCreateInline.tsx` — name + color swatch grid form
- `ActualBlock.tsx` — render a single actual on the timeline (filled, category color)
- `PlanBlock.tsx` — extracted from the existing `TimedBlock`, now rendered with category color, dashed/outlined treatment
- `ActualsEditor.tsx` — modal for editing/deleting an actual (mirror of `TaskEditor` structure)
- `NowPlayingBar.tsx` — mobile sticky bottom bar; reads `/api/calendar/actuals/running`; shows current activity, elapsed time, Sleep/Wake button, expand handle
- `PlannedTodaySheet.tsx` — full-screen sheet (mobile) / right column (desktop). Sections: "Now playing," "Sleep" button, "Planned today" (deduped plan list), "+ New activity" CTA → opens `AdHocActualForm`
- `AdHocActualForm.tsx` — category picker + optional title → `POST /api/calendar/actuals/start`
- `colors.ts` — palette constants + `pickNextUnusedColor`, `cssTintFor`

### Modified existing components

- `DayView.tsx` — major revamp. Desktop: 3-column grid (Plan | Actuals | side panel). Mobile (`<md:`): merged timeline (plan dashed/outlined on left half, actuals filled on right half, sleep full-width) + sticky bottom bar. Receives `tasks`, `actuals`, `categories`, `runningActualId`, `isAdmin`, `timezone`, `today` as props.
- `TaskEditor.tsx` — adds `<CategoryPicker>`. All other fields unchanged.
- `MonthView.tsx` / `YearView.tsx` — unchanged for v1. Continue to drive off plan completion.
- `date-utils.ts` — adds `epochToHHMM(ms, tz)`, `epochToMinutesOfDay(ms, tz)`, `clampActualToDay(date, start, end, tz)`.

### Library layer

- `src/lib/calendar.ts` — gains `getActualsInRange`, `getRunningActual`, `startActual`, `stopActual`, `updateActual`, `deleteActual`. Existing task functions return joined `category` data.
- `src/lib/calendar-categories.ts` (new) — `listCategories`, `createCategory`, `updateCategory`, `deleteCategory`, `usageCount(categoryId)`.
- `src/lib/db.ts` — `initDb()` performs the new schema additions and Sleep seed.

### Animations

- Side panel and sticky bar: existing entrance fade conventions
- Actuals start/stop: no animation (must feel instant)
- The currently-running block on the timeline gets a subtle pulsing right-edge marker

## Verification plan (translates into implementation plan tests)

- Start actual with no others running → row inserted, `end_at = null`, returned
- Start a second actual → first one auto-stopped at same `now`, second running
- Start actual from a plan → `category_id`/`title` copied, `plan_id` set
- Stop with nothing running → 200 with `null`, no DB changes
- Sleep button toggle: starts a Sleep actual when none running; stops the running Sleep when there is one
- Sleep started while another actual is running stops that actual
- Create category with duplicate name (case-insensitive) → 409
- Delete category with references → 409 with `planCount`, `actualCount`
- Cross-midnight actual renders correctly on both days at correct positions
- Edit `start_at` past `end_at` → 400
- Edit a stopped actual to overlap the running one → rejected
- Mobile breakpoint shows merged timeline + sticky bar; desktop shows 3 columns
- Existing `calendar_tasks` rows with `category_id = NULL` load and render fine (backwards compatibility)
- Old `/api/calendar/tasks` clients (no `categoryId` in body) still work

## Open considerations (deferred)

These were called out during brainstorming and are not in v1, but the design accommodates them:

- Year view "actuals time" toggle (API ready via `metric=actuals`)
- Bulk re-categorize / merge — would be a category-management page extension
- Recurring plans — separate model; this design doesn't preclude it
- External sync — distinct project; FK from actuals to a future external-event table is plausible
