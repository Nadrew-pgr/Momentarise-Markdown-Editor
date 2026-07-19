import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
assertScript("generate:large-performance-fixture");
assertScript("benchmark:performance");
assertScript("test:performance-budgets");
assert(rootPackage.scripts.test.includes("npm run test:performance-budgets"), "root npm test must include performance budget tests.");

await execFileAsync(process.execPath, ["scripts/generate-large-performance-fixture.mjs", "--check"], {
  cwd: process.cwd(),
  maxBuffer: 10 * 1024 * 1024
});

const fixturePath = "fixtures/021-large-performance/input.md";
const expectationsPath = "fixtures/021-large-performance/expectations.md";
const fixture = await readText(fixturePath);
const expectations = await readText(expectationsPath);
const lines = fixture.split("\n");
assert(lines.length >= 10_000, `large fixture must have at least 10k lines, got ${lines.length}.`);
for (const required of [
  "---\n",
  "# Large Performance Fixture",
  "## Performance section 0042",
  "- [ ] Todo item 0042",
  "| Metric | Value | Notes |",
  "```ts",
  "```mermaid",
  "[relative link](./section-0042.md)",
  "<section data-mme-performance=\"0042\">",
  "> [!NOTE] Section 0042",
  "[^perf-0042]",
  "[^perf-0042]:",
  "::mme-opaque{#perf-0042}"
]) {
  assert(fixture.includes(required), `large fixture must include ${required}.`);
}
for (const required of ["10k-line", "preserve", "normalized", "opaque", "source-only", "render"]) {
  assert(expectations.toLowerCase().includes(required), `large fixture expectations must mention ${required}.`);
}

const budgets = JSON.parse(await readText("docs/internal/performance-budgets.json"));
assert(budgets.schema === "https://momentarise.dev/schemas/performance-budgets.v0.json", "budget schema must be stable.");
assert(budgets.fixture === fixturePath, "budgets must point at the committed large fixture.");
assert(budgets.command === "npm run test:performance-budgets", "budget check command must enforce budgets.");
assert(budgets.reportCommand === "npm run benchmark:performance", "budget report command must be documented separately.");
assert(Array.isArray(budgets.docsPublicFiles), "budgets must declare bounded public docs render files.");
assert(budgets.docsPublicFiles.includes("docs/public/concepts/performance.md"), "docs public render must include the performance page.");
const requiredOperations = [
  "parseLargeDocument",
  "serializeLargeDocument",
  "richMountLargeDocument",
  "richSerializeLargeDocument",
  "renderHtmlLargeDocument",
  "outlineLargeDocument",
  "findReplaceLargeDocument",
  "saveHashLargeDocument",
  "saveAutosaveTruth",
  "docsPublicRender"
];
for (const operation of requiredOperations) {
  assert(Number.isFinite(budgets.operations?.[operation]?.maxMs), `${operation} must have a numeric maxMs budget.`);
}

const benchmarkSource = await readText("scripts/performance-benchmarks.mjs");
for (const required of [
  "performance.now",
  "docs/internal/performance-budgets.json",
  "budgets.fixture",
  "createMarkdownAstParser",
  "createMarkdownAstFormatter",
  "createRichMarkdownState",
  "serializeRichMarkdownState",
  "renderMarkdownToHtml",
  "createMarkdownEditorSession",
  "createSaveEngine",
  "--check"
]) {
  assert(benchmarkSource.includes(required), `benchmark script must include ${required}.`);
}

const benchmark = JSON.parse((await execFileAsync(process.execPath, ["scripts/performance-benchmarks.mjs", "--json"], {
  cwd: process.cwd(),
  maxBuffer: 20 * 1024 * 1024
})).stdout);
assert(benchmark.status === "pass", `benchmark JSON must pass current budgets: ${JSON.stringify(benchmark.summary)}`);
for (const operation of requiredOperations) {
  const result = benchmark.operations.find((entry) => entry.id === operation);
  assert(result, `benchmark output must include ${operation}.`);
  assert(result.status === "pass", `${operation} must pass its budget.`);
  assert(Number.isFinite(result.durationMs), `${operation} must report numeric durationMs.`);
  assert(result.durationMs <= result.budgetMs, `${operation} duration must be within budget.`);
}

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const editor = await import("../packages/md-editor/dist/index.js");
const state = rich.createRichMarkdownState(fixture, { dialect: "momentarise-enhanced" });
const edited = rich.replaceFirstRichText(state, "Performance section 0042", "Performance section 0042 edited");
const output = rich.serializeRichMarkdownState(edited).content;
const editedLineIndex = fixture.split("\n").findIndex((line) => line === "## Performance section 0042");
assert(editedLineIndex >= 0, "large fixture target heading must exist once.");
assert(fixture.split("\n").filter((line) => line === "## Performance section 0042").length === 1, "large fixture target heading must stay unique.");
assert(output.includes("## Performance section 0042 edited"), "large fixture targeted rich edit must apply.");
assertEveryLineExcept(
  fixture,
  output,
  (_, index) => index === editedLineIndex,
  "large fixture rich edit must preserve unrelated source lines"
);

const target = save.createMemorySaveTarget({ initialContent: fixture, targetLabel: "memory://large-performance.md" });
const engine = save.createSaveEngine({
  autosaveDelayMs: 500,
  content: fixture,
  now: new Date("2026-07-19T00:00:00.000Z"),
  target
});
engine.updateContent(output, { now: new Date("2026-07-19T00:00:01.000Z") });
assert(engine.shouldAutosave(new Date("2026-07-19T00:00:01.250Z")) === false, "autosave must not fire before debounce budget.");
assert(engine.shouldAutosave(new Date("2026-07-19T00:00:01.500Z")) === true, "autosave must fire after debounce budget.");
const saved = await engine.flush({ now: new Date("2026-07-19T00:00:01.600Z"), reason: "autosave" });
assert(saved.status === "saved", `large fixture autosave must save truthfully, got ${saved.status}.`);
assert(saved.state.currentHash === save.hashMarkdownContent(output), "saved state current hash must match output content.");
assert(saved.state.lastSavedHash === save.hashMarkdownContent(output), "saved state last saved hash must match output content.");
assert(target.readContent() === output, "memory target must contain the autosaved output.");

const session = editor.createMarkdownEditorSession({
  content: fixture,
  path: fixturePath,
  scheduler: {
    schedule() {
      return () => {};
    }
  },
  target: save.createMemorySaveTarget({ initialContent: fixture })
});
try {
  assert(countOutlineItems(session.getOutline()) >= 250, "large fixture outline must include generated sections.");
  assert(session.find("Performance section").length >= 250, "large fixture find must index generated headings.");
} finally {
  session.destroy();
}

const performanceDoc = await readText("docs/public/concepts/performance.md");
for (const required of [
  "npm run test:performance-budgets",
  "npm run benchmark:performance",
  "10k-line",
  "performance-budgets.json",
  "residual risks"
]) {
  assert(performanceDoc.toLowerCase().includes(required), `performance doc must document ${required}.`);
}

async function readText(path) {
  assert(existsSync(path), `${path} must exist.`);
  return readFile(path, "utf8");
}

function assertScript(name) {
  assert(rootPackage.scripts?.[name], `package.json must define ${name}.`);
}

function assertEveryLineExcept(input, output, isEditedLine, label) {
  const inputLines = input.split("\n");
  const outputLines = output.split("\n");
  if (inputLines.length !== outputLines.length) {
    throw new Error(`${label}: line count changed from ${inputLines.length} to ${outputLines.length}.`);
  }
  for (let index = 0; index < inputLines.length; index += 1) {
    if (isEditedLine(inputLines[index], index)) {
      continue;
    }
    if (inputLines[index] !== outputLines[index]) {
      throw new Error(
        `${label}: line ${index + 1} changed.\ninput:  ${JSON.stringify(inputLines[index])}\noutput: ${JSON.stringify(outputLines[index])}`
      );
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function countOutlineItems(items) {
  return items.reduce((count, item) => count + 1 + countOutlineItems(item.children ?? []), 0);
}
