import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");

const mixedInput = await readFile("fixtures/014-mixed-real-world/input.md", "utf8");

const untouched = rich.createRichMarkdownState(mixedInput, { dialect: "momentarise-enhanced" });
const untouchedOutput = rich.serializeRichMarkdownState(untouched).content;
if (untouchedOutput !== mixedInput) {
  throw new Error("Untouched rich serialization must return the original source bytes.");
}

const editedHeading = rich.replaceFirstRichText(untouched, "Summary", "Executive Summary");
const editedOutput = rich.serializeRichMarkdownState(editedHeading).content;
assertIncludes(editedOutput, "## Executive Summary", "edited heading");
assertEveryLineExcept(
  mixedInput,
  editedOutput,
  (line) => line === "## Summary",
  "editing one heading in the mixed fixture must preserve all unrelated lines"
);

for (const rawLine of [
  "| Area | Risk | Mitigation |",
  "| -- | -- | -- |",
  "| Parser | unknown syntax | opaque nodes |",
  "```mermaid",
  "  participant Editor",
  "Related: [[Save Engine]], [Quality Gates](../docs/internal/QUALITY_GATES.md)",
  "<div data-preview=\"safe\">HTML artifact placeholder</div>",
  "Final note with $a^2 + b^2 = c^2$."
]) {
  assertIncludes(editedOutput, rawLine, `untouched raw line ${rawLine}`);
}

const delimiterInput = [
  "Setext Heading",
  "==============",
  "",
  "Paragraph with _underscore emphasis_ that must stay untouched.",
  "",
  "* star marker item",
  "",
  "## Change this",
  "",
  "Next paragraph keeps the original blank-line run."
].join("\n") + "\n";
const delimiterState = rich.createRichMarkdownState(delimiterInput, { dialect: "momentarise-enhanced" });
const delimiterEdited = rich.replaceFirstRichText(delimiterState, "Change this", "Changed only this");
const delimiterOutput = rich.serializeRichMarkdownState(delimiterEdited).content;
assertEveryLineExcept(
  delimiterInput,
  delimiterOutput,
  (line) => line === "## Change this",
  "editing one block must preserve setext headings, emphasis style, list markers, and blank-line runs outside it"
);
assertIncludes(delimiterOutput, "Setext Heading\n==============", "untouched setext heading");
assertIncludes(delimiterOutput, "_underscore emphasis_", "untouched underscore emphasis");
assertIncludes(delimiterOutput, "* star marker item", "untouched list marker");

const paragraphSource = "First paragraph\n\nSecond paragraph\n";
const paragraphEdited = rich.replaceFirstRichText(
  rich.createRichMarkdownState(paragraphSource, { dialect: "momentarise-enhanced" }),
  "First",
  "Changed first"
);
const paragraphOutput = rich.serializeRichMarkdownState(paragraphEdited).content;
assertIncludes(
  paragraphOutput,
  "Changed first paragraph\n\nSecond paragraph",
  "reconstructed adjacent paragraphs must keep a blank-line separator"
);

const duplicateSource = "Same\n----\n\n## Same\n\nTail paragraph.\n";
const duplicateEdited = replaceFirstTopLevelText(
  rich.createRichMarkdownState(duplicateSource, { dialect: "momentarise-enhanced" }),
  "Same",
  "Changed"
);
const duplicateOutput = rich.serializeRichMarkdownState(duplicateEdited).content;
assertIncludes(duplicateOutput, "## Changed\n\n## Same", "duplicate heading replacement alignment");
assertIncludes(duplicateOutput, "\n\nTail paragraph.\n", "duplicate heading tail preservation");
if (duplicateOutput.includes("Same\n----\n\nTail paragraph.")) {
  throw new Error(`Duplicate equivalent headings must not preserve the edited heading raw bytes as the untouched sibling.\n${duplicateOutput}`);
}

let diskContent = mixedInput;
const writes = [];
const target = {
  persistenceTarget: "disk",
  targetLabel: "disk://mixed-real-world.md",
  readExternalHash() {
    return save.hashMarkdownContent(diskContent);
  },
  async write(request) {
    writes.push(request);
    diskContent = request.content;
    return {
      externalHash: request.contentHash,
      status: "saved"
    };
  }
};
const engine = save.createSaveEngine({
  autosaveDelayMs: 1000,
  content: mixedInput,
  target
});
engine.updateContent(editedOutput);
const autosaveResult = await engine.flush({ reason: "autosave" });
if (autosaveResult.status !== "saved") {
  throw new Error(`Expected autosave to save targeted rich edit, got ${autosaveResult.status}.`);
}
if (writes.length !== 1) {
  throw new Error(`Expected one autosave write, got ${writes.length}.`);
}
if (writes[0].reason !== "autosave") {
  throw new Error(`Autosave write must carry reason "autosave", got ${writes[0].reason}.`);
}
assertIncludes(writes[0].content, "| Parser | unknown syntax | opaque nodes |", "autosaved untouched table");
assertIncludes(writes[0].content, "```mermaid\nsequenceDiagram", "autosaved untouched Mermaid block");
assertEveryLineExcept(
  mixedInput,
  writes[0].content,
  (line) => line === "## Summary",
  "autosave after a rich edit must write only the targeted block change"
);

const modeSwitchWrites = [];
const modeSwitchTarget = {
  persistenceTarget: "disk",
  targetLabel: "disk://mode-switch.md",
  async write(request) {
    modeSwitchWrites.push(request);
    return {
      externalHash: request.contentHash,
      status: "saved"
    };
  }
};
const modeSwitchEngine = save.createSaveEngine({
  content: "# Mode\n\nBefore.\n",
  target: modeSwitchTarget
});
modeSwitchEngine.updateContent("# Mode\n\nAfter.\n");
const modeSwitchResult = await modeSwitchEngine.flush({ reason: "mode-switch" });
if (modeSwitchResult.status !== "saved") {
  throw new Error(`Expected mode-switch flush to save, got ${modeSwitchResult.status}.`);
}
if (modeSwitchWrites[0]?.reason !== "mode-switch") {
  throw new Error(`SaveTarget.write must receive mode-switch reason, got ${modeSwitchWrites[0]?.reason}.`);
}

const demoMain = await readFile("apps/md-demo/src/main.ts", "utf8");
const switchEditorMode = extractFunction(demoMain, "function switchEditorMode");
if (!switchEditorMode.includes('flushSave("mode-switch")')) {
  throw new Error("switchEditorMode must flush Save Engine with reason \"mode-switch\" after rich/source handoff.");
}

function assertEveryLineExcept(input, output, isEditedLine, label) {
  const inputLines = input.split("\n");
  const outputLines = output.split("\n");
  if (inputLines.length !== outputLines.length) {
    throw new Error(`${label}: line count changed from ${inputLines.length} to ${outputLines.length}.\n${output}`);
  }
  for (let index = 0; index < inputLines.length; index += 1) {
    if (isEditedLine(inputLines[index], index)) {
      continue;
    }
    if (inputLines[index] !== outputLines[index]) {
      throw new Error(
        `${label}: line ${index + 1} changed.\ninput:  ${JSON.stringify(inputLines[index])}\noutput: ${JSON.stringify(outputLines[index])}`
      );
    }
  }
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`${label} missing ${JSON.stringify(expected)}.\n${content}`);
  }
}

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) {
    throw new Error(`Missing function signature: ${signature}`);
  }
  const bodyStart = source.indexOf("{", start);
  if (bodyStart < 0) {
    throw new Error(`Missing function body: ${signature}`);
  }
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(bodyStart + 1, index);
      }
    }
  }
  throw new Error(`Unclosed function body: ${signature}`);
}

function replaceFirstTopLevelText(state, search, replacement) {
  let from = null;
  let to = null;
  state.editorState.doc.forEach((node, offset) => {
    if (from !== null) {
      return;
    }
    const index = node.textContent.indexOf(search);
    if (index < 0) {
      return;
    }
    from = offset + 1 + index;
    to = from + search.length;
  });
  if (from === null || to === null) {
    throw new Error(`Could not find top-level rich text: ${search}`);
  }
  return {
    ...state,
    editorState: state.editorState.apply(state.editorState.tr.insertText(replacement, from, to))
  };
}
