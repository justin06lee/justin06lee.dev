import { describe, it, expect } from "vitest";
import { bodyLineOffset, parseArticleDraft } from "@/lib/article-draft";

// Map a 1-based raw line to a 1-based body (preview) line the way the editor does.
function contentLine(raw: string, rawLine: number): number {
  const { content } = parseArticleDraft(raw, "untitled");
  return rawLine - bodyLineOffset(raw, content);
}

describe("bodyLineOffset", () => {
  it("counts title + blank lines before the body", () => {
    const raw = "# Title\n\nFirst paragraph.\n\nSecond.\n";
    const { content } = parseArticleDraft(raw, "x");
    expect(bodyLineOffset(raw, content)).toBe(2);
    // body line 1 ("First paragraph.") is raw line 3
    expect(contentLine(raw, 3)).toBe(1);
    // body line 3 ("Second.") is raw line 5
    expect(contentLine(raw, 5)).toBe(3);
  });

  it("accounts for metadata lines", () => {
    const raw = "# Title\ntags: a, b\nexcerpt: hi\n\nBody starts here.\n";
    const { content } = parseArticleDraft(raw, "x");
    // body line 1 is raw line 5
    expect(contentLine(raw, 5)).toBe(1);
    expect(bodyLineOffset(raw, content)).toBe(4);
  });

  it("ignores a mid-line match inside the title (the wrong-block bug)", () => {
    // body's first line text also appears inside the title; a bare indexOf would
    // anchor on the title occurrence and shift every mapped line.
    const raw = "# Hello world\n\nHello world\n";
    const { content } = parseArticleDraft(raw, "x");
    expect(content).toBe("Hello world");
    // must resolve to the real body line (raw line 3), not the title (line 1)
    expect(bodyLineOffset(raw, content)).toBe(2);
    expect(contentLine(raw, 3)).toBe(1);
  });

  it("returns 0 for empty content", () => {
    expect(bodyLineOffset("# Title\n", "")).toBe(0);
  });

  it("returns 0 when the body cannot be located", () => {
    expect(bodyLineOffset("# Title\n\nbody\n", "not present")).toBe(0);
  });
});
