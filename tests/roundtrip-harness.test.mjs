import { readdir, readFile } from "node:fs/promises";
import {
  createIdentityMarkdownFormatter,
  runFixtureRoundTrip
} from "../packages/md-format/dist/index.js";

const fixturesRoot = "fixtures";
const requiredModes = new Set(["strict", "semantic", "opaque-preservation"]);

const fixtures = await loadFixtures(fixturesRoot);
const result = runFixtureRoundTrip({
  fixtures,
  formatter: createIdentityMarkdownFormatter()
});

if (result.summary.total < 18) {
  throw new Error(`Expected at least 18 round-trip fixtures, got ${result.summary.total}.`);
}

if (result.summary.passed < 10) {
  throw new Error(`Expected at least 10 passing round-trip fixtures, got ${result.summary.passed}.`);
}

for (const mode of requiredModes) {
  if (!result.summary.modes.includes(mode)) {
    throw new Error(`Missing round-trip mode: ${mode}`);
  }
}

const unknownSyntax = result.results.find((fixture) => fixture.fixtureId === "013-unknown-custom-syntax");
if (!unknownSyntax?.preservedOpaqueNodes.length) {
  throw new Error("Unknown syntax fixture must prove opaque node preservation.");
}
if (unknownSyntax.status !== "pass") {
  throw new Error("Unknown syntax fixture should pass opaque-preservation mode.");
}

const frontmatter = result.results.find((fixture) => fixture.fixtureId === "002-yaml-frontmatter");
if (frontmatter?.status !== "pass" || !frontmatter.frontmatterPreserved) {
  throw new Error("Frontmatter fixture must pass and preserve frontmatter.");
}

const html = result.results.find((fixture) => fixture.fixtureId === "010-html-inline-block");
if (html?.status !== "pass" || !html.htmlPreserved) {
  throw new Error("HTML fixture must pass and preserve HTML when untouched.");
}

for (const failure of result.results.filter((fixture) => fixture.status === "fail")) {
  if (!failure.diff.trim()) {
    throw new Error(`Failure for ${failure.fixtureId} must include a readable diff.`);
  }
}

for (const fixture of fixtures) {
  const input = fixture.input;
  if (!input.endsWith("\n")) {
    throw new Error(`${fixture.fixtureId}/input.md must end with a newline for stable round-trip checks.`);
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
