"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar as ChromeNavbar, type NavbarProps } from "@/components/chrome/navbar";
import { Rainbow } from "@/components/chrome/rainbow";
import { useIsPhone } from "@/hooks/use-phone";
import type { Pfp } from "@/lib/site-config";

// Mono on purpose, the one place in the nav: the carets are ascii, and the
// cat page they lead to is ascii and sprites. text-sm keeps it the size of the
// links beside it; inheriting the body's 16px made it read as a heading.
function RainbowCat() {
    return <Rainbow className="font-mono text-sm tracking-tight">^cat^</Rainbow>;
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

export default function Navbar({
    pfp,
    entrance,
}: { pfp?: Pfp; entrance?: NavbarProps["entrance"] } = {}) {
    const [fetchedPfp, setFetchedPfp] = useState<Pfp | undefined>(pfp);
    const router = useRouter();
    // The home page doesn't play the intro on a phone, so the nav doesn't
    // offer it there. Resolving after mount is free here: leftLinks only ever
    // appear on a phone inside the hamburger panel, which isn't rendered until
    // it is opened, so there is nothing to see removed.
    const phone = useIsPhone();

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
        // The intro is a client-side animation, so on the home page replay it
        // where it stands. Routing to /?intro=1 and back round-trips a
        // force-dynamic route through the server for no reason, and when that
        // navigation commits it takes the whole tree with it: the page blinks
        // out and re-enters, long after the intro has finished.
        if (window.location.pathname === "/") {
            window.dispatchEvent(new Event("replay-intro"));
            return;
        }
        router.push("/?intro=1", { scroll: false });
    };

    const brand = (
        <>
            <Link
                href="/"
                className="text-sm text-white underline-offset-4 hover:underline whitespace-nowrap hidden lg:inline-flex"
            >
                justin06lee.dev
            </Link>
            {fetchedPfp?.url && (
                <span className="inline-flex lg:hidden">
                    <NavPfp pfp={fetchedPfp} />
                </span>
            )}
            {/* Cat lives in `brand`, not `leftLinks`, so it stays inline at every
                width — chrome's navbar only shows leftLinks on desktop and folds
                them into the mobile hamburger. Here it sits next to the pfp on
                mobile and next to the name on desktop, and never hides in the menu. */}
            <Link href="/cat" aria-label="cat" className="inline-flex items-center">
                <RainbowCat />
            </Link>
        </>
    );

    return (
        <ChromeNavbar
            brand={brand}
            entrance={entrance}
            leftLinks={phone ? [] : [
                { label: "intro", onClick: playIntro, id: "intro" },
            ]}
            links={[
                { label: "calendar", href: "/calendar" },
                { label: "articles", href: "/articles" },
                { label: "gallery", href: "/gallery" },
                { label: "oddjobs", href: "https://oddjob.justin06lee.dev" },
            ]}
            linkComponent={Link}
        />
    );
}
