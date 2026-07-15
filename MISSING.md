# MISSING — gaps found migrating justin06lee.dev onto the chrome registry

This file tracks components (or props) the site needed that the chrome registry
(`@justin06lee/chrome`) does not yet cover, or covers only partially. Each entry
notes what the site does today, why the existing chrome component can't express
it as-is, and a suggested addition to the library.

Where an entry says **(patched installed copy)**, the site's owned copy under
`src/components/chrome/` was edited to unblock the migration; the same change
should be upstreamed into the registry so a fresh `add` ships it.

---

## navbar — independent left/right link groups + ReactNode labels + mobile extras  (patched installed copy)

**Site need:** the top nav has links on *both* sides — a left cluster
(`justin06lee.dev`, an **intro** replay *button*, and a `^cat^` rainbow link) and
a right cluster (`calendar`, `articles`, `gallery`). On mobile, the slide-in panel
must list the union of both clusters. The `^cat^` link renders through `<Rainbow>`
(a ReactNode, not a string) and the intro control is a `<button>` (router push),
not an `<a href>`.

**Chrome today:** `Navbar` takes `brand` (left ReactNode), `links: {label: string,
href: string}[]` (right side + mobile panel), and `actions` (desktop-only right
extras). Labels are plain strings, there is only one link group, and the mobile
panel renders only `links` — so a left-side button/rainbow link can't appear in
the panel.

**Patched installed copy:** added an optional `mobilePanelExtras?: ReactNode` slot
to `src/components/chrome/navbar.tsx`, rendered above `links` inside the mobile
panel. The site passes the intro button + rainbow cat there.

**Suggested library addition:** either (a) allow `NavLink.label: ReactNode` and add
a `leftLinks` group that also flows into the mobile panel, or (b) formalize a
`mobilePanelExtras` slot. Option (a) is the more general fix.

---

## CLI / registry issues found during install (not component gaps, but worth fixing)

These are toolchain problems that had to be worked around by hand; they aren't
about a missing component but they blocked the migration.

1. **`lucide-react` pinned to `^1.24.0` dropped all brand icons.** `socials`
   imports `Github`, `Linkedin`, `Youtube`, `Instagram` from `lucide-react`, but
   1.24 removed brand glyphs — so chrome's own `socials` fails to compile against
   the version the CLI installs. Worked around by pinning `lucide-react` to
   `^0.540.0`. The registry should either pin a lucide version that still ships
   brand icons or inline the brand glyphs (as it already does for the X icon).

2. **Cross-component imports use a hard-coded `@/components/ui/` alias.** Every
   multi-part component (`gallery`, `desk`, `prose`, `manager-table`,
   `article-list`, `calendar-nav`, `editor`, `tag-input`, `image-cropper`,
   `login-form`, `not-found`, plus `use-line-sync`) imports its siblings from
   `@/components/ui/<name>`, ignoring the `components` alias in `chrome.json`
   (here `@/components/chrome`). The CLI should rewrite these to the configured
   alias on `add`. Worked around by rewriting all `@/components/ui/` →
   `@/components/chrome/` in the installed copies.

3. **Layout misdetection on later `add`s.** The first install landed files under
   `src/components/chrome/`, but a subsequent `add` wrote to `./components/chrome/`
   and `./lib/` at the repo root instead of `src/`. Worked around by moving the
   files into `src/` and deleting the root strays. The CLI's src-layout detection
   should be deterministic across runs.

---
