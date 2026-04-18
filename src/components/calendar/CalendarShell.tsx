"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { addDays } from "./date-utils";

type View = "day" | "month" | "year";

function parsePath(pathname: string): { view: View; token: string | null } {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "calendar") return { view: "day", token: null };
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
  children,
}: {
  today: string;
  todayMonth: string;
  todayYear: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
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

  return (
    <div className="min-h-screen bg-black text-white pt-16 pb-16 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3 mb-6">
          <div className="flex items-center gap-4 text-sm">
            <Link href={dayHref(today)} className={`underline-offset-4 hover:underline ${view === "day" ? "text-white" : "text-white/60"}`}>day</Link>
            <Link href={monthHref(todayMonth)} className={`underline-offset-4 hover:underline ${view === "month" ? "text-white" : "text-white/60"}`}>month</Link>
            <Link href={yearHref(todayYear)} className={`underline-offset-4 hover:underline ${view === "year" ? "text-white" : "text-white/60"}`}>year</Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href={prevHref} className="text-white/60 hover:text-white">‹</Link>
            <Link href={todayHref} className="text-white/60 hover:text-white underline-offset-4 hover:underline">today</Link>
            <Link href={nextHref} className="text-white/60 hover:text-white">›</Link>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
