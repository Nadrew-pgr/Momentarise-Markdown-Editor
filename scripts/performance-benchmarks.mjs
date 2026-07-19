import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";

const checkMode = process.argv.includes("--check");
const jsonMode = process.argv.includes("--json") || checkMode;

const budgetsPath = "docs/internal/performance-budgets.json";
const budgets = JSON.parse(await readFile(budgetsPath, "utf8"));
const largeFixture = await readFile(budgets.fixture, "utf8");

const format = await import("../packages/md-format/dist/index.js");
const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const render = await import("../packages/md-render-html/dist/index.js");
const editor = await import("../packages/md-editor/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");

const operations = [];
let parseResult;
let richState;

await measure("parseLargeDocument", () => {
  parseResult = format.createMarkdownAstParser().parse(largeFixture, { dialect: "momentarise-enhanced" });
  return { diagnostics: parseResult.diagnostics.length };
});

await measure("serializeLargeDocument", () => {
  const result = format.createMarkdownAstFormatter().serialize(parseResult);
  if (result.content !== largeFixture) {
    throw new Error("Large fixture identity serialization changed content.");
  }
  return { bytes: result.content.length };
});

await measure("richMountLargeDocument", () => {
  richState = rich.createRichMarkdownState(largeFixture, { dialect: "momentarise-enhanced" });
  return { diagnostics: richState.diagnostics.length };
});

await measure("richSerializeLargeDocument", () => {
  const result = rich.serializeRichMarkdownState(richState);
  if (result.content !== largeFixture) {
    throw new Error("Untouched large rich serialization changed content.");
  }
  return { bytes: result.content.length };
});

await measure("renderHtmlLargeDocument", () => {
  const result = render.renderMarkdownToHtml(largeFixture, { fileName: budgets.fixture });
  if (!result.html.includes("Large Performance Fixture")) {
    throw new Error("Large fixture HTML render did not include the title.");
  }
  return { bytes: result.html.length, diagnostics: result.diagnostics.length };
});

await measure("outlineLargeDocument", () => {
  const session = createSession(largeFixture);
  try {
    const outline = session.getOutline();
    const outlineItems = countOutlineItems(outline);
    if (outlineItems < 250) {
      throw new Error(`Large fixture outline is unexpectedly small: ${outlineItems}`);
    }
    return { outlineItems };
  } finally {
    session.destroy();
  }
});

await measure("findReplaceLargeDocument", () => {
  const session = createSession(largeFixture);
  try {
    const matches = session.find("Performance section 0042");
    if (matches.length !== 1) {
      throw new Error(`Expected one section 0042 match, got ${matches.length}`);
    }
    const result = session.replace(matches[0], "Performance section 0042 benchmarked", "host");
    if (result.replaced !== 1 || !result.content.includes("Performance section 0042 benchmarked")) {
      throw new Error("Large fixture replace did not apply.");
    }
    assertEveryLineExcept(
      largeFixture,
      result.content,
      (_, index) => index === lineIndexForOffset(largeFixture, matches[0].from),
      "Large fixture session replace rewrote unrelated source."
    );
    return { matches: matches.length, bytes: result.content.length };
  } finally {
    session.destroy();
  }
});

await measure("saveHashLargeDocument", () => {
  const hash = save.hashMarkdownContent(largeFixture);
  if (!hash.startsWith("fnv1a64:")) {
    throw new Error(`Unexpected hash: ${hash}`);
  }
  return { hash };
});

await measure("saveAutosaveTruth", async () => {
  const edited = largeFixture.replace("Performance section 0042", "Performance section 0042 saved");
  const target = save.createMemorySaveTarget({ initialContent: largeFixture });
  const engine = save.createSaveEngine({
    autosaveDelayMs: 500,
    content: largeFixture,
    now: new Date("2026-07-19T00:00:00.000Z"),
    target
  });
  engine.updateContent(edited, { now: new Date("2026-07-19T00:00:01.000Z") });
  if (engine.shouldAutosave(new Date("2026-07-19T00:00:01.250Z"))) {
    throw new Error("Autosave fired before its debounce window.");
  }
  if (!engine.shouldAutosave(new Date("2026-07-19T00:00:01.500Z"))) {
    throw new Error("Autosave did not fire after its debounce window.");
  }
  const flushed = await engine.flush({ now: new Date("2026-07-19T00:00:01.600Z"), reason: "autosave" });
  if (flushed.status !== "saved") {
    throw new Error(`Autosave flush did not save: ${flushed.status}`);
  }
  const expectedHash = save.hashMarkdownContent(edited);
  if (flushed.state.currentHash !== expectedHash || flushed.state.lastSavedHash !== expectedHash) {
    throw new Error("Autosave flush hashes did not match edited content.");
  }
  if (target.readContent() !== edited) {
    throw new Error("Autosave target did not receive edited content.");
  }
  return { status: flushed.status, writes: target.writeCount() };
});

await measure("docsPublicRender", async () => {
  const docs = budgets.docsPublicFiles ?? ["docs/public/concepts/performance.md"];
  let renderedBytes = 0;
  for (const doc of docs) {
    renderedBytes += render.renderMarkdownToHtml(await readFile(doc, "utf8"), { fileName: doc }).html.length;
  }
  return { docs: docs.length, bytes: renderedBytes };
});

const failed = operations.filter((operation) => operation.status !== "pass");
const report = {
  schema: "https://momentarise.dev/schemas/performance-report.v0.json",
  budgetsPath,
  fixture: budgets.fixture,
  generatedAt: new Date(0).toISOString(),
  status: failed.length === 0 ? "pass" : "fail",
  summary: {
    failed: failed.length,
    total: operations.length
  },
  operations
};

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  for (const operation of operations) {
    process.stdout.write(`${operation.status.toUpperCase()} ${operation.id}: ${operation.durationMs.toFixed(2)}ms / ${operation.budgetMs}ms\n`);
  }
}

if (checkMode && failed.length > 0) {
  process.exitCode = 1;
}

async function measure(id, fn) {
  const budget = budgets.operations?.[id];
  if (!budget || !Number.isFinite(budget.maxMs)) {
    throw new Error(`Missing performance budget for ${id}.`);
  }
  const start = performance.now();
  let metadata = {};
  let error;
  try {
    metadata = (await fn()) ?? {};
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  const durationMs = performance.now() - start;
  operations.push({
    id,
    budgetMs: budget.maxMs,
    description: budget.description,
    durationMs: Number(durationMs.toFixed(3)),
    status: !error && durationMs <= budget.maxMs ? "pass" : "fail",
    ...(error ? { error } : {}),
    metadata
  });
}

function createSession(content) {
  return editor.createMarkdownEditorSession({
    content,
    path: budgets.fixture,
    scheduler: {
      schedule() {
        return () => {};
      }
    },
    target: save.createMemorySaveTarget({ initialContent: content })
  });
}

function countOutlineItems(items) {
  return items.reduce((count, item) => count + 1 + countOutlineItems(item.children ?? []), 0);
}

function lineIndexForOffset(source, offset) {
  return source.slice(0, offset).split("\n").length - 1;
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
      throw new Error(`${label}: line ${index + 1} changed.`);
    }
  }
}
