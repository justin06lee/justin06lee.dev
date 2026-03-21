# CLAUDE.md

## Project Overview
Personal portfolio website for justin06lee.dev. Built with Next.js 15 (App Router), React 19, TypeScript, and Tailwind CSS 4.

## Commands
- `bun run dev` — Start dev server (Turbopack)
- `bun run build` — Production build (Turbopack)
- `bun run start` — Start production server
- `bun run lint` — ESLint

## Tech Stack
- **Framework**: Next.js 15.5.9 with App Router, React 19, TypeScript 5
- **Styling**: Tailwind CSS 4, shadcn/ui (Radix primitives), class-variance-authority
- **Animation**: Motion (framer-motion successor)
- **Theme**: next-themes (dark/light mode)
- **Analytics**: @vercel/analytics
- **Package Manager**: Bun
- **Bundler**: Turbopack

## Project Structure
```
src/
  app/           # Next.js App Router pages & layouts
    page.tsx     # Home page (server component, renders HomePage)
    layout.tsx   # Root layout (metadata, theme provider, navbar)
    projects/    # Projects gallery page
    hobbies/     # Hobbies page
    ideas/       # Ideas page
    in-development/ # Placeholder page
  components/    # React components
    ui/          # shadcn/ui primitives (button, sheet, tabs, etc.)
    HomePage.tsx # Main homepage with scramble text + ASCII donut
    Navbar.tsx   # Responsive nav with mobile sheet menu
    ItemGallery.tsx # Reusable gallery grid
    AsciiDonut.tsx  # ASCII spinning donut animation
  lib/
    utils.ts     # cn() helper (clsx + tailwind-merge)
public/          # Static assets (images, 3D models, fonts)
```

## Conventions
- Path alias: `@/*` maps to `src/*`
- Server components by default; `"use client"` directive where needed
- shadcn/ui components live in `src/components/ui/`
- Tailwind classes via `cn()` utility from `src/lib/utils.ts`
