import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function readRepoFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function assertFile(relativePath) {
  try {
    const info = await stat(path.join(root, relativePath));
    if (!info.isFile()) {
      throw new Error(`${relativePath} exists but is not a file.`);
    }
  } catch (error) {
    throw new Error(`Missing required Claude reviewer tooling file: ${relativePath}`);
  }
}

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`${label} must include ${expected}.`);
  }
}

function assertDoesNotInclude(source, forbidden, label) {
  if (source.includes(forbidden)) {
    throw new Error(`${label} must not include ${forbidden}.`);
  }
}

await assertFile(".env.example");
await assertFile("CLAUDE.md");
await assertFile("scripts/claude-framework-review.mjs");
await assertFile("docs/internal/AI_REVIEWER.md");
await assertFile("docs/internal/ai-reviews/README.md");
await assertFile("docs/internal/ai-reviews/.gitignore");

const gitignore = await readRepoFile(".gitignore");
assertIncludes(gitignore, ".env", ".gitignore");
assertIncludes(gitignore, ".env.*", ".gitignore");
assertIncludes(gitignore, "!.env.example", ".gitignore");

const envExample = await readRepoFile(".env.example");
assertIncludes(envExample, "ANTHROPIC_API_KEY=", ".env.example");
assertIncludes(envExample, "CLAUDE_REVIEW_MODEL=claude-fable-5", ".env.example");
assertDoesNotInclude(envExample, "sk-ant-", ".env.example");

const claudeMd = await readRepoFile("CLAUDE.md");
assertIncludes(claudeMd, "AGENT.md", "CLAUDE.md");
assertIncludes(claudeMd, "npm run ai:review:claude", "CLAUDE.md");
assertIncludes(claudeMd, "not product AI", "CLAUDE.md");

const packageJson = JSON.parse(await readRepoFile("package.json"));
assertIncludes(
  packageJson.scripts["ai:review:claude"] ?? "",
  "scripts/claude-framework-review.mjs",
  "package.json scripts.ai:review:claude"
);
assertIncludes(
  packageJson.scripts["ai:review:dry-run"] ?? "",
  "--dry-run",
  "package.json scripts.ai:review:dry-run"
);
assertIncludes(
  packageJson.scripts["test:ai-reviewer-tooling"] ?? "",
  "tests/claude-reviewer-tooling.test.mjs",
  "package.json scripts.test:ai-reviewer-tooling"
);

const reviewerScript = await readRepoFile("scripts/claude-framework-review.mjs");
assertIncludes(reviewerScript, "https://api.anthropic.com/v1/messages", "Claude reviewer script");
assertIncludes(reviewerScript, "claude-fable-5", "Claude reviewer script");
assertIncludes(reviewerScript, "ANTHROPIC_API_KEY", "Claude reviewer script");
assertIncludes(reviewerScript, "--dry-run", "Claude reviewer script");
assertIncludes(reviewerScript, "docs/internal/ai-reviews", "Claude reviewer script");
assertDoesNotInclude(reviewerScript, "console.log(apiKey", "Claude reviewer script");
assertDoesNotInclude(reviewerScript, "console.error(apiKey", "Claude reviewer script");

const reviewIgnore = await readRepoFile("docs/internal/ai-reviews/.gitignore");
assertIncludes(reviewIgnore, "*", "docs/internal/ai-reviews/.gitignore");
assertIncludes(reviewIgnore, "!README.md", "docs/internal/ai-reviews/.gitignore");
assertIncludes(reviewIgnore, "!.gitignore", "docs/internal/ai-reviews/.gitignore");

const docs = await readRepoFile("docs/internal/AI_REVIEWER.md");
assertIncludes(docs, "claude-fable-5", "AI reviewer docs");
assertIncludes(docs, "ANTHROPIC_API_KEY", "AI reviewer docs");
assertIncludes(docs, "not product AI", "AI reviewer docs");
