"use client";

import { useEffect, useRef, useState } from "react";
import type { Pfp } from "@/lib/site-config";

export default function PfpTile({ pfp }: { pfp: Pfp }) {
    const [hover, setHover] = useState(false);
    const shineRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!hover || !shineRef.current) return;
        const anim = shineRef.current.animate(
            [
                { transform: "translateX(-220%)", opacity: 0, offset: 0 },
                { opacity: 1, offset: 0.15 },
                { opacity: 1, offset: 0.85 },
                { transform: "translateX(320%)", opacity: 0, offset: 1 },
            ],
            { duration: 900, easing: "ease-in-out", fill: "forwards" }
        );
        return () => anim.cancel();
    }, [hover]);

    return (
        <div style={{ perspective: "500px" }}>
            <div
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                className="relative size-16 overflow-hidden border border-white/70 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_8px_24px_-8px_rgba(0,0,0,0.6)] cursor-pointer"
                style={{
                    transform: hover
                        ? "rotateX(14deg) rotateY(14deg) translateZ(0)"
                        : "rotateX(0deg) rotateY(0deg) translateZ(0)",
                    transformStyle: "preserve-3d",
                    transition: "transform 0.4s cubic-bezier(0.2, 0.9, 0.2, 1)",
                    willChange: "transform",
                }}
            >
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
                <div
                    ref={shineRef}
                    aria-hidden
                    className="absolute top-0 bottom-0 w-1/2 pointer-events-none"
                    style={{
                        background:
                            "linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.75) 50%, transparent 80%)",
                        filter: "blur(1px)",
                        mixBlendMode: "screen",
                        transform: "translateX(-220%)",
                        opacity: 0,
                    }}
                />
            </div>
        </div>
    );
}
