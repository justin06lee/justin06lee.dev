"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type UseMenuOptions = {
  itemCount: number;
  /** Activate the item at the given index (Enter/Space on the highlighted row). */
  onActivate?: (i: number) => void;
};

export type UseMenuReturn = {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Index of the keyboard-highlighted item, or -1. */
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  /** Wrap the trigger + dropdown; an outside click closes the menu. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Build a stable per-item id for aria-activedescendant wiring. */
  itemId: (i: number) => string;
  /** Spread onto the trigger button. */
  triggerProps: {
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
    onClick: () => void;
    onKeyDown: (e: KeyboardEvent) => void;
  };
  /** Spread onto the menu container; handles arrow/Enter/Escape. */
  menuProps: {
    ref: React.RefObject<HTMLDivElement | null>;
    role: "menu";
    tabIndex: -1;
    "aria-activedescendant": string | undefined;
    onKeyDown: (e: KeyboardEvent) => void;
  };
  /** Call when an item is chosen — closes and resets. */
  onSelect: (run: () => void) => void;
};

/**
 * Headless action-menu behavior: open state, outside-click + Escape close, and
 * arrow-key navigation with a highlighted item. No styling.
 */
export function useMenu({ itemCount, onActivate }: UseMenuOptions): UseMenuReturn {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Element focused when the menu opened (the trigger) — restored on
  // Escape/select close so focus doesn't drop to document.body.
  const triggerElRef = useRef<HTMLElement | null>(null);
  const baseId = useId();

  // Keep the latest onActivate without re-subscribing handlers.
  const activateRef = useRef(onActivate);
  activateRef.current = onActivate;

  const itemId = (i: number) => `${baseId}-item-${i}`;

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    // Focus the menu so its onKeyDown (Arrow/Enter/Escape) fires on open.
    triggerElRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    menuRef.current?.focus();
    const onPointer = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  const move = (dir: 1 | -1) => {
    if (itemCount === 0) return;
    setActiveIndex((i) => {
      const next = i + dir;
      if (next < 0) return itemCount - 1;
      if (next > itemCount - 1) return 0;
      return next;
    });
  };

  const triggerKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(0);
    }
  };

  const menuKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Enter":
      case " ":
        if (activeIndex >= 0 && activeIndex < itemCount) {
          e.preventDefault();
          activateRef.current?.(activeIndex);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        triggerElRef.current?.focus();
        break;
    }
  };

  return {
    open,
    setOpen,
    activeIndex,
    setActiveIndex,
    containerRef,
    itemId,
    triggerProps: {
      "aria-haspopup": "menu",
      "aria-expanded": open,
      onClick: () => setOpen(!open),
      onKeyDown: triggerKeyDown,
    },
    menuProps: {
      ref: menuRef,
      role: "menu",
      tabIndex: -1,
      "aria-activedescendant":
        activeIndex >= 0 && activeIndex < itemCount ? itemId(activeIndex) : undefined,
      onKeyDown: menuKeyDown,
    },
    onSelect: (run: () => void) => {
      run();
      setOpen(false);
      triggerElRef.current?.focus();
    },
  };
}
