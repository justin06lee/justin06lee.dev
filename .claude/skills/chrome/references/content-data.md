# content & data display

components for rendering content and data: markdown pipelines (prose, collapsible-prose, article, code-block), browsable collections (gallery, article-list, file-card), documents (docket), quantitative display (stat-tile, sparkline, bar-list, streak, detail-list), plus an image cropper, a credential form, and a demo frame (showcase). all share the registry's brutalist conventions: square corners, thin `white/10`–`white/20` borders, mono accents, lowercase copy. every component takes `className` on its root even where meta.ts omits it.

the quantitative set divides by what it can show, and picking wrong is the usual mistake: `stat-tile` is one headline figure (with a delta and a slot a `sparkline` drops into), `sparkline` is one series over time, `bar-list` ranks a handful of labeled quantities, `streak` is an unbroken run plus its recent history, and `detail-list` is unrelated label/value facts about one thing. for a year of density go to `heatmap`, and for a day of scheduled blocks `timeline` — both in `references/time-scheduling.md`.

## article

**Role:** article reading layout — back link, banner, title, date + tags header over a body slot.
**Install:** `bunx @justin06lee/chrome@latest add article`
**Composes:** npm: `motion`, `lucide-react`; registry: nothing beyond utils

renders a centered `<article>` (max-w-3xl) with staggered `motion/react-client` fade-ins: optional back link (ArrowLeft icon + label), optional banner image (max-h 400px, bordered, object-cover), the h1 title, a date + tag-chip row, then `children` as the body. delays step from 0.1s to 0.35s so the page builds top-down on mount.

the `date` prop accepts an ISO string (formatted via `toLocaleDateString("en-US", { timeZone: "UTC", ... })` as e.g. "May 24, 2026") or any unparseable string, which passes through verbatim as a pre-formatted label. the body is a plain slot — the intended pairing is `<Article ...><Prose>{markdown}</Prose></Article>`, keeping the renderer your choice.

reach for `article` when you want the full post page chrome around a body; use `prose` alone when you only need markdown rendered, and `collapsible-prose` when the body should fold per `##` section (it can be the child of `article` too). the banner uses a plain `<img>`, and the back link is a plain `<a>` — no router coupling.

**Key props:**
- `title: string` (required)
- `date: string` — ISO string or pre-formatted label.
- `tags: string[]`
- `banner: string` — banner image URL.
- `backHref: string` — renders a back link.
- `backLabel: string = 'back'` — back link label.
- `children: ReactNode` — body — typically `<Prose>{markdown}</Prose>`.

**Example:**
```tsx
<Article title="building a component registry" date="2026-05-24" tags={["next", "react"]} backHref="/articles">
  <Prose>{markdown}</Prose>
</Article>
```

## article-list

**Role:** searchable, tag-filterable grid of article-preview cards for a blog index.
**Install:** `bunx @justin06lee/chrome@latest add article-list`
**Composes:** registry: `badge`, `fade-in`; no npm dependencies

renders a search input, a row of ghost badge tag chips (single-select toggle, with a "clear" button), and a responsive 1/2/3-column grid of cards. each card is a plain `<a href={`${basePath}/${slug}`}>` wrapping a banner, title, formatted date, two-line-clamped excerpt, and tag badges — plain `<a>`/`<img>` keep it framework-agnostic; wire it to any router by setting `basePath`. filtering matches the lowercased query against title + excerpt + tags, AND-ed with the selected tag. there is no sorting — cards render in the order given. cards stagger their entrance via `fade-in` (`staggerDelay` at 60ms per card, capped past index 8; honors prefers-reduced-motion) — pass `stagger={false}` to render instantly.

the banner treatment is the distinctive part: each banner is fetched as a blob, its first frame frozen to a still PNG via canvas (`drawImage` + `toDataURL`), and rendered grayscale + dimmed at rest; on hover the card swaps to an object URL of the original blob in full color, so animated GIF/WebP banners stay calm until the user shows interest. stills are memoized in a module-level cache keyed by src (in-flight promises shared, failures evicted for retry), so cards remounting while typing in the search box don't refetch. a cross-origin image without CORS headers fails the canvas step and falls back to the original, possibly animated, src.

vs `gallery`: article-list is for dated content previews — single tag filter, no sort, whole card is a link, hover-animated banners. gallery is for project/portfolio cards — multi-tag AND filter, a sort menu, pinned items, repo/live action links.

**Key props:**
- `articles: ArticlePreview[]` (required) — articles to render as cards. `{ slug, title, excerpt, bannerUrl?, tags, publishedAt? }`
- `basePath: string = ''` — prefix for card hrefs, built as `${basePath}/${slug}`.
- `defaultQuery: string = ''` — initial value of the search box.
- `defaultTag: string` — initially selected tag filter.
- `stagger: boolean = true` — stagger each card's entrance fade by index (60ms per card, capped; honors prefers-reduced-motion).
- `className: string`

**Example:**
```tsx
<ArticleList
  articles={[{ slug: "my-post", title: "My post", excerpt: "…", tags: ["react"], publishedAt: "2026-05-12" }]}
  basePath="/articles"
/>
```

## bar-list

**Role:** ranked horizontal bar list — the bar is the row's own background.
**Install:** `bunx @justin06lee/chrome@latest add bar-list`
**Composes:** nothing beyond utils

rows of `{ id?, label, value, color?, href? }` where each row's proportional bar
**is the row's background**, not a separate track beside it — so a long list
reads as a block of text with weight behind it rather than a chart with rows
bolted on. label sits left, value right-aligned.

`items` render in the order given: **sort before passing.** `limit` keeps the
first N, not the largest N — so an unsorted list with a limit silently shows an
arbitrary subset. `max` sets the bar scale ceiling, defaulting to the largest
value present; pass it explicitly when several bar-lists on a page should share
one scale, or the eye compares bars that aren't comparable.

per-item `color` is rendered at low opacity so the label stays legible — the bar
is a background, not a swatch. rows with `href` render through `linkComponent`;
`onItemClick` makes the rest buttons and is ignored on rows that carry an href.
`showValue={false}` hides the value column visually but keeps it available to
screen readers. an all-zero list renders empty bars rather than NaN widths.

vs siblings: `bar-list` ranks a handful of labeled quantities; `sparkline` shows
one series over time; `stat-tile` is a single headline figure; `heatmap` is
density across a year.

**Key props:**
- `items: BarListItem[]` — required — rows in render order. BarListItem is { id?, label, value, color?, href? }. sort before passing — limit keeps the first N, not the largest N.
- `max: number` — bar scale ceiling; defaults to the largest value present.
- `formatValue: (value: number) => string = String` — value formatter for the right column.
- `showValue: boolean = true` — show the value column; when false it stays available to screen readers.
- `limit: number` — render at most this many rows.
- `onItemClick: (item: BarListItem) => void` — makes rows buttons; ignored on rows that carry an href.
- `linkComponent: React.ElementType = 'a'` — anchor element/component for rows with an href — pass your router's Link.
- `className: string`

**Example:**
```tsx
<BarList
  items={[...pages].sort((a, b) => b.views - a.views)}
  limit={8}
  formatValue={(n) => n.toLocaleString()}
  linkComponent={Link}
/>
```

## code-block

**Role:** syntax-highlighted code box with a built-in copy button.
**Install:** `bunx @justin06lee/chrome@latest add code-block`
**Composes:** npm: `prism-react-renderer`; registry: nothing beyond utils

renders code through `prism-react-renderer`'s `<Highlight>` — synchronous, pure-React token spans, no async loading or WASM — inside a bordered `<pre>` with horizontal scroll. the theme is a module-level `chromeTheme: PrismTheme` constant, a restrained palette (violet keywords, mint strings, blue functions, amber numbers) tuned for a black background; after installing, edit that constant in your copy to retint. commonly bundled prism language ids: tsx, ts, jsx, js, bash, json, css, markup. a trailing newline in `code` is trimmed.

the copy button sits top-right, writes the trimmed source via `navigator.clipboard.writeText`, flips its label to "copied" for `resetMs`, and announces the result through a dedicated `sr-only` live region (the toggling button label is an unreliable live region). clipboard failures are swallowed silently.

`prose` uses this component for fenced code blocks, so if you install `prose` you get `code-block` automatically; reach for it directly when you have a raw code string outside markdown.

**Key props:**
- `code: string` (required) — source to render; trailing newline trimmed.
- `language: string = "tsx"` — prism language id.
- `copyable: boolean = true` — show the top-right copy button.
- `resetMs: number = 2000` — ms before the copy label reverts.

**Example:**
```tsx
<CodeBlock code={`const x = 1;`} language="ts" />
```

## collapsible-prose

**Role:** markdown reading layout where each `##` heading folds into a native `<details>` section.
**Install:** `bunx @justin06lee/chrome@latest add collapsible-prose`
**Composes:** npm: `lucide-react`; registry: `prose`

splits the markdown string on every line matching `^##\s+(.+)$`: content before the first `##` renders flat as an intro, then each section becomes a `<details open?>` whose `<summary>` holds a rotating ChevronRight and an `<h2>` with a slugged id (lowercased, punctuation stripped, spaces to dashes, deduped as base, base-1, base-2 against every emitted id) so sections are deep-linkable via `var(--sticky-header-offset, 80px)` scroll margin. if the markdown has no `##` headings at all it falls back to one flat render. collapse state is pure native `<details>` — no javascript state.

the component does not render markdown itself: you inject `renderMarkdown`, typically `(md) => <Prose>{md}</Prose>`. note the splitting is line-based on the raw string, so a literal `## ` line inside a fenced code block will incorrectly start a new section — keep level-2 headings out of code fences or use `prose` directly.

vs `prose`: use collapsible-prose for long-form documents where sections should toggle; it delegates the actual rendering. vs `article`: article is the page header/layout around a body; collapsible-prose can be that body.

**Key props:**
- `children: string` (required) — markdown source; split on ## headings.
- `renderMarkdown: (markdown: string) => ReactNode` (required) — renders a markdown string — typically (md) => `<Prose>{md}</Prose>`.
- `defaultOpen: boolean = true` — whether sections start expanded.

**Example:**
```tsx
<CollapsibleProse renderMarkdown={(md) => <Prose>{md}</Prose>}>
  {markdown}
</CollapsibleProse>
```

## detail-list

**Role:** label/value metadata as a real `<dl>`, in row, grid or stacked layouts.
**Install:** `bunx @justin06lee/chrome@latest add detail-list`
**Composes:** nothing beyond utils

`items` of `{ label, value, icon?, note?, wide? }` in one of three layouts:
`rows` (label left, value right, one line each, hairline-divided), `grid` (a
two-column card of label-over-value cells — `wide: true` spans both), or
`stacked` (a single column of those cells). server-renderable, no client state.

it exists for the confirmation-page case the library had no answer for: a
handful of *unrelated* facts about one thing. `stat-tile` covers one big number
and `manager-table` covers many rows of the same shape, so every call site was
hand-building a div grid — which reads to a screen reader as an undifferentiated
pile rather than as term/definition pairs. this renders a real `<dl>`, with
`<dt>`/`<dd>` kept as direct children so the pairing survives (the row styling
lives on the pair, not on a wrapper div).

`divided` only means anything in the `rows` layout. `dense` tightens padding.
reach for `docket` when the thing itself is the record (numbered, stamped,
tearable) rather than metadata inside something else.

**Key props:**
- `items: DetailItem[]` — required — { label, value, icon?, note?, wide? }. wide spans both columns in the grid layout.
- `layout: 'rows' | 'grid' | 'stacked' = 'rows'` — 'rows' is label left / value right on one line; 'grid' is a two-column card of label-over-value cells; 'stacked' is a single column of them.
- `divided: boolean = true` — hairlines between rows; only meaningful for 'rows'.
- `dense: boolean = false` — tightens the row padding.
- `className: string`

**Example:**
```tsx
<DetailList
  layout="grid"
  items={[
    { label: "when", value: "wed 12 aug, 4:00pm" },
    { label: "duration", value: "30 min" },
    { label: "location", value: "meet.example.com/abc", wide: true },
  ]}
/>
```

## docket

**Role:** work order / docket — a numbered document with label-value rows and an optional tear-off stub.
**Install:** `bunx @justin06lee/chrome@latest add docket`
**Composes:** nothing beyond utils

`detail-list` renders the same label-value pairs, and docket uses that shape for its `rows` — but a docket is the *document* around them: it carries a reference in a mono header, it has a slot for a mark, and it tears. reach for detail-list when you want metadata inside something else, and for a docket when the thing itself is the record. rows render as a real `<dl>`.

the `mark` slot sits at the top right of the body and is designed for a `stamp` — `received`, `filed`, `void`. the title gets right padding automatically when a mark is present so the two never collide.

`stub` adds a perforated tear line and a section below it; omit it and no tear edge is drawn. the perforation is a hard-stop repeating gradient rather than a dashed border, so the dash length is explicit and reads the same at any width. the notches at each end are **opaque circles in the page colour**, not a mask: masking the card to cut real holes also masks the border, and a docket without its outline stops reading as a document. that means `notchColor` has to match whatever the docket sits on — it defaults to `#000`, which is right on the standard black background and wrong on a raised surface.

**Key props:**
- `reference: ReactNode — printed in the header, e.g. 'OJ-0042'. set in mono.`
- `kind: ReactNode — small caps line opposite the reference.`
- `mark: ReactNode — top-right slot in the body; a Stamp is the intended occupant.`
- `title: ReactNode`
- `rows: DocketRow[] — { label, value }[] rendered as a <dl>.`
- `children: ReactNode — body content under the rows.`
- `stub: ReactNode — content below the perforation.`
- `notchColor: string = '#000000' — must match the surface behind the docket.`
- `className: string`

**Example:**
```tsx
<Docket
  kind="work order"
  reference="OJ-0042"
  title="rebuild the intake form"
  mark={<Stamp size="sm">received</Stamp>}
  rows={[
    { label: "job type", value: "build" },
    { label: "budget", value: "1k – 5k" },
  ]}
  stub={<CopyButton text="OJ-0042" />}
/>
```

## file-card

**Role:** stacked-paper download card — papers fan out on hover, renders as a link or button.
**Install:** `bunx @justin06lee/chrome@latest add file-card`
**Composes:** registry: `stack`; no npm dependencies

a `stack` dressed as a file: the front paper holds three faint ruled lines, an optional mono uppercase `meta` kicker ("pdf · 1.2 mb"), and the file `name`; the papers behind fan out with stack's css spring on hover (and sit still under prefers-reduced-motion — stack handles that). the root is `h-44 w-40` like stack; resize via `className`, and forward extra sheets with `layers`.

the render element follows the props: with `href` it's an anchor (through `linkComponent` — pass your router's Link; `download` sets the anchor's download attribute, `true` or a save-as filename, and `onClick` still runs alongside navigation); with only `onClick` it's a `<button>`; with neither it's a plain block. focus gets a visible ring.

use file-card for a downloadable/openable file affordance; `file-grid` (in `references/editor.md`) wraps a collection of these with a drag-to-trash delete flow. for article previews use `article-list`; for a bare hover-fan container use `stack` directly.

**Key props:**
- `name: string` (required) — file name shown on the front paper.
- `meta: string` — small uppercase kicker line above the name, e.g. 'pdf · 1.2 mb'.
- `href: string` — link target; renders the card as an anchor.
- `onClick: () => void` — click handler; without href the card renders as a `<button>`.
- `download: boolean | string` — sets the anchor's download attribute (true, or a filename to save as).
- `linkComponent: React.ElementType = 'a'` — anchor element/component — pass your router's Link.
- `layers: number = 1` — paper layers behind the front card, forwarded to stack.
- `className: string` — overrides on the root element.

**Example:**
```tsx
<FileCard
  name="quarterly-report.pdf"
  meta="pdf · 1.2 mb"
  href="/files/quarterly-report.pdf"
  download
/>
```

## gallery

**Role:** searchable, filterable, sortable project card grid with pinned chrome-foil highlights.
**Install:** `bunx @justin06lee/chrome@latest add gallery`
**Composes:** npm: `lucide-react`, `motion`; registry: `card`, `badge`, `menu`, `chrome`

a full page section (renders `<main>`, max-w-6xl): heading + subtitle, a sort `menu` (Newest / Oldest / A–Z / Z–A), a search input, multi-select tag chips, and a 1/2/3-column grid of `card`s showing title (optionally linked), year, description, italic notes, outline tech badges, and "View Code" / "Live" external links. filtering matches the query against title + description + tech and requires every selected tag (AND). sorting always floats `pinned` items first, then applies the chosen order with title as tiebreaker.

pinned items get the chrome treatment: the title wraps in `<Chrome>` foil and a lucide pin glyph is painted with the same `CHROME_FOIL_STYLE` gradient stack clipped through a CSS mask (background-clip: text can't clip to an SVG stroke), with the bevel/glow filter on a wrapper span so the drop-shadow isn't clipped away by the mask. the pin shimmers in phase with the title and respects prefers-reduced-motion via `data-chrome`.

entrance is a staggered fade (`chipBase` + i × `chipStep` seconds) that runs only on first mount — after that a `hasMounted` flag zeroes the delays so searching and filtering update the grid instantly instead of replaying the stagger.

vs `article-list`: gallery is for portfolio/project items (year-sorted, multi-tag, pinning, action links); article-list is for dated posts with excerpt cards and hover-animated banners. gallery brings its own page margins and heading — pass `className` to override if embedding.

**Key props:**
- `title: string` (required) — heading shown above the grid.
- `subtitle: string = 'A curated list of things I've built or explored.'` — muted line under the title.
- `items: GalleryItem[] = []` — the cards to render: { id, title, link?, description, year, tech[], repo?, live?, notes?, pinned? }[].
- `initialSort: 'newest' | 'oldest' | 'az' | 'za' = 'newest'` — starting sort order; pinned items always sort first.
- `chipBase: number = 0.4` — base entrance-animation delay (seconds) before the first staggered element.
- `chipStep: number = 0.1` — per-element stagger step (seconds) for the entrance animation.
- `className: string` — overrides on the root element.

**Example:**
```tsx
<Gallery
  title="Things I've built"
  items={[{ id: "chrome-ui", title: "chrome-ui registry", description: "…", year: 2026, tech: ["Next.js"], pinned: true }]}
  initialSort="newest"
/>
```

## image-cropper

**Role:** drag-to-reposition, scroll/slider-to-zoom image cropper emitting a serializable crop value.
**Install:** `bunx @justin06lee/chrome@latest add image-cropper`
**Composes:** registry: `range`; no npm dependencies

fully controlled around a `CropValue` of `{ url, scale, x, y }` — x/y are framing offsets in percent of the frame, scale is zoom. the image renders frame-sized with `object-cover` and a `translate(x%, y%) scale(s)` transform, so the value is a pure description you can persist and replay anywhere with the same CSS. dragging inside the frame nudges x/y, the mouse wheel and a zoom slider drive scale, and two more sliders give precise x/y control; a reset button re-centers at scale 1. an optional `circle` overlay draws a circular crop guide (the emitted value is unchanged — the frame stays rectangular).

everything is cover-clamped: scale is floored at 1 regardless of `minScale` (below 1 the image would be smaller than the frame), and the max offset per axis is `(scale - 1) * 50` percent — the image can never expose empty space inside the crop, and zooming out re-clamps x/y against the shrunken bound. state changes flow only through `onChange`; there is no internal crop state and no canvas output — consumers apply the value themselves (e.g. as an avatar transform) or rasterize it server-side.

pointer handling is deliberately robust: drags attach `pointermove`/`pointerup`/`pointercancel` to the window (so tracking continues outside the frame and survives a missed pointerup — a mouse moving with `buttons === 0` ends the drag), pointer capture is best-effort, in-flight drags are stopped on unmount, and the wheel listener is registered non-passive by hand because React's passive wheel listeners make `preventDefault` a no-op (the page would scroll while zooming).

**Key props:**
- `value: CropValue` (required) — controlled crop value { url, scale, x, y }.
- `onChange: (value: CropValue) => void` (required)
- `size: number = 240` — frame size in px.
- `aspect: number = 1` — width / height ratio of the frame.
- `minScale: number = 1` — floored at 1 so the image can never be smaller than the frame.
- `maxScale: number = 4`
- `circle: boolean = false` — render a circular crop guide.

**Example:**
```tsx
const [crop, setCrop] = useState<CropValue>({ url: "/avatar.jpg", scale: 1.5, x: 0, y: 0 });
<ImageCropper value={crop} onChange={setCrop} size={240} circle />
```

## login-form

**Role:** styled credential form with loading / error / rate-limited states over a headless hook.
**Install:** `bunx @justin06lee/chrome@latest add login-form`
**Composes:** registry: `input`; no npm dependencies

installs two files: `login-form.tsx` (the styled view) and `use-login-form.ts` (a headless `registry:hook`). the hook is a transport-agnostic state machine — field values, `loading`/`error`/`rateLimited` flags, an enter-to-submit `onKeyDown`, and a `submit()` that delegates to your injected `onSubmit(credentials)`. resolving means success (the form shows nothing — navigate or update state in your onSubmit); returning `{ error }` shows that message in red; `{ rateLimited: true }` shows the rate-limit message in amber; throwing shows a generic network error (or the rate-limit message if the thrown object has `rateLimited`). the styled component renders the configured `fields` (default: a single password input), the error line, and a submit button that swaps to `loadingLabel` and disables inputs while pending.

its validation posture is deliberately minimal and server-trusting: no client-side format validation, default error copy is generic ("incorrect credentials.") to avoid user-enumeration hints, an empty-string `error` falls back to that generic default so nothing sensitive leaks, and rate limiting / lockout are explicitly the consumer backend's job — surfaced here only via the `rateLimited` flag. credentials live only in React state and flow solely to `onSubmit` (never logged or echoed); submission is preventDefault-only so values can't leak into a URL. password-type fields also get spellcheck/autocorrect/autocapitalize turned off.

for multi-field logins pass `fields` (e.g. email + password); each entry sets name, label, type, placeholder, and autoComplete. if you want completely custom markup, import `useLoginForm` directly and skip the styled component.

**Key props:**
- `onSubmit: (credentials) => Promise<{ error?, rateLimited? } | void>` (required in the component's types) — caller submit; resolve to succeed, return an error / rateLimited result or throw to fail.
- `fields: LoginField[]` — fields to render. defaults to a single password field.
- `title: string = 'log in'` — heading above the fields.
- `submitLabel: string = 'log in'` — button label when idle.
- `loadingLabel: string = 'signing in...'` — button label while submitting.

**Example:**
```tsx
<LoginForm
  onSubmit={async ({ password }) => {
    const res = await fetch("/api/login", { method: "POST", body: JSON.stringify({ password }) });
    if (res.status === 429) return { rateLimited: true };
    if (!res.ok) return { error: "wrong password." };
  }}
/>
```

## prose

**Role:** markdown renderer with the full pipeline — GFM, KaTeX math, heading slugs, highlighted code.
**Install:** `bunx @justin06lee/chrome@latest add prose`
**Composes:** npm: `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `rehype-slug`, `katex`; registry: `code-block`

renders a markdown string (the single string child) through `react-markdown` with `remarkGfm` + `remarkMath` on the remark side and `rehypeKatex` + `rehypeSlug` on the rehype side, `skipHtml` enabled (raw HTML in the markdown is dropped, not rendered). every element gets the dark prose styling via a memoized component map: slugged headings with `scroll-margin-top: var(--sticky-header-offset, 80px)` for anchor links under a sticky header, bordered tables in an overflow wrapper, bordered inline code, lazy images. it imports `katex/dist/katex.min.css` directly. fenced code blocks are intercepted at the `pre` renderer — raw text and `language-*` class are pulled off the hast node and handed to `code-block` for prism highlighting; inline code is detected by the absence of a language class and single-line position.

links split by kind: internal hrefs — anything without a protocol scheme and not protocol-relative, i.e. relative paths, `/…`, and `#…` anchors — render through `linkComponent` (pass next/link for client-side navigation; defaults to `"a"`), while external links always stay plain `<a>`s and http(s) ones open in a new tab with `rel="noopener noreferrer"`. images get a two-step resolution: relative srcs are prefixed with `imageBaseUrl` (e.g. a GitHub raw base; already-resolved `http(s):`, `data:`, and `/…` srcs are left alone), then `imageTheme` resolves `-light`/`-dark`-suffixed pairs, and finally `resolveImageSrc` maps the result to what's actually rendered.

`imageTheme` is the built-in version of that last swap: an image whose src is named `<name>-light.<ext>` or `<name>-dark.<ext>` resolves to the requested theme's file, while unsuffixed srcs pass through untouched. **it defaults to `"light"`**, which is a deliberate choice for diagrams (dark-on-light artwork stays readable when a reader saves or prints a page) — a dark site that ships dark-variant diagrams must pass `imageTheme="dark"` explicitly. the exported `resolveThemeImageSrc(src, theme)` helper does the same swap outside the component.

the line-sync feature is for split-pane editor/preview UIs: with `lineSync` on, a custom rehype plugin stamps each top-level block with `data-source-line` (its 1-based line in the markdown source) so a host can map editor lines to rendered blocks for scroll sync. `highlightLine` marks the last top-level block starting at or above that line with `data-sync-highlight`, and a scoped `<style>` (injected only when lineSync is on) paints it as a gray streak — text blocks bleed the fill horizontally, images get an outline instead. it's declarative, rendered into the markup, so a re-render can't strand the highlight. only top-level children are tagged, mapping each line to exactly one block. off by default with zero overhead.

vs siblings: prose is the renderer; `article` is the page layout that typically wraps it; `collapsible-prose` splits markdown into folding sections and calls back into prose. note `children` must be a string, not JSX.

**Key props:**
- `children: string` (required) — markdown source.
- `imageBaseUrl: string` — prefix for relative image srcs.
- `lineSync: boolean = false` — stamp each top-level block with data-source-line for editor/preview scroll/highlight sync. zero overhead when off.
- `highlightLine: number | null = null` — 1-based source line whose block is marked with data-sync-highlight. requires lineSync.
- `linkComponent: React.ElementType = 'a'` — anchor component for internal links (relative, /…, #…) — pass your router's link. external links always render a plain `<a>`; http(s) opens in a new tab.
- `imageTheme: "light" | "dark" = "light"` — which variant to render for images with a light/dark pair (files named `<name>-light.<ext>` / `<name>-dark.<ext>`). a -light/-dark-suffixed src resolves to this theme; unsuffixed srcs are untouched. a dark site passes "dark". the exported `resolveThemeImageSrc(src, theme)` helper does the swap.
- `resolveImageSrc: (src: string) => string` — maps each image src to the src actually rendered (e.g. light/dark theme variants). runs after imageBaseUrl resolution.

**Example:**
```tsx
<Prose>{`# hello\n\nmarkdown with $e^{i\\pi} + 1 = 0$ and \`\`\`ts\ncode\n\`\`\``}</Prose>
```

## showcase

**Role:** framed preview container for presenting component demos on a dotted backdrop.
**Install:** `bunx @justin06lee/chrome@latest add showcase`
**Composes:** nothing beyond utils

a documentation/demo primitive: an optional mono uppercase `label` above a bordered frame with a `dots` (default), `grid`, or `none` background pattern, then an optional code-styled `source` caption and muted `note` below. children are centered; the file also exports a `Row` helper — if any direct child is a `<Row>`, rows stack vertically with a gap, otherwise all children are wrapped in one implicit centered row. this is the frame the chrome docs site uses for its examples, and it is useful anywhere you present components against a neutral backdrop.

one prop exists in the component but not in meta.ts: `clip: boolean = true` applies `overflow-hidden` to the frame; set it false for demos whose popups (menus, dropdowns) need to overflow the frame edges. `children` is likewise implicit.

**Key props:**
- `label: string` — small uppercase label rendered above the frame.
- `source: string` — code-styled caption rendered below the frame.
- `note: string` — muted secondary caption below the source.
- `background: 'dots' | 'grid' | 'none' = 'dots'` — backdrop pattern inside the frame.
- `className: string`
- `clip: boolean = true` — (in the component, not meta.ts) clip children to the frame; set false to let popups overflow.

**Example:**
```tsx
<Showcase label="button" source={`<Button variant="dashed" />`} background="dots">
  <Button variant="dashed">click</Button>
</Showcase>
```


## sparkline

**Role:** tiny inline svg trend line, sized to sit in a line of text.
**Install:** `bunx @justin06lee/chrome@latest add sparkline`
**Composes:** nothing beyond utils

pure svg — no chart library, no dependencies. `values` is the series, oldest
first, drawn at 80x24 by default so it sits inline with text. `curve="smooth"`
runs a catmull-rom spline **that still passes through every sample**: the
standard uniform form, chosen because a sparkline that misses its own data
points lies. optional `fill` (area under the line), `showDots` (a small square
per point) or `highlightLast` (only the final point).

a flat series renders on the **vertical midline** rather than collapsing to the
floor, so "no change" still reads as a line. `min`/`max` override the scale —
pass them when several sparklines should share one scale, or the reader compares
shapes that aren't comparable.

sizing gotcha: the viewBox stretches to whatever box `className` gives it (the
stroke stays 1:1 via `non-scaling-stroke`), so scaling it up is free — **but dot
squares are drawn in viewBox units and stretch with it.** keep `width`/`height`
near the rendered size whenever `showDots` or `highlightLast` is on.

`stroke` defaults to `currentColor`, so it inherits the surrounding text. an
accessible name is generated from the value range when `label` is omitted. drops
neatly into `stat-tile`'s `children` slot.

**Key props:**
- `values: number[]` — required — the series, oldest first. one value renders a flat line.
- `width: number = 80` — intrinsic width in px (viewBox units; the svg still stretches to its css box).
- `height: number = 24` — intrinsic height in px.
- `stroke: string = 'currentColor'` — line color; inherits the surrounding text by default.
- `strokeWidth: number = 1.5` — line thickness in px, kept 1:1 under stretching.
- `fill: string` — area fill under the line. omit for a bare line.
- `showDots: boolean = false` — mark every point with a small square.
- `highlightLast: boolean = false` — mark only the last point. ignored when showDots is set.
- `min: number` — scale floor; defaults to the series minimum.
- `max: number` — scale ceiling; defaults to the series maximum.
- `curve: "linear" | "smooth" = 'linear'` — polyline, or a catmull-rom curve that still passes through every sample.
- `label: string` — accessible name; a value-range summary is generated when omitted.
- `className: string`

**Example:**
```tsx
<Sparkline values={last30Days} curve="smooth" fill="rgba(255,255,255,0.08)" highlightLast />
```

## stat-tile

**Role:** big-number kpi tile with label, delta chip, footnote and a sparkline slot.
**Install:** `bunx @justin06lee/chrome@latest add stat-tile`
**Composes:** count-up (registry); lucide-react (npm)

a mono uppercase `label`, one headline `value` with an optional trailing `unit`,
an optional signed `delta` chip, a `footnote`, a top-right `icon` slot, and
`children` rendered between the number and the footnote — where a `sparkline`
fits exactly.

**it is server-renderable by default.** the tile is static markup and only the
opt-in `animate` path pulls in the `CountUp` client component, so a grid of
tiles costs nothing on the client until you ask it to move. two consequences:
`format` is a function prop and **can't cross the server/client boundary**, so
`format` + `animate` together requires the tile to render inside a client
component; and a `value` passed as a string renders as-is (already formatted,
`"—"`, etc.) rather than being tweened.

the delta logic keeps two things separate that are easy to conflate: **direction
is the sign, tone is whether that direction is welcome.** that separation is
what lets `invertDelta` recolor the chip without flipping the direction icon —
use it for figures where less is better (distractions, time-to-first-commit), so
a rise turns red while the arrow still points up.

**Key props:**
- `label: ReactNode` — required — mono uppercase kicker above the number.
- `value: number | string` — required — headline figure; strings render as-is (already formatted, "—", etc.).
- `unit: string` — small trailing qualifier next to the number, e.g. "h".
- `format: (n: number) => string` — formatter for numeric value and delta; overrides decimals. pairing it with animate requires the tile to render inside a client component (functions can't cross the server boundary).
- `decimals: number = 0` — fixed decimal places for numeric value/delta.
- `animate: boolean = false` — tween the number up from 0 when it scrolls into view, via count-up.
- `duration: number = 1` — tween length in seconds when animate is set.
- `delta: number` — signed change since the comparison period; the sign picks the direction icon.
- `deltaLabel: ReactNode` — trailing context for the delta chip, e.g. "vs last month".
- `invertDelta: boolean = false` — flip which sign is bad, for figures where less is better.
- `footnote: ReactNode` — muted line under the tile — provenance, caveats, sample size.
- `icon: ReactNode` — decorative slot pinned to the top-right, typically a 14px lucide icon.
- `children: ReactNode` — rendered between the number and the footnote — a sparkline fits here.
- `className: string`

**Example:**
```tsx
<StatTile label="focus time" value={32.5} unit="h" decimals={1} delta={4.2} deltaLabel="vs last week">
  <Sparkline values={weekly} />
</StatTile>

<StatTile label="interruptions" value={12} delta={3} invertDelta footnote="a rise is bad here." />
```

## streak

**Role:** current unbroken run, an optional best, and a strip of recent hit/miss days.
**Install:** `bunx @justin06lee/chrome@latest add streak`
**Composes:** nothing beyond utils

a mono kicker, the `current` run with its `unit` pluralized (a naive `+s` —
enough for "day"/"week", so pass a pre-pluralized unit for anything irregular),
an optional `best` rendered as a quiet comparison, and a compact strip of cells
from `days`.

**the strip is the point.** a number alone can't show that the run nearly broke
twice last week, and that near-miss is usually the information worth acting on.
`days` is `boolean[]` with the **most recent LAST** — the opposite of what you
might guess, so check the ordering when a strip looks reversed.

the whole component collapses to one sr-only sentence for screen readers rather
than announcing each cell.

**Key props:**
- `current: number` — required — days (or whatever unit is) in the current unbroken run.
- `best: number` — all-time best run, rendered as a quiet comparison.
- `days: boolean[]` — recent history, most recent LAST — one cell per entry, true = hit.
- `label: ReactNode = 'streak'` — mono uppercase kicker.
- `unit: string = 'day'` — singular noun for the run; an "s" is appended when current isn't 1.
- `className: string`

**Example:**
```tsx
<Streak current={12} best={31} days={last14Days.map((d) => d.hit)} />
```
