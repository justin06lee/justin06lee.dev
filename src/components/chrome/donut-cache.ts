// Shared bake registry for <Donut/>. Every Donut with an identical config shares
// ONE entry: one precomputed array of frame strings, baked once. Steady-state
// animation is then literally `pre.textContent = frames[i]` — pure array
// iteration, zero per-frame math.
//
// The array is filled by whichever finishes first:
//   - a single process-wide web worker (off-thread, preferred), or
//   - a chunked main-thread bake (fallback) that fills it over a few idle slices.
// The main-thread fallback ALSO fires if the worker is present but never answers
// (broken/blocked in some bundlers), so playback always converges to smooth
// array iteration within ~1s regardless of environment. N donuts on a page never
// spawn N workers or recompute the same frame twice.
import { makeDonutRenderer, type DonutConfig } from "./donut-frames";
import type { BakeRequest, BakeResult } from "./donut.worker";

export interface DonutHandle {
  key: string;
  cfg: DonutConfig;
  N: number;
  live: ReturnType<typeof makeDonutRenderer>;
  /** Precomputed frame strings, shared across every instance. Filled lazily/by bake. */
  frames: (string | undefined)[];
  /** True once every frame string is materialised — pure array iteration from here. */
  ready: boolean;
  bakeStarted: boolean;
  refs: number;
  /** Set once the entry is evicted — stops any in-flight bake from resuming. */
  cancelled: boolean;
  /** Pending main-thread chunk handle (rIC id or timeout id), if any. */
  bakeHandle: number | null;
  /** Worker-answer safety-net timeout id, if any. */
  fallbackTimer: ReturnType<typeof setTimeout> | null;
}

const handles = new Map<string, DonutHandle>();

// --- one process-wide worker, created lazily, with graceful fallback ----------
let worker: Worker | null = null;
let workerTried = false;

function ensureWorker(): void {
  if (workerTried) return;
  workerTried = true;
  if (typeof Worker === "undefined") return;
  try {
    worker = new Worker(new URL("./donut.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<BakeResult>) => fillFromStrings(e.data.key, e.data.frames);
    // A worker that fails to load just leaves entries to the main-thread bake.
    worker.onerror = () => {
      worker = null;
    };
  } catch {
    worker = null;
  }
}

/**
 * Terminate the shared worker once no bakes reference it. `workerTried` is reset
 * so the next bake request lazily recreates it via ensureWorker().
 */
function teardownWorker(): void {
  if (worker) worker.terminate();
  worker = null;
  workerTried = false;
}

function cancelMainThreadBake(h: DonutHandle): void {
  if (h.bakeHandle === null) return;
  if (typeof cancelIdleCallback !== "undefined") cancelIdleCallback(h.bakeHandle);
  else clearTimeout(h.bakeHandle);
  h.bakeHandle = null;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function keyOf(cfg: DonutConfig): string {
  return [
    cfg.width,
    cfg.height,
    round(cfg.R),
    round(cfg.r),
    round(cfg.K),
    round(cfg.D),
    cfg.du ?? 0,
    cfg.dv ?? 0,
    round(cfg.Lx),
    round(cfg.Ly),
    round(cfg.Lz),
    cfg.chars,
    round(cfg.speed),
    round(cfg.yScale),
    cfg.isLowEnd ? 1 : 0,
  ].join("|");
}

/** Worker delivered the finished frame strings — adopt them wholesale (zero per-frame work). */
function fillFromStrings(key: string, frames: string[]): void {
  const h = handles.get(key);
  if (!h || h.ready) return;
  for (let fi = 0; fi < h.N; fi++) {
    const s = frames[fi];
    if (s !== undefined) h.frames[fi] = s;
  }
  h.ready = true;
}

/** Fallback: bake the loop on the main thread, spread across idle slices (non-blocking). */
function mainThreadBake(h: DonutHandle): void {
  if (h.ready || h.cancelled) return;
  const CHUNK = 48;
  let fi = 0;
  const schedule: (cb: () => void) => number =
    typeof requestIdleCallback !== "undefined"
      ? (cb) => requestIdleCallback(() => cb())
      : (cb) => setTimeout(cb, 0) as unknown as number;
  function step(): void {
    h.bakeHandle = null;
    if (h.ready || h.cancelled) return; // worker beat us to it, or evicted
    const end = Math.min(h.N, fi + CHUNK);
    for (; fi < end; fi++) {
      if (h.frames[fi] === undefined) h.frames[fi] = h.live.renderString(fi);
    }
    if (fi < h.N) h.bakeHandle = schedule(step);
    else h.ready = true;
  }
  h.bakeHandle = schedule(step);
}

function scheduleBake(h: DonutHandle): void {
  if (h.bakeStarted) return;
  h.bakeStarted = true;
  ensureWorker();
  if (worker) {
    worker.postMessage({ key: h.key, cfg: h.cfg } satisfies BakeRequest);
    // Safety net: if the worker never answers, fall back to a main-thread bake.
    h.fallbackTimer = setTimeout(() => {
      h.fallbackTimer = null;
      if (!h.ready && !h.cancelled) mainThreadBake(h);
    }, 1000);
  } else {
    mainThreadBake(h);
  }
}

/** Get (creating if needed) the shared bake for this config and bump its refcount. */
export function acquireBake(cfg: DonutConfig): DonutHandle {
  const key = keyOf(cfg);
  let h = handles.get(key);
  if (!h) {
    const live = makeDonutRenderer(cfg);
    h = {
      key,
      cfg,
      N: live.N,
      live,
      frames: new Array(live.N),
      ready: false,
      bakeStarted: false,
      refs: 0,
      cancelled: false,
      bakeHandle: null,
      fallbackTimer: null,
    };
    handles.set(key, h);
    scheduleBake(h);
  }
  h.refs++;
  return h;
}

/**
 * Drop a reference. When a bake's refs reach 0 its entry (and its frames) are
 * evicted from the cache and any in-flight main-thread bake / fallback timer is
 * cancelled. Once no bakes remain, the shared worker is terminated (and lazily
 * recreated on the next bake request). Bakes still referenced are untouched, so
 * "multiple donuts share one bake" is preserved.
 */
export function releaseBake(h: DonutHandle): void {
  h.refs = Math.max(0, h.refs - 1);
  if (h.refs > 0) return;

  // Evict: stop any pending work and free the entry + its frame strings.
  h.cancelled = true;
  cancelMainThreadBake(h);
  if (h.fallbackTimer !== null) {
    clearTimeout(h.fallbackTimer);
    h.fallbackTimer = null;
  }
  h.frames.length = 0;
  // Only delete the live entry (a remount may have already replaced it).
  if (handles.get(h.key) === h) handles.delete(h.key);

  if (handles.size === 0) teardownWorker();
}

/**
 * The printable `<pre>` string for frame `fi`. Once baked this is a plain array
 * read; before the bake lands it computes (and shares) the frame on demand so the
 * same frame is never rendered twice across instances.
 */
export function frameString(h: DonutHandle, fi: number): string {
  const cached = h.frames[fi];
  if (cached !== undefined) return cached;
  const s = h.live.renderString(fi);
  h.frames[fi] = s;
  return s;
}
