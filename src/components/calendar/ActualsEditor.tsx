"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarActual } from "@/lib/calendar";
import type { CalendarCategory } from "@/lib/calendar-categories";
import CategoryPicker from "./CategoryPicker";
import { useDialog } from "@/components/Dialog";
import { epochToLocalInput, localInputToEpoch } from "@/lib/calendar-dates";
import { Input } from "@/components/chrome/input";
import { Textarea } from "@/components/chrome/textarea";
import { Checkbox } from "@/components/chrome/checkbox";
import { Button } from "@/components/chrome/button";

type Props = {
  actual: CalendarActual;
  categories?: CalendarCategory[];
  timezone: string;
  onClose: () => void;
};

export default function ActualsEditor({ actual, categories, timezone, onClose }: Props) {
  const router = useRouter();
  const dialog = useDialog();
  // Values the inputs are seeded with; used below to detect no-op time edits.
  const initialStartInput = epochToLocalInput(actual.startAt, timezone);
  const initialEndInput = actual.endAt ? epochToLocalInput(actual.endAt, timezone) : "";
  const [categoryId, setCategoryId] = useState<string | null>(actual.categoryId);
  const [title, setTitle] = useState<string>(actual.title ?? "");
  const [startInput, setStartInput] = useState<string>(initialStartInput);
  const [endInput, setEndInput] = useState<string>(initialEndInput);
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
      notes: notes.trim() || null,
    };

    // Unchecking "still running" must supply a valid end. An empty/invalid input
    // parses to NaN, which JSON serializes as null, which the server reads as
    // "keep running" — silently defeating the intent. Block the save instead.
    if (stillRunning) {
      body.endAt = null;
    } else {
      const endAt = localInputToEpoch(endInput, timezone);
      if (!Number.isFinite(endAt)) {
        setError("end time is required");
        setSubmitting(false);
        return;
      }
      // DST guard: localInputToEpoch can round-trip an untouched value to a
      // DIFFERENT epoch across the fall-back repeated hour, so only send endAt
      // when the field actually changed from what it was seeded with.
      if (endInput !== initialEndInput) body.endAt = endAt;
    }

    // Same DST guard for start — a no-op save must not rewrite the stored time.
    if (startInput !== initialStartInput) {
      body.startAt = localInputToEpoch(startInput, timezone);
    }

    const r = await fetch(`/api/calendar/actuals/${actual.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}));
      setError(errBody.error ?? "failed to save");
      setSubmitting(false);
      return;
    }
    onClose();
    router.refresh();
  }

  async function remove() {
    const ok = await dialog.confirm({
      title: "delete this activity?",
      message: "this block will be permanently removed.",
      confirmText: "delete",
      danger: true,
    });
    if (!ok) return;
    setSubmitting(true);
    const r = await fetch(`/api/calendar/actuals/${actual.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) {
      setError("failed to delete");
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
    >
      <div
        className="w-full max-w-md border border-white/20 bg-black p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="edit activity"
      >
        <h3 className="text-[11px] uppercase tracking-[0.18em] text-white/40">edit activity</h3>
        <div className="space-y-1">
          <label className="text-xs text-white/60">category</label>
          <CategoryPicker selectedId={categoryId} onChange={setCategoryId} categories={categories} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-white/60">title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full"
          />
        </div>
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
              disabled={stillRunning}
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
        <Checkbox
          checked={stillRunning}
          onChange={(e) => setStillRunning(e.target.checked)}
          wrapperClassName="text-xs text-white/70"
          label="still running"
        />
        <div className="space-y-1">
          <label className="text-xs text-white/60">notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
        <div className="flex justify-between pt-1">
          <Button variant="link" size="sm" onClick={remove} disabled={submitting} className="text-red-400 hover:text-red-300">
            delete
          </Button>
          <div className="flex gap-2">
            <Button variant="link" size="sm" onClick={onClose} className="text-white/60 hover:text-white">
              cancel
            </Button>
            <Button variant="outline" size="sm" onClick={save} disabled={submitting}>
              {submitting ? "saving…" : "save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
