"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link"

export default function Navbar() {
	const replayIntro = () => {
		try {
			localStorage.removeItem("did_anim");
			// Signal Home to replay the intro (no reload)
			window.dispatchEvent(new Event("replay-intro"));
		} catch (e) {
			console.error("Failed to reset intro flag", e);
		}
	};

	return (
		<div className="fixed inset-x-0 top-0 z-[70]">
			<div className="flex justify-between w-screen">
				<div className="mt-2 ml-6">
					<Button variant="link" onClick={replayIntro} title="Replay intro" asChild>
						<Link href="/">
							sehnsucht.dev
						</Link>
					</Button>
					<Button variant="link" asChild>
						<Link href="/">home</Link>
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
