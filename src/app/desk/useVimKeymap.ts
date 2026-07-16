"use client";

import { useEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, MouseEvent } from "react";

// Vim keymap for the /desk editor, recovered from the pre-chrome-migration
// editor (commit 6e90aaf) and adapted onto the chrome `Desk`/`Editor`
// `textareaProps` escape hatch: the motions/edits run as a textarea `onKeyDown`
// so the workbench's own splice/save/sync glue stays intact underneath.

type VimMode = "insert" | "normal";

const VIM_STORAGE_KEY = "operator-editor-vim";

function getStoredVimEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(VIM_STORAGE_KEY) === "1";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeNormalCursor(text: string, index: number): number {
  if (text.length === 0) return 0;
  return clamp(index, 0, text.length - 1);
}

function getLineStart(text: string, index: number): number {
  let cursor = clamp(index, 0, text.length);
  while (cursor > 0 && text[cursor - 1] !== "\n") cursor -= 1;
  return cursor;
}

function getLineEnd(text: string, index: number): number {
  let cursor = clamp(index, 0, text.length);
  while (cursor < text.length && text[cursor] !== "\n") cursor += 1;
  return cursor;
}

function getLineLastCharacter(text: string, index: number): number {
  const start = getLineStart(text, index);
  const end = getLineEnd(text, index);
  return end > start ? end - 1 : start;
}

function getCurrentColumn(text: string, index: number): number {
  return clamp(index, 0, text.length) - getLineStart(text, index);
}

function getFirstNonWhitespace(text: string, index: number): number {
  const start = getLineStart(text, index);
  const end = getLineEnd(text, index);
  let cursor = start;
  while (cursor < end && /\s/.test(text[cursor] ?? "")) cursor += 1;
  return cursor < end ? cursor : start;
}

function moveVertical(
  text: string,
  index: number,
  direction: -1 | 1,
  preferredColumn?: number | null,
): { column: number; index: number } {
  if (text.length === 0) return { column: 0, index: 0 };

  const currentStart = getLineStart(text, index);
  const targetColumn = preferredColumn ?? getCurrentColumn(text, index);

  if (direction === -1) {
    if (currentStart === 0) return { column: targetColumn, index };
    const previousLineEnd = currentStart - 1;
    const previousLineStart = getLineStart(text, previousLineEnd);
    const previousLineLength = getLineEnd(text, previousLineStart) - previousLineStart;
    const targetIndex =
      previousLineLength > 0
        ? previousLineStart + Math.min(targetColumn, previousLineLength - 1)
        : previousLineStart;
    return { column: targetColumn, index: targetIndex };
  }

  const currentLineEnd = getLineEnd(text, index);
  if (currentLineEnd >= text.length) return { column: targetColumn, index };
  const nextLineStart = currentLineEnd + 1;
  const nextLineLength = getLineEnd(text, nextLineStart) - nextLineStart;
  const targetIndex =
    nextLineLength > 0
      ? nextLineStart + Math.min(targetColumn, nextLineLength - 1)
      : nextLineStart;
  return { column: targetColumn, index: targetIndex };
}

function getCharClass(character: string | undefined): "space" | "symbol" | "word" {
  if (!character || /\s/.test(character)) return "space";
  if (/\w/.test(character)) return "word";
  return "symbol";
}

function moveToNextWordStart(text: string, index: number): number {
  if (text.length === 0) return 0;
  let cursor = normalizeNormalCursor(text, index);
  const kind = getCharClass(text[cursor]);
  if (kind === "space") {
    while (cursor < text.length && getCharClass(text[cursor]) === "space") cursor += 1;
    return normalizeNormalCursor(text, cursor);
  }
  while (cursor < text.length && getCharClass(text[cursor]) === kind) cursor += 1;
  while (cursor < text.length && getCharClass(text[cursor]) === "space") cursor += 1;
  return normalizeNormalCursor(text, cursor);
}

function moveToPreviousWordStart(text: string, index: number): number {
  if (text.length === 0) return 0;
  let cursor = normalizeNormalCursor(text, Math.max(index - 1, 0));
  while (cursor > 0 && getCharClass(text[cursor]) === "space") cursor -= 1;
  const kind = getCharClass(text[cursor]);
  while (cursor > 0 && getCharClass(text[cursor - 1]) === kind) cursor -= 1;
  return cursor;
}

function moveToWordEnd(text: string, index: number): number {
  if (text.length === 0) return 0;
  let cursor = normalizeNormalCursor(text, index);
  while (cursor < text.length - 1 && getCharClass(text[cursor]) === "space") cursor += 1;
  const kind = getCharClass(text[cursor]);
  while (cursor < text.length - 1 && getCharClass(text[cursor + 1]) === kind) cursor += 1;
  return cursor;
}

export interface VimTextareaProps {
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus: (event: FocusEvent<HTMLTextAreaElement>) => void;
  onMouseUp: (event: MouseEvent<HTMLTextAreaElement>) => void;
}

export interface VimKeymap {
  vimEnabled: boolean;
  vimMode: VimMode;
  pendingCommand: "d" | "g" | null;
  toggleVim: () => void;
  /** Spread onto the chrome editor's `textareaProps` — handlers compose. */
  textareaProps: VimTextareaProps;
}

/**
 * Headless vim keymap over a controlled `value`/`onChange` markdown source.
 * Supports the motions/edits the bespoke editor had: `hjkl`, `w`, `b`, `e`,
 * `0`, `$`, `gg`, `G`, `i`, `a`, `I`, `A`, `o`, `O`, `x`, and `dd`, plus
 * `Esc` to leave insert mode. The enable flag persists to localStorage so the
 * editor comes back in the same mode across reloads.
 */
export function useVimKeymap({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): VimKeymap {
  const [vimEnabled, setVimEnabled] = useState(getStoredVimEnabled);
  const [vimMode, setVimMode] = useState<VimMode>(() =>
    getStoredVimEnabled() ? "normal" : "insert",
  );
  const [pendingCommand, setPendingCommand] = useState<"d" | "g" | null>(null);
  const preferredColumnRef = useRef<number | null>(null);
  // The live textarea element, captured from the latest event so the toolbar
  // toggle (which has no direct handle on it) can refocus + reposition.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    window.localStorage.setItem(VIM_STORAGE_KEY, vimEnabled ? "1" : "0");
  }, [vimEnabled]);

  function setEditorSelection(index: number) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(index, index);
  }

  // Commit an edit that changes the text: onChange re-renders, so restore focus
  // + caret on the next frame once the new value has painted.
  function applyEditorState(nextRaw: string, nextIndex: number, nextMode?: VimMode) {
    onChange(nextRaw);
    if (nextMode) setVimMode(nextMode);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(nextIndex, nextIndex);
    });
  }

  function enterNormalMode(fromIndex: number) {
    preferredColumnRef.current = null;
    setPendingCommand(null);
    setVimMode("normal");
    setEditorSelection(normalizeNormalCursor(value, fromIndex));
  }

  function enterInsertMode(index: number) {
    preferredColumnRef.current = null;
    setPendingCommand(null);
    setVimMode("insert");
    setEditorSelection(clamp(index, 0, value.length));
  }

  // In normal mode vim's block cursor sits ON a character, never past the last
  // one; snap the native caret back after focus/click so it stays consistent.
  function syncNormalCursorPosition() {
    if (!vimEnabled || vimMode !== "normal") return;
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const nextIndex = normalizeNormalCursor(value, textarea.selectionStart);
      textarea.setSelectionRange(nextIndex, nextIndex);
    });
  }

  function toggleVim() {
    const nextEnabled = !vimEnabled;
    setVimEnabled(nextEnabled);
    setPendingCommand(null);
    preferredColumnRef.current = null;

    const textarea = textareaRef.current;
    if (!textarea) {
      setVimMode(nextEnabled ? "normal" : "insert");
      return;
    }

    if (nextEnabled) {
      setVimMode("normal");
      const nextIndex = normalizeNormalCursor(value, textarea.selectionStart);
      requestAnimationFrame(() => {
        const current = textareaRef.current;
        if (!current) return;
        current.focus();
        current.setSelectionRange(nextIndex, nextIndex);
      });
      return;
    }

    setVimMode("insert");
  }

  function handleNormalModeKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    const textarea = event.currentTarget;
    const cursor = normalizeNormalCursor(value, textarea.selectionStart);

    if (event.key !== "j" && event.key !== "k") {
      preferredColumnRef.current = null;
    }

    if (pendingCommand === "g") {
      setPendingCommand(null);
      if (event.key === "g") {
        setEditorSelection(0);
        return;
      }
    }

    if (pendingCommand === "d") {
      setPendingCommand(null);
      if (event.key === "d") {
        const start = getLineStart(value, cursor);
        const end = getLineEnd(value, cursor);
        const deleteEnd = end < value.length ? end + 1 : end;
        const nextRaw = value.slice(0, start) + value.slice(deleteEnd);
        const nextIndex = normalizeNormalCursor(nextRaw, start);
        applyEditorState(nextRaw, nextRaw.length === 0 ? 0 : nextIndex);
        return;
      }
    }

    switch (event.key) {
      case "Escape":
        setPendingCommand(null);
        return;
      case "h":
        setEditorSelection(Math.max(cursor - 1, 0));
        return;
      case "l":
        setEditorSelection(value.length === 0 ? 0 : Math.min(cursor + 1, value.length - 1));
        return;
      case "j": {
        const next = moveVertical(value, cursor, 1, preferredColumnRef.current);
        preferredColumnRef.current = next.column;
        setEditorSelection(next.index);
        return;
      }
      case "k": {
        const next = moveVertical(value, cursor, -1, preferredColumnRef.current);
        preferredColumnRef.current = next.column;
        setEditorSelection(next.index);
        return;
      }
      case "w":
        setEditorSelection(moveToNextWordStart(value, cursor + 1));
        return;
      case "b":
        setEditorSelection(moveToPreviousWordStart(value, cursor));
        return;
      case "e":
        setEditorSelection(moveToWordEnd(value, cursor));
        return;
      case "0":
        setEditorSelection(getLineStart(value, cursor));
        return;
      case "$":
        setEditorSelection(getLineLastCharacter(value, cursor));
        return;
      case "g":
        setPendingCommand("g");
        return;
      case "G":
        setEditorSelection(normalizeNormalCursor(value, value.length - 1));
        return;
      case "i":
        enterInsertMode(cursor);
        return;
      case "a":
        enterInsertMode(value.length === 0 ? 0 : Math.min(cursor + 1, value.length));
        return;
      case "I":
        enterInsertMode(getFirstNonWhitespace(value, cursor));
        return;
      case "A":
        enterInsertMode(getLineEnd(value, cursor));
        return;
      case "o": {
        const lineEnd = getLineEnd(value, cursor);
        const insertAt = lineEnd < value.length ? lineEnd + 1 : lineEnd;
        const nextRaw = `${value.slice(0, insertAt)}\n${value.slice(insertAt)}`;
        applyEditorState(nextRaw, insertAt + 1, "insert");
        return;
      }
      case "O": {
        const lineStart = getLineStart(value, cursor);
        const nextRaw = `${value.slice(0, lineStart)}\n${value.slice(lineStart)}`;
        applyEditorState(nextRaw, lineStart, "insert");
        return;
      }
      case "x": {
        if (value.length === 0) return;
        const nextRaw = value.slice(0, cursor) + value.slice(cursor + 1);
        const nextIndex = normalizeNormalCursor(nextRaw, cursor);
        applyEditorState(nextRaw, nextRaw.length === 0 ? 0 : nextIndex);
        return;
      }
      case "d":
        setPendingCommand("d");
        return;
      default:
        setPendingCommand(null);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    textareaRef.current = event.currentTarget;
    if (!vimEnabled) return;
    // Let editor/OS shortcuts (cmd/ctrl+s save, etc.) through untouched.
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (vimMode === "insert") {
      if (event.key === "Escape") {
        event.preventDefault();
        enterNormalMode(event.currentTarget.selectionStart - 1);
      }
      return;
    }

    // Normal mode swallows every key: motions/edits are handled explicitly and
    // no character should reach the textarea's own input.
    event.preventDefault();
    handleNormalModeKey(event);
  }

  function onFocus(event: FocusEvent<HTMLTextAreaElement>) {
    textareaRef.current = event.currentTarget;
    syncNormalCursorPosition();
  }

  function onMouseUp(event: MouseEvent<HTMLTextAreaElement>) {
    textareaRef.current = event.currentTarget;
    syncNormalCursorPosition();
  }

  return {
    vimEnabled,
    vimMode,
    pendingCommand,
    toggleVim,
    textareaProps: { onKeyDown, onFocus, onMouseUp },
  };
}
