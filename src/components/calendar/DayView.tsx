"use client";

import { useState, useEffect, type ReactNode } from "react";
import * as motion from "motion/react-client";
import type { CalendarTask, CalendarActual } from "@/lib/calendar";
import type { CalendarCategory } from "@/lib/calendar-categories";
import { clampActualToDay, epochToMinutesOfDay } from "@/lib/calendar-dates";
import TaskEditor from "./TaskEditor";
import PlanBlock from "./PlanBlock";
import ActualBlock from "./ActualBlock";
import ActualsEditor from "./ActualsEditor";
import PlannedTodaySheet from "./PlannedTodaySheet";
import NowPlayingBar from "./NowPlayingBar";
import { Timeline } from "@/components/chrome/timeline";

type Props = {
  date: string;
  tasks: CalendarTask[];
  actuals: CalendarActual[];
  categories: CalendarCategory[];
  /** Server-rendered prayer markers, suspended by the page route. */
  prayersSlot: ReactNode;
  isAdmin: boolean;
  today: string;
  timezone: string;
};

function useNowMinutes(enabled: boolean, timezone: string) {
  const [minutes, setMinutes] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setMinutes(epochToMinutesOfDay(Date.now(), timezone));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [enabled, timezone]);
  return minutes;
}

export default function DayView({
  date,
  tasks,
  actuals,
  categories,
  prayersSlot,
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
      <div
        className={`grid gap-4 pb-20 md:pb-0 ${
          isAdmin ? "md:grid-cols-[1fr_1fr_280px]" : "md:grid-cols-2"
        }`}
      >
        {/* PLAN COLUMN — also hosts the mobile actuals overlay */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative min-h-[960px]"
        >
          {/* chrome Timeline draws the static track: border, hour grid, the
              live now-line, and the streamed prayer markers (via markersSlot).
              Interactive plan/actual blocks overlay it below — Timeline blocks
              aren't clickable, so they stay bespoke. nowMinutes is driven by
              our tz-aware clock (not Timeline's browser-local one). */}
          <Timeline
            events={[]}
            nowMinutes={nowMinutes ?? undefined}
            markersSlot={prayersSlot}
            className="absolute inset-0"
          />
          <div className="absolute inset-0">
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
                  onClick={isAdmin ? () => setEditing(task) : undefined}
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
                  onClick={isAdmin ? () => setEditing(task) : undefined}
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
          className="hidden md:block relative min-h-[960px]"
        >
          <Timeline events={[]} nowMinutes={nowMinutes ?? undefined} className="absolute inset-0" />
          <div className="absolute inset-0">
            {renderActuals.map(({ actual, startMin, endMin }) => (
              <ActualBlock
                key={actual.id}
                actual={actual}
                startMin={startMin}
                endMin={endMin}
                isRunning={actual.endAt === null}
              />
            ))}
            {renderActuals.length === 0 && (
              <div className="absolute top-2 right-2 text-[10px] text-white/40 font-mono uppercase tracking-widest">
                no actuals yet
              </div>
            )}
          </div>
        </motion.div>

        {/* SIDE PANEL — desktop, admin only */}
        {isAdmin && (
          <motion.aside
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="hidden md:block"
          >
            <PlannedTodaySheet
              date={date}
              tasks={tasks}
              actuals={actuals}
              categories={categories}
              timezone={timezone}
              onEditPlan={(t) => setEditing(t)}
              onEditActual={(a) => setEditingActual(a)}
            />
          </motion.aside>
        )}
      </div>

      {/* MOBILE STICKY BAR — admin only */}
      {isAdmin && (
        <NowPlayingBar
          date={date}
          tasks={tasks}
          actuals={actuals}
          categories={categories}
          timezone={timezone}
          onEditPlan={(t) => setEditing(t)}
          onEditActual={(a) => setEditingActual(a)}
        />
      )}

      {/* Plan task editor modal */}
      {editing && (
        <TaskEditor
          key={editing === "new" ? "new" : editing.id}
          date={date}
          task={editing === "new" ? undefined : editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Actuals editor — opened from the sidebar/log, not from clicking blocks */}
      {editingActual && (
        <ActualsEditor
          actual={editingActual}
          categories={categories}
          timezone={timezone}
          onClose={() => setEditingActual(null)}
        />
      )}
    </>
  );
}
