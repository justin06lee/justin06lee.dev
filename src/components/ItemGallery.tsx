"use client";

import React, { useMemo, useState } from "react";
import * as motion from "motion/react-client";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { ListFilter } from "lucide-react";

export type GalleryItem = {
	id: string;
	title: string;
	description: string;
	year: number;          // used for sorting
	tech: string[];        // tags/filters
	repo?: string;         // optional "View Code" link
	live?: string;         // optional "Live" link
	notes?: string;        // optional italic note
};

type SortKey = "newest" | "oldest" | "az" | "za";

export function ItemGallery({
	title,
	subtitle = "A curated list of things I’ve built or explored.",
	items,
	initialSort = "newest",
	chipBase = 0.4,        // animation: base delay
	chipStep = 0.1,        // animation: per-chip stagger
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

	const sortLabel = (s: SortKey) =>
		s === "newest" ? "Newest" :
			s === "oldest" ? "Oldest" :
				s === "az" ? "A → Z" : "Z → A";

	// All unique tags from items.tech
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

	const animStart = chipBase + allTags.length * chipStep;

	return (
		<main className="max-w-6xl mx-auto px-4 pt-16 pb-24">
			{/* Header */}
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

				{/* Sort dropdown (shadcn) */}
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.3 }}
					className="text-sm"
				>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="gap-2"
								aria-label="Open sort menu"
							>
								<ListFilter className="h-4 w-4" />
								<span>Sort: {sortLabel(sort)}</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48 border border-white/10">
							<DropdownMenuLabel>Sort by</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuRadioGroup
								value={sort}
								onValueChange={(v) => setSort(v as SortKey)}
							>
								<DropdownMenuRadioItem value="newest">Newest</DropdownMenuRadioItem>
								<DropdownMenuRadioItem value="oldest">Oldest</DropdownMenuRadioItem>
								<DropdownMenuRadioItem value="az">A → Z</DropdownMenuRadioItem>
								<DropdownMenuRadioItem value="za">Z → A</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</motion.div>
			</div>

			{/* Search */}
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
						className="w-full bg-transparent border border-white/20 rounded-xl px-4 py-2 outline-none focus:border-white/40"
					/>
				</motion.div>
			</div>

			{/* Tags */}
			<div className="flex flex-wrap gap-2 mb-8">
				{allTags.map((t, i) => (
					<motion.div
						key={t}
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: chipBase + i * chipStep }}
					>
						<button
							onClick={() => toggleTag(t)}
							className={[
								"px-3 py-1 rounded-full text-sm border transition",
								selected.includes(t)
									? "bg-white text-black border-white"
									: "bg-transparent text-white/80 border-white/20 hover:border-white/40",
							].join(" ")}
						>
							{t}
						</button>
					</motion.div>
				))}

				{selected.length > 0 && (
					<Button onClick={() => setSelected([])} variant="link" className="-mt-1">
						Clear filters
					</Button>
				)}
			</div>

			{/* Grid */}
			{
				filtered.length === 0 ? (
					<div className="text-center text-white/60 py-24">No items match your filters.</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
						{filtered.map((p, i) => (
							<ProjectCard key={p.id} p={p} i={i} k={animStart} />
						))}
					</div>
				)
			}

			<div className="mt-10 text-center text-xs text-white/50">
				Want more details? Ping me and I’ll write deeper docs.
			</div>
		</main >
	);
}

function ProjectCard({ p, i, k }: { p: GalleryItem; i: number; k: number }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.8, delay: k + i * 0.1 }}
			className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 flex flex-col gap-3"
		>
			<div className="flex items-start justify-between gap-3">
				<h3 className="text-lg font-semibold leading-tight">{p.title}</h3>
				<span className="text-xs text-white/60 select-none">{p.year}</span>
			</div>

			<p className="text-sm text-white/80">{p.description}</p>
			{p.notes && <p className="text-xs text-white/60 italic">{p.notes}</p>}

			<div className="flex flex-wrap gap-2 mt-1">
				{p.tech.map((t) => (
					<span
						key={t}
						className="px-2 py-0.5 rounded-full text-xs border border-white/15 text-white/80"
					>
						{t}
					</span>
				))}
			</div>

			<div className="mt-3 flex items-center gap-2">
				{p.repo && (
					<a href={p.repo} target="_blank" rel="noreferrer noopener" className="inline-flex">
						<Button variant="link" className="px-2 py-0 h-auto">View Code</Button>
					</a>
				)}
				{p.live && (
					<a href={p.live} target="_blank" rel="noreferrer noopener" className="inline-flex">
						<Button variant="link" className="px-2 py-0 h-auto">Live</Button>
					</a>
				)}
			</div>
		</motion.div>
	);
}
