import { db, initDb, type DbCalendarTask, type DbCalendarActual, type DbCalendarCategory } from "./db";
import {
  epochToDateInTz,
  hhmmToMinutes,
  clampActualToDay,
  addDays,
  intervalIntersectionMinutes,
} from "@/lib/calendar-dates";
import { rowToCategory, type CalendarCategory } from "./calendar-categories";

// Web Crypto global — works in Node 19+, Bun, and edge runtimes.
const randomUUID = () => globalThis.crypto.randomUUID();

export type CategorySummary = { id: string; name: string; color: string };

/**
 * An alternative concrete task that can also fulfill an "uncertain" plan's
 * slot. Each alternative is a full mini-task (category + title + interval).
 *
 * Match rule for heatmap scoring: an actual fulfills an alternative when its
 * `category_id` equals the alternative's `categoryId` AND its `title`
 * (trimmed, lowercased) equals the alternative's `title` (same normalization).
 * Both fields must match — alternatives are deliberately specific.
 *
 * The plan's own (parent) category still scores by category-only, as before.
 * That asymmetry is intentional: parent says "anything in this category," each
 * alternative says "this exact other thing."
 */
export type PlanFallback = {
  categoryId: string;
  title: string;
  /** HH:MM — must be present; alternatives without a time slot can't be scored. */
  startTime: string;
  /** HH:MM — must be > startTime. */
  endTime: string;
};

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
  isUncertain: boolean;
  fallbacks: PlanFallback[];
};

type NewCalendarTask = {
  date: string;
  title: string;
  notes?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  position?: number;
  categoryId?: string | null;
  isUncertain?: boolean;
  fallbacks?: PlanFallback[];
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
  isUncertain: boolean;
  fallbacks: PlanFallback[];
}>;

/** Parses the JSON-encoded `fallbacks` column. Always returns a valid array;
 *  malformed rows degrade silently to []. We don't surface a parse error
 *  because (a) writes go through the API which validates and (b) a failed
 *  fallback list shouldn't break the rest of the task data. */
function parseFallbacks(raw: string | null): PlanFallback[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidFallback);
  } catch {
    return [];
  }
}

function isValidFallback(v: unknown): v is PlanFallback {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.categoryId === "string" && o.categoryId.length > 0 &&
    typeof o.title === "string" && o.title.trim().length > 0 &&
    typeof o.startTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(o.startTime) &&
    typeof o.endTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(o.endTime) &&
    o.startTime < o.endTime
  );
}

function serializeFallbacks(fbs: PlanFallback[] | undefined | null): string | null {
  if (!fbs || fbs.length === 0) return null;
  // Trim titles on write so the heatmap doesn't have to per-row at read time.
  // Lowercasing happens at scoring time (display still shows the original case).
  const normalized = fbs
    .filter(isValidFallback)
    .map((f) => ({
      categoryId: f.categoryId,
      title: f.title.trim(),
      startTime: f.startTime,
      endTime: f.endTime,
    }));
  if (normalized.length === 0) return null;
  return JSON.stringify(normalized);
}

/** Returns true iff the given non-null id matches a row. We use this from
 *  write paths so callers see a clear "invalid-category"/"invalid-plan"
 *  error instead of silently storing a dangling FK. */
async function categoryExists(id: string): Promise<boolean> {
  const r = await db.execute({
    sql: "SELECT 1 FROM calendar_categories WHERE id = ? LIMIT 1",
    args: [id],
  });
  return r.rows.length > 0;
}

async function planExists(id: string): Promise<boolean> {
  const r = await db.execute({
    sql: "SELECT 1 FROM calendar_tasks WHERE id = ? LIMIT 1",
    args: [id],
  });
  return r.rows.length > 0;
}

type DbCalendarTaskJoined = DbCalendarTask & {
  cat_id: string | null;
  cat_name: string | null;
  cat_color: string | null;
};

function rowToTask(row: DbCalendarTaskJoined): CalendarTask {
  // Always surface the raw FK in `categoryId` even if the joined category
  // row is gone. Hard-deleting a category should not silently rewrite the
  // task's stored FK to null in the API surface — only `category` (the
  // joined summary) is null in that orphan case.
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
      row.cat_id != null
        ? { id: row.cat_id, name: row.cat_name ?? "", color: row.cat_color ?? "" }
        : null,
    isUncertain: row.is_uncertain === 1,
    fallbacks: parseFallbacks(row.fallbacks),
  };
}

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

export type CreateTaskResult =
  | { ok: true; task: CalendarTask }
  | { ok: false; reason: "invalid-category" };

export async function createTask(input: NewCalendarTask): Promise<CreateTaskResult> {
  await initDb();
  if (input.categoryId && !(await categoryExists(input.categoryId))) {
    return { ok: false, reason: "invalid-category" };
  }
  const id = randomUUID();
  const now = Date.now();
  const isUncertain = input.isUncertain ? 1 : 0;
  // Drop fallbacks entirely when not uncertain — keeps the column clean and
  // makes the "off" state unambiguous on read.
  const fallbacksJson = isUncertain ? serializeFallbacks(input.fallbacks) : null;
  await db.execute({
    sql: `INSERT INTO calendar_tasks
          (id, date, title, notes, start_time, end_time, done, position, category_id, is_uncertain, fallbacks, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.date,
      input.title,
      input.notes ?? null,
      input.startTime ?? null,
      input.endTime ?? null,
      input.position ?? 0,
      input.categoryId ?? null,
      isUncertain,
      fallbacksJson,
      now,
      now,
    ],
  });
  const task = await getTaskById(id);
  if (!task) throw new Error("Failed to create task");
  return { ok: true, task };
}

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

export type UpdateTaskResult =
  | { ok: true; task: CalendarTask }
  | { ok: false; reason: "not-found" | "invalid-category" };

export async function updateTask(id: string, patch: CalendarTaskPatch): Promise<UpdateTaskResult> {
  await initDb();
  const existing = await getTaskById(id);
  if (!existing) return { ok: false, reason: "not-found" };
  if (patch.categoryId && !(await categoryExists(patch.categoryId))) {
    return { ok: false, reason: "invalid-category" };
  }
  const merged = {
    date: patch.date ?? existing.date,
    title: patch.title ?? existing.title,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    startTime: patch.startTime !== undefined ? patch.startTime : existing.startTime,
    endTime: patch.endTime !== undefined ? patch.endTime : existing.endTime,
    done: patch.done !== undefined ? patch.done : existing.done,
    position: patch.position !== undefined ? patch.position : existing.position,
    categoryId: patch.categoryId !== undefined ? patch.categoryId : existing.categoryId,
    isUncertain: patch.isUncertain !== undefined ? patch.isUncertain : existing.isUncertain,
    fallbacks: patch.fallbacks !== undefined ? patch.fallbacks : existing.fallbacks,
  };
  // Same invariant as createTask: when not uncertain, fallbacks are erased so
  // the off state is unambiguous and toggling back on doesn't surface stale data.
  const fallbacksJson = merged.isUncertain ? serializeFallbacks(merged.fallbacks) : null;
  await db.execute({
    sql: `UPDATE calendar_tasks
          SET date=?, title=?, notes=?, start_time=?, end_time=?, done=?, position=?, category_id=?, is_uncertain=?, fallbacks=?, updated_at=?
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
      merged.isUncertain ? 1 : 0,
      fallbacksJson,
      Date.now(),
      id,
    ],
  });
  const updated = await getTaskById(id);
  if (!updated) throw new Error("Failed to load updated task");
  return { ok: true, task: updated };
}

export async function deleteTask(id: string): Promise<{ ok: boolean }> {
  await initDb();
  const result = await db.execute({
    sql: "DELETE FROM calendar_tasks WHERE id = ?",
    args: [id],
  });
  return { ok: (result.rowsAffected ?? 0) > 0 };
}

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
  // Always surface raw FKs (`planId`/`categoryId`) even if the joined row is
  // gone. The nested `plan`/`category` summaries are nullable so callers can
  // still tell "categorized but orphaned" from "uncategorized".
  return {
    id: row.id,
    date: row.date,
    planId: row.plan_id,
    plan: row.plan_id != null && row.plan_title != null
      ? { id: row.plan_id, title: row.plan_title }
      : null,
    categoryId: row.category_id,
    category: row.cat_id != null
      ? { id: row.cat_id, name: row.cat_name ?? "", color: row.cat_color ?? "" }
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
    // Include the running row only if it could plausibly intersect the range
    // (its anchor date is on or before `to`). Without that bound, historical
    // queries would always pick up "now" — surprising for callers.
    sql: `SELECT a.*, c.id AS cat_id, c.name AS cat_name, c.color AS cat_color, p.title AS plan_title
          FROM calendar_actuals a
          LEFT JOIN calendar_categories c ON c.id = a.category_id
          LEFT JOIN calendar_tasks p ON p.id = a.plan_id
          WHERE (a.date BETWEEN ? AND ?)
             OR (a.end_at IS NULL AND a.date <= ?)
          ORDER BY a.start_at ASC`,
    args: [from, to, to],
  });
  return (result.rows as unknown as DbCalendarActualJoined[]).map(rowToActual);
}

export async function getRunningActual(): Promise<CalendarActual | null> {
  await initDb();
  // ORDER BY is defensive: the partial UNIQUE index on `end_at IS NULL`
  // already guarantees at most one row matches, but if that index is ever
  // dropped we still want deterministic results.
  const result = await db.execute({
    sql: `SELECT a.*, c.id AS cat_id, c.name AS cat_name, c.color AS cat_color, p.title AS plan_title
          FROM calendar_actuals a
          LEFT JOIN calendar_categories c ON c.id = a.category_id
          LEFT JOIN calendar_tasks p ON p.id = a.plan_id
          WHERE a.end_at IS NULL
          ORDER BY a.start_at DESC
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

export type StartActualInput = {
  planId?: string | null;
  categoryId?: string | null;
  title?: string | null;
  timezone: string; // for computing the actuals row's `date` field
  nowMs?: number; // overrideable for tests; defaults to Date.now()
};

export type StartActualResult =
  | { ok: true; started: CalendarActual; autoStopped: CalendarActual | null }
  | { ok: false; reason: "concurrent-start" | "invalid-category" | "invalid-plan" };

/** Detect a violation of the partial UNIQUE index on `end_at IS NULL`.
 *  libsql surfaces the SQLITE_CONSTRAINT_UNIQUE code on its error objects. */
function isRunningUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { code?: string; message?: string };
  if (err.code === "SQLITE_CONSTRAINT_UNIQUE" || err.code === "SQLITE_CONSTRAINT") {
    return true;
  }
  const msg = err.message ?? "";
  return /UNIQUE constraint failed.*calendar_actuals/i.test(msg) ||
         msg.includes("idx_calendar_actuals_running");
}

export async function startActual(input: StartActualInput): Promise<StartActualResult> {
  await initDb();
  const now = input.nowMs ?? Date.now();

  // Validate explicit refs up front. `getTaskById` below also confirms plan
  // existence, but we need a clean error before that path can null-it-out.
  if (input.categoryId && !(await categoryExists(input.categoryId))) {
    return { ok: false, reason: "invalid-category" };
  }
  if (input.planId && !(await planExists(input.planId))) {
    return { ok: false, reason: "invalid-plan" };
  }

  // Hydrate from plan if requested. We distinguish "not provided" (undefined)
  // from "explicit null" so callers can opt out of plan inheritance per-field
  // by sending null.
  let categoryId: string | null = input.categoryId !== undefined ? input.categoryId : null;
  let title: string | null = input.title !== undefined ? input.title : null;
  if (input.planId) {
    const plan = await getTaskById(input.planId);
    if (plan) {
      if (input.categoryId === undefined) categoryId = plan.categoryId;
      if (input.title === undefined) title = plan.title;
    }
  }

  // Snapshot the running row, then atomically stop+insert in one transaction.
  // The partial UNIQUE index on `end_at IS NULL` catches concurrent starts
  // that race past the snapshot — surfaced as `concurrent-start`.
  const running = await getRunningActual();
  const id = randomUUID();
  const date = epochToDateInTz(now, input.timezone);

  const ops: { sql: string; args: unknown[] }[] = [];
  if (running) {
    ops.push({
      sql: `UPDATE calendar_actuals SET end_at=?, updated_at=? WHERE id=? AND end_at IS NULL`,
      args: [now, now, running.id],
    });
  }
  ops.push({
    sql: `INSERT INTO calendar_actuals
          (id, date, plan_id, category_id, title, start_at, end_at, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
    args: [id, date, input.planId ?? null, categoryId, title, now, now, now],
  });

  try {
    await db.batch(ops as never, "write");
  } catch (e) {
    if (isRunningUniqueViolation(e)) {
      return { ok: false, reason: "concurrent-start" };
    }
    throw e;
  }

  const started = await getActualById(id);
  if (!started) throw new Error("Failed to start actual");
  const autoStopped = running ? await getActualById(running.id) : null;
  return { ok: true, started, autoStopped };
}

export type StopActualResult = {
  stopped: CalendarActual | null; // null if nothing was running (idempotent)
};

export async function stopActual(nowMs: number = Date.now()): Promise<StopActualResult> {
  await initDb();
  const running = await getRunningActual();
  if (!running) return { stopped: null };
  // `WHERE end_at IS NULL` makes this a no-op if a concurrent stop already
  // closed the row; rowsAffected===0 means we lost the race and the row was
  // already stopped by someone else. Either way we return the current state.
  const result = await db.execute({
    sql: `UPDATE calendar_actuals SET end_at=?, updated_at=? WHERE id=? AND end_at IS NULL`,
    args: [nowMs, nowMs, running.id],
  });
  if ((result.rowsAffected ?? 0) === 0) return { stopped: null };
  const stopped = await getActualById(running.id);
  return { stopped };
}

export type ActualPatch = Partial<{
  categoryId: string | null;
  title: string | null;
  startAt: number;
  endAt: number | null;
  notes: string | null;
}>;

export type UpdateActualResult =
  | { ok: true; actual: CalendarActual }
  | { ok: false; reason: "not-found" | "start-after-end" | "would-overlap-running" | "invalid-category" };

export async function updateActual(id: string, patch: ActualPatch): Promise<UpdateActualResult> {
  await initDb();
  const existing = await getActualById(id);
  if (!existing) return { ok: false, reason: "not-found" };
  if (patch.categoryId && !(await categoryExists(patch.categoryId))) {
    return { ok: false, reason: "invalid-category" };
  }

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

  // Catch the partial UNIQUE violation as a fallback for the TOCTOU window
  // between `getRunningActual` above and the UPDATE below. App-level pre-check
  // gives a cleaner error in the uncontested case; the catch covers races.
  try {
    await db.execute({
      sql: `UPDATE calendar_actuals
            SET category_id=?, title=?, start_at=?, end_at=?, notes=?, updated_at=?
            WHERE id=?`,
      args: [merged.categoryId, merged.title, merged.startAt, merged.endAt, merged.notes, Date.now(), id],
    });
  } catch (e) {
    if (isRunningUniqueViolation(e)) {
      return { ok: false, reason: "would-overlap-running" };
    }
    throw e;
  }
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

export type CreateActualInput = {
  startAt: number;
  endAt: number;
  categoryId?: string | null;
  title?: string | null;
  planId?: string | null;
  notes?: string | null;
  timezone: string;
};

export type CreateActualResult =
  | { ok: true; actual: CalendarActual }
  | { ok: false; reason: "start-after-end" | "invalid-category" | "invalid-plan" };

/**
 * Backfills a closed (non-running) actual with explicit start/end times. Does
 * NOT touch the partial UNIQUE running-row index because end_at is set.
 */
export async function createActual(input: CreateActualInput): Promise<CreateActualResult> {
  await initDb();
  if (input.startAt >= input.endAt) return { ok: false, reason: "start-after-end" };
  if (input.categoryId && !(await categoryExists(input.categoryId))) {
    return { ok: false, reason: "invalid-category" };
  }
  if (input.planId && !(await planExists(input.planId))) {
    return { ok: false, reason: "invalid-plan" };
  }
  const id = randomUUID();
  const now = Date.now();
  const date = epochToDateInTz(input.startAt, input.timezone);
  await db.execute({
    sql: `INSERT INTO calendar_actuals
          (id, date, plan_id, category_id, title, start_at, end_at, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      date,
      input.planId ?? null,
      input.categoryId ?? null,
      input.title ?? null,
      input.startAt,
      input.endAt,
      input.notes ?? null,
      now,
      now,
    ],
  });
  const created = await getActualById(id);
  if (!created) throw new Error("Failed to create actual");
  return { ok: true, actual: created };
}

/**
 * Batched loader for the day-view page: tasks + actuals + categories in a
 * single libsql round trip. Any running actual is already included in
 * `actuals` via the `(end_at IS NULL AND date <= ?)` clause, so consumers
 * derive it via `actuals.find(a => a.endAt === null)`.
 */
export type DayPageData = {
  tasks: CalendarTask[];
  actuals: CalendarActual[];
  categories: CalendarCategory[];
};

export async function loadDayPageData(date: string, yesterday: string): Promise<DayPageData> {
  await initDb();
  const [tasksRs, actualsRs, categoriesRs] = await db.batch(
    [
      {
        sql: `SELECT t.*, c.id AS cat_id, c.name AS cat_name, c.color AS cat_color
              FROM calendar_tasks t
              LEFT JOIN calendar_categories c ON c.id = t.category_id
              WHERE t.date BETWEEN ? AND ?
              ORDER BY t.date ASC, t.position ASC, t.created_at ASC`,
        args: [date, date],
      },
      {
        sql: `SELECT a.*, c.id AS cat_id, c.name AS cat_name, c.color AS cat_color, p.title AS plan_title
              FROM calendar_actuals a
              LEFT JOIN calendar_categories c ON c.id = a.category_id
              LEFT JOIN calendar_tasks p ON p.id = a.plan_id
              WHERE (a.date BETWEEN ? AND ?)
                 OR (a.end_at IS NULL AND a.date <= ?)
              ORDER BY a.start_at ASC`,
        args: [yesterday, date, date],
      },
      {
        sql: `SELECT * FROM calendar_categories
              ORDER BY archived ASC, is_system DESC, position ASC, LOWER(name) ASC`,
        args: [],
      },
    ],
    "read",
  );

  const tasks = (tasksRs.rows as unknown as DbCalendarTaskJoined[]).map(rowToTask);
  const actuals = (actualsRs.rows as unknown as DbCalendarActualJoined[]).map(rowToActual);
  const categories = (categoriesRs.rows as unknown as DbCalendarCategory[]).map(rowToCategory);

  return { tasks, actuals, categories };
}

/**
 * Returns { "YYYY-MM-DD": fillRatio } across the given inclusive date range,
 * where fillRatio in (0, 1] is fulfilled overlap minutes divided by
 * min(8h, total planned minutes that day) — see the loop below.
 *
 * Each plan has one "parent" candidate (its own interval + category) and, if
 * it's uncertain, one extra candidate per alternative (alt's interval +
 * (categoryId, title)). Per-candidate match rules:
 *
 *   - parent:      actual.category_id === plan.category_id (title irrelevant)
 *   - alternative: actual.category_id === alt.categoryId AND
 *                  trim/lower(actual.title) === trim/lower(alt.title)
 *
 * For each candidate we collect the sub-intervals where matching actuals
 * overlap the candidate's own time slot. The plan's score is the union length
 * of those sub-intervals across parent + all alternatives — overlapping
 * candidates fulfilled by the same actual minute count once, not multiple
 * times. Per-day total is the sum across plans on that day.
 *
 * Cross-midnight actuals are clamped to each day they touch. Running actuals
 * (`end_at IS NULL`) clamp to "now".
 */
export async function getOverlapHeatmapForRange(
  from: string,
  to: string,
  timezone: string,
): Promise<Record<string, number>> {
  await initDb();
  const dayBefore = addDays(from, -1);

  const [tasksRs, actualsRs] = await db.batch(
    [
      {
        sql: `SELECT date, start_time, end_time, category_id, is_uncertain, fallbacks
              FROM calendar_tasks
              WHERE date BETWEEN ? AND ?
                AND start_time IS NOT NULL AND end_time IS NOT NULL`,
        args: [from, to],
      },
      {
        sql: `SELECT date, start_at, end_at, category_id, title FROM calendar_actuals
              WHERE date BETWEEN ? AND ?`,
        args: [dayBefore, to],
      },
    ],
    "read",
  );

  type PlanRow = {
    interval: readonly [number, number];
    categoryId: string | null;
    isUncertain: boolean;
    fallbacks: PlanFallback[];
  };
  type ActualSlice = {
    interval: readonly [number, number];
    categoryId: string | null;
    /** Pre-lowercased + trimmed at filter-time for case-insensitive title match. */
    titleLower: string | null;
  };

  const plansByDate = new Map<string, PlanRow[]>();
  for (const row of tasksRs.rows as unknown as {
    date: string;
    start_time: string;
    end_time: string;
    category_id: string | null;
    is_uncertain: number;
    fallbacks: string | null;
  }[]) {
    const start = hhmmToMinutes(row.start_time);
    const end = hhmmToMinutes(row.end_time);
    if (start === null || end === null || end <= start) continue;
    const isUncertain = row.is_uncertain === 1;
    const plan: PlanRow = {
      interval: [start, end],
      categoryId: row.category_id,
      isUncertain,
      // Strict plans don't need fallbacks at scoring time — skip the parse.
      fallbacks: isUncertain ? parseFallbacks(row.fallbacks) : [],
    };
    const arr = plansByDate.get(row.date) ?? [];
    arr.push(plan);
    plansByDate.set(row.date, arr);
  }

  const now = Date.now();
  const actualsByDate = new Map<string, ActualSlice[]>();
  for (const row of actualsRs.rows as unknown as {
    date: string;
    start_at: number;
    end_at: number | null;
    category_id: string | null;
    title: string | null;
  }[]) {
    const startsOn = row.date;
    const endsOn = epochToDateInTz(row.end_at ?? now, timezone);
    // Walk every day the actual touches, not just its endpoints: an actual
    // spanning 3+ days must populate intermediate days too, or plans on those
    // days never match and their heatmap fill is wrongly zero.
    const datesToCheck: string[] = [];
    for (let current = startsOn; current <= endsOn; current = addDays(current, 1)) {
      datesToCheck.push(current);
    }
    const titleLower = row.title ? row.title.trim().toLowerCase() : null;
    for (const d of datesToCheck) {
      if (d < from || d > to) continue;
      const w = clampActualToDay(d, row.start_at, row.end_at, timezone, now);
      if (!w) continue;
      const arr = actualsByDate.get(d) ?? [];
      arr.push({
        interval: [w.startMin, w.endMin],
        categoryId: row.category_id,
        titleLower,
      });
      actualsByDate.set(d, arr);
    }
  }

  const FULL_DAY: [number, number][] = [[0, 1440]];
  // Heatmap fills relative to the day's own plan, not an absolute clock: a fully
  // followed light day should light up as much as a fully followed heavy one.
  // Denominator = min(8h, total planned minutes); 8h caps the "full" threshold so
  // marathon plans don't require an unreachable amount of follow-through.
  const FULL_TARGET_MIN = 8 * 60;
  const out: Record<string, number> = {};
  for (const [date, plans] of plansByDate) {
    const dayActuals = actualsByDate.get(date);
    if (!dayActuals || dayActuals.length === 0) continue;
    let total = 0;
    let plannedMinutes = 0;
    for (const plan of plans) {
      plannedMinutes += plan.interval[1] - plan.interval[0];
      // Collect fulfilled sub-intervals across the parent + alternatives. Each
      // matching actual gets clipped to its candidate's interval before being
      // unioned, so a candidate at 18:00–19:00 fulfilled by an actual that
      // ran 17:30–18:30 contributes only [18:00, 18:30].
      const fulfilled: [number, number][] = [];

      // Parent candidate: category-only match.
      for (const a of dayActuals) {
        if (a.categoryId !== plan.categoryId) continue;
        const lo = Math.max(a.interval[0], plan.interval[0]);
        const hi = Math.min(a.interval[1], plan.interval[1]);
        if (hi > lo) fulfilled.push([lo, hi]);
      }

      // Alternative candidates: category AND title both must match.
      if (plan.isUncertain) {
        for (const alt of plan.fallbacks) {
          const altStart = hhmmToMinutes(alt.startTime);
          const altEnd = hhmmToMinutes(alt.endTime);
          if (altStart === null || altEnd === null || altEnd <= altStart) continue;
          const altTitleLower = alt.title.trim().toLowerCase();
          for (const a of dayActuals) {
            if (a.categoryId !== alt.categoryId) continue;
            if (a.titleLower !== altTitleLower) continue;
            const lo = Math.max(a.interval[0], altStart);
            const hi = Math.min(a.interval[1], altEnd);
            if (hi > lo) fulfilled.push([lo, hi]);
          }
        }
      }

      if (fulfilled.length === 0) continue;
      // Intersecting with the full day is a no-op after the helper's internal
      // normalize step — saves us exporting normalizeIntervals just for this.
      total += intervalIntersectionMinutes(fulfilled, FULL_DAY);
    }
    if (total > 0 && plannedMinutes > 0) {
      const denom = Math.min(FULL_TARGET_MIN, plannedMinutes);
      out[date] = Math.min(1, total / denom);
    }
  }
  return out;
}
