"use client";

import { useEffect, useRef, useState } from "react";

export type UseNavbarReturn = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  close: () => void;
  /** Attach to the mobile panel; an outside click or Escape closes it. */
  panelRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * Headless mobile-nav behavior: open state, outside-click + Escape to close, and
 * a body scroll-lock while the panel is open. No styling.
 */
export function useNavbar(): UseNavbarReturn {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Outside-click + Escape close — only wired while open.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Lock body scroll while the panel covers the page.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return {
    open,
    setOpen,
    toggle: () => setOpen(!open),
    close: () => setOpen(false),
    panelRef,
  };
}
