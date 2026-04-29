"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarCategory } from "@/lib/calendar-categories";
import CategoryPicker from "./CategoryPicker";
import { epochToLocalInput, localInputToEpoch } from "@/lib/calendar-dates";

type Props = {
  categories?: CalendarCategory[];
  timezone: string;
  onStarted: () => void;
  onCancel: () => void;
};

export default function AdHocActualForm({ categories, timezone, onStarted, onCancel }: Props) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"now" | "backfill">("now");
  const [startInput, setStartInput] = useState(() => epochToLocalInput(Date.now() - 60 * 60 * 1000, timezone));
  const [endInput, setEndInput] = useState(() => epochToLocalInput(Date.now(), timezone));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "now") {
        const r = await fetch("/api/calendar/actuals/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ categoryId, title: title.trim() || null }),
        });
        if (!r.ok) {
          setError("Failed to start");
          return;
        }
      } else {
        const startAt = localInputToEpoch(startInput, timezone);
        const endAt = localInputToEpoch(endInput, timezone);
        if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
          setError("Invalid time");
          return;
        }
        if (startAt >= endAt) {
          setError("Start must be before end");
          return;
        }
        const r = await fetch("/api/calendar/actuals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ startAt, endAt, categoryId, title: title.trim() || null }),
        });
        if (!r.ok) {
          const errBody = await r.json().catch(() => ({}));
          setError(errBody.error ?? "Failed to add");
          return;
        }
      }
      onStarted();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      className="border border-white/20 p-3 space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-white/60">
          {mode === "now" ? "New activity" : "Backfill activity"}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("now")}
            className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 ${
              mode === "now" ? "border border-white/40 text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            Now
          </button>
          <button
            type="button"
            onClick={() => setMode("backfill")}
            className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 ${
              mode === "backfill" ? "border border-white/40 text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            Backfill
          </button>
        </div>
      </div>
      <CategoryPicker selectedId={categoryId} onChange={setCategoryId} categories={categories} />
      <input
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-transparent border border-white/20 px-2 py-1 text-sm focus:border-white/60 outline-none"
      />
      {mode === "backfill" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-white/60">Start</label>
            <input
              type="datetime-local"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              className="w-full bg-transparent border border-white/20 px-2 py-1 text-sm focus:border-white/60 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/60">End</label>
            <input
              type="datetime-local"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              className="w-full bg-transparent border border-white/20 px-2 py-1 text-sm focus:border-white/60 outline-none"
            />
          </div>
        </div>
      )}
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-white/60 hover:text-white px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="text-xs border border-white/30 hover:bg-white/10 disabled:opacity-40 px-2 py-1"
        >
          {submitting ? "Saving..." : mode === "now" ? "Start" : "Add"}
        </button>
      </div>
    </form>
  );
}
