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
const defaultBaseUrl = "https://momentarise.dev/docs";
const baseUrl = normalizeBaseUrl(process.env.MME_DOCS_SITE_URL ?? defaultBaseUrl);
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
    "Markdown-native framework for portable, preservation-first document editors.",
    "",
    "## Public Docs",
    ""
  ];
  for (const page of docsPages) {
    const title = sanitizeLlmsLineField(page.title, 120);
    const description = sanitizeLlmsLineField(page.description, 220);
    const suffix = description ? `: ${description}` : "";
    lines.push(`- [${title}](${page.url})${suffix}`);
  }
  lines.push("", "## Full Context", "", `- [llms-full.txt](${baseUrl}/llms-full.txt)`, "");
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
    return baseUrl;
  }
  return `${baseUrl}/${route.split("/").map(encodeURIComponent).join("/")}`;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/g, "");
}
