"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar as ChromeNavbar } from "@/components/chrome/navbar";
import { Rainbow } from "@/components/chrome/rainbow";
import type { Pfp } from "@/lib/site-config";

function RainbowCat() {
    return (
        <Rainbow className="font-mono tracking-tight">^cat^</Rainbow>
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
    const [fetchedPfp, setFetchedPfp] = useState<Pfp | undefined>(pfp);
    const router = useRouter();

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
        router.push("/?intro=1", { scroll: false });
    };

    const linkClass =
        "text-sm text-white underline-offset-4 hover:underline whitespace-nowrap";

    const brand = (
        <>
            <Link href="/" className={`${linkClass} hidden lg:inline-flex`}>
                justin06lee.dev
            </Link>
            {fetchedPfp?.url && (
                <span className="inline-flex lg:hidden">
                    <NavPfp pfp={fetchedPfp} />
                </span>
            )}
            <button onClick={playIntro} className={`${linkClass} hidden lg:inline-flex`}>
                intro
            </button>
            <Link href="/cat" className="text-sm underline-offset-4 hover:underline inline-flex whitespace-nowrap">
                <RainbowCat />
            </Link>
        </>
    );

    const mobilePanelExtras = (
        <>
            <button onClick={playIntro} className={`${linkClass} py-1`}>
                intro
            </button>
            <Link href="/cat" className="text-sm underline-offset-4 hover:underline py-1">
                <RainbowCat />
            </Link>
        </>
    );

    return (
        <ChromeNavbar
            brand={brand}
            links={[
                { label: "calendar", href: "/calendar" },
                { label: "articles", href: "/articles" },
                { label: "gallery", href: "/gallery" },
            ]}
            mobilePanelExtras={mobilePanelExtras}
            menuLabel="Menu"
        />
    );
}
