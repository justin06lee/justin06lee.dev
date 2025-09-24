
// app/home-client.tsx
"use client";

import { useEffect, useState } from "react";
import * as motion from "motion/react-client";
import Navbar from "@/components/Navbar";
import HomePage from "@/components/HomePage";
import AsciiSpinningDonut from "@/components/AsciiDonut";
import { Button } from "@/components/ui/button";
import { useSearchParams, useRouter } from "next/navigation";

export default function HomeClient() {
  const [hasPlayed, setHasPlayed] = useState<null | boolean>(null);
  const [introCycle, setIntroCycle] = useState(0);

  const sp = useSearchParams();
  const router = useRouter();
  const shouldReplay = sp.get("intro") === "1";

  useEffect(() => {
    const did =
      typeof window !== "undefined" &&
      localStorage.getItem("did_anim") === "true";
    setHasPlayed(did);
  }, []);

  useEffect(() => {
    if (shouldReplay) {
      setHasPlayed(false);
      setIntroCycle((c) => c + 1);
      window.dispatchEvent(new Event("replay-intro"));
      router.replace("/", { scroll: false });
    }
  }, [shouldReplay, router]);

  useEffect(() => {
    const onReplay = () => {
      setHasPlayed(false);
      setIntroCycle((c) => c + 1);
    };
    window.addEventListener("replay-intro", onReplay);
    return () => window.removeEventListener("replay-intro", onReplay);
  }, []);

  if (hasPlayed === null) return null;

  return (
    <div className="w-screen flex justify-center text-center bg-black text-white">
      <div className="min-h-screen flex flex-col" key={introCycle}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: hasPlayed ? 0 : 16 }}
        >
          <Navbar />
        </motion.div>

        {hasPlayed && <HomePage />}

        {!hasPlayed && (
          <Intro
            onDone={() => {
              localStorage.setItem("did_anim", "true");
              setHasPlayed(true);
              setIntroCycle((c) => c + 1);
            }}
          />
        )}
      </div>
    </div>
  );
}

function Intro({ onDone }: { onDone: () => void }) {
  const steps = [
    { text: "hi.", in: 2, out: 5 },
    { text: "im justin.", in: 6, out: 10 },
    { text: "welcome to my website.", in: 11, out: 15 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center -mt-8">
      <motion.div
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.8, delay: 15 }}
        className="mb-12"
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="text-white"
        >
          <AsciiSpinningDonut />
        </motion.div>
      </motion.div>

      <div
        className="relative text-white text-lg leading-tight"
        style={{ height: "1.75em", width: "250px" }}
      >
        {steps.map((s, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: 10 }}
            transition={{ duration: 1, delay: s.out }}
            onAnimationComplete={i === steps.length - 1 ? onDone : undefined}
          >
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: s.in }}
            >
              <div>{s.text}</div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      <Button
        variant="link"
        onClick={onDone}
        className="fixed bottom-12"
        aria-label="Skip intro"
      >
        Skip
      </Button>
    </div>
  );
}
