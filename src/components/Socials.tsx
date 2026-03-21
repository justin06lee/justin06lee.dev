"use client";

import React, { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  type LucideIcon,
  Github,
  Linkedin,
  Mail,
  Youtube,
  Instagram,
  Globe,
} from "lucide-react";

// X (formerly Twitter) icon
const XIcon: LucideIcon = Object.assign(
  React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
    function XIcon(props, ref) {
      return (
        <svg ref={ref} viewBox="0 0 24 24" fill="currentColor" {...props}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    }
  ),
  { displayName: "XIcon" }
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

export type SocialBarProps = {
  links: SocialLinks;
  size?: "sm" | "md" | "lg";
  className?: string;
  gap?: "tight" | "normal" | "loose";
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
  href?: string;
  label: string;
  tooltip: string;
  Icon: LucideIcon;
};

const itemsConfig = (links: SocialLinks): SocialItem[] => {
  const items: SocialItem[] = [
    { key: "github", href: links.github, label: "GitHub", tooltip: "GitHub", Icon: Github },
    { key: "linkedin", href: links.linkedin, label: "LinkedIn", tooltip: "LinkedIn", Icon: Linkedin },
    { key: "x", href: links.x, label: "X", tooltip: "X", Icon: XIcon },
    { key: "email", href: links.email, label: "Email", tooltip: "Copy email", Icon: Mail },
    { key: "youtube", href: links.youtube, label: "YouTube", tooltip: "YouTube", Icon: Youtube },
    { key: "instagram", href: links.instagram, label: "Instagram", tooltip: "Instagram", Icon: Instagram },
    { key: "website", href: links.website, label: "Website", tooltip: "Website", Icon: Globe },
  ];

  return items.filter((r) => typeof r.href === "string" && r.href.length > 0);
};

function SocialButton({
  item,
  iconSize,
  btnClass,
  onCopy,
}: {
  item: SocialItem;
  iconSize: number;
  btnClass: string;
  onCopy: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const { key, href, label, tooltip, Icon } = item;

  const tooltipText = key === "email" && copied ? "Copied!" : tooltip;

  const handleEmailClick = () => {
    if (href) {
      onCopy(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const inner = (
    <>
      <span className="social-tooltip">{tooltipText}</span>
      <Icon aria-hidden width={iconSize} height={iconSize} />
      <span className="sr-only">{label}</span>
    </>
  );

  if (key === "email" && href) {
    return (
      <button
        className={cn("social-tooltip-wrap", btnClass)}
        onClick={handleEmailClick}
      >
        {inner}
      </button>
    );
  }

  const isExternal = typeof href === "string" && !href.startsWith("/");

  if (isExternal) {
    return (
      <a
        href={href}
        aria-label={label}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("social-tooltip-wrap", btnClass)}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={href ?? "#"} aria-label={label} className={cn("social-tooltip-wrap", btnClass)}>
      {inner}
    </Link>
  );
}

export default function SocialBar({
  links,
  size = "md",
  className,
  gap = "normal",
}: SocialBarProps) {
  const items = itemsConfig(links);
  const iconSize = iconSizeMap[size];

  if (!items.length) return null;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy email", err);
    }
  };

  const btnClass = cn(
    sizeMap[size],
    "inline-flex items-center justify-center hover:bg-white/10 transition-shadow hover:shadow-sm"
  );

  return (
    <nav
      aria-label="Social links"
      className={cn("flex flex-wrap items-center", gapMap[gap], className)}
    >
      {items.map((item) => (
        <SocialButton
          key={item.key}
          item={item}
          iconSize={iconSize}
          btnClass={btnClass}
          onCopy={handleCopy}
        />
      ))}
    </nav>
  );
}
