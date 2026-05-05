import Link from "next/link";
import { getArticleTitle, prerequisiteToRoute } from "@/lib/github";

interface PrerequisitesSidebarProps {
  prerequisites: string[];
  noCache?: boolean;
  basePath?: string;
}

export async function PrerequisitesSidebar({
  prerequisites,
  noCache,
  basePath = "",
}: PrerequisitesSidebarProps) {
  if (prerequisites.length === 0) return null;

  const resolved = await Promise.all(
    prerequisites.map(async (filepath) => {
      let title: string;
      try {
        title = await getArticleTitle(
          filepath,
          noCache ? { noCache: true } : undefined
        );
      } catch {
        title = filepath.split("/").pop() || filepath;
      }
      const route = basePath + prerequisiteToRoute(filepath);
      return { title, route, filepath };
    })
  );

  return (
    <div
      className="sticky overflow-y-auto"
      style={{
        maxHeight: "calc(100vh - var(--sticky-header-offset) - 2rem)",
        top: "var(--sticky-header-offset)",
      }}
    >
      <p className="mb-3 text-xs text-white/40 font-mono uppercase tracking-widest">
        prerequisites
      </p>
      <ul className="space-y-2">
        {resolved.map((prereq) => (
          <li key={prereq.filepath}>
            <Link
              href={prereq.route}
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/[0.04] hover:border-white/20 transition-colors"
            >
              {prereq.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
