"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function OperatorLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    let res: Response;
    try {
      res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
    } catch {
      setError("Network error. Check your connection and try again.");
      return;
    }

    if (res.status === 429) {
      setError("Too many attempts. Try again later.");
      return;
    }

    if (res.status === 401) {
      setError("Incorrect password.");
      return;
    }

    if (!res.ok) {
      setError(`Sign in failed (${res.status}). Try again.`);
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm border border-border bg-surface p-6"
      >
        <h1 className="mb-4 flex items-baseline gap-2 text-xl font-normal tracking-tight text-foreground">
          Operator Access
        </h1>
        <p className="mb-4 text-sm text-muted">
          Enter the admin password to manage articles.
        </p>
        <label className="mb-2 block text-sm font-medium text-foreground">
          Password
        </label>
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mb-4 w-full border border-border bg-background px-3 py-2 text-foreground"
        />
        {error ? (
          <p
            role="alert"
            className="mb-4 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full border border-border bg-foreground px-4 py-2 text-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
