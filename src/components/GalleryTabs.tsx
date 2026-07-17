"use client";

import { useRouter } from "next/navigation";
import { Tabs, type TabItem } from "@/components/chrome/tabs";

export type GalleryTab = "projects" | "hobbies" | "in-development";

const TABS: TabItem<GalleryTab>[] = [
    { value: "projects", label: "projects" },
    { value: "hobbies", label: "hobbies" },
    { value: "in-development", label: "in development" },
];

export function GalleryTabs({ active }: { active: GalleryTab }) {
    const router = useRouter();
    return (
        <div className="max-w-6xl mx-auto px-4 pt-16">
            <Tabs
                value={active}
                onValueChange={(tab) => router.push(`/gallery?tab=${tab}`, { scroll: false })}
                items={TABS}
            />
        </div>
    );
}
