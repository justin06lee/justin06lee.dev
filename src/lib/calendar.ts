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
 * Returns { "YYYY-MM-DD": overlapMinutes } across the given inclusive date range.
 *
 * Overlap = total minutes-of-day where a planned task interval and a logged actual
 * interval coincide AND share the same `category_id` (NULL counts as its own bucket).
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
        sql: `SELECT date, start_time, end_time, category_id FROM calendar_tasks
              WHERE date BETWEEN ? AND ?
                AND start_time IS NOT NULL AND end_time IS NOT NULL`,
        args: [from, to],
      },
      {
        sql: `SELECT date, start_at, end_at, category_id FROM calendar_actuals
              WHERE date BETWEEN ? AND ?`,
        args: [dayBefore, to],
      },
    ],
    "read",
  );

  type Bucket = Map<string, [number, number][]>;
  const plansByDate = new Map<string, Bucket>();
  for (const row of tasksRs.rows as unknown as {
    date: string;
    start_time: string;
    end_time: string;
    category_id: string | null;
  }[]) {
    const start = hhmmToMinutes(row.start_time);
    const end = hhmmToMinutes(row.end_time);
    if (start === null || end === null || end <= start) continue;
    const key = row.category_id ?? "";
    let bucket = plansByDate.get(row.date);
    if (!bucket) { bucket = new Map(); plansByDate.set(row.date, bucket); }
    const arr = bucket.get(key) ?? [];
    arr.push([start, end]);
    bucket.set(key, arr);
  }

  const now = Date.now();
  const actualsByDate = new Map<string, Bucket>();
  for (const row of actualsRs.rows as unknown as {
    date: string;
    start_at: number;
    end_at: number | null;
    category_id: string | null;
  }[]) {
    const startsOn = row.date;
    const endsOn = epochToDateInTz(row.end_at ?? now, timezone);
    const datesToCheck = startsOn === endsOn ? [startsOn] : [startsOn, endsOn];
    const key = row.category_id ?? "";
    for (const d of datesToCheck) {
      if (d < from || d > to) continue;
      const w = clampActualToDay(d, row.start_at, row.end_at, timezone, now);
      if (!w) continue;
      let bucket = actualsByDate.get(d);
      if (!bucket) { bucket = new Map(); actualsByDate.set(d, bucket); }
      const arr = bucket.get(key) ?? [];
      arr.push([w.startMin, w.endMin]);
      bucket.set(key, arr);
    }
  }

  const out: Record<string, number> = {};
  for (const [date, plansByCat] of plansByDate) {
    const actualsByCat = actualsByDate.get(date);
    if (!actualsByCat) continue;
    let total = 0;
    for (const [cat, plans] of plansByCat) {
      const actuals = actualsByCat.get(cat);
      if (!actuals) continue;
      total += intervalIntersectionMinutes(plans, actuals);
    }
    if (total > 0) out[date] = total;
  }
  return out;
}
