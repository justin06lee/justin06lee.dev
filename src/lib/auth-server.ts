import "server-only";

import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, validateSession } from "./auth";

export async function isAdminServer(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  return validateSession(token);
}

export async function requireAdminServer(): Promise<void> {
  if (!(await isAdminServer())) {
    throw new Error("Unauthorized.");
  }
}
