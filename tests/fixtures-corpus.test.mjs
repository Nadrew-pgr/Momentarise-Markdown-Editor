import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const fixturesRoot = "fixtures";

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

const requiredExpectationTerms = ["preserve", "normalized", "opaque", "source-only", "render"];

const bannedSecretPatterns = [
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{20,}/,
  /password\s*[:=]\s*["']?[^"'\s]+/i,
  /secret\s*[:=]\s*["']?[^"'\s]+/i,
  /token\s*[:=]\s*["']?[^"'\s]+/i
];

const entries = await readdir(fixturesRoot, { withFileTypes: true });
const fixtureDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

if (fixtureDirs.length < requiredFixtures.length) {
  throw new Error(`Expected at least ${requiredFixtures.length} fixture directories, found ${fixtureDirs.length}.`);
}

for (const fixture of requiredFixtures) {
  if (!fixtureDirs.includes(fixture)) {
    throw new Error(`Missing required fixture directory: ${fixture}`);
  }
}

await assertFile("fixtures/README.md", "fixture corpus README");

for (const fixture of requiredFixtures) {
  const inputPath = join(fixturesRoot, fixture, "input.md");
  const expectationsPath = join(fixturesRoot, fixture, "expectations.md");
  const input = await assertFile(inputPath, `${fixture} input`);
  const expectations = await assertFile(expectationsPath, `${fixture} expectations`);

  assertNoSecrets(input, inputPath);
  assertNoSecrets(expectations, expectationsPath);

  const lowerExpectations = expectations.toLowerCase();
  for (const term of requiredExpectationTerms) {
    if (!lowerExpectations.includes(term)) {
      throw new Error(`${expectationsPath} must mention "${term}".`);
    }
  }
}

async function assertFile(path, label) {
  const fileStat = await stat(path);
  if (!fileStat.isFile()) {
    throw new Error(`Expected ${label} to be a file: ${path}`);
  }
  const content = await readFile(path, "utf8");
  if (!content.trim()) {
    throw new Error(`Expected ${label} to be non-empty: ${path}`);
  }
  return content;
}

function assertNoSecrets(content, path) {
  for (const pattern of bannedSecretPatterns) {
    if (pattern.test(content)) {
      throw new Error(`Potential secret-like content found in ${path}: ${pattern}`);
    }
  }
}
