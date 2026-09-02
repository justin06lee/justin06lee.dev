// The tube. A single full-screen quad and one fragment shader that turns a
// flat image into what an old monitor did to it: barrel curvature, a keystone
// because the photographed set is seen a little from above, an aperture-grille
// RGB mask, scanlines, a slow rolling bar, phosphor snow, mains flicker, a
// vignette, a little chromatic fringing, and the two faults every tired set
// had — the vertical hold slipping so the picture rolls, and the horizontal
// sync tearing a band sideways. On top of those, three states the cabinet
// drives: off-station static (the dial between two detents), a burst of
// colour bars torn sideways (the hover glitch), and the picture with its
// colours inverted (hover). Nothing here is faked in CSS because the thing
// being asked for, the image itself bending with the glass, is a per-pixel
// remap, and only a shader does that at any size without measuring.
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
uniform vec2 uSpan;
uniform float uKeystone;
uniform float uTime;
uniform float uPower;
uniform float uSnow;
uniform float uGlitch;
uniform float uInvert;
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

// The seven bars of a test card, left to right.
vec3 bar(float i) {
  if (i < 1.0) return vec3(0.92);
  if (i < 2.0) return vec3(0.92, 0.92, 0.10);
  if (i < 3.0) return vec3(0.10, 0.92, 0.92);
  if (i < 4.0) return vec3(0.10, 0.92, 0.10);
  if (i < 5.0) return vec3(0.92, 0.10, 0.92);
  if (i < 6.0) return vec3(0.92, 0.10, 0.10);
  return vec3(0.10, 0.10, 0.92);
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

  // The glitch shears every band of the picture sideways by its own amount,
  // fresh every frame, and the colour bars below share the same shear so
  // they tear with it.
  float band = floor(uv.y * 28.0);
  float shear = (hash(vec2(band, floor(uTime * 45.0))) - 0.5) * 0.5;
  p.x += uGlitch * shear;

  // Switching off pulls the raster into a bright line, then a dot. Switching
  // on runs it backwards. uPower is 1.0 lit, 0.0 dark.
  float open = smoothstep(0.0, 1.0, uPower);
  float yScale = max(pow(open, 2.2), 0.003);
  float xScale = max(smoothstep(0.0, 0.18, uPower), 0.003);
  p.y = (p.y - 0.5) / yScale + 0.5;
  p.x = (p.x - 0.5) / xScale + 0.5;
  float inside = step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);

  // The picture fills the glass; uSpan is the window of the texture that the
  // glass shows (1 on an axis means all of it).
  vec2 t = (p - 0.5) * uSpan + 0.5;
  float onTex = step(0.0, t.x) * step(t.x, 1.0) * step(0.0, t.y) * step(t.y, 1.0) * uHasTex;

  // A touch of colour fringing at the edges, like a tube that was never
  // quite converged.
  float ca = 0.0026 * length(uv - 0.5);
  vec3 col = vec3(
    texture2D(uTex, t + vec2(ca, 0.0)).r,
    texture2D(uTex, t).g,
    texture2D(uTex, t - vec2(ca, 0.0)).b
  ) * onTex;

  // Inverted colours, only where there is a picture to invert; the dark
  // outside the raster stays dark.
  col = mix(col, (1.0 - col) * onTex, uInvert);

  // The blanking bar that rides with the roll.
  col *= 1.0 - 0.92 * rolling * step(fract(uv.y + roll), 0.05);

  // The phosphor is never fully black while the set is on; that faint glow is
  // what makes the glass read as lit rather than as a hole.
  col += vec3(0.05, 0.055, 0.052);

  // Off-station static: grey snow in cells wider than they are tall, the way
  // it smeared along the scan, with slow darker bands drifting through.
  vec2 cell = floor(vec2(uv.x * uRes.x * 0.22, uv.y * uRes.y * 0.45));
  float snow = hash(cell + fract(uTime * 13.0));
  snow *= 0.75 + 0.25 * sin(uv.y * 40.0 - uTime * 7.0);
  col = mix(col, vec3(snow * 0.95), uSnow);

  // The glitch: colour bars, with the picture's shear, over a grainy floor,
  // and the dark blocks of a test card's bottom strip.
  float bx = fract(uv.x + shear * 0.8);
  vec3 bars = bar(floor(bx * 7.0));
  float blocks = step(0.5, hash(vec2(floor(bx * 9.0), band))) * 0.35;
  bars = mix(bars, vec3(blocks), step(uv.y, 0.24));
  bars *= 0.55 + 0.7 * hash(uv * uRes * 0.4 + fract(uTime * 17.0));
  col = mix(col, bars, uGlitch * 0.94);

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
  col *= pow(clamp(vig, 0.0, 1.0), 0.22);
  col *= inside;

  // The collapse line flares as the raster squeezes into it, then the dot
  // it leaves fades rather than sitting there for as long as the set is off.
  col *= 1.0 + (1.0 - open) * 2.5;
  col *= smoothstep(0.0, 0.06, uPower);

  gl_FragColor = vec4(col, 1.0);
}`;

export type CrtFrame = {
  time: number;
  /** 1 lit, 0 dark; in between is the switch-on / switch-off animation. */
  power: number;
  /** 1 full static, 0 clean picture. */
  snow: number;
  /** 1 colour bars torn sideways, 0 none. */
  glitch: number;
  /** 1 inverted colours, 0 as shot. */
  invert: number;
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
 * How the picture sits in the glass. It fills it: the picture is scaled to
 * cover the canvas, stretched off its own aspect by up to `stretch` on the
 * long axis (an old set never showed a picture at exactly the right aspect
 * either), and whatever still doesn't fit is cropped evenly. `overscan` > 1
 * pushes the raster past the canvas edge the way a tube's did; with the
 * barrel and the keystone, 1.0 already covers every pixel of the hole in
 * the bezel photo. `keystone` is the top-to-bottom width ratio minus one,
 * read off the photo.
 */
export type CrtGeometry = {
  stretch: number;
  overscan: number;
  keystone: number;
};

const DEFAULT_GEOMETRY: CrtGeometry = { stretch: 0.15, overscan: 1.0, keystone: 0.1 };

/**
 * The window of the texture the glass shows, per axis (1 = all of it), for a
 * picture of aspect `texAspect` on a glass of aspect `screenAspect`. Kept
 * pure so the stretch/crop split can be tested.
 */
export function pictureSpan(texAspect: number, screenAspect: number, stretch: number, overscan: number): [number, number] {
  const ratio = texAspect / screenAspect;
  let sx = 1;
  let sy = 1;
  if (ratio > 1) {
    // Wider than the glass: squash it up to the tolerance, crop the rest.
    const squash = Math.min(ratio, 1 + stretch);
    sx = squash / ratio;
  } else if (ratio < 1) {
    const squash = Math.min(1 / ratio, 1 + stretch);
    sy = squash * ratio;
  }
  return [sx / overscan, sy / overscan];
}

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
    span: gl.getUniformLocation(program, "uSpan"),
    keystone: gl.getUniformLocation(program, "uKeystone"),
    time: gl.getUniformLocation(program, "uTime"),
    power: gl.getUniformLocation(program, "uPower"),
    snow: gl.getUniformLocation(program, "uSnow"),
    glitch: gl.getUniformLocation(program, "uGlitch"),
    invert: gl.getUniformLocation(program, "uInvert"),
    hasTex: gl.getUniformLocation(program, "uHasTex"),
    motion: gl.getUniformLocation(program, "uMotion"),
  };
  gl.uniform1f(u.keystone, geo.keystone);

  let hasTex = 0;
  let texAspect = 1;
  let width = canvas.width;
  let height = canvas.height;

  const updateSpan = () => {
    const [sx, sy] = pictureSpan(texAspect, width / height, geo.stretch, geo.overscan);
    gl.uniform2f(u.span, sx, sy);
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
      updateSpan();
    },
    resize(w, h) {
      width = Math.max(1, Math.floor(w));
      height = Math.max(1, Math.floor(h));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      updateSpan();
    },
    render(frame) {
      gl.uniform2f(u.res, width, height);
      gl.uniform1f(u.time, frame.time);
      gl.uniform1f(u.power, frame.power);
      gl.uniform1f(u.snow, frame.snow);
      gl.uniform1f(u.glitch, frame.glitch);
      gl.uniform1f(u.invert, frame.invert);
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

export type CrtPicture = {
  source: HTMLCanvasElement;
  width: number;
  height: number;
  /** The colour the picture throws into the room: its bright pixels' mean, 0–255. */
  tint: [number, number, number];
};

/**
 * Loads a picture for the tube. SVG pixel art is rasterised onto a canvas
 * first — an `<img>` of an SVG with no intrinsic size uploads as nothing, and
 * even one with a size uploads at that size, which for a 64px sprite is far
 * too little to survive the curvature. Cross-origin images need the CORS
 * header to be readable by WebGL; GitHub raw content sends it.
 */
export function loadPicture(src: string, maxEdge = 1024): Promise<CrtPicture | null> {
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
      resolve({ source: off, width: w, height: h, tint: pictureTint(img) });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * What colour a lit screen showing this picture throws on the wall: the mean
 * of its pixels weighted by their brightness, so a dark screenshot with a
 * teal sprite lights the room teal rather than the grey of its background.
 */
function pictureTint(img: HTMLImageElement): [number, number, number] {
  const n = 24;
  const small = document.createElement("canvas");
  small.width = n;
  small.height = n;
  const ctx = small.getContext("2d");
  if (!ctx) return [180, 180, 180];
  try {
    ctx.drawImage(img, 0, 0, n, n);
    const px = ctx.getImageData(0, 0, n, n).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let weight = 0;
    for (let i = 0; i < px.length; i += 4) {
      const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      const w = lum * lum;
      r += px[i] * w;
      g += px[i + 1] * w;
      b += px[i + 2] * w;
      weight += w;
    }
    if (weight <= 0) return [180, 180, 180];
    return [Math.round(r / weight), Math.round(g / weight), Math.round(b / weight)];
  } catch {
    return [180, 180, 180];
  }
}
