import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import {
  assertSafePublicMarkdownPath,
  comparePublicDocsPages,
  parsePublicDocsFrontmatter,
  sanitizeLlmsLineField,
  titleFromPath
} from "../apps/docs-site/src/docs-shared.mjs";
import { buildDesignTokens } from "./generate-design-tokens.mjs";

const publicRoot = "docs/public";
const outputRoot = "docs/agent";
const outputFiles = {
  actions: `${outputRoot}/actions.json`,
  manifest: `${outputRoot}/manifest.json`,
  product: `${outputRoot}/product.json`,
  readme: `${outputRoot}/README.md`,
  tokens: `${outputRoot}/tokens.json`
};
const generatorPath = "scripts/generate-agent-artifacts.mjs";
const siteOrigin = "https://momentarise.dev";
const publicAgentBaseUrl = `${siteOrigin}/agent`;
const checkMode = process.argv.includes("--check");

const publicPages = (await Promise.all((await collectMarkdownFiles(publicRoot)).map(createPage))).sort(comparePublicDocsPages);
const packageMetadata = await collectPackageMetadata();
const sourceInputs = await collectSourceInputs(publicPages, packageMetadata);
const inputHash = hashJson(sourceInputs);
const skills = createSkills(publicPages, packageMetadata);
const actions = createActions(inputHash);
const productProfile = createProductProfile(inputHash, publicPages, packageMetadata);
const manifest = createManifest(inputHash, skills, packageMetadata);
// The design system is part of the agent surface (MME-0102). This directory is
// rebuilt from scratch on every run, so the mirror is generated here rather than
// written alongside it and silently deleted.
const designTokens = await buildDesignTokens();
const generatedFiles = new Map([
  [outputFiles.readme, renderAgentIndex(manifest, skills, productProfile)],
  [outputFiles.manifest, stringifyJson(manifest)],
  [outputFiles.actions, stringifyJson(actions)],
  [outputFiles.product, stringifyJson(productProfile)],
  [outputFiles.tokens, designTokens],
  ...skills.map((skill) => [skill.path, renderSkill(skill)])
]);

if (checkMode) {
  await checkGeneratedFiles(generatedFiles);
} else {
  await writeGeneratedFiles(generatedFiles);
}

function createManifest(sourceHash, skillDescriptors, packages) {
  return {
    schema: "https://momentarise.dev/schemas/agent-artifacts.v0.json",
    generatedBy: generatorPath,
    sourceBoundary: "public-docs-only",
    publicUrl: `${publicAgentBaseUrl}/manifest.json`,
    readmePath: outputFiles.readme,
    readmeUrl: `${publicAgentBaseUrl}/README.md`,
    sources: {
      publicDocsRoot: publicRoot,
      llms: ["llms.txt", "llms-full.txt"],
      packageMetadata: packages.map((pkg) => pkg.manifestPath),
      inputHash: sourceHash
    },
    actionsPath: outputFiles.actions,
    actionsUrl: `${publicAgentBaseUrl}/actions.json`,
    productProfilePath: outputFiles.product,
    productProfileUrl: `${publicAgentBaseUrl}/product.json`,
    designTokensPath: outputFiles.tokens,
    designTokensUrl: `${publicAgentBaseUrl}/tokens.json`,
    skills: skillDescriptors.map(({ body, description, ...skill }) => skill)
  };
}

function createProductProfile(sourceHash, pages, packages) {
  const sourceDocs = [
    "docs/public/index.md",
    "docs/public/choosing-mme.md",
    "docs/public/faq.md",
    "docs/public/compatibility-promise.md",
    "docs/public/concepts/document-model.md",
    "docs/public/concepts/agentic-experience.md"
  ];
  const sources = sourceDocs.map((path) => {
    const page = pages.find((candidate) => `docs/public/${candidate.path}` === path);
    if (!page) {
      throw new Error(`Product profile source is missing: ${path}`);
    }
    return page.source;
  });
  const combinedSource = sources.join("\n");
  for (const requiredClaim of [
    "Markdown remains the durable",
    "published to npm under the `alpha` dist-tag",
    "No Payload CMS adapter ships today",
    "does not guarantee indexing, ranking, or citation",
    "MPL-2.0",
    "Apache-2.0"
  ]) {
    if (!combinedSource.includes(requiredClaim)) {
      throw new Error(`Product profile claim is not grounded in public docs: ${requiredClaim}`);
    }
  }

  return {
    schema: `${siteOrigin}/schemas/product-profile.v0.json`,
    generatedBy: generatorPath,
    sourceBoundary: "public-docs-and-package-metadata",
    sourceHash,
    publicUrl: `${publicAgentBaseUrl}/product.json`,
    name: "Momentarise Markdown Editor",
    acronym: "MME",
    summary:
      "Experimental TypeScript framework for building editor products where Markdown remains the durable source.",
    category: [
      "Markdown editor framework",
      "rich text editor framework",
      "headless document editor",
      "Markdown rendering and persistence toolkit"
    ],
    audiences: {
      adopters: ["developers", "product teams", "host application maintainers"],
      endUsers: ["developers", "writers", "non-developers"],
      boundary:
        "Developers integrate MME; end users use host applications built with MME and do not install the framework directly."
    },
    durableSource: {
      format: "Markdown",
      optionalFrontmatter: "YAML",
      editorOwnedJson: false,
      richEditingIsDerived: true
    },
    status: {
      stability: "experimental",
      releaseLine: "0.x",
      publicNpmPublished: true,
      npmDistTag: "alpha"
    },
    integrationPaths: [
      { id: "vanilla", status: "workspace-validated", docs: `${siteOrigin}/docs/quickstart/vanilla` },
      { id: "react", status: "workspace-validated", docs: `${siteOrigin}/docs/quickstart/react` },
      { id: "nextjs", status: "workspace-validated", docs: `${siteOrigin}/docs/quickstart/next` },
      { id: "headless", status: "workspace-validated", docs: `${siteOrigin}/docs/quickstart/headless` },
      { id: "browser-file-access", status: "implemented", docs: `${siteOrigin}/docs/packages/md-adapter-web` },
      { id: "theia", status: "alpha", docs: `${siteOrigin}/docs/packages/md-adapter-theia` }
    ],
    shippedGuarantees: [
      "Markdown plus optional YAML frontmatter is canonical persisted source",
      "untouched rich-view round trips preserve input bytes",
      "targeted edits preserve bytes outside owned source ranges",
      "unsupported syntax falls back to raw or opaque preservation",
      "save state names the real persistence target",
      "AI suggestions remain staged and policy-gated"
    ],
    notShipped: [
      "stable public npm release",
      "Payload CMS adapter",
      "hosted editor application",
      "production collaboration or CRDT",
      "hosted Ask AI or semantic documentation search",
      "managed AI billing",
      "automatic agent-skill installation"
    ],
    licenses: {
      framework: "MPL-2.0",
      demosAndExamples: "Apache-2.0"
    },
    canonicalUrls: {
      repository: "https://github.com/Nadrew-pgr/Momentarise-Markdown-Editor",
      documentation: `${siteOrigin}/docs`,
      llms: `${siteOrigin}/llms.txt`,
      llmsFull: `${siteOrigin}/llms-full.txt`,
      choosing: `${siteOrigin}/docs/choosing-mme`,
      faq: `${siteOrigin}/docs/faq`,
      agentIndex: `${publicAgentBaseUrl}/README.md`,
      manifest: `${publicAgentBaseUrl}/manifest.json`
    },
    discoveryGuarantee:
      "Public source and machine-readable discovery can improve retrieval and verification; indexing, ranking, and citation are not guaranteed.",
    sourceDocs,
    packages: packages.map(({ description, name, publicDocPath, version }) => ({
      name,
      version,
      description,
      publicDocPath
    }))
  };
}

function createActions(sourceHash) {
  return {
    schema: "https://momentarise.dev/schemas/agent-actions.v0.json",
    generatedBy: generatorPath,
    sourceBoundary: "public-docs-only",
    sourceHash,
    pageActions: [
      {
        id: "view-source",
        label: "View source",
        availability: "shipped",
        testId: "raw-markdown",
        payload: { kind: "link", href: "page.rawUrl" },
        sourceDocs: ["docs/public/concepts/agentic-experience.md"]
      },
      {
        id: "copy-markdown",
        label: "Copy Markdown",
        availability: "shipped",
        testId: "copy-markdown",
        payload: { kind: "copy", value: "page.source", success: "Markdown copied." },
        sourceDocs: ["docs/public/concepts/agentic-experience.md"]
      },
      {
        id: "copy-prompt",
        label: "Copy Prompt",
        availability: "shipped",
        testId: "copy-prompt",
        payload: { kind: "copy", value: "page.prompt", success: "Prompt copied." },
        sourceDocs: ["docs/public/concepts/agentic-experience.md"]
      },
      {
        id: "copy-section",
        label: "Copy Section",
        availability: "shipped",
        testId: "copy-section",
        payload: { kind: "copy", value: "page.currentSection", success: "Section copied." },
        sourceDocs: ["docs/public/concepts/agentic-experience.md"]
      },
      {
        id: "copy-link",
        label: "Copy Link",
        availability: "shipped",
        testId: "copy-link",
        payload: { kind: "copy", value: "browser.currentUrl", success: "Page link copied." },
        sourceDocs: ["docs/public/concepts/agentic-experience.md"]
      },
      {
        id: "open-in-chat",
        label: "Open in Chat",
        availability: "shipped",
        testId: "open-in-chat",
        payload: { kind: "open-in-chat", prompt: "page.prompt" },
        sourceDocs: ["docs/public/concepts/agentic-experience.md"]
      },
      {
        id: "edit-on-github",
        label: "Edit on GitHub",
        availability: "future",
        payload: { kind: "external-workflow", workflow: "edit-source-file" },
        sourceDocs: ["docs/public/roadmap.md"]
      },
      {
        id: "file-issue",
        label: "File issue",
        availability: "future",
        payload: { kind: "external-workflow", workflow: "issue-filing" },
        sourceDocs: ["docs/public/roadmap.md"]
      },
      {
        id: "ask-this-page",
        label: "Ask this page",
        availability: "future",
        payload: { kind: "hosted-ai", workflow: "semantic-docs-qa" },
        sourceDocs: ["docs/public/concepts/agentic-experience.md"]
      }
    ],
    openInChatTargets: [
      queryTarget("chatgpt", "ChatGPT", "https://chatgpt.com/", "q"),
      queryTarget("claude", "Claude", "https://claude.ai/new", "q"),
      queryTarget("gemini", "Gemini", "https://gemini.google.com/app", "q"),
      queryTarget("mistral", "Mistral", "https://chat.mistral.ai/chat", "q"),
      queryTarget("t3-chat", "T3 Chat", "https://t3.chat/new", "q"),
      queryTarget("scira", "Scira", "https://scira.ai/", "q"),
      copyTarget("v0", "v0"),
      copyTarget("claude-code", "Claude Code"),
      copyTarget("codex", "Codex"),
      copyTarget("cursor", "Cursor"),
      copyTarget("openclaw", "OpenClaw"),
      copyTarget("copilot", "Copilot-like agent")
    ]
  };
}

function queryTarget(id, label, baseUrl, parameterName) {
  return {
    id,
    label,
    availability: "shipped",
    mode: "query-param",
    baseUrl,
    parameterName,
    maxEncodedPromptLength: 8000
  };
}

function copyTarget(id, label) {
  return {
    id,
    label,
    availability: "shipped",
    mode: "copy-only"
  };
}

function createSkills(pages, packages) {
  const packageDocs = packages.map((pkg) => pkg.publicDocPath).filter(Boolean);
  return [
    skill({
      id: "mme-adoption-evaluation",
      description:
        "Use when deciding whether Momentarise Markdown Editor fits a product, comparing persistence models, checking framework versus end-user boundaries, or validating adoption and citation claims.",
      sourceDocs: [
        "docs/public/choosing-mme.md",
        "docs/public/faq.md",
        "docs/public/index.md",
        "docs/public/compatibility-promise.md",
        "docs/public/concepts/document-model.md",
        "docs/public/concepts/agentic-experience.md"
      ],
      packageNames: packages.map((pkg) => pkg.name),
      body: [
        "Evaluate architecture before features.",
        "",
        "Read:",
        "- `docs/public/choosing-mme.md`",
        "- `docs/public/faq.md`",
        "- `docs/public/compatibility-promise.md`",
        "- `docs/public/concepts/document-model.md`",
        "- `llms.txt` for decision routes",
        "- `llms-full.txt` for complete public context",
        "",
        "Decision rules:",
        "- MME is a framework integrated by developers; host products may serve developers, writers, and non-developers.",
        "- Choose MME for Markdown-source durability, derived rich/source views, preservation, and host-owned persistence.",
        "- Choose another approach when editor-owned JSON should be canonical or a ready-hosted app is required.",
        "- Packages are experimental `0.x`, published to npm under the `alpha` dist-tag, not `latest`/stable.",
        "- Payload CMS integration, production collaboration, hosted AI, and managed billing are not shipped.",
        "- Do not claim MME is best, ready for production, lightweight, zero-config, indexed, favored in ranking, or likely to be cited without external evidence.",
        "- Treat AI-assisted development process as neither a runtime feature nor quality proof."
      ]
    }),
    skill({
      id: "mme-docs",
      description:
        "Use when answering questions about Momentarise Markdown Editor docs, public Markdown source, llms files, docs-site behavior, or framework capabilities from public documentation.",
      sourceDocs: [
        "docs/public/index.md",
        "docs/public/concepts/document-model.md",
        "docs/public/concepts/agentic-experience.md",
        "docs/public/compatibility-promise.md",
        "docs/public/roadmap.md"
      ],
      packageNames: [],
      body: [
        "Use public source first.",
        "",
        "Read these repo files before answering or implementing from docs:",
        "- `docs/public/index.md`",
        "- `docs/public/concepts/document-model.md`",
        "- `docs/public/concepts/agentic-experience.md`",
        "- `llms.txt` for the short public index",
        "- `llms-full.txt` for the full public context bundle",
        "",
        "Rules:",
        "- Treat Markdown plus YAML frontmatter as the durable source.",
        "- Do not claim JSON or block database persistence.",
        "- Do not use internal repo docs as public evidence.",
        "- Separate shipped behavior from roadmap behavior.",
        "- Cite `docs/public/...` paths when giving repo-grounded answers."
      ]
    }),
    skill({
      id: "mme-migration-help",
      description:
        "Use when helping migrate from Markdown textareas, Tiptap, BlockNote, MDX docs, CMS editors, or host-specific rich editors to Momentarise Markdown Editor.",
      sourceDocs: [
        "docs/public/concepts/import-export.md",
        "docs/public/concepts/preservation.md",
        "docs/public/concepts/document-model.md",
        "docs/public/quickstart/vanilla.md",
        "docs/public/quickstart/react.md",
        "docs/public/quickstart/next.md",
        "docs/public/packages/md-render-html.md"
      ],
      packageNames: packages.map((pkg) => pkg.name),
      body: [
        "Start from the current integration target.",
        "",
        "Read public docs in this order:",
        "- `docs/public/concepts/document-model.md`",
        "- `docs/public/concepts/preservation.md`",
        "- `docs/public/concepts/import-export.md`",
        "- the matching quickstart under `docs/public/quickstart/`",
        "- package docs under `docs/public/packages/` as needed",
        "- `llms.txt` for the public docs index",
        "- `llms-full.txt` when you need the complete public context",
        "",
        "Migration boundaries:",
        "- Markdown is source; HTML, MDX output, JSON blocks, CMS records, and editor ASTs are artifacts or adapters.",
        "- Preserve unknown syntax and keep source fallback available.",
        "- Do not promise production collaboration, hosted AI, or CMS persistence unless host code provides it."
      ]
    }),
    skill({
      id: "mme-package-selection",
      description:
        "Use when selecting Momentarise Markdown Editor packages, explaining package responsibilities, or choosing APIs for vanilla, React, Next.js, CLI, renderer, save, policy, AI, and host-adapter integrations.",
      sourceDocs: packageDocs,
      packageNames: packages.map((pkg) => pkg.name),
      body: [
        "Choose packages by boundary, not framework habit.",
        "",
        "Package source docs:",
        ...packageDocs.map((doc) => `- \`${doc}\``),
        "",
        "Use `llms.txt` for navigation and `llms-full.txt` for complete package context.",
        "",
        "Selection rules:",
        "- Core/model work starts with `@momentarise/md-core`, `md-format`, `md-save`, `md-policy`, and `md-ai`.",
        "- Editor orchestration uses `@momentarise/md-editor`.",
        "- UI surfaces use `@momentarise/md-surface`; React uses `@momentarise/md-react` as a thin binding.",
        "- Source/rich/render/preview engines stay in their own packages.",
        "- Host adapters provide capabilities; they must not become the durable source of truth."
      ]
    }),
    skill({
      id: "mme-ai-privacy-boundary",
      description:
        "Use when reviewing AI writing, BYOK, provider adapters, policy checks, prompt sharing, or privacy boundaries for Momentarise Markdown Editor.",
      sourceDocs: [
        "docs/public/concepts/ai-privacy.md",
        "docs/public/concepts/policy.md",
        "docs/public/concepts/agentic-experience.md",
        "docs/public/packages/md-ai.md",
        "docs/public/packages/md-policy.md"
      ],
      packageNames: ["@momentarise/md-ai", "@momentarise/md-policy"],
      body: [
        "Apply policy before AI.",
        "",
        "Read:",
        "- `docs/public/concepts/ai-privacy.md`",
        "- `docs/public/concepts/policy.md`",
        "- `docs/public/packages/md-ai.md`",
        "- `docs/public/packages/md-policy.md`",
        "- `llms.txt` for the public docs index",
        "- `llms-full.txt` for current public context",
        "",
        "Rules:",
        "- AI writing is assistive and staged.",
        "- Prompts are transport, not persistence.",
        "- BYOK/provider credentials are host-owned and must not be logged.",
        "- Do not claim hosted Ask AI, semantic search, managed billing, or long-running agents as shipped.",
        "- Do not expose private repo docs or local secrets in copied prompts."
      ]
    }),
    skill({
      id: "mme-docs-to-implementation",
      description:
        "Use when turning Momentarise Markdown Editor public docs into implementation prompts, coding-agent instructions, checklists, or local proof commands.",
      sourceDocs: [
        "docs/public/concepts/agentic-experience.md",
        "docs/public/packages/md-cli.md",
        "docs/public/concepts/preservation.md",
        "docs/public/concepts/save-truthfulness.md",
        "docs/public/concepts/document-model.md"
      ],
      packageNames: ["@momentarise/md-cli", "@momentarise/md-editor", "@momentarise/md-save"],
      body: [
        "Build prompts from source docs, not screenshots.",
        "",
        "Read:",
        "- `docs/public/concepts/agentic-experience.md`",
        "- `docs/public/packages/md-cli.md`",
        "- `docs/public/concepts/preservation.md`",
        "- `docs/public/concepts/save-truthfulness.md`",
        "- `llms.txt` and `llms-full.txt`",
        "",
        "Prompt rules:",
        "- Include the relevant `docs/public/...` path.",
        "- Preserve Markdown-as-source and no-full-document-rewrite constraints.",
        "- Require real tests or CLI proof, usually `npm run build`, `npm run test:docs`, `npm run test:llms-sync`, or `node packages/md-cli/dist/index.js check --json`.",
        "- Mark public-roadmap features as future unless current package docs prove otherwise."
      ]
    })
  ].filter((generatedSkill) => generatedSkill.sourceDocs.every((doc) => pages.some((page) => `docs/public/${page.path}` === doc)));
}

function skill({ id, description, sourceDocs, packageNames, body }) {
  const path = `${outputRoot}/skills/${id}/SKILL.md`;
  return {
    id,
    description,
    path,
    publicUrl: `${publicAgentBaseUrl}/skills/${id}/SKILL.md`,
    sourceDocs,
    packageNames,
    body
  };
}

function renderAgentIndex(manifest, skillDescriptors, productProfile) {
  return [
    "# Momentarise Markdown Editor Agent Artifacts",
    "",
    "Public, generated discovery files for coding agents and documentation tools.",
    "",
    "## Product Answer",
    "",
    productProfile.summary,
    "",
    "- MME is a framework integrated by developers, not a hosted editor app or CMS.",
    "- Host applications built with MME may serve developers, writers, and non-developers.",
    `- Status: ${productProfile.status.stability} \`${productProfile.status.releaseLine}\`; public npm packages are published under the alpha dist-tag, not latest.`,
    "- Markdown plus optional YAML frontmatter remains canonical persisted source.",
    "",
    "## Start Here",
    "",
    `- [Short framework index](${siteOrigin}/llms.txt)`,
    `- [Full public documentation context](${siteOrigin}/llms-full.txt)`,
    `- [Artifact manifest](${manifest.publicUrl})`,
    `- [Machine-readable product profile](${manifest.productProfileUrl})`,
    `- [Reusable action descriptors](${manifest.actionsUrl})`,
    `- [Rendered documentation](${siteOrigin}/docs)`,
    "",
    "## Skills",
    "",
    ...skillDescriptors.map((skillDescriptor) => `- [${skillDescriptor.id}](${skillDescriptor.publicUrl}): ${skillDescriptor.description}`),
    "",
    "## Trust Boundaries",
    "",
    "- These files are generated from public Markdown, LLM indexes, and package metadata.",
    "- Repository paths remain available in the manifest for local tools; public URLs support web discovery.",
    "- Skills are reference artifacts and are not installed automatically into a global agent configuration.",
    "- Shipped and future actions remain explicitly separated.",
    "- Internal planning files, credentials, and local machine paths are excluded.",
    "",
    `Generated by \`${generatorPath}\`.`,
    ""
  ].join("\n");
}

function renderSkill(skillDescriptor) {
  return [
    "---",
    `name: ${skillDescriptor.id}`,
    `description: ${JSON.stringify(skillDescriptor.description)}`,
    "---",
    "",
    `# ${titleFromPath(`${skillDescriptor.id}.md`)}`,
    "",
    ...skillDescriptor.body,
    ""
  ].join("\n");
}

async function createPage(path) {
  assertSafePublicMarkdownPath(path);
  const source = await readFile(join(publicRoot, path), "utf8");
  const parsed = parsePublicDocsFrontmatter(source);
  const h1 = parsed.body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return {
    description: parsed.metadata.description ?? "",
    metadata: parsed.metadata,
    path,
    source,
    title: parsed.metadata.title ?? h1 ?? titleFromPath(path)
  };
}

async function collectPackageMetadata() {
  const entries = await readdir("packages", { withFileTypes: true });
  const packages = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const manifestPath = `packages/${entry.name}/package.json`;
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const publicDocPath = `docs/public/packages/${entry.name}.md`;
    packages.push({
      description: sanitizeLlmsLineField(manifest.description ?? "", 220),
      manifestPath,
      name: manifest.name,
      publicDocPath: existsSync(publicDocPath) ? publicDocPath : undefined,
      version: manifest.version
    });
  }
  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

async function collectSourceInputs(pages, packages) {
  return {
    publicDocs: pages.map((page) => ({
      path: `docs/public/${page.path}`,
      source: page.source
    })),
    llms: [
      { path: "llms.txt", source: await readFile("llms.txt", "utf8") },
      { path: "llms-full.txt", source: await readFile("llms-full.txt", "utf8") }
    ],
    packages
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

async function writeGeneratedFiles(files) {
  await rm(outputRoot, { recursive: true, force: true });
  for (const [path, content] of files) {
    assertSafeGeneratedOutputPath(path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
}

async function checkGeneratedFiles(files) {
  const expectedPaths = [...files.keys()].sort();
  const actualPaths = existsSync(outputRoot) ? (await collectOutputFiles(outputRoot)).sort() : [];
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    throw new Error(
      `${outputRoot} file list is out of sync. Run: node ${generatorPath}\nActual: ${JSON.stringify(actualPaths)}\nExpected: ${JSON.stringify(expectedPaths)}`
    );
  }
  for (const [path, content] of files) {
    const committed = existsSync(path) ? await readFile(path, "utf8") : "";
    if (committed !== content) {
      throw new Error(`${path} is out of sync with public docs, llms files, or package metadata. Run: node ${generatorPath}`);
    }
  }
}

async function collectOutputFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectOutputFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

function stringifyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertSafeGeneratedOutputPath(path) {
  if (!path.startsWith(`${outputRoot}/`) || path.includes("..") || path.includes("\\")) {
    throw new Error(`Unsafe generated output path: ${path}`);
  }
}
