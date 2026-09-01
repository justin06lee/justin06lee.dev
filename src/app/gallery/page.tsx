import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import { ItemGallery } from "@/components/ItemGallery";
import { GalleryTabs, type GalleryTab } from "@/components/GalleryTabs";
import { ProjectWall, type WallPiece } from "@/components/gallery/ProjectWall";
import { MangaPages, type MangaPiece } from "@/components/gallery/MangaPages";
import { IconGrid } from "@/components/gallery/IconGrid";
import { TerminalStrip } from "@/components/gallery/TerminalStrip";
import { getItemsByCategory } from "@/lib/items";
import { getProjectWallPieces } from "@/lib/project-images";
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
    const collectionById = new Map(items.map((i) => [i.id, i.collection]));

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
                        pieces={pieces}
                        collectionById={collectionById}
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

function ThemedSections({
    pieces,
    collectionById,
    seed,
}: {
    pieces: MangaPiece[];
    collectionById: Map<string, string | null>;
    seed: number;
}) {
    const grouped: Record<GalleryTheme, MangaPiece[]> = { panels: [], terminal: [], icons: [] };
    for (const piece of pieces) {
        const theme = classifyTheme({
            id: piece.id,
            collection: collectionById.get(piece.id),
            src: piece.src,
            width: piece.width,
            height: piece.height,
        });
        grouped[theme].push(piece);
    }

    // Offset the seed per section so two sections of the same size don't deal
    // themselves into identical row rhythms.
    const sections = GALLERY_THEMES.map((theme, index) => ({
        theme,
        items: grouped[theme],
        seed: seed + index * 7919,
    })).filter((s) => s.items.length > 0);

    return (
        <div className="flex flex-col gap-16">
            {sections.map(({ theme, items, seed: sectionSeed }) => (
                <section key={theme}>
                    <div className="mb-4 flex items-baseline gap-3">
                        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/70">
                            {THEME_META[theme].title}
                        </h2>
                        <p className="truncate text-xs text-white/35">{THEME_META[theme].subtitle}</p>
                    </div>

                    {theme === "panels" && (
                        <MangaPages pages={packPages(items, sectionSeed)} ariaLabel="panels" />
                    )}
                    {theme === "terminal" && <TerminalStrip items={items} ariaLabel="terminal" />}
                    {theme === "icons" && <IconGrid items={items} ariaLabel="apps" />}
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
