import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppStoreList } from "./AppStoreList";
import type { AppCard } from "@/lib/app-store";

const shot = (n: number) => ({ src: `https://raw.example/shot-${n}.png`, width: 1600, height: 1000 });

const card = (over: Partial<AppCard> = {}): AppCard => ({
  id: "lanyard",
  title: "lanyard",
  subtitle: "a floating name tag",
  description: "a floating name tag for whichever session you're looking at.",
  icon: { src: "https://raw.example/icon.svg", width: 512, height: 512 },
  screenshots: [],
  open: { href: "https://github.com/justin06lee/lanyard", kind: "source" },
  href: "/apps/lanyard",
  tech: ["rust"],
  ...over,
});

const render = (apps: AppCard[]) => renderToStaticMarkup(createElement(AppStoreList, { apps }));

describe("AppStoreList", () => {
  it("links the row to the app page and the button to the app, without nesting anchors", () => {
    const html = render([card()]);
    // The row link is an empty stretched anchor: nothing (in particular no
    // other anchor) may be a child of it.
    expect(html).toMatch(/<a href="\/apps\/lanyard" aria-label="lanyard, details" class="[^"]*"><\/a>/);
    expect(html).toContain('href="https://github.com/justin06lee/lanyard"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("says open whether that opens a site or the source — one button, one word", () => {
    expect(render([card()])).toMatch(/>open<\/a>/);
    expect(render([card()])).not.toMatch(/>source<\/a>/);
    expect(render([card({ open: { href: "https://themephile.vercel.app", kind: "site" } })])).toMatch(
      /href="https:\/\/themephile\.vercel\.app"[^>]*>open<\/a>/,
    );
    expect(render([card({ open: null })])).not.toMatch(/>open<\/a>/);
  });

  it("shows at most three screenshots in the strip", () => {
    const html = render([card({ screenshots: [shot(1), shot(2), shot(3), shot(4), shot(5)] })]);
    expect(html.match(/shot-\d\.png/g)).toHaveLength(3);
  });

  it("omits the strip entirely when there are no screenshots", () => {
    expect(render([card()])).not.toContain("grid-cols-3");
  });

  it("falls back to an initial when the app has no icon", () => {
    const html = render([card({ icon: null, title: "betterboard" })]);
    expect(html).not.toContain("<img");
    expect(html).toContain(">B</span>");
  });

  it("masks every icon to the continuous-corner squircle", () => {
    const html = render([card()]);
    expect(html).toContain("appstore-icon");
    expect(html).toContain("mask-image");
    expect(html).toContain("data:image/svg+xml");
  });

  it("routes the row through the given link component", () => {
    const Fake = (props: { href: string }) => createElement("span", { "data-fake": props.href });
    const html = renderToStaticMarkup(createElement(AppStoreList, { apps: [card()], linkComponent: Fake }));
    expect(html).toContain('data-fake="/apps/lanyard"');
  });
});
