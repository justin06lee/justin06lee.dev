---
name: chrome
description: Use when building UI with the chrome component library (chrome.justin06lee.dev / @justin06lee/chrome) — installing its components, composing them into pages, matching its dark brutalist design language, or deciding which chrome component fits a job. Triggers on phrases like "use chrome components", "add a chrome component", "install from chrome.justin06lee.dev", "chrome-ui", "justin06lee's components", or any work inside a project that has a chrome.json.
---

# chrome

chrome is a dark-only, brutalist, own-the-code react component registry —
shadcn-style. components are not an npm dependency: the cli copies their
source into the project (default `components/chrome/…`), and from then on
the project owns and edits that code. the canonical docs live at
https://chrome.justin06lee.dev and every component page there has live
demos, copyable usage examples, and a props table.

the registry holds 100+ components, from primitives (button, input, kbd)
through overlays (dialog, command-palette, sheet) and effects (donut,
chrome foil, scramble) up to a full markdown editor suite (desk). it is
**actively grown** — new components land regularly, so treat any count here
as approximate and the reference files as the enumeration. per-component
reference — role, internals, every prop, gotchas, canonical example — is
split across the files in `references/`:

| file | covers |
|------|--------|
| `references/primitives.md` | badge, button, card, checkbox, color-swatch, copy-button, dropzone, field, input, kbd, radio-group, range, segmented, switch, tag-input, textarea |
| `references/overlays-nav.md` | accordion, breadcrumb, combobox, command-palette, dialog, menu, navbar, pagination, select, sheet, sidebar, stepper, tabs, timezone-select, toc, tooltip |
| `references/feedback.md` | callout, empty-state, live-badge, progress, skeleton, toast |
| `references/effects.md` | ascii, ascii-shader, blueprint, chrome, count-up, dimension, donut, fade-in, grain, hazard, intro, marquee, not-found, pencil-rule, pfp, rainbow, scramble, sprite-scrubber, stack, stamp |
| `references/content-data.md` | article, article-list, bar-list, code-block, collapsible-prose, detail-list, docket, file-card, gallery, image-cropper, login-form, prose, showcase, sparkline, stat-tile, streak |
| `references/time-scheduling.md` | add-to-calendar, availability-grid, break-overlay, calendar, calendar-nav, clock, date-strip, heatmap, interval-picker, slot-picker, timeline, timer-ring |
| `references/media.md` | album-art, avatar-stack, lane-bar, lyrics, now-playing-bar, playhead, sound-bars, spectrum, track-list, transport, vinyl, volume, waveform |
| `references/editor.md` | asset-sidebar, desk, drawing-window, editor, editor-toolbar, file-grid, inline-edit, manager-table, socials |

read the relevant reference file before using a component from that group.
do not guess props — the reference lists every prop with its type and
default, taken from the source.

**if a component isn't in the table above**, it may have been added since
this skill was last synced. do not assume it doesn't exist and do not
invent its props: run `bunx @justin06lee/chrome@latest list` to see what
the registry actually serves, and read
`https://chrome.justin06lee.dev/components/<name>` or the installed source
for its props. if you have the registry checked out locally, `node
tools/refs.mjs check` (in this skill's directory) reports exactly which
components and props the references are missing.

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
- files land at the aliases configured in `chrome.json` (defaults:
  `components/chrome/<name>.tsx`, `hooks/…`, `lib/utils.ts`). src-layouts
  (`src/…` with `@/*` mapped in tsconfig) are detected once at `init` and
  recorded as `aliasBase` in chrome.json, so every later `add` writes to the
  same place.
- imports inside installed files are rewritten at install time: registry
  sources use canonical `@/components/ui/<name>` / `@/hooks/<x>` /
  `@/lib/utils` specifiers, and the cli maps them to your chrome.json
  aliases (`diff` applies the same rewrite, so alias differences never show
  as drift).
- page-type files install relative to the app dir: `not-found` drops
  `app/not-found.tsx` (or `src/app/not-found.tsx`) so the 404 page works
  with zero wiring.
- the three bullets above (aliasBase, import rewriting, page files) need cli
  **0.2.0+** (0.2.2 at the time of writing). always run via
  `bunx @justin06lee/chrome@latest` — an older cached/global install writes
  to the repo root with unrewritten `@/components/ui/…` imports. if that
  happens, suspect the cli version first.
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
- **framework-agnostic, with a router escape hatch.** components default to
  plain `<a>` tags and none import next.js APIs (the one exception is the
  `not-found` page file, an app-router page by design). anything that
  navigates takes a `linkComponent` prop — pass next/link for client-side
  navigation — and this is now the norm rather than an exception:
  `button`, `bar-list`, `breadcrumb`, `calendar-nav`, `file-card`,
  `file-grid`, `heatmap`, `prose`, `sidebar` and `album-art` all accept it.
  `button` and `calendar-nav` additionally forward a `prefetch` flag. note
  that only **internal** hrefs route through `linkComponent`; external
  `http(s)` urls always fall back to a plain `<a>`.

## conventions that hold across every component

- `className` merges via tailwind-merge — later classes win, so sizing and
  spacing overrides (`className="h-96 w-full"`) are the intended
  customization path.
- cross-component imports in the registry sources use the canonical
  `@/components/ui/<name>`, `@/hooks/<x>`, `@/lib/utils` — the cli rewrites
  them to your chrome.json aliases on install (default components alias is
  `@/components/chrome`).
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

- text/markdown rendering: `prose` (plain; pass `linkComponent` — e.g.
  next/link — for client-side internal links), `article` (page chrome around
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
  `file-card` (stacked-paper download card), `file-grid` (file browser with
  drag-to-trash delete), `stack` (layered cards).
- dates & activity: `calendar` (month picker; `renderCell` + `cellClassName`
  + `fillHeight` turn it into an agenda month grid), `heatmap` (year density
  view; month labels link out via `monthHref`), `timeline` (day schedule;
  clickable blocks via `onEventClick`, multi-track via `tracks`,
  drag-to-edit via `onEventChange`), `date-strip` (linear run of days when
  the next opening matters more than the week), `calendar-nav` (the header
  controls above any of them — pass `linkComponent` + the `*Href` props to
  page by prefetched link instead of callback).
- booking: `slot-picker` (times with a split-row two-step confirm),
  `availability-grid` (weekly "when am i free" editor — gate saves on the
  exported `isAvailabilityValid`), `timezone-select` (searchable zones
  showing the live local time), `add-to-calendar` (google/outlook links plus
  a generated .ics).
- work & rest timing: `timer-ring` (circular countdown that runs its own
  clock off `endsAt`), `interval-picker` ("every n minutes"),
  `break-overlay` (full-screen rest screen, deliberately hard to dismiss),
  `clock` (analog/digital in any iana zone).
- feedback: `toast` (interrupts from a corner and leaves — provider +
  `useToast()`), `callout` (stays attached to the thing it's about),
  `empty-state` (nothing here, and the action that would fix it),
  `skeleton` (reserve layout while loading), `progress` (linear determinate
  or indeterminate).
- numbers: `stat-tile` (one headline figure + delta; server-renderable,
  takes a `sparkline` as children), `sparkline` (one series inline),
  `bar-list` (ranked labeled quantities — sort before passing),
  `streak` (a run plus its recent history), `detail-list` (unrelated
  label/value facts as a real `<dl>`).
- media & playback: `transport` (controls; each button appears only when
  given a callback), `playhead` (thin scrubber that extrapolates between
  polls via `startedAt`), `waveform` (static envelope, seekable),
  `spectrum` (live analyser — canvas), `sound-bars` (pure-css playing
  meter), `album-art` (cover tile with a real fallback),
  `now-playing-bar` / `lane-bar` (one running activity, or several).
- flair: `chrome` (foil text effect — wraps anything), `donut` (spinning
  ascii torus), `ascii-shader` (any `(x, y, t) => luminance` on a char
  grid), `scramble` (hover text scramble), `rainbow`, `count-up`,
  `fade-in`, `intro` (full-screen splash), `ascii` (exact-grid ascii art),
  `marquee` (scrolling ticker band), `not-found` (404 page with random
  ascii cats), `pfp` (3d-tilt avatar with cartoon glint).
- drafting surfaces & marks: `blueprint` (graph-paper substrate with an
  optional crosshair), `hazard` (caution-stripe tape and frame),
  `dimension` (architect's measurement line), `pencil-rule` (a rule that
  draws itself), `stamp` (rotated rubber stamp — the counterpart to
  `badge`), `grain` (paper/film texture overlay). this group takes its
  colour through props, so it is where a site's accent goes.
- forms & records: `field` (label + control + hint/error, with a render-prop
  that hands the control its aria wiring), `radio-group` (exactly one of
  these, with the arrow-key contract), `switch` (takes effect immediately —
  `checkbox` is for intent a submit commits), `dropzone` (drag-drop upload
  with validation), `textarea` with `counter` (long-form briefs), `stepper`
  (sequenced flow — unlike `tabs`, later steps aren't reachable), `docket`
  (a numbered document with rows and a tear-off stub), `pagination` (page
  navigation for long lists).
- editor: `desk` is the full markdown workstation (toolbar + assets +
  split panes + save); `editor`, `editor-toolbar`, `asset-sidebar` are its
  parts and compose independently; `file-grid` is the standalone asset
  browser to pair with it.

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

if what you need genuinely doesn't exist in the registry, prefer composing
it from what does before writing something new — and if you are working on
the registry itself (or want new components upstreamed into it), use the
`dev-chrome` skill instead, which covers building and contributing them.
