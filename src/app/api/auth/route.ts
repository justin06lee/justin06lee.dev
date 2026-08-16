import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminKey,
  createSession,
  validateSession,
  destroySession,
  checkRateLimit,
  getClientIp,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  if (!(await checkRateLimit(ip))) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  // Reject oversized bodies before buffering — a login payload is a small
  // {password} object, so anything large is abuse (memory DoS on a public POST).
  if (Number(req.headers.get("content-length")) > 4096) {
    return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
  }

  let body: { password?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const { password } = body;

  // Bound the password length BEFORE verifyAdminKey: safeCompare allocates
  // buffers sized to the input, so a multi-MB string would blow up allocation
  // just to fail the compare. No legitimate password approaches 512 chars.
  if (typeof password !== "string" || password.length > 512) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!verifyAdminKey(password)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}

/** Check if the current session is valid */
export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken && await validateSession(sessionToken)) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}

/** Logout — destroy session */
export async function DELETE(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken) await destroySession(sessionToken);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}
