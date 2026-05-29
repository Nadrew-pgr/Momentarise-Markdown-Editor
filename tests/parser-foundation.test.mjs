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
