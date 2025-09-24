import Navbar from "@/components/Navbar";
import { ItemGallery, GalleryItem } from "@/components/ItemGallery";

const HOBBIES: GalleryItem[] = [
	{
		id: "art",
		title: "art",
		description: "traditional, digital. pencil, pen, pixel, paint, you name it. i just love creativity.",
		year: 2025,
		tech: ["art", "creative"],
		notes: "not that good at it though.",
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
		id: "workout",
		title: "working out",
		description:
			"trying out the good ol' one punch man workout. 100 push ups, sit ups and pull ups, and a 10 km run, every single day!",
		year: 2025,
		tech: ["health", "swole"],
		notes: "healthy body, healthy mind!"
	},
	{
		id: "electrical",
		title: "electrical engineering(?)",
		description: "I play around with breadboards every once in a while. still a beginner though.",
		year: 2025,
		tech: ["problem-solving", "ee"],
		notes: "ill build a computer from scratch one day."
	},
	{
		id: "reading",
		title: "reading",
		description: "a smart man learns from his mistakes. a wise man learns from the mistakes of others.",
		year: 2025,
		tech: ["philosophy"],
		notes: 'currently reading "the myth of sisyphus" and "this is how they tell me the world ends".',
	},
	{
		id: "abacus",
		title: "mental arithmetic (abacus)",
		description: "it always feels inconvenient and amateurish to pull out the calculator app for basic arithmetic.",
		year: 2025,
		tech: ["philosophy"],
		notes: "i should've done this when i was younger...",
	},
	{
		id: "taekwondo",
		title: "tae-kwondo",
		description: "i did taekwondo when i as like eight years old... trying to join the ucsc taekwondo club to relearn",
		year: 2025,
		tech: ["martial arts", "health"],
		notes: "im a complete noob though.",
	},
	{
		id: "muaythai",
		title: "muay-thai",
		description: "i have never done this in my life... trying to join the ucsc muay thai club to learn",
		year: 2025,
		tech: ["martial arts", "health"],
		notes: "i just hope i dont get whooped",
	},
	{
		id: "judo",
		title: "judo",
		description: "i have never done this in my life... trying to join the ucsc judo club to learn",
		year: 2025,
		tech: ["martial arts", "health"],
		notes: "i just hope i dont get whooped",
	},
	{
		id: "fencing",
		title: "fencing",
		description: "ive done this for a maximum of like 3 days before... trying to join the ucsc fencing club to relearn",
		year: 2025,
		tech: ["martial arts", "health"],
		notes: "im a complete noob though.",
	},
	{
		id: "wrestling",
		title: "wrestling",
		description: "i have never done this in my life... trying to join the ucsc grappling club to learn",
		year: 2025,
		tech: ["martial arts", "health"],
		notes: "i just hope i dont get whooped",
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
