// Pure ASCII-donut frame math — no DOM access, so it is safe to import in a Web
// Worker as well as on the main thread. The component uses it for the brief live
// fallback; the worker uses it to bake the whole spin in the background.
//
// Geometry/optimisation notes live in AsciiDonut.tsx history: sampling density is
// derived from each ring's projected circumference (fills gaps, no fixed du/dv
// over/under-sampling); the rotation is expanded so each coord is A + B*cv + C*sv
// and luminance collapses to cv*lumC + sv*lumS (no normal vector). The spin loops
// seamlessly after exactly 5 ax-turns / 3 az-turns, so N frames cover one cycle.

export type DonutConfig = {
	width: number;
	height: number;
	R: number;
	r: number;
	K: number;
	D: number;
	du?: number;
	dv?: number;
	Lx: number; // pre-normalised light direction
	Ly: number;
	Lz: number;
	chars: string; // luminance ramp, chars[0] must be the empty/space cell
	speed: number;
	yScale: number; // measured char-cell aspect (charWidth / lineHeight)
	isLowEnd: boolean;
};

export type DonutRenderer = {
	N: number; // frames in one seamless loop
	width: number;
	height: number;
	bufSize: number; // width * height
	chars: string;
	/** Render frame `fi` as char-ramp indices into `out[outOffset .. +bufSize]`. */
	renderToIndices(fi: number, out: Uint8Array, outOffset?: number): void;
	/** Render frame `fi` straight to a printable string. */
	renderString(fi: number): string;
};

/** Convert a frame's index slice into the printable `<pre>` string. */
export function indicesToString(out: Uint8Array, off: number, width: number, height: number, chars: string): string {
	let s = "";
	for (let y = 0; y < height; y++) {
		const start = off + y * width;
		for (let x = 0; x < width; x++) s += chars[out[start + x]];
		if (y < height - 1) s += "\n";
	}
	return s;
}

export function makeDonutRenderer(cfg: DonutConfig): DonutRenderer {
	const { width, height, R, r, K, D, du, dv, Lx, Ly, Lz, chars, speed, yScale, isLowEnd } = cfg;
	const TWO_PI = Math.PI * 2;

	// --- sampling density (projected-circumference driven) ---
	const oozNear = 1 / Math.max(D - r, 0.0001);
	const oversample = 1.5;
	let uSteps = Math.ceil(TWO_PI * (R + r) * K * oozNear * oversample);
	let vSteps = Math.ceil(TWO_PI * r * K * oozNear * oversample);
	if (du && du > 0) uSteps = Math.ceil(TWO_PI / du);
	if (dv && dv > 0) vSteps = Math.ceil(TWO_PI / dv);
	uSteps = Math.min(2048, Math.max(48, uSteps));
	vSteps = Math.min(2048, Math.max(48, vSteps));
	const MAX_SAMPLES = 96000;
	if (uSteps * vSteps > MAX_SAMPLES) {
		const k = Math.sqrt(MAX_SAMPLES / (uSteps * vSteps));
		uSteps = Math.max(48, Math.ceil(uSteps * k));
		vSteps = Math.max(48, Math.ceil(vSteps * k));
	}
	if (isLowEnd) {
		uSteps = Math.max(48, Math.ceil(uSteps * 0.6));
		vSteps = Math.max(48, Math.ceil(vSteps * 0.6));
	}
	const adu = TWO_PI / uSteps;
	const adv = TWO_PI / vSteps;

	// --- seamless loop length: exactly PERIOD_X ax-turns / PERIOD_Z az-turns ---
	const PERIOD_X = 5, PERIOD_Z = 3;
	const baseAxInc = 0.025 * speed;
	let N = Math.round((TWO_PI * PERIOD_X) / baseAxInc);
	if (!isFinite(N) || N < 1) N = 1;
	const axInc = (TWO_PI * PERIOD_X) / N;
	const azInc = (TWO_PI * PERIOD_Z) / N;

	const cx = width >> 1;
	const cy = height >> 1;
	const Ky = K * yScale;
	const cmax = chars.length - 1;
	const bufSize = width * height;

	const zbuf = new Float32Array(bufSize);
	const cosU = new Float32Array(uSteps);
	const sinU = new Float32Array(uSteps);
	const cosV = new Float32Array(vSteps);
	const sinV = new Float32Array(vSteps);
	for (let i = 0; i < uSteps; i++) {
		const u = i * adu;
		cosU[i] = Math.cos(u);
		sinU[i] = Math.sin(u);
	}
	for (let i = 0; i < vSteps; i++) {
		const v = i * adv;
		cosV[i] = Math.cos(v);
		sinV[i] = Math.sin(v);
	}
	const scratch = new Uint8Array(bufSize);

	function renderToIndices(fi: number, out: Uint8Array, outOffset = 0): void {
		const ax = fi * axInc;
		const az = fi * azInc;
		out.fill(0, outOffset, outOffset + bufSize);
		zbuf.fill(-Infinity);

		const cosAx = Math.cos(ax), sinAx = Math.sin(ax);
		const cosAz = Math.cos(az), sinAz = Math.sin(az);
		const cosAxSinAz = cosAx * sinAz;
		const cosAxCosAz = cosAx * cosAz;
		const Cpx = r * sinAx * sinAz;
		const Cpy = -r * sinAx * cosAz;
		const Cz = r * cosAx;
		const lumS = sinAx * sinAz * Lx - sinAx * cosAz * Ly + cosAx * Lz;

		for (let ui = 0; ui < uSteps; ui++) {
			const cu = cosU[ui], su = sinU[ui];
			const k1 = cu * cosAz - su * cosAxSinAz;
			const k2 = cu * sinAz + su * cosAxCosAz;
			const ss = su * sinAx;
			const Apx = R * k1, Bpx = r * k1;
			const Apy = R * k2, Bpy = r * k2;
			const Az = R * ss + D, Bz = r * ss;
			const lumC = k1 * Lx + k2 * Ly + ss * Lz;

			for (let vi = 0; vi < vSteps; vi++) {
				const cv = cosV[vi], sv = sinV[vi];
				const z = Az + Bz * cv + Cz * sv;
				if (z <= 0) continue;
				const ooz = 1 / z;
				const px2 = Apx + Bpx * cv + Cpx * sv;
				const py2 = Apy + Bpy * cv + Cpy * sv;
				const xProj = (cx + K * px2 * ooz) | 0;
				const yProj = (cy - Ky * py2 * ooz) | 0;
				if (xProj >= 0 && xProj < width && yProj >= 0 && yProj < height) {
					const idx = xProj + yProj * width;
					if (ooz > zbuf[idx]) {
						zbuf[idx] = ooz;
						const lum = cv * lumC + sv * lumS;
						if (lum > 0) out[outOffset + idx] = Math.min(cmax, (lum * cmax) | 0);
					}
				}
			}
		}
	}

	function renderString(fi: number): string {
		renderToIndices(fi, scratch, 0);
		return indicesToString(scratch, 0, width, height, chars);
	}

	return { N, width, height, bufSize, chars, renderToIndices, renderString };
}
