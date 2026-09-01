#!/usr/bin/env python3
"""Non-interactive SEO drift runner for schedules and CI.

Wraps the drift baseline/compare engine so a cron job or CI pipeline can watch
a set of URLs without a human in the loop. It captures baselines on first sight,
compares on every run after that, aggregates findings across all URLs, and exits
non-zero when a configured severity threshold is breached, so a pipeline fails
on regression the same way it fails on a broken test.

Baselines live in the SQLite store shared with ``drift_baseline.py``. Point
``CLAUDE_SEO_DRIFT_DIR`` at a checked-in or cache-restored directory to make the
comparison reproducible across runners.

Usage:
    claude-seo run drift_ci.py check  --config urls.json [--fail-on critical]
    claude-seo run drift_ci.py check  --url https://a.com --url https://b.com
    claude-seo run drift_ci.py baseline --config urls.json   # (re)seed baselines

URL sources (combine freely):
    --config FILE   JSON ({"urls": [...]} or a bare list) or newline-delimited
                    text; "-" reads stdin.
    --url URL       Repeatable.

Exit codes:
    0  clean: no findings at or above --fail-on, no operational errors
    1  regression: at least one URL breached the threshold
    2  operational error: bad config, unreachable page, or a missing baseline
       under --on-missing fail
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from xml.sax.saxutils import quoteattr, escape

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPTS_DIR)

from drift_baseline import (  # noqa: E402
    DB_PATH,
    capture_baseline,
    init_db,
    url_hash,
)
from drift_compare import load_baseline, run_comparison  # noqa: E402

# Severity ordering, lowest to highest. --fail-on names the lowest severity that
# should fail the run; "any" is an alias for the lowest real severity.
SEVERITY_ORDER = ["info", "warning", "critical"]
FAIL_ON_CHOICES = ["none", "any", *SEVERITY_ORDER]

EXIT_CLEAN = 0
EXIT_REGRESSION = 1
EXIT_OPERATIONAL = 2


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_urls(config: str | None, urls: list[str]) -> list[str]:
    """Merge --url values with a --config file, de-duplicated, order preserved.

    The config is JSON (an object with a ``urls`` list, or a bare list) or a
    newline-delimited text file; ``-`` reads stdin. Blank lines and ``#``
    comments are ignored so a text list can be annotated.
    """
    collected: list[str] = list(urls)
    if config is not None:
        raw = sys.stdin.read() if config == "-" else _read_file(config)
        collected.extend(_parse_config(raw, config))
    seen: set[str] = set()
    ordered: list[str] = []
    for url in collected:
        url = url.strip()
        if url and url not in seen:
            seen.add(url)
            ordered.append(url)
    return ordered


def _read_file(path: str) -> str:
    try:
        with open(path, encoding="utf-8") as handle:
            return handle.read()
    except OSError as exc:
        raise ConfigError(f"cannot read config {path}: {exc}") from exc


def _parse_config(raw: str, source: str) -> list[str]:
    stripped = raw.lstrip()
    if stripped[:1] in "{[":
        try:
            data = json.loads(raw)
        except ValueError as exc:
            raise ConfigError(f"invalid JSON in config {source}: {exc}") from exc
        if isinstance(data, dict):
            data = data.get("urls", [])
        if not isinstance(data, list):
            raise ConfigError(f"config {source} must be a list or an object with a 'urls' list")
        return [str(item) for item in data]
    # Newline-delimited text, with # comments.
    lines = []
    for line in raw.splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            lines.append(line)
    return lines


class ConfigError(ValueError):
    """A user-facing problem with the URL configuration."""


def _has_baseline(url: str) -> bool:
    # init_db() creates the store if absent and returns its own connection, the
    # same one run_comparison uses, so the two agree on what "exists" means.
    if not os.path.exists(DB_PATH):
        return False
    conn = init_db()
    try:
        # url_hash normalizes internally, matching capture_baseline and
        # run_comparison, so all three agree on a URL's identity.
        return load_baseline(conn, url_hash(url)) is not None
    finally:
        conn.close()


def _severity_at_or_above(threshold: str, summary: dict) -> int:
    """Count findings whose severity is at or above the threshold."""
    if threshold in ("none",):
        return 0
    floor = 0 if threshold == "any" else SEVERITY_ORDER.index(threshold)
    return sum(summary.get(sev, 0) for sev in SEVERITY_ORDER[floor:])


def check_url(url: str, skip_cwv: bool, on_missing: str) -> dict:
    """Compare one URL to its baseline, honoring the missing-baseline policy."""
    if not _has_baseline(url):
        if on_missing == "fail":
            return {"url": url, "outcome": "missing", "error": "no baseline captured"}
        if on_missing == "skip":
            return {"url": url, "outcome": "skipped", "reason": "no baseline captured"}
        # on_missing == "baseline": seed it now and report no drift this run.
        seeded = capture_baseline(url, skip_cwv=skip_cwv)
        if seeded.get("error"):
            return {"url": url, "outcome": "error", "error": seeded["error"]}
        return {
            "url": url,
            "outcome": "baselined",
            "baseline_id": seeded.get("baseline_id"),
            "summary": {"critical": 0, "warning": 0, "info": 0},
        }
    result = run_comparison(url, skip_cwv=skip_cwv)
    if result.get("error"):
        return {"url": url, "outcome": "error", "error": result["error"]}
    return {
        "url": url,
        "outcome": "compared",
        "baseline_id": result.get("baseline_id"),
        "baseline_timestamp": result.get("baseline_timestamp"),
        "summary": {
            "critical": result["summary"]["critical"],
            "warning": result["summary"]["warning"],
            "info": result["summary"]["info"],
        },
        "findings": [
            {
                "rule": f["rule"],
                "severity": f["severity"],
                "message": f["message"],
            }
            for f in result.get("triggered_findings", [])
        ],
    }


def baseline_url(url: str, skip_cwv: bool) -> dict:
    result = capture_baseline(url, skip_cwv=skip_cwv)
    if result.get("error"):
        return {"url": url, "outcome": "error", "error": result["error"]}
    return {"url": url, "outcome": "baselined", "baseline_id": result.get("baseline_id")}


def run(mode: str, urls: list[str], *, skip_cwv: bool, on_missing: str, fail_on: str) -> dict:
    results = []
    totals = {"urls": len(urls), "critical": 0, "warning": 0, "info": 0,
              "errors": 0, "baselined": 0, "compared": 0, "skipped": 0, "regressions": 0}
    for url in urls:
        if mode == "baseline":
            entry = baseline_url(url, skip_cwv)
        else:
            entry = check_url(url, skip_cwv, on_missing)
        outcome = entry["outcome"]
        if outcome == "error" or outcome == "missing":
            totals["errors"] += 1
        elif outcome == "baselined":
            totals["baselined"] += 1
        elif outcome == "skipped":
            totals["skipped"] += 1
        elif outcome == "compared":
            totals["compared"] += 1
            summary = entry["summary"]
            for sev in SEVERITY_ORDER:
                totals[sev] += summary.get(sev, 0)
            breach = _severity_at_or_above(fail_on, summary)
            entry["breached"] = breach > 0
            if breach:
                totals["regressions"] += 1
        results.append(entry)

    regressions = totals["regressions"] > 0
    operational = totals["errors"] > 0
    if operational:
        exit_code = EXIT_OPERATIONAL
    elif regressions:
        exit_code = EXIT_REGRESSION
    else:
        exit_code = EXIT_CLEAN

    return {
        "status": "ok",
        "mode": mode,
        "generated_at": _now(),
        "fail_on": fail_on,
        "on_missing": on_missing,
        "totals": totals,
        "regressions": regressions,
        "results": results,
        "exit_code": exit_code,
    }


def to_junit(report: dict) -> str:
    """Render a JUnit suite: one testcase per URL, failure on breach, error on fault."""
    results = report["results"]
    failures = sum(1 for r in results if r.get("breached"))
    errors = sum(1 for r in results if r["outcome"] in ("error", "missing"))
    skipped = sum(1 for r in results if r["outcome"] == "skipped")
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<testsuite name="seo-drift" tests={quoteattr(str(len(results)))} '
        f'failures={quoteattr(str(failures))} errors={quoteattr(str(errors))} '
        f'skipped={quoteattr(str(skipped))} timestamp={quoteattr(report["generated_at"])}>',
    ]
    for entry in results:
        name = quoteattr(entry["url"])
        lines.append(f'  <testcase name={name} classname="seo-drift.{entry["outcome"]}">')
        if entry["outcome"] in ("error", "missing"):
            msg = quoteattr(entry.get("error", entry["outcome"]))
            lines.append(f'    <error message={msg}></error>')
        elif entry.get("breached"):
            summary = entry.get("summary", {})
            msg = quoteattr(
                f'{summary.get("critical", 0)} critical, '
                f'{summary.get("warning", 0)} warning, {summary.get("info", 0)} info'
            )
            detail = "\n".join(
                f'{f["severity"]}: {f["rule"]} — {f["message"]}'
                for f in entry.get("findings", [])
            )
            lines.append(f'    <failure message={msg}>{escape(detail)}</failure>')
        elif entry["outcome"] == "skipped":
            lines.append(f'    <skipped message={quoteattr(entry.get("reason", "skipped"))}></skipped>')
        lines.append("  </testcase>")
    lines.append("</testsuite>")
    return "\n".join(lines) + "\n"


def format_summary(report: dict) -> str:
    totals = report["totals"]
    mode = report["mode"]
    parts = [f"seo-drift {mode}: {totals['urls']} URL(s)"]
    if mode == "baseline":
        parts.append(f"{totals['baselined']} baselined, {totals['errors']} error(s)")
        return " | ".join(parts)
    parts.append(f"{totals['compared']} compared, {totals['baselined']} seeded, "
                 f"{totals['skipped']} skipped, {totals['errors']} error(s)")
    parts.append(f"findings: {totals['critical']} critical, "
                 f"{totals['warning']} warning, {totals['info']} info")
    if report["regressions"]:
        parts.append(f"REGRESSION: {totals['regressions']} URL(s) breached --fail-on {report['fail_on']}")
    else:
        parts.append("no regressions")
    return " | ".join(parts)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Non-interactive SEO drift runner for schedules and CI."
    )
    parser.add_argument("mode", choices=["check", "baseline"],
                        help="check compares against baselines; baseline (re)captures them")
    parser.add_argument("--url", action="append", default=[], metavar="URL",
                        help="a URL to watch (repeatable)")
    parser.add_argument("--config", metavar="FILE",
                        help="JSON or newline-delimited URL list; '-' reads stdin")
    parser.add_argument("--fail-on", choices=FAIL_ON_CHOICES, default="critical",
                        help="lowest severity that fails the run (default: critical)")
    parser.add_argument("--on-missing", choices=["baseline", "skip", "fail"], default="baseline",
                        help="what to do when a URL has no baseline (default: baseline)")
    parser.add_argument("--skip-cwv", action="store_true",
                        help="skip Core Web Vitals comparison (no Google API needed)")
    parser.add_argument("--output", metavar="FILE",
                        help="write the aggregate JSON report here (default: stdout)")
    parser.add_argument("--junit", metavar="FILE",
                        help="also write a JUnit XML report here")
    parser.add_argument("--quiet", action="store_true",
                        help="suppress the human-readable summary on stderr")
    args = parser.parse_args(argv)

    try:
        urls = load_urls(args.config, args.url)
    except ConfigError as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, indent=2))
        return EXIT_OPERATIONAL
    if not urls:
        print(json.dumps(
            {"status": "error", "error": "no URLs given; use --url or --config"}, indent=2))
        return EXIT_OPERATIONAL

    report = run(args.mode, urls, skip_cwv=args.skip_cwv,
                 on_missing=args.on_missing, fail_on=args.fail_on)

    payload = json.dumps(report, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            handle.write(payload + "\n")
    else:
        print(payload)

    if args.junit:
        with open(args.junit, "w", encoding="utf-8") as handle:
            handle.write(to_junit(report))

    if not args.quiet:
        print(format_summary(report), file=sys.stderr)

    return report["exit_code"]


if __name__ == "__main__":
    sys.exit(main())
