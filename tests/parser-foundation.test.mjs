import { readdir, readFile } from "node:fs/promises";
import { createMarkdownAstParser } from "../packages/md-format/dist/index.js";

const fixtures = await loadFixtures("fixtures");
const parser = createMarkdownAstParser();

const parsedFixtures = [];
for (const fixture of fixtures) {
  const result = parser.parse(fixture.input, {
    dialect: "momentarise-enhanced",
    path: `fixture://${fixture.fixtureId}/input.md`
  });

  parsedFixtures.push({ fixture, result });

  if (result.document.root.kind !== "root") {
    throw new Error(`${fixture.fixtureId} must parse to a Momentarise root node.`);
  }
  if (!Array.isArray(result.document.diagnostics) || !Array.isArray(result.diagnostics)) {
    throw new Error(`${fixture.fixtureId} must expose parser diagnostics arrays.`);
  }
  if (result.snapshot.content !== fixture.input) {
    throw new Error(`${fixture.fixtureId} parser snapshot must preserve original source content.`);
  }
}

if (parsedFixtures.length < 18) {
  throw new Error(`Expected at least 18 parsed fixtures, got ${parsedFixtures.length}.`);
}

const frontmatter = findFixture("002-yaml-frontmatter");
const frontmatterRecord = frontmatter.result.document.frontmatter;
if (!frontmatterRecord) {
  throw new Error("YAML frontmatter fixture must extract frontmatter.");
}
if (frontmatterRecord.title !== "Fixture With Frontmatter") {
  throw new Error(`Unexpected frontmatter title: ${String(frontmatterRecord.title)}`);
}
if (!Array.isArray(frontmatterRecord.tags) || !frontmatterRecord.tags.includes("preservation")) {
  throw new Error("YAML frontmatter tags must be extracted as a list.");
}

const simpleHeading = findNodeByType(findFixture("001-simple-markdown").result.document.root, "heading");
if (simpleHeading.attributes?.depth !== 1) {
  throw new Error("Heading nodes must expose Momentarise-native depth before rich mode.");
}

const taskListItem = findNodeByType(findFixture("003-gfm-task-list").result.document.root, "listItem", (node) =>
  Object.prototype.hasOwnProperty.call(node.attributes ?? {}, "checked")
);
if (typeof taskListItem.attributes?.checked !== "boolean") {
  throw new Error("Task list items must expose Momentarise-native checked state before rich mode.");
}

const tableVariants = findFixture("019-gfm-table-variants");
const tableNode = findNodeByType(tableVariants.result.document.root, "table");
const tableSource = sourceForNode(tableVariants.fixture.input, tableNode);
if (!tableSource.includes("| Escaped \\| pipe | Editor | preserved |")) {
  throw new Error(`Supported GFM tables must expose source ranges that preserve escaped pipes.\n${tableSource}`);
}
const malformedTableOpaque = collectOpaqueNodes(tableVariants.result.document.root).find(
  (node) => node.reason === "unsupported table-like syntax"
);
if (!malformedTableOpaque || !malformedTableOpaque.raw.includes("| broken table-like block | should stay raw |")) {
  throw new Error("Malformed table-like syntax must be carried as opaque raw Markdown.");
}

const tableFootnotes = findFixture("032-table-footnote-editing");
const tableFootnoteDefinitions = collectNodesByType(tableFootnotes.result.document.root, "footnoteDefinition");
for (const identifier of ["table-top", "table-list", "table-task", "table-wide"]) {
  const definition = tableFootnoteDefinitions.find((node) => node.attributes?.identifier === identifier);
  const nestedTables = definition ? collectNodesByType(definition, "table") : [];
  if (nestedTables.length !== 1 || !nestedTables[0]?.sourceRange) {
    throw new Error(`Expected one source-ranged table in footnote definition ${identifier}.`);
  }
}
const malformedTableFootnoteSource = [
  "Before[^bad].",
  "",
  "[^bad]: Intro.",
  "",
  "    | A | B |",
  "    | --- |",
  "    | one | two |",
  ""
].join("\n");
const malformedTableFootnote = parser.parse(malformedTableFootnoteSource, {
  dialect: "momentarise-enhanced"
});
const redundantTableFallback = (malformedTableFootnote.document.root.children ?? []).find(
  (node) => node.kind === "opaque" && node.reason === "unsupported table-like syntax"
);
if (redundantTableFallback) {
  throw new Error("Malformed table-like text enclosed by a footnote must not be duplicated as root opaque source.");
}
if (malformedTableFootnote.snapshot.content !== malformedTableFootnoteSource) {
  throw new Error("Malformed table-footnote parser snapshot must preserve exact source.");
}

const footnotes = findFixture("020-gfm-footnotes");
const footnoteReference = findNodeByType(footnotes.result.document.root, "footnoteReference");
if (footnoteReference.kind !== "inline" || footnoteReference.attributes?.identifier !== "first") {
  throw new Error(`Footnote references must expose inline native identifiers.\n${JSON.stringify(footnoteReference)}`);
}
const footnoteDefinition = findNodeByType(footnotes.result.document.root, "footnoteDefinition");
const footnoteDefinitionSource = sourceForNode(footnotes.fixture.input, footnoteDefinition);
if (
  footnoteDefinition.attributes?.identifier !== "first" ||
  !footnoteDefinitionSource.includes("Continued definition line that must keep its indentation.")
) {
  throw new Error(`Footnote definitions must expose identifiers and source ranges.\n${footnoteDefinitionSource}`);
}
const malformedFootnoteOpaque = collectOpaqueNodes(footnotes.result.document.root).find(
  (node) => node.reason === "unsupported footnote-like syntax"
);
if (!malformedFootnoteOpaque || !malformedFootnoteOpaque.raw.includes("[^malformed] Missing colon")) {
  throw new Error("Malformed footnote-like syntax must be carried as opaque raw Markdown.");
}
for (const code of [
  "footnote_reference_missing_definition",
  "footnote_definition_duplicate",
  "footnote_definition_malformed"
]) {
  if (!footnotes.result.diagnostics.some((diagnostic) => diagnostic.code === code)) {
    throw new Error(`Footnote fixture must emit diagnostic ${code}.`);
  }
}
const footnoteLookalikeParse = parser.parse("Inline code `[^code]` is not a footnote reference.\n", {
  dialect: "momentarise-enhanced"
});
if (
  footnoteLookalikeParse.diagnostics.some(
    (diagnostic) => diagnostic.code === "footnote_reference_missing_definition"
  )
) {
  throw new Error("Footnote diagnostics must not treat inline-code lookalikes as missing references.");
}

const codeFence = findNodeByType(findFixture("005-code-fence-language").result.document.root, "codeFence");
if (codeFence.attributes?.language !== "ts" || typeof codeFence.attributes?.value !== "string") {
  throw new Error("Code fence nodes must expose language and value before rich mode.");
}

const link = findNodeByType(findFixture("009-link-image").result.document.root, "link");
if (link.attributes?.url !== "../docs/public/GLOSSARY.md") {
  throw new Error("Link nodes must expose URL before rich mode.");
}

const image = findNodeByType(findFixture("009-link-image").result.document.root, "image");
if (!image.attributes?.url || !image.attributes?.alt) {
  throw new Error("Image nodes must expose URL and alt text before rich mode.");
}

const unsupportedFixtures = [
  {
    fixtureId: "007-obsidian-callout",
    reason: "Obsidian callout",
    rawSnippets: ["> [!NOTE] Preservation note", "> This Obsidian-style callout should survive"]
  },
  {
    fixtureId: "008-wikilink",
    reason: "wikilink",
    rawSnippets: ["[[Project Alpha|Alpha overview]]"]
  },
  {
    fixtureId: "011-mermaid-fence",
    reason: "Mermaid fenced block",
    rawSnippets: ["```mermaid", "flowchart TD"]
  },
  {
    fixtureId: "012-latex-inline-block",
    reason: "LaTeX math",
    rawSnippets: ["$$", "\\int_0^1 x^2 dx = \\frac{1}{3}"]
  },
  {
    fixtureId: "013-unknown-custom-syntax",
    reason: "unknown extension syntax",
    rawSnippets: [
      ":::momentarise-card kind=\"decision\"\ntitle: Keep Markdown canonical\n:::",
      "{% experimental block=\"timeline\" %}\n- 2026-05-29: Start preservation tests\n{% endexperimental %}"
    ]
  }
];

for (const { fixtureId, rawSnippets, reason } of unsupportedFixtures) {
  const { result } = findFixture(fixtureId);
  const opaqueNodes = collectOpaqueNodes(result.document.root);
  for (const rawSnippet of rawSnippets) {
    if (!opaqueNodes.some((node) => node.reason === reason && node.raw.includes(rawSnippet))) {
      throw new Error(`${fixtureId} must preserve ${reason} raw snippet: ${rawSnippet}`);
    }
  }
}

for (const { fixture, result } of parsedFixtures) {
  if (!result.diagnostics.some((diagnostic) => diagnostic.code === "ast_parser_foundation")) {
    throw new Error(`${fixture.fixtureId} must record parser foundation diagnostics.`);
  }
  assertNoThirdPartyAstLeak(result.document.root, fixture.fixtureId);
}

function findFixture(fixtureId) {
  const found = parsedFixtures.find((entry) => entry.fixture.fixtureId === fixtureId);
  if (!found) {
    throw new Error(`Missing parsed fixture ${fixtureId}.`);
  }
  return found;
}

function collectOpaqueNodes(node) {
  if (node.kind === "opaque") {
    return [node];
  }
  return (node.children ?? []).flatMap((child) => collectOpaqueNodes(child));
}

function collectNodesByType(node, type) {
  const nodes = node.type === type ? [node] : [];
  return node.kind === "opaque"
    ? nodes
    : [...nodes, ...(node.children ?? []).flatMap((child) => collectNodesByType(child, type))];
}

function findNodeByType(node, type, predicate = () => true) {
  if (node.type === type && predicate(node)) {
    return node;
  }
  for (const child of node.children ?? []) {
    const found = findNodeByType(child, type, predicate);
    if (found) {
      return found;
    }
  }
  return null;
}

function sourceForNode(source, node) {
  if (!node?.sourceRange) {
    throw new Error(`Node is missing source range: ${node?.type ?? "<null>"}`);
  }
  return source.slice(node.sourceRange.start.offset, node.sourceRange.end.offset);
}

function assertNoThirdPartyAstLeak(node, fixtureId) {
  const forbiddenKeys = ["position", "data", "spread", "checked", "ordered"];
  for (const key of forbiddenKeys) {
    if (Object.prototype.hasOwnProperty.call(node, key)) {
      throw new Error(`${fixtureId} leaked third-party AST key "${key}" on node ${node.type}.`);
    }
  }
  for (const child of node.children ?? []) {
    assertNoThirdPartyAstLeak(child, fixtureId);
  }
}

async function loadFixtures(root) {
  const fixtureDirs = await readdir(root, { withFileTypes: true });
  const dirs = fixtureDirs.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  return Promise.all(
    dirs.map(async (fixtureId) => ({
      fixtureId,
      input: await readFile(`${root}/${fixtureId}/input.md`, "utf8")
    }))
  );
}
