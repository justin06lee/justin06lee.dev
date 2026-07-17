"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/chrome/segmented";
import { Button } from "@/components/chrome/button";

export type CalendarView = "day" | "month" | "year";

export type CalendarNavProps = {
  /** The current period label, e.g. "June 2026". */
  label: ReactNode;
  /** Controlled active view. */
  view?: CalendarView;
  /** Views to offer in the switcher. Hidden when fewer than 2. */
  views?: CalendarView[];
  onViewChange?: (view: CalendarView) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  /** Label for the "jump to current period" button. */
  todayLabel?: ReactNode;
  /**
   * Anchor component for the nav controls — pass your router's Link (e.g.
   * next/link) to make prev / next / today / the view switcher client-side,
   * PREFETCHED links instead of callback buttons. This is the fix for slow
   * period-switching on server-rendered (force-dynamic) calendar routes: the
   * target route is prefetched on hover/mount, so the click navigates from
   * cache. Provide the matching *Href props below; controls without an href
   * fall back to their onX callback.
   */
  linkComponent?: React.ElementType;
  /** Href for the previous period. With linkComponent, renders a prefetched link. */
  prevHref?: string;
  /** Href for the next period. */
  nextHref?: string;
  /** Href for the current period ("today"). */
  todayHref?: string;
  /** Maps a view to its href, for the switcher. With linkComponent, each segment is a link. */
  viewHref?: (view: CalendarView) => string;
  /** Forwarded to linkComponent (e.g. next/link's prefetch) for every control. */
  prefetch?: boolean;
  className?: string;
};

/**
 * Period-navigation header that pairs with the calendar / heatmap / timeline
 * views: a day/month/year switcher on the left, prev / today / next controls
 * on the right. Controlled by default (callbacks, no router coupling); pass
 * `linkComponent` + the `*Href` props to render prefetched client-side links
 * instead — much faster period-switching on dynamic routes. Generalized from
 * the justin06lee.dev CalendarShell.
 */
export function CalendarNav({
  label,
  view,
  views = ["day", "month", "year"],
  onViewChange,
  onPrev,
  onNext,
  onToday,
  todayLabel = "today",
  linkComponent,
  prevHref,
  nextHref,
  todayHref,
  viewHref,
  prefetch,
  className,
}: CalendarNavProps) {
  const showSwitcher = views.length >= 2;
  const asLinks = Boolean(linkComponent);
  const LinkComp = linkComponent;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3 text-white",
        className,
      )}
    >
      {showSwitcher ? (
        asLinks && viewHref && LinkComp ? (
          // Link-based switcher — same look as Segmented, but each segment is a
          // prefetched anchor so switching views navigates from cache.
          <div role="group" aria-label="Calendar view" className="inline-flex items-center gap-1">
            {views.map((v) => {
              const active = v === view;
              return (
                <LinkComp
                  key={v}
                  href={viewHref(v)}
                  aria-current={active ? "page" : undefined}
                  {...(prefetch !== undefined ? { prefetch } : {})}
                  className={cn(
                    "border px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "border-white/40 text-white"
                      : "border-transparent text-white/40 hover:text-white/70",
                  )}
                >
                  {v}
                </LinkComp>
              );
            })}
          </div>
        ) : (
          <Segmented<CalendarView>
            value={view ?? views[0] ?? "day"}
            onChange={(v) => onViewChange?.(v)}
            options={views.map((v) => ({ value: v, label: v }))}
            ariaLabel="Calendar view"
          />
        )
      ) : (
        <span />
      )}

      <div className="flex items-center gap-1 text-sm">
        <Button
          variant="ghost"
          size="sm"
          icon={ChevronLeft}
          label="Previous"
          {...(asLinks && prevHref
            ? { href: prevHref, linkComponent, prefetch }
            : { onClick: onPrev, disabled: !onPrev })}
        />
        <span className="px-1 font-mono tabular-nums text-white/80">
          {label}
        </span>
        <Button
          variant="link"
          size="sm"
          className="text-white/60 hover:text-white"
          {...(asLinks && todayHref
            ? { href: todayHref, linkComponent, prefetch }
            : { onClick: onToday })}
        >
          {todayLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={ChevronRight}
          label="Next"
          {...(asLinks && nextHref
            ? { href: nextHref, linkComponent, prefetch }
            : { onClick: onNext, disabled: !onNext })}
        />
      </div>
    </div>
  );
}
