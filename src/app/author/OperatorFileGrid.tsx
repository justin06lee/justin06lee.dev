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
      <div className="flex flex-wrap gap-8 p-8">
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
                ? "scale-110 border-red-500 bg-red-500 text-white shadow-[0_18px_40px_rgba(239,68,68,0.32)]"
                : "border-border bg-surface text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
              : "border-border bg-surface text-muted shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
          }`}
        >
          <TrashIcon />
        </div>
      </div>

      {pendingDelete ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 px-4">
          <div className="w-full max-w-md border border-border bg-surface p-6 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Delete article
            </p>
            <h2 className="mt-2 text-2xl tracking-tight text-foreground">
              {pendingDelete.name}
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted">
              This action permanently removes this article. Type the exact name
              below to confirm deletion.
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-muted">
              Type {pendingDelete.name}
            </label>
            <input
              type="text"
              value={confirmValue}
              onChange={(event) => setConfirmValue(event.target.value)}
              className="mt-2 w-full border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
              autoFocus
            />
            {deleteError ? (
              <p className="mt-4 text-sm leading-6 text-red-600 dark:text-red-400">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={resetDeleteState}
                className="border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-alt"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canDelete || deletingName === pendingDelete.name}
                onClick={confirmDelete}
                className="border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
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
