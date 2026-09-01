import { db, initDb, type DbItem } from "./db";
import type { GalleryItem } from "@/components/ItemGallery";
import { parsePlacement, type Placement } from "./gallery-wall";

// The card grid only needs GalleryItem, but the projects salon groups by an
// optional collection, and the hand-arranged wall needs each piece's stored
// box + image override, so the query carries all of it alongside.
export type SiteGalleryItem = GalleryItem & {
  collection: string | null;
  wallDesktop: Placement | null;
  wallMobile: Placement | null;
  wallImage: string | null;
};

export async function getItemsByCategory(category: string): Promise<SiteGalleryItem[]> {
  await initDb();
  const result = await db.execute({
    sql: "SELECT * FROM items WHERE category = ? ORDER BY pinned DESC, sort_order ASC, year DESC",
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
    pinned: !!row.pinned,
    collection: row.collection ?? null,
    wallDesktop: parsePlacement(row.wall_desktop),
    wallMobile: parsePlacement(row.wall_mobile),
    wallImage: row.wall_image ?? null,
  }));
}
