/**
 * MME-0114 — the deterministic half of visual gate integrity.
 *
 * The browser gates themselves cannot run inside `npm test` (they need a real
 * Chrome and three dev servers). What CAN run on every push is the structural
 * contract around them, and that contract is where the rot actually started:
 *
 *  - four gate scripts existed with no `package.json` entry at all, so no
 *    command in the repository could run them;
 *  - eight gates delete their whole artifact directory before running, taking
 *    the committed `README.md` that Gate 0.8 requires with them whenever the
 *    gate then fails;
 *  - nothing proved a gate script actually exits non-zero when its assertion
 *    fails, which is the only reason a suite means anything.
 *
 * Every assertion below was mutation-tested: see the reversion table in the
 * MME-0114 build-log entry.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  clearGeneratedArtifacts,
  classifyGateOutcome,
  countFreshArtifacts,
  outcomeFailsBuild
} from "../scripts/visual-artifacts.mjs";
import { SAVE_TRUTH_PAIR_EXPRESSION, assertSaveTruthPair } from "../scripts/visual-save-truth.mjs";
import { DEMO_DISCLOSURES, openDemoDisclosuresExpression } from "../scripts/visual-demo-disclosures.mjs";
import { footnoteMembershipExpression } from "../scripts/visual-footnote-membership.mjs";
import {
  richContentBlocksExpression,
  richTextExpression,
  richTextIndexExpression,
  richTextListExpression
} from "../scripts/visual-rich-text.mjs";
import {
  DEFAULT_GROUPS,
  KEPT_VISUAL_ARTIFACTS,
  KNOWN_FAILING,
  OPT_IN_GROUPS,
  VISUAL_GATES,
  VISUAL_SERVERS
} from "../scripts/visual-gates.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");

const packageJson = JSON.parse(read("package.json"));

/* ------------------------------------------------------------------ *
 * 1. The manifest is the whole set: no gate script is unreachable.
 * ------------------------------------------------------------------ */

const scriptFiles = readdirSync(join(repoRoot, "scripts"))
  .filter((name) => name.startsWith("visual-check-") && name.endsWith(".mjs"))
  .map((name) => `scripts/${name}`)
  .sort();

const manifestScripts = [...new Set(VISUAL_GATES.map((gate) => gate.script))].sort();

assert.deepEqual(
  manifestScripts,
  scriptFiles,
  "Every scripts/visual-check-*.mjs file must appear in VISUAL_GATES, and every manifest entry must point at a real file. " +
    "A gate outside the manifest is a gate nothing runs — that is exactly how four proofs went unreachable before MME-0114."
);

/* ------------------------------------------------------------------ *
 * 2. Every gate is runnable on its own, through package.json.
 * ------------------------------------------------------------------ */

const npmVisualScripts = Object.keys(packageJson.scripts)
  .filter((name) => name.startsWith("visual:"))
  .sort();

assert.deepEqual(
  npmVisualScripts,
  VISUAL_GATES.map((gate) => gate.npmScript).sort(),
  "package.json's visual:* scripts and the manifest's npmScript values must be the same set."
);

for (const gate of VISUAL_GATES) {
  const command = packageJson.scripts[gate.npmScript];
  assert.equal(
    command,
    `node ${gate.script}`,
    `${gate.npmScript} must run ${gate.script}; it runs "${command}".`
  );
}

assert.equal(
  packageJson.scripts.visual,
  "node scripts/visual-runner.mjs",
  "`npm run visual` is the one documented command that runs the suite."
);

/* ------------------------------------------------------------------ *
 * 3. Manifest entries are internally coherent.
 * ------------------------------------------------------------------ */

const knownGroups = new Set([...DEFAULT_GROUPS, ...OPT_IN_GROUPS]);

// The only issue allowed to own a quarantined gate. The list is empty today —
// MME-0116 repaired the last 37 entries, after MME-0117 and MME-0119 shipped
// their product fixes — so this set currently guards nothing. It stays because a
// new owner must be a deliberate edit here, not something a gate can claim for
// itself, and MME-0116 remains the reference for what an owner has to be.
const QUARANTINE_OWNERS = new Set(["MME-0116"]);

const seenIds = new Set();

for (const gate of VISUAL_GATES) {
  assert.ok(!seenIds.has(gate.id), `Duplicate gate id: ${gate.id}`);
  seenIds.add(gate.id);

  assert.ok(knownGroups.has(gate.group), `${gate.id}: unknown group "${gate.group}".`);
  assert.ok(VISUAL_SERVERS[gate.group], `${gate.id}: group "${gate.group}" has no server definition.`);
  assert.ok(existsSync(join(repoRoot, gate.script)), `${gate.id}: ${gate.script} does not exist.`);
  assert.ok(
    existsSync(join(repoRoot, gate.artifacts)),
    `${gate.id}: artifact directory ${gate.artifacts} does not exist. A gate with nowhere to write its proof cannot prove anything.`
  );

  if (gate.status === "retired") {
    /*
     * Retirement removes a gate from the suite entirely, so it needs at least the
     * accountability quarantine needs — otherwise it is the cheaper escape hatch
     * and every awkward gate ends up here instead.
     */
    assert.ok(
      typeof gate.reason === "string" && gate.reason.length > 0,
      `${gate.id}: a retired gate must record why. "Left red" and "quietly deleted" are the two outcomes this issue exists to forbid.`
    );
    assert.match(
      String(gate.obsoletedBy),
      /^MME-\d{4}(\.\d+)?$/,
      `${gate.id}: a retired gate must name the issue that made it obsolete in \`obsoletedBy\`.`
    );
  } else if (gate.status === "known-failing") {
    /*
     * The quarantine contract. A gate may be exempted from failing the build
     * only if the exemption names why and who repairs it — otherwise the list
     * becomes a way to silence red gates, which is the failure MME-0114 exists
     * to end rather than to institutionalise.
     */
    assert.ok(
      typeof gate.reason === "string" && gate.reason.length > 0,
      `${gate.id}: a known-failing gate must record why it fails. Nothing enters quarantine anonymously.`
    );
    assert.match(
      String(gate.since),
      /^\d{4}-\d{2}-\d{2}$/,
      `${gate.id}: a known-failing gate must record when it entered quarantine, so an entry that outlives its owning issue is visible.`
    );
    assert.ok(
      QUARANTINE_OWNERS.has(gate.owner),
      `${gate.id}: a known-failing gate must name the issue that owns its repair (one of ${[...QUARANTINE_OWNERS].join(", ")}); it names ${JSON.stringify(gate.owner)}.`
    );
  } else {
    assert.equal(gate.status, "active", `${gate.id}: status must be "active", "known-failing" or "retired".`);
  }
}

// Quarantine entries and gate statuses are one fact, not two.
assert.deepEqual(
  Object.keys(KNOWN_FAILING).sort(),
  VISUAL_GATES.filter((gate) => gate.status === "known-failing")
    .map((gate) => gate.id)
    .sort(),
  "Every KNOWN_FAILING key must correspond to a gate marked known-failing, and vice versa. A quarantine entry for a gate id that does not exist silences nothing and hides a typo."
);

for (const gate of VISUAL_GATES) {
  const expected = VISUAL_SERVERS[gate.group].env;
  assert.ok(
    read(gate.script).includes(`process.env.${expected}`),
    `${gate.id}: declares group "${gate.group}" but its script never reads ${expected}. ` +
      "Reassigning a gate's group is otherwise a silent way to move it into an opt-in set that no job runs."
  );
}

for (const [name, server] of Object.entries(VISUAL_SERVERS)) {
  assert.ok(server.env?.startsWith("MME_"), `Server ${name} must declare the MME_* env var gates read for its URL.`);
  assert.ok(server.url?.startsWith("http://127.0.0.1:"), `Server ${name} must pin a loopback URL.`);
}

/* ------------------------------------------------------------------ *
 * 4. Every gate script is capable of failing the build.
 *
 * Two independent properties: the process must exit non-zero when the body
 * throws, and the body must contain at least one check that can throw. A
 * screenshot script with no assertion is a picture, not a gate.
 * ------------------------------------------------------------------ */

const TOP_LEVEL_AWAIT_MAIN = /^await main\(\);$/m;
const CATCH_WITH_FAILING_EXIT = /main\(\)[\s\S]{0,200}?\.catch\([\s\S]{0,200}?process\.exit(Code)?\s*(\(|=)\s*1/;

for (const gate of VISUAL_GATES) {
  const source = read(gate.script);

  assert.ok(
    TOP_LEVEL_AWAIT_MAIN.test(source) || CATCH_WITH_FAILING_EXIT.test(source),
    `${gate.id}: ${gate.script} must end in a top-level \`await main();\` or a \`.catch\` that sets a non-zero exit code. ` +
      "A gate that logs its failure and exits 0 is worse than no gate."
  );

  const assertions =
    (source.match(/throw new Error\(/g) ?? []).length + (source.match(/\bassert[.(]/g) ?? []).length;
  assert.ok(
    assertions >= 3,
    `${gate.id}: ${gate.script} contains only ${assertions} failing-capable check(s). ` +
      "Visual gates must assert behaviour, not merely capture screenshots."
  );
}

/* ------------------------------------------------------------------ *
 * 5. No gate destroys the documentation that explains its own artifacts.
 *
 * Gate 0.8 requires a README.md in each visual-checks folder. Eight scripts used
 * to `rm(visualDir, { recursive: true })` before running; when such a gate then
 * failed, it deleted the committed README and result files on its way down. The
 * first full suite run in MME-0114 did exactly that to MME-0078.
 * ------------------------------------------------------------------ */

/*
 * The property, not one spelling of it. The first version of this check grepped
 * for the exact historical call; review demonstrated that 8 of 10 realistic
 * variants evaded it (`rmSync`, `fs.rm`, `rm(join(visualDir))`,
 * `rm(\`${visualDir}/\`)`, an aliased identifier, and so on). So: no removal call
 * of any spelling may name the artifact directory, and any recursive removal
 * must target one of the scratch directories a gate legitimately owns.
 */
const REMOVAL_CALL = /(?:^|[^\w.])(?:fs\.)?rm(?:Sync)?\(([^;]*?)\)\s*;/gm;
const SCRATCH_TARGET = /userDataDir|\/tmp\/|tmpdir\(\)/;
/** `visualDir`, `join(visualDir)`, `` `${visualDir}` ``, `` `${visualDir}/` `` — the directory itself. */
const IS_THE_DIRECTORY = /^\s*(visualDir|join\(\s*visualDir\s*\)|`\$\{visualDir\}\/?`)\s*$/;

/** The first argument of a call, up to the first top-level comma. */
function firstArgument(args) {
  let depth = 0;
  for (let index = 0; index < args.length; index += 1) {
    const character = args[index];
    if ("([{`".includes(character)) {
      depth += 1;
    } else if (")]}`".includes(character)) {
      depth -= 1;
    } else if (character === "," && depth === 0) {
      return args.slice(0, index);
    }
  }
  return args;
}

for (const gate of VISUAL_GATES) {
  const source = read(gate.script);
  // Statements only: the repaired scripts quote the old call in their comments.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  for (const [call, args] of code.matchAll(REMOVAL_CALL)) {
    const target = firstArgument(args);
    const statement = call.trim();

    assert.ok(
      !IS_THE_DIRECTORY.test(target) && !/\bdirname\s*\(/.test(target),
      `${gate.id}: ${gate.script} removes its artifact directory itself (\`${statement}\`). ` +
        "Remove only the files the gate regenerates — via clearGeneratedArtifacts, or per file — so a failing run cannot destroy the committed README.md and result files."
    );

    if (/recursive:/.test(args)) {
      assert.match(
        target,
        SCRATCH_TARGET,
        `${gate.id}: ${gate.script} performs a recursive removal on something other than its own scratch directory (\`${statement}\`). ` +
          "A recursive delete near the artifact directory is how MME-0078's committed README and result.json were lost."
      );
    }
  }
}

/*
 * Finding from review: a gate could still exit 0 while swallowing its own
 * failure. `try { … } catch (error) { console.error(error); }` inside `main`
 * leaves the top-level `await main();` and the assertion count intact while
 * making the gate incapable of failing the build — the precise failure mode
 * section 4 names. Every catch that binds an error must rethrow it or exit
 * non-zero; the bare `catch {}` used as a polling guard is fine because it
 * cannot hide an assertion.
 */
const BINDING_CATCH = /catch\s*\((\w+)\)\s*\{/g;

/** The body of a block whose opening brace sits at `openIndex`, brace-matched. */
function blockBody(source, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex + 1, index);
      }
    }
  }
  return source.slice(openIndex);
}

for (const gate of VISUAL_GATES) {
  const source = read(gate.script);
  for (const match of source.matchAll(BINDING_CATCH)) {
    const body = blockBody(source, match.index + match[0].length - 1);
    const handles = /\bthrow\b/.test(body) || /process\.exit(Code)?\s*(\(|=)\s*1/.test(body);
    assert.ok(
      handles,
      `${gate.id}: ${gate.script} has a \`catch (${match[1]})\` that neither rethrows nor sets a non-zero exit. ` +
        "A gate that logs its failure and exits 0 is worse than no gate."
    );
  }
}

/*
 * A gate that never exits is worse than one that fails: it looks identical from
 * the outside and it blocks the suite behind it. MME-0005 did exactly this — it
 * printed its success line and then hung, because a Chrome that ignores SIGTERM
 * keeps its stdio pipes open and so keeps Node's event loop alive. Every gate
 * that signals Chrome must therefore escalate.
 */
for (const gate of VISUAL_GATES) {
  const source = read(gate.script);
  if (!source.includes('kill("SIGTERM")')) {
    continue;
  }
  assert.ok(
    source.includes('kill("SIGKILL")'),
    `${gate.id}: ${gate.script} signals Chrome with SIGTERM but never escalates to SIGKILL. ` +
      "A gate that hangs on a browser which ignores SIGTERM stalls the whole suite until the runner's timeout."
  );
}

/* ------------------------------------------------------------------ *
 * 6. The staleness and preservation rules the runner depends on.
 *
 * `countFreshArtifacts` is what turns "exited 0" into "actually produced a
 * proof". `clearGeneratedArtifacts` is what stops a gate destroying its own
 * documentation on the way down. Both are exercised against a real directory
 * because both are entirely about filesystem behaviour.
 * ------------------------------------------------------------------ */

const sandbox = await mkdtemp(join(tmpdir(), "mme-visual-gate-integrity-"));
try {
  const runStartedAt = Date.now();
  const longAgo = new Date(runStartedAt - 90 * 24 * 60 * 60 * 1000);

  await writeFile(join(sandbox, "README.md"), "# what these artifacts prove\n");
  await writeFile(join(sandbox, "old-screenshot.png"), "stale");
  await utimes(join(sandbox, "old-screenshot.png"), longAgo, longAgo);
  await utimes(join(sandbox, "README.md"), longAgo, longAgo);

  const beforeWriting = await countFreshArtifacts(sandbox, runStartedAt);
  assert.equal(
    beforeWriting.fresh,
    0,
    "A directory holding only files older than the run must report zero fresh artifacts, so the runner fails the gate instead of trusting last month's screenshots."
  );
  assert.equal(beforeWriting.total, 2, "Stale files must still be counted, so the failure message can say how many were found.");

  await writeFile(join(sandbox, "new-screenshot.png"), "fresh");
  const afterWriting = await countFreshArtifacts(sandbox, runStartedAt);
  assert.equal(afterWriting.fresh, 1, "A file written during the run must count as a fresh artifact.");

  assert.equal(
    (await countFreshArtifacts(join(sandbox, "does-not-exist"), runStartedAt)).missing,
    true,
    "A missing artifact directory must be reported as missing, not as an empty success."
  );

  await clearGeneratedArtifacts(sandbox);
  assert.equal(
    existsSync(join(sandbox, "README.md")),
    true,
    "clearGeneratedArtifacts must never delete the README.md that Gate 0.8 requires."
  );
  assert.equal(
    existsSync(join(sandbox, "old-screenshot.png")),
    false,
    "clearGeneratedArtifacts must remove the screenshots the gate regenerates."
  );
} finally {
  await rm(sandbox, { force: true, recursive: true });
}

/* ------------------------------------------------------------------ *
 * 7. The quarantine contract, as behaviour rather than as prose.
 *
 * The MME-0114 addendum requires three rules. They are asserted here rather than
 * only in the runner because the runner needs a browser and three dev servers,
 * and a rule nothing checks on every push is how this suite rotted in the first
 * place.
 * ------------------------------------------------------------------ */

const outcome = (quarantined, exitedZero, wroteFreshArtifact) =>
  classifyGateOutcome({ exitedZero, quarantined, wroteFreshArtifact });

assert.equal(outcome(false, true, true), "passed", "A healthy gate that exits 0 and writes a proof passed.");
assert.equal(outcome(false, false, false), "failed", "A gate expected to pass that exits non-zero failed.");
assert.equal(
  outcome(false, true, false),
  "failed",
  "A gate that exits 0 without writing a fresh artifact failed: last month's screenshots are not evidence about today."
);
assert.equal(
  outcome(true, false, false),
  "known-failing",
  "A quarantined gate that fails is the recorded expectation — reported and counted, not a build failure."
);
assert.equal(
  outcome(true, true, true),
  "anomaly",
  "A quarantined gate that PASSES is an anomaly, so a repair that landed without updating the manifest gets noticed instead of rotting."
);

assert.equal(outcomeFailsBuild("failed"), true, "Only an unexpected failure may fail the build.");
for (const status of ["passed", "known-failing", "anomaly"]) {
  assert.equal(
    outcomeFailsBuild(status),
    false,
    `"${status}" must not fail the build; a permanently red job is a job everyone learns to ignore.`
  );
}

/* ------------------------------------------------------------------ *
 * 8. Save truthfulness, asserted on the pair (Gate 6).
 *
 * `md-surface` renders `persistence-target` immediately above `save-state`, so
 * the user reads the target next to the word `saved`. The pair assertion is
 * stronger than the single-field check it replaces because it also fails when
 * the target line is dropped, moved out of the panel, or reordered below the
 * status — none of which the old check could catch.
 * ------------------------------------------------------------------ */

const truthfulPair = {
  engineState: "memory saved (not persisted)",
  engineTarget: "memory-only",
  inSamePanel: true,
  saveState: "saved",
  targetLabel: "fixture, memory only, not persisted",
  targetPrecedesStatus: true,
  visible: true
};

assertSaveTruthPair(truthfulPair, "a bare `saved` beside a target label is honest");

const rejects = (mutation, why) => {
  assert.throws(
    () => assertSaveTruthPair({ ...truthfulPair, ...mutation }, "pair"),
    /Save UI|persistence target|status panel|Save Engine|save-state/i,
    why
  );
};

rejects({ targetLabel: null }, "Dropping the persistence-target line must fail.");
rejects({ targetLabel: "" }, "An empty persistence-target line must fail.");
rejects({ inSamePanel: false }, "A target rendered outside the status panel must fail.");
rejects({ targetPrecedesStatus: false }, "A target rendered below the status must fail.");
rejects({ targetLabel: "saved" }, "A target line that just repeats a bare status word names no target.");
rejects({ saveState: null }, "A missing save-state line must fail.");
rejects({ saveState: "" }, "An empty save-state line must fail.");
/*
 * The two properties review showed the first version of this module had lost:
 * it read a collapsed panel (asserting text no user can see), and it silently
 * dropped the Save Engine half that `assertNoPlainSaved` used to cover.
 */
rejects(
  { visible: false },
  "Asserting the pair while the status popover is collapsed is a claim about invisible DOM and must fail."
);
rejects({ engineState: null }, "A missing Save Engine state must fail.");
rejects({ engineState: "" }, "An empty Save Engine state must fail.");
rejects(
  { engineState: "saved" },
  "A bare `saved` in the Save Engine panel must fail — this is the half the single-field check used to cover."
);
assertSaveTruthPair(
  { ...truthfulPair, engineState: "dirty" },
  "a bare `dirty` in the Save Engine panel claims no persistence and is honest"
);

/* ------------------------------------------------------------------ *
 * 9. The artifact policy (MME-0116, decided 2026-08-06).
 *
 * Screenshots are gate output. They re-render on every run, so committing them
 * put "run the visual suite before committing" and "commit only your issue" in
 * direct conflict: MME-0123's run dirtied 242 tracked PNGs, none of them caused
 * by its change. The images are gitignored and uploaded by CI; `result.json` and
 * `README.md` stay committed because they are diffable.
 *
 * This section is what stops the policy decaying back. A newly committed PNG is
 * rejected unless it is declared in `KEPT_VISUAL_ARTIFACTS` with a reason and an
 * owning issue — the same accountability the quarantine requires, so keeping a
 * screenshot is a deliberate act rather than the path of least resistance.
 * ------------------------------------------------------------------ */

const VISUAL_CHECKS_DIR = "docs/internal/visual-checks";

/*
 * Deliberately not a `try { … } catch { skip }`. A check that silently disables
 * itself when its precondition is missing is the exact defect this suite exists
 * to prevent — Block B3 shipped a gate that reported green while disabled
 * because this repository's directory name contains a space.
 */
let trackedVisualFiles;
try {
  trackedVisualFiles = execFileSync("git", ["ls-files", "-z", "--", VISUAL_CHECKS_DIR], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  })
    .split("\0")
    .filter(Boolean);
} catch (error) {
  throw new Error(
    `The artifact policy check needs \`git ls-files\` to see what is committed under ${VISUAL_CHECKS_DIR}; git failed: ${error.message}`
  );
}

const isUnder = (file, directory) => file === directory || file.startsWith(`${directory}/`);

for (const kept of KEPT_VISUAL_ARTIFACTS) {
  assert.ok(
    kept.path?.startsWith(`${VISUAL_CHECKS_DIR}/`),
    `A kept-artifact entry must point inside ${VISUAL_CHECKS_DIR}; it points at ${JSON.stringify(kept.path)}.`
  );
  assert.ok(
    typeof kept.reason === "string" && kept.reason.length > 0,
    `${kept.path}: a kept screenshot must record why it survives the purge. Nothing stays committed anonymously.`
  );
  assert.match(
    String(kept.issue),
    /^MME-\d{4}(\.\d+)?$/,
    `${kept.path}: a kept screenshot must name the issue whose record it is evidence for.`
  );
  /*
   * A kept path that matches nothing is how the exception list would rot into a
   * blanket permission: it stops describing the tree, and the next reviewer
   * reads it as broader than it is.
   */
  assert.ok(
    trackedVisualFiles.some((file) => isUnder(file, kept.path) && file.endsWith(".png")),
    `${kept.path}: declared as a kept screenshot but no committed PNG matches it. Remove the entry, or restore the evidence it claims to protect.`
  );
}

const undeclaredScreenshots = trackedVisualFiles.filter(
  (file) => file.endsWith(".png") && !KEPT_VISUAL_ARTIFACTS.some((kept) => isUnder(file, kept.path))
);

assert.deepEqual(
  undeclaredScreenshots,
  [],
  `${undeclaredScreenshots.length} committed screenshot(s) under ${VISUAL_CHECKS_DIR} are not declared in KEPT_VISUAL_ARTIFACTS:\n` +
    `${undeclaredScreenshots.slice(0, 10).map((file) => `  ${file}`).join("\n")}\n` +
    "Screenshots are gate output: every run re-renders them, so a committed one is drift, not evidence. Let them be gitignored and read them from the CI artifact instead. " +
    "If one really is load-bearing for an issue record and nothing reproduces it, declare it in KEPT_VISUAL_ARTIFACTS with a reason and an owning issue."
);

/*
 * The manifest states the policy; `.gitignore` is what enforces it on a laptop.
 * They are one fact, so a change to either that leaves the other behind fails
 * here rather than at the next surprise commit.
 */
const gitignore = read(".gitignore");
assert.ok(
  gitignore.includes(`${VISUAL_CHECKS_DIR}/**/*.png`),
  `.gitignore must ignore ${VISUAL_CHECKS_DIR}/**/*.png; without it the purge lasts exactly one visual run.`
);
for (const kept of KEPT_VISUAL_ARTIFACTS) {
  assert.ok(
    gitignore.includes(`!${kept.path}/`),
    `.gitignore must re-include ${kept.path}/ — it is declared kept in the manifest but the ignore rule would hide it.`
  );
}

/* ------------------------------------------------------------------ *
 * 10. The strings that are evaluated in a browser must at least parse.
 *
 * A typo in either expression is otherwise discovered only by a browser run,
 * which is the slowest possible feedback loop for a syntax error.
 * ------------------------------------------------------------------ */

/*
 * MME-0116 added five more expression builders, and a backtick inside a comment
 * *inside* one of these template literals silently terminated the literal twice
 * during that issue — a class of error a browser run finds nine minutes later and
 * this finds instantly.
 */
for (const [name, expression] of [
  ["SAVE_TRUTH_PAIR_EXPRESSION", SAVE_TRUTH_PAIR_EXPRESSION],
  ["openDemoDisclosuresExpression", openDemoDisclosuresExpression(Object.values(DEMO_DISCLOSURES))],
  ["footnoteMembershipExpression", footnoteMembershipExpression()],
  ["richContentBlocksExpression", richContentBlocksExpression()],
  ["richTextExpression", richTextExpression(".ProseMirror h1")],
  ["richTextIndexExpression", richTextIndexExpression(".ProseMirror h1", "Root")],
  ["richTextListExpression", richTextListExpression(".rich-fold-hidden")]
]) {
  assert.doesNotThrow(
    // Parse only — never executed here, and it touches no DOM at parse time.
    () => new Function(`return ${expression};`),
    `${name} must be syntactically valid JavaScript.`
  );
}
