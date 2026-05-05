"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export function OperatorLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleLogin = async () => {
    setError("");
    let res: Response;
    try {
      res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
    } catch {
      setError("Network error. Try again.");
      return;
    }
    if (res.status === 429) {
      setError("Too many attempts. Try again later.");
      return;
    }
    if (!res.ok) {
      setError("Wrong password.");
      return;
    }
    startTransition(() => router.refresh());
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-full max-w-sm flex flex-col gap-4 px-4">
          <h1 className="text-xl font-semibold text-center">Admin</h1>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            autoFocus
            autoComplete="current-password"
            className="w-full bg-black border border-white/20 px-4 py-2 outline-none focus:border-white/40 text-white placeholder:text-white/40"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={pending}
            className="w-full bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-60"
          >
            {pending ? "Signing in..." : "Log in"}
          </button>
        </div>
      </div>
    </>
  );
}
