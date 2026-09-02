# putting a project on the crt

the terminal hang of [justin06lee.dev/gallery](https://justin06lee.dev/gallery?tab=projects) is one small monitor. it reads everything it shows off the project's own github repo: the picture on the glass is the readme's first image, and the clip it plays is `assets/crt.mp4`. so getting a project onto it is three files in the repo and one row in the site's admin, and nothing on the site changes.

below is the prompt to hand an assistant working in the project's repo. it does the repo half the same way every time, which is what lets the site pick the project up on its own.

## what the site does with it

- the readme's first non-badge image is the project's picture. its filename routes the project to a hang: `sprite`, `pixel`, `tui` or `terminal` in the name puts it on the crt, `panel` on the manga wall, `icon` or `logo` in the app store. an item's `collection` set in `/me` wins over the filename.
- an svg picture is drawn at the glass's size, and if it animates with css it is sampled into one loop of frames and played.
- `assets/crt.mp4`, if the repo has one, plays on the glass with sound, and when it ends the set tunes to the next project. hovering shows the picture instead, with a glitch each way; the clip plays on underneath. browsers only allow sound after a click, so the clip starts silent and the first click or key on the page turns it up.
- the site checks a repo about once an hour, so a new file shows up on the next check.

## the prompt

copy from the rule below to the end of the file into the assistant's chat, in the project's repo.

---

You are preparing this repository to appear on the CRT monitor in the projects gallery of justin06lee.dev. The site reads everything it shows off this repo through the GitHub API, so all of the work is in this repo and nothing on the site changes. Do every step, commit on `master` (the default branch is always `master`, never `main`), and push.

1. **A pixel sprite for the glass: `assets/<name>-sprite.svg`**, where `<name>` is this repo's name in lowercase. It is pixel art of the project's mascot or mark with the project's name in blocky letters underneath, on a `#0C0C0F` background. Requirements, all of them load-bearing for the site:
   - `viewBox="0 0 630 350"`, and **no `width` or `height` attributes**.
   - Built from `<rect>` blocks on a 5-unit grid inside a `<g shape-rendering="crispEdges">`. No text elements, fonts, images, scripts, or external references of any kind: the site fetches the file and rasterises it itself, so anything it can't draw from the text alone is lost.
   - If anything animates, animate with CSS in a `<style>` inside the SVG, under `@media (prefers-reduced-motion: no-preference)`. Keep it to `transform` (letters bobbing with `translateY`, for instance), give every animation the **same duration** and `infinite`, and stagger with negative `animation-delay` values. The site samples exactly one loop, so a single shared period is what makes the loop seamless.
   - Reference for the look and the structure: https://raw.githubusercontent.com/justin06lee/bmo/master/assets/bmo.svg (three letters, each a `<g class="lt lN">` bobbing on a 2.8s loop).

2. **The README leads with it.** The first image in `README.md` is the sprite, centred, before any badge, screenshot, or other image:
   ```html
   <p align="center">
     <img src="assets/<name>-sprite.svg" alt="<name>" width="630">
   </p>
   ```
   The gallery takes the README's first non-badge image as the project's picture, and the word `sprite` in the filename is what routes the project to the CRT rather than the manga wall or the app store. Do not rename it to something without that word.

3. **A clip with sound: `assets/crt.mp4`.** Start from a screen recording of the project in use, one to four minutes long, with whatever sound belongs to it (the app's own audio, a voice-over, or music you have the right to use). Then run it through the site's retro-TV audio script so it sounds like it is coming out of the set's little speaker, and so the picture is encoded the way the site streams it:
   ```sh
   curl -fsSL https://raw.githubusercontent.com/justin06lee/justin06lee.dev/master/scripts/retro-tv-audio.py -o /tmp/retro-tv-audio.py
   python3 -m venv /tmp/retro && /tmp/retro/bin/pip install pydub scipy numpy audioop-lts
   brew install ffmpeg   # or apt install ffmpeg
   /tmp/retro/bin/python /tmp/retro-tv-audio.py recording.mp4 assets/crt.mp4
   ```
   That writes H.264 (yuv420p, 360p, `+faststart`) with mono AAC at 96k, with the sound high-passed at 250 Hz, low-passed at 6.5 kHz, boosted a little between 1 and 3 kHz, and given a very quiet bed of hiss and crackle. Keep the file under about 15 MB (shorten the recording or pass `--height 240` if it isn't). Commit the file directly, **not through Git LFS**: the site streams it from raw.githubusercontent.com, and an LFS pointer does not stream. If the script can't be fetched, reproduce those parameters with pydub and ffmpeg by hand; the numbers above are the contract.

4. **Commit and push on `master`.** Use conventional commits (`feat(assets): add the crt sprite and clip for justin06lee.dev`). The site re-reads the repo about once an hour; the project appears on the next read.

Afterwards, on the site itself: add the project at justin06lee.dev/me with the GitHub URL in the repo field (and the deployed site in the live field if there is one) under the `projects` category. Nothing else needs setting; if the sprite's filename somehow lacks the routing word, set the item's collection to `terminal`.
