import { describe, expect, it } from "vitest";
import {
  formatDate,
  isVersionTag,
  openTarget,
  pickScreenshots,
  platformsFor,
  readmeIntro,
  shortSubtitle,
  siteIconCandidates,
} from "./app-store-parse";

describe("readmeIntro", () => {
  it("takes what sits between the title and the first section", () => {
    const md = `# lanyard\n\nA floating name tag.\n\nIt follows the session.\n\n## Install\n\nbrew install`;
    expect(readmeIntro(md)).toBe("A floating name tag.\n\nIt follows the session.");
  });

  it("drops banners, badges and presentational html", () => {
    const md = [
      "# app",
      '<p align="center"><img src="docs/banner.svg" width="400"></p>',
      "",
      "[![ci](https://img.shields.io/badge/ci-passing-green)](https://ci)",
      "",
      "![logo](assets/logo.png)",
      "",
      "the actual description.",
      "",
      "## usage",
    ].join("\n");
    expect(readmeIntro(md)).toBe("the actual description.");
  });

  it("does not mistake a heading inside a code fence for a section", () => {
    const md = "# app\n\nintro\n\n```sh\n# a comment\n```\n\nmore intro\n\n## next";
    expect(readmeIntro(md)).toBe("intro\n\n```sh\n# a comment\n```\n\nmore intro");
  });

  it("uses the whole document when there is no title", () => {
    expect(readmeIntro("just a line\n\n## Install")).toBe("just a line");
  });

  it("returns an empty string for a README that opens straight into a section", () => {
    expect(readmeIntro("## Install\n\nsteps")).toBe("");
  });
});

describe("isVersionTag", () => {
  it("accepts versions with or without a v", () => {
    for (const tag of ["v0.3.3", "1.0", "2", "v1.2.3-beta.1", "0.4.1+build"]) {
      expect(isVersionTag(tag), tag).toBe(true);
    }
  });

  it("rejects branch-style tags", () => {
    for (const tag of ["feat/theme-import", "fix-desktop-launch", "refactor-terminal-only", "latest"]) {
      expect(isVersionTag(tag), tag).toBe(false);
    }
  });
});

describe("pickScreenshots", () => {
  const raw = "https://raw.githubusercontent.com/o/r/master/docs/";

  it("keeps the pictures and drops the icon, the hero and badges", () => {
    const out = pickScreenshots(
      [`${raw}logo.svg`, `${raw}editor.png`, "https://img.shields.io/badge/x", `${raw}icon.png`, `${raw}terminal.png`],
      `${raw}logo.svg`,
    );
    expect(out).toEqual([`${raw}editor.png`, `${raw}terminal.png`]);
  });

  it("only takes image files", () => {
    expect(pickScreenshots([`${raw}demo.mp4`, `${raw}shot.webp`], null)).toEqual([`${raw}shot.webp`]);
  });

  it("caps the number of screenshots", () => {
    const many = Array.from({ length: 10 }, (_, i) => `${raw}shot-${i}.png`);
    expect(pickScreenshots(many, null, 3)).toHaveLength(3);
  });

  it("keeps an svg banner that is not named like an icon", () => {
    expect(pickScreenshots([`${raw}banner.svg`], null)).toEqual([`${raw}banner.svg`]);
  });
});

describe("siteIconCandidates", () => {
  const page = "https://www.example.com/some/page";

  it("prefers apple-touch-icons, then the largest icon, and resolves relative hrefs", () => {
    const html = `
      <link rel="icon" href="/favicon.ico" sizes="32x32">
      <link rel="icon" href="/logo-480.png" type="image/png" sizes="480x480">
      <link rel="icon" href="/favicon-96.png" sizes="96x96">
      <link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180">
    `;
    expect(siteIconCandidates(html, page)).toEqual([
      "https://www.example.com/apple-icon.png",
      "https://www.example.com/logo-480.png",
      "https://www.example.com/favicon-96.png",
    ]);
  });

  it("skips favicons and anything too small to be an icon", () => {
    const html = `<link rel="icon" href="/favicon.ico"><link rel="icon" href="/tiny.png" sizes="16x16">`;
    expect(siteIconCandidates(html, page)).toEqual([]);
  });

  it("ignores stylesheets and other links", () => {
    const html = `<link rel="stylesheet" href="/app.css"><link rel="preload" href="/font.woff2">`;
    expect(siteIconCandidates(html, page)).toEqual([]);
  });

  it("dedupes and refuses non-http schemes", () => {
    const html = `
      <link rel="apple-touch-icon" href="/a.png">
      <link rel="apple-touch-icon" href="/a.png">
      <link rel="apple-touch-icon" href="javascript:alert(1)">
    `;
    expect(siteIconCandidates(html, page)).toEqual(["https://www.example.com/a.png"]);
  });
});

describe("platformsFor", () => {
  it("reads the platform off the tags and never guesses an os", () => {
    expect(platformsFor(["rust", "tauri", "desktop app"], false)).toEqual(["desktop"]);
    expect(platformsFor(["go", "cli"], false)).toEqual(["terminal"]);
    expect(platformsFor(["agent skill", "claude code"], false)).toEqual(["claude code"]);
    expect(platformsFor(["next.js"], true)).toEqual(["web"]);
    expect(platformsFor(["typescript", "library"], false)).toEqual(["library"]);
  });

  it("counts a live site as the web even without a web tag", () => {
    expect(platformsFor(["go"], true)).toEqual(["web"]);
  });
});

describe("formatDate", () => {
  it("prints a lowercase month in utc", () => {
    expect(formatDate("2026-08-19T23:59:00Z")).toBe("aug 19, 2026");
    expect(formatDate("2026-01-01T00:00:00Z")).toBe("jan 1, 2026");
  });

  it("returns null for nothing or garbage", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate("soon")).toBeNull();
  });
});

describe("openTarget", () => {
  it("opens the site when there is one", () => {
    expect(openTarget({ link: "https://themephile.vercel.app", repo: "https://github.com/o/r" })).toEqual({
      href: "https://themephile.vercel.app",
      kind: "site",
    });
  });

  it("falls back to the source when the only url is github", () => {
    expect(openTarget({ repo: "https://github.com/o/r" })).toEqual({
      href: "https://github.com/o/r",
      kind: "source",
    });
    // A github url in `link` is still the source, not a site.
    expect(openTarget({ link: "https://github.com/o/r" })?.kind).toBe("source");
  });

  it("is null with nowhere to go", () => {
    expect(openTarget({})).toBeNull();
  });
});

describe("shortSubtitle", () => {
  it("leaves short descriptions alone", () => {
    expect(shortSubtitle("a shared clipboard for all your devices")).toBe("a shared clipboard for all your devices");
  });

  it("cuts long ones at a natural break", () => {
    const long = "a one-line installer for claude code skills straight from any github repo — no marketplace, no plugin wrapper";
    const out = shortSubtitle(long);
    expect(out.length).toBeLessThanOrEqual(73);
    expect(out.endsWith("…")).toBe(true);
    expect(out).toBe("a one-line installer for claude code skills straight from any github…");
  });
});
