import { createFocusRefreshWatcher } from "../packages/md-adapter-web/dist/index.js";
import { createMarkdownEditorSession } from "../packages/md-editor/dist/index.js";
import { createMemorySaveTarget, createSaveEngine, hashMarkdownContent } from "../packages/md-save/dist/index.js";
import { readFileSync } from "node:fs";

const initialContent = "# External Change\n\nInitial body.\n";
const editedContent = "# External Change\n\nLocal edit.\n";
const externalContent = "# External Change\n\nExternal edit.\n";
const secondExternalContent = "# External Change\n\nSecond external edit.\n";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert(
  packageJson.scripts["test:web-external-change"] === "npm run build && node tests/web-external-change.test.mjs",
  "Missing test:web-external-change script."
);
assert(packageJson.scripts.test.includes("test:web-external-change"), "Root npm test must include web external-change checks.");

const target = createMemorySaveTarget({
  initialContent,
  targetLabel: "disk://watcher.md"
});
const engine = createSaveEngine({
  content: initialContent,
  target
});

let trigger;
let stopped = false;
const observedHashes = [];
const watcher = createFocusRefreshWatcher({
  getLastSavedHash() {
    return engine.getState().lastSavedHash;
  },
  listen(handler) {
    trigger = handler;
    return () => {
      stopped = true;
    };
  },
  onExternalChange(externalHash) {
    observedHashes.push(externalHash);
  },
  readExternalHash: target.readExternalHash
});

watcher.start();
watcher.start();
assert(typeof trigger === "function", "Focus refresh watcher must register one host listener on start.");
target.simulateExternalChange(externalContent);
await trigger();
assert(
  observedHashes[0] === hashMarkdownContent(externalContent),
  "Focus refresh watcher must surface the external hash when it differs from the last saved hash."
);
target.simulateExternalChange(externalContent);
await trigger();
assert(observedHashes.length === 1, "Focus refresh watcher must not spam duplicate unchanged external hashes.");
target.simulateExternalChange(secondExternalContent);
await trigger();
assert(
  observedHashes[1] === hashMarkdownContent(secondExternalContent),
  "Focus refresh watcher must notify again when the external hash changes again."
);
watcher.stop();
watcher.stop();
assert(stopped, "Focus refresh watcher stop must detach the host listener.");

let staleTrigger;
let resolveStaleHash;
let staleNotified = false;
const staleWatcher = createFocusRefreshWatcher({
  getLastSavedHash() {
    return hashMarkdownContent(initialContent);
  },
  listen(handler) {
    staleTrigger = handler;
    return () => {};
  },
  onExternalChange() {
    staleNotified = true;
  },
  readExternalHash() {
    return new Promise((resolve) => {
      resolveStaleHash = () => resolve(hashMarkdownContent(externalContent));
    });
  }
});
staleWatcher.start();
const staleRun = staleTrigger();
staleWatcher.stop();
resolveStaleHash();
await staleRun;
assert(!staleNotified, "Stopped focus refresh watcher must ignore stale in-flight external-change callbacks.");

let errorTrigger;
let observedError = null;
const errorWatcher = createFocusRefreshWatcher({
  getLastSavedHash() {
    return hashMarkdownContent(initialContent);
  },
  listen(handler) {
    errorTrigger = handler;
    return () => {};
  },
  onError(error) {
    observedError = error;
  },
  onExternalChange() {
    throw new Error("onExternalChange should not be reached after read failure.");
  },
  readExternalHash() {
    throw new Error("read failed");
  }
});
errorWatcher.start();
await errorTrigger();
assert(observedError instanceof Error && observedError.message === "read failed", "Watcher refresh errors must be isolated through onError.");

engine.updateContent(editedContent);
const conflictResult = await engine.flush({
  reason: "manual"
});
assert(conflictResult.status === "conflict", `Subsequent save-time verification must still report conflict, got ${conflictResult.status}.`);
assert(target.readContent() === secondExternalContent, "Conflict flush must not overwrite externally changed content.");

const cleanTarget = createMemorySaveTarget({
  initialContent,
  targetLabel: "disk://clean-apply.md"
});
const cleanSession = createSession(initialContent, cleanTarget);
cleanTarget.simulateExternalChange(externalContent);
const cleanApplied = cleanSession.applyExternalContent(cleanTarget.readContent(), "host");
assert(cleanApplied.status === "applied", `Clean external content should apply, got ${cleanApplied.status}.`);
assert(cleanSession.getContent() === externalContent, "Clean session must adopt external content.");
assert(cleanSession.getSaveState().status === "saved", "Clean external apply must remain saved.");
assert(cleanSession.getSaveState().lastSavedHash === hashMarkdownContent(externalContent), "Clean external apply must advance lastSavedHash.");
const cleanFlush = await cleanSession.flush("manual");
assert(cleanFlush.status === "noop", `Flush after clean external apply should be noop, got ${cleanFlush.status}.`);

const dirtyTarget = createMemorySaveTarget({
  initialContent,
  targetLabel: "disk://dirty-conflict.md"
});
const dirtySession = createSession(initialContent, dirtyTarget);
dirtySession.setContent(editedContent, "source-view");
dirtyTarget.simulateExternalChange(externalContent);
const dirtyApplied = dirtySession.applyExternalContent(dirtyTarget.readContent(), "host");
assert(dirtyApplied.status === "conflict", `Dirty external content should conflict, got ${dirtyApplied.status}.`);
assert(dirtySession.getContent() === editedContent, "Dirty session must keep local unsaved content.");
assert(dirtySession.getSaveState().status === "conflict", "Dirty external apply must put the session into conflict.");
const dirtyFlush = await dirtySession.flush("manual");
assert(dirtyFlush.status === "conflict", `Unresolved external conflict must block flush, got ${dirtyFlush.status}.`);
assert(dirtyTarget.readContent() === externalContent, "Dirty conflict must not overwrite external content.");

function createSession(content, saveTarget) {
  return createMarkdownEditorSession({
    content,
    scheduler: {
      schedule() {
        return () => {};
      }
    },
    target: saveTarget
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
