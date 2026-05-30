import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const buildScript = packageJson.scripts?.build ?? "";
const testScript = packageJson.scripts?.test ?? "";

const expectedBuildPackages = [
  "packages/md-core",
  "packages/md-format",
  "packages/md-save",
  "packages/md-policy",
  "packages/md-source-codemirror",
  "packages/md-adapter-web",
  "packages/md-cli"
];

for (const packagePath of expectedBuildPackages) {
  if (!buildScript.includes(packagePath)) {
    throw new Error(`Build script must include ${packagePath}.`);
  }
}

for (const scriptName of ["test:policy", "test:source-codemirror", "test:alignment"]) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`Missing alignment script: ${scriptName}.`);
  }
}

if (!testScript.includes("test:policy") || !testScript.includes("test:source-codemirror")) {
  throw new Error("Root npm test must include policy and source CodeMirror package checks.");
}

const issues = readFileSync("docs/internal/ISSUES.md", "utf8");
if (!issues.includes("MME-0011.5") || issues.indexOf("MME-0011.5") > issues.indexOf("MME-0012")) {
  throw new Error("MME-0011.5 must exist before MME-0012 in ISSUES.md.");
}

const readme = readFileSync("README.md", "utf8");
if (!readme.includes("MME-0011") || !readme.includes("MME-0011.5")) {
  throw new Error("README must report MME-0011 and the MME-0011.5 alignment gate.");
}

const buildLog = readFileSync("docs/internal/build-log.md", "utf8");
if (!buildLog.includes("## MME-0011.5 — Alignment gate before rich mode")) {
  throw new Error("Build log must include MME-0011.5 before rich mode starts.");
}
for (const required of [
  "Alignment matrix",
  "code-complete/pending human review",
  "docs/internal/visual-checks/MME-0011.5/unsupported-local-file-state.png",
  "MME_VISUAL_DIR=docs/internal/visual-checks/MME-0011.5"
]) {
  if (!buildLog.includes(required)) {
    throw new Error(`MME-0011.5 build-log entry missing ${required}.`);
  }
}

const visualPortability = readFileSync("tests/visual-chrome-portability.test.mjs", "utf8");
if (!visualPortability.includes("scripts/visual-check-mme0011.mjs")) {
  throw new Error("Visual Chrome portability test must cover MME-0011.");
}

const demo = readFileSync("apps/md-demo/src/main.ts", "utf8");
if (demo.includes("<p><span>Fixture</span><strong data-testid=\"roundtrip-fixture\"")) {
  throw new Error("Round-trip panel must not label every active document as Fixture.");
}
if (!demo.includes("showUnsupportedLocalFileState")) {
  throw new Error("Demo must expose a first-class unsupported local file state.");
}
if (!demo.includes("properties-overflow-note")) {
  throw new Error("Properties list truncation must be visible instead of silent.");
}
