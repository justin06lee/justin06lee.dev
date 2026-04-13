import { db, initDb, type DbArticle } from "./db";

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  banner_url: string | null;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapArticle(row: DbArticle): Article {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    banner_url: row.banner_url,
    tags: (() => { try { return JSON.parse(row.tags); } catch { return []; } })(),
    published: row.published === 1,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getPublishedArticles(): Promise<Article[]> {
  await initDb();
  const result = await db.execute(
    "SELECT * FROM articles WHERE published = 1 ORDER BY published_at DESC, created_at DESC"
  );
  return (result.rows as unknown as DbArticle[]).map(mapArticle);
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  await initDb();
  const result = await db.execute({
    sql: "SELECT * FROM articles WHERE slug = ? AND published = 1",
    args: [slug],
  });
  const rows = result.rows as unknown as DbArticle[];
  if (rows.length === 0) return null;
  return mapArticle(rows[0]);
}

export async function getAllArticles(): Promise<Article[]> {
  await initDb();
  const result = await db.execute(
    "SELECT * FROM articles ORDER BY created_at DESC"
  );
  return (result.rows as unknown as DbArticle[]).map(mapArticle);
}
