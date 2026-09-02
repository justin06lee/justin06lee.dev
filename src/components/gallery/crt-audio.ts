// The set's speaker. Everything the monitor is heard through goes by way of
// this: the level the room hears it at (which falls off as the set scrolls
// away, since the sound comes from the set and not from the page), the hiss
// of an off-station tube, and the crack of the sync letting go when the
// glass is hovered. The clip's own sound stays on its <video> element (its
// volume is set to the same level) so it plays wherever media does; the two
// synthesised sounds need Web Audio. The context is built at once, so that
// on a page the browser already trusts (a return visit, a site interacted
// with before) the set is heard from the first frame; where the browser
// insists on a gesture first the context sits suspended, and `wake()`, called
// from every pointer or key the page sees, resumes it. A glitch fired while
// it is suspended is dropped rather than queued: a burst that arrived with
// the first click, out of nowhere, was worse than none.

export type Speaker = {
  /** Build or resume the audio context. Call from a user gesture. */
  wake(): void;
  /** How loud the room hears the set, 0–1. Applies to every sound here. */
  setLevel(level: number): void;
  /** How much static is on the glass, 0–1; the hiss follows it. */
  setStatic(amount: number): void;
  /** The sync tearing: a short burst of the static yanked down through the speaker's range, with a thump. */
  glitch(): void;
  destroy(): void;
};

/** The hiss at full static, and the burst's peak, as gains on the master. */
const STATIC_GAIN = 0.22;
const GLITCH_GAIN = 0.5;
/** The speaker's band: where a small driver in a plastic case actually speaks. */
const BAND_HZ = 2400;
const BAND_Q = 0.6;

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function createSpeaker(): Speaker {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let hiss: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let level = 1;
  let staticAmount = 0;
  let destroyed = false;

  const build = () => {
    if (ctx || destroyed || typeof AudioContext === "undefined") return;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    master = ctx.createGain();
    master.gain.value = level;
    master.connect(ctx.destination);

    // Two seconds of white noise, looped: the static, and the raw material
    // of the glitch.
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = BAND_HZ;
    band.Q.value = BAND_Q;
    hiss = ctx.createGain();
    hiss.gain.value = staticAmount * STATIC_GAIN;
    source.connect(band).connect(hiss).connect(master);
    source.start();
  };

  return {
    wake() {
      build();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    },
    setLevel(v) {
      level = clamp(v);
      if (ctx && master) master.gain.setTargetAtTime(level, ctx.currentTime, 0.05);
    },
    setStatic(amount) {
      staticAmount = clamp(amount);
      if (ctx && hiss) hiss.gain.setTargetAtTime(staticAmount * STATIC_GAIN, ctx.currentTime, 0.03);
    },
    glitch() {
      if (!ctx || !master || !noise) return;
      if (ctx.state !== "running") {
        // Suspended by policy, or interrupted (iOS does that for a call):
        // ask again, but don't schedule into a stopped clock.
        ctx.resume().catch(() => {});
        return;
      }
      const t = ctx.currentTime;
      // The bars: a burst of the noise with its band dragged from the top of
      // the speaker's range to the bottom over the length of the glitch.
      const burst = ctx.createBufferSource();
      burst.buffer = noise;
      const sweep = ctx.createBiquadFilter();
      sweep.type = "bandpass";
      sweep.Q.value = 1.2;
      sweep.frequency.setValueAtTime(3800, t);
      sweep.frequency.exponentialRampToValueAtTime(600, t + 0.26);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(GLITCH_GAIN, t + 0.012);
      env.gain.setValueAtTime(GLITCH_GAIN, t + 0.16);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      burst.connect(sweep).connect(env).connect(master);
      burst.start(t, Math.random() * 1.5);
      burst.stop(t + 0.32);
      // The thump of the sync letting go.
      const thump = ctx.createOscillator();
      thump.type = "square";
      thump.frequency.setValueAtTime(110, t);
      thump.frequency.exponentialRampToValueAtTime(45, t + 0.14);
      const thumpEnv = ctx.createGain();
      thumpEnv.gain.setValueAtTime(GLITCH_GAIN * 0.45, t);
      thumpEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      thump.connect(thumpEnv).connect(master);
      thump.start(t);
      thump.stop(t + 0.16);
    },
    destroy() {
      destroyed = true;
      if (ctx) ctx.close().catch(() => {});
      ctx = null;
      master = null;
      hiss = null;
      noise = null;
    },
  };
}
