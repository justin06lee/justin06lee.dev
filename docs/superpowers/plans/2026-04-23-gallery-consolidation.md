# Gallery Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate `/projects`, `/hobbies`, and `/in-development` into a single `/gallery` route with URL-driven tabs (`?tab=`), and add a blank `/oddjobs` placeholder route.

**Architecture:** Server-component page reads `searchParams.tab`, validates it, and fetches a single category via existing `getItemsByCategory()`. A small client component (`GalleryTabs`) renders three `<Link>`s that change the `?tab=` query, triggering an RSC re-render. The old routes are deleted outright (no redirects). `/oddjobs` is an empty dark shell with just the navbar.

**Tech Stack:** Next.js 15 App Router, React 19 server/client components, Tailwind v4, Motion v12, Bun, Turbopack.

**Spec:** `docs/superpowers/specs/2026-04-22-gallery-consolidation-design.md`

**Verification convention:** This repo has no automated tests. Each task verifies via `bun run lint`, `bun run build`, and targeted manual smoke checks. Start the dev server with `bun run dev` when manual browser checks are required.

---

### Task 1: Create the `GalleryTabs` client component

**Files:**
- Create: `src/components/GalleryTabs.tsx`

- [ ] **Step 1: Create the component file**

Write the following to `src/components/GalleryTabs.tsx`:

```tsx
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
        <div className="flex gap-2 px-6 pt-4 sm:px-8">
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
```

- [ ] **Step 2: Verify lint passes**

Run: `bun run lint`
Expected: no errors referencing `src/components/GalleryTabs.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/GalleryTabs.tsx
git commit -m "feat(gallery): add GalleryTabs client component"
```

---

### Task 2: Create the `/gallery` route

**Files:**
- Create: `src/app/gallery/page.tsx`

- [ ] **Step 1: Create the page**

Write the following to `src/app/gallery/page.tsx`:

```tsx
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
```

Notes for the engineer:
- Next.js 15 makes `searchParams` a `Promise` in server components — this is why the signature uses `await searchParams`.
- `getItemsByCategory` accepts the same category strings the old pages passed (`"projects"`, `"hobbies"`, `"in-development"`). See `src/lib/items.ts`.

- [ ] **Step 2: Verify build compiles**

Run: `bun run build`
Expected: build succeeds, `/gallery` appears in the route summary output.

- [ ] **Step 3: Manual smoke — tabs work**

Run: `bun run dev`, then:
- Visit `http://localhost:3000/gallery` — expect Projects view with tabs on top, projects tab highlighted.
- Visit `http://localhost:3000/gallery?tab=hobbies` — expect Hobbies view, hobbies tab highlighted.
- Visit `http://localhost:3000/gallery?tab=in-development` — expect In Development view.
- Visit `http://localhost:3000/gallery?tab=garbage` — expect fallback to projects view (no error).
- Click each tab — URL should update to `/gallery?tab=<name>` and content should swap.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/gallery/page.tsx
git commit -m "feat(gallery): add /gallery route with tab-based filtering"
```

---

### Task 3: Create `/oddjobs` placeholder route

**Files:**
- Create: `src/app/oddjobs/page.tsx`

- [ ] **Step 1: Create the page**

Write the following to `src/app/oddjobs/page.tsx`:

```tsx
import Navbar from "@/components/Navbar";

export default function OddjobsPage() {
    return (
        <div className="min-h-screen bg-black text-white">
            <Navbar />
            <main />
        </div>
    );
}
```

- [ ] **Step 2: Verify build compiles**

Run: `bun run build`
Expected: build succeeds, `/oddjobs` appears in the route summary output.

- [ ] **Step 3: Manual smoke**

Run: `bun run dev`, visit `http://localhost:3000/oddjobs`. Expect a fully black page with only the navbar visible. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/oddjobs/page.tsx
git commit -m "feat(oddjobs): add blank /oddjobs placeholder route"
```

---

### Task 4: Replace the three nav links with a single `gallery` link

**Files:**
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Update the desktop nav row**

In `src/components/Navbar.tsx`, find the desktop nav block (currently lines ~104–120) and replace the three `<Link>` entries for `/in-development`, `/hobbies`, `/projects` with a single `gallery` link.

Replace:

```tsx
                    <Link href="/in-development" className="text-sm text-white underline-offset-4 hover:underline px-4 py-2 whitespace-nowrap">
                        in development
                    </Link>
                    <Link href="/hobbies" className="text-sm text-white underline-offset-4 hover:underline px-4 py-2 whitespace-nowrap">
                        hobbies
                    </Link>
                    <Link href="/projects" className="text-sm text-white underline-offset-4 hover:underline px-4 py-2 whitespace-nowrap">
                        projects
                    </Link>
```

With:

```tsx
                    <Link href="/gallery" className="text-sm text-white underline-offset-4 hover:underline px-4 py-2 whitespace-nowrap">
                        gallery
                    </Link>
```

- [ ] **Step 2: Update the mobile sheet**

In the same file, find the mobile sheet block (currently lines ~178–186) and do the same replacement.

Replace:

```tsx
                                <Link href="/in-development" onClick={() => setOpen(false)} className="text-sm text-white underline-offset-4 hover:underline py-1">
                                    in development
                                </Link>
                                <Link href="/hobbies" onClick={() => setOpen(false)} className="text-sm text-white underline-offset-4 hover:underline py-1">
                                    hobbies
                                </Link>
                                <Link href="/projects" onClick={() => setOpen(false)} className="text-sm text-white underline-offset-4 hover:underline py-1">
                                    projects
                                </Link>
```

With:

```tsx
                                <Link href="/gallery" onClick={() => setOpen(false)} className="text-sm text-white underline-offset-4 hover:underline py-1">
                                    gallery
                                </Link>
```

- [ ] **Step 3: Verify lint and build**

Run: `bun run lint && bun run build`
Expected: both succeed.

- [ ] **Step 4: Manual smoke — navbar**

Run: `bun run dev`. Confirm:
- Desktop: single `gallery` link is visible where the three used to be; clicking it lands on `/gallery`.
- Mobile (narrow viewport): open hamburger, verify single `gallery` entry; clicking it closes the sheet and navigates to `/gallery`.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat(nav): replace three category links with single gallery link"
```

---

### Task 5: Update sitemap, home page, and not-found references

**Files:**
- Modify: `src/app/sitemap.ts`
- Modify: `src/components/HomePage.tsx`
- Modify: `src/app/not-found.tsx`

- [ ] **Step 1: Update sitemap**

In `src/app/sitemap.ts`, replace the hobbies and projects entries with a single gallery entry.

Replace:

```ts
        { url: `${base}/hobbies`, lastModified, changeFrequency: "weekly", priority: 0.7 },
        { url: `${base}/projects`, lastModified, changeFrequency: "weekly", priority: 0.7 },
```

With:

```ts
        { url: `${base}/gallery`, lastModified, changeFrequency: "weekly", priority: 0.7 },
```

- [ ] **Step 2: Update HomePage**

In `src/components/HomePage.tsx`, find the "get started" link row (currently lines ~260–268) and replace the two links with a single gallery link.

Replace:

```tsx
                                <Link href="/hobbies" className="text-sm text-white underline-offset-4 hover:underline px-4 py-2">
                                    hobbies
                                </Link>
                                <Link href="/projects" className="text-sm text-white underline-offset-4 hover:underline px-4 py-2">
                                    projects
                                </Link>
```

With:

```tsx
                                <Link href="/gallery" className="text-sm text-white underline-offset-4 hover:underline px-4 py-2">
                                    gallery
                                </Link>
```

- [ ] **Step 3: Update not-found**

In `src/app/not-found.tsx`, find the bottom link row (currently lines ~57–65) and replace the projects and hobbies links with a single gallery link.

Replace:

```tsx
                    <Link href="/" className="underline-offset-4 hover:underline px-4 py-2">
                        home
                    </Link>
                    <Link href="/projects" className="underline-offset-4 hover:underline px-4 py-2">
                        projects
                    </Link>
                    <Link href="/hobbies" className="underline-offset-4 hover:underline px-4 py-2">
                        hobbies
                    </Link>
```

With:

```tsx
                    <Link href="/" className="underline-offset-4 hover:underline px-4 py-2">
                        home
                    </Link>
                    <Link href="/gallery" className="underline-offset-4 hover:underline px-4 py-2">
                        gallery
                    </Link>
```

- [ ] **Step 4: Verify lint and build**

Run: `bun run lint && bun run build`
Expected: both succeed.

- [ ] **Step 5: Manual smoke**

Run: `bun run dev`. Confirm:
- `http://localhost:3000/sitemap.xml` contains a `/gallery` entry and no `/hobbies` or `/projects` entries.
- Home page "get started" section shows a single `gallery` link; it navigates to `/gallery`.
- Visit a bogus URL like `http://localhost:3000/does-not-exist` — 404 page shows home and gallery links only.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/app/sitemap.ts src/components/HomePage.tsx src/app/not-found.tsx
git commit -m "feat(gallery): update sitemap, home, and 404 links to /gallery"
```

---

### Task 6: Delete the old category routes and final verification

**Files:**
- Delete: `src/app/projects/`
- Delete: `src/app/hobbies/`
- Delete: `src/app/in-development/`

- [ ] **Step 1: Sanity-check there are no remaining references**

Run:

```bash
grep -rn "/projects\|/hobbies\|/in-development" src/ 2>/dev/null | grep -v "api/items\|category"
```

Expected: no results. (If any results point to live `<Link>`s you missed, fix them first before proceeding.)

Note: `src/lib/items.ts` and `src/app/api/items/` intentionally still reference the category *names* `"projects"`, `"hobbies"`, `"in-development"` — those are DB category values, not URLs. The grep above filters those out.

- [ ] **Step 2: Delete the route directories**

Run:

```bash
rm -rf src/app/projects src/app/hobbies src/app/in-development
```

- [ ] **Step 3: Verify lint and build**

Run: `bun run lint && bun run build`
Expected: both succeed. Build output should list `/gallery`, `/oddjobs`, `/articles`, `/calendar/...`, etc. — but no `/projects`, `/hobbies`, or `/in-development`.

- [ ] **Step 4: Manual smoke — full flow**

Run: `bun run dev`. Confirm:
- `http://localhost:3000/projects` → 404.
- `http://localhost:3000/hobbies` → 404.
- `http://localhost:3000/in-development` → 404.
- `http://localhost:3000/gallery` → projects view with tabs.
- Click each tab, verify items swap and URL updates.
- `http://localhost:3000/oddjobs` → blank page with navbar.
- Navbar shows single `gallery` link both on desktop and in the mobile sheet.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add -A src/app/projects src/app/hobbies src/app/in-development
git commit -m "chore(gallery): remove old /projects, /hobbies, /in-development routes"
```

(Note: `git add -A <path>` stages the deletion of the directories.)

---

## Post-implementation checklist

- [ ] `bun run lint` passes.
- [ ] `bun run build` passes.
- [ ] `/gallery` renders with Projects tab active by default.
- [ ] `?tab=hobbies` and `?tab=in-development` switch the category.
- [ ] Invalid `?tab=` falls back to projects without error.
- [ ] Old routes return 404.
- [ ] Navbar, sitemap, home page, and 404 page only link to `/gallery`.
- [ ] `/oddjobs` renders blank with navbar only.
- [ ] Six clean commits on the branch, each scoped to one task.
