"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "solid" | "outline" | "dashed" | "ghost" | "link";

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  /** White slide-up pill shown on hover. */
  tooltip?: string;
  /** aria-label override; required for icon-only buttons. */
  label?: string;
  /** Renders as <a>; external URLs (http(s)://) get target="_blank" auto-applied. */
  href?: string;
  /**
   * Anchor component for internal `href`s — pass your router's Link (e.g.
   * next/link) for client-side navigation + prefetch. External http(s) hrefs
   * always use a plain <a>. Defaults to a plain <a>.
   */
  linkComponent?: React.ElementType;
  /** Forwarded to `linkComponent` (e.g. next/link's prefetch) when set. */
  prefetch?: boolean;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  fullWidth?: boolean;
  /** CSS background applied to the root element. Transparent by default. */
  background?: string;
  /** When set, click copies this string to the clipboard. */
  copy?: string;
  /** Swaps into tooltip (and into children if children is a string) for 1.5s after copy. Defaults to "Copied!". */
  copyFeedback?: string;
  ref?: React.Ref<HTMLButtonElement | HTMLAnchorElement>;
};

const SIZE = {
  sm: { icon: "size-9", text: "px-3 py-1.5 text-sm" },
  md: { icon: "size-10", text: "px-4 py-2 text-sm" },
} as const;

const variantClass: Record<ButtonVariant, string> = {
  solid: "bg-white text-black hover:bg-white/90",
  outline: "border border-white/20 text-white hover:bg-white/5",
  dashed:
    "border border-dashed border-white/20 text-white/70 hover:text-white hover:bg-white/5",
  ghost: "text-white hover:bg-white/10 hover:shadow-sm",
  link: "text-white underline-offset-4 hover:underline",
};

export function Button({
  variant = "outline",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  tooltip,
  label,
  href,
  linkComponent,
  prefetch,
  onClick,
  className,
  children,
  type = "button",
  disabled,
  fullWidth,
  background,
  copy,
  copyFeedback = "Copied!",
  ref,
}: ButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const iconOnly = !children;
  const isLink = variant === "link";
  const hasIcon = Boolean(Icon || IconRight);
  const iconPx = !isLink && iconOnly ? (size === "sm" ? 18 : 20) : 16;

  const showFeedback = copy && copied;
  const tooltipShown = showFeedback ? copyFeedback : tooltip;
  const childrenShown =
    showFeedback && typeof children === "string" ? copyFeedback : children;

  const handleClick = async () => {
    if (copy) {
      try {
        await navigator.clipboard.writeText(copy);
        setCopied(true);
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopied(false), 1500);
      } catch {
        /* clipboard blocked */
      }
    }
    onClick?.();
  };

  const cls = cn(
    "group relative inline-flex items-center transition",
    disabled
      ? "opacity-60 cursor-not-allowed pointer-events-none"
      : "cursor-pointer",
    !isLink && SIZE[size][iconOnly ? "icon" : "text"],
    iconOnly && !isLink && "justify-center",
    hasIcon && !iconOnly && (isLink ? "gap-1.5" : "gap-2"),
    fullWidth && "w-full justify-center",
    variantClass[variant],
    className,
  );

  // Icon-only buttons have no visible text, so they need an accessible name:
  // prefer an explicit `label`, then fall back to `tooltip`. (Children are
  // absent when iconOnly.) Labelled buttons get their name from visible text.
  const ariaLabel = iconOnly ? (label ?? tooltip) : undefined;

  const content = (
    <>
      {tooltipShown && (
        <span aria-hidden className="pointer-events-none absolute bottom-full left-1/2 z-10 whitespace-nowrap bg-white px-2 py-1 text-[11px] text-black opacity-0 [transform:translate(-50%,4px)] transition-[opacity,transform] duration-150 group-hover:opacity-100 group-hover:[transform:translate(-50%,-4px)]">
          {tooltipShown}
        </span>
      )}
      {Icon && <Icon size={iconPx} aria-hidden />}
      {childrenShown}
      {IconRight && <IconRight size={iconPx} aria-hidden />}
    </>
  );

  // Precedence: `copy` (and `disabled`) win over `href`. When `copy` is set the
  // element must be a real <button> to run the clipboard handler, so we fall
  // through to the button branch and the anchor (href + onClick navigation) is
  // intentionally not rendered. Don't combine `copy` with `href`.
  if (href && !copy && !disabled) {
    const external = /^https?:\/\//.test(href);
    // Internal hrefs route through linkComponent (next/link, …) when provided,
    // so the host gets client-side navigation + prefetch. External links stay
    // plain <a> (a router Link can't own another origin).
    if (linkComponent && !external) {
      const LinkComp = linkComponent;
      return (
        <LinkComp
          ref={ref}
          href={href}
          aria-label={ariaLabel}
          className={cls}
          style={{ background }}
          {...(prefetch !== undefined ? { prefetch } : {})}
        >
          {content}
        </LinkComp>
      );
    }
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        aria-label={ariaLabel}
        className={cls}
        style={{ background }}
        {...(external && { target: "_blank", rel: "noopener noreferrer" })}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cls}
      style={{ background }}
    >
      {content}
    </button>
  );
}
