/**
 * Which visual family a project belongs to, and therefore how it gets hung.
 *
 * Classification is deliberately a pile of cheap heuristics rather than a
 * clean model, because the signal genuinely is messy — shape alone can't tell a
 * pixel-art banner from a manga panel (both are wide). The ladder below runs
 * cheapest-explicit to vaguest, so there is always a way to override:
 *
 *   1. the item's `collection` column   — set it in /me, wins over everything
 *   2. the hero image's filename        — `*-panel.*`, `icon.*`, `logo.*`, `*-pixel.*`
 *   3. a hardcoded slug seed            — today's projects, until 1 or 2 applies
 *   4. aspect ratio                     — square reads as an icon, else a panel
 *
 * Step 2 is the one to lean on going forward: name the asset in the repo and
 * the gallery sorts itself with no change here.
 */

export type GalleryTheme = "panels" | "terminal" | "icons";

export const GALLERY_THEMES: GalleryTheme[] = ["panels", "terminal", "icons"];

export const THEME_META: Record<GalleryTheme, { title: string; subtitle: string }> = {
  panels: {
    title: "panels",
    subtitle: "the ones that look like a page out of something.",
  },
  terminal: {
    title: "terminal",
    subtitle: "pixels and prompts.",
  },
  icons: {
    title: "apps",
    subtitle: "things with an icon and a home screen.",
  },
};

export function isGalleryTheme(value: unknown): value is GalleryTheme {
  return typeof value === "string" && (GALLERY_THEMES as string[]).includes(value);
}

/**
 * Filename markers, checked against the hero image's path. `panel` is listed
 * first so `henri-panel.svg` classifies as a panel even though `henri` would
 * otherwise fall through to the shape test.
 */
const FILENAME_MARKERS: [RegExp, GalleryTheme][] = [
  [/panel/i, "panels"],
  [/(^|[/\-_])(icon|logo|appicon)([.\-_]|$)/i, "icons"],
  [/pixel|sprite|terminal|term\b|tui/i, "terminal"],
];

/**
 * Today's projects, classified by hand. This is the bandage: it exists so the
 * gallery looks right immediately without renaming eighteen repos. An entry
 * here loses to `collection` and to a filename marker, so it quietly stops
 * mattering as those land — deleting a row once its repo is renamed is safe.
 */
const SLUG_SEED: Record<string, GalleryTheme> = {
  bmo: "terminal",
  alpaca: "terminal",
  "omniscience-md": "panels",
  "zanka-md": "panels",
  lanyard: "icons",
  "themephile-dev": "icons",
  betterboard: "icons",
  caveira: "icons",
  "the-hifz-project": "icons",
};

/** Square-ish art reads as an icon; anything else is treated as a panel. */
const SQUARE_LO = 0.92;
const SQUARE_HI = 1.08;

export type ClassifyInput = {
  id: string;
  /** The item's `collection` column, if the operator set one. */
  collection?: string | null;
  /** Resolved hero image URL, used for the filename marker test. */
  src?: string | null;
  width?: number;
  height?: number;
};

export function classifyTheme(item: ClassifyInput): GalleryTheme {
  const collection = item.collection?.trim().toLowerCase();
  if (isGalleryTheme(collection)) return collection;

  if (item.src) {
    // Compare against the path only: a query string or host could contain any
    // of these words without saying anything about the art.
    const path = item.src.split(/[?#]/)[0];
    for (const [pattern, theme] of FILENAME_MARKERS) {
      if (pattern.test(path)) return theme;
    }
  }

  const seeded = SLUG_SEED[item.id];
  if (seeded) return seeded;

  if (item.width && item.height && item.height > 0) {
    const aspect = item.width / item.height;
    if (aspect >= SQUARE_LO && aspect <= SQUARE_HI) return "icons";
  }

  return "panels";
}

/** Groups items by theme, preserving input order within each group. */
export function groupByTheme<T extends ClassifyInput>(items: T[]): Record<GalleryTheme, T[]> {
  const out: Record<GalleryTheme, T[]> = { panels: [], terminal: [], icons: [] };
  for (const item of items) out[classifyTheme(item)].push(item);
  return out;
}
