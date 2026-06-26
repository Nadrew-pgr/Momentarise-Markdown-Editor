import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "scripts/visual-check-mme0026.mjs",
  "docs/internal/visual-checks/MME-0026/README.md"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing MME-0026 required file: ${file}`);
  }
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

if (packageJson.scripts["test:preferences-demo"] !== "node tests/preferences-demo-baseline.test.mjs") {
  throw new Error("Missing test:preferences-demo script.");
}

if (packageJson.scripts["visual:mme-0026"] !== "node scripts/visual-check-mme0026.mjs") {
  throw new Error("Missing visual:mme-0026 script.");
}

if (!packageJson.scripts.test.includes("test:preferences-demo")) {
  throw new Error("Root npm test must include MME-0026 demo preference checks.");
}

const visualScript = readFileSync("scripts/visual-check-mme0026.mjs", "utf8");
for (const snippet of [
  "setReferenceSurfacePreferencesForTest",
  "getReferenceSurfaceState",
  "userVisible",
  "locks",
  "keymapDelegateToHost",
  "switchEditorMode(\"rich\")",
  "runtime-preferences-debug.png"
]) {
  if (!visualScript.includes(snippet)) {
    throw new Error(`MME-0026 visual script missing snippet: ${snippet}`);
  }
}

const visualReadme = readFileSync("docs/internal/visual-checks/MME-0026/README.md", "utf8");
for (const snippet of [
  "MME_DEMO_URL=http://127.0.0.1:5174/ npm run visual:mme-0026",
  "runtime-preferences-debug.png",
  "debug-host simulation",
  "Headless resolver tests cover the document `mme:` allowlist subset"
]) {
  if (!visualReadme.includes(snippet)) {
    throw new Error(`MME-0026 visual README missing snippet: ${snippet}`);
  }
}
