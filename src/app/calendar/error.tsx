"use client";

/**
 * Route-level error boundary for /calendar/*. A Turso/data hiccup that escapes
 * a server component (e.g. the day page's data load) lands here instead of the
 * app-wide 500 — dark, lowercase, with a reset() retry.
 */
export default function CalendarError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
        something broke
      </div>
      <p className="text-sm text-white/60">the calendar hit an error.</p>
      <button
        type="button"
        onClick={reset}
        className="text-xs border border-white/40 px-3 py-1 transition hover:bg-white hover:text-black"
      >
        try again
      </button>
    </div>
  );
}
