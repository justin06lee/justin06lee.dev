// app/home-client.tsx
"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import HomePage from "@/components/HomePage";
import AsciiSpinningDonut from "@/components/AsciiDonut";
import { Intro as ChromeIntro } from "@/components/chrome/intro";
import { useSearchParams, useRouter } from "next/navigation";
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
  const router = useRouter();
  const shouldReplay = sp.get("intro") === "1";

  useEffect(() => {
    const did = typeof window !== "undefined" && localStorage.getItem("did_anim") === "true";
    setPhase(did ? "home" : "intro");
  }, []);

  useEffect(() => {
    if (shouldReplay) {
      setPhase("intro");
      setIntroCycle((c) => c + 1);
      window.dispatchEvent(new Event("replay-intro"));
      router.replace("/", { scroll: false });
    }
  }, [shouldReplay, router]);

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
          <AsciiSpinningDonut />
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
