import { readFileSync } from "node:fs";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const source = await import("../packages/md-source-codemirror/dist/index.js");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

if (packageJson.scripts["visual:mme-0033"] !== "node scripts/visual-check-mme0033.mjs") {
  throw new Error("MME-0033 visual script must be registered in package.json.");
}

for (const exportName of ["richPositionForSourceOffset", "richRangeForSourceRange", "sourceRangeForRichRange"]) {
  if (typeof rich[exportName] !== "function") {
    throw new Error(`@momentarise/md-rich-prosemirror must export ${exportName} for MME-0033 rich find highlights.`);
  }
}

for (const exportName of ["createMomentariseSourceFindHighlightExtension"]) {
  if (typeof source[exportName] !== "function") {
    throw new Error(`@momentarise/md-source-codemirror must export ${exportName} for MME-0033 source find highlights.`);
  }
}

const richState = rich.createRichMarkdownState("# Title\n\nParagraph with needle text.\n", {
  dialect: "momentarise-enhanced"
});
const sourceOffset = "# Title\n\nParagraph with ".length;
const mapped = rich.richPositionForSourceOffset(richState, sourceOffset);
if (!mapped || mapped.approximate) {
  throw new Error(`Untouched rich source offset must map exactly, got ${JSON.stringify(mapped)}.`);
}
const range = rich.richRangeForSourceRange(richState, {
  from: sourceOffset,
  to: sourceOffset + "needle".length
});
if (!range || range.approximate || range.from >= range.to) {
  throw new Error(`Untouched rich source range must map exactly, got ${JSON.stringify(range)}.`);
}
const inverseRange = rich.sourceRangeForRichRange(richState, {
  from: range.from,
  to: range.to
});
if (!inverseRange || inverseRange.from !== sourceOffset || inverseRange.to !== sourceOffset + "needle".length) {
  throw new Error(`Untouched rich selection must map back to its exact source range, got ${JSON.stringify(inverseRange)}.`);
}
const cursor = rich.richRangeForSourceRange(richState, {
  from: sourceOffset + "needle".length,
  to: sourceOffset + "needle".length
});
const inverseCursor = cursor
  ? rich.sourceRangeForRichRange(richState, {
      from: cursor.from,
      to: cursor.to
    })
  : null;
if (!inverseCursor || inverseCursor.from !== sourceOffset + "needle".length || inverseCursor.to !== inverseCursor.from) {
  throw new Error(`Rich cursor must map back to its exact source offset, got ${JSON.stringify(inverseCursor)}.`);
}

const syntaxRichSource = "Paragraph with *needle* text.\n";
const syntaxRichState = rich.createRichMarkdownState(syntaxRichSource, {
  dialect: "momentarise-enhanced"
});
const syntaxOffset = syntaxRichSource.indexOf("*needle*");
const syntaxMapped = rich.richRangeForSourceRange(syntaxRichState, {
  from: syntaxOffset,
  to: syntaxOffset + 1
});
if (syntaxMapped !== null) {
  throw new Error(`Markdown syntax-only ranges must be reported as non-mappable, got ${JSON.stringify(syntaxMapped)}.`);
}

const inlineCodeSource = "`code`\n";
const inlineCodeState = rich.createRichMarkdownState(inlineCodeSource, {
  dialect: "momentarise-enhanced"
});
const inlineCodeMarkerMapped = rich.richRangeForSourceRange(inlineCodeState, {
  from: 0,
  to: 1
});
if (inlineCodeMarkerMapped !== null) {
  throw new Error(`Inline-code marker ranges must be reported as non-mappable, got ${JSON.stringify(inlineCodeMarkerMapped)}.`);
}

const demoSource = readFileSync("apps/md-demo/src/main.ts", "utf8");
for (const snippet of [
  "createFindReplaceSurface",
  "mountRichEditor(result.content)",
  "setFindMatches",
  "session.find(",
  "session.replaceAll(",
  "getOutline()"
]) {
  if (!demoSource.includes(snippet)) {
    throw new Error(`MME-0033 demo must wire find/outline snippet: ${snippet}`);
  }
}

const visualScript = readFileSync("scripts/visual-check-mme0033.mjs", "utf8");
for (const artifact of ["source-find-highlights.png", "source-replace-preserved.png", "rich-find-highlights.png", "rich-replace-preserved.png"]) {
  if (!visualScript.includes(artifact)) {
    throw new Error(`MME-0033 visual script must capture ${artifact}.`);
  }
}
