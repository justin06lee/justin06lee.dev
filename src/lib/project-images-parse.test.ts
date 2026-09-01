import { describe, it, expect } from "vitest";
import { heroImageCandidates, isBadge, parseRepoSlug, resolveImageUrl } from "./project-images-parse";

describe("parseRepoSlug", () => {
  it("parses a https github url", () => {
    expect(parseRepoSlug("https://github.com/justin06lee/foo")).toEqual({
      owner: "justin06lee",
      repo: "foo",
    });
  });

  it("strips a trailing slash and .git", () => {
    expect(parseRepoSlug("https://github.com/o/r/")).toEqual({ owner: "o", repo: "r" });
    expect(parseRepoSlug("https://github.com/o/r.git")).toEqual({ owner: "o", repo: "r" });
  });

  it("parses an ssh remote and a bare owner/repo", () => {
    expect(parseRepoSlug("git@github.com:o/r.git")).toEqual({ owner: "o", repo: "r" });
    expect(parseRepoSlug("o/r")).toEqual({ owner: "o", repo: "r" });
  });

  it("takes the first two path segments of a deep url", () => {
    expect(parseRepoSlug("https://github.com/o/r/tree/main/docs")).toEqual({ owner: "o", repo: "r" });
  });

  it("rejects non-github and empty input", () => {
    expect(parseRepoSlug("https://gitlab.com/x/y")).toBeNull();
    expect(parseRepoSlug("")).toBeNull();
    expect(parseRepoSlug(undefined)).toBeNull();
  });
});

describe("isBadge", () => {
  it("flags shields/CI badge hosts and paths", () => {
    expect(isBadge("https://img.shields.io/badge/build-passing-green")).toBe(true);
    expect(isBadge("https://github.com/o/r/workflows/ci/badge.svg")).toBe(true);
  });
  it("leaves real assets alone", () => {
    expect(isBadge("https://raw.githubusercontent.com/o/r/HEAD/banner.svg")).toBe(false);
  });
});

/** The hero is simply the first candidate; the rest exist for 404 fall-through. */
const hero = (markdown: string) => heroImageCandidates(markdown)[0] ?? null;

describe("heroImageCandidates — the hero is the first candidate", () => {
  it("reads a leading markdown image", () => {
    expect(hero("![hero](banner.svg)\n\n# Title")).toBe("banner.svg");
  });

  it("reads a centered html img", () => {
    expect(hero('<p align="center"><img src="assets/logo.svg" /></p>')).toBe(
      "assets/logo.svg",
    );
  });

  it("skips a leading badge to find the hero", () => {
    const md = "![build](https://img.shields.io/badge/x) then ![hero](banner.png)";
    expect(hero(md)).toBe("banner.png");
  });

  it("takes the earliest image across html and markdown", () => {
    expect(hero("<img src='a.png'> and ![](b.png)")).toBe("a.png");
  });

  it("extracts the image out of a link-wrapped image", () => {
    expect(hero("[![alt](img.svg)](https://example.com)")).toBe("img.svg");
  });

  it("returns null when there is no image", () => {
    expect(hero("# just a heading\n\nsome prose")).toBeNull();
  });
});

describe("resolveImageUrl", () => {
  const readme = "https://raw.githubusercontent.com/o/r/HEAD/README.md";

  it("passes absolute and protocol-relative urls through", () => {
    expect(resolveImageUrl("https://cdn.example.com/x.png", readme)).toBe(
      "https://cdn.example.com/x.png",
    );
    expect(resolveImageUrl("//cdn.example.com/x.png", readme)).toBe("https://cdn.example.com/x.png");
  });

  it("resolves a relative ref against the README's directory", () => {
    expect(resolveImageUrl("banner.svg", readme)).toBe(
      "https://raw.githubusercontent.com/o/r/HEAD/banner.svg",
    );
    expect(resolveImageUrl("./assets/b.svg", readme)).toBe(
      "https://raw.githubusercontent.com/o/r/HEAD/assets/b.svg",
    );
  });

  it("resolves a root-absolute ref against the repo root", () => {
    expect(resolveImageUrl("/assets/b.svg", readme)).toBe(
      "https://raw.githubusercontent.com/o/r/HEAD/assets/b.svg",
    );
  });

  it("resolves relative to a README that lives in a subdirectory", () => {
    const nested = "https://raw.githubusercontent.com/o/r/HEAD/docs/README.md";
    expect(resolveImageUrl("img.png", nested)).toBe(
      "https://raw.githubusercontent.com/o/r/HEAD/docs/img.png",
    );
  });
});
