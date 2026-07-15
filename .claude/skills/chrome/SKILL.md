---
name: chrome
description: Use when building UI with the chrome component library (chrome.justin06lee.dev / @justin06lee/chrome) — installing its components, composing them into pages, matching its dark brutalist design language, or deciding which chrome component fits a job. Triggers on phrases like "use chrome components", "add a chrome component", "install from chrome.justin06lee.dev", "chrome-ui", "justin06lee's components", or any work inside a project that has a chrome.json.
---

# chrome

chrome is a dark-only, brutalist, own-the-code react component registry —
shadcn-style. components are not an npm dependency: the cli copies their
source into the project (`components/ui/…`), and from then on the project
owns and edits that code. the canonical docs live at
https://chrome.justin06lee.dev and every component page there has live
demos, copyable usage examples, and a props table.

there are ~59 components, from primitives (button, input, kbd) through
overlays (dialog, command-palette, sheet) and effects (donut, chrome foil,
scramble) up to a full markdown editor suite (desk). per-component
reference — role, internals, every prop, gotchas, canonical example — is
split across the files in `references/`:

| file | covers |
|------|--------|
| `references/primitives.md` | badge, button, card, checkbox, color-swatch, copy-button, input, kbd, range, segmented, tag-input, textarea |
| `references/overlays-nav.md` | accordion, breadcrumb, combobox, command-palette, dialog, menu, navbar, select, sheet, sidebar, tabs, toc, tooltip |
| `references/effects.md` | ascii, chrome, count-up, donut, fade-in, intro, not-found, pfp, rainbow, scramble, sprite-scrubber, stack |
| `references/content-data.md` | article, article-list, calendar, calendar-nav, code-block, collapsible-prose, gallery, heatmap, image-cropper, login-form, prose, showcase, timeline |
| `references/editor.md` | asset-sidebar, desk, drawing-window, editor, editor-toolbar, inline-edit, manager-table, now-playing-bar, socials |

read the relevant reference file before using a component from that group.
do not guess props — the reference lists every prop with its type and
default, taken from the source.

## installing components into a project

requirements: next.js (or any react + tailwind v4 setup) with the app the
cli can patch. all commands run from the project root.

```bash
# one-time setup: writes chrome.json, lib/utils.ts, patches globals.css
bunx @justin06lee/chrome@latest init

# add components (names are kebab-case, several at once is fine)
bunx @justin06lee/chrome@latest add button dialog command-palette

# see what exists / audit local drift
bunx @justin06lee/chrome@latest list
bunx @justin06lee/chrome@latest diff button
```

behavior you can rely on:

- `add` resolves `registryDependencies` **transitively** — adding
  `command-palette` also installs `kbd` and `utils`; adding `desk` pulls the
  whole editor suite. never hand-install a component's dependencies.
- npm `dependencies` (motion, lucide-react, …) are unioned and installed in
  a single pass with the project's package manager.
- files land under the project's alias base: `components/ui/<name>.tsx`,
  `hooks/…`, `lib/utils.ts`. src-layouts (`src/…` with `@/*` mapped in
  tsconfig) are detected automatically.
- page-type files install relative to the app dir: `not-found` drops
  `app/not-found.tsx` (or `src/app/not-found.tsx`) so the 404 page works
  with zero wiring.
- existing files that differ produce a conflict and a nonzero exit instead
  of a silent overwrite; `--overwrite` opts in explicitly.
- components already in the project are owned code — edit them in place;
  `chrome diff <name>` shows drift from the registry copy.

## the design language (match it exactly)

everything chrome ships obeys these rules. code composed around it should
too, or the seams show:

- **dark-only.** black backgrounds (`#000` / `#0a0a0a` surfaces), white
  text with opacity steps (`text-white`, `/70`, `/55`, `/40`, `/30`).
  there is no light theme.
- **square corners, 1px borders.** `border border-white/10..20`, no
  rounded corners (the sole exception: `kbd`'s 3px keycap radius), no
  drop shadows for depth — hierarchy comes from borders and opacity.
- **lowercase copy.** headings, labels, buttons — all lowercase. group
  labels are mono uppercase-tracked (`font-mono text-[11px] uppercase
  tracking-[0.18em] text-white/40`) as the one deliberate contrast.
- **no ascii arrows.** never "→" in copy or code comments; use lucide
  icons (`ArrowRight`, `ArrowDown`) instead.
- **motion is subtle.** fades and 10px y-offsets via `motion/react`
  (0.6–0.8s, staggered delays) or pure css; respect
  `prefers-reduced-motion` — every animated component already does.
- **framework-agnostic.** components render plain `<a>` tags; ones that
  navigate accept a `linkComponent` prop (pass next/link) or take hrefs as
  data. none import next.js APIs (the one exception is the `not-found`
  page file, which is an app-router page by design).

## conventions that hold across every component

- `className` merges via tailwind-merge — later classes win, so sizing and
  spacing overrides (`className="h-96 w-full"`) are the intended
  customization path.
- cross-component imports use `@/components/ui/<name>`, `@/hooks/<x>`,
  `@/lib/utils` — the aliases `init` configures.
- css that a component needs travels inside it: keyframes ship as hoisted
  `<style precedence="default" href="…">` tags (deduped by react), not
  separate stylesheets. don't move them out.
- controlled/uncontrolled: interactive components follow the standard
  pattern — a `value`/`open` prop wins when provided, changes route through
  `onChange`/`onOpenChange`, and they self-manage otherwise.
- sizes: the editor suite uses named presets (`size="sm" | "md" | "lg" |
  "xl" | "2xl" | "screen"`); other components size via className.
- theming: `init` writes a fenced `/* @chrome:theme */ … /* @chrome:end */`
  block into globals.css with the color tokens. edit tokens freely — reruns
  of init only replace the fenced block.

## picking components (fast map)

- text/markdown rendering: `prose` (plain), `article` (page chrome around
  prose), `collapsible-prose` (details/summary), `code-block` (highlighted
  code; prose already routes fenced blocks through it).
- pickers: `select` (small enum), `combobox` (searchable + creatable),
  `menu` (actions), `command-palette` (global cmd+k navigation).
- overlays: `dialog` (modal confirm/form), `sheet` (slide-in panel with
  arbitrary content), `tooltip` (hover hint).
- navigation: `navbar` (top bar), `sidebar` (grouped docs nav + search),
  `breadcrumb`, `toc` (scroll-spy, supports contained scrolling via
  `container`), `tabs` / `segmented` (in-page switching).
- showing collections: `gallery` (searchable card grid with pinned chrome
  foil), `article-list` (article previews), `manager-table` (admin rows),
  `stack` (layered cards).
- flair: `chrome` (foil text effect — wraps anything), `donut` (spinning
  ascii torus), `scramble` (hover text scramble), `rainbow`, `count-up`,
  `fade-in`, `intro` (full-screen splash), `ascii` (exact-grid ascii art),
  `not-found` (404 page with random ascii cats), `pfp` (3d-tilt avatar
  with cartoon glint).
- editor: `desk` is the full markdown workstation (toolbar + assets +
  split panes + save); `editor`, `editor-toolbar`, `asset-sidebar` are its
  parts and compose independently.

## workflow for an agent using chrome

1. check for `chrome.json` in the project root. missing → run `init`.
2. read the reference file for each component you plan to use; confirm the
   props you need exist.
3. `add` the components (one command, several names). trust transitive
   resolution.
4. compose. prefer wiring existing chrome components together over writing
   new ui; the library is designed for composition (gallery is cards +
   chrome + menu + badges; desk is the editor parts).
5. if a component needs to look different, edit the installed copy — it's
   owned code — but keep the design language rules above.
6. verify with the project's own typecheck/build. component pages at
   https://chrome.justin06lee.dev/components/<name> are the source of
   truth for expected look and behavior.
