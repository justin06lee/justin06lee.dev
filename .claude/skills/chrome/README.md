# chrome.md

the [claude code](https://claude.com/claude-code) skill for
[chrome](https://chrome.justin06lee.dev) — justin06lee's dark-only,
own-the-code react component registry.

it teaches an agent the entire library: what every component does, how it
works internally, every prop with its type and default, which components
compose which, and the design language the code has to follow.

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
└── references/
    ├── primitives.md              # badge, button, card, checkbox, ...
    ├── overlays-nav.md            # dialog, menu, command-palette, sidebar, ...
    ├── effects.md                 # donut, chrome, scramble, intro, ...
    ├── content-data.md            # prose, gallery, calendar, timeline, ...
    └── editor.md                  # desk, editor, manager-table, ...
```

every reference section is generated against the component source in the
registry, not from memory — role, internals, full prop list, canonical
example, gotchas.
