"use client";

import type { CalendarTask } from "@/lib/calendar";
import { hhmmToMinutes } from "./date-utils";
import { categoryTintStyle } from "@/lib/colors";

type Props = {
  task: CalendarTask;
  onClick?: () => void;
  /** When true, renders as a half-width left-aligned block (mobile dual layout). */
  halfLeft?: boolean;
};

export default function PlanBlock({ task, onClick, halfLeft = false }: Props) {
  const start = hhmmToMinutes(task.startTime);
  if (start === null) return null;
  const end = hhmmToMinutes(task.endTime) ?? start + 30;
  const top = (start / 1440) * 100;
  const height = Math.max(((end - start) / 1440) * 100, 0.8);

  const tint = categoryTintStyle(task.category?.color, 0.10);
  const borderStyle = task.category?.color
    ? { borderColor: task.category.color, color: "#e5e5e5" }
    : { borderColor: "rgba(255,255,255,0.4)", color: "rgba(255,255,255,0.85)" };

  const titleText = task.category
    ? `${task.category.name} — ${task.title}`
    : task.title;

  return (
    <button
      onClick={onClick}
      className={`group absolute border border-dashed text-left text-xs px-1 py-0.5 transition hover:bg-white/5 ${halfLeft ? "left-12 right-1/2 mr-0.5" : "left-12 right-2"}`}
      style={{ top: `${top}%`, height: `${height}%`, ...tint, ...borderStyle }}
    >
      <span className="font-mono text-[10px] opacity-70">
        {task.startTime}–{task.endTime ?? "?"}
      </span>{" "}
      {titleText}
    </button>
  );
}
