import { db, initDb, type DbItem } from "./db";
import type { GalleryItem } from "@/components/ItemGallery";

type CacheEntry = { data: GalleryItem[]; ts: number };
const cache = new Map<string, CacheEntry>();
const TTL = 24 * 60 * 60 * 1000; // 24 hours

export function invalidateItemsCache(category?: string) {
  if (category) cache.delete(category);
  else cache.clear();
}

export async function getItemsByCategory(category: string): Promise<GalleryItem[]> {
  const cached = cache.get(category);
  if (cached && Date.now() - cached.ts < TTL) return cached.data;

  await initDb();
  const result = await db.execute({
    sql: "SELECT * FROM items WHERE category = ? ORDER BY sort_order ASC, year DESC",
    args: [category],
  });

  const data = (result.rows as unknown as DbItem[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    year: row.year,
    tech: JSON.parse(row.tech),
    link: row.link ?? undefined,
    repo: row.repo ?? undefined,
    live: row.live ?? undefined,
    notes: row.notes ?? undefined,
  }));

  cache.set(category, { data, ts: Date.now() });
  return data;
}
