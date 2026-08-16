"use client";

import { useEffect } from "react";

// Root fallback: catches errors thrown by the root layout itself, so it must
// render its own <html>/<body> (the layout it would normally sit inside is what
// failed). Tailwind/globals.css can't be relied on here, so styles are inline.
export default function GlobalError({
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
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    background: "#000000",
                    color: "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1.5rem",
                    padding: "1.5rem",
                    textAlign: "center",
                    fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                }}
            >
                <p style={{ fontSize: "2rem", margin: 0, letterSpacing: "-0.02em" }}>
                    something broke.
                </p>
                <p
                    style={{
                        maxWidth: "28rem",
                        margin: 0,
                        fontSize: "0.875rem",
                        color: "rgba(255,255,255,0.6)",
                    }}
                >
                    the page failed to load. try reloading.
                </p>
                <button
                    type="button"
                    onClick={reset}
                    style={{
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.4)",
                        color: "#ffffff",
                        padding: "0.5rem 1rem",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                    }}
                >
                    try again
                </button>
            </body>
        </html>
    );
}
