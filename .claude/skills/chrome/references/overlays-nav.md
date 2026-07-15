# overlays & navigation

this group covers chrome's overlay surfaces (dialog, sheet, command-palette, tooltip, menu, select, combobox) and navigation chrome (navbar, sidebar, breadcrumb, tabs, toc, accordion). everything is dark-only (black backgrounds, white/10-ish borders, square corners) and you own the code after install — components land as plain .tsx files in your project. installs pull registryDependencies transitively, so `add command-palette` also brings `kbd` and `utils` without extra steps. several components split behavior into a headless `use-*.ts` hook that installs alongside the styled component.

## accordion

**Role:** collapsible content rows, optionally exclusive (one open at a time)
**Install:** `bunx @justin06lee/chrome@latest add accordion`
**Composes:** lucide-react (npm); nothing beyond utils from the registry

renders `Accordion` (a plain flex column wrapper that injects a shared `<style>` block) around `AccordionItem` rows. each item is a native `<details>`/`<summary>` element — open state lives in the browser, zero javascript state, and it is a server component (no "use client"). the chevron rotates via tailwind's `group-open` variant.

exclusivity is also browser-native: give sibling items the same `name` and the browser closes the others when one opens (the `<details name>` attribute). open/close animates via `::details-content` + `interpolate-size: allow-keywords`; browsers without support just snap closed — graceful degradation, no polyfill.

reach for accordion for FAQ-style disclosure inline in a page. it is not an overlay and holds no react state, so it works in server-rendered content where sheet/dialog cannot.

**Key props:**
- `AccordionItem.title: ReactNode` — required
- `AccordionItem.defaultOpen: boolean` — open on first render.
- `AccordionItem.name: string` — a shared name makes the group exclusive.

**Example:**
```tsx
<Accordion>
  <AccordionItem title="what is this?" name="faq" defaultOpen>
    a collapsible row built on native details.
  </AccordionItem>
  <AccordionItem title="how does exclusivity work?" name="faq">
    siblings sharing a name auto-close each other.
  </AccordionItem>
</Accordion>
```

## breadcrumb

**Role:** presentational trail showing where the current page sits in a hierarchy
**Install:** `bunx @justin06lee/chrome@latest add breadcrumb`
**Composes:** lucide-react (npm); nothing beyond utils from the registry

renders a `<nav aria-label="breadcrumb">` with an `<ol>` of crumbs, root first. links are plain `<a href>` — framework-agnostic, no router integration and no `linkComponent` prop (unlike sidebar). the last item always renders as the current page: muted, not a link, with `aria-current="page"`, even if you gave it an `href`. items without an `href` also render as plain text. it is a server component with no state.

the file also exports `crumbsFromPath(pathname, { labels?, basePath? })`, a helper that splits a pathname into a `Crumb[]`: each segment is percent-decoded (falling back to the raw segment on invalid escapes), dashes become spaces, and each crumb's href is the cumulative path. pass a `labels` callback to override individual segment labels.

use breadcrumb for "you are here" context on deep pages; use tabs or sidebar when the user is switching between siblings rather than looking up the ancestry.

**Key props:**
- `items: Crumb[]` — required — { label, href? }[], root first. last is the current page.
- `separator: ReactNode = <ChevronRight />` — node placed between crumbs.
- `homeHref: string` — optional leading 'home' link prepended before items.
- `className: string`

**Example:**
```tsx
<Breadcrumb
  homeHref="/"
  items={crumbsFromPath("/desk/articles/field-notes/edit")}
/>
```

## combobox

**Role:** searchable single-select with optional inline create and clear rows
**Install:** `bunx @justin06lee/chrome@latest add combobox`
**Composes:** nothing beyond utils (also installs its own use-combobox.ts hook)

renders a trigger button showing the current selection (with an optional color swatch when the option has `color`); clicking opens an absolutely-positioned dropdown (`z-20`, anchored under the trigger — not a portal, so it can be clipped by `overflow: hidden` ancestors) containing an autofocused filter input and a listbox. fully controlled: you own `value` and `onChange(value | null)`.

behavior comes from the shipped headless `useCombobox` hook: open state, case-insensitive label filtering, outside-click close, and an `inputKeyDown` builder that handles ArrowUp/ArrowDown (wrapping, scrolls the highlighted row into view), Enter to activate, and Escape to close (with `stopPropagation` so a dialog underneath doesn't also close). the query and highlight reset whenever the dropdown closes or the filtered rows change. aria wiring is aria-activedescendant style — focus stays in the input.

two optional rows sit above the options: `onCreate` renders a "+ Create {query}" row that calls back with the trimmed query (you append the option and select it yourself), and `allowClear` renders a "Clear" row when something is selected, which calls `onChange(null)`. choose combobox over select when the option list is long enough to need typing to filter, or when users can create options inline; choose command-palette when the "select" is app-wide navigation rather than a form field.

**Key props:**
- `value: T | null` — required
- `onChange: (value: T | null) => void` — required
- `options: ComboboxOption<T>[]` — required — { value, label, color? }[]
- `allowClear: boolean` — show a Clear row when selected.
- `onCreate: (query: string) => void` — renders a '+ Create' row.

**Example:**
```tsx
const [value, setValue] = useState<string | null>(null);
<Combobox
  value={value}
  onChange={setValue}
  options={[{ value: "deep-work", label: "deep work", color: "#6ee7b7" }]}
  allowClear
  onCreate={(q) => addOptionAndSelect(q)}
/>
```

## command-palette

**Role:** app-wide cmd+k search overlay for jumping to pages or running actions
**Install:** `bunx @justin06lee/chrome@latest add command-palette`
**Composes:** kbd (registry); lucide-react (npm)

renders nothing until open, then a `fixed inset-0 z-[110]` overlay (highest layer in the registry — it sits above dialog at z-[100] and sheet at z-[80]) with a dimmed blurred backdrop and a centered search panel capped at 560px. results are filtered case-insensitively over label, group, and keywords, with label-prefix matches ranked before substring matches, capped at 12, and grouped under their `group` headers (ungrouped items first). a footer shows kbd hints.

works uncontrolled or controlled. uncontrolled: a global window keydown listener toggles it on cmd/ctrl + `hotkey` (default "k") and closes on Escape. controlled: pass `open`/`onOpenChange` and wire your own trigger — the hotkey still works because it calls the same setter. mount it once near the app root either way. while open it locks body scroll (saving and restoring the previous overflow value so it doesn't clobber another overlay's lock), resets query and highlight on each open, and supports ArrowUp/ArrowDown (wrapping across section boundaries) plus Enter to select; scroll-into-view only fires for keyboard moves, not mouse hover.

selecting an item calls `onSelect(item)` if given; the default fallback navigates via `window.location.href = item.href` — a full page load, so pass `onSelect` with your router's push for SPA navigation. item keys default to `label:href`, so items sharing a placeholder href stay unique; pass `id` if labels can collide. prefer command-palette over combobox/select when the list is global navigation or commands triggered from anywhere, not a value bound to a form field.

**Key props:**
- `items: PaletteItem[]` — required — { id?, label, href?, group?, keywords? }[]
- `onSelect: (item: PaletteItem) => void` — called with the chosen item. default follows item.href via window.location.
- `placeholder: string = "search…"`
- `hotkey: string = "k"` — key that opens the palette with cmd/ctrl held.
- `open: boolean` — controlled visibility; omit for the built-in hotkey flow.
- `onOpenChange: (open: boolean) => void`
- `emptyMessage: string = "no results."` — shown when nothing matches.
- `className: string`

**Example:**
```tsx
<CommandPalette
  items={[
    { label: "installation", href: "/docs/install", group: "docs", keywords: ["setup"] },
    { label: "dialog", href: "/components/dialog", group: "components" },
  ]}
/>
{/* press cmd+k / ctrl+k anywhere */}
```

## dialog

**Role:** promise-based confirm and alert modals, called imperatively from event handlers
**Install:** `bunx @justin06lee/chrome@latest add dialog`
**Composes:** nothing beyond utils (actually zero dependencies — it doesn't even import utils)

unlike the other components this is not a declarative element you place in jsx. wrap your app in `DialogProvider`, then call `const { confirm, alert } = useDialog()` and `await confirm({ title, danger })` inside an event handler — it returns `Promise<boolean>` (`alert` returns `Promise<void>`). the provider renders the modal at `fixed inset-0 z-[100]` when a call is pending. opening a new dialog over a pending one settles the stranded promise first (a superseded confirm resolves `false`) so callers never hang. `useDialog` throws outside the provider.

the modal is a small centered panel with a Confirm/Notice eyebrow, title, optional pre-line message, and buttons. it implements the full modal contract by hand: focus capture and restore, a Tab/Shift+Tab focus trap, body scroll lock (restoring the previous overflow value), Escape to cancel (with `preventDefault` so a dropdown listening beneath doesn't also close), and backdrop click to cancel. `danger: true` styles the confirm button red and moves initial focus to Cancel so a stray Enter can't instantly confirm a destructive action; otherwise the confirm/OK button gets focus.

reach for dialog when you need a blocking yes/no or acknowledgment; reach for sheet when you need a panel with arbitrary content that doesn't demand an answer. there is no generic "custom content dialog" here — the api is exactly confirm and alert.

**Key props:** (these are the confirm/alert option fields, not jsx props)
- `title: string` — required
- `message: string`
- `danger: boolean = false`

**Example:**
```tsx
// once, near the root:
<DialogProvider>{children}</DialogProvider>

// anywhere below it:
const { confirm } = useDialog();
const ok = await confirm({ title: "delete this?", danger: true });
if (ok) doDelete();
```

## menu

**Role:** action dropdown — a trigger button opening a list of items that each run a callback
**Install:** `bunx @justin06lee/chrome@latest add menu`
**Composes:** lucide-react (npm); nothing beyond utils from the registry (also installs its own use-menu.ts hook)

renders a bordered trigger button (your `trigger` node inside it) and, when open, an absolutely-positioned dropdown (`z-30`, under the trigger, aligned left or right — inline positioning, not a portal, so watch clipping ancestors). each item runs its `onSelect` and the menu closes and returns focus to the trigger. items can carry a lucide `icon`, a `disabled` flag, and a `selected` marker — when `selected` is defined a small square renders, filled when true, which turns the menu into a lightweight single-choice control (e.g. a sort menu).

behavior lives in the shipped headless `useMenu` hook: open state, outside-click close, and keyboard handling. on open the menu container itself is focused so its keydown handler fires: ArrowUp/ArrowDown move a highlighted index (wrapping), Enter/Space activate it, Escape closes and restores focus to the trigger. ArrowDown/Enter/Space on the closed trigger opens with the first item highlighted. aria is `role="menu"`/`menuitem` with aria-activedescendant.

pick menu when items are actions or a small fixed choice set behind an icon/button; pick select when the control represents a form value with a visible current selection in the trigger; pick combobox when the list needs search.

**Key props:**
- `trigger: ReactNode` — required
- `items: MenuItem[]` — required — { label, onSelect, icon?, selected?, disabled? }[]
- `label: string` — heading above the items.
- `align: 'left' | 'right' = 'left'`

**Example:**
```tsx
<Menu
  trigger={<span>Sort: {LABELS[sort]}</span>}
  label="Sort by"
  items={sorts.map((k) => ({ label: LABELS[k], selected: sort === k, onSelect: () => setSort(k) }))}
/>
```

## navbar

**Role:** fixed top navigation bar that collapses to a hamburger slide-in below md
**Install:** `bunx @justin06lee/chrome@latest add navbar`
**Composes:** lucide-react, motion (npm); nothing beyond utils from the registry (also installs its own use-navbar.ts hook)

renders a `fixed inset-x-0 top-0 z-40` nav with brand on the left and, at `md` and up, inline links plus your `actions` node on the right. below `md` it swaps to a hamburger that opens a right-side slide-in panel (motion tween, `AnimatePresence` exit animation) over a dimmed backdrop; the panel repeats the links vertically and closes when one is tapped. links are `{ label, href }` plain `<a>` elements — framework-agnostic, no router integration and no linkComponent prop.

behavior comes from the shipped headless `useNavbar` hook: open state for the mobile panel, outside-click and Escape close (attached to `panelRef`), and a body scroll lock while the panel is open. z-index layering inside: the nav bar is z-40, the mobile backdrop z-50, the panel z-[80] — so sheet and navbar panels share a layer and dialog (z-[100]) / command-palette (z-[110]) sit above them.

because it is `position: fixed`, embedding it in a bounded demo/frame requires overriding with `className="relative"` (tailwind-merge lets your class win on the position utility). it does no active-link highlighting and no scroll behavior — it is the top-of-page shell; use sidebar for hierarchical in-page nav and toc for scroll-spy.

**Key props:**
- `brand: ReactNode` — left-side logo / name.
- `links: NavLink[]` — { label, href }[] — plain anchors.
- `actions: ReactNode` — right-side desktop extras.
- `menuLabel: string = 'menu'` — heading atop the mobile panel.

**Example:**
```tsx
<Navbar
  brand={<span className="text-sm text-white">justin06lee.dev</span>}
  links={[
    { label: "calendar", href: "/calendar" },
    { label: "articles", href: "/articles" },
  ]}
/>
```

## select

**Role:** styled non-searchable dropdown select bound to a controlled value
**Install:** `bunx @justin06lee/chrome@latest add select`
**Composes:** nothing — empty registryDependencies and no npm deps; it doesn't even import utils (className is concatenated by hand)

default-exported (`import Select from "@/components/ui/select"`), generic over `string | number` values. renders a trigger button showing the selected option's `prefix` + label (or a placeholder) and, when open, an inline absolutely-positioned listbox (`z-30`, max-h-72, scrollable — not a portal). fully controlled via `value`/`onChange`; note `onChange` gets `T`, never null — there is no built-in clear (use combobox with `allowClear` for that).

keyboard support is the most complete of the dropdown trio: on open the listbox is focused and the currently-selected option is pre-highlighted; ArrowUp/ArrowDown move with wrapping and skip disabled options, Home/End jump to the first/last enabled option, Enter selects, Escape closes with `stopPropagation` so a surrounding dialog stays open. selecting or escaping returns focus to the trigger so it doesn't drop to document.body. outside click closes. aria is `role="listbox"`/`option` with aria-activedescendant.

options can carry a `prefix` ReactNode (e.g. a color swatch) and `disabled`. `size="compact"` shrinks the trigger and rows for inline/table-cell use, and `background` sets a CSS background on the root (transparent by default — useful over non-black surfaces). choose select for short static lists; combobox when users need to filter or create; menu when items are actions rather than a value.

**Key props:**
- `value: T` — required
- `onChange: (value: T) => void` — required
- `options: SelectOption<T>[]` — required
- `placeholder: string` — shown in the trigger when no option matches value.
- `disabled: boolean` — disables the trigger button.
- `ariaLabel: string` — accessible name for the trigger.
- `className: string` — extra classes for the root element.
- `size: 'default' | 'compact' = 'default'`
- `background: string` — CSS background applied to the root element. transparent by default.

**Example:**
```tsx
const [v, setV] = useState<"a" | "b" | "c">("a");
<Select
  value={v}
  onChange={setV}
  options={[
    { value: "a", label: "alpha" },
    { value: "b", label: "beta" },
  ]}
  ariaLabel="variant"
/>
```

## sheet

**Role:** edge-anchored slide-in panel (drawer) with backdrop, for secondary content
**Install:** `bunx @justin06lee/chrome@latest add sheet`
**Composes:** motion, lucide-react (npm); nothing beyond utils from the registry

controlled overlay: you own `open` and pass `onClose`, which fires on backdrop click, Escape, or the built-in X button. renders a fixed dimmed backdrop (`z-50`) and a fixed panel (`z-[80]`) anchored to one screen edge via `side` — right/left panels are w-72 (sm:w-80) full-height, top/bottom are h-72 full-width; override sizing with `className` (e.g. `className="h-96"` on a bottom sheet). enter/exit is a motion tween from/to offscreen with `AnimatePresence`, so the exit animation plays before unmount.

it carries the full modal contract: focus moves to the first focusable in the panel on open (falling back to the panel itself) and is restored on close, Tab/Shift+Tab are trapped inside, body scroll is locked while open (previous overflow value restored so stacked overlays don't clobber each other), and the panel is `role="dialog" aria-modal="true"` labelled by the rendered `title` or by `ariaLabel` when there is no title.

the sheet is headless about its contents — the body is just a scrollable region for whatever children you pass. choose sheet for settings panels, mobile nav drawers, detail panes; choose dialog when you need a blocking answer (confirm/alert); note navbar already ships its own right-side panel for the mobile-menu case.

**Key props:**
- `open: boolean` — whether the sheet is visible.
- `onClose: () => void` — called on backdrop click, escape, or close button.
- `side: "right" | "left" | "top" | "bottom" = 'right'` — edge the panel slides in from.
- `title: string` — optional heading atop the panel.
- `children: ReactNode` — panel body.
- `className: string` — extra classes for the panel.
- `ariaLabel: string` — accessible name for the panel when no title is rendered. ignored when title is set.

**Example:**
```tsx
const [open, setOpen] = useState(false);
<button onClick={() => setOpen(true)}>settings</button>
<Sheet open={open} onClose={() => setOpen(false)} side="right" title="settings">
  <a href="/profile">profile</a>
</Sheet>
```

## sidebar

**Role:** grouped docs-style navigation column with active highlighting and optional search
**Install:** `bunx @justin06lee/chrome@latest add sidebar`
**Composes:** lucide-react (npm); nothing beyond utils from the registry

renders a fixed-width (`w-[240px]`) bordered `<aside>` of labeled groups, each an uppercase mono heading over a list of links. the item whose `href` exactly equals `activeHref` gets the active treatment (white text, left border); everything else is muted with hover. it does not observe scroll or the url — you compute `activeHref` (e.g. from `usePathname()`) and pass it in. matching is exact string equality, so normalize trailing slashes yourself.

`searchable` adds a filter input above the groups that live-filters items by case-insensitive label match, hiding emptied groups and showing "no matches." when nothing survives. this is the one nav component with a `linkComponent` prop — pass your router's `Link` for client-side navigation; it defaults to a plain `"a"`. it is a client component (the search state), inline in the layout flow, not an overlay; give it `overflow-y-auto` via className if its column should scroll independently.

use sidebar for site-level hierarchical nav (docs sections); use toc for within-page headings that should track scroll automatically; use navbar for the horizontal top-level shell.

**Key props:**
- `groups: SidebarGroup[]` — { label, items: { label, href }[] }[] — the nav sections.
- `activeHref: string` — href of the current page; the exact-matching item gets the active treatment.
- `searchable: boolean = false` — renders a search input above the groups that filters items by label.
- `searchPlaceholder: string = 'search…'` — placeholder for the search input.
- `linkComponent: React.ElementType = 'a'` — anchor element/component for items — pass your router's Link.
- `className: string` — extra classes on the root <aside>.

**Example:**
```tsx
<Sidebar
  groups={[
    { label: "getting started", items: [{ label: "installation", href: "/docs/install" }] },
    { label: "components", items: [{ label: "sidebar", href: "/components/sidebar" }] },
  ]}
  activeHref={pathname}
  searchable
/>
```

## tabs

**Role:** controlled tab-strip for switching between sibling views
**Install:** `bunx @justin06lee/chrome@latest add tabs`
**Composes:** nothing beyond utils (also installs its own use-tabs.ts hook)

renders only the row of bordered pill tab buttons — it does not manage panels. you own `value`/`onValueChange` and render the matching panel yourself (switch on `value`; the hook's `getPanelId` gives you the id to wire `aria-controls` against if you want full aria). the active tab gets a solid white border; disabled items render at reduced opacity and are skipped by keyboard nav.

behavior lives in the shipped headless `useTabs` hook: roving tabindex (only the active tab is in the tab order), and arrow keys that both move focus and change selection — ArrowRight/ArrowDown forward, ArrowLeft/ArrowUp back, Home/End to the first/last enabled tab, wrapping past the ends unless `loop={false}`. if the controlled value points at a disabled or unknown tab, the first arrow press lands on a sane enabled tab from the edge rather than jumping off the end. proper `role="tablist"`/`tab`/`aria-selected` wiring throughout.

tabs is for peer views inside one page region. use breadcrumb for hierarchy, sidebar for site nav, accordion when sections should stack and stay in the document.

**Key props:**
- `value: T` — required
- `onValueChange: (value: T) => void` — required
- `items: TabItem<T>[]` — required — { value, label, disabled? }[]
- `loop: boolean = true` — loop arrow-key focus past the ends.

**Example:**
```tsx
const [tab, setTab] = useState<"projects" | "hobbies">("projects");
<Tabs
  value={tab}
  onValueChange={setTab}
  items={[
    { value: "projects", label: "projects" },
    { value: "hobbies", label: "hobbies" },
  ]}
/>
<div role="tabpanel">{tab === "projects" ? <Projects /> : <Hobbies />}</div>
```

## toc

**Role:** sticky "on this page" table of contents with scroll-spy highlighting
**Install:** `bunx @justin06lee/chrome@latest add toc`
**Composes:** nothing beyond utils (also installs its own use-toc.ts hook)

give it a flat list of `{ id, text }` headings whose ids exist in the DOM; it renders a sticky nav (`top` bound to the `--sticky-header-offset` CSS var, default 80px) of anchor links and highlights whichever heading is currently in view. renders null for an empty headings list. the active row comes from the shipped headless `useToc` hook, which returns the active id from an IntersectionObserver: it observes each heading element, picks the topmost intersecting one in document order (deterministic, not "last batch entry wins"), and when nothing intersects falls back to the last heading scrolled past the observed zone's top inset — so the highlight never goes blank mid-page. the observer re-subscribes only when the actual id set changes, so a fresh array literal each render is fine.

by default it spies on the document with a `-80px 0px -70% 0px` rootMargin (leaving room for a sticky header). pass `container` (a ref to a scrollable element) to scope everything to that element: the observer uses it as `root` with a `0px 0px -60% 0px` margin, and link clicks scroll only that container — the hash and page scroll are suppressed entirely so the page can't jump. without a container, clicks smooth-scroll the page (instant under prefers-reduced-motion) and push the hash onto history.

toc is for flat within-page heading tracking that updates itself on scroll; sidebar is for cross-page hierarchy where you supply the active href manually. links here are plain `<a href="#id">` — no linkComponent, and none is needed since targets are same-page.

**Key props:**
- `headings: TocHeading[]` — required — { id, text }[] — ids must exist in the DOM.
- `label: string = 'on this page'`
- `container: RefObject<HTMLElement | null>` — scrollable element the headings live in. scroll-spy and click scrolling stay inside it; defaults to the document.

**Example:**
```tsx
<Toc
  headings={[
    { id: "introduction", text: "introduction" },
    { id: "installation", text: "installation" },
  ]}
/>
```

## tooltip

**Role:** tiny hover/focus label pill on any trigger element
**Install:** `bunx @justin06lee/chrome@latest add tooltip`
**Composes:** nothing beyond utils

pure CSS, no state, server-component safe. wraps its children in a relative `group` span with an absolutely-positioned white pill (`z-10`, black text — the one inverted surface in this dark-only set) that fades and slides in on `group-hover` and `group-focus-within`, so keyboard focus on the trigger reveals it too. `side` picks above (slides up) or below (slides down); the transform is written as a single arbitrary value rather than composed translate utilities so the slide transitions smoothly instead of snapping.

the pill is `aria-hidden` and `pointer-events-none` — it is decorative, so the trigger must carry its own accessible name (e.g. `aria-label` on an icon button). the pill is not portaled and `whitespace-nowrap`, so it can be clipped by `overflow: hidden` ancestors and will overflow long labels; keep labels short.

use tooltip for one-line hints on hover; anything interactive, multi-line, or click-triggered belongs in menu, sheet, or dialog instead.

**Key props:**
- `label: ReactNode` — required — text shown in the pill.
- `side: 'top' | 'bottom' = 'top'`
- `children: ReactNode` — required — the trigger element.

**Example:**
```tsx
<Tooltip label="copy to clipboard">
  <button type="button" aria-label="copy">
    <CopyIcon />
  </button>
</Tooltip>
```
