import {
  createDownloadRequiredSaveTarget,
  createMemorySaveTarget,
  createSaveEngine,
  hashMarkdownContent,
  persistenceTargetLabel
} from "../packages/md-save/dist/index.js";

const initialContent = "# Save Engine\n\nInitial body.\n";
const editedContent = "# Save Engine\n\nEdited body.\n";
const secondEdit = "# Save Engine\n\nSecond edit.\n";

const memoryTarget = createMemorySaveTarget({
  initialContent,
  targetLabel: "fixture://source-mode-fixture.md"
});
const engine = createSaveEngine({
  autosaveDelayMs: 1000,
  content: initialContent,
  now: date("2026-05-30T00:00:00.000Z"),
  target: memoryTarget
});

assertState(engine.getState(), {
  currentHash: hashMarkdownContent(initialContent),
  lastSavedHash: hashMarkdownContent(initialContent),
  status: "saved",
  target: "memory-only"
});
assertIncludes(
  persistenceTargetLabel(engine.getState()),
  "memory saved (not persisted)",
  "memory-only saved label"
);

engine.updateContent(editedContent, {
  now: date("2026-05-30T00:00:01.000Z")
});
assertState(engine.getState(), {
  currentHash: hashMarkdownContent(editedContent),
  status: "dirty",
  target: "memory-only"
});
if (!engine.shouldBlockClose()) {
  throw new Error("Dirty Save Engine state must request close guard.");
}
if (engine.shouldAutosave(date("2026-05-30T00:00:01.999Z"))) {
  throw new Error("Autosave must not fire before configured delay.");
}
if (!engine.shouldAutosave(date("2026-05-30T00:00:02.000Z"))) {
  throw new Error("Autosave must fire at configured delay.");
}

const autosaveResult = await engine.flush({
  now: date("2026-05-30T00:00:02.000Z"),
  reason: "autosave"
});
if (autosaveResult.status !== "saved") {
  throw new Error(`Expected autosave to save memory target, got ${autosaveResult.status}.`);
}
assertState(engine.getState(), {
  currentHash: hashMarkdownContent(editedContent),
  lastSavedHash: hashMarkdownContent(editedContent),
  status: "saved",
  target: "memory-only"
});
if (memoryTarget.readContent() !== editedContent) {
  throw new Error("Autosave must write edited content to memory target.");
}
if (engine.shouldBlockClose()) {
  throw new Error("Clean saved state must not request close guard.");
}

engine.updateContent(secondEdit, {
  now: date("2026-05-30T00:00:03.000Z")
});
memoryTarget.simulateExternalChange("# Save Engine\n\nExternal edit.\n");
const conflictResult = await engine.flush({
  now: date("2026-05-30T00:00:03.100Z"),
  reason: "manual"
});
if (conflictResult.status !== "conflict") {
  throw new Error(`Expected external change to produce conflict, got ${conflictResult.status}.`);
}
assertState(engine.getState(), {
  status: "conflict",
  target: "conflict"
});
if (memoryTarget.readContent() !== "# Save Engine\n\nExternal edit.\n") {
  throw new Error("Conflict flush must not silently overwrite external content.");
}
if (!engine.shouldBlockClose()) {
  throw new Error("Conflict state must request close guard.");
}
assertIncludes(
  persistenceTargetLabel(engine.getState()),
  "conflict",
  "conflict label"
);
engine.updateContent(editedContent, {
  now: date("2026-05-30T00:00:03.200Z")
});
assertState(engine.getState(), {
  status: "conflict",
  target: "conflict"
});
if (!engine.shouldBlockClose()) {
  throw new Error("Reverting text after conflict must not clear unresolved conflict state.");
}

const downloadTarget = createDownloadRequiredSaveTarget({
  initialContent,
  targetLabel: "uploaded-copy.md"
});
const downloadEngine = createSaveEngine({
  content: initialContent,
  now: date("2026-05-30T00:01:00.000Z"),
  target: downloadTarget
});
downloadEngine.updateContent(editedContent, {
  now: date("2026-05-30T00:01:01.000Z")
});
const downloadResult = await downloadEngine.flush({
  now: date("2026-05-30T00:01:02.000Z"),
  reason: "manual"
});
if (downloadResult.status !== "blocked") {
  throw new Error(`Expected download-required target to block flush, got ${downloadResult.status}.`);
}
assertState(downloadEngine.getState(), {
  status: "dirty",
  target: "download-required"
});
assertIncludes(
  persistenceTargetLabel(downloadEngine.getState()),
  "download required",
  "download-required label"
);
if (downloadEngine.getState().lastSavedHash === hashMarkdownContent(editedContent)) {
  throw new Error("Download-required target must not mark edited content as persisted.");
}

const queuedTarget = createMemorySaveTarget({
  initialContent,
  targetLabel: "queued-memory.md",
  writeDelayMs: 20
});
const queuedEngine = createSaveEngine({
  content: initialContent,
  now: date("2026-05-30T00:02:00.000Z"),
  target: queuedTarget
});
queuedEngine.updateContent(editedContent, {
  now: date("2026-05-30T00:02:01.000Z")
});
const firstFlush = queuedEngine.flush({
  now: date("2026-05-30T00:02:01.010Z"),
  reason: "manual"
});
await wait(0);
queuedEngine.updateContent(secondEdit, {
  now: date("2026-05-30T00:02:01.020Z")
});
const secondFlush = queuedEngine.flush({
  now: date("2026-05-30T00:02:01.030Z"),
  reason: "manual"
});
await Promise.all([firstFlush, secondFlush]);
if (queuedTarget.readContent() !== secondEdit) {
  throw new Error("Write queue must flush the latest content after an edit during save.");
}
if (queuedTarget.writeCount() < 2) {
  throw new Error("Write queue must perform a follow-up write when content changes during save.");
}
assertState(queuedEngine.getState(), {
  currentHash: hashMarkdownContent(secondEdit),
  lastSavedHash: hashMarkdownContent(secondEdit),
  status: "saved",
  target: "memory-only"
});

const dirtyDuringSaveTarget = createMemorySaveTarget({
  initialContent,
  targetLabel: "dirty-during-save.md",
  writeDelayMs: 20
});
const dirtyDuringSaveEngine = createSaveEngine({
  content: initialContent,
  now: date("2026-05-30T00:03:00.000Z"),
  target: dirtyDuringSaveTarget
});
dirtyDuringSaveEngine.updateContent(editedContent, {
  now: date("2026-05-30T00:03:01.000Z")
});
const dirtyDuringSaveFlush = dirtyDuringSaveEngine.flush({
  now: date("2026-05-30T00:03:01.010Z"),
  reason: "manual"
});
await wait(0);
dirtyDuringSaveEngine.updateContent(secondEdit, {
  now: date("2026-05-30T00:03:01.020Z")
});
const dirtyDuringSaveResult = await dirtyDuringSaveFlush;
if (dirtyDuringSaveResult.status === "saved" && dirtyDuringSaveResult.state.status === "dirty") {
  throw new Error("Flush result must not report saved when the returned Save Engine state remains dirty.");
}
if (dirtyDuringSaveResult.status !== "dirty") {
  throw new Error(`Expected dirty result after edit during in-flight save, got ${dirtyDuringSaveResult.status}.`);
}
assertState(dirtyDuringSaveEngine.getState(), {
  currentHash: hashMarkdownContent(secondEdit),
  lastSavedHash: hashMarkdownContent(editedContent),
  status: "dirty",
  target: "memory-only"
});

function assertState(actual, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      throw new Error(`Expected Save Engine state ${key}=${String(value)}, got ${String(actual[key])}.`);
    }
  }
}

function assertIncludes(value, expected, label) {
  if (!String(value).includes(expected)) {
    throw new Error(`Expected ${label} to include ${JSON.stringify(expected)}, got ${JSON.stringify(value)}.`);
  }
}

function date(value) {
  return new Date(value);
}

async function wait(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
