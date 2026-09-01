#!/usr/bin/env python3
"""Repository consistency checker: dead references, orphans, routing, lock integrity.

Complements tests/test_manifest_consistency.py (counts and version triangulation) with
reference-graph checks that no other tool covers:

1. ``references/X`` mentions in SKILL.md and agent files resolve via the fallback chain
   own dir -> shared ``skills/seo/references/`` -> any skill's references dir (cross-skill
   resolutions are reported as info, dead ones as errors).
2. ``research/X.md`` path mentions exist.
3. ``scripts/X.py`` mentions resolve PATH-AWARE: the core runtime at
   ``skills/seo/scripts/`` first, then the
   enclosing extension's ``scripts/`` dir for files under ``extensions/<name>/``. Prose
   keeps the skill-relative ``scripts/X.py`` form because that is where the files sit
   once the skill is installed. A bare
   basename existing somewhere else in the tree does NOT count (this exact bug hid dead
   ``scripts/presets.py`` invocations before the 2026-07 full review).
4. Routing tables in ``skills/seo/SKILL.md`` and ``docs/COMMANDS.md`` agree with each
   other and with the skill directories on disk.
5. ``agents/<name>.md`` path mentions exist under ``skills/seo/agents/``
   (``seo-newagent`` doc example whitelisted).
6. ``skills/seo-flow/references/flow-prompts.lock`` SHA-256 integrity.
7. Orphan-file candidates (tracked files whose basename is mentioned nowhere else);
   reported as warnings, never errors.

Usage:
    claude-seo run consistency_check.py [--json] [--strict]

Exit codes: 0 = no errors (warnings allowed unless --strict), 1 = errors found.
"""
import argparse
import glob
import hashlib
import json
import os
import re
import subprocess
import sys

def _repo_root() -> str:
    """Locate the repository root from inside the seo skill.

    The reference graph spans every skill, agent, and doc, so this gate needs
    the repository root, not the skill root the runtime resolves.
    """
    here = os.path.dirname(os.path.abspath(__file__))
    candidate = here
    while True:
        if os.path.isfile(os.path.join(candidate, ".claude-plugin", "plugin.json")):
            return candidate
        parent = os.path.dirname(candidate)
        if parent == candidate:
            return os.path.dirname(here)
        candidate = parent


REPO = _repo_root()

ORPHAN_SCRIPT_WHITELIST = {
    "portability_check.py", "agent_ux_check.py", "gbp_deprecation_lint.py",
    "release_sign.py", "verify_release.py", "consistency_check.py",
}
GENERIC_BASENAMES = {"README.md", "SKILL.md", "__init__.py", "LICENSE", "LICENSE.txt",
                     "plugin.json", "marketplace.json", "hooks.json"}
DOC_EXAMPLE_AGENTS = {"seo-newagent"}
LOCK_PATH = "skills/seo-flow/references/flow-prompts.lock"
RUNTIME_UTILITY_COMMANDS = {"setup", "doctor"}


def tracked_files():
    out = subprocess.run(["git", "-C", REPO, "ls-files"],
                         capture_output=True, text=True, check=True).stdout
    return [l for l in out.splitlines() if l.strip()]


def read(rel, _cache={}):
    if rel not in _cache:
        try:
            with open(os.path.join(REPO, rel), encoding="utf-8", errors="replace") as fh:
                _cache[rel] = fh.read()
        except OSError:
            _cache[rel] = ""
    return _cache[rel]


def extension_root(rel):
    m = re.match(r"(extensions/[^/]+)/", rel)
    return m.group(1) if m else None


CORE_SKILL = "skills/seo"
CORE_SCRIPTS = f"{CORE_SKILL}/scripts"
CORE_AGENTS = f"{CORE_SKILL}/agents"
SELF_DOC = {f"{CORE_SCRIPTS}/consistency_check.py", "tests/test_consistency_check.py"}


def check_references(files, md):
    ref_pat = re.compile(r'references/([A-Za-z0-9_\-./]+\.(?:md|html|json|txt|ya?ml))')
    errors, infos = [], []
    carriers = [f for f in md if (f.startswith(("skills/", "extensions/")) and f.endswith("SKILL.md"))
                or f.startswith(f"{CORE_AGENTS}/")]
    for f in carriers:
        base = os.path.dirname(f)
        for m in sorted(set(ref_pat.findall(read(f)))):
            candidates = [os.path.join(base, "references", m),
                          os.path.join(f"{CORE_SKILL}/references", m)]
            if any(os.path.exists(os.path.join(REPO, c)) for c in candidates):
                continue
            hits = (glob.glob(os.path.join(REPO, "skills", "*", "references", m))
                    + glob.glob(os.path.join(REPO, "extensions", "*", "skills", "*", "references", m)))
            if hits:
                infos.append(f"{f}: references/{m} resolves cross-skill to "
                             f"{os.path.relpath(hits[0], REPO)}")
            else:
                errors.append(f"{f}: dead reference references/{m}")
    return errors, infos


def check_research_refs(files, texts):
    pat = re.compile(r'research/([A-Za-z0-9_\-]+\.md)')
    errors = []
    for f in texts:
        if f in SELF_DOC:
            continue
        for m in sorted(set(pat.findall(read(f)))):
            if not os.path.exists(os.path.join(REPO, "research", m)):
                errors.append(f"{f}: dead research ref research/{m}")
    return errors


def check_script_refs(files, texts):
    """Path-aware: scripts/X.py must exist at repo scripts/ or the enclosing extension's.

    The lookbehind skips path-qualified mentions such as
    ``extensions/banana/scripts/edit.py`` (checked via their own full path elsewhere).
    ``research/`` notes, ``CHANGELOG.md``, and ``.github/`` templates are
    historical/example carriers.
    """
    pat = re.compile(r'(?<![\w/])scripts/([A-Za-z0-9_]+\.py)\b')
    errors = []
    mentioned = set()
    for f in texts:
        if f.startswith(("research/", ".github/")) or f == "CHANGELOG.md" or f in SELF_DOC:
            continue
        ext_root = extension_root(f)
        for m in sorted(set(pat.findall(read(f)))):
            mentioned.add(m)
            candidates = [f"{CORE_SCRIPTS}/{m}"]
            if ext_root:
                candidates.insert(0, f"{ext_root}/scripts/{m}")
            if not any(c in files or os.path.isfile(os.path.join(REPO, c)) for c in candidates):
                errors.append(f"{f}: dead script ref scripts/{m} "
                              f"(checked: {', '.join(candidates)})")
    orphans = []
    all_text = "\n".join(read(f) for f in texts)
    for s in sorted(os.path.basename(f) for f in files
                    if f.startswith(f"{CORE_SCRIPTS}/") and f.endswith(".py")):
        if s in ORPHAN_SCRIPT_WHITELIST:
            continue
        others = all_text.count(s) - read(f"{CORE_SCRIPTS}/{s}").count(s)
        if others <= 0:
            orphans.append(f"scripts/{s}: referenced nowhere outside itself")
    return errors, orphans


def check_skill_dir_script_refs(files, texts):
    """Validate scripts invoked through Claude's portable skill-root variable.

    Extension installers place their scripts beside the installed skill. In the
    source tree those scripts live at ``extensions/<name>/scripts``. Core skills
    must carry scripts inside their own skill directory before using this form.
    """
    pat = re.compile(r'\$\{CLAUDE_SKILL_DIR\}/scripts/([A-Za-z0-9_]+\.py)\b')
    errors = []
    for f in texts:
        for script in sorted(set(pat.findall(read(f)))):
            ext_root = extension_root(f)
            if ext_root:
                candidate = f"{ext_root}/scripts/{script}"
            elif f.startswith("skills/"):
                skill_root = "/".join(f.split("/")[:2])
                candidate = f"{skill_root}/scripts/{script}"
            else:
                errors.append(f"{f}: CLAUDE_SKILL_DIR script used outside a skill layout")
                continue
            if candidate not in files and not os.path.isfile(os.path.join(REPO, candidate)):
                errors.append(
                    f"{f}: dead skill-root script {script} (checked: {candidate})"
                )
    return errors


def check_runtime_invocations(texts):
    """Reject cwd-dependent or interpreter-dependent bundled script commands."""
    errors = []
    carriers = [
        f for f in texts
        if f.startswith(("skills/", "extensions/")) and f.endswith(".md")
    ]
    bare = re.compile(
        r"\b(?:python3|python|py\s+-3)\s+[^\n`]*?scripts/[A-Za-z0-9_./-]+\.py"
    )
    runtime = re.compile(r"\bclaude-seo\s+run(?:\s+--extension\s+[a-z0-9-]+)?\s+([A-Za-z0-9_-]+\.py)")
    for f in carriers:
        content = read(f)
        for match in bare.finditer(content):
            errors.append(f"{f}: bare bundled-script invocation: {match.group(0)}")
        for script in sorted(set(runtime.findall(content))):
            if not os.path.isfile(os.path.join(REPO, CORE_SCRIPTS, script)) and not any(
                os.path.isfile(path)
                for path in glob.glob(os.path.join(REPO, "extensions", "*", "scripts", script))
            ):
                errors.append(f"{f}: runtime invocation references missing script {script}")
    return errors


def check_routing(files):
    cmd_pat = re.compile(r'`/seo(?:\s+([a-z][a-z0-9-]*))?')
    tables = {src: {m for m in cmd_pat.findall(read(src)) if m}
              for src in ("skills/seo/SKILL.md", "docs/COMMANDS.md")}
    skill_tokens = {d.split("/")[1][4:] for d in files
                    if d.startswith("skills/seo-") and d.endswith("SKILL.md")}
    ext_tokens = {p.split("/")[3][4:] for p in files
                  if re.match(r'extensions/[^/]+/skills/seo-[^/]+/SKILL\.md$', p)}
    known = skill_tokens | ext_tokens
    a, b = tables["skills/seo/SKILL.md"], tables["docs/COMMANDS.md"]
    errors = []
    for c in sorted(a - b):
        errors.append(f"routing: `/seo {c}` in orchestrator but not docs/COMMANDS.md")
    for c in sorted(b - a):
        errors.append(f"routing: `/seo {c}` in docs/COMMANDS.md but not orchestrator")
    for c in sorted((a | b) - known - RUNTIME_UTILITY_COMMANDS):
        errors.append(f"routing: `/seo {c}` has no matching skill directory")
    return errors


def check_agent_refs(files, texts):
    agents = {os.path.basename(f)[:-3] for f in files
              if f.startswith((f"{CORE_AGENTS}/", "extensions/")) and "/agents/" in f
              and f.endswith(".md")}
    pat = re.compile(r'agents/([a-z0-9-]+)\.md')
    errors = []
    for f in texts:
        if "/agents/" in f:
            continue
        for m in sorted(set(pat.findall(read(f)))):
            if m not in agents and m not in DOC_EXAMPLE_AGENTS:
                errors.append(f"{f}: dead agent ref agents/{m}.md")
    return errors


def check_flow_lock(files):
    errors = []
    locked = {}
    for line in read(LOCK_PATH).splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) == 2:
            locked[parts[1]] = parts[0]
    for rel, want in locked.items():
        full = os.path.join(REPO, rel)
        if not os.path.exists(full):
            errors.append(f"flow lock: missing {rel}")
            continue
        with open(full, "rb") as fh:
            got = hashlib.sha256(fh.read()).hexdigest()
        if got != want:
            errors.append(f"flow lock: hash mismatch {rel}")
    extra = {f for f in files
             if f.startswith("skills/seo-flow/references/prompts/") and f.endswith(".md")} - set(locked)
    for rel in sorted(extra):
        errors.append(f"flow lock: unlocked prompt file {rel}")
    return errors


def check_orphan_files(files, texts):
    warnings = []
    prefixes = ("skills/", "docs/", "research/", "data/", "schema/")
    corpus = {f: read(f) for f in texts}
    for f in files:
        if not f.startswith(prefixes):
            continue
        base = os.path.basename(f)
        if base in GENERIC_BASENAMES or f.startswith("skills/seo-flow/references/prompts/"):
            continue
        if not any(base in c for other, c in corpus.items() if other != f):
            warnings.append(f"orphan candidate: {f}")
    return warnings


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--json", action="store_true", help="JSON output")
    ap.add_argument("--strict", action="store_true", help="exit 1 on warnings too")
    args = ap.parse_args()

    files = tracked_files()
    fileset = set(files)
    md = [f for f in files if f.endswith(".md")]
    texts = [f for f in files if f.endswith((".md", ".json", ".yaml", ".yml", ".toml",
                                             ".py", ".sh", ".ps1", ".cff", ".txt", ".html"))]

    ref_errors, ref_infos = check_references(fileset, md)
    script_errors, script_orphans = check_script_refs(fileset, texts)
    errors = (ref_errors + check_research_refs(fileset, texts) + script_errors
              + check_skill_dir_script_refs(fileset, texts)
              + check_runtime_invocations(texts)
              + check_routing(fileset) + check_agent_refs(fileset, texts)
              + check_flow_lock(fileset))
    warnings = script_orphans + check_orphan_files(fileset, texts)
    result = {"errors": errors, "warnings": warnings, "info": ref_infos,
              "files_checked": len(files),
              "status": "FAIL" if errors or (args.strict and warnings) else "PASS"}

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        for e in errors:
            print(f"ERROR: {e}")
        for w in warnings:
            print(f"WARN:  {w}")
        print(f"{result['status']}: {len(errors)} errors, {len(warnings)} warnings, "
              f"{len(ref_infos)} cross-skill infos, {len(files)} files")
    return 1 if result["status"] == "FAIL" else 0


if __name__ == "__main__":
    sys.exit(main())
