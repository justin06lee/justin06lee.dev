"use client";

import { useState } from "react";
import type { Annotation } from "@/lib/annotations";
import { Eye, EyeOff, Trash2 } from "lucide-react";

type Props = {
  annotations: Annotation[];
  isAdmin: boolean;
  onUpdate: (id: string, patch: { comment?: string | null; public?: boolean }) => void;
  onDelete: (id: string) => void;
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
  newComment: string;
  onNewCommentChange: (value: string) => void;
  onNewCommentSubmit: () => void;
  pendingParagraph: { paragraphIndex: number; position: "before" | "after" } | null;
};

function highlightBorderColor(color: string | null): string {
  switch (color) {
    case "gold":
      return "border-yellow-400/40";
    case "amber":
      return "border-amber-600/40";
    default:
      return "border-white/20";
  }
}

function AnnotationCard({
  a,
  isAdmin,
  editingId,
  onEditingChange,
  onUpdate,
  onDelete,
}: {
  a: Annotation;
  isAdmin: boolean;
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
  onUpdate: (id: string, patch: { comment?: string | null; public?: boolean }) => void;
  onDelete: (id: string) => void;
}) {
  const [editText, setEditText] = useState(a.comment ?? "");
  const isEditing = editingId === a.id;

  const isHighlight = a.type === "highlight";
  const borderColor = isHighlight ? highlightBorderColor(a.highlightColor) : "border-white/20";
  const borderStyle = a.public ? "border-solid" : "border-dashed";
  const opacity = a.public ? "" : "opacity-60";

  const label = isHighlight
    ? `highlight \u00b7 \u00b6${a.paragraphIndex}`
    : `comment \u00b7 ${a.position ?? "before"} \u00b6${a.paragraphIndex}`;

  return (
    <div className={`${borderColor} ${borderStyle} ${opacity} border p-3`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">
          {label}
        </span>
        {isAdmin && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onUpdate(a.id, { public: !a.public })}
              className="p-1 text-white/40 hover:text-white transition-colors"
              title={a.public ? "Make private" : "Make public"}
            >
              {a.public ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <button
              type="button"
              onClick={() => onDelete(a.id)}
              className="p-1 text-white/40 hover:text-red-400 transition-colors"
              title="Delete annotation"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {a.comment && !isEditing && (
        <p
          className={`mt-2 text-xs text-white/80 ${isAdmin ? "cursor-pointer hover:text-white" : ""}`}
          onClick={() => {
            if (isAdmin) {
              setEditText(a.comment ?? "");
              onEditingChange(a.id);
            }
          }}
        >
          {a.comment}
        </p>
      )}

      {isEditing && (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="bg-transparent border border-white/20 px-2 py-1 text-white outline-none focus:border-white/60 text-xs"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onEditingChange(null)}
              className="text-white/40 hover:text-white text-xs"
            >
              cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdate(a.id, { comment: editText || null });
                onEditingChange(null);
              }}
              className="border border-white/40 px-2 py-0.5 text-xs hover:bg-white hover:text-black transition"
            >
              save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnnotationSidebar({
  annotations,
  isAdmin,
  onUpdate,
  onDelete,
  editingId,
  onEditingChange,
  newComment,
  onNewCommentChange,
  onNewCommentSubmit,
  pendingParagraph,
}: Props) {
  const showPending = pendingParagraph !== null && isAdmin;
  const isEmpty = annotations.length === 0 && !showPending;

  return (
    <div className="hidden lg:flex flex-col gap-3 text-sm">
      {showPending && (
        <div className="border border-white/20 p-3 flex flex-col gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">
            new comment &middot; {pendingParagraph!.position} &para;{pendingParagraph!.paragraphIndex}
          </span>
          <textarea
            value={newComment}
            onChange={(e) => onNewCommentChange(e.target.value)}
            rows={3}
            placeholder="Write a margin comment..."
            className="bg-transparent border border-white/20 px-2 py-1 text-white outline-none focus:border-white/60 text-xs"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onEditingChange(null)}
              className="text-white/40 hover:text-white text-xs"
            >
              cancel
            </button>
            <button
              type="button"
              onClick={onNewCommentSubmit}
              disabled={newComment.trim().length === 0}
              className="border border-white/40 px-2 py-0.5 text-xs hover:bg-white hover:text-black transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              save
            </button>
          </div>
        </div>
      )}

      {annotations.map((a) => (
        <AnnotationCard
          key={a.id}
          a={a}
          isAdmin={isAdmin}
          editingId={editingId}
          onEditingChange={onEditingChange}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}

      {isEmpty && (
        <p className="text-xs text-white/30 font-mono">
          No annotations yet.
        </p>
      )}
    </div>
  );
}
