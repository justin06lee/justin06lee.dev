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
    const [y, m] = token.split("-").map(Number);
    const prev = new Date(Date.UTC(y, m - 2, 1));
    return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return String(Number(token) - 1);
}

function nextToken(view: View, token: string | null): string | null {
  if (!token) return null;
  if (view === "day") return addDays(token, 1);
  if (view === "month") {
    const [y, m] = token.split("-").map(Number);
    const next = new Date(Date.UTC(y, m, 1));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return String(Number(token) + 1);
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
            // Render the controls as prefetched next/link anchors: Next prefetches
            // the adjacent period + the view targets on hover/mount, so switching
            // navigates from the client cache instead of a cold server round-trip.
            linkComponent={Link}
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
