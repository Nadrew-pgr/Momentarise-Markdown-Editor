import { readdir, readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const format = await import("../packages/md-format/dist/index.js");

// Gate 4.5 — Derived-view fidelity.
// Mounting rich mode and serializing back without edits must return the input bytes
// for the full fixture corpus. No flattening, no normalization, no dropped syntax.

const fixturesRoot = "fixtures";
const fixtureDirs = (await readdir(fixturesRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (fixtureDirs.length < 18) {
  throw new Error(`Expected at least 18 fixtures for the fidelity gate, got ${fixtureDirs.length}.`);
}

const failures = [];
for (const fixtureId of fixtureDirs) {
  const input = await readFile(`${fixturesRoot}/${fixtureId}/input.md`, "utf8");
  const state = rich.createRichMarkdownState(input, { dialect: "momentarise-enhanced" });
  const output = rich.serializeRichMarkdownState(state).content;
  if (output !== input) {
    failures.push(`${fixtureId}: ${firstByteDifference(input, output)}`);
  }
}

if (failures.length > 0) {
  throw new Error(
    `Rich round-trip fidelity gate failed for ${failures.length} fixture(s):\n` + failures.join("\n")
  );
}

// Editing one block must not corrupt untouched unsupported blocks elsewhere.
// The GFM table fixture gains a paragraph edit far away from the table.
const tableInput = await readFile(`${fixturesRoot}/004-gfm-table/input.md`, "utf8");
const tableState = rich.createRichMarkdownState(tableInput, { dialect: "momentarise-enhanced" });
const editedTableDoc = rich.replaceFirstRichText(
  tableState,
  "remain readable",
  "remain intact"
);
const editedOutput = rich.serializeRichMarkdownState(editedTableDoc).content;
for (const tableLine of tableInput.split("\n").filter((line) => line.startsWith("|"))) {
  if (!editedOutput.includes(tableLine)) {
    throw new Error(
      `Editing a paragraph must keep the untouched GFM table byte-identical; missing line:\n${tableLine}\n--- output ---\n${editedOutput}`
    );
  }
}
if (!editedOutput.includes("remain intact")) {
  throw new Error(`Edited paragraph text missing from output:\n${editedOutput}`);
}

// The rich mapper must not flatten unsupported blocks into editable paragraphs.
// Tables must surface as raw/opaque unsupported blocks in the ProseMirror doc.
const tableBlockTypes = [];
tableState.editorState.doc.forEach((node) => {
  tableBlockTypes.push(node.type.name);
});
if (!tableBlockTypes.includes("unsupported_block")) {
  throw new Error(
    `GFM table must map to unsupported_block (raw preservation), got top-level types: ${tableBlockTypes.join(", ")}`
  );
}
let tableRaw = null;
tableState.editorState.doc.forEach((node) => {
  if (node.type.name === "unsupported_block") {
    tableRaw = String(node.attrs.raw ?? "");
  }
});
if (!tableRaw || !tableRaw.includes("| :-- | :-: | --: |")) {
  throw new Error(`unsupported_block must carry the raw table source, got: ${JSON.stringify(tableRaw)}`);
}

const tableVariantsInput = await readFile(`${fixturesRoot}/019-gfm-table-variants/input.md`, "utf8");
const tableVariantsState = rich.createRichMarkdownState(tableVariantsInput, { dialect: "momentarise-enhanced" });
const tableVariantsOutput = rich.serializeRichMarkdownState(tableVariantsState).content;
if (tableVariantsOutput !== tableVariantsInput) {
  throw new Error(`Table variants fixture must rich round-trip byte-for-byte:\n${firstByteDifference(tableVariantsInput, tableVariantsOutput)}`);
}
const tableVariantUnsupportedBlocks = topLevelBlocks(tableVariantsState).filter((node) => node.type.name === "unsupported_block");
const supportedTableFallback = tableVariantUnsupportedBlocks.find((node) =>
  String(node.attrs.raw ?? "").includes("| Feature | Owner | Status |")
);
if (!supportedTableFallback || !/table/i.test(String(supportedTableFallback.attrs.reason ?? ""))) {
  throw new Error("Supported GFM tables must mount as an explicit preserved-table fallback in rich mode.");
}
const malformedTableFallback = tableVariantUnsupportedBlocks.find((node) =>
  String(node.attrs.raw ?? "").includes("| broken table-like block | should stay raw |")
);
if (!malformedTableFallback || String(malformedTableFallback.attrs.reason ?? "") !== "unsupported table-like syntax") {
  throw new Error("Malformed table-like syntax must mount as an opaque preserved-table fallback in rich mode.");
}
const supportedTableDom = supportedTableFallback.type.spec.toDOM?.(supportedTableFallback);
if (
  !domSpecContainsAttribute(supportedTableDom, "data-mme-preserved-table", "true") ||
  !domSpecContainsText(supportedTableDom, "Preserved Markdown table") ||
  !domSpecContainsText(supportedTableDom, "Edit in Source mode")
) {
  throw new Error(`Preserved table fallback DOM must clearly tell users it is source-only.\n${JSON.stringify(supportedTableDom)}`);
}

// Strikethrough must survive a rich edit in the same paragraph.
const strikeSource = "Keep ~~struck words~~ and plain text.\n";
const strikeState = rich.createRichMarkdownState(strikeSource, { dialect: "momentarise-enhanced" });
const strikeEdited = rich.replaceFirstRichText(strikeState, "plain", "edited");
const strikeOutput = rich.serializeRichMarkdownState(strikeEdited).content;
if (!strikeOutput.includes("~~struck words~~")) {
  throw new Error(`Strikethrough must survive edits in the same block:\n${strikeOutput}`);
}

// Opaque detection must not flag currency amounts as LaTeX math.
const currencyParse = format.createMarkdownAstParser().parse("Budget is $5 and $10 today.\n", {
  dialect: "momentarise-enhanced"
});
const currencyOpaque = collectOpaque(currencyParse.document.root).filter((node) => node.reason === "LaTeX math");
if (currencyOpaque.length > 0) {
  throw new Error(
    `Dollar amounts must not be detected as LaTeX math: ${currencyOpaque.map((node) => node.raw).join(" | ")}`
  );
}

// Real inline and display math must still be detected.
const mathParse = format.createMarkdownAstParser().parse(
  "Inline $E = mc^2$ stays math.\n\n$$\n\\int_0^1 x^2 dx\n$$\n",
  { dialect: "momentarise-enhanced" }
);
const mathOpaque = collectOpaque(mathParse.document.root).filter((node) => node.reason === "LaTeX math");
if (mathOpaque.length < 2) {
  throw new Error(`Inline and display math must still be detected as LaTeX opaque, got ${mathOpaque.length}.`);
}

// Opaque patterns must not match inside fenced code blocks.
const fencedParse = format.createMarkdownAstParser().parse(
  "# Doc\n\n```text\nSee [[Not A Wikilink]] and > [!NOTE] not a callout\necho $HOME $PATH\n```\n",
  { dialect: "momentarise-enhanced" }
);
const fencedOpaque = collectOpaque(fencedParse.document.root).filter(
  (node) => node.reason === "wikilink" || node.reason === "Obsidian callout" || node.reason === "LaTeX math"
);
if (fencedOpaque.length > 0) {
  throw new Error(
    `Opaque patterns must not match inside fenced code: ${fencedOpaque
      .map((node) => `${node.reason}:${JSON.stringify(node.raw)}`)
      .join(" | ")}`
  );
}

// Mermaid fences themselves must still be detected as opaque (the fence IS the construct).
const mermaidParse = format.createMarkdownAstParser().parse(
  "```mermaid\nflowchart TD\n  A --> B\n```\n",
  { dialect: "momentarise-enhanced" }
);
if (!collectOpaque(mermaidParse.document.root).some((node) => node.reason === "Mermaid fenced block")) {
  throw new Error("Mermaid fenced blocks must still be detected as opaque.");
}

function collectOpaque(node) {
  if (node.kind === "opaque") {
    return [node];
  }
  return (node.children ?? []).flatMap((child) => collectOpaque(child));
}

function topLevelBlocks(state) {
  const blocks = [];
  state.editorState.doc.forEach((node) => {
    blocks.push(node);
  });
  return blocks;
}

function domSpecContainsAttribute(spec, name, value) {
  if (!Array.isArray(spec)) {
    return false;
  }
  const maybeAttrs = spec[1];
  if (maybeAttrs && typeof maybeAttrs === "object" && !Array.isArray(maybeAttrs) && maybeAttrs[name] === value) {
    return true;
  }
  return spec.some((entry) => domSpecContainsAttribute(entry, name, value));
}

function domSpecContainsText(spec, text) {
  if (typeof spec === "string") {
    return spec.includes(text);
  }
  if (!Array.isArray(spec)) {
    return false;
  }
  return spec.some((entry) => domSpecContainsText(entry, text));
}

function firstByteDifference(input, output) {
  const max = Math.max(input.length, output.length);
  for (let index = 0; index < max; index += 1) {
    if (input[index] !== output[index]) {
      return `first difference at offset ${index}: input ${JSON.stringify(
        input.slice(Math.max(0, index - 20), index + 20)
      )} vs output ${JSON.stringify(output.slice(Math.max(0, index - 20), index + 20))}`;
    }
  }
  return `lengths differ: input ${input.length} vs output ${output.length}`;
}
