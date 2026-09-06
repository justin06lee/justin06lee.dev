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
uniform sampler2D uTex2;
uniform vec2 uRes;
uniform vec2 uSpan;
uniform vec2 uSpan2;
uniform float uKeystone;
uniform float uTime;
uniform float uPower;
uniform float uSnow;
uniform float uGlitch;
uniform float uInvert;
uniform float uHasTex;
uniform float uHasTex2;
uniform float uCross;
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

// One source on the glass: the window of the texture the glass shows, with a
// touch of colour fringing at the edges, like a tube that was never quite
// converged. rgb is the picture, a is whether there is one under this pixel —
// the two mix together, so the mask has to mix with them.
vec4 source(sampler2D tex, vec2 span, float has, vec2 p, float ca) {
  vec2 t = (p - 0.5) * span + 0.5;
  float on = step(0.0, t.x) * step(t.x, 1.0) * step(0.0, t.y) * step(t.y, 1.0) * has;
  return vec4(vec3(
    texture2D(tex, t + vec2(ca, 0.0)).r,
    texture2D(tex, t).g,
    texture2D(tex, t - vec2(ca, 0.0)).b
  ) * on, on);
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

  // The two sources dissolve into each other: uTex is the project's picture,
  // uTex2 the clip, uCross how much of the clip shows. The dissolve happens
  // here, before anything else — the roll, the snow, the bars, the grille and
  // the scanlines are the tube's, and a tube showing a dissolve is still one
  // tube. The branches are on a uniform, so they cost nothing and the two
  // steady states stay at three texture fetches rather than six.
  float ca = 0.0026 * length(uv - 0.5);
  vec4 s;
  if (uCross <= 0.001) {
    s = source(uTex, uSpan, uHasTex, p, ca);
  } else if (uCross >= 0.999) {
    s = source(uTex2, uSpan2, uHasTex2, p, ca);
  } else {
    s = mix(source(uTex, uSpan, uHasTex, p, ca), source(uTex2, uSpan2, uHasTex2, p, ca), uCross);
  }
  vec3 col = s.rgb;
  float onTex = s.a;

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
  /**
   * Show a picture: one frame for a still, or several spread evenly over
   * `period` seconds for an animated one. `null` clears the glass.
   */
  setPicture(picture: { frames: TexImageSource[]; width: number; height: number; period: number } | null): void;
  /** Upload the clip's current frame. It is what the glass shows at mix 1. */
  setVideoFrame(video: HTMLVideoElement): void;
  /**
   * How much of the clip the glass shows, against the picture: 1 the clip
   * alone, 0 the picture alone, and anything between a dissolve of the two.
   * A hover flips it; on a touch screen, where there is no hover, scrolling
   * the set toward the middle of the view drives it.
   */
  setVideoMix(amount: number): void;
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
  if (!program || !vs || !fs) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`crt: could not create the program (context lost: ${gl.isContextLost()})`);
    }
    return null;
  }
  // A shader that won't compile returns null here, and the component quietly
  // falls back to a flat image — which is the right thing to ship and exactly
  // the wrong thing to debug against, because nothing anywhere says why. The
  // driver's log is the only thing that does, so say it in development.
  const compile = (shader: WebGLShader, source: string, what: string) => {
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return true;
    if (process.env.NODE_ENV !== "production") {
      console.warn(`crt: ${what} shader did not compile\n${gl.getShaderInfoLog(shader)}`);
    }
    return false;
  };
  if (!compile(vs, VERT, "vertex") || !compile(fs, FRAG, "fragment")) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`crt: program did not link\n${gl.getProgramInfoLog(program)}`);
    }
    return null;
  }
  gl.useProgram(program);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const makeTexture = () => {
    const t = gl.createTexture();
    if (!t) return null;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  };
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  // A 1x1 black texture stands in while there is no picture, so the sampler
  // is never unbound.
  const blank = makeTexture();
  if (!blank) return null;
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  // One texture per frame of the picture. An animated picture is a handful of
  // frames swapped by time rather than one atlas: an atlas of thirty frames
  // outgrows the guaranteed texture size on phones, and a bind per frame is
  // free.
  let frames: WebGLTexture[] = [];
  let period = 0;
  const dropFrames = () => {
    for (const t of frames) gl.deleteTexture(t);
    frames = [];
    period = 0;
  };

  const u = {
    tex: gl.getUniformLocation(program, "uTex"),
    tex2: gl.getUniformLocation(program, "uTex2"),
    res: gl.getUniformLocation(program, "uRes"),
    span: gl.getUniformLocation(program, "uSpan"),
    span2: gl.getUniformLocation(program, "uSpan2"),
    keystone: gl.getUniformLocation(program, "uKeystone"),
    time: gl.getUniformLocation(program, "uTime"),
    power: gl.getUniformLocation(program, "uPower"),
    snow: gl.getUniformLocation(program, "uSnow"),
    glitch: gl.getUniformLocation(program, "uGlitch"),
    invert: gl.getUniformLocation(program, "uInvert"),
    hasTex: gl.getUniformLocation(program, "uHasTex"),
    hasTex2: gl.getUniformLocation(program, "uHasTex2"),
    cross: gl.getUniformLocation(program, "uCross"),
    motion: gl.getUniformLocation(program, "uMotion"),
  };
  gl.uniform1f(u.keystone, geo.keystone);
  // The picture lives on unit 0 and the clip on unit 1 for the life of the
  // renderer, so a dissolve is two binds a frame rather than a reload.
  gl.uniform1i(u.tex, 0);
  gl.uniform1i(u.tex2, 1);

  let hasTex = 0;
  let texAspect = 1;
  // The clip has its own texture, re-uploaded every frame it changes, so
  // switching between it and the picture is a bind, not a reload.
  let videoTex: WebGLTexture | null = null;
  let videoAspect = 1;
  let videoHas = 0;
  let videoMix = 0;
  let width = canvas.width;
  let height = canvas.height;

  // The clip can only be mixed in once there is a frame of it to mix.
  const cross = () => (videoHas === 1 && videoTex !== null ? videoMix : 0);

  // Both spans, always: the two sources have their own aspects, so each needs
  // its own window on the glass or the dissolve would re-frame one of them
  // as it crossed.
  const updateSpan = () => {
    const glass = width / height;
    const [sx, sy] = pictureSpan(texAspect, glass, geo.stretch, geo.overscan);
    gl.uniform2f(u.span, sx, sy);
    const [vx, vy] = pictureSpan(videoAspect, glass, geo.stretch, geo.overscan);
    gl.uniform2f(u.span2, vx, vy);
  };

  return {
    setPicture(picture) {
      dropFrames();
      hasTex = 0;
      if (picture && picture.width > 0 && picture.height > 0 && picture.frames.length > 0) {
        try {
          for (const source of picture.frames) {
            const t = makeTexture();
            if (!t) throw new Error("no texture");
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
            frames.push(t);
          }
          hasTex = 1;
          texAspect = picture.width / picture.height;
          period = frames.length > 1 ? picture.period : 0;
        } catch {
          dropFrames();
        }
      }
      updateSpan();
    },
    setVideoFrame(video) {
      if (video.videoWidth === 0 || video.videoHeight === 0) return;
      if (!videoTex) videoTex = makeTexture();
      if (!videoTex) return;
      gl.bindTexture(gl.TEXTURE_2D, videoTex);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      } catch {
        // A clip served without CORS taints the upload; the picture stays.
        videoHas = 0;
        updateSpan();
        return;
      }
      const aspect = video.videoWidth / video.videoHeight;
      if (videoHas === 0 || aspect !== videoAspect) {
        videoHas = 1;
        videoAspect = aspect;
        updateSpan();
      }
    },
    setVideoMix(amount) {
      videoMix = Math.min(1, Math.max(0, amount));
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
      // Unit 1 first, then unit 0, so unit 0 is the one left active: every
      // upload outside this function binds on the active unit, and render
      // rebinds both anyway.
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, videoTex ?? blank);
      gl.activeTexture(gl.TEXTURE0);
      const n = frames.length;
      const i = n > 1 && period > 0 ? Math.floor((frame.time / period) * n) % n : 0;
      gl.bindTexture(gl.TEXTURE_2D, frames[i] ?? blank);
      gl.uniform2f(u.res, width, height);
      gl.uniform1f(u.time, frame.time);
      gl.uniform1f(u.power, frame.power);
      gl.uniform1f(u.snow, frame.snow);
      gl.uniform1f(u.glitch, frame.glitch);
      gl.uniform1f(u.invert, frame.invert);
      gl.uniform1f(u.hasTex, hasTex);
      gl.uniform1f(u.hasTex2, videoHas);
      gl.uniform1f(u.cross, cross());
      gl.uniform1f(u.motion, frame.motion);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      dropFrames();
      if (videoTex) gl.deleteTexture(videoTex);
      gl.deleteTexture(blank);
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      // Deliberately *not* `loseContext()`. It looks like the tidy thing —
      // hand the GPU its memory back now rather than at the next collection —
      // but a lost context stays bound to its canvas, and `getContext` on that
      // canvas afterwards returns the same lost one rather than a fresh one.
      // React hands the same canvas node to a new renderer routinely (its
      // double-invoked effects in development, and any remount that reconciles
      // the node rather than replacing it), and every one of those got a
      // context on which `createShader` quietly returns null — the set fell
      // through to its flat fallback for the rest of the session, after a tab
      // switch and back. There is one of these on a page; letting it go with
      // the canvas is the cheaper mistake by far.
    },
  };
}

export type CrtPicture = {
  /** One canvas for a still; several, evenly spaced through `period`, for an animated SVG. */
  frames: HTMLCanvasElement[];
  width: number;
  height: number;
  /** Seconds one loop of the frames takes; 0 for a still. */
  period: number;
  /** The colour the picture throws into the room: its bright pixels' mean, 0–255. */
  tint: [number, number, number];
};

/** Frames per second an animated picture is sampled at, and how many at most: they all sit on the GPU at once. */
const FRAME_RATE = 10;
const MIN_FRAMES = 6;
const MAX_FRAMES = 30;
/** Animated frames are rasterised smaller than a still, since there are up to MAX_FRAMES of them. */
const ANIMATED_EDGE = 640;

/**
 * Loads a picture for the tube.
 *
 * SVGs are fetched as text and rasterised onto a canvas at the size the
 * glass wants, not the size the file claims: an `<img>` of an SVG with no
 * width and height reports the 300x150 default, and uploading that made a
 * 630-unit sprite a blur. An SVG that animates (CSS `animation` or SMIL) is
 * sampled into frames: drawing an `<img>` to a canvas always renders time
 * zero of its animations, so each frame is the same document with every
 * delay shifted back by that frame's time (`shiftAnimations`), which puts
 * the moment we want at time zero. The shader then swaps frames by the
 * clock. Under prefers-reduced-motion one frame is taken, and a fetch that
 * fails for any reason (no CORS, blocked by the CSP) falls back to the
 * plain image path below.
 *
 * Cross-origin images need the CORS header to be readable by WebGL; GitHub
 * raw content sends it.
 */
export async function loadPicture(src: string, maxEdge = 1024): Promise<CrtPicture | null> {
  if (isSvgUrl(src)) {
    const svg = await loadSvgPicture(src, maxEdge);
    if (svg) return svg;
  }
  const img = await loadImage(src);
  if (!img) return null;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  const scale = Math.min(1, maxEdge / Math.max(iw, ih));
  const frame = rasterise(img, Math.max(1, Math.round(iw * scale)), Math.max(1, Math.round(ih * scale)));
  if (!frame) return null;
  return { frames: [frame], width: frame.width, height: frame.height, period: 0, tint: pictureTint(frame) };
}

function isSvgUrl(src: string): boolean {
  try {
    return new URL(src, typeof location === "undefined" ? "http://localhost" : location.href).pathname.toLowerCase().endsWith(".svg");
  } catch {
    return false;
  }
}

async function loadSvgPicture(src: string, maxEdge: number): Promise<CrtPicture | null> {
  let text: string;
  try {
    const res = await fetch(src, { mode: "cors" });
    if (!res.ok) return null;
    text = await res.text();
  } catch {
    return null;
  }
  const size = svgSize(text);
  if (!size) return null;
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const period = reduced ? 0 : animationPeriod(text);
  const n = period > 0 ? frameCount(period) : 1;
  const edge = n > 1 ? Math.min(maxEdge, ANIMATED_EDGE) : maxEdge;
  const scale = edge / Math.max(size.width, size.height);
  const w = Math.max(1, Math.round(size.width * scale));
  const h = Math.max(1, Math.round(size.height * scale));
  const frames = await Promise.all(
    Array.from({ length: n }, (_, i) => rasteriseSvg(n > 1 ? shiftAnimations(text, (i / n) * period) : text, w, h)),
  );
  if (frames.some((f) => f === null)) return null;
  const ready = frames as HTMLCanvasElement[];
  return { frames: ready, width: w, height: h, period, tint: pictureTint(ready[0]) };
}

/** How many frames to sample one loop of an animation into. */
export function frameCount(period: number): number {
  return Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, Math.round(period * FRAME_RATE)));
}

/**
 * The size an SVG draws at: its width/height when it has them in plain
 * units, else its viewBox. Null when neither is usable.
 */
export function svgSize(svg: string): { width: number; height: number } | null {
  const open = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!open) return null;
  const attr = (name: string) => {
    const m = open.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
    return m ? m[2].trim() : null;
  };
  const num = (v: string | null) => {
    const m = v?.match(/^(\d*\.?\d+)(px)?$/);
    return m ? parseFloat(m[1]) : null;
  };
  const w = num(attr("width"));
  const h = num(attr("height"));
  if (w && h) return { width: w, height: h };
  const vb = attr("viewBox")?.split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { width: vb[2], height: vb[3] };
  return null;
}

const TIME = /(-?\d*\.?\d+)(ms|s)\b/g;
const seconds = (value: string, unit: string) => (unit === "ms" ? parseFloat(value) / 1000 : parseFloat(value));
const fmt = (t: number) => `${(Math.round(t * 10000) / 10000).toString()}s`;

/** Split on commas outside parentheses, so `cubic-bezier(a, b, c, d)` stays whole. */
function splitTop(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const ch = list[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(list.slice(start, i));
      start = i + 1;
    }
  }
  out.push(list.slice(start));
  return out;
}

const SHORTHAND = /(^|[\s;{])animation(\s*:\s*)([^;}]*)/g;
const SMIL = /<(animate|animateTransform|animateMotion|set)\b([^>]*)>/g;

/**
 * How long one loop of everything animating in an SVG takes, in seconds, or
 * 0 when nothing does. Reads CSS `animation-duration`, the duration in
 * `animation` shorthands (its first time value), and SMIL `dur`. Several
 * different lengths loop together at their least common multiple, unless
 * that is impractically long, when the longest wins.
 */
export function animationPeriod(svg: string): number {
  const durations: number[] = [];
  const push = (v: string) => {
    const m = v.trim().match(/^(-?\d*\.?\d+)(ms|s)$/);
    if (m) durations.push(seconds(m[1], m[2]));
  };
  for (const m of svg.matchAll(/animation-duration\s*:\s*([^;}]*)/g)) for (const v of splitTop(m[1])) push(v);
  for (const m of svg.matchAll(SHORTHAND)) {
    for (const part of splitTop(m[3])) {
      const t = part.match(TIME);
      if (t) push(t[0]);
    }
  }
  for (const m of svg.matchAll(SMIL)) {
    const dur = m[2].match(/\bdur\s*=\s*(["'])(.*?)\1/);
    if (dur) push(dur[2]);
  }
  const positive = durations.filter((d) => d > 0);
  if (positive.length === 0) return 0;
  // Least common multiple in centiseconds.
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const cs = positive.map((d) => Math.max(1, Math.round(d * 100)));
  const lcm = cs.reduce((a, b) => (a * b) / gcd(a, b));
  const longest = Math.max(...positive);
  return lcm / 100 <= 12 ? lcm / 100 : longest;
}

/**
 * The same SVG with every animation started `by` seconds earlier, so that
 * time zero of the document shows the moment `by` seconds in. Delays in
 * CSS longhands and shorthands (a shorthand with one time value has no delay
 * yet, so one is added after the duration) and SMIL `begin` offsets are all
 * moved; event-based SMIL begins are left alone.
 */
export function shiftAnimations(svg: string, by: number): string {
  if (by === 0) return svg;
  return svg
    .replace(/animation-delay(\s*:\s*)([^;}]*)/g, (_m, sep: string, list: string) => {
      const shifted = splitTop(list).map((v) => {
        const t = v.trim().match(/^(-?\d*\.?\d+)(ms|s)$/);
        return t ? fmt(seconds(t[1], t[2]) - by) : v.trim();
      });
      return `animation-delay${sep}${shifted.join(", ")}`;
    })
    .replace(SHORTHAND, (_m, lead: string, sep: string, decl: string) => {
      const parts = splitTop(decl).map((part) => {
        let seen = 0;
        let out = part.replace(TIME, (whole, v: string, unit: string) => {
          seen++;
          return seen === 2 ? fmt(seconds(v, unit) - by) : whole;
        });
        if (seen === 1) out = out.replace(TIME, (whole) => `${whole} ${fmt(-by)}`);
        return out;
      });
      return `${lead}animation${sep}${parts.join(",")}`;
    })
    .replace(SMIL, (_m, tag: string, attrs: string) => {
      const begin = attrs.match(/\bbegin\s*=\s*(["'])(.*?)\1/);
      if (!begin) {
        // A self-closing tag keeps its slash after the new attribute.
        const body = attrs.replace(/\s*\/\s*$/, "");
        return `<${tag}${body} begin="${fmt(-by)}"${body === attrs ? "" : "/"}>`;
      }
      const t = begin[2].trim().match(/^(-?\d*\.?\d+)(ms|s)?$/);
      if (!t) return _m;
      return `<${tag}${attrs.replace(begin[0], `begin="${fmt(seconds(t[1], t[2] ?? "s") - by)}"`)}>`;
    });
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function rasteriseSvg(svg: string, w: number, h: number): Promise<HTMLCanvasElement | null> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  return loadImage(url).then((img) => {
    URL.revokeObjectURL(url);
    return img ? rasterise(img, w, h) : null;
  });
}

/** Draws an image onto a fresh canvas of the given size; null if the canvas would be tainted. */
function rasterise(img: HTMLImageElement, w: number, h: number): HTMLCanvasElement | null {
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  try {
    ctx.drawImage(img, 0, 0, w, h);
    // Reading a pixel back is the cheapest test that the canvas is not
    // tainted; a tainted upload would throw later, out of our hands.
    ctx.getImageData(0, 0, 1, 1);
  } catch {
    return null;
  }
  return off;
}

const GREY: [number, number, number] = [180, 180, 180];

function pictureTint(source: CanvasImageSource): [number, number, number] {
  return sourceTint(source) ?? GREY;
}

/**
 * What colour a lit screen showing this throws on the wall: the mean of its
 * pixels weighted by their brightness, so a dark screenshot with a teal
 * sprite lights the room teal rather than the grey of its background. Works
 * on a playing video too (its current frame); null when the source can't be
 * read, so a caller keeps whatever colour it had.
 */
export function sourceTint(source: CanvasImageSource): [number, number, number] | null {
  const n = 24;
  const small = document.createElement("canvas");
  small.width = n;
  small.height = n;
  const ctx = small.getContext("2d");
  if (!ctx) return null;
  try {
    ctx.drawImage(source, 0, 0, n, n);
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
    if (weight <= 0) return null;
    return [Math.round(r / weight), Math.round(g / weight), Math.round(b / weight)];
  } catch {
    return null;
  }
}
