#!/usr/bin/env python3
"""
retro-tv-audio.py — make a clip sound like it is coming out of a small old TV.

The picture on justin06lee.dev's CRT plays a video from each project's repo,
and the audio should sound like it is leaving a plastic speaker the size of
a coaster, not a pair of studio monitors. This does that:

  1. high-pass at 300 Hz: the cabinet had no bass to give
  2. low-pass at 4.8 kHz: nor any air on top; muffled, like it was
  3. a boost between 1.2 and 2.8 kHz: the boxy, tinny resonance of a small
     driver in a plastic case
  4. saturation and an 8-bit crush: the amplifier was a few cents' worth of
     transistors driven too hard, and the grit is most of what "old" means
  5. a quiet bed of hiss, the odd crackle, and a mains hum, so silence is
     never digital silence

Usage

  python retro-tv-audio.py                       # uses INPUT / OUTPUT below
  python retro-tv-audio.py in.mp4 out.mp4        # video in, video out: the
                                                 # picture is re-encoded small,
                                                 # the sound is replaced
  python retro-tv-audio.py in.wav out.mp3        # audio in, audio out
  python retro-tv-audio.py in.mp4 out.m4a --audio-only

Options

  --audio-only     write only the processed sound, even for a video input
  --height N       height of the re-encoded picture for a video output
                   (default 360; the CRT glass is a few hundred pixels wide)
  --keep-video     copy the picture untouched instead of re-encoding it
  --no-texture     leave out the hiss and crackle
  --dry            print what would happen and stop

Install

  brew install ffmpeg                # macOS; apt install ffmpeg on debian/ubuntu
  python3 -m venv .venv && source .venv/bin/activate
  pip install pydub scipy numpy
  pip install audioop-lts            # python 3.13+ only: pydub needs the removed audioop module

pydub shells out to ffmpeg for anything that is not a wav, and this script
shells out to it again to put the processed sound back under the picture.
"""

from __future__ import annotations

import argparse
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from pydub import AudioSegment
from pydub.effects import normalize

# Importing this swaps pydub's first-order (6 dB/octave) filters for scipy's
# butterworth ones, which actually take the bass and the air off rather than
# leaning on them gently. It also runs in C, so a three-minute clip filters
# in a second instead of a minute.
import pydub.scipy_effects  # noqa: F401

# ── change these two to run without arguments ──────────────────────────────
INPUT = "input.mp4"
OUTPUT = "output.mp4"

# ── the sound ───────────────────────────────────────────────────────────────
HIGH_PASS_HZ = 300
LOW_PASS_HZ = 4800
FILTER_ORDER = 4          # butterworth order: 4 is ~24 dB/octave, a real cut, not a tilt
MID_LOW_HZ = 1200
MID_HIGH_HZ = 2800
MID_BOOST_DB = 5.0        # clearly boxy; 3 was polite, 8 is a telephone
DRIVE = 2.6               # tanh saturation: 1 is clean, 4 is a fuzz pedal
BITS = 8                  # word length after the crush; 16 leaves it untouched
DRIVE_HEADROOM_DB = 3.0   # level into the drive, so a quiet clip and a loud one get the same grit
HISS_DBFS = -46           # the bed of static: audible in the quiet, under everything else
CRACKLES_PER_MINUTE = 60  # pops, like a tired speaker cone
CRACKLE_DBFS = -30
HUM_HZ = 120              # mains hum, second harmonic: a small speaker can't voice 60
HUM_DBFS = -44
HEADROOM_DB = 1.0         # normalise to this much below full scale at the end

# ── the picture, for video outputs ─────────────────────────────────────────
VIDEO_HEIGHT = 360
VIDEO_CRF = 26            # x264 quality: 23 is default, 26 is a touch smaller and invisible on a tiny screen
AUDIO_BITRATE = "96k"

VIDEO_EXTS = {".mp4", ".m4v", ".mov", ".mkv", ".webm", ".avi"}
AUDIO_CODEC_FOR_EXT = {".mp3": "mp3", ".m4a": "aac", ".aac": "aac", ".ogg": "libvorbis", ".opus": "libopus", ".flac": "flac", ".wav": "pcm_s16le"}


def retro(seg: AudioSegment, texture: bool = True) -> AudioSegment:
    """The whole treatment, in order. Mono in, mono out: the set had one speaker."""
    seg = seg.set_channels(1).set_sample_width(2)

    seg = seg.high_pass_filter(HIGH_PASS_HZ, order=FILTER_ORDER)
    seg = seg.low_pass_filter(LOW_PASS_HZ, order=FILTER_ORDER)

    # pydub has no parametric EQ, so the boost is done the way an analogue desk
    # did it: band-pass a copy and mix it back in. Mixing a copy at gain g on
    # top of the original raises the band by 20·log10(1 + 10^(g/20)) dB, so
    # for a target boost B the copy goes in at 20·log10(10^(B/20) − 1).
    band = seg.band_pass_filter(MID_LOW_HZ, MID_HIGH_HZ, order=2)
    copy_gain = 20 * math.log10(10 ** (MID_BOOST_DB / 20) - 1)
    seg = seg.overlay(band.apply_gain(copy_gain))

    # The amplifier. Drive is set against a fixed level so every clip gets the
    # same grit; the crush and the drive both put fizz above the band, which
    # the speaker still can't voice, so the low-pass comes round again.
    seg = normalize(seg, headroom=DRIVE_HEADROOM_DB)
    seg = saturate(seg, DRIVE)
    seg = crush(seg, BITS)
    seg = seg.low_pass_filter(LOW_PASS_HZ, order=2)

    if texture:
        seg = seg.overlay(hiss(len(seg), seg.frame_rate))
        seg = seg.overlay(crackle(len(seg), seg.frame_rate))
        seg = seg.overlay(hum(len(seg), seg.frame_rate))

    return normalize(seg, headroom=HEADROOM_DB)


def _samples(seg: AudioSegment) -> np.ndarray:
    """The segment as floats in [-1, 1]."""
    arr = np.array(seg.get_array_of_samples(), dtype=np.float64)
    return arr / float(1 << (8 * seg.sample_width - 1))


def _from_samples(samples: np.ndarray, like: AudioSegment) -> AudioSegment:
    """Floats in [-1, 1] back into a segment shaped like `like`."""
    scale = float((1 << (8 * like.sample_width - 1)) - 1)
    dtype = {1: "<i1", 2: "<i2", 4: "<i4"}[like.sample_width]
    return like._spawn((np.clip(samples, -1.0, 1.0) * scale).astype(dtype).tobytes())


def saturate(seg: AudioSegment, drive: float) -> AudioSegment:
    """Soft clipping: a tanh curve, scaled so full scale still lands on full scale."""
    return _from_samples(np.tanh(drive * _samples(seg)) / math.tanh(drive), seg)


def crush(seg: AudioSegment, bits: int) -> AudioSegment:
    """Requantise to `bits` with triangular dither, the grain of a cheap converter."""
    x = _samples(seg)
    q = float(1 << (bits - 1))
    rng = np.random.default_rng(3)
    dither = (rng.uniform(-0.5, 0.5, x.shape) + rng.uniform(-0.5, 0.5, x.shape)) / q
    return _from_samples(np.round((x + dither) * q) / q, seg)


def hum(duration_ms: int, rate: int) -> AudioSegment:
    """Mains hum with its next two harmonics, breathing slightly, as a supply that isn't quite steady does."""
    n = int(rate * duration_ms / 1000)
    t = np.arange(n) / rate
    wave = np.sin(2 * np.pi * HUM_HZ * t) + 0.4 * np.sin(2 * np.pi * 2 * HUM_HZ * t) + 0.2 * np.sin(2 * np.pi * 3 * HUM_HZ * t)
    wave *= 1 + 0.12 * np.sin(2 * np.pi * 0.7 * t)
    seg = _mono(wave / np.max(np.abs(wave)), rate)
    return seg.apply_gain(HUM_DBFS - seg.dBFS)


def _mono(samples: np.ndarray, rate: int) -> AudioSegment:
    """A float array in [-1, 1] as a 16-bit mono segment."""
    data = np.clip(samples, -1.0, 1.0)
    return AudioSegment((data * 32767).astype("<i2").tobytes(), frame_rate=rate, sample_width=2, channels=1)


def hiss(duration_ms: int, rate: int) -> AudioSegment:
    """White noise, shaped by the same speaker so it sits inside the sound rather than on top of it."""
    n = int(rate * duration_ms / 1000)
    rng = np.random.default_rng(7)
    noise = _mono(rng.uniform(-1.0, 1.0, n), rate)
    noise = noise.high_pass_filter(HIGH_PASS_HZ, order=FILTER_ORDER).low_pass_filter(LOW_PASS_HZ, order=FILTER_ORDER)
    return noise.apply_gain(HISS_DBFS - noise.dBFS)


def crackle(duration_ms: int, rate: int) -> AudioSegment:
    """Sparse pops: a click with a short exponential tail, at random moments."""
    n = int(rate * duration_ms / 1000)
    out = np.zeros(n)
    rng = np.random.default_rng(11)
    count = max(1, int(CRACKLES_PER_MINUTE * duration_ms / 60000))
    tail = np.exp(-np.arange(int(rate * 0.004)) / (rate * 0.0008))  # 4 ms, most of it in the first millisecond
    for at in rng.integers(0, max(1, n - len(tail)), count):
        out[at : at + len(tail)] += tail * rng.uniform(0.5, 1.0) * rng.choice([-1, 1])
    seg = _mono(out, rate).low_pass_filter(LOW_PASS_HZ, order=2)
    peak = seg.max_dBFS
    return seg.apply_gain(CRACKLE_DBFS - peak) if math.isfinite(peak) else seg


def ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        sys.exit("ffmpeg not found on PATH. Install it: brew install ffmpeg (macOS) / apt install ffmpeg (debian).")
    return exe


def write_audio(seg: AudioSegment, out: Path) -> None:
    ext = out.suffix.lower()
    fmt = {".m4a": "ipod", ".aac": "adts", ".opus": "opus"}.get(ext, ext.lstrip("."))
    codec = AUDIO_CODEC_FOR_EXT.get(ext)
    kwargs = {"codec": codec} if codec and ext not in (".wav", ".mp3") else {}
    if ext in (".m4a", ".aac", ".mp3", ".ogg", ".opus"):
        kwargs["bitrate"] = AUDIO_BITRATE
    seg.export(str(out), format=fmt, **kwargs)


def write_video(src: Path, seg: AudioSegment, out: Path, height: int, keep_video: bool) -> None:
    """The original picture (re-encoded small unless asked not to) with the processed sound under it."""
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "sound.wav"
        seg.export(str(wav), format="wav")
        video = ["-c:v", "copy"] if keep_video else [
            "-c:v", "libx264", "-preset", "slow", "-crf", str(VIDEO_CRF), "-pix_fmt", "yuv420p",
            "-vf", f"scale=-2:{height}",
        ]
        cmd = [
            ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(src), "-i", str(wav),
            "-map", "0:v:0", "-map", "1:a:0",
            *video,
            "-c:a", "aac", "-b:a", AUDIO_BITRATE, "-ac", "1",
            # faststart puts the index at the front, so a browser can start
            # playing from a plain file URL before the whole thing is down.
            "-movflags", "+faststart", "-shortest",
            str(out),
        ]
        subprocess.run(cmd, check=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", nargs="?", default=INPUT)
    ap.add_argument("output", nargs="?", default=OUTPUT)
    ap.add_argument("--audio-only", action="store_true")
    ap.add_argument("--height", type=int, default=VIDEO_HEIGHT)
    ap.add_argument("--keep-video", action="store_true")
    ap.add_argument("--no-texture", action="store_true")
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    src, out = Path(args.input), Path(args.output)
    if not src.exists():
        sys.exit(f"no such file: {src}")
    video_out = not args.audio_only and src.suffix.lower() in VIDEO_EXTS and out.suffix.lower() in VIDEO_EXTS
    print(f"{src} -> {out} ({'video, sound replaced' if video_out else 'audio'})")
    if args.dry:
        return

    seg = AudioSegment.from_file(str(src))
    print(f"  {len(seg) / 1000:.1f}s, {seg.frame_rate} Hz, {seg.channels} ch, {seg.dBFS:.1f} dBFS in")
    seg = retro(seg, texture=not args.no_texture)
    print(f"  {seg.dBFS:.1f} dBFS out, peak {seg.max_dBFS:.1f}")

    out.parent.mkdir(parents=True, exist_ok=True)
    if video_out:
        write_video(src, seg, out, args.height, args.keep_video)
    else:
        write_audio(seg, out)
    print(f"  wrote {out} ({out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
