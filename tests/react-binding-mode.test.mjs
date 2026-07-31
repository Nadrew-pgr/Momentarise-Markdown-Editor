import assert from "node:assert/strict";

// MME-0101: @momentarise/md-react must mount the rich editing surface when the session mode is
// rich (and restore source when it switches back), keeping Markdown canonical across switches and
// leaking no view or listener. Fails today because mountReactEditor only ever mounts the source view.

const mdReact = await import("../packages/md-react/dist/index.js");

const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
for (const key of ["HTMLElement", "Node", "Text", "DocumentFragment", "getComputedStyle", "MutationObserver", "DOMParser", "Event", "KeyboardEvent", "InputEvent"]) {
  globalThis[key] = dom.window[key];
}
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.ResizeObserver = dom.window.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = React;
const { useMarkdownEditor } = mdReact;
const { createMemorySaveTarget } = await import("../packages/md-save/dist/index.js");

function scheduler() {
  return { schedule() { return () => {}; } };
}

async function waitFor(predicate, message, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await act(async () => { await new Promise((r) => setTimeout(r, 15)); });
  }
  assert.fail(`timed out waiting for: ${message}`);
}

const initialContent = "# Rich binding\n\nEdit me.\n\n- one\n- two\n";
let latest = null;
const held = {};

function Host() {
  if (!held.value) {
    held.value = { content: initialContent, scheduler: scheduler(), target: createMemorySaveTarget({ initialContent }) };
  }
  latest = useMarkdownEditor(held.value);
  return React.createElement("div", { ref: latest.containerRef });
}

const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
act(() => { root.render(React.createElement(Host)); });

// 1. Source mounts first, no rich view yet.
assert.ok(container.querySelector("[data-mme-react-source] .cm-editor"), "source view (CodeMirror) must mount initially.");
assert.equal(container.querySelector(".ProseMirror"), null, "rich view must not be mounted in source mode.");

const session = latest.session;

// 2. Switching to rich mounts the rich surface and unmounts source.
act(() => { session.setMode("rich"); });
await waitFor(() => Boolean(container.querySelector(".ProseMirror")), "rich view (.ProseMirror) to mount after setMode('rich')");
assert.ok(container.querySelector(".ProseMirror"), "rich view must mount when mode is rich.");
assert.equal(container.querySelector("[data-mme-react-source] .cm-editor"), null, "source view must be unmounted in rich mode.");
assert.ok(container.querySelector(".ProseMirror").textContent.includes("Rich binding"), "rich view must render the document content.");

// 3. Switching back restores source with content intact (canonical Markdown preserved).
act(() => { session.setMode("source"); });
await waitFor(() => Boolean(container.querySelector("[data-mme-react-source] .cm-editor")), "source view to remount after switching back");
assert.equal(container.querySelector(".ProseMirror"), null, "rich view must be unmounted after switching back to source.");
assert.equal(session.getContent(), initialContent, "canonical Markdown must survive a source->rich->source round trip untouched.");

// 4. No inert control: the binding's mode control must not offer live-preview (not mounted).
const modeButtons = [...container.querySelectorAll("[data-mme-react-mode] [data-editor-mode]")].map((b) => b.dataset.editorMode);
assert.ok(modeButtons.includes("source") && modeButtons.includes("rich"), "binding mode control must offer source and rich.");
assert.ok(!modeButtons.includes("live-preview"), "binding mode control must not offer an inert live-preview button.");

// 5. Final unmount destroys exactly once and leaves nothing mounted.
let destroyCalls = 0;
const realDestroy = session.destroy.bind(session);
session.destroy = (...a) => { destroyCalls += 1; return realDestroy(...a); };
act(() => { root.unmount(); });
assert.equal(destroyCalls, 1, "session.destroy must be called exactly once on final unmount.");
assert.equal(container.querySelector(".ProseMirror"), null, "no rich view may remain after unmount.");

console.log("react-binding-mode: all assertions passed.");
