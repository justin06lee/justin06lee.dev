"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarTask, PlanFallback } from "@/lib/calendar";
import type { CalendarCategory } from "@/lib/calendar-categories";
import { isValidHhmm } from "@/lib/calendar-dates";
import CategoryPicker from "./CategoryPicker";
import { useDialog } from "@/components/Dialog";

type Props = {
  date: string;
  task?: CalendarTask;
  categories?: CalendarCategory[];
  onClose: () => void;
};

/** Local draft type — alternatives are partial while being edited. The submit
 *  step validates and only sends complete rows; incomplete rows raise an error. */
type AlternativeDraft = {
  categoryId: string;
  title: string;
  startTime: string;
  endTime: string;
};

function emptyAlternative(): AlternativeDraft {
  return { categoryId: "", title: "", startTime: "", endTime: "" };
}

function fallbackToDraft(f: PlanFallback): AlternativeDraft {
  return { categoryId: f.categoryId, title: f.title, startTime: f.startTime, endTime: f.endTime };
}

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
  const [alternatives, setAlternatives] = useState<AlternativeDraft[]>(
    () => task?.fallbacks.map(fallbackToDraft) ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let cleanFallbacks: PlanFallback[] = [];
    if (isUncertain && alternatives.length > 0) {
      for (let i = 0; i < alternatives.length; i++) {
        const a = alternatives[i];
        const num = i + 1;
        if (!a.categoryId) {
          setError(`alternative ${num}: pick a category`);
          setSubmitting(false);
          return;
        }
        if (!a.title.trim()) {
          setError(`alternative ${num}: title is required`);
          setSubmitting(false);
          return;
        }
        if (!isValidHhmm(a.startTime) || !isValidHhmm(a.endTime)) {
          setError(`alternative ${num}: start and end must be HH:MM`);
          setSubmitting(false);
          return;
        }
        if (a.startTime >= a.endTime) {
          setError(`alternative ${num}: end must be after start`);
          setSubmitting(false);
          return;
        }
        cleanFallbacks.push({
          categoryId: a.categoryId,
          title: a.title.trim(),
          startTime: a.startTime,
          endTime: a.endTime,
        });
      }
    } else {
      cleanFallbacks = [];
    }

    const payload = {
      date,
      title,
      notes: notes || null,
      startTime: startTime || null,
      endTime: endTime || null,
      categoryId,
      isUncertain,
      fallbacks: cleanFallbacks,
    };
    const url = task ? `/api/calendar/tasks/${task.id}` : "/api/calendar/tasks";
    const method = task ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
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
    const res = await fetch(`/api/calendar/tasks/${task.id}`, { method: "DELETE", credentials: "include" });
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
        className="w-full max-w-md bg-black border border-white/20 p-5 flex flex-col gap-3 text-sm max-h-[90vh] overflow-y-auto"
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
        <label className="flex flex-col gap-1">
          <span className="text-white/60 text-xs">title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
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
        <label className="flex flex-col gap-1">
          <span className="text-white/60 text-xs">notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="bg-transparent border border-white/20 px-2 py-1 text-white outline-none focus:border-white/60"
          />
        </label>
        <AlternativesSection
          isUncertain={isUncertain}
          onUncertainChange={setIsUncertain}
          alternatives={alternatives}
          onAlternativesChange={setAlternatives}
          categories={categories}
        />
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
 * "Uncertain" toggle + per-row alternative-task editor. Each alternative is a
 * full mini-task (category + title + start + end). Heatmap scoring credits the
 * plan for time spent on EITHER the parent's category OR any alternative's
 * exact (category, title) pairing within that alternative's time slot.
 */
function AlternativesSection({
  isUncertain,
  onUncertainChange,
  alternatives,
  onAlternativesChange,
  categories,
}: {
  isUncertain: boolean;
  onUncertainChange: (v: boolean) => void;
  alternatives: AlternativeDraft[];
  onAlternativesChange: (v: AlternativeDraft[]) => void;
  categories?: CalendarCategory[];
}) {
  function update(idx: number, patch: Partial<AlternativeDraft>) {
    const next = alternatives.slice();
    next[idx] = { ...next[idx], ...patch };
    onAlternativesChange(next);
  }
  function remove(idx: number) {
    onAlternativesChange(alternatives.filter((_, i) => i !== idx));
  }
  function addAlternative() {
    onAlternativesChange([...alternatives, emptyAlternative()]);
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
            doing the plan above — or any alternative below — counts toward this slot
          </span>
        </span>
      </label>
      {isUncertain && (
        <div className="flex flex-col gap-3 pl-6">
          {alternatives.length === 0 && (
            <div className="text-white/40 text-[11px]">no alternatives yet — add one below if you want</div>
          )}
          {alternatives.map((alt, i) => (
            <div key={i} className="flex flex-col gap-1.5 border border-white/10 px-2 py-2">
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-[10px] uppercase tracking-wider">alt {i + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove alternative ${i + 1}`}
                  className="text-white/40 hover:text-white text-xs px-1"
                >
                  ×
                </button>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-white/60 text-[10px]">category</span>
                <CategoryPicker
                  selectedId={alt.categoryId || null}
                  onChange={(id) => update(i, { categoryId: id ?? "" })}
                  categories={categories}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-white/60 text-[10px]">title</span>
                <input
                  value={alt.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  placeholder="what you'd do instead"
                  className="w-full bg-transparent border border-white/20 px-2 py-1 text-white text-xs outline-none focus:border-white/60"
                />
              </label>
              <div className="flex gap-2">
                <label className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="text-white/60 text-[10px]">start</span>
                  <input
                    type="time"
                    value={alt.startTime}
                    onChange={(e) => update(i, { startTime: e.target.value })}
                    className="w-full min-w-0 bg-transparent border border-white/20 px-2 py-1 text-white text-xs outline-none focus:border-white/60"
                  />
                </label>
                <label className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="text-white/60 text-[10px]">end</span>
                  <input
                    type="time"
                    value={alt.endTime}
                    onChange={(e) => update(i, { endTime: e.target.value })}
                    className="w-full min-w-0 bg-transparent border border-white/20 px-2 py-1 text-white text-xs outline-none focus:border-white/60"
                  />
                </label>
              </div>
            </div>
          ))}
          <div>
            <button
              type="button"
              onClick={addAlternative}
              className="text-[11px] text-white/60 hover:text-white border border-white/20 hover:border-white/40 px-2 py-0.5"
            >
              + alternative
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
