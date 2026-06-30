import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "scripts/visual-check-mme0017.mjs",
  "scripts/visual-check-mme00285.mjs",
  "docs/internal/visual-checks/MME-0017/README.md",
  "apps/md-demo/src/main.ts",
  "apps/md-demo/src/styles.css",
  "docs/public/AI_PROVIDER_ADAPTER.md",
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
  ["visual:mme-0017", "node scripts/visual-check-mme0017.mjs"],
  ["visual:mme-0028.5", "node scripts/visual-check-mme00285.mjs"],
  ["visual:mme-0028.6", "node scripts/visual-check-mme00286.mjs"]
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
  "AiDemoProviderMode",
  "ai-writing-panel",
  "ai-byok-key-input",
  "ai-provider-mode",
  "ai-provider-endpoint",
  "ai-start-session-button",
  "ai-action-select",
  "ai-prompt-input",
  "ai-generate-button",
  "ai-accept-button",
  "ai-reject-button",
  "configureDemoAiProvider",
  "createOpenAiCompatibleProvider",
  "createMockAiProvider",
  "getAiProviderRuntimeState",
  "session.startAiSession",
  "session.requestAiSuggestion",
  "session.acceptPendingSuggestion",
  "session.rejectPendingSuggestion",
  "getAiWritingState",
  "createInlineAiPrompt",
  "inline-ai-prompt-host",
  "inline-ai-prompt-input",
  "inlineAiProviderState",
  "openInlineAiPromptFromAction",
  "configureHostAiProviderForTest",
  "configurePersonalByokProviderForTest",
  "configureRelativeSecretEndpointForTest",
  "submitInlineAiPrompt",
  "positionInlineAiPrompt",
  "getInlineAiPromptState"
]) {
  if (!main.includes(snippet)) {
    throw new Error(`Demo missing MME-0017 AI writing snippet: ${snippet}`);
  }
}

if (main.includes("setEditorAiSurfaceState({ visible: true });\n  if (activeDocument.kind !== \"markdown\")")) {
  throw new Error("Editor-native AI commands must open the inline prompt first, not the detached assistant panel.");
}

if (main.includes("logEvent(aiByokKeyInput.value") || main.includes("localStorage.setItem(\"momentarise-ai")) {
  throw new Error("Demo must not log or persist the memory-only demo key.");
}

for (const forbidden of [
  "import OpenAI",
  "from \"openai\"",
  "from \"@ai-sdk",
  "keyInputValue",
  "localStorage.setItem(\"mme-ai-provider",
  "localStorage.setItem(\"momentarise-ai-provider",
  "sessionStorage.setItem(\"mme-ai-provider",
  "console.log(apiKey",
  "console.log(aiByokKeyInput.value"
]) {
  if (main.includes(forbidden)) {
    throw new Error(`Demo provider path must not use forbidden snippet: ${forbidden}`);
  }
}

const styles = readFileSync("apps/md-demo/src/styles.css", "utf8");
for (const snippet of [
  ".ai-writing-panel",
  ".ai-writing-controls",
  ".ai-provider-state",
  ".ai-suggestion-preview",
  ".ai-policy-note",
  ".inline-ai-prompt",
  ".inline-ai-prompt-actions",
  ".inline-ai-provider-state",
  ".inline-ai-suggestion-preview"
]) {
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

const inlineVisual = readFileSync("scripts/visual-check-mme00285.mjs", "utf8");
for (const artifact of [
  "inline-ai-prompt-rich.png",
  "inline-ai-suggestion-staged.png",
  "inline-ai-provider-missing.png",
  "inline-ai-policy-blocked.png"
]) {
  if (!inlineVisual.includes(artifact)) {
    throw new Error(`MME-0028.5 visual script missing artifact: ${artifact}`);
  }
}

const providerVisual = readFileSync("scripts/visual-check-mme00286.mjs", "utf8");
for (const artifact of [
  "ai-provider-default-mock.png",
  "ai-provider-host-managed.png",
  "ai-provider-personal-byok-staged.png",
  "ai-provider-policy-blocked.png"
]) {
  if (!providerVisual.includes(artifact)) {
    throw new Error(`MME-0028.6 visual script missing artifact: ${artifact}`);
  }
}

const providerDocs = readFileSync("docs/public/AI_PROVIDER_ADAPTER.md", "utf8");
for (const snippet of [
  "OpenAI-compatible",
  "LiteLLM",
  "host backend",
  "sidecar",
  "secure storage",
  "personal BYOK",
  "memory-only",
  "Document Access Policy"
]) {
  if (!providerDocs.includes(snippet)) {
    throw new Error(`AI provider adapter docs missing required guidance: ${snippet}`);
  }
}
