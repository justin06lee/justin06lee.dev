import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TerminalStrip } from "./TerminalStrip";

const pieces = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `piece-${index}`,
    title: `piece ${index}`,
    src: null,
    width: 630,
    height: 350,
  }));

const cellClasses = (count: number) => {
  const html = renderToStaticMarkup(createElement(TerminalStrip, { items: pieces(count) }));
  return Array.from(html.matchAll(/<li(?: class="([^"]*)")?>/g), (match) => match[1] ?? "");
};

describe("TerminalStrip dense rows", () => {
  it("lets two projects share the whole desktop row", () => {
    expect(cellClasses(2)).toEqual([
      expect.stringContaining("lg:col-span-3"),
      expect.stringContaining("lg:col-span-3"),
    ]);
  });

  it("uses three equal cells when the row is full", () => {
    for (const className of cellClasses(3)) {
      expect(className).toContain("lg:col-span-2");
    }
  });

  it("reflows a four-project tail as two complete rows", () => {
    for (const className of cellClasses(4)) {
      expect(className).toContain("lg:col-span-3");
    }
  });

  it("gives an odd mobile tail the full row", () => {
    expect(cellClasses(3).at(-1)).toContain("sm:col-span-6");
  });
});
