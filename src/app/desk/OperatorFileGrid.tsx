"use client";

import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";
import { FileCard } from "@/components/article/file-card";
import { deleteOperatorEntryAction } from "./content-actions";

interface OperatorFileItem {
  href: string;
  name: string;
  pathSegments: string[];
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 fill-none stroke-current"
    >
      <path
        d="M5 7h14M9 7V5.8c0-.4.3-.8.8-.8h4.4c.5 0 .8.4.8.8V7M8 10v6M12 10v6M16 10v6M7 7l.7 10.1c0 .9.7 1.6 1.6 1.6h5.4c.9 0 1.6-.7 1.6-1.6L17 7"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function OperatorFileGrid({
  items,
}: {
  items: OperatorFileItem[];
}) {
  const router = useRouter();
  const [confirmValue, setConfirmValue] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [draggingItem, setDraggingItem] = useState<OperatorFileItem | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<OperatorFileItem | null>(null);

  const canDelete = useMemo(
    () => pendingDelete !== null && confirmValue.trim() === pendingDelete.name,
    [confirmValue, pendingDelete]
  );

  function resetDeleteState() {
    setConfirmValue("");
    setDeleteError("");
    setPendingDelete(null);
  }

  function confirmDelete() {
    if (!pendingDelete || !canDelete) {
      return;
    }

    setDeleteError("");
    setDeletingName(pendingDelete.name);

    startTransition(async () => {
      try {
        await deleteOperatorEntryAction({
          kind: "article",
          pathSegments: pendingDelete.pathSegments,
        });
        resetDeleteState();
        router.refresh();
      } catch (error) {
        setDeleteError(
          error instanceof Error ? error.message : "Unable to delete article."
        );
      } finally {
        setDeletingName(null);
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-8">
        {items.map((item) => (
          <div
            key={item.name}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", item.name);
              setDraggingItem(item);
              setDropActive(false);
            }}
            onDragEnd={() => {
              setDraggingItem(null);
              setDropActive(false);
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <FileCard href={item.href} label={item.name} />
          </div>
        ))}
      </div>

      <div className="pointer-events-none fixed bottom-6 right-6 z-[65]">
        <div
          onDragOver={(event) => {
            if (!draggingItem) {
              return;
            }

            event.preventDefault();
            setDropActive(true);
          }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            if (!draggingItem) {
              return;
            }

            setPendingDelete(draggingItem);
            setConfirmValue("");
            setDeleteError("");
            setDraggingItem(null);
            setDropActive(false);
          }}
          className={`pointer-events-auto flex h-16 w-16 items-center justify-center border transition-all ${
            draggingItem
              ? dropActive
                ? "scale-110 border-red-500 bg-red-500/90 text-white"
                : "border-white/30 bg-black text-white"
              : "border-white/15 bg-black text-white/50"
          }`}
        >
          <TrashIcon />
        </div>
      </div>

      {pendingDelete ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
          <div className="bg-black border border-white/20 p-6 max-w-sm w-full flex flex-col gap-4">
            <p className="text-sm text-white">
              Delete <span className="font-medium">{pendingDelete.name}</span>? This permanently removes the article. Type the exact name to confirm.
            </p>
            <input
              type="text"
              value={confirmValue}
              onChange={(event) => setConfirmValue(event.target.value)}
              placeholder={pendingDelete.name}
              className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/40"
              autoFocus
            />
            {deleteError ? (
              <p className="text-sm text-red-400">{deleteError}</p>
            ) : null}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={resetDeleteState}
                className="text-sm hover:bg-white/10 px-4 py-1.5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canDelete || deletingName === pendingDelete.name}
                onClick={confirmDelete}
                className="bg-red-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600"
              >
                {deletingName === pendingDelete.name ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
