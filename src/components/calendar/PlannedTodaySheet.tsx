"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CalendarTask, CalendarActual } from "@/lib/calendar";
import type { CalendarCategory } from "@/lib/calendar-categories";
import AdHocActualForm from "./AdHocActualForm";
import { epochToHHMMInTz, clampActualToDay } from "@/lib/calendar-dates";
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

export default function PlannedTodaySheet({ date, tasks, actuals, categories, timezone, onEditPlan, onEditActual }: Props) {
  const router = useRouter();
  const dialog = useDialog();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  // router.refresh() is async; a bare call clears `busy` while props are still
  // stale, so a second click could fire a duplicate start. Keep the controls
  // disabled through the transition until the refreshed data lands.
  const [isPending, startTransition] = useTransition();
  const locked = busy || isPending;

  // Lanes mean several actuals can be open at once. The lowest lane is the
  // primary one this sheet's summary and stop button act on; sleep is matched
  // across every lane so it's still detected when it isn't the primary.
  const runningActuals = actuals
    .filter((a) => a.endAt === null)
    .sort((a, b) => a.track - b.track);
  const runningActual = runningActuals[0] ?? null;
  const sleepingActual =
    runningActuals.find((a) => a.categoryId === SLEEP_CATEGORY_ID) ?? null;
  const isSleeping = sleepingActual !== null;

  // Only timed plans for the day; dedupe by category+title to keep the list clean.
  const timed = tasks.filter((t) => t.date === date && t.startTime);
  const seen = new Set<string>();
  const uniqueTimed = timed.filter((t) => {
    const key = `${t.categoryId ?? ""}|${t.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const untimed = tasks.filter((t) => t.date === date && !t.startTime);

  // Include yesterday-anchored blocks that clamp into this day (e.g. a sleep
  // 23:30→07:00 that renders on day 2), not just those whose start date equals
  // `date` — the log is the only edit affordance for cross-midnight actuals.
  // The predicate is an OR over a single pass, so each actual appears once.
  const todayActuals = actuals
    .filter((a) => a.date === date || clampActualToDay(date, a.startAt, a.endAt, timezone) !== null)
    .sort((a, b) => a.startAt - b.startAt);

  async function reportFailure(label: string, r: Response) {
    const body = await r.json().catch(() => ({}));
    await dialog.alert({ title: label, message: body.error ?? `HTTP ${r.status}` });
  }

  async function startFromPlan(planId: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/calendar/actuals/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId }),
      });
      if (!r.ok) {
        await reportFailure("failed to start", r);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      // Stop by id so this closes the entry the sheet is actually showing,
      // rather than whichever lane the server would pick as primary.
      const r = await fetch("/api/calendar/actuals/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(runningActual ? { id: runningActual.id } : {}),
      });
      if (!r.ok) {
        await reportFailure("failed to stop", r);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function toggleSleep() {
    setBusy(true);
    try {
      // Sleep may not be the primary lane, so wake the sleep row by id.
      const r = isSleeping
        ? await fetch("/api/calendar/actuals/stop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(sleepingActual ? { id: sleepingActual.id } : {}),
          })
        : await fetch("/api/calendar/actuals/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ categoryId: SLEEP_CATEGORY_ID }),
          });
      if (!r.ok) {
        await reportFailure(isSleeping ? "failed to wake up" : "failed to start sleep", r);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <section>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40 mb-2">now playing</div>
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
              disabled={locked}
              className="text-xs border border-white/30 hover:bg-white/10 px-2 py-1 disabled:opacity-40"
            >
              stop
            </button>
          </div>
        ) : (
          <div className="text-xs text-white/40">nothing running</div>
        )}
      </section>

      <section>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40 mb-2">sleep</div>
        <button
          type="button"
          onClick={toggleSleep}
          disabled={locked}
          className="w-full text-left border border-white/20 hover:bg-white/10 px-3 py-2 text-sm disabled:opacity-40"
        >
          {isSleeping ? "wake up" : "sleep"}
        </button>
      </section>

      <section>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40 mb-2">planned today</div>
        {uniqueTimed.length === 0 && (
          <div className="text-xs text-white/40">no timed plans for this day</div>
        )}
        <div className="space-y-1">
          {uniqueTimed.map((t) => {
            const isLive = runningActual?.planId === t.id;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => isLive ? stop() : startFromPlan(t.id)}
                disabled={locked}
                className={`w-full flex items-center justify-between border px-3 py-2 text-left disabled:opacity-40 ${isLive ? "border-white/60 bg-white/10" : "border-white/15 hover:bg-white/5"}`}
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
                <span className="text-[10px] text-white/50 shrink-0">{isLive ? "stop" : "start"}</span>
              </button>
            );
          })}
        </div>
      </section>

      {untimed.length > 0 && (
        <section>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40 mb-2">untimed</div>
          <div className="space-y-1">
            {untimed.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => onEditPlan?.(t)}
                disabled={!onEditPlan}
                className="w-full flex items-center justify-between border border-white/15 hover:bg-white/5 px-3 py-2 text-left disabled:cursor-default disabled:opacity-60"
              >
                <span className="flex items-center gap-2 truncate">
                  {t.category && (
                    <span
                      className="h-2 w-2 inline-block border border-white/30 shrink-0"
                      style={{ backgroundColor: t.category.color }}
                    />
                  )}
                  <span className={`truncate ${t.done ? "text-white/40 line-through" : ""}`}>
                    {t.category ? `${t.category.name} — ${t.title}` : t.title}
                  </span>
                </span>
                {onEditPlan && <span className="text-[10px] text-white/50 shrink-0">edit</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40 mb-2">activity log</div>
        {todayActuals.length === 0 ? (
          <div className="text-xs text-white/40">nothing logged yet</div>
        ) : (
          <div className="space-y-1">
            {todayActuals.map((a) => {
              const start = epochToHHMMInTz(a.startAt, timezone);
              const end = a.endAt ? epochToHHMMInTz(a.endAt, timezone) : "...";
              const label = a.category
                ? `${a.category.name}${a.title ? ` — ${a.title}` : ""}`
                : a.title ?? "(untitled)";
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => onEditActual?.(a)}
                  disabled={!onEditActual}
                  className="w-full flex items-center gap-2 border border-white/15 hover:bg-white/5 px-3 py-2 text-left disabled:cursor-default disabled:opacity-60"
                >
                  <span className="font-mono text-[10px] text-white/50 shrink-0 tabular-nums">{start}–{end}</span>
                  <span className="flex items-center gap-2 truncate flex-1 min-w-0">
                    {a.category && (
                      <span
                        className="h-2 w-2 inline-block border border-white/30 shrink-0"
                        style={{ backgroundColor: a.category.color }}
                      />
                    )}
                    <span className="truncate">{label}</span>
                  </span>
                  {onEditActual && <span className="text-[10px] text-white/50 shrink-0">edit</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section>
        {creating ? (
          <AdHocActualForm
            categories={categories}
            timezone={timezone}
            onStarted={() => setCreating(false)}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full text-left border border-dashed border-white/20 hover:bg-white/5 px-3 py-2 text-sm text-white/70"
          >
            + new activity
          </button>
        )}
      </section>
    </div>
  );
}
