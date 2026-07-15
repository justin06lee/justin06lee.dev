"use client";

import * as motion from "motion/react-client";
import { AnimatePresence } from "motion/react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavbar } from "@/hooks/use-navbar";

export type NavLink = {
  label: string;
  href: string;
};

export type NavbarProps = {
  /** Left-side brand — your logo, name, or any node. */
  brand?: React.ReactNode;
  links?: NavLink[];
  /** Right-side extras shown on desktop (e.g. a theme toggle). */
  actions?: React.ReactNode;
  /**
   * Extra nodes rendered at the top of the mobile slide-in panel, above `links`.
   * Use for controls that live outside the plain `links` list on desktop (a
   * left-side button, a ReactNode link) but still belong in the mobile menu.
   * See MISSING.md — the general fix is ReactNode labels + a left link group.
   */
  mobilePanelExtras?: React.ReactNode;
  className?: string;
  /** Heading shown at the top of the mobile panel. Defaults to "menu". */
  menuLabel?: string;
};

/**
 * Fixed top navigation. Desktop shows inline links; below `md` it collapses to a
 * hamburger that opens a right-side slide-in panel. Routes are caller-supplied —
 * plain <a href>, framework-agnostic. Behavior lives in the headless useNavbar hook.
 */
export function Navbar({
  brand,
  links = [],
  actions,
  mobilePanelExtras,
  className,
  menuLabel = "menu",
}: NavbarProps) {
  const { open, setOpen, panelRef } = useNavbar();

  const linkClass =
    "text-sm text-white underline-offset-4 hover:underline whitespace-nowrap";

  return (
    <nav className={cn("fixed inset-x-0 top-0 z-40 w-full", className)}>
      <div className="flex items-center gap-6 px-4 py-2 sm:px-6">
        {brand && <div className="mr-auto flex items-center gap-6">{brand}</div>}

        <div className="ml-auto hidden items-center gap-1 md:flex">
          {links.map((l, i) => (
            <a key={`${l.label}-${i}`} href={l.href} className={cn(linkClass, "px-4 py-2")}>
              {l.label}
            </a>
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
                {mobilePanelExtras}
                {links.map((l, i) => (
                  <a
                    key={`${l.label}-${i}`}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(linkClass, "py-1")}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
