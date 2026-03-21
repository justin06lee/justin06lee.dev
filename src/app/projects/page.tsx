import Navbar from "@/components/Navbar";
import { ItemGallery } from "@/components/ItemGallery";
import { getItemsByCategory } from "@/lib/items";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
	const items = await getItemsByCategory("projects");
	return (
		<div className="min-h-screen bg-black text-white">
			<Navbar />
			<ItemGallery
				title="Projects"
				subtitle="A curated list of the things I've built that are usable but still probably need updates."
				items={items}
				initialSort="newest"
				chipBase={0.4}
				chipStep={0.1}
			/>
		</div>
	);
}
