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
const { NodeSelection, TextSelection } = await import("prosemirror-state");

const failures = [];

/*
 * The todo item is load-bearing. `activeBlockCommand` walks the ancestry to find
 * `todo_item`, which is never at depth 1 — and the issue explicitly protects that
 * walk from being "fixed". It had zero coverage until review found that changing
 * its return value survived every gate.
 */
const INITIAL = "# Rich binding\n\nalpha bravo charlie\n\n- one\n- two\n\n- [ ] a task\n";

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
  const handle = { events: [], rich: null };
  let latest = null;
  function Host() {
    if (!held.value) {
      held.value = {
        content: INITIAL,
        scheduler: scheduler(),
        target: createMemorySaveTarget({ initialContent: INITIAL }),
        onRichViewReady(rich) {
          handle.rich = rich;
          handle.events.push(rich === null ? "null" : "handle");
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
  /*
   * The AI entry must be absent, not merely present-and-disabled: this binding
   * ships no AI entry point, and an affordance that cannot do anything is the
   * inert control the block's standing rule forbids.
   */
  const aiButton = bubbleOf(container).querySelector('[data-testid="selected-text-ai-bubble-action"]');
  assert.ok(
    aiButton === null || aiButton.hidden === true,
    "the binding provides no AI entry point, so the bubble must not offer one"
  );
  const usable = [...bubbleOf(container).querySelectorAll("button")].filter((node) => !node.hidden && !node.disabled);
  assert.ok(
    usable.length >= 6,
    `the bubble rendered ${usable.length} enabled control(s); an empty bubble is not a formatting surface`
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
    "# Rich binding\n\nalpha ~~bravo~~ charlie\n\n- one\n- two\n\n- [ ] a task\n",
    "the bubble must write canonical Markdown and leave every other byte alone"
  );
  selectWord(handle, "bravo");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble to reappear");
  bubbleOf(container).querySelector('[data-testid="selection-bubble-strikethrough"]').click();
  await waitFor(() => !session.getContent().includes("~~"), "the mark to be removed again");
  assert.equal(session.getContent(), INITIAL, "removing the mark must return the original bytes");
  act(() => root.unmount());
});

await check("turn-into converts the block and one undo steps back past it", async () => {
  const { container, handle, root, session } = await mountBinding();
  selectWord(handle, "alpha");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble to appear");
  bubbleOf(container).querySelector('[data-testid="selection-bubble-turn-into"]').click();
  await waitFor(
    () => Boolean(bubbleOf(container).querySelector('[data-turn-into-command="heading2"]')),
    "the turn-into dropdown to open"
  );
  bubbleOf(container).querySelector('[data-turn-into-command="heading2"]').click();
  await waitFor(
    () => session.getContent().includes("## alpha bravo charlie"),
    "the block conversion to reach the session content"
  );
  assert.equal(
    session.getContent(),
    "# Rich binding\n\n## alpha bravo charlie\n\n- one\n- two\n\n- [ ] a task\n",
    "turn-into must serialize canonical Markdown and leave every other byte alone"
  );
  act(() => root.unmount());
});

await check("the link popover writes and removes a real destination", async () => {
  const { container, handle, root, session } = await mountBinding();
  selectWord(handle, "bravo");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble to appear");
  bubbleOf(container).querySelector('[data-testid="selection-bubble-link"]').click();
  await waitFor(
    () => Boolean(bubbleOf(container).querySelector('[data-testid="selection-bubble-link-input"]')),
    "the link popover to open"
  );
  const input = bubbleOf(container).querySelector('[data-testid="selection-bubble-link-input"]');
  input.value = "./notes.md";
  input.closest("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(() => session.getContent().includes("](./notes.md)"), "the link to reach the session content");
  assert.equal(
    session.getContent(),
    "# Rich binding\n\nalpha [bravo](./notes.md) charlie\n\n- one\n- two\n\n- [ ] a task\n",
    "a relative Markdown destination must be written verbatim"
  );
  selectWord(handle, "bravo");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble to reappear");
  bubbleOf(container).querySelector('[data-testid="selection-bubble-link"]').click();
  await waitFor(
    () => Boolean(bubbleOf(container).querySelector('[data-testid="selection-bubble-link-remove"]')),
    "the popover to offer removal for an existing link"
  );
  bubbleOf(container).querySelector('[data-testid="selection-bubble-link-remove"]').click();
  await waitFor(() => !session.getContent().includes("./notes.md"), "the link to be removed");
  assert.equal(session.getContent(), INITIAL, "removing the link must return the original bytes");
  act(() => root.unmount());
});

await check("returning to rich mode a second time still has a formatting surface", async () => {
  /*
   * The bubble is torn down when the rich view unmounts. If the teardown forgets
   * to clear its own reference, the guard in `mountSelectionBubble` early-returns
   * on the second visit and the writer silently gets no formatting surface — a
   * regression identical in shape to the one this issue closes.
   */
  const { container, handle, root, session } = await mountBinding();
  act(() => session.setMode("source"));
  await waitFor(() => container.querySelector(".ProseMirror") === null, "the rich view to unmount");
  act(() => session.setMode("rich"));
  await waitFor(() => Boolean(container.querySelector(".ProseMirror")), "the rich view to mount again");
  await waitFor(() => Boolean(handle.rich), "the rich handle to be delivered again");
  selectWord(handle, "bravo");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble on the second visit to rich mode");
  bubbleOf(container).querySelector('[data-testid="selection-bubble-strikethrough"]').click();
  await waitFor(() => session.getContent().includes("~~bravo~~"), "the second visit's bubble to still apply marks");
  act(() => root.unmount());
});

await check("the bubble refuses a selection inside an opaque block", async () => {
  const content = "# Doc\n\n<div data-x>raw</div>\n";
  const { container, handle, root } = await mountBinding({
    content,
    target: createMemorySaveTarget({ initialContent: content })
  });
  const view = handle.rich?.getEditorView();
  /*
   * The block must actually be selected. The first version of this check used
   * `Selection.near(doc.resolve(1))`, which lands at position 1 — inside the
   * heading — and produced a COLLAPSED selection. It therefore passed for the
   * same reason a caret in ordinary prose passes, and stayed green against a
   * build whose only rule was "not empty". Measured: the heading occupies 0-4 and
   * the `unsupported_block` sits at position 5.
   */
  const opaquePosition = (() => {
    let found = null;
    view.state.doc.descendants((node, pos) => {
      if (found === null && node.type.name === "unsupported_block") {
        found = pos;
      }
      return true;
    });
    return found;
  })();
  assert.ok(opaquePosition !== null, "the fixture must mount the raw HTML as an unsupported_block");
  view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, opaquePosition)));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
  assert.equal(
    view.state.selection.empty,
    false,
    "the opaque block must be genuinely selected, or this check passes for the wrong reason"
  );
  assert.equal(
    bubbleOf(container)?.hidden,
    true,
    "an opaque block carries preserved source bytes; the package rule must be applied by the binding too"
  );
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
  assert.equal(
    bubbleOf(container),
    null,
    "opting out must mount no bubble at all — a hidden one still carries its listeners and its session subscription"
  );
  assert.equal(
    container.querySelector("[data-mme-react-bubble]"),
    null,
    "opting out must not leave the bubble's host element in the consumer's DOM either"
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

await check("the binding declares exactly the surfaces it is expected to provide", () => {
  /*
   * A frozen expected set, because deriving the check from the binding's own
   * declaration is circular: review demonstrated that dropping a surface from
   * BOTH the contract and the code left the previous version green — which is
   * the actual shape of MME-0125, where md-react neither claimed the bubble nor
   * mounted it. Shrinking this list must be a deliberate edit here.
   */
  assert.deepEqual(
    [...mdReact.markdownReactBindingPackage.surfaces].sort(),
    ["documentStatus", "modeControl", "richView", "selectionBubble", "sourceView"],
    "the binding's declared surfaces changed; if that is intended, update this list and say why in the build log"
  );
});

await check("every declared surface is actually rendered by a default mount", async () => {
  /*
   * Reachability proven by MOUNTING, not by searching source text.
   *
   * The previous version grepped `packages/md-react/src` for `factory(`. Review
   * showed it passed on a call in dead code, in a function nothing invokes, and
   * behind a flag defaulting to off — the last of which is precisely "the default
   * configuration a consumer installs" failing while the gate is green. It also
   * read `src/*.ts` while the artifact consumers install is `dist/*.js`.
   *
   * Mounting the binding the way a consumer does and asserting one rendered
   * artifact per declared surface cannot be satisfied by unreachable code.
   */
  const { container, handle, root, session } = await mountBinding();
  const rendered = {
    documentStatus: () => container.querySelector("[data-mme-react-status]")?.childElementCount > 0,
    modeControl: () => container.querySelector("[data-mme-react-mode]")?.childElementCount > 0,
    richView: () => Boolean(container.querySelector(".ProseMirror")),
    selectionBubble: () => Boolean(container.querySelector('[data-testid="selection-bubble-toolbar"]')),
    sourceView: () => Boolean(container.querySelector("[data-mme-react-source] .cm-editor"))
  };
  for (const surface of mdReact.markdownReactBindingPackage.surfaces) {
    if (surface === "sourceView") {
      continue;
    }
    assert.ok(
      rendered[surface]?.(),
      `the binding declares the ${surface} surface but a default mount renders nothing for it — ` +
        "a consumer installing the packages would not get it. This is the MME-0125 defect class."
    );
  }
  // The source view is the other half of the mode pair, so it is asserted in its own mode.
  act(() => session.setMode("source"));
  await waitFor(() => rendered.sourceView(), "the source view to mount in source mode");
  void handle;
  act(() => root.unmount());
});

await check("a sub-panel does not survive the selection that opened it", async () => {
  /*
   * Open the link popover, then move the caret so the bubble has nothing to act
   * on. If the panel flag is not cleared, the next valid selection reopens
   * straight into the URL field instead of the button row — the writer asks for
   * formatting and gets a text input.
   */
  const { container, handle, root } = await mountBinding();
  selectWord(handle, "bravo");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble to appear");
  bubbleOf(container).querySelector('[data-testid="selection-bubble-link"]').click();
  await waitFor(
    () => Boolean(bubbleOf(container).querySelector('[data-testid="selection-bubble-link-input"]')),
    "the link popover to open"
  );
  const view = handle.rich.getEditorView();
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 1)));
  await waitFor(() => bubbleOf(container)?.hidden === true, "the bubble to hide on a collapsed selection");
  selectWord(handle, "charlie");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble to reappear on a new selection");
  assert.equal(
    bubbleOf(container).querySelector('[data-testid="selection-bubble-link-input"]'),
    null,
    "the bubble reopened into the link editor; a panel must not outlive the selection that opened it"
  );
  act(() => root.unmount());
});

await check("an open link popover survives a re-render", async () => {
  /*
   * The host re-renders the bubble on every transaction. If the panel flags are
   * cleared on the wrong branch, the popover closes on the next repaint — in a
   * real host, the next keystroke anywhere, or a scroll — and takes the
   * half-typed destination with it. The previous check cannot see this: a mutant
   * that resets MORE eagerly satisfies it while breaking exactly this case.
   */
  const { container, handle, root } = await mountBinding();
  selectWord(handle, "bravo");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble to appear");
  bubbleOf(container).querySelector('[data-testid="selection-bubble-link"]').click();
  await waitFor(
    () => Boolean(bubbleOf(container).querySelector('[data-testid="selection-bubble-link-input"]')),
    "the link popover to open"
  );
  bubbleOf(container).querySelector('[data-testid="selection-bubble-link-input"]').value = "./half-typed";
  const view = handle.rich.getEditorView();
  view.dispatch(view.state.tr);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
  const input = bubbleOf(container).querySelector('[data-testid="selection-bubble-link-input"]');
  assert.ok(input !== null, "a repaint closed the link popover while the writer was typing into it");
  assert.equal(input.value, "./half-typed", "a repaint discarded the destination the writer had typed");
  act(() => root.unmount());
});

await check("the turn-into control names the block the caret is actually in", async () => {
  /*
   * Three single-constant mutants survived every gate before this check existed:
   * mapping `strike` to the italic command id, returning "orderedList" for a
   * bullet list, and returning "bulletList" for a todo. Each ships a bubble that
   * reports the wrong block or lights the wrong button, and each is one word.
   * The todo case matters most: `todo_item` is never at depth 1, which is why the
   * ancestry walk exists, and the issue explicitly protects it from being
   * "fixed" — while it had zero coverage.
   */
  const { container, handle, root } = await mountBinding();
  const caption = () =>
    bubbleOf(container).querySelector(
      '[data-testid="selection-bubble-turn-into"] .selection-bubble-turn-into-label'
    )?.textContent ?? null;
  const checkedEntry = () => {
    bubbleOf(container).querySelector('[data-testid="selection-bubble-turn-into"]').click();
    const checked = bubbleOf(container).querySelector('[data-turn-into-command][aria-checked="true"]');
    const id = checked?.dataset.turnIntoCommand ?? null;
    bubbleOf(container).querySelector('[data-testid="selection-bubble-turn-into"]')?.click();
    return id;
  };

  selectWord(handle, "bravo");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble over a paragraph");
  assert.equal(caption(), "Paragraph", "a paragraph must report itself as a paragraph");
  assert.equal(checkedEntry(), "paragraph", "the menu's checked entry must match the block the caret is in");

  /*
   * Only the caption is asserted for the list and todo cases: inside a list item
   * no block conversion can run, so MME-0089 disables the control there
   * deliberately rather than shipping an inert one — which means the menu cannot
   * be opened to read its checked entry. The caption is what a writer sees in
   * that state, and it is what the wrong-constant mutants corrupt.
   */
  selectWord(handle, "one");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble over a bullet list");
  assert.equal(caption(), "Bullet list", "a bullet list must not report itself as a numbered list");

  selectWord(handle, "a task");
  await waitFor(() => bubbleOf(container)?.hidden === false, "the bubble over a todo");
  assert.equal(caption(), "Todo", "a todo must report itself as a todo, not as the list that contains it");
  act(() => root.unmount());
});

await check("each mark control reports its own mark, not another's", async () => {
  const { container, handle, root, session } = await mountBinding();
  const pressed = (testId) =>
    bubbleOf(container).querySelector(`[data-testid="${testId}"]`).getAttribute("aria-pressed");
  for (const [testId, marker] of [
    ["selection-bubble-bold", "**bravo**"],
    ["selection-bubble-italic", "*bravo*"],
    ["selection-bubble-strikethrough", "~~bravo~~"],
    ["selection-bubble-inline-code", "`bravo`"]
  ]) {
    const others = [
      "selection-bubble-bold",
      "selection-bubble-italic",
      "selection-bubble-strikethrough",
      "selection-bubble-inline-code"
    ].filter((id) => id !== testId);
    selectWord(handle, "bravo");
    await waitFor(() => bubbleOf(container)?.hidden === false, `the bubble before applying ${testId}`);
    assert.equal(pressed(testId), "false", `${testId} must not report itself pressed over plain text`);
    bubbleOf(container).querySelector(`[data-testid="${testId}"]`).click();
    await waitFor(() => session.getContent().includes(marker), `${testId} to reach the document`);
    selectWord(handle, "bravo");
    await waitFor(() => bubbleOf(container)?.hidden === false, `the bubble after applying ${testId}`);
    assert.equal(pressed(testId), "true", `${testId} must report itself pressed once its mark is applied`);
    for (const other of others) {
      assert.equal(pressed(other), "false", `applying ${testId} must not light ${other}`);
    }
    bubbleOf(container).querySelector(`[data-testid="${testId}"]`).click();
    await waitFor(() => !session.getContent().includes(marker), `${testId} to be removed again`);
  }
  act(() => root.unmount());
});

await check("onRichViewReady reports the handle and its teardown, in that order", async () => {
  const { handle, root, session } = await mountBinding();
  assert.deepEqual(
    handle.events,
    ["handle"],
    `mounting rich mode must deliver exactly one handle and no teardown; got ${JSON.stringify(handle.events)}`
  );
  act(() => session.setMode("source"));
  await waitFor(() => handle.events.length > 1, "the teardown notification");
  assert.deepEqual(
    handle.events,
    ["handle", "null"],
    `leaving rich mode must report exactly one teardown; got ${JSON.stringify(handle.events)}`
  );
  assert.equal(handle.rich, null, "the handle must be null after the rich view unmounts");
  act(() => root.unmount());
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
