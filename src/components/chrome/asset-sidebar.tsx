"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type Asset = {
  id: string;
  url: string;
  name: string;
  markdownPath: string;
};

export type AssetSidebarProps = {
  assets: Asset[];
  /** Fired when the "insert" button is clicked. */
  onInsert?: (asset: Asset) => void;
  /** Fired when "delete" is clicked. Parent owns any confirm flow. */
  onDelete?: (asset: Asset) => void;
  /** Files dropped on the sidebar's drop zone. Omit to hide the drop zone. */
  onUpload?: (files: File[]) => void;
  title?: string;
  description?: string;
  className?: string;
  emptyLabel?: string;
};

/** Scrollable asset/image sidebar. Drag a row into a textarea or click insert. */
export function AssetSidebar({
  assets,
  onInsert,
  onDelete,
  onUpload,
  title = "images",
  description,
  className,
  emptyLabel = "no images yet.",
}: AssetSidebarProps) {
  const [dragOver, setDragOver] = useState(false);
  const dropDepth = useRef(0);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border border-white/10 bg-white/[0.02]",
        className,
      )}
    >
      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <h3 className="font-semibold text-white">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-white/50">{description}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {assets.length === 0 ? (
          <p className="text-sm text-white/60">{emptyLabel}</p>
        ) : (
          assets.map((asset) => (
            <div
              key={asset.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  "text/plain",
                  `![${asset.name}](${asset.markdownPath})`,
                );
                event.dataTransfer.effectAllowed = "copy";
              }}
              className="border border-white/10 bg-black p-3"
            >
              <div className="mb-3 aspect-video w-full overflow-hidden border border-white/10 bg-[#efede7]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt={asset.name}
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="truncate text-sm font-medium text-white">
                {asset.name}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-white/40">
                {asset.markdownPath}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onInsert?.(asset)}
                  className="flex-1 border border-white/20 px-3 py-1.5 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  insert
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(asset)}
                  className="border border-white/20 px-3 py-1.5 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {onUpload ? (
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            dropDepth.current += 1;
            setDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            dropDepth.current -= 1;
            if (dropDepth.current <= 0) {
              dropDepth.current = 0;
              setDragOver(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            dropDepth.current = 0;
            setDragOver(false);
            const files = Array.from(event.dataTransfer.files);
            if (files.length > 0) onUpload(files);
          }}
          className={cn(
            "shrink-0 border-t border-dashed border-white/20 px-4 py-4 text-center text-xs transition-colors",
            dragOver ? "bg-white/10 text-white" : "text-white/50",
          )}
        >
          drop images here to upload
        </div>
      ) : null}
    </aside>
  );
}
