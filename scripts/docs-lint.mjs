import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { createMarkdownAstFormatter } from "../packages/md-format/dist/index.js";

const publicRoot = resolve("docs/public");
const packageRoot = resolve("packages");
const requiredDocs = [
  "index.md",
  "quickstart/vanilla.md",
  "quickstart/react.md",
  "quickstart/next.md",
  "quickstart/headless.md",
  "concepts/document-model.md",
  "concepts/preservation.md",
  "concepts/save-truthfulness.md",
  "concepts/policy.md",
  "concepts/ai-privacy.md",
  "concepts/theming.md",
  "concepts/preferences.md",
  "concepts/extensions.md",
  "faq.md",
  "roadmap.md"
];
const allowedFrontmatterKeys = new Set([
  "title",
  "description",
  "nav_section",
  "nav_order",
  "audience",
  "tags",
  "packages",
  "llms",
  "updated"
]);
const formatter = createMarkdownAstFormatter();
const failures = [];

const packageDocs = await expectedPackageDocs();
for (const doc of [...requiredDocs, ...packageDocs]) {
  const fullPath = join(publicRoot, doc);
  if (!existsSync(fullPath)) {
    failures.push(`Missing required public doc: docs/public/${doc}`);
  }
}

const docs = await collectMarkdownFiles(publicRoot);
if (docs.length === 0) {
  failures.push("docs/public must contain public Markdown docs.");
}

let hasNoFrontmatterPage = false;
for (const docPath of docs) {
  const relPath = relative(publicRoot, docPath).replaceAll("\\", "/");
  const source = await readFile(docPath, "utf8");
  lintSource({ relPath, source });
}

if (!hasNoFrontmatterPage) {
  failures.push("At least one docs/public page must omit frontmatter to prove frontmatter is optional.");
}

if (failures.length > 0) {
  throw new Error(`Public docs lint failed:\n- ${failures.join("\n- ")}`);
}

async function expectedPackageDocs() {
  const entries = await readdir(packageRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}.md`)
    .sort();
}

async function collectMarkdownFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function lintSource({ relPath, source }) {
  if (!source.endsWith("\n")) {
    failures.push(`${relPath}: file must end with a newline.`);
  }
  if (/\[\[/.test(source)) {
    failures.push(`${relPath}: public docs use relative Markdown links, not wikilinks.`);
  }
  if (/\bdocs\/internal\b/.test(source)) {
    failures.push(`${relPath}: public docs must not reference docs/internal.`);
  }
  const proseSource = removeFencedCode(source);
  if (/^\s*(import|export)\s+/m.test(proseSource) || /<[A-Z][A-Za-z0-9.:-]*(\s|>|\/>)/.test(proseSource)) {
    failures.push(`${relPath}: public docs must stay plain Markdown/GFM, not MDX/JSX.`);
  }

  const frontmatter = parseFrontmatter(source);
  if (!frontmatter) {
    hasNoFrontmatterPage = true;
  } else {
    for (const key of frontmatter.entries.keys()) {
      if (!allowedFrontmatterKeys.has(key)) {
        failures.push(`${relPath}: unsupported frontmatter key ${JSON.stringify(key)}.`);
      }
    }
    lintFrontmatterShape(relPath, frontmatter.entries);
  }

  lintHeadings(relPath, frontmatter?.body ?? source);
  lintFences(relPath, source);
  lintLinks(relPath, source);
  lintFormatterIdentity(relPath, source);
}

function parseFrontmatter(source) {
  if (!source.startsWith("---\n")) {
    return null;
  }
  const closeIndex = source.indexOf("\n---\n", 4);
  if (closeIndex === -1) {
    failures.push("Frontmatter block opened but did not close with ---.");
    return null;
  }
  const raw = source.slice(4, closeIndex);
  const entries = new Map();
  let currentArrayKey = null;
  for (const line of raw.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const arrayItem = /^\s+-\s+(.+)$/.exec(line);
    if (arrayItem && currentArrayKey) {
      entries.get(currentArrayKey).items.push(arrayItem[1].trim());
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(line);
    if (match) {
      const value = line.slice(match[0].length).trim();
      currentArrayKey = value ? null : match[1];
      entries.set(match[1], value ? { kind: "scalar", value } : { items: [], kind: "array" });
      continue;
    }
    failures.push(`Frontmatter line is not supported by the public docs schema: ${JSON.stringify(line)}`);
  }
  return {
    body: source.slice(closeIndex + "\n---\n".length),
    entries
  };
}

function lintFrontmatterShape(relPath, entries) {
  for (const key of ["title", "description", "nav_section", "audience", "updated"]) {
    if (entries.has(key)) {
      assertScalar(relPath, entries, key);
    }
  }
  if (entries.has("llms")) {
    const value = assertScalar(relPath, entries, "llms");
    if (value && !["include", "exclude"].includes(stripQuotes(value))) {
      failures.push(`${relPath}: frontmatter llms must be include or exclude.`);
    }
  }
  if (entries.has("nav_order")) {
    const value = assertScalar(relPath, entries, "nav_order");
    if (value && !/^\d+$/.test(stripQuotes(value))) {
      failures.push(`${relPath}: frontmatter nav_order must be an integer.`);
    }
  }
  for (const key of ["tags", "packages"]) {
    if (entries.has(key)) {
      const entry = entries.get(key);
      if (entry.kind !== "array" || entry.items.length === 0) {
        failures.push(`${relPath}: frontmatter ${key} must be a non-empty YAML list.`);
      }
      for (const item of entry.items ?? []) {
        if (!stripQuotes(item)) {
          failures.push(`${relPath}: frontmatter ${key} contains an empty item.`);
        }
      }
    }
  }
}

function assertScalar(relPath, entries, key) {
  const entry = entries.get(key);
  if (entry.kind !== "scalar" || !stripQuotes(entry.value)) {
    failures.push(`${relPath}: frontmatter ${key} must be a non-empty scalar.`);
    return null;
  }
  return entry.value;
}

function stripQuotes(value) {
  return String(value).replace(/^["']|["']$/g, "").trim();
}

function lintHeadings(relPath, body) {
  const headings = [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({
    depth: match[1].length,
    text: match[2].trim()
  }));
  const h1s = headings.filter((heading) => heading.depth === 1);
  if (h1s.length !== 1) {
    failures.push(`${relPath}: expected exactly one H1, got ${h1s.length}.`);
  }
  let previousDepth = 0;
  for (const heading of headings) {
    if (heading.text.length === 0) {
      failures.push(`${relPath}: heading text must not be empty.`);
    }
    if (previousDepth > 0 && heading.depth > previousDepth + 1) {
      failures.push(`${relPath}: heading hierarchy skips from H${previousDepth} to H${heading.depth}.`);
    }
    previousDepth = heading.depth;
  }
}

function lintFences(relPath, source) {
  let openFence = null;
  const lines = source.split("\n");
  for (const line of lines) {
    const match = /^(`{3,}|~{3,})([^\n]*)$/.exec(line);
    if (!match) {
      continue;
    }
    const marker = match[1][0];
    if (!openFence) {
      const info = match[2].trim();
      if (!info) {
        failures.push(`${relPath}: fenced code blocks must include a language tag.`);
      }
      openFence = marker;
      continue;
    }
    if (marker === openFence) {
      openFence = null;
    }
  }
  if (openFence) {
    failures.push(`${relPath}: fenced code block is not closed.`);
  }
}

function removeFencedCode(source) {
  const lines = source.split("\n");
  const kept = [];
  let openFence = null;
  for (const line of lines) {
    const match = /^(`{3,}|~{3,})([^\n]*)$/.exec(line);
    if (match) {
      const marker = match[1][0];
      if (!openFence) {
        openFence = marker;
        kept.push("");
        continue;
      }
      if (marker === openFence) {
        openFence = null;
        kept.push("");
        continue;
      }
    }
    kept.push(openFence ? "" : line);
  }
  return kept.join("\n");
}

function lintLinks(relPath, source) {
  for (const match of source.matchAll(/!?\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1];
    if (isExternalOrAnchor(target)) {
      continue;
    }
    if (!target.endsWith(".md") && !target.includes(".md#")) {
      failures.push(`${relPath}: internal link must target a .md file: ${target}`);
      continue;
    }
    const [targetPath] = target.split("#");
    const resolved = resolve(publicRoot, dirname(relPath), targetPath);
    const insidePublic = normalize(resolved).startsWith(publicRoot);
    if (!insidePublic) {
      failures.push(`${relPath}: internal link escapes docs/public: ${target}`);
      continue;
    }
    if (!existsSync(resolved)) {
      failures.push(`${relPath}: internal link target missing: ${target}`);
    }
  }
}

function isExternalOrAnchor(target) {
  return (
    target.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(target) ||
    target.startsWith("mailto:")
  );
}

function lintFormatterIdentity(relPath, source) {
  const parseResult = formatter.parse(source, {
    dialect: "momentarise-enhanced",
    path: `docs-public://${relPath}`
  });
  const serializeResult = formatter.serialize(parseResult, {
    dialect: "momentarise-enhanced",
    preserveUnchangedRanges: true
  });
  if (serializeResult.content !== source) {
    failures.push(`${relPath}: MME formatter identity check changed Markdown bytes.`);
  }
}
