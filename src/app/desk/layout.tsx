import type { Metadata } from "next";
import { isAdminServer } from "@/lib/auth-server";
import Navbar from "@/components/Navbar";
import { OperatorHeader } from "./OperatorHeader";
import { OperatorLoginForm } from "./OperatorLoginForm";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "desk | justin06lee.dev",
};

export default async function DeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAdminServer();

  if (!authenticated) {
    return <OperatorLoginForm />;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <OperatorHeader />
      {children}
    </div>
  );
}
