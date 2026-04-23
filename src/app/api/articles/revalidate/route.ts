import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const slug = req.nextUrl.searchParams.get("slug");
  if (slug) {
    if (!/^[\w-]+$/.test(slug)) {
      return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    }
    revalidatePath(`/articles/${slug}`);
  }
  revalidatePath("/articles");

  return NextResponse.json({ ok: true, slug: slug ?? null });
}
