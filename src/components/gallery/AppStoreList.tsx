import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AppCard } from "@/lib/app-store";

/*
 * The one place on the site that is not the site's own design language. This
 * is the App Store, deliberately: continuous-corner icons, grey pills with blue capitals, hairline separators
 * inset to the text, 8e8e93 secondary labels on black. Nothing here should
 * pick up the mono uppercase tracking or the 1px square borders used
 * everywhere else, and nothing elsewhere should pick this up.
 */

export const APPSTORE_CSS = `
.appstore {
  font-family: var(--font-poppins), sans-serif;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.appstore-icon {
  -webkit-mask-image: url("${squircleMask()}");
  mask-image: url("${squircleMask()}");
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}
.appstore-hairline { box-shadow: inset 0 -0.5px 0 #38383a; }
.appstore-scroll { scrollbar-width: none; }
.appstore-scroll::-webkit-scrollbar { display: none; }
`;

/**
 * The iOS icon outline is a superellipse, not a rounded rectangle — the
 * corner curvature ramps in rather than starting abruptly. |x|^n + |y|^n = 1
 * with n = 5 is the usual approximation, traced here as an SVG path for a
 * CSS mask so any size gets the same shape.
 */
function squircleMask(): string {
  const n = 5;
  const steps = 96;
  const pts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = 50 + 50 * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = 50 + 50 * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><polygon points='${pts.join(" ")}'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export type AppStoreListProps = {
  apps: AppCard[];
  /** Anchor for the row's internal link — pass next/link for client-side navigation. */
  linkComponent?: ElementType;
  className?: string;
  ariaLabel?: string;
};

/** The store, with its large title: what the gallery's apps section renders. */
export function AppStore({
  title = "Apps",
  subtitle,
  ...list
}: AppStoreListProps & { title?: string; subtitle?: string }) {
  return (
    <section className="appstore text-white">
      <style precedence="default" href="appstore">{APPSTORE_CSS}</style>
      <header className="mb-2">
        <h2 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em]">{title}</h2>
        {subtitle && <p className="mt-1 text-[15px] text-[#8e8e93]">{subtitle}</p>}
      </header>
      <AppStoreList {...list} />
    </section>
  );
}

/**
 * Search-results rows: icon, name, one line, a pill, then three screenshots
 * when the README has any. The whole row is the product page's link, and
 * the pill is the app's. Two anchors can't nest, so the row link is a
 * stretched overlay behind the text and the pill sits above it — both stay
 * real links (middle click, hover status, copy address).
 */
export function AppStoreList({ apps, linkComponent = "a", className, ariaLabel = "apps" }: AppStoreListProps) {
  return (
    <ul
      aria-label={ariaLabel}
      className={cn("appstore grid list-none grid-cols-1 gap-x-12 p-0 md:grid-cols-2", className)}
    >
      <style precedence="default" href="appstore">{APPSTORE_CSS}</style>
      {apps.map((app) => (
        <li key={app.id}>
          <AppRow app={app} linkComponent={linkComponent} />
        </li>
      ))}
    </ul>
  );
}

const MAX_STRIP = 3;

export function AppRow({ app, linkComponent = "a" }: { app: AppCard; linkComponent?: ElementType }) {
  const Anchor = linkComponent;
  return (
    <article className="group relative py-3">
      <Anchor
        href={app.href}
        aria-label={`${app.title}, details`}
        className="absolute -inset-x-3 inset-y-0 z-0 rounded-[14px] outline-none transition-colors group-hover:bg-white/[0.04] focus-visible:bg-white/[0.06]"
      />

      <div className="pointer-events-none relative z-10 flex items-center gap-3.5">
        <AppIcon app={app} size={64} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-semibold leading-[1.25]">{app.title}</h3>
          <p className="mt-0.5 truncate text-[15px] leading-[1.3] text-[#8e8e93]">{app.subtitle}</p>
        </div>
        {app.open && <OpenButton href={app.open.href} title={app.title} />}
      </div>

      {app.screenshots.length > 0 && (
        <div className="pointer-events-none relative z-10 mt-3.5 grid grid-cols-3 gap-2">
          {app.screenshots.slice(0, MAX_STRIP).map((shot) => (
            <div
              key={shot.src}
              className="aspect-[16/10] overflow-hidden rounded-[10px] bg-[#1c1c1e] ring-1 ring-inset ring-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.src}
                alt=""
                loading="lazy"
                draggable={false}
                className="h-full w-full object-cover object-top"
              />
            </div>
          ))}
        </div>
      )}

      <div aria-hidden className="appstore-hairline pointer-events-none absolute inset-x-0 bottom-0 ml-[78px] h-px" />
    </article>
  );
}

/** A continuous-corner icon tile; the art is kept whole inside it. */
export function AppIcon({ app, size, className }: { app: AppCard; size: number; className?: string }) {
  return (
    <span
      className={cn("appstore-icon flex shrink-0 items-center justify-center overflow-hidden bg-[#1c1c1e]", className)}
      style={{ width: size, height: size }}
    >
      {app.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={app.icon.src}
          alt=""
          loading="lazy"
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-[#8e8e93]" style={{ fontSize: Math.round(size * 0.3), fontWeight: 600 }}>
          {app.title.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/**
 * OPEN. One button, one word: it opens the site when the project has one and
 * the source when it doesn't — the store's job is to open the thing, not to
 * explain where it lives. `primary` is the filled blue of a product page,
 * the default is the grey pill of a results row.
 */
export function OpenButton({
  href,
  title,
  primary = false,
  className,
}: {
  href: string;
  title: string;
  primary?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`open ${title}`}
      className={cn(
        "pointer-events-auto relative z-10 inline-flex shrink-0 items-center justify-center rounded-full font-bold uppercase tracking-[0.01em] outline-none transition-[background-color,transform] active:scale-95",
        primary
          ? "h-[32px] bg-[#0a84ff] px-6 text-[15px] text-white hover:bg-[#3395ff] focus-visible:ring-2 focus-visible:ring-white/60"
          : "h-[28px] bg-[rgba(120,120,128,0.24)] px-[18px] text-[15px] text-[#0a84ff] hover:bg-[rgba(120,120,128,0.36)] focus-visible:ring-2 focus-visible:ring-[#0a84ff]/60",
        className,
      )}
    >
      open
    </a>
  );
}

/** A store section title, with an optional trailing action in blue. */
export function StoreHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-[22px] font-bold leading-tight tracking-[-0.015em]">{children}</h2>
      {action}
    </div>
  );
}
