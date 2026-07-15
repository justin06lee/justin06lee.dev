"use client";

import React, { useState } from "react";
import {
  type LucideIcon,
  Github,
  Linkedin,
  Mail,
  Youtube,
  Instagram,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

// X (formerly Twitter) — not in lucide, so we ship the glyph inline.
const XIcon: LucideIcon = Object.assign(
  React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
    function XIcon(props, ref) {
      return (
        <svg ref={ref} viewBox="0 0 24 24" fill="currentColor" {...props}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    },
  ),
  { displayName: "XIcon" },
) as unknown as LucideIcon;

export type SocialKey =
  | "github"
  | "linkedin"
  | "x"
  | "email"
  | "youtube"
  | "instagram"
  | "website";

export type SocialLinks = Partial<Record<SocialKey, string>>;

export type SocialsProps = {
  /** Map of platform to url (or bare email address for `email`). Empty entries are skipped. */
  links: SocialLinks;
  size?: "sm" | "md" | "lg";
  gap?: "tight" | "normal" | "loose";
  className?: string;
};

const sizeMap = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
  lg: "h-11 w-11",
} as const;

const gapMap = {
  tight: "gap-1.5",
  normal: "gap-2.5",
  loose: "gap-4",
} as const;

const iconSizeMap = { sm: 16, md: 18, lg: 20 } as const;

type SocialItem = {
  key: SocialKey;
  href: string;
  label: string;
  tooltip: string;
  Icon: LucideIcon;
};

const ORDER: Array<{ key: SocialKey; label: string; tooltip: string; Icon: LucideIcon }> = [
  { key: "github", label: "GitHub", tooltip: "GitHub", Icon: Github },
  { key: "linkedin", label: "LinkedIn", tooltip: "LinkedIn", Icon: Linkedin },
  { key: "x", label: "X", tooltip: "X", Icon: XIcon },
  { key: "email", label: "Email", tooltip: "Copy email", Icon: Mail },
  { key: "youtube", label: "YouTube", tooltip: "YouTube", Icon: Youtube },
  { key: "instagram", label: "Instagram", tooltip: "Instagram", Icon: Instagram },
  { key: "website", label: "Website", tooltip: "Website", Icon: Globe },
];

const tooltipClass =
  "pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 translate-y-1 whitespace-nowrap " +
  "bg-white px-2 py-1 text-[11px] text-black opacity-0 transition-all duration-150 " +
  "group-hover:-translate-y-1 group-hover:opacity-100 group-focus-visible:-translate-y-1 group-focus-visible:opacity-100";

function SocialButton({
  item,
  iconSize,
  btnClass,
}: {
  item: SocialItem;
  iconSize: number;
  btnClass: string;
}) {
  const [copied, setCopied] = useState(false);
  const { key, href, label, tooltip, Icon } = item;
  const tooltipText = key === "email" && copied ? "Copied!" : tooltip;

  const inner = (
    <>
      <span className={tooltipClass}>{tooltipText}</span>
      <Icon aria-hidden width={iconSize} height={iconSize} />
      <span className="sr-only">{label}</span>
    </>
  );

  if (key === "email") {
    return (
      <button
        type="button"
        aria-label={label}
        className={cn("group relative", btnClass)}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(href);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // clipboard unavailable (e.g. insecure context) — fall back to mailto.
            window.location.href = `mailto:${href}`;
          }
        }}
      >
        {inner}
      </button>
    );
  }

  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("group relative", btnClass)}
    >
      {inner}
    </a>
  );
}

/**
 * Row of social links. Pass a `links` map; only the platforms you provide are
 * rendered. The email entry copies the address to the clipboard on click
 * (white slide-up tooltip on hover/focus). Framework-agnostic — plain anchors.
 */
export function Socials({ links, size = "md", gap = "normal", className }: SocialsProps) {
  const items: SocialItem[] = ORDER.filter(
    (r) => typeof links[r.key] === "string" && links[r.key]!.length > 0,
  ).map((r) => ({ ...r, href: links[r.key]! }));

  if (!items.length) return null;

  const iconSize = iconSizeMap[size];
  const btnClass = cn(
    sizeMap[size],
    "inline-flex items-center justify-center text-white/80 transition-colors hover:bg-white/10 hover:text-white",
  );

  return (
    <nav
      aria-label="Social links"
      className={cn("flex flex-wrap items-center", gapMap[gap], className)}
    >
      {items.map((item) => (
        <SocialButton key={item.key} item={item} iconSize={iconSize} btnClass={btnClass} />
      ))}
    </nav>
  );
}
