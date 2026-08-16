"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarCategory } from "@/lib/calendar-categories";
import CategoryPicker from "./CategoryPicker";
import { epochToLocalInput, localInputToEpoch } from "@/lib/calendar-dates";
import { Input } from "@/components/chrome/input";
import { Button } from "@/components/chrome/button";
import { Segmented } from "@/components/chrome/segmented";

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
          setError("failed to start");
          return;
        }
      } else {
        const startAt = localInputToEpoch(startInput, timezone);
        const endAt = localInputToEpoch(endInput, timezone);
        if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
          setError("invalid time");
          return;
        }
        if (startAt >= endAt) {
          setError("start must be before end");
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
          setError(errBody.error ?? "failed to add");
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
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
          {mode === "now" ? "new activity" : "backfill activity"}
        </div>
        <Segmented<"now" | "backfill">
          size="compact"
          value={mode}
          onChange={setMode}
          options={[
            { value: "now", label: "now" },
            { value: "backfill", label: "backfill" },
          ]}
          ariaLabel="activity mode"
        />
      </div>
      <CategoryPicker selectedId={categoryId} onChange={setCategoryId} categories={categories} />
      <Input
        placeholder="title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full"
      />
      {mode === "backfill" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-white/60">start</label>
            <Input
              type="datetime-local"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/60">end</label>
            <Input
              type="datetime-local"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      )}
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="flex justify-end gap-2">
        <Button variant="link" size="sm" onClick={onCancel} className="text-white/60 hover:text-white">
          cancel
        </Button>
        <Button type="submit" variant="outline" size="sm" disabled={submitting}>
          {submitting ? "saving…" : mode === "now" ? "start" : "add"}
        </Button>
      </div>
    </form>
  );
}
