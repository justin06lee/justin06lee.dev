"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { addDays } from "@/lib/calendar-dates";
import { CalendarNav, type CalendarView } from "@/components/chrome/calendar-nav";

type View = "day" | "month" | "year";

function parsePath(pathname: string): { view: View; token: string | null } {
  // The CalendarShell layout only mounts under `/calendar/*`, so `parts[0]`
  // is always "calendar" — no defensive branch needed.
  const parts = pathname.split("/").filter(Boolean);
  const view = (parts[1] as View) ?? "day";
  const token = parts[2] ?? null;
  return { view, token };
}

function prevToken(view: View, token: string | null): string | null {
  if (!token) return null;
  if (view === "day") return addDays(token, -1);
  if (view === "month") {
    // Manual month arithmetic instead of Date.UTC: for years 0-99 Date.UTC
    // remaps to 1900+y, corrupting the token. Zero-pad the year so low years
    // round-trip through the URL (e.g. 0999-12).
    const [y, m] = token.split("-").map(Number);
    const py = m <= 1 ? y - 1 : y;
    const pm = m <= 1 ? 12 : m - 1;
    return `${String(py).padStart(4, "0")}-${String(pm).padStart(2, "0")}`;
  }
  // Zero-pad year tokens: /calendar/year/1000 → "999" would 404, needs "0999".
  return String(Number(token) - 1).padStart(4, "0");
}

function nextToken(view: View, token: string | null): string | null {
  if (!token) return null;
  if (view === "day") return addDays(token, 1);
  if (view === "month") {
    const [y, m] = token.split("-").map(Number);
    const ny = m >= 12 ? y + 1 : y;
    const nm = m >= 12 ? 1 : m + 1;
    return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}`;
  }
  return String(Number(token) + 1).padStart(4, "0");
}

export default function CalendarShell({
  today,
  todayMonth,
  todayYear,
  isAdmin = false,
  children,
}: {
  today: string;
  todayMonth: string;
  todayYear: string;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const onCategories = pathname === "/calendar/categories";
  const { view, token } = parsePath(pathname);

  const dayHref = (t: string) => `/calendar/day/${t}`;
  const monthHref = (t: string) => `/calendar/month/${t}`;
  const yearHref = (t: string) => `/calendar/year/${t}`;

  const prev = prevToken(view, token);
  const next = nextToken(view, token);
  const prevHref =
    view === "day" && prev ? dayHref(prev) :
    view === "month" && prev ? monthHref(prev) :
    view === "year" && prev ? yearHref(prev) : null;
  const nextHref =
    view === "day" && next ? dayHref(next) :
    view === "month" && next ? monthHref(next) :
    view === "year" && next ? yearHref(next) : null;
  const todayHref = view === "month" ? monthHref(todayMonth) : view === "year" ? yearHref(todayYear) : dayHref(today);
  const currentLabel = view === "month" ? "this month" : view === "year" ? "this year" : "today";
  const viewHref = (v: CalendarView) =>
    v === "day" ? dayHref(today) : v === "month" ? monthHref(todayMonth) : yearHref(todayYear);

  return (
    <div className="min-h-screen bg-black text-white pt-16 pb-16 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center gap-4 border-b border-white/10 pb-3 mb-6">
          <CalendarNav
            className="flex-1 border-b-0 pb-0"
            // On /calendar/categories `view` holds "categories" (not in the
            // switcher options), so no segment highlights — matching the old shell.
            view={view as CalendarView}
            views={["day", "month", "year"]}
            label={token ?? currentLabel}
            todayLabel={currentLabel}
            // Render the controls as prefetched next/link anchors, and force a
            // FULL prefetch (prefetch) so the adjacent period + view targets are
            // fetched — data included — on mount. Paired with a short
            // staleTimes.dynamic in next.config, clicking a prefetched period is
            // instant (served from the client router cache, no server round-trip).
            linkComponent={Link}
            prefetch
            viewHref={viewHref}
            prevHref={prevHref ?? undefined}
            nextHref={nextHref ?? undefined}
            todayHref={todayHref}
          />
          {isAdmin && (
            <Link
              href="/calendar/categories"
              className={`text-sm underline-offset-4 hover:underline ${onCategories ? "text-white" : "text-white/60"}`}
            >
              categories
            </Link>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
