# time, dates & scheduling

everything that renders or edits time: the date views (`calendar`, `heatmap`,
`date-strip`, `timeline`) and the header that pages them (`calendar-nav`), the
booking flow (`slot-picker`, `availability-grid`, `add-to-calendar`), and the
work/rest set (`timer-ring`, `break-overlay`, `clock`, `interval-picker`).

the running-activity bars (`now-playing-bar`, `lane-bar`) live in
`references/media.md` with the rest of the playback set.

two conventions hold across the whole group. **dates are plain strings** —
months are `"YYYY-MM"`, days are `"YYYY-MM-DD"`, and grids are built with
`Date.UTC`, so there is no timezone drift and no `Date` object crosses a prop
boundary; `calendar`, `heatmap` and `date-strip` can share one keyed record.
**times within a day are minutes past midnight** on a 0–1440 axis, which is
what `timeline` and `availability-grid` both speak.

anything with a live clock is hydration-safe the same way: the clock state
starts `null` and fills in after mount, because seeding it with `Date.now()`
during render would make the server and the client disagree. until the first
tick lands, each component renders a stable placeholder form.

## add-to-calendar

**Role:** "add to calendar" for a confirmed booking — web targets as links plus a generated .ics.
**Install:** `bunx @justin06lee/chrome@latest add add-to-calendar`
**Composes:** lucide-react (npm); nothing beyond utils from the registry

renders either a menu (default) or an inline row of buttons offering google,
outlook, office 365 and yahoo as plain urls, plus an `.ics` download for
everything else (apple calendar, thunderbird, anything corporate).

the ics is **built in the component**, not fetched — rfc 5545 folding to 75
octets (without splitting a multi-byte character) and property escaping
included — so the component works with no backend at all. the module exports
`buildIcs(event, now?)` and `calendarUrl(event, target)` if you want the
strings without the ui.

`icsHref` overrides the generated blob with your own route. reach for it once
an invite has actually been emailed: the `UID` and `SEQUENCE` in the download
have to match the invite, or the guest's calendar creates a duplicate event
instead of updating the existing one. that is the one case where generating
client-side is wrong.

implementation note worth keeping if you edit the installed copy: the blob url
is revoked on the *next frame* after the click, not synchronously — revoking
immediately can beat the download in some browsers and produce an empty file.

`event.start`/`event.end` are **epoch ms**, not strings — the one place in this
group that isn't a date string, because an ics needs an absolute instant.

**Key props:**
- `event: CalendarEventInput` — required — { title, start, end, description?, location?, url?, uid? } — start/end are epoch ms.
- `targets: CalendarTarget[] = ['google', 'outlook', 'office', 'ics']` — which destinations to offer, in order. 'yahoo' is also available.
- `icsHref: string` — serve the .ics from your own route instead of the generated blob — use it once an invite has been emailed and the uid has to match.
- `filename: string = 'invite.ics'`
- `label: ReactNode = 'add to calendar'`
- `variant: 'menu' | 'inline' = 'menu'` — 'inline' lays the targets out as a row of buttons.
- `className: string`

**Example:**
```tsx
<AddToCalendar
  event={{
    title: "intro call — justin",
    start: Date.parse("2026-08-12T16:00:00Z"),
    end: Date.parse("2026-08-12T16:30:00Z"),
    location: "https://meet.example.com/abc",
  }}
/>
```

## availability-grid

**Role:** the weekly "when am i free" editor — a switch per day plus any number of time windows.
**Install:** `bunx @justin06lee/chrome@latest add availability-grid`
**Composes:** lucide-react (npm); nothing beyond utils from the registry

one row per weekday: a switch that opens or closes the day, and under it zero
or more `{ startMin, endMin }` windows with time inputs, an add button, and a
copy-to-open-days action for the common "same hours every weekday" shape. fully
controlled — `value` is a flat `AvailabilityRange[]` of
`{ weekday (0 = sunday), startMin, endMin }`.

two design decisions to preserve if you edit it. **turning a day off keeps
nothing** — an empty day and a day with no ranges are the same state, so there
is no hidden draft to resurrect and surprise someone later. and **invalid
ranges are flagged, never corrected**: an end before its start, or two windows
that overlap on the same day, are called out inline and left exactly as typed.
silently rewriting someone's input is how you ship a schedule they didn't ask
for.

that means the component can hold invalid state by design, so gate your save
button on the exported `isAvailabilityValid(ranges)` rather than assuming
`onChange` only emits good data.

adding a second window starts it an hour after the previous one ends, so the
usual "morning, then afternoon" shape needs no dragging. `weekOrder` defaults
to monday-first even though `weekday` is sunday-indexed.

**Key props:**
- `value: AvailabilityRange[]` — required — { weekday (0=sunday), startMin, endMin } in minutes past midnight.
- `onChange: (ranges: AvailabilityRange[]) => void` — required
- `dayLabels: string[] = ['sunday', …, 'saturday']` — index-aligned to weekday.
- `weekOrder: number[] = [1,2,3,4,5,6,0]` — row order; defaults to monday-first.
- `defaultRange: { startMin: number; endMin: number } = { 540, 1020 }` — window added when a closed day is switched on.
- `stepMin: number = 15` — granularity of the time inputs.
- `disabled: boolean = false`
- `className: string`

**Example:**
```tsx
const [hours, setHours] = useState<AvailabilityRange[]>([
  { weekday: 1, startMin: 540, endMin: 1020 },
]);

<AvailabilityGrid value={hours} onChange={setHours} />
<Button disabled={!isAvailabilityValid(hours)} onClick={save}>save hours</Button>
```

## break-overlay

**Role:** full-screen rest overlay with a live countdown and resume / extend / skip.
**Install:** `bunx @justin06lee/chrome@latest add break-overlay`
**Composes:** motion, lucide-react (npm); nothing beyond utils from the registry

a full-screen black overlay with a small mono label, a heading, a large live
countdown (`12:34`, widening to `1:02:03` past the hour), an optional message,
and up to three actions. it traps focus and locks scroll like the other modal
surfaces.

**by default it is not escapable** — `dismissible` is false, because the entire
point of a forced break is that it should be mildly inconvenient to wave away.
turn it on when the break is advisory; escape then resolves as resume.

the deadline is component state rather than a prop derivative, for two reasons
you'll hit immediately: `onExtend` moves the overlay's own deadline as well as
telling you, and a `seconds` break has no anchor until the overlay actually
opens. pass `endsAt` instead of `seconds` when the break is persisted
somewhere and has to survive a remount at the right offset — `endsAt` wins when
both are given.

each of `onResume`, `onSkip` and `onExtend` renders its button only when
provided, so an overlay with none is a pure countdown you dismiss
programmatically. `onComplete` fires exactly once, when the countdown reaches
zero on its own. `anchor="container"` covers the nearest positioned ancestor
instead of the viewport, for embedding the rest screen in a panel.

pair with `timer-ring` for the work interval and `interval-picker` for
configuring the cadence.

**Key props:**
- `open: boolean` — required — whether the rest screen is showing.
- `endsAt: number | Date` — absolute end of the break; wins over seconds. use it when the break is persisted and must survive a remount at the right offset.
- `seconds: number` — break length in seconds, counted from the moment it opens.
- `title: string = 'break time'` — heading above the countdown.
- `message: ReactNode` — optional line under the countdown — what to actually do with the break.
- `label: string = 'break'` — small mono label above the heading.
- `onResume: () => void` — user ended the break early. also fires on escape when dismissible. omit to hide the button.
- `onSkip: () => void` — user skipped the break outright. omit to hide the button.
- `onExtend: (seconds: number) => void` — user extended the break; receives the added seconds. the overlay moves its own deadline too. omit to hide the button.
- `extendBy: number = 300` — how much extend adds, in seconds.
- `onComplete: () => void` — fires once, when the countdown reaches zero on its own.
- `dismissible: boolean = false` — allow escape to close the overlay, resolving as resume. off by default — a forced break should be mildly inconvenient to dismiss.
- `anchor: 'viewport' | 'container' = 'viewport'` — 'viewport' covers the window and locks body scroll; 'container' covers the nearest positioned ancestor instead.
- `className: string` — extra classes for the overlay.

**Example:**
```tsx
<BreakOverlay
  open={onBreak}
  endsAt={breakEndsAt}
  message="stand up. look at something far away."
  onResume={() => setOnBreak(false)}
  onExtend={(s) => setBreakEndsAt((t) => t + s * 1000)}
  onComplete={() => setOnBreak(false)}
/>
```

## calendar

**Role:** interactive single-month date grid with selectable days and a today ring.
**Install:** `bunx @justin06lee/chrome@latest add calendar`
**Composes:** lucide-react (npm, header chevrons); nothing beyond utils from the registry

renders a prev/next header (month name + year in mono uppercase, lucide chevron
arrows) over a sunday-aligned 7-column grid of day buttons. `showHeader={false}`
drops the built-in header — use it when an external nav (`calendar-nav`) already
pages the month, so the two don't double up. all dates are plain strings and the
grid is built with `Date.UTC`, so there is no timezone drift. fully controlled:
`month`/`onMonthChange` drive paging (the arrows are disabled when
`onMonthChange` is absent), `selected`/`onSelect` drive selection. the selected
day inverts to white-on-black; `today` gets an inset ring.

`renderDay` lets you layer extra content under each day number — task dots,
counts — without forking the component. `renderCell` goes further: it replaces
the whole cell (day number included) with your own layout, for agenda-style
month grids. it receives a `CalendarDay` — `{ date, day, isToday, isSelected }`
— and drops the compact `size-9` picker styling: cells stay `<button>`s when
`onSelect` is set, otherwise they render as plain `<div>`s so hosts can embed
their own links. in full-cell mode today keeps its ring and selection tints
(`bg-white/10`) instead of inverting so rich content stays readable.

pair `renderCell` with `cellClassName` — a string or a per-day
`(day: CalendarDay) => string` function, applied in both modes — for sizing
(`"min-h-28 p-2"`) or a per-day heatmap tint, and with `fillHeight` to stretch
the day rows to equal heights (`auto-rows-fr`) so the grid fills the component's
height. that combination is what turns the picker into a full-page agenda month
view; give the root a height via `className` for it to fill.

vs siblings: `calendar` is the interactive month picker (and, with `renderCell`,
the agenda month grid); `heatmap` is the read-mostly full-year density view;
`date-strip` is the linear run of days for booking; `calendar-nav` is only the
header controls meant to sit above any of them.

**Key props:**
- `month: string` — required — "YYYY-MM" displayed month.
- `onMonthChange: (month: string) => void` — enables prev/next.
- `selected: string | null` — "YYYY-MM-DD".
- `onSelect: (date: string) => void`
- `today: string` — "YYYY-MM-DD" to ring.
- `showHeader: boolean = true` — set false when an external nav (e.g. calendar-nav) already pages the month.
- `renderDay: (date: string) => ReactNode` — extra cell content under the day number.
- `renderCell: (day: CalendarDay) => ReactNode` — replace the whole cell (day number included). day = { date, day, isToday, isSelected }.
- `cellClassName: string | ((day: CalendarDay) => string)` — per-cell classes — heatmap tint, min-height. works in both modes.
- `fillHeight: boolean = false` — stretch the day rows to equal heights (auto-rows-fr) to fill the component's height — give the root a height via className for a full-page agenda month grid. best with renderCell.

**Example:**
```tsx
const [month, setMonth] = useState("2026-08");
const [selected, setSelected] = useState<string | null>(null);
<Calendar month={month} onMonthChange={setMonth} selected={selected} onSelect={setSelected} today="2026-08-05" />

// agenda month grid
<Calendar
  month={month}
  showHeader={false}
  fillHeight
  className="h-[calc(100dvh-12rem)]"
  cellClassName="min-h-28 p-2"
  renderCell={({ date, day }) => <DayCell date={date} day={day} events={byDate[date]} />}
/>
```

## calendar-nav

**Role:** period-navigation header — view switcher plus prev / today / next controls.
**Install:** `bunx @justin06lee/chrome@latest add calendar-nav`
**Composes:** segmented, button (registry); lucide-react (npm)

a header bar with a `segmented` day/month/year switcher on the left and chevron
prev/next buttons flanking the period label and a "today" jump link on the
right, above a bottom border. it renders no calendar itself — you own the
current date, compute the `label` (e.g. "August 2026"), and step it in
`onPrev`/`onNext` by the active view's unit. the switcher hides when `views` has
fewer than 2 entries. because both `label` and `todayLabel` are ReactNode, you
can put richer content than a string in either.

it works in two modes. **callback mode** (the original) uses `onPrev`/`onNext`/
`onToday`/`onViewChange` and renders buttons. **link mode** renders the same
controls as real anchors: pass `linkComponent` (your router's Link) together
with `prevHref`, `nextHref`, `todayHref` and `viewHref(view)`, and every control
becomes a prefetchable client-side link. that is a large win on server-rendered
(`force-dynamic`) calendar routes, where callback paging means a round trip per
click and link paging can prefetch the neighbouring periods. `prefetch` is
forwarded to `linkComponent` for every control.

you need the `*Href` props for link mode to do anything — passing
`linkComponent` alone leaves the controls as buttons.

pair it with `calendar` (month view, `showHeader={false}`), `heatmap` (year
view), `date-strip` or `timeline` (day view), swapping the body when the view
changes.

**Key props:**
- `label: ReactNode` — required — the current period label, e.g. "August 2026".
- `view: 'day' | 'month' | 'year'` — controlled active view.
- `views: CalendarView[] = ['day', 'month', 'year']` — switcher hidden when fewer than 2.
- `onViewChange: (view: CalendarView) => void`
- `onPrev: () => void`
- `onNext: () => void`
- `onToday: () => void`
- `todayLabel: ReactNode = 'today'`
- `linkComponent: React.ElementType` — pass your router's Link (e.g. next/link) to render prev/next/today + the view switcher as prefetched client-side links instead of callback buttons — much faster period-switching on server-rendered (force-dynamic) routes. provide the *Href props too.
- `prevHref: string` — href for the previous period (with linkComponent).
- `nextHref: string` — href for the next period.
- `todayHref: string` — href for the current period.
- `viewHref: (view: CalendarView) => string` — maps a view to its href; each switcher segment becomes a prefetched link.
- `prefetch: boolean` — forwarded to linkComponent (e.g. next/link's prefetch) for every control.
- `className: string`

**Example:**
```tsx
// link mode on a server-rendered route
<CalendarNav
  label="August 2026"
  view="month"
  linkComponent={Link}
  prefetch
  prevHref="/calendar/2026-07"
  nextHref="/calendar/2026-09"
  todayHref="/calendar/2026-08"
  viewHref={(v) => `/calendar/2026-08?view=${v}`}
/>
```

## clock

**Role:** live clock — analog face, digital readout, or both, in any iana zone.
**Install:** `bunx @justin06lee/chrome@latest add clock`
**Composes:** nothing beyond utils

a thin-stroke analog face, a tabular-nums digital readout, or `both` stacked.
`timeZone` takes any iana zone name; omit it for the viewer's local zone.
`showZone` adds the abbreviation (e.g. "KST") under the readout.

the zone handling goes through `Intl` — the only way to render another zone's
wall clock without shipping a tz database, since `Date`'s getters are
local-only. the locale is pinned so the server and browser parse identical
parts, and one ICU quirk is folded away: some builds emit `"24"` for midnight
under `h23`, which is normalized back to 0.

ssr-safety is the usual pattern, and visible here: the clock renders a **stable
midnight form** until mounted, then fills in. the first tick is aligned to the
next whole second so the hand steps with the wall clock rather than drifting by
however long hydration took, and the small hands use fractional
minutes/hours so they sit between tick marks — which is what makes an analog
face read as continuous rather than jerky.

`sweep` runs the second hand continuously instead of stepping. it costs a rAF
loop, so it's opt-in, and it's ignored under `prefers-reduced-motion`. `size`
sets the analog face edge in px; the digital readout is sized by `className`
instead.

**Key props:**
- `variant: 'analog' | 'digital' | 'both' = 'analog'` — 'both' stacks the face over the readout.
- `timeZone: string` — iana zone, e.g. "Asia/Seoul". omit for the viewer's local zone.
- `showSeconds: boolean = true` — second hand and :ss in the readout.
- `hour12: boolean = false` — 12-hour readout with an am/pm suffix.
- `size: number = 160` — analog face edge in px; the digital readout is sized by className.
- `ticks: boolean = true` — hour tick marks around the face.
- `sweep: boolean = false` — sweep the second hand continuously instead of stepping. costs a raf loop; ignored under prefers-reduced-motion.
- `showZone: boolean = false` — zone abbreviation under the readout, e.g. "KST".
- `accent: string` — css color for the second hand. defaults to the muted white step.
- `className: string`

**Example:**
```tsx
<Clock variant="both" timeZone="Asia/Seoul" showZone />
<Clock variant="digital" className="text-3xl" hour12 />
```

## date-strip

**Role:** horizontal run of days — the linear counterpart to calendar's month grid.
**Install:** `bunx @justin06lee/chrome@latest add date-strip`
**Composes:** lucide-react (npm); nothing beyond utils from the registry

a scrollable row of day cells (weekday over number) with optional arrows, for
booking flows where **the next opening matters more than which week it's in**.
controlled by `value`/`onChange` over a `days` array of
`{ value, label, weekday?, count?, disabled?, today? }`.

the `count` semantics are the sharp part and worth getting right: availability
renders as a **dot, not a number** — at strip size the exact count is unreadable
anyway, and the only question the strip answers is "is there anything on this
day". a known count of `0` disables the day. **`undefined` means unknown and
leaves the day alone** — which is what a still-loading strip should pass, so it
never tells a guest their whole week is empty before the data lands.

the arrows watch the element and hide themselves when nothing overflows, which
covers both "everything already fits" and "the strip was resized narrower". and
a `value` change from outside scrolls the selected day into view, so a "next
available" button elsewhere on the page doesn't leave the selection off-screen.

use `date-strip` for picking a day in a booking flow, `calendar` when the month
shape matters, `slot-picker` for the times within the chosen day.

**Key props:**
- `days: StripDay[]` — required — { value, label, weekday?, count?, disabled?, today? }. count 0 disables the day; undefined means unknown.
- `value: string | null` — required
- `onChange: (value: string) => void` — required
- `label: ReactNode` — mono uppercase caption above the strip, usually the month.
- `arrows: boolean = true` — scroll arrows; they hide themselves when nothing overflows.
- `showCount: boolean = true` — render availability as a dot under the number.
- `ariaLabel: string = 'pick a day'`
- `className: string`

**Example:**
```tsx
<DateStrip
  label="august"
  days={days.map((d) => ({ value: d.date, label: d.day, weekday: d.weekday, count: d.openSlots }))}
  value={day}
  onChange={setDay}
/>
```

## heatmap

**Role:** year activity grid — 12 mini month calendars tinted by value, contribution-graph style.
**Install:** `bunx @justin06lee/chrome@latest add heatmap`
**Composes:** nothing beyond utils

lays out 12 sunday-aligned mini month grids (2/3/4 columns responsive), each
square day cell tinted white with an alpha derived from its value: values bucket
into `levels` steps against a `max` ceiling (defaulting to the largest value
present), then map to alpha — level 0 is a faint 0.04, levels 1..n span 0.15 to
0.85. a less-to-more legend renders below. `today` gets a white ring; other
cells ring on hover.

`values` is a flat `Record<"YYYY-MM-DD", number>` — days absent from the record
count as 0, so you can pass sparse data. cells are `<div>`s by default; passing
`onSelectDay` upgrades every cell to a `<button>` with an aria-label. tooltips
default to `"date — value"` and are overridable via `title`. everything is
UTC-computed strings, matching `calendar`'s conventions, so the two can share
the same keyed data.

`monthHref` makes each month label a link: it's called with a `HeatmapMonth` —
`{ index (0-based, 0 = jan), year, label }` — and the returned href renders
through `linkComponent` (pass your router's Link; defaults to a plain `"a"`).
months whose callback you skip stay plain `<span>`s.

use heatmap for the at-a-glance year view; drill into a `calendar` month or a
`timeline` day when the user selects a cell, with `calendar-nav` switching
between them.

**Key props:**
- `values: Record<string, number>` — required — value per "YYYY-MM-DD".
- `year: number` — required
- `levels: number = 5` — intensity steps incl. empty.
- `max: number` — bucketing cap; defaults to max value.
- `today: string` — "YYYY-MM-DD" to ring.
- `onSelectDay: (date: string) => void` — makes cells clickable.
- `title: (date: string, value: number) => string` — cell tooltip formatter.
- `monthHref: (month: HeatmapMonth) => string` — when set, month labels link to the returned href. HeatmapMonth is { index (0 = jan), year, label }.
- `linkComponent: React.ElementType = 'a'` — anchor element/component for month links — pass your router's Link.

**Example:**
```tsx
<Heatmap
  values={{ "2026-08-04": 75, "2026-08-05": 25 }}
  year={2026}
  today="2026-08-05"
  monthHref={({ year, index }) => `/calendar/${year}-${String(index + 1).padStart(2, "0")}`}
/>
```

## interval-picker

**Role:** duration picker for "every n minutes" settings — presets plus a stepper.
**Install:** `bunx @justin06lee/chrome@latest add interval-picker`
**Composes:** lucide-react (npm); nothing beyond utils from the registry

a row of quick presets in a roving-tabindex radiogroup (one tab stop, arrows to
move) plus −/+ steppers and a number field for anything between them. it
**always emits a plain minute count**, so callers never parse a unit back out.

the typing behavior is the detail that makes it usable: while you type, the
field holds a raw draft rather than clamping every keystroke — otherwise a
half-entered "1" on the way to "120" would snap up to `min` mid-keystroke. the
draft live-commits only once it is already in range, and otherwise waits for
blur or Enter, so clamping never fights the typist. values are clamped to
`min`/`max` before reaching `onChange`.

pair it with `timer-ring` (the work interval) and `break-overlay` (what happens
when it elapses).

**Key props:**
- `value: number` — required — current interval, in minutes.
- `onChange: (minutes: number) => void` — required — fired with the new interval in minutes, already clamped to min/max.
- `presets: number[] = [15, 25, 50, 90]` — quick-pick values in minutes.
- `min: number = 1` — lower bound in minutes.
- `max: number = 240` — upper bound in minutes.
- `step: number = 5` — amount the steppers and arrow keys move by.
- `unit: string = 'min'` — unit shown after the custom value.
- `label: ReactNode = 'interval'` — group caption; pass null to drop it.
- `disabled: boolean = false`
- `ariaLabel: string` — accessible name for the preset group.
- `className: string`

**Example:**
```tsx
const [minutes, setMinutes] = useState(25);
<IntervalPicker value={minutes} onChange={setMinutes} label="focus block" />
```

## slot-picker

**Role:** column or grid of bookable times with a two-step confirm.
**Install:** `bunx @justin06lee/chrome@latest add slot-picker`
**Composes:** nothing beyond utils

a column (or `columns`-wide grid) of time buttons from a `slots` array of
`{ value, label, disabled?, note? }`. `value` is stable identity — an iso
string or epoch ms — not the display label.

**the interaction is the whole point.** picking a time doesn't submit it: the
chosen row splits in two, the time slides left and a confirm button takes the
other half, so the commit lands *under the cursor that just picked the time*
rather than at the bottom of a long column. that makes the commit deliberate and
a mis-tap on a phone free. clicking the selected slot again deselects it —
which is the only way back out of the split state by mouse. omit `onConfirm`
and it degrades to a plain single-select grid.

keyboard handling is a roving tabindex over the whole grid: one tab stop in,
arrows to move. that matters because a day can hold thirty-odd slots, and
tabbing through all of them to reach the afternoon is not navigation.

`confirming` is the pending flag for the confirm half (disable it while your
booking request is in flight). `columns="auto"` fills the container at roughly
7rem per column. `footnote` is usually where you state the timezone the labels
are in — pair it with `timezone-select`.

**Key props:**
- `slots: Slot[]` — required — { value, label, disabled?, note? }. value is stable identity — iso string or epoch ms.
- `value: string | null` — required — selected slot value.
- `onChange: (value: string | null) => void` — required — fires on pick; clicking the selected slot again deselects.
- `onConfirm: (value: string) => void` — commits the selection. when set, the selected row splits and reveals the confirm half in place. omit for a plain single-select grid.
- `confirmLabel: ReactNode = 'confirm'`
- `columns: number | 'auto' = 1` — 'auto' fills the container at ~7rem per column.
- `label: ReactNode` — mono uppercase caption above the grid.
- `footnote: ReactNode` — muted line under the grid — usually the zone the labels are in.
- `emptyState: ReactNode` — shown in place of the grid when slots is empty.
- `disabled: boolean = false` — disables every slot without emptying the grid.
- `confirming: boolean = false` — pending state for the confirm half.
- `ariaLabel: string = 'available times'`
- `className: string`

**Example:**
```tsx
<SlotPicker
  label="wednesday 12 august"
  slots={times.map((t) => ({ value: t.iso, label: t.label, disabled: t.taken }))}
  value={slot}
  onChange={setSlot}
  onConfirm={book}
  confirming={booking}
  footnote="times shown in your local zone"
  emptyState={<EmptyState title="no times left" description="try another day." bordered={false} />}
/>
```

## timeline

**Role:** day schedule — a 24h vertical axis with positioned event blocks, markers, and a live now-line.
**Install:** `bunx @justin06lee/chrome@latest add timeline`
**Composes:** nothing beyond utils

renders a min-height 960px bordered track with a faint hour grid (00:00 through
23:00 labels) and absolutely positioned event blocks. everything is placed by
minutes since midnight on a 0–1440 axis: an event at
`{ startMin: 480, endMin: 570 }` spans 8:00 to 9:30. blocks get a colored left
border and a `color-mix` 15% tint of the same color (default white), a two-line
clamped label, and are clamped into the visible day so out-of-range events can't
overflow the track. events are not collision-resolved — overlapping blocks
overlap visually.

blocks are display-only `<div>`s by default; `onEventClick` upgrades them to
keyboard-accessible `<button>`s with an HH:MM-range aria-label. `tracks`
switches to multi-track mode: N labeled columns side by side
(`{ label?, events, onEventClick? }[]` — a per-track handler overrides the
top-level one) sharing one hour axis, grid, markers, and now-line — plan vs
actuals, people, rooms; `events` is ignored when `tracks` is set. `onEventChange`
opts blocks into editing: drag to move, or drag the bottom edge to resize,
snapped to `snapMinutes` (default 5); it fires once on drop with
`(event, { startMin, endMin })` and you commit by updating your data — the
component holds only the in-flight drag preview. editing is pointer-driven (no
keyboard path), and a drag that moved suppresses the click that follows.

`markers` draws labeled full-width horizontal rules at given minutes — thin line
with a small mono uppercase label at the right edge — for any fixed daily
reference times (prayer times, market open/close, deadlines). `markersSlot` is a
ReactNode rendered into the same marker layer, so marker data can stream in —
e.g. a `<Suspense>`-wrapped server component rendering the exported
`TimelineMarker` primitive (`{ minutes, label, color? }`). the now-line is a red
dot + rule: `showNow` computes it from the client clock and ticks every minute,
while `nowMinutes` overrides the position explicitly (and implies the line
shows — useful for SSR determinism or another timezone). toggling `showNow` off
hides the line rather than freezing it.

the track is tall by design; wrap it in a fixed-height `overflow-y-auto`
container for a scrollable day view. pair with `calendar-nav` for day paging.

**Key props:**
- `events: TimelineEvent[]` — { startMin, endMin, label?, color? }[] — single-track events. ignored when tracks is set.
- `tracks: TimelineTrack[]` — { label?, events, onEventClick? }[] — labeled columns sharing one axis; per-track onEventClick overrides the top-level one.
- `showNow: boolean` — live red now-line, ticks each minute.
- `nowMinutes: number` — override now-line position (minutes of day).
- `markers: Array<{ minutes: number; label: string; color?: string }>` — labeled full-width marker lines at minutes-of-day (e.g. prayer times), label at the right edge.
- `markersSlot: ReactNode` — slot in the marker layer for streamed markers — render the exported `TimelineMarker` inside it.
- `onEventClick: (event: TimelineEvent) => void` — blocks become keyboard-accessible buttons; display-only when absent.
- `onEventChange: (event, next: { startMin; endMin }) => void` — opt-in drag-to-move + bottom-edge resize; called once on drop.
- `snapMinutes: number = 5` — snap increment for drag editing.

**Example:**
```tsx
<div className="h-[420px] overflow-y-auto">
  <Timeline
    showNow
    markers={[{ minutes: 5 * 60 + 12, label: "fajr" }]}
    tracks={[
      { label: "plan", events: planned },
      { label: "actual", events: logged },
    ]}
    onEventClick={(e) => openEvent(e)}
    onEventChange={(e, next) => updateEvent(e, next)}
    snapMinutes={15}
  />
</div>
```

## timer-ring

**Role:** circular progress ring — a value/max pair, or a self-ticking countdown.
**Install:** `bunx @justin06lee/chrome@latest add timer-ring`
**Composes:** nothing beyond utils

one stroked svg circle driven by `stroke-dasharray`/`stroke-dashoffset`, with a
center slot. two modes: **determinate** from `value`/`max`, or **countdown** —
set `endsAt` and the ring runs its own one-second clock toward the deadline,
rendering the remaining time (`mm:ss`, or `h:mm:ss` past the hour, clamped at
zero) in the center.

`startedAt` is the 0% anchor for a countdown and defaults to mount time, so a
ring given only `endsAt` starts empty and fills toward the deadline. pass
`startedAt` explicitly when the timer was started earlier and the ring is
remounting — otherwise it restarts visually from empty.

two implementation notes worth preserving. the countdown steps once a second
but the arc is **interpolated across almost the whole second**, so it reads as
continuous motion rather than ticking. and the clock anchor is component state
rather than a ref *on purpose*: it is read during render to size the arc, and a
ref read during render makes output depend on mutable data react isn't tracking,
which tears under concurrent rendering. the completion flag stays a ref because
it is only ever touched inside effects.

`direction="drain"` empties the arc as time runs out instead of filling it.
`label={null}` gives a bare ring. `onComplete` fires once per deadline and
re-arms if `endsAt` changes.

use `timer-ring` for a circular countdown, `progress` (in
`references/feedback.md`) for the linear determinate case.

**Key props:**
- `value: number = 0` — determinate value; ignored in countdown mode.
- `max: number = 100` — upper bound for value.
- `endsAt: number | Date` — countdown target. setting it makes the ring tick itself once a second.
- `startedAt: number | Date = mount time` — the 0% anchor for a countdown; given only endsAt, the ring starts empty at mount.
- `size: number = 128` — outer edge in px.
- `thickness: number = 2` — stroke width in px.
- `accent: string = '#fff'` — css color for the progress arc.
- `label: ReactNode` — center slot. defaults to the remaining time (countdown) or a percentage; pass null for a bare ring.
- `onComplete: () => void` — fired once when a countdown reaches endsAt; re-arms if endsAt changes.
- `direction: 'fill' | 'drain' = 'fill'` — 'drain' empties the arc as time runs out.
- `ariaLabel: string`
- `className: string`

**Example:**
```tsx
<TimerRing endsAt={sessionEndsAt} startedAt={sessionStartedAt} direction="drain" onComplete={startBreak} />
<TimerRing value={done} max={total} label={`${done}/${total}`} size={96} />
```

