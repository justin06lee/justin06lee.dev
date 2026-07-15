# primitives

small building-block controls: chips, buttons, form inputs, keycaps, and pickers. these are the atoms of the chrome registry — thin translucent borders, square corners, dark-only styling on a transparent background. every component installs its own transitive dependencies when added via the cli, so `add tag-input` pulls in `badge` and `utils` automatically.

## badge

**Role:** small chip for labels, tech tags, and toggleable filter chips.
**Install:** `bunx @justin06lee/chrome@latest add badge`
**Composes:** nothing beyond utils

renders an inline chip in one of three variants: `outline` (thin border, muted text — the tech-tag look), `solid` (white fill, black text — selected/emphasis), and `ghost` (transparent until hovered — the filter-chip look). by default it is a static `<span>`; passing `onClick` switches the element to a real `<button type="button">` with `aria-pressed` wired to `active`, making it a toggle without any extra markup.

the `active` prop overrides the chosen variant with the solid look, so the canonical filter pattern is `variant="ghost"` plus `active={selected}` — inactive chips stay quiet, the selected one goes white. state is entirely yours (controlled from outside); the component holds none.

classes merge via `cn` (clsx + tailwind-merge), so `className` overrides win over defaults. reach for badge for small inert or toggleable chips; use `tag-input` when you need a full add/remove chip editor, and `button` when the thing is an action rather than a label.

**Key props:**
- `variant: 'outline' | 'solid' | 'ghost' = 'outline'`
- `onClick: () => void — renders as a toggle button.`
- `active: boolean = false — toggle state; swaps to the solid look.`

**Example:**
```tsx
<Badge>react</Badge>
<Badge variant="solid">selected</Badge>
<Badge variant="ghost" active={selected} onClick={() => toggle("react")}>
  react
</Badge>
```

## button

**Role:** the primary action element — polymorphic button/anchor with variants, icons, hover tooltip, and click-to-clipboard.
**Install:** `bunx @justin06lee/chrome@latest add button`
**Composes:** lucide-react (npm)

renders a `<button>` by default, or a plain `<a>` when given `href` — no framework router involved, so it works anywhere; external urls (matching `http(s)://`) get `target="_blank"` and `rel="noopener noreferrer"` automatically. five variants: `solid`, `outline` (the default), `dashed`, `ghost`, and `link`. the `link` variant drops padding/size classes entirely and behaves like inline text with an underline on hover.

icons are lucide components passed as `icon` / `iconRight`. omitting `children` makes it an icon-only square button — those need an accessible name, resolved as `label` first, then `tooltip`. the `tooltip` prop renders a white slide-up pill above the button on hover (pure css transition, `aria-hidden`, positioned off the `group` class).

`copy` turns the button into a clipboard writer: click writes the string via `navigator.clipboard`, then the tooltip (and string children) swap to `copyFeedback` ("Copied!" by default) for 1.5s. precedence gotcha, documented in the source: `copy` and `disabled` win over `href` — when `copy` is set the element must be a real button, so the anchor branch is skipped and no navigation happens. do not combine `copy` with `href`. `onClick` still fires after the copy. classes merge via `cn`, `background` sets an inline css background (transparent otherwise), and `ref` forwards to the underlying button or anchor.

**Key props:**
- `variant: 'solid' | 'outline' | 'dashed' | 'ghost' | 'link' = 'outline'`
- `size: 'sm' | 'md' = 'md'`
- `icon: LucideIcon — lucide icon before text (or alone if no children).`
- `iconRight: LucideIcon — lucide icon after text.`
- `tooltip: string — white slide-up pill shown on hover.`
- `label: string — aria-label override; required for icon-only buttons.`
- `href: string — renders as <a>. external URLs (http(s)://) get target="_blank" auto-applied.`
- `onClick: () => void`
- `fullWidth: boolean = false`
- `disabled: boolean = false`
- `copy: string — click copies this to the clipboard. tooltip + text children swap to copyFeedback for 1.5s.`
- `copyFeedback: string = 'Copied!'`
- `background: string — CSS background applied to the root element. transparent by default.`

**Example:**
```tsx
<Button variant="solid" icon={Menu}>menu</Button>
<Button icon={Github} label="GitHub" tooltip="GitHub" href="https://github.com" />
<Button variant="link" icon={Copy} tooltip="Copy email" copy="hi@example.com">Copy</Button>
```

## card

**Role:** compositional bordered container with header/title/meta/body/actions slots.
**Install:** `bunx @justin06lee/chrome@latest add card`
**Composes:** nothing beyond utils

a slot-based card in the shadcn style: `Card` is the shell (thin `border-white/10`, square corners, `flex-col gap-3 p-5`, transparent background), and `CardHeader`, `CardTitle`, `CardMeta`, `CardBody`, `CardActions` are the pieces you compose inside it. everything is a plain server-safe component — no client state, no "use client".

`CardHeader` lays title and meta side by side (`justify-between`); `CardMeta` is the muted, shrink-proof right-hand slot for a year or status; `CardBody` is a `<p>` of muted small text; `CardActions` is a footer row for links or buttons. `CardTitle` renders an `<h3>`, and given `href` wraps it in a plain `<a>` — external urls get `target="_blank"` automatically, same convention as button.

use only the slots you need and drop the rest — nothing is required. every slot accepts `className` merged via `cn`, so overrides always win. `Card` also takes `background` as an inline css background for when the transparent default is not enough.

**Key props:**
- `Card.background: string — CSS background on the shell. transparent by default.`
- `CardTitle.href: string — renders the title as a link; external URLs open in a new tab.`
- `className: string — available on every slot for overrides.`

**Example:**
```tsx
<Card>
  <CardHeader>
    <CardTitle href="https://chrome.justin06lee.dev">chrome registry</CardTitle>
    <CardMeta>2026</CardMeta>
  </CardHeader>
  <CardBody>own-the-code components, installed via the cli.</CardBody>
  <CardActions>
    <a href="#" className="text-sm hover:underline">view code</a>
  </CardActions>
</Card>
```

## checkbox

**Role:** square form checkbox with a check-on-fill look.
**Install:** `bunx @justin06lee/chrome@latest add checkbox`
**Composes:** lucide-react (npm)

wraps a native `<input type="checkbox">` inside a `<label>`, so it works in plain html forms with zero wiring — `name`, `checked`, `defaultChecked`, `onChange`, `required`, and every other input attribute pass straight through (the props interface extends `InputHTMLAttributes` minus `type` and `size`). works controlled or uncontrolled exactly like a native checkbox.

the box is the input itself with `appearance-none`: thin translucent border, no corners, filling solid white when checked. the black check mark is a lucide `Check` overlaid absolutely and revealed via the `peer-checked` selector — pure css, no state in the component. focus shows a `focus-visible` ring; disabled dims the whole label and switches the cursor.

`className` targets the box element; `wrapperClassName` targets the outer `<label>`. pass `label` for the text beside the box — clicking the text toggles the input for free since it is all one label. the component is a `forwardRef` to the underlying input, so it plugs into react-hook-form style `register` calls directly.

**Key props:**
- `label: ReactNode — text rendered beside the box.`
- `checked: boolean — controlled checked state.`
- `defaultChecked: boolean — uncontrolled initial state.`
- `onChange: (e: ChangeEvent<HTMLInputElement>) => void`
- `disabled: boolean = false`
- `wrapperClassName: string — classes for the outer <label>.`

**Example:**
```tsx
<Checkbox label="published" defaultChecked />
<Checkbox label="hidden test case" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
<Checkbox label="disabled" disabled />
```

## color-swatch

**Role:** fixed-palette color chip plus a controlled radio-style palette picker.
**Install:** `bunx @justin06lee/chrome@latest add color-swatch`
**Composes:** nothing beyond utils

exports three things: `ColorSwatch`, a tiny presentational chip (a bordered `size-3` span filled with the given hex); `ColorSwatchPicker`, a controlled row of selectable swatches; and `CATEGORY_PALETTE`, a muted 8-color default palette (slate-blue, taupe, sage, plum, ochre, terracotta, fog, indigo) ported from the site's calendar categories. a helper `pickNextUnusedColor(used)` returns the palette hex appearing least often in a list, ties broken by palette order — handy for auto-assigning colors to new categories.

the picker is fully controlled: `value` is the selected hex or `null`, `onChange` fires with the clicked hex. semantically it is a `role="radiogroup"` of `role="radio"` buttons with `aria-checked`, each labelled and titled with the color's name. the active swatch gets a solid white border; the rest stay faint until hovered. selection is not clearable from inside the picker — clicking always selects.

pass your own `palette` (`{ name, hex }[]`) to replace the default. reach for this when the choice set is a small fixed palette; it is not a freeform color picker.

**Key props:**
- `color: string (required) — ColorSwatch: hex chip fill.`
- `value: string | null (required) — ColorSwatchPicker: selected hex.`
- `onChange: (hex: string) => void (required) — ColorSwatchPicker.`
- `palette: readonly PaletteColor[] = CATEGORY_PALETTE — ColorSwatchPicker: { name, hex }[] to choose from.`

**Example:**
```tsx
const [value, setValue] = useState<string | null>(CATEGORY_PALETTE[0]!.hex);

<ColorSwatch color={value ?? "#000000"} />
<ColorSwatchPicker value={value} onChange={setValue} ariaLabel="pick a color" />
```

## copy-button

**Role:** copy-to-clipboard text button with copied/error feedback states.
**Install:** `bunx @justin06lee/chrome@latest add copy-button`
**Composes:** nothing beyond utils

a small mono-font text button (`copy` in muted white, brightening on hover) that writes `text` to the clipboard on click. internal state machine is `idle | copied | error`: success shows the copied label, failure (clipboard api absent — insecure context — or write rejected) shows the error label, and either reverts to idle after `resetMs`. the result is also announced through a visually-hidden `role="status"` live region, separate from the button label, so screen readers hear the outcome reliably.

it is intentionally standalone — no registry deps at all, and it does not use `cn`: `className` is plainly concatenated after the defaults, so tailwind-merge conflict resolution does not apply here. pass `children` to replace the label entirely (feedback then only reaches users via the live region), or restyle via `className`/`background`. all other native button attributes spread through.

use this for the "copy a command / snippet" affordance next to code. if you want a full button with variants and a hover tooltip that flips to "Copied!", use `button` with its `copy` prop instead — this one is the quieter inline-text version.

**Key props:**
- `text: string (required) — string to copy`
- `resetMs: number = 2000 — ms before reverting`
- `labels: { idle, copied, error } = copy/copied/failed`
- `background: string — CSS background applied to the root element. transparent by default.`

**Example:**
```tsx
<code className="font-mono text-[13px]">bunx @justin06lee/chrome@latest init</code>
<CopyButton text="bunx @justin06lee/chrome@latest init" />
```

## input

**Role:** minimal single-line text input.
**Install:** `bunx @justin06lee/chrome@latest add input`
**Composes:** nothing beyond utils

a styled native `<input>`: transparent background, thin `border-white/20`, square corners, small white text, faint placeholder, border brightening to `white/50` on focus (no ring). the props interface extends `InputHTMLAttributes`, so it behaves exactly like a native input — controlled with `value`/`onChange` or uncontrolled with `defaultValue`, and `type`, `name`, `placeholder`, `disabled`, etc. all pass through. it is a `forwardRef` to the input element and is server-safe (no "use client").

meta.ts declares no props list; the surface is intentionally just the native input plus `background` (an inline css background that overrides anything in `style`, transparent by default) and `className` merged via `cn`. there is no size prop — set width with a class like `w-56`.

use `textarea` for multiline, `tag-input` for chip lists. no light-mode styles exist; it assumes a dark page.

**Key props:**
- `background: string — CSS background applied to the root element. transparent by default.`
- `...props: InputHTMLAttributes — all native input attributes (value, onChange, type, placeholder, disabled, ...).`

**Example:**
```tsx
<Input placeholder="type something..." className="w-56" />
```

## kbd

**Role:** macos-style keycap for showing keyboard shortcuts.
**Install:** `bunx @justin06lee/chrome@latest add kbd`
**Composes:** nothing beyond utils

renders a semantic `<kbd>` element styled as a keycap: mono glyph on a faint raised cap (`bg-white/[0.06]`) with a heavier bottom border edge (`border-b-2`) that gives the physical-key look. notably the one place in the registry with a rounded corner — `rounded-[3px]`, matching real keycaps. text is selectable-off (`select-none`) so shortcut hints don't get caught in text selection.

purely presentational and server-safe. compose combos by placing several side by side: `<Kbd>⌘</Kbd><Kbd>k</Kbd>`. two sizes — `sm` (default, 20px tall) and `md` (24px) — both with a min-width so single glyphs stay square. all native html attributes spread through and `className` merges via `cn`.

**Key props:**
- `size: 'sm' | 'md' = 'sm' — keycap size.`
- `className: string`
- `children: ReactNode (required) — the key glyph or label.`

**Example:**
```tsx
<div className="flex items-center gap-1.5">
  <Kbd>⌘</Kbd>
  <Kbd>k</Kbd>
  <span className="ml-2 text-sm text-white/50">open the palette</span>
</div>
```

## range

**Role:** thin minimal slider for numeric values.
**Install:** `bunx @justin06lee/chrome@latest add range`
**Composes:** nothing beyond utils

a controlled wrapper around a native `<input type="range">`: `value` and `onChange` are required, with `onChange` receiving the value already coerced to a number. `min`/`max`/`step` map straight to the native attributes. being native, keyboard support (arrows, home/end) comes for free; pass `ariaLabel` since there is no visible label.

the look — a 2px translucent track with a square 12px white thumb that scales 1.2x on hover — cannot be expressed in utility classes because it lives in `::-webkit-slider-thumb` / `::-moz-range-thumb` pseudo-elements. so the component ships a `range.css` file defining a `.chrome-range` class, and the cli patches that css into your globals on `add`. the tsx just applies `chrome-range` plus your `className` via `cn`.

gotcha: if the slider renders unstyled (default browser look), the css patch did not land — check that the `.chrome-range` rules made it into your global stylesheet. also note meta.ts lists only the value/bounds props; `ariaLabel` and `className` exist on the component as well.

**Key props:**
- `value: number (required)`
- `onChange: (value: number) => void (required)`
- `min: number = 0`
- `max: number = 100`
- `step: number = 1`
- `disabled: boolean = false`

**Example:**
```tsx
const [v, setV] = useState(40);
<Range value={v} onChange={setV} ariaLabel="volume" />
```

## segmented

**Role:** row of mutually exclusive options — a mode/view switcher.
**Install:** `bunx @justin06lee/chrome@latest add segmented`
**Composes:** nothing beyond utils

a controlled, generically-typed segmented control: `value: T`, `onChange(value: T)`, and `options: { value, label }[]` where `T extends string`, so option values stay narrowly typed (e.g. `"day" | "month" | "year"`). the active segment gets a visible border and full-white text; inactive segments are borderless and muted until hovered. two sizes: `default`, and `compact` — smaller, uppercase, wide letter-spacing, meant for terse mode toggles like "now / backfill".

keyboard behavior is a proper roving tabindex: only the active segment sits in the tab order, and arrow keys (left/right and up/down) move both focus and selection between segments, looping at the ends. if no option matches `value`, the first segment falls back into the tab order so the control never becomes keyboard-unreachable. semantics are `role="group"` with `aria-pressed` buttons; pass `ariaLabel` to name the group.

use this for 2-5 exclusive choices always visible at once; reach for a select/combobox when the option list is long, and `badge` chips when selections are independent toggles rather than exclusive.

**Key props:**
- `value: T (required)`
- `onChange: (value: T) => void (required)`
- `options: SegmentedOption<T>[] (required) — { value, label }[]`
- `size: 'default' | 'compact' = 'default'`

**Example:**
```tsx
const [view, setView] = useState<"day" | "month" | "year">("day");
<Segmented
  value={view}
  onChange={setView}
  options={[
    { value: "day", label: "day" },
    { value: "month", label: "month" },
    { value: "year", label: "year" },
  ]}
/>
```

## tag-input

**Role:** chip editor — type to add tags, click suggestions, remove with backspace or the chip's x.
**Install:** `bunx @justin06lee/chrome@latest add tag-input`
**Composes:** badge (registry)

a controlled tag list built on `badge`: `value` is the current `string[]`, `onChange` receives the next list on every add/remove. the visible "field" is a bordered flex-wrap box holding outline badges (each with an x button) plus a borderless inner `<input>` for the draft; clicking anywhere in the box focuses the input. below it, any `suggestions` not already present render as ghost badges that append on click.

input behavior: enter or comma commits the draft; blur also commits it; backspace in an empty draft removes the last tag. tags are trimmed and deduped on add (exact string match). set `allowFreeText={false}` to ignore typed text entirely and accept only suggestion clicks. the placeholder only shows while the tag list is empty.

it imports `Badge` from `@/components/ui/badge` — the cli resolves that automatically since `badge` is a registry dependency. state lives entirely in the parent except the draft string; there is no internal tag state to get out of sync. each remove button carries an `aria-label` of `remove <tag>`.

**Key props:**
- `value: string[] (required) — current tags (controlled).`
- `onChange: (tags: string[]) => void (required)`
- `suggestions: string[] = [] — clickable existing-tag chips; present tags are hidden.`
- `placeholder: string = "add a tag…"`
- `allowFreeText: boolean = true — when false, only suggestions can be added.`
- `className: string`

**Example:**
```tsx
const [tags, setTags] = useState<string[]>(["react", "typescript"]);
<TagInput
  value={tags}
  onChange={setTags}
  suggestions={["next.js", "tailwind", "bun"]}
/>
```

## textarea

**Role:** minimal multiline text input matching the input styling.
**Install:** `bunx @justin06lee/chrome@latest add textarea`
**Composes:** nothing beyond utils

the multiline sibling of `input`: a styled native `<textarea>` with the same thin `border-white/20`, square corners, transparent background, faint placeholder, and focus border brightening — plus `w-full` and vertical-only resize (`resize-y`). defaults to 4 rows. the props interface extends `TextareaHTMLAttributes`, so it works controlled or uncontrolled exactly like a native textarea, and it is a `forwardRef` to the element. server-safe, no client state.

`background` sets an inline css background that wins over anything in `style`; `className` merges via `cn` so overrides land last. there is no autogrow — height is `rows` plus the user's manual resize. use `input` for single-line values.

**Key props:**
- `rows: number = 4`
- `background: string — CSS background. transparent by default.`
- `...props: TextareaHTMLAttributes — all native textarea attributes.`

**Example:**
```tsx
<Textarea
  className="w-72"
  placeholder="write something…"
  value={v}
  onChange={(e) => setV(e.target.value)}
/>
```
