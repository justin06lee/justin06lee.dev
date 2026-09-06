# CLAUDE.md

## Project Overview
Personal site for justin06lee.dev. Three surfaces share one Next.js app:
1. **Public portfolio** — animated home (a first-visit intro that cross-fades into the page: see `home-client.tsx`), ASCII donut, scramble text, gallery, articles, a pet-the-cat page.
2. **Personal calendar / time tracker** — day/month/year views, plans + "actuals" with a one-running-per-track invariant (parallel activity lanes), plan/actual overlap heatmap, prayer-time markers.
3. **Two admin surfaces** — `/me` (item CRUD + site config) and `/desk/*` (article CMS that writes back to a GitHub repo).

Dark-only theme, minimal black/white aesthetic, motion-driven, ASCII flourishes. Lowercase voice everywhere.

## Commands
- `bun run dev` — Next dev server (Turbopack)
- `bun run build` — Production build. **It writes into the same `.next` the dev server reads** (Next 15.5 has no separate dev output dir), so a running `bun run dev` answers 500 on every page afterwards until it is restarted.
- `bun run start` — Start production server
- `bun run lint` — ESLint
- `bun run test` — Vitest run
- `bun run test:watch` — Vitest watch

## Tech Stack
- **Framework**: Next.js 15.5 (App Router), React 19, TypeScript 5
- **Bundler / package manager**: Turbopack, **Bun**
- **Styling**: Tailwind CSS 4 (no shadcn). Custom CSS vars in `globals.css`. **Poppins is the site's one typeface** — self-hosted in `public/` in four weights via `next/font/local` (`--font-poppins`, also `--font-sans`). Geist Mono (`font-mono`) survives only where the glyph grid is the point: ASCII art, the donut, code blocks, and the markdown editors. Don't put `font-mono` on UI text — labels, times, and section headings are Poppins (letterspaced uppercase where a label is wanted). The one exception in the nav is the `^cat^` wordmark: mono on purpose (ascii carets, leading to an ascii page), and `text-sm` so it sits at the links' size rather than the body's 16px. The other exception is the App Store (`.appstore`), set in the platform's own face (`-apple-system` stack) because it *is* the App Store; Poppins there looked wrong to its owner. There is no `@font-face` for Poppins in CSS on purpose; a second declaration for the same family once won over the local file and dropped the body to the system sans.
- **Animation**: `motion` v12 (`motion/react-client`) — staggered fade/slide patterns
- **Theme**: `next-themes`, dark mode forced
- **Database**: **Turso / libSQL** via `@libsql/client` (raw SQL, no ORM)
- **Markdown**: `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` + `rehype-slug`
- **Sanitization**: markdown is rendered with `react-markdown` + `skipHtml` (raw HTML is dropped, not sanitized); there is no `dangerouslySetInnerHTML` anywhere
- **Auth**: hand-rolled DB-backed sessions + httpOnly cookie + ADMIN_KEY env
- **Content source**: GitHub Contents API (read for articles, read+write for the operator/CMS)
- **Analytics**: `@vercel/analytics`
- **Tests**: Vitest (Node env)

## Project Structure
```
src/
  app/
    page.tsx, home-client.tsx     # Hero (intro animation, donut, scramble text, socials)
    layout.tsx, globals.css       # Root layout, Tailwind theme vars, keyframes
    not-found.tsx                 # 404 with random ASCII
    opengraph-image.tsx, twitter-image.tsx, robots.ts, sitemap.ts, manifest.ts

    gallery/                      # Tabbed grid (projects | hobbies | in-development)
    apps/[slug]/                  # App-store style product page per project
    articles/                     # GitHub-backed markdown articles
      [slug]/                     # Per-article view + parsed prerequisites
    cat/                          # Sprite-sheet petting + global pat counter
    calendar/                     # Personal calendar — see "Calendar" section
      day/[date], month/[yyyymm], year/[yyyy], categories/
    me/                           # Item + site-config CMS (admin)
      wall/                       # Free-form projects-wall editor (admin)
    desk/                         # Article CMS (admin) — writes to GitHub
      [slug]/, new-article/, content-actions.ts (server actions)
    oddjobs/                      # Placeholder

    api/
      auth/             # session login/logout
      config/           # site config (description, socials, pfp, prayerLocation)
      items/            # gallery item CRUD + /move
      uploads/          # binary uploads stored in Turso
      pats/             # global cat-pat counter (origin-gated)
      pats/, calendar/  # calendar tasks/actuals/categories/prayer-times CRUD
      geocode/reverse/  # reverse-geocode helper for prayer location detect
      desk/upload/      # admin image upload to GitHub
      articles/revalidate/

  components/
    Navbar.tsx, HomePage.tsx, AsciiDonut.tsx, PfpTile.tsx, Socials.tsx
    ItemGallery.tsx, GalleryTabs.tsx
    ArticleList.tsx, article/{markdown-renderer,table-of-contents,...}.tsx
    Dialog.tsx, Select.tsx, theme-provider.tsx
    gallery/                      # MangaPages, CrtMonitor (+crt-gl, crt-dial, crt-audio),
                                  # AppStoreList, ProjectWall, WallEditor
    calendar/                     # DayView, MonthView, YearView, CalendarShell,
                                  # PlanBlock, ActualBlock, ActualsEditor,
                                  # TaskEditor, NowPlayingBar, PlannedTodaySheet,
                                  # CategoriesManager, CategoryPicker, PrayerMarkers
    author/                       # OperatorArticleEditor, OperatorFileGrid,
                                  # OperatorDrawingWindow, OperatorLoginForm, ...

  lib/
    utils.ts                      # cn() = clsx + tailwind-merge
    db.ts                         # Turso client, schema bootstrap (initDb), migrations
    auth.ts, auth-server.ts       # session, rate limits, requireAdmin*()
    site-config.ts                # SiteConfig, getSiteConfig (cached), prayer location
    items.ts                      # gallery items query
    calendar.ts                   # tasks + actuals CRUD, overlap heatmap scoring
    calendar-categories.ts        # category CRUD + palette validation
    calendar-dates.ts             # tz-aware date helpers, intervals, heatmap buckets
    calendar-validate.ts          # API input validation + bounds
    calendar-constants.ts         # shared IDs (e.g. SLEEP_CATEGORY_ID)
    colors.ts                     # 8-color category palette + tint helpers
    prayer-times.ts               # Aladhan API client w/ 3-tier cache
    github.ts, github-paths.ts    # public article reader (Contents API)
    operator-content.ts           # admin: write articles/images back to GitHub
    article-draft.ts, article-sections.ts  # markdown parsing/serializing
    theme-images.ts
    app-store.ts, app-store-parse.ts  # store listing: README screenshots, releases, repo record
    project-images.ts, project-images-parse.ts  # hero image + site-icon resolution
    project-video.ts              # a project's CRT clip (assets/crt.mp4 in its repo)

scripts/
  retro-tv-audio.py               # pydub: make a clip sound like an old TV's speaker (used for CRT clips)
docs/
  crt-project-prompt.md           # the prompt that gets a new project onto the CRT (sprite + clip conventions)

public/
  crt/monitor.webp                # cut-out Macintosh Color Display bezel (transparent glass, apple cloned out)
  ascii/ascii{1,3,4,9}.txt        # responsive ASCII swap on small screens
  cat-sprite.jpg                  # 12x10 cat sprite sheet
  Poppins-{Regular,Medium,SemiBold,Bold}.ttf  # the site's typeface, self-hosted (OG images read Regular)
```

## Home intro
**Not on a phone.** Below `md` (`PHONE_QUERY` in `hooks/use-phone.ts`, the one definition both callers read) the home mounts straight into `home`: the intro was composed for a screen it could hold the middle of, and a phone gives it a fraction of that room while putting the page the visitor asked for eight seconds away. The nav's `intro` item goes with it below the same breakpoint — `leftLinks` only reach a phone inside the hamburger panel, which isn't rendered until opened, so resolving the query after mount costs nothing visible. `?intro=1` still strips itself there; it just doesn't play.

`home-client.tsx` runs the home in three phases: `intro` (chrome's `Intro` overlay alone, at `speed` 2.2 so each line holds about two seconds), `revealing` (begins on the overlay's `onExit`, the moment its fade starts — this is when the navbar and `HomePage` mount, so their entrances run *under* the fade and the two cross), and `home`. What this replaced mounted the page only after the fade had finished (a black beat, then a snap), slid the navbar in on a hard-coded 16-second timer, and remounted the whole tree at the end so the navbar entered twice. `HomePage`'s entrance is one two-second cascade (`ENTER`) from the donut to the socials; the socials used to mount with no entrance at all. The `onExit` hook was added to chrome's intro for this and lives in the registry.

Two things this sequencing exposed, both fixed where they belonged. **The donut must never be empty**: chrome's `Donut` leaves its `<pre>` blank until the bake lands (hundreds of ms), so the entrance faded in an empty box and the art popped to full opacity afterwards — it now paints frame 0 synchronously on mount and holds it until the bake catches up, so it is *still* before it spins rather than absent before it appears. And `useBreakpointScale` resolves the donut's grid before the first paint instead of one render later, which was baking a full-size donut and throwing it away. **The replay never navigates**: the nav's `intro` dispatches a `replay-intro` event when it is already on `/`, and arriving with `?intro=1` strips the param with `history.replaceState`. Routing to `/?intro=1` and back round-tripped this `force-dynamic` route through the server, and when that navigation finally committed, the page's `<Suspense fallback={null}>` swapped in — the whole tree unmounted and the entrance replayed, seconds after the intro had finished.

## Projects gallery
`/gallery?tab=projects` renders one of two hangs, chosen by the `wallMode` site-config key:
- **`auto`** (default) — projects are split into **themes** and each theme gets its own layout: `panels` → composed manga pages drifting across the screen as a band (`MangaPages` in band mode, inside chrome's `marquee`), `terminal` → one photographed CRT monitor (`CrtMonitor`), `icons` → an App Store clone (`AppStore`) with a product page per app at `/apps/[id]`.
- **`manual`** — the hand-arranged wall from `/me/wall` (`ProjectWall` + `lib/gallery-wall.ts`).

### Themes (`lib/gallery-themes.ts`)
Classification is a deliberate ladder of cheap heuristics, most explicit first: the item's `collection` column → the hero image's **filename** (`*-panel.*`, `icon.*`/`logo.*`, `*pixel*`/`*tui*`) → a hardcoded slug seed → aspect ratio. Lean on the filename rule going forward: rename the asset in the repo and the gallery re-sorts itself with no code change. The slug seed is a bandage for today's projects and rows can be deleted as repos are renamed.

### Manga pages (`lib/manga-layout.ts`)
The material is already-composed manga panels — someone framed each one — so the layout's hard constraint is **never re-crop**. An earlier fixed-slot template version violated this badly (`reze` lost 47% of itself); do not reintroduce any layout that picks a panel's shape before knowing the image's.

- **A page is a split tree, not a list of rows.** `pageShapes` enumerates a deliberately narrow grammar — a page is a stack of tiers, a tier is a run of frames across, a frame is sometimes a short column of stacked panels, and nothing nests deeper. That grammar *is* the vocabulary of a printed page; widening it is how the wall drifts back into arbitrary rectangles.
- **Every node's width is affine in its height (`w = m·h + c`, `c` in px carrying only gap terms).** Panel: `m = aspect, c = 0`. Row: `m = Σmᵢ, c = Σcᵢ + g(n-1)`. Stack: `m = 1/Σ(1/mᵢ), c = (Σ(cᵢ/mᵢ) - g(n-1))/Σ(1/mᵢ)`. Solving that top-down from the container width lands every panel on its own exact aspect — no crop, no dead space — at any width. **This is the load-bearing identity; changing a node type means re-deriving both terms.**
- **What varies to absorb the images is one of the page's two dimensions, never a panel's shape.** Down the page that is the height: a page is as tall as its panels require, and uniform page height was the thing given up, on purpose. In the band it is the mirror — every page shares the band's height and the *width* varies — which is the same affine family read from the other end, not a second layout.
- **Structure is chosen by scoring, not by rule.** Every template × a bounded set of panel assignments is solved and scored; the hard terms are the page-height band and a minimum panel edge (`minPanelSize`, 200px of the 1120 reference width — a *share* of the page, since the layout scales whole, so it holds on a phone too), and the soft ones are taste — a focal frame, a per-page drawn target height, a penalty on one flat tier of bare panels. Node geometry is invariant to the order of a node's children, so assignments are sampled rather than exhausted past n=4. ~2ms for a 12-panel wall. The edge floor is squared and weighted far above the taste terms — as a linear nudge it lost to them, and a ~130px sidecar next to a full-width band was routine — but stays finite, because a 5:1 strip sharing a tier puts the floor out of reach of every candidate and the least-bad page still has to win. **`referenceHeight` is what makes that floor true in the band**: scored against the 1120px page and then squeezed to the band height, a dense page lands well under the floor the packer thought it had cleared, so scoring measures at whichever dimension is actually fixed. The page's own aspect is the same number either way, so the height-band terms need no second form.
- **The wall drifts sideways as a band, not down the page.** Left to itself the wall grows a page taller with every project, until the CRT and the store below it are never reached. Passing `pageHeight` to `MangaPages` lays the pages *across* instead, every one at `STRIP_HEIGHT_CSS` (`min(78svh, 780px)`), inside chrome's `marquee` — so the hang is one page tall however many projects there are, and what a new project costs is a longer loop rather than more scrolling. The band carries the accessible name, so `MangaPages` inside it doesn't repeat it; the marquee's repeat copies are `aria-hidden` and `inert`, so the tab key is offered each panel once; it pauses under the pointer and on focus-within; and under reduced motion it becomes a plain horizontal scroller. `STRIP_HEIGHT` (780) and `STRIP_HEIGHT_CSS` are defined together in `manga-layout.ts` **because they have to agree** — the packer scores page structures for panels of a given size, and a browser drawing them at some other size makes that choice a lie. An earlier pass bounded the wall in a vertical scrolling window (chrome's `pane`) instead — the same problem solved by bounding rather than drifting.
- **Rendering is `width: calc(P% + Qpx)` per node plus `aspect-ratio` per panel.** Because the relation is affine, each child's width is affine in its parent's, so the browser reproduces the solve exactly — no measurement, no client JS, no first-paint reflow. A band page is sized by the same identity solved from the other end: `pageWidthCss` emits `calc(m * <height> + c px)`, and because the height stays a *CSS length* rather than a number, the band can be given in viewport units and resizes with the window without a re-solve. `min-width: 0` and `flex: none` are load-bearing: a flex item's automatic minimum size is its content's, which would let a wide image refuse its solved slot. Rows use `align-items: flex-start`, never `stretch` — stretch overrides `aspect-ratio` and crops.
- **The caption is a hover affordance with a pointer and a permanent one without.** A panel is a link, and on a pointer the cursor plus the name fading up on hover says so. A thumb gets neither, so below the hover breakpoint the bottom bar is simply always on and carries a small bordered arrow chip *beside* the name — pushed to the far edge it sat a thousand pixels from the thing it referred to on a full-width panel and read as decoration. The panel's border brightens to `white/30` there too, so the box reads as something you press rather than a picture that happens to be framed. The media query is `@media (hover:hover) and (min-width:768px)`, the exact complement of the CRT's `TOUCH_QUERY`, so the page's two touch affordances appear together — and it tests `hover`, not width alone, because a tablet is wide and still has no pointer. Note Tailwind v4 already wraps `hover:` in `@media (hover:hover)`, which is why the old caption never appeared on a phone at all. A panel with no art keeps no caption: there the box is already nothing but its title.
- **Panels are `object-contain`, not `object-cover`.** The box is already the image's exact aspect, so the two agree when the measured dimensions are right — but when a measurement is stale or unreadable, contain shows a sliver of black and cover silently eats the art. Only one of those is recoverable.
- Pages keep the tight 8px seam inside and a 48px black gutter between — and the marquee is given that same 48px between repeats, so the seam where the band loops reads as another page turn rather than as a join. Page splitting happens before layout, so it can never strand a single panel.
- **A fresh seed per request is the point.** The gallery re-deals every load, so a newly added project lands anywhere rather than always at the bottom. `?seed=N` pins one for comparison.

### CRT monitor (`components/gallery/CrtMonitor.tsx`, `crt-gl.ts`, `crt-dial.ts`)
The terminal pieces play on a photograph of an Apple Macintosh Color Display (`public/crt/monitor.webp`, 1200x991, a cut-out with a transparent hole where the glass was; the apple on the bezel was cloned out). The glass is a WebGL canvas **behind** the photo: the photo's alpha does the masking, so the shader never knows the hole's shape. Positions in the component are shares of the photo, measured off its alpha channel — the hole spans x 14.9–87.4%, y 17.2–82.4% and tapers toward the bottom; the two controls sit at the ends of the bezel's bottom band (which runs x 9.4–92.4%), the knob at x 19.6% and the power button on the LED slot at x 82.1%, both at y 91.8%. Nothing is printed on the bezel and nothing is written on the glass; the picture is the label, and the knob's `aria-valuetext` carries the name for assistive tech. Re-cutting the photo means re-measuring those numbers.
- **The controls are short cylinders turned to the band, not circles laid on it.** Each is a cap over a stack of nine discs a `--step` apart inside a `preserve-3d` element (`.crt-cyl`) whose `--tilt` is a 2D rotate by the band's ~6° slope there, then `perspective()` and a turn. The camera stood above the set and in front of its middle, so the side that shows is the top of the wall and the edge facing the middle: the left of the power button, the right of the knob. `rotateX` is *negative* on purpose — the camera is above, so a vertical face's top edge is its near edge and the discs behind the cap peek out above it; positive read as a button seen from below, which is what looked pasted on. The 3D lives on the inner element so the control's own box stays the plain circle the pointer maths measure, and the centring stays in the `translate` property. Pressing the power sinks its cap along `--step`.
- **The picture fills the glass.** `pictureSpan` covers the canvas, stretching the picture off its own aspect by up to 15% on the long axis and cropping the rest evenly, so none of the picture's own background is left showing beside black. With the barrel and the keystone, overscan 1.0 already covers every pixel of the hole — checked numerically against the alpha channel; re-check if the curve, the keystone, or the `SCREEN` box changes.
- **The glass has two sources, and they dissolve.** `uTex` is the project's picture and `uTex2` the clip, on texture units 0 and 1 for the life of the renderer, and `setVideoMix(0..1)` says how much of the clip shows — 1 the clip alone, 0 the picture alone, between them a dissolve. Each source carries its own `uSpan`, or the one being crossed to would re-frame itself on the way. The dissolve happens *at the source*, before the roll, the snow, the bars, the grille and the scanlines: a tube showing a dissolve is still one tube. The two ends branch on the uniform so the steady states stay at three texture fetches rather than six, and the clip stops being uploaded at all once it is fully dissolved away (it plays on; its next visible frame is uploaded then). The room's colour is a `mixTint` of the two in the same proportion — the light and what throws it can't disagree.
- **`destroy()` must not call `loseContext()`.** It reads as the tidy thing, but a lost context stays bound to its canvas and `getContext` on that canvas afterwards hands back the same lost one, on which `createShader` quietly returns null. React gives the same canvas node to a new renderer routinely (double-invoked effects in development, and any remount that reconciles rather than replaces), so the set fell through to its flat fallback for the rest of the session after a gallery tab switch and back. `createCrtRenderer` now also logs the driver's compile and link logs in development, because a silent fallback is exactly the failure you can't debug.
- **The shader (`crt-gl.ts`) is the effect, not CSS.** Barrel curvature, a keystone (the set was shot slightly from above, so the raster is wider at the top), aperture grille, scanlines, rolling bar, coarse and fine grain, mains flicker, chromatic fringing, two faults (the vertical hold slipping so the picture rolls every ~11s, horizontal sync tearing a band sideways every ~5s), and three states the cabinet drives per frame: grey off-station static (`snow`), colour bars torn sideways (`glitch`), and inverted colours (`invert`).
- **The knob is a rotary channel selector that turns all the way round.** `crt-dial.ts` is pure: one detent per channel spread over 360°, so the last channel clicks on to the first in either direction. The knob's angle is one unbounded number of degrees and the channel is read off it (`channelAt`); nothing else stores which channel is on. Dragging follows the pointer one to one (`pointerTurn`: the centre is measured once at pointerdown from the untransformed box, a dead zone of 28% of the radius round the centre turns nothing, and one sample may turn at most 40° — a pointer crossing the middle otherwise read as half a turn and spun the knob) and shows static between detents (`staticAmount`: the picture holds for 22% of a step either side of a detent, then static ramps in over a few degrees), flipping to the next project past each midpoint — clockwise is next, anticlockwise previous. **During a drag the cap turns by a style write, not a render**: state only follows when the channel or the static would change, so a 120Hz pointer doesn't re-render the set. Release snaps to the nearest detent (a firm 220ms, no overshoot); a press that travels under 6° is a click and steps one clockwise from where it started; arrow keys step once it has focus; the wheel steps a detent per 80px (`wheelDetents`, attached non-passive so rolling the dial doesn't scroll the page). It is a `role="slider"`.
- **The set is heard through `crt-audio.ts`.** `createSpeaker` is a Web Audio graph built at mount and woken (`wake`) on every pointerdown or keydown — the same gesture that unmutes a clip that had to start silent — so a page the browser already trusts is heard at once and one that insists on a gesture is heard from the first click; a `glitch()` fired while the context is suspended is dropped, not queued (a burst arriving with the first click, out of nowhere, was worse than none). The clip ducks to 30% for 320ms under each glitch so the burst is what is heard. The graph: a looping noise buffer through a band-pass at the speaker's 2.4 kHz whose gain follows the static on the glass (`setStatic`, fed from the draw loop and scaled by the power ramp, so switch-on and a channel change hiss and switching off fades it), and `glitch()`, a quarter-second burst of the same noise with its band swept from 3.8 kHz down to 600 Hz plus a square-wave thump, fired with every kick of the set. **The sound comes from the set, not the page**: on scroll and resize the component measures how far the set's middle is from the viewport's middle and sets a level — full within a quarter of the viewport's height, then falling over the next half a height to nothing — on the speaker's master gain and the clip's `volume`. Short on purpose: the store is the last hang, so at the foot of the page the set is barely a viewport away, and that has to be silence. The clip keeps playing at level 0; only the sound stops.
- **A channel plays its repo's clip.** `lib/project-video.ts` asks the Contents API for `assets/crt.mp4` in the project's repo (a fixed path, not a README ref — a README can't embed a repo-relative video, and a convention is what lets a new project be picked up by dropping one file in place; `docs/crt-project-prompt.md` is the prompt that produces it, and `scripts/retro-tv-audio.py` gives the sound the set's speaker: 300 Hz–4.8 kHz, a 5 dB boxy lift, tanh drive into an 8-bit crush, hiss, crackle and a 120 Hz hum, the last two kept well under the clip). The clip is a hidden `<video crossOrigin>` re-uploaded as a texture every frame it changes (`setVideoFrame` / `showVideo`), so switching between clip and picture is a bind, not a reload. When it ends the knob steps on to the next channel by itself. **Sound needs a gesture**: `playVideo` tries with sound, and on refusal plays muted and unmutes on the first pointerdown or keydown anywhere on the page. Power off pauses it; reduced motion never plays it (the channel is its picture); the room tint is re-read from the clip every 400ms. The CSP's `media-src` allows raw.githubusercontent.com for it. No WebGL → the `<video>` element itself is the fallback's picture layer.
- **A touch screen gets the picture by scrolling, and a button that says the set is a link.** There is no hover under a thumb, so nothing tells a reader the glass opens the project and nothing brings the picture up. Under `TOUCH_QUERY` (`(hover: none), (max-width: 767px)` — the width term so a desktop window pulled to a phone's size shows the same thing rather than looking broken) the same scroll measurement that sets the volume also drives the dissolve: the clip becomes the project's picture as the set comes to the middle of the view and goes back to the clip as it leaves, with a hold at the middle (`PICTURE_HOLD`) wide enough to read the picture in and a smoothstep either side (`DISSOLVE_SPAN`). It moves on scroll frames, so it lives in a ref and the draw loop applies it — none of it is a render. Under the cabinet, standing in the pool of light, is an `open` button: absolute over that pool rather than in flow, because the room below is sized for the light and a button in flow would push the store down on every screen. It is the one uppercase control on the site, on purpose — a label on a piece of hardware.
- **Hovering the glass kicks the set**: ~260ms of colour bars sheared by band and a 340ms shake of the whole cabinet (CSS). On a channel with a clip the glass then shows the project's picture, as shot, and leaving kicks it again and brings the clip back — the clip never pauses for a hover, it plays on behind the picture, sound and all. On a channel with no clip there is only the picture, so hover shows it inverted and leaving simply restores the colours. Mouse pointers only (a tap is the click, and the scroll dissolve above is what a touch screen gets instead), and only while the set is on. The glass stays a real `<a>` to the project (middle-click, open-in-new-tab work); when the set is off it is a button that switches it on.
- **The set lights the room.** `loadPicture` returns a luminance-weighted `tint` of the picture; the component lifts it toward white into `--crt-glow`, which colours a glow behind the cabinet (`.crt-room`), light on the plastic (`.crt-bezel-light`, masked with the photo itself so it never spills into the hole), and a pool on the floor in front (`.crt-floor`). There is no contact shadow under the foot: the set stands in its own light, and a dark band there read as a gap under a floating cabinet. Static throws grey, the inverted picture throws the inverted tint, and switching off fades it all (`--crt-lit`). The pool is a lobe centred on the set's foot, faded in with a mask over the set's lower quarter so it meets the wall's glow without a seam — a lobe that began at the band drew a hard horizontal line either side of the set. The room below it is a `pt-[22%]` spacer *inside* the stage: a percentage padding resolves against the containing block's width, and on the stage itself that was the section, which reserved three times the pool's height and pushed the store away. 22% is the pool's *visible* depth (its box runs deeper, but the last of it is a tail on black), sized so the dark between the pool and the store matches the dark between the label and the set (the set carries `mt-12` from the page for that: the label's own `mb-4` left it crowding the cabinet). The set is small on purpose (`max-w-[480px]`): a little lit screen in a dark room, not a hero.
- **Smoothness is designed in, not hoped for.** The three room lights are painted at a quarter (the plastic at half) of their size and `transform: scale()`d up by the compositor: they are soft gradients, so the upscale is invisible, and a colour change — every clip sample, eased over 700ms — repaints a few thousand pixels instead of the two megapixels the full-size room light was. The room's colour is written to `--crt-glow` on the stage by `applyGlow` from the draw loop, never through React state (a re-render every sample re-diffed the whole set for one property; `useLayoutEffect` applies it before first paint). The tube's render scale starts at the device pixel ratio (capped at 2) and drops by a quarter, down to 0.75, whenever the smoothed frame time exceeds 24ms for a couple of seconds — scanlines and grain read the same a little soft, a dropped frame reads as a broken set. The clip is re-uploaded only on a new frame, the tint sampled every 600ms, the speaker's static gain only written when it changes, and the knob turns by style writes.
- **The render loop runs only while the set is on, on screen, and something is changing.** Under `prefers-reduced-motion` it draws one still frame per state (no roll, tear, flicker, glitch, shake, or collapse; static and inversion still show). No WebGL → a flat `<img>` with CSS scanlines, grain for the static, and `filter: invert` on hover.
- **Pictures are rasterised through a 2D canvas before upload (`loadPicture`).** SVGs are fetched as text and drawn at the size the glass wants, since a sizeless SVG reports 300x150 to an `<img>` and uploaded as a blur. An SVG that animates (CSS `animation` or SMIL — the bmo and alpaca sprites bob their letters) is sampled into up to 30 frames at 10fps: drawing an `<img>` to a canvas always renders time zero of its animations, so each frame is the same document with every delay and `begin` shifted back by that frame's time (`shiftAnimations`, pure and tested), and the shader swaps textures by the clock. One texture per frame, never an atlas — thirty frames stacked outgrow the guaranteed texture size on phones. Reduced motion takes one frame; a fetch that fails (no CORS, blocked by the CSP) falls back to the plain image path. Cross-origin images need CORS; GitHub raw sends it.

### App store (`lib/app-store.ts`, `components/gallery/AppStoreList.tsx`, `app/apps/[slug]`)
**This is the one surface that is deliberately not in the site's design language.** It is styled as the App Store — continuous-corner squircle icons via a CSS mask, grey pills with blue capitals, hairlines inset to the text, `#8e8e93` secondary text, `#0a84ff` links, Title Case section names. Nothing here should pick up the site's uppercase letterspaced labels or 1px square borders, and nothing elsewhere should pick this up; the store's CSS is scoped under `.appstore`. It copies the type too: `.appstore` is set in the platform's system face (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto…`), the one surface on the site that isn't Poppins, because the real store is set in the platform's face and Poppins there read as a knock-off.

Everything the store shows past the item row is **read from the project's own repo** — screenshots are the README's non-icon images, "What's New" is GitHub releases (falling back to version tags without notes), the information block is the repository record. Nothing is stored twice: add a screenshot to the README or cut a release and the page follows.
- **One button, one word: OPEN.** It opens the site when the project has one and the source when it doesn't (`openTarget`); it never says which. Both are real anchors; the row's own link to `/apps/[id]` is a stretched overlay behind the text so nothing nests.
- A project whose only URL is a deployed site (no repo) gets its icon from the site's `apple-touch-icon` / largest `rel=icon` (`getSiteIcon`) — this is how `thehifzproject.com` stopped being a placard.
- `/apps/[id]` works for any project item, not just icon-theme ones; the store list only links the icon ones. Pure parsing (`readmeIntro`, `pickScreenshots`, `siteIconCandidates`, `platformsFor`) is in `app-store-parse.ts` and tested.

### Hero images (`lib/project-images.ts`)
`probeImage` keeps `exists` separate from `dims` on purpose: a **404 means try the next README candidate**, while a 200 whose bytes can't be measured is still a good image and is kept at a default aspect. Collapsing the two is what put broken frames on the wall — a renamed asset left the dead URL rendering anyway. `heroImageCandidates` returns *all* non-badge refs so that fall-through has somewhere to go.

`probeImage` fetches a **32KB byte range**, not the file: every format keeps its size in the header, and a whole-file read of a large screenshot inside the render overflowed the dev server's response stream (React serialises awaited values into its dev-only debug payload) and truncated the gallery on every cold start. A server that ignores `Range` answers 200 with the whole body and is measured the same way.

The measured dimensions are what *size the panel*, so a stale measurement mis-frames the art. Two things guard that: lookups are memoised with React `cache()` (per render pass) and never a module-level Map — a Map outlives the request and pinned `toji` at a dead 599x181 while GitHub served 1234x393, cropping 5% of it off — and the image probe shares the README's 1h revalidate window, because what is really cached there is the measurement, not the bytes.

Invariants worth knowing before changing the hand-arranged wall:
- **Positions are design units, not pixels.** Desktop is authored on a 1200-unit canvas, mobile on a 390-unit one (`DESIGN_WIDTH`), and the renderer scales by `containerWidth / DESIGN_WIDTH`. This is what makes the editor WYSIWYG — there is no reflow to diverge from, only a scale factor. Never store or compare these numbers as CSS pixels.
- **The two variants are independent layouts**, stored in separate columns (`items.wall_desktop` / `wall_mobile`). Editing one must never write the other; `ProjectWall` picks between them by *measured container width*, not by a media query.
- **`seedWall` is shared by the editor and the public page, and must stay that way.** It keeps stored boxes verbatim and packs anything unplaced into a block below the hang. If only the editor seeded, a project added since the last arrangement would silently vanish from the live gallery.
- **`wall_image` is rendered into a public `<img src>`**, so `PUT /api/items/wall` allowlists its scheme (site-relative or `http(s)` only). Keep that check if the field grows new write paths — `javascript:`/`data:` must stay rejected.
- **The wall crops (`object-cover`), the salon does not (`object-contain`).** Deliberate: on a hand-arranged wall the author sized the box, so the box is the intent; in the salon the image's aspect drives the box, so cropping would be a bug.
- Alignment snapping beats grid snapping per axis (lining up with a neighbour is more deliberate than landing on an arbitrary step). Resize snapping only anchors the edges the handle drives — snapping the fixed edge makes the box escape the cursor.
- `?wall=preview` force-renders the manual wall for an admin without publishing; the param is inert for everyone else.

## Calendar
Most substantial piece of recent work. Three primitives:
- **Plans** (`calendar_tasks`) — what was planned. Optionally timed, optionally "uncertain" with up to 16 `PlanFallback` alternatives (each with its own `categoryId`, `title`, `startTime`, `endTime`).
- **Actuals** (`calendar_actuals`) — what happened. Closed (start+end) or running (`end_at IS NULL`). Each sits on a `track` (lane): 0 is primary, 1..7 are activities running in parallel with it.
- **Categories** (`calendar_categories`) — palette-restricted (8 fixed hexes in `colors.ts`), with a built-in "Sleep" system row.

Invariants worth knowing before changing this code:
- **At most one running actual _per track_.** Enforced by partial UNIQUE index `idx_calendar_actuals_running_track ON calendar_actuals(track) WHERE end_at IS NULL`. App code does an optimistic check, then catches `SQLITE_CONSTRAINT_UNIQUE` to surface `concurrent-start` / `would-overlap-running` errors. Overlapping rows on *different* tracks are legal and expected — that is what parallel tracks are for — so any overlap check must be scoped to one lane (see `updateActual`).
- **`startActual` is atomic and lane-local** — stop-prior-on-this-track + insert-new in a single `db.batch`. It never touches other lanes; use `stopAllActuals` to end everything. An omitted `track` means lane 0, never "all lanes".
- **`getRunningActual` is a lossy view** now that lanes exist — it returns the lowest occupied lane for callers that can only render one timer. Use `getRunningActuals` anywhere that can show more than one, and `GET /api/calendar/actuals/running?all=1` for the array shape (the default response stays a bare `CalendarActual` for pre-parallel clients).
- **No FK enforcement at DB level** (libsql doesn't enable `PRAGMA foreign_keys`). `SET NULL` semantics are simulated in app code. Always validate `categoryId` / `planId` via `categoryExists` / `planExists` before insert/update.
- **Cross-midnight actuals** are anchored to their start date but clamped per visible day with `clampActualToDay`. Day queries fetch yesterday too so a block that crosses midnight still renders.
- **Heatmap match rule is asymmetric**: parent plan matches actuals by `category_id` only; each alternative matches by `(category_id, lowercased trimmed title)`. Fulfilled sub-intervals are unioned to avoid double-counting overlapping candidates.
- **DST-correct datetime-local round-trips**: `localInputToEpoch` does a two-pass offset correction; never use `new Date(s)` for `<input type="datetime-local">` values.

Prayer times come from the Aladhan API, fetched per month, with a three-tier cache (in-memory → `prayer_times_cache` table → API). Streamed in via `<Suspense>` so a slow API never blocks day-view render.

## Auth Model
- `ADMIN_KEY` env var is the master password. Compared via `timingSafeEqual`.
- `POST /api/auth` → `checkRateLimit` (10 attempts / 15min, 24h lockout) → mint UUID session, set httpOnly `admin_session` cookie.
- `sessions` table is DB-backed so logins survive serverless cold starts.
- **Route Handlers**: `requireAdmin(req)` returns a 401 NextResponse or null; `requireAdminWithMutationRate(req)` also enforces 200/min per-IP write throttle.
- **Server Components / Server Actions**: `isAdminServer()` / `requireAdminServer()` (uses `cookies()` from `next/headers`).
- `/api/pats` is the only public mutation — Origin-header gated, separate token-bucket rate limit, `delta` capped per-request.
- `/me` is in `robots.ts` `disallow`. `/desk/*` is metadata `noindex, nofollow`.

## Conventions
- Path alias `@/*` → `src/*`.
- Server components by default. `"use client"` only where needed.
- Content-heavy / dynamic routes: `export const dynamic = "force-dynamic"`.
- Tailwind classes composed via `cn()`.
- CSS vars (`--background`, `--foreground`, `--surface`, `--surface-alt`, `--border`, `--muted`, `--accent`) drive the dark theme. Both `:root` and `.dark` set them — always design against these tokens, not raw colors.
- Animations: `motion/react-client` with intentional staggered delays. Keep timings consistent with existing patterns when adding components.
- **Comments explain *why*, not *what*.** Concurrency races, DST quirks, FK simulation, asymmetric match rules — these warrant comments. Mechanical descriptions don't.
- Defensive JSON parsing throughout (`try/catch` returning a safe default for malformed columns).
- DB schema is bootstrapped by `initDb()` (memoized). Idempotent column additions via `ensureColumn` use a regex allowlist for identifiers (SQLite can't parameterize them).
- Admin endpoints gated by `requireAdmin*` middleware. User-authored markdown is rendered through `react-markdown` with `skipHtml` (raw HTML never reaches the DOM); uploaded images are served with a hardened `Content-Type` allowlist + `Content-Disposition: inline` + `default-src 'none'; sandbox` CSP.
- Security headers (CSP, X-Frame-Options DENY, Permissions-Policy, Referrer-Policy) configured in `next.config.ts`.
- No emojis in product copy or UI.

## Tests
Vitest, Node env, `tests/**/*.test.ts` and `src/**/*.test.ts`. Currently covers `calendar-dates`, `calendar-validate`, and `colors`. Add tests when touching calendar invariants or date math.
