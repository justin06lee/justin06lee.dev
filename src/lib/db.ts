import { createClient } from "@libsql/client";
import { SLEEP_CATEGORY_ID } from "./calendar-constants";

export { SLEEP_CATEGORY_ID };

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

// Memoize so initDb() costs ~0 after the first call in a worker process.
// Without this, every lib function call (7+ per request) re-runs the full
// schema batch — adding hundreds of ms to each page load.
let initPromise: Promise<void> | null = null;

export function initDb(): Promise<void> {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

async function doInit(): Promise<void> {
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
      pinned INTEGER NOT NULL DEFAULT 0,
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
    // checkRateLimit prunes `WHERE first_attempt < ?` on every login attempt;
    // without this index that prune is a full table scan.
    `CREATE INDEX IF NOT EXISTS idx_login_attempts_first_attempt ON login_attempts(first_attempt)`,
    `CREATE TABLE IF NOT EXISTS api_mutation_rate (
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
      category_id TEXT,
      is_uncertain INTEGER NOT NULL DEFAULT 0,
      fallbacks TEXT,
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
    // FK clauses below are declarative; libsql does not enable
    // PRAGMA foreign_keys per-connection, so SET NULL is enforced
    // at the app level (see calendar-categories.ts deleteCategory).
    `CREATE TABLE IF NOT EXISTS calendar_actuals (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      plan_id TEXT,
      category_id TEXT,
      title TEXT,
      start_at INTEGER NOT NULL,
      end_at INTEGER,
      track INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (plan_id) REFERENCES calendar_tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES calendar_categories(id) ON DELETE SET NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_actuals_date ON calendar_actuals(date)`,
    // NOTE: the partial UNIQUE index guarding the running-row invariant is
    // created below, after ensureColumn guarantees `track` exists. It cannot
    // live in this batch because older installations reach here without the
    // column the index is built on.
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

  // Idempotent migration for installations that predate `category_id`. The
  // CREATE TABLE above already includes the column for fresh schemas; this
  // adds it to older deployments without dropping data.
  await ensureColumn("calendar_tasks", "category_id", "TEXT");
  await ensureColumn("calendar_tasks", "is_uncertain", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("calendar_tasks", "fallbacks", "TEXT");
  await ensureColumn("items", "pinned", "INTEGER NOT NULL DEFAULT 0");
  // Optional sub-grouping within a gallery category (e.g. "colorful",
  // "terminal") so projects sharing one clump together on the salon wall.
  await ensureColumn("items", "collection", "TEXT");

  // Parallel tracks. `track` lanes concurrent activity — working out while a
  // build runs, studying while socialising — so two things happening at once
  // are two rows, not a lie about one of them. Pre-existing rows default to
  // lane 0, which is exactly where the old single-timer behaviour lived, so
  // this is a pure widening: nothing that worked before changes meaning.
  await ensureColumn("calendar_actuals", "track", "INTEGER NOT NULL DEFAULT 0");

  // The running-row invariant is now per-lane: at most one open row PER track
  // rather than one globally. The old global index has to be dropped first —
  // it forbids exactly the second concurrent lane the new one exists to
  // allow. Both statements are idempotent, and both must run after the
  // ensureColumn above so the indexed column is guaranteed to exist.
  await db.execute({
    sql: `DROP INDEX IF EXISTS idx_calendar_actuals_running`,
    args: [],
  });
  await db.execute({
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_actuals_running_track
          ON calendar_actuals(track) WHERE end_at IS NULL`,
    args: [],
  });

  // One-time cleanup of pre-2026-05 fallback rows. The old shape was
  // `[{"type":"category"|"title", ...}]`; the new shape has no `"type"` key.
  // The runtime parser already discards old rows silently, but clearing the
  // column here means re-edits don't show ghost-uncertain tasks with no alts.
  // Idempotent: subsequent runs find no `"type":` substrings and no-op.
  await db.execute({
    sql: `UPDATE calendar_tasks SET fallbacks = NULL WHERE fallbacks LIKE '%"type":%'`,
    args: [],
  });

  // Seed the built-in Sleep category if not present.
  await db.execute({
    sql: `INSERT INTO calendar_categories (id, name, color, is_system, archived, position, created_at, updated_at)
          SELECT ?, 'Sleep', ?, 1, 0, 0, ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM calendar_categories WHERE LOWER(name) = 'sleep')`,
    args: [SLEEP_CATEGORY_ID, "#5b5b8a", Date.now(), Date.now()],
  });
}

// SQLite cannot parameterize identifiers, so caller-provided table/column/type
// strings are interpolated directly. Allowlist them to prevent injection if
// callers ever pass non-literal values.
const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SAFE_TYPE = /^[A-Za-z0-9_ ()]+$/;

async function ensureColumn(table: string, column: string, type: string): Promise<void> {
  if (!SAFE_IDENT.test(table) || !SAFE_IDENT.test(column) || !SAFE_TYPE.test(type)) {
    throw new Error(`ensureColumn: unsafe identifier(s): ${table}.${column} ${type}`);
  }
  const info = await db.execute({ sql: `PRAGMA table_info(${table})`, args: [] });
  const exists = (info.rows as unknown as { name: string }[]).some((r) => r.name === column);
  if (!exists) {
    await db.execute({ sql: `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, args: [] });
  }
}

export type DbItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  year: number;
  tech: string;
  link: string | null;
  repo: string | null;
  live: string | null;
  notes: string | null;
  sort_order: number;
  pinned: number;
  collection: string | null;
};

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
  is_uncertain: number;
  /** JSON-encoded PlanFallback[]; null when not uncertain or empty. */
  fallbacks: string | null;
  created_at: number;
  updated_at: number;
};

export type DbPrayerTimesCache = {
  cache_key: string;
  year: number;
  month: number;
  city: string;
  country: string;
  method: number;
  data: string;
  fetched_at: number;
};

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
  /** Concurrency lane. 0 is the primary lane; >0 are parallel activities. */
  track: number;
  notes: string | null;
  created_at: number;
  updated_at: number;
};
