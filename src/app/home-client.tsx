// app/home-client.tsx
"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import HomePage from "@/components/HomePage";
import AsciiSpinningDonut from "@/components/AsciiDonut";
import { Intro as ChromeIntro } from "@/components/chrome/intro";
import { useSearchParams } from "next/navigation";
import { PHONE_QUERY } from "@/hooks/use-phone";
import type { SiteConfig } from "@/lib/site-config";

/**
 * The home page in three phases. `intro` is the overlay alone; `revealing`
 * begins the moment the overlay starts to fade, and is when the navbar and
 * the page mount so their entrances run *under* the fade and the two cross;
 * `home` is the page on its own. What this replaced mounted the page only
 * after the fade had finished (a black beat, then a snap), slid the navbar in
 * on a hard-coded 16-second timer that had nothing to do with when the intro
 * actually ended, and remounted the whole tree at the end, so the navbar
 * entered twice. Replaying the intro (the nav's "intro") goes back to `intro`
 * with a fresh key on the overlay; the page and navbar unmount beneath it and
 * enter again when it lifts.
 */
type Phase = "intro" | "revealing" | "home";

/** How much faster than the chrome intro's own timeline: about two seconds a line. */
const INTRO_SPEED = 2.2;

export default function HomeClient({ config }: { config: SiteConfig }) {
  const [phase, setPhase] = useState<Phase | null>(null);
  const [introCycle, setIntroCycle] = useState(0);

  const sp = useSearchParams();
  const shouldReplay = sp.get("intro") === "1";

  useEffect(() => {
    const did = typeof window !== "undefined" && localStorage.getItem("did_anim") === "true";
    // The intro is a desktop thing. It was composed for a screen it could
    // hold the middle of — a donut, three lines, eight seconds — and a phone
    // gives it a fraction of that room while putting the page the visitor
    // actually asked for eight seconds away. The nav's "intro" goes with it
    // below the same breakpoint, so nothing offers what isn't there.
    const phone = window.matchMedia(PHONE_QUERY).matches;
    setPhase(did || phone ? "home" : "intro");
  }, []);

  // Arriving from another page with ?intro=1: play it, then drop the param.
  useEffect(() => {
    if (!shouldReplay) return;
    // Strip the param either way: a phone that arrived here from an older tab
    // or a shared link shouldn't be left with ?intro=1 in the bar.
    if (!window.matchMedia(PHONE_QUERY).matches) {
      setPhase("intro");
      setIntroCycle((c) => c + 1);
    }
    // history.replaceState, not router.replace: this route is force-dynamic, so
    // a replace refetches it from the server, and when that response finally
    // commits, the Suspense boundary above swaps in its null fallback — the
    // whole tree unmounts and the entrance replays, seconds after the intro
    // finished. Rewriting the URL in place is all that was ever wanted.
    window.history.replaceState(null, "", "/");
  }, [shouldReplay]);

  useEffect(() => {
    const onReplay = () => {
      setPhase("intro");
      setIntroCycle((c) => c + 1);
    };
    window.addEventListener("replay-intro", onReplay);
    return () => window.removeEventListener("replay-intro", onReplay);
  }, []);

  // Undetermined until localStorage has been read, so a return visit never
  // flashes the intro and a first visit never flashes the page.
  if (phase === null) return null;

  const pageShown = phase !== "intro";

  return (
    <div className="w-screen flex justify-center text-center bg-black text-white">
      <div className="min-h-screen flex flex-col">
        {/* The navbar animates itself in via `entrance`. It must: it is
            position:fixed, so an animating wrapper's transform would become its
            containing block and render it at the wrapper's width. It mounts
            with the page, so its slide is part of the same reveal. */}
        {pageShown && <Navbar pfp={config.pfp} entrance={{ duration: 0.8, delay: 0.1 }} />}

        {pageShown && <HomePage config={config} />}

        {phase === "intro" && (
          <Intro
            key={introCycle}
            config={config}
            onExit={() => setPhase("revealing")}
            onDone={() => {
              localStorage.setItem("did_anim", "true");
              setPhase("home");
            }}
          />
        )}
      </div>
    </div>
  );
}

function Intro({ config, onExit, onDone }: { config: SiteConfig; onExit: () => void; onDone: () => void }) {
  const justinStep = (
    <span className="inline-flex items-center gap-1.5">
      <span>im justin.</span>
      {config.pfp?.url && (
        <span className="inline-flex items-center gap-0.5">
          <span>(</span>
          <span className="relative inline-block size-7 overflow-hidden align-middle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={config.pfp.url}
              alt=""
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{
                transform: `translate(${config.pfp.x}%, ${config.pfp.y}%) scale(${config.pfp.scale})`,
                transformOrigin: "center",
              }}
            />
          </span>
          <span>)</span>
        </span>
      )}
    </span>
  );

  return (
    <ChromeIntro
      hero={
        <div className="text-white -mt-8 mb-4">
          {/* The grid stays 60x30 at every size — it is the char cell that
              shrinks, so the art is the same art, just smaller. Sizing it by
              breakpoint instead would coarsen the torus on a phone, and the
              fixed text-xs it replaces measured 432px across: wider than a
              393px phone, so the donut was clipped down both sides. Both terms
              are needed — vw for a narrow screen, svh for a short one (an
              in-app browser's sheet is both) — and 0.75rem caps it at the
              text-xs it has always been from ~550px up. */}
          <AsciiSpinningDonut className="font-mono text-[min(2.2vw,1.8svh,0.75rem)] leading-[1] whitespace-pre cursor-default select-none" />
        </div>
      }
      lines={["hi.", justinStep, "welcome to my website."]}
      speed={INTRO_SPEED}
      skipLabel="skip"
      onExit={onExit}
      onComplete={onDone}
    />
  );
}
