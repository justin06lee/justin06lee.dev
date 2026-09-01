# CI and scheduled drift monitoring

`drift_ci.py` turns SEO drift into a check a pipeline can gate on. It watches a
set of URLs, seeds baselines on first sight, compares on every run after that,
and exits non-zero when a severity threshold is breached.

## The reproducibility problem

Baselines live in a SQLite store. On a developer's machine that store is at
`~/.cache/claude-seo/drift/baselines.db` and persists between runs. A CI runner
is ephemeral, so without help every run would start with no baselines, seed
them, and report clean forever — never detecting drift.

Two ways to give CI a persistent baseline:

1. **Cache the directory** between runs (shown below). Simple; the first run
   seeds, later runs compare. A cache eviction silently re-seeds.
2. **Commit the directory** to the repo and point `CLAUDE_SEO_DRIFT_DIR` at it.
   Baselines are reviewed like code; updating one is an explicit commit. Best
   when you want drift measured against an approved snapshot, not "whatever was
   live last week."

`CLAUDE_SEO_DRIFT_DIR` overrides the store location for all four drift scripts.

## Exit codes

| Code | Meaning | Pipeline outcome |
|------|---------|------------------|
| 0 | No finding at or above `--fail-on`, no errors | pass |
| 1 | At least one URL breached the threshold | fail (regression) |
| 2 | Bad config, unreachable page, or missing baseline under `--on-missing fail` | fail (broken run) |

An operational error (2) outranks a regression (1): a run that could not
complete should be fixed before its partial findings are trusted.

## GitHub Actions: scheduled check with a cached baseline

```yaml
name: SEO drift
on:
  schedule:
    - cron: "0 7 * * 1"   # Mondays 07:00 UTC
  workflow_dispatch:

jobs:
  drift:
    runs-on: ubuntu-latest
    env:
      CLAUDE_SEO_DRIFT_DIR: ${{ github.workspace }}/.seo-drift
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      # Persist baselines between runs. The key is stable so every run restores
      # the same store; drop a date suffix into the key to force periodic reseed.
      - uses: actions/cache@v4
        with:
          path: .seo-drift
          key: seo-drift-baselines

      - name: Install the seo skill
        run: |
          pip install requests beautifulsoup4 lxml
          bmo add justin06lee/valhalla.md/skills/seo   # or a manual checkout

      - name: Check for SEO drift
        run: |
          claude-seo run drift_ci.py check \
            --config .github/seo-urls.txt \
            --fail-on critical \
            --skip-cwv \
            --junit drift-junit.xml \
            --output drift-report.json

      - name: Publish the report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: seo-drift
          path: |
            drift-report.json
            drift-junit.xml
```

`.github/seo-urls.txt` is a plain list:

```
# Pages that must not regress
https://example.com/
https://example.com/pricing
https://example.com/blog/flagship-post
```

## Committed-baseline variant

To gate against an approved snapshot instead of a cached one, drop the
`actions/cache` step, commit the store, and seed it deliberately:

```bash
# One time, locally, reviewed in a PR:
CLAUDE_SEO_DRIFT_DIR=./.seo-drift \
  claude-seo run drift_ci.py baseline --config .github/seo-urls.txt --skip-cwv
git add .seo-drift && git commit -m "seo: approve drift baseline"
```

CI then runs `check` with `--on-missing fail`, so a URL added to the list
without an approved baseline fails the run rather than silently seeding one.

## Cron on a server

```bash
# /etc/cron.d/seo-drift — Mondays 07:00, mail on regression
0 7 * * 1  seo  claude-seo run drift_ci.py check --config /etc/seo/urls.txt --fail-on critical --skip-cwv --quiet || echo "SEO drift detected" | mail -s "SEO regression" seo@example.com
```

## Choosing `--fail-on`

- `critical` (default): fail only on indexability-breaking changes — canonical,
  noindex, status codes, schema/title/H1 removal. The right gate for "block the
  deploy."
- `warning`: also fail on softer regressions — title/description edits, heading
  changes. Good for a review that a human triages.
- `any` / `info`: fail on anything, including informational deltas. Noisy;
  reserve for a page that is supposed to be frozen.
- `none`: never fail on findings (still fails on operational errors). Useful to
  record drift as an artifact without blocking.
