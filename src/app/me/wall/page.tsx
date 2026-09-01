import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { OperatorLoginForm } from "@/app/desk/OperatorLoginForm";
import { WallEditor, type StoredLayout } from "@/components/gallery/WallEditor";
import { isAdminServer } from "@/lib/auth-server";
import { getItemsByCategory } from "@/lib/items";
import { getProjectWallPieces } from "@/lib/project-images";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "wall",
  robots: { index: false, follow: false },
};

export default async function WallEditorPage() {
  // Gate before fetching, not just before rendering: the resolved piece list
  // would otherwise ride along in the RSC payload of an unauthenticated
  // request. Same reasoning as /desk.
  if (!(await isAdminServer())) return <OperatorLoginForm />;

  const [items, config] = await Promise.all([
    getItemsByCategory("projects"),
    getSiteConfig(),
  ]);
  const pieces = await getProjectWallPieces(items);

  const initialLayouts: Record<string, StoredLayout> = Object.fromEntries(
    items.map((item) => [
      item.id,
      { desktop: item.wallDesktop, mobile: item.wallMobile, image: item.wallImage },
    ]),
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-16 sm:px-6">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">wall</h1>
            <p className="mt-1 text-sm text-white/50">
              arrange the projects gallery by hand. desktop and mobile are two
              separate hangs.
            </p>
          </div>
          <Link
            href="/me"
            className="text-sm text-white/60 underline-offset-4 hover:text-white hover:underline"
          >
            back to content manager
          </Link>
        </div>

        {pieces.length > 0 ? (
          <WallEditor
            pieces={pieces}
            initialLayouts={initialLayouts}
            initialMode={config.wallMode}
          />
        ) : (
          <p className="text-sm text-white/40">
            no projects yet — add some in the content manager first.
          </p>
        )}
      </main>
    </div>
  );
}
