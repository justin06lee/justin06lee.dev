import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ChevronLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Prose } from "@/components/chrome/prose";
import {
  APPSTORE_CSS,
  AppIcon,
  AppStoreList,
  OpenButton,
  StoreHeading,
} from "@/components/gallery/AppStoreList";
import { getItemById, getItemsByCategory } from "@/lib/items";
import { getAppCard, getAppListing, type AppListing, type Release } from "@/lib/app-store";
import { resolveProjectImage } from "@/lib/project-images";
import { classifyTheme } from "@/lib/gallery-themes";
import { formatDate } from "@/lib/app-store-parse";

export const dynamic = "force-dynamic";

const BACK_HREF = "/gallery?tab=projects";
const MORE_LIMIT = 4;
const SCREENSHOT_HEIGHT = 320;

async function load(slug: string): Promise<AppListing | null> {
  const item = await getItemById(decodeURIComponent(slug));
  if (!item || item.category !== "projects") return null;
  return getAppListing(item);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const app = await load(slug);
  if (!app) return {};
  const images = app.icon ? [app.icon.src] : undefined;
  return {
    title: app.title,
    description: app.description,
    alternates: { canonical: app.href },
    openGraph: { type: "website", title: app.title, description: app.description, url: app.href, images },
    twitter: { card: "summary", title: app.title, description: app.description, images },
  };
}

/**
 * One app, laid out as an App Store product page: icon and button, the facts
 * ribbon, the previews, the description, What's New, Information, and more
 * by the developer. Everything past the item row is read from the repo —
 * screenshots from the README, notes from the releases, the information
 * block from the repository record — so the page keeps up with the project
 * without being edited. Styled as the store, not as the site (see
 * `AppStoreList.tsx`).
 */
export default async function AppPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = await load(slug);
  if (!app) notFound();

  const [latest, ...history] = app.releases;
  const more = await moreBy(app.id);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="appstore mx-auto max-w-[980px] px-5 pb-24 pt-24">
        <style precedence="default" href="appstore">{APPSTORE_CSS}</style>

        <Link
          href={BACK_HREF}
          className="inline-flex items-center gap-0.5 text-[17px] text-[#0a84ff] outline-none hover:opacity-80 focus-visible:underline"
        >
          <ChevronLeft size={22} strokeWidth={2.2} aria-hidden className="-ml-1.5" />
          Apps
        </Link>

        <header className="mt-6 flex items-start gap-5 sm:gap-6">
          <AppIcon app={app} size={120} className="sm:!size-[128px]" />
          <div className="flex min-w-0 flex-1 flex-col self-stretch">
            <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.02em] sm:text-[28px]">{app.title}</h1>
            <p className="mt-1 text-[15px] leading-[1.35] text-[#8e8e93] sm:text-[17px]">{app.description}</p>
            {app.open && (
              <div className="mt-auto pt-4">
                <OpenButton href={app.open.href} title={app.title} primary />
              </div>
            )}
          </div>
        </header>

        <Ribbon app={app} latest={latest} />

        {app.screenshots.length > 0 && (
          <section className="mt-8" aria-label="previews">
            <div className="appstore-scroll -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5">
              {app.screenshots.map((shot) => (
                <a
                  key={shot.src}
                  href={shot.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block shrink-0 snap-start overflow-hidden rounded-[18px] bg-[#1c1c1e] ring-1 ring-inset ring-white/10 outline-none focus-visible:ring-[#0a84ff]"
                  style={{ height: SCREENSHOT_HEIGHT, aspectRatio: `${shot.width} / ${shot.height}` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.src}
                    alt={`${app.title} screenshot`}
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                </a>
              ))}
            </div>
          </section>
        )}

        {app.about && (
          <section className="mt-8 border-t border-[#38383a] pt-6">
            <div className="prose-store max-w-[680px] text-[15px] leading-[1.45] text-white/90">
              <Prose
                imageTheme="dark"
                imageBaseUrl={app.about.imageBaseUrl ?? undefined}
                linkComponent={Link}
              >
                {app.about.markdown}
              </Prose>
            </div>
          </section>
        )}

        {latest && (
          <section className="mt-8 border-t border-[#38383a] pt-6">
            <StoreHeading
              action={
                history.length > 0 ? (
                  <a href="#version-history" className="text-[15px] text-[#0a84ff] hover:opacity-80">
                    Version History
                  </a>
                ) : undefined
              }
            >
              What&rsquo;s New
            </StoreHeading>
            <VersionLine release={latest} />
            <div className="mt-2 max-w-[680px] text-[15px] leading-[1.45] text-white/90">
              {latest.notes ? (
                <Prose imageTheme="dark">{latest.notes}</Prose>
              ) : (
                <p className="text-[#8e8e93]">Bug fixes and performance improvements.</p>
              )}
            </div>
            {history.length > 0 && (
              <details id="version-history" className="group mt-5 max-w-[680px]">
                <summary className="cursor-pointer list-none text-[15px] text-[#0a84ff] hover:opacity-80">
                  <span className="group-open:hidden">Show version history</span>
                  <span className="hidden group-open:inline">Hide version history</span>
                </summary>
                <ol className="mt-3">
                  {history.map((release) => (
                    <li key={release.version} className="appstore-hairline py-4 last:shadow-none">
                      <VersionLine release={release} />
                      {release.notes && (
                        <div className="mt-2 text-[15px] leading-[1.45] text-white/80">
                          <Prose imageTheme="dark">{release.notes}</Prose>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </section>
        )}

        <section className="mt-8 border-t border-[#38383a] pt-6">
          <StoreHeading>Information</StoreHeading>
          <dl className="max-w-[680px]">
            {information(app).map((row) => (
              <div key={row.label} className="appstore-hairline flex items-start justify-between gap-6 py-3 last:shadow-none">
                <dt className="shrink-0 text-[15px] text-[#8e8e93]">{row.label}</dt>
                <dd className="min-w-0 text-right text-[15px] leading-[1.35]">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {more.length > 0 && (
          <section className="mt-8 border-t border-[#38383a] pt-6">
            <StoreHeading>More by {app.info.developer}</StoreHeading>
            <AppStoreList apps={more} linkComponent={Link} ariaLabel="more apps" />
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * The row of facts under the header: the store's ratings/age/chart strip,
 * with the facts a repo actually has.
 */
function Ribbon({ app, latest }: { app: AppListing; latest: Release | undefined }) {
  const cells: { label: string; value: string; sub?: string }[] = [];
  if (latest) cells.push({ label: "Version", value: latest.version, sub: formatDate(latest.date) ?? undefined });
  if (app.info.stars !== null) cells.push({ label: "Stars", value: String(app.info.stars), sub: "on GitHub" });
  if (app.tech[0]) cells.push({ label: "Category", value: app.tech[0] });
  cells.push({ label: "Developer", value: app.info.developer });
  if (app.info.language) cells.push({ label: "Language", value: app.info.language });
  if (app.info.license) cells.push({ label: "License", value: app.info.license });
  if (app.info.platforms.length > 0) cells.push({ label: "Runs on", value: app.info.platforms.join(", ") });

  return (
    <div className="appstore-scroll -mx-5 mt-6 overflow-x-auto border-y border-[#38383a] px-5">
      <dl className="flex min-w-max">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className="flex min-w-[112px] flex-col items-center gap-1 border-r border-[#38383a] px-5 py-3 text-center last:border-r-0"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">{cell.label}</dt>
            <dd className="truncate text-[20px] font-semibold leading-tight text-[#8e8e93]">{cell.value}</dd>
            {cell.sub && <dd className="text-[12px] text-[#8e8e93]/80">{cell.sub}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}

function VersionLine({ release }: { release: Release }) {
  const date = formatDate(release.date);
  return (
    <p className="flex items-baseline justify-between gap-4 text-[15px] text-[#8e8e93]">
      <span>
        Version {release.version.replace(/^v/i, "")}
        {release.name && <span className="ml-2 text-white/70">{release.name}</span>}
      </span>
      {date && <span className="shrink-0">{date}</span>}
    </p>
  );
}

function information(app: AppListing): { label: string; value: React.ReactNode }[] {
  const rows: { label: string; value: React.ReactNode }[] = [{ label: "Developer", value: app.info.developer }];
  if (app.tech.length > 0) rows.push({ label: "Category", value: app.tech.join(", ") });
  if (app.info.platforms.length > 0) rows.push({ label: "Compatibility", value: app.info.platforms.join(", ") });
  if (app.info.language) rows.push({ label: "Language", value: app.info.language });
  if (app.info.license) rows.push({ label: "License", value: app.info.license });
  if (app.info.updated) rows.push({ label: "Updated", value: app.info.updated });
  rows.push({ label: "Year", value: String(app.year) });
  if (app.siteUrl) rows.push({ label: "Website", value: <StoreLink href={app.siteUrl} /> });
  if (app.repoUrl) rows.push({ label: "Source Code", value: <StoreLink href={app.repoUrl} /> });
  return rows;
}

function StoreLink({ href }: { href: string }) {
  const label = href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-0.5 break-all text-[#0a84ff] hover:opacity-80"
    >
      {label}
      <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden className="shrink-0" />
    </a>
  );
}

/** The other apps in the store, for the "more by" row. */
async function moreBy(currentId: string) {
  try {
    const items = (await getItemsByCategory("projects")).filter((item) => item.id !== currentId);
    const withIcons = await Promise.all(
      items.map(async (item) => ({ item, icon: await resolveProjectImage(item) })),
    );
    const apps = withIcons.filter(({ item, icon }) =>
      classifyTheme({
        id: item.id,
        collection: item.collection,
        src: icon?.src,
        width: icon?.width,
        height: icon?.height,
      }) === "icons",
    );
    return Promise.all(apps.slice(0, MORE_LIMIT).map(({ item, icon }) => getAppCard(item, icon)));
  } catch {
    return [];
  }
}
