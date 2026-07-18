"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileGrid, type FileGridFile } from "@/components/chrome/file-grid";
import { FileCard } from "@/components/chrome/file-card";
import { Checkbox } from "@/components/chrome/checkbox";
import {
  deleteOperatorEntryAction,
  setArticleVisibilityAction,
} from "./content-actions";

interface OperatorFileItem {
  href: string;
  name: string;
  pathSegments: string[];
  hidden: boolean;
}

// pathSegments + hidden ride along on the file object into onDelete/renderCard.
type OperatorFile = FileGridFile & { pathSegments: string[]; hidden: boolean };

/**
 * Wraps chrome's `FileGrid` (stacked-paper cards + drag-to-trash delete) and adds
 * a per-article "visible" checkbox. Toggling writes the front-matter `hidden`
 * flag back to GitHub via a server action (optimistic, with rollback on error);
 * hidden articles dim and drop off the public site.
 */
export function OperatorFileGrid({ items }: { items: OperatorFileItem[] }) {
  const router = useRouter();
  // Local hidden state keyed by href, seeded from the server list, so the toggle
  // is optimistic (instant) and can roll back if the write fails.
  const [hiddenById, setHiddenById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.href, i.hidden]))
  );
  const [error, setError] = useState<string | null>(null);

  const files: OperatorFile[] = items.map((item) => ({
    id: item.href,
    name: item.name,
    href: item.href,
    pathSegments: item.pathSegments,
    hidden: hiddenById[item.href] ?? item.hidden,
  }));

  async function toggleVisibility(file: OperatorFile, nextHidden: boolean) {
    setError(null);
    setHiddenById((m) => ({ ...m, [file.id]: nextHidden }));
    try {
      await setArticleVisibilityAction({
        pathSegments: file.pathSegments,
        hidden: nextHidden,
      });
      router.refresh();
    } catch (e) {
      // Roll the checkbox back and surface the reason.
      setHiddenById((m) => ({ ...m, [file.id]: !nextHidden }));
      setError(e instanceof Error ? e.message : "couldn't update visibility.");
    }
  }

  return (
    <>
      {error && <p className="mb-4 text-sm text-red-300">{error}</p>}
      <FileGrid
        files={files}
        linkComponent={Link}
        trashPosition="viewport"
        renderCard={(file) => (
          <div className={file.hidden ? "opacity-50 transition-opacity" : "transition-opacity"}>
            <FileCard name={file.name} href={file.href} linkComponent={Link} />
            {/* stopPropagation on pointerdown so interacting with the checkbox
                never starts the card's drag-to-trash gesture, and cursor-default
                overrides the grid's grab cursor. */}
            <div
              className="mt-2 cursor-default"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={!file.hidden}
                onChange={(e) => toggleVisibility(file, !e.target.checked)}
                label={file.hidden ? "hidden" : "visible"}
                wrapperClassName="text-xs text-white/60"
              />
            </div>
          </div>
        )}
        onDelete={async (file) => {
          // Throwing keeps the confirm dialog open with the error surfaced
          // inline; resolving closes it. router.refresh re-fetches the uncached
          // article list so the deleted card disappears.
          await deleteOperatorEntryAction({
            kind: "article",
            pathSegments: file.pathSegments,
          });
          router.refresh();
        }}
      />
    </>
  );
}
