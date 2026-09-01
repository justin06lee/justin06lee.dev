# Stack adapters: where SEO lives, per framework

The same fix lands in different places depending on the stack. `seo_inventory.py`
reports `framework` and `router`; use this to apply edits idiomatically instead
of pasting raw `<head>` HTML into a component that doesn't own the head.

## Next.js — App Router (`app/`)

- **Metadata** (title, description, canonical, OG): export a `metadata` object
  or `generateMetadata()` from `layout.tsx` (site-wide defaults) and each
  `page.tsx` (per-route overrides). Do not hand-write `<head>` tags.
- **Canonical**: `metadata.alternates.canonical`.
- **JSON-LD**: render a `<script type="application/ld+json">` in the component,
  or a dedicated `<JsonLd>` component; `next/script` with `strategy` is fine.
- **Sitemap**: `app/sitemap.ts` exporting a default function returning the route
  list. **Robots**: `app/robots.ts`.
- **hreflang**: `metadata.alternates.languages`.

## Next.js — Pages Router (`pages/`)

- **Metadata**: `next/head` `<Head>` inside each page, or a shared SEO component;
  `_app.tsx`/`_document.tsx` for site-wide defaults.
- **Sitemap/robots**: `next-sitemap` package, or a `pages/sitemap.xml.tsx`
  server-side route. Prefer the package if already a dependency.

## Astro (`src/pages/`)

- **Metadata**: in the page/layout frontmatter and `<head>` of the `.astro`
  layout. Astro owns the head directly, so `<meta>`/`<link>` in the layout is
  idiomatic.
- **JSON-LD**: a `<script type="application/ld+json" set:html={...}>` in the
  layout or page.
- **Sitemap**: `@astrojs/sitemap` integration in `astro.config.mjs`.

## Nuxt (`pages/`)

- **Metadata**: `useHead()` / `useSeoMeta()` composables in pages and layouts;
  `nuxt.config` `app.head` for defaults.
- **Sitemap**: `@nuxtjs/sitemap` module.

## SvelteKit (`src/routes/`)

- **Metadata**: `<svelte:head>` in `+layout.svelte` and `+page.svelte`.
- **Sitemap**: a `src/routes/sitemap.xml/+server.ts` endpoint.

## Gatsby (`src/pages/`)

- **Metadata**: `gatsby-plugin-react-helmet` / `Head` API export.
- **Sitemap**: `gatsby-plugin-sitemap`.

## Hugo (`content/`, `layouts/`)

- **Metadata**: `layouts/partials/head.html`, driven by front matter and site
  params. Canonical and OG go here.
- **Sitemap**: Hugo generates `sitemap.xml` automatically; tune via
  `sitemap` config, don't hand-write it.

## Jekyll (`_posts/`, `_layouts/`)

- **Metadata**: `_layouts/default.html` `<head>`, driven by front matter;
  `jekyll-seo-tag` plugin is the idiomatic path.
- **Sitemap**: `jekyll-sitemap` plugin.

## Static HTML

- **Metadata**: directly in each page's `<head>`. This is the one case where
  hand-written `<meta>`/`<link>`/JSON-LD is correct.
- **Sitemap/robots**: write `sitemap.xml` and `robots.txt` at the site root.
- Watch for shared includes (SSI, a build step, a templating tool) so a fix to
  one `<head>` is not silently undone by a generator.

## SPA / unknown

- Client-rendered heads (react-helmet, vue-meta) mean crawlers may not see the
  tags without SSR/prerender. Note this in the report: recommend SSR/prerender or
  a static meta fallback rather than only injecting tags at runtime.

## General rules

- Prefer the framework's metadata API over raw `<head>` injection every time one
  exists — it is what other tooling and the framework's own `<head>` dedup
  expect.
- Site-wide defaults go in the layout; per-page values override in the page.
- Never edit generated output (`.next/`, `dist/`, `build/`, `public/build/`);
  edit the source that produces it.
