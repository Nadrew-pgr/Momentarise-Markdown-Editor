import { readdir, readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import {
  createMarkdownEditorSession,
  editorModesForDocumentKind,
  isEditorModeAvailableForDocumentKind
} from "../packages/md-editor/dist/index.js";
import { createMemorySaveTarget, createSaveEngine, hashMarkdownContent } from "../packages/md-save/dist/index.js";
import {
  createModeControl,
  defaultMmeStrings
} from "../packages/md-surface/dist/index.js";
import {
  createRichMarkdownState,
  replaceFirstRichText,
  serializeRichMarkdownState
} from "../packages/md-rich-prosemirror/dist/index.js";
import { renderMarkdownToHtml } from "../packages/md-render-html/dist/index.js";

const session = createMarkdownEditorSession({
  content: "# Live Preview\n\nSource stays canonical.\n",
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({
    initialContent: "# Live Preview\n\nSource stays canonical.\n"
  })
});
const modeEvents = [];
session.on("mode", (payload) => modeEvents.push(payload.mode));
session.setMode("live-preview");
assert(session.getMode() === "live-preview", "Session must accept live-preview as a distinct mode.");
assert(modeEvents.includes("live-preview"), "Session must emit live-preview mode transitions.");

const markdownModes = editorModesForDocumentKind("markdown").map((mode) => mode.id);
assertSequence(markdownModes, ["source", "rich", "live-preview"], "Markdown mode availability");
assert(isEditorModeAvailableForDocumentKind("live-preview", "markdown"), "Live Preview must be available for Markdown.");
assert(!isEditorModeAvailableForDocumentKind("preview", "markdown"), "Markdown mode controls must not expose HTML Preview.");

const htmlModes = editorModesForDocumentKind("html-artifact").map((mode) => mode.id);
assertSequence(htmlModes, ["source", "preview"], "HTML artifact mode availability");
assert(!isEditorModeAvailableForDocumentKind("rich", "html-artifact"), "HTML artifacts must not expose Rich mode.");
assert(!isEditorModeAvailableForDocumentKind("live-preview", "html-artifact"), "HTML artifacts must not expose Live Preview.");

assertModeControl({
  documentKind: "markdown",
  editorMode: "live-preview",
  expectedModes: ["source", "rich", "live-preview"],
  missingModes: ["preview"]
});
assertModeControl({
  documentKind: "html-artifact",
  editorMode: "preview",
  expectedModes: ["source", "preview"],
  missingModes: ["rich", "live-preview"]
});

assertTypedMarkdown("Paragraph text", "Paragraph text", "paragraph live typing", ["paragraph"]);
assertTypedMarkdown("# Live title", "# Live title", "heading live typing", ["heading"]);
assertTypedMarkdown("- Live bullet", "- Live bullet", "bullet list live typing", ["bullet_list", "list_item", "paragraph"]);
assertTypedMarkdown("1. Ordered item", "1. Ordered item", "ordered list live typing", ["ordered_list", "list_item", "paragraph"]);
assertTypedMarkdown("- [ ] Live task", "- [ ] Live task", "task list live typing", ["bullet_list", "todo_item", "paragraph"]);
assertTypedMarkdown("> Live quote", "> Live quote", "blockquote live typing", ["blockquote", "paragraph"]);
assertTypedMarkdown("```ts const answer = 42;", "```ts\nconst answer = 42;\n```", "code fence live typing", ["code_block"]);
assertTypedMarkdown("---", "---", "thematic break live typing", ["horizontal_rule"]);
assertTypedInlineMark("Use `inline code` here", "code", "inline code", "inline code live typing");
assertTypedInlineMark(
  "Read [the guide](https://momentarise.dev/docs) now",
  "link",
  "https://momentarise.dev/docs",
  "link live typing"
);
assertTypedLinkWithTitle(
  'Read [the guide](https://momentarise.dev/docs "Momentarise docs") now',
  "https://momentarise.dev/docs",
  "Momentarise docs",
  "link title live typing"
);
assertInvalidTypedLinkTitleStaysPlain("Read [the guide](https://momentarise.dev/docs bad title) now");
assertTypedImageLikeMarkdownPreserved("![diagram](./diagram.png)");
assertUnsafeTypedLinkNotActivated("Read [bad](javascript:alert(1)) now");

const liveTarget = createMemorySaveTarget({
  initialContent: mixedLineEndSource()
});
const liveSession = createMarkdownEditorSession({
  content: mixedLineEndSource(),
  scheduler: createManualScheduler(),
  target: liveTarget
});
liveSession.setMode("source");
liveSession.setMode("live-preview");
const mountedLiveState = createRichMarkdownState(liveSession.getContent(), {
  dialect: "momentarise-enhanced"
});
const liveMountedOutput = serializeRichMarkdownState(mountedLiveState).content;
assert(liveMountedOutput === mixedLineEndSource(), "Live Preview mount must keep source bytes unchanged.");
liveSession.setContent(liveMountedOutput, "rich-view");
liveSession.setMode("source");
const liveFlush = await liveSession.flush("mode-switch");
assert(liveFlush.status === "noop", `Clean Live Preview mode-switch flush must be noop, got ${liveFlush.status}.`);
assert(liveTarget.writeCount() === 0, `Clean Live Preview mount must not write, got ${liveTarget.writeCount()} writes.`);
assert(liveTarget.readContent() === mixedLineEndSource(), "Live Preview clean mount/unmount must preserve saved target bytes.");
const liveCopyMarkdown = liveSession.getContent();
assert(liveCopyMarkdown === mixedLineEndSource(), "Live Preview copy/export content must stay byte-identical after mount/unmount.");

const editedLiveTarget = createMemorySaveTarget({
  initialContent: mixedLineEndSource()
});
const editedLiveSession = createMarkdownEditorSession({
  content: mixedLineEndSource(),
  scheduler: createManualScheduler(),
  target: editedLiveTarget
});
editedLiveSession.setMode("live-preview");
const editedLiveState = replaceFirstRichText(
  createRichMarkdownState(editedLiveSession.getContent(), { dialect: "momentarise-enhanced" }),
  "source mode",
  "live preview mode"
);
const editedLiveOutput = serializeRichMarkdownState(editedLiveState).content;
editedLiveSession.setContent(editedLiveOutput, "rich-view");
const editedLiveFlush = await editedLiveSession.flush("mode-switch");
assert(editedLiveFlush.status === "saved", `Edited Live Preview mode-switch flush must save, got ${editedLiveFlush.status}.`);
assert(editedLiveTarget.writeCount() === 1, `Edited Live Preview save must write once, got ${editedLiveTarget.writeCount()}.`);
assert(
  editedLiveTarget.readContent().includes("live preview mode"),
  "Edited Live Preview save target must receive serialized Markdown."
);
assert(
  editedLiveTarget.readContent().includes("```mermaid\nsequenceDiagram"),
  "Edited Live Preview save target must preserve unrelated Mermaid source bytes."
);

const externalCleanSession = createMarkdownEditorSession({
  content: "# External\n\nClean local copy.\n",
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({
    initialContent: "# External\n\nClean local copy.\n"
  })
});
externalCleanSession.setMode("live-preview");
const cleanExternalResult = externalCleanSession.applyExternalContent("# External\n\nChanged externally.\n");
assert(cleanExternalResult.status === "applied", `Clean Live Preview external change must apply, got ${cleanExternalResult.status}.`);
assert(
  externalCleanSession.getContent() === "# External\n\nChanged externally.\n",
  "Clean Live Preview external change must replace session content."
);

const externalDirtySession = createMarkdownEditorSession({
  content: "# External\n\nBase local copy.\n",
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({
    initialContent: "# External\n\nBase local copy.\n"
  })
});
externalDirtySession.setMode("live-preview");
externalDirtySession.setContent("# External\n\nUnsaved local edit.\n", "rich-view");
const dirtyExternalResult = externalDirtySession.applyExternalContent("# External\n\nChanged externally.\n");
assert(dirtyExternalResult.status === "conflict", `Dirty Live Preview external change must conflict, got ${dirtyExternalResult.status}.`);
assert(
  externalDirtySession.getContent() === "# External\n\nUnsaved local edit.\n",
  "Dirty Live Preview external change must not overwrite local edits."
);

const saveWrites = [];
let diskContent = mixedLineEndSource();
const diskTarget = {
  persistenceTarget: "disk",
  targetLabel: "disk://live-preview.md",
  readExternalHash() {
    return hashMarkdownContent(diskContent);
  },
  async write(request) {
    saveWrites.push(request);
    diskContent = request.content;
    return {
      externalHash: request.contentHash,
      status: "saved"
    };
  }
};
const saveEngine = createSaveEngine({
  content: mixedLineEndSource(),
  target: diskTarget
});
saveEngine.updateContent(editedLiveOutput);
const saveResult = await saveEngine.flush({ reason: "mode-switch" });
assert(saveResult.status === "saved", `Live Preview save engine proof must save, got ${saveResult.status}.`);
assert(saveWrites[0]?.reason === "mode-switch", "Live Preview save proof must preserve mode-switch write reason.");
assertEveryLineExcept(
  mixedLineEndSource(),
  saveWrites[0].content,
  (line) => line.includes("source mode"),
  "Live Preview save pipeline must preserve unrelated lines"
);

const fixtureDirs = (await readdir("fixtures", { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const identityFailures = [];
for (const fixtureId of fixtureDirs) {
  const input = await readFile(`fixtures/${fixtureId}/input.md`, "utf8");
  const fixtureSession = createMarkdownEditorSession({
    content: input,
    scheduler: createManualScheduler(),
    target: createMemorySaveTarget({
      initialContent: input
    })
  });
  fixtureSession.setMode("source");
  fixtureSession.setMode("live-preview");
  const liveState = createRichMarkdownState(fixtureSession.getContent(), {
    dialect: "momentarise-enhanced"
  });
  const output = serializeRichMarkdownState(liveState).content;
  fixtureSession.setMode("source");
  if (output !== input || fixtureSession.getContent() !== input) {
    identityFailures.push(`${fixtureId}: ${firstByteDifference(input, output)}`);
  }
}
assert(
  identityFailures.length === 0,
  `Source -> Live Preview -> Source identity failed:\n${identityFailures.join("\n")}`
);

const mixedInput = await readFile("fixtures/014-mixed-real-world/input.md", "utf8");
const mixedEdited = replaceFirstRichText(
  createRichMarkdownState(mixedInput, { dialect: "momentarise-enhanced" }),
  "source mode",
  "live preview mode"
);
const mixedOutput = serializeRichMarkdownState(mixedEdited).content;
for (const protectedLine of [
  "```mermaid",
  "sequenceDiagram",
  "Related: [[Save Engine]], [Quality Gates](../docs/internal/QUALITY_GATES.md)",
  '<div data-preview="safe">HTML artifact placeholder</div>'
]) {
  assert(
    mixedOutput.includes(protectedLine),
    `Live Preview edited-block serialization must preserve unrelated source line: ${protectedLine}`
  );
}
assert(mixedOutput.includes("live preview mode"), "Live Preview edited block must serialize the edited text.");

const htmlMarkdown = [
  "# HTML policy",
  "",
  "Inline <kbd>Cmd</kbd> + <kbd>K</kbd> should render only through sanitizer.",
  "",
  '<aside onclick="boom()">Safe text <script>boom()</script></aside>',
  ""
].join("\n");
const htmlBefore = htmlMarkdown.slice();
const htmlRendered = renderMarkdownToHtml(htmlMarkdown, {
  fileName: "live-preview-html-policy.md"
});
assert(htmlMarkdown === htmlBefore, "HTML render policy must not mutate Markdown source bytes.");
assert(htmlRendered.html.includes("<kbd>Cmd</kbd>"), "Safe inline HTML may render through md-render-html.");
assert(htmlRendered.html.includes("Safe text"), "Safe raw HTML text must remain visible after render sanitization.");
assert(!htmlRendered.html.toLowerCase().includes("onclick="), "Unsafe HTML attributes must be stripped.");
assert(!htmlRendered.html.toLowerCase().includes("<script"), "Script HTML must be stripped.");
assert(
  htmlRendered.diagnostics.some((diagnostic) => diagnostic.code === "render_html_stripped"),
  "Unsafe HTML policy cases must emit render-only diagnostics."
);

function assertModeControl({ documentKind, editorMode, expectedModes, missingModes }) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const host = dom.window.document.createElement("div");
  const actions = [];
  const component = createModeControl({
    host,
    icons: {
      render(name) {
        return `<span data-icon="${name}" aria-hidden="true"></span>`;
      }
    },
    preferences: {
      aiEntryPoints: [],
      toolbarMode: "sticky",
      visibleCommandGroups: []
    },
    session,
    state: {
      documentKind,
      editorMode
    },
    strings: defaultMmeStrings,
    onSwitchMode(mode) {
      actions.push(mode);
    }
  });
  for (const mode of expectedModes) {
    const button = host.querySelector(`[data-editor-mode="${mode}"]`);
    assert(button, `${documentKind} mode control missing ${mode}.`);
    if (mode === "source") {
      assert(button.textContent === defaultMmeStrings.mode.source, "Source must be a visible labeled mode.");
      assert(button.getAttribute("aria-label") === defaultMmeStrings.mode.source, "Source aria label must identify Source mode.");
      assert(!button.hasAttribute("aria-checked"), "Source must not expose stale binary switch state when three Markdown modes exist.");
      assert(button.getAttribute("role") !== "switch", "Source must be a normal mode button, not a rich-mode switch.");
    }
    if (mode === "rich") {
      assert(button.textContent === defaultMmeStrings.mode.rich, "Rich label must come from strings.");
    }
    if (mode === "live-preview") {
      assert(button.textContent === defaultMmeStrings.mode.livePreview, "Live Preview label must come from strings.");
      assert(button.getAttribute("aria-pressed") === "true", "Active Live Preview button must expose aria-pressed.");
      button.click();
      assert(actions.includes("live-preview"), "Live Preview click must dispatch live-preview mode.");
    }
  }
  for (const mode of missingModes) {
    assert(!host.querySelector(`[data-editor-mode="${mode}"]`), `${documentKind} mode control must not expose ${mode}.`);
  }
  component.destroy();
}

function assertTypedMarkdown(input, expectedMarkdown, label, expectedPath) {
  const state = typeIntoRichState(createRichMarkdownState("", { dialect: "momentarise-enhanced" }), input);
  const output = serializeRichMarkdownState(state).content;
  assert(output.includes(expectedMarkdown), `${label} missing ${JSON.stringify(expectedMarkdown)}.\n${output}`);
  assertNodePath(state, expectedPath, `${label} node shape`);
}

function assertTypedInlineMark(input, markName, expectedValue, label) {
  const state = typeIntoRichState(createRichMarkdownState("", { dialect: "momentarise-enhanced" }), input);
  const output = serializeRichMarkdownState(state).content;
  const marks = collectMarks(state.editorState.doc.toJSON(), markName);
  assert(marks.length > 0, `${label} must create a ${markName} mark.\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  if (markName === "link") {
    assert(
      marks.some((mark) => mark.attrs?.href === expectedValue),
      `${label} must preserve link href ${expectedValue}.\n${JSON.stringify(marks, null, 2)}`
    );
    assert(output.includes(`[the guide](${expectedValue})`), `${label} must serialize Markdown link.\n${output}`);
  } else {
    assert(output.includes("`inline code`"), `${label} must serialize Markdown inline code.\n${output}`);
  }
}

function assertTypedLinkWithTitle(input, expectedHref, expectedTitle, label) {
  const state = typeIntoRichState(createRichMarkdownState("", { dialect: "momentarise-enhanced" }), input);
  const output = serializeRichMarkdownState(state).content;
  const links = collectMarks(state.editorState.doc.toJSON(), "link");
  assert(
    links.some((mark) => mark.attrs?.href === expectedHref && mark.attrs?.title === expectedTitle),
    `${label} must create a link mark with title.\n${JSON.stringify(links, null, 2)}`
  );
  assert(output.includes(`[the guide](${expectedHref} "${expectedTitle}")`), `${label} must serialize Markdown link title.\n${output}`);
}

function assertInvalidTypedLinkTitleStaysPlain(input) {
  const state = typeIntoRichState(createRichMarkdownState("", { dialect: "momentarise-enhanced" }), input);
  const links = collectMarks(state.editorState.doc.toJSON(), "link");
  assert(links.length === 0, `Invalid title syntax must not create a link mark.\n${JSON.stringify(links, null, 2)}`);
  assert(serializeRichMarkdownState(state).content.includes(input), "Invalid title syntax must remain visible as typed Markdown.");
}

function assertTypedImageLikeMarkdownPreserved(input) {
  const state = typeIntoRichState(createRichMarkdownState("", { dialect: "momentarise-enhanced" }), input);
  const output = serializeRichMarkdownState(state).content;
  assert(output.includes(input), `Image-like Markdown must not be partially converted into a link.\n${output}`);
}

function assertUnsafeTypedLinkNotActivated(input) {
  const state = typeIntoRichState(createRichMarkdownState("", { dialect: "momentarise-enhanced" }), input);
  const output = serializeRichMarkdownState(state).content;
  const links = collectMarks(state.editorState.doc.toJSON(), "link");
  assert(links.length === 0, `Unsafe typed link must not create a link mark.\n${JSON.stringify(links, null, 2)}`);
  assert(output.includes(input), `Unsafe typed link Markdown text must remain source-visible.\n${output}`);
}

function typeIntoRichState(state, text) {
  let editorState = state.editorState;
  for (const character of text) {
    const transaction = editorState.tr.insertText(character);
    const result = editorState.applyTransaction(transaction);
    editorState = result.state;
  }
  return {
    ...state,
    editorState
  };
}

function assertNodePath(state, expectedPath, label) {
  let node = state.editorState.doc;
  for (const expectedType of expectedPath) {
    node = node.firstChild;
    assert(
      node && node.type.name === expectedType,
      `${label} expected path ${expectedPath.join(" > ")}.\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`
    );
  }
}

function assertEveryLineExcept(input, output, isEditedLine, label) {
  const inputLines = input.split("\n");
  const outputLines = output.split("\n");
  assert(inputLines.length === outputLines.length, `${label}: line count changed.\n${output}`);
  for (let index = 0; index < inputLines.length; index += 1) {
    if (isEditedLine(inputLines[index], index)) {
      continue;
    }
    assert(
      inputLines[index] === outputLines[index],
      `${label}: line ${index + 1} changed.\ninput: ${JSON.stringify(inputLines[index])}\noutput: ${JSON.stringify(outputLines[index])}`
    );
  }
}

function mixedLineEndSource() {
  return [
    "# Live Save",
    "",
    "Paragraph with source mode text.",
    "",
    "```mermaid",
    "sequenceDiagram",
    "  participant Source",
    "```",
    "",
    "<div data-preview=\"safe\">HTML artifact placeholder</div>",
    ""
  ].join("\n");
}

function collectMarks(node, markName) {
  const marks = [];
  if (Array.isArray(node.marks)) {
    marks.push(...node.marks.filter((mark) => mark.type === markName));
  }
  for (const child of node.content ?? []) {
    marks.push(...collectMarks(child, markName));
  }
  return marks;
}

function assertSequence(actual, expected, label) {
  assert(
    actual.join(",") === expected.join(","),
    `${label} expected ${expected.join(", ")}; got ${actual.join(", ")}.`
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createManualScheduler() {
  return {
    schedule() {
      return () => {};
    }
  };
}

function firstByteDifference(input, output) {
  const max = Math.max(input.length, output.length);
  for (let index = 0; index < max; index += 1) {
    if (input[index] !== output[index]) {
      return `offset ${index}: expected ${JSON.stringify(input.slice(index, index + 80))}, got ${JSON.stringify(output.slice(index, index + 80))}`;
    }
  }
  return "no byte difference";
}
