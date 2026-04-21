import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, requireAdmin } from "@/lib/auth";
import {
  createAnnotation,
  getAnnotationsForArticle,
} from "@/lib/annotations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json(
      { error: "slug query parameter is required" },
      { status: 400 },
    );
  }

  const includePrivate = await isAdminRequest(req);
  const annotations = await getAnnotationsForArticle(slug, includePrivate);
  return NextResponse.json({ annotations });
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { articleSlug, type, paragraphIndex } = body;

  // Required fields
  if (typeof articleSlug !== "string" || articleSlug.length === 0) {
    return NextResponse.json(
      { error: "articleSlug is required" },
      { status: 400 },
    );
  }
  if (type !== "highlight" && type !== "margin") {
    return NextResponse.json(
      { error: "type must be \"highlight\" or \"margin\"" },
      { status: 400 },
    );
  }
  if (typeof paragraphIndex !== "number" || paragraphIndex < 0) {
    return NextResponse.json(
      { error: "paragraphIndex must be a non-negative number" },
      { status: 400 },
    );
  }

  // Type-specific validation
  if (type === "margin") {
    const { position, comment } = body;
    if (position !== "before" && position !== "after") {
      return NextResponse.json(
        { error: "position must be \"before\" or \"after\" for margin annotations" },
        { status: 400 },
      );
    }
    if (typeof comment !== "string" || comment.trim().length === 0) {
      return NextResponse.json(
        { error: "comment must be a non-empty string for margin annotations" },
        { status: 400 },
      );
    }
  }

  if (type === "highlight") {
    const { startOffset, endOffset } = body;
    if (typeof startOffset !== "number" || typeof endOffset !== "number") {
      return NextResponse.json(
        { error: "startOffset and endOffset must be numbers for highlight annotations" },
        { status: 400 },
      );
    }
    if (endOffset <= startOffset) {
      return NextResponse.json(
        { error: "endOffset must be greater than startOffset" },
        { status: 400 },
      );
    }
  }

  const annotation = await createAnnotation({
    articleSlug: articleSlug as string,
    type: type as string,
    paragraphIndex: paragraphIndex as number,
    position: typeof body.position === "string" ? body.position : undefined,
    startOffset: typeof body.startOffset === "number" ? body.startOffset : undefined,
    endOffset: typeof body.endOffset === "number" ? body.endOffset : undefined,
    highlightColor: typeof body.highlightColor === "string" ? body.highlightColor : undefined,
    comment: typeof body.comment === "string" ? body.comment : undefined,
  });

  return NextResponse.json(annotation);
}
