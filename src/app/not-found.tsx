"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as motion from "motion/react-client";
import Navbar from "@/components/Navbar";

export default function NotFound() {
    const [ascii, setAscii] = useState<string>("");

    useEffect(() => {
        const n = Math.floor(Math.random() * 10) + 1;
        fetch(`/ascii/ascii${n}.txt`)
            .then((r) => (r.ok ? r.text() : ""))
            .then(setAscii)
            .catch(() => setAscii(""));
    }, []);

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <Navbar />
            <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8">
                <motion.pre
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: ascii ? 1 : 0, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="font-mono text-[10px] sm:text-xs md:text-sm leading-tight whitespace-pre text-left text-white/80 select-none inline-block"
                    aria-hidden
                >
                    {ascii}
                </motion.pre>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="font-mono text-5xl sm:text-6xl tracking-tight"
                >
                    404
                </motion.div>

                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    className="text-sm text-white/60 max-w-md"
                >
                    this page wandered off. the cat hasn&apos;t seen it either.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.7 }}
                    className="flex gap-6 text-sm"
                >
                    <Link href="/" className="underline-offset-4 hover:underline px-4 py-2">
                        home
                    </Link>
                    <Link href="/projects" className="underline-offset-4 hover:underline px-4 py-2">
                        projects
                    </Link>
                    <Link href="/hobbies" className="underline-offset-4 hover:underline px-4 py-2">
                        hobbies
                    </Link>
                </motion.div>
            </main>
        </div>
    );
}
