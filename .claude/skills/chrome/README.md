# chrome.md

the [claude code](https://claude.com/claude-code) skill for
[chrome](https://chrome.justin06lee.dev) — justin06lee's dark-only,
own-the-code react component registry.

it teaches an agent the entire library: what every component does, how it
works internally, every prop with its type and default, which components
compose which, and the design language the code has to follow.

for *building* new chrome components and upstreaming them into the registry,
see the companion skill [dev.chrome.md](../dev.chrome.md).

## install

with [bmo](https://github.com/justin06lee/bmo):

```bash
go install github.com/justin06lee/bmo@latest

bmo add justin06lee/chrome.md          # install globally
bmo add justin06lee/chrome.md here     # ...or just into this project
```

manage it the same way:

```bash
bmo inspect justin06lee/chrome.md   # preview before installing
bmo update chrome                   # pull the latest version
bmo remove chrome                   # uninstall
```

## layout

```
chrome.md/
├── SKILL.md                       # core: install workflow, design language, component map
├── tools/
│   └── refs.mjs                   # drift checker + section scaffolder
└── references/
    ├── primitives.md              # badge, button, field, input, switch, ...
    ├── overlays-nav.md            # dialog, menu, command-palette, sidebar, ...
    ├── feedback.md                # toast, callout, empty-state, skeleton, ...
    ├── effects.md                 # donut, chrome, scramble, blueprint, ...
    ├── content-data.md            # prose, gallery, stat-tile, sparkline, ...
    ├── time-scheduling.md         # calendar, timeline, slot-picker, timer-ring, ...
    ├── media.md                    # transport, playhead, waveform, track-list, ...
    └── editor.md                  # desk, editor, manager-table, ...
```

every reference section is written against the component source in the
registry, not from memory — role, internals, full prop list, canonical
example, gotchas.

## keeping it in sync

the registry is the moving target: it grows continuously, and prose written
by hand goes stale silently. `tools/refs.mjs` is the guard.

```bash
node tools/refs.mjs check           # audit docs against the registry, nonzero on drift
node tools/refs.mjs scaffold toast  # print a section skeleton for a component
node tools/refs.mjs list            # every registry component and the file documenting it
```

`check` reports five kinds of drift: components in the registry with no
reference section, sections for components that no longer exist, the same
component documented in two files, props present in `meta.ts` but missing
from the docs, and documented defaults that disagree with `meta.ts`. it
exits nonzero when any of those is non-empty, so it works as a pre-commit
or CI gate.

it finds the registry via `--registry <path>`, `$CHROME_REGISTRY`, or by
looking for `chrome.justin06lee.dev` beside this repo.

it is deliberately a **checker, not a generator**. the reference prose
carries things `meta.ts` doesn't — gotchas, vs-sibling guidance, props that
exist on the component but never made it into meta — and a generator would
flatten all of it. the tool tells you what drifted; a human or an agent
writes the words.
