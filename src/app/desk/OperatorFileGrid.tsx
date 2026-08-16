"use client";

import { useEffect, useState } from "react";
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
  // Only in-flight/optimistic overrides live here, keyed by href — NOT a seeded
  // copy of every row. That way refreshed server props are the default source of
  // truth; an override only shadows a row while its write is pending.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Drop an override once the refreshed server props agree with it, so server
  // truth wins and there's no flash back to the old value between the optimistic
  // update and the refresh landing.
  useEffect(() => {
    setPending((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const item of items) {
        if (item.href in next && next[item.href] === item.hidden) {
          delete next[item.href];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  const files: OperatorFile[] = items.map((item) => ({
    id: item.href,
    name: item.name,
    href: item.href,
    pathSegments: item.pathSegments,
    hidden: item.href in pending ? pending[item.href] : item.hidden,
  }));

  async function toggleVisibility(file: OperatorFile, nextHidden: boolean) {
    // In-flight guard: a second toggle before the first resolves would write the
    // same stale sha and 422; ignore it while one write is pending on this row.
    if (file.id in pending) return;
    setError(null);
    setPending((m) => ({ ...m, [file.id]: nextHidden }));
    try {
      await setArticleVisibilityAction({
        pathSegments: file.pathSegments,
        hidden: nextHidden,
      });
      // Pull fresh server state; the effect above drops the override once props
      // catch up, so the optimistic value stays put until then (no flicker).
      router.refresh();
    } catch (e) {
      // Roll the override back to server truth and surface the reason. Also
      // refresh in case the write actually committed to GitHub before throwing,
      // so the UI reconciles either way.
      setPending((m) => {
        const nextMap = { ...m };
        delete nextMap[file.id];
        return nextMap;
      });
      setError(e instanceof Error ? e.message : "couldn't update visibility.");
      router.refresh();
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
                disabled={file.id in pending}
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
