# effects & flourishes

these are the registry's decorative and motion components: text effects (chrome, rainbow, scramble), ascii renderers (ascii, ascii-shader, donut, not-found), entrance animation (fade-in, intro, count-up), drafting surfaces and marks (blueprint, dimension, grain, hazard, pencil-rule, stamp), and interactive flourishes (marquee, pfp, sprite-scrubber, stack). all are dark-only and brutalist by default. most are dependency-free — they animate with requestAnimationFrame, WAAPI, or CSS keyframes hoisted into `<head>` via react's `<style precedence>` dedup — and only intro and not-found pull in `motion`. several are designed to compose: ascii, ascii-shader and donut are plain-paint text so wrapping them in chrome foils every glyph.

the drafting group is the one place the registry expects to be recoloured: blueprint, dimension, grain, hazard, pencil-rule and stamp all take their colour through props and default to white, so a consuming site can point them at its own accent without the library itself gaining a palette.

## ascii

**Role:** renders ascii art on an exact, drift-free character grid.
**Install:** `bunx @justin06lee/chrome@latest add ascii`
**Composes:** nothing beyond utils

renders a mono `<pre>` locked to a fixed character grid. the critical trick is turning font ligatures and contextual alternates off (`fontVariantLigatures: "none"` plus `fontFeatureSettings: '"liga" 0, "calt" 0'`) — otherwise glyph pairs like `=>`, `|-`, or `fi` merge and break column alignment. it also sets `tabSize: 4`, `textRendering: "geometricPrecision"`, `whitespace-pre`, and a tight 1.15 line-height so box-drawing rows touch.

art comes from either a `src` .txt file or a string child. `src` is fetched on mount through a module-level promise cache, so the same file is fetched once per page no matter how many instances render it; a failed fetch is evicted from the cache so a later mount can retry. with both `src` and children, the inline art renders as the placeholder until the file loads (and stays if the fetch fails). loaded text is normalized: BOM stripped, `\r\n` unified to `\n`, and only trailing newlines dropped — leading spaces and interior blank lines are meaningful and preserved.

pass `label` to get `role="img"` with an aria-label; omit it and the art is `aria-hidden` (decorative). the output is static, plain-painted text, which means wrapping it in `<Chrome>` foils every glyph with zero extra setup — the ascii demo does exactly that.

**Key props:**
- `src: string — url/path of a .txt file holding the art; fetched once and rendered exactly.`
- `children: string — inline art; with src, shows until the file loads.`
- `label: string — accessible name (role="img"); omit for decorative art.`
- `size: number = 12 — font size in px.`
- `lineHeight: number = 1.15 — line-height multiplier.`
- `className: string`

**Example:**
```tsx
<Ascii src="/ascii/cat.txt" label="ascii cat" />

<Chrome as="div">
  <Ascii src="/ascii/cat.txt" label="chrome-foiled cat" />
</Chrome>
```

## ascii-shader

**Role:** ascii fragment shader — a character grid painted by a per-cell function of position and time.
**Install:** `bunx @justin06lee/chrome@latest add ascii-shader`
**Composes:** nothing beyond utils

the general form of what `donut` does for one fixed torus. you supply `(x, y, t) => luminance` and the component owns the grid, the ramp and the loop. each frame is built as one string and assigned to `pre.textContent` — a single text mutation per frame, no per-cell dom, no react re-render.

three things keep it cheap. the loop is capped at `fps` (24 by default) rather than running free — ascii reads fine well below 60 and the saving is real. an IntersectionObserver stops the loop entirely while the element is off-screen, so a shader below the fold costs nothing. and under `prefers-reduced-motion` it paints one frame at t=0 and never starts a loop at all.

the character cell is measured on mount with a hidden probe, because the aspect correction that makes a circle round depends on the actual font rather than an assumed ratio. `x` and `y` arrive at the shader already corrected and normalised against the shorter physical side, so `x*x + y*y` describes a real circle. `col`/`row` are also passed for grid-space effects.

grid size is auto-fit to the element by default. with auto rows the `<pre>` is taken out of flow (absolutely positioned), because otherwise adding a row would grow the host, which would fit another row, and the ResizeObserver would never settle — so **give the element a height** when you let rows auto-fit. pass explicit `cols`/`rows` to size the grid instead.

`isolate` behaves exactly as it does on `donut`: containment isolates the per-frame repaint and is faster, but it creates its own paint context, so pass `isolate={false}` inside `<Chrome>` or the foil won't paint through. `paused` holds the clock rather than the frame, so resuming continues where it stopped instead of jumping forward.

three preset shaders ship as named exports: `plasma` (interfering sine fields), `ripple` (rings travelling outward), `tunnel` (rotating spiral).

**Key props:**
- `shader: (point: ShaderPoint) => number (required) — returns luminance 0..1; point is { col, row, x, y, t, cols, rows }.`
- `cols: number — fixed column count; omit to fill the element's width.`
- `rows: number — fixed row count; omit to fill the element's height (which then has to be set on the element).`
- `chars: string = ' .:-=+*#%@' — luminance ramp, dark to light.`
- `fps: number = 24`
- `speed: number = 1 — multiplies the time fed to the shader.`
- `paused: boolean = false`
- `size: number = 12 — font size in px; drives the auto-fit grid.`
- `isolate: boolean = true — set false inside <Chrome>.`
- `label: string — accessible name; without one the canvas is decorative and hidden.`
- `className: string`

**Example:**
```tsx
import { AsciiShader, ripple } from "@/components/chrome/ascii-shader";

<AsciiShader shader={ripple} label="ripple field" className="h-64" />

// your own shader, chrome-foiled (note isolate={false})
<Chrome as="div">
  <AsciiShader
    isolate={false}
    cols={80}
    rows={24}
    shader={({ x, y, t }) => (Math.sin(x * 6 + t) + Math.cos(y * 4 - t)) / 4 + 0.5}
  />
</Chrome>
```

## blueprint

**Role:** engineering graph-paper substrate with corner marks and an optional pointer crosshair.
**Install:** `bunx @justin06lee/chrome@latest add blueprint`
**Composes:** nothing beyond utils

wraps its children in a positioned element and paints a grid behind them at `-z-10`. the grid is four stacked `linear-gradient`s on one span rather than a tiled image: it stays crisp at any zoom, costs no request, and the major lines can be recoloured independently — major is declared first so it paints over the minor line it shares a pixel with. set `major={0}` for minor lines only.

`fade` masks the grid toward the edges (`radial`, `top`, `bottom`) so it reads as a substrate rather than as a table. `ticks` adds L-shaped registration marks in the four corners.

`crosshair` tracks the pointer with full-bleed rules and a mono coordinate readout. it reads `pointerType` off the event rather than using a media query, so hybrid laptops stay correct: the crosshair follows the mouse and stays away for the touchscreen. the readout defaults to grid cell coordinates; override with `formatCoordinate`.

colours come in through props, so the component never hardcodes anything but white — point `color`/`majorColor` at your own accent without editing the installed copy.

**Key props:**
- `cell: number = 8 — minor grid pitch in px.`
- `major: number = 5 — minor cells per major line; 0 draws minor only.`
- `color: string = 'rgba(255,255,255,0.05)'`
- `majorColor: string = 'rgba(255,255,255,0.1)'`
- `fade: 'none' | 'radial' | 'top' | 'bottom' = 'none'`
- `ticks: boolean = false — corner registration marks.`
- `crosshair: boolean = false`
- `formatCoordinate: (x: number, y: number, cell: number) => string`
- `as: ElementType = 'div'`
- `children: ReactNode`
- `className: string`

**Example:**
```tsx
<Blueprint fade="radial" ticks crosshair className="min-h-dvh px-8 py-24">
  <h1 className="text-4xl tracking-tight">odd jobs.</h1>
</Blueprint>
```

## chrome

**Role:** wrapper that renders every text glyph inside it as shimmering chrome foil.
**Install:** `bunx @justin06lee/chrome@latest add chrome`
**Composes:** nothing beyond utils

the namesake effect. it paints a three-layer background on the wrapper — a sweeping white shine band, a fine repeating diagonal grain, and a pastel spectrum gradient — then clips the whole stack to the text with `background-clip: text` and `color: transparent`. the shine loop is a `chrome-shine` keyframe animating `background-position` over 5s, shipped inline via `<style precedence="default" href="chrome-shine-keyframes">` so react hoists it to `<head>` and dedupes across instances. `prefers-reduced-motion` freezes the shine mid-sweep instead of animating.

because `background-clip: text` clips the wrapper's gradient to every glyph it contains — descendants included — chrome works as a wrapper around arbitrary content. the catch: a nested element with its own `color` would paint opaque text over the clipped gradient, so a global rule forces `[data-chrome] * { color: transparent !important }`. every descendant's text becomes transparent; do not expect any child inside chrome to keep its own text color.

the glow is deliberately cheap: one sharp bevel drop-shadow (blur 0) plus one 24px-radius glow. the source comments warn that big-radius drop-shadows (60px+) get re-rasterized on every repaint — when chrome wraps animating content like `<Donut isolate={false}>` that rewrites its text every frame, large blurs re-blur ~60 times a second and pin a core. keep that in mind if you customize the glow. speaking of donut: it must be given `isolate={false}` inside chrome, because donut's default `contain: paint` knocks out the inherited foil paint.

for composing the foil onto non-text shapes (a css-masked marker, say), the module exports `CHROME_FOIL_STYLE` and `CHROME_GLOW_STYLE` as plain style objects — pair them with a `data-chrome` attribute so the reduced-motion freeze applies, and render alongside a `<Chrome>` so the keyframes exist.

**Key props:**
- `as: ElementType = 'span'`
- `children: ReactNode (required)`

**Example:**
```tsx
<Chrome as="h1" className="font-serif italic font-bold text-7xl">
  chrome.
</Chrome>
```

## count-up

**Role:** animated number that tweens up to its target value when scrolled into view.
**Install:** `bunx @justin06lee/chrome@latest add count-up`
**Composes:** nothing beyond utils

a dependency-free requestAnimationFrame tween with an easeOutCubic curve (fast start, gentle settle). the first tween (from 0) is gated behind an IntersectionObserver at 0.5 threshold, so instances further down the page hold at 0 and animate when scrolled to; after that gate opens, any later `value` change tweens immediately, starting from whatever value is currently displayed (tracked in a ref) rather than snapping back to 0.

`prefers-reduced-motion` or `duration <= 0` skips the tween and snaps straight to the target. output text gets `tabular-nums` by default so digits don't jitter horizontally while counting. formatting is either `decimals` (a `toFixed` call) or a `format` function that receives the raw in-flight number and overrides `decimals` entirely — use `format` for thousands separators, currency, etc. `prefix`/`suffix` render as plain strings around the number.

use it for stats rows, dashboards, and hero metrics. it renders a `span` by default; pass `as` to change the tag.

**Key props:**
- `value: number (required) — target number to animate toward.`
- `duration: number = 1 — tween length in seconds.`
- `decimals: number = 0 — fixed decimal places; ignored when format is set.`
- `format: (n: number) => string — custom formatter; overrides decimals.`
- `prefix: string — text rendered before the number.`
- `suffix: string — text rendered after the number.`
- `as: ElementType = 'span'`
- `className: string`

**Example:**
```tsx
<CountUp value={1280} className="text-5xl" />
<CountUp value={99.5} decimals={1} suffix="%" duration={1.5} />
```

## dimension

**Role:** architect's dimension line — witness lines, caps, and a measurement in a break in the rule.
**Install:** `bunx @justin06lee/chrome@latest add dimension`
**Composes:** nothing beyond utils

every part inherits `currentColor` from the root, so recolouring the whole annotation is one `color` prop rather than a prop per part. the caps are css triangles rather than an svg marker: they stay a crisp 1px-aligned shape at any DPR. `cap` picks between `arrow`, the draughtsman's 45-degree `tick`, a `dot`, or `none`.

accessibility is opt-in by design. with `ariaLabel` the annotation is exposed as an image; without it the whole thing is `aria-hidden`, which is the right default whenever the measurement is already stated in nearby copy — otherwise a screen reader hears the same number twice.

horizontal fills its container's width; vertical fills its height, so give the vertical form a height (or let a flex parent stretch it).

**Key props:**
- `label: ReactNode — the measurement, rendered in the break in the line.`
- `orientation: 'horizontal' | 'vertical' = 'horizontal'`
- `cap: 'arrow' | 'tick' | 'dot' | 'none' = 'arrow'`
- `extension: number = 8 — half-length in px of the witness lines; 0 removes them.`
- `color: string = 'rgba(255,255,255,0.35)'`
- `ariaLabel: string — exposes it as an image; omit to keep it decorative.`
- `labelClassName: string`
- `className: string`

**Example:**
```tsx
<Dimension label="1 200" ariaLabel="width: 1200 millimetres" />
<Dimension label="640" orientation="vertical" cap="tick" className="h-40" />
```

## donut

**Role:** spinning ascii torus, baked off-thread and replayed as a seamless loop.
**Install:** `bunx @justin06lee/chrome@latest add donut`
**Composes:** nothing beyond utils (installs three extra lib files: donut-frames.ts, donut-cache.ts, donut.worker.ts)

the classic donut.c, engineered for zero steady-state cost. instead of computing torus math every frame, the entire spin loop is precomputed ("baked") into an array of frame strings, and playback is literally `pre.textContent = frames[i]` on requestAnimationFrame — pure array iteration. the loop is mathematically seamless: exactly 5 x-axis turns per 3 z-axis turns over N frames, so frame N wraps back to frame 0 with no visible seam.

the bake runs in a single process-wide web worker shared by every donut on the page. `donut-cache.ts` keys bakes by the full config, so N identical donuts share one bake, one frame array, one worker — refcounted, evicted when the last instance unmounts, worker terminated when no bakes remain. if the worker fails to load or never answers within 1s (blocked in some bundlers), a chunked main-thread bake fills the array over idle slices instead; before the bake lands, frames are computed live on demand and cached, so nothing is ever rendered twice. sampling density adapts to the projected circumference and to device tier (`hardwareConcurrency`/`deviceMemory`); low-end devices get coarser sampling and a ~30fps frame budget.

on mount it measures the actual char-cell aspect ratio (char width over line height) with a hidden probe so the torus isn't squashed by your font, and auto-fits the projection scale `K` to the grid so the donut never clips at any width/height — only pass `K` if you want manual control. the defaults (60x30 grid) are what the demo renders as just `<Donut />`.

the key composition gotcha is `isolate`. by default the `<pre>` gets `contain: layout paint style`, which isolates the per-frame repaint and is faster. but css containment creates its own paint context, which knocks out `<Chrome>`'s `background-clip: text` foil — so inside chrome you must pass `isolate={false}` (and chrome's small 24px glow exists precisely to keep that combination affordable).

**Key props:**
- `width: number = 60 — char columns`
- `height: number = 30 — char rows`
- `R: number = 0.4 — torus center radius`
- `r: number = 0.25 — torus tube radius`
- `K: number — projection scale; omit to auto-fit the torus to the grid`
- `D: number = 4 — camera distance`
- `du: number — optional override for the adaptive u-sampling step (radians)`
- `dv: number — optional override for the adaptive v-sampling step (radians)`
- `speed: number = 0.5625`
- `luminanceChars: string = ' ,-~:;=!*#$@'`
- `lightDirection: [number, number, number] = [0, 1, -1]`
- `yScaleOverride: number — override the measured char-cell aspect`
- `background: string — CSS background applied to the root element. transparent by default.`
- `isolate: boolean = true — apply CSS contain to isolate per-frame repaint; set false inside <Chrome> so the foil paints through`

**Example:**
```tsx
<Donut />

// chrome-foiled hero donut (note isolate={false})
<Chrome as="div">
  <Donut width={44} height={20} isolate={false} />
</Chrome>
```

## fade-in

**Role:** fade + translate a node in on mount, with a stagger helper for lists.
**Install:** `bunx @justin06lee/chrome@latest add fade-in`
**Composes:** nothing beyond utils

pure css, no motion dependency, and no "use client" — it's server-component safe. a single `chrome-fade-in` keyframe drives opacity 0 to 1 and `translate(var(--fade-x), var(--fade-y))` to 0; each instance passes its offsets as css custom properties and its `delay`/`duration` as inline `animationDelay`/`animationDuration`, so one shared keyframe serves every configuration. the keyframes ship inline via `<style precedence="default" href="chrome-fade-in-keyframes">`, hoisted to `<head>` and deduped by href across instances — nothing to wire up. `prefers-reduced-motion` disables the animation.

`animation-fill-mode: both` is what makes staggering work: elements stay at opacity 0 during their delay instead of flashing visible then restarting. stagger a list with the exported `staggerDelay(index, step = 0.08, base = 0)` helper, which returns `base + index * step` seconds. easing is a snappy ease-out cubic-bezier(0.16, 1, 0.3, 1).

it animates on mount only — there is no in-view trigger and no exit animation. to replay it (or re-stagger a list), remount with a changed `key`, which is what the demo's replay button does. use `x`/`y` to control the entrance direction; the default is a subtle 10px drop-in from above.

**Key props:**
- `as: ElementType = 'div' — element/component to render.`
- `delay: number = 0 — delay before the animation starts, in seconds.`
- `y: number = -10 — starting vertical offset in px (animates to 0).`
- `x: number = 0 — starting horizontal offset in px (animates to 0).`
- `duration: number = 0.8 — animation duration in seconds.`
- `className: string`
- `children: ReactNode`

**Example:**
```tsx
{items.map((item, i) => (
  <FadeIn key={item.id} delay={staggerDelay(i)}>
    {item.title}
  </FadeIn>
))}
```

## grain

**Role:** paper / film texture overlay.
**Install:** `bunx @justin06lee/chrome@latest add grain`
**Composes:** nothing beyond utils

the texture is an inline svg `feTurbulence` data uri rather than a bundled png: a few hundred bytes, resolution-independent, and retunable without shipping a second asset. `noise` is `fractalNoise` (even film speckle), `paper` is `turbulence` with a stretched base frequency (long fibrous streaks, like stock), and `dots` is a radial-gradient dot screen that inherits `currentColor`.

`scale` means different things per variant and so has no shared default — it is the turbulence base frequency for noise/paper (0.8, higher is finer) and the dot pitch in px for dots (4). omit it and each variant resolves its own.

the layer is `pointer-events-none` and `aria-hidden`, so it can sit over live ui at any z-index without swallowing clicks. `fixed` (the default) covers the viewport for a page-wide texture; `fixed={false}` covers the nearest positioned ancestor, for texturing one panel. keep `opacity` low — past about 0.12 grain reads as dirt.

`animate` steps the background position through a handful of offsets rather than tweening it: smooth motion reads as a moving pattern, whereas discrete jumps read as grain. frozen under reduced motion.

**Key props:**
- `variant: 'noise' | 'paper' | 'dots' = 'noise'`
- `opacity: number = 0.05`
- `scale: number — base frequency (noise/paper, default 0.8) or dot pitch in px (dots, default 4).`
- `animate: boolean = false`
- `fixed: boolean = true — false scopes it to the nearest positioned ancestor.`
- `blend: CSSProperties['mixBlendMode']`
- `className: string`

**Example:**
```tsx
// page-wide film grain
<Grain animate opacity={0.06} />

// one textured panel
<div className="relative overflow-hidden border border-white/10">
  <Grain variant="paper" fixed={false} opacity={0.09} />
  <p className="relative">…</p>
</div>
```

## hazard

**Role:** diagonal caution-stripe tape — a band that reads as a boundary, plus a frame that tapes the edges of a block.
**Install:** `bunx @justin06lee/chrome@latest add hazard`
**Composes:** nothing beyond utils

two exports. `Hazard` is the band itself — horizontal or vertical, sized by `thickness`, usable as a divider, a rule, or an edge. `HazardFrame` wraps content and tapes the sides named in `edges`; the tape is absolutely positioned so it never enters the flow, and the frame can be dropped around an existing block without re-measuring anything (give the content padding on the taped sides yourself).

deliberately not a `progress` variant: progress encodes a value, this encodes a boundary. the band is `aria-hidden` with no semantics of its own.

the stripes are a `repeating-linear-gradient` with hard stops, so the edges stay knife-sharp at any pitch instead of blurring like a tiled png. `animate` marches them, and the march displaces the background along the gradient's own axis — shifting by one pitch on x alone would be short by a factor of sin(angle) and the loop would visibly jump. frozen under reduced motion.

**Key props:**
- `thickness: number = 8 — band thickness in px.`
- `pitch: number = 12 — one stripe plus one gap, in px.`
- `angle: number = 45`
- `color: string = 'rgba(255,255,255,0.22)'`
- `gapColor: string = 'transparent'`
- `orientation: 'horizontal' | 'vertical' = 'horizontal' — Hazard only.`
- `animate: boolean = false`
- `duration: number = 1.2 — seconds per stripe cycle.`
- `edges: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'bottom'] — HazardFrame only.`
- `className: string`

**Example:**
```tsx
<Hazard animate />

<HazardFrame edges={["left"]} thickness={6}>
  <div className="border border-white/10 py-6 pl-10 pr-6">work in progress.</div>
</HazardFrame>
```

## intro

**Role:** full-screen splash overlay that plays a timed hero + line sequence, then fades out.
**Install:** `bunx @justin06lee/chrome@latest add intro`
**Composes:** motion (npm)

a fixed inset-0 z-[100] black overlay driven by motion/react (`motion/react-client` elements plus `AnimatePresence`). an optional `hero` node enters at the 1s mark and holds on top for the whole sequence while each entry in `lines` takes a turn in a fixed-height slot beneath it: fade in from above, hold 3s, fade out downward, 1s gap, next line. every line renders absolutely into the same slot so the layout never shifts. the hero leaves with the last line, then the whole overlay fades (0.7s) and unmounts; `onComplete` fires only after the exit fade finishes, via AnimatePresence's `onExitComplete`. the timeline is fixed — you control pacing only through `speed`, which divides every duration and delay (2 = twice as fast).

`persistKey` is the play-once gate: after completing (or being skipped), the intro writes `localStorage[persistKey] = "true"` and will not replay on later mounts. the visibility state starts as null while the localStorage check resolves, so nothing flashes for returning visitors. omit `persistKey` to play on every mount. a skip button (default label "skip") sits at the bottom and triggers the same graceful fade-out — it never snaps.

body scroll is locked (`overflow: hidden`) while the overlay is visible and restored on exit. `useReducedMotion` collapses the entire timeline to zero durations and offsets, so reduced-motion users see an instant pass-through. the demo mirrors the justin06lee.dev homepage: the hero is a chrome-foiled donut (`<Chrome as="div"><Donut width={44} height={20} isolate={false} /></Chrome>`) and lines can be arbitrary react nodes, including inline images.

**Key props:**
- `lines: ReactNode[] (required) — lines shown one at a time in a fixed slot under the hero, in order.`
- `hero: ReactNode — optional visual rendered above the lines for the whole intro (e.g. ascii art).`
- `speed: number = 1 — playback speed multiplier; 2 plays the sequence twice as fast.`
- `onComplete: () => void — called once after the overlay finishes fading out (also on skip).`
- `skippable: boolean = true — whether to show the skip button.`
- `skipLabel: string = 'skip' — label for the skip button.`
- `persistKey: string — when set, plays only once and remembers via localStorage.`
- `className: string — extra classes for the overlay.`

**Example:**
```tsx
<Intro
  hero={<Chrome as="div"><Donut width={44} height={20} isolate={false} /></Chrome>}
  lines={["hi.", "im justin.", "welcome."]}
  persistKey="intro-played"
  onComplete={() => setReady(true)}
/>
```

## marquee

**Role:** infinite scrolling ticker band.
**Install:** `bunx @justin06lee/chrome@latest add marquee`
**Composes:** nothing beyond utils

speed is specified in px/s and the duration is *derived* from the measured content width, so a short label and a long sentence travel at the same rate — a fixed duration would make them scroll at wildly different speeds. the copy count is computed from the container width rather than hardcoded to two, because content narrower than the container needs as many repeats as it takes to cover it plus one, or the band shows a hole between loops. only the first copy is exposed to assistive tech; the rest are `aria-hidden`.

`pauseOnHover` (on by default) halts the band under the pointer. `fade` masks the left and right edges so content arrives and leaves softly. under reduced motion the animation is dropped entirely and the first copy sits still — a ticker that can't be paused is a real accessibility problem, and a static label is a legitimate reading of the same content.

**Key props:**
- `children: ReactNode (required)`
- `speed: number = 40 — px per second.`
- `reverse: boolean = false`
- `gap: number = 32 — px between repeats.`
- `separator: ReactNode — rendered between repeats.`
- `pauseOnHover: boolean = true`
- `fade: boolean = false`
- `className: string`

**Example:**
```tsx
<Marquee fade separator={<span className="text-white/20">/</span>} className="border-y border-white/10 py-3">
  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">now building</span>
</Marquee>
```

## not-found

**Role:** drop-in 404 block — a random ascii cat above a big mono headline and links.
**Install:** `bunx @justin06lee/chrome@latest add not-found`
**Composes:** ascii (registry), motion (npm)

the justin06lee.dev 404 page as a component. one of ten embedded ascii cats (shipped in `cat-ascii.ts`, no public files to copy) fades in above a big mono headline, a muted excuse line, and a row of footer links, each element staggered in with motion fades. the cat is picked in a `useEffect` on mount so server and client markup agree (SSR-safe — the server renders a blank slot, the cat fades in client-side). pass `cat` (0-9) to pin a specific cat, e.g. for visual regression tests; the demo's "another cat" button just remounts with a new key.

installation is the special part: alongside `not-found.tsx` and `cat-ascii.ts`, it installs `page.tsx` as `app/not-found.tsx` (a `registry:page` file), so next.js immediately renders it for `notFound()` calls and unmatched routes with zero wiring. if you already have an `app/not-found.tsx`, expect a collision. the installed page wraps the block in `min-h-screen bg-black text-white` centering — the block itself deliberately ships no page chrome (no navbar, no min-height); that is the caller's job when composing it elsewhere.

links are plain `<a>` anchors, framework-agnostic. `credit` toggles the small "made by justin06lee.dev" line at the bottom (on by default — turn it off if you don't want it). the cat renders through the `ascii` component with responsive text sizing.

**Key props:**
- `title: string = '404' — big mono headline.`
- `message: string = 'this page wandered off…' — muted line under the headline.`
- `links: { label: string; href: string }[] = [{ label: 'home', href: '/' }] — footer links (plain anchors).`
- `cat: number — fix the cat (0-9) instead of picking randomly on mount.`
- `credit: boolean = true — show the subtle 'made by justin06lee.dev' line.`
- `className: string`

**Example:**
```tsx
// installed automatically as app/not-found.tsx; or compose it yourself:
<div className="flex min-h-screen items-center justify-center bg-black text-white">
  <NotFound links={[{ label: "home", href: "/" }, { label: "docs", href: "/docs" }]} />
</div>
```

## pencil-rule

**Role:** a rule that draws itself, with a pencil riding the leading edge.
**Install:** `bunx @justin06lee/chrome@latest add pencil-rule`
**Composes:** nothing beyond utils

the stroke is a `scaleX`-ed element rather than an animated `width`: transform composites, width doesn't, so the draw can't cause layout on any frame. the pencil rides a zero-height full-width track translated by a percentage — a percentage on the pencil itself would resolve against its own 46px — and shares the stroke's timing function, which is what keeps the nib pinned to the end of the line. mismatched curves are exactly what make a drawing effect read as fake. the pencil fades out once it lands.

`trigger` is `in-view` by default (IntersectionObserver at 0.2); `mount` draws immediately. `drawn` always starts false even for `mount`, because flipping it in the same render leaves the browser no undrawn frame to transition from. set `repeat` to redraw on every re-entry. replay it manually by remounting with a changed `key`.

under reduced motion the finished line renders immediately and the pencil never appears — the rule's job is to be a rule, and the drawing is decoration.

**Key props:**
- `duration: number = 1.2 — seconds to cross the full width.`
- `delay: number = 0`
- `trigger: 'in-view' | 'mount' = 'in-view'`
- `repeat: boolean = false`
- `thickness: number = 1`
- `color: string = 'rgba(255,255,255,0.35)'`
- `pencilColor: string = 'rgba(255,255,255,0.75)'`
- `showPencil: boolean = true`
- `className: string`

**Example:**
```tsx
<h1 className="text-3xl tracking-tight">odd jobs, done properly.</h1>
<PencilRule delay={0.2} className="mt-1" />
```

## pfp

**Role:** profile-picture tile that tilts in 3d on hover with a cartoon glint sweep.
**Install:** `bunx @justin06lee/chrome@latest add pfp`
**Composes:** nothing beyond utils

an image framed in a bordered square (default `size-16`, resize via `className`) inside a `perspective: 500px` parent. on hover the tile rotates `rotateX`/`rotateY` by `rotate` degrees with a springy css transition (cubic-bezier(0.2, 0.9, 0.2, 1)), and a thick solid-white diagonal stripe sweeps across it once — the cartoon glint. the sweep is a WAAPI `element.animate()` of transform only (`translate3d(-300%) to translate3d(400%)`, 800ms), so it stays on the compositor; each hover cancels any in-flight sweep and plays a fresh one. a subtle implementation detail worth copying: the stripe's 25-degree slant uses the standalone css `rotate` property, which the WAAPI `transform` animation does not override.

the stripe rests off the tile's left edge, clipped by `overflow-hidden`, so nothing shows at rest. frame the subject inside the tile with `x`/`y` (percent translate of the image) and `scale` (zoom) — useful when the source photo isn't already a tight square crop. the image is `object-cover`, non-draggable, and pointer-events-none so the hover target is the tile itself.

hover-only by design: there is no touch equivalent, so on touch devices it's just a static framed image. the component also accepts `className` for sizing even though it isn't in the meta prop list.

**Key props:**
- `src: string (required)`
- `alt: string = ''`
- `x: number = 0 — horizontal framing offset, % of tile.`
- `y: number = 0 — vertical framing offset, % of tile.`
- `scale: number = 1 — zoom of the image inside the tile.`
- `rotate: number = 14 — tilt angle on hover, in degrees.`

**Example:**
```tsx
<Pfp src="/pfp.png" alt="justin's pfp" />
<Pfp src="/pfp.png" className="size-24" scale={1.2} />
```

## rainbow

**Role:** wrapper that cycles every text character inside it through a staggered rainbow.
**Install:** `bunx @justin06lee/chrome@latest add rainbow`
**Composes:** nothing beyond utils

recursively rebuilds its child tree, replacing every text character with an inline-block `<span>` running a shared `chrome-rainbow-cycle` keyframe that animates `color` through six hue stops. the stagger comes from negative `animationDelay` values (`-stagger * index`), so every character is already mid-cycle on mount — no wave-in, just a continuously flowing rainbow. a monotonic counter hands out indices across the whole subtree, so the stagger flows continuously through nested elements (links, spans) rather than restarting per text node; element wrappers are preserved via `cloneElement`. the keyframes ship via `<style precedence="default" href="chrome-rainbow-keyframes">`, deduped across instances.

accessibility is handled the same way as scramble: an sr-only span carries the extracted plain text for assistive tech, while every animated glyph span is `aria-hidden`. text is extracted recursively from the child tree, so nested markup still yields a sensible accessible name.

cost scales with character count — every character is its own animated element with its own color animation, so keep this to short strings (headings, logos, a word or two), not paragraphs. note there is no prefers-reduced-motion handling in this component. per-char spans are `white-space: pre` so spaces survive the split.

**Key props:**
- `children: ReactNode (required)`
- `as: ElementType = 'span'`
- `duration: number = 3 — seconds per cycle`
- `stagger: number = 0.25 — delay step per char (s)`
- `background: string — CSS background applied to the root element. transparent by default.`

**Example:**
```tsx
<Rainbow className="font-mono text-4xl">^cat^</Rainbow>
```

## scramble

**Role:** wrapper that scrambles every word inside it on hover, then resolves left to right.
**Install:** `bunx @justin06lee/chrome@latest add scramble`
**Composes:** nothing beyond utils

recursively rebuilds its child tree, splitting text nodes on whitespace into independent hover targets: each word becomes a `ScrambleWord` span, whitespace runs stay plain spans, and element wrappers (links, nested spans) are preserved. hovering a word starts a `setInterval` loop that rewrites the visible span's `textContent` directly — no react re-renders per frame — showing random lowercase letters that lock in from the left as `iteration` advances by `step` per tick, until the real word is restored. re-hovering mid-scramble restarts cleanly (the old interval is cleared).

layout stability is handled with a hidden off-screen sizer span holding the real word: its measured width (tracked by ResizeObserver) becomes the visible span's `minWidth`, so random glyphs of different widths never make the line reflow. each word also carries an sr-only copy of the real text for assistive tech while the scrambling glyphs are `aria-hidden`, so screen readers never hear the noise.

scrambling substitutes only lowercase a-z regardless of the source characters, and the effect is per-word — hovering one word in a sentence scrambles just that word. hover-only, so it's inert on touch devices, and there is no prefers-reduced-motion handling. good for nav links, headings, and labels where you want the terminal-decrypt vibe on pointer devices without any dependency.

**Key props:**
- `children: ReactNode (required)`
- `as: ElementType = 'span'`
- `speed: number = 30 — ms between scramble frames`
- `step: number = 1/3 — chars to lock per frame`
- `background: string — CSS background applied to the root element. transparent by default.`

**Example:**
```tsx
<Scramble>hover to scramble</Scramble>
```

## sprite-scrubber

**Role:** scrub through a sprite-sheet grid by dragging — pointer x maps to a frame index.
**Install:** `bunx @justin06lee/chrome@latest add sprite-scrubber`
**Composes:** nothing beyond utils (installs two files: sprite-scrubber.tsx and the pure scrub.ts mapping helpers)

renders a bordered black container with the sprite sheet as a css `background-image` sized to `cols*100% x rows*100%`; showing frame N is just setting `background-position` percentages, so scrubbing never swaps images or touches the DOM tree. pointer x within the container maps linearly to a frame index across the FULL width — `edgeLeft`/`edgeRight` never clamp the mapping; they only bound `onEdge` sweep detection (see below). `reverse` defaults to true, meaning moving left plays forward, matching the original justin06lee.dev artifact; pass `reverse={false}` for a conventional scrubber. the mapping and edge logic live in the shipped `scrub.ts` as pure functions (`relXToFrame`, `stepEdge`, `seedEdge`), separately testable.

`onEdge` fires when the pointer reaches one edge zone (x ≤ edgeLeft or x ≥ edgeRight, defaults 0.22/0.78) after last visiting the opposite one — exactly once per full sweep, never on re-entering the same zone. the tracker is seeded by which half the pointer entered on, so a sweep completed outside the container doesn't fire on re-entry, and touch drags re-arm on pointer-up. use it for "swept the whole animation" triggers. the sheet is also preloaded: a built-in "loading..." overlay covers the container until the image loads (replace it with `renderLoading` — return null to disable), and `onLoad` fires once on successful load; a failed load clears the overlay and leaves the bordered black box.

it is tuned to avoid per-move jank: the container rect is measured once per pointer session (on enter/down) instead of on every pointermove, and frame updates are coalesced through a single requestAnimationFrame so a burst of moves paints at most once per vsync. `onFrameChange` fires only when the displayed frame actually changes. pointer capture on pointerdown keeps a drag alive outside the bounds; mouse users scrub on plain hover-move, while touch/pen require pressing (moves with `buttons === 0` are ignored on non-mouse pointers).

one sharp gotcha the source calls out: the css `url()` is quoted because svg data URIs routinely contain raw parentheses, and an unquoted url token silently drops the whole declaration. if you build svg data URIs yourself, also escape `(` and `)` as `%28`/`%29` (encodeURIComponent leaves them raw) — the demo does exactly this. the root has `role="img"` and no default accessible name, so pass an `aria-label`. give it a size via `className` and, if the sheet cells aren't square, an explicit `aspectRatio`.

**Key props:**
- `src: string (required) — url or data uri of the sprite sheet grid.`
- `frames: number (required) — total number of frames in the sheet.`
- `cols: number (required) — number of columns in the grid.`
- `rows: number (required) — number of rows in the grid.`
- `edgeLeft: number = 0.22 — left edge zone as a fraction in [0,1]. bounds onEdge sweep detection only — frames always map across the full width.`
- `edgeRight: number = 0.78 — right edge zone, same rules.`
- `reverse: boolean = true — moving left plays forward.`
- `aspectRatio: string — css aspect-ratio for the root (e.g. "1 / 1").`
- `mode: "pointer" = "pointer" — interaction mode.`
- `onFrameChange: (frame: number) => void — fired when the displayed frame changes.`
- `onEdge: (edge: "left" | "right") => void — fired once per full sweep, when the pointer reaches one edge zone after last visiting the opposite one.`
- `onLoad: () => void — fired once the sprite sheet image has loaded.`
- `renderLoading: () => ReactNode — custom node while the sheet loads; defaults to a "loading..." overlay, return null to disable.`
- `className: string`

**Example:**
```tsx
<SpriteScrubber
  src="/sheet.png"
  frames={12}
  cols={4}
  rows={3}
  reverse={false}
  aspectRatio="1 / 1"
  className="w-64"
  aria-label="product spin"
  onEdge={(edge) => console.log(`swept to ${edge}`)}
/>
```

## stack

**Role:** stacked-paper card that fans its layers out with a spring on hover.
**Install:** `bunx @justin06lee/chrome@latest add stack`
**Composes:** nothing beyond utils

a pile of bordered black cards: `layers` empty paper sheets sit behind one front card that holds your `children`. at rest the sheets are slightly rotated (each deeper layer a bit more) so the stack reads as paper; on hover every layer springs to a fanned-out rotation and offset — back sheets swing left and down, the front card tips right and up. the "spring" is plain css: a 500ms transform transition with an overshoot bezier, cubic-bezier(0.34, 1.56, 0.64, 1), so there is no animation library and no javascript beyond a hover state flag. the fan-out respects `prefers-reduced-motion` — reduced-motion users get a stack that sits still on hover.

each layer carries its own box-shadow (heavier on the front card) for depth, and the back sheets are `aria-hidden` since they're purely decorative. the root defaults to `h-44 w-40` (`relative`); override the size with `className` — children fill the front card absolutely, so give them their own padding and layout (the demo uses a flex column with `p-4`).

hover-only interaction, mouse events specifically (`onMouseEnter`/`onMouseLeave`), so it stays folded on touch devices. good for article cards, portfolio pieces, or anything that benefits from a physical "pick me up" affordance. more layers cost almost nothing — they're empty divs — but 1-2 reads best. `file-card` (in `references/content-data.md`) is the registry's own composition of it: a download card dressed as a stacked file.

**Key props:**
- `layers: number = 1 — paper layers behind the front card`
- `children: ReactNode (required)`
- `background: string — CSS background applied to the root element. transparent by default.`

**Example:**
```tsx
<Stack>
  <div className="flex h-full flex-col justify-between p-4">
    <p className="text-xs uppercase tracking-widest text-white/55">article</p>
    <p className="text-sm font-medium">stacked paper card</p>
  </div>
</Stack>
```

## stamp

**Role:** rubber-stamp overlay — mono uppercase in a double rule, rotated off square.
**Install:** `bunx @justin06lee/chrome@latest add stamp`
**Composes:** nothing beyond utils

the counterpart to `badge`. a badge is a flat inline chip that participates in a row of metadata; a stamp is an assertion applied *on top of* something — it rotates, it overlaps, and it usually sits absolutely positioned over the document it marks. pair it with `docket`'s `mark` slot.

the inner rule is a real inset element rather than a box-shadow, because a gapped double rule can't be drawn with `inset` shadows on a transparent background. `distress` masks the ink with a coarse turbulence, so it inherits the ink colour automatically and there is nothing to load.

`ariaLabel` defaults to the text when `children` is a string; pass it explicitly for anything else, or `null` to mark the stamp decorative.

**Key props:**
- `children: ReactNode (required)`
- `sub: ReactNode — second line: a date, a reference, an initial.`
- `rotate: number = -12`
- `color: string = 'rgba(255,255,255,0.55)' — ink colour.`
- `size: 'sm' | 'md' | 'lg' = 'md'`
- `distress: boolean = true`
- `ariaLabel: string | null`
- `className: string`

**Example:**
```tsx
<div className="relative border border-white/10 p-6">
  <p>oj-0042 — rebuild the intake form</p>
  <Stamp size="lg" className="absolute right-6 top-6">filed</Stamp>
</div>
```
