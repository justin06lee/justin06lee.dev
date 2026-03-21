import Navbar from "@/components/Navbar";
import { ItemGallery } from "@/components/ItemGallery";
import { getItemsByCategory } from "@/lib/items";

export const dynamic = "force-dynamic";

export default async function DevPage() {
	const items = await getItemsByCategory("in-development");
	return (
		<div className="min-h-screen bg-black text-white">
			<Navbar />
			<ItemGallery
				title="In Development"
				subtitle="Stuff I'm currently tinkering with."
				items={items}
				initialSort="newest"
				chipBase={0.4}
				chipStep={0.1}
			/>
		</div>
	);
}
