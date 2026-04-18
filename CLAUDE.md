# CLAUDE.md

## Project Overview
Personal portfolio website for justin06lee.dev. Built with Next.js 15 (App Router), React 19, TypeScript, and Tailwind CSS 4. Dark-only theme with a minimal black/white aesthetic, motion-driven animations, and ASCII art flourishes.

## Commands
- `bun run dev` — Start dev server (Turbopack)
- `bun run build` — Production build (Turbopack)
- `bun run start` — Start production server
- `bun run lint` — ESLint

## Tech Stack
- **Framework**: Next.js 15.5.9 (App Router), React 19, TypeScript 5
- **Styling**: Tailwind CSS 4 (no shadcn), custom CSS in `globals.css`
- **Animation**: Motion v12 (`motion/react-client`)
- **Theme**: next-themes (dark mode forced)
- **Database**: Turso / LibSQL (`@libsql/client`)
- **Markdown**: react-markdown + remark-gfm + rehype-katex
- **Auth**: Custom sessions + PAT tokens, admin-gated `/author/*` routes
- **Analytics**: @vercel/analytics
- **Package Manager**: Bun
- **Bundler**: Turbopack

## Project Structure
```
src/
  app/                  # Next.js App Router
    page.tsx            # Home (force-dynamic, wraps home-client)
    layout.tsx          # Root layout (Geist fonts, theme, analytics, navbar)
    globals.css         # Tailwind + custom theme vars + keyframes
    projects/           # Projects gallery (ItemGallery)
    hobbies/            # Hobbies gallery (ItemGallery)
    articles/           # Blog index + [slug] article view
    author/             # Admin CMS (auth-gated layout)
    cat/                # Interactive cat sprite page
    me/                 # Profile page
    in-development/     # WIP placeholder
    api/                # items, articles, auth, pats, uploads, config
    opengraph-image.tsx, twitter-image.tsx, robots.ts, sitemap.ts, manifest.ts
  components/
    HomePage.tsx        # Hero: scramble text + responsive ASCII donut
    AsciiDonut.tsx      # 3D torus ASCII renderer (rotation matrices, z-buffer)
    Navbar.tsx          # Fixed nav with mobile sheet, RainbowCat
    ItemGallery.tsx     # Filterable/sortable gallery grid
    ArticleList.tsx, MarkdownRenderer.tsx, TableOfContents.tsx
    PfpTile.tsx, Socials.tsx, RainbowCat.tsx
    author/             # Admin editor, login form, file grid
  lib/
    utils.ts            # cn() = clsx + tailwind-merge
    db.ts, github.ts    # Turso client, GitHub article fetcher
    auth.ts             # isAdminServer, requireAdmin
public/
  ascii/                # ascii1..9.txt for responsive donut swap
  cat-sprite.jpg        # 12x10 sprite sheet
  Poppins-Regular.ttf   # Custom font
```

## Conventions
- Path alias: `@/*` → `src/*`
- Server components by default; `"use client"` where needed
- Content-heavy routes use `export const dynamic = "force-dynamic"`
- Tailwind classes composed via `cn()` helper
- Dark theme only — design around `--background: #000`, `--foreground: #fff`, `--surface`, `--border`
- Animations via `motion/react-client` with staggered delays
- Admin endpoints gated by `requireAdmin(req)` middleware; sanitize user HTML with `isomorphic-dompurify`
- Security headers (CSP, X-Frame-Options, Permissions-Policy) configured in `next.config.ts`
