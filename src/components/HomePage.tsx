"use client";

import { Button } from "@/components/ui/button";
import AsciiSpinningDonut from "@/components/AsciiDonut";
import React, { useEffect, useRef, useState } from "react";
import * as motion from "motion/react-client";
import Link from "next/link"

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** Single word with HYPERPLEXED-style scramble on hover.
 *  - No hover background/color changes.
 *  - Word width is measured and fixed so the sentence never reflows.
 */
function ScrambleWord({ text }: { text: string }) {
	const visRef = useRef<HTMLSpanElement | null>(null);   // visible text span
	const sizerRef = useRef<HTMLSpanElement | null>(null); // hidden measurer
	const intervalRef = useRef<number | null>(null);
	const [widthPx, setWidthPx] = useState<number | null>(null);

	// Measure natural width of the word (in current font/size) and lock it.
	useEffect(() => {
		const measure = () => {
			if (!sizerRef.current) return;
			const w = sizerRef.current.getBoundingClientRect().width;
			if (w) setWidthPx(w);
		};

		// Initial + on resize
		measure();
		const onResize = () => measure();
		window.addEventListener("resize", onResize);

		// Fallback: re-measure once after fonts settle
		const t = window.setTimeout(measure, 50);

		return () => {
			window.removeEventListener("resize", onResize);
			window.clearTimeout(t);
		};
	}, [text]);

	// Clear any running interval on unmount
	useEffect(() => {
		return () => {
			if (intervalRef.current) window.clearInterval(intervalRef.current);
		};
	}, []);

	const handleMouseEnter = () => {
		if (!visRef.current) return;
		const el = visRef.current;
		const targetValue = text;

		let iteration = 0;
		if (intervalRef.current) window.clearInterval(intervalRef.current);

		intervalRef.current = window.setInterval(() => {
			if (!visRef.current) return;

			const scrambled = targetValue
				.split("")
				.map((_, idx) =>
					idx < iteration
						? targetValue[idx]
						: LETTERS[Math.floor(Math.random() * 26)]
				)
				.join("");

			el.textContent = scrambled;

			iteration += 1 / 3;
			if (iteration >= targetValue.length) {
				window.clearInterval(intervalRef.current!);
				intervalRef.current = null;
				el.textContent = targetValue;
			}
		}, 30);
	};

	return (
		<>
			{/* Hidden measurer (same text, same styles) */}
			<span
				ref={sizerRef}
				className="absolute -left-[9999px] -top-[9999px] whitespace-pre"
				aria-hidden
			>
				{text}
			</span>

			{/* Visible word: inline-block with fixed width to prevent reflow */}
			<span
				className="inline-block whitespace-nowrap align-baseline cursor-default"
				style={widthPx ? { width: `${widthPx}px` } : undefined}
				onMouseEnter={handleMouseEnter}
			>
				<span ref={visRef}>{text}</span>
			</span>
		</>
	);
}

function ScrambleText({ text }: { text: string }) {
	const parts = text.split(/(\s+)/);
	return (
		<>
			{parts.map((p, i) =>
				/\s+/.test(p) ? <span key={i}>{p}</span> : <ScrambleWord key={i} text={p} />
			)}
		</>
	);
}

export default function HomePage() {
	return (
		<div className="grid grid-cols-2">
			<div className="h-screen flex flex-col justify-center">
				<motion.div
					initial={{ opacity: 0, y: 100 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{
						duration: 0.8,
						delay: 1
					}}
				>
					<div>
						<AsciiSpinningDonut
							width={120}
							height={60}
							R={0.7}
							r={0.5}
							K={240}
							D={7}
							speed={0.5625}
						/>
					</div>
				</motion.div>
			</div>

			<div className="h-screen flex flex-col justify-center">
				<div className="flex flex-col gap-4">
					<div>
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{
								duration: 0.8,
								delay: 2
							}}
						>
							<ScrambleText text="im justin." />
						</motion.div>
					</div>

					<div className="leading-relaxed">

						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{
								duration: 0.8,
								delay: 2.2
							}}
						>
							<ScrambleText text="im an incoming ucsc freshman majoring in computer" />
							<br />
						</motion.div>
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{
								duration: 0.8,
								delay: 2.3
							}}
						>
							<ScrambleText text="science, and an addict for the low-level. i love c(++), go, rust, and zig," />
							<br />
						</motion.div>
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{
								duration: 0.8,
								delay: 2.4
							}}
						>
							<ScrambleText text="but have also been developing a new addiction towards" />
							<br />
						</motion.div>
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{
								duration: 0.8,
								delay: 2.5
							}}
						>
							<ScrambleText text="llms lately, and have been working with agentic llms, mcp and rag." />
							<br />
						</motion.div>
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{
								duration: 0.8,
								delay: 2.6
							}}
						>
							<ScrambleText text="feel free to look around. this is where i'll be posting everything." />
						</motion.div>
					</div>

					<div>
						<div className="mt-4 mb-2">
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{
									duration: 0.8,
									delay: 2.7
								}}
							>
								get started.
							</motion.div>
						</div>

						<div className="flex justify-center scale-110">
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{
									duration: 0.8,
									delay: 2.8
								}}
							>
								<Button variant="link" asChild>
									<Link href="/hobbies">hobbies</Link>
								</Button>
								<Button variant="link" asChild>
									<Link href="/projects">projects</Link>
								</Button>
							</motion.div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
