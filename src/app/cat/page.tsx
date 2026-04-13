"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";

const TOTAL_FRAMES = 115;
const SPRITE_COLS = 12;
const SPRITE_ROWS = 10;
const SPRITE_URL = "/cat-sprite.jpg";
const FLUSH_INTERVAL_MS = 1000;
const POLL_INTERVAL_MS = 5000;
const EDGE_LEFT = 0.22;
const EDGE_RIGHT = 0.78;

// Map mouse X position (0 = left, 1 = right) to a frame index.
// Left side of image = later in the animation (forward play as mouse moves left).
const relXToFrame = (relX: number) => {
    const clamped = Math.min(1, Math.max(0, relX));
    return Math.round((1 - clamped) * (TOTAL_FRAMES - 1));
};

export default function CatPage() {
    const spriteRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const pendingFrameRef = useRef<number | null>(null);
    const currentFrameRef = useRef(-1);
    const lastEdgeRef = useRef<"left" | "right" | null>(null);
    const pendingPatsRef = useRef(0);
    const flushingRef = useRef(false);
    const [pats, setPats] = useState(0);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const img = new Image();
        img.onload = () => { if (!cancelled) setReady(true); };
        img.onerror = () => { if (!cancelled) setReady(true); };
        img.src = SPRITE_URL;
        return () => { cancelled = true; };
    }, []);

    const flush = async () => {
        if (flushingRef.current) return;
        const delta = pendingPatsRef.current;
        if (delta <= 0) return;
        flushingRef.current = true;
        pendingPatsRef.current = 0;
        try {
            const res = await fetch("/api/pats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ delta }),
            });
            if (res.ok) {
                const data = await res.json();
                if (typeof data.count === "number") {
                    setPats((p) => Math.max(p, data.count));
                }
            } else {
                pendingPatsRef.current += delta;
            }
        } catch {
            pendingPatsRef.current += delta;
        } finally {
            flushingRef.current = false;
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
            if (document.visibilityState !== "visible") return;
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
        if (idx === null || !spriteRef.current) return;
        if (idx === currentFrameRef.current) return;
        currentFrameRef.current = idx;
        const col = idx % SPRITE_COLS;
        const row = Math.floor(idx / SPRITE_COLS);
        const x = (col / (SPRITE_COLS - 1)) * 100;
        const y = (row / (SPRITE_ROWS - 1)) * 100;
        spriteRef.current.style.backgroundPosition = `${x}% ${y}%`;
    };

    const registerPat = () => {
        const wasIdle = pendingPatsRef.current === 0;
        pendingPatsRef.current += 1;
        setPats((p) => p + 1);
        if (wasIdle && !flushingRef.current) flush();
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
                registerPat();
            }
            lastEdgeRef.current = "left";
        } else if (relX >= EDGE_RIGHT) {
            if (lastEdgeRef.current === "left") {
                registerPat();
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
                        {pats === 1 ? "time bothered, globally" : "times bothered, globally"}
                    </div>
                </div>

                <div
                    ref={containerRef}
                    className="relative select-none cursor-grab active:cursor-grabbing max-w-[480px] w-[80vw] aspect-square border border-white/15"
                    onMouseEnter={handleEnter}
                    onMouseMove={handleMove}
                    role="img"
                    aria-label="cat"
                >
                    <div
                        ref={spriteRef}
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: `url(${SPRITE_URL})`,
                            backgroundSize: `${SPRITE_COLS * 100}% ${SPRITE_ROWS * 100}%`,
                            backgroundPosition: "0% 0%",
                            backgroundRepeat: "no-repeat",
                            imageRendering: "auto",
                        }}
                    />
                    {!ready && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white/60 text-xs">
                            loading...
                        </div>
                    )}
                </div>

                <p className="text-xs text-white/50 text-center max-w-xs">
                    pet the cat.
                </p>
            </main>
        </div>
    );
}
