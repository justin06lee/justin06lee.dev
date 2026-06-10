"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type AlertOptions = {
  title: string;
  message?: string;
  okText?: string;
};

type DialogState =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "alert"; options: AlertOptions; resolve: () => void }
  | null;

type DialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({ kind: "confirm", options, resolve })),
    [],
  );

  const alert = useCallback(
    (options: AlertOptions) =>
      new Promise<void>((resolve) => setState({ kind: "alert", options, resolve })),
    [],
  );

  const close = useCallback(
    (resolved: boolean) => {
      if (!state) return;
      if (state.kind === "confirm") state.resolve(resolved);
      else state.resolve();
      setState(null);
    },
    [state],
  );

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      // stop Escape from also reaching globally-listening components (e.g. an open Select) beneath the modal
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      }
      if (e.key === "Enter") close(true);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, close]);

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-sm border border-white/20 bg-black p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="space-y-2">
              <div className="text-xs font-mono uppercase tracking-widest text-white/50">
                {state.kind === "confirm" ? "Confirm" : "Notice"}
              </div>
              <div className="text-sm text-white">{state.options.title}</div>
              {state.options.message && (
                <div className="text-xs text-white/60 whitespace-pre-line">{state.options.message}</div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              {state.kind === "confirm" && (
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="text-xs text-white/60 hover:text-white px-3 py-1"
                >
                  {state.options.cancelText ?? "Cancel"}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className={`text-xs border px-3 py-1 transition ${
                  state.kind === "confirm" && state.options.danger
                    ? "border-red-400/60 text-red-300 hover:bg-red-400/10"
                    : "border-white/40 hover:bg-white hover:text-black"
                }`}
              >
                {state.kind === "confirm"
                  ? state.options.confirmText ?? "OK"
                  : state.options.okText ?? "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
