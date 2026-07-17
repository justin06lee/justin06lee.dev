"use client";

import React, { useState } from "react";
import { type LucideIcon, Mail, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

// Newer lucide releases dropped the brand glyphs (github, linkedin, youtube,
// instagram), so we ship them inline instead of importing — paths copied
// verbatim from lucide-react 0.540.0 (ISC) so the rendered icons match.
function brandIcon(displayName: string, children: React.ReactNode): LucideIcon {
  return Object.assign(
    React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
      function BrandIcon(props, ref) {
        return (
          <svg
            ref={ref}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
          >
            {children}
          </svg>
        );
      },
    ),
    { displayName },
  ) as unknown as LucideIcon;
}

const GithubIcon = brandIcon(
  "GithubIcon",
  <>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </>,
);

const LinkedinIcon = brandIcon(
  "LinkedinIcon",
  <>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </>,
);

const YoutubeIcon = brandIcon(
  "YoutubeIcon",
  <>
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" />
  </>,
);

const InstagramIcon = brandIcon(
  "InstagramIcon",
  <>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </>,
);

// X (formerly Twitter) — never in lucide; a filled glyph, unlike the rest.
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
  { key: "github", label: "GitHub", tooltip: "GitHub", Icon: GithubIcon },
  { key: "linkedin", label: "LinkedIn", tooltip: "LinkedIn", Icon: LinkedinIcon },
  { key: "x", label: "X", tooltip: "X", Icon: XIcon },
  { key: "email", label: "Email", tooltip: "Copy email", Icon: Mail },
  { key: "youtube", label: "YouTube", tooltip: "YouTube", Icon: YoutubeIcon },
  { key: "instagram", label: "Instagram", tooltip: "Instagram", Icon: InstagramIcon },
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
