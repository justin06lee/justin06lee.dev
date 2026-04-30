"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarTask, PlanFallback } from "@/lib/calendar";
import type { CalendarCategory } from "@/lib/calendar-categories";
import CategoryPicker from "./CategoryPicker";
import { useDialog } from "@/components/Dialog";

type Props = {
  date: string;
  task?: CalendarTask;
  categories?: CalendarCategory[];
  onClose: () => void;
};

export default function TaskEditor({ date, task, categories, onClose }: Props) {
  const router = useRouter();
  const dialog = useDialog();
  const dialogRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [startTime, setStartTime] = useState(task?.startTime ?? "");
  const [endTime, setEndTime] = useState(task?.endTime ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(task?.categoryId ?? null);
  const [isUncertain, setIsUncertain] = useState<boolean>(task?.isUncertain ?? false);
  const [fallbacks, setFallbacks] = useState<PlanFallback[]>(task?.fallbacks ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    // Drop blank title-fallbacks before submit so accidentally-empty rows don't
    // 400 the request. Server still validates as a defense against hand-crafted
    // payloads.
    const cleanFallbacks = fallbacks.filter((f) =>
      f.type === "category" ? f.categoryId.length > 0 : f.title.trim().length > 0,
    );
    const payload = {
      date,
      title,
      notes: notes || null,
      startTime: startTime || null,
      endTime: endTime || null,
      categoryId,
      isUncertain,
      fallbacks: isUncertain ? cleanFallbacks : [],
    };
    const url = task ? `/api/calendar/tasks/${task.id}` : "/api/calendar/tasks";
    const method = task ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onClose();
    router.refresh();
  };

  const remove = async () => {
    if (!task) return;
    const ok = await dialog.confirm({
      title: "Delete this task?",
      message: "The plan and any actuals tied to it will lose this reference.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    setSubmitting(true);
    const res = await fetch(`/api/calendar/tasks/${task.id}`, { method: "DELETE" });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
      return;
    }
    onClose();
    router.refresh();
  };

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
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={task ? "Edit task" : "New task"}
    >
      <form
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md bg-black border border-white/20 p-5 flex flex-col gap-3 text-sm"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono uppercase tracking-widest text-white/70 text-xs">
            {task ? "Edit task" : "New task"} · {date}
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/60 hover:text-white">×</button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-white/60 text-xs">category</span>
          <CategoryPicker selectedId={categoryId} onChange={setCategoryId} categories={categories} />
        </label>
        <FallbackSection
          isUncertain={isUncertain}
          onUncertainChange={setIsUncertain}
          fallbacks={fallbacks}
          onFallbacksChange={setFallbacks}
          categories={categories}
        />
        <label className="flex flex-col gap-1">
          <span className="text-white/60 text-xs">title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="bg-transparent border border-white/20 px-2 py-1 text-white outline-none focus:border-white/60"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-white/60 text-xs">notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="bg-transparent border border-white/20 px-2 py-1 text-white outline-none focus:border-white/60"
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 flex-1 min-w-0">
            <span className="text-white/60 text-xs">start</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full min-w-0 bg-transparent border border-white/20 px-2 py-1 text-white outline-none focus:border-white/60"
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-0">
            <span className="text-white/60 text-xs">end</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full min-w-0 bg-transparent border border-white/20 px-2 py-1 text-white outline-none focus:border-white/60"
            />
          </label>
        </div>
        {error && <div className="text-red-400 text-xs">{error}</div>}
        <div className="flex items-center justify-between pt-2">
          {task ? (
            <button type="button" onClick={remove} disabled={submitting} className="text-red-400 hover:text-red-300 text-xs underline-offset-4 hover:underline">
              delete
            </button>
          ) : <span />}
          <button type="submit" disabled={submitting} className="border border-white/40 px-3 py-1 hover:bg-white hover:text-black transition">
            {submitting ? "saving…" : "save"}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * "Uncertain" toggle + per-row fallback editor. A fallback is either a
 * category match or a free-text actual-title match (case-insensitive). The
 * scoring engine treats the eligible-set as a union, so adding more fallbacks
 * can only widen what counts — never multiply it.
 */
function FallbackSection({
  isUncertain,
  onUncertainChange,
  fallbacks,
  onFallbacksChange,
  categories,
}: {
  isUncertain: boolean;
  onUncertainChange: (v: boolean) => void;
  fallbacks: PlanFallback[];
  onFallbacksChange: (v: PlanFallback[]) => void;
  categories?: CalendarCategory[];
}) {
  function update(idx: number, patch: PlanFallback) {
    const next = fallbacks.slice();
    next[idx] = patch;
    onFallbacksChange(next);
  }
  function remove(idx: number) {
    onFallbacksChange(fallbacks.filter((_, i) => i !== idx));
  }
  function addCategory() {
    onFallbacksChange([...fallbacks, { type: "category", categoryId: "" }]);
  }
  function addTitle() {
    onFallbacksChange([...fallbacks, { type: "title", title: "" }]);
  }

  return (
    <div className="flex flex-col gap-2 border border-white/10 px-3 py-2">
      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isUncertain}
          onChange={(e) => onUncertainChange(e.target.checked)}
          className="mt-[3px] accent-white"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-white/80 text-xs">uncertain</span>
          <span className="text-white/40 text-[10px] leading-snug">
            doing the plan&rsquo;s category — or any fallback below — counts toward this slot
          </span>
        </span>
      </label>
      {isUncertain && (
        <div className="flex flex-col gap-2 pl-6">
          {fallbacks.length === 0 && (
            <div className="text-white/40 text-[11px]">no fallbacks yet — add at least one below</div>
          )}
          {fallbacks.map((fb, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-white/40 text-[10px] uppercase tracking-wider w-12">
                {fb.type === "category" ? "cat" : "title"}
              </span>
              <div className="flex-1 min-w-0">
                {fb.type === "category" ? (
                  <CategoryPicker
                    selectedId={fb.categoryId || null}
                    onChange={(id) => update(i, { type: "category", categoryId: id ?? "" })}
                    categories={categories}
                  />
                ) : (
                  <input
                    value={fb.title}
                    onChange={(e) => update(i, { type: "title", title: e.target.value })}
                    placeholder="actual title to accept"
                    className="w-full bg-transparent border border-white/20 px-2 py-1 text-white text-sm outline-none focus:border-white/60"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove fallback"
                className="text-white/40 hover:text-white text-xs px-1"
              >
                ×
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addCategory}
              className="text-[11px] text-white/60 hover:text-white border border-white/20 hover:border-white/40 px-2 py-0.5"
            >
              + category
            </button>
            <button
              type="button"
              onClick={addTitle}
              className="text-[11px] text-white/60 hover:text-white border border-white/20 hover:border-white/40 px-2 py-0.5"
            >
              + title
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
