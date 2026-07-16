import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = {
  label: ReactNode;
  href?: string;
};

export type BreadcrumbProps = {
  /** Trail items, root first. The last item renders as the current page (no link, muted). */
  items: Crumb[];
  /** Node placed between crumbs. Defaults to a lucide ChevronRight. */
  separator?: ReactNode;
  /** Optional leading "home" link prepended before `items`. */
  homeHref?: string;
  className?: string;
};

/**
 * Presentational breadcrumb trail. Framework-agnostic — links are plain <a href>.
 * The last item is always rendered as the current page: muted and not a link.
 */
export function Breadcrumb({
  items,
  separator,
  homeHref,
  className,
}: BreadcrumbProps) {
  const sep = separator ?? (
    <ChevronRight className="size-3.5 text-white/30" aria-hidden="true" />
  );

  const trail: Crumb[] = homeHref
    ? [{ label: "home", href: homeHref }, ...items]
    : items;

  return (
    <nav
      aria-label="breadcrumb"
      className={cn(
        "flex min-w-0 items-center gap-2 text-sm font-mono tabular-nums",
        className,
      )}
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-2">
        {trail.map((crumb, i) => {
          const isLast = i === trail.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && <span className="flex items-center">{sep}</span>}
              {isLast || !crumb.href ? (
                <span
                  className="truncate text-white"
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              ) : (
                <a
                  href={crumb.href}
                  className="truncate text-white/60 underline-offset-4 hover:text-white hover:underline"
                >
                  {crumb.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type CrumbsFromPathOptions = {
  /** Map a raw segment to a display label. Defaults to decode + dashes to spaces. */
  labels?: (segment: string, index: number) => ReactNode;
  /** Path prefix stripped before splitting, e.g. "/desk". Becomes the first href. */
  basePath?: string;
};

/**
 * Split a pathname into a Crumb[] — each segment is decoded and dashes become spaces.
 * Each crumb's href is the cumulative path; the final segment is still given an href
 * (the Breadcrumb component renders the last item as current regardless).
 */
export function crumbsFromPath(
  pathname: string,
  { labels, basePath }: CrumbsFromPathOptions = {},
): Crumb[] {
  const base = basePath ?? "";
  const rest = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const segments = rest.split("/").filter(Boolean);

  const defaultLabel = (segment: string) => {
    // An invalid percent-escape throws — fall back to the raw segment.
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {}
    return decoded.replace(/-/g, " ");
  };

  return segments.map((segment, i) => ({
    label: labels?.(segment, i) ?? defaultLabel(segment),
    href: `${base}/${segments.slice(0, i + 1).join("/")}`,
  }));
}
