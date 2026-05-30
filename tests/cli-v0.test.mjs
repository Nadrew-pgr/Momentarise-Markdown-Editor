import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = process.cwd();
const cliPath = resolve("packages/md-cli/dist/index.js");
const cliSource = readFileSync("packages/md-cli/src/index.ts", "utf8");
const cliPackage = JSON.parse(readFileSync("packages/md-cli/package.json", "utf8"));

if (cliPackage.bin?.mme !== "./dist/index.js") {
  throw new Error("md-cli package must expose the mme binary.");
}

assertNoForbiddenHostImports(cliSource);

const frontmatterInspect = runCli(["inspect", "fixtures/002-yaml-frontmatter/input.md", "--json"]);
const frontmatter = parseJson(frontmatterInspect.stdout, "frontmatter inspect");
if (frontmatter.file !== "fixtures/002-yaml-frontmatter/input.md") {
  throw new Error(`Inspect must report the inspected file, got ${frontmatter.file}.`);
}
if (frontmatter.dialect !== "momentarise-enhanced") {
  throw new Error(`Inspect must default to momentarise-enhanced dialect, got ${frontmatter.dialect}.`);
}
if (frontmatter.frontmatter?.title !== "Fixture With Frontmatter") {
  throw new Error("Inspect must report YAML frontmatter.");
}
if (!frontmatter.diagnostics?.some((diagnostic) => diagnostic.code === "ast_parser_foundation")) {
  throw new Error("Inspect must report parser diagnostics.");
}

const opaqueInspect = runCli(["inspect", "fixtures/013-unknown-custom-syntax/input.md", "--json"]);
const opaque = parseJson(opaqueInspect.stdout, "opaque inspect");
if (!Array.isArray(opaque.opaqueNodes) || opaque.opaqueNodes.length === 0) {
  throw new Error("Inspect must report opaque nodes for unknown syntax.");
}

const fixturesResult = parseJson(runCli(["test:fixtures", "--json"]).stdout, "fixture test");
if (fixturesResult.summary.total < 18 || fixturesResult.summary.passed < 10) {
  throw new Error(`CLI fixture test returned weak summary: ${JSON.stringify(fixturesResult.summary)}`);
}
if (!fixturesResult.summary.modes.includes("opaque-preservation")) {
  throw new Error("CLI fixture test must include opaque-preservation mode.");
}
if (!fixturesResult.results.some((fixture) =>
  fixture.diagnostics.some((diagnostic) => diagnostic.code === "ast_parser_foundation")
)) {
  throw new Error("CLI fixture test must exercise the real AST formatter, not the identity formatter.");
}

const checkResult = parseJson(runCli(["check", "--json"]).stdout, "check");
if (checkResult.status !== "pass" || checkResult.fixtures.summary.total < 18) {
  throw new Error(`CLI check must pass fixture validation: ${JSON.stringify(checkResult)}`);
}

const tempRoot = await mkdtemp(join(tmpdir(), "mme-cli-"));
try {
  const formatFile = join(tempRoot, "format-me.md");
  const unformatted = "# CLI Format\n\nBody without final newline";
  await writeFile(formatFile, unformatted, "utf8");
  const beforeDryRun = await readFile(formatFile, "utf8");
  const dryRun = parseJson(runCli(["format", formatFile, "--json"]).stdout, "format dry-run");
  const afterDryRun = await readFile(formatFile, "utf8");
  if (afterDryRun !== beforeDryRun) {
    throw new Error("mme format dry-run must not write to disk.");
  }
  if (dryRun.wrote !== false || dryRun.changed !== true) {
    throw new Error(`Dry-run format must report pending change without writing: ${JSON.stringify(dryRun)}`);
  }

  const writeResult = parseJson(runCli(["format", formatFile, "--write", "--json"]).stdout, "format write");
  const afterWrite = await readFile(formatFile, "utf8");
  if (writeResult.wrote !== true || afterWrite !== `${unformatted}\n`) {
    throw new Error("mme format --write must explicitly write formatted content.");
  }

  const initResult = parseJson(runCli(["init", "--json"], { cwd: tempRoot }).stdout, "init");
  if (initResult.status !== "created" || !existsSync(join(tempRoot, ".momentarise-markdown-editor.json"))) {
    throw new Error("mme init must create local project config.");
  }

  const fixtureResult = parseJson(runCli(["create-fixture", "cli-smoke", "--json"], { cwd: tempRoot }).stdout, "create fixture");
  const fixtureInput = join(tempRoot, "fixtures", "cli-smoke", "input.md");
  const fixtureExpectations = join(tempRoot, "fixtures", "cli-smoke", "expectations.md");
  if (fixtureResult.fixtureId !== "cli-smoke") {
    throw new Error("mme create-fixture must report the created fixture id.");
  }
  await stat(fixtureInput);
  await stat(fixtureExpectations);

  const failingFixturesRoot = join(tempRoot, "fixtures");
  const failingFixtureRoot = join(failingFixturesRoot, "bad-fixture");
  await mkdir(failingFixtureRoot, {
    recursive: true
  });
  await writeFile(join(failingFixtureRoot, "input.md"), "# Bad fixture without final newline", "utf8");
  const failedCheck = spawnSync(process.execPath, [cliPath, "check", "--json"], {
    cwd: tempRoot,
    encoding: "utf8"
  });
  if (failedCheck.status === 0) {
    throw new Error("mme check must exit non-zero when fixture checks fail.");
  }
  const failedFixtureCheck = spawnSync(process.execPath, [cliPath, "test:fixtures", "--json"], {
    cwd: tempRoot,
    encoding: "utf8"
  });
  if (failedFixtureCheck.status === 0) {
    throw new Error("mme test:fixtures must exit non-zero when fixture checks fail.");
  }

  const missingExpectationsRoot = await mkdtemp(join(tmpdir(), "mme-cli-missing-expectations-"));
  const missingFixtureRoot = join(missingExpectationsRoot, "fixtures", "missing-expectations");
  await mkdir(missingFixtureRoot, {
    recursive: true
  });
  await writeFile(join(missingFixtureRoot, "input.md"), "# Missing Expectations\n", "utf8");
  const missingExpectationsCheck = spawnSync(process.execPath, [cliPath, "test:fixtures", "--json"], {
    cwd: missingExpectationsRoot,
    encoding: "utf8"
  });
  if (missingExpectationsCheck.status === 0) {
    throw new Error("mme test:fixtures must fail when a fixture has no expectations.md.");
  }
  await rm(missingExpectationsRoot, {
    force: true,
    recursive: true
  });
} finally {
  await rm(tempRoot, {
    force: true,
    recursive: true
  });
}

function runCli(args, options = {}) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? root,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(
      `CLI command failed: mme ${args.join(" ")}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }
  return result;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Expected JSON for ${label}, got:\n${text}\n${error instanceof Error ? error.message : ""}`);
  }
}

function assertNoForbiddenHostImports(source) {
  const forbidden = ["@theia/", "vscode", "@codemirror/", "codemirror", "prosemirror", "electron"];
  for (const value of forbidden) {
    if (source.includes(value)) {
      throw new Error(`CLI must not import host/editor dependency: ${value}`);
    }
  }
}
