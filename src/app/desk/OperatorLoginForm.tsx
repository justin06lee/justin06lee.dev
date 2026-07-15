"use client";

import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { LoginForm } from "@/components/chrome/login-form";

export function OperatorLoginForm() {
  const router = useRouter();

  return (
    <>
      <Navbar />
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <LoginForm
          title="admin"
          submitLabel="log in"
          loadingLabel="signing in..."
          onSubmit={async ({ password }) => {
            let res: Response;
            try {
              res = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
              });
            } catch {
              return { error: "network error. try again." };
            }
            if (res.status === 429) return { rateLimited: true };
            if (!res.ok) return { error: "wrong password." };
            // Success — refresh so the server layout re-renders the authed desk.
            router.refresh();
          }}
        />
      </div>
    </>
  );
}
