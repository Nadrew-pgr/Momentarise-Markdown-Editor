import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import {
  assertSafePublicMarkdownPath,
  comparePublicDocsPages,
  parsePublicDocsFrontmatter,
  sanitizeLlmsLineField,
  titleFromPath,
  validateAbsoluteUrl
} from "../apps/docs-site/src/docs-shared.mjs";

const publicRoot = "docs/public";
const outputFiles = {
  full: "llms-full.txt",
  index: "llms.txt"
};
const defaultDocsBaseUrl = "https://momentarise.dev/docs";
const docsBaseUrl = normalizeBaseUrl(process.env.MME_DOCS_SITE_URL ?? defaultDocsBaseUrl);
const siteOrigin = normalizeBaseUrl(process.env.MME_SITE_URL ?? new URL(docsBaseUrl).origin);
const repositoryUrl = "https://github.com/Nadrew-pgr/Momentarise-Markdown-Editor";
const checkMode = process.argv.includes("--check");

const pages = (await Promise.all((await collectMarkdownFiles(publicRoot)).map(createPage))).sort(comparePublicDocsPages);
const includedPages = pages.filter((page) => page.metadata.llms !== "exclude");
const generated = {
  [outputFiles.index]: renderLlmsIndex(includedPages),
  [outputFiles.full]: renderLlmsFull(includedPages)
};

if (checkMode) {
  await checkGeneratedOutput(generated);
} else {
  for (const [path, content] of Object.entries(generated)) {
    await writeFile(path, content);
  }
}

async function checkGeneratedOutput(files) {
  const tempDir = await mkdtemp(join(tmpdir(), "mme-llms-"));
  try {
    for (const [path, content] of Object.entries(files)) {
      await writeFile(join(tempDir, path), content);
      const committed = existsSync(path) ? await readFile(path, "utf8") : "";
      if (committed !== content) {
        throw new Error(`${path} is out of sync with docs/public. Run: node scripts/generate-llms.mjs`);
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function renderLlmsIndex(docsPages) {
  const lines = [
    "# Momentarise Markdown Editor",
    "",
    "## What MME Is",
    "",
    "Momentarise Markdown Editor is an experimental TypeScript framework for building modern document editors where Markdown remains the durable source.",
    "",
    "Source editing, rich editing, HTML rendering, save state, extensions, and policy-gated AI are derived around real `.md` files instead of replacing them with an editor-owned JSON or block database.",
    "",
    "## Core Guarantees",
    "",
    "- Markdown plus optional YAML frontmatter is canonical persisted source.",
    "- Untouched documents remain byte-identical through derived views.",
    "- Targeted edits preserve bytes outside the owned source range.",
    "- Unsupported syntax falls back to raw or opaque preservation.",
    "- Save state names the real disk, download, memory, conflict, or error target.",
    "- Core packages remain independent from React, Next.js, CodeMirror, ProseMirror, and host APIs.",
    "- Sensitive access and AI calls are policy-gated; suggestions remain staged.",
    "",
    "## Use MME When",
    "",
    "- You need modern source and rich editing while users keep portable Markdown files.",
    "- You need headless, vanilla, React, Next.js, browser-file, or IDE-shell integration.",
    "- You need preservation, truthful persistence, safe rendering, extension, theme, and AI contracts in reusable packages.",
    "",
    "## Decision Summary",
    "",
    "- MME is a framework integrated by developers; it is not a hosted editor app, CMS, or finished writing product.",
    "- Developers, writers, and non-developers can use an editor built with MME when a host supplies final UX and persistence.",
    "- Choose MME when real Markdown must remain canonical and rich/source views must preserve unsupported or untouched source.",
    "- Choose another architecture when an editor-owned JSON/block database should be canonical or a ready-hosted collaborative app is required.",
    "- Current packages are experimental `0.x` and published to npm under the `alpha` dist-tag (`0.1.0-alpha.1`), not `latest`.",
    "",
    "## Citation-Safe Claims",
    "",
    "- MME keeps Markdown plus optional YAML frontmatter as canonical persisted source.",
    "- MME provides CodeMirror source and ProseMirror rich view packages around a host-independent headless session.",
    "- Repository tests cover untouched rich identity, targeted serialization, truthful save targets, public APIs, and packed consumer paths.",
    "- No Payload CMS adapter, hosted Ask AI, production collaboration, or managed AI billing ships today.",
    "- Public source and machine-readable discovery can improve retrieval and verification; it does not guarantee indexing, ranking, or citation.",
    "",
    "## Question Routes",
    "",
    `- [Should I choose MME?](${docsBaseUrl}/choosing-mme)`,
    `- [Common product and integration questions](${docsBaseUrl}/faq)`,
    `- [Machine-readable product profile](${siteOrigin}/agent/product.json)`,
    `- [Document and persistence model](${docsBaseUrl}/concepts/document-model)`,
    `- [Compatibility and release status](${docsBaseUrl}/compatibility-promise)`,
    "",
    "## Do Not Assume",
    "",
    "- Current packages are experimental `0.x` alpha releases (`alpha` dist-tag), not stable or ready for production use.",
    "- Payload CMS or other CMS integrations are future work, not shipped adapters.",
    "- Hosted Ask AI, semantic docs search, production collaboration, managed AI billing, and automatic skill installation are not shipped.",
    "- Public docs are `README.md` plus `docs/public`; internal planning files are not public product evidence.",
    "",
    "## Start Building",
    "",
    `- [Overview](${docsBaseUrl})`,
    `- [Vanilla quickstart](${docsBaseUrl}/quickstart/vanilla)`,
    `- [React quickstart](${docsBaseUrl}/quickstart/react)`,
    `- [Next.js quickstart](${docsBaseUrl}/quickstart/next)`,
    `- [Headless quickstart](${docsBaseUrl}/quickstart/headless)`,
    `- [CLI for agents and developers](${docsBaseUrl}/packages/md-cli)`,
    "",
    "## Machine-Readable Entry Points",
    "",
    `- [Full public context](${siteOrigin}/llms-full.txt)`,
    `- [Agent artifact index](${siteOrigin}/agent/README.md)`,
    `- [Product profile](${siteOrigin}/agent/product.json)`,
    `- [Agent manifest](${siteOrigin}/agent/manifest.json)`,
    `- [Agent actions](${siteOrigin}/agent/actions.json)`,
    `- [Source repository](${repositoryUrl})`,
    "",
    "## Public Docs",
    ""
  ];
  let currentSection = "";
  for (const page of docsPages) {
    const section = sanitizeLlmsLineField(page.metadata.navSection ?? "Reference", 80);
    if (section !== currentSection) {
      if (currentSection) {
        lines.push("");
      }
      lines.push(`### ${section}`, "");
      currentSection = section;
    }
    const title = sanitizeLlmsLineField(page.title, 120);
    const description = sanitizeLlmsLineField(page.description, 220);
    const suffix = description ? `: ${description}` : "";
    lines.push(`- [${title}](${page.url})${suffix}`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderLlmsFull(docsPages) {
  return `${docsPages
    .map((page) =>
      [
        "---",
        `path: docs/public/${sanitizeLlmsLineField(page.path, 180)}`,
        `url: ${page.url}`,
        `title: ${sanitizeLlmsLineField(page.title, 180)}`,
        "---",
        "",
        page.source.trimEnd()
      ].join("\n")
    )
    .join("\n\n")}\n`;
}

async function createPage(path) {
  assertSafePublicMarkdownPath(path);
  const source = await readFile(join(publicRoot, path), "utf8");
  const parsed = parsePublicDocsFrontmatter(source);
  const h1 = parsed.body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title = parsed.metadata.title ?? h1 ?? titleFromPath(path);
  const url = validateAbsoluteUrl(buildUrl(path));
  return {
    description: parsed.metadata.description ?? "",
    metadata: parsed.metadata,
    path,
    source,
    title,
    url
  };
}

async function collectMarkdownFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(relative(publicRoot, fullPath).replaceAll("\\", "/"));
    }
  }
  return files.sort();
}

function buildUrl(path) {
  const route = path.replace(/\.md$/, "");
  if (route === "index") {
    return docsBaseUrl;
  }
  return `${docsBaseUrl}/${route.split("/").map(encodeURIComponent).join("/")}`;
}

function normalizeBaseUrl(value) {
  const parsed = new URL(validateAbsoluteUrl(value));
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`Docs base URL must not include credentials, a query, or a fragment: ${value}`);
  }
  return parsed.toString().replace(/\/+$/g, "");
}
