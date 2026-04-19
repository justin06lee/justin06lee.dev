"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarTask } from "@/lib/calendar";
import type { PrayerTimes } from "@/lib/prayer-times";
import { hhmmToMinutes } from "./date-utils";
import PrayerTimeMarker from "./PrayerTimeMarker";
import TaskEditor from "./TaskEditor";

type Props = {
  date: string;
  tasks: CalendarTask[];
  prayers: PrayerTimes | null;
  isAdmin: boolean;
};

function TimedBlock({
  task,
  onClick,
}: {
  task: CalendarTask;
  onClick: () => void;
}) {
  const start = hhmmToMinutes(task.startTime);
  const end = hhmmToMinutes(task.endTime) ?? (start !== null ? start + 30 : null);
  if (start == null || end == null) return null;
  const top = (start / 1440) * 100;
  const height = Math.max(((end - start) / 1440) * 100, 0.8);
  return (
    <button
      onClick={onClick}
      className={`absolute left-14 right-32 border px-2 py-1 text-left text-xs overflow-hidden transition ${
        task.done ? "bg-white/15 border-white/30 line-through text-white/60" : "bg-white/5 border-white/30 hover:bg-white/10"
      }`}
      style={{ top: `${top}%`, height: `${height}%` }}
    >
      <span className="font-mono">{task.startTime}–{task.endTime ?? "?"}</span> {task.title}
    </button>
  );
}

export default function DayView({ date, tasks, prayers, isAdmin }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<CalendarTask | "new" | null>(null);

  const timed = tasks.filter((t) => t.startTime);
  const untimed = tasks.filter((t) => !t.startTime);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const toggleDone = async (task: CalendarTask) => {
    await fetch(`/api/calendar/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    });
    router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="relative border border-white/10 bg-white/[0.02] min-h-[960px]">
        <div className="absolute inset-0">
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

          {timed.map((task) => (
            <TimedBlock key={task.id} task={task} onClick={() => isAdmin && setEditing(task)} />
          ))}
        </div>
      </div>

      <aside className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-mono uppercase tracking-widest text-xs text-white/60">checklist</span>
          {isAdmin && (
            <button onClick={() => setEditing("new")} className="text-xs underline-offset-4 hover:underline text-white/80">+ add</button>
          )}
        </div>
        {untimed.length === 0 && (
          <div className="text-xs text-white/40">no untimed tasks</div>
        )}
        {untimed.map((task) => (
          <div key={task.id} className="flex items-start gap-2 border border-white/10 p-2">
            <button
              onClick={() => isAdmin && toggleDone(task)}
              disabled={!isAdmin}
              className={`size-4 border shrink-0 mt-0.5 ${task.done ? "bg-white border-white" : "border-white/40"} ${isAdmin ? "cursor-pointer" : "cursor-default"}`}
              aria-label={task.done ? "mark not done" : "mark done"}
            />
            <div className="flex-1 min-w-0">
              <div className={`text-sm ${task.done ? "line-through text-white/50" : "text-white"}`}>{task.title}</div>
              {task.notes && <div className="text-xs text-white/50 mt-1">{task.notes}</div>}
            </div>
            {isAdmin && (
              <button onClick={() => setEditing(task)} className="text-xs text-white/50 hover:text-white">edit</button>
            )}
          </div>
        ))}
      </aside>

      {editing && (
        <TaskEditor
          key={editing === "new" ? "new" : editing.id}
          date={date}
          task={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
