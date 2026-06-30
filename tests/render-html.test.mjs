import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createMarkdownAstParser } from "../packages/md-format/dist/index.js";
import {
  markdownHtmlRendererPackage,
  renderMarkdownToHtml
} from "../packages/md-render-html/dist/index.js";

const parser = createMarkdownAstParser();
const requiredFixtures = [
  "001-simple-markdown",
  "002-yaml-frontmatter",
  "003-gfm-task-list",
  "004-gfm-table",
  "005-code-fence-language",
  "006-blockquote",
  "007-obsidian-callout",
  "008-wikilink",
  "009-link-image",
  "010-html-inline-block",
  "011-mermaid-fence",
  "012-latex-inline-block",
  "013-unknown-custom-syntax",
  "014-mixed-real-world",
  "015-sanitized-vault-sample",
  "016-policy-sensitive",
  "017-long-heading-document",
  "018-nested-lists-todos"
];

if (markdownHtmlRendererPackage.packageName !== "@momentarise/md-render-html") {
  throw new Error("Renderer package must expose the expected public contract.");
}
if (markdownHtmlRendererPackage.renderKind !== "markdown-html") {
  throw new Error(`Unexpected render kind: ${markdownHtmlRendererPackage.renderKind}`);
}

const fixtureNames = readdirSync("fixtures", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const fixtureName of requiredFixtures) {
  if (!fixtureNames.includes(fixtureName)) {
    throw new Error(`Missing required fixture for render-html regression: ${fixtureName}`);
  }
}

for (const fixtureName of fixtureNames) {
  const inputPath = join("fixtures", fixtureName, "input.md");
  const markdown = readFileSync(inputPath, "utf8");
  const sourceBefore = markdown.slice();
  const beforeHash = parser.parse(markdown, { dialect: "momentarise-enhanced" }).snapshot.hash;
  const firstPass = renderMarkdownToHtml(markdown, {
    fileName: inputPath
  });
  const secondPass = renderMarkdownToHtml(markdown, {
    fileName: inputPath
  });
  const afterHash = parser.parse(markdown, { dialect: "momentarise-enhanced" }).snapshot.hash;

  assert(firstPass.html.trim().length > 0, `${fixtureName} must render non-empty HTML.`);
  assert(!/<script\b/i.test(firstPass.html), `${fixtureName} rendered a script tag.`);
  assert(beforeHash === afterHash, `${fixtureName} render mutated parse source hash.`);
  assert(markdown === sourceBefore, `${fixtureName} render must not mutate the source markdown string.`);
  assert(firstPass.html === secondPass.html, `${fixtureName} render output changed between repeated calls.`);
  assert(
    JSON.stringify(firstPass.diagnostics) === JSON.stringify(secondPass.diagnostics),
    `${fixtureName} diagnostics changed between repeated calls.`
  );
}

const unknownSyntax = renderMarkdownToHtml(
  [
    "# Unknown render",
    "",
    "> [!NOTE] Preservation note",
    "> Callout body stays visible.",
    "",
    "- [[Project Alpha|Alpha overview]]",
    "",
    "Inline math uses $E = mc^2$.",
    "",
    ":::momentarise-card kind=\"decision\"",
    "title: Keep Markdown canonical",
    ":::\n"
  ].join("\n")
);

for (const visible of [
  "[!NOTE] Preservation note",
  "[[Project Alpha|Alpha overview]]",
  "$E = mc^2$",
  ":::momentarise-card",
  "Keep Markdown canonical"
]) {
  assert(
    visibleText(unknownSyntax.html).includes(visible),
    `Unknown or opaque syntax must stay visible in rendered output: ${visible}\n${unknownSyntax.html}`
  );
}

const hostileMarkdown = [
  "# Unsafe HTML",
  "",
  '<div onclick="window.__MME_RENDER_HTML_SCRIPT_RAN__ = true">Keep div text</div>',
  '<img src="x" onerror="window.__MME_RENDER_HTML_SCRIPT_RAN__ = true" alt="unsafe image">',
  '<a href="javascript:alert(1)">Unsafe link text</a>',
  '<a href="https://example.invalid">Unsafe external link text</a>',
  '<img src="data:text/plain,hello-world" alt="unsafe data image">',
  "<script>window.__MME_RENDER_HTML_SCRIPT_RAN__ = true</script>",
  '<iframe src="https://example.invalid"></iframe>',
  "<style>body { background: red; }</style>"
].join("\n");
const hostileBefore = hostileMarkdown.slice();
const hostileResult = renderMarkdownToHtml(hostileMarkdown, {
  fileName: "unsafe-inline-html.md"
});

assert(hostileMarkdown === hostileBefore, "Render must not mutate the input Markdown string.");
assert(hostileResult.html.includes("Keep div text"), "Safe text inside stripped HTML must remain visible.");
assert(hostileResult.html.includes("Unsafe link text"), "Unsafe link label must remain visible.");

for (const forbidden of [
  "<script",
  "</script",
  "<iframe",
  "</iframe",
  "<style",
  "</style",
  "onclick=",
  "onerror=",
  "javascript:"
]) {
  assert(!hostileResult.html.toLowerCase().includes(forbidden), `Rendered HTML leaked forbidden token: ${forbidden}`);
}
assert(!/href=["']\s*https?:\/\/|href=["']\s*\/\//i.test(hostileResult.html), "Rendered Markdown HTML must strip external link URLs.");
assert(!/href=["']\s*javascript:/i.test(hostileResult.html), "Rendered Markdown HTML must strip javascript: URLs.");
assert(!/href=["']\s*data:/i.test(hostileResult.html), "Rendered Markdown HTML must strip data: link URLs.");
assert(!/src=["']\s*https?:\/\/|src=["']\s*\/\//i.test(hostileResult.html), "Rendered Markdown HTML must strip external image URLs.");
assert(!/src=["']\s*javascript:/i.test(hostileResult.html), "Rendered Markdown HTML must strip javascript: image URLs.");
assert(!/src=["']\s*data:/i.test(hostileResult.html), "Rendered Markdown HTML must strip data: image URLs.");

const stripped = hostileResult.diagnostics.filter((diagnostic) => diagnostic.code === "render_html_stripped");
assert(stripped.length > 0, "Renderer must emit render_html_stripped diagnostics for unsafe HTML.");
assert(
  stripped.some((diagnostic) => (diagnostic.removedElements?.length ?? 0) > 0),
  "Stripped diagnostics must report removed elements."
);
assert(
  stripped.some((diagnostic) => (diagnostic.removedAttributes?.length ?? 0) > 0),
  "Stripped diagnostics must report removed attributes."
);

function visibleText(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
