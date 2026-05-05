"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

const BASE = "/desk";

function formatSegment(segment: string): string {
  return decodeURIComponent(segment).replace(/-/g, " ");
}

export function OperatorHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const segments = pathname?.replace(BASE, "").split("/").filter(Boolean) ?? [];

  async function handleLogout() {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
      // Ignore network errors — clear local state and redirect anyway.
    }
    startTransition(() => {
      router.refresh();
      router.push("/desk");
    });
  }

  return (
    <div className="pt-16 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3 mb-6">
          <nav className="flex min-w-0 items-center gap-2 text-sm font-mono tabular-nums">
            <Link href={BASE} className="text-white/60 hover:text-white underline-offset-4 hover:underline">
              desk
            </Link>
            {segments.map((segment, i) => (
              <span key={`${segment}-${i}`} className="flex items-center gap-2">
                <span className="text-white/30">/</span>
                {i < segments.length - 1 ? (
                  <Link
                    href={`${BASE}/${segments.slice(0, i + 1).join("/")}`}
                    className="text-white/60 hover:text-white underline-offset-4 hover:underline"
                  >
                    {formatSegment(segment)}
                  </Link>
                ) : (
                  <span className="text-white">{formatSegment(segment)}</span>
                )}
              </span>
            ))}
          </nav>

          <div className="flex items-center gap-4 text-sm">
            <Link href="/desk/new-article" className="text-white/60 hover:text-white underline-offset-4 hover:underline">
              new article
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={pending}
              className="text-white/60 hover:text-white underline-offset-4 hover:underline disabled:opacity-60"
            >
              sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
