"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { addDays } from "@/lib/calendar-dates";

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
    view === "year" && prev ? yearHref(prev) : "#";
  const nextHref =
    view === "day" && next ? dayHref(next) :
    view === "month" && next ? monthHref(next) :
    view === "year" && next ? yearHref(next) : "#";
  const todayHref = view === "month" ? monthHref(todayMonth) : view === "year" ? yearHref(todayYear) : dayHref(today);
  const currentToken =
    view === "day" ? today :
    view === "month" ? todayMonth :
    todayYear;
  const isOnCurrent = token === currentToken;
  const currentLabel = view === "month" ? "this month" : view === "year" ? "this year" : "today";
  const middleLabel = isOnCurrent ? currentLabel : (token ?? currentLabel);

  return (
    <div className="min-h-screen bg-black text-white pt-16 pb-16 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3 mb-6">
          <div className="flex items-center gap-4 text-sm">
            <Link href={dayHref(today)} className={`underline-offset-4 hover:underline ${view === "day" && !onCategories ? "text-white" : "text-white/60"}`}>day</Link>
            <Link href={monthHref(todayMonth)} className={`underline-offset-4 hover:underline ${view === "month" && !onCategories ? "text-white" : "text-white/60"}`}>month</Link>
            <Link href={yearHref(todayYear)} className={`underline-offset-4 hover:underline ${view === "year" && !onCategories ? "text-white" : "text-white/60"}`}>year</Link>
            {isAdmin && (
              <Link
                href="/calendar/categories"
                className={`underline-offset-4 hover:underline ml-2 pl-4 border-l border-white/10 ${onCategories ? "text-white" : "text-white/60"}`}
              >
                categories
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href={prevHref} aria-label="Previous" className="text-white/60 hover:text-white">‹</Link>
            <Link href={todayHref} title={isOnCurrent ? currentLabel : `jump to ${currentLabel}`} className="text-white/60 hover:text-white underline-offset-4 hover:underline font-mono tabular-nums">{middleLabel}</Link>
            <Link href={nextHref} aria-label="Next" className="text-white/60 hover:text-white">›</Link>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
