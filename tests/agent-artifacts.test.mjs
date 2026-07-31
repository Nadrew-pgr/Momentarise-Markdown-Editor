import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const rootPackage = await readJson("package.json");
assertScript("generate:agent-artifacts");
assertScript("test:agent-artifacts");
assert(
  rootPackage.scripts.test.includes("npm run test:agent-artifacts"),
  "root npm test must include test:agent-artifacts."
);

await execFileAsync(process.execPath, ["scripts/generate-agent-artifacts.mjs", "--check"], {
  cwd: process.cwd(),
  maxBuffer: 10 * 1024 * 1024
});

const manifest = await readJson("docs/agent/manifest.json");
const actions = await readJson("docs/agent/actions.json");

assert(manifest.schema === "https://momentarise.dev/schemas/agent-artifacts.v0.json", "agent manifest schema must be stable.");
assert(manifest.generatedBy === "scripts/generate-agent-artifacts.mjs", "manifest must record the generator.");
assert(manifest.sourceBoundary === "public-docs-only", "manifest must be public-docs-only.");
assert(manifest.sources.publicDocsRoot === "docs/public", "manifest must derive from docs/public.");
assertDeepEqual(manifest.sources.llms, ["llms.txt", "llms-full.txt"], "manifest must derive from llms outputs.");
assert(
  typeof manifest.sources.inputHash === "string" && /^[a-f0-9]{64}$/.test(manifest.sources.inputHash),
  "manifest must include a stable input hash."
);
assert(manifest.actionsPath === "docs/agent/actions.json", "manifest must point to reusable action descriptors.");

const requiredSkills = [
  "mme-adoption-evaluation",
  "mme-docs",
  "mme-migration-help",
  "mme-package-selection",
  "mme-ai-privacy-boundary",
  "mme-docs-to-implementation"
];
const skillsById = new Map(manifest.skills.map((skill) => [skill.id, skill]));
for (const skillId of requiredSkills) {
  const skill = skillsById.get(skillId);
  assert(skill, `manifest must include ${skillId}.`);
  assert(skill.path === `docs/agent/skills/${skillId}/SKILL.md`, `${skillId} path must be repository-owned.`);
  assert(Array.isArray(skill.sourceDocs) && skill.sourceDocs.every((path) => path.startsWith("docs/public/")), `${skillId} must cite public docs.`);
  assert(!JSON.stringify(skill).includes("docs/internal"), `${skillId} metadata must not expose internal docs.`);
  const source = await readText(skill.path);
  assert(source.startsWith("---\n"), `${skillId} must be a Codex-style SKILL.md.`);
  assert(source.includes(`name: ${skillId}`), `${skillId} frontmatter must use the skill id.`);
  assert(source.includes("description:"), `${skillId} must include a description trigger.`);
  assert(source.includes("docs/public/"), `${skillId} must point agents to public Markdown docs.`);
  assert(source.includes("llms.txt"), `${skillId} must point agents to llms.txt.`);
  assert(source.includes("llms-full.txt"), `${skillId} must point agents to llms-full.txt.`);
  assert(!source.includes("TODO"), `${skillId} must not keep template TODOs.`);
}

assert(manifest.productProfilePath === "docs/agent/product.json", "manifest must point to the product profile.");
assert(
  manifest.productProfileUrl === "https://momentarise.dev/agent/product.json",
  "manifest must expose the product profile URL."
);
const productProfile = await readJson(manifest.productProfilePath);
assert(
  productProfile.sourceHash === manifest.sources.inputHash,
  "product profile must share the manifest input hash."
);
assert(productProfile.sourceBoundary === "public-docs-and-package-metadata", "product profile boundary must be explicit.");
assert(productProfile.status.publicNpmPublished === true, "product profile must keep npm publication truth.");
assert(productProfile.status.npmDistTag === "alpha", "product profile must state the current npm dist-tag.");
assert(productProfile.notShipped.includes("Payload CMS adapter"), "product profile must keep Payload unshipped.");
assert(
  productProfile.audiences.boundary.includes("host applications"),
  "product profile must distinguish adopters from host-app end users."
);
assert(
  productProfile.sourceDocs.every((path) => path.startsWith("docs/public/")),
  "product profile must cite only public docs."
);

const packageSelection = skillsById.get("mme-package-selection");
assert(packageSelection.packageNames.length >= 8, "package selection skill must derive from package metadata.");
assert(packageSelection.sourceDocs.includes("docs/public/packages/md-cli.md"), "package selection must reference package docs.");

assert(actions.schema === "https://momentarise.dev/schemas/agent-actions.v0.json", "action descriptor schema must be stable.");
assert(actions.generatedBy === manifest.generatedBy, "actions must record the same generator.");
assert(actions.sourceHash === manifest.sources.inputHash, "actions must share the manifest input hash.");
assert(actions.sourceBoundary === "public-docs-only", "actions must be public-docs-only.");

const requiredActions = new Map([
  ["view-source", "shipped"],
  ["copy-markdown", "shipped"],
  ["copy-section", "shipped"],
  ["copy-prompt", "shipped"],
  ["copy-link", "shipped"],
  ["open-in-chat", "shipped"],
  ["edit-on-github", "future"],
  ["file-issue", "future"],
  ["ask-this-page", "future"]
]);
const actionsById = new Map(actions.pageActions.map((action) => [action.id, action]));
for (const [actionId, availability] of requiredActions) {
  const action = actionsById.get(actionId);
  assert(action, `actions must include ${actionId}.`);
  assert(action.availability === availability, `${actionId} availability must be ${availability}.`);
  assert(action.payload?.kind, `${actionId} must include a payload kind.`);
  assert(!JSON.stringify(action).includes("docs/internal"), `${actionId} must not expose internal docs.`);
}
assert(actions.openInChatTargets.some((target) => target.id === "codex"), "open-in-chat targets must include Codex copy fallback.");
assert(actions.openInChatTargets.some((target) => target.id === "chatgpt"), "open-in-chat targets must include ChatGPT.");
for (const target of actions.openInChatTargets) {
  assert(target.availability === "shipped", `${target.id} open-in-chat target must declare shipped availability.`);
}

const generatedFiles = await collectFiles("docs/agent");
for (const file of generatedFiles) {
  const source = await readText(file);
  assert(!source.includes("docs/internal"), `${file} must not expose internal docs.`);
  assert(!source.includes(".env"), `${file} must not mention local env files.`);
  assert(!source.includes("AGENT.md"), `${file} must not expose internal build instructions.`);
}

const agentActionsSource = await readText("apps/docs-site/src/agent-actions.ts");
const docActionsSource = await readText("apps/docs-site/src/DocActions.tsx");
const docsPageViewSource = await readText("apps/docs-site/src/DocsPageView.tsx");
assert(agentActionsSource.includes("docs/agent/actions.json"), "docs site must load reusable action descriptors.");
assert(agentActionsSource.includes("actionsRegistryJson"), "docs site action registry must use a static generated JSON import.");
assert(!agentActionsSource.includes("readFileSync"), "docs site action registry must not depend on runtime filesystem reads.");
assert(!agentActionsSource.includes("process.cwd()"), "docs site action registry must not depend on cwd.");
assert(agentActionsSource.includes("assertAgentActionRegistry"), "docs site must validate the action registry before rendering.");
assert(docsPageViewSource.includes("getDocsAgentActionRegistry"), "docs page view must pass generated action descriptors.");
assert(docActionsSource.includes("actionRegistry"), "DocActions must render from an action registry prop.");
assert(docActionsSource.includes('target.availability === "shipped"'), "DocActions must render only shipped open-in-chat targets.");
assert(!docActionsSource.includes("./open-in-chat"), "DocActions must not own the open-in-chat registry.");

const axGuide = await readText("docs/public/concepts/agentic-experience.md");
for (const required of [
  "docs/agent/manifest.json",
  "docs/agent/actions.json",
  "docs/agent/skills",
  "not installed automatically"
]) {
  assert(axGuide.includes(required), `Agentic Experience guide must document ${required}.`);
}
assert(
  !axGuide.includes("Generated Codex skills, reusable agent action descriptors, hosted Ask AI"),
  "Agentic Experience guide must not describe generated skills/action descriptors as future work after MME-0049."
);

function assertScript(name) {
  assert(rootPackage.scripts?.[name], `package.json must define ${name}.`);
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function readText(path) {
  assert(existsSync(path), `${path} must exist.`);
  return readFile(path, "utf8");
}

async function collectFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files.sort();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nActual: ${JSON.stringify(actual)}\nExpected: ${JSON.stringify(expected)}`);
  }
}
