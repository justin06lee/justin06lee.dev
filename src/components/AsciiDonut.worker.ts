// Background donut baker. Receives a DonutConfig and renders every frame of one
// seamless loop straight to its finished `<pre>` string. Building the strings here
// (not just the char-ramp indices) keeps the main thread out of the per-frame
// string concatenation entirely — playback becomes a pure array swap, with no
// first-loop materialisation jank exactly when the page first loads.
import { makeDonutRenderer, type DonutConfig } from "./donut-frames";

export type BakeResult = {
	frames: string[]; // one printable <pre> string per frame, frame-major
	N: number;
};

const ctx = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent<DonutConfig>) => {
	const renderer = makeDonutRenderer(e.data);
	const { N } = renderer;
	const frames: string[] = new Array(N);
	for (let fi = 0; fi < N; fi++) frames[fi] = renderer.renderString(fi);
	ctx.postMessage({ frames, N } satisfies BakeResult);
};
