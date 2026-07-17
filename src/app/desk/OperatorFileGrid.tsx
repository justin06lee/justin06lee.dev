"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileGrid, type FileGridFile } from "@/components/chrome/file-grid";
import { deleteOperatorEntryAction } from "./content-actions";

interface OperatorFileItem {
  href: string;
  name: string;
  pathSegments: string[];
}

// pathSegments rides along on the file object into onDelete untouched.
type OperatorFile = FileGridFile & { pathSegments: string[] };

/**
 * Thin wrapper over chrome's `FileGrid`: it owns the stacked-paper cards, the
 * drag-to-trash + type-the-name confirm dialog, and the async pending/error
 * states. We only map the article list onto its file shape and wire delete to
 * the existing server action.
 */
export function OperatorFileGrid({ items }: { items: OperatorFileItem[] }) {
  const router = useRouter();

  const files: OperatorFile[] = items.map((item) => ({
    id: item.href,
    name: item.name,
    href: item.href,
    pathSegments: item.pathSegments,
  }));

  return (
    <FileGrid
      files={files}
      linkComponent={Link}
      trashPosition="viewport"
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
  );
}
