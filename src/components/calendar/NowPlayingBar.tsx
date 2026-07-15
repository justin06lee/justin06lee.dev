"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarActual, CalendarTask } from "@/lib/calendar";
import type { CalendarCategory } from "@/lib/calendar-categories";
import PlannedTodaySheet from "./PlannedTodaySheet";
import { useDialog } from "@/components/Dialog";
import { SLEEP_CATEGORY_ID } from "@/lib/calendar-constants";
import { NowPlayingBar as ChromeNowPlayingBar } from "@/components/chrome/now-playing-bar";
import { Sheet } from "@/components/chrome/sheet";
import { Button } from "@/components/chrome/button";

type Props = {
  date: string;
  tasks: CalendarTask[];
  actuals: CalendarActual[];
  categories: CalendarCategory[];
  timezone: string;
  onEditPlan?: (task: CalendarTask) => void;
  onEditActual?: (actual: CalendarActual) => void;
};

export default function NowPlayingBar({ date, tasks, actuals, categories, timezone, onEditPlan, onEditActual }: Props) {
  const router = useRouter();
  const dialog = useDialog();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const runningActual = actuals.find((a) => a.endAt === null) ?? null;
  const isSleeping = runningActual?.categoryId === SLEEP_CATEGORY_ID;

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

  const runningTitle = runningActual
    ? `${runningActual.category ? `${runningActual.category.name} — ` : ""}${runningActual.title ?? "(untitled)"}`
    : "";

  return (
    <>
      <Sheet
        open={expanded}
        onClose={() => setExpanded(false)}
        side="bottom"
        ariaLabel="Planner sheet"
        className="h-[80vh]"
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
      </Sheet>
      <ChromeNowPlayingBar
        className="md:hidden"
        title={runningTitle}
        startedAt={runningActual ? runningActual.startAt : undefined}
        onClick={() => setExpanded(true)}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={toggleSleep} disabled={busy} className="px-2 py-1 text-xs">
              {isSleeping ? "Wake up" : "Sleep"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setExpanded(true)} label="Open planner sheet" className="px-2 py-1 text-xs">
              Open
            </Button>
          </>
        }
      />
    </>
  );
}
