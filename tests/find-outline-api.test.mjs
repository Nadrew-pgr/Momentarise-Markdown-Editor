import { readFile } from "node:fs/promises";
import { createMarkdownEditorSession } from "../packages/md-editor/dist/index.js";
import { createMemorySaveTarget } from "../packages/md-save/dist/index.js";

const mixedInput = await readFile("fixtures/014-mixed-real-world/input.md", "utf8");

const session = createMarkdownEditorSession({
  content: mixedInput,
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({
    initialContent: mixedInput
  })
});

if (typeof session.find !== "function") {
  throw new Error("MarkdownEditorSession must expose session.find(query, options).");
}
if (typeof session.replace !== "function") {
  throw new Error("MarkdownEditorSession must expose session.replace(range, replacement).");
}
if (typeof session.replaceAll !== "function") {
  throw new Error("MarkdownEditorSession must expose session.replaceAll(query, replacement, options).");
}
if (typeof session.getOutline !== "function") {
  throw new Error("MarkdownEditorSession must expose session.getOutline().");
}

const summaryMatches = session.find("Summary");
assertEqual(summaryMatches.length, 1, "find must locate the Summary heading once.");
assertEqual(mixedInput.slice(summaryMatches[0].from, summaryMatches[0].to), "Summary", "find ranges must be source offsets.");

const caseInsensitiveMatches = session.find("summary", { caseSensitive: false });
assertEqual(caseInsensitiveMatches.length, 1, "find must support case-insensitive matching.");

const regexMatches = session.find("\\bmode\\b", { regex: true });
assert(regexMatches.length >= 2, "find must support regex matching over canonical Markdown.");
for (const match of regexMatches) {
  assertEqual(mixedInput.slice(match.from, match.to), "mode", "regex match ranges must remain source offsets.");
}

session.replace(summaryMatches[0], "Executive Summary");
const replacedContent = session.getContent();
assertIncludes(replacedContent, "## Executive Summary", "single replace must update target text.");
assertEveryLineExcept(
  mixedInput,
  replacedContent,
  (line) => line === "## Summary",
  "single replace in fixture 014 must preserve all unrelated source lines"
);

const replaceAllSession = createMarkdownEditorSession({
  content: "alpha beta alpha\nALPHA alpha\n",
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({
    initialContent: "alpha beta alpha\nALPHA alpha\n"
  })
});
const replaceAllResult = replaceAllSession.replaceAll("alpha", "omega", { caseSensitive: true });
assertEqual(replaceAllResult.replaced, 3, "replaceAll must report the number of replacements.");
assertEqual(replaceAllSession.getContent(), "omega beta omega\nALPHA omega\n", "replaceAll must honor case-sensitive matching.");

const outlineSource = [
  "---",
  "title: Frontmatter Title",
  "---",
  "",
  "# Guide",
  "",
  "## Install",
  "",
  "### Step",
  "",
  "## Install",
  "",
  "# Guide",
  ""
].join("\n");
const outlineSession = createMarkdownEditorSession({
  content: outlineSource,
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({
    initialContent: outlineSource
  })
});
const outline = outlineSession.getOutline();
assertEqual(outline.length, 2, "outline must include two root H1 headings.");
assertEqual(outline[0].text, "Guide", "outline must derive H1 text from headings, not frontmatter.");
assertEqual(outline[0].depth, 1, "outline H1 depth must be preserved.");
assertEqual(outline[0].slug, "h1-guide", "outline slug must use the heading fold segment scheme.");
assertEqual(outline[0].children.length, 2, "first Guide must have both H2 children.");
assertEqual(outline[0].children[0].slug, "h2-install", "first duplicate sibling slug must be unsuffixed.");
assertEqual(outline[0].children[1].slug, "h2-install-2", "duplicate sibling slug must receive an occurrence suffix.");
assertEqual(outline[0].children[0].children[0].slug, "h3-step", "outline must nest lower-depth headings.");
assertEqual(outline[1].slug, "h1-guide-2", "duplicate root slug must receive an occurrence suffix.");
assert(!JSON.stringify(outline).includes("Frontmatter Title"), "outline must never derive entries from frontmatter.");
assertEqual(outlineSource.slice(outline[0].sourceRange.start.offset, outline[0].sourceRange.end.offset), "# Guide", "outline sourceRange must point at heading source bytes.");

const keybindings = session.extensions.getKeybindings();
assert(
  keybindings.some((binding) => binding.commandId === "mme.find.open" && binding.keys.includes("Mod-f")),
  "Mod-f must be registered through the MME keybinding registry."
);
const delegatedKeybindings = session.extensions.getKeybindings({ keymapDelegateToHost: true });
assert(
  !delegatedKeybindings.some((binding) => binding.commandId === "mme.find.open"),
  "find keybinding must respect host keymap delegation."
);

session.destroy();
replaceAllSession.destroy();
outlineSession.destroy();

function createManualScheduler() {
  return {
    schedule() {
      return () => {};
    }
  };
}

function assert(value, label) {
  if (!value) {
    throw new Error(label);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`${label} missing ${JSON.stringify(expected)}.\n${content}`);
  }
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
