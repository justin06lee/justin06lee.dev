# media & playback

the audio/playback set: the cover art (`album-art` flat, `vinyl` spinning),
the controls (`transport`, `volume`), the two scrubbers (`playhead`,
`waveform`), the two meters (`sound-bars`, `spectrum`), the list and sheet
(`track-list`, `lyrics`), the listeners (`avatar-stack`), and the
running-activity bars (`now-playing-bar`, `lane-bar`).

several of these share one clock: `playhead` and `lyrics` both take
`position` + `startedAt` and extrapolate between polls, so a remotely-sourced
position moves smoothly instead of stepping. drive them from the same state.

one distinction runs through the group and is worth holding onto: **anything
that repaints every frame is canvas or text, anything with a fixed shape is
dom.** `spectrum` repaints continuously so it is canvas — forty dom nodes with
changing inline styles would mean forty style recalcs a frame. `waveform` is a
fixed shape whose only change is a fill ratio, so it gets to be dom elements and
wins crisp 1px edges, hover targets, and a css transition instead of a repaint
loop. `sound-bars` goes further still and is pure css with no state at all.

the bars and scrubbers are hydration-safe the same way the rest of the library
is: clocks start null and fill in after mount, and `sound-bars` derives each
bar's phase from its index rather than `Math.random`, so the server and client
never disagree.

## album-art

**Role:** square cover tile with a real fallback state.
**Install:** `bunx @justin06lee/chrome@latest add album-art`
**Composes:** lucide-react (npm); nothing beyond utils from the registry

a square cover image at one of six sizes (`full` fills its container), with an
optional `overlay` slot drawn on top (a play button, a hover scrim) and an
optional blurred `bleed` copy behind it that throws the cover's colour onto the
page.

**the fallback is the reason this exists as a component.** cover urls are the
least reliable part of any music api — expired cdn links, podcasts with no art,
local files — so `onError` swaps to a disc glyph and the tile **keeps its exact
footprint**. a placeholder that changes size shifts the whole layout, which is
what hand-rolled versions get wrong.

it renders a plain `<img>`, not a framework image component, so it works outside
next.js like everything else in the library — `loading="lazy"` and
`decoding="async"` are still applied. `alt` should describe the record, not the
picture. `onClick` renders the tile as a button and `href` as a link (through
`linkComponent` for internal routes).

`bleed` only really reads at `lg` and up, which is why it's off by default.

**Key props:**
- `src: string` — cover url; omit or let it fail and the fallback takes over.
- `alt: string = ''` — describe the record, not the picture.
- `size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'md'` — 'full' fills the container as a square.
- `bleed: boolean = false` — blurred copy of the art behind the tile; only reads at lg and up.
- `fallback: ReactNode` — node shown when there is no art.
- `onClick: () => void` — renders the tile as a button.
- `href: string` — renders the tile as a link.
- `linkComponent: React.ElementType` — anchor component for internal hrefs (e.g. next/link).
- `overlay: ReactNode` — drawn on top of the art — a play button, a hover scrim.
- `className: string`

**Example:**
```tsx
<AlbumArt src={track.coverUrl} alt={`${track.album} by ${track.artist}`} size="lg" bleed />
```

## lane-bar

**Role:** multi-lane sibling of now-playing-bar — several activities running in parallel.
**Install:** `bunx @justin06lee/chrome@latest add lane-bar`
**Composes:** nothing beyond utils

a pinned bar stacking one row per running activity, each with a title,
optional subtitle, a live elapsed timer, an optional accent dot, and its own
`actions` slot. same visual language and the **same elapsed format** as
`now-playing-bar` (`1h 2m` / `2m 3s` / `4s`) — this one just stacks. a lane
without `startedAt` reads as paused.

all lanes share **one** one-second interval rather than each owning theirs.
per-lane timers would drift apart visually — their seconds flipping at
different moments — and cost a render per lane per tick. the interval is alive
only while something is actually running, and `visible={false}` tears it down.

hydration-safe like the rest of the group: `now` is null until mounted, so
every lane renders a stable zero form through the server render and first
client paint.

use `now-playing-bar` for exactly one running thing, `lane-bar` when several
run at once (plan vs actual, several timers, a team view). `position="sticky"`
as the last child of a scroll container avoids the fixed-overlay padding
problem.

**Key props:**
- `lanes: Lane[]` — required — { id, title, subtitle?, startedAt?, accent?, actions? }[] — activities running in parallel, top to bottom. a lane without startedAt reads as paused.
- `onLaneClick: (id: string) => void` — click handler for a lane row; omit to make rows inert.
- `actions: ReactNode` — right-side slot on the header row, applying to every lane.
- `label: ReactNode = 'lanes'` — mono label on the header row; the lane count is appended.
- `emptyLabel: ReactNode = 'nothing running'` — copy shown when lanes is empty.
- `visible: boolean = true` — hide the bar and tear down the shared timer.
- `position: 'fixed' | 'sticky' = 'fixed'` — pin to the viewport or to the scroll container.
- `className: string`

**Example:**
```tsx
<LaneBar
  lanes={[
    { id: "a", title: "deep work — writing", startedAt: a, actions: <Button size="sm" onClick={() => stop("a")}>stop</Button> },
    { id: "b", title: "build watch", startedAt: b, accent: "#6ee7b7" },
  ]}
/>
```

## lyrics

**Role:** time-synced lyrics with the current line lit and the rest receding.
**Install:** `bunx @justin06lee/chrome@latest add lyrics`
**Composes:** playhead (registry)

a scroll box of `{ time?, text }` lines with the line whose timestamp has most
recently passed lit and the rest dimmed. it **shares `playhead`'s clock** — give
it `position` plus `startedAt` and lines advance on their own between polls,
rather than jumping once per update.

`parseLrc(text)` ships alongside for `.lrc` sheets and handles the two things
real lrc files do that a naive split doesn't: **several timestamps on one line**
(a repeated chorus) and metadata tags like `[ar:...]`, which are dropped rather
than rendered as lyrics. its output is sorted by time, because multi-timestamp
lines arrive out of order by construction.

omit `time` on every line and it degrades to a plain unsynced sheet — the same
component, no special-casing at the call site.

auto-scroll centres the active line but **stands down for eight seconds after
you scroll by hand**, so reading ahead doesn't fight the animation. `onSeek`
makes each line clickable, jumping to its timestamp.

**Key props:**
- `lines: LyricLine[]` — required — { time?: number; text: string }[] — time in seconds; omit it on every line for an unsynced sheet. parseLrc() builds these from .lrc.
- `position: number = 0` — last known playback position in seconds.
- `startedAt: number | Date` — wall-clock ms at which position was true — the line then advances on its own.
- `playing: boolean = true`
- `onSeek: (seconds: number) => void` — click a line to jump to its timestamp.
- `autoScroll: boolean = true` — scroll the active line into view.
- `height: number | 'auto' = 280` — height of the scroll box in px.
- `align: 'left' | 'center' = 'left'`
- `empty: ReactNode` — rendered when lines is empty.
- `className: string`

**Example:**
```tsx
<Lyrics
  lines={parseLrc(lrcText)}
  position={track.positionSec}
  startedAt={track.positionTakenAt}
  playing={playing}
  onSeek={seek}
  align="center"
/>
```

## now-playing-bar

**Role:** pinned bottom "now playing" bar for a running activity, with a live elapsed timer.
**Install:** `bunx @justin06lee/chrome@latest add now-playing-bar`
**Composes:** nothing beyond utils

a thin black bar pinned to the bottom edge (`fixed` to the viewport by default,
or `sticky` inside a scroll container via `position`). the left side is a button
(clickable only when `onClick` is set) stacking a tiny "NOW PLAYING" label, the
title line, and an optional subtitle. when `startedAt` is set the title line
shows the activity with a live elapsed timer appended (`1h 2m` / `2m 3s` /
`4s`, tabular-nums); omit `startedAt` for the idle state, which renders
"Nothing running" in muted text. `actions` is a right-side slot, typically a
stop button.

the timer ticks every second only while running and visible, and it is
hydration-safe: `now` starts as null and the elapsed string renders from
`startedAt` itself until the clock starts client-side. `visible={false}` returns
null and tears the interval down. `accent` adds a small colored dot before the
running title — the source bar has no accent, so omit it for the faithful look.
all data is props/callbacks; there is no built-in activity state.

when using `position="fixed"` (the default), remember it overlays page content —
give the page bottom padding, or use `position="sticky"` as the last child of an
`overflow-hidden`/scrolling container. use `lane-bar` when more than one
activity runs at once.

**Key props:**
- `title: ReactNode` — required
- `startedAt: number | Date` — when set, shows a live elapsed timer ticking every second; omit for the idle state.
- `accent: string` — optional css color for a small dot before the running title. omit for the source-faithful look.
- `subtitle: ReactNode`
- `actions: ReactNode` — right-side slot, e.g. a Stop button.
- `onClick: () => void`
- `visible: boolean = true` — hide the bar and tear down the timer.
- `position: 'fixed' | 'sticky' = 'fixed'`
- `className: string`

**Example:**
```tsx
<NowPlayingBar
  position="sticky"
  title="Deep work — writing"
  subtitle="focus session"
  startedAt={startedAt}
  actions={<Button size="sm" variant="outline" onClick={stop}>Stop</Button>}
/>
```

## playhead

**Role:** playback scrubber with elapsed / total times, drag-and-key seeking, and a clock of its own.
**Install:** `bunx @justin06lee/chrome@latest add playhead`
**Composes:** nothing beyond utils (also installs its own use-playback-clock.ts hook)

a proportional fill with elapsed and total labels, an optional fainter
`buffered` fill underneath, and optional seeking. `position` and `duration` are
in **seconds**.

two things separate it from `progress`. **it owns a clock**: give it `startedAt`
(the wall-clock ms at which `position` was true) and it extrapolates the
position between updates — the difference between a playhead that moves and one
that jumps once per poll, which is what you want for a remotely-sourced
position. `playing={false}` holds it. **and it is seekable**: passing `onSeek`
turns it into a real `role="slider"` with pointer drag, click, arrows (±5s),
page keys (±30s) and Home/End.

the fill transitions over exactly one tick interval, linearly, so the
interpolation lands precisely as the next tick arrives — a longer or eased
transition would visibly lag the true position. dragging drops the transition
entirely, because a scrubber that chases the cursor feels broken. preserve both
if you restyle it.

`remaining` counts the right-hand label down (`-1:23`) instead of showing the
total. pair with `now-playing-bar` for the surrounding bar and `sound-bars` (in
`references/effects.md`) for the playing indicator on a track row.

**Key props:**
- `position: number` — required — last known position in seconds.
- `duration: number` — required — track length in seconds.
- `startedAt: number | Date` — wall-clock ms at which position was true. supply it and the bar advances on its own between updates.
- `playing: boolean = true` — advance only while true.
- `buffered: number` — seconds buffered ahead, drawn as a fainter fill under the played one.
- `onSeek: (seconds: number) => void` — makes the bar seekable — click, drag, arrows (±5s), page keys (±30s), home/end.
- `size: 'sm' | 'md' = 'sm'` — track height.
- `showTimes: boolean = true`
- `remaining: boolean = false` — count the right label down (-1:23) instead of showing the total.
- `accent: string = '#fff'` — css color of the played portion.
- `ariaLabel: string = 'seek'`
- `className: string`

**Example:**
```tsx
<Playhead
  position={track.positionSec}
  duration={track.durationSec}
  startedAt={track.positionTakenAt}
  playing={track.playing}
  onSeek={(s) => seek(s)}
  remaining
/>
```

## sound-bars

**Role:** the little dancing meter that marks the row currently playing.
**Install:** `bunx @justin06lee/chrome@latest add sound-bars`
**Composes:** nothing beyond utils

`bars` (1–12, default 4) scaling on the y axis — no canvas, no state, no
javascript at all. each bar's period and phase are a **pure function of its
index**, never `Math.random`, so the pattern is identical across server render,
hydration and every remount; a random version would make the server and client
disagree and reshuffle itself on every mount.

the reduced-motion and `paused` behavior is a deliberate departure from "turn
the animation off": the bars **hold their resting heights** rather than
flattening. the meter is carrying the meaning "this is the one that's playing",
and a flat line would drop that meaning entirely. `label` is the same
information for anyone who can't see the bars — pass `label={null}` when an
adjacent "now playing" label already says it.

`accent` defaults to `currentColor`, so it inherits the row it sits in. pair it
with `playhead` and `now-playing-bar` (both in
`references/time-scheduling.md`).

**Key props:**
- `bars: number = 4` — how many bars (1–12).
- `paused: boolean = false` — freeze the bars low.
- `size: 'sm' | 'md' | 'lg' = 'md'`
- `accent: string = 'currentColor'` — css color of the bars; inherits the row it sits in by default.
- `speed: number = 1.1` — seconds for one full cycle of the slowest bar.
- `label: string | null = 'playing'` — screen-reader text; null when an adjacent label already says it.
- `className: string`

**Example:**
```tsx
<li className="flex items-center gap-2">
  {isCurrent && <SoundBars paused={!playing} label={null} />}
  <span>{track.title}</span>
</li>
```

## spectrum

**Role:** live frequency analyser off a web audio AnalyserNode (or any sample callback).
**Install:** `bunx @justin06lee/chrome@latest add spectrum`
**Composes:** nothing beyond utils

`bars` columns painted from a live audio signal. the normal path is `analyser`:
create an `AnalyserNode` once (`ctx.createAnalyser()`, wire your source into it)
and hand it over — the component only ever reads from it, never configures the
graph. `sample` is the escape hatch for anything that isn't a web audio graph:
return `bars` magnitudes in 0–1 per frame. `analyser` wins when both are given.

**canvas, not elements** — this repaints every frame, and 40 dom nodes with
changing inline styles would mean 40 style recalcs per frame. that's the
opposite trade from `waveform`, whose fixed shape never repaints and so gets to
be dom. keep that split in mind if you fork either.

columns are spaced **logarithmically**. a linear walk over the fft bins spends
about three quarters of its width on frequencies no instrument occupies, which
is why naive analysers look like they're only reacting on the far left.

the motion is shaped for readability rather than fidelity: **instant attack,
gradual decay** (`decay`, fall per frame, lower falls slower) so the bars read
as loudness instead of strobing. `peakHold` leaves a thin cap at each column's
recent maximum. `paused` stops reading and lets the columns settle to the floor
rather than freezing them mid-air.

**Key props:**
- `analyser: AnalyserNode` — web audio analyser to read; create it once and hand it over, the component only reads.
- `sample: (time: number) => number[]` — escape hatch for anything that isn't a web audio graph — return `bars` magnitudes in 0–1 per frame. ignored when analyser is set.
- `bars: number = 40` — column count.
- `height: number = 64`
- `barWidth: number = 6` — widest a column may get; columns flex to fill.
- `gap: number = 2`
- `accent: string = '#fff'`
- `mirror: boolean = false` — mirror the columns around the centre line.
- `decay: number = 0.12` — fall speed per frame, 0–1. lower falls slower.
- `peakHold: boolean = true` — hold a thin cap at each column's recent maximum.
- `paused: boolean = false` — stop reading and let the columns settle to the floor.
- `ariaLabel: string = 'audio spectrum'`
- `className: string`

**Example:**
```tsx
const analyser = useMemo(() => ctx.createAnalyser(), [ctx]);
<Spectrum analyser={analyser} paused={!playing} mirror />
```

## avatar-stack

**Role:** overlapping square tiles for "who else is here".
**Install:** `bunx @justin06lee/chrome@latest add avatar-stack`
**Composes:** tooltip (registry)

overlapping tiles from `people` (`{ id, name, src?, href? }[]`) — listeners,
collaborators, a room. tiles fall back to **initials** (never more than two
glyphs) when there's no image, show a name pill on hover *and keyboard focus*
via `tooltip`, and become links or buttons when given `href` / `onSelect`.

square, because the library is. the black hairline between tiles is a **ring on
each tile rather than a gap**, so the row stays tight and every tile still reads
as separate against a photo behind it.

**the overflow counter is the last tile, not a line of text after the row** — it
is the same kind of object as the faces it summarises. the prop that's easy to
miss: pass `total` when `people` is only the slice you fetched, and the counter
reports `total - shown` instead of `people.length - shown`. without it, a list
capped server-side silently under-reports the room.

vs `pfp` (in `references/effects.md`): pfp is the single 3d-tilt portrait; this
is the crowd.

**Key props:**
- `people: Person[]` — required — { id, name, src?, href? }[]
- `max: number = 5` — how many tiles before the overflow counter.
- `total: number` — true headcount when people is only a slice.
- `size: 'xs' | 'sm' | 'md' = 'sm'`
- `tooltip: boolean = true` — name pill on hover and keyboard focus.
- `onSelect: (person: Person) => void`
- `linkComponent: React.ElementType` — anchor component for internal hrefs (e.g. next/link).
- `ariaLabel: string` — screen-reader summary. defaults to 'N people'.
- `className: string`

**Example:**
```tsx
<AvatarStack people={listeners.slice(0, 5)} total={listenerCount} max={5} />
```

## track-list

**Role:** queue, history or tracklist — rows with the current one marked by a live meter.
**Install:** `bunx @justin06lee/chrome@latest add track-list`
**Composes:** sound-bars, album-art (registry); lucide-react (npm)

rows of title / artist / duration from `tracks`, with `activeId` marking the
current one. undefined durations render as an em dash rather than `0:00`.

**the meter replaces the row's number rather than sitting beside it.** keeping
both would push every row's text sideways by a few pixels the moment playback
moved, and a list that reflows while you read it is worse than one that loses a
number you can already infer. `playing` controls whether that meter animates.

each row is **one real control**: a link when it has an `href` (through
`linkComponent`), a button when you pass `onSelect`, and inert otherwise — so
keyboard and screen-reader behaviour follows from the data rather than from
extra role wiring.

`art` swaps the position number for an `album-art` thumbnail per row;
`numbered` is ignored when it's on.

vs siblings: `manager-table` is for *editing* records, `article-list` for
browsing cards. this is the read-and-pick case.

**Key props:**
- `tracks: Track[]` — required — { id, title, artist?, duration?, art?, href?, meta?, unavailable? }[] — duration in seconds.
- `activeId: string` — the current track; gets the meter in place of its index.
- `playing: boolean = true` — whether the active track is actually sounding.
- `onSelect: (track: Track) => void`
- `art: boolean = false` — show a cover thumbnail per row instead of a position number.
- `numbered: boolean = true` — number the rows; ignored when art is on.
- `linkComponent: React.ElementType` — anchor component for internal hrefs (e.g. next/link).
- `label: ReactNode` — mono uppercase caption above the list.
- `empty: ReactNode` — rendered in place of the rows when tracks is empty.
- `className: string`

**Example:**
```tsx
<TrackList
  label="up next"
  tracks={queue}
  activeId={current?.id}
  playing={playing}
  onSelect={(t) => play(t.id)}
  art
/>
```

## transport

**Role:** playback controls — skip, play/pause, shuffle and repeat.
**Install:** `bunx @justin06lee/chrome@latest add transport`
**Composes:** lucide-react (npm); nothing beyond utils from the registry

**every control appears only when you hand it a callback**, so one component
covers both a full player and a listen-only page with nothing but a play button.
`onPrevious`/`onNext` omitted means no skip buttons; `shuffle` needs
`onShuffleChange` alongside it to render, and `repeat` needs `onRepeatChange`.

the play/pause button is the solid one — the single filled element in a dark ui
reads as "this is the button", which is exactly right for the one that starts
the sound. shuffle and repeat render their state as a **lit glyph with an
underline dot rather than a colour**, since the library has no colour to spend
here.

`repeat` cycles `off → all → one` on a single button and announces the mode it
moves to, so a screen-reader user isn't left guessing which of three states a
press landed on. `loading` swaps a spinner in for the play glyph — for buffering
or waiting on a remote player.

pair with `playhead` or `waveform` for position, `now-playing-bar` for the
surrounding chrome.

**Key props:**
- `playing: boolean` — required
- `onPlayPause: () => void` — required
- `onPrevious: () => void` — omit and the button doesn't render.
- `onNext: () => void` — omit and the button doesn't render.
- `shuffle: boolean` — pass with onShuffleChange to show the toggle.
- `onShuffleChange: (next: boolean) => void`
- `repeat: 'off' | 'all' | 'one' = 'off'` — pass with onRepeatChange to show the toggle.
- `onRepeatChange: (next: RepeatMode) => void`
- `loading: boolean = false` — spinner in place of the play glyph — buffering, or waiting on a remote.
- `size: 'sm' | 'md' | 'lg' = 'md'`
- `disabled: boolean = false`
- `className: string`

**Example:**
```tsx
<Transport
  playing={playing}
  onPlayPause={toggle}
  onPrevious={prev}
  onNext={next}
  repeat={repeat}
  onRepeatChange={setRepeat}
  loading={buffering}
/>
```

## volume

**Role:** level-reflecting icon that mutes, plus a filled slider.
**Install:** `bunx @justin06lee/chrome@latest add volume`
**Composes:** lucide-react (npm); nothing beyond utils from the registry

a controlled level in **0–1** with an icon that changes with the value (and
becomes a mute toggle when you pass `muted` + `onMutedChange`) beside a filled
track.

`range` is the library's general-purpose slider — a bare thumb on a bare track,
right for "pick a number". volume is the specific case that needs more: the fill
has to show the level at a glance, muting has to be one click, and the icon has
to reflect the value. that's the whole justification for a separate component.

the behaviour worth relying on: **muting leaves `value` untouched** and only
draws the track dimmed, so unmuting restores exactly the level you had. don't
implement mute by setting the value to 0.

`collapsible` hides the track until the control is hovered or focused — for a
player bar where volume is secondary to everything beside it.

**Key props:**
- `value: number` — required — level, 0–1.
- `onChange: (value: number) => void` — required
- `muted: boolean = false` — pass with onMutedChange and the icon becomes a mute toggle.
- `onMutedChange: (muted: boolean) => void`
- `collapsible: boolean = false` — collapse the slider until the control is hovered or focused.
- `width: number = 80` — track width in px when open.
- `size: 'sm' | 'md' = 'md'`
- `disabled: boolean = false`
- `className: string`

**Example:**
```tsx
<Volume value={level} onChange={setLevel} muted={muted} onMutedChange={setMuted} collapsible />
```

## waveform

**Role:** a track's amplitude envelope with the played portion filled in, seekable by click.
**Install:** `bunx @justin06lee/chrome@latest add waveform`
**Composes:** nothing beyond utils

`peaks` is an array of amplitudes in 0–1, left to right, one per bar; `progress`
(0–1) fills the played portion. passing `onSeek` makes it seekable, called with
a 0–1 ratio. `mirror` reflects each bar around a centre line instead of standing
it on the floor.

**bars are elements, not a canvas.** at the few hundred bars a track needs that
costs nothing, and it buys crisp 1px edges at every dpr, real hover targets, and
a progress fill that is a css transition rather than a repaint loop.

the module exports `samplePeaks(pcm, count)` to build `peaks` from raw pcm. it
takes the **maximum absolute sample per bucket, not the mean** — a waveform
swings symmetrically about zero, so averaging trends toward zero and would
flatten every loud passage into the same grey band. peaks are normalized to the
loudest value so quiet masters still fill the frame.

`floor` keeps the shortest bar at a fraction of the tallest so silence still has
a spine rather than disappearing. `barWidth` is a maximum — bars flex to fill
the container up to it.

vs `playhead`: playhead is the thin scrubber that owns a clock and extrapolates
between polls; waveform is the static envelope of a known track, seekable but
with no clock of its own. drive it from the same position state.

**Key props:**
- `peaks: number[]` — required — peak amplitudes 0–1, left to right; one entry per bar. samplePeaks() builds these from pcm.
- `progress: number = 0` — how far through, 0–1.
- `onSeek: (ratio: number) => void` — makes the waveform seekable; ratio is 0–1.
- `height: number = 48` — height in px.
- `barWidth: number = 3` — widest a bar may get; bars flex to fill the container up to this.
- `gap: number = 2` — gap between bars in px.
- `mirror: boolean = false` — mirror each bar around the centre line instead of standing it on the floor.
- `accent: string = '#fff'` — css color of the played bars.
- `floor: number = 0.06` — shortest bar as a fraction of the tallest, so silence still has a spine.
- `ariaLabel: string = 'waveform'`
- `className: string`

**Example:**
```tsx
<Waveform
  peaks={samplePeaks(pcm, 240)}
  progress={position / duration}
  onSeek={(r) => seek(r * duration)}
  mirror
/>
```

## vinyl

**Role:** a record on a platter — grooves, a centre label, an optional tonearm.
**Install:** `bunx @justin06lee/chrome@latest add vinyl`
**Composes:** nothing beyond utils

a spinning record with `src` art in the centre label (`labelRatio` sets its
diameter as a fraction of the record) and an optional `arm` dropped onto it.

**round on purpose** — this is the one place in a square-cornered library where
curvature is right, because it's the object itself and not a corner radius.

two implementation choices worth keeping. the grooves are **one
`repeating-radial-gradient`, not a stack of rings**: a hundred bordered divs
would cost a hundred paints per frame while it turns. and the spin is a css
animation on a wrapper, so it composites on the gpu and the label art rides
along with no per-frame javascript.

`spinning={false}` sets `animation-play-state` rather than removing the
animation, which **leaves the record exactly where it stopped** — a needle that
jumps back to twelve o'clock on every pause looks broken. under reduced motion
it stops outright: the record is decoration, and decoration is the first thing
that should hold still.

pair with `album-art` when you want the flat cover tile instead, and
`sound-bars` for the playing indicator in a list.

**Key props:**
- `src: string` — art for the centre label; without it the label is a plain disc.
- `alt: string = ''`
- `size: number = 160` — diameter in px.
- `spinning: boolean = true`
- `period: number = 4` — seconds per revolution.
- `arm: boolean = false` — drop the tonearm onto the record.
- `labelRatio: number = 0.36` — label diameter as a fraction of the record.
- `className: string`

**Example:**
```tsx
<Vinyl src={track.coverUrl} alt={track.album} spinning={playing} arm size={220} />
```
