"use client";

import { useState } from "react";

export type LoginCredentials = Record<string, string>;

export type LoginSubmitResult = {
  /** Set true to surface the rate-limited state instead of a generic error. */
  rateLimited?: boolean;
  /** Optional error message; presence marks the attempt as failed. */
  error?: string;
} | void;

export type UseLoginFormOptions = {
  /**
   * Caller-supplied submit. Resolve to signal success; return
   * `{ error }` / `{ rateLimited: true }`, or throw, to signal failure.
   * No transport is assumed — wire it to fetch, an action, anything.
   */
  onSubmit: (credentials: LoginCredentials) => Promise<LoginSubmitResult>;
  /** Field names the form collects. Defaults to a single "password". */
  fields?: string[];
  /** Message shown when onSubmit throws. */
  networkError?: string;
  /** Message shown when a result/throw flags rate limiting. */
  rateLimitedError?: string;
  /** Fallback message for a generic failed attempt. */
  defaultError?: string;
};

export type UseLoginFormReturn = {
  values: LoginCredentials;
  setValue: (name: string, value: string) => void;
  loading: boolean;
  error: string;
  rateLimited: boolean;
  /** Run the submit flow. */
  submit: () => Promise<void>;
  /** Wire to inputs for Enter-to-submit. */
  onKeyDown: (e: React.KeyboardEvent) => void;
};

/**
 * Headless login state machine: holds field values, loading + error +
 * rateLimited flags, an Enter-to-submit handler, and a submit runner that
 * delegates to an injected onSubmit. Framework- and transport-agnostic.
 *
 * Credentials live only in React state and are handed solely to onSubmit —
 * never logged, persisted, or echoed into error copy. Default errors are
 * generic on purpose (no user-enumeration hints); real rate limiting and
 * lockout belong on the consumer's backend, surfaced here via `rateLimited`.
 */
export function useLoginForm({
  onSubmit,
  fields = ["password"],
  networkError = "network error. try again.",
  rateLimitedError = "too many attempts. try again later.",
  defaultError = "incorrect credentials.",
}: UseLoginFormOptions): UseLoginFormReturn {
  const [values, setValues] = useState<LoginCredentials>(() =>
    Object.fromEntries(fields.map((f) => [f, ""])),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rateLimited, setRateLimited] = useState(false);

  const setValue = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const submit = async () => {
    if (loading) return;
    setError("");
    setRateLimited(false);
    setLoading(true);
    try {
      const result = await onSubmit(values);
      if (result?.rateLimited) {
        setRateLimited(true);
        setError(result.error ?? rateLimitedError);
      } else if (result?.error !== undefined) {
        // Empty string marks a failure without custom copy — fall back to the
        // generic default so nothing sensitive leaks into the message.
        setError(result.error || defaultError);
      }
    } catch (e) {
      const limited =
        typeof e === "object" && e !== null && "rateLimited" in e
          ? Boolean((e as { rateLimited?: unknown }).rateLimited)
          : false;
      if (limited) {
        setRateLimited(true);
        setError(rateLimitedError);
      } else {
        setError(networkError);
      }
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  };

  return { values, setValue, loading, error, rateLimited, submit, onKeyDown };
}
