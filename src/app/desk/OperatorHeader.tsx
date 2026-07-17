"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Breadcrumb, crumbsFromPath } from "@/components/chrome/breadcrumb";
import { Button } from "@/components/chrome/button";

const BASE = "/desk";

export function OperatorHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // "desk" root crumb, then the cumulative path segments below it. The last
  // crumb renders as the current page (the Breadcrumb component owns that).
  const items = [
    { label: "desk", href: BASE },
    ...crumbsFromPath(pathname ?? BASE, { basePath: BASE }),
  ];

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
          <Breadcrumb items={items} linkComponent={Link} />

          <div className="flex items-center gap-2 text-sm">
            <Button
              href="/desk/new-article"
              variant="link"
              size="sm"
              className="text-white/60"
            >
              new article
            </Button>
            <Button
              onClick={handleLogout}
              variant="link"
              size="sm"
              disabled={pending}
              className="text-white/60"
            >
              sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
