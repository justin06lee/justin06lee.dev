# Gallery consolidation + `/oddjobs` placeholder

## Goal

Collapse the three separate gallery routes (`/projects`, `/hobbies`, `/in-development`) into one unified `/gallery` route with a tab-based filter. Add a new `/oddjobs` route as a blank placeholder for future work.

## Motivation

The three pages are structurally identical — each passes a different `category` plus title/subtitle to `ItemGallery`. Maintaining three routes for the same shape is wasted surface area, and switching between them requires full navigations back to the navbar. A single `/gallery` route with tabs keeps the URL shareable (via `?tab=`) while reducing duplication.

## Scope

### In scope

- New route `/gallery` with three tabs: `projects`, `hobbies`, `in-development`.
- Tab state stored in the URL query string (`?tab=<name>`).
- New route `/oddjobs` as a blank shell (navbar + empty main).
- Deletion of the old routes `/projects`, `/hobbies`, `/in-development`.
- Updates to navbar, sitemap, not-found page, and home page link references.

### Out of scope

- Redirects from old routes. Clean 404 is intentional.
- An "all categories" aggregate view.
- Any `/oddjobs` content, styling, or navigation entry.
- Changes to `ItemGallery` component internals.
- Changes to `/api/items` or the `items` table.

## Design

### Routing

**`src/app/gallery/page.tsx`** — server component, `force-dynamic`.

- Reads `searchParams.tab`.
- Validates against the allowed set `["projects", "hobbies", "in-development"]`.
- Defaults to `projects` when the param is missing or invalid (no redirect — just render projects).
- Fetches items for the resolved tab via `getItemsByCategory(tab)`.
- Renders `<Navbar />`, the new `<GalleryTabs activeTab={tab} />`, then `<ItemGallery ...>` with title/subtitle derived from the active tab.

**`src/app/oddjobs/page.tsx`** — server component.

- Renders `<Navbar />` and an empty `<main>` inside the standard `min-h-screen bg-black text-white` shell.
- No title, subtitle, or other content.

### Tab component

**`src/components/GalleryTabs.tsx`** — client component.

- Props: `activeTab: "projects" | "hobbies" | "in-development"`.
- Renders three `<Link>` elements pointing at `/gallery?tab=<name>` so Next.js handles RSC transitions and prefetch natively.
- Active tab is styled (underline or filled pill — pick based on what harmonizes with the existing `ItemGallery` filter chip aesthetic; no new primitives).
- Lives above the `ItemGallery` in the page layout.

### Title and subtitle mapping

Moved out of the per-route pages into a single object in `gallery/page.tsx`:

```
projects       → "Projects"       / "A curated list of the things I've built that are usable but still probably need updates."
hobbies        → "Hobbies"        / "Stuff I tinker with outside of programming (mostly)"
in-development → "In Development" / "Stuff I'm currently tinkering with."
```

These strings are copied verbatim from the deleted pages.

### Deletions

- `src/app/projects/` (entire directory).
- `src/app/hobbies/` (entire directory).
- `src/app/in-development/` (entire directory).

Hitting the old URLs will produce Next.js's default 404 via `not-found.tsx`.

### Reference updates

- **`src/components/Navbar.tsx`** — replace the three `in-development` / `hobbies` / `projects` links (desktop row and mobile sheet) with a single `gallery` link pointing at `/gallery`. Do not add `/oddjobs` to the navbar.
- **`src/app/sitemap.ts`** — remove `/hobbies` and `/projects` entries; add `/gallery`. Do not add `/oddjobs`.
- **`src/app/not-found.tsx`** — if it references any of the old paths, rewrite to point at `/gallery`.
- **`src/components/HomePage.tsx`** — if it links to any of the old paths, rewrite to `/gallery`.

## Data flow

1. Request hits `/gallery?tab=hobbies`.
2. Server component reads `searchParams.tab`, validates, resolves active category.
3. `getItemsByCategory(category)` runs (one DB query, same cost as today).
4. Page renders with `<GalleryTabs>` on top and `<ItemGallery>` below, both parameterized by the resolved tab.
5. Tab click → `<Link>` navigates to the new query string → server re-renders with a new category.

## Error handling

- Invalid or missing `?tab` value: fall back to `projects`. No redirect, no error.
- DB failure inside `getItemsByCategory`: surface via the existing error paths in that function (unchanged).

## Testing

Manual validation only (consistent with the rest of the repo — no test suite today):

1. `/gallery` renders with the Projects tab active and project items listed.
2. `/gallery?tab=hobbies` renders hobbies; tab UI reflects active state.
3. `/gallery?tab=in-development` renders in-development items.
4. `/gallery?tab=garbage` falls back to projects without erroring.
5. `/projects`, `/hobbies`, `/in-development` return 404.
6. Navbar shows a single `gallery` link on both desktop and mobile; clicking it lands on `/gallery`.
7. `/oddjobs` returns a blank dark page with only the navbar.
8. Sitemap XML includes `/gallery` and omits the old paths.

## Open questions

None.
