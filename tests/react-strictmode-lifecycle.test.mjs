import assert from "node:assert/strict";

// SSR / server-component-boundary safety: the module must be importable with zero DOM globals present.
// This import happens before any jsdom globals are installed below.
const mdReactNoDom = await import("../packages/md-react/dist/index.js");
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
const { createRoot } = await import("react-dom/client");
const { act } = React;
const { useMarkdownEditor, MarkdownEditor } = mdReactNoDom;
const { createMemorySaveTarget } = await import("../packages/md-save/dist/index.js");

function createManualScheduler() {
  return {
    schedule() {
      return () => {};
    }
  };
}

function assertField(condition, message) {
  assert.ok(condition, message);
}

// --- Test 1: raw hook survives StrictMode mount -> simulated remount, stays alive and editable. ---
{
  const initialContent = "# Strict\n\nHello.\n";
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

  assertField(latest !== null, "hook must render at least once.");
  assertField(latest.session !== null && latest.session !== undefined, "useMarkdownEditor must return a non-null session during render.");

  const sourceHost = container.querySelector("[data-mme-react-source]");
  assertField(sourceHost !== null, "containerRef must mount the react editor shell.");
  assertField(sourceHost.children.length > 0, "containerRef must mount a working CodeMirror source view after StrictMode settles.");

  const liveSession = latest.session;
  assert.doesNotThrow(() => {
    act(() => {
      liveSession.setContent("# Strict\n\nEdited after remount.\n", "host");
    });
  }, "session must remain alive and accept edits after StrictMode mount -> cleanup -> remount.");

  assertField(latest.state.saveState !== undefined, "state must reflect the post-remount session's save state.");
  assert.equal(liveSession.getContent(), "# Strict\n\nEdited after remount.\n", "content edits after remount must apply to the live session.");

  // MME-0101: a mode switch after the StrictMode double-mount must mount the rich surface against
  // the live (not destroyed) session, then restore source, with no leaked view.
  async function waitForMode(predicate, message) {
    const start = Date.now();
    while (Date.now() - start < 4000) {
      if (predicate()) return;
      await act(async () => { await new Promise((r) => setTimeout(r, 15)); });
    }
    assert.fail(`timed out waiting for: ${message}`);
  }
  act(() => { liveSession.setMode("rich"); });
  await waitForMode(() => Boolean(container.querySelector(".ProseMirror")), "rich view to mount after StrictMode remount");
  assertField(container.querySelector(".ProseMirror") !== null, "rich view must mount on mode switch after a StrictMode remount.");
  assertField(container.querySelector("[data-mme-react-source] .cm-editor") === null, "source view must unmount when rich mounts.");
  act(() => { liveSession.setMode("source"); });
  await waitForMode(() => Boolean(container.querySelector("[data-mme-react-source] .cm-editor")), "source view to remount");
  assertField(container.querySelector(".ProseMirror") === null, "rich view must unmount when switching back to source (no leak).");
  assert.equal(liveSession.getContent(), "# Strict\n\nEdited after remount.\n", "content must survive the rich round trip.");

  // Final (real) unmount: session must be destroyed exactly once and truly dead afterward.
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
    "the session must be truly destroyed after final unmount (assertAlive must reject further writes)."
  );

  const onRenderCallsBeforeEmit = latest;
  liveSession.emit("change", { content: liveSession.getContent(), origin: "host" });
  assert.equal(latest, onRenderCallsBeforeEmit, "no further render/state update may occur from a destroyed session's leftover event surface after final unmount.");
}

// --- Test 2: MarkdownEditor component's onChange stays wired to the post-remount session under StrictMode. ---
{
  const { EditorView } = await import("@codemirror/view");
  const initialContent = "# Component\n";
  const optionsHolder = {};
  const changes = [];

  function onChange(content) {
    changes.push(content);
  }

  function Host() {
    if (!optionsHolder.value) {
      optionsHolder.value = {
        content: initialContent,
        scheduler: createManualScheduler(),
        target: createMemorySaveTarget({ initialContent })
      };
    }
    return React.createElement(MarkdownEditor, { onChange, options: optionsHolder.value });
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(React.StrictMode, null, React.createElement(Host)));
  });

  const sourceHost = container.querySelector("[data-mme-react-source]");
  assertField(sourceHost !== null && sourceHost.children.length > 0, "MarkdownEditor must mount a working editor after StrictMode settles.");

  // Drive a real CodeMirror edit (the same path a keystroke takes) rather than calling
  // session.setContent directly, so this proves MarkdownEditor's own onChange-forwarding
  // effect is wired to the post-remount session, not a stale render-closure reference.
  const cmRoot = sourceHost.querySelector(".cm-editor");
  assertField(cmRoot !== null, "a live CodeMirror editor must be mounted after StrictMode settles.");
  const cmView = EditorView.findFromDOM(cmRoot);
  assertField(cmView !== null, "EditorView.findFromDOM must resolve the mounted post-remount editor view.");

  act(() => {
    cmView.dispatch({
      changes: { from: 0, insert: "Edited via CodeMirror after remount.\n" }
    });
  });

  assertField(
    changes.some((content) => content.startsWith("Edited via CodeMirror after remount.\n")),
    "MarkdownEditor's onChange must fire with the edited content after StrictMode settles (proves the component's own change-subscription effect reconnected to the post-remount session)."
  );

  act(() => {
    root.unmount();
  });
}

console.log("react-strictmode-lifecycle: all assertions passed.");
