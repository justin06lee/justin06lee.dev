"use client";

import { useState } from "react";
import type { CalendarTask } from "@/lib/calendar";
import { hhmmToMinutes } from "@/lib/calendar-dates";
import { categoryTintStyle } from "@/lib/colors";

type Props = {
  task: CalendarTask;
  onClick?: () => void;
  /** When true, renders as a half-width left-aligned block (mobile dual layout). */
  halfLeft?: boolean;
};

export default function PlanBlock({ task, onClick, halfLeft = false }: Props) {
  const [tipOpen, setTipOpen] = useState(false);
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
  const timeText = `${task.startTime}–${task.endTime ?? "?"}`;
  // `~` is the marker for an uncertain plan: approximate match, fallbacks
  // accepted. Reads cleanly inline without needing a separate badge slot.
  const uncertainMarker = task.isUncertain ? "~ " : "";
  const fullText = `${uncertainMarker}${timeText} ${titleText}${
    task.isUncertain && task.fallbacks.length > 0 ? ` (+${task.fallbacks.length} alt)` : ""
  }`;

  const handleClick = () => {
    if (onClick) onClick();
    else setTipOpen((t) => !t);
  };

  return (
    <button
      onClick={handleClick}
      aria-label={fullText}
      title={fullText}
      className={`group absolute border border-dashed text-left text-xs transition hover:bg-white/5 ${halfLeft ? "left-12 right-1/2 mr-0.5" : "left-12 right-2"}`}
      style={{ top: `${top}%`, height: `${height}%`, ...tint, ...borderStyle }}
    >
      <div className="absolute inset-0 overflow-hidden px-1 py-0.5 flex items-center gap-1 min-w-0">
        {task.isUncertain && (
          <span
            aria-hidden="true"
            title="uncertain — fallbacks accepted"
            className="font-mono text-[10px] opacity-70 shrink-0"
          >
            ~
          </span>
        )}
        <span className="font-mono text-[10px] opacity-70 shrink-0">{timeText}</span>
        <span className="truncate">{titleText}</span>
      </div>
      <span
        className={`absolute z-30 left-0 top-full mt-1 px-2 py-1 bg-black border border-white/30 text-white text-xs whitespace-normal max-w-[260px] shadow-lg pointer-events-none transition-opacity ${
          tipOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {fullText}
      </span>
    </button>
  );
}
