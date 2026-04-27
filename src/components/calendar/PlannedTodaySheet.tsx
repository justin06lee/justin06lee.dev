"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarTask, CalendarActual } from "@/lib/calendar";
import AdHocActualForm from "./AdHocActualForm";

type Props = {
  date: string;
  tasks: CalendarTask[];
  runningActual: CalendarActual | null;
};

export default function PlannedTodaySheet({ date, tasks, runningActual }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  // Only timed plans for the day; dedupe by category+title to keep the list clean.
  const timed = tasks.filter((t) => t.date === date && t.startTime);
  const seen = new Set<string>();
  const uniqueTimed = timed.filter((t) => {
    const key = `${t.categoryId ?? ""}|${t.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  async function startFromPlan(planId: string) {
    setBusy(true);
    await fetch("/api/calendar/actuals/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ planId }),
    });
    setBusy(false);
    router.refresh();
  }

  async function stop() {
    setBusy(true);
    await fetch("/api/calendar/actuals/stop", { method: "POST", credentials: "include" });
    setBusy(false);
    router.refresh();
  }

  async function toggleSleep() {
    setBusy(true);
    if (runningActual && runningActual.category?.name.toLowerCase() === "sleep") {
      await fetch("/api/calendar/actuals/stop", { method: "POST", credentials: "include" });
    } else {
      const r = await fetch("/api/calendar/categories", { credentials: "include" });
      const cats = (await r.json()) as { id: string; name: string }[];
      const sleep = cats.find((c) => c.name.toLowerCase() === "sleep");
      if (sleep) {
        await fetch("/api/calendar/actuals/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ categoryId: sleep.id }),
        });
      }
    }
    setBusy(false);
    router.refresh();
  }

  const isSleeping = runningActual?.category?.name.toLowerCase() === "sleep";

  return (
    <div className="space-y-4 text-sm">
      <section>
        <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Now playing</div>
        {runningActual ? (
          <div className="flex items-center justify-between border border-white/20 bg-white/5 px-3 py-2">
            <div>
              <div className="text-white/90">
                {runningActual.category ? `${runningActual.category.name} — ` : ""}
                {runningActual.title ?? "(untitled)"}
              </div>
              <div className="text-[10px] text-white/40">running</div>
            </div>
            <button
              type="button"
              onClick={stop}
              disabled={busy}
              className="text-xs border border-white/30 hover:bg-white/10 px-2 py-1"
            >
              Stop
            </button>
          </div>
        ) : (
          <div className="text-xs text-white/40">Nothing running</div>
        )}
      </section>

      <section>
        <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Sleep</div>
        <button
          type="button"
          onClick={toggleSleep}
          disabled={busy}
          className="w-full text-left border border-white/20 hover:bg-white/10 px-3 py-2 text-sm"
        >
          {isSleeping ? "Wake up" : "Sleep"}
        </button>
      </section>

      <section>
        <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Planned today</div>
        {uniqueTimed.length === 0 && (
          <div className="text-xs text-white/40">No timed plans for this day</div>
        )}
        <div className="space-y-1">
          {uniqueTimed.map((t) => {
            const isLive = runningActual?.planId === t.id;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => isLive ? stop() : startFromPlan(t.id)}
                disabled={busy}
                className={`w-full flex items-center justify-between border px-3 py-2 text-left ${isLive ? "border-white/60 bg-white/10" : "border-white/15 hover:bg-white/5"}`}
              >
                <span className="flex items-center gap-2 truncate">
                  {t.category && (
                    <span
                      className="h-2 w-2 inline-block border border-white/30 shrink-0"
                      style={{ backgroundColor: t.category.color }}
                    />
                  )}
                  <span className="truncate">
                    {t.category ? `${t.category.name} — ${t.title}` : t.title}
                  </span>
                </span>
                <span className="text-[10px] text-white/50 shrink-0">{isLive ? "Stop" : "Start"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        {creating ? (
          <AdHocActualForm
            onStarted={() => setCreating(false)}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full text-left border border-dashed border-white/20 hover:bg-white/5 px-3 py-2 text-sm text-white/70"
          >
            + New activity
          </button>
        )}
      </section>
    </div>
  );
}
