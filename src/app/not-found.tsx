import Navbar from "@/components/Navbar";
import { NotFound as ChromeNotFound } from "@/components/chrome/not-found";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <Navbar />
            <main className="flex-1 flex items-center justify-center">
                <ChromeNotFound
                    message="this page wandered off. the cat hasn't seen it either."
                    links={[
                        { label: "home", href: "/" },
                        { label: "gallery", href: "/gallery" },
                    ]}
                    credit={false}
                />
            </main>
        </div>
    );
}
