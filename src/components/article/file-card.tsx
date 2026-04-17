"use client";

import Link from "next/link";
import { motion } from "motion/react";

interface FileCardProps {
  href: string;
  label: string;
}

export function FileCard({ href, label }: FileCardProps) {
  return (
    <Link href={href} className="group block">
      <motion.div
        className="relative h-44 w-40"
        initial="rest"
        whileHover="hovered"
        animate="rest"
      >
        <motion.div
          variants={{
            hovered: {
              rotate: -7,
              x: -8,
              y: 4,
            },
            rest: {
              rotate: -2,
              x: 0,
              y: 0,
            },
          }}
          transition={{ type: "spring", stiffness: 240, damping: 22 }}
          className="absolute inset-0 border border-[var(--paper-border)] bg-background shadow-[0_8px_18px_rgba(0,0,0,0.08)]"
        />
        <motion.div
          variants={{
            hovered: {
              rotate: 4,
              x: 10,
              y: -6,
            },
            rest: {
              rotate: 1,
              x: 0,
              y: 0,
            },
          }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="absolute inset-0 border border-[var(--paper-border)] bg-background shadow-[0_16px_28px_rgba(0,0,0,0.12)]"
        >
          <div className="flex h-full flex-col justify-between p-4">
            <div className="space-y-2 text-muted/80">
              <div className="h-px w-full bg-border" />
              <div className="h-px w-5/6 bg-border" />
              <div className="h-px w-2/3 bg-border" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
                Article
              </p>
              <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                {label}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </Link>
  );
}
