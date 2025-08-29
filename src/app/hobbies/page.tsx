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
		notes: "not that good at it though.",
		live: "/art"
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
		id: "fnaf-go",
		title: "fnaf go!",
		description:
			"a fnaf fan game written entirely in go, using the pixel 2.0 library.",
		year: 2025,
		tech: ["game dev", "creative", "games"],
		repo: "https://github.com/sehnsucht-nach-einer-ehefrau/FNAF_GO",
		notes: "in development!"
	},
	{
		id: "r6 drone",
		title: "r6 drone",
		description:
			"a fully functional drone from rainbow six siege (video game), with cameras, people detection, jumping and remote control.",
		year: 2025,
		tech: ["hardware", "physics", "embedded software"],
		notes: "in planning phase!"
	},
	{
		id: "drone",
		title: "ai-powered drone",
		description:
			"an open source, drone-flying reinforcement learning model to make a drone follow me around and come back when I wave at it.",
		year: 2025,
		tech: ["hardware", "physics", "embedded software"],
		notes: "i wanna look cyberpunk."
	},
	{
		id: "workout",
		title: "working out",
		description:
			"trying out the good ol' one punch man workout. 100 push ups, sit ups and pull ups, and a 10 km run, every single day!",
		year: 2025,
		tech: ["health", "swole"],
		notes: "healthy body, healthy mind!"
	},
];

export default function HobbiesPage() {
	return (
		<div className="min-h-screen bg-black text-white">
			<Navbar />
			<ItemGallery
				title="Hobbies"
				subtitle="Stuff I tinker with outside of programming (mostly)"
				items={HOBBIES}
				initialSort="newest"
				chipBase={0.4}
				chipStep={0.1}
			/>
		</div>
	);
}
