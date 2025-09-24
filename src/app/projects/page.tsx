import Navbar from "@/components/Navbar";
import { ItemGallery, GalleryItem } from "@/components/ItemGallery";

const PROJECTS: GalleryItem[] = [
	{
		id: "1000000x.dev",
		link: "https://www.1000000x.dev",
		title: "1,000,000x.dev",
		description:
			"ai knowledge-graph explorer for research. search a topic, expand connections, visualize relationships, and save sessions.",
		year: 2025,
		tech: ["next.js", "full-stack", "agentic ai", "llm"],
		repo: "https://github.com/justin06lee/1000000x.dev",
		notes: "vibe-learning is now real",
	},
	{
		id: "ragpack.top",
		link: "https://www.ragpack.top",
		title: "ragpack.top",
		description:
			"document chunker and preprocessor for rag with configurable chunking and retrieval methods.",
		year: 2025,
		tech: ["next.js", "full-stack", "ai", "rag"],
		repo: "https://github.com/justin06lee/ragpack",
		notes: "runs fully locally + privately!"
	},
	{
		id: "takina",
		title: "takina (beta)",
		description:
			"a dynamic llm-powered schedule planner over a time span of your preference.",
		year: 2025,
		tech: ["agentic ai", "llm", "app dev", "tauri", "rust"],
		repo: "https://github.com/justin06lee/takina-beta",
		notes: "coming out as a web project?"
	},
	{
		id: "truman",
		title: "truman (beta)",
		description:
			"block-based time tracker and llm-powered statistics generator.",
		year: 2025,
		tech: ["agentic ai", "llm", "app dev", "tauri", "rust"],
		repo: "https://github.com/justin06lee/truman-beta",
		notes: "coming out as a web project?"
	},
	{
		id: "senku",
		title: "senku",
		description:
			"my own personal library of every book i encounter.",
		year: 2025,
		tech: ["next.js", "google sheets", "full-stack", "llm", "agentic ai"],
		repo: "https://github.com/justin06lee/senku",
		notes: "i should probably add auth to this..."
	},
];

export default function ProjectsPage() {
	return (
		<div className="min-h-screen bg-black text-white">
			<Navbar />
			<ItemGallery
				title="Projects"
				subtitle="A curated list of the things I've built that are usable but still probably need updates."
				items={PROJECTS}
				initialSort="newest"
				chipBase={0.4}
				chipStep={0.1}
			/>
		</div>
	);
}
