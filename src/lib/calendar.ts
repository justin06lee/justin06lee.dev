import { db, initDb, type DbCalendarTask, type DbCalendarActual } from "./db";
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

export async function getHeatmapForYear(year: number): Promise<Record<string, number>> {
  await initDb();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const result = await db.execute({
    sql: "SELECT date, SUM(done) AS count FROM calendar_tasks WHERE date BETWEEN ? AND ? GROUP BY date",
    args: [from, to],
  });
  const out: Record<string, number> = {};
  for (const row of result.rows as unknown as { date: string; count: number }[]) {
    out[row.date] = Number(row.count ?? 0);
  }
  return out;
}

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

export async function deleteTask(id: string): Promise<void> {
  await initDb();
  await db.execute({ sql: "DELETE FROM calendar_tasks WHERE id = ?", args: [id] });
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
  return {
    id: row.id,
    date: row.date,
    planId: row.plan_id,
    plan: row.plan_id != null && row.plan_title != null ? { id: row.plan_id, title: row.plan_title } : null,
    categoryId: row.category_id,
    category:
      row.cat_id != null
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
