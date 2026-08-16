---
name: dev-chrome
description: Use when building NEW components for the chrome registry (chrome.justin06lee.dev / @justin06lee/chrome), or when working in any project that uses chrome and the UI you need isn't in the registry yet. Covers finding the registry repo on this machine, deciding between a new component and a prop on an existing one, writing to the house quality bar, and upstreaming the result into the registry and the docs site. Triggers on "add a chrome component", "chrome doesn't have", "build a component for chrome", "contribute to chrome.justin06lee.dev", "new registry component", or hitting a missing UI need in a project with a chrome.json.
---

# dev-chrome

this is the **development** skill for chrome. the companion `chrome` skill
covers *using* the registry; this one covers *growing* it.

the core rule, in one line:

> **if a component exists, use it. if you need something that doesn't exist,
> build it properly and upstream it into the registry and the site — don't
> leave a bespoke one-off behind.**

chrome is meant to get deeper over time. every real UI need that the
registry can't meet is a gap in the registry, not just a gap in the current
project. closing those gaps is the job. be generous about creating new
components — but never at the cost of duplicating one that already exists,
and never at the cost of the quality bar below.

## 1. find the registry

the registry source lives on this machine. locate it before doing anything
else:

```bash
# usual location: a sibling of whatever you're working in
ls -d ~/Workspace/**/chrome.justin06lee.dev 2>/dev/null

# or search
fd -td -d6 '^chrome\.justin06lee\.dev$' ~ 2>/dev/null
find ~ -maxdepth 6 -type d -name 'chrome.justin06lee.dev' 2>/dev/null

# confirm it's the right thing
test -f <path>/packages/registry/button/meta.ts && echo ok
```

it is a bun monorepo:

| path | what |
|------|------|
| `packages/registry/<name>/` | one directory per component — the source of truth |
| `packages/registry/_shared/` | `utils` (cn) and the theme block |
| `packages/registry-builder/` | `defineComponent`, the build, the validators |
| `packages/cli/` | `@justin06lee/chrome` — the `init`/`add`/`list`/`diff` cli |
| `apps/site/` | chrome.justin06lee.dev — the docs site |

export it once so the tooling in this skill can find it:

```bash
export CHROME_REGISTRY=<path>/packages/registry
```

**if you cannot find it on this machine, stop and ask.** do not clone it
speculatively and do not invent the path — the whole point of this skill is
editing the real repo.

## 2. decide which mode you're in

**mode A — you are working inside the registry repo itself.** normal
component development. sections 3-7 apply directly.

**mode B — you are working in another project that consumes chrome** (it has
a `chrome.json`). this is the common case and it has an extra obligation:

1. build the feature using registry components wherever they fit.
2. when something genuinely isn't in the registry, **build it as a proper
   registry component**, not as a page-local one-off.
3. add it to the registry repo (sections 4-6), run the build, and verify.
4. install it back into the consuming project via
   `bunx @justin06lee/chrome@latest add <name>` so the project uses the
   canonical copy rather than a fork.
5. mention in your summary that you extended the registry, and with what.

do not silently skip step 3 because you were "only" working on the other
project. a component that stays local is a component the next project has to
write again.

## 3. do not duplicate — the single most important check

before writing a new component, establish that it doesn't already exist in
some form. in order:

```bash
# what the registry actually serves right now
ls $CHROME_REGISTRY | sort
bunx @justin06lee/chrome@latest list

# what this skill's references document, and where
node tools/refs.mjs list
```

then read the relevant `references/*.md` file. those files carry a
`vs`-sibling paragraph for nearly every component, which exists precisely to
answer "is this the thing I'm about to build".

### new component, or a prop on an existing one?

this is the judgment call, and the registry has strong precedent. **a new
component is justified by different semantics, not by different styling.**

props on an existing component when the difference is presentational or
additive:

- another layout of the same content: `detail-list`'s `layout`,
  `radio-group`'s `variant`, `clock`'s `variant`
- a router escape hatch: `linkComponent` / `prefetch`
- an opt-in capability: `calendar`'s `renderCell` + `fillHeight`,
  `textarea`'s `counter`, `prose`'s `lineSync`

a genuinely new component when the *meaning* differs — each of these is a
real split the registry already made, and each one's `meta.ts` description
states the justification in a sentence:

| new | vs existing | because |
|-----|-------------|---------|
| `switch` | `checkbox` | takes effect immediately vs states an intent a submit commits |
| `stepper` | `tabs` | asserts sequence vs peers visitable in any order |
| `stamp` | `badge` | an assertion applied *on top of* something vs a chip in a row |
| `live-badge` | `badge` | what a thing is *doing right now* vs what it *is* |
| `volume` | `range` | level + mute + reflective icon vs "pick a number" |
| `timezone-select` | `combobox` | the label alone can't answer the question |
| `docket` | `detail-list` | the document itself vs metadata inside something else |
| `waveform` | `spectrum` | fixed shape (dom) vs repaints every frame (canvas) |
| `lane-bar` | `now-playing-bar` | many parallel activities vs one |
| `callout` | `toast` | stays attached vs interrupts and leaves |

write that sentence for your component **before** you write the component.
if you can't — if the honest answer is "it's the same thing with different
padding" — it's a prop.

### if it should be a prop

add the prop rather than a new component, and treat it as an API change:

- new props must be **optional with a default that preserves today's
  behavior**. changing an existing default is a breaking change for every
  project that already installed the component (`fade-in`'s duration once
  moved 0.4 → 0.8; that is the kind of change that needs to be deliberate
  and called out, not incidental).
- update `meta.ts` props in the same commit as the component change, or the
  docs site and every downstream reader go stale.

## 4. write it to the house bar

read two or three neighbouring components in `packages/registry/` before
starting. the style is consistent and worth matching exactly.

### design language (identical to the `chrome` skill — match it)

- **dark-only.** black backgrounds (`#000` / `#0a0a0a`), white text on the
  opacity ladder (`text-white`, `/70`, `/55`, `/40`, `/30`). no light theme.
- **square corners, 1px borders.** `border border-white/10..20`, no rounded
  corners (sole exception: `kbd`'s 3px keycap), no shadows for depth —
  hierarchy comes from borders and opacity.
- **lowercase copy** everywhere, with mono uppercase-tracked group labels
  (`font-mono text-[11px] uppercase tracking-[0.18em] text-white/40`) as the
  one deliberate contrast.
- **no ascii arrows** in copy or comments — use lucide icons.
- **ration colour.** only genuine severity spends it: `danger` red, `warn`
  amber. everything else stays monochrome — `toast`'s success variant earns
  its distinction from an icon, not a colour. if you're reaching for colour
  to convey emphasis, use the opacity ladder instead.
- **framework-agnostic.** plain `<a>` by default, no next.js imports.
  anything that navigates takes `linkComponent` (and `prefetch` where it
  helps); external `http(s)` hrefs always stay a plain `<a>`.

### engineering rules the whole registry follows

- **hydration safety.** anything with a clock starts `null` and fills in
  after mount — never seed state with `Date.now()`/`new Date()` during
  render. render a stable placeholder until the first tick. same for
  randomness: derive from an index (`sound-bars`), never `Math.random`.
- **`prefers-reduced-motion` is a considered choice, not a blanket off
  switch.** ask what the motion was carrying and keep that: `skeleton` stops
  the shimmer but keeps the block (it reserves layout), `sound-bars` holds
  resting heights (it means "this one is playing"), `live-badge` keeps the
  dot lit (live is information), `pencil-rule` renders the finished rule.
- **real semantics over styled divs.** `<dl>` for term/value, `<ol>` for a
  stepper, `role="switch"`, `role="radiogroup"` with a roving tabindex,
  `aria-current="page"`. match the aria-live level to severity — assertive
  for danger, polite for warn/success, silent for a plain note.
- **keyboard support is not optional.** a list of choices is one tab stop
  with arrow keys, not N tab stops. anything draggable needs a keyboard
  path or an explicit note that it hasn't got one.
- **controlled and callback-driven.** the component owns transient
  interaction state (a drag preview, a draft string, an open flag) and
  nothing else. no persistence, no transport, no fetching — the caller
  brings the data and the backend.
- **self-contained css.** keyframes ship inline as
  `<style precedence="default" href="…">` (react hoists and dedupes by
  href), not a globals.css edit. `range` is the one exception, and it needs
  a cli patch.
- **`className` merges via `cn` last**, so caller overrides win.
- **server-renderable when it can be.** don't add `"use client"` reflexively;
  `stat-tile` stays static markup and only pulls in a client component on
  the opt-in `animate` path.
- **explain the non-obvious in comments.** every component in this registry
  opens with a doc comment saying what it is *and what it is distinct from*,
  and annotates the decisions a reader would otherwise "fix": why drag depth
  is counted rather than flagged, why the notches are opaque circles rather
  than a mask, why an anchor is state rather than a ref. write those.

## 5. add it to the registry

for a component named `<name>`, create `packages/registry/<name>/`:

**`<name>.tsx`** — the component. cross-component imports use the canonical
specifiers `@/components/ui/<other>`, `@/hooks/<x>`, `@/lib/utils`; the cli
rewrites them to each project's aliases on install. never import by relative
path across components.

**`meta.ts`** — the contract. this drives the docs site, the props table,
and every downstream reader:

```ts
import { defineComponent } from "chrome-ui-registry-builder";

export default defineComponent({
  name: "<name>",
  type: "registry:ui",
  description:
    "one paragraph: what it is, and the sentence justifying why it isn't " +
    "an existing component. this is what people read first.",
  dependencies: ["lucide-react"],          // npm packages
  registryDependencies: ["utils", "badge"], // other registry components
  files: [
    { source: "<name>.tsx", target: "<name>.tsx" },
    // headless hook alongside a styled component:
    { source: "use-<name>.ts", target: "use-<name>.ts", type: "registry:hook" },
  ],
  props: [
    { name: "value", type: "string", required: true, description: "…" },
    { name: "size", type: "'sm' | 'md'", default: "'md'" },
  ],
});
```

every prop the component accepts belongs in `props`, with its real type and
default. `node tools/refs.mjs check` will catch you if a prop is missing or
a default disagrees.

**`demo.tsx`** — what the docs site renders. show the component doing its
actual job, not a lorem placeholder; the demo is the second thing people
read after the description.

**pure logic in its own module with tests** when there is any — `pagination`
ships `pagination-range.ts` + `pagination-range.test.ts`. extract anything
worth testing rather than burying it in the component.

## 6. wire it into the site

two files are edited by hand; the rest is generated.

**`apps/site/app/components/[name]/page.tsx`** — add an entry to the static
demo map. turbopack can't resolve a fully dynamic import path, so this map
is explicit and a missing entry means a 404 demo:

```ts
"<name>": () => import("../../../../../packages/registry/<name>/demo"),
```

**`apps/site/components/ui/<name>.ts`** — only if another registry component
imports yours via `@/components/ui/<name>`. it's a one-line bridge:

```ts
export * from "../../../../packages/registry/<name>/<name>";
```

then build and verify:

```bash
cd <registry repo>
bun run build:registry   # regenerates registry-manifest.ts + public/r/*.json
bun run typecheck
bun test
bun run dev              # check the component page renders and the demo works
```

`apps/site/registry-manifest.ts` and `apps/site/public/r/*.json` are
**auto-generated — never edit them by hand**; if they look wrong, fix
`meta.ts` and rebuild. the builder validates as it goes: duplicate component
names and imports that don't resolve to a declared dependency both fail the
build.

for a change to the cli or install behavior, `scripts/smoke.sh` runs the
whole thing end-to-end against a fresh next.js app.

## 7. close the loop on the docs

a component that exists but isn't documented is one an agent won't use. in
the same change:

- **`meta.ts` description and props** — done in section 5.
- **the `chrome.md` skill references** — add a section for the new component
  in the matching `references/*.md` file (this repo carries the same files;
  the canonical copy is the `chrome.md` skill beside it). follow the house
  shape: **Role / Install / Composes**, a few paragraphs of internals and
  gotchas, a `vs`-sibling paragraph, **Key props**, **Example**. then update
  the file table and picking-guide in that skill's `SKILL.md`.
- **verify**: `node tools/refs.mjs check` must report `no drift`.

```bash
node tools/refs.mjs scaffold <name>   # prints the skeleton with props filled in
node tools/refs.mjs check             # nonzero until the docs match the registry
```

the scaffold gives you the mechanical parts (install line, composes, the
full prop list from `meta.ts`). you write the narrative — the internals, the
gotcha that would otherwise cost someone an afternoon, and the sentence
saying when to reach for a sibling instead.

## 8. commit

one commit per coherent addition. the repo's commit style is a short
`feat(registry): …` subject and a body that explains *why* each component
exists and what non-obvious decision it makes — read
`git log packages/registry` for the pattern. do not push unless asked.

## checklist

- [ ] found the real registry repo on this machine
- [ ] confirmed the component doesn't already exist, and can state in one
      sentence why it isn't a prop on an existing one
- [ ] matches the design language: dark-only, square, lowercase, colour rationed
- [ ] hydration-safe; reduced-motion handled deliberately; real semantics;
      keyboard path
- [ ] `meta.ts` lists every prop with real types and defaults
- [ ] `demo.tsx` shows it doing its actual job
- [ ] site demo map entry added (and the `components/ui` bridge if needed)
- [ ] `bun run build:registry && bun run typecheck && bun test` all pass
- [ ] reference section written; `node tools/refs.mjs check` reports no drift
- [ ] if a consuming project needed it, installed back via `chrome add <name>`
