#!/usr/bin/env python3
"""Cross-site SEO portfolio: aggregate many audits into one dashboard.

A single audit answers "how is this site?". An agency or a multi-property team
needs "how is the whole portfolio, and what is wrong across several sites at
once?". This reads the ``audit-data.json`` envelope that ``seo-audit`` writes
under each ``{domain}-audit/`` directory, ranks the sites, surfaces issues that
recur across them, and renders a standalone HTML dashboard in the house style.

It also emits a machine-readable ``portfolio.json`` so a later run can diff
against it: pass ``--previous portfolio.json`` and each site shows its score
delta since that snapshot.

Usage:
    claude-seo run portfolio_report.py DIR [DIR ...] [--output portfolio.html]
    claude-seo run portfolio_report.py --scan ./clients --output portfolio.html
    claude-seo run portfolio_report.py --scan . --previous last/portfolio.json

Inputs:
    DIR             an audit directory containing audit-data.json, or the JSON
                    file itself (repeatable).
    --scan ROOT     find every */audit-data.json under ROOT (one level of
                    subdirectories, matching the {domain}-audit/ convention).

Outputs:
    --output FILE   HTML dashboard (default: portfolio.html).
    --json FILE     aggregate JSON (default: alongside the HTML as portfolio.json).
    --previous FILE a prior portfolio.json to compute per-site score deltas.
"""
from __future__ import annotations

import argparse
import glob
import html
import json
import os
import sys
from datetime import datetime, timezone

COLORS = {
    "navy": "#1e3a5f",
    "gold": "#b8860b",
    "green": "#2d6a4f",
    "amber": "#d4740e",
    "red": "#c53030",
    "cream": "#faf9f7",
    "white": "#ffffff",
    "light_gray": "#f3f4f6",
    "mid_gray": "#6b7280",
    "dark_gray": "#374151",
}

# The audit envelope uses a five-level severity vocabulary; anything else is
# folded into "info" so a malformed finding never silently vanishes from counts.
SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"]
SEVERITY_LABEL = {s: s.capitalize() for s in SEVERITY_ORDER}
# Severities that count toward the "issues that need attention" headline.
ACTIONABLE = {"critical", "high", "medium"}


def _escape(text) -> str:
    if text is None:
        return ""
    return html.escape(str(text))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_severity(value) -> str:
    key = str(value or "info").strip().lower()
    if key in SEVERITY_ORDER:
        return key
    # Common synonyms seen in envelopes.
    return {"warning": "medium", "warn": "medium", "error": "high",
            "critical!": "critical"}.get(key, "info")


class PortfolioError(ValueError):
    """A user-facing problem loading the audits."""


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def discover_inputs(paths: list[str], scan_root: str | None) -> list[str]:
    """Resolve CLI paths and --scan into a list of audit-data.json files."""
    files: list[str] = []
    for path in paths:
        if os.path.isdir(path):
            candidate = os.path.join(path, "audit-data.json")
            if not os.path.isfile(candidate):
                raise PortfolioError(f"{path} has no audit-data.json")
            files.append(candidate)
        elif os.path.isfile(path):
            files.append(path)
        else:
            raise PortfolioError(f"no such audit path: {path}")
    if scan_root:
        if not os.path.isdir(scan_root):
            raise PortfolioError(f"--scan root is not a directory: {scan_root}")
        found = sorted(glob.glob(os.path.join(scan_root, "*", "audit-data.json")))
        files.extend(found)
    # De-duplicate by real path, order preserved.
    seen: set[str] = set()
    ordered: list[str] = []
    for f in files:
        real = os.path.realpath(f)
        if real not in seen:
            seen.add(real)
            ordered.append(f)
    return ordered


def _domain_from_path(json_path: str) -> str:
    """Derive a site label from the {domain}-audit/ directory name."""
    parent = os.path.basename(os.path.dirname(os.path.abspath(json_path)))
    if parent.endswith("-audit"):
        parent = parent[: -len("-audit")]
    return parent or "site"


def load_audit(json_path: str) -> dict:
    """Read and summarize one audit envelope into a portfolio site record."""
    try:
        with open(json_path, encoding="utf-8") as handle:
            data = json.load(handle)
    except OSError as exc:
        raise PortfolioError(f"cannot read {json_path}: {exc}") from exc
    except ValueError as exc:
        raise PortfolioError(f"invalid JSON in {json_path}: {exc}") from exc
    if not isinstance(data, dict):
        raise PortfolioError(f"{json_path} is not an audit envelope (expected an object)")

    summary = data.get("summary") if isinstance(data.get("summary"), dict) else {}
    domain = summary.get("domain") or summary.get("url") or _domain_from_path(json_path)
    score = _coerce_score(summary.get("health_score"))

    severity_counts = {s: 0 for s in SEVERITY_ORDER}
    findings: list[dict] = []
    categories = data.get("categories") if isinstance(data.get("categories"), list) else []
    category_scores = []
    for category in categories:
        if not isinstance(category, dict):
            continue
        cat_name = str(category.get("name", "Category"))
        cat_score = _coerce_score(category.get("score"))
        if cat_score is not None:
            category_scores.append({"name": cat_name, "score": cat_score})
        for finding in category.get("findings", []) or []:
            if not isinstance(finding, dict):
                continue
            sev = normalize_severity(finding.get("severity"))
            severity_counts[sev] += 1
            findings.append({
                "title": str(finding.get("title", "Untitled finding")).strip(),
                "severity": sev,
                "category": cat_name,
            })

    actionable = sum(severity_counts[s] for s in ACTIONABLE)
    return {
        "domain": str(domain),
        "source": json_path,
        "health_score": score,
        "business_type": summary.get("business_type"),
        "severity_counts": severity_counts,
        "actionable_issues": actionable,
        "total_findings": len(findings),
        "category_scores": category_scores,
        "findings": findings,
    }


def _coerce_score(value):
    try:
        score = float(value)
    except (TypeError, ValueError):
        return None
    return max(0, min(100, round(score)))


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------

def _finding_key(title: str) -> str:
    """Normalize a finding title so the same issue matches across sites."""
    return " ".join(title.lower().split())


def build_portfolio(sites: list[dict], previous: dict | None) -> dict:
    """Assemble the aggregate: ranking, totals, shared issues, and deltas."""
    prev_scores = {}
    if previous:
        for site in previous.get("sites", []):
            if isinstance(site, dict) and site.get("domain") is not None:
                prev_scores[site["domain"]] = site.get("health_score")

    for site in sites:
        prev = prev_scores.get(site["domain"])
        if prev is not None and site["health_score"] is not None:
            site["score_delta"] = site["health_score"] - prev
        else:
            site["score_delta"] = None

    # Rank worst-first: sites with a score sort by it ascending, unscored last.
    ranked = sorted(
        sites,
        key=lambda s: (s["health_score"] is None, s["health_score"] if s["health_score"] is not None else 0,
                       -s["actionable_issues"]),
    )

    totals = {s: 0 for s in SEVERITY_ORDER}
    for site in sites:
        for sev in SEVERITY_ORDER:
            totals[sev] += site["severity_counts"][sev]

    scored = [s["health_score"] for s in sites if s["health_score"] is not None]
    avg_score = round(sum(scored) / len(scored)) if scored else None

    shared = _shared_issues(sites)

    return {
        "status": "ok",
        "generated_at": _now(),
        "site_count": len(sites),
        "average_health_score": avg_score,
        "severity_totals": totals,
        "actionable_total": sum(totals[s] for s in ACTIONABLE),
        "shared_issues": shared,
        "sites": ranked,
    }


def _shared_issues(sites: list[dict], min_sites: int = 2) -> list[dict]:
    """Findings whose title recurs across sites — fix-once, help-many candidates."""
    index: dict[str, dict] = {}
    for site in sites:
        seen_here: set[str] = set()
        for finding in site["findings"]:
            key = _finding_key(finding["title"])
            if not key or key in seen_here:
                continue
            seen_here.add(key)
            entry = index.setdefault(key, {
                "title": finding["title"],
                "severity": finding["severity"],
                "sites": [],
            })
            entry["sites"].append(site["domain"])
            # Keep the most severe label seen for this issue.
            if SEVERITY_ORDER.index(finding["severity"]) < SEVERITY_ORDER.index(entry["severity"]):
                entry["severity"] = finding["severity"]
    shared = [e for e in index.values() if len(e["sites"]) >= min_sites]
    shared.sort(key=lambda e: (SEVERITY_ORDER.index(e["severity"]), -len(e["sites"])))
    return shared


# ---------------------------------------------------------------------------
# HTML rendering
# ---------------------------------------------------------------------------

def _score_color(score) -> str:
    if score is None:
        return COLORS["mid_gray"]
    if score >= 80:
        return COLORS["green"]
    if score >= 50:
        return COLORS["amber"]
    return COLORS["red"]


def _delta_html(delta) -> str:
    if delta is None:
        return f'<span style="color:{COLORS["mid_gray"]}">—</span>'
    if delta > 0:
        return f'<span style="color:{COLORS["green"]}">▲ +{delta}</span>'
    if delta < 0:
        return f'<span style="color:{COLORS["red"]}">▼ {delta}</span>'
    return f'<span style="color:{COLORS["mid_gray"]}">±0</span>'


def render_html(portfolio: dict) -> str:
    sites = portfolio["sites"]
    totals = portfolio["severity_totals"]
    avg = portfolio["average_health_score"]

    site_rows = []
    for site in sites:
        score = site["health_score"]
        score_txt = f"{score}" if score is not None else "n/a"
        chips = " ".join(
            f'<span class="chip sev-{sev}">{site["severity_counts"][sev]} {SEVERITY_LABEL[sev]}</span>'
            for sev in SEVERITY_ORDER if site["severity_counts"][sev]
        ) or '<span class="chip sev-none">no findings</span>'
        biz = f' <span class="biz">{_escape(site["business_type"])}</span>' if site.get("business_type") else ""
        site_rows.append(f"""
        <tr>
          <td class="site"><span class="dot" style="background:{_score_color(score)}"></span>
              {_escape(site["domain"])}{biz}</td>
          <td class="score" style="color:{_score_color(score)}">{score_txt}</td>
          <td class="delta">{_delta_html(site.get("score_delta"))}</td>
          <td class="issues">{site["actionable_issues"]}</td>
          <td class="chips">{chips}</td>
        </tr>""")

    shared_rows = []
    for issue in portfolio["shared_issues"]:
        site_list = ", ".join(_escape(s) for s in issue["sites"])
        shared_rows.append(f"""
        <tr>
          <td><span class="chip sev-{issue['severity']}">{SEVERITY_LABEL[issue['severity']]}</span></td>
          <td class="issue-title">{_escape(issue["title"])}</td>
          <td class="issue-count">{len(issue["sites"])} sites</td>
          <td class="issue-sites">{site_list}</td>
        </tr>""")
    shared_section = f"""
      <h2>Issues across multiple sites</h2>
      <p class="sub">The same problem on several sites is usually one root cause. Fixing it once helps the whole portfolio.</p>
      <table class="shared">
        <thead><tr><th>Severity</th><th>Issue</th><th>Reach</th><th>Sites</th></tr></thead>
        <tbody>{''.join(shared_rows)}</tbody>
      </table>""" if shared_rows else """
      <h2>Issues across multiple sites</h2>
      <p class="sub">No finding recurs across two or more sites. Issues are site-specific.</p>"""

    totals_chips = " ".join(
        f'<span class="chip sev-{sev}">{totals[sev]} {SEVERITY_LABEL[sev]}</span>'
        for sev in SEVERITY_ORDER if totals[sev]
    ) or '<span class="chip sev-none">no findings</span>'

    avg_txt = f"{avg}" if avg is not None else "n/a"
    generated = _escape(portfolio["generated_at"])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SEO Portfolio Dashboard</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{ font-family: Georgia, 'Times New Roman', serif; margin: 0; background: {COLORS['cream']};
          color: {COLORS['dark_gray']}; }}
  .wrap {{ max-width: 1040px; margin: 0 auto; padding: 32px 24px 64px; }}
  header {{ border-top: 6px solid {COLORS['navy']}; background: {COLORS['white']};
            padding: 28px 32px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }}
  h1 {{ color: {COLORS['navy']}; margin: 0 0 4px; font-size: 26px; }}
  .meta {{ color: {COLORS['mid_gray']}; font-size: 13px; }}
  .cards {{ display: flex; flex-wrap: wrap; gap: 16px; margin: 24px 0; }}
  .card {{ flex: 1 1 160px; background: {COLORS['white']}; border: 1px solid {COLORS['light_gray']};
           border-radius: 6px; padding: 18px 20px; }}
  .card .big {{ font-size: 30px; font-weight: bold; color: {COLORS['navy']}; }}
  .card .lbl {{ font-size: 12px; color: {COLORS['mid_gray']}; text-transform: uppercase; letter-spacing: .04em; }}
  h2 {{ color: {COLORS['navy']}; border-bottom: 2px solid {COLORS['navy']}; padding-bottom: 6px;
        margin-top: 40px; font-size: 19px; }}
  .sub {{ color: {COLORS['mid_gray']}; font-size: 13px; margin-top: -2px; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 12px; background: {COLORS['white']};
           overflow: hidden; border-radius: 6px; }}
  th {{ text-align: left; background: {COLORS['navy']}; color: {COLORS['white']}; padding: 10px 12px;
        font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }}
  td {{ padding: 11px 12px; border-bottom: 1px solid {COLORS['light_gray']}; font-size: 14px; vertical-align: top; }}
  tr:last-child td {{ border-bottom: none; }}
  .site {{ font-weight: bold; color: {COLORS['navy']}; }}
  .dot {{ display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 7px; }}
  .biz {{ font-weight: normal; color: {COLORS['mid_gray']}; font-size: 12px; }}
  .score {{ font-weight: bold; font-size: 16px; }}
  .chip {{ display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px;
           font-family: -apple-system, Arial, sans-serif; margin: 1px 2px; white-space: nowrap; }}
  .sev-critical {{ background: #fef2f2; color: {COLORS['red']}; }}
  .sev-high {{ background: #fff5f0; color: {COLORS['amber']}; }}
  .sev-medium {{ background: #fffbeb; color: {COLORS['gold']}; }}
  .sev-low {{ background: #f0f9f4; color: {COLORS['green']}; }}
  .sev-info {{ background: #eff6ff; color: {COLORS['navy']}; }}
  .sev-none {{ background: {COLORS['light_gray']}; color: {COLORS['mid_gray']}; }}
  .issue-title {{ font-weight: bold; }}
  .issue-sites {{ color: {COLORS['mid_gray']}; font-size: 13px; }}
  footer {{ color: {COLORS['mid_gray']}; font-size: 12px; text-align: center; margin-top: 40px; }}
</style>
</head>
<body>
<header>
  <div class="wrap" style="padding:0">
    <h1>SEO Portfolio Dashboard</h1>
    <div class="meta">{portfolio['site_count']} sites · generated {generated}</div>
  </div>
</header>
<div class="wrap">
  <div class="cards">
    <div class="card"><div class="big">{portfolio['site_count']}</div><div class="lbl">Sites</div></div>
    <div class="card"><div class="big" style="color:{_score_color(avg)}">{avg_txt}</div><div class="lbl">Avg health</div></div>
    <div class="card"><div class="big">{portfolio['actionable_total']}</div><div class="lbl">Actionable issues</div></div>
    <div class="card" style="flex:2 1 260px"><div class="lbl" style="margin-bottom:6px">Findings by severity</div>{totals_chips}</div>
  </div>

  <h2>Sites, worst first</h2>
  <p class="sub">Ranked by health score, then by open Critical/High/Medium issues.</p>
  <table>
    <thead><tr><th>Site</th><th>Score</th><th>Δ</th><th>Issues</th><th>Findings</th></tr></thead>
    <tbody>{''.join(site_rows)}</tbody>
  </table>

  {shared_section}

  <footer>Claude SEO portfolio view · scores and findings read from each site's audit-data.json</footer>
</div>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Aggregate many SEO audits into one dashboard.")
    parser.add_argument("paths", nargs="*", metavar="DIR",
                        help="audit directories or audit-data.json files")
    parser.add_argument("--scan", metavar="ROOT",
                        help="find every */audit-data.json under ROOT")
    parser.add_argument("--output", default="portfolio.html", metavar="FILE",
                        help="HTML dashboard path (default: portfolio.html)")
    parser.add_argument("--json", dest="json_path", metavar="FILE",
                        help="aggregate JSON path (default: portfolio.json beside the HTML)")
    parser.add_argument("--previous", metavar="FILE",
                        help="a prior portfolio.json to compute per-site score deltas")
    args = parser.parse_args(argv)

    try:
        inputs = discover_inputs(args.paths, args.scan)
        if not inputs:
            raise PortfolioError("no audits given; pass audit directories or --scan ROOT")
        previous = None
        if args.previous:
            with open(args.previous, encoding="utf-8") as handle:
                previous = json.load(handle)
        sites = [load_audit(path) for path in inputs]
    except (PortfolioError, OSError, ValueError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, indent=2))
        return 2

    portfolio = build_portfolio(sites, previous)

    json_path = args.json_path or os.path.join(os.path.dirname(os.path.abspath(args.output)), "portfolio.json")
    with open(json_path, "w", encoding="utf-8") as handle:
        json.dump(portfolio, handle, indent=2)
        handle.write("\n")
    with open(args.output, "w", encoding="utf-8") as handle:
        handle.write(render_html(portfolio))

    print(json.dumps({
        "status": "ok",
        "sites": portfolio["site_count"],
        "average_health_score": portfolio["average_health_score"],
        "actionable_total": portfolio["actionable_total"],
        "shared_issues": len(portfolio["shared_issues"]),
        "html": os.path.abspath(args.output),
        "json": os.path.abspath(json_path),
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
