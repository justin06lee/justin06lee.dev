import { db, initDb } from "./db";
import { randomUUID } from "crypto";

export type Annotation = {
  id: string;
  articleSlug: string;
  type: string;
  paragraphIndex: number;
  position: string | null;
  startOffset: number | null;
  endOffset: number | null;
  highlightColor: string | null;
  comment: string | null;
  public: boolean;
  createdAt: number;
};

export type NewAnnotation = {
  articleSlug: string;
  type: string;
  paragraphIndex: number;
  position?: string | null;
  startOffset?: number | null;
  endOffset?: number | null;
  highlightColor?: string | null;
  comment?: string | null;
};

export type AnnotationPatch = Partial<{
  comment: string | null;
  public: boolean;
  highlightColor: string | null;
}>;

export type DbAnnotation = {
  id: string;
  article_slug: string;
  type: string;
  paragraph_index: number;
  position: string | null;
  start_offset: number | null;
  end_offset: number | null;
  highlight_color: string | null;
  comment: string | null;
  public: number;
  created_at: number;
};

function rowToAnnotation(row: DbAnnotation): Annotation {
  return {
    id: row.id,
    articleSlug: row.article_slug,
    type: row.type,
    paragraphIndex: row.paragraph_index,
    position: row.position,
    startOffset: row.start_offset,
    endOffset: row.end_offset,
    highlightColor: row.highlight_color,
    comment: row.comment,
    public: row.public === 1,
    createdAt: row.created_at,
  };
}

export async function getAnnotationsForArticle(
  slug: string,
  includePrivate: boolean
): Promise<Annotation[]> {
  await initDb();
  const sql = includePrivate
    ? "SELECT * FROM annotations WHERE article_slug = ? ORDER BY paragraph_index ASC, created_at ASC"
    : "SELECT * FROM annotations WHERE article_slug = ? AND public = 1 ORDER BY paragraph_index ASC, created_at ASC";
  const result = await db.execute({ sql, args: [slug] });
  return (result.rows as unknown as DbAnnotation[]).map(rowToAnnotation);
}

async function getAnnotationById(id: string): Promise<Annotation | null> {
  await initDb();
  const result = await db.execute({
    sql: "SELECT * FROM annotations WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0] as unknown as DbAnnotation | undefined;
  return row ? rowToAnnotation(row) : null;
}

export async function createAnnotation(input: NewAnnotation): Promise<Annotation> {
  await initDb();
  const id = randomUUID();
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO annotations (id, article_slug, type, paragraph_index, position, start_offset, end_offset, highlight_color, comment, public, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    args: [
      id,
      input.articleSlug,
      input.type,
      input.paragraphIndex,
      input.position ?? null,
      input.startOffset ?? null,
      input.endOffset ?? null,
      input.highlightColor ?? null,
      input.comment ?? null,
      now,
    ],
  });
  const annotation = await getAnnotationById(id);
  if (!annotation) throw new Error("Failed to create annotation");
  return annotation;
}

export async function updateAnnotation(
  id: string,
  patch: AnnotationPatch
): Promise<Annotation | null> {
  await initDb();
  const existing = await getAnnotationById(id);
  if (!existing) return null;
  const merged = {
    comment: patch.comment !== undefined ? patch.comment : existing.comment,
    public: patch.public !== undefined ? patch.public : existing.public,
    highlightColor:
      patch.highlightColor !== undefined ? patch.highlightColor : existing.highlightColor,
  };
  await db.execute({
    sql: `UPDATE annotations SET comment=?, public=?, highlight_color=? WHERE id=?`,
    args: [merged.comment, merged.public ? 1 : 0, merged.highlightColor, id],
  });
  return getAnnotationById(id);
}

export async function deleteAnnotation(id: string): Promise<void> {
  await initDb();
  await db.execute({ sql: "DELETE FROM annotations WHERE id = ?", args: [id] });
}
