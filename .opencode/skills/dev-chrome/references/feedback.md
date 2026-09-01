# feedback & status

the components that tell the user what just happened, what is happening, or
why there is nothing to look at: `toast` (interrupts from a corner and
leaves), `callout` (stays attached to the thing it's about), `empty-state`
(the slot that could hold something but doesn't), `progress` and `skeleton`
(work in flight). the group shares a deliberate colour discipline — only
`danger` and `warn` spend colour, everything else stays on the white opacity
ladder, so a page full of notices doesn't turn into a traffic light.

three of these ship their keyframes inline via a hoisted
`<style precedence="default" href="…">` tag rather than a globals.css
keyframe, so there is nothing to wire up on install.

## callout

**Role:** inline notice attached to the thing it's about — the counterpart to a toast.
**Install:** `bunx @justin06lee/chrome@latest add callout`
**Composes:** lucide-react (npm); nothing beyond utils from the registry

a bordered block with a variant icon, an optional bold title line, body copy,
an optional trailing `action` slot, and an optional dismiss button. where
`toast` interrupts from a corner and leaves, a callout stays put — so it suits
the standing caveats a form or a page has to carry permanently.

the accessibility detail worth knowing: **`role` follows severity rather than
being fixed.** `danger` gets `role="alert"` (assertive — interrupts), `warn`
and `success` announce politely via `role="status"`, and a plain `note` carries
no live semantics at all, because a page of decorative notes would otherwise
flood the screen-reader buffer. this is why picking the right variant matters
beyond colour.

colour is rationed the same way: only `warn` and `danger` spend it; `note` and
`success` stay on the white opacity ladder. `icon` swaps the variant's default
lucide glyph, and `icon={null}` drops it entirely. `onDismiss` adds a close
button but the component is presentational — it never hides itself, the caller
owns visibility.

reach for callout for persistent, in-context notices; `toast` for transient
confirmations of an action the user just took; `empty-state` when the whole
region is empty rather than merely annotated.

**Key props:**
- `variant: 'note' | 'success' | 'warn' | 'danger' = 'note'` — tone. only warn and danger spend colour; the rest stay on the opacity ladder.
- `title: ReactNode` — bold first line. omit for a single-line callout.
- `children: ReactNode` — body copy.
- `icon: LucideIcon | null` — replaces the variant's default icon; null drops it entirely.
- `onDismiss: () => void` — adds a close button. presentational — the caller owns visibility.
- `action: ReactNode` — trailing slot under the copy, e.g. a retry button.
- `className: string`

**Example:**
```tsx
<Callout variant="warn" title="unsaved changes">
  this draft hasn't been saved since 4:12pm.
</Callout>

<Callout variant="danger" title="upload failed" action={<Button size="sm" onClick={retry}>retry</Button>}>
  the file exceeded the 25mb limit.
</Callout>
```

## empty-state

**Role:** the "nothing here" panel — icon, title, reason, and the action that would fix it.
**Install:** `bunx @justin06lee/chrome@latest add empty-state`
**Composes:** nothing beyond utils

a centered panel with a dashed border, an optional decorative `icon` slot, a
lowercase `title` saying what isn't here, a `description` explaining why or
what to do, and up to two action slots. server-renderable — no client state.

the dashed border is not arbitrary: it is the library's existing signal for a
slot that could hold something but doesn't, matching the `dashed` button
variant. set `bordered={false}` when the parent already draws a border, so you
don't stack two.

the reason it exists is worth carrying into your own usage — every list in the
library was hand-rolling this, and the hand-rolled versions kept collapsing two
different states into one. **empty-because-new and empty-because-filtered want
different copy and different actions**: "no articles yet / write your first
one" versus "no articles match / clear filters". pass different props for the
two cases rather than one generic panel.

`action` is the primary fix (usually a `Button`); `secondaryAction` is the
quieter escape hatch beside it. `size` scales the padding and type.

**Key props:**
- `title: ReactNode` — required — one lowercase line saying what isn't here.
- `description: ReactNode` — why it's empty, or what to do about it.
- `icon: ReactNode` — decorative mark above the title — a lucide icon, ascii, anything.
- `action: ReactNode` — primary action, usually a Button.
- `secondaryAction: ReactNode` — quieter escape hatch beside the action.
- `size: 'sm' | 'md' | 'lg' = 'md'`
- `bordered: boolean = true` — draw the dashed container; off when the parent already has a border.
- `className: string`

**Example:**
```tsx
{query ? (
  <EmptyState
    title="no articles match"
    description="try a different search, or clear the tag filter."
    action={<Button onClick={clear}>clear filters</Button>}
  />
) : (
  <EmptyState
    icon={<FileText size={20} />}
    title="no articles yet"
    description="drafts you write in the desk show up here."
    action={<Button href="/desk">open the desk</Button>}
  />
)}
```

## live-badge

**Role:** "happening right now" — a pulsing dot, a word, and an optional detail.
**Install:** `bunx @justin06lee/chrome@latest add live-badge`
**Composes:** nothing beyond utils

four fixed states — `live`, `connecting`, `idle`, `offline` — each with its own
dot treatment and default word, plus an optional `detail` appended after a
middot (a listener count, a bitrate, a room name).

`badge` is a chip in a row of metadata: it says what a thing **is**. this says
what a thing is **doing at this second**, which is what earns it a separate
component — the states are fixed rather than free-form variants, the dot
animates, and the whole thing carries `role="status"` so a change from offline
to live is *announced* rather than silently redrawn.

the pulse is **a ring expanding out of the dot, not the dot itself blinking** —
a blinking element in the corner of the eye is genuinely unpleasant to sit
beside for an hour. under reduced motion the ring is dropped and the dot stays
lit: "live" is information, and it survives without the animation. keep both
behaviours if you restyle it.

**Key props:**
- `status: 'live' | 'connecting' | 'idle' | 'offline' = 'live'`
- `label: ReactNode` — overrides the default word for the status.
- `detail: ReactNode` — appended after a middot — a listener count, a bitrate, a room name.
- `size: 'sm' | 'md' = 'md'`
- `accent: string = '#fff'` — css color of the dot when live.
- `className: string`

**Example:**
```tsx
<LiveBadge status={connected ? "live" : "connecting"} detail={`${listeners} listening`} />
```

## progress

**Role:** linear progress bar — determinate from a value, or an indeterminate sweep.
**Install:** `bunx @justin06lee/chrome@latest add progress`
**Composes:** nothing beyond utils

a square-cornered track in one of three heights (`sm` 2px, `md` 4px, `lg` 8px)
with an optional mono `label` above it and an optional value readout opposite.
determinate mode fills from `value`/`max`; `indeterminate` instead sweeps a
sliver across the track and **reports no value to assistive tech** — which is
the correct behavior for unknown durations, rather than faking a percentage.

the sweep keyframes ship inline through a hoisted `<style>` tag deduped by
react, so the component stays self-contained: no css file to wire up and no
motion dependency. `prefers-reduced-motion` is honored.

`valueText` overrides the percentage with your own string (e.g. `"3 of 8"`) and
sets `aria-valuetext` to match, so the announced value and the visible one
never diverge. `bordered` outlines the track instead of tinting it — only
really legible at `size="lg"`. `accent` recolors the fill.

use `progress` for a linear determinate bar, `timer-ring` (in
`references/time-scheduling.md`) when the same value should read as a circular
countdown, and `skeleton` when you're reserving layout rather than reporting
completion.

**Key props:**
- `value: number = 0` — current amount; ignored when indeterminate.
- `max: number = 100` — upper bound for value.
- `indeterminate: boolean = false` — unknown-duration state: a sliver sweeps the track and no value is reported to assistive tech.
- `size: 'sm' | 'md' | 'lg' = 'md'` — track height: 2px, 4px, 8px.
- `accent: string = '#fff'` — css color for the filled bar.
- `label: ReactNode` — caption above the track, set in the mono group-label style.
- `showValue: boolean = false` — show the percentage opposite the label.
- `bordered: boolean = false` — outline the track instead of tinting it. only sensible at size 'lg'.
- `valueText: string` — custom value text, e.g. "3 of 8". overrides the percentage and sets aria-valuetext.
- `ariaLabel: string`
- `className: string`

**Example:**
```tsx
<Progress label="uploading" value={sent} max={total} showValue />
<Progress indeterminate size="sm" ariaLabel="loading results" />
<Progress label="steps" value={3} max={8} valueText="3 of 8" showValue />
```

## skeleton

**Role:** loading placeholder in block, text and circle shapes.
**Install:** `bunx @justin06lee/chrome@latest add skeleton`
**Composes:** nothing beyond utils

three variants: `block` (a bar, sized by `width`/`height`), `text` (a stack of
`lines` bars where **the last one is shortened** so it reads as prose rather
than a table cell), and `circle` (an avatar placeholder, a square side by
default). the shimmer keyframes ship inline via a hoisted `<style>` tag deduped
by react, exactly like `progress` and `toast`.

the reduced-motion behavior is a deliberate departure from the usual rule:
under `prefers-reduced-motion` **the sweep stops but the block stays visible**.
removing the placeholder entirely would collapse the layout it exists to
reserve, which is the whole point of a skeleton.

accessibility is handled with `aria-busy` plus a single `label` — a stack of
text bars announces one "loading", not one per bar. **pass `label={null}` when
a parent already owns the live region**, or a page of skeletons announces
itself repeatedly. `animate={false}` kills the shimmer for large grids where
many sweeping bars get noisy.

**Key props:**
- `variant: 'block' | 'text' | 'circle' = 'block'`
- `lines: number = 3` — number of bars for variant="text"; the last is shortened.
- `width: string | number` — css width. defaults to full width, or a square side for circle.
- `height: string | number` — css height. defaults per variant.
- `animate: boolean = true` — turn off the shimmer for large grids where the sweep gets noisy.
- `label: string | null = 'loading'` — announced while loading. pass null when a parent already owns the live region.
- `className: string`

**Example:**
```tsx
<div className="flex gap-3">
  <Skeleton variant="circle" width={40} />
  <div className="flex-1">
    <Skeleton variant="text" lines={3} label={null} />
  </div>
</div>
```

## toast

**Role:** stacked, auto-dismissing notifications behind a provider and a hook.
**Install:** `bunx @justin06lee/chrome@latest add toast`
**Composes:** motion, lucide-react (npm); nothing beyond utils from the registry (also installs its own use-toast.ts hook)

like `dialog`, this is not a declarative element you place in jsx. mount
`<ToastProvider>` once near the app root, then call
`const { toast, dismiss } = useToast()` anywhere below it. `toast(options)`
queues a notification and returns its id; `dismiss(id)` removes one and
`dismiss()` removes all. the hook file also exports `useToastStore` if you want
the state machine without the provider.

the load-bearing implementation detail: **the viewport is always rendered, even
while empty.** an `aria-live` region has to exist in the dom *before* its
contents change for screen readers to announce them, so mounting it lazily
would silently swallow the first toast. don't "optimize" that away in your
installed copy.

toasts enter from the edge they're anchored to (so the motion reads as sliding
in from off-screen), pause on **hover and focus** — a keyboard user tabbing to
an action needs the timer held just as much as a pointer user does — and use a
motion layout animation so survivors don't snap into the gap a dismissed toast
leaves. bottom-anchored stacks grow upward so the newest toast is always
nearest the corner the eye is already on. the viewport itself never eats
clicks; only the toasts do. `max` caps how many stay on screen.

colour is rationed as elsewhere in the group: `danger` is the only variant that
spends red, and `success` earns its distinction from a check icon so the stack
stays monochrome. `duration: 0` (or `Infinity`) pins a toast until dismissed by
hand — **pair that with `action`**, or the undo button disappears before it can
be pressed. `anchor="container"` scopes the stack to the nearest positioned
ancestor instead of the viewport.

reach for toast when confirming an action the user just took; `callout` when
the notice belongs beside the thing it describes and should persist.

**Key props:** (provider props, then `toast()` options and the hook)
- `children: ReactNode` — the tree that can call useToast().
- `position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' = 'bottom-right'` — corner the stack grows from. bottom corners stack upward so the newest toast sits nearest the corner.
- `duration: number = 4000` — default auto-dismiss delay in ms for toasts that don't set their own.
- `max: number = 4` — how many toasts stay on screen; the oldest fall off past this.
- `anchor: 'viewport' | 'container' = 'viewport'` — 'viewport' pins the stack to the window; 'container' pins it to the nearest positioned ancestor, for toasts scoped to a panel.
- `label: string = 'notifications'` — accessible name for the aria-live region.
- `className: string` — extra classes for the viewport.
- `toast(options).title: ReactNode` — required — the headline line.
- `toast(options).description: ReactNode` — secondary copy under the title.
- `toast(options).variant: 'default' | 'success' | 'danger' = 'default'` — tone. success is marked by a check icon; danger is the only variant that spends color (red).
- `toast(options).duration: number` — ms before auto-dismiss, overriding the provider default. 0 or Infinity pins it until dismissed by hand.
- `toast(options).action: ReactNode` — trailing slot under the copy, e.g. an undo button. pair with duration: 0 so it stays reachable.
- `useToast().toast: (options: ToastOptions) => string` — queues a toast and returns its id.
- `useToast().dismiss: (id?: string) => void` — dismisses one toast by id, or every toast when called with no argument.

**Example:**
```tsx
// once, near the root:
<ToastProvider position="bottom-right">{children}</ToastProvider>

// anywhere below it:
const { toast, dismiss } = useToast();

toast({ title: "saved", variant: "success" });

const id = toast({
  title: "article deleted",
  duration: 0, // pinned, so the action stays reachable
  action: <Button size="sm" onClick={() => { restore(); dismiss(id); }}>undo</Button>,
});
```
