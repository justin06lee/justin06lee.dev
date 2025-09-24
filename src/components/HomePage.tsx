"use client";

import { Button } from "@/components/ui/button";
import AsciiSpinningDonut from "@/components/AsciiDonut";
import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { ArrowDown } from "lucide-react";
import SocialBar from "@/components/Socials";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

function ScrambleWord({ text }: { text: string }) {
    const visRef = useRef<HTMLSpanElement | null>(null);
    const sizerRef = useRef<HTMLSpanElement | null>(null);
    const intervalRef = useRef<number | null>(null);
    const [widthPx, setWidthPx] = useState<number | null>(null);

    // Measure width – handle font swaps + any size changes
    useLayoutEffect(() => {
        const measure = () => {
            if (!sizerRef.current) return;
            const w = sizerRef.current.getBoundingClientRect().width;
            if (w) setWidthPx(Math.ceil(w)); // ceil avoids sub-pixel truncation
        };

        measure();

        const onResize = () => measure();
        window.addEventListener("resize", onResize);

        // Re-measure after fonts load/swap
        let fontsReadyCancelled = false;
        if ("fonts" in document) {
            (document).fonts.ready.then(() => {
                if (!fontsReadyCancelled) measure();
            });
        }

        // Observe the sizer changing (covers font load, CSS changes, etc.)
        const ro = new ResizeObserver(() => measure());
        if (sizerRef.current) ro.observe(sizerRef.current);

        return () => {
            window.removeEventListener("resize", onResize);
            fontsReadyCancelled = true;
            ro.disconnect();
        };
    }, [text]);

    useEffect(() => {
        return () => {
            if (intervalRef.current) window.clearInterval(intervalRef.current);
        };
    }, []);

    const handleMouseEnter = () => {
        const el = visRef.current;
        if (!el) return;
        const targetValue = text;

        let iteration = 0;
        if (intervalRef.current) window.clearInterval(intervalRef.current);

        intervalRef.current = window.setInterval(() => {
            const node = visRef.current;
            if (!node) return;

            const scrambled = targetValue
                .split("")
                .map((_, idx) => (idx < iteration ? targetValue[idx] : LETTERS[Math.floor(Math.random() * 26)]))
                .join("");

            node.textContent = scrambled;

            iteration += 1 / 3;
            if (iteration >= targetValue.length) {
                window.clearInterval(intervalRef.current!);
                intervalRef.current = null;
                node.textContent = targetValue;
            }
        }, 30);
    };

    return (
        <>
            {/* Use the same typography context as the visible span */}
            <span ref={sizerRef} className="absolute -left-[9999px] -top-[9999px] whitespace-pre" aria-hidden>
                {text}
            </span>

            <span
                className="inline-block whitespace-nowrap align-baseline cursor-default"
                // Allow growth if the real font is wider
                style={widthPx ? { minWidth: `${widthPx}px` } : undefined}
                onMouseEnter={handleMouseEnter}
            >
                <span ref={visRef}>{text}</span>
            </span>
        </>
    );
}

function ScrambleText({ text }: { text: string }) {
    const parts = text.split(/(\s+)/);
    return <>{parts.map((p, i) => (/\s+/.test(p) ? <span key={i}>{p}</span> : <ScrambleWord key={i} text={p} />))}</>;
}

function useBreakpointScale() {
    const [s, setS] = useState(1);
    useEffect(() => {
        // Tailwind breakpoints (match from largest → smallest)
        const mqs = [
            { mq: window.matchMedia("(min-width:1536px)"), key: "2xl" }, // 2xl
            { mq: window.matchMedia("(min-width:1280px)"), key: "xl" }, // xl
            { mq: window.matchMedia("(min-width:1024px)"), key: "lg" }, // lg
            { mq: window.matchMedia("(min-width:768px)"), key: "md" }, // md
            { mq: window.matchMedia("(min-width:640px)"), key: "sm" }, // sm
            { mq: window.matchMedia("(min-width:400px)"), key: "xs" }, // sm
        ];

        // Raw per-breakpoint scale choices (tweak as you like)
        const scaleByKey = {
            "2xl": 1.0,
            xl: 0.75,
            lg: 0.6,
            md: 0.4, // smallest we want to go
            sm: 0.4,
            xs: 0.4, // extra small screens
            base: 0.4, // default <640px also small
        } as const;

        const MD_CAP = scaleByKey.md; // cap shrinkage at md size

        const compute = () => {
            const match = mqs.find(({ mq }) => mq.matches)?.key ?? "base";
            const raw = scaleByKey[match as keyof typeof scaleByKey] ?? scaleByKey.base;
            // Don’t let large screens shrink smaller than md’s size
            const clamped = Math.max(raw, MD_CAP);
            setS(clamped);
        };

        mqs.forEach(({ mq }) => mq.addEventListener("change", compute));
        compute();
        return () => mqs.forEach(({ mq }) => mq.removeEventListener("change", compute));
    }, []);
    return s;
}

export default function HomePage() {
    const s = useBreakpointScale();
    const BASE_W = 120,
        BASE_H = 60;

    const handleScroll = () => {
        window.scrollBy({
            top: window.innerHeight, // scroll down one viewport height
            behavior: "smooth", // smooth scrolling
        });
    };

    return (
        <div className="grid md:grid-cols-2 grid-cols-1 h-screen">
            <div className="h-screen flex flex-col justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.8,
                        delay: 1,
                    }}
                >
                    <div>
                        <AsciiSpinningDonut width={Math.round(BASE_W * s)} height={Math.round(BASE_H * s)} R={0.7 * s} r={0.5 * s} K={240 * s} D={7 * s} speed={0.5625} />
                    </div>
                </motion.div>
                <div className="md:hidden block self-center mt-120 absolute">
                    <Button variant="ghost" size="icon" className="rounded-full scale-120 cursor-pointer" onClick={handleScroll}>
                        <ArrowDown />
                    </Button>
                </div>
            </div>

            <div className="h-screen flex flex-col justify-center">
                <div className="flex flex-col gap-4">
                    <div className="xl:block hidden">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.8,
                                delay: 2,
                            }}
                        >
                            <ScrambleText text="im justin." />
                        </motion.div>
                    </div>

                    <div className="leading-relaxed xl:block hidden">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.8,
                                delay: 2.2,
                            }}
                        >
                            <ScrambleText text="im a freshman at ucsc majoring in computer science," />
                            <br />
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.8,
                                delay: 2.3,
                            }}
                        >
                            <ScrambleText text="and an addict for the low-level. i love c(++), go, rust, and zig," />
                            <br />
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.8,
                                delay: 2.4,
                            }}
                        >
                            <ScrambleText text="but have also been developing a new addiction towards" />
                            <br />
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.8,
                                delay: 2.5,
                            }}
                        >
                            <ScrambleText text="llms lately, and have been working with agentic llms, mcp and rag." />
                            <br />
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.8,
                                delay: 2.6,
                            }}
                        >
                            <ScrambleText text="feel free to look around. this is where ill be posting everything." />
                        </motion.div>
                    </div>

                    <div>
                        <div className="mt-4 mb-2">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    duration: 0.8,
                                    delay: 2.7,
                                }}
                            >
                                get started.
                            </motion.div>
                        </div>

                        <div className="flex justify-center scale-110">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    duration: 0.8,
                                    delay: 2.8,
                                }}
                            >
                                <Button variant="link" asChild>
                                    <Link href="/hobbies">hobbies</Link>
                                </Button>
                                <Button variant="link" asChild>
                                    <Link href="/projects">projects</Link>
                                </Button>
                            </motion.div>
                            <div className="md:hidden block self-center mt-120 absolute text-sm text-gray-500/90">
                                <h1 className="mb-4">...or check out my socials.</h1>
                                <Button variant="ghost" size="icon" className="rounded-full scale-120 cursor-pointer" onClick={handleScroll}>
                                    <ArrowDown />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex flex-col justify-center text-center h-screen md:h-2 md:absolute md:bottom-15 md:left-[25%] md:right-[25%]">
                <SocialBar
                    links={{
                        github: "https://github.com/justin06lee",
                        linkedin: "https://www.linkedin.com/in/justin06lee/",
                        x: "https://x.com/justin06lee",
                        email: "justin.leehuiyun@gmail.com",
                        instagram: "https://instagram.com/justin06lee",
                    }}
                    size="md"
                    variant="ghost"
                    rounded
                    className="justify-center"
                />
            </div>
        </div>
    );
}
