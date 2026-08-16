import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import { ItemGallery } from "@/components/ItemGallery";
import { GalleryTabs, type GalleryTab } from "@/components/GalleryTabs";
import { Salon } from "@/components/chrome/salon";
import { getItemsByCategory } from "@/lib/items";
import { getProjectSalonItems } from "@/lib/project-images";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "gallery",
    description: "projects, hobbies, and things in development.",
    alternates: { canonical: "/gallery" },
};

const TAB_META: Record<GalleryTab, { title: string; subtitle: string }> = {
    projects: {
        title: "projects",
        subtitle: "a curated list of the things i've built that are usable but still probably need updates.",
    },
    hobbies: {
        title: "hobbies",
        subtitle: "stuff i tinker with outside of programming (mostly)",
    },
    "in-development": {
        title: "in development",
        subtitle: "stuff i'm currently tinkering with.",
    },
};

const VALID_TABS: GalleryTab[] = ["projects", "hobbies", "in-development"];

function resolveTab(raw: string | string[] | undefined): GalleryTab {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value && (VALID_TABS as string[]).includes(value)) return value as GalleryTab;
    return "projects";
}

export default async function GalleryPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string | string[] }>;
}) {
    const { tab: rawTab } = await searchParams;
    const tab = resolveTab(rawTab);
    const meta = TAB_META[tab];
    const items = await getItemsByCategory(tab);

    // Projects hang as a salon wall of their README hero images; the other tabs
    // keep the searchable card grid.
    const salonItems = tab === "projects" ? await getProjectSalonItems(items) : [];

    return (
        <div className="min-h-screen bg-black text-white">
            <Navbar />
            <GalleryTabs active={tab} />
            {tab === "projects" ? (
                <main className="mx-auto max-w-6xl px-4 pb-24 pt-16">
                    <div className="mb-8">
                        <h1 className="text-3xl font-semibold tracking-tight">{meta.title}</h1>
                        <p className="mt-1 text-sm text-white/70">{meta.subtitle}</p>
                    </div>
                    {salonItems.length > 0 ? (
                        <Salon items={salonItems} ariaLabel="projects" />
                    ) : (
                        <p className="text-sm text-white/40">no projects yet.</p>
                    )}
                </main>
            ) : (
                <ItemGallery
                    title={meta.title}
                    subtitle={meta.subtitle}
                    items={items}
                    initialSort="newest"
                    chipBase={0.4}
                    chipStep={0.1}
                />
            )}
        </div>
    );
}
