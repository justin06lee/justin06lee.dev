"use client";

import { useEffect, useRef, useState } from "react";

export type UseInlineEditOptions = {
  /** Source of truth, owned by the caller. */
  value: string;
  /**
   * Commit the next value. Throw to signal failure — the draft rolls back to
   * `value`. May be sync or async; while it runs the field is pending.
   */
  onCommit: (next: string) => void | Promise<void>;
  /** Trim before comparing / committing. Default true. */
  trim?: boolean;
};

export type UseInlineEditReturn = {
  draft: string;
  setDraft: (next: string) => void;
  pending: boolean;
  /** Commit the draft (onBlur / Enter). No-op if unchanged or empty. */
  commit: () => Promise<void>;
  /** Discard the draft and snap back to `value` (Escape). */
  cancel: () => void;
  /** Convenience handler: Enter commits, Escape cancels. */
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

/**
 * Headless blur-to-save editor. Holds a local draft over a controlled `value`,
 * commits via an injected onCommit, shows a pending flag while committing, and
 * ROLLS BACK to the previous value if onCommit throws.
 */
export function useInlineEdit({
  value,
  onCommit,
  trim = true,
}: UseInlineEditOptions): UseInlineEditReturn {
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);

  // Generation token: bumped on every commit and whenever `value` changes. A
  // resolving onCommit only updates state if its captured generation is still
  // current (no newer commit/value superseded it, component still mounted).
  const generation = useRef(0);
  const mounted = useRef(true);
  // In-flight commit count. `pending` must ALWAYS resolve — a value change
  // bumps the generation and would skip a generation-guarded reset, leaving
  // the field disabled forever — so the reset keys on this counter instead.
  const inflight = useRef(0);

  // Keep the draft in sync when the source of truth changes externally
  // (e.g. a successful commit updates `value`), but never while mid-edit.
  useEffect(() => {
    if (!pending) setDraft(value);
  }, [value, pending]);

  // An external value change supersedes any in-flight commit.
  useEffect(() => {
    generation.current++;
  }, [value]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Set transiently by an Escape press so the blur it triggers does not commit
  // the (about-to-be-discarded) draft. Consumed and cleared by the next commit.
  const skipNextCommit = useRef(false);

  const cancel = () => setDraft(value);

  const commit = async () => {
    if (skipNextCommit.current) {
      skipNextCommit.current = false;
      return;
    }
    const next = trim ? draft.trim() : draft;
    if (next.length === 0 || next === value) {
      // Nothing to do — revert to the source of truth.
      setDraft(value);
      return;
    }
    const gen = ++generation.current;
    const isCurrent = () => mounted.current && gen === generation.current;
    inflight.current += 1;
    setPending(true);
    try {
      await onCommit(next);
      if (isCurrent()) setDraft(next);
    } catch {
      // Roll back to the previous value on failure — unless superseded.
      if (isCurrent()) setDraft(value);
    } finally {
      inflight.current -= 1;
      if (mounted.current && inflight.current === 0) setPending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      // The blur below triggers the consumer's onCommit; suppress that one commit
      // so Escape discards the draft rather than saving it.
      skipNextCommit.current = true;
      cancel();
      e.currentTarget.blur();
    }
  };

  return { draft, setDraft, pending, commit, cancel, onKeyDown };
}
