// app/home-client.tsx
"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import HomePage from "@/components/HomePage";
import AsciiSpinningDonut from "@/components/AsciiDonut";
import { Intro as ChromeIntro } from "@/components/chrome/intro";
import { useSearchParams, useRouter } from "next/navigation";
import type { SiteConfig } from "@/lib/site-config";

export default function HomeClient({ config }: { config: SiteConfig }) {
  const [hasPlayed, setHasPlayed] = useState<null | boolean>(null);
  const [introCycle, setIntroCycle] = useState(0);

  const sp = useSearchParams();
  const router = useRouter();
  const shouldReplay = sp.get("intro") === "1";

  useEffect(() => {
    const did =
      typeof window !== "undefined" &&
      localStorage.getItem("did_anim") === "true";
    setHasPlayed(did);
  }, []);

  useEffect(() => {
    if (shouldReplay) {
      setHasPlayed(false);
      setIntroCycle((c) => c + 1);
      window.dispatchEvent(new Event("replay-intro"));
      router.replace("/", { scroll: false });
    }
  }, [shouldReplay, router]);

  useEffect(() => {
    const onReplay = () => {
      setHasPlayed(false);
      setIntroCycle((c) => c + 1);
    };
    window.addEventListener("replay-intro", onReplay);
    return () => window.removeEventListener("replay-intro", onReplay);
  }, []);

  if (hasPlayed === null) return null;

  return (
    <div className="w-screen flex justify-center text-center bg-black text-white">
      <div className="min-h-screen flex flex-col" key={introCycle}>
        {/* The navbar animates itself in via `entrance`. It must: it is
            position:fixed, so an animating wrapper's transform would become its
            containing block and render it at the wrapper's width — which here
            is a shrink-to-fit column, so the bar sat narrow and centered until
            the tween ended and motion wrote `transform: none`, then snapped
            out to full width. On a first visit it waits out the 16s intro. */}
        <Navbar pfp={config.pfp} entrance={{ duration: 1, delay: hasPlayed ? 0 : 16 }} />

        {hasPlayed && <HomePage config={config} />}

        {!hasPlayed && (
          <Intro
            config={config}
            onDone={() => {
              localStorage.setItem("did_anim", "true");
              setHasPlayed(true);
              setIntroCycle((c) => c + 1);
            }}
          />
        )}
      </div>
    </div>
  );
}

function Intro({ config, onDone }: { config: SiteConfig; onDone: () => void }) {
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
      skipLabel="skip"
      onComplete={onDone}
    />
  );
}
