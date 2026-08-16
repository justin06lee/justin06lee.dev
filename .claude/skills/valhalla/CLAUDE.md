# Claude SEO: Universal SEO Analysis Skill

## Project Overview

This repository contains **Claude SEO**, a Tier 4 Claude Code skill for comprehensive
SEO analysis across all industries. It follows the Agent Skills open standard and the
3-layer architecture (directive, orchestration, execution). 26 sub-skills (22 core +
1 orchestrator + 1 framework integration + 2 extension mirrors), 18 sub-agents (15 core +
1 framework integration + 2 extension mirrors), and an extensible reference
system cover technical SEO, content quality,
schema markup, image optimization, sitemap architecture, AI search optimization,
local SEO (GBP, citations, reviews, map pack), maps intelligence, semantic topic
clustering, search experience optimization (SXO), SEO drift monitoring, e-commerce
SEO, and international SEO with cultural adaptation profiles.

### Valhalla: the single-command front door

A root `SKILL.md` (`name: valhalla`) is the one-command entry point. Because a
root `SKILL.md` makes the whole repository install as **one** skill, two install
shapes exist from the same tree:

- **`bmo add justin06lee/valhalla.md`** (bare) installs a single `valhalla`
  skill: the whole repo, minus the `.bmoignore`d dev trees, lands under
  `~/.claude/skills/valhalla/`. The 26 discipline skills come along as nested
  *knowledge* Valhalla loads on demand — they are **not** registered as separate
  `/seo …` commands. The user gets exactly one command, `/valhalla`, which runs
  the full autopilot (it delegates to `skills/seo-everything/`).
- **`bmo add …/skills --all`** or a **plugin install** registers the 26
  discipline skills individually (`/seo audit`, `/seo schema`, …). The plugin
  loader ignores the root `SKILL.md` because a `skills/` directory is present.

Keep both working: the root `SKILL.md` is a thin director that reads the internal
skills; the discipline skills remain independently usable. When editing routing
or counts, update both the root front door and the `seo` orchestrator.

## Architecture

```
claude-seo/
  SKILL.md                           # Valhalla: root single-skill front door (/valhalla)
  .bmoignore                         # Keeps a bmo single-skill install lean
  CLAUDE.md                          # Project instructions (this file)
  CONTRIBUTORS.md                    # Community credits (Pro Hub Challenge)
  AGENTS.md                          # Multi-platform agent instructions (Cursor, Antigravity)
  .claude-plugin/
    plugin.json                    # Plugin manifest (name: valhalla, v3.0.0)
    marketplace.json               # Marketplace catalog for distribution
  skills/                            # 26 sub-skills (auto-discovered; Valhalla drives these internally)
    seo/                           # Main orchestrator skill + shared runtime
      SKILL.md                     # Entry point, routing table, core rules
      references/                  # On-demand knowledge files (13 files)
      agents/                      # 18 subagents (declared in plugin.json)
      scripts/                     # 53 Python execution scripts
      bin/claude-seo               # Runtime launcher
      schema/                      # Schema.org JSON-LD templates
      pdf/ data/                   # Bundled reference + update data
      requirements.txt             # Python dependencies
    seo-everything/                # Autonomous full-project SEO pass (perceive, fan out, apply)
      SKILL.md
      references/                # Stack adapters, relevance matrix, apply safety
    seo-audit/SKILL.md            # Full site audit with parallel agents
    seo-page/SKILL.md            # Deep single-page analysis
    seo-technical/SKILL.md       # Technical SEO (9 categories)
    seo-content/SKILL.md         # E-E-A-T and content quality
    seo-content-brief/SKILL.md   # Content brief generation
    seo-schema/SKILL.md          # Schema.org markup detection/generation
    seo-sitemap/SKILL.md         # XML sitemap analysis/generation
    seo-images/SKILL.md          # Image optimization analysis
    seo-geo/SKILL.md             # AI search / GEO optimization
    seo-local/SKILL.md           # Local SEO (GBP, citations, reviews, map pack)
    seo-maps/SKILL.md            # Maps intelligence (geo-grid, GBP audit, reviews, competitors)
    seo-plan/SKILL.md            # Strategic SEO planning
    seo-flow/SKILL.md            # FLOW framework integration
    seo-programmatic/SKILL.md    # Programmatic SEO at scale
    seo-competitor-pages/SKILL.md # Competitor comparison pages
    seo-hreflang/SKILL.md       # International SEO / hreflang
    seo-google/                  # Google SEO APIs
      SKILL.md
      references/                # API reference files (11 files)
    seo-backlinks/SKILL.md      # Backlink profile analysis
    seo-cluster/                 # Semantic topic clustering (v1.9.0, by Lutfiya Miller)
      SKILL.md
      references/                # Clustering methodology, architecture, workflow
      templates/                 # cluster-map.html interactive visualization
    seo-sxo/                     # Search Experience Optimization (v1.9.0, by Florian Schmitz)
      SKILL.md
      references/                # Page-type taxonomy, user stories, personas, wireframes
    seo-drift/                   # SEO drift monitoring (v1.9.0, by Dan Colta)
      SKILL.md
      references/                # Comparison rules (17 rules, 3 severity levels)
    seo-ecommerce/               # E-commerce SEO (v1.9.0, by Matej Marjanovic)
      SKILL.md
      references/                # Marketplace API endpoints
    seo-dataforseo/SKILL.md     # Live SEO data via DataForSEO MCP (extension mirror)
    seo-image-gen/              # AI image generation for SEO assets (extension mirror)
      SKILL.md
      references/                # Image gen reference files (7 files)
  skills/seo/agents/               # 18 subagents (declared in .claude-plugin/plugin.json)
    seo-technical.md             # Crawlability, indexability, security
    seo-content.md               # E-E-A-T, readability, thin content
    seo-schema.md                # Structured data validation
    seo-sitemap.md               # Sitemap quality gates
    seo-performance.md           # Core Web Vitals, page speed
    seo-visual.md                # Screenshots, mobile rendering
    seo-geo.md                   # AI crawler access, GEO, citability
    seo-local.md                 # GBP, NAP, citations, reviews, local schema
    seo-maps.md                  # Geo-grid, GBP audit, reviews, competitor radius
    seo-google.md                # Google API analyst (CrUX, GSC, GA4)
    seo-backlinks.md             # Backlink profile analyst (Moz, Bing, CC, verify)
    seo-dataforseo.md            # DataForSEO data analyst
    seo-image-gen.md             # SEO image audit analyst
    seo-cluster.md               # Semantic clustering analysis
    seo-sxo.md                   # Search experience optimization
    seo-drift.md                 # SEO drift monitoring
    seo-ecommerce.md             # E-commerce SEO analysis
    seo-flow.md                  # FLOW framework integration
  hooks/                           # Quality gate hooks (plugin root: auto-discovered there)
    hooks.json                   # PostToolUse schema validation
  skills/seo/scripts/              # 53 Python execution scripts
    google_auth.py               # Credential management (OAuth, SA, API key, 4-tier detection)
    backlinks_auth.py            # Backlink API credential management (Moz, Bing)
    moz_api.py                   # Moz Link Explorer API (DA/PA, spam, domains, anchors)
    bing_webmaster.py            # Bing Webmaster Tools API (registered-site links/comparison)
    commoncrawl_graph.py         # Common Crawl web graph parser (PageRank, in-degree)
    verify_backlinks.py          # Backlink existence verification crawler
    pagespeed_check.py           # PSI v5 + CrUX API
    crux_history.py              # CrUX History API (25-week trends)
    gsc_query.py                 # Search Console (queries, pages, sitemaps, sites)
    gsc_inspect.py               # URL Inspection (single + batch)
    indexing_notify.py           # Indexing API v3 (URL_UPDATED/URL_DELETED)
    ga4_report.py                # GA4 organic traffic reports
    google_report.py             # PDF/HTML report generator (WeasyPrint + matplotlib)
    portfolio_report.py          # Cross-site portfolio dashboard (aggregates {domain}-audit/ artifacts)
    youtube_search.py            # YouTube Data API v3
    nlp_analyze.py               # Cloud Natural Language API
    keyword_planner.py           # Google Ads Keyword Planner
    fetch_page.py                # Page fetcher with UA rotation
    parse_html.py                # HTML parser for SEO elements
    capture_screenshot.py        # Playwright screenshots
    analyze_visual.py            # Visual analysis helper
    drift_baseline.py            # SEO drift baseline capture (SQLite)
    drift_compare.py             # SEO drift comparison engine (17 rules)
    drift_report.py              # SEO drift HTML report generator
    drift_history.py             # SEO drift history query
    drift_ci.py                  # Non-interactive multi-URL drift runner for schedules/CI
    dataforseo_costs.py          # DataForSEO cost estimation and budget tracking
    dataforseo_merchant.py       # Google Shopping / Amazon data fetching
    dataforseo_normalize.py      # DataForSEO response normalization utility
    sync_flow.py                 # FLOW prompt library sync (GitHub API, CC BY 4.0 headers, --dry-run, --ref)
    url_safety.py                # Canonical URL/SSRF safety module (validate, DNS-pin, safe fetch)
    render_page.py               # Shared headless renderer (SPA-aware, scroll/network settle, Playwright)
    lcp_subparts.py              # LCP subparts breakdown via CrUX API
    preload_check.py             # Speculation Rules / bfcache / prerender / preload detector
    agent_ux_check.py            # Agent-friendly page auditor
    content_quality.py           # QRG-aligned content quality detector
    content_humanize.py          # AI-pattern remover (rewrites AI-typical phrasing)
    content_verify.py            # Claim extractor + citation-gap detector
    schema_generate.py           # JSON-LD generators for high-leverage v2 schema types
    seo_inventory.py             # Deterministic codebase SEO scanner (framework, routes, surface, business type)
    schema_ecommerce_validate.py # Product schema validator (merchant-listing requirements)
    iptc_ai_label.py             # IPTC DigitalSourceType audit/injection for AI imagery
    parasite_risk.py             # Parasite-SEO risk scanner
    gbp_deprecation_lint.py      # GBP feature-deprecation linter
    domain_history.py            # Expired-domain heritage check
    seo_updates.py               # Primary-source Google updates query tool
    indexnow_submit.py           # IndexNow submitter
    ucp_check.py                 # UCP (Universal Commerce Protocol) profile auditor
    unlighthouse_run.py          # Unlighthouse CLI wrapper (site-wide Lighthouse)
    validate_backlink_report.py  # Backlink report validation
    portability_check.py         # Cross-platform portability lint for SKILL.md files
    consistency_check.py         # Reference-graph gate: dead refs, routing, lock, orphans
    release_sign.py              # SHA-256 manifest generator for release signing
    verify_release.py            # Verify checkout integrity against a release manifest
    mobile_analysis.py           # Mobile rendering analysis (gitignored, dev-only)
  skills/seo/schema/               # Schema.org JSON-LD templates
  extensions/                      # Optional add-on install helpers
    dataforseo/                  # DataForSEO MCP install scripts
    firecrawl/                   # Firecrawl MCP install scripts
    banana/                      # Banana MCP install scripts
    ahrefs/                      # Ahrefs MCP install scripts
    bing-webmaster/              # Bing Webmaster and IndexNow install scripts
    profound/                    # Profound MCP install scripts
    seranking/                   # SE Ranking MCP install scripts
    unlighthouse/                # Unlighthouse install scripts
  docs/                            # Extended documentation
```

## Commands

| Command | Use Case |
|---------|----------|
| `/seo everything [path]` | Autonomous full-project SEO pass: perceive, fan out, apply on a branch |
| `/seo audit <url>` | Full website audit with parallel subagents |
| `/seo page <url>` | Single page analysis |
| `/seo technical <url>` | Technical SEO across 9 categories |
| `/seo content <url>` | E-E-A-T and content quality |
| `/seo content-brief <topic>` | Detailed content brief: keywords, outline, internal links |
| `/seo schema <url>` | Schema markup detection, validation, generation |
| `/seo sitemap <url>` | Sitemap validation |
| `/seo sitemap generate` | Create new sitemap with industry templates |
| `/seo images <url>` | Image optimization |
| `/seo geo <url>` | AI search optimization (GEO) |
| `/seo local <url>` | Local SEO (GBP, citations, reviews) |
| `/seo maps [command]` | Maps intelligence (geo-grid, GBP audit, competitors) |
| `/seo backlinks <url>` | Backlink profile analysis |
| `/seo cluster <seed>` | SERP-based semantic clustering |
| `/seo sxo <url>` | Search Experience Optimization |
| `/seo drift baseline\|compare\|history\|ci <url>` | SEO drift monitoring (+ CI/scheduled runner) |
| `/seo ecommerce <url>` | E-commerce SEO |
| `/seo hreflang [url]` | Hreflang and international SEO |
| `/seo plan <type>` | Strategic planning by industry |
| `/seo programmatic [url\|plan]` | Programmatic SEO analysis |
| `/seo competitor-pages [url\|generate]` | Competitor comparison pages |
| `/seo flow [stage] [url\|topic]` | FLOW framework prompts |
| `/seo google [command] [url]` | Google SEO APIs (GSC, PSI, CrUX, GA4) |
| `/seo dataforseo [command]` | Live SEO data (extension) |
| `/seo image-gen [use-case] <desc>` | AI image generation (extension) |
| `/seo firecrawl [command] <url>` | Full-site crawling (extension) |
| `/seo ahrefs [command] <url>` | Backlinks, organic keywords, and content data via the official Ahrefs MCP (extension) |
| `/seo seranking [command]` | AI Share-of-Voice across ChatGPT, Gemini, Perplexity, AI Overviews, AI Mode (extension) |
| `/seo profound [command]` | LLM citation tracking with time-series data (extension) |
| `/seo bing [command] <url>` | Bing Webmaster Tools + IndexNow URL submission (extension) |
| `/seo unlighthouse <url>` | Multi-page Lighthouse runner, runs locally (extension) |

## Development Rules

- Keep SKILL.md files under 500 lines / 5000 tokens
- Reference files should be focused and under 200 lines
- Scripts must have docstrings, CLI interface, and JSON output
- Follow kebab-case naming for all skill directories
- Agents invoked via Agent tool, never via Bash
- Bundled tools run through `claude-seo run`; plugin state uses `CLAUDE_PLUGIN_DATA`
- Manual Python dependencies install into `~/.claude/skills/seo/.venv/`
- Test with `python3 -m pytest tests/` after changes (if applicable)

## Security Rules

- **Never commit credentials**: `.env`, `client_secret*.json`, `oauth-token.json`, `service_account*.json` are all in `.gitignore`
- **URL validation**: All scripts that connect to user-supplied URLs must use `scripts/url_safety.py` (`validate_url_strict()` plus the pinned safe request helpers). This blocks private IPs, loopback, metadata endpoints, redirect rebinding, and DNS rebinding.
- **OAuth tokens**: Never store `client_secret` in the token file. Read it from the client_secret.json file at runtime.
- **No hardcoded paths**: Use `os.path.dirname(os.path.abspath(__file__))` for relative paths, never a user-specific absolute path
- **Config location**: `~/.config/claude-seo/google-api.json` and `~/.config/claude-seo/backlinks-api.json` (user-space, not in repo)

## Report Generation Rules

- **All SEO reports must use `scripts/google_report.py`** as the canonical report generator
- **Dependencies**: `matplotlib>=3.8.0` (charts) + `weasyprint>=61.0` (HTML-to-PDF), both in `requirements.txt`
- **Format**: A4 PDF via WeasyPrint + matplotlib charts at 200 DPI
- **Style**: Clean white title page with navy (#1e3a5f) accent, Times New Roman body font
- **Color palette**: Navy #1e3a5f (headers), dark gold #b8860b (accents), forest green #2d6a4f (pass), warm amber #d4740e (warnings), deep red #c53030 (fail), warm cream #faf9f7 (backgrounds)
- **Structure**: Title page → TOC with scores → Executive Summary → Data sections → Recommendations → Methodology
- **Charts**: 85% width, max-height 120mm, figure captions on every chart, saved to `charts/` at 200 DPI
- **No `page-break-inside: avoid`** on any element (causes white gaps in WeasyPrint)
- **Post-generation review**: `_review_pdf()` runs automatically, checking for empty images, thin sections, duplicates
- **Before presenting any PDF to the user**: verify the review passes (`"status": "PASS"`)
- **Cross-skill enforcement**: After completing ANY analysis command (audit, page, technical, content, schema, geo, local, maps), offer: "Generate a PDF report? Use `/seo google report`"
- **Google logo** appears on title page when using Google API data ("Powered by Google APIs")

## Ecosystem

Part of the Claude Code skill family:
- [Claude Banana](https://github.com/AgriciDaniel/banana-claude) -- standalone image gen (bundled as extension here)
- [Claude Blog](https://github.com/AgriciDaniel/claude-blog) -- companion blog engine, consumes SEO findings
- [AI Marketing Claude](https://github.com/zubair-trabzada/ai-marketing-claude) -- community marketing suite (copy, emails, ads, funnels, CRO)

## Key Principles

1. **Progressive Disclosure**: Metadata always loaded, instructions on activation, resources on demand
2. **Industry Detection**: Auto-detect SaaS, e-commerce, local, publisher, agency
3. **Parallel Execution**: Full audits spawn up to 15 subagents simultaneously
4. **Extension System**: DataForSEO, Firecrawl, Banana, Ahrefs, SE Ranking, Profound, Bing Webmaster, and Unlighthouse extensions

## Repository Topology

This repository is a **fork** of [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo),
distributed at `justin06lee/valhalla.md`. It has one remote.

| Remote | URL | Role |
|---|---|---|
| `origin` | `https://github.com/justin06lee/valhalla.md` | The only remote. Development and releases both live here. |

Upstream is not configured as a remote. To pull upstream changes, add it
explicitly and merge:

```bash
git remote add upstream https://github.com/AgriciDaniel/claude-seo
git fetch upstream
git merge upstream/main
```

Expect conflicts around layout: this fork moved the runtime into
`skills/seo/` (see "Architecture"), so upstream changes to `scripts/`,
`agents/`, or `bin/` land at paths that no longer exist here. Resolve by
applying the upstream change to the corresponding `skills/seo/` path.

### Workflow

- Work on a branch, merge into `main` with `--no-ff`, tag the feature.
- Releases are tagged `vX.Y.Z` and pushed to `origin` along with `main`.
- `install.sh` and `install.ps1` pin `REPO_TAG` to the current release, and
  `tests/test_manifest_consistency.py` fails if that tag drifts from
  `plugin.json`. Bump both in the release commit, then tag.

### Attribution

The MIT license, the upstream copyright in every `LICENSE.txt`, `CITATION.cff`
authorship, and `CONTRIBUTORS.md` credits are upstream's and stay unchanged.
Only distribution pointers (repository URLs, marketplace slug) name this fork.

## Release Blog Post

After cutting a new release (git tag + `gh release create`), run:

```
/release-blog
```

This generates a blog post on https://claude-seo.md/blog/, handles cover image generation, SEO metadata, FAQ schema, internal linking, sitemap/llms.txt updates, Vercel deployment, and Google indexing.
