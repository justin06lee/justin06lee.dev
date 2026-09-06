"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as motion from "motion/react-client";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type IntroProps = {
  /** Lines shown one at a time in a fixed slot under the hero, in order. */
  lines: React.ReactNode[];
  /** Optional visual rendered above the lines for the whole intro (e.g. ascii art). */
  hero?: React.ReactNode;
  /** Playback speed multiplier — 2 plays the sequence twice as fast. Default 1. */
  speed?: number;
  /**
   * Called once when the overlay starts fading out (also on skip). Mount the
   * page beneath here so it comes up under the fade and the two cross:
   * waiting for onComplete leaves a black beat, then a snap.
   */
  onExit?: () => void;
  /** Called once after the overlay finishes fading out (also on skip). */
  onComplete?: () => void;
  /** Whether to show the skip button. Defaults to true. */
  skippable?: boolean;
  /** Label for the skip button. Defaults to "skip". */
  skipLabel?: string;
  /**
   * When set, the intro writes `localStorage[persistKey] = "true"` after
   * completing and will not replay on subsequent mounts. Omit to always play.
   */
  persistKey?: string;
  /** Extra classes for the overlay. */
  className?: string;
};

// Timeline (seconds), mirroring the justin06lee.dev homepage intro: the hero
// enters at 1 and holds; each line fades in from above, holds, and fades out
// downward before the next takes its place; the hero leaves with the last
// line, then the whole overlay fades so the page beneath fades in.
const HERO_IN = 1;
const FIRST_LINE_IN = 2;
const LINE_HOLD = 3; // fully-visible time per line
const LINE_GAP = 1; // empty-slot beat between lines
const FADE = 1; // per-element fade duration
const EXIT_DURATION = 0.7;

// The vertical room the skip button is given at the foot of the overlay: its
// 3rem stand-off from the bottom edge plus its own 1.25rem line. An empty row
// of the same height sits above the content so the content stays centred on
// the viewport and not on the space above the button.
const SKIP_ROW = "4.25rem";

const lineIn = (i: number) => FIRST_LINE_IN + i * (FADE + LINE_HOLD + LINE_GAP);
const lineOut = (i: number) => lineIn(i) + FADE + LINE_HOLD;

/**
 * Full-screen intro/splash overlay: an optional hero sits on top for the whole
 * sequence while lines cycle one at a time in a fixed slot beneath it. After
 * the last line leaves, the hero and overlay fade out (never snap) — onExit
 * fires as that fade begins, so the page beneath can come up under it — then
 * onComplete fires and it unmounts. Locks body scroll while visible. Dark-only.
 * An optional persistKey gates it to play only once via localStorage.
 */
export function Intro({
  lines,
  hero,
  speed = 1,
  onExit,
  onComplete,
  skippable = true,
  skipLabel = "skip",
  persistKey,
  className,
}: IntroProps) {
  // null = gate undetermined (waiting on localStorage); avoids a replay flash.
  const [visible, setVisible] = useState<boolean | null>(persistKey ? null : true);
  const reduceMotion = useReducedMotion();

  // Keep the latest callbacks without re-running timers when they change.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  // localStorage gate.
  useEffect(() => {
    if (!persistKey) return;
    const played =
      typeof window !== "undefined" &&
      window.localStorage.getItem(persistKey) === "true";
    setVisible(!played);
  }, [persistKey]);

  // Starts the fade-out; completion settles in AnimatePresence's
  // onExitComplete so onComplete only fires once the fade has finished.
  // onExit fires here, once: a second call (the timer landing after a skip)
  // must not announce a second exit.
  const exited = useRef(false);
  const beginExit = useCallback(() => {
    if (exited.current) return;
    exited.current = true;
    setVisible(false);
    onExitRef.current?.();
  }, []);

  const handleExited = useCallback(() => {
    if (persistKey && typeof window !== "undefined") {
      window.localStorage.setItem(persistKey, "true");
    }
    onCompleteRef.current?.();
  }, [persistKey]);

  // Everything scales by 1/speed; reduced motion collapses the timeline.
  const t = useCallback(
    (seconds: number) => (reduceMotion ? 0 : seconds / speed),
    [reduceMotion, speed],
  );

  const hasHero = hero != null;
  // The hero leaves as the last line does (or on its own if there are none).
  const heroOut = lines.length > 0 ? lineOut(lines.length - 1) : HERO_IN + LINE_HOLD;

  // Once the last exit fade lands, fade the whole overlay out.
  useEffect(() => {
    if (visible !== true) return;
    if (lines.length === 0 && !hasHero) {
      beginExit();
      return;
    }
    const id = window.setTimeout(beginExit, t(heroOut + FADE) * 1000);
    return () => window.clearTimeout(id);
  }, [visible, lines.length, hasHero, heroOut, t, beginExit]);

  // Body scroll lock while visible.
  useEffect(() => {
    if (visible !== true) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [visible]);

  if (visible === null) return null;

  const fade = reduceMotion ? 0 : FADE / speed;
  const offset = reduceMotion ? 0 : 10;

  return (
    <AnimatePresence onExitComplete={handleExited}>
      {visible && (
        <motion.div
          key="intro"
          exit={{ opacity: 0 }}
          transition={{
            duration: reduceMotion ? 0 : EXIT_DURATION,
            ease: "easeInOut",
          }}
          className={cn(
            "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black text-white",
            className,
          )}
        >
          {/* Empty twin of the skip row at the foot, so the content between the
              two is centred on the viewport exactly as it was when the button
              floated free of the layout. */}
          {skippable && <div aria-hidden className="flex-1" style={{ minHeight: SKIP_ROW }} />}

          {/* The hero and the lines share one shrinkable box. min-h-0 lets it
              give way when the viewport is too short for the hero at its
              natural size — an in-app browser's sheet leaves ~550px, not the
              ~850 a phone's own browser does — so a tall hero is cropped
              evenly rather than pushing the skip row off the bottom. The py-3
              is what the fades need: every element here enters from 10px above
              its resting place, which the clip would otherwise shave off the
              hero's first frames. */}
          <div className="flex min-h-0 flex-col items-center justify-center overflow-hidden py-3">
            {hasHero && (
              // Outer div fades the hero out at the end; inner fades it in.
              <motion.div
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: offset }}
                transition={{ duration: fade * 0.8, delay: t(heroOut) }}
                // The hero is the one thing allowed to give way when the box
                // above has to shrink: art can be cropped, the line below it
                // is words and cannot.
                className="mb-12 min-h-0"
              >
                <motion.div
                  initial={{ opacity: 0, y: -offset }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: fade * 0.8, delay: t(HERO_IN) }}
                >
                  {hero}
                </motion.div>
              </motion.div>
            )}

            {lines.length > 0 && (
              // Fixed slot: every line renders absolutely into the same box so
              // they take turns without the layout shifting.
              <div
                className="relative min-w-64 shrink-0 text-center text-lg leading-tight"
                style={{ height: "1.75em" }}
              >
                {lines.map((line, i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 0, y: offset }}
                    transition={{ duration: fade, delay: t(lineOut(i)) }}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: -offset }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: fade, delay: t(lineIn(i)) }}
                    >
                      {line}
                    </motion.div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* In flow, never `fixed`: as a fixed element the button took up no
              layout space at all, so on a short viewport the centred column
              simply grew down over it and the last line rendered on top of the
              word "skip". Its own row can't be encroached on. */}
          {skippable && (
            <div className="flex flex-1 items-end justify-center pb-12">
              <button
                type="button"
                onClick={beginExit}
                aria-label={skipLabel}
                className="text-sm text-white/80 underline-offset-4 transition hover:text-white hover:underline"
              >
                {skipLabel}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
