import { listCategories } from "@/lib/calendar-categories";
import { isAdminServer } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import CategoriesManager from "@/components/calendar/CategoriesManager";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const admin = await isAdminServer();
  if (!admin) redirect("/calendar");
  const categories = await listCategories();
  return (
    <main className="max-w-3xl mx-auto px-4 pt-16 pb-24">
      <h1 className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40 mb-6">categories</h1>
      <CategoriesManager initial={categories} />
    </main>
  );
}
