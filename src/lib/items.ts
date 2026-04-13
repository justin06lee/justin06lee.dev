import { db, initDb, type DbItem } from "./db";
import type { GalleryItem } from "@/components/ItemGallery";

export async function getItemsByCategory(category: string): Promise<GalleryItem[]> {
  await initDb();
  const result = await db.execute({
    sql: "SELECT * FROM items WHERE category = ? ORDER BY sort_order ASC, year DESC",
    args: [category],
  });

  return (result.rows as unknown as DbItem[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    year: row.year,
    tech: (() => { try { return JSON.parse(row.tech); } catch { return []; } })(),
    link: row.link ?? undefined,
    repo: row.repo ?? undefined,
    live: row.live ?? undefined,
    notes: row.notes ?? undefined,
  }));
}
