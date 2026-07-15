// Background donut baker. Receives `{ key, cfg }`, renders every frame of one
// seamless loop straight to its finished `<pre>` string, and posts the `string[]`
// back tagged with `key` so the main thread can route it to the right cache entry.
// Building the finished strings here (not just char-ramp indices) keeps the main
// thread out of the per-frame string concatenation entirely — once a bake lands,
// playback is a pure array swap with no first-loop materialisation jank exactly
// when the page first loads. A single worker bakes every distinct config
// sequentially. The main thread never does this math.
import { makeDonutRenderer, type DonutConfig } from "./donut-frames";

export type BakeRequest = { key: string; cfg: DonutConfig };
export type BakeResult = {
  key: string;
  frames: string[]; // one printable <pre> string per frame, frame-major
};

const ctx = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent<BakeRequest>) => {
  const { key, cfg } = e.data;
  const renderer = makeDonutRenderer(cfg);
  const { N } = renderer;
  const frames: string[] = new Array(N);
  for (let fi = 0; fi < N; fi++) frames[fi] = renderer.renderString(fi);
  ctx.postMessage({ key, frames } satisfies BakeResult);
};
