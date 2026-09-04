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

function useBreakpointScale() {
    const [s, setS] = useState(1);
    useEffect(() => {
        const mqs = [
            { mq: window.matchMedia("(min-width:1536px)"), key: "2xl" },
            { mq: window.matchMedia("(min-width:1280px)"), key: "xl" },
            { mq: window.matchMedia("(min-width:1024px)"), key: "lg" },
            { mq: window.matchMedia("(min-width:768px)"), key: "md" },
            { mq: window.matchMedia("(min-width:640px)"), key: "sm" },
            { mq: window.matchMedia("(min-width:400px)"), key: "xs" },
        ];

        const scaleByKey = {
            "2xl": 1.0,
            xl: 0.75,
            lg: 0.6,
            md: 0.4,
            sm: 0.4,
            xs: 0.4,
            base: 0.4,
        } as const;

        const compute = () => {
            const match = mqs.find(({ mq }) => mq.matches)?.key ?? "base";
            setS(scaleByKey[match as keyof typeof scaleByKey] ?? scaleByKey.base);
        };

        mqs.forEach(({ mq }) => mq.addEventListener("change", compute));
        compute();
        return () => mqs.forEach(({ mq }) => mq.removeEventListener("change", compute));
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
};
const RISE = 10;

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
            <div className="h-screen flex flex-col justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, delay: ENTER.donut, ease: "easeOut" }}
                >
                    <div>
                        <AsciiSpinningDonut width={Math.round(BASE_W * s)} height={Math.round(BASE_H * s)} R={0.7 * s} r={0.5 * s} K={240 * s} D={7 * s} speed={0.5625} />
                    </div>
                </motion.div>
            </div>

            <div className="h-screen flex flex-col justify-center">
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
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.5 }}
                                transition={{ duration: 0.8, delay: ENTER.socials }}
                                className="md:hidden block self-center mt-120 absolute text-sm text-white"
                            >
                                <h1 className="mb-4">...or check out my socials.</h1>
                                <button className="inline-flex items-center justify-center size-9 hover:bg-white/10 scale-120 cursor-pointer" onClick={handleScroll}>
                                    <ArrowDown />
                                </button>
                            </motion.div>
                        </div>
                    </div>
                </div>
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
