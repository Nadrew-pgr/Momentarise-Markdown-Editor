import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "scripts/visual-check-mme0017.mjs",
  "docs/internal/visual-checks/MME-0017/README.md",
  "apps/md-demo/src/main.ts",
  "apps/md-demo/src/styles.css",
  "packages/md-ai/src/index.ts"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing MME-0017 required file: ${file}`);
  }
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
for (const [scriptName, expected] of [
  ["test:ai-writing", "npm run build && node tests/ai-writing.test.mjs"],
  ["test:demo-ai-writing", "node tests/demo-ai-writing-baseline.test.mjs"],
  ["visual:mme-0017", "node scripts/visual-check-mme0017.mjs"]
]) {
  if (packageJson.scripts[scriptName] !== expected) {
    throw new Error(`Missing ${scriptName} script.`);
  }
}

if (!packageJson.scripts.test.includes("test:ai-writing")) {
  throw new Error("Root npm test must include AI writing package checks.");
}
if (!packageJson.scripts.test.includes("test:demo-ai-writing")) {
  throw new Error("Root npm test must include demo AI writing checks.");
}

const main = readFileSync("apps/md-demo/src/main.ts", "utf8");
for (const snippet of [
  "ai-writing-panel",
  "ai-byok-key-input",
  "ai-start-session-button",
  "ai-action-select",
  "ai-prompt-input",
  "ai-generate-button",
  "ai-accept-button",
  "ai-reject-button",
  "createMockAiProvider",
  "createAiWritingSession",
  "requestAiSuggestion",
  "policyResolver: demoAiPolicyResolver",
  "getAiWritingState"
]) {
  if (!main.includes(snippet)) {
    throw new Error(`Demo missing MME-0017 AI writing snippet: ${snippet}`);
  }
}

if (main.includes("logEvent(aiByokKeyInput.value") || main.includes("localStorage.setItem(\"momentarise-ai")) {
  throw new Error("Demo must not log or persist the BYOK key.");
}

const styles = readFileSync("apps/md-demo/src/styles.css", "utf8");
for (const snippet of [".ai-writing-panel", ".ai-writing-controls", ".ai-suggestion-preview", ".ai-policy-note"]) {
  if (!styles.includes(snippet)) {
    throw new Error(`Demo styles missing MME-0017 AI UI snippet: ${snippet}`);
  }
}

const visual = readFileSync("scripts/visual-check-mme0017.mjs", "utf8");
for (const artifact of [
  "ai-panel-session-ready.png",
  "ai-suggestion-pending.png",
  "ai-suggestion-accepted.png",
  "ai-policy-blocked.png"
]) {
  if (!visual.includes(artifact)) {
    throw new Error(`MME-0017 visual script missing artifact: ${artifact}`);
  }
}
