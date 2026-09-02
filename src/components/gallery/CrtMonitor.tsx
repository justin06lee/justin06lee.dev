"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { Grain } from "@/components/chrome/grain";
import { createCrtRenderer, loadPicture, type CrtRenderer } from "./crt-gl";
import {
  angleForChannel,
  channelAt,
  deltaAngle,
  detentStep,
  pointerAngle,
  snapAngle,
  staticAmount,
} from "./crt-dial";

export type CrtChannel = {
  id: string;
  title: string;
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
 * 1200x991, with the apple on the bezel cloned out). Everything below is
 * positioned as a share of that picture, measured off its alpha channel:
 *
 *   - the hole spans x 14.9%–87.4%, y 17.2%–82.4%, tapering toward the
 *     bottom; the canvas sits behind it with a margin, and the photo's alpha
 *     does the masking
 *   - the bezel's bottom band (y 84%–98%) carries the two controls, one at
 *     each end of the plastic: the knob at x 19.6% and the power button on
 *     the LED slot the photo already has at x 82.1%, both at y 91.8%. The
 *     band runs 9.4%–92.4% across at that height, so the two sit the same
 *     distance in from its ends
 *   - the band is not square to the camera: the front is convex and the set
 *     was shot from a little above, so its bottom edge climbs about 6° from
 *     the middle out to either end, and each end recedes. `--tilt` on the two
 *     controls (a 2D rotate by that slope, then a perspective turn away) is
 *     what stops them looking pasted on. Re-cutting the photo means
 *     re-measuring all of these
 */
const BEZEL_ASPECT = "1200 / 991";
const SCREEN = { left: "12.5%", top: "15%", width: "77%", height: "69.5%" };
const KNOB = { left: "19.6%", top: "91.8%" };
const POWER = { left: "82.1%", top: "91.8%" };

// Switch-on / switch-off, the static burst on a channel change, and the
// hover glitch and the shake that goes with it, in ms.
const POWER_MS = 420;
const BURST_MS = 320;
const GLITCH_MS = 260;
const SHAKE_MS = 340;
/** A press that travels less than this is a click, not a turn of the knob. */
const DRAG_THRESHOLD_DEG = 6;
/** What static throws on the wall. */
const STATIC_TINT: [number, number, number] = [200, 200, 200];

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The terminal pieces, playing on one small old monitor in a dark room.
 *
 * The knob on the bezel is a rotary channel selector: drag it round, click
 * it to step on one, or use the arrow keys once it has focus. It turns all
 * the way round, so the last channel clicks straight on to the first.
 * Between two detents the set is off-station and shows static; land on one
 * and it shows that project. Nothing is printed on the bezel and nothing is
 * written on the glass: the picture is the label, and the knob's
 * aria-valuetext carries the name for assistive tech. The glass is a link
 * to the project — a real anchor, so middle-click and "open in new tab"
 * behave — and hovering it kicks the set: a burst of colour bars, a shake,
 * then the picture with its colours inverted until the pointer leaves.
 * Power switches the set off with the raster collapse a tube actually did,
 * and clicking the dark glass turns it back on.
 *
 * The set lights the room: a glow behind it, light on the bezel's plastic,
 * and a pool on the floor in front, all in the colour the picture throws
 * (measured when it loads). Everything on the glass is drawn by `crt-gl`;
 * this component only owns the cabinet, the controls, and the timeline it
 * hands the shader each frame. The loop runs only while the set is on, on
 * screen, and something is changing, and under prefers-reduced-motion it
 * draws one still frame per state.
 */
export function CrtMonitor({ channels, className, ariaLabel = "terminal" }: CrtMonitorProps) {
  const count = channels.length;
  // The knob's angle is the one source of truth for the channel: unbounded
  // degrees, never wrapped, so the dial keeps the turns it has done.
  const [angle, setAngleState] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [on, setOn] = useState(true);
  const [hover, setHover] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [glOk, setGlOk] = useState(true);
  const [tint, setTint] = useState<[number, number, number] | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const renderer = useRef<CrtRenderer | null>(null);
  const raf = useRef<number | null>(null);
  const visible = useRef(true);
  const reduced = useRef(false);
  // Animation timeline, kept out of React state so a frame never re-renders.
  const timeline = useRef({ powerFrom: 1, powerTo: 1, powerAt: 0, burstAt: -Infinity, glitchAt: -Infinity });
  const snow = useRef(0);
  const invert = useRef(false);
  const wantsOn = useRef(true);
  const angleRef = useRef(0);
  const drag = useRef<{ pointerId: number; last: number; moved: number } | null>(null);
  const shakeTimer = useRef<number | null>(null);
  // The shader gets time since mount, not performance.now(): a float32 uniform
  // holding hours of milliseconds loses the fine bits every hash and sine
  // depends on, and a tab left open overnight came back with garbage grain.
  const start = useRef<number | null>(null);

  const channel = channelAt(angle, count);
  const current = channels[channel] ?? channels[0];
  const snowing = staticAmount(angle, count) > 0.5;

  const setAngle = useCallback((next: number) => {
    angleRef.current = next;
    setAngleState(next);
  }, []);

  /* ── the tube ─────────────────────────────────────────────────────────── */

  const draw = useCallback((now: number) => {
    const r = renderer.current;
    if (!r) return false;
    const t = timeline.current;
    if (start.current === null) start.current = now;
    const p = Math.min(1, (now - t.powerAt) / POWER_MS);
    const power = reduced.current ? t.powerTo : t.powerFrom + (t.powerTo - t.powerFrom) * ease(p);
    const burst = reduced.current ? 0 : Math.max(0, 1 - (now - t.burstAt) / BURST_MS);
    // The bars hold at full for most of the glitch, then drop out fast.
    const g = (now - t.glitchAt) / GLITCH_MS;
    const glitch = reduced.current || g >= 1 ? 0 : g < 0.7 ? 1 : 1 - (g - 0.7) / 0.3;
    r.render({
      time: (now - start.current) / 1000,
      power,
      snow: Math.max(burst, snow.current),
      glitch,
      invert: invert.current ? 1 : 0,
      motion: reduced.current ? 0 : 1,
    });
    // Whether another frame is worth drawing.
    return power > 0 && (!reduced.current || p < 1 || burst > 0 || glitch > 0);
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
      if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
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
      r.setPicture(null);
      setTint(null);
      return;
    }
    loadPicture(current.src).then((pic) => {
      if (cancelled || !renderer.current) return;
      if (pic) {
        renderer.current.setPicture(pic);
        setTint(pic.tint);
      } else {
        renderer.current.setPicture(null);
        setTint(null);
      }
      kick();
    });
    return () => {
      cancelled = true;
    };
  }, [current?.src, kick]);

  // Off-station static follows the knob.
  useEffect(() => {
    snow.current = staticAmount(angle, count);
    kick();
  }, [angle, count, kick]);

  /* ── controls ─────────────────────────────────────────────────────────── */

  /** Turn the knob to an angle with the set's usual burst of static. */
  const turnTo = useCallback(
    (next: number) => {
      if (next === angleRef.current) return;
      setAngle(next);
      timeline.current.burstAt = performance.now();
      kick();
    },
    [kick, setAngle],
  );

  const step = useCallback(
    (direction: 1 | -1) => turnTo(angleRef.current + direction * detentStep(count)),
    [count, turnTo],
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
      kick();
    },
    [kick],
  );

  const onKnobPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const knob = knobRef.current;
    if (!knob || count === 0) return;
    const rect = knob.getBoundingClientRect();
    const at = pointerAngle(rect.left + rect.width / 2, rect.top + rect.height / 2, e.clientX, e.clientY);
    drag.current = { pointerId: e.pointerId, last: at, moved: 0 };
    knob.setPointerCapture(e.pointerId);
  };

  const onKnobPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const knob = knobRef.current;
    if (!d || !knob || d.pointerId !== e.pointerId) return;
    const rect = knob.getBoundingClientRect();
    const at = pointerAngle(rect.left + rect.width / 2, rect.top + rect.height / 2, e.clientX, e.clientY);
    const delta = deltaAngle(d.last, at);
    d.last = at;
    d.moved += Math.abs(delta);
    if (d.moved < DRAG_THRESHOLD_DEG) return;
    if (!dragging) setDragging(true);
    setAngle(angleRef.current + delta);
  };

  const onKnobPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    knobRef.current?.releasePointerCapture(e.pointerId);
    setDragging(false);
    if (d.moved >= DRAG_THRESHOLD_DEG) {
      // Let go: the knob falls into the nearest detent.
      setAngle(snapAngle(angleRef.current, count));
    } else {
      // A plain press clicks the knob round one stop.
      step(1);
    }
  };

  const onKnobKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      turnTo(angleForChannel(angleRef.current, 0, count));
    } else if (e.key === "End") {
      e.preventDefault();
      turnTo(angleForChannel(angleRef.current, count - 1, count));
    }
  };

  // Hovering the glass kicks the set. Touch has no hover — a tap is the
  // click, and a glitch before every open would be in the way.
  const onGlassEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !on) return;
    invert.current = true;
    timeline.current.glitchAt = performance.now();
    setHover(true);
    setShaking(true);
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => setShaking(false), SHAKE_MS);
    kick();
  };

  const onGlassLeave = () => {
    if (!invert.current) return;
    // Straight back to the picture: no bars, no shake, just the colours.
    invert.current = false;
    timeline.current.glitchAt = -Infinity;
    setHover(false);
    kick();
  };

  if (count === 0) return null;

  const screenLabel = on ? `open ${current.title}` : "switch on";
  const glow = lightColour(snowing || !tint ? STATIC_TINT : hover ? invertTint(tint) : tint);
  const stageStyle = { "--crt-glow": glow, "--crt-lit": on ? 1 : 0 } as CSSProperties;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("crt-stage relative mx-auto w-full max-w-[480px]", shaking && "crt-stage--kick", className)}
      style={stageStyle}
    >
      <style precedence="default" href="crt-monitor">{CSS}</style>

      <div className="relative">
        {/* The room: what the lit tube throws on the wall behind the set. */}
        <div aria-hidden className="crt-room" />

        <div className={cn("crt-set relative z-[1] w-full @container", shaking && "crt-shake")} style={{ aspectRatio: BEZEL_ASPECT }}>
          {/* The glass: a canvas behind the hole in the bezel. */}
          <div ref={screenRef} className="absolute overflow-hidden bg-black" style={SCREEN}>
            {glOk ? (
              <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
            ) : (
              <Fallback channel={current} on={on} snowing={snowing} inverted={hover} />
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
          {/* The glass lighting the plastic round it; masked to the cabinet. */}
          <div aria-hidden className="crt-bezel-light absolute inset-0 z-[11]" />

          {/* The glass as a link, over the bezel so it can be clicked. */}
          {on && current.href ? (
            <a
              href={current.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={screenLabel}
              onPointerEnter={onGlassEnter}
              onPointerLeave={onGlassLeave}
              className="crt-glass absolute z-20 outline-none"
              style={SCREEN}
            />
          ) : (
            <button
              type="button"
              aria-label={screenLabel}
              onClick={() => !on && setPower(true)}
              onPointerEnter={onGlassEnter}
              onPointerLeave={onGlassLeave}
              className="crt-glass absolute z-20 outline-none"
              style={SCREEN}
            />
          )}

          {/* The channel knob, at the left end of the bezel's bottom band. */}
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
              "crt-knob absolute z-20 size-[max(28px,6.8cqw)] touch-none select-none rounded-full outline-none",
              "focus-visible:ring-[0.3cqw] focus-visible:ring-black/40",
            )}
            style={KNOB}
          >
            <div
              aria-hidden
              className={cn(
                "crt-knob-cap absolute inset-0 rounded-full",
                !dragging && "transition-transform duration-[260ms] ease-[cubic-bezier(0.2,0.9,0.3,1.15)] motion-reduce:transition-none",
              )}
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <span className="absolute left-1/2 top-[9%] h-[30%] w-[8%] -translate-x-1/2 rounded-full bg-[#3f3b35]" />
            </div>
          </div>

          {/* The power button, on the LED slot at the right end. */}
          <button
            type="button"
            onClick={() => setPower(!on)}
            aria-pressed={on}
            aria-label={on ? "switch off" : "switch on"}
            className={cn(
              "crt-power absolute z-20 flex size-[max(22px,5.4cqw)] items-center justify-center rounded-full outline-none",
              "focus-visible:ring-[0.3cqw] focus-visible:ring-black/40",
              on && "crt-power--on",
            )}
            style={POWER}
          >
            <Power aria-hidden strokeWidth={2.75} className="size-[52%]" />
          </button>
        </div>

        {/* The floor: the set's shadow, and the light it throws in front. */}
        <div aria-hidden className="crt-floor" />
      </div>

      {/* Room below for the pool of light on the floor: the pool's bottom is
          38% of the set's height past its foot, and the set is 991/1200 of
          this width tall. A percentage padding resolves against the containing
          block's width, so it lives on a child of the stage — on the stage
          itself it measured the section and reserved three times this. */}
      <div aria-hidden className="pt-[31%]" />
    </div>
  );
}

/** No WebGL: the flat image with the effects approximated in CSS. */
function Fallback({
  channel,
  on,
  snowing,
  inverted,
}: {
  channel: CrtChannel;
  on: boolean;
  snowing: boolean;
  inverted: boolean;
}) {
  return (
    <div className={cn("crt-fallback absolute inset-0 transition-opacity duration-300", !on && "opacity-0")}>
      {channel.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={channel.src}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ imageRendering: "pixelated", filter: inverted ? "invert(1)" : undefined, opacity: snowing ? 0 : 1 }}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-xs lowercase text-white/40">
          {channel.title}
        </span>
      )}
      <Grain variant="noise" fixed={false} opacity={snowing ? 0.9 : 0.14} animate />
    </div>
  );
}

/** The wall colour for a picture's tint: lifted toward white, as a lit screen is. */
function lightColour([r, g, b]: [number, number, number]): string {
  const lift = (c: number) => Math.round(c + (255 - c) * 0.22);
  return `${lift(r)} ${lift(g)} ${lift(b)}`;
}

function invertTint([r, g, b]: [number, number, number]): [number, number, number] {
  return [255 - r, 255 - g, 255 - b];
}

const CSS = `
@keyframes crt-shake {
  0% { transform: translate(0, 0); }
  15% { transform: translate(-1.5px, 1px) rotate(-0.15deg); }
  30% { transform: translate(1.5px, -1px) rotate(0.15deg); }
  45% { transform: translate(-1px, -1px); }
  60% { transform: translate(1px, 1px) rotate(-0.1deg); }
  75% { transform: translate(-0.5px, 0.5px); }
  100% { transform: translate(0, 0); }
}
@keyframes crt-flash {
  0% { filter: brightness(1); }
  20% { filter: brightness(1.9); }
  60% { filter: brightness(1.6); }
  100% { filter: brightness(1); }
}
@keyframes crt-breathe {
  0% { filter: brightness(1); }
  37% { filter: brightness(1.05); }
  52% { filter: brightness(0.97); }
  71% { filter: brightness(1.03); }
  100% { filter: brightness(1); }
}
.crt-glass { cursor: pointer; }
.crt-glass:focus-visible { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.6); }
.crt-shake { animation: crt-shake ${SHAKE_MS}ms linear; }

/* What the tube throws into the room. Colour rides on currentColor so a
   change of channel fades the light rather than cutting it. */
.crt-room, .crt-floor, .crt-bezel-light {
  pointer-events: none;
  color: rgb(var(--crt-glow));
  transition: color 700ms ease, opacity 600ms ease;
}
.crt-room {
  position: absolute;
  left: -50%; right: -50%; top: -45%; bottom: -30%;
  opacity: var(--crt-lit);
  background: radial-gradient(ellipse 42% 40% at 50% 44%,
    color-mix(in srgb, currentColor 78%, transparent) 0%,
    color-mix(in srgb, currentColor 32%, transparent) 38%,
    color-mix(in srgb, currentColor 8%, transparent) 62%,
    transparent 76%);
  animation: crt-breathe 5s ease-in-out infinite;
}
/* The pool on the floor is a lobe centred on the set's foot (42% down this
   box is the set's 100%). It has no top edge: the mask fades it in over the
   set's lower quarter, where the wall's glow is still fading out, so the two
   lights meet without a seam. The old lobe started at the band with its
   centre two points below its own top, and drew a hard line either side of
   the set. */
.crt-floor {
  position: absolute;
  left: -50%; right: -50%; top: 72%; height: 66%;
  opacity: var(--crt-lit);
  background:
    radial-gradient(ellipse 24% 24% at 50% 42%,
      color-mix(in srgb, currentColor 70%, white) 0%,
      transparent 100%),
    radial-gradient(ellipse 50% 58% at 50% 42%,
      color-mix(in srgb, currentColor 92%, transparent) 0%,
      color-mix(in srgb, currentColor 55%, transparent) 30%,
      color-mix(in srgb, currentColor 22%, transparent) 58%,
      transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 42%);
  mask-image: linear-gradient(to bottom, transparent, #000 42%);
  animation: crt-breathe 5s ease-in-out infinite 1.3s;
}
/* The set stands on the floor: a contact shadow under its foot. */
.crt-floor::before {
  content: "";
  position: absolute;
  left: 32%; right: 32%; top: 40%; height: 5%;
  background: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 45%, transparent 70%);
}
.crt-bezel-light {
  opacity: calc(var(--crt-lit) * 0.5);
  mix-blend-mode: screen;
  background: radial-gradient(ellipse 44% 40% at 51% 49%,
    color-mix(in srgb, currentColor 62%, transparent) 0%,
    color-mix(in srgb, currentColor 24%, transparent) 55%,
    transparent 82%);
  -webkit-mask-image: url("/crt/monitor.webp");
  mask-image: url("/crt/monitor.webp");
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}
.crt-stage--kick .crt-room, .crt-stage--kick .crt-floor {
  animation: crt-flash ${GLITCH_MS}ms linear;
}

/* Both controls sit on the tilted band. translate centres each on its
   measured point and --tilt turns it to the plastic: the 2D rotate is the
   band's slope there, the perspective turn is the end of the case receding.
   The offset stays in the translate property and the turn in transform so
   :active can add to one without touching the other — a transform that
   restated the offset on top of the utility's translate once jumped the
   power button half its width on every press. */
.crt-knob, .crt-power { translate: -50% -50%; }
/* A moulded knob in the same beige as the case: a short cylinder seen from
   a little above, so its side shows under the cap. The side and the drop
   shadow live on the base, which never turns; only the cap rotates. */
.crt-knob {
  --tilt: rotate(6deg) perspective(180px) rotateX(14deg) rotateY(-22deg);
  transform: var(--tilt);
  background: #b3ad9f;
  box-shadow:
    0 1px 0 #a39d8f,
    0 2px 0 #9a9486,
    0 3px 0 #8f897c,
    0 4px 4px rgba(0,0,0,0.5),
    0 0 0 1px rgba(0,0,0,0.12);
  cursor: grab;
}
.crt-knob:active { cursor: grabbing; }
.crt-knob-cap {
  background: radial-gradient(circle at 50% 32%, #ece7dc 0%, #d6d0c3 48%, #bcb6a8 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.85),
    inset 0 -2px 3px rgba(0,0,0,0.2);
}
/* Grip ridges round the rim of the cap. */
.crt-knob-cap::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, rgba(0,0,0,0.13) 0deg 5deg, transparent 5deg 12deg);
  -webkit-mask-image: radial-gradient(circle, transparent 64%, #000 67%);
  mask-image: radial-gradient(circle, transparent 64%, #000 67%);
}
/* The power button: a round push button in the same plastic, with its
   symbol lit green while the set is on. */
.crt-power {
  --tilt: rotate(-6deg) perspective(180px) rotateX(14deg) rotateY(22deg);
  transform: var(--tilt);
  color: #4a463f;
  background: radial-gradient(circle at 50% 32%, #e8e3d8 0%, #d1cbbe 55%, #b7b1a3 100%);
  box-shadow:
    0 1px 0 #a39d8f,
    0 2px 0 #9a9486,
    0 3px 3px rgba(0,0,0,0.45),
    inset 0 1px 0 rgba(255,255,255,0.8);
  transition: color 300ms, transform 80ms, box-shadow 80ms;
}
/* Pressed: the cap sinks into the case, so its side shortens and it shrinks a
   touch, along the same tilt. */
.crt-power:active {
  transform: var(--tilt) scale(0.95);
  box-shadow: 0 1px 0 #a39d8f, 0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.6);
}
.crt-power--on {
  color: #2fd36a;
  filter: drop-shadow(0 0 3px rgba(60,230,110,0.9));
}
.crt-fallback {
  background:
    repeating-linear-gradient(to bottom, rgba(255,255,255,0) 0 2px, rgba(0,0,0,0.35) 2px 3px),
    #050606;
}
@media (prefers-reduced-motion: reduce) {
  .crt-shake, .crt-room, .crt-floor, .crt-stage--kick .crt-room, .crt-stage--kick .crt-floor { animation: none; }
}
`;
