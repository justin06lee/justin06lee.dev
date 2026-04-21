"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyCodeButton({ codeRef }: { codeRef: React.RefObject<HTMLPreElement | null> }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = codeRef.current?.innerText ?? "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-white/40 hover:text-white"
      aria-label="Copy code"
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}
