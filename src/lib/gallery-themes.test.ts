import { describe, it, expect } from "vitest";
import { classifyTheme, groupByTheme, isGalleryTheme } from "./gallery-themes";

describe("isGalleryTheme", () => {
  it("accepts the three themes and nothing else", () => {
    expect(isGalleryTheme("panels")).toBe(true);
    expect(isGalleryTheme("terminal")).toBe(true);
    expect(isGalleryTheme("icons")).toBe(true);
    expect(isGalleryTheme("apps")).toBe(false);
    expect(isGalleryTheme(null)).toBe(false);
    expect(isGalleryTheme(3)).toBe(false);
  });
});

describe("classifyTheme — precedence", () => {
  it("lets the collection column beat everything", () => {
    expect(
      classifyTheme({
        id: "bmo", // seeded as terminal
        collection: "panels",
        src: "assets/icon.svg", // filename says icons
        width: 100,
        height: 100, // square says icons
      }),
    ).toBe("panels");
  });

  it("is case- and whitespace-insensitive about the collection", () => {
    expect(classifyTheme({ id: "x", collection: "  ICONS " })).toBe("icons");
  });

  it("ignores a collection that isn't a theme and falls through", () => {
    expect(classifyTheme({ id: "bmo", collection: "colorful" })).toBe("terminal");
  });

  it("lets a filename marker beat the slug seed", () => {
    // bmo is seeded terminal; a *-panel asset overrides it.
    expect(classifyTheme({ id: "bmo", src: "assets/bmo-panel.svg" })).toBe("panels");
  });

  it("lets the slug seed beat the shape fallback", () => {
    // Zanka's square-ish manga art would otherwise look like an app icon.
    expect(classifyTheme({ id: "zanka-md", width: 592, height: 592 })).toBe("panels");
  });
});

describe("classifyTheme — filename markers", () => {
  it("reads *-panel.* as a manga panel", () => {
    expect(classifyTheme({ id: "henri", src: "assets/henri-panel.svg" })).toBe("panels");
    expect(classifyTheme({ id: "v", src: "assets/valhalla-panel.svg" })).toBe("panels");
  });

  it("reads icon and logo filenames as icons", () => {
    expect(classifyTheme({ id: "lanyard", src: "assets/icon.svg" })).toBe("icons");
    expect(classifyTheme({ id: "t", src: "docs/logo.svg" })).toBe("icons");
    expect(classifyTheme({ id: "t", src: "assets/app-icon.png" })).toBe("icons");
  });

  it("reads pixel/terminal filenames as terminal", () => {
    expect(classifyTheme({ id: "x", src: "assets/thing-pixel.png" })).toBe("terminal");
    expect(classifyTheme({ id: "x", src: "assets/tui.svg" })).toBe("terminal");
  });

  it("does not match a marker word inside an unrelated path segment", () => {
    // "iconography" should not count as an icon marker.
    expect(classifyTheme({ id: "x", src: "assets/iconography-panel.svg" })).toBe("panels");
  });

  it("ignores query strings when matching", () => {
    expect(classifyTheme({ id: "x", src: "assets/art.svg?v=logo" })).toBe("panels");
  });
});

describe("classifyTheme — fallbacks", () => {
  it("treats square art as an icon", () => {
    expect(classifyTheme({ id: "unknown", width: 512, height: 512 })).toBe("icons");
  });

  it("treats non-square art as a panel", () => {
    expect(classifyTheme({ id: "unknown", width: 1680, height: 768 })).toBe("panels");
    expect(classifyTheme({ id: "unknown", width: 686, height: 948 })).toBe("panels");
  });

  it("defaults to panels with no signal at all", () => {
    expect(classifyTheme({ id: "unknown" })).toBe("panels");
  });

  it("does not divide by zero on a degenerate size", () => {
    expect(classifyTheme({ id: "unknown", width: 100, height: 0 })).toBe("panels");
  });
});

describe("classifyTheme — today's projects land where intended", () => {
  const cases: [string, string | null, string][] = [
    ["bmo", "assets/bmo.svg", "terminal"],
    ["alpaca", "assets/alpaca.svg", "terminal"],
    ["lanyard", "assets/icon.svg", "icons"],
    ["themephile-dev", "docs/logo.svg", "icons"],
    ["betterboard", "assets/betterboard.svg", "icons"],
    ["caveira", "docs/caveira.png", "icons"],
    ["henri", "assets/henri-panel.svg", "panels"],
    ["yagami", "assets/yagami.png", "panels"],
    ["mahito-md", "assets/mahito.svg", "panels"],
    ["valhalla-md", "assets/valhalla-panel.svg", "panels"],
    ["toji", "assets/toji.png", "panels"],
    ["reze", "assets/reze.svg", "panels"],
    ["omniscience-md", "assets/omniscience.svg", "panels"],
    ["zanka-md", "assets/zanka.svg", "panels"],
  ];

  for (const [id, src, expected] of cases) {
    it(`${id} -> ${expected}`, () => {
      expect(classifyTheme({ id, src })).toBe(expected);
    });
  }
});

describe("groupByTheme", () => {
  it("buckets items and preserves input order within a bucket", () => {
    const out = groupByTheme([
      { id: "a", src: "assets/a-panel.svg" },
      { id: "bmo", src: "assets/bmo.svg" },
      { id: "b", src: "assets/b-panel.svg" },
      { id: "lanyard", src: "assets/icon.svg" },
    ]);
    expect(out.panels.map((i) => i.id)).toEqual(["a", "b"]);
    expect(out.terminal.map((i) => i.id)).toEqual(["bmo"]);
    expect(out.icons.map((i) => i.id)).toEqual(["lanyard"]);
  });

  it("returns all three buckets even when empty", () => {
    expect(groupByTheme([])).toEqual({ panels: [], terminal: [], icons: [] });
  });
});
