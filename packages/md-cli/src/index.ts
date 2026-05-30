#!/usr/bin/env node
import type {
  Diagnostic,
  DocumentDialect,
  DocumentPath,
  MomentariseNode,
  OpaqueNode,
  ParseResult
} from "@momentarise/md-core";
import {
  createMarkdownAstFormatter,
  runFixtureRoundTrip,
  type RoundTripFixture,
  type RoundTripHarnessResult
} from "@momentarise/md-format";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface CliContract {
  readonly packageName: "@momentarise/md-cli";
  readonly dependsOnCore: true;
  readonly commandName: "mme";
}

export type CliCommandName =
  | "init"
  | "check"
  | "test:fixtures"
  | "inspect"
  | "format"
  | "create-fixture";

export interface CliCommandContext {
  readonly cwd: DocumentPath;
  readonly defaultDialect: DocumentDialect;
}

export interface CliCommandDefinition {
  readonly name: CliCommandName;
  readonly mutatesFiles: boolean;
}

export interface CliRunOptions {
  readonly cwd?: string;
}

export interface CliRunResult {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

interface ParsedArgs {
  readonly command: string | undefined;
  readonly dialect: DocumentDialect;
  readonly json: boolean;
  readonly positionals: readonly string[];
  readonly write: boolean;
}

const defaultDialect: DocumentDialect = "momentarise-enhanced";
const configFileName = ".momentarise-markdown-editor.json";

export const cliCommands: readonly CliCommandDefinition[] = [
  {
    mutatesFiles: true,
    name: "init"
  },
  {
    mutatesFiles: false,
    name: "check"
  },
  {
    mutatesFiles: false,
    name: "test:fixtures"
  },
  {
    mutatesFiles: false,
    name: "inspect"
  },
  {
    mutatesFiles: false,
    name: "format"
  },
  {
    mutatesFiles: true,
    name: "create-fixture"
  }
];

export async function runCli(args: readonly string[], options: CliRunOptions = {}): Promise<CliRunResult> {
  const cwd = options.cwd ?? process.cwd();
  const parsed = parseArgs(args);
  try {
    if (!parsed.command || parsed.command === "help" || parsed.command === "--help" || parsed.command === "-h") {
      return ok(helpText());
    }

    if (!isCliCommandName(parsed.command)) {
      return fail(`Unknown command: ${parsed.command}\n\n${helpText()}`);
    }

    if (parsed.command === "init") {
      return ok(formatPayload(await initProject(cwd), parsed.json));
    }
    if (parsed.command === "check") {
      const result = await checkProject(cwd, parsed.dialect);
      return result.status === "pass"
        ? ok(formatPayload(result, parsed.json))
        : fail(formatPayload(result, parsed.json));
    }
    if (parsed.command === "test:fixtures") {
      const result = await testFixtures(cwd, parsed.dialect);
      return result.summary.failed === 0
        ? ok(formatPayload(result, parsed.json))
        : fail(formatPayload(result, parsed.json));
    }
    if (parsed.command === "inspect") {
      return ok(formatPayload(await inspectFile(cwd, parsed), parsed.json));
    }
    if (parsed.command === "format") {
      return ok(formatPayload(await formatFile(cwd, parsed), parsed.json));
    }
    if (parsed.command === "create-fixture") {
      return ok(formatPayload(await createFixture(cwd, parsed), parsed.json));
    }

    return fail(`Unhandled command: ${parsed.command}`);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unknown CLI error.");
  }
}

async function initProject(cwd: string): Promise<{
  readonly configPath: string;
  readonly status: "created" | "exists";
}> {
  const configPath = join(cwd, configFileName);
  if (await fileExists(configPath)) {
    return {
      configPath,
      status: "exists"
    };
  }
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        defaultDialect,
        fixtures: "fixtures",
        schemaVersion: 1
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return {
    configPath,
    status: "created"
  };
}

async function checkProject(
  cwd: string,
  dialect: DocumentDialect
): Promise<{
  readonly fixtures: Awaited<ReturnType<typeof testFixtures>>;
  readonly status: "pass" | "fail";
}> {
  const fixtures = await testFixtures(cwd, dialect);
  return {
    fixtures,
    status: fixtures.summary.failed === 0 ? "pass" : "fail"
  };
}

async function testFixtures(
  cwd: string,
  dialect: DocumentDialect
): Promise<{
  readonly results: readonly {
    readonly diagnostics: readonly Pick<Diagnostic, "code" | "severity" | "message">[];
    readonly fixtureId: string;
    readonly mode: string;
    readonly status: string;
  }[];
  readonly summary: RoundTripHarnessResult["summary"];
}> {
  const fixtures = await loadFixtures(join(cwd, "fixtures"));
  const result = runFixtureRoundTrip({
    dialect,
    fixtures,
    formatter: createMarkdownAstFormatter()
  });
  const fixtureRows = result.results.map((fixture, index) => {
    const sourceFixture = fixtures[index]!;
    const diagnostics = fixture.diagnostics.map(minimalDiagnostic);
    const stabilityDiagnostics = sourceFixture.input.endsWith("\n")
      ? []
      : [
          {
            code: "fixture_missing_final_newline",
            message: "Fixture input must end with a newline for stable round-trip checks.",
            severity: "error" as const
          }
        ];
    return {
      diagnostics: [...diagnostics, ...stabilityDiagnostics],
      fixtureId: fixture.fixtureId,
      mode: fixture.mode,
      status: stabilityDiagnostics.length > 0 ? "fail" : fixture.status
    };
  });
  const passed = fixtureRows.filter((fixture) => fixture.status === "pass").length;
  return {
    results: fixtureRows,
    summary: {
      ...result.summary,
      failed: fixtureRows.length - passed,
      passed
    }
  };
}

async function inspectFile(
  cwd: string,
  parsed: ParsedArgs
): Promise<{
  readonly diagnostics: readonly Pick<Diagnostic, "code" | "severity" | "message">[];
  readonly dialect: DocumentDialect;
  readonly file: string;
  readonly frontmatter: ParseResult["document"]["frontmatter"] | null;
  readonly hash: string;
  readonly opaqueNodes: readonly {
    readonly reason: string | null;
    readonly sourceRange: OpaqueNode["sourceRange"];
  }[];
}> {
  const file = requiredPositional(parsed, 0, "mme inspect <file>");
  const path = resolve(cwd, file);
  const source = await readFile(path, "utf8");
  const formatter = createMarkdownAstFormatter();
  const result = formatter.parse(source, {
    dialect: parsed.dialect,
    path: displayPath(cwd, path) as DocumentPath
  });
  return {
    diagnostics: result.diagnostics.map(minimalDiagnostic),
    dialect: result.snapshot.dialect,
    file: displayPath(cwd, path),
    frontmatter: result.document.frontmatter ?? null,
    hash: result.snapshot.hash,
    opaqueNodes: collectOpaqueNodes(result.document.root).map((node) => ({
      reason: node.reason ?? null,
      sourceRange: node.sourceRange
    }))
  };
}

async function formatFile(
  cwd: string,
  parsed: ParsedArgs
): Promise<{
  readonly changed: boolean;
  readonly diagnostics: readonly Pick<Diagnostic, "code" | "severity" | "message">[];
  readonly file: string;
  readonly formatted?: string;
  readonly writeRequired: boolean;
  readonly wrote: boolean;
}> {
  const file = requiredPositional(parsed, 0, "mme format <file> [--write]");
  const path = resolve(cwd, file);
  const source = await readFile(path, "utf8");
  const formatter = createMarkdownAstFormatter();
  const parseResult = formatter.parse(source, {
    dialect: parsed.dialect,
    path: displayPath(cwd, path) as DocumentPath
  });
  const serializeResult = formatter.serialize(parseResult, {
    dialect: parsed.dialect,
    preserveUnchangedRanges: true
  });
  const formatted = ensureFinalNewline(serializeResult.content);
  const changed = formatted !== source;
  if (parsed.write && changed) {
    await writeFile(path, formatted, "utf8");
  }
  return {
    changed,
    diagnostics: [...parseResult.diagnostics, ...serializeResult.diagnostics].map(minimalDiagnostic),
    file: displayPath(cwd, path),
    ...(parsed.json ? {} : { formatted }),
    writeRequired: changed && !parsed.write,
    wrote: parsed.write && changed
  };
}

async function createFixture(
  cwd: string,
  parsed: ParsedArgs
): Promise<{
  readonly expectationsPath: string;
  readonly fixtureId: string;
  readonly inputPath: string;
  readonly status: "created";
}> {
  const fixtureId = sanitizeFixtureName(requiredPositional(parsed, 0, "mme create-fixture <name>"));
  const fixtureRoot = join(cwd, "fixtures", fixtureId);
  const inputPath = join(fixtureRoot, "input.md");
  const expectationsPath = join(fixtureRoot, "expectations.md");
  await mkdir(fixtureRoot, {
    recursive: true
  });
  if (await fileExists(inputPath) || await fileExists(expectationsPath)) {
    throw new Error(`Fixture already exists: ${fixtureId}`);
  }
  await writeFile(inputPath, `# ${fixtureId}\n\n`, "utf8");
  await writeFile(
    expectationsPath,
    [
      `# ${fixtureId} expectations`,
      "",
      "- preserve: source Markdown must survive round-trip.",
      "- normalized: document may receive documented formatting normalizations.",
      "- opaque: unknown syntax must be kept raw.",
      "- source-only: unsupported blocks remain editable in source mode.",
      "- render: supported blocks should render in compatible views.",
      ""
    ].join("\n"),
    "utf8"
  );
  return {
    expectationsPath,
    fixtureId,
    inputPath,
    status: "created"
  };
}

async function loadFixtures(fixturesRoot: string): Promise<readonly RoundTripFixture[]> {
  await access(fixturesRoot, fsConstants.R_OK);
  const entries = await readdir(fixturesRoot, {
    withFileTypes: true
  });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  return Promise.all(
    directories.map(async (fixtureId) => ({
      fixtureId,
      input: await readFile(join(fixturesRoot, fixtureId, "input.md"), "utf8")
    }))
  );
}

function parseArgs(args: readonly string[]): ParsedArgs {
  let dialect: DocumentDialect = defaultDialect;
  let json = false;
  let write = false;
  const positionals: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--json") {
      json = true;
    } else if (arg === "--write") {
      write = true;
    } else if (arg === "--dialect") {
      const value = args[index + 1];
      if (!isDocumentDialect(value)) {
        throw new Error(`Invalid or missing dialect after --dialect: ${value ?? "<missing>"}`);
      }
      dialect = value;
      index += 1;
    } else {
      positionals.push(arg);
    }
  }
  return {
    command: positionals[0],
    dialect,
    json,
    positionals: positionals.slice(1),
    write
  };
}

function isCliCommandName(value: string): value is CliCommandName {
  return cliCommands.some((command) => command.name === value);
}

function isDocumentDialect(value: unknown): value is DocumentDialect {
  return (
    value === "commonmark" ||
    value === "gfm" ||
    value === "obsidian-compatible" ||
    value === "momentarise-enhanced"
  );
}

function requiredPositional(parsed: ParsedArgs, index: number, usage: string): string {
  const value = parsed.positionals[index];
  if (!value) {
    throw new Error(`Missing argument. Usage: ${usage}`);
  }
  return value;
}

function collectOpaqueNodes(node: MomentariseNode): readonly OpaqueNode[] {
  if (node.kind === "opaque") {
    return [node];
  }
  return (node.children ?? []).flatMap((child) => collectOpaqueNodes(child));
}

function minimalDiagnostic(diagnostic: Diagnostic): Pick<Diagnostic, "code" | "severity" | "message"> {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    severity: diagnostic.severity
  };
}

function ensureFinalNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function sanitizeFixtureName(value: string): string {
  const sanitized = basename(value).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!sanitized) {
    throw new Error(`Invalid fixture name: ${value}`);
  }
  return sanitized;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const entry = await stat(path);
    return entry.isFile();
  } catch {
    return false;
  }
}

function displayPath(cwd: string, path: string): string {
  const relativePath = relative(cwd, path);
  return relativePath && !relativePath.startsWith("..") ? relativePath : path;
}

function formatPayload(payload: unknown, json: boolean): string {
  if (json) {
    return `${JSON.stringify(payload, null, 2)}\n`;
  }
  if (typeof payload === "object" && payload && "formatted" in payload && typeof payload.formatted === "string") {
    return payload.formatted;
  }
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function ok(stdout: string): CliRunResult {
  return {
    exitCode: 0,
    stderr: "",
    stdout
  };
}

function fail(stderr: string): CliRunResult {
  return {
    exitCode: 1,
    stderr: `${stderr.trimEnd()}\n`,
    stdout: ""
  };
}

function helpText(): string {
  return [
    "Momentarise Markdown Editor CLI",
    "",
    "Usage:",
    "  mme init [--json]",
    "  mme check [--json]",
    "  mme test:fixtures [--json]",
    "  mme inspect <file> [--json] [--dialect <dialect>]",
    "  mme format <file> [--write] [--json] [--dialect <dialect>]",
    "  mme create-fixture <name> [--json]",
    ""
  ].join("\n");
}

function isDirectInvocation(metaUrl: string): boolean {
  const invokedPath = process.argv[1];
  return invokedPath ? resolve(fileURLToPath(metaUrl)) === resolve(invokedPath) : false;
}

if (isDirectInvocation(import.meta.url)) {
  const result = await runCli(process.argv.slice(2));
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exitCode = result.exitCode;
}

export type { DocumentDialect, DocumentPath } from "@momentarise/md-core";
