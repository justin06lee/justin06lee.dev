import { describe, expect, it } from "vitest";
import { parseArticleDraft, setDraftHidden } from "./article-draft";

describe("parseArticleDraft — hidden front-matter", () => {
  it("defaults hidden to false when absent", () => {
    expect(parseArticleDraft("# Title\n\nbody", "fallback").hidden).toBe(false);
  });

  it("reads hidden: true", () => {
    const raw = "# Title\nhidden: true\ntags: a, b\n\nbody";
    const parsed = parseArticleDraft(raw, "fallback");
    expect(parsed.hidden).toBe(true);
    // the hidden line is consumed, not treated as body or a tag
    expect(parsed.tags).toEqual(["a", "b"]);
    expect(parsed.content).toBe("body");
  });

  it("treats non-truthy values as visible", () => {
    expect(parseArticleDraft("# T\nhidden: false\n\nb", "f").hidden).toBe(false);
  });
});

describe("setDraftHidden", () => {
  const article = "# My Article\ncover: c.png\ntags: x\n\nfirst line\n\nsecond line\n";

  it("adds hidden: true and round-trips through the parser", () => {
    const hidden = setDraftHidden(article, true);
    expect(hidden).toContain("hidden: true");
    const parsed = parseArticleDraft(hidden, "f");
    expect(parsed.hidden).toBe(true);
    // body + other metadata preserved
    expect(parsed.content).toBe("first line\n\nsecond line");
    expect(parsed.cover).toBe("c.png");
    expect(parsed.tags).toEqual(["x"]);
  });

  it("removes hidden when set false", () => {
    const hidden = setDraftHidden(article, true);
    const shown = setDraftHidden(hidden, false);
    expect(shown).not.toContain("hidden:");
    expect(parseArticleDraft(shown, "f").hidden).toBe(false);
  });

  it("is idempotent (no duplicate hidden lines)", () => {
    const once = setDraftHidden(article, true);
    const twice = setDraftHidden(once, true);
    expect(twice.match(/hidden:/gi)?.length).toBe(1);
  });

  it("leaves the body untouched when there is no front-matter", () => {
    const raw = "# Just a title\n\njust body\n";
    const parsed = parseArticleDraft(setDraftHidden(raw, true), "f");
    expect(parsed.hidden).toBe(true);
    expect(parsed.content).toBe("just body");
  });
});
