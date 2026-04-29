"use client";

import { useState } from "react";
import type { CalendarActual } from "@/lib/calendar";
import { categoryTintStyle } from "@/lib/colors";
import { minutesToHHMM } from "@/lib/calendar-dates";

type Props = {
  actual: CalendarActual;
  startMin: number;
  endMin: number;
  isRunning: boolean;
  /** When true, renders as a half-width right-aligned block (mobile dual layout). */
  halfRight?: boolean;
};

export default function ActualBlock({ actual, startMin, endMin, isRunning, halfRight = false }: Props) {
  const [tipOpen, setTipOpen] = useState(false);
  const top = (startMin / 1440) * 100;
  const height = Math.max(((endMin - startMin) / 1440) * 100, 0.8);

  const tint = categoryTintStyle(actual.category?.color, 0.45);
  const labelParts: string[] = [];
  if (actual.category) labelParts.push(actual.category.name);
  if (actual.title) labelParts.push(actual.title);
  const label = labelParts.length > 0 ? labelParts.join(" — ") : "(untitled)";

  const timeText = `${minutesToHHMM(startMin)}–${endMin === 1440 ? "..." : minutesToHHMM(endMin)}`;
  const fullText = `${timeText} ${label}`;

  // Actuals are tooltip-only on the timeline; the sidebar/log is the edit
  // affordance. Every click here just toggles the tooltip.
  const handleClick = () => setTipOpen((t) => !t);

  return (
    <button
      onClick={handleClick}
      aria-label={fullText}
      title={fullText}
      className={`group absolute border text-left text-xs ${halfRight ? "left-1/2 right-1 ml-0.5" : "left-12 right-2"} ${isRunning ? "animate-pulse" : ""}`}
      style={{ top: `${top}%`, height: `${height}%`, ...tint }}
    >
      <div className="absolute inset-0 overflow-hidden px-1 py-0.5 flex items-center gap-1 min-w-0">
        <span className="font-mono text-[10px] opacity-70 shrink-0">{timeText}</span>
        <span className="truncate">{label}</span>
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
