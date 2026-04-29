"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarActual } from "@/lib/calendar";
import type { CalendarCategory } from "@/lib/calendar-categories";
import CategoryPicker from "./CategoryPicker";
import { useDialog } from "@/components/Dialog";
import { epochToLocalInput, localInputToEpoch } from "@/lib/calendar-dates";

type Props = {
  actual: CalendarActual;
  categories?: CalendarCategory[];
  timezone: string;
  onClose: () => void;
};

export default function ActualsEditor({ actual, categories, timezone, onClose }: Props) {
  const router = useRouter();
  const dialog = useDialog();
  const [categoryId, setCategoryId] = useState<string | null>(actual.categoryId);
  const [title, setTitle] = useState<string>(actual.title ?? "");
  const [startInput, setStartInput] = useState<string>(epochToLocalInput(actual.startAt, timezone));
  const [endInput, setEndInput] = useState<string>(actual.endAt ? epochToLocalInput(actual.endAt, timezone) : "");
  const [stillRunning, setStillRunning] = useState<boolean>(actual.endAt === null);
  const [notes, setNotes] = useState<string>(actual.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    const body: Record<string, unknown> = {
      categoryId,
      title: title.trim() || null,
      startAt: localInputToEpoch(startInput, timezone),
      endAt: stillRunning ? null : localInputToEpoch(endInput, timezone),
      notes: notes.trim() || null,
    };
    const r = await fetch(`/api/calendar/actuals/${actual.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}));
      setError(errBody.error ?? "Failed to save");
      setSubmitting(false);
      return;
    }
    onClose();
    router.refresh();
  }

  async function remove() {
    const ok = await dialog.confirm({
      title: "Delete this activity?",
      message: "This block will be permanently removed.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    setSubmitting(true);
    const r = await fetch(`/api/calendar/actuals/${actual.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) {
      setError("Failed to delete");
      setSubmitting(false);
      return;
    }
    onClose();
    router.refresh();
  }

  // Esc-to-close + return-focus on unmount.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Edit activity"
    >
      <div
        className="w-full max-w-md border border-white/20 bg-black p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm uppercase tracking-wider text-white/70">Edit activity</h3>
        <div className="space-y-1">
          <label className="text-xs text-white/60">Category</label>
          <CategoryPicker selectedId={categoryId} onChange={setCategoryId} categories={categories} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-white/60">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent border border-white/20 px-2 py-1 text-sm focus:border-white/60 outline-none"
          />
        </div>
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
              disabled={stillRunning}
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              className="w-full bg-transparent border border-white/20 px-2 py-1 text-sm disabled:opacity-40 focus:border-white/60 outline-none"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={stillRunning}
            onChange={(e) => setStillRunning(e.target.checked)}
          />
          Still running
        </label>
        <div className="space-y-1">
          <label className="text-xs text-white/60">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-transparent border border-white/20 px-2 py-1 text-sm focus:border-white/60 outline-none"
          />
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
        <div className="flex justify-between pt-1">
          <button
            type="button"
            onClick={remove}
            disabled={submitting}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 disabled:opacity-40"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-white/60 hover:text-white px-2 py-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={submitting}
              className="text-xs border border-white/30 hover:bg-white/10 disabled:opacity-40 px-2 py-1"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
