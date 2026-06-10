import { db, initDb, type DbCalendarCategory } from "./db";
import { isPaletteColor } from "./colors";

// Web Crypto global — works in Node 19+, Bun, and edge runtimes.
const randomUUID = () => globalThis.crypto.randomUUID();

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

export function rowToCategory(row: DbCalendarCategory): CalendarCategory {
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

export async function createCategory(input: NewCategory): Promise<{ ok: true; category: CalendarCategory } | { ok: false; reason: "duplicate" | "invalid-color" | "empty-name" }> {
  await initDb();
  if (!isPaletteColor(input.color)) return { ok: false, reason: "invalid-color" };
  const trimmed = input.name.trim();
  if (trimmed.length === 0) return { ok: false, reason: "empty-name" };
  const dup = await findCategoryByNameCI(trimmed);
  if (dup) return { ok: false, reason: "duplicate" };
  const id = randomUUID();
  const now = Date.now();
  // position is a small orderable integer (ORDER BY position ASC), not a
  // timestamp — append after the current max so new categories sort last.
  const posRes = await db.execute({
    sql: "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM calendar_categories",
    args: [],
  });
  const position = Number((posRes.rows[0] as unknown as { next: number }).next ?? 0);
  await db.execute({
    sql: `INSERT INTO calendar_categories (id, name, color, is_system, archived, position, created_at, updated_at)
          VALUES (?, ?, ?, 0, 0, ?, ?, ?)`,
    args: [id, trimmed, input.color, position, now, now],
  });
  const created = await getCategoryById(id);
  if (!created) throw new Error("Failed to create category");
  return { ok: true, category: created };
}

export async function updateCategory(
  id: string,
  patch: CategoryPatch,
): Promise<{ ok: true; category: CalendarCategory } | { ok: false; reason: "not-found" | "duplicate" | "invalid-color" | "system-name-locked" | "empty-name" }> {
  await initDb();
  const existing = await getCategoryById(id);
  if (!existing) return { ok: false, reason: "not-found" };

  if (patch.name !== undefined) {
    if (existing.isSystem) return { ok: false, reason: "system-name-locked" };
    const trimmed = patch.name.trim();
    if (trimmed.length === 0) return { ok: false, reason: "empty-name" };
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
