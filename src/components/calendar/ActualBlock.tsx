"use client";

import type { CalendarActual } from "@/lib/calendar";
import { categoryTintStyle } from "@/lib/colors";

type Props = {
  actual: CalendarActual;
  startMin: number;
  endMin: number;
  isRunning: boolean;
  onClick?: () => void;
  /** When true, renders as a half-width right-aligned block (mobile dual layout). */
  halfRight?: boolean;
};

export default function ActualBlock({ actual, startMin, endMin, isRunning, onClick, halfRight = false }: Props) {
  const top = (startMin / 1440) * 100;
  const height = Math.max(((endMin - startMin) / 1440) * 100, 0.8);

  const tint = categoryTintStyle(actual.category?.color, 0.45);
  const labelParts: string[] = [];
  if (actual.category) labelParts.push(actual.category.name);
  if (actual.title) labelParts.push(actual.title);
  const label = labelParts.length > 0 ? labelParts.join(" — ") : "(untitled)";

  const formatHM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  return (
    <button
      onClick={onClick}
      className={`group absolute border text-left text-xs px-1 py-0.5 transition hover:brightness-125 ${halfRight ? "left-1/2 right-1 ml-0.5" : "left-12 right-2"} ${isRunning ? "animate-pulse" : ""}`}
      style={{ top: `${top}%`, height: `${height}%`, ...tint }}
    >
      <span className="font-mono text-[10px] opacity-70">
        {formatHM(startMin)}–{endMin === 1440 ? "..." : formatHM(endMin)}
      </span>{" "}
      {label}
    </button>
  );
}
