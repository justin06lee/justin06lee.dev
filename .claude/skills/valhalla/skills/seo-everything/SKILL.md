---
name: seo-everything
description: >
  Autonomous end-to-end SEO for a codebase. One command perceives the project,
  decides which SEO disciplines apply, fans out specialists in parallel, and
  applies every relevant fix directly to the source on a branch, then shows one
  diff. Use when the user says "do all the SEO", "full SEO pass", "seo everything",
  "apply all SEO", "make this project SEO-complete", "SEO autopilot", or wants a
  hands-off SEO edit of a project rather than a per-skill audit.
user-invocable: true
argument-hint: "[path] (defaults to current project)"
license: MIT
metadata:
  author: AgriciDaniel
  version: "3.1.0"
  category: seo
---

# SEO Everything: Autonomous Full-Project SEO Pass

**Invocation:** `/seo everything $1` where `$1` is a project path (default: `.`).

One command takes a codebase from wherever it is to as SEO-complete as the
project allows, without the user choosing skills or reviewing partial results.
It decides relevance, fans out the specialists, applies every fix that fits, and
leaves a single reviewable diff on a branch.

The contract with the user is: **they point, it does everything applicable, they
review one diff.** Never ask them which discipline to run. Never stop halfway to
ask what to do next unless a fix is genuinely unsafe to make autonomously (see
Apply Safety). Relevance is your job, not theirs.

## When NOT to run apply autonomously

Only run the apply phase against a codebase the user controls and that is under
version control (so the branch + diff review is real and reversible). If the
target is a live URL with no local source, or not a git repo, do the analysis
and produce the plan, then tell the user apply needs a checked-out repo.

## The Pipeline

Six phases. Do them in order. Phases 1-3 are read-only and safe to parallelize;
phase 5 is a single coordinated writer.

### Phase 1 — PERCEIVE (deterministic)

Run the scanner; do not guess the stack from vibes:

```
claude-seo run seo_inventory.py <path>
```

It returns JSON with `framework` (+ router model), `routes` (count + sample),
`seo_surface` (which surfaces already exist), `surface_gaps`, and
`business_type`. Read it. If `status` is `error`, stop and report.

Then read enough of the actual source to ground the plan: the routing entry
points, the layout/head component, any existing metadata/schema, `robots`/
`sitemap` if present. Load `references/stack-adapters.md` for where SEO lives in
this framework.

### Phase 2 — DECIDE relevance

Map the inventory to the disciplines that apply. Load
`references/relevance-matrix.md` for the full mapping. The shape of it:

- **Always applicable** (every web project): technical hygiene, content quality
  (E-E-A-T), schema, sitemap + robots, GEO/AI-citability, images, SXO.
- **Conditional** (only when signals fire): local (address/phone/locations),
  e-commerce (products/cart/SKUs), hreflang (multiple locales), semantic
  clustering (a real content library), programmatic (templated page sets).

Produce an explicit list: for each discipline, `applies: yes/no` and the reason.
This is what replaces the user's manual thinking, so make it visible in the
final report.

### Phase 3 — ANALYZE (parallel fan-out)

For each applicable discipline, spawn a specialist subagent **in parallel**
(this is the swarm). Each subagent:

- Loads its discipline's knowledge from the matching skill's `SKILL.md` and
  `references/` (e.g. `seo-schema`, `seo-technical`, `seo-content`, `seo-geo`,
  `seo-sitemap`, `seo-images`, `seo-hreflang`, `seo-local`, `seo-ecommerce`,
  `seo-sxo`, `seo-cluster`). The knowledge is authoritative; the discipline
  skills already encode Google-currency guardrails (see Guardrails below).
- Works **read-only**: it inspects the source and returns a list of proposed
  concrete edits — for each, the file, the exact change, the first-principle it
  rests on, and a "how would we know this failed?" check.

Use the Agent tool with the specialist agents where one exists (`seo-technical`,
`seo-schema`, `seo-content`, `seo-geo`, `seo-sitemap`, `seo-images`, `seo-local`,
`seo-ecommerce`, `seo-sxo`, `seo-cluster`), told to operate in codebase mode
against the source rather than crawling a URL. Analysis agents never write.

### Phase 4 — PLAN (synthesize + sequence)

Collect every proposed edit and reconcile them:

- **Merge by file.** Several disciplines touch the same page head (title, meta
  description, canonical, OG, JSON-LD). Combine them into one coherent edit per
  file, not five conflicting ones.
- **Dedupe.** Two specialists proposing the same fix collapse to one.
- **Sequence by dependency.** Foundational fixes first (routing/head component,
  canonical strategy, sitemap infrastructure), then per-page content, then
  enrichment (schema, OG, images). Walk the 10-principle synthesis the `seo`
  orchestrator uses: PERCEIVE -> ANALYZE -> VALIDATE -> ACT.
- **Drop the irrelevant and the unsafe.** Anything a discipline proposed that
  does not actually fit this product, or that Apply Safety forbids automating,
  goes to a "suggested, not applied" list instead of the diff.

### Phase 5 — APPLY (single coordinated writer)

Load `references/apply-safety.md` first. Then:

1. Ensure the target is a clean git repo (or commit a checkpoint of pre-existing
   changes first, per the omniscience workflow, so the SEO diff is isolated).
2. Create a branch: `git switch -c feat/seo-pass`.
3. Apply the planned edits in dependency order, idiomatically for the framework
   (use `references/stack-adapters.md`). Every edit is **idempotent**: re-running
   the pass must not duplicate a tag, a schema block, or a sitemap entry.
4. Generate net-new files where the plan calls for them (a `sitemap` route,
   `robots`, a schema component, an `llms.txt`) using the project's conventions.
5. **Never break the build.** If the project has a typecheck/build/test command
   (from `package.json` scripts or an obvious equivalent), run it after applying
   and fix anything the pass broke before reporting. A red build is not a
   finished pass.
6. Commit in logical units (Conventional Commits): e.g. `feat(seo): add
   structured data across routes`, `fix(seo): canonical + metadata on all pages`.

### Phase 6 — REPORT

Emit one summary:

- The relevance decision from Phase 2 (what applied, what didn't, and why) — this
  is the record that the user did not have to think about any of it.
- What changed, grouped by discipline, each item with its first-principle and its
  falsifiability check and a leading indicator to watch.
- The "suggested, not applied" list (things that need a human: a business
  decision, real-world data, or content only the owner can write truthfully).
- The branch name and the one-line review instruction: inspect the diff, then
  merge or revert.
- Offer a follow-up: `/seo audit` for a scored health report, or `/seo drift
  baseline` to lock in the new state so future regressions are caught.

## Guardrails (inherited, non-negotiable)

The discipline skills encode these; the pass must honor them:

- Never add `HowTo` schema (deprecated Sept 2023). Never add `FAQPage` for a
  Google SERP benefit (FAQ rich results retired 2026-05-07); use `QAPage` only
  for genuine user Q&A.
- All Core Web Vitals guidance uses INP, never FID.
- Location-page thresholds: warn at 30+, hard-stop at 50+ generated location
  pages without justification.
- Never fabricate content, reviews, authorship, dates, or claims. If a fix needs
  true information the code does not contain (a real address, a genuine author, a
  factual product spec), it goes to "suggested, not applied", never invented.
- Respect `robots` and never touch secrets, `.env`, or build output.

## Relationship to the other commands

This is the autopilot. The 24 discipline skills still exist for when the user
wants one thing (`/seo schema`, `/seo hreflang`, ...). `/seo everything` is for
when they want all of it, applied, with no per-skill decisions. It reuses those
skills' knowledge rather than duplicating it.

Full references:
- `references/stack-adapters.md` — where each framework expresses SEO.
- `references/relevance-matrix.md` — signal-to-discipline mapping.
- `references/apply-safety.md` — idempotency, build preservation, do-not-touch.
