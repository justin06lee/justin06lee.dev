"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

const BASE = "/author";

function formatSegment(segment: string): string {
  return decodeURIComponent(segment).replace(/-/g, " ").toLocaleUpperCase();
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
      // Ignore network errors — we still want to clear local state and redirect.
    }
    startTransition(() => {
      router.refresh();
      router.push("/author");
    });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href={BASE}
          className="text-sm font-semibold tracking-wider text-foreground"
        >
          OPERATOR
        </Link>

        <nav className="flex min-w-0 items-center gap-2 text-sm text-muted">
          <Link href={BASE} className="transition-colors hover:text-foreground">
            ME
          </Link>
          {segments.map((segment, i) => (
            <span
              key={`${segment}-${i}`}
              className="flex items-center gap-2"
            >
              <span>/</span>
              {i < segments.length - 1 ? (
                <Link
                  href={`${BASE}/${segments.slice(0, i + 1).join("/")}`}
                  className="transition-colors hover:text-foreground"
                >
                  {formatSegment(segment)}
                </Link>
              ) : (
                <span className="text-foreground">{formatSegment(segment)}</span>
              )}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-sm text-muted">
          <Link
            href="/author/new-article"
            className="underline hover:text-foreground"
          >
            New article
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={pending}
            className="underline hover:text-foreground disabled:opacity-60"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
