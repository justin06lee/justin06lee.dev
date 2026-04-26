"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type GalleryTab = "projects" | "hobbies" | "in-development";

const TABS: { key: GalleryTab; label: string }[] = [
    { key: "projects", label: "projects" },
    { key: "hobbies", label: "hobbies" },
    { key: "in-development", label: "in development" },
];

export function GalleryTabs({ active }: { active: GalleryTab }) {
    return (
        <div className="max-w-6xl mx-auto px-4 pt-16 flex gap-2">
            {TABS.map(({ key, label }) => {
                const isActive = key === active;
                return (
                    <Link
                        key={key}
                        href={`/gallery?tab=${key}`}
                        scroll={false}
                        className={cn(
                            "text-sm px-3 py-1.5 border transition-colors whitespace-nowrap",
                            isActive
                                ? "border-white text-white"
                                : "border-white/20 text-white/60 hover:border-white/50 hover:text-white",
                        )}
                    >
                        {label}
                    </Link>
                );
            })}
        </div>
    );
}
