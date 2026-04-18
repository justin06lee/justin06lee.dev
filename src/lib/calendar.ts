import { db, initDb, type DbCalendarTask } from "./db";
import { randomUUID } from "crypto";

export type CalendarTask = {
  id: string;
  date: string;
  title: string;
  notes: string | null;
  startTime: string | null;
  endTime: string | null;
  done: boolean;
  position: number;
};

export type NewCalendarTask = {
  date: string;
  title: string;
  notes?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  position?: number;
};

export type CalendarTaskPatch = Partial<{
  title: string;
  notes: string | null;
  startTime: string | null;
  endTime: string | null;
  done: boolean;
  position: number;
  date: string;
}>;

function rowToTask(row: DbCalendarTask): CalendarTask {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    notes: row.notes,
    startTime: row.start_time,
    endTime: row.end_time,
    done: row.done === 1,
    position: row.position,
  };
}

export async function getTasksInRange(from: string, to: string): Promise<CalendarTask[]> {
  await initDb();
  const result = await db.execute({
    sql: "SELECT * FROM calendar_tasks WHERE date BETWEEN ? AND ? ORDER BY date ASC, position ASC, created_at ASC",
    args: [from, to],
  });
  return (result.rows as unknown as DbCalendarTask[]).map(rowToTask);
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
    sql: `INSERT INTO calendar_tasks (id, date, title, notes, start_time, end_time, done, position, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    args: [
      id,
      input.date,
      input.title,
      input.notes ?? null,
      input.startTime ?? null,
      input.endTime ?? null,
      input.position ?? 0,
      now,
      now,
    ],
  });
  const task = await getTaskById(id);
  if (!task) throw new Error("Failed to create task");
  return task;
}

export async function getTaskById(id: string): Promise<CalendarTask | null> {
  await initDb();
  const result = await db.execute({
    sql: "SELECT * FROM calendar_tasks WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0] as unknown as DbCalendarTask | undefined;
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
  };
  await db.execute({
    sql: `UPDATE calendar_tasks
          SET date=?, title=?, notes=?, start_time=?, end_time=?, done=?, position=?, updated_at=?
          WHERE id=?`,
    args: [
      merged.date,
      merged.title,
      merged.notes,
      merged.startTime,
      merged.endTime,
      merged.done ? 1 : 0,
      merged.position,
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
