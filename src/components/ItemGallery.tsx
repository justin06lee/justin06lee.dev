"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import * as motion from "motion/react-client";
import { ListFilter } from "lucide-react";

export type GalleryItem = {
	id: string;
	title: string;
	link?: string;
	description: string;
	year: number;
	tech: string[];
	repo?: string;
	live?: string;
	notes?: string;
};

type SortKey = "newest" | "oldest" | "az" | "za";

export function ItemGallery({
	title,
	subtitle = "A curated list of things I've built or explored.",
	items,
	initialSort = "newest",
	chipBase = 0.4,
	chipStep = 0.1,
}: {
	title: string;
	subtitle?: string;
	items: GalleryItem[];
	initialSort?: SortKey;
	chipBase?: number;
	chipStep?: number;
}) {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<string[]>([]);
	const [sort, setSort] = useState<SortKey>(initialSort);
	const [sortOpen, setSortOpen] = useState(false);
	const sortRef = useRef<HTMLDivElement>(null);
	const hasAnimated = useRef(false);

	// After first render, mark animations as done
	useEffect(() => {
		const timer = setTimeout(() => {
			hasAnimated.current = true;
		}, 1500);
		return () => clearTimeout(timer);
	}, []);

	// Close sort dropdown on outside click
	useEffect(() => {
		if (!sortOpen) return;
		const handler = (e: MouseEvent) => {
			if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
				setSortOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [sortOpen]);

	const sortLabel = (s: SortKey) =>
		s === "newest" ? "Newest" :
			s === "oldest" ? "Oldest" :
				s === "az" ? "A → Z" : "Z → A";

	const allTags = useMemo(() => {
		const s = new Set<string>();
		items.forEach((p) => p.tech.forEach((t) => s.add(t)));
		return Array.from(s).sort((a, b) => a.localeCompare(b));
	}, [items]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		const res = items.filter((p) => {
			const text = `${p.title} ${p.description} ${p.tech.join(" ")}`.toLowerCase();
			const matchesQ = q === "" || text.includes(q);
			const matchesTags = selected.length === 0 || selected.every((t) => p.tech.includes(t));
			return matchesQ && matchesTags;
		});

		res.sort((a, b) => {
			switch (sort) {
				case "newest": return b.year - a.year || a.title.localeCompare(b.title);
				case "oldest": return a.year - b.year || a.title.localeCompare(b.title);
				case "az": return a.title.localeCompare(b.title);
				case "za": return b.title.localeCompare(a.title);
			}
		});

		return res;
	}, [items, query, selected, sort]);

	const toggleTag = (t: string) => {
		setSelected((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
	};

	// Only use staggered delays on first render
	const shouldAnimate = !hasAnimated.current;
	const animStart = shouldAnimate ? chipBase + allTags.length * chipStep : 0;

	return (
		<main className="max-w-6xl mx-auto px-4 pt-16 pb-24">
			<div className="mb-8 flex items-end justify-between gap-4">
				<div>
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.1 }}
					>
						<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
					</motion.div>

					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.2 }}
					>
						<p className="text-white/70 mt-1 text-sm">{subtitle}</p>
					</motion.div>
				</div>

				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.3 }}
					className="text-sm"
				>
					<div ref={sortRef} className="relative">
						<button
							onClick={() => setSortOpen((o) => !o)}
							className="inline-flex items-center gap-2 border border-white/20 bg-transparent px-3 py-1.5 text-sm hover:bg-white/5 transition-colors"
							aria-label="Open sort menu"
						>
							<ListFilter className="h-4 w-4" />
							<span>Sort: {sortLabel(sort)}</span>
						</button>

						{sortOpen && (
							<div className="absolute right-0 top-full mt-1 w-48 border border-white/10 bg-black shadow-md z-50">
								<div className="px-2 py-1.5 text-sm font-medium text-white/70">Sort by</div>
								<div className="h-px bg-white/10" />
								{(["newest", "oldest", "az", "za"] as SortKey[]).map((key) => (
									<button
										key={key}
										onClick={() => { setSort(key); setSortOpen(false); }}
										className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 transition-colors flex items-center gap-2 ${sort === key ? "text-white" : "text-white/60"}`}
									>
										<span className={`inline-block w-2 h-2 border border-current ${sort === key ? "bg-white" : ""}`} />
										{sortLabel(key)}
									</button>
								))}
							</div>
						)}
					</div>
				</motion.div>
			</div>

			<div className="mb-5">
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.4 }}
				>
					<input
						type="text"
						placeholder="Search items, tech…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						className="w-full bg-black border border-white/20 px-4 py-2 outline-none focus:border-white/40 text-white placeholder:text-white/40"
					/>
				</motion.div>
			</div>

			<div className="flex flex-wrap gap-2 mb-8">
				{allTags.map((t, i) => (
					<motion.div
						key={t}
						initial={shouldAnimate ? { opacity: 0, y: -10 } : false}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: shouldAnimate ? chipBase + i * chipStep : 0 }}
					>
						<button
							onClick={() => toggleTag(t)}
							className={[
								"px-3 py-1 text-sm transition",
								selected.includes(t)
									? "bg-white text-black"
									: "bg-transparent text-white/60 hover:text-white hover:bg-white/10",
							].join(" ")}
						>
							{t}
						</button>
					</motion.div>
				))}

				{selected.length > 0 && (
					<button onClick={() => setSelected([])} className="text-sm text-white underline-offset-4 hover:underline px-2 -mt-1">
						Clear filters
					</button>
				)}
			</div>

			{filtered.length === 0 ? (
				<div className="text-center text-white/60 py-24">No items match your filters.</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
					{filtered.map((p, i) => (
						<ProjectCard key={p.id} p={p} i={i} k={animStart} shouldAnimate={shouldAnimate} />
					))}
				</div>
			)}

			<div className="mt-10 text-center text-xs text-white/50">
				Want more details? Ping me and I&apos;ll write deeper docs.
			</div>
		</main>
	);
}

function ProjectCard({ p, i, k, shouldAnimate }: { p: GalleryItem; i: number; k: number; shouldAnimate: boolean }) {
	return (
		<motion.div
			initial={shouldAnimate ? { opacity: 0, y: -10 } : false}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.8, delay: shouldAnimate ? k + i * 0.1 : 0 }}
			className="border border-white/10 bg-transparent p-5 flex flex-col gap-3"
		>
			<div className="flex items-start justify-between gap-3">
				{p.link && <a href={p.link} target="_blank" rel="noreferrer noopener"><h3 className="text-lg font-semibold leading-tight hover:underline underline-offset-5">{p.title}</h3></a>}
				{!p.link && <h3 className="text-lg font-semibold leading-tight">{p.title}</h3>}
				<span className="text-xs text-white/60 select-none">{p.year}</span>
			</div>

			<p className="text-sm text-white/80">{p.description}</p>
			{p.notes && <p className="text-xs text-white/60 italic">{p.notes}</p>}

			<div className="flex flex-wrap gap-2 mt-1">
				{p.tech.map((t) => (
					<span
						key={t}
						className="px-2 py-0.5 text-xs border border-white/15 text-white/80"
					>
						{t}
					</span>
				))}
			</div>

			<div className="mt-3 flex items-center gap-2">
				{p.repo && (
					<a href={p.repo} target="_blank" rel="noreferrer noopener" className="text-sm text-white underline-offset-4 hover:underline px-2 py-0">
						View Code
					</a>
				)}
				{p.live && (
					<a href={p.live} target="_blank" rel="noreferrer noopener" className="text-sm text-white underline-offset-4 hover:underline px-2 py-0">
						Live
					</a>
				)}
			</div>
		</motion.div>
	);
}
