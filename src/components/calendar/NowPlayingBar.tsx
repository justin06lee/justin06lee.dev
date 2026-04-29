"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CalendarActual, CalendarTask } from "@/lib/calendar";
import type { CalendarCategory } from "@/lib/calendar-categories";
import PlannedTodaySheet from "./PlannedTodaySheet";
import { useDialog } from "@/components/Dialog";
import { SLEEP_CATEGORY_ID } from "@/lib/calendar-constants";

type Props = {
  date: string;
  tasks: CalendarTask[];
  actuals: CalendarActual[];
  categories: CalendarCategory[];
  timezone: string;
  onEditPlan?: (task: CalendarTask) => void;
  onEditActual?: (actual: CalendarActual) => void;
};

function formatElapsed(startAt: number, now: number): string {
  const totalSec = Math.max(0, Math.floor((now - startAt) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function NowPlayingBar({ date, tasks, actuals, categories, timezone, onEditPlan, onEditActual }: Props) {
  const router = useRouter();
  const dialog = useDialog();
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const [busy, setBusy] = useState(false);

  const runningActual = actuals.find((a) => a.endAt === null) ?? null;
  const isSleeping = runningActual?.categoryId === SLEEP_CATEGORY_ID;

  // Tick every second while a row is running.
  useEffect(() => {
    if (!runningActual) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [runningActual]);

  async function toggleSleep() {
    setBusy(true);
    try {
      const r = isSleeping
        ? await fetch("/api/calendar/actuals/stop", { method: "POST", credentials: "include" })
        : await fetch("/api/calendar/actuals/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ categoryId: SLEEP_CATEGORY_ID }),
          });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        await dialog.alert({
          title: isSleeping ? "Failed to wake up" : "Failed to start sleep",
          message: body.error ?? `HTTP ${r.status}`,
        });
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {expanded && (
        <div
          className="fixed inset-0 z-30 bg-black/70 md:hidden"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Planner sheet"
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-black border-t border-white/20 p-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <PlannedTodaySheet
              date={date}
              tasks={tasks}
              actuals={actuals}
              categories={categories}
              timezone={timezone}
              onEditPlan={(t) => {
                setExpanded(false);
                onEditPlan?.(t);
              }}
              onEditActual={(a) => {
                setExpanded(false);
                onEditActual?.(a);
              }}
            />
          </div>
        </div>
      )}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/20 bg-black md:hidden">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex flex-col items-start text-left flex-1 min-w-0 mr-2"
          >
            <span className="text-[10px] uppercase tracking-wider text-white/50">Now playing</span>
            {runningActual ? (
              <span className="truncate text-sm text-white">
                {runningActual.category ? `${runningActual.category.name} — ` : ""}
                {runningActual.title ?? "(untitled)"} · {formatElapsed(runningActual.startAt, now)}
              </span>
            ) : (
              <span className="truncate text-sm text-white/50">Nothing running · tap to start</span>
            )}
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleSleep}
              disabled={busy}
              className="text-xs border border-white/30 hover:bg-white/10 px-2 py-1 disabled:opacity-40"
            >
              {isSleeping ? "Wake up" : "Sleep"}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-xs border border-white/30 hover:bg-white/10 px-2 py-1"
              aria-label="Open planner sheet"
            >
              Open
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
