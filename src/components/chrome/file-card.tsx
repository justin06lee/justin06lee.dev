"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Stack } from "@/components/chrome/stack";

export interface FileCardProps {
  /** file name shown on the front paper. */
  name: string;
  /** small uppercase kicker line above the name, e.g. "pdf · 1.2 mb". */
  meta?: string;
  /** link target; renders the card as an anchor. */
  href?: string;
  /** click handler; without href the card renders as a <button>. */
  onClick?: () => void;
  /** sets the anchor's download attribute (true, or a filename to save as). */
  download?: boolean | string;
  /** anchor element/component — pass your router's Link. default "a". */
  linkComponent?: React.ElementType;
  /** paper layers behind the front card, forwarded to stack. default 1. */
  layers?: number;
  className?: string;
}

/**
 * Animated stacked-paper file card. The papers fan out on hover (a spring
 * transition handled by `stack`, which sits still under
 * prefers-reduced-motion). Renders as a link when `href` is set, a button
 * when only `onClick` is set, and a plain block otherwise.
 */
export function FileCard({
  name,
  meta,
  href,
  onClick,
  download,
  linkComponent: LinkComponent = "a",
  layers = 1,
  className,
}: FileCardProps) {
  const content = (
    <Stack layers={layers} className="h-full w-full">
      <div className="flex h-full flex-col justify-between p-4 text-left">
        <div aria-hidden className="space-y-2">
          <div className="h-px w-full bg-white/15" />
          <div className="h-px w-5/6 bg-white/15" />
          <div className="h-px w-2/3 bg-white/15" />
        </div>
        <div>
          {meta && (
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
              {meta}
            </p>
          )}
          <p className={cn("text-sm font-medium leading-6 text-white", meta && "mt-2")}>
            {name}
          </p>
        </div>
      </div>
    </Stack>
  );

  const rootClass = cn(
    "block h-44 w-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50",
    className,
  );

  if (href) {
    return (
      <LinkComponent
        href={href}
        onClick={onClick}
        className={rootClass}
        {...(download !== undefined && { download })}
      >
        {content}
      </LinkComponent>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rootClass}>
        {content}
      </button>
    );
  }
  return <div className={rootClass}>{content}</div>;
}
