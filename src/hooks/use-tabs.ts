"use client";

import { useId, useRef, type KeyboardEvent } from "react";

export type TabItem<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type UseTabsOptions<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  items: TabItem<T>[];
  /** Loop focus from last back to first (and vice versa). Defaults to true. */
  loop?: boolean;
};

export type TabProps = {
  id: string;
  role: "tab";
  "aria-selected": boolean;
  "aria-controls": string;
  tabIndex: number;
  disabled?: boolean;
  ref: (el: HTMLButtonElement | null) => void;
  onClick: () => void;
};

export type UseTabsReturn<T extends string> = {
  tabListProps: {
    role: "tablist";
    onKeyDown: (e: KeyboardEvent) => void;
  };
  getTabProps: (value: T) => TabProps;
  /** id of the panel a given tab controls — wire onto your <Tabs.Panel>. */
  getPanelId: (value: T) => string;
};

/**
 * Headless tab-strip behavior: controlled selection, roving tabindex, and
 * arrow-key navigation with ARIA wiring. No styling — bring your own skin.
 *
 * Roving tabindex means only the active tab is in the tab order; arrows move
 * between tabs and shift selection, skipping disabled ones.
 */
export function useTabs<T extends string>({
  value,
  onValueChange,
  items,
  loop = true,
}: UseTabsOptions<T>): UseTabsReturn<T> {
  const baseId = useId();
  const refs = useRef(new Map<T, HTMLButtonElement | null>());

  const tabId = (v: T) => `${baseId}-tab-${v}`;
  const panelId = (v: T) => `${baseId}-panel-${v}`;

  const enabled = items.filter((i) => !i.disabled);

  const focusValue = (v: T) => {
    onValueChange(v);
    refs.current.get(v)?.focus();
  };

  const move = (dir: 1 | -1) => {
    if (enabled.length === 0) return;
    // If the controlled value points at a disabled (or unknown) tab, findIndex
    // returns -1. Start from the edge so the first arrow press lands on a sane
    // enabled tab instead of jumping off either end.
    const idx = enabled.findIndex((i) => i.value === value);
    const from = idx === -1 ? (dir === 1 ? -1 : enabled.length) : idx;
    let next = from + dir;
    if (next < 0) next = loop ? enabled.length - 1 : 0;
    if (next > enabled.length - 1) next = loop ? 0 : enabled.length - 1;
    const target = enabled[next];
    if (target) focusValue(target.value);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        if (enabled[0]) focusValue(enabled[0].value);
        break;
      case "End":
        e.preventDefault();
        if (enabled[enabled.length - 1]) focusValue(enabled[enabled.length - 1]!.value);
        break;
    }
  };

  return {
    tabListProps: { role: "tablist", onKeyDown },
    getTabProps: (v: T): TabProps => ({
      id: tabId(v),
      role: "tab",
      "aria-selected": v === value,
      "aria-controls": panelId(v),
      tabIndex: v === value ? 0 : -1,
      disabled: items.find((i) => i.value === v)?.disabled,
      ref: (el) => {
        if (el) refs.current.set(v, el);
        else refs.current.delete(v);
      },
      onClick: () => onValueChange(v),
    }),
    getPanelId: panelId,
  };
}
