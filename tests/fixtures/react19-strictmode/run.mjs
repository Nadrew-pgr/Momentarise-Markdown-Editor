import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Isolated fixture (own node_modules, installed by tests/react19-strictmode-lifecycle.test.mjs):
// proves the currently PUBLISHED @momentarise/md-react alpha survives React 19's StrictMode
// dev-mode double-mount. Kept in its own directory rather than the root workspace because Node
// cannot resolve two different "react" versions from one node_modules tree (React 18 is already
// hoisted at the repo root for tests/react-strictmode-lifecycle.test.mjs).

const mdReactNoDom = await import("@momentarise/md-react");
assert.equal(typeof mdReactNoDom.useMarkdownEditor, "function", "useMarkdownEditor must be importable with no DOM globals present.");
assert.equal(typeof mdReactNoDom.MarkdownEditor, "function", "MarkdownEditor must be importable with no DOM globals present.");

const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.Text = dom.window.Text;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.ResizeObserver = dom.window.ResizeObserver ?? class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const reactVersion = React.version;
assert.ok(reactVersion.startsWith("19."), `fixture must actually run React 19, got ${reactVersion}.`);

const { createRoot } = await import("react-dom/client");
const { act } = React;
const { useMarkdownEditor } = mdReactNoDom;
const { createMemorySaveTarget } = await import("@momentarise/md-save");

function createManualScheduler() {
  return {
    schedule() {
      return () => {};
    }
  };
}

const initialContent = "# Strict React 19\n\nHello.\n";
let latest = null;
const optionsHolder = {};

function Host() {
  if (!optionsHolder.value) {
    optionsHolder.value = {
      content: initialContent,
      scheduler: createManualScheduler(),
      target: createMemorySaveTarget({ initialContent })
    };
  }
  const result = useMarkdownEditor(optionsHolder.value);
  latest = result;
  return React.createElement("div", { ref: result.containerRef });
}

const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);

act(() => {
  root.render(React.createElement(React.StrictMode, null, React.createElement(Host)));
});

assert.ok(latest !== null, "hook must render at least once.");
assert.ok(latest.session !== null && latest.session !== undefined, "useMarkdownEditor must return a non-null session during render.");

const sourceHost = container.querySelector("[data-mme-react-source]");
assert.ok(sourceHost !== null, "containerRef must mount the react editor shell.");
assert.ok(sourceHost.children.length > 0, "containerRef must mount a working CodeMirror source view after StrictMode settles.");

const liveSession = latest.session;
assert.doesNotThrow(() => {
  act(() => {
    liveSession.setContent("# Strict React 19\n\nEdited after remount.\n", "host");
  });
}, "session must remain alive and accept edits after StrictMode mount -> cleanup -> remount under React 19.");

assert.equal(
  liveSession.getContent(),
  "# Strict React 19\n\nEdited after remount.\n",
  "content edits after remount must apply to the live session."
);

// MME-0101: mode switch after a React 19 StrictMode double-mount must mount the rich surface
// against the live session and restore source with no leaked view.
async function waitForMode(predicate, message) {
  const start = Date.now();
  while (Date.now() - start < 4000) {
    if (predicate()) return;
    await act(async () => { await new Promise((r) => setTimeout(r, 15)); });
  }
  assert.fail(`timed out waiting for: ${message}`);
}
act(() => { liveSession.setMode("rich"); });
await waitForMode(() => Boolean(container.querySelector(".ProseMirror")), "rich view to mount (React 19)");
assert.ok(container.querySelector(".ProseMirror") !== null, "rich view must mount on mode switch after a React 19 StrictMode remount.");
assert.ok(container.querySelector("[data-mme-react-source] .cm-editor") === null, "source view must unmount when rich mounts (React 19).");
/*
 * MME-0125 — the selection-bubble leg, version-aware on purpose.
 *
 * This fixture installs `@momentarise/md-react` from the REGISTRY, so it can only
 * assert what the published artifact contains. The bubble ships in the alpha
 * after 0.1.0-alpha.3, and the leg activates itself the moment a bubble-bearing
 * version is installed — no quarantine entry to go quiet, and no assertion that
 * silently passes because the feature is absent.
 */
const bubbleShipped = Boolean(
  (await import("@momentarise/md-react/package.json", { with: { type: "json" } }).catch(() => null)) &&
    readFileSync(new URL("./node_modules/@momentarise/md-react/dist/index.js", import.meta.url), "utf8").includes(
      "createSelectionBubbleToolbar"
    )
);
if (bubbleShipped) {
  await waitForMode(
    () => Boolean(container.querySelector('[data-testid="selection-bubble-toolbar"]')),
    "the selection bubble to mount alongside the rich view (React 19)"
  );
  assert.equal(
    container.querySelectorAll('[data-testid="selection-bubble-toolbar"]').length,
    1,
    "a React 19 StrictMode double mount must leave exactly one selection bubble."
  );
} else {
  console.log(
    "react19-strictmode fixture: selection-bubble leg skipped — the installed registry " +
      `@momentarise/md-react predates MME-0125. It activates on the next alpha republish.`
  );
}

act(() => { liveSession.setMode("source"); });
await waitForMode(() => Boolean(container.querySelector("[data-mme-react-source] .cm-editor")), "source view to remount (React 19)");
assert.ok(container.querySelector(".ProseMirror") === null, "rich view must unmount when switching back to source under React 19 (no leak).");
if (bubbleShipped) {
  assert.equal(
    container.querySelector('[data-testid="selection-bubble-toolbar"]'),
    null,
    "the selection bubble must unmount with the rich view under React 19 (no leak)."
  );
}
assert.equal(liveSession.getContent(), "# Strict React 19\n\nEdited after remount.\n", "content must survive the rich round trip (React 19).");

let destroyCalls = 0;
const originalDestroy = liveSession.destroy.bind(liveSession);
liveSession.destroy = (...args) => {
  destroyCalls += 1;
  return originalDestroy(...args);
};

act(() => {
  root.unmount();
});

assert.equal(destroyCalls, 1, "session.destroy must be called exactly once on final unmount.");
assert.throws(
  () => liveSession.setContent("# After unmount\n", "host"),
  /destroyed/i,
  "the session must be truly destroyed after final unmount."
);

console.log(`react19-strictmode fixture: all assertions passed (react ${reactVersion}).`);
