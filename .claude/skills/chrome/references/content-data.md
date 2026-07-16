# content & data display

components for rendering content and data: markdown pipelines (prose, collapsible-prose, article, code-block), browsable collections (gallery, article-list, file-card), date and activity views (calendar, calendar-nav, heatmap, timeline), plus an image cropper, a credential form, and a demo frame (showcase). all are dark-only client components that install at your configured components alias and share the registry's brutalist conventions: square corners, thin `white/10`–`white/20` borders, mono accents, lowercase copy. every component takes `className` on its root even where meta.ts omits it.

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

## calendar

**Role:** interactive single-month date grid with selectable days and a today ring.
**Install:** `bunx @justin06lee/chrome@latest add calendar`
**Composes:** nothing beyond utils

renders a prev/next header (month name + year in mono uppercase) over a sunday-aligned 7-column grid of day buttons. all dates are plain strings — the month is `"YYYY-MM"`, days are `"YYYY-MM-DD"` — and the grid is built with `Date.UTC`, so there is no timezone drift and no Date objects cross the prop boundary. fully controlled: `month`/`onMonthChange` drive paging (the arrows are disabled when `onMonthChange` is absent), `selected`/`onSelect` drive selection. the selected day inverts to white-on-black; `today` gets an inset ring.

`renderDay` lets you layer extra content under each day number — task dots, counts — without forking the component; it's called with the cell's date string inside the day button. `renderCell` goes further: it replaces the whole cell (day number included) with your own layout, for agenda-style month grids showing per-day events. it receives a `CalendarDay` — `{ date, day, isToday, isSelected }` — and drops the compact `size-9` picker styling: cells stay `<button>`s when `onSelect` is set, otherwise they render as plain `<div>`s so hosts can embed their own links. in full-cell mode today keeps its ring and selection tints (`bg-white/10`) instead of inverting so rich content stays readable. pair it with `cellClassName` — a string or a per-day `(day: CalendarDay) => string` function, applied in both modes — for sizing (`"min-h-28 p-2"`) or a per-day heatmap tint.

vs siblings: `calendar` is the interactive month picker (and, with renderCell, the agenda month grid); `heatmap` is the read-mostly full-year density view; `calendar-nav` is only the header controls (view switcher + prev/today/next) meant to sit above any of these views.

**Key props:**
- `month: string` (required) — "YYYY-MM" displayed month.
- `onMonthChange: (month: string) => void` — enables prev/next.
- `selected: string | null` — "YYYY-MM-DD".
- `onSelect: (date: string) => void`
- `today: string` — "YYYY-MM-DD" to ring.
- `renderDay: (date: string) => ReactNode` — extra cell content.
- `renderCell: (day: CalendarDay) => ReactNode` — replace the whole cell (day number included). day = { date, day, isToday, isSelected }.
- `cellClassName: string | ((day: CalendarDay) => string)` — per-cell classes — heatmap tint, min-height. works in both modes.

**Example:**
```tsx
const [month, setMonth] = useState("2026-05");
const [selected, setSelected] = useState<string | null>(null);
<Calendar month={month} onMonthChange={setMonth} selected={selected} onSelect={setSelected} today="2026-05-24" />
```

## calendar-nav

**Role:** period-navigation header — view switcher plus prev / today / next controls.
**Install:** `bunx @justin06lee/chrome@latest add calendar-nav`
**Composes:** npm: `lucide-react`; registry: `segmented`, `button`

a header bar with a `segmented` day/month/year switcher on the left and chevron prev/next buttons flanking the period label and a "today" jump link on the right, above a bottom border. it renders no calendar itself — it is fully controlled and router-free: you own the current date, compute the `label` (e.g. "June 2026"), and step it in `onPrev`/`onNext` by the active view's unit. the switcher hides when `views` has fewer than 2 entries.

pair it with `calendar` (month view), `heatmap` (year view), or `timeline` (day view) and swap the body when `onViewChange` fires. because both `label` and `todayLabel` are ReactNode, you can put richer content than a string in either.

**Key props:**
- `label: ReactNode` (required) — the current period label, e.g. "June 2026".
- `view: 'day' | 'month' | 'year'` — controlled active view.
- `views: CalendarView[] = ['day', 'month', 'year']` — switcher hidden when fewer than 2.
- `onViewChange: (view: CalendarView) => void`
- `onPrev: () => void`
- `onNext: () => void`
- `onToday: () => void`
- `todayLabel: ReactNode = 'today'`
- `className: string`

**Example:**
```tsx
<CalendarNav
  label="June 2026"
  view={view}
  onViewChange={setView}
  onPrev={() => step(-1)}
  onNext={() => step(1)}
  onToday={() => setDate(TODAY)}
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

## heatmap

**Role:** year activity grid — 12 mini month calendars tinted by value, contribution-graph style.
**Install:** `bunx @justin06lee/chrome@latest add heatmap`
**Composes:** nothing beyond utils

lays out 12 sunday-aligned mini month grids (2/3/4 columns responsive), each square day cell tinted white with an alpha derived from its value: values bucket into `levels` steps against a `max` ceiling (defaulting to the largest value present), then map to alpha — level 0 is a faint 0.04, levels 1..n span 0.15 to 0.85. a less-to-more legend renders below. `today` gets a white ring; other cells ring on hover.

`values` is a flat `Record<"YYYY-MM-DD", number>` — days absent from the record count as 0, so you can pass sparse data. cells are `<div>`s by default; passing `onSelectDay` upgrades every cell to a `<button>` with an aria-label. tooltips default to `"date — value"` and are overridable via `title`. everything is UTC-computed strings, matching `calendar`'s conventions, so the two can share the same keyed data.

`monthHref` makes each month label a link: it's called with a `HeatmapMonth` — `{ index (0-based, 0 = jan), year, label }` — and the returned href renders through `linkComponent` (pass your router's Link for client-side navigation; defaults to a plain `"a"`). months whose callback you skip (or when the prop is absent) stay plain `<span>`s.

use heatmap for the at-a-glance year view; drill into a `calendar` month (with `renderDay` dots, or via `monthHref` links to per-month pages) or a `timeline` day when the user selects a cell, with `calendar-nav` switching between them.

**Key props:**
- `values: Record<string, number>` (required) — value per "YYYY-MM-DD".
- `year: number` (required)
- `levels: number = 5` — intensity steps incl. empty.
- `max: number` — bucketing cap; defaults to max value.
- `today: string` — "YYYY-MM-DD" to ring.
- `onSelectDay: (date: string) => void` — makes cells clickable.
- `title: (date: string, value: number) => string` — cell tooltip formatter.
- `monthHref: (month: HeatmapMonth) => string` — when set, month labels link to the returned href. HeatmapMonth is { index (0 = jan), year, label }.
- `linkComponent: React.ElementType = 'a'` — anchor element/component for month links — pass your router's Link.

**Example:**
```tsx
<Heatmap
  values={{ "2026-05-24": 75, "2026-05-25": 25 }}
  year={2026}
  today="2026-05-24"
  monthHref={({ year, index }) => `/calendar/${year}-${String(index + 1).padStart(2, "0")}`}
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

links split by kind: internal hrefs — anything without a protocol scheme and not protocol-relative, i.e. relative paths, `/…`, and `#…` anchors — render through `linkComponent` (pass next/link for client-side navigation; defaults to `"a"`), while external links always stay plain `<a>`s and http(s) ones open in a new tab with `rel="noopener noreferrer"`. images get a two-step resolution: relative srcs are prefixed with `imageBaseUrl` (e.g. a GitHub raw base; already-resolved `http(s):`, `data:`, and `/…` srcs are left alone), then `resolveImageSrc` maps the final src to what's actually rendered — e.g. swapping `foo-light.png` ↔ `foo-dark.png` theme variants.

the line-sync feature is for split-pane editor/preview UIs: with `lineSync` on, a custom rehype plugin stamps each top-level block with `data-source-line` (its 1-based line in the markdown source) so a host can map editor lines to rendered blocks for scroll sync. `highlightLine` marks the last top-level block starting at or above that line with `data-sync-highlight`, and a scoped `<style>` (injected only when lineSync is on) paints it as a gray streak — text blocks bleed the fill horizontally, images get an outline instead. it's declarative, rendered into the markup, so a re-render can't strand the highlight. only top-level children are tagged, mapping each line to exactly one block. off by default with zero overhead.

vs siblings: prose is the renderer; `article` is the page layout that typically wraps it; `collapsible-prose` splits markdown into folding sections and calls back into prose. note `children` must be a string, not JSX.

**Key props:**
- `children: string` (required) — markdown source.
- `imageBaseUrl: string` — prefix for relative image srcs.
- `lineSync: boolean = false` — stamp each top-level block with data-source-line for editor/preview scroll/highlight sync. zero overhead when off.
- `highlightLine: number | null = null` — 1-based source line whose block is marked with data-sync-highlight. requires lineSync.
- `linkComponent: React.ElementType = 'a'` — anchor component for internal links (relative, /…, #…) — pass your router's link. external links always render a plain `<a>`; http(s) opens in a new tab.
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

## timeline

**Role:** day schedule — a 24h vertical axis with positioned event blocks, markers, and a live now-line.
**Install:** `bunx @justin06lee/chrome@latest add timeline`
**Composes:** nothing beyond utils

renders a min-height 960px bordered track with a faint hour grid (00:00 through 23:00 labels) and absolutely positioned event blocks. everything is placed by minutes since midnight on a 0–1440 axis: an event at `{ startMin: 480, endMin: 570 }` spans 8:00 to 9:30. blocks get a colored left border and a `color-mix` 15% tint of the same color (default white), a two-line-clamped label, and are clamped into the visible day so out-of-range events can't overflow the track. events are not collision-resolved — overlapping blocks overlap visually.

blocks are display-only `<div>`s by default; `onEventClick` upgrades them to keyboard-accessible `<button>`s with a subtle hover/focus ring and an HH:MM-range aria-label. `tracks` switches to multi-track mode: N labeled columns side by side (`{ label?, events, onEventClick? }[]` — a per-track handler overrides the top-level one) sharing one hour axis, grid, markers, and now-line — plan vs actuals, people, rooms; `events` is ignored when `tracks` is set. `onEventChange` opts blocks into editing: drag to move, or drag the bottom edge to resize, snapped to `snapMinutes` (default 5); it fires once on drop with `(event, { startMin, endMin })` and you commit by updating your data — the component holds only the in-flight drag preview. editing is pointer-driven (no keyboard path), and a drag that moved suppresses the click that follows so it doesn't also fire onEventClick.

`markers` draws labeled full-width horizontal rules at given minutes — thin line with a small mono uppercase label at the right edge — styled after the upstream prayer-time markers; use them for any fixed daily reference times (prayer times, market open/close, deadlines). `markersSlot` is a ReactNode rendered into the same marker layer, so marker data can stream in — e.g. a `<Suspense>`-wrapped server component rendering the exported `TimelineMarker` primitive (`{ minutes, label, color? }`), whose `top` percentages resolve against the full 24h track. the now-line is a red dot + rule: `showNow` computes it from the client clock and ticks every minute via setInterval, while `nowMinutes` overrides the position explicitly (and implies the line shows — useful for SSR determinism or showing another timezone). toggling `showNow` off hides the line rather than freezing it.

the track is tall by design; wrap it in a fixed-height `overflow-y-auto` container (as the demo does) for a scrollable day view. pair with `calendar-nav` for day paging.

**Key props:**
- `events: TimelineEvent[]` — { startMin, endMin, label?, color? }[] — single-track events. ignored when tracks is set.
- `tracks: TimelineTrack[]` — { label?, events, onEventClick? }[] — labeled columns sharing one axis; per-track onEventClick overrides the top-level one.
- `showNow: boolean` — live red now-line, ticks each minute.
- `nowMinutes: number` — override now-line position (minutes of day).
- `markers: Array<{ minutes: number; label: string; color?: string }>` — labeled full-width marker lines at minutes-of-day (e.g. prayer times), label at the right edge.
- `markersSlot: ReactNode` — slot in the marker layer for streamed markers — render the exported `TimelineMarker` inside it.
- `onEventClick: (event: TimelineEvent) => void` — blocks become keyboard-accessible buttons; display-only when absent.
- `onEventChange: (event, next: { startMin; endMin }) => void` — opt-in drag-to-move + bottom-edge resize; called once on drop.
- `snapMinutes: number = 5` — snap increment for drag editing.

**Example:**
```tsx
<div className="h-[420px] overflow-y-auto">
  <Timeline
    showNow
    markers={[{ minutes: 5 * 60 + 12, label: "fajr" }]}
    tracks={[
      { label: "plan", events: planned },
      { label: "actual", events: logged },
    ]}
    onEventClick={(e) => openEvent(e)}
    onEventChange={(e, next) => updateEvent(e, next)}
    snapMinutes={15}
  />
</div>
```
