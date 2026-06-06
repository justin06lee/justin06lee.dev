// Background donut baker. Receives a DonutConfig, renders every frame of one
// seamless loop into a single Uint8Array of char-ramp indices, and transfers the
// underlying buffer back (zero-copy). The main thread never does this math.
import { makeDonutRenderer, type DonutConfig } from "./donut-frames";

export type BakeResult = {
	buf: Uint8Array; // N * width * height char-ramp indices, frame-major
	N: number;
	width: number;
	height: number;
};

const ctx = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent<DonutConfig>) => {
	const renderer = makeDonutRenderer(e.data);
	const { N, width, height, bufSize } = renderer;
	const buf = new Uint8Array(N * bufSize);
	for (let fi = 0; fi < N; fi++) renderer.renderToIndices(fi, buf, fi * bufSize);
	ctx.postMessage({ buf, N, width, height } satisfies BakeResult, [buf.buffer]);
};
