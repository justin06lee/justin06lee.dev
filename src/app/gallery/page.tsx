import Navbar from "@/components/Navbar";
import { ItemGallery } from "@/components/ItemGallery";
import { GalleryTabs, type GalleryTab } from "@/components/GalleryTabs";
import { getItemsByCategory } from "@/lib/items";

export const dynamic = "force-dynamic";

const TAB_META: Record<GalleryTab, { title: string; subtitle: string }> = {
    projects: {
        title: "Projects",
        subtitle: "A curated list of the things I've built that are usable but still probably need updates.",
    },
    hobbies: {
        title: "Hobbies",
        subtitle: "Stuff I tinker with outside of programming (mostly)",
    },
    "in-development": {
        title: "In Development",
        subtitle: "Stuff I'm currently tinkering with.",
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

    return (
        <div className="min-h-screen bg-black text-white">
            <Navbar />
            <GalleryTabs active={tab} />
            <ItemGallery
                title={meta.title}
                subtitle={meta.subtitle}
                items={items}
                initialSort="newest"
                chipBase={0.4}
                chipStep={0.1}
            />
        </div>
    );
}
