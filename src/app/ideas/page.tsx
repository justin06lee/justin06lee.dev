import Navbar from "@/components/Navbar";
import * as motion from "motion/react-client";

export default function HobbiesPage() {
	return (
		<div className="flex flex-col justify-center w-screen h-screen text-center">
			<Navbar />
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1 }}
            >
                <h1>I can&apos;t risk leaking my ideas. Sorry.</h1>
            </motion.div>
		</div>
	);
}
