---
name: seo-drift
description: >
  SEO drift monitoring: capture baselines of SEO-critical elements, detect changes,
  and track regressions over time. Git for SEO: baseline, diff, and track changes
  to your on-page SEO. Use when user says "SEO drift", "baseline", "track changes",
  "did anything break", "SEO regression", "compare SEO", "before and after",
  "monitor SEO changes", or "deployment check".
user-invocable: true
argument-hint: "baseline|compare|history|ci <url>"
license: MIT
metadata:
  author: AgriciDaniel
  original_author: "Dan Colta (Pro Hub Challenge)"
  version: "3.1.0"
  category: seo
---

# SEO Drift Monitor (April 2026)

Git for your SEO. Capture baselines, detect regressions, track changes over time.

---

## Commands

| Command | Purpose |
|---------|---------|
| `/seo drift baseline <url>` | Capture current SEO state as a "known good" snapshot |
| `/seo drift compare <url>` | Compare current page state to stored baseline |
| `/seo drift history <url>` | Show change history and past comparisons |
| `/seo drift ci` | Non-interactive runner for schedules and CI: watch many URLs, exit non-zero on regression |

---

## What It Captures

Every baseline records these SEO-critical elements:

| Element | Field | Source |
|---------|-------|--------|
| Title tag | `title` | `parse_html.py` |
| Meta description | `meta_description` | `parse_html.py` |
| Canonical URL | `canonical` | `parse_html.py` |
| Robots directives | `meta_robots` | `parse_html.py` |
| H1 headings | `h1` (array) | `parse_html.py` |
| H2 headings | `h2` (array) | `parse_html.py` |
| H3 headings | `h3` (array) | `parse_html.py` |
| JSON-LD schema | `schema` (array) | `parse_html.py` |
| Open Graph tags | `open_graph` (dict) | `parse_html.py` |
| Core Web Vitals | `cwv` (dict) | `pagespeed_check.py` |
| HTTP status code | `status_code` | `fetch_page.py` |
| HTML content hash | `html_hash` (SHA-256) | Computed |
| Schema content hash | `schema_hash` (SHA-256) | Computed |

---

## How Comparison Works

The comparison engine applies **17 rules across 3 severity levels**. Load
`references/comparison-rules.md` for the full rule set with thresholds,
recommended actions, and cross-skill references.

### Severity Levels

| Level | Meaning | Response Time |
|-------|---------|---------------|
| **CRITICAL** | SEO-breaking change, likely traffic loss | Immediate |
| **WARNING** | Potential impact, needs investigation | Within 1 week |
| **INFO** | Awareness only, may be intentional | Review at convenience |

---

## Storage

All data is stored locally in SQLite:

```
~/.cache/claude-seo/drift/baselines.db
```

### Tables

- **baselines**: Captured snapshots with all SEO elements
- **comparisons**: Diff results with triggered rules and severities

URL normalization ensures consistent matching: lowercase scheme/host, strip
default ports (80/443), sort query parameters, remove UTM parameters, strip
trailing slashes.

---

## Command: `baseline`

Captures the current state of a page and stores it.

**Steps:**
1. Validate URL (SSRF protection via `google_auth.validate_url()`)
2. Fetch page via `scripts/fetch_page.py`
3. Parse HTML via `scripts/parse_html.py`
4. Optionally fetch CWV via `scripts/pagespeed_check.py` (use `--skip-cwv` to skip)
5. Hash HTML body and schema content (SHA-256)
6. Store snapshot in SQLite

**Execution:**
```bash
claude-seo run drift_baseline.py <url>
claude-seo run drift_baseline.py <url> --skip-cwv
```

**Output:** JSON with baseline ID, timestamp, URL, and summary of captured elements.

---

## Command: `compare`

Fetches the current page state and diffs it against the most recent baseline.

**Steps:**
1. Validate URL
2. Load most recent baseline from SQLite (or specific `--baseline-id`)
3. Fetch and parse current page state
4. Run all 17 comparison rules
5. Classify findings by severity
6. Store comparison result
7. Output JSON diff report

**Execution:**
```bash
claude-seo run drift_compare.py <url>
claude-seo run drift_compare.py <url> --baseline-id 5
claude-seo run drift_compare.py <url> --skip-cwv
```

**Output:** JSON with all triggered rules, old/new values, severity, and actions.

After comparison, offer to generate an HTML report:
```bash
claude-seo run drift_report.py <comparison_json_file> --output drift-report.html
```

---

## Command: `history`

Shows all baselines and comparisons for a URL.

**Execution:**
```bash
claude-seo run drift_history.py <url>
claude-seo run drift_history.py <url> --limit 10
```

**Output:** JSON array of baselines (newest first) with timestamps and comparison summaries.

---

## Command: `ci`

Runs baseline/compare across many URLs without a human in the loop, aggregates
the findings, and exits non-zero when a severity threshold is breached, so a
cron job or CI pipeline fails on SEO regression the way it fails on a broken
test.

**Execution:**
```bash
# Compare a list of URLs; exit 1 if any has a CRITICAL finding
claude-seo run drift_ci.py check --config urls.json

# Watch two URLs, fail on WARNING or worse, skip CWV (no Google API needed)
claude-seo run drift_ci.py check --url https://a.com --url https://b.com \
  --fail-on warning --skip-cwv

# (Re)seed baselines for the whole list
claude-seo run drift_ci.py baseline --config urls.json

# Emit a JUnit report for a CI system to display
claude-seo run drift_ci.py check --config urls.json --junit drift.xml
```

**URL sources:** `--url` (repeatable) and/or `--config FILE`. The config is
JSON (`{"urls": [...]}` or a bare list) or a newline-delimited text file with
`#` comments; `--config -` reads stdin.

**Key flags:**

| Flag | Effect |
|------|--------|
| `--fail-on none\|any\|info\|warning\|critical` | Lowest severity that fails the run (default `critical`) |
| `--on-missing baseline\|skip\|fail` | What to do when a URL has no baseline yet (default `baseline`: seed it and report no drift this run) |
| `--skip-cwv` | Skip Core Web Vitals so no Google API credentials are needed |
| `--output FILE` | Write the aggregate JSON report (default stdout) |
| `--junit FILE` | Also write a JUnit XML report |
| `--quiet` | Suppress the human-readable stderr summary |

**Exit codes:** `0` clean, `1` regression (a URL breached `--fail-on`), `2`
operational error (bad config, unreachable page, or a missing baseline under
`--on-missing fail`). An operational error outranks a regression: fix the run
before trusting its findings.

**Reproducible baselines across runners:** set `CLAUDE_SEO_DRIFT_DIR` to a
checked-in or cache-restored directory so every CI run compares against the
same stored state. See `references/ci-integration.md` for a ready-to-use
GitHub Actions workflow.

---

## Cross-Skill Integration

When drift is detected, recommend the appropriate specialized skill:

| Finding | Recommendation |
|---------|----------------|
| Schema removed or modified | Run `/seo schema <url>` for full validation |
| CWV regression | Run `/seo technical <url>` for performance audit |
| Title or meta description changed | Run `/seo page <url>` for content analysis |
| Canonical changed or removed | Run `/seo technical <url>` for indexability check |
| Noindex added | Run `/seo technical <url>` for crawlability audit |
| H1/heading structure changed | Run `/seo content <url>` for E-E-A-T review |
| OG tags removed | Run `/seo page <url>` for social sharing analysis |
| Status code changed to error | Run `/seo technical <url>` for full diagnostics |

---

## Error Handling

| Scenario | Action |
|----------|--------|
| URL unreachable | Report error from `fetch_page.py`. Do not guess state. Suggest user verify URL. |
| No baseline exists for URL | Inform user and suggest running `baseline` first. |
| SSRF blocked (private IP) | Report `validate_url()` rejection. Never bypass. |
| SQLite database missing | Auto-create on first use. No error. |
| CWV fetch fails (no API key) | Store `null` for CWV fields. Skip CWV rules during comparison. |
| Page returns 4xx/5xx | Still capture as baseline (status code IS a tracked field). |
| Multiple baselines exist | Use most recent unless `--baseline-id` specified. |

---

## Security

- **All URL fetching** goes through `scripts/fetch_page.py` which enforces SSRF protection
  (blocks private IPs, loopback, reserved ranges, GCP metadata endpoints)
- **No curl, no subprocess HTTP calls** -- only the project's validated fetch pipeline
- **All SQLite queries** use parameterized placeholders (`?`), never string interpolation
- **TLS always verified** -- no `verify=False` anywhere in the pipeline

---

## Typical Workflows

### Pre/Post Deployment Check
```
/seo drift baseline https://example.com     # Before deploy
# ... deploy happens ...
/seo drift compare https://example.com      # After deploy
```

### Ongoing Monitoring
```
/seo drift baseline https://example.com     # Initial capture
# ... weeks later ...
/seo drift compare https://example.com      # Check for drift
/seo drift history https://example.com      # Review all changes
```

### Investigating a Traffic Drop
```
/seo drift compare https://example.com      # What changed?
/seo drift history https://example.com      # When did it change?
```

### Scheduled / CI Monitoring
```
# In CI or cron, gate on regression across a list of URLs:
claude-seo run drift_ci.py check --config urls.json --fail-on critical --skip-cwv
```
Exits non-zero when a page regresses, so the pipeline fails like a broken test.
See `references/ci-integration.md` for a ready-to-use GitHub Actions workflow
and the committed-baseline variant.
