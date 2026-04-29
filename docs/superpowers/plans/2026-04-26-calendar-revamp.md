# Calendar Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dual-track day view (plan + actuals timelines), add a category system that ties both together, and add sleep tracking as a built-in actuals category — per spec at `docs/superpowers/specs/2026-04-26-calendar-revamp-design.md`.

**Architecture:** Three new concepts in the database (`calendar_categories`, `calendar_actuals`, plus a `category_id` column on `calendar_tasks`). A unified "start an actual / stop the running actual" primitive backs both the play-on-plan and sleep buttons; a single-active invariant is enforced server-side. UI is a 3-column desktop layout that merges into one timeline + sticky bottom bar at the `md:` breakpoint.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Tailwind 4, Motion v12, Turso/libsql via `@libsql/client`, Bun. Tests added via Vitest for pure helpers; DB-touching library code and API routes are verified manually via dev server + curl.

**Conventions inherited from the codebase:**
- All admin endpoints gated by `requireAdmin(req)`; all data routes set `export const dynamic = "force-dynamic"`
- Snake_case in DB / camelCase in TS; `rowToX` mappers in lib code
- Booleans stored as INTEGER 0/1; timestamps as `Date.now()` epoch ms
- IDs from `crypto.randomUUID()`
- Color via Tailwind utility classes against the dark theme; CSS custom props in `globals.css`
- Motion entrance fades on initial render, `useRef(hasAnimated)` to skip on renavigation

**Note on testing:** This plan introduces Vitest for pure-function unit tests (date math, colors, validation helpers). API routes and UI are verified manually with curl + browser walkthroughs because the project has no e2e infrastructure today and adding it is out of scope. If you want to skip Vitest entirely, omit Task 1 and the "Run unit tests" substeps in later tasks — manual verification still covers correctness end-to-end.

---

## Task 1: Add Vitest for unit testing pure helpers

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/.gitkeep`

- [ ] **Step 1: Install Vitest**

```bash
bun add -d vitest @vitest/ui
```

Expected: package.json updated, lockfile updated.

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add test scripts to `package.json`**

In `package.json`'s `scripts` block add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Sanity-check Vitest is wired**

Create `tests/sanity.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("vitest works", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `bun run test`
Expected: 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock vitest.config.ts tests/sanity.test.ts
git commit -m "chore(test): add vitest for unit testing pure helpers"
```

---

## Task 2: Add color palette + helpers (`src/lib/colors.ts`)

**Files:**
- Create: `src/lib/colors.ts`
- Create: `src/lib/colors.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/colors.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { CATEGORY_PALETTE, isPaletteColor, pickNextUnusedColor } from "./colors";

describe("CATEGORY_PALETTE", () => {
  it("has 8 muted entries with name + hex", () => {
    expect(CATEGORY_PALETTE).toHaveLength(8);
    for (const c of CATEGORY_PALETTE) {
      expect(c.name).toMatch(/^[a-z-]+$/);
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("isPaletteColor", () => {
  it("accepts a known palette hex", () => {
    expect(isPaletteColor(CATEGORY_PALETTE[0].hex)).toBe(true);
  });
  it("rejects unknown hexes", () => {
    expect(isPaletteColor("#ff0000")).toBe(false);
    expect(isPaletteColor("not-a-hex")).toBe(false);
  });
});

describe("pickNextUnusedColor", () => {
  it("returns the first palette color when none are used", () => {
    expect(pickNextUnusedColor([])).toBe(CATEGORY_PALETTE[0].hex);
  });
  it("skips used colors and returns the first unused one", () => {
    const used = [CATEGORY_PALETTE[0].hex, CATEGORY_PALETTE[1].hex];
    expect(pickNextUnusedColor(used)).toBe(CATEGORY_PALETTE[2].hex);
  });
  it("wraps to least-used when all are taken", () => {
    const used = CATEGORY_PALETTE.map((c) => c.hex);
    used.push(CATEGORY_PALETTE[3].hex); // index 3 used twice
    const result = pickNextUnusedColor(used);
    expect(result).not.toBe(CATEGORY_PALETTE[3].hex);
    expect(CATEGORY_PALETTE.map((c) => c.hex)).toContain(result);
  });
});
```

- [ ] **Step 2: Run the tests; expect failure**

Run: `bun run test src/lib/colors.test.ts`
Expected: failure ("Cannot find module './colors'").

- [ ] **Step 3: Implement `src/lib/colors.ts`**

```typescript
export type PaletteColor = { name: string; hex: string };

export const CATEGORY_PALETTE: readonly PaletteColor[] = [
  { name: "slate-blue",  hex: "#5b7a8a" },
  { name: "taupe",       hex: "#7a6b5b" },
  { name: "sage",        hex: "#6b8a72" },
  { name: "plum",        hex: "#7a5b78" },
  { name: "ochre",       hex: "#8a7a5b" },
  { name: "terracotta",  hex: "#8a6655" },
  { name: "fog",         hex: "#7a8085" },
  { name: "indigo",      hex: "#5b5b8a" },
] as const;

export const SLEEP_DEFAULT_HEX = "#5b5b8a"; // indigo

const PALETTE_HEX_SET = new Set(CATEGORY_PALETTE.map((c) => c.hex));

export function isPaletteColor(hex: string): boolean {
  return PALETTE_HEX_SET.has(hex);
}

/**
 * Returns the palette hex used least often in `usedHexes`.
 * Ties broken by earlier palette position. If `usedHexes` is empty, returns the first color.
 */
export function pickNextUnusedColor(usedHexes: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const c of CATEGORY_PALETTE) counts.set(c.hex, 0);
  for (const h of usedHexes) {
    if (counts.has(h)) counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  let bestHex = CATEGORY_PALETTE[0].hex;
  let bestCount = Infinity;
  for (const c of CATEGORY_PALETTE) {
    const n = counts.get(c.hex) ?? 0;
    if (n < bestCount) {
      bestCount = n;
      bestHex = c.hex;
    }
  }
  return bestHex;
}

/** Returns inline style object: filled fill at low opacity for category-tinted blocks. */
export function categoryTintStyle(hex: string | null | undefined, alpha = 0.32) {
  if (!hex) return undefined;
  return {
    backgroundColor: `${hex}${alphaToHex(alpha)}`,
    borderColor: `${hex}${alphaToHex(Math.min(1, alpha + 0.45))}`,
  } as const;
}

function alphaToHex(a: number): string {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255);
  return v.toString(16).padStart(2, "0");
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `bun run test src/lib/colors.test.ts`
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/colors.ts src/lib/colors.test.ts
git commit -m "feat(calendar): add muted color palette + helpers for categories"
```

---

## Task 3: Extend `date-utils.ts` with epoch + cross-midnight helpers

**Files:**
- Modify: `src/components/calendar/date-utils.ts`
- Create: `src/components/calendar/date-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/components/calendar/date-utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  epochToDateInTz,
  epochToMinutesOfDay,
  clampActualToDay,
  hhmmToMinutes,
} from "./date-utils";

const NYC = "America/New_York";
const UTC = "UTC";

describe("epochToDateInTz", () => {
  it("returns YYYY-MM-DD for an epoch in the given tz", () => {
    // 2026-04-26T12:00:00Z → in NYC that's 2026-04-26 (08:00 EDT)
    const ms = Date.UTC(2026, 3, 26, 12, 0, 0);
    expect(epochToDateInTz(ms, NYC)).toBe("2026-04-26");
  });
  it("rolls back across the tz boundary", () => {
    // 2026-04-27T03:00:00Z is still 2026-04-26 23:00 in NYC
    const ms = Date.UTC(2026, 3, 27, 3, 0, 0);
    expect(epochToDateInTz(ms, NYC)).toBe("2026-04-26");
  });
});

describe("epochToMinutesOfDay", () => {
  it("returns minutes since midnight in tz", () => {
    // 2026-04-26 08:30 NYC = 12:30Z (EDT = UTC-4)
    const ms = Date.UTC(2026, 3, 26, 12, 30, 0);
    expect(epochToMinutesOfDay(ms, NYC)).toBe(8 * 60 + 30);
  });
  it("returns 0 at midnight in tz", () => {
    // 2026-04-26 00:00 UTC
    const ms = Date.UTC(2026, 3, 26, 0, 0, 0);
    expect(epochToMinutesOfDay(ms, UTC)).toBe(0);
  });
});

describe("clampActualToDay", () => {
  it("returns full block when fully inside the day", () => {
    const start = Date.UTC(2026, 3, 26, 10, 0, 0); // 10:00Z
    const end = Date.UTC(2026, 3, 26, 11, 30, 0); // 11:30Z
    const r = clampActualToDay("2026-04-26", start, end, UTC);
    expect(r).toEqual({ startMin: 600, endMin: 690 });
  });
  it("clamps left edge for blocks that started yesterday", () => {
    const start = Date.UTC(2026, 3, 25, 23, 0, 0); // 23:00Z prev day
    const end = Date.UTC(2026, 3, 26, 6, 0, 0); // 06:00Z today
    const r = clampActualToDay("2026-04-26", start, end, UTC);
    expect(r).toEqual({ startMin: 0, endMin: 360 });
  });
  it("clamps right edge for blocks that continue into tomorrow", () => {
    const start = Date.UTC(2026, 3, 26, 22, 0, 0);
    const end = Date.UTC(2026, 3, 27, 4, 0, 0);
    const r = clampActualToDay("2026-04-26", start, end, UTC);
    expect(r).toEqual({ startMin: 22 * 60, endMin: 1440 });
  });
  it("treats null end as 'now' (unbounded right)", () => {
    const now = Date.UTC(2026, 3, 26, 9, 15, 0);
    const start = Date.UTC(2026, 3, 26, 8, 0, 0);
    const r = clampActualToDay("2026-04-26", start, null, UTC, now);
    expect(r).toEqual({ startMin: 480, endMin: 9 * 60 + 15 });
  });
  it("returns null when block doesn't intersect the day at all", () => {
    const start = Date.UTC(2026, 3, 24, 10, 0, 0);
    const end = Date.UTC(2026, 3, 24, 11, 0, 0);
    expect(clampActualToDay("2026-04-26", start, end, UTC)).toBeNull();
  });
});

describe("hhmmToMinutes (existing)", () => {
  it("still works", () => {
    expect(hhmmToMinutes("07:30")).toBe(450);
    expect(hhmmToMinutes(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run; expect failure**

Run: `bun run test src/components/calendar/date-utils.test.ts`
Expected: failures because `epochToDateInTz`, `epochToMinutesOfDay`, `clampActualToDay` aren't exported.

- [ ] **Step 3: Add the new helpers to `date-utils.ts`**

Append to `src/components/calendar/date-utils.ts`:

```typescript
/** Returns YYYY-MM-DD for an epoch ms timestamp in the given timezone. */
export function epochToDateInTz(ms: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** Returns minutes since midnight (0..1440) for an epoch ms timestamp in the given timezone. */
export function epochToMinutesOfDay(ms: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/**
 * Returns the minutes-of-day window {startMin, endMin} for an actuals block on a given day,
 * or null if the block doesn't intersect the day at all.
 *
 * - `endAt = null` means "currently running"; we use `nowMs` (default Date.now()) as the right edge.
 * - Blocks that span across midnight are clamped to [0, 1440] for the visible day.
 */
export function clampActualToDay(
  date: string,
  startAtMs: number,
  endAtMs: number | null,
  timezone: string,
  nowMs: number = Date.now(),
): { startMin: number; endMin: number } | null {
  const effectiveEnd = endAtMs ?? nowMs;
  if (effectiveEnd <= startAtMs) return null;

  const startDate = epochToDateInTz(startAtMs, timezone);
  const endDate = epochToDateInTz(effectiveEnd, timezone);

  const startsBefore = startDate < date;
  const startsToday = startDate === date;
  const startsAfter = startDate > date;
  const endsBefore = endDate < date;
  const endsToday = endDate === date;
  const endsAfter = endDate > date;

  if (startsAfter || endsBefore) return null;

  const startMin = startsToday ? epochToMinutesOfDay(startAtMs, timezone) : 0;
  const endMin = endsToday ? epochToMinutesOfDay(effectiveEnd, timezone) : 1440;
  return { startMin, endMin };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `bun run test src/components/calendar/date-utils.test.ts`
Expected: all date-utils tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/date-utils.ts src/components/calendar/date-utils.test.ts
git commit -m "feat(calendar): add epoch+timezone helpers and cross-midnight clamping"
```

---

## Task 4: DB schema additions + Sleep seed in `initDb()`

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add new types and SQL to `src/lib/db.ts`**

Replace the body of `initDb()` to include the new tables, the `category_id` column on `calendar_tasks`, indexes, and the Sleep seed. Append the new `Db*` types at the bottom.

Replace lines 8-81 (the entire `initDb` function) with:

```typescript
export async function initDb() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      year INTEGER NOT NULL,
      tech TEXT NOT NULL,
      link TEXT,
      repo TEXT,
      live TEXT,
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS site_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      data TEXT NOT NULL,
      article_slug TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS login_attempts (
      ip TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      first_attempt INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS pat_counter (
      id INTEGER PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0
    )`,
    `INSERT OR IGNORE INTO pat_counter (id, count) VALUES (1, 0)`,
    `CREATE TABLE IF NOT EXISTS pat_rate (
      ip TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      pats INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS calendar_tasks (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      start_time TEXT,
      end_time TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_tasks_date ON calendar_tasks(date)`,
    `CREATE TABLE IF NOT EXISTS calendar_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_categories_name_lower ON calendar_categories(LOWER(name))`,
    `CREATE TABLE IF NOT EXISTS calendar_actuals (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      plan_id TEXT,
      category_id TEXT,
      title TEXT,
      start_at INTEGER NOT NULL,
      end_at INTEGER,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (plan_id) REFERENCES calendar_tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES calendar_categories(id) ON DELETE SET NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_actuals_date ON calendar_actuals(date)`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_actuals_running ON calendar_actuals(end_at) WHERE end_at IS NULL`,
    `CREATE TABLE IF NOT EXISTS prayer_times_cache (
      cache_key TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      method INTEGER NOT NULL,
      data TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    )`,
  ]);

  // Additive ALTER for existing rows (no-op if column exists)
  await ensureColumn("calendar_tasks", "category_id", "TEXT");

  // Seed the built-in Sleep category if not present
  await db.execute({
    sql: `INSERT INTO calendar_categories (id, name, color, is_system, archived, position, created_at, updated_at)
          SELECT ?, 'Sleep', ?, 1, 0, 0, ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM calendar_categories WHERE LOWER(name) = 'sleep')`,
    args: ["sleep-system", "#5b5b8a", Date.now(), Date.now()],
  });
}

async function ensureColumn(table: string, column: string, type: string): Promise<void> {
  const info = await db.execute({ sql: `PRAGMA table_info(${table})`, args: [] });
  const exists = (info.rows as unknown as { name: string }[]).some((r) => r.name === column);
  if (!exists) {
    await db.execute({ sql: `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, args: [] });
  }
}
```

- [ ] **Step 2: Add new types at bottom of `src/lib/db.ts`**

Append after the existing `DbPrayerTimesCache` type:

```typescript
export type DbCalendarCategory = {
  id: string;
  name: string;
  color: string;
  is_system: number;
  archived: number;
  position: number;
  created_at: number;
  updated_at: number;
};

export type DbCalendarActual = {
  id: string;
  date: string;
  plan_id: string | null;
  category_id: string | null;
  title: string | null;
  start_at: number;
  end_at: number | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
};
```

Also extend `DbCalendarTask` to include the new column:

```typescript
export type DbCalendarTask = {
  id: string;
  date: string;
  title: string;
  notes: string | null;
  start_time: string | null;
  end_time: string | null;
  done: number;
  position: number;
  category_id: string | null;
  created_at: number;
  updated_at: number;
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `bun run lint`
Expected: passes (existing usages of `DbCalendarTask` will need `category_id` access added later — but since none read that column today, the type extension is purely additive).

If lint flags any unused import or anything else, fix before committing.

- [ ] **Step 4: Boot the dev server to confirm migration runs**

Run: `bun run dev`
In another shell, hit any calendar API to trigger `initDb()`:

```bash
curl -s http://localhost:3000/api/calendar/heatmap?year=2026 | head -c 200
```

You'll get a 401 (unauthenticated) — that's fine; init runs before auth check fails. Then connect to the Turso DB (or check via the admin if you have a debug page) and verify:

- `calendar_categories` exists with one row, `name='Sleep'`, `is_system=1`
- `calendar_actuals` exists, no rows
- `calendar_tasks` has a `category_id` column (nullable, all NULL)

If you don't have a way to inspect Turso, write a one-off temporary route in step 5; otherwise stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(calendar): add categories+actuals tables, category_id on tasks, seed Sleep"
```

---

## Task 5: Library functions for categories (`src/lib/calendar-categories.ts`)

**Files:**
- Create: `src/lib/calendar-categories.ts`

- [ ] **Step 1: Implement `src/lib/calendar-categories.ts`**

```typescript
import { randomUUID } from "crypto";
import { db, initDb, type DbCalendarCategory } from "./db";
import { isPaletteColor } from "./colors";

export type CalendarCategory = {
  id: string;
  name: string;
  color: string;
  isSystem: boolean;
  archived: boolean;
  position: number;
};

export type NewCategory = { name: string; color: string };
export type CategoryPatch = Partial<{ name: string; color: string; archived: boolean; position: number }>;

function rowToCategory(row: DbCalendarCategory): CalendarCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isSystem: row.is_system === 1,
    archived: row.archived === 1,
    position: row.position,
  };
}

export async function listCategories(): Promise<CalendarCategory[]> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT * FROM calendar_categories
          ORDER BY archived ASC, is_system DESC, position ASC, LOWER(name) ASC`,
    args: [],
  });
  return (result.rows as unknown as DbCalendarCategory[]).map(rowToCategory);
}

export async function getCategoryById(id: string): Promise<CalendarCategory | null> {
  await initDb();
  const result = await db.execute({
    sql: "SELECT * FROM calendar_categories WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0] as unknown as DbCalendarCategory | undefined;
  return row ? rowToCategory(row) : null;
}

export async function findCategoryByNameCI(name: string): Promise<CalendarCategory | null> {
  await initDb();
  const result = await db.execute({
    sql: "SELECT * FROM calendar_categories WHERE LOWER(name) = LOWER(?)",
    args: [name],
  });
  const row = result.rows[0] as unknown as DbCalendarCategory | undefined;
  return row ? rowToCategory(row) : null;
}

export async function createCategory(input: NewCategory): Promise<{ ok: true; category: CalendarCategory } | { ok: false; reason: "duplicate" | "invalid-color" }> {
  await initDb();
  if (!isPaletteColor(input.color)) return { ok: false, reason: "invalid-color" };
  const trimmed = input.name.trim();
  if (trimmed.length === 0) return { ok: false, reason: "duplicate" }; // empty name is treated as invalid
  const dup = await findCategoryByNameCI(trimmed);
  if (dup) return { ok: false, reason: "duplicate" };
  const id = randomUUID();
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO calendar_categories (id, name, color, is_system, archived, position, created_at, updated_at)
          VALUES (?, ?, ?, 0, 0, ?, ?, ?)`,
    args: [id, trimmed, input.color, now, now, now],
  });
  const created = await getCategoryById(id);
  if (!created) throw new Error("Failed to create category");
  return { ok: true, category: created };
}

export async function updateCategory(
  id: string,
  patch: CategoryPatch,
): Promise<{ ok: true; category: CalendarCategory } | { ok: false; reason: "not-found" | "duplicate" | "invalid-color" | "system-name-locked" }> {
  await initDb();
  const existing = await getCategoryById(id);
  if (!existing) return { ok: false, reason: "not-found" };

  if (patch.name !== undefined) {
    if (existing.isSystem) return { ok: false, reason: "system-name-locked" };
    const trimmed = patch.name.trim();
    if (trimmed.length === 0) return { ok: false, reason: "duplicate" };
    const dup = await findCategoryByNameCI(trimmed);
    if (dup && dup.id !== id) return { ok: false, reason: "duplicate" };
  }
  if (patch.color !== undefined && !isPaletteColor(patch.color)) {
    return { ok: false, reason: "invalid-color" };
  }

  const merged = {
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    color: patch.color ?? existing.color,
    archived: patch.archived !== undefined ? patch.archived : existing.archived,
    position: patch.position !== undefined ? patch.position : existing.position,
  };

  await db.execute({
    sql: `UPDATE calendar_categories
          SET name=?, color=?, archived=?, position=?, updated_at=?
          WHERE id=?`,
    args: [merged.name, merged.color, merged.archived ? 1 : 0, merged.position, Date.now(), id],
  });
  const updated = await getCategoryById(id);
  if (!updated) throw new Error("Failed to load updated category");
  return { ok: true, category: updated };
}

export async function categoryUsage(id: string): Promise<{ planCount: number; actualCount: number }> {
  await initDb();
  const planRes = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM calendar_tasks WHERE category_id = ?",
    args: [id],
  });
  const actualRes = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM calendar_actuals WHERE category_id = ?",
    args: [id],
  });
  const planCount = Number((planRes.rows[0] as unknown as { n: number }).n ?? 0);
  const actualCount = Number((actualRes.rows[0] as unknown as { n: number }).n ?? 0);
  return { planCount, actualCount };
}

export async function deleteCategory(
  id: string,
): Promise<{ ok: true } | { ok: false; reason: "not-found" | "system-locked" | "in-use"; planCount?: number; actualCount?: number }> {
  await initDb();
  const existing = await getCategoryById(id);
  if (!existing) return { ok: false, reason: "not-found" };
  if (existing.isSystem) return { ok: false, reason: "system-locked" };
  const usage = await categoryUsage(id);
  if (usage.planCount > 0 || usage.actualCount > 0) {
    return { ok: false, reason: "in-use", planCount: usage.planCount, actualCount: usage.actualCount };
  }
  await db.execute({ sql: "DELETE FROM calendar_categories WHERE id = ?", args: [id] });
  return { ok: true };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `bun run lint`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/calendar-categories.ts
git commit -m "feat(calendar): add category CRUD lib with duplicate+system+usage rules"
```

---

## Task 6: Extend `calendar.ts` plan-task fns to read `category_id` and join category

**Files:**
- Modify: `src/lib/calendar.ts`

- [ ] **Step 1: Update types and mappers**

Replace the existing `CalendarTask` type and `rowToTask` function. Add a `category` summary inline so consumers can render without a second join.

Replace lines 1-45:

```typescript
import { db, initDb, type DbCalendarTask, type DbCalendarCategory } from "./db";
import { randomUUID } from "crypto";

export type CategorySummary = { id: string; name: string; color: string };

export type CalendarTask = {
  id: string;
  date: string;
  title: string;
  notes: string | null;
  startTime: string | null;
  endTime: string | null;
  done: boolean;
  position: number;
  categoryId: string | null;
  category: CategorySummary | null;
};

type NewCalendarTask = {
  date: string;
  title: string;
  notes?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  position?: number;
  categoryId?: string | null;
};

export type CalendarTaskPatch = Partial<{
  title: string;
  notes: string | null;
  startTime: string | null;
  endTime: string | null;
  done: boolean;
  position: number;
  date: string;
  categoryId: string | null;
}>;

type DbCalendarTaskJoined = DbCalendarTask & {
  cat_id: string | null;
  cat_name: string | null;
  cat_color: string | null;
};

function rowToTask(row: DbCalendarTaskJoined): CalendarTask {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    notes: row.notes,
    startTime: row.start_time,
    endTime: row.end_time,
    done: row.done === 1,
    position: row.position,
    categoryId: row.category_id,
    category:
      row.cat_id && row.cat_name && row.cat_color
        ? { id: row.cat_id, name: row.cat_name, color: row.cat_color }
        : null,
  };
}
```

- [ ] **Step 2: Update `getTasksInRange` to LEFT JOIN categories**

Replace `getTasksInRange`:

```typescript
export async function getTasksInRange(from: string, to: string): Promise<CalendarTask[]> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT t.*, c.id AS cat_id, c.name AS cat_name, c.color AS cat_color
          FROM calendar_tasks t
          LEFT JOIN calendar_categories c ON c.id = t.category_id
          WHERE t.date BETWEEN ? AND ?
          ORDER BY t.date ASC, t.position ASC, t.created_at ASC`,
    args: [from, to],
  });
  return (result.rows as unknown as DbCalendarTaskJoined[]).map(rowToTask);
}
```

- [ ] **Step 3: Update `getTaskById` and `createTask` and `updateTask` to handle `categoryId`**

Replace `getTaskById`:

```typescript
async function getTaskById(id: string): Promise<CalendarTask | null> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT t.*, c.id AS cat_id, c.name AS cat_name, c.color AS cat_color
          FROM calendar_tasks t
          LEFT JOIN calendar_categories c ON c.id = t.category_id
          WHERE t.id = ?`,
    args: [id],
  });
  const row = result.rows[0] as unknown as DbCalendarTaskJoined | undefined;
  return row ? rowToTask(row) : null;
}
```

Replace `createTask`:

```typescript
export async function createTask(input: NewCalendarTask): Promise<CalendarTask> {
  await initDb();
  const id = randomUUID();
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO calendar_tasks
          (id, date, title, notes, start_time, end_time, done, position, category_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    args: [
      id,
      input.date,
      input.title,
      input.notes ?? null,
      input.startTime ?? null,
      input.endTime ?? null,
      input.position ?? 0,
      input.categoryId ?? null,
      now,
      now,
    ],
  });
  const task = await getTaskById(id);
  if (!task) throw new Error("Failed to create task");
  return task;
}
```

Replace `updateTask`:

```typescript
export async function updateTask(id: string, patch: CalendarTaskPatch): Promise<CalendarTask | null> {
  await initDb();
  const existing = await getTaskById(id);
  if (!existing) return null;
  const merged = {
    date: patch.date ?? existing.date,
    title: patch.title ?? existing.title,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    startTime: patch.startTime !== undefined ? patch.startTime : existing.startTime,
    endTime: patch.endTime !== undefined ? patch.endTime : existing.endTime,
    done: patch.done !== undefined ? patch.done : existing.done,
    position: patch.position !== undefined ? patch.position : existing.position,
    categoryId: patch.categoryId !== undefined ? patch.categoryId : existing.categoryId,
  };
  await db.execute({
    sql: `UPDATE calendar_tasks
          SET date=?, title=?, notes=?, start_time=?, end_time=?, done=?, position=?, category_id=?, updated_at=?
          WHERE id=?`,
    args: [
      merged.date,
      merged.title,
      merged.notes,
      merged.startTime,
      merged.endTime,
      merged.done ? 1 : 0,
      merged.position,
      merged.categoryId,
      Date.now(),
      id,
    ],
  });
  return getTaskById(id);
}
```

Note: the import of `DbCalendarCategory` at the top is currently unused; remove it if lint flags. Otherwise keep for symmetry.

- [ ] **Step 4: Verify lint passes**

Run: `bun run lint`
Expected: passes. If `DbCalendarCategory` is unused, remove its import.

- [ ] **Step 5: Manual smoke test**

Start dev server: `bun run dev`
Log in as admin (existing flow), then in browser console:

```js
const r = await fetch("/api/calendar/tasks?from=2026-04-26&to=2026-04-26", { credentials: "include" });
const tasks = await r.json();
console.log(tasks);
```

Expected: existing tasks come back with `categoryId: null` and `category: null`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/calendar.ts
git commit -m "feat(calendar): tasks join category and surface categoryId+category in API shape"
```

---

## Task 7: Actuals lib — getActualsInRange + getRunningActual

**Files:**
- Modify: `src/lib/calendar.ts`

- [ ] **Step 1: Add types and read functions**

Append to `src/lib/calendar.ts`:

```typescript
import type { DbCalendarActual } from "./db";

export type PlanSummary = { id: string; title: string };

export type CalendarActual = {
  id: string;
  date: string;
  planId: string | null;
  plan: PlanSummary | null;
  categoryId: string | null;
  category: CategorySummary | null;
  title: string | null;
  startAt: number;
  endAt: number | null;
  notes: string | null;
};

type DbCalendarActualJoined = DbCalendarActual & {
  cat_id: string | null;
  cat_name: string | null;
  cat_color: string | null;
  plan_title: string | null;
};

function rowToActual(row: DbCalendarActualJoined): CalendarActual {
  return {
    id: row.id,
    date: row.date,
    planId: row.plan_id,
    plan: row.plan_id && row.plan_title ? { id: row.plan_id, title: row.plan_title } : null,
    categoryId: row.category_id,
    category:
      row.cat_id && row.cat_name && row.cat_color
        ? { id: row.cat_id, name: row.cat_name, color: row.cat_color }
        : null,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    notes: row.notes,
  };
}

export async function getActualsInRange(from: string, to: string): Promise<CalendarActual[]> {
  await initDb();
  // Returns rows anchored to [from, to] plus any currently-running row.
  // Callers wanting to render cross-midnight blocks on the day AFTER they start
  // should query with `from = addDays(date, -1)` so yesterday's anchored rows
  // are included; the component layer (clampActualToDay) filters them to the visible day.
  const result = await db.execute({
    sql: `SELECT a.*, c.id AS cat_id, c.name AS cat_name, c.color AS cat_color, p.title AS plan_title
          FROM calendar_actuals a
          LEFT JOIN calendar_categories c ON c.id = a.category_id
          LEFT JOIN calendar_tasks p ON p.id = a.plan_id
          WHERE a.date BETWEEN ? AND ?
             OR a.end_at IS NULL
          ORDER BY a.start_at ASC`,
    args: [from, to],
  });
  return (result.rows as unknown as DbCalendarActualJoined[]).map(rowToActual);
}

export async function getRunningActual(): Promise<CalendarActual | null> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT a.*, c.id AS cat_id, c.name AS cat_name, c.color AS cat_color, p.title AS plan_title
          FROM calendar_actuals a
          LEFT JOIN calendar_categories c ON c.id = a.category_id
          LEFT JOIN calendar_tasks p ON p.id = a.plan_id
          WHERE a.end_at IS NULL
          LIMIT 1`,
    args: [],
  });
  const row = result.rows[0] as unknown as DbCalendarActualJoined | undefined;
  return row ? rowToActual(row) : null;
}

async function getActualById(id: string): Promise<CalendarActual | null> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT a.*, c.id AS cat_id, c.name AS cat_name, c.color AS cat_color, p.title AS plan_title
          FROM calendar_actuals a
          LEFT JOIN calendar_categories c ON c.id = a.category_id
          LEFT JOIN calendar_tasks p ON p.id = a.plan_id
          WHERE a.id = ?`,
    args: [id],
  });
  const row = result.rows[0] as unknown as DbCalendarActualJoined | undefined;
  return row ? rowToActual(row) : null;
}
```

Note: the `import type { DbCalendarActual } from "./db";` may be merged with the existing `import { ... } from "./db";` line at the top. Combine if you like:

```typescript
import { db, initDb, type DbCalendarTask, type DbCalendarActual } from "./db";
```

- [ ] **Step 2: Verify lint passes**

Run: `bun run lint`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/calendar.ts
git commit -m "feat(calendar): add actuals read helpers (range, running, by-id) with joins"
```

---

## Task 8: Actuals lib — startActual + stopActual with single-active invariant

**Files:**
- Modify: `src/lib/calendar.ts`

- [ ] **Step 1: Add `startActual` and `stopActual`**

Append to `src/lib/calendar.ts`:

```typescript
import { epochToDateInTz } from "@/components/calendar/date-utils";

export type StartActualInput = {
  planId?: string | null;
  categoryId?: string | null;
  title?: string | null;
  timezone: string; // for computing the actuals row's `date` field
  nowMs?: number; // overrideable for tests; defaults to Date.now()
};

export type StartActualResult = {
  started: CalendarActual;
  autoStopped: CalendarActual | null;
};

export async function startActual(input: StartActualInput): Promise<StartActualResult> {
  await initDb();
  const now = input.nowMs ?? Date.now();

  // 1) Auto-stop any running actual.
  const running = await getRunningActual();
  if (running) {
    await db.execute({
      sql: `UPDATE calendar_actuals SET end_at=?, updated_at=? WHERE id=? AND end_at IS NULL`,
      args: [now, now, running.id],
    });
  }

  // 2) If planId given, hydrate missing fields from the plan.
  let categoryId = input.categoryId ?? null;
  let title = input.title ?? null;
  if (input.planId) {
    const plan = await getTaskById(input.planId);
    if (plan) {
      if (categoryId === null) categoryId = plan.categoryId;
      if (title === null) title = plan.title;
    }
  }

  const id = randomUUID();
  const date = epochToDateInTz(now, input.timezone);
  await db.execute({
    sql: `INSERT INTO calendar_actuals
          (id, date, plan_id, category_id, title, start_at, end_at, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
    args: [id, date, input.planId ?? null, categoryId, title, now, now, now],
  });

  const started = await getActualById(id);
  if (!started) throw new Error("Failed to start actual");
  const autoStopped = running ? await getActualById(running.id) : null;
  return { started, autoStopped };
}

export type StopActualResult = {
  stopped: CalendarActual | null; // null if nothing was running (idempotent)
};

export async function stopActual(nowMs: number = Date.now()): Promise<StopActualResult> {
  await initDb();
  const running = await getRunningActual();
  if (!running) return { stopped: null };
  await db.execute({
    sql: `UPDATE calendar_actuals SET end_at=?, updated_at=? WHERE id=? AND end_at IS NULL`,
    args: [nowMs, nowMs, running.id],
  });
  const stopped = await getActualById(running.id);
  return { stopped };
}
```

- [ ] **Step 2: Verify lint passes**

Run: `bun run lint`
Expected: passes.

- [ ] **Step 3: Manual smoke test**

Start dev server, log in as admin, then in browser console:

```js
// Start an ad-hoc actual
const r1 = await fetch("/api/calendar/actuals/start", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ title: "Smoke test" }),
});
console.log("Step 8 needs Task 13 (API) before this works — defer");
```

Step 3 is just a marker — actual smoke test happens in Task 13 once the API is wired.

- [ ] **Step 4: Commit**

```bash
git add src/lib/calendar.ts
git commit -m "feat(calendar): add startActual/stopActual with single-active auto-stop"
```

---

## Task 9: Actuals lib — updateActual + deleteActual

**Files:**
- Modify: `src/lib/calendar.ts`

- [ ] **Step 1: Add `updateActual` and `deleteActual`**

Append to `src/lib/calendar.ts`:

```typescript
export type ActualPatch = Partial<{
  categoryId: string | null;
  title: string | null;
  startAt: number;
  endAt: number | null;
  notes: string | null;
}>;

export type UpdateActualResult =
  | { ok: true; actual: CalendarActual }
  | { ok: false; reason: "not-found" | "start-after-end" | "would-overlap-running" };

export async function updateActual(id: string, patch: ActualPatch): Promise<UpdateActualResult> {
  await initDb();
  const existing = await getActualById(id);
  if (!existing) return { ok: false, reason: "not-found" };

  const merged = {
    categoryId: patch.categoryId !== undefined ? patch.categoryId : existing.categoryId,
    title: patch.title !== undefined ? patch.title : existing.title,
    startAt: patch.startAt !== undefined ? patch.startAt : existing.startAt,
    endAt: patch.endAt !== undefined ? patch.endAt : existing.endAt,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
  };

  if (merged.endAt !== null && merged.startAt >= merged.endAt) {
    return { ok: false, reason: "start-after-end" };
  }

  // Single-active invariant: if this row is becoming/staying running (endAt=null),
  // there must be no OTHER running row.
  if (merged.endAt === null) {
    const running = await getRunningActual();
    if (running && running.id !== id) {
      return { ok: false, reason: "would-overlap-running" };
    }
  } else {
    // If this row is now stopped, ensure it doesn't span the running row's start.
    const running = await getRunningActual();
    if (running && running.id !== id && merged.endAt > running.startAt) {
      return { ok: false, reason: "would-overlap-running" };
    }
  }

  await db.execute({
    sql: `UPDATE calendar_actuals
          SET category_id=?, title=?, start_at=?, end_at=?, notes=?, updated_at=?
          WHERE id=?`,
    args: [merged.categoryId, merged.title, merged.startAt, merged.endAt, merged.notes, Date.now(), id],
  });
  const updated = await getActualById(id);
  if (!updated) throw new Error("Failed to load updated actual");
  return { ok: true, actual: updated };
}

export async function deleteActual(id: string): Promise<{ ok: boolean }> {
  await initDb();
  const result = await db.execute({
    sql: "DELETE FROM calendar_actuals WHERE id = ?",
    args: [id],
  });
  return { ok: (result.rowsAffected ?? 0) > 0 };
}
```

- [ ] **Step 2: Verify lint passes**

Run: `bun run lint`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/calendar.ts
git commit -m "feat(calendar): add updateActual/deleteActual with invariant checks"
```

---

## Task 10: Categories API — `GET/POST /api/calendar/categories` + per-id `PATCH/DELETE`

**Files:**
- Create: `src/app/api/calendar/categories/route.ts`
- Create: `src/app/api/calendar/categories/[id]/route.ts`

- [ ] **Step 1: Implement the collection route**

Create `src/app/api/calendar/categories/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listCategories, createCategory } from "@/lib/calendar-categories";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const cats = await listCategories();
  return NextResponse.json(cats);
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, color } = body;
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof color !== "string") {
    return NextResponse.json({ error: "color is required" }, { status: 400 });
  }

  const result = await createCategory({ name, color });
  if (!result.ok) {
    if (result.reason === "duplicate") {
      return NextResponse.json({ error: "A category with that name already exists" }, { status: 409 });
    }
    if (result.reason === "invalid-color") {
      return NextResponse.json({ error: "color must be from the muted palette" }, { status: 400 });
    }
  }
  return NextResponse.json(result.category);
}
```

- [ ] **Step 2: Implement the item route**

Create `src/app/api/calendar/categories/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateCategory, deleteCategory } from "@/lib/calendar-categories";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: { name?: string; color?: string; archived?: boolean; position?: number } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ error: "name must be non-empty" }, { status: 400 });
    }
    patch.name = body.name;
  }
  if (body.color !== undefined) {
    if (typeof body.color !== "string") {
      return NextResponse.json({ error: "color must be a string" }, { status: 400 });
    }
    patch.color = body.color;
  }
  if (body.archived !== undefined) {
    if (typeof body.archived !== "boolean") {
      return NextResponse.json({ error: "archived must be boolean" }, { status: 400 });
    }
    patch.archived = body.archived;
  }
  if (body.position !== undefined) {
    if (typeof body.position !== "number") {
      return NextResponse.json({ error: "position must be number" }, { status: 400 });
    }
    patch.position = body.position;
  }

  const result = await updateCategory(id, patch);
  if (!result.ok) {
    if (result.reason === "not-found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (result.reason === "duplicate") return NextResponse.json({ error: "Duplicate name" }, { status: 409 });
    if (result.reason === "invalid-color") return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    if (result.reason === "system-name-locked") {
      return NextResponse.json({ error: "Cannot rename a system category" }, { status: 400 });
    }
  }
  return NextResponse.json(result.category);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { id } = await params;
  const result = await deleteCategory(id);
  if (!result.ok) {
    if (result.reason === "not-found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (result.reason === "system-locked") {
      return NextResponse.json({ error: "Cannot delete a system category" }, { status: 400 });
    }
    if (result.reason === "in-use") {
      return NextResponse.json(
        { error: "Category is in use", planCount: result.planCount, actualCount: result.actualCount },
        { status: 409 },
      );
    }
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Manual smoke tests**

Start dev server, log in as admin. In browser console:

```js
// List
let r = await fetch("/api/calendar/categories", { credentials: "include" });
console.log("list", await r.json()); // [{ name: "Sleep", isSystem: true, ... }]

// Create
r = await fetch("/api/calendar/categories", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ name: "Oddjob", color: "#7a6b5b" }),
});
const oddjob = await r.json();
console.log("created", oddjob);

// Duplicate fails
r = await fetch("/api/calendar/categories", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ name: "oddjob", color: "#7a6b5b" }),
});
console.log("dup", r.status, await r.json()); // 409

// Edit color
r = await fetch(`/api/calendar/categories/${oddjob.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ color: "#6b8a72" }),
});
console.log("patched", await r.json());
```

Expected: list returns Sleep, create works, dup returns 409, patch works.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/calendar/categories
git commit -m "feat(calendar): add categories API (list/create/patch/delete)"
```

---

## Task 11: Plan tasks API — accept and return `categoryId`

**Files:**
- Modify: `src/app/api/calendar/tasks/route.ts`
- Modify: `src/app/api/calendar/tasks/[id]/route.ts`

- [ ] **Step 1: Update collection POST to accept `categoryId`**

In `src/app/api/calendar/tasks/route.ts`, modify the POST body extraction. Replace lines 32-54 (the body destructure + validation + createTask call):

```typescript
  const { date, title, notes, startTime, endTime, position, categoryId } = body;
  if (typeof date !== "string" || !isValidDateString(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (startTime !== undefined && startTime !== null && (typeof startTime !== "string" || !isValidHhmm(startTime))) {
    return NextResponse.json({ error: "startTime must be HH:MM" }, { status: 400 });
  }
  if (endTime !== undefined && endTime !== null && (typeof endTime !== "string" || !isValidHhmm(endTime))) {
    return NextResponse.json({ error: "endTime must be HH:MM" }, { status: 400 });
  }
  if (categoryId !== undefined && categoryId !== null && typeof categoryId !== "string") {
    return NextResponse.json({ error: "categoryId must be string or null" }, { status: 400 });
  }

  const task = await createTask({
    date,
    title: title.trim(),
    notes: typeof notes === "string" ? notes : null,
    startTime: typeof startTime === "string" ? startTime : null,
    endTime: typeof endTime === "string" ? endTime : null,
    position: typeof position === "number" ? position : 0,
    categoryId: typeof categoryId === "string" ? categoryId : null,
  });
  return NextResponse.json(task);
```

- [ ] **Step 2: Update item PATCH to accept `categoryId`**

Read `src/app/api/calendar/tasks/[id]/route.ts` to confirm its current shape, then add `categoryId` to the patch builder. The pattern matches existing fields:

```typescript
  if (body.categoryId !== undefined) {
    if (body.categoryId !== null && typeof body.categoryId !== "string") {
      return NextResponse.json({ error: "categoryId must be string or null" }, { status: 400 });
    }
    patch.categoryId = body.categoryId as string | null;
  }
```

Insert this in the same block where existing fields like `title`, `notes`, etc. are validated.

- [ ] **Step 3: Manual smoke test**

In browser console:

```js
// Create the Oddjob category first (Task 10 manual flow)
// Then create a task with categoryId
const r = await fetch("/api/calendar/tasks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    date: "2026-04-26",
    title: "AbdurRazzaq",
    startTime: "14:00",
    endTime: "15:30",
    categoryId: "<oddjob-id-from-task-10>",
  }),
});
console.log(await r.json());
// Expected: task with category: { id, name: "Oddjob", color: "#..." }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/calendar/tasks
git commit -m "feat(calendar): tasks API accepts categoryId on create+patch"
```

---

## Task 12: Actuals API — `GET range` + `GET running`

**Files:**
- Create: `src/app/api/calendar/actuals/route.ts`
- Create: `src/app/api/calendar/actuals/running/route.ts`

- [ ] **Step 1: Implement range GET**

Create `src/app/api/calendar/actuals/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getActualsInRange } from "@/lib/calendar";
import { isValidDateString } from "@/components/calendar/date-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to || !isValidDateString(from) || !isValidDateString(to)) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
  }
  const actuals = await getActualsInRange(from, to);
  return NextResponse.json(actuals);
}
```

- [ ] **Step 2: Implement running GET**

Create `src/app/api/calendar/actuals/running/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getRunningActual } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const running = await getRunningActual();
  if (!running) return new NextResponse(null, { status: 204 });
  return NextResponse.json(running);
}
```

- [ ] **Step 3: Manual smoke test**

In browser console (no actuals exist yet, so both should be empty):

```js
let r = await fetch("/api/calendar/actuals?from=2026-04-26&to=2026-04-26", { credentials: "include" });
console.log("range", await r.json()); // []
r = await fetch("/api/calendar/actuals/running", { credentials: "include" });
console.log("running status", r.status); // 204
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/calendar/actuals
git commit -m "feat(calendar): add actuals GET range + GET running endpoints"
```

---

## Task 13: Actuals API — `POST start` + `POST stop`

**Files:**
- Create: `src/app/api/calendar/actuals/start/route.ts`
- Create: `src/app/api/calendar/actuals/stop/route.ts`

- [ ] **Step 1: Implement start**

Create `src/app/api/calendar/actuals/start/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { startActual } from "@/lib/calendar";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // Allow empty body (e.g., quick "start sleep" with no fields).
  }

  const planId = typeof body.planId === "string" ? body.planId : null;
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : null;
  const title = typeof body.title === "string" ? body.title : null;

  const config = await getSiteConfig();
  const tz = resolveTimezone(config);
  const result = await startActual({ planId, categoryId, title, timezone: tz });
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Implement stop**

Create `src/app/api/calendar/actuals/stop/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { stopActual } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const result = await stopActual();
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Manual smoke test — full single-active dance**

In browser console (with admin session):

```js
// Start with no body → ad-hoc, no plan, no category
let r = await fetch("/api/calendar/actuals/start", { method: "POST", credentials: "include" });
const s1 = await r.json();
console.log("start1", s1); // { started: { ... endAt: null }, autoStopped: null }

// Start a second one immediately → first one auto-stopped
r = await fetch("/api/calendar/actuals/start", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ title: "Second" }),
});
const s2 = await r.json();
console.log("start2", s2); // autoStopped should reference s1's id, started is new

// Confirm running is the second one
r = await fetch("/api/calendar/actuals/running", { credentials: "include" });
console.log("running", await r.json()); // s2.started

// Stop
r = await fetch("/api/calendar/actuals/stop", { method: "POST", credentials: "include" });
console.log("stopped", await r.json()); // { stopped: <s2 with endAt set> }

// Stop again (idempotent)
r = await fetch("/api/calendar/actuals/stop", { method: "POST", credentials: "include" });
console.log("stop2 idempotent", await r.json()); // { stopped: null }
```

Expected: all five steps behave as commented. If any fail, debug before committing.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/calendar/actuals
git commit -m "feat(calendar): add actuals start/stop endpoints with auto-stop on conflict"
```

---

## Task 14: Actuals API — `PATCH /[id]` + `DELETE /[id]`

**Files:**
- Create: `src/app/api/calendar/actuals/[id]/route.ts`

- [ ] **Step 1: Implement PATCH and DELETE**

Create `src/app/api/calendar/actuals/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateActual, deleteActual } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: {
    categoryId?: string | null;
    title?: string | null;
    startAt?: number;
    endAt?: number | null;
    notes?: string | null;
  } = {};

  if (body.categoryId !== undefined) {
    if (body.categoryId !== null && typeof body.categoryId !== "string") {
      return NextResponse.json({ error: "categoryId must be string or null" }, { status: 400 });
    }
    patch.categoryId = body.categoryId as string | null;
  }
  if (body.title !== undefined) {
    if (body.title !== null && typeof body.title !== "string") {
      return NextResponse.json({ error: "title must be string or null" }, { status: 400 });
    }
    patch.title = body.title as string | null;
  }
  if (body.startAt !== undefined) {
    if (typeof body.startAt !== "number" || body.startAt <= 0) {
      return NextResponse.json({ error: "startAt must be a positive epoch ms" }, { status: 400 });
    }
    patch.startAt = body.startAt;
  }
  if (body.endAt !== undefined) {
    if (body.endAt !== null && (typeof body.endAt !== "number" || body.endAt <= 0)) {
      return NextResponse.json({ error: "endAt must be epoch ms or null" }, { status: 400 });
    }
    patch.endAt = body.endAt as number | null;
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") {
      return NextResponse.json({ error: "notes must be string or null" }, { status: 400 });
    }
    patch.notes = body.notes as string | null;
  }

  const result = await updateActual(id, patch);
  if (!result.ok) {
    if (result.reason === "not-found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (result.reason === "start-after-end") {
      return NextResponse.json({ error: "startAt must be before endAt" }, { status: 400 });
    }
    if (result.reason === "would-overlap-running") {
      return NextResponse.json({ error: "Edit would overlap the running actual" }, { status: 409 });
    }
  }
  return NextResponse.json(result.actual);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { id } = await params;
  const result = await deleteActual(id);
  if (!result.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Manual smoke test**

In browser console (after Task 13's actuals exist):

```js
// Create one to play with
let r = await fetch("/api/calendar/actuals/start", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ title: "Edit me" }),
});
const { started } = await r.json();
await fetch("/api/calendar/actuals/stop", { method: "POST", credentials: "include" });

// Edit title
r = await fetch(`/api/calendar/actuals/${started.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ title: "Edited" }),
});
console.log("patched", await r.json()); // title: "Edited"

// Bad time order
r = await fetch(`/api/calendar/actuals/${started.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ startAt: Date.now() + 1_000_000_000, endAt: started.startAt }),
});
console.log("bad order", r.status); // 400

// Delete
r = await fetch(`/api/calendar/actuals/${started.id}`, { method: "DELETE", credentials: "include" });
console.log("deleted", await r.json()); // { ok: true }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/calendar/actuals/[id]
git commit -m "feat(calendar): add actuals PATCH/DELETE with invariant validation"
```

---

## Task 15: Heatmap — accept `metric=plans|actuals`

**Files:**
- Modify: `src/app/api/calendar/heatmap/route.ts`
- Modify: `src/lib/calendar.ts`

- [ ] **Step 1: Add `getActualsHeatmapForYear` to lib**

Append to `src/lib/calendar.ts`:

```typescript
/** Returns { "YYYY-MM-DD": totalMinutes } for actuals anchored to that day in `year`. */
export async function getActualsHeatmapForYear(year: number): Promise<Record<string, number>> {
  await initDb();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const result = await db.execute({
    sql: `SELECT date, SUM(
            CASE WHEN end_at IS NULL THEN 0 ELSE (end_at - start_at) / 60000 END
          ) AS minutes
          FROM calendar_actuals
          WHERE date BETWEEN ? AND ?
          GROUP BY date`,
    args: [from, to],
  });
  const out: Record<string, number> = {};
  for (const row of result.rows as unknown as { date: string; minutes: number }[]) {
    out[row.date] = Number(row.minutes ?? 0);
  }
  return out;
}
```

- [ ] **Step 2: Update the route to accept `metric`**

Modify `src/app/api/calendar/heatmap/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getHeatmapForYear, getActualsHeatmapForYear } from "@/lib/calendar";
import { isValidYearString } from "@/components/calendar/date-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const yearStr = req.nextUrl.searchParams.get("year");
  if (!yearStr || !isValidYearString(yearStr)) {
    return NextResponse.json({ error: "year must be YYYY" }, { status: 400 });
  }
  const metric = req.nextUrl.searchParams.get("metric") ?? "plans";
  if (metric !== "plans" && metric !== "actuals") {
    return NextResponse.json({ error: "metric must be plans or actuals" }, { status: 400 });
  }
  const year = Number(yearStr);
  const data = metric === "plans" ? await getHeatmapForYear(year) : await getActualsHeatmapForYear(year);
  return NextResponse.json(data);
}
```

(If the existing route differs, adapt — but keep `metric=plans` as the default to preserve current behavior.)

- [ ] **Step 3: Smoke test**

```js
let r = await fetch("/api/calendar/heatmap?year=2026", { credentials: "include" });
console.log("plans default", await r.json()); // existing behavior
r = await fetch("/api/calendar/heatmap?year=2026&metric=actuals", { credentials: "include" });
console.log("actuals", await r.json()); // {} or { "2026-04-26": <minutes> }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/calendar/heatmap src/lib/calendar.ts
git commit -m "feat(calendar): heatmap supports metric=actuals (minutes per day)"
```

---

## Task 16: `CategoryPicker` + inline create form

**Files:**
- Create: `src/components/calendar/CategoryPicker.tsx`
- Create: `src/components/calendar/CategoryCreateInline.tsx`

- [ ] **Step 1: Implement `CategoryCreateInline`**

Create `src/components/calendar/CategoryCreateInline.tsx`:

```typescript
"use client";

import { useState } from "react";
import { CATEGORY_PALETTE, pickNextUnusedColor } from "@/lib/colors";
import type { CalendarCategory } from "@/lib/calendar-categories";

type Props = {
  initialName: string;
  existingCategories: CalendarCategory[];
  onCreated: (cat: CalendarCategory) => void;
  onCancel: () => void;
};

export default function CategoryCreateInline({ initialName, existingCategories, onCreated, onCancel }: Props) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<string>(() =>
    pickNextUnusedColor(existingCategories.map((c) => c.color)),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const r = await fetch("/api/calendar/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, color }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.error ?? "Failed to create");
      setSubmitting(false);
      return;
    }
    const cat = (await r.json()) as CalendarCategory;
    onCreated(cat);
  }

  return (
    <div className="border border-white/20 bg-black p-3 text-sm space-y-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Category name"
        className="w-full bg-transparent border border-white/20 px-2 py-1 text-white focus:border-white/60 outline-none"
      />
      <div className="grid grid-cols-8 gap-2">
        {CATEGORY_PALETTE.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => setColor(c.hex)}
            aria-label={c.name}
            title={c.name}
            className={`h-6 w-6 border ${color === c.hex ? "border-white" : "border-white/20"}`}
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-white/60 hover:text-white px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || name.trim().length === 0}
          className="text-xs border border-white/30 hover:bg-white/10 disabled:opacity-40 px-2 py-1"
        >
          {submitting ? "Creating..." : "Create"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `CategoryPicker`**

Create `src/components/calendar/CategoryPicker.tsx`:

```typescript
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarCategory } from "@/lib/calendar-categories";
import CategoryCreateInline from "./CategoryCreateInline";

type Props = {
  selectedId: string | null;
  onChange: (id: string | null) => void;
};

export default function CategoryPicker({ selectedId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<CalendarCategory[]>([]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loaded) {
      void refresh();
    }
  }, [loaded]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function refresh() {
    const r = await fetch("/api/calendar/categories", { credentials: "include" });
    if (r.ok) {
      const list = (await r.json()) as CalendarCategory[];
      setCategories(list);
      setLoaded(true);
    }
  }

  const selected = categories.find((c) => c.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const active = categories.filter((c) => !c.archived);
    if (!query.trim()) return active;
    return active.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  }, [categories, query]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 border border-white/20 px-2 py-1 text-left text-sm hover:bg-white/5"
      >
        {selected ? (
          <>
            <span className="h-3 w-3 inline-block border border-white/30" style={{ backgroundColor: selected.color }} />
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-white/50">No category</span>
        )}
        <span className="ml-auto text-white/30">▾</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 border border-white/20 bg-black max-h-72 overflow-auto">
          {creating ? (
            <CategoryCreateInline
              initialName={query}
              existingCategories={categories}
              onCreated={(cat) => {
                setCategories((prev) => [...prev, cat]);
                onChange(cat.id);
                setCreating(false);
                setOpen(false);
                setQuery("");
              }}
              onCancel={() => setCreating(false)}
            />
          ) : (
            <>
              <input
                autoFocus
                placeholder="Search categories..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent border-b border-white/20 px-3 py-2 text-sm focus:border-white/60 outline-none"
              />
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 border-b border-white/10"
              >
                + Create {query.trim() ? `"${query.trim()}"` : "new category"}
              </button>
              {selectedId !== null && (
                <button
                  type="button"
                  onClick={() => { onChange(null); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-white/50 hover:bg-white/10 border-b border-white/10"
                >
                  Clear category
                </button>
              )}
              {filtered.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => { onChange(c.id); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                >
                  <span className="h-3 w-3 inline-block border border-white/30" style={{ backgroundColor: c.color }} />
                  <span className="truncate">{c.name}</span>
                  {c.isSystem && <span className="ml-auto text-[10px] text-white/40">system</span>}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-xs text-white/40">No matches</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Lint check**

Run: `bun run lint`
Expected: passes.

- [ ] **Step 4: Commit (UI verified once integrated in Task 17)**

```bash
git add src/components/calendar/CategoryPicker.tsx src/components/calendar/CategoryCreateInline.tsx
git commit -m "feat(calendar): add CategoryPicker with searchable dropdown + inline create"
```

---

## Task 17: Wire `CategoryPicker` into `TaskEditor`

**Files:**
- Modify: `src/components/calendar/TaskEditor.tsx`

- [ ] **Step 1: Read existing TaskEditor**

Run: `cat src/components/calendar/TaskEditor.tsx | head -120`
Expected: see the existing structure (form for title/notes/start/end). Add a CategoryPicker bound to a new `categoryId` state.

- [ ] **Step 2: Add `categoryId` state and CategoryPicker to the form**

In `TaskEditor.tsx`:

1. Add import: `import CategoryPicker from "./CategoryPicker";`
2. Add state: `const [categoryId, setCategoryId] = useState<string | null>(task?.categoryId ?? null);`
3. In the JSX, above the title input, render:

```tsx
<div className="space-y-1">
  <label className="text-xs text-white/60">Category</label>
  <CategoryPicker selectedId={categoryId} onChange={setCategoryId} />
</div>
```

4. In the submit handler that POSTs/PATCHes the task, include `categoryId` in the body.

- [ ] **Step 3: Manual UI test**

Start dev server, navigate to `/calendar/day/2026-04-26`, click "+ new task" (or whatever the existing affordance is). Verify:

- The Category field appears above title
- Dropdown opens, shows Sleep + any categories you created in earlier tasks
- Search filters
- "+ Create '<query>'" works inline
- Saving the task persists `categoryId`; the saved task renders with category color (after Task 18)

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/TaskEditor.tsx
git commit -m "feat(calendar): TaskEditor uses CategoryPicker"
```

---

## Task 18: `PlanBlock` + `ActualBlock` components

**Files:**
- Create: `src/components/calendar/PlanBlock.tsx`
- Create: `src/components/calendar/ActualBlock.tsx`

- [ ] **Step 1: Implement `PlanBlock`**

Create `src/components/calendar/PlanBlock.tsx`:

```typescript
"use client";

import type { CalendarTask } from "@/lib/calendar";
import { hhmmToMinutes } from "./date-utils";
import { categoryTintStyle } from "@/lib/colors";

type Props = {
  task: CalendarTask;
  onClick?: () => void;
  /** When true, renders as a half-width left-aligned block (mobile dual layout). */
  halfLeft?: boolean;
};

export default function PlanBlock({ task, onClick, halfLeft = false }: Props) {
  const start = hhmmToMinutes(task.startTime);
  if (start === null) return null;
  const end = hhmmToMinutes(task.endTime) ?? start + 30;
  const top = (start / 1440) * 100;
  const height = Math.max(((end - start) / 1440) * 100, 0.8);

  const tint = categoryTintStyle(task.category?.color, 0.10);
  const borderStyle = task.category?.color
    ? { borderColor: task.category.color, color: "#e5e5e5" }
    : { borderColor: "rgba(255,255,255,0.4)", color: "rgba(255,255,255,0.85)" };

  const titleText = task.category
    ? `${task.category.name} — ${task.title}`
    : task.title;

  return (
    <button
      onClick={onClick}
      className={`group absolute border border-dashed text-left text-xs px-1 py-0.5 transition hover:bg-white/5 ${halfLeft ? "left-12 right-1/2 mr-0.5" : "left-12 right-2"}`}
      style={{ top: `${top}%`, height: `${height}%`, ...tint, ...borderStyle }}
    >
      <span className="font-mono text-[10px] opacity-70">
        {task.startTime}–{task.endTime ?? "?"}
      </span>{" "}
      {titleText}
    </button>
  );
}
```

- [ ] **Step 2: Implement `ActualBlock`**

Create `src/components/calendar/ActualBlock.tsx`:

```typescript
"use client";

import type { CalendarActual } from "@/lib/calendar";
import { categoryTintStyle } from "@/lib/colors";

type Props = {
  actual: CalendarActual;
  startMin: number;
  endMin: number;
  isRunning: boolean;
  onClick?: () => void;
  /** When true, renders as a half-width right-aligned block (mobile dual layout). */
  halfRight?: boolean;
};

export default function ActualBlock({ actual, startMin, endMin, isRunning, onClick, halfRight = false }: Props) {
  const top = (startMin / 1440) * 100;
  const height = Math.max(((endMin - startMin) / 1440) * 100, 0.8);

  const tint = categoryTintStyle(actual.category?.color, 0.45);
  const labelParts: string[] = [];
  if (actual.category) labelParts.push(actual.category.name);
  if (actual.title) labelParts.push(actual.title);
  const label = labelParts.length > 0 ? labelParts.join(" — ") : "(untitled)";

  const formatHM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  return (
    <button
      onClick={onClick}
      className={`group absolute border text-left text-xs px-1 py-0.5 transition hover:brightness-125 ${halfRight ? "left-1/2 right-1 ml-0.5" : "left-12 right-2"} ${isRunning ? "animate-pulse" : ""}`}
      style={{ top: `${top}%`, height: `${height}%`, ...tint }}
    >
      <span className="font-mono text-[10px] opacity-70">
        {formatHM(startMin)}–{endMin === 1440 ? "..." : formatHM(endMin)}
      </span>{" "}
      {label}
    </button>
  );
}
```

- [ ] **Step 3: Lint check**

Run: `bun run lint`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/PlanBlock.tsx src/components/calendar/ActualBlock.tsx
git commit -m "feat(calendar): add PlanBlock (dashed) and ActualBlock (filled) timeline components"
```

---

## Task 19: `ActualsEditor` modal

**Files:**
- Create: `src/components/calendar/ActualsEditor.tsx`

- [ ] **Step 1: Implement the editor**

Create `src/components/calendar/ActualsEditor.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarActual } from "@/lib/calendar";
import CategoryPicker from "./CategoryPicker";

type Props = {
  actual: CalendarActual;
  onClose: () => void;
};

function epochToLocalInput(ms: number): string {
  // YYYY-MM-DDTHH:MM in local tz, suitable for <input type="datetime-local">
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToEpoch(s: string): number {
  return new Date(s).getTime();
}

export default function ActualsEditor({ actual, onClose }: Props) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState<string | null>(actual.categoryId);
  const [title, setTitle] = useState<string>(actual.title ?? "");
  const [startInput, setStartInput] = useState<string>(epochToLocalInput(actual.startAt));
  const [endInput, setEndInput] = useState<string>(actual.endAt ? epochToLocalInput(actual.endAt) : "");
  const [stillRunning, setStillRunning] = useState<boolean>(actual.endAt === null);
  const [notes, setNotes] = useState<string>(actual.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    const body: Record<string, unknown> = {
      categoryId,
      title: title.trim() || null,
      startAt: localInputToEpoch(startInput),
      endAt: stillRunning ? null : localInputToEpoch(endInput),
      notes: notes.trim() || null,
    };
    const r = await fetch(`/api/calendar/actuals/${actual.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.error ?? "Failed to save");
      setSubmitting(false);
      return;
    }
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this actual?")) return;
    setSubmitting(true);
    const r = await fetch(`/api/calendar/actuals/${actual.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) {
      setError("Failed to delete");
      setSubmitting(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-white/20 bg-black p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm uppercase tracking-wider text-white/70">Edit actual</h3>
        <div className="space-y-1">
          <label className="text-xs text-white/60">Category</label>
          <CategoryPicker selectedId={categoryId} onChange={setCategoryId} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-white/60">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent border border-white/20 px-2 py-1 text-sm focus:border-white/60 outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-white/60">Start</label>
            <input
              type="datetime-local"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              className="w-full bg-transparent border border-white/20 px-2 py-1 text-sm focus:border-white/60 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/60">End</label>
            <input
              type="datetime-local"
              disabled={stillRunning}
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              className="w-full bg-transparent border border-white/20 px-2 py-1 text-sm disabled:opacity-40 focus:border-white/60 outline-none"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={stillRunning}
            onChange={(e) => setStillRunning(e.target.checked)}
          />
          Still running
        </label>
        <div className="space-y-1">
          <label className="text-xs text-white/60">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-transparent border border-white/20 px-2 py-1 text-sm focus:border-white/60 outline-none"
          />
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
        <div className="flex justify-between pt-1">
          <button
            type="button"
            onClick={remove}
            disabled={submitting}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 disabled:opacity-40"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-white/60 hover:text-white px-2 py-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={submitting}
              className="text-xs border border-white/30 hover:bg-white/10 disabled:opacity-40 px-2 py-1"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint check**

Run: `bun run lint`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/ActualsEditor.tsx
git commit -m "feat(calendar): add ActualsEditor modal (edit times, category, title, notes, delete)"
```

---

## Task 20: `AdHocActualForm` (quick "+ new activity")

**Files:**
- Create: `src/components/calendar/AdHocActualForm.tsx`

- [ ] **Step 1: Implement the form**

Create `src/components/calendar/AdHocActualForm.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CategoryPicker from "./CategoryPicker";

type Props = {
  onStarted: () => void;
  onCancel: () => void;
};

export default function AdHocActualForm({ onStarted, onCancel }: Props) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setSubmitting(true);
    setError(null);
    const r = await fetch("/api/calendar/actuals/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ categoryId, title: title.trim() || null }),
    });
    if (!r.ok) {
      setError("Failed to start");
      setSubmitting(false);
      return;
    }
    onStarted();
    router.refresh();
  }

  return (
    <div className="border border-white/20 p-3 space-y-2">
      <div className="text-xs uppercase tracking-wider text-white/60">New activity</div>
      <CategoryPicker selectedId={categoryId} onChange={setCategoryId} />
      <input
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-transparent border border-white/20 px-2 py-1 text-sm focus:border-white/60 outline-none"
      />
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-white/60 hover:text-white px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={start}
          disabled={submitting}
          className="text-xs border border-white/30 hover:bg-white/10 disabled:opacity-40 px-2 py-1"
        >
          {submitting ? "Starting..." : "Start"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/AdHocActualForm.tsx
git commit -m "feat(calendar): add AdHocActualForm for starting actuals without a plan"
```

---

## Task 21: `PlannedTodaySheet` (right column on desktop, full-screen on mobile)

**Files:**
- Create: `src/components/calendar/PlannedTodaySheet.tsx`

- [ ] **Step 1: Implement the sheet**

Create `src/components/calendar/PlannedTodaySheet.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarTask, CalendarActual } from "@/lib/calendar";
import AdHocActualForm from "./AdHocActualForm";

type Props = {
  date: string;
  tasks: CalendarTask[];
  runningActual: CalendarActual | null;
};

export default function PlannedTodaySheet({ date, tasks, runningActual }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  // Only timed plans for the day; dedupe by category+title to keep the list clean.
  const timed = tasks.filter((t) => t.date === date && t.startTime);
  const seen = new Set<string>();
  const uniqueTimed = timed.filter((t) => {
    const key = `${t.categoryId ?? ""}|${t.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  async function startFromPlan(planId: string) {
    setBusy(true);
    await fetch("/api/calendar/actuals/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ planId }),
    });
    setBusy(false);
    router.refresh();
  }

  async function stop() {
    setBusy(true);
    await fetch("/api/calendar/actuals/stop", { method: "POST", credentials: "include" });
    setBusy(false);
    router.refresh();
  }

  async function toggleSleep() {
    setBusy(true);
    if (runningActual && runningActual.category?.name.toLowerCase() === "sleep") {
      await fetch("/api/calendar/actuals/stop", { method: "POST", credentials: "include" });
    } else {
      // Start sleep: send a categoryId by name "Sleep" — but the API takes id.
      // Easiest: fetch the Sleep category and pass its id.
      const r = await fetch("/api/calendar/categories", { credentials: "include" });
      const cats = (await r.json()) as { id: string; name: string }[];
      const sleep = cats.find((c) => c.name.toLowerCase() === "sleep");
      if (sleep) {
        await fetch("/api/calendar/actuals/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ categoryId: sleep.id }),
        });
      }
    }
    setBusy(false);
    router.refresh();
  }

  const isSleeping = runningActual?.category?.name.toLowerCase() === "sleep";

  return (
    <div className="space-y-4 text-sm">
      <section>
        <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Now playing</div>
        {runningActual ? (
          <div className="flex items-center justify-between border border-white/20 bg-white/5 px-3 py-2">
            <div>
              <div className="text-white/90">
                {runningActual.category ? `${runningActual.category.name} — ` : ""}
                {runningActual.title ?? "(untitled)"}
              </div>
              <div className="text-[10px] text-white/40">running</div>
            </div>
            <button
              type="button"
              onClick={stop}
              disabled={busy}
              className="text-xs border border-white/30 hover:bg-white/10 px-2 py-1"
            >
              Stop
            </button>
          </div>
        ) : (
          <div className="text-xs text-white/40">Nothing running</div>
        )}
      </section>

      <section>
        <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Sleep</div>
        <button
          type="button"
          onClick={toggleSleep}
          disabled={busy}
          className="w-full text-left border border-white/20 hover:bg-white/10 px-3 py-2 text-sm"
        >
          {isSleeping ? "Wake up" : "Sleep"}
        </button>
      </section>

      <section>
        <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Planned today</div>
        {uniqueTimed.length === 0 && (
          <div className="text-xs text-white/40">No timed plans for this day</div>
        )}
        <div className="space-y-1">
          {uniqueTimed.map((t) => {
            const isLive = runningActual?.planId === t.id;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => isLive ? stop() : startFromPlan(t.id)}
                disabled={busy}
                className={`w-full flex items-center justify-between border px-3 py-2 text-left ${isLive ? "border-white/60 bg-white/10" : "border-white/15 hover:bg-white/5"}`}
              >
                <span className="flex items-center gap-2 truncate">
                  {t.category && (
                    <span
                      className="h-2 w-2 inline-block border border-white/30 shrink-0"
                      style={{ backgroundColor: t.category.color }}
                    />
                  )}
                  <span className="truncate">
                    {t.category ? `${t.category.name} — ${t.title}` : t.title}
                  </span>
                </span>
                <span className="text-[10px] text-white/50 shrink-0">{isLive ? "Stop" : "Start"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        {creating ? (
          <AdHocActualForm
            onStarted={() => setCreating(false)}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full text-left border border-dashed border-white/20 hover:bg-white/5 px-3 py-2 text-sm text-white/70"
          >
            + New activity
          </button>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/PlannedTodaySheet.tsx
git commit -m "feat(calendar): add PlannedTodaySheet (now-playing, sleep, plan list, ad-hoc)"
```

---

## Task 22: `NowPlayingBar` (mobile sticky bottom bar)

**Files:**
- Create: `src/components/calendar/NowPlayingBar.tsx`

- [ ] **Step 1: Implement the bar**

Create `src/components/calendar/NowPlayingBar.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CalendarActual, CalendarTask } from "@/lib/calendar";
import PlannedTodaySheet from "./PlannedTodaySheet";

type Props = {
  date: string;
  tasks: CalendarTask[];
  runningActual: CalendarActual | null;
};

function formatElapsed(startAt: number, now: number): string {
  const totalSec = Math.max(0, Math.floor((now - startAt) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function NowPlayingBar({ date, tasks, runningActual }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const [busy, setBusy] = useState(false);

  // Tick every second while a row is running.
  useEffect(() => {
    if (!runningActual) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [runningActual]);

  async function toggleSleep() {
    setBusy(true);
    if (runningActual?.category?.name.toLowerCase() === "sleep") {
      await fetch("/api/calendar/actuals/stop", { method: "POST", credentials: "include" });
    } else {
      const r = await fetch("/api/calendar/categories", { credentials: "include" });
      const cats = (await r.json()) as { id: string; name: string }[];
      const sleep = cats.find((c) => c.name.toLowerCase() === "sleep");
      if (sleep) {
        await fetch("/api/calendar/actuals/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ categoryId: sleep.id }),
        });
      }
    }
    setBusy(false);
    router.refresh();
  }

  const isSleeping = runningActual?.category?.name.toLowerCase() === "sleep";

  return (
    <>
      {expanded && (
        <div
          className="fixed inset-0 z-30 bg-black/70 md:hidden"
          onClick={() => setExpanded(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-black border-t border-white/20 p-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <PlannedTodaySheet date={date} tasks={tasks} runningActual={runningActual} />
          </div>
        </div>
      )}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/20 bg-black md:hidden">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex flex-col items-start text-left flex-1 min-w-0 mr-2"
          >
            <span className="text-[10px] uppercase tracking-wider text-white/50">Now playing</span>
            {runningActual ? (
              <span className="truncate text-sm text-white">
                {runningActual.category ? `${runningActual.category.name} — ` : ""}
                {runningActual.title ?? "(untitled)"} · {formatElapsed(runningActual.startAt, now)}
              </span>
            ) : (
              <span className="truncate text-sm text-white/50">Nothing running · tap to start</span>
            )}
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleSleep}
              disabled={busy}
              className="text-xs border border-white/30 hover:bg-white/10 px-2 py-1"
            >
              {isSleeping ? "Wake up" : "Sleep"}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-xs border border-white/30 hover:bg-white/10 px-2 py-1"
              aria-label="Open planner sheet"
            >
              ▴
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/NowPlayingBar.tsx
git commit -m "feat(calendar): add NowPlayingBar mobile sticky bar with elapsed timer + sheet"
```

---

## Task 23: Day view page route — fetch actuals, categories, running

**Files:**
- Modify: `src/app/calendar/day/[date]/page.tsx`

- [ ] **Step 1: Update the page to fetch the new data**

Replace the file contents with:

```typescript
import { notFound } from "next/navigation";
import DayView from "@/components/calendar/DayView";
import {
  getTasksInRange,
  getActualsInRange,
  getRunningActual,
} from "@/lib/calendar";
import { listCategories } from "@/lib/calendar-categories";
import { getPrayerTimesForDate } from "@/lib/prayer-times";
import { addDays, isValidDateString, todayInTz } from "@/components/calendar/date-utils";
import { isAdminServer } from "@/lib/auth-server";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDateString(date)) notFound();
  // Fetch yesterday's anchored actuals too so a block that started yesterday
  // and crosses midnight into `date` is included; clampActualToDay filters.
  const yesterday = addDays(date, -1);
  const [tasks, actuals, running, categories, prayers, admin, config] = await Promise.all([
    getTasksInRange(date, date),
    getActualsInRange(yesterday, date),
    getRunningActual(),
    listCategories(),
    getPrayerTimesForDate(date),
    isAdminServer(),
    getSiteConfig(),
  ]);
  const tz = resolveTimezone(config);
  return (
    <DayView
      date={date}
      tasks={tasks}
      actuals={actuals}
      runningActual={running}
      categories={categories}
      prayers={prayers}
      isAdmin={admin}
      today={todayInTz(tz)}
      timezone={tz}
    />
  );
}
```

- [ ] **Step 2: TS will complain about DayView prop mismatch — that's expected**

The DayView component accepts new props in Task 24. Don't lint yet.

- [ ] **Step 3: Don't commit yet — Task 24 makes DayView accept these props.**

This task is paired with Task 24. Move on to Task 24, then commit both together at the end of Task 24.

---

## Task 24: `DayView` revamp — 3-column desktop, merged mobile

**Files:**
- Modify: `src/components/calendar/DayView.tsx`

This task is large but mechanical. Read the existing file end-to-end before starting; the surgery is: replace the layout, add actuals rendering, mount the side sheet on desktop and the sticky bar on mobile.

- [ ] **Step 1: Read the existing DayView**

Run: `wc -l src/components/calendar/DayView.tsx && head -200 src/components/calendar/DayView.tsx`

Note where the existing timeline grid is built and where the existing TaskEditor modal is mounted.

- [ ] **Step 2: Update the props signature**

Update the `Props` type:

```typescript
import type { CalendarTask, CalendarActual } from "@/lib/calendar";
import type { CalendarCategory } from "@/lib/calendar-categories";
import type { PrayerTimes } from "@/lib/prayer-times"; // adjust import to what the existing file uses

type Props = {
  date: string;
  tasks: CalendarTask[];
  actuals: CalendarActual[];
  runningActual: CalendarActual | null;
  categories: CalendarCategory[];
  prayers: PrayerTimes;
  isAdmin: boolean;
  today: string;
  timezone: string;
};
```

(Use the actual existing `PrayerTimes` type name from the existing imports — don't invent.)

- [ ] **Step 3: Replace the timeline render with a 3-column desktop / merged mobile grid**

Add imports:

```typescript
import PlanBlock from "./PlanBlock";
import ActualBlock from "./ActualBlock";
import PlannedTodaySheet from "./PlannedTodaySheet";
import NowPlayingBar from "./NowPlayingBar";
import ActualsEditor from "./ActualsEditor";
import { clampActualToDay } from "./date-utils";
```

Add state for editing actuals:

```typescript
const [editingActual, setEditingActual] = useState<CalendarActual | null>(null);
```

Compute renderable actuals for this day (clamped):

```typescript
const renderActuals = actuals
  .map((a) => {
    const w = clampActualToDay(date, a.startAt, a.endAt, timezone);
    return w ? { actual: a, ...w } : null;
  })
  .filter((x): x is { actual: CalendarActual; startMin: number; endMin: number } => x !== null);
```

Replace the current single-timeline JSX with:

```tsx
<div className="grid gap-4 md:grid-cols-[1fr_1fr_280px]">
  {/* Plan column (desktop) / merged left-half (mobile) */}
  <div className="relative border border-white/10 bg-white/[0.02] min-h-[960px]">
    {/* hours legend — keep existing implementation; assume function or block */}
    {/* prayer markers — keep */}
    {/* mobile dual rendering: half-width plan blocks; desktop full-width */}
    {tasks.filter((t) => t.startTime).map((t) => (
      <PlanBlock
        key={t.id}
        task={t}
        halfLeft={true}
        onClick={() => isAdmin && setEditing(t)}
      />
    ))}
    {/* On mobile only, also render actuals overlaid */}
    <div className="md:hidden">
      {renderActuals.map(({ actual, startMin, endMin }) => (
        <ActualBlock
          key={actual.id}
          actual={actual}
          startMin={startMin}
          endMin={endMin}
          isRunning={actual.endAt === null}
          halfRight
          onClick={() => isAdmin && setEditingActual(actual)}
        />
      ))}
    </div>
  </div>

  {/* Actuals column (desktop only) */}
  <div className="relative hidden md:block border border-white/10 bg-white/[0.02] min-h-[960px]">
    {renderActuals.map(({ actual, startMin, endMin }) => (
      <ActualBlock
        key={actual.id}
        actual={actual}
        startMin={startMin}
        endMin={endMin}
        isRunning={actual.endAt === null}
        onClick={() => isAdmin && setEditingActual(actual)}
      />
    ))}
  </div>

  {/* Side panel (desktop) */}
  <aside className="hidden md:block">
    {isAdmin ? (
      <PlannedTodaySheet date={date} tasks={tasks} runningActual={runningActual} />
    ) : null}
  </aside>
</div>

{/* Mobile sticky bar */}
{isAdmin && (
  <NowPlayingBar date={date} tasks={tasks} runningActual={runningActual} />
)}

{/* Existing TaskEditor modal stays unchanged */}
{editing && <TaskEditor /* ...existing props... */ />}

{/* Actuals editor */}
{editingActual && (
  <ActualsEditor
    actual={editingActual}
    onClose={() => setEditingActual(null)}
  />
)}
```

Notes:
- Keep the existing hours legend, prayer-time markers, "today" indicator, and TaskEditor wiring intact — they should work unchanged.
- The `halfLeft={true}` prop on `PlanBlock` is what makes plans render half-width on mobile so the right half can show actuals. On desktop the plan column is its own column, so plans visually fill the column even with `halfLeft` (the left half of a half-width column is fine; if it looks too narrow, drop `halfLeft` on desktop only via a CSS conditional).
- If the page has bottom padding, add `pb-16 md:pb-0` to the main wrapper so the sticky bar doesn't cover content on mobile.

- [ ] **Step 4: Lint**

Run: `bun run lint`
Expected: passes.

- [ ] **Step 5: Manual verification — desktop**

Start dev server. Navigate to `/calendar/day/2026-04-26`. As admin, verify:

- Three columns visible at viewport width >= md
- Plan column shows existing tasks as dashed/outlined blocks tinted by category color
- Actuals column is empty (no actuals yet)
- Right column shows "Now playing" (empty), "Sleep" button, "Planned today" list, "+ New activity"
- Click a planned item → it starts an actual; the actuals column now shows a filled block
- Click "Stop" → the block stops; "Now playing" empties
- Click "Sleep" → starts a Sleep actual; button label flips to "Wake up"; sleep block appears in actuals column
- Click an actuals block → ActualsEditor opens; edit title; save; block updates
- Delete an actual via the editor → block disappears

- [ ] **Step 6: Manual verification — mobile**

Resize browser to <md width (or use device emulator). Verify:

- Single timeline column with plan blocks dashed on the left half, actuals filled on the right half (same category color, different treatment)
- Sleep blocks span full width (verify in Step 8 once a sleep block exists)
- Sticky bottom bar visible, shows "Now playing" or "Nothing running"
- Sleep button toggles correctly
- Tap the bar → bottom sheet opens with the full PlannedTodaySheet
- Sheet's planned-today list lets you start/stop; sheet stays open until tap-outside

- [ ] **Step 7: Cross-midnight verification**

In browser console, force-create a sleep actual ending tomorrow:

```js
// Start sleep ~5h before now using a manual PATCH
let r = await fetch("/api/calendar/actuals/start", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ categoryId: "sleep-system" }),
});
const { started } = await r.json();
const fiveHrAgo = Date.now() - 5 * 60 * 60 * 1000;
await fetch(`/api/calendar/actuals/${started.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ startAt: fiveHrAgo }),
});
```

Reload. The block should render starting from `now − 5h` to "now," pulsing. Stop it; reload — block has fixed end.

If `now − 5h` falls in yesterday, navigate to yesterday's day view too — the block should render from its start to midnight there.

- [ ] **Step 8: Commit (Tasks 23 + 24 together)**

```bash
git add src/app/calendar/day/[date]/page.tsx src/components/calendar/DayView.tsx
git commit -m "feat(calendar): DayView dual-timeline (3-col desktop, merged mobile + sticky bar)"
```

---

## Task 25: Categories management page

**Files:**
- Create: `src/app/calendar/categories/page.tsx`
- Create: `src/components/calendar/CategoriesManager.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/calendar/categories/page.tsx`:

```typescript
import { listCategories } from "@/lib/calendar-categories";
import { isAdminServer } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import CategoriesManager from "@/components/calendar/CategoriesManager";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const admin = await isAdminServer();
  if (!admin) redirect("/calendar");
  const categories = await listCategories();
  return (
    <main className="max-w-3xl mx-auto px-4 pt-16 pb-24">
      <h1 className="text-xl uppercase tracking-wider text-white mb-6">Categories</h1>
      <CategoriesManager initial={categories} />
    </main>
  );
}
```

- [ ] **Step 2: Implement the manager**

Create `src/components/calendar/CategoriesManager.tsx`:

```typescript
"use client";

import { useState } from "react";
import type { CalendarCategory } from "@/lib/calendar-categories";
import { CATEGORY_PALETTE } from "@/lib/colors";
import CategoryCreateInline from "./CategoryCreateInline";

type Props = { initial: CalendarCategory[] };

export default function CategoriesManager({ initial }: Props) {
  const [categories, setCategories] = useState<CalendarCategory[]>(initial);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setError(null);
    const r = await fetch(`/api/calendar/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setError(e.error ?? "Failed to update");
      return;
    }
    const updated = (await r.json()) as CalendarCategory;
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }

  async function remove(c: CalendarCategory) {
    setError(null);
    if (!confirm(`Delete "${c.name}"?`)) return;
    const r = await fetch(`/api/calendar/categories/${c.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      if (e.planCount !== undefined || e.actualCount !== undefined) {
        setError(`In use by ${e.planCount} plans and ${e.actualCount} actuals — reassign or archive first.`);
      } else {
        setError(e.error ?? "Failed to delete");
      }
      return;
    }
    setCategories((prev) => prev.filter((x) => x.id !== c.id));
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red-400">{error}</div>}

      {creating ? (
        <CategoryCreateInline
          initialName=""
          existingCategories={categories}
          onCreated={(c) => {
            setCategories((prev) => [...prev, c]);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="border border-dashed border-white/20 hover:bg-white/5 px-3 py-2 text-sm text-white/70"
        >
          + New category
        </button>
      )}

      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-white/50">
          <tr>
            <th className="text-left py-2 w-8"></th>
            <th className="text-left py-2">Name</th>
            <th className="text-left py-2">Color</th>
            <th className="text-right py-2">Status</th>
            <th className="text-right py-2 w-32">Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} className="border-t border-white/10">
              <td className="py-2">
                <span
                  className="h-3 w-3 inline-block border border-white/30"
                  style={{ backgroundColor: c.color }}
                />
              </td>
              <td className="py-2 text-white/90">
                {c.isSystem ? (
                  <span>{c.name} <span className="text-[10px] text-white/40">system</span></span>
                ) : (
                  <input
                    defaultValue={c.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== c.name) void patch(c.id, { name: v });
                    }}
                    className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/60 outline-none w-full"
                  />
                )}
              </td>
              <td className="py-2">
                <select
                  defaultValue={c.color}
                  onChange={(e) => void patch(c.id, { color: e.target.value })}
                  className="bg-transparent border border-white/20 px-1 py-0.5 text-xs"
                >
                  {CATEGORY_PALETTE.map((p) => (
                    <option key={p.hex} value={p.hex} style={{ backgroundColor: p.hex }}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2 text-right">
                {c.archived ? (
                  <button
                    type="button"
                    onClick={() => void patch(c.id, { archived: false })}
                    className="text-xs text-white/60 hover:text-white"
                  >
                    Unarchive
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void patch(c.id, { archived: true })}
                    className="text-xs text-white/60 hover:text-white"
                  >
                    Archive
                  </button>
                )}
              </td>
              <td className="py-2 text-right">
                {!c.isSystem && (
                  <button
                    type="button"
                    onClick={() => void remove(c)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

As admin, navigate to `/calendar/categories`. Verify:

- Sleep listed as system (no rename/delete affordance)
- "+ New category" creates inline; new row shows up
- Renaming a non-system category persists (blur)
- Changing color via dropdown persists
- Archiving / unarchiving toggles status
- Deleting an unused category works; deleting one in use shows the "in use" error message

- [ ] **Step 4: Commit**

```bash
git add src/app/calendar/categories src/components/calendar/CategoriesManager.tsx
git commit -m "feat(calendar): add /calendar/categories admin manager (rename/color/archive/delete)"
```

---

## Task 26: End-to-end manual verification + final cleanup

**Files:**
- (verification only, no edits unless bugs found)

- [ ] **Step 1: Run lint and tests**

```bash
bun run lint
bun run test
bun run build
```

Expected: all pass.

- [ ] **Step 2: End-to-end walkthrough**

With `bun run dev` running and admin session active, walk through:

1. **Categories**:
   - `/calendar/categories` — create "Oddjob" (taupe), "Study" (sage), "Gym" (terracotta)
2. **Plan a day**:
   - Navigate to today's day view
   - Create a task: 09:00–10:00, category "Study", title "Tafsir"
   - Create a task: 14:00–15:30, category "Oddjob", title "AbdurRazzaq"
   - Create a task: 18:00–19:00, category "Gym"
   - Verify plans render with the right colors and labels
3. **Track actuals**:
   - From the side panel, click "Start" on the Tafsir plan → actual appears in the actuals column
   - Wait a few seconds → "Now playing" shows elapsed time ticking
   - Click "Sleep" → previous actual auto-stops, sleep actual starts
   - Click "Wake up" → sleep stops
   - Click "+ New activity" → choose "Oddjob", title "Lunch break", start
   - Stop it
4. **Edit an actual**:
   - Click a stopped actuals block → editor opens with the right values
   - Adjust the end time → save → block resizes
   - Delete one → it vanishes
5. **Mobile**:
   - Resize to < 768px
   - Verify: timeline merges, sticky bar visible, planned/actuals overlay correctly, sheet opens on tap
6. **Cross-midnight**:
   - Start a Sleep actual, manually patch its `startAt` to ~5 hours ago
   - Navigate to yesterday's day view → block visible from its start to midnight
   - Stop it → both days' rendering updates accordingly
7. **Backwards compatibility**:
   - Confirm any pre-existing tasks (created before this feature) still render — title only, no category
   - Confirm `/api/calendar/heatmap?year=2026` (default) still returns plan-completion data
   - Confirm `/api/calendar/heatmap?year=2026&metric=actuals` returns minutes
8. **Single-active invariant**:
   - Start an actual; in another tab, immediately start a different one
   - First tab's actual should auto-stop on next refresh; only one running at a time

- [ ] **Step 3: Confirm no regressions on Month/Year**

Navigate to `/calendar/month/2026-04` and `/calendar/year/2026`. Both should look unchanged from before (still plan-completion driven).

- [ ] **Step 4: Final commit (if any cleanup needed)**

If you touched anything in Step 2's walkthrough as a fixup:

```bash
git add -A
git commit -m "fix(calendar): walkthrough fixups"
```

Otherwise, the feature is complete. Branch is ready for PR review.

- [ ] **Step 5: Open the PR**

```bash
gh pr create --title "feat(calendar): plan + actuals dual timeline, categories, sleep tracking" --body "$(cat <<'EOF'
## Summary
- Adds `calendar_categories` and `calendar_actuals` tables; `category_id` on `calendar_tasks`
- DayView becomes a 3-column desktop layout (plan | actuals | side panel) and merges into one timeline + sticky bar on mobile
- Single-active actuals invariant enforced server-side; sleep is a built-in seeded category with dedicated bar buttons
- Adds `/calendar/categories` admin page

## Test plan
- [ ] `bun run lint` passes
- [ ] `bun run test` passes
- [ ] Walkthrough in `docs/superpowers/plans/2026-04-26-calendar-revamp.md` Task 26 Step 2 passes end-to-end
- [ ] Existing tasks without categories still render
- [ ] Month/Year views unchanged

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review note

After writing this plan, verified against the spec:

- [x] Categories CRUD + admin page → Tasks 5, 10, 25
- [x] `category_id` on tasks → Task 4 (schema), Task 6 (lib), Task 11 (API), Task 17 (UI)
- [x] Actuals table + lib + API → Tasks 4, 7, 8, 9, 12, 13, 14
- [x] Single-active invariant + auto-stop → Task 8 + Task 14
- [x] Sleep as seeded category + bar buttons → Tasks 4, 21, 22
- [x] DayView 3-col desktop + merged mobile → Tasks 23, 24
- [x] `NowPlayingBar` mobile sticky → Task 22
- [x] `PlannedTodaySheet` desktop right column / mobile sheet → Task 21
- [x] Cross-midnight rendering → Task 3 (helpers) + Task 24 verification step
- [x] Heatmap actuals metric → Task 15
- [x] Date helpers (epoch + clamp) → Task 3
- [x] Color palette + helpers → Task 2
- [x] Verification plan → Task 26 (mirrors spec's Verification section)

No spec requirements left unmapped. Type names consistent across tasks (`CalendarCategory`, `CalendarTask`, `CalendarActual`, `CategorySummary`, `PlanSummary`).
