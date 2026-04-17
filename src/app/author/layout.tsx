import type { Metadata } from "next";
import { isAdminServer } from "@/lib/auth-server";
import { OperatorHeader } from "./OperatorHeader";
import { OperatorLoginForm } from "./OperatorLoginForm";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Author | justin06lee.dev",
};

export default async function AuthorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAdminServer();

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background">
        <OperatorLoginForm />
      </div>
    );
  }

  return (
    <div className="operator-shell min-h-screen bg-background">
      <OperatorHeader />
      {children}
    </div>
  );
}
