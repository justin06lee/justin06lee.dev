"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as motion from "motion/react-client";
import { AnimatePresence } from "motion/react";
import type { Pfp } from "@/lib/site-config";

function RainbowCat() {
    const chars = "^cat^".split("");
    return (
        <span className="rainbow-text font-mono tracking-tight" aria-label="cat">
            {chars.map((c, i) => (
                <span key={i} style={{ animationDelay: `${-0.25 * i}s` }}>{c}</span>
            ))}
        </span>
    );
}

function NavPfp({ pfp }: { pfp: Pfp }) {
    return (
        <Link href="/" aria-label="home" className="inline-flex items-center">
            <span className="relative inline-block size-7 overflow-hidden align-middle border border-white/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={pfp.url}
                    alt="pfp"
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    style={{
                        transform: `translate(${pfp.x}%, ${pfp.y}%) scale(${pfp.scale})`,
                        transformOrigin: "center",
                    }}
                />
            </span>
        </Link>
    );
}

export default function Navbar({ pfp }: { pfp?: Pfp } = {}) {
    const [open, setOpen] = useState(false);
    const [fetchedPfp, setFetchedPfp] = useState<Pfp | undefined>(pfp);
    const router = useRouter();
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (pfp) { setFetchedPfp(pfp); return; }
        let cancelled = false;
        fetch("/api/config")
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!cancelled && data?.pfp?.url) setFetchedPfp(data.pfp);
            })
            .catch(() => { });
        return () => { cancelled = true; };
    }, [pfp]);

    const playIntro = () => {
        setOpen(false);
        router.push("/?intro=1", { scroll: false });
    };

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    useEffect(() => {
        if (open) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    return (
        <nav className="fixed inset-x-0 top-0 z-40 w-full">
            <div className="flex items-center w-full px-4 sm:px-6 py-2">
                {/* Left: site name + intro — pinned left */}
                <div className="flex items-center gap-6 mr-auto">
                    <Link href="/" className="text-sm text-white underline-offset-4 hover:underline whitespace-nowrap hidden lg:inline-flex">
                        justin06lee.dev
                    </Link>
                    {fetchedPfp?.url && (
                        <span className="inline-flex lg:hidden">
                            <NavPfp pfp={fetchedPfp} />
                        </span>
                    )}
                    <button onClick={playIntro} className="text-sm text-white underline-offset-4 hover:underline hidden lg:inline-flex whitespace-nowrap">
                        intro
                    </button>
                    <Link href="/cat" className="text-sm underline-offset-4 hover:underline inline-flex whitespace-nowrap">
                        <RainbowCat />
                    </Link>
                </div>

                {/* Right: nav links — pinned right */}
                <div className="hidden md:flex items-center gap-1 ml-auto">
                    <Link href="/calendar" className="text-sm text-white underline-offset-4 hover:underline px-4 py-2 whitespace-nowrap">
                        calendar
                    </Link>
                    <Link href="/articles" className="text-sm text-white underline-offset-4 hover:underline px-4 py-2 whitespace-nowrap">
                        articles
                    </Link>
                    <Link href="/gallery" className="text-sm text-white underline-offset-4 hover:underline px-4 py-2 whitespace-nowrap">
                        gallery
                    </Link>
                </div>

                {/* Mobile hamburger — pinned right */}
                <div className="md:hidden ml-auto">
                    {!open && (
                        <button
                            onClick={() => setOpen(true)}
                            className="inline-flex items-center justify-center size-9 hover:bg-white/10 transition-colors"
                            aria-label="Open navigation menu"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-50 bg-black/50"
                        />
                        <motion.div
                            ref={panelRef}
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
                            className="fixed inset-y-0 right-0 z-[80] w-72 sm:w-80 bg-black border-l border-white/10 flex flex-col gap-4 shadow-lg"
                        >
                            <div className="flex items-center justify-between p-4">
                                <span className="font-semibold text-white">Menu</span>
                                <button
                                    onClick={() => setOpen(false)}
                                    className="opacity-70 hover:opacity-100 transition-opacity"
                                >
                                    <X className="size-4" />
                                    <span className="sr-only">Close</span>
                                </button>
                            </div>

                            <div className="flex flex-col items-start gap-2 px-4">
                                <button onClick={playIntro} className="text-sm text-white underline-offset-4 hover:underline py-1">
                                    intro
                                </button>
                                <Link href="/cat" onClick={() => setOpen(false)} className="text-sm underline-offset-4 hover:underline py-1">
                                    <RainbowCat />
                                </Link>
                                <Link href="/calendar" onClick={() => setOpen(false)} className="text-sm text-white underline-offset-4 hover:underline py-1">
                                    calendar
                                </Link>
                                <Link href="/articles" onClick={() => setOpen(false)} className="text-sm text-white underline-offset-4 hover:underline py-1">
                                    articles
                                </Link>
                                <Link href="/gallery" onClick={() => setOpen(false)} className="text-sm text-white underline-offset-4 hover:underline py-1">
                                    gallery
                                </Link>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </nav>
    );
}
