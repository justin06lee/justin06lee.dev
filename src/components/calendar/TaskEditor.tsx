"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarTask } from "@/lib/calendar";

type Props = {
  date: string;
  task?: CalendarTask;
  onClose: () => void;
};

export default function TaskEditor({ date, task, onClose }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [startTime, setStartTime] = useState(task?.startTime ?? "");
  const [endTime, setEndTime] = useState(task?.endTime ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      date,
      title,
      notes: notes || null,
      startTime: startTime || null,
      endTime: endTime || null,
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
    if (!confirm("Delete this task?")) return;
    setSubmitting(true);
    await fetch(`/api/calendar/tasks/${task.id}`, { method: "DELETE" });
    setSubmitting(false);
    onClose();
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md bg-black border border-white/20 p-5 flex flex-col gap-3 text-sm"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono uppercase tracking-widest text-white/70 text-xs">
            {task ? "Edit task" : "New task"} · {date}
          </span>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white">×</button>
        </div>
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
            <span className="text-white/60 text-xs">start (HH:MM)</span>
            <input
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="09:00"
              pattern="\d{2}:\d{2}"
              className="w-full min-w-0 bg-transparent border border-white/20 px-2 py-1 text-white outline-none focus:border-white/60"
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-0">
            <span className="text-white/60 text-xs">end (HH:MM)</span>
            <input
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="10:00"
              pattern="\d{2}:\d{2}"
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
