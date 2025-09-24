"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import {useRouter} from "next/navigation"

export default function Navbar() {
    const [open, setOpen] = useState(false);
    const router = useRouter()

    const playIntro = () => {
        router.push("/?intro=1", { scroll: false });
        // window.dispatchEvent(new Event("replay-intro"));
    };

    const NavLinks = () => (
        <>
            <Button variant="link" asChild>
                <Link href="/in-development">in development</Link>
            </Button>
            <Button variant="link" asChild>
                <Link href="/hobbies">hobbies</Link>
            </Button>
            <Button variant="link" asChild>
                <Link href="/projects">projects</Link>
            </Button>
            <Button variant="link" asChild>
                <Link href="/ideas">ideas</Link>
            </Button>
        </>
    );

    return (
        <div className="fixed inset-x-0 top-0 z-40">
            <div className="flex items-center justify-between w-full px-4 sm:px-6 py-2">
                <div className="flex items-center gap-2">
                    <Button variant="link" asChild>
                        <Link href="/">justin06lee.dev</Link>
                    </Button>
                    <Button variant="link" onClick={playIntro} className="hidden md:inline-flex">
                        intro
                    </Button>
                </div>

                <div className="hidden md:flex items-center gap-1">
                    <NavLinks />
                </div>

                <div className="md:hidden">
                    <Sheet open={open} onOpenChange={setOpen}>
                        {!open && (
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                        )}

                        <SheetContent side="right" className="w-72 sm:w-80 z-[80]">
                            <SheetHeader className="text-left pr-10">
                                <SheetTitle>Menu</SheetTitle>
                            </SheetHeader>

                            <div className="mt-4 flex flex-col items-start gap-2">
                                <SheetClose asChild>
                                    <Button variant="link" onClick={playIntro}>
				    intro
                                    </Button>
                                </SheetClose>
                                <SheetClose asChild>
                                    <Button variant="link" asChild>
                                        <Link href="/in-development">in development</Link>
                                    </Button>
                                </SheetClose>
                                <SheetClose asChild>
                                    <Button variant="link" asChild>
                                        <Link href="/hobbies">hobbies</Link>
                                    </Button>
                                </SheetClose>
                                <SheetClose asChild>
                                    <Button variant="link" asChild>
                                        <Link href="/projects">projects</Link>
                                    </Button>
                                </SheetClose>
                                <SheetClose asChild>
                                    <Button variant="link" asChild>
                                        <Link href="/ideas">ideas</Link>
                                    </Button>
                                </SheetClose>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </div>
    );
}
