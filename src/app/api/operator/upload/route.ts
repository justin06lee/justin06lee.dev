import { NextRequest, NextResponse } from "next/server";
import { isAdminServer } from "@/lib/auth-server";
import { uploadOperatorImageByPath } from "@/lib/operator-content";

export async function POST(req: NextRequest) {
  if (!(await isAdminServer())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  const articlePathRaw = form.get("articlePath");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (typeof articlePathRaw !== "string" || !articlePathRaw) {
    return NextResponse.json({ error: "Article path is required." }, { status: 400 });
  }

  const articlePath = articlePathRaw
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const buffer = Buffer.from(await file.arrayBuffer());
  const data = buffer.toString("base64");

  try {
    const asset = await uploadOperatorImageByPath({
      articlePath,
      data,
      filename: file.name,
      mimeType: file.type,
    });
    return NextResponse.json(asset);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
