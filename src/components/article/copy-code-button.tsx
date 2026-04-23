"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, AlertCircle } from "lucide-react";

type Status = "idle" | "copied" | "error";

export function CopyCodeButton({
  codeRef,
}: {
  codeRef: React.RefObject<HTMLPreElement | null>;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    const pre = codeRef.current;
    if (!pre) return;
    const code = pre.querySelector("code");
    const text = (code ?? pre).textContent ?? "";
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus("idle"), 2000);
  };

  const Icon =
    status === "copied" ? Check : status === "error" ? AlertCircle : Copy;
  const label =
    status === "copied"
      ? "Copied"
      : status === "error"
        ? "Copy failed"
        : "Copy code";

  return (
    <button
      type="button"
      onClick={handleCopy}
      tabIndex={status === "idle" ? -1 : 0}
      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition text-white/40 hover:text-white focus:text-white focus:outline-none"
      aria-label={label}
      title={label}
    >
      <Icon className="size-4" />
    </button>
  );
}
