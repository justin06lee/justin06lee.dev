
import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  type LucideIcon,
  Github,
  Linkedin,
  Mail,
  Youtube,
  Instagram,
  Globe,
  Twitter,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  variant?: "ghost" | "outline" | "secondary" | "default" | "link";
  rounded?: boolean;
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
  Icon: LucideIcon;
};

const itemsConfig = (links: SocialLinks): SocialItem[] => {
  const items: SocialItem[] = [
    { key: "github", href: links.github, label: "GitHub", Icon: Github },
    { key: "linkedin", href: links.linkedin, label: "LinkedIn", Icon: Linkedin },
    { key: "x", href: links.x, label: "X", Icon: Twitter },
    { key: "email", href: links.email, label: "Email", Icon: Mail },
    { key: "youtube", href: links.youtube, label: "YouTube", Icon: Youtube },
    { key: "instagram", href: links.instagram, label: "Instagram", Icon: Instagram },
    { key: "website", href: links.website, label: "Website", Icon: Globe },
  ];

  // keep only those with a non-empty href
  return items.filter((r) => typeof r.href === "string" && r.href.length > 0);
};

export default function SocialBar({
  links,
  size = "md",
  variant = "ghost",
  rounded = true,
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

  return (
    <TooltipProvider>
      <nav
        aria-label="Social links"
        className={cn("flex flex-wrap items-center", gapMap[gap], className)}
      >
        {items.map(({ key, href, label, Icon }) => {
          if (key === "email" && href) {
            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <Button
                    variant={variant}
                    size="icon"
                    className={cn(
                      sizeMap[size],
                      rounded ? "rounded-full" : "rounded-xl",
                      "transition-shadow hover:shadow-sm"
                    )}
                    onClick={() => handleCopy(href)}
                  >
                    <Icon aria-hidden width={iconSize} height={iconSize} />
                    <span className="sr-only">{label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>Copy Email</TooltipContent>
              </Tooltip>
            );
          }

          const isExternal = typeof href === "string" && !href.startsWith("/");

          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <Button
                  variant={variant}
                  size="icon"
                  className={cn(
                    sizeMap[size],
                    rounded ? "rounded-full" : "rounded-xl",
                    "transition-shadow hover:shadow-sm"
                  )}
                  asChild
                >
                  {isExternal ? (
                    <a
                      href={href}
                      aria-label={label}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon aria-hidden width={iconSize} height={iconSize} />
                      <span className="sr-only">{label}</span>
                    </a>
                  ) : (
                    <Link href={href ?? "#"} aria-label={label}>
                      <Icon aria-hidden width={iconSize} height={iconSize} />
                      <span className="sr-only">{label}</span>
                    </Link>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
