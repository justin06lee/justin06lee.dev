
import Navbar from "@/components/Navbar";
import { ItemGallery, GalleryItem } from "@/components/ItemGallery";

const DEV: GalleryItem[] = [
	{
		id: "crows",
		title: "crows",
		repo: "https://github.com/The-Root-Spell-Project/Crows",
		description: "a terminal-based chatting platform that has peer-to-peer connections, choosable encryption methods, and war mode (otp with custom usb firmware, cover traffic, etc).",
		year: 2025,
		tech: ["cybersecurity", "networks", "low-level"],
		notes: "nsa and nist will probably find backdoors for this"
	},
	{
		id: "ragpack.top",
		link: "https://www.ragpack.top",
		title: "ragpack.top",
		description:
			"document chunker and preprocessor for rag with configurable chunking and retrieval methods, and a custom complementary library to host your own vector database.",
		year: 2025,
		tech: ["next.js", "full-stack", "ai", "rag"],
		repo: "https://github.com/justin06lee/ragpack",
		notes: "this will be one hell of a difficult project..."
	},
];

export default function DevPage() {
	return (
		<div className="min-h-screen bg-black text-white">
			<Navbar />
			<ItemGallery
				title="In Development"
				subtitle="Stuff I'm currently tinkering with."
				items={DEV}
				initialSort="newest"
				chipBase={0.4}
				chipStep={0.1}
			/>
		</div>
	);
}
