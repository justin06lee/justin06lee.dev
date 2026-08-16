# Apply safety: the rules the autonomous edit pass must not break

The pass edits a real product. These rules are what make "apply everything
autonomously" safe enough to hand a diff instead of a support ticket.

## Isolation and reversibility

- **Only apply to a git repo.** The branch + diff is the safety net; without it,
  do analysis only and say apply needs a checked-out repo.
- **Commit pre-existing changes first** as a checkpoint (`chore: checkpoint
  pre-existing changes`) so the SEO diff is isolated and the user can tell your
  edits from theirs.
- **Work on `feat/seo-pass`**, never on the user's default branch directly.
- Commit in logical units so the diff reads as a sequence of intentional changes,
  not one opaque blob.

## Idempotency (the most important rule)

Running the pass twice must not double anything. Before adding a tag, a JSON-LD
block, a canonical link, a sitemap entry, or a meta field: check whether an
equivalent already exists and update in place instead of appending. The inventory
reports what surfaces already exist; re-verify per file at apply time, because
the plan was built from a snapshot.

## Never break the build

- After applying, run the project's typecheck/build/test if one exists
  (`package.json` scripts, `tsc`, the framework's build). Fix anything the pass
  broke before reporting. A red build is an unfinished pass.
- Match the project's language, framework version, and formatting. A schema
  component in a TypeScript app is `.tsx` with types, not loose JS.
- Prefer the framework's metadata API over raw `<head>` injection (see
  `stack-adapters.md`); it is what the framework's head-dedup and other tooling
  expect.

## Never touch

- Secrets: `.env*`, credential files, keys, tokens — read nor write.
- Build output: `.next/`, `dist/`, `build/`, `out/`, `public/build/`. Edit the
  source that generates it.
- CI/deploy config, database, and infra unless the fix is specifically an SEO
  config the user would expect (e.g. adding a `robots` route). When unsure, it
  goes to "suggested, not applied".
- Anything outside the target project path.

## Never fabricate

SEO schema and content have required fields that tempt invention. Do not invent:
a business address, a phone number, an author identity, a founding date, a
review, a rating, a price, or a product specification. If the truthful value is
not present in the project, the edit that needs it is **suggested, not applied**,
with a note on exactly what fact the user must supply.

## Honor the Google-currency guardrails

Inherited from the discipline skills, enforced here:

- No `HowTo` schema (deprecated Sept 2023).
- No `FAQPage` for Google SERP benefit (FAQ rich results retired 2026-05-07);
  `QAPage` only for genuine user Q&A.
- INP, never FID, in any Core Web Vitals guidance.
- Location-page volume: warn at 30+, hard-stop at 50+ generated location pages
  without explicit justification.

## When to stop and ask

Autonomy is the default, but stop and ask the user when a fix would:

- change routing or URLs of existing indexed pages (a redirect strategy is a
  decision with traffic risk),
- delete or substantially rewrite existing published content,
- alter canonical targets in a way that could de-index pages,
- require a fact only the owner can supply truthfully.

Everything else: apply it, and let the diff be the review.
