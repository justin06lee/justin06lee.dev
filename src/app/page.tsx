"use client";

import { useEffect, useState } from "react";
import * as motion from "motion/react-client";
import Navbar from "@/components/Navbar";
import HomePage from "@/components/HomePage";
import AsciiSpinningDonut from "@/components/AsciiDonut";
import { Button } from "@/components/ui/button"

export default function Home() {
	// null = unknown (prevents hydration flash), boolean once decided
	const [hasPlayed, setHasPlayed] = useState<null | boolean>(null);
	// Force-remount animated blocks when we toggle intro on/off
	const [introCycle, setIntroCycle] = useState(0);

	// Decide whether to skip the intro on first load
	useEffect(() => {
		const did =
			typeof window !== "undefined" &&
			localStorage.getItem("did_anim") === "true";
		setHasPlayed(did);
	}, []);

	// Listen for "Intro" requests from the navbar (no reload)
	useEffect(() => {
		const onReplay = () => {
			setHasPlayed(false);
			setIntroCycle((c) => c + 1); // remount motion blocks to reapply delays
		};
		window.addEventListener("replay-intro", onReplay);
		return () => window.removeEventListener("replay-intro", onReplay);
	}, []);

	if (hasPlayed === null) return null; // avoid SSR mismatch

	return (
		<div className="w-screen flex justify-center text-center bg-black text-white">
			{/* key={introCycle} ensures the animations restart when we replay/skip */}
			<div className="min-h-screen flex flex-col" key={introCycle}>
				{/* Navbar */}
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 1, delay: hasPlayed ? 0 : 16 }}
				>
					<Navbar />
				</motion.div>

				{/* Main content shows only after intro (or immediately if already played) */}
				{hasPlayed && <HomePage />}

				{/* Intro overlay (only when not played) */}
				{!hasPlayed && (
					<Intro
						onDone={() => {
							// Mark as played and remount so navbar/content appear immediately
							localStorage.setItem("did_anim", "true");
							setHasPlayed(true);
							setIntroCycle((c) => c + 1);
						}}
					/>
				)}
			</div>
		</div>
	);
}

function Intro({ onDone }: { onDone: () => void }) {
	// in = fade-in start time; out = fade-out start time (in seconds)
	const steps = [
		{ text: "hi.", in: 2, out: 5 },
		{ text: "im justin.", in: 6, out: 10 },
		{ text: "welcome to my website.", in: 11, out: 15 },
	];

	return (
		<div className="fixed inset-0 z-50 flex flex-col items-center justify-center -mt-8">
			{/* Donut */}
			<motion.div
				initial={{ opacity: 1, y: 0 }}
				animate={{ opacity: 0, y: 10 }}
				transition={{ duration: 0.8, delay: 15 }}
				className="mb-12"
			>
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 1 }}
					className="text-white"
				>
					<AsciiSpinningDonut />
				</motion.div>
			</motion.div>

			{/* Lines of intro text — stacked so they don’t shift */}
			<div
				className="relative text-white text-lg leading-tight"
				style={{ height: "1.75em", width: "250px" }}
			>
				{steps.map((s, i) => (
					<motion.div
						key={i}
						className="absolute inset-0 flex items-center justify-center"
						initial={{ opacity: 1, y: 0 }}
						animate={{ opacity: 0, y: 10 }}
						transition={{ duration: 1, delay: s.out }}
						// When the last line finishes, complete the intro
						onAnimationComplete={i === steps.length - 1 ? onDone : undefined}
					>
						<motion.div
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 1, delay: s.in }}
						>
							<div>{s.text}</div>
						</motion.div>
					</motion.div>
				))}
			</div>

			{/* Skip button (bottom center) */}
			<motion.div
				initial={{ opacity: 1, y: 0 }}
				animate={{ opacity: 0, y: 10 }}
				transition={{ duration: 0.8, delay: 15 }}
			>
				<Button
					variant="link"
					onClick={onDone}
					className="fixed bottom-12"
					aria-label="Skip intro"
				>
					Skip
				</Button>
			</motion.div>
		</div>
	);
}
