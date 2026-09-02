// The tube. A single full-screen quad and one fragment shader that turns a
// flat image into what an old monitor did to it: barrel curvature, a keystone
// because the photographed set is seen a little from above, an aperture-grille
// RGB mask, scanlines, a slow rolling bar, phosphor snow, mains flicker, a
// vignette, a little chromatic fringing, and the two faults every tired set
// had — the vertical hold slipping so the picture rolls, and the horizontal
// sync tearing a band sideways. Nothing here is faked in CSS because the
// thing being asked for, the image itself bending with the glass, is a
// per-pixel remap, and only a shader does that at any size without measuring.
//
// The canvas sits *behind* the cut-out bezel photo, whose transparent hole is
// the glass. So this shader paints the whole canvas as lit tube and lets the
// photo's alpha decide the outline; it never has to know the hole's shape.

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec2 uFit;
uniform vec2 uCenter;
uniform float uKeystone;
uniform float uTime;
uniform float uPower;
uniform float uBurst;
uniform float uHasTex;
uniform float uMotion;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Bulge the glass: the further from centre, the more the picture bends.
vec2 curve(vec2 uv) {
  uv = uv * 2.0 - 1.0;
  vec2 off = abs(uv.yx) / vec2(3.6, 3.0);
  uv = uv + uv * off * off;
  return uv * 0.5 + 0.5;
}

float ease(float t) {
  t = clamp(t, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// A gaussian-ish bump; pow() on a negative base is undefined in GLSL ES.
float bump(float x) {
  return exp(-x * x);
}

void main() {
  vec2 uv = curve(vUv);

  // The set was photographed from slightly above, so the glass is wider at
  // the top than the bottom; the raster follows it.
  vec2 p = uv;
  p.x = (p.x - 0.5) / (1.0 + uKeystone * (p.y - 0.5)) + 0.5;

  // Vertical hold slipping: every so often the whole picture rolls up one
  // frame, with the blanking bar dragged through it.
  float rollCycle = 11.0;
  float rollT = mod(uTime + 3.0, rollCycle);
  float roll = uMotion * (rollT < 1.5 ? ease(rollT / 1.5) : 0.0);
  float rolling = step(0.001, roll) * step(roll, 0.999);
  p.y = fract(p.y + roll);
  // A little bounce as the hold catches again.
  p.y += uMotion * 0.006 * sin(uTime * 9.0) * bump((rollT - 1.7) * 3.0);

  // Horizontal sync: a constant faint wobble, and a band that tears sideways.
  p.x += uMotion * 0.0018 * sin(p.y * 46.0 + uTime * 5.0);
  float tearCycle = 5.3;
  float tearT = mod(uTime, tearCycle);
  float tearOn = uMotion * step(tearT, 0.22);
  float tearY = 0.2 + 0.6 * hash(vec2(floor(uTime / tearCycle), 1.0));
  float tearAmt = (hash(vec2(floor(uTime * 40.0), 2.0)) - 0.5) * 0.06;
  p.x += tearOn * tearAmt * step(tearY, p.y) * step(p.y, tearY + 0.18);

  // Switching off pulls the raster into a bright line, then a dot. Switching
  // on runs it backwards. uPower is 1.0 lit, 0.0 dark.
  float open = smoothstep(0.0, 1.0, uPower);
  float yScale = max(pow(open, 2.2), 0.003);
  float xScale = max(smoothstep(0.0, 0.18, uPower), 0.003);
  p.y = (p.y - 0.5) / yScale + 0.5;
  p.x = (p.x - 0.5) / xScale + 0.5;
  float inside = step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);

  vec2 t = (p - uCenter) * uFit + 0.5;
  float onTex = step(0.0, t.x) * step(t.x, 1.0) * step(0.0, t.y) * step(t.y, 1.0) * uHasTex;

  // A touch of colour fringing at the edges, like a tube that was never
  // quite converged.
  float ca = 0.0026 * length(uv - 0.5);
  vec3 col = vec3(
    texture2D(uTex, t + vec2(ca, 0.0)).r,
    texture2D(uTex, t).g,
    texture2D(uTex, t - vec2(ca, 0.0)).b
  ) * onTex;

  // The blanking bar that rides with the roll.
  col *= 1.0 - 0.92 * rolling * step(fract(uv.y + roll), 0.05);

  // The phosphor is never fully black while the set is on; that faint glow is
  // what makes the glass read as lit rather than as a hole.
  col += vec3(0.05, 0.055, 0.052);

  // Static between channels.
  float snow = hash(floor(uv * uRes * 0.35) + fract(uTime * 13.0));
  col = mix(col, vec3(snow * 0.9), uBurst);

  // Aperture grille: alternating RGB stripes, subtle so the art stays the art.
  float m = mod(gl_FragCoord.x, 3.0);
  vec3 grille = vec3(
    m < 1.0 ? 1.08 : 0.96,
    m >= 1.0 && m < 2.0 ? 1.08 : 0.96,
    m >= 2.0 ? 1.08 : 0.96
  );
  col *= grille;

  // Scanlines follow the tube, not the pixel grid.
  col *= 0.82 + 0.18 * sin(p.y * uRes.y * 1.6);

  // Rolling bar, mains flicker, and grain — coarse snow plus fine noise —
  // only while motion is allowed.
  float bar = fract(uTime * 0.07);
  col *= 1.0 + uMotion * 0.07 * bump((uv.y - bar) * 9.0);
  col *= 1.0 - uMotion * 0.025 * sin(uTime * 63.0);
  float fine = hash(uv * 1.7 + fract(uTime * 7.0)) - 0.5;
  float coarse = hash(floor(uv * uRes * 0.5) / 100.0 + fract(uTime * 11.0)) - 0.5;
  col += uMotion * (fine * 0.07 + coarse * 0.05);
  col += (1.0 - uMotion) * fine * 0.03;

  // Glass sheen, then vignette.
  float sheen = 1.0 - abs(vUv.x * 0.55 + vUv.y * 0.85 - 1.05) * 2.6;
  col += 0.03 * pow(max(sheen, 0.0), 2.0);
  float vig = 16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
  col *= pow(clamp(vig, 0.0, 1.0), 0.28);
  col *= inside;

  // The collapse line flares as the raster squeezes into it.
  col *= 1.0 + (1.0 - open) * 2.5;

  gl_FragColor = vec4(col, 1.0);
}`;

export type CrtFrame = {
  time: number;
  /** 1 lit, 0 dark; in between is the switch-on / switch-off animation. */
  power: number;
  /** 1 full static, 0 clean picture. */
  burst: number;
  /** 0 freezes every animated effect (prefers-reduced-motion). */
  motion: number;
};

export type CrtRenderer = {
  setImage(source: TexImageSource | null, width: number, height: number): void;
  resize(width: number, height: number): void;
  render(frame: CrtFrame): void;
  destroy(): void;
};

/**
 * How the raster sits in the canvas. The canvas is a rectangle drawn behind a
 * hole that is not one — wider at the top, rounded hard at the bottom — so the
 * picture is kept to a share of the canvas and sat a little high, where the
 * hole has the most room. `keystone` is the top-to-bottom width ratio minus
 * one, read off the photo.
 */
export type CrtGeometry = {
  fill: number;
  center: [number, number];
  keystone: number;
};

const DEFAULT_GEOMETRY: CrtGeometry = { fill: 0.82, center: [0.5, 0.515], keystone: 0.1 };

export function createCrtRenderer(
  canvas: HTMLCanvasElement,
  geometry: Partial<CrtGeometry> = {},
): CrtRenderer | null {
  const geo = { ...DEFAULT_GEOMETRY, ...geometry };
  const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
  if (!gl) return null;

  const program = gl.createProgram();
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!program || !vs || !fs) return null;
  gl.shaderSource(vs, VERT);
  gl.compileShader(vs);
  gl.shaderSource(fs, FRAG);
  gl.compileShader(fs);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

  const u = {
    res: gl.getUniformLocation(program, "uRes"),
    fit: gl.getUniformLocation(program, "uFit"),
    center: gl.getUniformLocation(program, "uCenter"),
    keystone: gl.getUniformLocation(program, "uKeystone"),
    time: gl.getUniformLocation(program, "uTime"),
    power: gl.getUniformLocation(program, "uPower"),
    burst: gl.getUniformLocation(program, "uBurst"),
    hasTex: gl.getUniformLocation(program, "uHasTex"),
    motion: gl.getUniformLocation(program, "uMotion"),
  };
  gl.uniform2f(u.center, geo.center[0], geo.center[1]);
  gl.uniform1f(u.keystone, geo.keystone);

  let hasTex = 0;
  let texAspect = 1;
  let width = canvas.width;
  let height = canvas.height;

  const updateFit = () => {
    // Contain the picture inside the glass at its own aspect. uFit > 1 on an
    // axis means the picture is narrower than the screen on that axis.
    const screenAspect = width / height;
    const sx = texAspect >= screenAspect ? 1 : screenAspect / texAspect;
    const sy = texAspect >= screenAspect ? texAspect / screenAspect : 1;
    gl.uniform2f(u.fit, sx / geo.fill, sy / geo.fill);
  };

  return {
    setImage(source, w, h) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (source && w > 0 && h > 0) {
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
          hasTex = 1;
          texAspect = w / h;
        } catch {
          hasTex = 0;
        }
      } else {
        hasTex = 0;
      }
      updateFit();
    },
    resize(w, h) {
      width = Math.max(1, Math.floor(w));
      height = Math.max(1, Math.floor(h));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      updateFit();
    },
    render(frame) {
      gl.uniform2f(u.res, width, height);
      gl.uniform1f(u.time, frame.time);
      gl.uniform1f(u.power, frame.power);
      gl.uniform1f(u.burst, frame.burst);
      gl.uniform1f(u.hasTex, hasTex);
      gl.uniform1f(u.motion, frame.motion);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

/**
 * Loads a picture for the tube. SVG pixel art is rasterised onto a canvas
 * first — an `<img>` of an SVG with no intrinsic size uploads as nothing, and
 * even one with a size uploads at that size, which for a 64px sprite is far
 * too little to survive the curvature. Cross-origin images need the CORS
 * header to be readable by WebGL; GitHub raw content sends it.
 */
export function loadPicture(
  src: string,
  maxEdge = 1024,
): Promise<{ source: HTMLCanvasElement; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (!iw || !ih) return resolve(null);
      const scale = Math.min(1, maxEdge / Math.max(iw, ih));
      const w = Math.max(1, Math.round(iw * scale));
      const h = Math.max(1, Math.round(ih * scale));
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const ctx = off.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.imageSmoothingEnabled = false;
      try {
        ctx.drawImage(img, 0, 0, w, h);
        // Reading a pixel back is the cheapest test that the canvas is not
        // tainted; a tainted upload would throw later, out of our hands.
        ctx.getImageData(0, 0, 1, 1);
      } catch {
        return resolve(null);
      }
      resolve({ source: off, width: w, height: h });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
