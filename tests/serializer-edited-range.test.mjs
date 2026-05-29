import { readdir, readFile } from "node:fs/promises";
import {
  createMarkdownAstFormatter,
  createMarkdownAstParser,
  runFixtureRoundTrip,
  serializeMarkdownEdits
} from "../packages/md-format/dist/index.js";

const fixtures = await loadFixtures("fixtures");
const parser = createMarkdownAstParser();
const formatter = createMarkdownAstFormatter();

const roundTrip = runFixtureRoundTrip({
  fixtures,
  formatter
});

if (roundTrip.summary.total < 18) {
  throw new Error(`Expected at least 18 serializer round-trip fixtures, got ${roundTrip.summary.total}.`);
}
if (roundTrip.summary.failed !== 0) {
  const failures = roundTrip.results
    .filter((result) => result.status === "fail")
    .map((result) => `${result.fixtureId}: ${result.diff}`)
    .join("\n");
  throw new Error(`Expected all serializer round-trip fixtures to pass.\n${failures}`);
}

assertEditPreservesOutsideRange({
  description: "heading edit",
  edit: {
    kind: "replace-node",
    nodeId: findNode(parseFixture("001-simple-markdown"), "heading", "# Simple Markdown Note").id,
    replacement: "# Simple Markdown Note Edited"
  },
  input: fixtureInput("001-simple-markdown"),
  parseResult: parseFixture("001-simple-markdown")
});

assertEditPreservesOutsideRange({
  description: "paragraph edit",
  edit: {
    kind: "replace-node",
    nodeId: findNode(parseFixture("001-simple-markdown"), "paragraph", "This is a short Markdown document").id,
    replacement: "This paragraph was edited through the serializer without touching the surrounding Markdown."
  },
  input: fixtureInput("001-simple-markdown"),
  parseResult: parseFixture("001-simple-markdown")
});

assertEditPreservesOutsideRange({
  description: "list item edit",
  edit: {
    kind: "replace-node",
    nodeId: findNode(parseFixture("003-gfm-task-list"), "listItem", "Write parser test").id,
    replacement: "- [ ] Write serializer test"
  },
  input: fixtureInput("003-gfm-task-list"),
  parseResult: parseFixture("003-gfm-task-list")
});

const codeFenceParse = parseFixture("005-code-fence-language");
const codeFenceNode = findNode(codeFenceParse, "codeFence", "type SaveTarget");
const codeContentEdit = serializeMarkdownEdits(codeFenceParse, {
  edits: [
    {
      kind: "replace-code-fence-content",
      nodeId: codeFenceNode.id,
      replacement: 'export const targetLabel = "disk";\n'
    }
  ]
});
assertIncludes(codeContentEdit.content, "```ts\nexport const targetLabel = \"disk\";\n```", "code fence content edit");
assertIncludes(codeContentEdit.content, "The language info string is important", "code fence trailing paragraph");
assertDiagnostic(codeContentEdit, "serializer_edit_applied");
assertNormalization(codeContentEdit, "replace-code-fence-content");

const codeLanguageEdit = serializeMarkdownEdits(codeFenceParse, {
  edits: [
    {
      kind: "replace-code-fence-language",
      nodeId: codeFenceNode.id,
      replacement: "tsx"
    }
  ]
});
assertIncludes(codeLanguageEdit.content, "```tsx\ntype SaveTarget", "code fence language edit");
assertIncludes(codeLanguageEdit.content, "return `target:${target}`;", "code fence body preserved");
assertNormalization(codeLanguageEdit, "replace-code-fence-language");

const crlfCodeFenceSource = [
  "# CRLF Fence",
  "",
  '```js title="keep-meta"',
  "const value = 1;",
  "```",
  "",
  "After fence."
].join("\r\n");
const crlfCodeFenceParse = parser.parse(crlfCodeFenceSource, {
  dialect: "momentarise-enhanced"
});
const crlfCodeFenceNode = findNode(crlfCodeFenceParse, "codeFence", "const value = 1;");
const crlfContentEdit = serializeMarkdownEdits(crlfCodeFenceParse, {
  edits: [
    {
      kind: "replace-code-fence-content",
      nodeId: crlfCodeFenceNode.id,
      replacement: "const value = 2;\r\n"
    }
  ]
});
assertIncludes(
  crlfContentEdit.content,
  '```js title="keep-meta"\r\nconst value = 2;\r\n```\r\n',
  "CRLF code fence boundaries preserved"
);

const infoStringMetadataEdit = serializeMarkdownEdits(crlfCodeFenceParse, {
  edits: [
    {
      kind: "replace-code-fence-language",
      nodeId: crlfCodeFenceNode.id,
      replacement: "ts"
    }
  ]
});
assertIncludes(
  infoStringMetadataEdit.content,
  '```ts title="keep-meta"\r\nconst value = 1;',
  "code fence language edit preserves info-string metadata"
);

const spacedInfoStringSource = [
  "# Spaced Info String Fence",
  "",
  '``` js title="keep-meta"',
  "console.log(1);",
  "```",
  ""
].join("\n");
const spacedInfoStringParse = parser.parse(spacedInfoStringSource, {
  dialect: "momentarise-enhanced"
});
const spacedInfoStringNode = findNode(spacedInfoStringParse, "codeFence", "console.log(1);");
const spacedInfoStringEdit = serializeMarkdownEdits(spacedInfoStringParse, {
  edits: [
    {
      kind: "replace-code-fence-language",
      nodeId: spacedInfoStringNode.id,
      replacement: "ts"
    }
  ]
});
assertIncludes(
  spacedInfoStringEdit.content,
  '``` ts title="keep-meta"\nconsole.log(1);',
  "spaced code fence language edit preserves spacing and metadata"
);
if (spacedInfoStringEdit.content.includes("ts js")) {
  throw new Error("Spaced code fence language edit must not duplicate the old language into metadata.");
}

const frontmatterEdit = serializeMarkdownEdits(parseFixture("002-yaml-frontmatter"), {
  edits: [
    {
      kind: "replace-node",
      nodeId: findNode(parseFixture("002-yaml-frontmatter"), "heading", "# Frontmatter Document").id,
      replacement: "# Edited Frontmatter Document"
    }
  ]
});
assertIncludes(frontmatterEdit.content, "---\ntitle: Fixture With Frontmatter", "frontmatter preserved");
assertIncludes(frontmatterEdit.content, "# Edited Frontmatter Document", "frontmatter heading edit");

const tableEdit = serializeMarkdownEdits(parseFixture("004-gfm-table"), {
  edits: [
    {
      kind: "replace-node",
      nodeId: findNode(parseFixture("004-gfm-table"), "heading", "# Table Fixture").id,
      replacement: "# Edited Table Fixture"
    }
  ]
});
assertIncludes(tableEdit.content, "| Source mode | ready | CodeMirror 6 |", "table preserved");

const htmlEdit = serializeMarkdownEdits(parseFixture("010-html-inline-block"), {
  edits: [
    {
      kind: "replace-node",
      nodeId: findNode(parseFixture("010-html-inline-block"), "heading", "# HTML Fixture").id,
      replacement: "# Edited HTML Fixture"
    }
  ]
});
assertIncludes(htmlEdit.content, "<aside data-kind=\"artifact\">", "HTML block preserved");
assertIncludes(htmlEdit.content, "<kbd>Cmd</kbd>", "inline HTML preserved");

const unknownEdit = serializeMarkdownEdits(parseFixture("013-unknown-custom-syntax"), {
  edits: [
    {
      kind: "replace-node",
      nodeId: findNode(parseFixture("013-unknown-custom-syntax"), "heading", "# Unknown Custom Syntax Fixture").id,
      replacement: "# Edited Unknown Syntax Fixture"
    }
  ]
});
assertIncludes(unknownEdit.content, ":::momentarise-card kind=\"decision\"", "colon custom block preserved");
assertIncludes(unknownEdit.content, "{% experimental block=\"timeline\" %}", "paired custom block preserved");

function parseFixture(fixtureId) {
  return parser.parse(fixtureInput(fixtureId), {
    dialect: "momentarise-enhanced",
    path: `fixture://${fixtureId}/input.md`
  });
}

function fixtureInput(fixtureId) {
  const fixture = fixtures.find((entry) => entry.fixtureId === fixtureId);
  if (!fixture) {
    throw new Error(`Missing fixture ${fixtureId}.`);
  }
  return fixture.input;
}

function assertEditPreservesOutsideRange({ description, edit, input, parseResult }) {
  const result = serializeMarkdownEdits(parseResult, {
    edits: [edit]
  });
  const range = findNodeById(parseResult.document.root, edit.nodeId).sourceRange;
  const before = input.slice(0, range.start.offset);
  const after = input.slice(range.end.offset);
  if (!result.content.startsWith(before)) {
    throw new Error(`${description} did not preserve bytes before edited range.`);
  }
  if (!result.content.endsWith(after)) {
    throw new Error(`${description} did not preserve bytes after edited range.`);
  }
  assertIncludes(result.content, edit.replacement, `${description} replacement`);
  assertDiagnostic(result, "serializer_edit_applied");
  assertNormalization(result, edit.kind);
}

function findNode(parseResult, type, rawSnippet) {
  const match = walk(parseResult.document.root).find((node) => {
    if (node.kind === "opaque" || node.type !== type || !node.sourceRange) {
      return false;
    }
    const raw = parseResult.snapshot.content.slice(node.sourceRange.start.offset, node.sourceRange.end.offset);
    return raw.includes(rawSnippet);
  });
  if (!match) {
    throw new Error(`Missing ${type} node containing ${rawSnippet}.`);
  }
  return match;
}

function findNodeById(root, nodeId) {
  const match = walk(root).find((node) => node.id === nodeId);
  if (!match) {
    throw new Error(`Missing node ${nodeId}.`);
  }
  return match;
}

function walk(node) {
  return [node, ...(node.children ?? []).flatMap((child) => walk(child))];
}

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) {
    throw new Error(`Expected ${label} to include ${JSON.stringify(expected)}.`);
  }
}

function assertDiagnostic(result, code) {
  if (!result.diagnostics.some((diagnostic) => diagnostic.code === code)) {
    throw new Error(`Expected serializer diagnostic ${code}.`);
  }
}

function assertNormalization(result, kind) {
  if (!result.normalizations.some((normalization) => normalization.includes(kind))) {
    throw new Error(`Expected serializer normalization for ${kind}.`);
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
