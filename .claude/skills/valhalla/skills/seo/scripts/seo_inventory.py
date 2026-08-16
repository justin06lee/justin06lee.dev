#!/usr/bin/env python3
"""Deterministic SEO inventory of a codebase, for the `/seo everything` autopilot.

The autopilot needs to perceive a project before it can decide which SEO
disciplines apply and where their fixes belong. Guessing from a chat with the
model is unreliable; this scans the source tree with fixed rules and emits JSON
the orchestrator plans from:

  - framework / static-site generator and its routing model
  - route/page files and their count
  - which SEO surfaces already exist (sitemap, robots, JSON-LD, meta description,
    canonical, hreflang, Open Graph, llms.txt)
  - business-type signals inferred from paths and content

It is stdlib-only and read-only: it never edits, fetches, or executes anything.

Usage:
    claude-seo run seo_inventory.py <path> [--json]
    claude-seo run seo_inventory.py .              # current project
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

# Directories that never contain hand-authored source worth scanning. Skipping
# them keeps the walk bounded on real repos and avoids build output.
SKIP_DIRS = {
    ".git", "node_modules", ".next", ".nuxt", ".svelte-kit", ".astro",
    "dist", "build", "out", "public/build", "__pycache__", ".venv", "venv",
    ".cache", "coverage", ".turbo", ".vercel", ".output", "vendor",
}

# Cap the walk so a monorepo cannot make this run unbounded.
MAX_FILES_SCANNED = 20000
# Only sniff content from files up to this size (SEO surface lives in source,
# not in large data blobs).
MAX_SNIFF_BYTES = 200_000

ROUTE_EXTS = {".html", ".htm", ".astro", ".vue", ".svelte", ".jsx", ".tsx",
              ".md", ".mdx", ".liquid", ".njk", ".erb", ".php"}

# Signals that a file participates in routing, per framework convention.
_NEXT_APP_PAGE = re.compile(r"(^|/)(page|route)\.(jsx?|tsx?)$")
_NEXT_PAGES = re.compile(r"(^|/)pages/.+\.(jsx?|tsx?|mdx?)$")


def _read(path: str, limit: int = MAX_SNIFF_BYTES) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return handle.read(limit)
    except OSError:
        return ""


def _load_json(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def detect_framework(root: str) -> dict:
    """Identify the framework/SSG and its routing model from config + deps."""
    pkg = _load_json(os.path.join(root, "package.json"))
    deps = {}
    for key in ("dependencies", "devDependencies"):
        section = pkg.get(key)
        if isinstance(section, dict):
            deps.update(section)

    def has(name: str) -> bool:
        return name in deps

    def any_file(*names: str) -> bool:
        return any(os.path.exists(os.path.join(root, n)) for n in names)

    # Order matters: meta-frameworks before the view libraries they build on.
    if has("next") or any_file("next.config.js", "next.config.mjs", "next.config.ts"):
        router = "app" if os.path.isdir(os.path.join(root, "app")) or \
            os.path.isdir(os.path.join(root, "src", "app")) else "pages"
        return {"framework": "next", "router": router, "language": "javascript"}
    if has("nuxt") or has("nuxt3") or any_file("nuxt.config.js", "nuxt.config.ts"):
        return {"framework": "nuxt", "router": "pages", "language": "javascript"}
    if has("astro") or any_file("astro.config.mjs", "astro.config.ts", "astro.config.js"):
        return {"framework": "astro", "router": "src/pages", "language": "javascript"}
    if has("@sveltejs/kit") or any_file("svelte.config.js"):
        return {"framework": "sveltekit", "router": "src/routes", "language": "javascript"}
    if has("gatsby") or any_file("gatsby-config.js", "gatsby-config.ts"):
        return {"framework": "gatsby", "router": "src/pages", "language": "javascript"}
    if any_file("hugo.toml", "hugo.yaml", "config.toml") and os.path.isdir(os.path.join(root, "content")):
        return {"framework": "hugo", "router": "content", "language": "go-templates"}
    if any_file("_config.yml") and os.path.isdir(os.path.join(root, "_posts")):
        return {"framework": "jekyll", "router": "_posts", "language": "ruby"}
    if has("react") or has("vue") or has("vite"):
        return {"framework": "spa", "router": "unknown", "language": "javascript"}
    # No JS toolchain: treat as a static HTML site if any .html exists.
    return {"framework": "static-html", "router": "filesystem", "language": "html"}


def _iter_files(root: str):
    count = 0
    for dirpath, dirnames, filenames in os.walk(root):
        # Prune skipped directories in place so os.walk does not descend them.
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for name in filenames:
            count += 1
            if count > MAX_FILES_SCANNED:
                return
            yield os.path.join(dirpath, name)


def enumerate_routes(root: str, framework: dict) -> dict:
    """Count route/page files, using the framework's routing convention."""
    routes = []
    fw = framework["framework"]
    for path in _iter_files(root):
        rel = os.path.relpath(path, root)
        ext = os.path.splitext(path)[1].lower()
        is_route = False
        if fw == "next" and framework["router"] == "app":
            is_route = bool(_NEXT_APP_PAGE.search(rel.replace(os.sep, "/")))
        elif fw == "next":
            is_route = bool(_NEXT_PAGES.search(rel.replace(os.sep, "/")))
        elif fw in ("astro", "nuxt", "sveltekit", "gatsby"):
            router = framework["router"]
            is_route = rel.replace(os.sep, "/").startswith(router + "/") and ext in ROUTE_EXTS
        elif fw in ("hugo", "jekyll"):
            is_route = ext in {".md", ".markdown", ".html"}
        elif fw == "static-html":
            is_route = ext in {".html", ".htm"}
        else:  # spa / unknown
            is_route = ext in {".html", ".htm"} or "/pages/" in rel.replace(os.sep, "/")
        if is_route:
            routes.append(rel)
    routes.sort()
    return {"count": len(routes), "sample": routes[:25]}


# SEO surfaces we look for, and how to recognize them.
_LD_JSON = re.compile(r'application/ld\+json', re.I)
_META_DESC = re.compile(r'<meta[^>]+name=["\']description["\']', re.I)
_META_DESC_NEXT = re.compile(r'\bdescription\s*:', re.I)  # framework metadata objects
_CANONICAL = re.compile(r'rel=["\']canonical["\']|canonical\s*:', re.I)
_HREFLANG = re.compile(r'hreflang', re.I)
_OG = re.compile(r'property=["\']og:|openGraph', re.I)


def inventory_seo_surface(root: str, framework: dict) -> dict:
    """Report which SEO surfaces already exist, so the plan only adds what's missing."""
    surface = {
        "sitemap": False, "robots": False, "llms_txt": False,
        "json_ld": False, "meta_description": False, "canonical": False,
        "hreflang": False, "open_graph": False,
    }
    # File-level markers.
    for rel in ("sitemap.xml", "public/sitemap.xml", "static/sitemap.xml",
                "app/sitemap.ts", "app/sitemap.js", "src/pages/sitemap.xml.ts"):
        if os.path.exists(os.path.join(root, rel)):
            surface["sitemap"] = True
    for rel in ("robots.txt", "public/robots.txt", "static/robots.txt",
                "app/robots.ts", "app/robots.js"):
        if os.path.exists(os.path.join(root, rel)):
            surface["robots"] = True
    for rel in ("llms.txt", "public/llms.txt", "static/llms.txt"):
        if os.path.exists(os.path.join(root, rel)):
            surface["llms_txt"] = True

    pkg = _load_json(os.path.join(root, "package.json"))
    dep_str = json.dumps(pkg.get("dependencies", {})) + json.dumps(pkg.get("devDependencies", {}))
    if any(s in dep_str for s in ("next-sitemap", "@astrojs/sitemap", "gatsby-plugin-sitemap")):
        surface["sitemap"] = True

    # Content-level markers: sniff a bounded set of source files.
    sniffed = 0
    for path in _iter_files(root):
        ext = os.path.splitext(path)[1].lower()
        if ext not in ROUTE_EXTS and os.path.basename(path) not in ("layout.tsx", "layout.jsx", "app.vue", "__layout.svelte"):
            continue
        if sniffed >= 400:
            break
        sniffed += 1
        text = _read(path)
        if not text:
            continue
        if _LD_JSON.search(text):
            surface["json_ld"] = True
        if _META_DESC.search(text) or _META_DESC_NEXT.search(text):
            surface["meta_description"] = True
        if _CANONICAL.search(text):
            surface["canonical"] = True
        if _HREFLANG.search(text):
            surface["hreflang"] = True
        if _OG.search(text):
            surface["open_graph"] = True
    return surface


# Business-type signals: path fragments and content keywords, weighted by how
# strongly each points at a vertical.
_SIGNALS = {
    "ecommerce": [r"/products?/", r"/cart", r"/checkout", r"/collections?/",
                  r"add[ -]?to[ -]?cart", r"\bskus?\b", r"\bshopify\b", r"\bstripe\b"],
    "local": [r"/locations?/", r"/contact", r"opening hours", r"\baddress\b",
              r"\bphone\b", r"service area", r"\bgoogle maps\b"],
    "publisher": [r"/blog/", r"/articles?/", r"/posts?/", r"/news/",
                  r"\bauthor\b", r"published", r"\bbyline\b"],
    "saas": [r"/pricing", r"/features", r"/integrations", r"free trial",
             r"sign ?up", r"/docs?/", r"\bapi\b"],
    "docs": [r"/docs?/", r"/guide", r"/reference", r"getting started"],
}


def infer_business_type(root: str) -> dict:
    """Score vertical signals across paths and a bounded content sample."""
    scores = {k: 0 for k in _SIGNALS}
    corpus_parts = []
    sniffed = 0
    for path in _iter_files(root):
        rel = os.path.relpath(path, root).replace(os.sep, "/").lower()
        corpus_parts.append(rel)
        ext = os.path.splitext(path)[1].lower()
        if ext in ROUTE_EXTS and sniffed < 300:
            sniffed += 1
            corpus_parts.append(_read(path, 20_000).lower())
    corpus = "\n".join(corpus_parts)
    for vertical, patterns in _SIGNALS.items():
        for pat in patterns:
            if re.search(pat, corpus):
                scores[vertical] += 1
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    primary = ranked[0][0] if ranked[0][1] > 0 else "general"
    return {"primary": primary, "scores": scores}


def build_inventory(root: str) -> dict:
    root = os.path.abspath(os.path.expanduser(root))
    if not os.path.isdir(root):
        return {"status": "error", "error": f"not a directory: {root}"}
    framework = detect_framework(root)
    routes = enumerate_routes(root, framework)
    surface = inventory_seo_surface(root, framework)
    business = infer_business_type(root)

    # Which disciplines are missing a surface they should have — the plan's
    # starting point. Kept here so the relevance decision has a deterministic base.
    gaps = [name for name, present in (
        ("sitemap", surface["sitemap"]),
        ("robots", surface["robots"]),
        ("json_ld", surface["json_ld"]),
        ("meta_description", surface["meta_description"]),
        ("canonical", surface["canonical"]),
        ("open_graph", surface["open_graph"]),
    ) if not present]

    return {
        "status": "ok",
        "root": root,
        "framework": framework,
        "routes": routes,
        "seo_surface": surface,
        "surface_gaps": gaps,
        "business_type": business,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Deterministic SEO inventory of a codebase.")
    parser.add_argument("path", nargs="?", default=".", help="project directory (default: .)")
    parser.add_argument("--json", action="store_true", help="emit JSON (default for machine use)")
    args = parser.parse_args(argv)

    inventory = build_inventory(args.path)
    print(json.dumps(inventory, indent=2))
    return 0 if inventory.get("status") == "ok" else 2


if __name__ == "__main__":
    sys.exit(main())
