"use client";

import { startTransition, useCallback, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Desk } from "@/components/chrome/desk";
import { Prose } from "@/components/chrome/prose";
import { Button } from "@/components/chrome/button";
import type { Asset } from "@/components/chrome/asset-sidebar";
import type { DrawingSaveResult } from "@/components/chrome/drawing-window";
import { bodyLineOffset, parseArticleDraft } from "@/lib/article-draft";
import { routeForPath } from "@/lib/github";
import type { OperatorImageAsset } from "@/lib/operator-content";
import { useVimKeymap } from "./useVimKeymap";
import {
  deleteImageAction,
  saveArticleAction,
  saveDrawingAction,
} from "./content-actions";

export function OperatorArticleEditor({
  articlePath,
  initialAssets,
  initialRaw,
  initialSha,
  previewBaseUrl,
}: {
  articlePath: string[];
  initialAssets: OperatorImageAsset[];
  initialRaw: string;
  initialSha?: string;
  previewBaseUrl: string;
}) {
  // Normalize CRLF from the source file to LF up front so the textarea, preview
  // sync, and save payload all share one line-ending convention (GitHub can
  // serve \r\n). Keeps line-offset math consistent across the whole session.
  const [raw, setRaw] = useState(() => initialRaw.replace(/\r\n/g, "\n"));
  const [assets, setAssets] = useState(initialAssets);
  const [sha, setSha] = useState(initialSha ?? "");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [assetError, setAssetError] = useState("");
  const [assetToDelete, setAssetToDelete] = useState<OperatorImageAsset | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<string | null>(null);

  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";

  const articleName = articlePath[articlePath.length - 1] ?? "Untitled";
  const articleLabel = articlePath.join(" / ");
  const parsed = useMemo(
    () => parseArticleDraft(raw, articleName),
    [articleName, raw],
  );
  const previewHref = `/desk/${articlePath.join("/")}`;
  const publicHref = routeForPath(articlePath);

  const vim = useVimKeymap({ value: raw, onChange: setRaw });

  // Strip the leading front-matter region (`# title`, `cover:`, `excerpt:`,
  // `tags:`, `prerequisites:`) so the preview renders body-only and doesn't
  // echo the raw metadata. `lineOffset` is the count of stripped source lines,
  // which keeps the two-way line-sync aligned (editor line N <-> preview block
  // line N - lineOffset). Reused across renders (stable ref keyed on the
  // fallback title) as Desk requires.
  const transformSource = useCallback(
    (source: string) => {
      const normalized = source.replace(/\r\n/g, "\n");
      const { content } = parseArticleDraft(normalized, articleName);
      return { body: content, lineOffset: bodyLineOffset(normalized, content) };
    },
    [articleName],
  );

  // Map the operator asset model onto the chrome sidebar's Asset shape. The
  // preview thumbnail uses the theme-appropriate rendered image (dark variant
  // when present), but the inserted markdown reference stays the base path so
  // the saved markdown matches what the reader resolves.
  const sidebarAssets: Asset[] = useMemo(
    () =>
      assets.map((asset) => ({
        id: asset.filename,
        url: theme === "dark" && asset.darkUrl ? asset.darkUrl : asset.url,
        name: asset.displayName,
        markdownPath: asset.markdownPath,
      })),
    [assets, theme],
  );

  // Save commits the raw markdown back to GitHub via the existing server action.
  // Fired by the Desk toolbar's Save button and by cmd/ctrl+s (Desk owns that
  // key binding). sha threads the optimistic-concurrency token forward.
  async function handleSave(value: string) {
    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    const formData = new FormData();
    formData.set("articlePath", articlePath.join("/"));
    formData.set("raw", value);
    formData.set("sha", sha);
    try {
      const result = await saveArticleAction(null, formData);
      if (result?.error) setSaveError(result.error);
      if (result?.message) setSaveMessage(result.message);
      if (result?.sha) setSha(result.sha);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save article.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleUploadAssets(files: File[]) {
    setAssetError("");
    startTransition(async () => {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length === 0) {
        setAssetError(
          "Only image files can be dropped here (png, jpeg, gif, webp, svg).",
        );
        return;
      }
      for (const file of imageFiles) {
        try {
          const form = new FormData();
          form.append("file", file);
          form.append("articlePath", articlePath.join("/"));
          const response = await fetch("/api/desk/upload", {
            method: "POST",
            body: form,
          });
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(
              body?.error || `Upload failed (status ${response.status}).`,
            );
          }
          const asset = (await response.json()) as OperatorImageAsset;
          setAssets((current) => [asset, ...current]);
        } catch (error) {
          setAssetError(error instanceof Error ? error.message : "Upload failed.");
        }
      }
    });
  }

  function handleDeleteAsset(asset: Asset) {
    const original = assets.find((item) => item.filename === asset.id);
    if (!original) return;
    setAssetError("");
    setAssetToDelete(original);
  }

  function confirmAssetDelete() {
    if (!assetToDelete) return;
    setAssetError("");
    setDeletingAsset(assetToDelete.filename);
    startTransition(async () => {
      try {
        await deleteImageAction({
          articlePath,
          darkFilename: assetToDelete.darkFilename,
          darkSha: assetToDelete.darkSha,
          filename: assetToDelete.filename,
          sha: assetToDelete.sha,
        });
        setAssets((current) =>
          current.filter((item) => item.filename !== assetToDelete.filename),
        );
        setAssetToDelete(null);
      } catch (error) {
        setAssetError(
          error instanceof Error ? error.message : "Unable to delete image.",
        );
      } finally {
        setDeletingAsset(null);
      }
    });
  }

  // A drawing window saved. With drawingDarkMapping on, the window hands back the
  // light master (dataUrl) plus its dark-mapped variant; persist both via the
  // existing server action and prepend the returned asset.
  async function handleSaveDrawing({ dataUrl, darkDataUrl }: DrawingSaveResult) {
    try {
      const result = await saveDrawingAction({
        articlePath,
        lightDataUrl: dataUrl,
        darkDataUrl: darkDataUrl ?? dataUrl,
      });
      setAssets((current) => [result, ...current]);
    } catch (error) {
      setAssetError(
        error instanceof Error ? error.message : "Unable to save drawing.",
      );
    }
  }

  return (
    <>
      {saving || saveMessage || saveError || assetError ? (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {saving ? <span className="text-white/60">saving...</span> : null}
          {saveError ? <span className="text-red-400">{saveError}</span> : null}
          {saveMessage && !saveError ? (
            <span className="text-green-400">{saveMessage}</span>
          ) : null}
          {assetError && !assetToDelete ? (
            <span className="text-red-400">{assetError}</span>
          ) : null}
        </div>
      ) : null}

      <Desk
        title={parsed.title || articleName}
        subtitle={articleLabel}
        value={raw}
        onChange={setRaw}
        onSave={handleSave}
        assets={sidebarAssets}
        onDeleteAsset={handleDeleteAsset}
        onUploadAssets={handleUploadAssets}
        onSaveDrawing={handleSaveDrawing}
        drawingDarkMapping
        textareaProps={vim.textareaProps}
        transformSource={transformSource}
        actions={
          <>
            {vim.vimEnabled ? (
              <span className="hidden text-xs text-white/60 sm:inline">
                vim &middot; {vim.vimMode}
                {vim.pendingCommand ? ` · ${vim.pendingCommand}` : ""}
              </span>
            ) : null}
            <Button
              onClick={vim.toggleVim}
              variant={vim.vimEnabled ? "solid" : "outline"}
              size="sm"
            >
              vim {vim.vimEnabled ? "on" : "off"}
            </Button>
            <Button href={previewHref} variant="outline" size="sm">
              preview
            </Button>
            <a
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center border border-white/20 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/5"
            >
              public page
            </a>
          </>
        }
        renderMarkdown={(md, { highlightLine }) => (
          <Prose
            imageBaseUrl={previewBaseUrl}
            lineSync
            highlightLine={highlightLine}
            // Match the published (forced-dark) rendering: show the dark variant
            // of light/dark image pairs in the editor preview too.
            imageTheme="dark"
          >
            {md}
          </Prose>
        )}
      />

      {assetToDelete ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
          <div className="flex w-full max-w-sm flex-col gap-4 border border-white/20 bg-black p-6">
            <p className="text-sm text-white">
              Delete{" "}
              <span className="font-medium">{assetToDelete.displayName}</span>?
              Existing markdown references will break.
            </p>
            {assetError ? (
              <p className="text-sm text-red-400">{assetError}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAssetError("");
                  setAssetToDelete(null);
                }}
                className="px-4 py-1.5 text-sm transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingAsset === assetToDelete.filename}
                onClick={confirmAssetDelete}
                className="bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-red-600"
              >
                {deletingAsset === assetToDelete.filename ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
