import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const root = process.cwd();
const apiUrl = "https://api.anthropic.com/v1/messages";
const defaultModel = "claude-fable-5";
const outputDir = "docs/internal/ai-reviews";
const maxFileChars = 45_000;
const maxDiffChars = 90_000;
const maxBuildLogChars = 45_000;

const requiredDocs = [
  "AGENT.md",
  "README.md",
  "docs/internal/PRD.md",
  "docs/internal/QUALITY_GATES.md",
  "docs/internal/ISSUES.md"
];

const relevantFiles = [
  "package.json",
  "apps/md-demo/src/main.ts",
  "apps/md-demo/src/reference-surface.ts",
  "apps/md-demo/src/styles.css",
  "packages/md-ai/src/index.ts",
  "packages/md-core/src/index.ts",
  "packages/md-policy/src/index.ts",
  "packages/md-rich-prosemirror/src/index.ts",
  "packages/md-source-codemirror/src/index.ts",
  "tests/demo-reference-surface-baseline.test.mjs",
  "tests/ai-writing.test.mjs",
  "tests/demo-ai-writing-baseline.test.mjs"
];

const args = parseArgs(process.argv.slice(2));
await loadLocalEnv(".env.local");
await loadLocalEnv(".env");

const model = process.env.CLAUDE_REVIEW_MODEL || defaultModel;
const maxTokens = Number.parseInt(process.env.CLAUDE_REVIEW_MAX_TOKENS || "12000", 10);

if (args.help) {
  printHelp();
  process.exit(0);
}

const contextPacket = await buildContextPacket();
const prompt = buildReviewerPrompt(contextPacket, args.focus);

if (args.dryRun) {
  const outputPath = await writeReport(
    `# Claude framework review dry run\n\nModel: \`${model}\`\n\nNo API call was made.\n\n## Prompt preview\n\n${fence(prompt.slice(0, 18000), "md")}\n`
  );
  console.log(`Dry run wrote ${outputPath}`);
  process.exit(0);
}

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error(
    "Missing ANTHROPIC_API_KEY. Copy .env.example to .env.local, set the key, or run npm run ai:review:dry-run."
  );
}

const response = await fetch(apiUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01"
  },
  body: JSON.stringify({
    model,
    max_tokens: maxTokens,
    system:
      "You are a senior framework reviewer. Be direct, rigorous, and specific. Prioritize correctness, architecture, tests, UX quality, and docs/code drift. Do not invent files you have not seen.",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  })
});

const responseText = await response.text();

if (!response.ok) {
  throw new Error(`Claude API request failed with HTTP ${response.status}: ${redactSecrets(responseText)}`);
}

const payload = JSON.parse(responseText);
const reviewText = extractText(payload);

const outputPath = await writeReport(
  `# Claude framework review\n\nModel: \`${model}\`\n\nGenerated: ${new Date().toISOString()}\n\n${reviewText}\n`
);

console.log(`Claude review wrote ${outputPath}`);

function parseArgs(argv) {
  const parsed = {
    dryRun: false,
    help: false,
    focus: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--focus") {
      parsed.focus = argv[index + 1] || "";
      index += 1;
    } else {
      parsed.focus = parsed.focus ? `${parsed.focus} ${arg}` : arg;
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage:
  npm run ai:review:dry-run
  npm run ai:review:claude
  npm run ai:review:claude -- --focus "Review MME-0018 UI and AI entry points"

Environment:
  ANTHROPIC_API_KEY        Required unless --dry-run is used
  CLAUDE_REVIEW_MODEL      Defaults to ${defaultModel}
  CLAUDE_REVIEW_MAX_TOKENS Defaults to 12000
`);
}

async function buildContextPacket() {
  const sections = [];

  for (const filePath of requiredDocs) {
    sections.push(await readSection(filePath, maxFileChars));
  }

  sections.push(await readTailSection("docs/internal/build-log.md", maxBuildLogChars));
  sections.push(await gitSection("git status --short", ["status", "--short"], 20_000));
  sections.push(await gitSection("git diff --stat", ["diff", "--stat"], 20_000));
  sections.push(await gitSection("git diff", ["diff"], maxDiffChars));

  for (const filePath of relevantFiles) {
    sections.push(await readOptionalSection(filePath, maxFileChars));
  }

  return sections.filter(Boolean).join("\n\n");
}

function buildReviewerPrompt(contextPacket, focus) {
  return `Review the Momentarise Markdown Editor framework.

Focus: ${focus || "current working-tree quality, docs/code drift, MME-0018 reference editor surface, AI reviewer/product AI boundaries, and next upgrade path toward BlockNote/Tiptap/Notion-level framework quality."}

Rules:
- Treat Markdown as the durable source of truth.
- Do not recommend core dependencies on Anthropic, React, CodeMirror, ProseMirror, Theia, browser APIs, or provider SDKs unless they belong in the correct package/adapter.
- Separate product AI from internal AI review tooling.
- Prioritize BlockNote/Tiptap/Notion/Obsidian-class editor quality, but keep recommendations concrete for this repo.
- Be strict about tests, visual verification, save truthfulness, unknown syntax preservation, policy, and adapter boundaries.
- If a point is hypothetical product vision rather than docs/code drift, put it in a separate Hypotheses section.
- Output a matrix: gap -> priority -> evidence -> decision/recommendation -> file/issue target.
- Include a short "Apply next" section with the smallest safe sequence.

Context packet:

${contextPacket}`;
}

async function readSection(filePath, limit) {
  const content = await readFile(path.join(root, filePath), "utf8");
  return section(filePath, truncate(content, limit));
}

async function readOptionalSection(filePath, limit) {
  try {
    return await readSection(filePath, limit);
  } catch {
    return "";
  }
}

async function readTailSection(filePath, limit) {
  const content = await readFile(path.join(root, filePath), "utf8");
  return section(`${filePath} tail`, tail(content, limit));
}

async function gitSection(label, gitArgs, limit) {
  try {
    const { stdout, stderr } = await execFileAsync("git", gitArgs, {
      cwd: root,
      maxBuffer: 4 * 1024 * 1024
    });
    const output = `${stdout}${stderr ? `\n${stderr}` : ""}`;
    return section(label, truncate(output, limit));
  } catch (error) {
    return section(label, `Unable to collect ${label}: ${error.message}`);
  }
}

function section(label, content) {
  return `## ${label}\n\n${fence(redactSecrets(content), guessFenceLanguage(label))}`;
}

function fence(content, language = "") {
  return `\`\`\`${language}\n${content}\n\`\`\``;
}

function guessFenceLanguage(label) {
  if (label.endsWith(".ts")) return "ts";
  if (label.endsWith(".mjs") || label.endsWith(".js")) return "js";
  if (label.endsWith(".json")) return "json";
  if (label.endsWith(".css")) return "css";
  if (label.endsWith(".md") || label.includes("build-log")) return "md";
  if (label.startsWith("git ")) return "txt";
  return "";
}

function truncate(content, limit) {
  if (content.length <= limit) return content;
  return `${content.slice(0, limit)}\n\n[TRUNCATED ${content.length - limit} chars]`;
}

function tail(content, limit) {
  if (content.length <= limit) return content;
  return `[TAIL TRUNCATED ${content.length - limit} leading chars]\n\n${content.slice(content.length - limit)}`;
}

function redactSecrets(content) {
  return content
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[REDACTED_ANTHROPIC_KEY]")
    .replace(/ANTHROPIC_API_KEY\s*=\s*[^\s"'`]+/g, "ANTHROPIC_API_KEY=[REDACTED]")
    .replace(/(api[_-]?key["']?\s*[:=]\s*["'])[A-Za-z0-9._-]{16,}(["'])/gi, "$1[REDACTED]$2");
}

async function loadLocalEnv(filePath) {
  const absolutePath = path.join(root, filePath);
  try {
    const content = await readFile(absolutePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  } catch {
    // Local env files are optional. Missing files are expected on clean checkouts.
  }
}

function extractText(payload) {
  if (!Array.isArray(payload.content)) {
    return fence(JSON.stringify(payload, null, 2), "json");
  }

  const text = payload.content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n\n")
    .trim();

  return text || fence(JSON.stringify(payload, null, 2), "json");
}

async function writeReport(content) {
  await mkdir(path.join(root, outputDir), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `claude-framework-review-${stamp}.md`);
  await writeFile(path.join(root, outputPath), content, "utf8");
  return outputPath;
}
