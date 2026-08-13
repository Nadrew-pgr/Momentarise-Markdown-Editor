/*
 * MME-0125 — the React binding mounts the formatting surface.
 *
 * MME-0089 turned the persistent toolbar off by default (benchmark contract 4).
 * The selection bubble that replaced it was mounted only by `apps/md-demo`, so a
 * default `@momentarise/md-react` install went from "a toolbar" to *no formatting
 * UI at all*. That is the `AGENT.md` reachability rule's exact defect class — a
 * feature that exists but cannot be reached is not implemented — and it passed
 * review because reachability was checked against the demo rather than against
 * the default configuration a consumer installs.
 *
 * This suite pins the mount itself, the preference that turns it off, the
 * StrictMode lifecycle, and the byte exactness of what it writes. It also carries
 * the generic reachability assertion, so the next surface cannot ship
 * demo-only without something going red.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

/*
 * Imported before any DOM global exists: the binding must stay importable inside
 * a Next.js server-component boundary, and mounting a DOM surface must not
 * change that.
 */
const mdReact = await import("../packages/md-react/dist/index.js");

const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
for (const key of [
  "DOMParser",
  "DocumentFragment",
  "Event",
  "HTMLElement",
  "InputEvent",
  "KeyboardEvent",
  "MouseEvent",
  "MutationObserver",
  "Node",
  "Text",
  "getComputedStyle"
]) {
  globalThis[key] = dom.window[key];
}
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.ResizeObserver =
  dom.window.ResizeObserver ??
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = React;
const { useMarkdownEditor } = mdReact;
const { createMemorySaveTarget } = await import("../packages/md-save/dist/index.js");
const { TextSelection } = await import("prosemirror-state");

const failures = [];

const INITIAL = "# Rich binding\n\nalpha bravo charlie\n\n- one\n- two\n";

function scheduler() {
  return {
    schedule() {
      return () => {};
    }
  };
}

async function waitFor(predicate, message, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });
  }
  throw new Error(`timed out waiting for: ${message}`);
}

/**
 * Mounts the binding and returns the live handles a test needs.
 *
 * The rich handle arrives through `onRichViewReady`, the binding's own public
 * lifecycle callback — not through a test backdoor. That callback exists because
 * a host composing its own surfaces needs the view; using it here means the test
 * exercises the same seam a consumer would.
 */
async function mountBinding(optionOverrides = {}) {
  const held = {};
  const handle = { rich: null };
  let latest = null;
  function Host() {
    if (!held.value) {
      held.value = {
        content: INITIAL,
        scheduler: scheduler(),
        target: createMemorySaveTarget({ initialContent: INITIAL }),
        onRichViewReady(rich) {
          handle.rich = rich;
        },
        ...optionOverrides
      };
    }
    latest = useMarkdownEditor(held.value);
    return React.createElement("div", { ref: latest.containerRef });
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(Host));
  });
  act(() => {
    latest.session.setMode("rich");
  });
  await waitFor(() => Boolean(container.querySelector(".ProseMirror")), "the rich view to mount");
  await waitFor(() => Boolean(handle.rich), "onRichViewReady to deliver the rich handle");
  return { container, handle, root, session: latest.session };
}

/**
 * Select a word through the ProseMirror view the binding owns.
 *
 * Driving the real view rather than a helper matters here: the bubble is derived
 * from the view's selection, so a test that set some other state would prove
 * nothing about what a writer sees.
 */
function selectWord(handle, word) {
  const view = handle.rich?.getEditorView();
  assert.ok(view, "the rich view must expose its EditorView for selection");
  let found = null;
  view.state.doc.descendants((node, pos) => {
    if (found || !node.isText) {
      return true;
    }
    const index = node.text.indexOf(word);
    if (index >= 0) {
      found = { from: pos + index, to: pos + index + word.length };
    }
    return true;
  });
  assert.ok(found, `the document must contain ${JSON.stringify(word)}`);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, found.from, found.to)));
  return found;
}

const bubbleOf = (container) => container.querySelector('[data-testid="selection-bubble-toolbar"]');

/* ------------------------------------------------------------------ *
 * Section 1 — a default mount has a formatting surface.
 * ------------------------------------------------------------------ */

await check("a default React mount raises the bubble on selection", async () => {
  const { container, handle, root } = await mountBinding();
  assert.equal(
    bubbleOf(container)?.hidden ?? null,
    true,
    "with nothing selected the bubble must exist and be hidden, not absent"
  );
  selectWord(handle, "bravo");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble to appear on selection");
  const controls = [...bubbleOf(container).querySelectorAll("[data-testid]")]
    .filter((node) => !node.hidden)
    .map((node) => node.dataset.testid);
  for (const required of [
    "selection-bubble-turn-into",
    "selection-bubble-bold",
    "selection-bubble-italic",
    "selection-bubble-strikethrough",
    "selection-bubble-inline-code",
    "selection-bubble-link"
  ]) {
    assert.ok(
      controls.includes(required),
      `a default React consumer must get ${required}; the binding rendered ${JSON.stringify(controls)}`
    );
  }
  act(() => root.unmount());
});

await check("the bubble's commands are visible under the binding's own preferences", async () => {
  /*
   * `mountReactEditor` hardcoded `visibleCommandGroups: []`, and every surface
   * command is gated on that list — so mounting the bubble without touching it
   * would render an empty shell that satisfies "the component is mounted" and
   * gives the writer nothing. Asserted on the rendered buttons, not on the
   * preference value.
   */
  const { container, handle, root } = await mountBinding();
  selectWord(handle, "bravo");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble to appear");
  const buttons = [...bubbleOf(container).querySelectorAll("button")].filter((node) => !node.hidden);
  assert.ok(
    buttons.length >= 6,
    `the bubble rendered ${buttons.length} usable control(s); an empty bubble is not a formatting surface`
  );
  act(() => root.unmount());
});

await check("a bubble action writes byte-exact Markdown", async () => {
  const { container, handle, root, session } = await mountBinding();
  selectWord(handle, "bravo");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble to appear");
  bubbleOf(container).querySelector('[data-testid="selection-bubble-strikethrough"]').click();
  await waitFor(
    () => session.getContent().includes("~~bravo~~"),
    "the strikethrough action to reach the session content"
  );
  assert.equal(
    session.getContent(),
    "# Rich binding\n\nalpha ~~bravo~~ charlie\n\n- one\n- two\n",
    "the bubble must write canonical Markdown and leave every other byte alone"
  );
  selectWord(handle, "bravo");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble to reappear");
  bubbleOf(container).querySelector('[data-testid="selection-bubble-strikethrough"]').click();
  await waitFor(() => !session.getContent().includes("~~"), "the mark to be removed again");
  assert.equal(session.getContent(), INITIAL, "removing the mark must return the original bytes");
  act(() => root.unmount());
});

await check("the bubble refuses a selection inside a code block", async () => {
  const content = "# Doc\n\n```ts\nconst canonical = 1;\n```\n";
  const { container, handle, root } = await mountBinding({
    content,
    target: createMemorySaveTarget({ initialContent: content })
  });
  selectWord(handle, "canonical");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
  assert.equal(
    bubbleOf(container)?.hidden,
    true,
    "code-block bytes are content, not prose; the package rule must be applied by the binding too"
  );
  act(() => root.unmount());
});

/* ------------------------------------------------------------------ *
 * Section 2 — the host can turn it off, without leaving an inert control.
 * ------------------------------------------------------------------ */

await check("a host can opt out of the bubble", async () => {
  const { container, handle, root } = await mountBinding({ surfacePreferences: { selectionBubble: false } });
  selectWord(handle, "bravo");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
  const bubble = bubbleOf(container);
  assert.ok(
    bubble === null || bubble.hidden === true,
    "opting out must leave no affordance at all, not a disabled one"
  );
  act(() => root.unmount());
});

/* ------------------------------------------------------------------ *
 * Section 3 — lifecycle.
 * ------------------------------------------------------------------ */

await check("StrictMode's double mount leaves exactly one bubble", async () => {
  const held = {};
  let latest = null;
  function Host() {
    if (!held.value) {
      held.value = {
        content: INITIAL,
        scheduler: scheduler(),
        target: createMemorySaveTarget({ initialContent: INITIAL })
      };
    }
    latest = useMarkdownEditor(held.value);
    return React.createElement("div", { ref: latest.containerRef });
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(React.StrictMode, null, React.createElement(Host)));
  });
  act(() => {
    latest.session.setMode("rich");
  });
  await waitFor(() => Boolean(container.querySelector(".ProseMirror")), "the rich view to mount under StrictMode");
  assert.equal(
    container.querySelectorAll('[data-testid="selection-bubble-toolbar"]').length,
    1,
    "a StrictMode double mount must not leave a second bubble behind"
  );
  act(() => root.unmount());
  assert.equal(
    container.querySelectorAll('[data-testid="selection-bubble-toolbar"]').length,
    0,
    "unmounting must take the bubble with it"
  );
});

await check("leaving rich mode takes the bubble with it", async () => {
  const { container, handle, root, session } = await mountBinding();
  selectWord(handle, "bravo");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble to appear");
  act(() => session.setMode("source"));
  await waitFor(
    () => bubbleOf(container) === null || bubbleOf(container).hidden === true,
    "the bubble to go when rich mode does"
  );
  assert.equal(session.getContent(), INITIAL, "the mode switch must not touch the document");
  act(() => root.unmount());
});

/* ------------------------------------------------------------------ *
 * Section 4 — the class of defect, not just this instance.
 * ------------------------------------------------------------------ */

await check("every default surface component has a call site outside the demo", () => {
  /*
   * The generic guard. MME-0089 shipped a component whose only consumer was
   * `apps/md-demo`, which is not what `AGENT.md` means by "reachable from the
   * default configuration a consumer installs". Each entry names a surface the
   * default configuration is supposed to provide; a new one that only the demo
   * mounts fails here rather than in a human review months later.
   */
  const REQUIRED_IN_PACKAGES = [
    "createSelectionBubbleToolbar",
    "createModeControl",
    "createDocumentStatus"
  ];
  const packageSources = readdirSync("packages")
    .flatMap((pkg) => {
      const dir = `packages/${pkg}/src`;
      try {
        return readdirSync(dir)
          .filter((file) => file.endsWith(".ts"))
          .map((file) => `${dir}/${file}`);
      } catch {
        return [];
      }
    })
    // md-surface defines them; a definition is not a call site.
    .filter((file) => !file.startsWith("packages/md-surface/"));
  const contents = packageSources.map((file) => ({ file, text: readFileSync(file, "utf8") }));
  for (const factory of REQUIRED_IN_PACKAGES) {
    const callSites = contents.filter(({ text }) => text.includes(`${factory}(`)).map(({ file }) => file);
    assert.ok(
      callSites.length > 0,
      `${factory} has no call site in any package source, so a consumer who installs the packages ` +
        "never gets it — only apps/md-demo does. This is the MME-0125 defect class."
    );
  }
});

await check("this suite runs inside npm test", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(
    packageJson.scripts["test:react-selection-bubble"],
    "npm run build && node tests/react-selection-bubble.test.mjs",
    "the gate needs its own focused script"
  );
  assert.ok(packageJson.scripts.test.includes("test:react-selection-bubble"), "npm test must run this gate");
});

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

if (failures.length > 0) {
  console.error(`react-selection-bubble: ${failures.length} failing check(s)`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}
console.log("react-selection-bubble: all checks passed.");

async function check(label, body) {
  try {
    await body();
  } catch (error) {
    failures.push(`[${label}] ${error.message}`);
  }
}
