"use client";

import { useState, useEffect } from "react";
import * as motion from "motion/react-client";
import type { CalendarTask, CalendarActual } from "@/lib/calendar";
import type { CalendarCategory } from "@/lib/calendar-categories";
import type { PrayerTimes } from "@/lib/prayer-times";
import { clampActualToDay } from "./date-utils";
import PrayerTimeMarker from "./PrayerTimeMarker";
import TaskEditor from "./TaskEditor";
import PlanBlock from "./PlanBlock";
import ActualBlock from "./ActualBlock";
import ActualsEditor from "./ActualsEditor";
import PlannedTodaySheet from "./PlannedTodaySheet";
import NowPlayingBar from "./NowPlayingBar";

type Props = {
  date: string;
  tasks: CalendarTask[];
  actuals: CalendarActual[];
  runningActual: CalendarActual | null;
  categories: CalendarCategory[];
  prayers: PrayerTimes | null;
  isAdmin: boolean;
  today: string;
  timezone: string;
};

function useNowMinutes(enabled: boolean, timezone: string) {
  const [minutes, setMinutes] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).formatToParts(new Date());
      const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
      const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
      setMinutes(h * 60 + m);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [enabled, timezone]);
  return minutes;
}

function HourGrid() {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <>
      {hours.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-white/5 flex items-start pl-2"
          style={{ top: `${(h / 24) * 100}%`, height: `${100 / 24}%` }}
        >
          <span className="font-mono text-[10px] text-white/40 mt-[-6px]">
            {String(h).padStart(2, "0")}:00
          </span>
        </div>
      ))}
    </>
  );
}

function NowLine({ nowMinutes }: { nowMinutes: number }) {
  return (
    <div
      className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
      style={{ top: `${(nowMinutes / 1440) * 100}%` }}
    >
      <div className="size-2 rounded-full bg-red-500 -ml-1 shrink-0" />
      <div className="h-px flex-1 bg-red-500" />
    </div>
  );
}

export default function DayView({
  date,
  tasks,
  actuals,
  runningActual,
  prayers,
  isAdmin,
  today,
  timezone,
}: Props) {
  const [editing, setEditing] = useState<CalendarTask | "new" | null>(null);
  const [editingActual, setEditingActual] = useState<CalendarActual | null>(null);
  const nowMinutes = useNowMinutes(date === today, timezone);

  const timed = tasks.filter((t) => t.startTime);

  // Pre-compute renderable actuals (clamped to this day's [0,1440] window).
  const renderActuals = actuals
    .map((a) => {
      const w = clampActualToDay(date, a.startAt, a.endAt, timezone);
      return w ? { actual: a, ...w } : null;
    })
    .filter((x): x is { actual: CalendarActual; startMin: number; endMin: number } => x !== null);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_280px] pb-20 md:pb-0">
        {/* PLAN COLUMN — also hosts the mobile actuals overlay */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative border border-white/10 bg-white/[0.02] min-h-[960px]"
        >
          <div className="absolute inset-0">
            <HourGrid />
            {prayers && (
              <>
                <PrayerTimeMarker name="Fajr" time={prayers.Fajr} />
                <PrayerTimeMarker name="Dhuhr" time={prayers.Dhuhr} />
                <PrayerTimeMarker name="Asr" time={prayers.Asr} />
                <PrayerTimeMarker name="Maghrib" time={prayers.Maghrib} />
                <PrayerTimeMarker name="Isha" time={prayers.Isha} />
              </>
            )}
            {!prayers && (
              <div className="absolute top-2 right-2 text-[10px] text-white/40 font-mono uppercase tracking-widest">
                prayer times unavailable
              </div>
            )}
            {nowMinutes != null && <NowLine nowMinutes={nowMinutes} />}

            {/* Header / +add task — z-20 so it sits above the now-line (z-10) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setEditing("new")}
                className="absolute top-1 right-1 z-20 bg-black text-[10px] uppercase tracking-widest text-white/60 hover:text-white border border-white/20 px-2 py-0.5 hover:bg-white/5"
              >
                + task
              </button>
            )}

            {/* On md+ desktops the plan column is its own column — full-width plan blocks. */}
            <div className="hidden md:block absolute inset-0">
              {timed.map((task) => (
                <PlanBlock
                  key={task.id}
                  task={task}
                  onClick={() => isAdmin && setEditing(task)}
                />
              ))}
            </div>

            {/* On mobile, plan blocks render half-width on the left, actuals overlay on the right. */}
            <div className="md:hidden absolute inset-0">
              {timed.map((task) => (
                <PlanBlock
                  key={task.id}
                  task={task}
                  halfLeft
                  onClick={() => isAdmin && setEditing(task)}
                />
              ))}
              {renderActuals.map(({ actual, startMin, endMin }) => (
                <ActualBlock
                  key={actual.id}
                  actual={actual}
                  startMin={startMin}
                  endMin={endMin}
                  isRunning={actual.endAt === null}
                  halfRight
                  onClick={() => isAdmin && setEditingActual(actual)}
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* ACTUALS COLUMN — desktop only */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="hidden md:block relative border border-white/10 bg-white/[0.02] min-h-[960px]"
        >
          <div className="absolute inset-0">
            <HourGrid />
            {nowMinutes != null && <NowLine nowMinutes={nowMinutes} />}
            {renderActuals.map(({ actual, startMin, endMin }) => (
              <ActualBlock
                key={actual.id}
                actual={actual}
                startMin={startMin}
                endMin={endMin}
                isRunning={actual.endAt === null}
                onClick={() => isAdmin && setEditingActual(actual)}
              />
            ))}
            {renderActuals.length === 0 && (
              <div className="absolute top-2 right-2 text-[10px] text-white/40 font-mono uppercase tracking-widest">
                no actuals yet
              </div>
            )}
          </div>
        </motion.div>

        {/* SIDE PANEL — desktop only */}
        <motion.aside
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="hidden md:block"
        >
          {isAdmin ? (
            <PlannedTodaySheet
              date={date}
              tasks={tasks}
              runningActual={runningActual}
              onEditPlan={(t) => setEditing(t)}
            />
          ) : null}
        </motion.aside>
      </div>

      {/* MOBILE STICKY BAR — admin only */}
      {isAdmin && (
        <NowPlayingBar
          date={date}
          tasks={tasks}
          runningActual={runningActual}
          onEditPlan={(t) => setEditing(t)}
        />
      )}

      {/* Plan task editor modal (existing) */}
      {editing && (
        <TaskEditor
          key={editing === "new" ? "new" : editing.id}
          date={date}
          task={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Actuals editor modal (new) */}
      {editingActual && (
        <ActualsEditor
          actual={editingActual}
          onClose={() => setEditingActual(null)}
        />
      )}
    </>
  );
}
