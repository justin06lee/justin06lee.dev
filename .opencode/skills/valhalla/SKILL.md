---
name: valhalla
description: >
  One-command autonomous SEO for a codebase. Say "/valhalla" (optionally with a
  path) and it does the entire job in one sweep: understands the product, decides
  which SEO disciplines apply, fans out specialists in parallel, and applies every
  relevant fix directly to the source on a branch, then shows one diff. No
  sub-commands, no per-skill decisions. Triggers on: valhalla, "audit this codebase
  and fix the SEO", "do all the SEO", "full SEO pass", "make this SEO-complete",
  "SEO autopilot", "fix all the seo", or any request to improve a project's SEO
  end to end.
user-invocable: true
argument-hint: "[path or task] (defaults to the current project)"
license: MIT
metadata:
  author: AgriciDaniel
  version: "3.1.0"
  category: seo
---

# Valhalla: One-Command SEO Autopilot

**Invocation:** `/valhalla $ARGUMENTS`. The argument is a project path, a task
description, or both — e.g. `/valhalla`, `/valhalla ./my-app`, or
`/valhalla audit this codebase and fix all the SEO`.

There is exactly one command. The user does not choose disciplines, does not run
things one at a time, and does not review partial results. They point Valhalla at
a project and it does everything applicable in a single run, then hands back one
diff to merge or revert.

**The whole SEO toolkit is inside this skill** — 26 discipline skills, their
references, the specialist agent definitions, and the runtime scripts, all under
this folder. Valhalla is the front door; it loads that knowledge as needed. The
user never has to know it is there.

## The contract

- **One sweep.** Perceive → decide relevance → fan out → apply → report, without
  stopping to ask which discipline to run.
- **Relevance is Valhalla's job, not the user's.** It runs what fits the product
  and skips what does not (no LocalBusiness schema on a SaaS), so "do everything"
  means "everything that applies", decided automatically.
- **Apply, don't just advise.** It edits the actual source. The review is the
  diff, on a `feat/seo-pass` branch, never the user's default branch.
- **Never break the build, never fabricate a fact, never touch secrets.** See the
  apply-safety rules loaded below.

## How to run it

### 0. Ensure the runtime yourself (automatic — never ask)

Before anything else, make sure the runtime is ready. Do not ask the user to run
setup; Valhalla is brainless-by-design, so Claude handles it:

```
claude-seo doctor --json
```

If `ready` is `false`, run setup yourself and report progress as you go, then
continue:

```
claude-seo setup
```

Setup is idempotent, so running it when already set up is harmless. If setup
cannot complete (no network, no Python), do not stop — the codebase-apply flow
still works: the perceive scanner is stdlib-only (runs without setup), and the
core of the pass is Claude reading and editing your source. Note in the final
report which heavier scripts were unavailable, and carry on with everything that
does not need them. The user should never have to type a setup command.

### 1. Read the detailed playbook

This front door stays short on purpose. The full six-phase pipeline —
PERCEIVE, DECIDE, ANALYZE, PLAN, APPLY, REPORT — lives in
`skills/seo-everything/SKILL.md`. **Load and follow it.** Its three references
are the operating manual:

- `skills/seo-everything/references/stack-adapters.md` — where SEO lives in each
  framework (Next app/pages router, Astro, Nuxt, SvelteKit, Hugo, static HTML…),
  so edits land idiomatically.
- `skills/seo-everything/references/relevance-matrix.md` — the signal-to-
  discipline mapping that replaces the user's manual choosing.
- `skills/seo-everything/references/apply-safety.md` — git isolation,
  idempotency, never-fabricate, never-touch, and the Google-currency guardrails.

### 2. Perceive the project deterministically

Do not guess the stack. Run the scanner (it is stdlib-only, so it runs even
before setup completes):

```
claude-seo run seo_inventory.py <path>
```

If `claude-seo` is not yet on PATH (a fresh install before setup), the same
script is at `skills/seo/scripts/seo_inventory.py` and needs only Python 3. It
returns the framework, routes, existing SEO surface, and business type as JSON.

### 3. Draw the discipline knowledge from inside this skill

Each applicable discipline has a skill folder under `skills/` with authoritative
instructions and references — `skills/seo-technical/`, `skills/seo-schema/`,
`skills/seo-content/`, `skills/seo-geo/`, `skills/seo-sitemap/`,
`skills/seo-images/`, `skills/seo-hreflang/`, `skills/seo-local/`,
`skills/seo-ecommerce/`, `skills/seo-sxo/`, `skills/seo-cluster/`, and the shared
`skills/seo/references/`. Load a discipline's files when applying it; that
knowledge already encodes the Google-currency guardrails.

### 4. Fan out, then apply

Run the analysis specialists in parallel (read-only), spawned via the Agent
tool — one per applicable discipline, each loading its discipline folder and
proposing concrete edits for this stack. Because a fresh skill-folder install may
not have registered the bundled specialist agents, spawn general-purpose agents
and point each at the discipline's knowledge rather than depending on a named
`subagent_type`. Then apply the merged plan as a single coordinated pass on the
`feat/seo-pass` branch, per the playbook.

### 5. Report one diff

Emit the relevance decision (what applied and why — the record that the user did
not have to think about it), what changed grouped by discipline with a
falsifiability check each, the "suggested, not applied" list (fixes needing a
fact only the owner can supply), and the branch to review.

## Guardrails (non-negotiable, inherited)

- Never add `HowTo` schema (deprecated) or `FAQPage` for a Google SERP benefit
  (FAQ rich results retired 2026-05-07; `QAPage` only for genuine Q&A).
- Core Web Vitals guidance uses INP, never FID.
- Never fabricate content, authorship, addresses, reviews, ratings, or claims. A
  fix that needs a fact the code lacks is "suggested, not applied".
- Only apply against a git repo the user controls (the branch + diff is the
  safety net). For a live URL with no local source, produce the plan instead.
- Never touch secrets, `.env`, or build output; edit source, not generated files.

## Setup and diagnostics

Setup is automatic (see step 0): Claude checks readiness and runs `claude-seo
setup` itself when needed, so the user never types a setup command. The runtime
(isolated Python + Chromium) powers the heavier scripts; the codebase-apply flow
itself leans on the stdlib scanner plus reading and editing source, so a run can
proceed even if setup is unavailable. `claude-seo doctor` reports readiness if
you need to diagnose.

## For the curious (not required to use Valhalla)

The internal disciplines can also be driven individually via the `seo` skill's
routing (`skills/seo/SKILL.md`) — audit, schema, hreflang, drift monitoring, a
cross-site portfolio view, and more. Valhalla exists so the user never has to.
