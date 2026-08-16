import type { Metadata } from "next";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
    title: "oddjobs",
    description: "odd jobs and miscellaneous experiments.",
    alternates: { canonical: "/oddjobs" },
};

export default function OddjobsPage() {
    return (
        <div className="min-h-screen bg-black text-white">
            <Navbar />
            <main />
        </div>
    );
}
