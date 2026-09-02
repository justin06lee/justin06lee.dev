"use client";

import { useEffect } from "react";
import Navbar from "@/components/Navbar";

// Route-segment error boundary. The root layout (and its providers) still wraps
// this, so it renders inside the normal chrome — only the failed segment is
// replaced. Anything this component itself throws bubbles up to global-error.
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <Navbar />
            <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
                <p className="text-4xl tracking-tight sm:text-5xl">
                    something broke.
                </p>
                <p className="max-w-md text-sm text-white/60">
                    an unexpected error got in the way. you can try again.
                </p>
                <button
                    type="button"
                    onClick={reset}
                    className="px-4 py-2 text-sm text-white underline-offset-4 hover:underline cursor-pointer"
                >
                    try again
                </button>
            </main>
        </div>
    );
}
