"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Grain } from "@/components/chrome/grain";
import { createCrtRenderer, loadPicture, type CrtRenderer } from "./crt-gl";
import {
  clampAngle,
  deltaAngle,
  detentAngle,
  nearestDetent,
  pointerAngle,
  stepChannel,
} from "./crt-dial";

export type CrtChannel = {
  id: string;
  title: string;
  description?: string;
  src: string | null;
  href?: string;
};

export type CrtMonitorProps = {
  channels: CrtChannel[];
  className?: string;
  ariaLabel?: string;
};

/**
 * The cabinet is a photograph of an Apple Macintosh Color Display, cut out
 * with a transparent hole where the glass was (`public/crt/monitor.webp`,
 * 1326x1095 before scaling). Everything below is positioned as a share of that
 * picture, measured off its alpha channel:
 *
 *   - the hole spans x 14.9%–87.5%, y 17.2%–82.4%; the canvas sits behind it
 *     with a margin, and the photo's alpha does the masking
 *   - the bottom band of the bezel, between the green apple and the LED slot,
 *     is where the controls are laid over the plastic
 *   - the LED slot is at x 82.1%, y 91.6%
 */
const BEZEL_ASPECT = "1326 / 1095";
const SCREEN = { left: "12.5%", top: "15%", width: "77%", height: "69.5%" };
const CONTROLS = { left: "28%", right: "23%", top: "85.5%", bottom: "3%" };
const LED = { left: "81.3%", top: "90.8%", width: "1.9%", height: "1.4%" };

// Switch-on / switch-off and the static burst between channels, in ms.
const POWER_MS = 420;
const BURST_MS = 320;
const OSD_MS = 1800;
/** A press that travels less than this is a click, not a turn of the knob. */
const DRAG_THRESHOLD_DEG = 6;

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const pad = (n: number) => String(n + 1).padStart(2, "0");

/**
 * The terminal pieces, playing on one old monitor.
 *
 * The knob on the bezel selects the channel (drag it, click it, or use the
 * arrow keys once it has focus; the printed channel names beside it are also
 * buttons). The glass is a link to the project — a real anchor, so
 * middle-click and "open in new tab" behave. Power switches the set off with
 * the raster collapse a tube actually did, and clicking the dark glass turns
 * it back on.
 *
 * Everything on the glass is drawn by `crt-gl`; this component only owns the
 * cabinet, the controls, and the timeline it hands the shader each frame. The
 * loop runs only while the set is on, on screen, and something is changing,
 * and under prefers-reduced-motion it draws one still frame per state.
 */
export function CrtMonitor({ channels, className, ariaLabel = "terminal" }: CrtMonitorProps) {
  const count = channels.length;
  const [channel, setChannel] = useState(0);
  const [on, setOn] = useState(true);
  const [dragAngle, setDragAngle] = useState<number | null>(null);
  const [osdKey, setOsdKey] = useState(0);
  const [glOk, setGlOk] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const renderer = useRef<CrtRenderer | null>(null);
  const raf = useRef<number | null>(null);
  const visible = useRef(true);
  const reduced = useRef(false);
  // Animation timeline, kept out of React state so a frame never re-renders.
  const timeline = useRef({ powerFrom: 1, powerTo: 1, powerAt: 0, burstAt: -Infinity });
  const wantsOn = useRef(true);
  const drag = useRef<{ pointerId: number; last: number; angle: number; moved: number } | null>(null);

  const current = channels[channel] ?? channels[0];
  const restAngle = useMemo(() => detentAngle(channel, count), [channel, count]);
  const knobAngle = dragAngle ?? restAngle;

  /* ── the tube ─────────────────────────────────────────────────────────── */

  const draw = useCallback((now: number) => {
    const r = renderer.current;
    if (!r) return false;
    const t = timeline.current;
    const p = Math.min(1, (now - t.powerAt) / POWER_MS);
    const power = reduced.current
      ? t.powerTo
      : t.powerFrom + (t.powerTo - t.powerFrom) * ease(p);
    const burst = reduced.current ? 0 : Math.max(0, 1 - (now - t.burstAt) / BURST_MS);
    r.render({ time: now / 1000, power, burst, motion: reduced.current ? 0 : 1 });
    // Whether another frame is worth drawing.
    return power > 0 && (!reduced.current || p < 1 || burst > 0);
  }, []);

  const loop = useCallback(() => {
    raf.current = null;
    if (!visible.current) return;
    const again = draw(performance.now());
    if (again) raf.current = requestAnimationFrame(loop);
  }, [draw]);

  const kick = useCallback(() => {
    if (raf.current === null) raf.current = requestAnimationFrame(loop);
  }, [loop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const screen = screenRef.current;
    if (!canvas || !screen) return;
    const r = createCrtRenderer(canvas);
    if (!r) {
      setGlOk(false);
      return;
    }
    renderer.current = r;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = media.matches;
    const onMedia = () => {
      reduced.current = media.matches;
      kick();
    };
    media.addEventListener("change", onMedia);

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = screen.getBoundingClientRect();
      r.resize(rect.width * dpr, rect.height * dpr);
      kick();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(screen);
    resize();

    const io = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      if (visible.current) kick();
    });
    io.observe(screen);

    return () => {
      media.removeEventListener("change", onMedia);
      ro.disconnect();
      io.disconnect();
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
      r.destroy();
      renderer.current = null;
    };
  }, [kick]);

  // Load the channel's picture; a change of channel also fires the static.
  useEffect(() => {
    const r = renderer.current;
    if (!r) return;
    let cancelled = false;
    timeline.current.burstAt = performance.now();
    kick();
    if (!current?.src) {
      r.setImage(null, 0, 0);
      return;
    }
    loadPicture(current.src).then((pic) => {
      if (cancelled || !renderer.current) return;
      if (pic) renderer.current.setImage(pic.source, pic.width, pic.height);
      else renderer.current.setImage(null, 0, 0);
      kick();
    });
    return () => {
      cancelled = true;
    };
  }, [current?.src, kick]);

  /* ── controls ─────────────────────────────────────────────────────────── */

  const tune = useCallback(
    (index: number) => {
      if (index === channel || count === 0) return;
      setChannel(index);
      setOsdKey((k) => k + 1);
    },
    [channel, count],
  );

  const setPower = useCallback(
    (next: boolean) => {
      if (wantsOn.current === next) return;
      wantsOn.current = next;
      const now = performance.now();
      const t = timeline.current;
      // Start from wherever the last animation got to, so a quick double
      // press doesn't snap.
      const p = Math.min(1, (now - t.powerAt) / POWER_MS);
      t.powerFrom = t.powerFrom + (t.powerTo - t.powerFrom) * ease(p);
      t.powerTo = next ? 1 : 0;
      t.powerAt = now;
      setOn(next);
      if (next) setOsdKey((k) => k + 1);
      kick();
    },
    [kick],
  );

  const onKnobPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const knob = knobRef.current;
    if (!knob || count <= 1) return;
    const rect = knob.getBoundingClientRect();
    const angle = pointerAngle(rect.left + rect.width / 2, rect.top + rect.height / 2, e.clientX, e.clientY);
    drag.current = { pointerId: e.pointerId, last: angle, angle: restAngle, moved: 0 };
    knob.setPointerCapture(e.pointerId);
  };

  const onKnobPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const knob = knobRef.current;
    if (!d || !knob || d.pointerId !== e.pointerId) return;
    const rect = knob.getBoundingClientRect();
    const angle = pointerAngle(rect.left + rect.width / 2, rect.top + rect.height / 2, e.clientX, e.clientY);
    const delta = deltaAngle(d.last, angle);
    d.last = angle;
    d.moved += Math.abs(delta);
    d.angle = clampAngle(d.angle + delta, count);
    if (d.moved >= DRAG_THRESHOLD_DEG) setDragAngle(d.angle);
  };

  const onKnobPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    knobRef.current?.releasePointerCapture(e.pointerId);
    setDragAngle(null);
    if (d.moved >= DRAG_THRESHOLD_DEG) {
      tune(nearestDetent(d.angle, count));
    } else {
      // A plain press clicks the knob round one stop.
      tune(stepChannel(channel, 1, count));
    }
  };

  const onKnobKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      tune(stepChannel(channel, 1, count));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      tune(stepChannel(channel, -1, count));
    } else if (e.key === "Home") {
      e.preventDefault();
      tune(0);
    } else if (e.key === "End") {
      e.preventDefault();
      tune(count - 1);
    }
  };

  if (count === 0) return null;

  const screenLabel = on ? `open ${current.title}` : "switch on";

  return (
    <div role="group" aria-label={ariaLabel} className={cn("mx-auto w-full max-w-[760px]", className)}>
      <style precedence="default" href="crt-monitor">{CSS}</style>

      <div className="crt-set relative w-full @container" style={{ aspectRatio: BEZEL_ASPECT }}>
        {/* The glass: a canvas behind the hole in the bezel. */}
        <div ref={screenRef} className="absolute overflow-hidden bg-black" style={SCREEN}>
          {glOk ? (
            <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
          ) : (
            <Fallback channel={current} on={on} />
          )}
          {on && (
            <div
              key={osdKey}
              aria-hidden
              className="crt-osd pointer-events-none absolute left-[12%] top-[11%] font-mono text-[max(9px,1.45cqw)] uppercase tracking-[0.3em] text-white/85"
            >
              ch {pad(channel)}
              <span className="ml-[1em] normal-case tracking-[0.12em] text-white/60">{current.title}</span>
            </div>
          )}
        </div>

        {/* The cabinet. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/crt/monitor.webp"
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full select-none"
        />

        {/* The glass as a link, over the bezel so it can be clicked. */}
        {on && current.href ? (
          <a
            href={current.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={screenLabel}
            className="crt-glass absolute z-20 outline-none"
            style={SCREEN}
          />
        ) : (
          <button
            type="button"
            aria-label={screenLabel}
            onClick={() => !on && setPower(true)}
            className="crt-glass absolute z-20 outline-none"
            style={SCREEN}
          />
        )}

        {/* The LED, lit in the slot the photo already has. */}
        <span
          aria-hidden
          className={cn(
            "crt-led absolute z-20 rounded-full transition-[background-color,box-shadow] duration-500",
            on ? "bg-[#7ee08a] shadow-[0_0_0.6cqw_0.15cqw_rgba(110,230,130,0.7)]" : "bg-transparent",
          )}
          style={LED}
        />

        {/* The controls, printed on the bezel's bottom band. */}
        <div
          className="absolute z-20 flex flex-wrap items-center justify-center gap-x-[3.5cqw] gap-y-[0.6cqw]"
          style={CONTROLS}
        >
          <div className="relative flex items-center gap-[1.6cqw]">
            <span className="crt-print text-[max(8px,1.15cqw)]">channel</span>
            <div
              ref={knobRef}
              tabIndex={0}
              role="slider"
              aria-label="channel"
              aria-valuemin={0}
              aria-valuemax={Math.max(0, count - 1)}
              aria-valuenow={channel}
              aria-valuetext={current.title}
              aria-orientation="horizontal"
              onPointerDown={onKnobPointerDown}
              onPointerMove={onKnobPointerMove}
              onPointerUp={onKnobPointerUp}
              onPointerCancel={onKnobPointerUp}
              onKeyDown={onKnobKeyDown}
              className={cn(
                "crt-knob relative size-[max(24px,5.2cqw)] shrink-0 touch-none select-none rounded-full outline-none",
                "focus-visible:ring-[0.3cqw] focus-visible:ring-black/40",
                dragAngle === null && "transition-transform duration-200 ease-out motion-reduce:transition-none",
              )}
              style={{ transform: `rotate(${knobAngle}deg)` }}
            >
              <span aria-hidden className="absolute left-1/2 top-[12%] h-[26%] w-[7%] -translate-x-1/2 rounded-full bg-[#3f3b35]" />
            </div>
          </div>

          <ol className="flex flex-wrap items-center gap-x-[2.4cqw] gap-y-[0.4cqw]" aria-label="channels">
            {channels.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => tune(i)}
                  aria-current={i === channel ? "true" : undefined}
                  className={cn(
                    "crt-print flex items-center gap-[0.7cqw] text-[max(8px,1.15cqw)] outline-none transition-opacity",
                    i === channel ? "opacity-100" : "opacity-45 hover:opacity-80 focus-visible:opacity-80",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-[max(4px,0.7cqw)] rounded-full",
                      i === channel ? "bg-[#3f3b35]" : "border border-[#3f3b35]",
                    )}
                  />
                  {c.title}
                </button>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={() => setPower(!on)}
            aria-pressed={on}
            aria-label={on ? "switch off" : "switch on"}
            className="crt-print flex items-center gap-[1.2cqw] text-[max(8px,1.15cqw)] outline-none"
          >
            <span
              aria-hidden
              className={cn(
                "crt-switch relative block h-[max(12px,2.3cqw)] w-[max(22px,4.2cqw)] rounded-full transition-colors",
                on ? "bg-[#b9b3a6]" : "bg-[#cdc7ba]",
              )}
            >
              <span
                className={cn(
                  "absolute top-[15%] h-[70%] w-[42%] rounded-full bg-[#5a554d] transition-[left] duration-200",
                  on ? "left-[52%]" : "left-[6%]",
                )}
              />
            </span>
            power
          </button>
        </div>
      </div>

      {/* The plate. */}
      <div className="mt-4 flex items-baseline justify-between gap-4 font-mono text-[11px] lowercase text-white/45">
        <p className="min-w-0 truncate">
          <span className="text-white/80">{current.title}</span>
          {current.description && <span className="text-white/40"> — {current.description}</span>}
        </p>
        <span className="shrink-0 tracking-[0.18em] text-white/30">macintosh color display</span>
      </div>
    </div>
  );
}

/** No WebGL: the flat image with the effects approximated in CSS. */
function Fallback({ channel, on }: { channel: CrtChannel; on: boolean }) {
  return (
    <div
      className={cn(
        "crt-fallback absolute inset-0 flex items-center justify-center p-[9%] transition-opacity duration-300",
        !on && "opacity-0",
      )}
    >
      {channel.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={channel.src}
          alt=""
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <span className="font-mono text-xs lowercase text-white/40">{channel.title}</span>
      )}
      <Grain variant="noise" fixed={false} opacity={0.14} animate />
    </div>
  );
}

const CSS = `
@keyframes crt-osd {
  0% { opacity: 0; }
  8% { opacity: 1; }
  75% { opacity: 1; }
  100% { opacity: 0; }
}
.crt-osd {
  animation: crt-osd ${OSD_MS}ms steps(12) forwards;
  text-shadow: 0 0 6px rgba(255,255,255,0.7);
}
.crt-glass { cursor: pointer; }
.crt-glass:focus-visible { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.6); }
/* The lettering printed on the plastic: small caps, letterspaced, ink grey. */
.crt-print {
  font-family: ui-sans-serif, system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #4a463f;
  line-height: 1;
  white-space: nowrap;
}
/* A moulded knob in the same beige as the case, lit from above. */
.crt-knob {
  background: radial-gradient(circle at 50% 35%, #e6e1d6 0%, #cfc9bc 55%, #b3ad9f 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.7),
    inset 0 -2px 3px rgba(0,0,0,0.18),
    0 1px 2px rgba(0,0,0,0.35);
  cursor: grab;
}
.crt-knob:active { cursor: grabbing; }
.crt-switch { box-shadow: inset 0 1px 2px rgba(0,0,0,0.35); }
.crt-fallback {
  border-radius: 6% / 8%;
  background:
    repeating-linear-gradient(to bottom, rgba(255,255,255,0) 0 2px, rgba(0,0,0,0.35) 2px 3px),
    radial-gradient(ellipse at center, #101212 0%, #050606 70%, #000 100%);
}
@media (prefers-reduced-motion: reduce) {
  .crt-osd { animation-duration: 0.01ms; opacity: 1; }
}
`;
