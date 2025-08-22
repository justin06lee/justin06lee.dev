import Navbar from "@/components/Navbar";
import { ItemGallery, GalleryItem } from "@/components/ItemGallery";

// Sample hobbies — replace with yours
const HOBBIES: GalleryItem[] = [
	{
		id: "art",
		title: "art",
		description: "traditional, digital. pencil, pen, pixel, paint, you name it. i just love creativity.",
		year: 2025,
		tech: ["art", "creative"],
		notes: "not that good at it though."
	},
	{
		id: "chess",
		title: "chess",
		description: "strategies, problem-solving, puzzles, and devious planning is always good fun.",
		year: 2025,
		tech: ["games", "problem-solving"],
		notes: "i love it when a plan comes together!",
	},
	{
		id: "gamedev",
		title: "game dev",
		description: "a well told story is one of my favorite things in life. i love being able to turn that into a playable experience.",
		year: 2025,
		tech: ["creative", "games", "development"],
		notes: "started projects: like 10. completed projects: 0"
	},
];

export default function HobbiesPage() {
	return (
		<div className="min-h-screen bg-black text-white">
			<Navbar />
			<ItemGallery
				title="Hobbies"
				subtitle="Stuff I tinker with outside of work/school."
				items={HOBBIES}
				initialSort="newest"
				chipBase={0.4}
				chipStep={0.1}
			/>
		</div>
	);
}
