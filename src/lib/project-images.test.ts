import { describe, it, expect, vi, afterEach } from "vitest";
import { heroImageCandidates } from "./project-images-parse";
import { getProjectImage } from "./project-images";

describe("heroImageCandidates", () => {
  it("returns every non-badge reference in document order", () => {
    const md = `
# thing
![cover](assets/cover.svg)
![ci](https://img.shields.io/badge/build-passing-green)
<img src="assets/second.png" alt="">
![third](./assets/third.gif)
`;
    expect(heroImageCandidates(md)).toEqual([
      "assets/cover.svg",
      "assets/second.png",
      "./assets/third.gif",
    ]);
  });

  it("drops badges, including workflow status images", () => {
    const md = `
![ci](https://github.com/o/r/actions/workflows/ci.yml/badge.svg)
![lic](https://img.shields.io/badge/License-MIT-yellow.svg)
![real](assets/real.png)
`;
    expect(heroImageCandidates(md)).toEqual(["assets/real.png"]);
  });

  it("de-duplicates a reference used twice", () => {
    const md = `![a](assets/a.png)\n![a again](assets/a.png)\n![b](assets/b.png)`;
    expect(heroImageCandidates(md)).toEqual(["assets/a.png", "assets/b.png"]);
  });

  it("returns an empty list for a README with only badges", () => {
    expect(
      heroImageCandidates(`![x](https://img.shields.io/badge/a-b-c)`),
    ).toEqual([]);
  });

  it("returns an empty list for a README with no images", () => {
    expect(heroImageCandidates("# just words\n\nsome prose.")).toEqual([]);
  });
});

/* ── the regression that put broken frames on the wall ─────────────────── */

type Handler = (url: string) => { status: number; body?: Uint8Array };

/** A 1x1 PNG — enough for image-size to report real dimensions. */
const PNG_1X1 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89,
]);

function mockFetch(readme: string, handler: Handler) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("api.github.com")) {
      return new Response(
        JSON.stringify({
          content: Buffer.from(readme, "utf-8").toString("base64"),
          encoding: "base64",
          download_url: "https://raw.githubusercontent.com/o/r/master/README.md",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    const res = handler(url);
    return new Response(res.body ? Buffer.from(res.body) : null, { status: res.status });
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("getProjectImage — dead README references", () => {
  it("falls through a 404 to the next candidate instead of hanging a broken image", async () => {
    mockFetch(`![cover](assets/gone.svg)\n![real](assets/real.png)`, (url) =>
      url.endsWith("gone.svg") ? { status: 404 } : { status: 200, body: PNG_1X1 },
    );
    // Unique slug per test: getProjectImage memoizes by repo for the process.
    const image = await getProjectImage("https://github.com/o/fallthrough");
    expect(image?.src).toBe("https://raw.githubusercontent.com/o/r/master/assets/real.png");
  });

  it("returns null when every candidate is dead, so the caller shows a placard", async () => {
    mockFetch(`![a](assets/a.svg)\n![b](assets/b.svg)`, () => ({ status: 404 }));
    expect(await getProjectImage("https://github.com/o/alldead")).toBeNull();
  });

  it("keeps an image that loads but can't be measured, at a default aspect", async () => {
    // An SVG with no intrinsic size still renders fine; it must not be skipped.
    mockFetch(`![svg](assets/vector.svg)`, () => ({
      status: 200,
      body: new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"),
    }));
    const image = await getProjectImage("https://github.com/o/unmeasurable");
    expect(image?.src).toBe("https://raw.githubusercontent.com/o/r/master/assets/vector.svg");
    expect(image?.width).toBeGreaterThan(0);
    expect(image?.height).toBeGreaterThan(0);
  });

  it("treats a network error on a candidate as missing and moves on", async () => {
    let first = true;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.github.com")) {
        return new Response(
          JSON.stringify({
            content: Buffer.from(`![a](assets/a.png)\n![b](assets/b.png)`, "utf-8").toString("base64"),
            encoding: "base64",
            download_url: "https://raw.githubusercontent.com/o/r/master/README.md",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (first) {
        first = false;
        throw new Error("ECONNRESET");
      }
      return new Response(Buffer.from(PNG_1X1), { status: 200 });
    });
    const image = await getProjectImage("https://github.com/o/flaky");
    expect(image?.src).toBe("https://raw.githubusercontent.com/o/r/master/assets/b.png");
  });

  it("returns null when the repo has no README", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 404 }));
    expect(await getProjectImage("https://github.com/o/noreadme")).toBeNull();
  });

  it("returns null for a URL that isn't a GitHub repo", async () => {
    expect(await getProjectImage("https://example.com/not-a-repo")).toBeNull();
    expect(await getProjectImage(undefined)).toBeNull();
  });
});
