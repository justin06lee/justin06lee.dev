# dev.chrome.md

the [claude code](https://claude.com/claude-code) skill for **building**
[chrome](https://chrome.justin06lee.dev) — the development counterpart to
[chrome.md](../chrome.md), which covers using it.

where `chrome.md` teaches an agent to pick and wire existing components,
this one teaches it to grow the registry: find the source repo on this
machine, tell a genuinely-new component apart from a prop on an existing
one, write to the registry's quality bar, and upstream the result into both
the registry and the docs site.

the rule it enforces:

> if a component exists, use it. if you need something that doesn't exist,
> build it properly and upstream it — don't leave a bespoke one-off behind.

that applies just as much when the work started in some other project. a
component that stays local is one the next project has to write again.

## install

with [bmo](https://github.com/justin06lee/bmo):

```bash
bmo add justin06lee/dev.chrome.md          # install globally
bmo add justin06lee/dev.chrome.md here     # ...or just into this project
```

install it alongside `chrome.md` — they're complementary. `chrome`
answers "which component do I use and how"; `dev-chrome` answers "this
doesn't exist yet, now what".

## layout

```
dev.chrome.md/
├── SKILL.md                       # find the repo, avoid duplicates, quality bar, upstream
├── tools/
│   └── refs.mjs                   # drift checker + section scaffolder
└── references/                    # the full component inventory (same as chrome.md)
    ├── primitives.md
    ├── overlays-nav.md
    ├── feedback.md
    ├── effects.md
    ├── content-data.md
    ├── time-scheduling.md
    ├── media.md
    └── editor.md
```

the references are carried here on purpose: **knowing what already exists is
the prerequisite for not duplicating it.** each section's `vs`-sibling
paragraph is the fastest way to answer "is this the thing I'm about to
build".

## keeping the inventory current

```bash
export CHROME_REGISTRY=<path to chrome.justin06lee.dev>/packages/registry

node tools/refs.mjs check           # what the references are missing, nonzero on drift
node tools/refs.mjs scaffold <name> # skeleton for a new component's section
node tools/refs.mjs list            # every registry component and where it's documented
```

adding a component to the registry without adding its reference section
leaves an agent unable to use it. `check` is what makes that failure loud —
run it as the last step of any registry change.

the `references/` here are a copy; **`chrome.md` holds the canonical set.**
write the new section there, then sync:

```bash
cp -R ../chrome.md/references/. references/
cp ../chrome.md/tools/refs.mjs tools/
```
