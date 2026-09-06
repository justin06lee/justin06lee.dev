"use client";

import AsciiSpinningDonut from "@/components/AsciiDonut";
import { useEffect, useState } from "react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { ArrowDown } from "lucide-react";
import SocialBar from "@/components/Socials";
import PfpTile from "@/components/PfpTile";
import { Scramble } from "@/components/chrome/scramble";
import { Ascii } from "@/components/chrome/ascii";
import type { SiteConfig } from "@/lib/site-config";

/**
 * Breakpoint to donut scale. Hoisted and ordered widest-first so the scale can
 * be resolved in one pass, synchronously.
 */
const DONUT_SCALES = [
    { query: "(min-width:1536px)", scale: 1.0 },
    { query: "(min-width:1280px)", scale: 0.75 },
    { query: "(min-width:1024px)", scale: 0.6 },
] as const;
const BASE_DONUT_SCALE = 0.4;

function currentDonutScale(): number {
    return DONUT_SCALES.find(({ query }) => window.matchMedia(query).matches)?.scale ?? BASE_DONUT_SCALE;
}

function useBreakpointScale() {
    // Resolved before the first paint, not one render after it. The donut's
    // grid is derived from this, and a scale that arrives late bakes a
    // full-size donut, throws it away, and bakes the real one — two bakes at
    // exactly the moment the page is animating in, when the first frame is
    // what the entrance has to fade. Guarded for the server, where matchMedia
    // doesn't exist; nothing renders differently there (the donut's <pre> is
    // filled by an effect), so there is no markup to mismatch.
    const [s, setS] = useState(() => (typeof window === "undefined" ? 1 : currentDonutScale()));

    useEffect(() => {
        const mqs = DONUT_SCALES.map(({ query }) => window.matchMedia(query));
        const compute = () => setS(currentDonutScale());
        mqs.forEach((mq) => mq.addEventListener("change", compute));
        compute();
        return () => mqs.forEach((mq) => mq.removeEventListener("change", compute));
    }, []);

    return s;
}

function useResponsiveAscii() {
    const [ascii, setAscii] = useState("");
    useEffect(() => {
        let cancelled = false;
        const pickFile = () => {
            const w = window.innerWidth;
            if (w >= 1280) return null;
            if (w >= 1024) return "ascii9.txt";
            if (w >= 768) return "ascii3.txt";
            if (w >= 640) return "ascii4.txt";
            return "ascii1.txt";
        };
        let currentFile: string | null = null;
        const load = () => {
            const file = pickFile();
            if (file === currentFile) return;
            currentFile = file;
            if (!file) { setAscii(""); return; }
            fetch(`/ascii/${file}`)
                .then((r) => (r.ok ? r.text() : ""))
                .then((t) => { if (!cancelled) setAscii(t); })
                .catch(() => { });
        };
        load();
        window.addEventListener("resize", load);
        return () => { cancelled = true; window.removeEventListener("resize", load); };
    }, []);
    return ascii;
}

/**
 * Entrance delays, in seconds. One cascade from the donut down to the socials,
 * two seconds end to end: it plays under the intro's fade on a first visit
 * and on its own on a return, and either way nothing waits a full second in
 * the dark before it appears. The donut rises 24px, not 100 — a long slide
 * read as a snap.
 */
const ENTER = {
    donut: 0.15,
    pfp: 0.45,
    name: 0.55,
    description: 0.65,
    line: 0.07,
    ascii: 0.5,
    cta: 0.95,
    link: 1.05,
    socials: 1.2,
    scrollHint: 1.35,
};
const RISE = 10;

/**
 * The "there is more below" affordance, one definition for both panes that
 * have something under them, so the two can't drift apart. Still, like every
 * other control on the page: the entrance it fades in on is the movement, and
 * a perpetual bob would be the only animation on the site that never ends.
 */
function ScrollArrow({ onClick, label }: { onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="inline-flex items-center justify-center size-9 hover:bg-white/10 scale-120 cursor-pointer"
        >
            <ArrowDown />
        </button>
    );
}

export default function HomePage({ config }: { config: SiteConfig }) {
    const s = useBreakpointScale();
    const ascii = useResponsiveAscii();
    const BASE_W = 120,
        BASE_H = 60;

    const handleScroll = () => {
        window.scrollBy({
            top: window.innerHeight,
            behavior: "smooth",
        });
    };

    return (
        <div className="grid md:grid-cols-2 grid-cols-1 h-screen">
            <div className="relative h-screen flex flex-col justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, delay: ENTER.donut, ease: "easeOut" }}
                >
                    <div>
                        <AsciiSpinningDonut width={Math.round(BASE_W * s)} height={Math.round(BASE_H * s)} R={0.7 * s} r={0.5 * s} K={240 * s} D={7 * s} speed={0.5625} />
                    </div>
                </motion.div>

                {/* Phones get a screenful per pane, so the donut arrives with
                    nothing on screen to say the page goes any further. Hidden
                    from md up, where the whole page is laid out in one viewport
                    and there is nothing to scroll to. */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    transition={{ duration: 0.8, delay: ENTER.scrollHint }}
                    className="md:hidden absolute inset-x-0 bottom-12 flex justify-center"
                >
                    <ScrollArrow onClick={handleScroll} label="scroll down" />
                </motion.div>
            </div>

            <div className="relative h-screen flex flex-col justify-center">
                <div className="flex flex-col gap-4">
                    <div className="xl:block hidden">
                        {config.pfp?.url && (
                            <motion.div
                                initial={{ opacity: 0, y: RISE }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: ENTER.pfp }}
                                className="inline-block mb-6"
                            >
                                <Link href="/cat" aria-label="pet the cat">
                                    <PfpTile pfp={config.pfp} />
                                </Link>
                            </motion.div>
                        )}
                        <motion.div
                            initial={{ opacity: 0, y: RISE }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: ENTER.name }}
                        >
                            <Scramble>im justin.</Scramble>
                        </motion.div>
                    </div>

                    <div className="leading-relaxed xl:block hidden">
                        {config.description.map((line, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: RISE }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: ENTER.description + i * ENTER.line }}>
                                <Scramble>{line}</Scramble>
                                <br />
                            </motion.div>
                        ))}
                    </div>

                    <div className="xl:hidden flex justify-center">
                        <motion.div
                            initial={{ opacity: 0, y: RISE }}
                            animate={{ opacity: ascii ? 1 : 0, y: 0 }}
                            transition={{ duration: 0.6, delay: ENTER.ascii }}
                            className="inline-block"
                        >
                            <Ascii size={16} lineHeight={1.1} className="text-left text-white/80">
                                {ascii || " "}
                            </Ascii>
                        </motion.div>
                    </div>

                    <div>
                        <div className="mt-4 mb-2">
                            <motion.div initial={{ opacity: 0, y: RISE }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: ENTER.cta }}>
                                get started.
                            </motion.div>
                        </div>

                        <div className="flex justify-center scale-110">
                            <motion.div initial={{ opacity: 0, y: RISE }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: ENTER.link }}>
                                <Link href="/gallery" className="text-sm text-white underline-offset-4 hover:underline px-4 py-2">
                                    gallery
                                </Link>
                            </motion.div>
                        </div>
                    </div>
                </div>

                {/* Anchored to the foot of the pane, not held 480px below the
                    gallery link by a margin: the offset was measured against a
                    tall phone, so on a short viewport — an in-app browser's
                    sheet leaves ~550px — it overshot the pane entirely and
                    landed under the fixed navbar on the screen below. Sitting
                    outside the scale-110 row it keeps that scale itself, and
                    the pane is the containing block only because the row's
                    transform no longer intercepts it. */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    transition={{ duration: 0.8, delay: ENTER.socials }}
                    className="md:hidden absolute inset-x-0 bottom-12 scale-110 text-sm text-white"
                >
                    <h1 className="mb-4">...or check out my socials.</h1>
                    <ScrollArrow onClick={handleScroll} label="scroll to my socials" />
                </motion.div>
            </div>
            {/* Last in the cascade: the socials used to mount with no entrance at
                all and snap in under a page that was still fading. */}
            <motion.div
                initial={{ opacity: 0, y: RISE }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: ENTER.socials }}
                className="flex flex-col justify-center text-center h-screen md:h-2 md:absolute md:bottom-15 md:left-[25%] md:right-[25%]"
            >
                <SocialBar
                    links={config.socials}
                    size="md"
                    className="justify-center"
                />
            </motion.div>
        </div>
    );
}
