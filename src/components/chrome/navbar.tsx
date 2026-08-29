"use client";

import * as motion from "motion/react-client";
import { AnimatePresence } from "motion/react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavbar } from "@/hooks/use-navbar";

export type NavLink = {
  /** Plain text or any node (e.g. a styled span). */
  label: React.ReactNode;
  /** Renders a plain <a href>. Omit it (with onClick) to render a <button> instead. */
  href?: string;
  /** Runs on click. Without href the item is a <button>; with href it runs alongside navigation. */
  onClick?: () => void;
  /** Stable React key. Recommended when labels are nodes or hrefs repeat (e.g. "#"). */
  id?: string;
};

export type NavbarEntrance = {
  /** Starting vertical offset in px (animates to 0). Default -10. */
  y?: number;
  /** Animation duration in seconds. Default 0.8. */
  duration?: number;
  /** Delay before the animation starts, in seconds. Default 0. */
  delay?: number;
};

export type NavbarProps = {
  /** Left-side brand — your logo, name, or any node. */
  brand?: React.ReactNode;
  /** Items next to the brand on desktop; listed before `links` in the mobile panel. */
  leftLinks?: NavLink[];
  /** Right-side items on desktop; listed after `leftLinks` in the mobile panel. */
  links?: NavLink[];
  /** Right-side extras shown on desktop (e.g. a theme toggle). */
  actions?: React.ReactNode;
  className?: string;
  /** Heading shown at the top of the mobile panel. Defaults to "menu". */
  menuLabel?: string;
  /**
   * Anchor component for internal `href`s — pass your router's Link (e.g.
   * next/link) for client-side navigation. External http(s) and "#" hrefs
   * always render a plain <a>. Defaults to a plain <a>.
   */
  linkComponent?: React.ElementType;
  /**
   * Fade + slide the bar in on mount. `true` uses the house entrance
   * (y: -10, 0.8s); pass an object to tune offset, duration and delay.
   *
   * Use this instead of wrapping <Navbar> in your own animating element. The
   * nav is `position: fixed`, so a wrapper carrying a `transform` becomes its
   * containing block and `inset-x-0` resolves against the wrapper's box rather
   * than the viewport — the bar renders at the wrapper's width and only snaps
   * to full width when the transform resolves back to `none` (or never, for a
   * CSS animation with `fill-mode: both`, which lands on `translate(0,0)`).
   */
  entrance?: boolean | NavbarEntrance;
};

// Labels can be ReactNodes and placeholder hrefs (e.g. "#") can repeat, so keys
// always fold in the index — `id` exists for callers who want stability across reorders.
function navItemKey(link: NavLink, index: number) {
  return link.id ?? `${link.href ?? "button"}-${index}`;
}

function NavItem({
  link,
  className,
  onNavigate,
  linkComponent = "a",
}: {
  link: NavLink;
  className?: string;
  onNavigate?: () => void;
  linkComponent?: React.ElementType;
}) {
  const handleClick = () => {
    link.onClick?.();
    onNavigate?.();
  };

  if (link.href === undefined) {
    return (
      <button type="button" onClick={handleClick} className={className}>
        {link.label}
      </button>
    );
  }
  // Internal hrefs route through linkComponent (next/link, …) when provided.
  // External http(s) links and "#" placeholders stay plain <a> (a router Link
  // can't own another origin, and "#" is a non-navigating placeholder).
  const external = /^https?:\/\//.test(link.href) || link.href.startsWith("#");
  const LinkComp = external ? "a" : linkComponent;
  return (
    <LinkComp href={link.href} onClick={handleClick} className={className}>
      {link.label}
    </LinkComp>
  );
}

/**
 * Fixed top navigation. Desktop shows a left cluster (brand + leftLinks) and a
 * right cluster (links + actions); below `md` it collapses to a hamburger whose
 * slide-in panel lists the union of leftLinks and links. Routes are caller-supplied —
 * plain <a href> by default (or a <button> when an item has onClick and no href).
 * Pass `linkComponent` to route internal hrefs through your router's Link;
 * external http(s) and "#" hrefs stay plain <a>. Behavior lives in the headless
 * useNavbar hook.
 *
 * Being `position: fixed`, it must own its own entrance animation — hence the
 * `entrance` prop rather than leaving callers to wrap it. See that prop's note.
 */
export function Navbar({
  brand,
  leftLinks = [],
  links = [],
  actions,
  className,
  menuLabel = "menu",
  linkComponent = "a",
  entrance,
}: NavbarProps) {
  const { open, setOpen, panelRef } = useNavbar();

  const linkClass =
    "text-sm text-white underline-offset-4 hover:underline whitespace-nowrap";

  const enter = entrance === true ? {} : entrance || null;

  return (
    <nav className={cn("fixed inset-x-0 top-0 z-40 w-full", className)}>
      {/* The entrance rides the bar row, never the <nav> and never the panel.
          A transform on <nav> would make it the containing block for the
          mobile backdrop and panel below (both `position: fixed`), pinning
          them to the bar's height instead of the viewport — the same trap this
          prop exists to spare callers. The bar row has no fixed descendants,
          so animating it is free. */}
      <div
        className={cn("flex items-center gap-6 px-4 py-2 sm:px-6", enter && "chrome-navbar-enter")}
        style={
          enter
            ? ({
                "--navbar-enter-y": `${enter.y ?? -10}px`,
                animationDuration: `${enter.duration ?? 0.8}s`,
                animationDelay: `${enter.delay ?? 0}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {enter && (
          // Hoisted and deduped by href, so N navbars ship one copy. Timing
          // matches motion's default on-mount tween (easeInOut) so a bar sliding
          // in beside motion-animated siblings stays in step.
          <style precedence="default" href="chrome-navbar-enter-keyframes">{`
            @keyframes chrome-navbar-enter {
              from { opacity: 0; transform: translateY(var(--navbar-enter-y, -10px)); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes chrome-navbar-enter-reduced {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            .chrome-navbar-enter {
              animation-name: chrome-navbar-enter;
              animation-duration: 0.8s;
              animation-delay: 0s;
              animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
              animation-fill-mode: both;
              animation-iteration-count: 1;
            }
            /* Reduced motion drops the travel, not the choreography: the bar
               still arrives on the caller's delay (it may be sequenced after a
               splash), it just fades rather than slides. Dropping the animation
               outright would surface the nav mid-intro; keeping the transform
               would leave an identity translate behind, and an identity
               transform still establishes a containing block. */
            @media (prefers-reduced-motion: reduce) {
              .chrome-navbar-enter { animation-name: chrome-navbar-enter-reduced; }
            }
          `}</style>
        )}
        {(brand || leftLinks.length > 0) && (
          <div className="mr-auto flex items-center gap-6">
            {brand}
            {leftLinks.length > 0 && (
              <div className="hidden items-center gap-6 md:flex">
                {leftLinks.map((l, i) => (
                  <NavItem key={navItemKey(l, i)} link={l} className={linkClass} linkComponent={linkComponent} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="ml-auto hidden items-center gap-1 md:flex">
          {links.map((l, i) => (
            <NavItem key={navItemKey(l, i)} link={l} className={cn(linkClass, "px-4 py-2")} linkComponent={linkComponent} />
          ))}
          {actions}
        </div>

        <div className="ml-auto md:hidden">
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="open navigation menu"
              className="inline-flex size-9 items-center justify-center transition-colors hover:bg-white/10"
            >
              <Menu className="size-5" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/50"
            />
            <motion.div
              ref={panelRef}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-y-0 right-0 z-[80] flex w-72 flex-col gap-4 border-l border-white/10 bg-black sm:w-80"
            >
              <div className="flex items-center justify-between p-4">
                <span className="font-semibold text-white">{menuLabel}</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="close navigation menu"
                  className="opacity-70 transition-opacity hover:opacity-100"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex flex-col items-start gap-2 px-4">
                {/* Union of both clusters — left first, indexed continuously for key safety. */}
                {[...leftLinks, ...links].map((l, i) => (
                  <NavItem
                    key={navItemKey(l, i)}
                    link={l}
                    className={cn(linkClass, "py-1")}
                    onNavigate={() => setOpen(false)}
                    linkComponent={linkComponent}
                  />
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
