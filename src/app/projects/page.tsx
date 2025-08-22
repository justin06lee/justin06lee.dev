import Navbar from "@/components/Navbar";
import { ItemGallery, GalleryItem } from "@/components/ItemGallery";

const PROJECTS: GalleryItem[] = [
	{
		id: "1000000x.dev",
		title: "1,000,000x.dev",
		description:
			"ai knowledge-graph explorer for research. search a topic, expand connections, visualize relationships, and save sessions.",
		year: 2025,
		tech: ["next.js", "full-stack", "agentic ai", "llm"],
		repo: "https://github.com/sehnsucht-nach-einer-ehefrau/1000000x.dev",
		// notes: "work-in-progress core; CLI stable",
	},
	{
		id: "ragpack.top",
		title: "ragpack.top",
		description:
			"document chunker and preprocessor for rag with configurable chunking and retrieval methods.",
		year: 2025,
		tech: ["next.js", "full-stack", "ai", "rag"],
		repo: "https://github.com/sehnsucht-nach-einer-ehefrau/ragpack",
		notes: "runs fully locally + privately!"
	},
	{
		id: "forge",
		title: "forge",
		description:
			"custom makefile-style build orchestration tool for my favorite languages. reads a blacksmith file; fast incremental rebuilds.",
		year: 2025,
		tech: ["C", "Go", "Build"],
		repo: "https://github.com/thaumatech/forge",
		notes: "in progress!"
	},
];

export default function ProjectsPage() {
	return (
		<div className="min-h-screen bg-black text-white">
			<Navbar />
			<ItemGallery
				title="Projects"
				subtitle="A curated list of the things I build for fun and learning."
				items={PROJECTS}
				initialSort="newest"
				chipBase={0.4}
				chipStep={0.1}
			/>
		</div>
	);
}
