import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import { ItemGallery } from "@/components/ItemGallery";
import { GalleryTabs, type GalleryTab } from "@/components/GalleryTabs";
import { ProjectWall, type WallPiece } from "@/components/gallery/ProjectWall";
import Link from "next/link";
import { MangaStrip, type MangaPiece } from "@/components/gallery/MangaPages";
import { AppStore } from "@/components/gallery/AppStoreList";
import { CrtMonitor, type CrtChannel } from "@/components/gallery/CrtMonitor";
import { getItemsByCategory, type SiteGalleryItem } from "@/lib/items";
import { getProjectWallPieces, repoUrlFor } from "@/lib/project-images";
import { getProjectVideo } from "@/lib/project-video";
import { getAppCard, type AppCard } from "@/lib/app-store";
import { seedWall } from "@/lib/gallery-wall";
import { packPages } from "@/lib/manga-layout";
import { GALLERY_THEMES, THEME_META, classifyTheme, type GalleryTheme } from "@/lib/gallery-themes";
import { getSiteConfig } from "@/lib/site-config";
import { isAdminServer } from "@/lib/auth-server";

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

function firstParam(raw: string | string[] | undefined): string | undefined {
    return Array.isArray(raw) ? raw[0] : raw;
}

export default async function GalleryPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string | string[]; wall?: string | string[]; seed?: string | string[] }>;
}) {
    const { tab: rawTab, wall: rawWall, seed: rawSeed } = await searchParams;
    const tab = resolveTab(rawTab);
    const meta = TAB_META[tab];
    const [items, config] = await Promise.all([getItemsByCategory(tab), getSiteConfig()]);

    if (tab !== "projects") {
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

    // `?wall=preview` renders the hand-arranged wall for an admin without
    // publishing it, so a layout can be checked on the real page before the
    // switch is thrown. Gated on the session — for everyone else the param is
    // inert and the published mode decides.
    const wantsPreview = firstParam(rawWall) === "preview";
    const manual = config.wallMode === "manual" || (wantsPreview && (await isAdminServer()));

    const resolved = await getProjectWallPieces(items);
    const itemById = new Map(items.map((i) => [i.id, i]));

    const pieces: MangaPiece[] = resolved.map((piece) => ({
        id: piece.id,
        title: piece.title,
        href: piece.href,
        src: piece.src,
        width: piece.naturalWidth,
        height: piece.naturalHeight,
    }));

    return (
        <div className="min-h-screen bg-black text-white">
            <Navbar />
            <GalleryTabs active={tab} />
            <main className="mx-auto max-w-6xl px-4 pb-24 pt-16">
                <div className="mb-10">
                    <h1 className="text-3xl font-semibold tracking-tight">{meta.title}</h1>
                    <p className="mt-1 text-sm text-white/70">{meta.subtitle}</p>
                </div>

                {pieces.length === 0 ? (
                    <p className="text-sm text-white/40">no projects yet.</p>
                ) : manual ? (
                    <ProjectWall pieces={buildWallPieces(resolved, items)} ariaLabel="projects" />
                ) : (
                    <ThemedSections
                        sections={await buildSections(pieces, itemById)}
                        seed={resolveSeed(firstParam(rawSeed))}
                    />
                )}
            </main>
        </div>
    );
}

/**
 * A fresh seed per request is what makes the gallery re-deal on every reload. A
 * `?seed=` overrides it so a particular layout can be linked or compared side
 * by side while tuning the packing.
 */
function resolveSeed(raw: string | undefined): number {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
    return Math.floor(Math.random() * 2 ** 31);
}

type Sections = {
    panels: MangaPiece[];
    terminal: CrtChannel[];
    icons: AppCard[];
};

/**
 * Sorts the pieces into their hangs and gathers what each hang needs beyond
 * the image: the store wants screenshots and an "open" target, the set wants
 * each channel's clip. The icon already resolved for the wall is handed
 * through so the store never measures it twice.
 */
async function buildSections(
    pieces: MangaPiece[],
    itemById: Map<string, SiteGalleryItem>,
): Promise<Sections> {
    const grouped: Record<GalleryTheme, MangaPiece[]> = { panels: [], terminal: [], icons: [] };
    for (const piece of pieces) {
        const item = itemById.get(piece.id);
        grouped[
            classifyTheme({
                id: piece.id,
                collection: item?.collection,
                src: piece.src,
                width: piece.width,
                height: piece.height,
            })
        ].push(piece);
    }

    const icons = await Promise.all(
        grouped.icons.flatMap((piece) => {
            const item = itemById.get(piece.id);
            if (!item) return [];
            const icon = piece.src ? { src: piece.src, width: piece.width, height: piece.height } : null;
            return [getAppCard(item, icon)];
        }),
    );

    // Each channel's clip comes from its repo, like everything else on the
    // set; a project without one just shows its picture.
    const terminal: CrtChannel[] = await Promise.all(
        grouped.terminal.map(async (piece) => {
            const item = itemById.get(piece.id);
            return {
                id: piece.id,
                title: piece.title,
                src: piece.src,
                href: piece.href,
                video: item ? await getProjectVideo(repoUrlFor(item)) : null,
            };
        }),
    );

    return { panels: grouped.panels, terminal, icons };
}

function ThemedSections({ sections, seed }: { sections: Sections; seed: number }) {
    // Offset the seed per section so two sections of the same size don't deal
    // themselves into identical row rhythms.
    const visible = GALLERY_THEMES.map((theme, index) => ({
        theme,
        count: sections[theme].length,
        seed: seed + index * 7919,
    })).filter((s) => s.count > 0);

    return (
        <div className="flex flex-col gap-16">
            {visible.map(({ theme, seed: sectionSeed }) => (
                <section key={theme}>
                    {/* The store brings its own large title; every other hang
                        gets the site's mono section label. */}
                    {theme !== "icons" && (
                        <div className="mb-4 flex items-baseline gap-3">
                            <h2 className="text-[11px] uppercase tracking-[0.22em] text-white/70">
                                {THEME_META[theme].title}
                            </h2>
                            <p className="truncate text-xs text-white/35">{THEME_META[theme].subtitle}</p>
                        </div>
                    )}

                    {/* A band, not a wall: bled to the viewport's edges (the main
                        is centred and padded, so the offset is half the difference
                        between the viewport and the column) and faded at both
                        ends, so the pages arrive and leave rather than appearing
                        cut. */}
                    {theme === "panels" && (
                        <MangaStrip
                            pages={packPages(sections.panels, sectionSeed)}
                            ariaLabel="panels"
                            className="relative left-1/2 w-screen -translate-x-1/2"
                        />
                    )}
                    {/* The set stands off the label by the same dark that
                        separates its pool from the next hang. */}
                    {theme === "terminal" && <CrtMonitor channels={sections.terminal} ariaLabel="terminal" className="mt-12" />}
                    {theme === "icons" && (
                        <AppStore
                            apps={sections.icons}
                            linkComponent={Link}
                            ariaLabel="apps"
                            title="Apps"
                            subtitle={THEME_META.icons.subtitle}
                        />
                    )}
                </section>
            ))}
        </div>
    );
}

/** Pairs each resolved piece with its stored (or seeded) hand-placed box. */
function buildWallPieces(
    resolved: Awaited<ReturnType<typeof getProjectWallPieces>>,
    items: Awaited<ReturnType<typeof getItemsByCategory>>,
): WallPiece[] {
    const arrange = resolved.map((p) => ({
        id: p.id,
        width: p.naturalWidth,
        height: p.naturalHeight,
    }));
    // Seed both variants so a project added since the last arrangement still
    // hangs (below the wall) instead of silently vanishing from the gallery.
    const desktop = seedWall(
        arrange,
        Object.fromEntries(items.map((i) => [i.id, i.wallDesktop])),
        "desktop",
    );
    const mobile = seedWall(
        arrange,
        Object.fromEntries(items.map((i) => [i.id, i.wallMobile])),
        "mobile",
    );
    return resolved.map((piece) => ({
        ...piece,
        desktop: desktop[piece.id],
        mobile: mobile[piece.id],
    }));
}
