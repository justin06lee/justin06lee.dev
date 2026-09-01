#!/usr/bin/env node
// refs.mjs — keep the reference docs honest against the chrome registry.
//
//   node tools/refs.mjs check              audit docs vs registry, nonzero on drift
//   node tools/refs.mjs check --quiet      only print problems
//   node tools/refs.mjs scaffold <name>    print a reference section skeleton
//   node tools/refs.mjs list               show every registry component and where it's documented
//
// The registry is found via --registry, $CHROME_REGISTRY, or by looking for
// chrome.justin06lee.dev next to this repo.
//
// Deliberately a CHECKER, not a generator. Reference prose carries knowledge
// that meta.ts doesn't have (gotchas, vs-sibling guidance, props that exist on
// the component but not in meta), and a generator would flatten it. This tells
// you what drifted and leaves the writing to a human or an agent.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REFS = join(ROOT, "references");

/* ------------------------------------------------------------------ paths */

function findRegistry(explicit) {
  const candidates = [];
  if (explicit) candidates.push(explicit);
  if (process.env.CHROME_REGISTRY) candidates.push(process.env.CHROME_REGISTRY);
  // Siblings of this repo, then one level up (…/shipped/chrome.justin06lee.dev).
  for (const base of [resolve(ROOT, ".."), resolve(ROOT, "../..")]) {
    candidates.push(join(base, "chrome.justin06lee.dev"));
  }
  for (const c of candidates) {
    for (const p of [c, join(c, "packages/registry")]) {
      if (existsSync(join(p, "button", "meta.ts"))) return p;
    }
  }
  return null;
}

/* --------------------------------------------------- tiny TS object reader */

function skipString(src, i) {
  const q = src[i];
  i++;
  while (i < src.length) {
    if (src[i] === "\\") { i += 2; continue; }
    if (src[i] === q) return i + 1;
    i++;
  }
  return i;
}

// String-and-comment aware balanced slice starting at the opening delimiter.
function balanced(src, start, open, close) {
  let depth = 0;
  let i = start;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") { i = skipString(src, i); continue; }
    if (ch === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (ch === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return src.slice(start, i + 1); }
    i++;
  }
  return null;
}

function unescape(s) {
  return s.replace(/\\(["'\\nt])/g, (_, c) => ({ n: "\n", t: "\t" })[c] ?? c);
}

// Reads `key:` and joins the string literal(s) that follow (handles "a" + "b").
function readString(obj, key) {
  const m = new RegExp(`(^|[{,\\s])${key}\\s*:`).exec(obj);
  if (!m) return null;
  let i = m.index + m[0].length;
  const parts = [];
  while (i < obj.length) {
    while (i < obj.length && /[\s+]/.test(obj[i])) i++;
    if (obj[i] !== '"' && obj[i] !== "'" && obj[i] !== "`") break;
    const end = skipString(obj, i);
    parts.push(obj.slice(i + 1, end - 1));
    i = end;
  }
  return parts.length ? unescape(parts.join("")) : null;
}

function readArrayOfStrings(obj, key) {
  const m = new RegExp(`(^|[{,\\s])${key}\\s*:\\s*\\[`).exec(obj);
  if (!m) return [];
  const arr = balanced(obj, obj.indexOf("[", m.index + m[0].length - 1), "[", "]");
  if (!arr) return [];
  return [...arr.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((x) => unescape(x[1]));
}

function parseMeta(file) {
  const src = readFileSync(file, "utf8");
  const out = {
    name: readString(src, "name"),
    description: readString(src, "description"),
    dependencies: readArrayOfStrings(src, "dependencies"),
    registryDependencies: readArrayOfStrings(src, "registryDependencies"),
    props: [],
  };
  // `dependencies` regex also matches registryDependencies' tail; re-read exactly.
  const depM = /(^|[{,\s])dependencies\s*:\s*\[/m.exec(src);
  if (depM) {
    const arr = balanced(src, src.indexOf("[", depM.index + depM[0].length - 1), "[", "]");
    out.dependencies = arr ? [...arr.matchAll(/"([^"]*)"/g)].map((x) => x[1]) : [];
  } else out.dependencies = [];

  const pm = /(^|[{,\s])props\s*:\s*\[/m.exec(src);
  if (pm) {
    const arr = balanced(src, src.indexOf("[", pm.index + pm[0].length - 1), "[", "]");
    if (arr) {
      let i = 1;
      while (i < arr.length) {
        if (arr[i] === '"' || arr[i] === "'" || arr[i] === "`") { i = skipString(arr, i); continue; }
        if (arr[i] === "/" && arr[i + 1] === "/") { while (i < arr.length && arr[i] !== "\n") i++; continue; }
        if (arr[i] === "{") {
          const obj = balanced(arr, i, "{", "}");
          if (!obj) break;
          const name = readString(obj, "name");
          if (name) {
            out.props.push({
              name,
              type: readString(obj, "type"),
              default: readString(obj, "default"),
              required: /(^|[{,\s])required\s*:\s*true/.test(obj),
              description: readString(obj, "description"),
            });
          }
          i += obj.length;
          continue;
        }
        i++;
      }
    }
  }
  return out;
}

function loadRegistry(dir) {
  const out = new Map();
  for (const name of readdirSync(dir)) {
    const meta = join(dir, name, "meta.ts");
    if (!existsSync(meta) || !statSync(join(dir, name)).isDirectory()) continue;
    out.set(name, parseMeta(meta));
  }
  return out;
}

/* ---------------------------------------------------------- doc reading */

function loadDocs() {
  const out = new Map();
  const dupes = [];
  if (!existsSync(REFS)) return { docs: out, dupes };
  for (const file of readdirSync(REFS).filter((f) => f.endsWith(".md")).sort()) {
    const text = readFileSync(join(REFS, file), "utf8");
    const lines = text.split("\n");
    let cur = null;
    for (const line of lines) {
      const h = /^##\s+(\S+)\s*$/.exec(line);
      if (h) {
        // A component documented twice is worse than one documented never:
        // the two copies drift apart and an agent reads whichever it hits first.
        if (out.has(h[1])) dupes.push(`${h[1]}: ${out.get(h[1]).file} and ${file}`);
        cur = { name: h[1], file, props: new Map(), install: null, composes: null };
        out.set(h[1], cur);
        continue;
      }
      if (!cur) continue;
      if (line.startsWith("**Install:**")) cur.install = line.slice(12).trim();
      if (line.startsWith("**Composes:**")) cur.composes = line.slice(13).trim();
      // - `name: type = default — note.`   /   - `name` — required — note
      const b = /^-\s+`([^`]+)`/.exec(line);
      if (b) {
        const inner = b[1];
        const raw = inner.split(":")[0].trim();
        const key = raw.includes("(") ? raw : raw.split(".").pop();
        // Pull a default out of the backticked part only, and skip the `=` of a
        // `=>` arrow so a callback type isn't read as a default value.
        const d = /\s=\s*(?!>)([^—]+)/.exec(inner);
        cur.props.set(key, d ? d[1].trim() : null);
      }
    }
  }
  return { docs: out, dupes };
}

const normDefault = (v) => (v == null ? null : String(v).trim().replace(/^['"]|['"]$/g, "").replace(/\s+/g, ""));

/* ------------------------------------------------------------------ check */

function check(registry, registryDir, quiet) {
  const { docs, dupes } = loadDocs();
  const problems = { undocumented: [], stale: [], duplicated: dupes, props: [], defaults: [] };

  for (const [name, meta] of [...registry].sort()) {
    const doc = docs.get(name);
    if (!doc) { problems.undocumented.push(name); continue; }
    for (const p of meta.props) {
      const key = p.name.includes("(") ? p.name : p.name.split(".").pop();
      if (!doc.props.has(key) && !doc.props.has(p.name)) {
        problems.props.push(`${name}.${p.name}`);
        continue;
      }
      const documented = doc.props.get(key) ?? doc.props.get(p.name);
      if (p.default != null && documented != null && normDefault(documented) !== normDefault(p.default)) {
        problems.defaults.push(`${name}.${p.name}: docs=${documented} registry=${p.default}`);
      }
    }
  }
  for (const name of docs.keys()) if (!registry.has(name)) problems.stale.push(name);

  const total = Object.values(problems).reduce((n, a) => n + a.length, 0);

  if (!quiet) {
    console.log(`registry: ${registryDir}`);
    console.log(`components: ${registry.size} in registry, ${docs.size} documented`);
  }
  const section = (title, items) => {
    if (!items.length) return;
    console.log(`\n${title} (${items.length})`);
    for (const i of items) console.log(`  ${i}`);
  };
  section("UNDOCUMENTED components", problems.undocumented);
  section("STALE doc sections (not in registry)", problems.stale);
  section("DUPLICATED sections (same component in two files)", problems.duplicated);
  section("UNDOCUMENTED props", problems.props);
  section("DEFAULT mismatches", problems.defaults);

  if (total === 0) {
    if (!quiet) console.log("\nno drift.");
    return 0;
  }
  console.log(`\n${total} problem(s). run \`node tools/refs.mjs scaffold <name>\` for new components.`);
  return 1;
}

/* --------------------------------------------------------------- scaffold */

function scaffold(meta) {
  const deps = [
    meta.registryDependencies.filter((d) => d !== "utils").join(", ") || null,
    meta.dependencies.length ? `${meta.dependencies.join(", ")} (npm)` : null,
  ].filter(Boolean);
  const lines = [
    `## ${meta.name}`,
    ``,
    `**Role:** TODO — one line, what it is for.`,
    `**Install:** \`bunx @justin06lee/chrome@latest add ${meta.name}\``,
    `**Composes:** ${deps.length ? deps.join("; ") : "nothing beyond utils"}`,
    ``,
    `TODO narrative. meta description says:`,
    ``,
    `> ${meta.description ?? ""}`,
    ``,
    `TODO: internals, gotchas, and when to reach for a sibling instead.`,
    ``,
    `**Key props:**`,
  ];
  for (const p of meta.props) {
    let s = `- \`${p.name}`;
    if (p.type) s += `: ${p.type}`;
    if (p.default != null) s += ` = ${p.default}`;
    s += "`";
    if (p.required) s += " — required";
    if (p.description) s += ` — ${p.description}`;
    lines.push(s);
  }
  lines.push("", "**Example:**", "```tsx", "TODO", "```");
  return lines.join("\n");
}

/* ------------------------------------------------------------------- main */

const argv = process.argv.slice(2);
const cmd = argv[0] ?? "check";
const flag = (n) => { const i = argv.indexOf(n); return i < 0 ? null : argv[i + 1]; };

const registryDir = findRegistry(flag("--registry"));
if (!registryDir) {
  console.error("could not find the chrome registry.");
  console.error("pass --registry <path/to/packages/registry> or set $CHROME_REGISTRY.");
  process.exit(2);
}
const registry = loadRegistry(registryDir);

if (cmd === "check") {
  process.exit(check(registry, registryDir, argv.includes("--quiet")));
} else if (cmd === "scaffold") {
  const name = argv[1];
  const meta = registry.get(name);
  if (!meta) {
    console.error(`unknown component: ${name}`);
    console.error(`known: ${[...registry.keys()].sort().join(", ")}`);
    process.exit(2);
  }
  console.log(scaffold(meta));
} else if (cmd === "list") {
  const { docs } = loadDocs();
  for (const name of [...registry.keys()].sort()) {
    const d = docs.get(name);
    console.log(`${name.padEnd(20)} ${d ? d.file : "— UNDOCUMENTED"}`);
  }
} else {
  console.error(`usage: refs.mjs [check|scaffold <name>|list] [--registry <path>]`);
  process.exit(2);
}
