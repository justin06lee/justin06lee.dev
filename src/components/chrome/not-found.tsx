"use client";

import { useEffect, useState, type ElementType } from "react";
import * as motion from "motion/react-client";
import { cn } from "@/lib/utils";
import { Ascii } from "@/components/chrome/ascii";
import { CAT_ASCII } from "./cat-ascii";

export interface NotFoundLink {
  label: string;
  href: string;
}

export interface NotFoundProps {
  /** Big mono headline. Default "404". */
  title?: string;
  /** Muted line under the headline. */
  message?: string;
  /** Footer links. Internal hrefs route through `linkComponent`; external stay plain <a>. */
  links?: NotFoundLink[];
  /**
   * Anchor component for internal footer `href`s — pass your router's Link.
   * External http(s) hrefs always render a plain <a>. Defaults to a plain <a>.
   */
  linkComponent?: ElementType;
  /** Override the random pick with a fixed cat (0-9) — e.g. for visual tests. */
  cat?: number;
  /** Show the subtle "made by justin06lee.dev" line at the bottom. Default true. */
  credit?: boolean;
  className?: string;
}

/**
 * The justin06lee.dev 404 block: one of ten random ascii cats fades in above a
 * big mono headline, a muted excuse, and footer links. The cat is picked on
 * mount (SSR-safe) and rendered through the `ascii` component. Page chrome
 * (navbar, min-h-screen) is the caller's.
 */
export function NotFound({
  title = "404",
  message = "this page wandered off. the cat hasn't seen it either.",
  links = [{ label: "home", href: "/" }],
  linkComponent = "a",
  cat,
  credit = true,
  className,
}: NotFoundProps) {
  // Picked on mount so server and client markup agree.
  const [index, setIndex] = useState<number | null>(cat ?? null);
  useEffect(() => {
    if (cat != null) return setIndex(cat % CAT_ASCII.length);
    setIndex(Math.floor(Math.random() * CAT_ASCII.length));
  }, [cat]);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-8 px-6 text-center",
        className,
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: index == null ? 0 : 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Ascii size={12} className="text-[10px] sm:text-xs md:text-sm">
          {index == null ? " " : (CAT_ASCII[index] ?? " ")}
        </Ascii>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="text-5xl tracking-tight sm:text-6xl"
      >
        {title}
      </motion.div>

      {message ? (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="max-w-md text-sm text-white/60"
        >
          {message}
        </motion.p>
      ) : null}

      {links.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="flex gap-6 text-sm"
        >
          {links.map((link) => {
            // Internal hrefs route through linkComponent (next/link, …); external
            // http(s) links stay plain <a> (a router Link can't own another origin).
            const external = /^https?:\/\//.test(link.href);
            const LinkComp = external ? "a" : linkComponent;
            return (
              <LinkComp
                key={`${link.label}:${link.href}`}
                href={link.href}
                className="px-4 py-2 underline-offset-4 hover:underline"
              >
                {link.label}
              </LinkComp>
            );
          })}
        </motion.div>
      ) : null}

      {credit ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-10"
        >
          <a
            href="https://justin06lee.dev"
            className="text-[11px] text-white/30 transition-colors hover:text-white/60"
          >
            made by justin06lee.dev
          </a>
        </motion.div>
      ) : null}
    </div>
  );
}
