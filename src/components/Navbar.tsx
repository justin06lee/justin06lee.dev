"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Navbar() {
	const playIntro = () => {
		// Don’t touch localStorage here—Home will handle marking it as played on finish
		window.dispatchEvent(new Event("replay-intro"));
	};

	return (
		<div className="fixed inset-x-0 top-0 z-[70]">
			<div className="flex justify-between w-screen">
				<div className="mt-2 ml-6">
					{/* Brand: just go home (NO intro replay) */}
					<Button variant="link" asChild>
						<Link href="/">justin06lee.dev</Link>
					</Button>

					{/* Intro trigger */}
					<Button variant="link" onClick={playIntro}>
						intro
					</Button>
				</div>

				<div className="flex mr-6 mt-2">
					<Button variant="link" asChild>
						<Link href="/hobbies">hobbies</Link>
					</Button>
					<Button variant="link" asChild>
						<Link href="/projects">projects</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
