"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/chrome/input";
import {
  useLoginForm,
  type LoginCredentials,
  type LoginSubmitResult,
} from "@/hooks/use-login-form";

export type LoginField = {
  name: string;
  label?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
};

export type LoginFormProps = {
  /**
   * Caller-supplied submit. Resolve to succeed; return `{ error }` /
   * `{ rateLimited: true }`, or throw, to fail. No transport assumed.
   */
  onSubmit: (credentials: LoginCredentials) => Promise<LoginSubmitResult>;
  /** Fields to render. Defaults to a single password field. */
  fields?: LoginField[];
  title?: string;
  submitLabel?: string;
  loadingLabel?: string;
  className?: string;
};

const DEFAULT_FIELDS: LoginField[] = [
  {
    name: "password",
    label: "password",
    type: "password",
    placeholder: "password",
    autoComplete: "current-password",
  },
];

/**
 * Styled login view over the headless useLoginForm hook. Renders one or more
 * fields, an error line (generic or rate-limited), and a submit button that
 * reflects the loading state. Plain <form> — no router, no fetch.
 *
 * Security notes: credentials only ever flow to the injected onSubmit (never
 * logged, stored, or echoed into the UI), submission is preventDefault-only so
 * values can't leak into a URL, and default error copy is generic. Rate
 * limiting and account lockout are the consumer backend's responsibility —
 * surface them via the `rateLimited` result flag.
 */
export function LoginForm({
  onSubmit,
  fields = DEFAULT_FIELDS,
  title = "log in",
  submitLabel = "log in",
  loadingLabel = "signing in...",
  className,
}: LoginFormProps) {
  const form = useLoginForm({
    onSubmit,
    fields: fields.map((f) => f.name),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.submit();
      }}
      className={cn("flex w-full max-w-sm flex-col gap-3", className)}
    >
      {title && (
        <h1 className="text-center text-sm lowercase text-white">{title}</h1>
      )}

      {fields.map((field, i) => {
        const type = field.type ?? "text";
        const secret = type === "password";
        return (
        <Input
          key={field.name}
          name={field.name}
          type={type}
          aria-label={field.label ?? field.name}
          placeholder={field.placeholder ?? field.label ?? field.name}
          autoComplete={
            field.autoComplete ?? (secret ? "current-password" : undefined)
          }
          // Keep secrets away from spellcheck/autocorrect services.
          spellCheck={secret ? false : undefined}
          autoCapitalize={secret ? "none" : undefined}
          autoCorrect={secret ? "off" : undefined}
          autoFocus={i === 0}
          value={form.values[field.name] ?? ""}
          disabled={form.loading}
          onChange={(e) => form.setValue(field.name, e.target.value)}
          onKeyDown={form.onKeyDown}
          className="w-full"
        />
        );
      })}

      {form.error && (
        <p
          className={cn(
            "text-center text-xs lowercase",
            form.rateLimited ? "text-amber-400" : "text-red-400",
          )}
        >
          {form.error}
        </p>
      )}

      <button
        type="submit"
        disabled={form.loading}
        className={cn(
          "w-full border border-white/20 bg-white/90 px-4 py-1.5 text-sm",
          "lowercase text-black transition-colors hover:bg-white",
          "disabled:opacity-60",
        )}
      >
        {form.loading ? loadingLabel : submitLabel}
      </button>
    </form>
  );
}
