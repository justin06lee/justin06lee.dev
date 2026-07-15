"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import { SpriteScrubber } from "@/components/chrome/sprite-scrubber";
import { CountUp } from "@/components/chrome/count-up";

const TOTAL_FRAMES = 115;
const SPRITE_COLS = 12;
const SPRITE_ROWS = 10;
const SPRITE_URL = "/cat-sprite.jpg";
const FLUSH_INTERVAL_MS = 1000;
const POLL_INTERVAL_MS = 5000;
const EDGE_LEFT = 0.22;
const EDGE_RIGHT = 0.78;

// With SpriteScrubber's reverse mapping, the left dead zone (relX <= EDGE_LEFT)
// clamps to the last frame and the right dead zone (relX >= EDGE_RIGHT) clamps
// to frame 0. That lets us detect edge crossings — and thus count pats — purely
// from the frame index, without owning the pointer math.
const LEFT_EDGE_FRAME = TOTAL_FRAMES - 1;
const RIGHT_EDGE_FRAME = 0;

export default function CatPage() {
    const lastEdgeRef = useRef<"left" | "right" | null>(null);
    const pendingPatsRef = useRef(0);
    const flushingRef = useRef(false);
    // flush() runs on unmount to drain pending pats; guard its post-await setState
    // so we don't update state on an unmounted component.
    const mountedRef = useRef(true);
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
                if (mountedRef.current && typeof data.count === "number") {
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
            if (flushingRef.current || pendingPatsRef.current <= 0) return;
            const delta = pendingPatsRef.current;
            pendingPatsRef.current = 0;
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
            mountedRef.current = false;
            flush();
        };
    }, []);

    const registerPat = () => {
        const wasIdle = pendingPatsRef.current === 0;
        pendingPatsRef.current += 1;
        setPats((p) => p + 1);
        if (wasIdle && !flushingRef.current) flush();
    };

    // A pat is one full sweep between the two edge zones. Guarding on the
    // opposite prior edge (with a null start) means the first pat only fires
    // after a complete left<->right pass — no spurious pat on entry.
    const handleFrameChange = (frame: number) => {
        if (frame === LEFT_EDGE_FRAME) {
            if (lastEdgeRef.current === "right") registerPat();
            lastEdgeRef.current = "left";
        } else if (frame === RIGHT_EDGE_FRAME) {
            if (lastEdgeRef.current === "left") registerPat();
            lastEdgeRef.current = "right";
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <Navbar />
            <main className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
                <div className="flex flex-col items-center gap-2">
                    <CountUp
                        value={pats}
                        as="div"
                        format={(n) => Math.round(n).toLocaleString()}
                        className="font-mono text-5xl sm:text-6xl tracking-tight"
                    />
                    <div className="text-xs text-white/50 uppercase tracking-widest">
                        {pats === 1 ? "time bothered, globally" : "times bothered, globally"}
                    </div>
                </div>

                <div className="relative select-none max-w-[480px] w-[80vw]">
                    <SpriteScrubber
                        src={SPRITE_URL}
                        frames={TOTAL_FRAMES}
                        cols={SPRITE_COLS}
                        rows={SPRITE_ROWS}
                        edgeLeft={EDGE_LEFT}
                        edgeRight={EDGE_RIGHT}
                        reverse
                        aspectRatio="1 / 1"
                        onFrameChange={handleFrameChange}
                        className="w-full"
                        aria-label="cat"
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
