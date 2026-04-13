"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";

const TOTAL_FRAMES = 115;
const FLUSH_INTERVAL_MS = 2500;
const POLL_INTERVAL_MS = 5000;
const EDGE_LEFT = 0.22;
const EDGE_RIGHT = 0.78;

const frameSrc = (i: number) => `/cat-frames/frame-${String(i + 1).padStart(3, "0")}.jpg`;

// Map mouse X position (0 = left, 1 = right) to a frame index.
// Left side of image = later in the animation (forward play as mouse moves left).
const relXToFrame = (relX: number) => {
    const clamped = Math.min(1, Math.max(0, relX));
    return Math.round((1 - clamped) * (TOTAL_FRAMES - 1));
};

export default function CatPage() {
    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const pendingFrameRef = useRef<number | null>(null);
    const currentFrameRef = useRef(0);
    const lastEdgeRef = useRef<"left" | "right" | null>(null);
    const pendingPatsRef = useRef(0);
    const [pats, setPats] = useState(0);
    const [loadedCount, setLoadedCount] = useState(0);
    const ready = loadedCount >= TOTAL_FRAMES;

    useEffect(() => {
        let cancelled = false;
        let loaded = 0;
        for (let i = 0; i < TOTAL_FRAMES; i++) {
            const img = new Image();
            img.onload = () => {
                if (cancelled) return;
                loaded += 1;
                setLoadedCount(loaded);
            };
            img.onerror = () => {
                if (cancelled) return;
                loaded += 1;
                setLoadedCount(loaded);
            };
            img.src = frameSrc(i);
        }
        return () => { cancelled = true; };
    }, []);

    const flush = async () => {
        const delta = pendingPatsRef.current;
        if (delta <= 0) return;
        pendingPatsRef.current = 0;
        try {
            const res = await fetch("/api/pats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ delta }),
            });
            if (res.ok) {
                const data = await res.json();
                if (typeof data.count === "number") setPats(data.count);
            } else {
                pendingPatsRef.current += delta;
            }
        } catch {
            pendingPatsRef.current += delta;
        }
    };

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await fetch("/api/pats");
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled && typeof data.count === "number") {
                    setPats((p) => Math.max(p, data.count));
                }
            } catch { /* offline */ }
        };
        load();
        const poll = window.setInterval(() => {
            if (pendingPatsRef.current === 0) load();
        }, POLL_INTERVAL_MS);
        const flushTimer = window.setInterval(flush, FLUSH_INTERVAL_MS);
        const onUnload = () => {
            const delta = pendingPatsRef.current;
            if (delta <= 0) return;
            try {
                navigator.sendBeacon?.(
                    "/api/pats",
                    new Blob([JSON.stringify({ delta })], { type: "application/json" })
                );
            } catch { /* noop */ }
        };
        window.addEventListener("beforeunload", onUnload);
        return () => {
            cancelled = true;
            window.clearInterval(poll);
            window.clearInterval(flushTimer);
            window.removeEventListener("beforeunload", onUnload);
            flush();
        };
    }, []);

    const applyFrame = () => {
        rafRef.current = null;
        const idx = pendingFrameRef.current;
        if (idx === null || !imgRef.current) return;
        if (idx === currentFrameRef.current) return;
        currentFrameRef.current = idx;
        imgRef.current.src = frameSrc(idx);
    };

    const scheduleFrame = (idx: number) => {
        pendingFrameRef.current = idx;
        if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(applyFrame);
        }
    };

    const updateFromClientX = (clientX: number) => {
        const c = containerRef.current;
        if (!c) return;
        const rect = c.getBoundingClientRect();
        const relX = (clientX - rect.left) / rect.width;
        scheduleFrame(relXToFrame(relX));

        if (relX <= EDGE_LEFT) {
            if (lastEdgeRef.current === "right") {
                pendingPatsRef.current += 1;
                setPats((p) => p + 1);
            }
            lastEdgeRef.current = "left";
        } else if (relX >= EDGE_RIGHT) {
            if (lastEdgeRef.current === "left") {
                pendingPatsRef.current += 1;
                setPats((p) => p + 1);
            }
            lastEdgeRef.current = "right";
        }
    };

    const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
        updateFromClientX(e.clientX);
    };

    const handleEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        const c = containerRef.current;
        if (!c) return;
        const rect = c.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width;
        lastEdgeRef.current = relX < 0.5 ? "left" : "right";
        updateFromClientX(e.clientX);
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <Navbar />
            <main className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
                <div className="flex flex-col items-center gap-2">
                    <div className="font-mono text-5xl sm:text-6xl tracking-tight tabular-nums">
                        {pats.toLocaleString()}
                    </div>
                    <div className="text-xs text-white/50 uppercase tracking-widest">
                        {pats === 1 ? "pat worldwide" : "pats worldwide"}
                    </div>
                </div>

                <div
                    ref={containerRef}
                    className="relative select-none cursor-grab active:cursor-grabbing"
                    onMouseEnter={handleEnter}
                    onMouseMove={handleMove}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        ref={imgRef}
                        src={frameSrc(0)}
                        alt="cat"
                        draggable={false}
                        className="max-w-[480px] w-[80vw] aspect-square object-cover border border-white/15 pointer-events-none"
                    />
                    {!ready && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white/60 text-xs">
                            loading frames {loadedCount}/{TOTAL_FRAMES}...
                        </div>
                    )}
                </div>

                <p className="text-xs text-white/50 text-center max-w-xs">
                    move left to play, right to reverse. pet the cat.
                </p>
            </main>
        </div>
    );
}
