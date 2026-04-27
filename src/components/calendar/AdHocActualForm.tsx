"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CategoryPicker from "./CategoryPicker";

type Props = {
  onStarted: () => void;
  onCancel: () => void;
};

export default function AdHocActualForm({ onStarted, onCancel }: Props) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setSubmitting(true);
    setError(null);
    const r = await fetch("/api/calendar/actuals/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ categoryId, title: title.trim() || null }),
    });
    if (!r.ok) {
      setError("Failed to start");
      setSubmitting(false);
      return;
    }
    onStarted();
    router.refresh();
  }

  return (
    <div className="border border-white/20 p-3 space-y-2">
      <div className="text-xs uppercase tracking-wider text-white/60">New activity</div>
      <CategoryPicker selectedId={categoryId} onChange={setCategoryId} />
      <input
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-transparent border border-white/20 px-2 py-1 text-sm focus:border-white/60 outline-none"
      />
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
          type="button"
          onClick={start}
          disabled={submitting}
          className="text-xs border border-white/30 hover:bg-white/10 disabled:opacity-40 px-2 py-1"
        >
          {submitting ? "Starting..." : "Start"}
        </button>
      </div>
    </div>
  );
}
