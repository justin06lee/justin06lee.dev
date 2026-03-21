import Navbar from "@/components/Navbar";
import { ItemGallery } from "@/components/ItemGallery";
import { getItemsByCategory } from "@/lib/items";

export const dynamic = "force-dynamic";

export default async function HobbiesPage() {
	const items = await getItemsByCategory("hobbies");
	return (
		<div className="min-h-screen bg-black text-white">
			<Navbar />
			<ItemGallery
				title="Hobbies"
				subtitle="Stuff I tinker with outside of programming (mostly)"
				items={items}
				initialSort="newest"
				chipBase={0.4}
				chipStep={0.1}
			/>
		</div>
	);
}
