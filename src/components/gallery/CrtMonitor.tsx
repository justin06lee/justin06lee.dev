"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { Grain } from "@/components/chrome/grain";
import { createCrtRenderer, loadPicture, sourceTint, type CrtRenderer } from "./crt-gl";
import { createSpeaker, type Speaker } from "./crt-audio";
import {
  angleForChannel,
  channelAt,
  detentStep,
  pointerTurn,
  snapAngle,
  staticAmount,
  wheelDetents,
} from "./crt-dial";

export type CrtChannel = {
  id: string;
  title: string;
  src: string | null;
  href?: string;
  /** A clip from the project's repo (`assets/crt.mp4`) that plays on the glass, sound and all. */
  video?: string | null;
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
 *     the middle out to either end, and each end recedes. Each control is a
 *     short cylinder (a cap over a stack of discs) turned to the plastic by
 *     `--tilt`: a 2D rotate by the band's slope there, then a perspective
 *     turn so the top of its side and the side facing the middle of the set
 *     show — the left of the power button, the right of the knob — as they
 *     would from where the camera stood. Re-cutting the photo means
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
/** How often the clip's colour is re-read for the room light. */
const TINT_MS = 600;
/**
 * Frame budget. When frames run longer than this on average the tube draws
 * at a smaller scale (down to MIN_RENDER_SCALE of device pixels) rather than
 * stutter: the effect is scanlines and grain, and reads the same a little
 * soft, while a dropped frame reads as a broken set.
 */
const SLOW_FRAME_MS = 24;
const MIN_RENDER_SCALE = 0.75;
/** The clip dips under a glitch so the burst is heard, then comes back. */
const DUCK_MS = 320;
const DUCK_LEVEL = 0.3;
/** A press that travels less than this is a click, not a turn of the knob. */
const CLICK_TRAVEL_DEG = 6;
/**
 * The sound comes from the set, not the page. It is heard in full while the
 * set's middle is within this share of the viewport's height of the
 * viewport's middle, and then falls off over the next FALLOFF_VIEWPORTS
 * of height to nothing. Short on purpose: the store is the last hang, so at
 * the foot of the page the set is barely a viewport away, and that has to be
 * far enough to have walked out of the room.
 */
const HEARD_VIEWPORTS = 0.25;
const FALLOFF_VIEWPORTS = 0.5;
/**
 * A touch screen has no hover, so on one it is *scrolling* that asks for the
 * project's picture: the clip dissolves into it as the set comes to the middle
 * of the view and back out again as it leaves. Both are shares of the
 * viewport's height — the picture is whole while the set's middle is within
 * PICTURE_HOLD of the view's middle, and the dissolve takes DISSOLVE_SPAN
 * either side of that. The hold is what makes it legible: without it the
 * picture is only ever whole for the one frame the set crosses the middle.
 */
const PICTURE_HOLD = 0.06;
const DISSOLVE_SPAN = 0.42;
/**
 * A hover can't happen here, so the affordances a pointer gets — the kick, the
 * picture, and the fact that the glass is a link at all — have to be offered
 * some other way. `(hover: none)` is the honest test, and the width term is
 * there so a desktop window pulled down to a phone's size shows the same thing
 * rather than looking broken.
 */
const TOUCH_QUERY = "(hover: none), (max-width: 767px)";
/** How far the dissolve moves before the room's colour is written again. */
const GLOW_STEP = 0.05;
/** The discs behind each control's cap that make its side, deepest last. */
const SIDE_LAYERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
/** What static throws on the wall. */
const STATIC_TINT: [number, number, number] = [200, 200, 200];

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smoothstep = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/**
 * The terminal pieces, playing on one small old monitor in a dark room.
 *
 * The knob on the bezel is a rotary channel selector: drag it round, click
 * it to step on one, or use the arrow keys once it has focus. It turns all
 * the way round, so the last channel clicks straight on to the first.
 * Between two detents the set is off-station and shows static; land on one
 * and it shows that project. Nothing is printed on the bezel and nothing is
 * written on the glass: the picture is the label, and the knob's
 * aria-valuetext carries the name for assistive tech.
 *
 * A channel whose repo carries a clip (`assets/crt.mp4`) plays it, sound
 * and all, and when the clip ends the knob steps on to the next channel by
 * itself. Browsers only allow sound after a gesture, so a clip that can't
 * start with sound starts silent and the first click or key anywhere on the
 * page turns it up. Hovering the glass kicks the set — a burst of colour
 * bars and a shake — and then shows the project's picture, as shot, until
 * the pointer leaves, when the same kick brings the clip back. The clip
 * never stops for a hover: it keeps playing behind the picture, so its
 * sound carries on and no time is lost. A channel with no clip has only its
 * picture, so there the hover shows it with its colours inverted and leaving
 * simply restores them. The glass is a link to the project — a real anchor,
 * so middle-click and "open in new tab" behave. Power switches the set off
 * with the raster collapse a tube actually did (and pauses the clip), and
 * clicking the dark glass turns it back on.
 *
 * The set lights the room: a glow behind it, light on the bezel's plastic,
 * and a pool on the floor in front, all in the colour the glass throws
 * (measured when the picture loads, and every few hundred milliseconds
 * from a playing clip). Everything on the glass is drawn by `crt-gl`;
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
  const [on, setOn] = useState(true);
  const [hover, setHover] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [glOk, setGlOk] = useState(true);
  const [still, setStill] = useState(false);
  const [tint, setTint] = useState<[number, number, number] | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  // No hover here, so the set offers the picture on scroll and an open button
  // under the cabinet instead. Read after mount, so the markup matches.
  const [touch, setTouch] = useState(false);
  // Only for the no-WebGL fallback, which crosses in CSS and so needs the
  // dissolve as a boolean; the shader gets the continuous value from a ref.
  const [pictured, setPictured] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLSpanElement>(null);
  const speaker = useRef<Speaker | null>(null);
  // How loud the room hears the set right now (the scroll falloff), and the
  // dip under a glitch; the clip's volume is their product.
  const level = useRef(1);
  const duck = useRef(1);
  const duckTimer = useRef<number | null>(null);
  const wheelCarry = useRef(0);
  // The colour the clip is throwing, and what the glow was last computed
  // from. The room's colour is written straight to a CSS variable from the
  // draw loop, never through state: a re-render every sample re-diffed the
  // whole set for one property.
  const videoTint = useRef<[number, number, number] | null>(null);
  const glowInputs = useRef({ snowing: false, showingVideo: false, hover: false, hasClip: false, tint: null as [number, number, number] | null });
  // Render scale (a cap on device pixels) and the frame-time average that
  // lowers it; `resizeRef` is how the loop asks the mount effect to re-size.
  const renderScale = useRef(2);
  const frameMs = useRef(16);
  const lastFrameAt = useRef(0);
  const lastDropAt = useRef(0);
  const resizeRef = useRef<(() => void) | null>(null);
  const lastStatic = useRef(-1);
  // How much of the project's picture has dissolved over the clip (0 the clip,
  // 1 the picture), the mix the shader was last given, and the mix the room
  // was last lit from. All refs: the dissolve moves on every scroll frame, and
  // none of it is worth a render.
  const pictureMix = useRef(0);
  const lastMix = useRef(-1);
  const lastGlowMix = useRef(-1);
  const touchRef = useRef(false);
  const renderer = useRef<CrtRenderer | null>(null);
  const raf = useRef<number | null>(null);
  const visible = useRef(true);
  const reduced = useRef(false);
  // Animation timeline, kept out of React state so a frame never re-renders.
  const timeline = useRef({ powerFrom: 1, powerTo: 1, powerAt: 0, burstAt: -Infinity, glitchAt: -Infinity });
  const snow = useRef(0);
  const invert = useRef(false);
  const hovering = useRef(false);
  // What the draw loop does with the clip, mirrored out of React state so a
  // frame never re-renders: whether to upload it, when it last did, and the
  // last colour it read off it.
  const uploadVideo = useRef(false);
  const lastVideoTime = useRef(-1);
  const lastTintAt = useRef(0);
  const wantsOn = useRef(true);
  const angleRef = useRef(0);
  // The angle React last rendered from. During a drag the cap turns on its
  // own (a style write, not a render) and state only follows when the channel
  // or the static would change, so a 120Hz pointer doesn't re-render the set.
  const shownAngle = useRef(0);
  const drag = useRef<{ pointerId: number; last: number; moved: number; from: number; cx: number; cy: number; radius: number } | null>(null);
  const shakeTimer = useRef<number | null>(null);
  // The shader gets time since mount, not performance.now(): a float32 uniform
  // holding hours of milliseconds loses the fine bits every hash and sine
  // depends on, and a tab left open overnight came back with garbage grain.
  const start = useRef<number | null>(null);

  const channel = channelAt(angle, count);
  const current = channels[channel] ?? channels[0];
  const snowing = staticAmount(angle, count) > 0.5;
  // A clip plays only where motion is allowed; under reduced motion the
  // channel is its picture. `hasClip` decides what a hover does, `showingVideo`
  // what the glass shows right now.
  const hasClip = Boolean(current?.video) && !still;
  const showingVideo = hasClip && videoReady && !hover;
  const hasClipRef = useRef(hasClip);
  hasClipRef.current = hasClip;
  glowInputs.current = { snowing, showingVideo, hover, hasClip, tint };

  /**
   * The colour the set throws into the room, written to the stage's CSS
   * variable: the clip's when the clip shows, otherwise the picture's, grey
   * for static, inverted for the inverted hover.
   */
  const applyGlow = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const g = glowInputs.current;
    const colour = g.snowing
      ? STATIC_TINT
      : g.showingVideo && videoTint.current
        // Mid-dissolve the room is lit by both, in the same proportion as the
        // glass: the light and what throws it can't disagree.
        ? g.tint
          ? mixTint(videoTint.current, g.tint, pictureMix.current)
          : videoTint.current
        : !g.tint
          ? STATIC_TINT
          : g.hover && !g.hasClip
            ? invertTint(g.tint)
            : g.tint;
    stage.style.setProperty("--crt-glow", lightColour(colour));
  }, []);

  // Before paint, so the room is never a frame without its colour.
  useLayoutEffect(() => {
    applyGlow();
  }, [snowing, showingVideo, hover, hasClip, tint, applyGlow]);

  /** The clip's volume: how loud the room hears the set, dipped under a glitch. */
  const applyVolume = useCallback(() => {
    const v = videoRef.current;
    if (v) v.volume = level.current * duck.current;
  }, []);

  /** Turn the cap to `deg` without a render. */
  const rotateCap = (deg: number) => {
    const cap = capRef.current;
    if (cap) cap.style.transform = `translateZ(0) rotate(${deg}deg)`;
  };

  const setAngle = useCallback((next: number) => {
    angleRef.current = next;
    shownAngle.current = next;
    rotateCap(next);
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
    // The dissolve between the clip and the picture. Written when it moves,
    // not every frame: on a still page it never moves, and on a pointer it
    // only ever takes the two ends.
    const mix = uploadVideo.current ? 1 - pictureMix.current : 0;
    if (mix !== lastMix.current) {
      lastMix.current = mix;
      r.setVideoMix(mix);
      // The room follows in steps rather than per frame — the lights carry a
      // 700ms colour transition, so rewriting them every frame would restart
      // it every frame and recalculate style for a change nobody can see.
      if (Math.abs(mix - lastGlowMix.current) > GLOW_STEP || mix === 0 || mix === 1) {
        lastGlowMix.current = mix;
        applyGlow();
      }
    }
    // The clip: upload a frame when it has a new one, and every so often
    // read its colour for the room. Nothing to do while it is fully dissolved
    // away — it plays on, and its next visible frame is uploaded then.
    const v = videoRef.current;
    if (uploadVideo.current && mix > 0 && v && v.readyState >= 2) {
      if (v.currentTime !== lastVideoTime.current) {
        lastVideoTime.current = v.currentTime;
        r.setVideoFrame(v);
      }
      if (now - lastTintAt.current > TINT_MS) {
        lastTintAt.current = now;
        const colour = sourceTint(v);
        const prev = videoTint.current;
        if (colour && !(prev && prev.every((c, i) => c === colour[i]))) {
          videoTint.current = colour;
          applyGlow();
        }
      }
    }
    // What the speaker hisses: the static on the glass, fading with the raster.
    const hiss = Math.max(burst, snow.current) * power;
    if (Math.abs(hiss - lastStatic.current) > 0.005 || (hiss === 0) !== (lastStatic.current === 0)) {
      lastStatic.current = hiss;
      speaker.current?.setStatic(hiss);
    }
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
  }, [applyGlow]);

  const loop = useCallback(() => {
    raf.current = null;
    if (!visible.current) return;
    const now = performance.now();
    // Frame time, smoothed; a gap over a quarter second is a hidden tab or
    // a stalled machine, not a slow frame, and is left out.
    const dt = now - lastFrameAt.current;
    lastFrameAt.current = now;
    if (dt > 0 && dt < 250) frameMs.current += (dt - frameMs.current) * 0.05;
    if (frameMs.current > SLOW_FRAME_MS && renderScale.current > MIN_RENDER_SCALE && now - lastDropAt.current > 2000) {
      renderScale.current = Math.max(MIN_RENDER_SCALE, renderScale.current * 0.75);
      lastDropAt.current = now;
      frameMs.current = 16;
      resizeRef.current?.();
    }
    const again = draw(now);
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
    setStill(media.matches);
    const onMedia = () => {
      reduced.current = media.matches;
      setStill(media.matches);
      kick();
    };
    media.addEventListener("change", onMedia);

    const touchMedia = window.matchMedia(TOUCH_QUERY);
    const onTouchMedia = () => {
      touchRef.current = touchMedia.matches;
      setTouch(touchMedia.matches);
      // A window dragged back over the breakpoint has a pointer again, so the
      // scrolled-in picture has to give the glass back to the hover.
      if (!touchMedia.matches && pictureMix.current !== 0) {
        pictureMix.current = 0;
        setPictured(false);
      }
      kick();
    };
    onTouchMedia();
    touchMedia.addEventListener("change", onTouchMedia);

    renderScale.current = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const scale = Math.min(renderScale.current, window.devicePixelRatio || 1);
      const rect = screen.getBoundingClientRect();
      r.resize(rect.width * scale, rect.height * scale);
      kick();
    };
    resizeRef.current = resize;
    const ro = new ResizeObserver(resize);
    ro.observe(screen);
    resize();

    const io = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      if (visible.current) kick();
    });
    io.observe(screen);

    // The speaker is built now, so a page the browser already trusts is heard
    // at once, and woken again on every gesture, which is when a browser that
    // insisted on one lets it run; the same gesture unmutes a clip that had
    // to start silent.
    speaker.current = createSpeaker();
    speaker.current.wake();
    const wake = () => {
      speaker.current?.wake();
      const v = videoRef.current;
      if (v) v.muted = false;
    };
    document.addEventListener("pointerdown", wake, { capture: true, passive: true });
    document.addEventListener("keydown", wake, { capture: true, passive: true });

    // The sound comes from the set: full while it is near the middle of the
    // view, then falling off with how far its middle has gone, to nothing.
    let measuring: number | null = null;
    const measure = () => {
      measuring = null;
      const set = setRef.current;
      if (!set) return;
      const rect = set.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const cy = rect.top + rect.height / 2;
      const cx = rect.left + rect.width / 2;
      const dy = Math.max(0, Math.abs(cy - vh / 2) - HEARD_VIEWPORTS * vh);
      const dx = Math.max(0, Math.abs(cx - vw / 2) - vw / 2);
      const away = Math.hypot(dx, dy) / (FALLOFF_VIEWPORTS * vh);
      const heard = Math.pow(Math.max(0, 1 - away), 1.5);
      level.current = heard;
      speaker.current?.setLevel(heard);
      applyVolume();

      // ...and on a touch screen, so does the picture. Same measurement, its
      // own curve: a hold at the middle wide enough to read the picture in,
      // and a smoothstep so the dissolve starts and ends softly rather than
      // beginning the moment the set appears.
      const near = touchRef.current
        ? smoothstep(1 - (Math.abs(cy - vh / 2) / vh - PICTURE_HOLD) / DISSOLVE_SPAN)
        : 0;
      if (near !== pictureMix.current) {
        pictureMix.current = near;
        setPictured(near > 0.5);
        kick();
      }
    };
    const onScroll = () => {
      if (measuring === null) measuring = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    measure();

    return () => {
      media.removeEventListener("change", onMedia);
      touchMedia.removeEventListener("change", onTouchMedia);
      ro.disconnect();
      io.disconnect();
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
      if (measuring !== null) cancelAnimationFrame(measuring);
      if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
      if (duckTimer.current !== null) window.clearTimeout(duckTimer.current);
      resizeRef.current = null;
      document.removeEventListener("pointerdown", wake, { capture: true });
      document.removeEventListener("keydown", wake, { capture: true });
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      speaker.current?.destroy();
      speaker.current = null;
      r.destroy();
      renderer.current = null;
    };
  }, [kick, applyVolume]);

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

  /**
   * Start the clip with sound. Browsers refuse that until the page has had a
   * gesture, so on refusal it starts silent; the page's first pointer or key
   * (the `wake` listener above) turns the sound on.
   */
  const playVideo = useCallback((v: HTMLVideoElement) => {
    applyVolume();
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => {});
    });
  }, [applyVolume]);

  // The channel's clip. It plays whenever the set is on, hovered or not: the
  // picture over it during a hover is another source on the same glass, not
  // a pause, so the sound carries on and no time is lost.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setVideoReady(false);
    videoTint.current = null;
    applyGlow();
    lastVideoTime.current = -1;
    const src = current?.video;
    if (!src || still) {
      v.pause();
      v.removeAttribute("src");
      v.load();
      return;
    }
    v.src = src;
    v.load();
    if (wantsOn.current) playVideo(v);
  }, [current?.video, still, playVideo, applyGlow]);

  // Whether the clip is a source on the glass at all. How much of it shows is
  // the dissolve, and that is the draw loop's business — it moves on scroll
  // frames, which must not be renders.
  useEffect(() => {
    uploadVideo.current = showingVideo;
    kick();
  }, [showingVideo, kick]);

  const onVideoReady = () => {
    setVideoReady(true);
    // The clip comes up through a little static, as a station does.
    timeline.current.burstAt = performance.now();
    kick();
  };

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
      // Off is off: the clip waits.
      const v = videoRef.current;
      if (v && v.getAttribute("src")) {
        if (next) playVideo(v);
        else v.pause();
      }
      kick();
    },
    [kick, playVideo],
  );

  const onKnobPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const knob = knobRef.current;
    if (!knob || count === 0) return;
    // The knob's box is untransformed (the tilt is on the cylinder inside
    // it), so its centre is the true centre, measured once: the cabinet
    // shakes and the cap turns during a drag, and a centre re-read every
    // sample wandered with them.
    const rect = knob.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const at = pointerTurn(0, cx, cy, rect.width / 2, e.clientX, e.clientY).last;
    drag.current = { pointerId: e.pointerId, last: at, moved: 0, from: angleRef.current, cx, cy, radius: rect.width / 2 };
    // Capture keeps the turn going when the pointer leaves the small knob;
    // a pointer that has already gone (or a synthetic one) throws, and the
    // drag still works without it.
    try {
      knob.setPointerCapture(e.pointerId);
    } catch {}
    const cap = capRef.current;
    if (cap) cap.style.transition = "none";
  };

  const onKnobPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const turn = pointerTurn(d.last, d.cx, d.cy, d.radius, e.clientX, e.clientY);
    d.last = turn.last;
    if (turn.delta === 0) return;
    d.moved += Math.abs(turn.delta);
    // Follow the pointer one to one, in the DOM; render only when the set
    // would change what it shows.
    const next = angleRef.current + turn.delta;
    angleRef.current = next;
    rotateCap(next);
    snow.current = staticAmount(next, count);
    kick();
    const shown = shownAngle.current;
    if (channelAt(next, count) !== channelAt(shown, count) || staticAmount(next, count) > 0.5 !== staticAmount(shown, count) > 0.5) {
      shownAngle.current = next;
      setAngleState(next);
    }
  };

  const onKnobPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    try {
      knobRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
    const cap = capRef.current;
    if (cap) cap.style.transition = "";
    if (d.moved >= CLICK_TRAVEL_DEG) {
      // Let go: the knob falls into the nearest detent.
      setAngle(snapAngle(angleRef.current, count));
    } else {
      // A plain press clicks the knob round one stop from where it started.
      turnTo(d.from + detentStep(count));
    }
  };

  // The wheel turns the knob too, a detent at a time. Attached by hand so it
  // can be non-passive: rolling a dial should not also scroll the page.
  useEffect(() => {
    const knob = knobRef.current;
    if (!knob) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      const { carry, steps } = wheelDetents(wheelCarry.current, px);
      wheelCarry.current = carry;
      if (steps !== 0) turnTo(angleRef.current + steps * detentStep(count));
    };
    knob.addEventListener("wheel", onWheel, { passive: false });
    return () => knob.removeEventListener("wheel", onWheel);
  }, [count, turnTo]);

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
  const kickSet = () => {
    timeline.current.glitchAt = performance.now();
    speaker.current?.glitch();
    // The clip dips under the burst, so the burst is what is heard.
    duck.current = DUCK_LEVEL;
    applyVolume();
    if (duckTimer.current !== null) window.clearTimeout(duckTimer.current);
    duckTimer.current = window.setTimeout(() => {
      duck.current = 1;
      applyVolume();
    }, DUCK_MS);
    setShaking(true);
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => setShaking(false), SHAKE_MS);
    kick();
  };

  const onGlassEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !on) return;
    hovering.current = true;
    // A channel with a clip shows its picture as shot; one without has only
    // its picture, so that one inverts.
    invert.current = !hasClipRef.current;
    setHover(true);
    kickSet();
  };

  const onGlassLeave = () => {
    if (!hovering.current) return;
    hovering.current = false;
    invert.current = false;
    setHover(false);
    if (hasClipRef.current) {
      // Back to the clip through the same kick it left by.
      kickSet();
    } else {
      // Straight back to the picture: no bars, no shake, just the colours.
      timeline.current.glitchAt = -Infinity;
      kick();
    }
  };

  if (count === 0) return null;

  const screenLabel = on ? `open ${current.title}` : "switch on";
  // No shader to dissolve with, so the fallback takes the halfway point as the
  // moment the picture wins.
  const fallbackVideo = showingVideo && !pictured;
  // --crt-glow is written by applyGlow, not here.
  const stageStyle = { "--crt-lit": on ? 1 : 0 } as CSSProperties;

  return (
    <div
      ref={stageRef}
      role="group"
      aria-label={ariaLabel}
      className={cn("crt-stage relative mx-auto w-full max-w-[480px]", shaking && "crt-stage--kick", className)}
      style={stageStyle}
    >
      <style precedence="default" href="crt-monitor">{CSS}</style>

      <div className="relative">
        {/* The room: what the lit tube throws on the wall behind the set. */}
        <div aria-hidden className="crt-room" />

        <div ref={setRef} className={cn("crt-set relative z-[1] w-full @container", shaking && "crt-shake")} style={{ aspectRatio: BEZEL_ASPECT }}>
          {/* The glass: a canvas behind the hole in the bezel. */}
          <div ref={screenRef} className="absolute overflow-hidden bg-black" style={SCREEN}>
            {/* The clip. The shader reads it as a texture, so with WebGL it is
                kept out of sight but rendered (display:none stops some browsers
                decoding it); without WebGL it is the fallback's own picture
                layer, under the fallback's grain. */}
            <video
              ref={videoRef}
              aria-hidden
              playsInline
              preload="auto"
              crossOrigin="anonymous"
              onLoadedData={onVideoReady}
              onEnded={() => step(1)}
              onError={() => setVideoReady(false)}
              className={cn(
                "pointer-events-none absolute",
                glOk
                  ? "left-0 top-0 h-px w-px opacity-0"
                  : cn("inset-0 h-full w-full object-cover transition-opacity duration-300", fallbackVideo && on ? "opacity-100" : "opacity-0"),
              )}
            />
            {glOk ? (
              <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
            ) : (
              <Fallback channel={current} on={on} snowing={snowing} inverted={hover && !hasClip} imageHidden={fallbackVideo} />
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
          <div aria-hidden className="crt-bezel-light absolute z-[11]" />

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

          {/* The channel knob, at the left end of the bezel's bottom band: a
              cylinder whose cap turns. */}
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
            <span aria-hidden className="crt-cyl">
              {SIDE_LAYERS.map((i) => (
                <span key={i} className={cn("crt-cyl-side", i === SIDE_LAYERS.length && "crt-cyl-foot")} style={{ "--i": i } as CSSProperties} />
              ))}
              <span ref={capRef} className="crt-cyl-cap crt-knob-cap" style={{ transform: `translateZ(0) rotate(${angle}deg)` }}>
                <span className="absolute left-1/2 top-[9%] h-[30%] w-[8%] -translate-x-1/2 rounded-full bg-[#3f3b35]" />
              </span>
            </span>
          </div>

          {/* The power button, on the LED slot at the right end. */}
          <button
            type="button"
            onClick={() => setPower(!on)}
            aria-pressed={on}
            aria-label={on ? "switch off" : "switch on"}
            className={cn(
              "crt-power absolute z-20 size-[max(22px,5.4cqw)] rounded-full outline-none",
              "focus-visible:ring-[0.3cqw] focus-visible:ring-black/40",
              on && "crt-power--on",
            )}
            style={POWER}
          >
            <span aria-hidden className="crt-cyl">
              {SIDE_LAYERS.map((i) => (
                <span key={i} className={cn("crt-cyl-side", i === SIDE_LAYERS.length && "crt-cyl-foot")} style={{ "--i": i } as CSSProperties} />
              ))}
              <span className="crt-cyl-cap crt-power-cap flex items-center justify-center">
                <Power strokeWidth={2.75} className="size-[52%]" />
              </span>
            </span>
          </button>
        </div>

        {/* The floor: the set's shadow, and the light it throws in front. */}
        <div aria-hidden className="crt-floor" />

        {/* A pointer discovers the glass is a link by hovering it — the set
            kicks, the picture comes up, the cursor changes. None of that
            happens under a thumb, so on a touch screen the set gets a button
            that says so, standing in the pool of light it throws. Absolute
            over that pool rather than in flow: the room below is sized for the
            light, and a button in flow would push the store down by its whole
            height on every screen. */}
        {touch && on && current.href && (
          <div className="absolute inset-x-0 top-full z-[2] flex justify-center pt-[5%]">
            <a
              href={current.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={screenLabel}
              className="crt-open"
            >
              open
              <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={2.25} />
            </a>
          </div>
        )}
      </div>

      {/* Room below for the pool of light on the floor: the pool is bright
          for about 27% of the set's height past its foot (its box runs to
          38%, but the last of that is a tail on black), and the set is
          991/1200 of this width tall. A percentage padding resolves against
          the containing block's width, so it lives on a child of the stage —
          on the stage itself it measured the section and reserved three times
          this. Sized so the dark between the pool and the next hang matches
          the dark between the label and the set. */}
      <div aria-hidden className="pt-[22%]" />
    </div>
  );
}

/** No WebGL: the flat image with the effects approximated in CSS. */
function Fallback({
  channel,
  on,
  snowing,
  inverted,
  imageHidden,
}: {
  channel: CrtChannel;
  on: boolean;
  snowing: boolean;
  inverted: boolean;
  /** The clip is showing underneath, so the picture steps aside. */
  imageHidden: boolean;
}) {
  return (
    <div
      className={cn("crt-fallback absolute inset-0 transition-opacity duration-300", !on && "opacity-0")}
      style={imageHidden ? { background: "transparent" } : undefined}
    >
      {channel.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={channel.src}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            imageRendering: "pixelated",
            filter: inverted ? "invert(1)" : undefined,
            opacity: snowing || imageHidden ? 0 : 1,
          }}
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

/** `t` of the way from one tint to another, for the light mid-dissolve. */
function mixTint(
  from: [number, number, number],
  to: [number, number, number],
  t: number,
): [number, number, number] {
  const k = clamp01(t);
  return [
    Math.round(from[0] + (to[0] - from[0]) * k),
    Math.round(from[1] + (to[1] - from[1]) * k),
    Math.round(from[2] + (to[2] - from[2]) * k),
  ];
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
/* The three lights are painted at a quarter (the plastic at half) of their
   size and scaled up by the compositor: they are soft gradients, so the
   upscale is invisible, and a colour change (every clip sample, eased over
   700ms) then repaints a few thousand pixels instead of a few million.
   Painted full size, the room light alone was two megapixels of radial
   gradient re-rasterised on every frame of every transition. transform-origin
   is the box's own corner so the percentages below stay the full-size ones
   divided by the scale. */
/* The button under the set. Square, hard-edged, and lit by the set rather
   than by the page: its border and the block it sits on are the colour the
   glass is throwing, so it reads as a thing standing in that light rather than
   as a control pasted over it. Uppercase is deliberate here and nowhere else
   on the site — this is a label on a piece of hardware, and hardware is
   labelled in capitals. Pressing it moves it onto its own shadow, which is
   what a physical button does, and what a hover state can't say to a thumb. */
.crt-open {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.95rem;
  border: 1px solid color-mix(in srgb, rgb(var(--crt-glow)) 60%, transparent);
  background: #000;
  color: #fff;
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  box-shadow: 3px 3px 0 0 color-mix(in srgb, rgb(var(--crt-glow)) 30%, transparent);
  transition:
    transform 110ms ease,
    box-shadow 110ms ease,
    border-color 700ms ease;
}
.crt-open:active {
  transform: translate(3px, 3px);
  box-shadow: 0 0 0 0 color-mix(in srgb, rgb(var(--crt-glow)) 30%, transparent);
}
.crt-open:focus-visible {
  outline: 1px solid #fff;
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .crt-open { transition: none; }
}

.crt-room, .crt-floor, .crt-bezel-light {
  pointer-events: none;
  color: rgb(var(--crt-glow));
  transition: color 700ms ease, opacity 600ms ease;
  transform-origin: 0 0;
  will-change: transform;
}
.crt-room {
  position: absolute;
  left: -50%; top: -45%; width: 50%; height: 43.75%;
  transform: scale(4);
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
  left: -50%; top: 72%; width: 50%; height: 16.5%;
  transform: scale(4);
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
.crt-bezel-light {
  left: 0; top: 0; width: 50%; height: 50%;
  transform: scale(2);
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

/* Each control is a short cylinder: a cap, and behind it a stack of discs a
   step apart that reads as its side once the stack is turned. translate
   centres the control on its measured point; --tilt, on the cylinder, turns
   it to the plastic: the 2D rotate is the band's slope there, then the
   perspective turn. The camera stood above the set and in front of its
   middle, so what shows of a side is its top and the edge facing the middle:
   the left of the power button, the right of the knob. (rotateX is negative
   because the camera is above: the top of a face on a vertical surface is
   the near edge, so the discs behind the cap peek out above it, not below.)
   Nothing 3D sits on the control element itself, so its box stays the plain
   circle the pointer maths measure. */
.crt-knob, .crt-power { translate: -50% -50%; }
.crt-cyl {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transform: var(--tilt);
}
.crt-knob .crt-cyl {
  --tilt: rotate(6deg) perspective(140px) rotateX(-18deg) rotateY(-32deg);
  --step: 0.2cqw;
}
.crt-power .crt-cyl {
  --tilt: rotate(-6deg) perspective(140px) rotateX(-18deg) rotateY(32deg);
  --step: 0.16cqw;
}
.crt-cyl-side, .crt-cyl-cap {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}
/* The side: the same plastic as the case, lit from the glass above it, so
   the top of the wall (which is what shows) is paler than the rest. */
.crt-cyl-side {
  background: linear-gradient(to bottom, #d3cdbf 0%, #b0aa9c 45%, #857f71 100%);
  transform: translateZ(calc(var(--i) * -1 * var(--step)));
}
.crt-cyl-foot {
  box-shadow: 0 0 0 1px rgba(0,0,0,0.16), 0 1px 3px rgba(0,0,0,0.35);
}
.crt-cyl-cap {
  transform: translateZ(0);
  transition: transform 90ms;
}
.crt-knob { cursor: grab; }
.crt-knob:active { cursor: grabbing; }
/* The knob's cap: a shallow dome, with grip ridges round the rim, that
   turns; the snap into a detent is a firm 220ms with no overshoot — a
   rotary switch clicks, it doesn't wobble. During a drag the transition is
   taken off so the cap follows the pointer exactly. */
.crt-knob-cap {
  background: radial-gradient(circle at 50% 32%, #ece7dc 0%, #d6d0c3 48%, #bcb6a8 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.85),
    inset 0 -2px 3px rgba(0,0,0,0.2);
  transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.crt-knob-cap::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, rgba(0,0,0,0.13) 0deg 5deg, transparent 5deg 12deg);
  -webkit-mask-image: radial-gradient(circle, transparent 64%, #000 67%);
  mask-image: radial-gradient(circle, transparent 64%, #000 67%);
}
/* The power button's cap, with its symbol lit green while the set is on;
   pressing sinks the cap into the case. */
.crt-power-cap {
  color: #4a463f;
  background: radial-gradient(circle at 50% 32%, #e8e3d8 0%, #d1cbbe 55%, #b7b1a3 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 2px rgba(0,0,0,0.15);
  transition: transform 90ms, color 300ms, filter 300ms;
}
.crt-power:active .crt-power-cap {
  transform: translateZ(calc(-3 * var(--step)));
}
.crt-power--on .crt-power-cap {
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
