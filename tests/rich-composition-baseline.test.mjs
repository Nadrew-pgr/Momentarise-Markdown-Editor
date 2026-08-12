import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * MME-0115 (attempt 3) — a cancelled composition over a block selection must
 * restore the blocks AND the bytes.
 *
 * Attempt 2 proved the restore itself in a real browser and reverted for one
 * located reason: the host adopts the mid-composition document as its Markdown
 * serialization baseline, so a byte-perfect DOM restore still serialized with a
 * blank block the writer never typed. This file is that defect's headless gate.
 *
 * What is REAL here, because a test that fakes the mechanism proves nothing:
 *
 *  - the plugin set is the default one a consumer installs (`createRichMarkdownState`
 *    with no plugin wiring), so a fix living outside it fails this file;
 *  - block selection is entered with a real `Escape` KeyboardEvent at the view's
 *    own DOM, and extended with real `Shift+ArrowDown`;
 *  - `compositionstart` / `compositionend` are real `CompositionEvent`s
 *    dispatched at the view's DOM, so ProseMirror's own composition machinery
 *    runs — including the `endComposition` branch it takes at `compositionstart`;
 *  - the host loop is the demo's `dispatchTransaction` + `syncRichMarkdownToSource`
 *    pair, in shape and in order.
 *
 * What is SIMULATED, and why it is honest: Chromium mutates the block's DOM text
 * while composing, and jsdom has no IME. Those mutations are replayed as the
 * transactions ProseMirror's DOM reader dispatches for them — the composed text
 * replacing the selected range, then (on cancel) that range emptied — carrying
 * the same `composition` meta the DOM reader stamps, and spread across real
 * frames so the guard ticks while `view.composing` is true. All three details
 * are load-bearing: without the meta, `prosemirror-history` groups by adjacency
 * instead and the undo assertions pass for the wrong reason; without the frames,
 * every tick lands after `compositionend` and the drain's "do nothing while
 * composing" branch is never executed at all.
 *
 * The composing document is asserted against the value measured in a real
 * browser and recorded in the MME-0115 attempt-2 build-log entry
 * (`"´\n\nBravo block.\n\n…"`; the two-block figure is derived from the same
 * measurement, not separately measured). `scripts/visual-check-mme0115.mjs`
 * drives the real thing with CDP `Input.imeSetComposition`; this file is what
 * makes the class regressible in `npm test`.
 *
 * The reversion-to-failure table for every assertion is in this issue's
 * `docs/internal/build-log.md` entry.
 */

const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
for (const globalName of [
  "CompositionEvent",
  "DOMParser",
  "DocumentFragment",
  "Element",
  "Event",
  "HTMLElement",
  "KeyboardEvent",
  "MutationObserver",
  "Node",
  "Range"
]) {
  if (dom.window[globalName] !== undefined) {
    globalThis[globalName] = dom.window[globalName];
  }
}

/*
 * jsdom has no layout engine. ProseMirror asks for client rects whenever a
 * transaction scrolls the selection into view, which `undo` does, so the two
 * geometry calls it makes are answered with empty geometry rather than left to
 * throw. Nothing in this file asserts on geometry.
 */
const zeroRect = { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0 };
dom.window.Range.prototype.getClientRects = () => [];
dom.window.Range.prototype.getBoundingClientRect = () => zeroRect;
globalThis.getComputedStyle = (element, pseudo) => dom.window.getComputedStyle(element, pseudo);

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const { EditorView } = await import("prosemirror-view");
const { Selection } = await import("prosemirror-state");
const { undo, undoDepth } = await import("prosemirror-history");

const {
  createRichMarkdownState,
  richBlockSelection,
  richTopLevelBlockRanges,
  isRichCompositionInFlight,
  serializeRichMarkdownState,
  shouldAdoptRichSerializationBaseline
} = rich;

assert.equal(
  typeof isRichCompositionInFlight,
  "function",
  "@momentarise/md-rich-prosemirror must export isRichCompositionInFlight (MME-0115): a host with a flush-now path " +
    "needs the same rule outside `dispatchTransaction`."
);

assert.equal(
  typeof shouldAdoptRichSerializationBaseline,
  "function",
  "@momentarise/md-rich-prosemirror must export shouldAdoptRichSerializationBaseline (MME-0115): the rule that " +
    "no serialization baseline is adopted while a composition is in flight is the package's, not each host's."
);

const SOURCE = "Alpha block.\n\nBravo block.\n\nCharlie block.\n\nDelta block.\n";

/** The dead-key state Chromium leaves mid-composition (measured, build log 2026-08-06). */
const DEAD_KEY = "´";
const COMPOSED = "é";

/*
 * Longer than the guard's own 600ms defence window. A cancelled composition
 * holds the guard for that whole window on purpose — Chromium's late flushes do
 * not arrive on a schedule — so anything asserting on the release has to outwait
 * it rather than the ~48ms a committed composition takes.
 */
const settle = (ms = 900) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Harness — a real EditorView on default plugins, under the demo's host loop
// ---------------------------------------------------------------------------

function mount(markdown) {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.append(host);
  let hostState = createRichMarkdownState(markdown, { dialect: "momentarise-enhanced" });
  const mountedDoc = hostState.editorState.doc;
  const adoptions = [];

  const view = new EditorView(host, {
    state: hostState.editorState,
    dispatchTransaction(transaction) {
      /*
       * `apps/md-demo/src/main.ts`, verbatim in shape: compare documents rather
       * than `transaction.docChanged` (MME-0122), then re-anchor the baseline by
       * serializing and re-parsing.
       */
      const documentBefore = view.state.doc;
      const editorState = view.state.apply(transaction);
      view.updateState(editorState);
      hostState = { ...hostState, editorState };
      const documentChanged = !editorState.doc.eq(documentBefore);
      if (shouldAdoptRichSerializationBaseline({ documentChanged, transaction, view })) {
        const content = serializeRichMarkdownState(hostState).content;
        const parsed = createRichMarkdownState(content, {
          dialect: "momentarise-enhanced",
          schema: hostState.schema
        });
        hostState = { ...parsed, editorState: hostState.editorState };
        adoptions.push({ composing: view.composing, content });
      }
    }
  });

  return {
    adoptions,
    /** What the host would write to the file right now. */
    bytes() {
      return serializeRichMarkdownState({ ...hostState, editorState: view.state }).content;
    },
    destroy() {
      view.destroy();
      host.remove();
    },
    mountedDoc,
    view
  };
}

/** This editor's own live region — never a neighbouring mount's. */
function liveRegionOf(editor) {
  const region = editor.view.dom.parentElement?.querySelector(
    '[data-testid="rich-block-selection-live-region"]'
  );
  assert(region, "the block-selection live region must exist, or any announcement assertion is vacuous.");
  return region;
}

function press(editor, key, modifiers = {}) {
  editor.view.dom.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key, ...modifiers })
  );
}

/** Enters block selection the way a writer does: caret in the block, then Escape. */
function selectBlocks(editor, index, extend = 0) {
  const range = richTopLevelBlockRanges(editor.view.state)[index];
  assert(range, `fixture has no block at index ${index}.`);
  editor.view.dispatch(
    editor.view.state.tr.setSelection(Selection.near(editor.view.state.doc.resolve(range.from + 1), 1))
  );
  press(editor, "Escape");
  for (let step = 0; step < extend; step += 1) {
    press(editor, "ArrowDown", { shiftKey: true });
  }
  const info = richBlockSelection(editor.view.state);
  assert(info, `Escape did not enter block selection on block ${index}.`);
  assert.equal(
    info.count,
    extend + 1,
    `the gesture must select ${extend + 1} block(s); it selected ${info?.count}.`
  );
  return info;
}

/**
 * Chromium's precondition, and the reason `compositionstart` carries the block's
 * own text as `data`: the DOM selection is a text range across the selected
 * blocks before the event fires. Without it ProseMirror reads back the same
 * `NodeSelection` and takes its `deleteSelection` branch instead, which is a
 * different (and rarer) sequence than the one the browser produces.
 */
function putDomRangeAcross(editor, info) {
  const blocks = [...editor.view.dom.children].filter(
    (child) => !child.classList.contains("ProseMirror-widget")
  );
  const first = blocks[info.fromIndex];
  const last = blocks[info.toIndex];
  assert(first && last, "the selected blocks must be rendered before a composition can start over them.");
  const startNode = first.firstChild ?? first;
  const endNode = last.lastChild ?? last;
  const range = dom.window.document.createRange();
  range.setStart(startNode, 0);
  range.setEnd(endNode, endNode.nodeType === 3 ? endNode.nodeValue.length : endNode.childNodes.length);
  const selection = dom.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function compositionEvent(editor, type, data) {
  editor.view.dom.dispatchEvent(
    new dom.window.CompositionEvent(type, { bubbles: true, cancelable: true, data })
  );
}

/**
 * Drives one composition over the current block selection.
 *
 * `flush` replays what ProseMirror's DOM reader dispatches when Chromium has
 * rewritten the composing range: the selected blocks become one paragraph
 * holding the composition's current text. `""` is the cancelled state — the
 * range emptied, which is precisely the byte defect this issue exists for.
 */
let compositionSerial = 0;

function composeOverSelection(editor, info) {
  putDomRangeAcross(editor, info);
  compositionEvent(editor, "compositionstart", editor.view.state.doc.textBetween(info.from, info.to, ""));
  let targetIndex = info.fromIndex;
  let span = { from: info.from, to: info.to };
  /*
   * The id `prosemirror-view` stamps on every transaction it reads out of a live
   * composition, and `prosemirror-history` groups an undo event by. Replaying the
   * flushes without it made the history assertions pass for the wrong reason:
   * grouping fell back to adjacency and the 500ms `newGroupDelay`, so a restore
   * that dropped the id looked identical to one that kept it.
   */
  compositionSerial += 1;
  const compositionId = compositionSerial;
  return {
    cancel() {
      this.flush("");
      compositionEvent(editor, "compositionend", "");
    },
    commit(text) {
      this.flush(text);
      compositionEvent(editor, "compositionend", text);
    },
    flush(text) {
      const { schema } = editor.view.state;
      const paragraph = schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
      editor.view.dispatch(
        editor.view.state.tr.replaceWith(span.from, span.to, paragraph).setMeta("composition", compositionId)
      );
      compositionEvent(editor, "compositionupdate", text);
      const range = richTopLevelBlockRanges(editor.view.state)[targetIndex];
      span = { from: range.from, to: range.to };
    }
  };
}

// ---------------------------------------------------------------------------
// 1. Cancel restores the blocks AND the bytes
// ---------------------------------------------------------------------------

const cancelCases = [
  {
    extend: 0,
    id: "single block",
    // Measured in Chrome, MME-0115 attempt 2: the composing document.
    transient: `${DEAD_KEY}\n\nBravo block.\n\nCharlie block.\n\nDelta block.\n`
  },
  {
    extend: 1,
    id: "two blocks",
    transient: `${DEAD_KEY}\n\nCharlie block.\n\nDelta block.\n`
  }
];

for (const testCase of cancelCases) {
  const editor = mount(SOURCE);
  try {
    assert.equal(editor.bytes(), SOURCE, `${testCase.id}: the fixture must mount byte-identical.`);
    const info = selectBlocks(editor, 0, testCase.extend);
    const selectedIndexes = [info.fromIndex, info.toIndex];

    const composition = composeOverSelection(editor, info);
    composition.flush(DEAD_KEY);
    /*
     * Long enough for the guard to tick while ProseMirror is still composing.
     * Without this the whole composition ran inside one macrotask and the first
     * tick always landed after `compositionend`, so the drain's
     * "do nothing while `view.composing`" branch — the line attempt 1 lost three
     * designs to — was never executed by this suite and could be deleted without
     * turning anything red. It is also the more faithful replay: a real dead-key
     * composition spans many frames, not zero.
     */
    await settle(150);
    assert.equal(
      serializeRichMarkdownState({
        ...createRichMarkdownState(editor.bytes(), { dialect: "momentarise-enhanced" }),
        editorState: editor.view.state
      }).content,
      testCase.transient,
      `${testCase.id}: the composing document must be the one measured in Chrome, or this test is ` +
        "replaying a sequence the browser never produces. (This is a fidelity check on the replay, not one of " +
        "the issue's proofs: it cannot detect a wrongly adopted baseline.)"
    );

    composition.cancel();
    /*
     * Measured after the composition's own flushes, not before them: those are
     * ordinary transactions and they enter history in this harness (the browser
     * groups them by ProseMirror's `composition` meta, which jsdom has no IME to
     * produce). The delta across the drain isolates the one thing the
     * implementation controls — whether the RESTORE becomes an undo step.
     */
    const historyBeforeRestore = undoDepth(editor.view.state);
    const destroyedDoc = editor.view.state.doc;
    await settle();

    // --- the restore: the document ---------------------------------------
    assert(
      editor.view.state.doc.eq(editor.mountedDoc),
      `${testCase.id}: a cancelled composition must restore the selected blocks exactly. ` +
        `Got ${JSON.stringify(editor.view.state.doc.textContent)}.`
    );

    // --- the restore: the block selection ---------------------------------
    const restored = richBlockSelection(editor.view.state);
    assert(restored, `${testCase.id}: the block selection must survive a cancelled composition.`);
    assert.deepEqual(
      [restored.fromIndex, restored.toIndex],
      selectedIndexes,
      `${testCase.id}: the same blocks must be selected after the cancel as before it.`
    );

    // --- the restore: the BYTES, which is what attempt 2 could not ship ----
    assert.equal(
      editor.bytes(),
      SOURCE,
      `${testCase.id}: after a cancelled composition the host must serialize the original bytes. A leading ` +
        "blank block here is the mid-composition state having been adopted as the serialization baseline.",
    );

    // --- a cancelled composition is a non-event for undo -------------------
    assert.equal(
      undoDepth(editor.view.state),
      historyBeforeRestore,
      `${testCase.id}: the restore must not become an undo step; a cancelled composition is a non-event.`
    );
    undo(editor.view.state, (transaction) => {
      editor.view.dispatch(transaction);
    });
    assert(
      !editor.view.state.doc.eq(destroyedDoc),
      `${testCase.id}: undo after a cancelled composition must never bring the wiped document back — that is ` +
        "what a restore recorded as its own undo step does to the writer."
    );
    assert(
      editor.view.state.doc.eq(editor.mountedDoc),
      `${testCase.id}: undo must step back past the whole non-event and land on the writer's document. A restore ` +
        "outside history leaves the composition's inverse steps for undo to replay onto an already-restored " +
        `document. Got ${JSON.stringify(editor.view.state.doc.textContent)}.`
    );

    // --- and no baseline was ever adopted from a composing document --------
    assert.deepEqual(
      editor.adoptions.filter((entry) => entry.composing),
      [],
      `${testCase.id}: no serialization baseline may be adopted while a composition is in flight.`
    );
    assert.equal(
      editor.adoptions.at(-1)?.content,
      SOURCE,
      `${testCase.id}: the host must re-anchor once the composition has drained, on the restored bytes.`
    );
  } finally {
    editor.destroy();
  }
}

// ---------------------------------------------------------------------------
// 1b. The same cancel, without the browser's DOM-range precondition.
//
// Measured while building this: ProseMirror's own `compositionstart` handler
// runs `endComposition(view, !selection.empty)`, and when the DOM selection maps
// back to the same `NodeSelection` that branch calls `deleteSelection()` — it
// destroys the block itself, and it does so BEFORE setting `input.composing`.
// A host gating only on `view.composing` therefore adopts that destroyed
// document as its baseline, which is why the guard is armed by this plugin's own
// handler (`runCustomHandler` runs custom handlers first) rather than read off
// `view.composing`.
// ---------------------------------------------------------------------------

{
  const editor = mount(SOURCE);
  try {
    const info = selectBlocks(editor, 0, 0);
    // Deliberately no `putDomRangeAcross`: this is the other branch.
    compositionEvent(editor, "compositionstart", "Alpha block.");
    assert(
      !editor.view.state.doc.eq(editor.mountedDoc),
      "no-dom-range: this case is only meaningful while ProseMirror destroys the block at compositionstart; " +
        "if that branch ever stops firing, delete the case rather than let it pass vacuously."
    );
    compositionEvent(editor, "compositionend", "");
    await settle();

    assert(
      editor.view.state.doc.eq(editor.mountedDoc),
      "no-dom-range: the blocks must come back from this branch too."
    );
    assert.equal(
      editor.bytes(),
      SOURCE,
      "no-dom-range: the destruction ProseMirror dispatches before `composing` is set must not become the " +
        "serialization baseline either."
    );
    assert.deepEqual(
      editor.adoptions.map((entry) => entry.content),
      [SOURCE],
      "no-dom-range: exactly one baseline adoption, on the restored document."
    );
  } finally {
    editor.destroy();
  }
}

// ---------------------------------------------------------------------------
// 1a. What a screen reader hears through a cancelled composition.
//
// The block selection is an announced surface: a polite live region reports what
// is selected. The watchdog clears and re-asserts the selection, and the
// composition clears it in between, so without care the region narrates a state
// that never existed — "Block selection cleared", then the same selection
// announced again, for a gesture that changed nothing. Everything a composition
// passes through is provisional, including what it says out loud.
// ---------------------------------------------------------------------------

{
  const editor = mount(SOURCE);
  try {
    const liveRegion = liveRegionOf(editor);

    const announced = [];
    const observer = new dom.window.MutationObserver(() => {
      announced.push(liveRegion.textContent ?? "");
    });
    observer.observe(liveRegion, { characterData: true, childList: true, subtree: true });

    const info = selectBlocks(editor, 0, 0);
    const onSelect = liveRegion.textContent;
    assert(
      onSelect && onSelect.length > 0,
      "selecting a block must announce something, or the rest of this case is vacuous."
    );
    // MutationObserver delivers its records in a microtask, so the selection's
    // own announcement is still pending here; drain it before measuring what the
    // composition adds.
    await settle(20);
    announced.length = 0;

    const composition = composeOverSelection(editor, info);
    composition.flush(DEAD_KEY);
    composition.cancel();
    await settle();
    observer.disconnect();

    assert.deepEqual(
      announced,
      [],
      `a cancelled composition must announce nothing: the selection it clears and restores never changed for the ` +
        `writer. Heard ${JSON.stringify(announced)}.`
    );
    assert.equal(
      liveRegion.textContent,
      onSelect,
      "and the live region must still hold what was announced when the block was selected."
    );
  } finally {
    editor.destroy();
  }
}

// ---------------------------------------------------------------------------
// 1bis. A flush that lands AFTER `compositionend`.
//
// Attempt 1's telemetry (build log, 2026-08-05): "Chromium then flushed the
// cancelled composition's remaining DOM removals AFTER compositionend, mapping
// them onto the restored document and re-destroying it. There is no DOM event
// that marks the last flush of a cancelled composition." ProseMirror's own
// teardown has the same shape — `compositionend` schedules `endComposition` 20ms
// later, which force-flushes the DOM observer, i.e. after the drain's first tick.
//
// This is why the restore is idempotent rather than a single shot: it re-asserts
// on every deviation until the document holds still, which overrules late
// flushes instead of racing them. jsdom produces no such flush on its own, so
// the measured one is replayed here.
// ---------------------------------------------------------------------------

/*
 * Three delays, not one. The first version of this case injected its flush at
 * 20ms — inside the few quiet frames the drain used to stop after — so it proved
 * only the easy half of the window and passed against a guard that stood down at
 * ~48ms. The Accessibility Reviewer measured a flush at 80ms destroying the block
 * with nothing left to catch it: no restore, and a live region saying "Block
 * selection cleared", which is character-for-character what a deliberate Escape
 * says. 150ms and 400ms are inside the documented 600ms window and outside any
 * stability shortcut.
 */
for (const delayMs of [20, 150, 400]) {
  const editor = mount(SOURCE);
  try {
    const info = selectBlocks(editor, 0, 0);
    const composition = composeOverSelection(editor, info);
    composition.flush(DEAD_KEY);
    composition.cancel();
    await settle(delayMs);
    const range = richTopLevelBlockRanges(editor.view.state)[0];
    editor.view.dispatch(
      editor.view.state.tr.replaceWith(range.from, range.to, editor.view.state.schema.nodes.paragraph.create())
    );
    await settle();

    assert(
      editor.view.state.doc.eq(editor.mountedDoc),
      `late flush +${delayMs}ms: a removal that lands after \`compositionend\` must be overruled, not obeyed. Got ` +
        `${JSON.stringify(editor.view.state.doc.textContent)}.`
    );
    assert.equal(
      editor.bytes(),
      SOURCE,
      `late flush +${delayMs}ms: and the bytes must be the writer's, not the flush's.`
    );
    const restored = richBlockSelection(editor.view.state);
    assert.equal(
      restored?.count,
      1,
      `late flush +${delayMs}ms: the block must still be selected — a flush that wins leaves the writer with no ` +
        "selection and no announcement that anything was lost."
    );
  } finally {
    editor.destroy();
  }
}

// ---------------------------------------------------------------------------
// 1d. A cancel that arrives after `prosemirror-history`'s grouping window.
//
// The writer types `option+e`, pauses, then presses Escape. The restore now
// lands more than `newGroupDelay` (500ms) after the composition's last change,
// so adjacency and time can no longer group it: the ONLY thing that puts it in
// the composition's undo event is the id it carries. Without that, one Cmd+Z
// undoes the restore and hands the writer back the document the cancelled
// composition had wiped.
// ---------------------------------------------------------------------------

{
  const editor = mount(SOURCE);
  try {
    const info = selectBlocks(editor, 0, 0);
    const composition = composeOverSelection(editor, info);
    composition.flush(DEAD_KEY);
    await settle(700);
    const wiped = editor.view.state.doc;
    composition.cancel();
    await settle();

    assert(editor.view.state.doc.eq(editor.mountedDoc), "late cancel: the blocks must come back.");
    undo(editor.view.state, (transaction) => {
      editor.view.dispatch(transaction);
    });
    assert(
      !editor.view.state.doc.eq(wiped),
      "late cancel: one undo must not hand back the document the cancelled composition wiped. The restore has to " +
        "join the composition's own history event; past `newGroupDelay`, only its id can put it there."
    );
    assert(
      editor.view.state.doc.eq(editor.mountedDoc),
      `late cancel: undo must land on the writer's document. Got ${JSON.stringify(editor.view.state.doc.textContent)}.`
    );
  } finally {
    editor.destroy();
  }
}

// ---------------------------------------------------------------------------
// 1c. A restarted composition still restores the document the writer authored.
//
// ProseMirror restarts compositions rather than nesting them (its
// `compositionstart` handler calls `endComposition(view, true)` and starts
// again), and a longer IME session produces several starts. Only the first
// snapshot is of a document the writer wrote; re-snapshotting on a restart would
// capture the transient composing state and "restore" to it.
// ---------------------------------------------------------------------------

{
  const editor = mount(SOURCE);
  try {
    const info = selectBlocks(editor, 0, 0);
    const composition = composeOverSelection(editor, info);
    composition.flush(DEAD_KEY);
    compositionEvent(editor, "compositionstart", DEAD_KEY);
    composition.flush("ô");
    composition.cancel();
    await settle();

    assert(
      editor.view.state.doc.eq(editor.mountedDoc),
      "restart: a composition restarted mid-session must still restore the document the writer authored, " +
        `not the transient one. Got ${JSON.stringify(editor.view.state.doc.textContent)}.`
    );
    assert.equal(editor.bytes(), SOURCE, "restart: and its bytes.");
  } finally {
    editor.destroy();
  }
}

// ---------------------------------------------------------------------------
// 2. The commit path still conforms — it did before this issue, and must after
// ---------------------------------------------------------------------------

const commitCases = [
  {
    announcement: "Block replaced",
    expected: `${COMPOSED}\n\nBravo block.\n\nCharlie block.\n\nDelta block.\n`,
    extend: 0,
    id: "single block"
  },
  {
    announcement: "2 blocks replaced",
    expected: `${COMPOSED}\n\nCharlie block.\n\nDelta block.\n`,
    extend: 1,
    id: "two blocks"
  }
];

for (const testCase of commitCases) {
  const editor = mount(SOURCE);
  try {
    const info = selectBlocks(editor, 0, testCase.extend);
    const liveRegion = liveRegionOf(editor);
    const composition = composeOverSelection(editor, info);
    composition.flush(DEAD_KEY);
    composition.commit(COMPOSED);
    await settle();

    /*
     * The issue's goal is that a composition replaces a block selection "the way
     * an ordinary keystroke does" — and a keystroke announces "2 blocks
     * replaced" (`replaceRichBlockSelectionWithTextCommand`). A composition used
     * to announce "Block selection cleared" instead: the browser's own
     * replacement clears the plugin state and nothing put a notice back. For the
     * French, Spanish and Portuguese writers this issue exists for, that is the
     * accented-character path reporting a LOST selection where the plain path
     * reports a completed replacement.
     */
    assert.equal(
      liveRegion.textContent,
      testCase.announcement,
      `commit/${testCase.id}: a committed composition must announce its replacement, not a cleared selection.`
    );

    assert.equal(
      editor.bytes(),
      testCase.expected,
      `commit/${testCase.id}: a committed composition must replace the selected blocks with the composed text.`
    );
    assert(
      !editor.view.state.doc.eq(editor.mountedDoc),
      `commit/${testCase.id}: a committed composition must NOT be restored — only a cancelled one is.`
    );
    assert.equal(
      editor.adoptions.at(-1)?.content,
      testCase.expected,
      `commit/${testCase.id}: the host must re-anchor on the committed bytes once the composition drains.`
    );
  } finally {
    editor.destroy();
  }
}

// ---------------------------------------------------------------------------
// 3. A composition at a plain caret — no block selection, no restore, and the
//    host still gets its baseline back. This is the case that proves the
//    release exists: nothing else dispatches a transaction after the composing
//    flush, so a host that only defers would keep pre-composition bytes and
//    save them (the MME-0122 stale-bytes class).
// ---------------------------------------------------------------------------

{
  const editor = mount(SOURCE);
  try {
    const range = richTopLevelBlockRanges(editor.view.state)[1];
    editor.view.dispatch(
      editor.view.state.tr.setSelection(Selection.near(editor.view.state.doc.resolve(range.to - 1), -1))
    );
    assert.equal(richBlockSelection(editor.view.state), null, "caret/plain: no block selection may be active.");

    assert.equal(
      isRichCompositionInFlight(editor.view),
      false,
      "caret/plain: nothing is in flight before the composition starts."
    );
    compositionEvent(editor, "compositionstart", "");
    assert.equal(
      isRichCompositionInFlight(editor.view),
      true,
      "caret/plain: the window opens at compositionstart — before ProseMirror sets `view.composing`, which is " +
        "the point of tracking it here rather than reading that flag."
    );
    const caret = editor.view.state.selection.from;
    editor.view.dispatch(editor.view.state.tr.insertText(COMPOSED, caret, caret));
    compositionEvent(editor, "compositionupdate", COMPOSED);
    assert.deepEqual(
      editor.adoptions,
      [],
      "caret/plain: the composing document must not be adopted as a baseline."
    );
    compositionEvent(editor, "compositionend", COMPOSED);
    await settle();

    const expected = `Alpha block.\n\nBravo block.${COMPOSED}\n\nCharlie block.\n\nDelta block.\n`;
    assert.equal(editor.bytes(), expected, "caret/plain: the composed character must land at the caret.");
    assert.equal(
      editor.adoptions.length,
      1,
      "caret/plain: the composition must release exactly one baseline adoption once it has drained; " +
        "without it the host keeps pre-composition bytes and saves them."
    );
    assert.equal(editor.adoptions[0]?.composing, false, "caret/plain: the release must arrive after composing ends.");
    assert.equal(
      isRichCompositionInFlight(editor.view),
      false,
      "caret/plain: and the window closes when the composition has drained, or a flush-now host would defer forever."
    );
    assert.equal(editor.adoptions[0]?.content, expected, "caret/plain: the released baseline must be the final bytes.");
  } finally {
    editor.destroy();
  }
}

// ---------------------------------------------------------------------------
// 4. The predicate's own contract, without a composition in sight
// ---------------------------------------------------------------------------

{
  const editor = mount(SOURCE);
  try {
    const idle = { composing: false };
    const composing = { composing: true };
    const ordinary = editor.view.state.tr.insertText("x", 1, 1);

    assert.equal(
      shouldAdoptRichSerializationBaseline({ documentChanged: true, transaction: ordinary, view: idle }),
      true,
      "contract: an ordinary document change outside a composition is exactly when a host re-anchors."
    );
    assert.equal(
      shouldAdoptRichSerializationBaseline({ documentChanged: false, transaction: editor.view.state.tr, view: idle }),
      false,
      "contract: a transaction that changed nothing is not a reason to re-anchor."
    );
    assert.equal(
      shouldAdoptRichSerializationBaseline({ documentChanged: true, transaction: ordinary, view: composing }),
      false,
      "contract: `view.composing` alone must be enough to refuse, for a host whose view this package did not arm."
    );
  } finally {
    editor.destroy();
  }
}

// ---------------------------------------------------------------------------
// 5. Reachability — the rule has a consumer, and it is the demo's own loop
// ---------------------------------------------------------------------------

const demoSource = readFileSync("apps/md-demo/src/main.ts", "utf8");
assert(
  demoSource.includes("shouldAdoptRichSerializationBaseline"),
  "apps/md-demo must consume the package rule: an exported predicate with no call site is a stub that looks " +
    "implemented (AGENT.md, Reachability). The demo is the loop hosts copy — that is why this issue is not a demo patch."
);
assert(
  /shouldAdoptRichSerializationBaseline\(\{[\s\S]{0,200}?\}\)/.test(demoSource),
  "apps/md-demo must call the predicate, not merely import its name."
);

/*
 * The demo's other re-anchor sites. Two shapes, and only one of them is this
 * issue's business:
 *
 *  - **Flush-now callers** — mode switch, find/replace, AI, asset insertion —
 *    read the derived Markdown outside `dispatchTransaction`, so the predicate
 *    above cannot reach them. Their idiom was `if (richChanged) { sync }`; every
 *    one now goes through `flushRichMarkdownToSource`, which refuses while a
 *    composition is in flight.
 *  - **Command paths** — toolbar, table and footnote commands — apply an edit
 *    with `updateState` and re-anchor on the document they just produced. That
 *    document is the user's own edit, not a state a composition is passing
 *    through, so deferring them would strand a real change. They stay direct.
 *
 * Both are pinned: the raw idiom must not come back, and the number of direct
 * call sites must not grow without someone deciding which shape a new one is.
 */
const unguardedFlushes = (demoSource.match(/if\s*\(richChanged\)\s*\{\s*syncRichMarkdownToSource\(/g) ?? []).length;
assert.equal(
  unguardedFlushes,
  0,
  `apps/md-demo has ${unguardedFlushes} flush-now caller(s) calling syncRichMarkdownToSource directly. Route them ` +
    "through `flushRichMarkdownToSource`, which refuses while a composition is in flight."
);

const directSyncCallSites = (demoSource.match(/^\s*syncRichMarkdownToSource\(/gm) ?? []).length;
assert.equal(
  directSyncCallSites,
  9,
  `apps/md-demo has ${directSyncCallSites} direct \`syncRichMarkdownToSource(\` call sites; MME-0115 left 9 — one ` +
    "inside `flushRichMarkdownToSource`, one in the gated `dispatchTransaction`, and seven command paths that " +
    "re-anchor on an edit they just applied themselves. A new one is a decision: if it reads the Markdown rather " +
    "than producing it, route it through `flushRichMarkdownToSource` instead of raising this number."
);
assert(
  /function flushRichMarkdownToSource[\s\S]{0,400}?isRichCompositionInFlight\(richEditor\)/.test(demoSource),
  "apps/md-demo's flush-now helper must consult isRichCompositionInFlight; without it the helper is a rename."
);

console.log(
  `rich-composition-baseline: ${cancelCases.length} cancel + ${commitCases.length} commit cases, ` +
    "caret composition, predicate contract, and the demo call site all proven."
);
