// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { createRef, createElement, act } from "react";
import { render, fireEvent } from "@testing-library/react";
import { SyncedPreview, type SyncedPreviewHandle } from "./SyncedPreview";
import { parseArticleDraft } from "@/lib/article-draft";

beforeAll(() => {
  Element.prototype.scrollBy = function () {};
  Element.prototype.scrollTo = function () {};
});

const content = [
  "# Heading one",
  "",
  "Anyhow, let's build a project. This is a regular paragraph.",
  "",
  "A second paragraph with the word array: here.",
  "",
  "```txt",
  "some code",
  "```",
  "",
  "Final paragraph after the fence.",
  "",
].join("\n");

function props(extra: Record<string, unknown> = {}) {
  return {
    ref: createRef<SyncedPreviewHandle>(),
    title: "t",
    prerequisites: [] as string[],
    content,
    imageBaseUrl: "",
    onSelectBlock: () => {},
    ...extra,
  };
}

function highlightedLine(container: HTMLElement): string | null {
  return (
    container
      .querySelector("[data-sync-highlight]")
      ?.getAttribute("data-source-line") ?? null
  );
}

describe("SyncedPreview highlight", () => {
  it("highlights the matched paragraph via alignLineToScreenY", async () => {
    const ref = createRef<SyncedPreviewHandle>();
    const { container } = render(createElement(SyncedPreview, props({ ref })));
    await act(async () => {
      ref.current?.alignLineToScreenY(5, 0);
    });
    expect(highlightedLine(container)).toBe("5");
  });

  it("highlights a paragraph when it is clicked", async () => {
    const { container } = render(createElement(SyncedPreview, props()));
    const para = container.querySelector<HTMLElement>('p[data-source-line="5"]')!;
    await act(async () => {
      fireEvent.click(para);
    });
    expect(highlightedLine(container)).toBe("5");
  });

  // regression: an imperatively-added class was wiped on the next render.
  it("keeps the highlight across a re-render with the same content", async () => {
    const { container, rerender } = render(createElement(SyncedPreview, props()));
    const para = container.querySelector<HTMLElement>('p[data-source-line="5"]')!;
    await act(async () => {
      fireEvent.click(para);
    });
    expect(highlightedLine(container)).toBe("5");
    await act(async () => {
      rerender(createElement(SyncedPreview, props()));
    });
    expect(highlightedLine(container)).toBe("5");
  });

  // the user's repro: click one block, then click another (the code block) -- the
  // highlight must move to the second, only one block highlighted at a time.
  it("moves the highlight to the second block clicked", async () => {
    const { container } = render(createElement(SyncedPreview, props()));
    const para = container.querySelector<HTMLElement>('p[data-source-line="5"]')!;
    const pre = container.querySelector<HTMLElement>('pre[data-source-line="7"]')!;
    await act(async () => {
      fireEvent.click(para);
    });
    expect(highlightedLine(container)).toBe("5");
    await act(async () => {
      fireEvent.click(pre);
    });
    expect(highlightedLine(container)).toBe("7");
    expect(container.querySelectorAll("[data-sync-highlight]").length).toBe(1);
  });

  it("highlights the code block via alignLineToScreenY too", async () => {
    const ref = createRef<SyncedPreviewHandle>();
    const { container } = render(createElement(SyncedPreview, props({ ref })));
    await act(async () => {
      ref.current?.alignLineToScreenY(7, 0);
    });
    expect(highlightedLine(container)).toBe("7");
  });
});

// repro for the "first click after a prior highlight selects the wrong block"
// report: clicking a block must always report ITS own source line, even right
// after a different block was highlighted (which rebuilds the markdown DOM).
describe("SyncedPreview onSelectBlock after a prior highlight", () => {
  const article = [
    "## Introduction", // line 1
    "",
    "Some intro paragraph.", // line 3
    "",
    "this, thinks that there's an 81% chance.", // line 5
    "",
    "Here's the code you can play with:", // line 7  (paragraph above the fence)
    "",
    "```py", // line 9  (fenced code block -- the LAST block)
    "import math",
    "print(sigma)",
    "```",
    "",
  ].join("\n");

  function clickBlock(container: HTMLElement, selector: string) {
    const el = container.querySelector<HTMLElement>(selector)!;
    expect(el).toBeTruthy();
    fireEvent.click(el);
  }

  it("reports the code block's own line on the first click after another block was highlighted", async () => {
    const calls: Array<{ startLine: number; endLine: number | null }> = [];
    const { container } = render(
      createElement(SyncedPreview, props({ content: article, onSelectBlock: (s: { startLine: number; endLine: number | null }) => calls.push(s) }))
    );

    // 1) click the intro heading (mirrors "clicked introduction")
    await act(async () => {
      clickBlock(container, 'h2[data-source-line="1"]');
    });
    expect(calls.at(-1)).toMatchObject({ startLine: 1 });

    // 2) first click on the code block -- must report line 9, not the paragraph
    await act(async () => {
      clickBlock(container, 'pre[data-source-line="9"]');
    });
    expect(calls.at(-1)).toMatchObject({ startLine: 9, endLine: null });

    // 3) click the paragraph above the fence
    await act(async () => {
      clickBlock(container, 'p[data-source-line="7"]');
    });
    expect(calls.at(-1)).toMatchObject({ startLine: 7, endLine: 9 });

    // 4) click the code block again -- still line 9
    await act(async () => {
      clickBlock(container, 'pre[data-source-line="9"]');
    });
    expect(calls.at(-1)).toMatchObject({ startLine: 9, endLine: null });
  });

  // the FULL article body (with the $$ math blocks between), to rule out math
  // blocks distorting the source-line ordering / indexOf used for endLine.
  it("reports the right lines for the real article body, including after a scroll-equivalent re-highlight", async () => {
    const RAW = [
      "# Neural networks demystified",
      "tags: Machine Learning, Beginner",
      "",
      "## Introduction",
      "",
      "I never understood machine learning.",
      "",
      "we get:",
      "",
      "$$",
      "\\sigma(1.45)= \\frac{1}{1.23}",
      "$$",
      "",
      "$$",
      "\\sigma(1.45)= 0.81",
      "$$",
      "",
      "The numbers were rounded but you get the point.",
      "",
      "Here's the code you can play with:",
      "",
      "```py",
      "import math",
      "print(sigma)",
      "```",
      "",
    ].join("\n");
    const { content } = parseArticleDraft(RAW, "x");
    const lines = content.split("\n");
    const fenceLine = lines.findIndex((l) => l.startsWith("```py")) + 1;
    const paraLine = lines.findIndex((l) => l.startsWith("Here's the code")) + 1;

    const calls: Array<{ startLine: number; endLine: number | null }> = [];
    const { container } = render(
      createElement(SyncedPreview, props({ content, onSelectBlock: (s: { startLine: number; endLine: number | null }) => calls.push(s) }))
    );

    const intro = container.querySelector<HTMLElement>("h2")!;
    await act(async () => fireEvent.click(intro));

    const fence = container.querySelector<HTMLElement>(`pre[data-source-line="${fenceLine}"]`)!;
    expect(fence).toBeTruthy();
    await act(async () => fireEvent.click(fence));
    // the code block is last -> endLine null; startLine must be the fence, not the
    // paragraph above it
    expect(calls.at(-1)).toMatchObject({ startLine: fenceLine, endLine: null });

    const para = container.querySelector<HTMLElement>(`p[data-source-line="${paraLine}"]`)!;
    await act(async () => fireEvent.click(para));
    expect(calls.at(-1)).toMatchObject({ startLine: paraLine, endLine: fenceLine });
  });
});
