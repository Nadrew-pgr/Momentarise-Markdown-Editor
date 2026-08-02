/**
 * MME-0114 — one command that runs the visual gates and can fail the build.
 *
 *   npm run visual              # every gate that only needs `npm ci` + a browser
 *   npm run visual -- --only mme-0013,mme-0027
 *   npm run visual -- --groups demo,docs,registry
 *   npm run visual -- --list
 *
 * Three properties are the point of this file, and each one exists because its
 * absence already cost this repository a shipped defect:
 *
 *  1. **The suite is a set, not 76 loose scripts.** MME-0088 changed one slash
 *     rule and broke five previously green gates. Nothing turned red, because
 *     nothing ran them together.
 *  2. **A gate that produces nothing fails.** A script that exits 0 while
 *     writing no artifacts is indistinguishable, from the outside, from a
 *     script that was never run. The runner stamps a start time and rejects any
 *     gate whose artifact directory has no file written after it.
 *  3. **A gate is never silently absent.** Every gate in the manifest appears in
 *     the report with an explicit outcome — `passed`, `failed`, `known-failing`,
 *     `anomaly`, or `not-selected` naming the group that was not requested.
 *     There is no "quietly skipped".
 *
 * The quarantine (MME-0114 addendum). 38 gates are red for reasons owned by
 * `MME-0116` and `MME-0117`, each named in `KNOWN_FAILING` with a reason. The
 * build fails only on a gate expected to pass, because a permanently red job is
 * a job everyone learns to ignore — but quarantined gates still run, and one
 * that starts *passing* is reported as an `anomaly` so a landed repair gets
 * noticed instead of rotting in the list.
 *
 * The runner also pins each gate's URL to the server it actually started, so a
 * gate whose hardcoded default points at a port nothing has served since
 * MME-0009 still runs against the live demo.
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyGateOutcome, countFreshArtifacts, outcomeFailsBuild } from "./visual-artifacts.mjs";
import { DEFAULT_GROUPS, OPT_IN_GROUPS, VISUAL_GATES, VISUAL_SERVERS } from "./visual-gates.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = join(repoRoot, "docs/internal/visual-checks/visual-gate-report.json");

/*
 * Sequential by default, deliberately. These gates drive a real Chrome with
 * fixed waits and their own snapshot timeouts; running two at once on one
 * machine turned a 35s gate into a 240s timeout during MME-0114's first run.
 * A suite that is trusted has to be deterministic before it is fast, so
 * concurrency is opt-in (`--concurrency 3`) rather than the default.
 */
const DEFAULT_GATE_TIMEOUT_MS = 300000;

function parseArgs(argv) {
  const options = {
    concurrency: 1,
    groups: [...DEFAULT_GROUPS],
    list: false,
    only: undefined,
    timeoutMs: DEFAULT_GATE_TIMEOUT_MS
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const valueOf = (name) => {
      if (arg.startsWith(`${name}=`)) {
        return arg.slice(name.length + 1);
      }
      index += 1;
      return argv[index];
    };

    if (arg === "--list") {
      options.list = true;
    } else if (arg === "--only" || arg.startsWith("--only=")) {
      options.only = valueOf("--only")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    } else if (arg === "--groups" || arg.startsWith("--groups=")) {
      options.groups = valueOf("--groups")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    } else if (arg === "--all") {
      options.groups = [...DEFAULT_GROUPS, ...OPT_IN_GROUPS];
    } else if (arg === "--concurrency" || arg.startsWith("--concurrency=")) {
      options.concurrency = Math.max(1, Number(valueOf("--concurrency")) || 1);
    } else if (arg === "--timeout" || arg.startsWith("--timeout=")) {
      options.timeoutMs = Math.max(1000, Number(valueOf("--timeout")) || DEFAULT_GATE_TIMEOUT_MS);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

async function waitForServer(url, timeoutMs, isDead) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response yet";
  while (Date.now() < deadline) {
    const dead = isDead();
    if (dead) {
      throw new Error(`server exited before becoming reachable (${dead})`);
    }
    try {
      const response = await fetch(url, { redirect: "manual" });
      // Any HTTP answer proves the port is served; Next dev may answer 3xx first.
      if (response.status > 0) {
        return;
      }
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`timed out waiting for ${url} (${lastError})`);
}

async function startServer(name) {
  const definition = VISUAL_SERVERS[name];
  if (!definition) {
    throw new Error(`Unknown visual server: ${name}`);
  }

  const child = spawn(definition.command, definition.args, {
    cwd: definition.cwd ? join(repoRoot, definition.cwd) : repoRoot,
    env: { ...process.env, BROWSER: "none", FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let log = "";
  let exited;
  child.stdout.on("data", (chunk) => {
    log += chunk;
  });
  child.stderr.on("data", (chunk) => {
    log += chunk;
  });
  child.on("exit", (code, signal) => {
    exited = `code ${code}, signal ${signal}`;
  });

  const readyUrl = new URL(definition.readyPath ?? "/", definition.url).toString();
  try {
    await waitForServer(readyUrl, definition.startupTimeoutMs ?? 90000, () => exited);
  } catch (error) {
    child.kill("SIGKILL");
    throw new Error(`${name}: ${error.message}\n${log.slice(-4000)}`);
  }

  return {
    definition,
    name,
    async stop() {
      if (exited) {
        return;
      }
      child.kill("SIGTERM");
      await Promise.race([
        new Promise((done) => child.once("exit", done)),
        new Promise((done) => setTimeout(done, 5000))
      ]);
      if (!exited) {
        child.kill("SIGKILL");
      }
    }
  };
}

/**
 * The staleness rule. A gate is trusted only if it wrote something after the run
 * began — an artifact directory full of last month's screenshots proves the gate
 * ran last month, not now.
 */
async function freshArtifacts(gate, startedAtMs) {
  const directory = join(repoRoot, gate.artifacts);
  const counted = await countFreshArtifacts(directory, startedAtMs);

  if (counted.missing) {
    return { fresh: 0, reason: `artifact directory ${gate.artifacts} does not exist` };
  }
  if (counted.fresh === 0) {
    return {
      fresh: 0,
      reason: `exited 0 but wrote no artifact into ${gate.artifacts} (${counted.total} stale file(s) present)`
    };
  }
  return { fresh: counted.fresh, reason: undefined };
}

async function runGate(gate, servers, options) {
  const startedAtMs = Date.now();
  const server = servers.get(gate.group);
  const env = { ...process.env };
  if (server) {
    env[server.definition.env] = server.definition.url;
  }

  const child = spawn(process.execPath, [join(repoRoot, gate.script)], {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });

  const timer = setTimeout(() => child.kill("SIGKILL"), options.timeoutMs);
  const exit = await new Promise((done) => {
    child.on("error", (error) => done({ code: null, error: error.message, signal: null }));
    child.on("exit", (code, signal) => done({ code, signal }));
  });
  clearTimeout(timer);

  const durationMs = Date.now() - startedAtMs;
  const tail = output.trim().split("\n").slice(-25).join("\n");
  const quarantined = gate.status === "known-failing";
  const base = {
    durationMs,
    id: gate.id,
    ...(quarantined ? { owner: gate.owner, quarantineReason: gate.reason } : {}),
    script: gate.script
  };

  const exitedZero = exit.code === 0;
  const artifacts = exitedZero ? await freshArtifacts(gate, startedAtMs) : { fresh: 0, reason: undefined };

  /*
   * One classifier, shared with `tests/visual-gate-integrity.test.mjs`, so the
   * quarantine rules that test proves are the rules this runner actually
   * applies — rather than a second implementation that could drift.
   */
  const status = classifyGateOutcome({
    exitedZero,
    quarantined,
    wroteFreshArtifact: exitedZero && !artifacts.reason
  });

  const reason = () => {
    if (status === "anomaly") {
      return `expected to fail (owned by ${gate.owner}) but passed — remove it from KNOWN_FAILING`;
    }
    if (status === "passed") {
      return undefined;
    }
    if (!exitedZero) {
      return exit.signal === "SIGKILL"
        ? `killed after ${options.timeoutMs}ms timeout`
        : `exited ${exit.code}${exit.signal ? ` (signal ${exit.signal})` : ""}`;
    }
    return artifacts.reason;
  };

  return {
    ...base,
    artifactsWritten: artifacts.fresh,
    exitCode: exit.code,
    output: tail,
    ...(reason() ? { reason: reason() } : {}),
    status
  };
}

async function runPool(gates, servers, options) {
  const queue = [...gates];
  const results = [];
  const workers = Array.from({ length: Math.min(options.concurrency, queue.length) }, async () => {
    for (;;) {
      const gate = queue.shift();
      if (!gate) {
        return;
      }
      const result = await runGate(gate, servers, options);
      results.push(result);
      const mark = { anomaly: "ANOM", failed: "FAIL", "known-failing": "KNWN", passed: "PASS" }[result.status];
      console.log(
        `${mark}  ${result.id.padEnd(18)} ${String(Math.round(result.durationMs / 1000)).padStart(4)}s${
          result.reason ? `  — ${result.reason}` : ""
        }`
      );
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.list) {
    for (const gate of VISUAL_GATES) {
      console.log(`${gate.id.padEnd(20)} ${gate.group.padEnd(10)} ${gate.status.padEnd(8)} ${gate.script}`);
    }
    return;
  }

  const selected = VISUAL_GATES.filter((gate) => {
    // `known-failing` gates still run: that is the only way an anomaly (a gate
    // that has quietly been repaired) can ever be noticed. Only `retired` gates
    // are excluded, and they are named in the report.
    if (gate.status === "retired") {
      return false;
    }
    if (options.only) {
      return options.only.includes(gate.id);
    }
    return options.groups.includes(gate.group);
  });

  if (selected.length === 0) {
    throw new Error(`No gates selected (groups: ${options.groups.join(", ")}, only: ${options.only ?? "-"}).`);
  }

  const neededGroups = [...new Set(selected.map((gate) => gate.group))];
  const servers = new Map();
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();

  try {
    for (const group of neededGroups) {
      console.log(`starting server for group "${group}" (${VISUAL_SERVERS[group].url})`);
      servers.set(group, await startServer(group));
    }

    console.log(`running ${selected.length} visual gate(s), concurrency ${options.concurrency}\n`);
    const results = await runPool(selected, servers, options);

    const notSelected = VISUAL_GATES.filter((gate) => !selected.includes(gate)).map((gate) => ({
      id: gate.id,
      reason:
        gate.status === "retired"
          ? `retired: ${gate.reason ?? "no reason recorded"}`
          : options.only
            ? "not in the --only selection"
            : `group "${gate.group}" not selected`,
      script: gate.script,
      status: gate.status === "retired" ? "retired" : "not-selected"
    }));

    results.sort((left, right) => left.id.localeCompare(right.id));
    const of = (status) => results.filter((result) => result.status === status);
    const failed = results.filter((result) => outcomeFailsBuild(result.status));
    const anomalies = of("anomaly");
    const knownFailing = of("known-failing");

    const report = {
      durationMs: Date.now() - startedAtMs,
      groups: options.groups,
      notSelected,
      results,
      startedAt,
      summary: {
        anomaly: anomalies.length,
        failed: failed.length,
        knownFailing: knownFailing.length,
        notSelected: notSelected.length,
        passed: of("passed").length,
        total: results.length
      }
    };

    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(
      `\n${report.summary.passed}/${report.summary.total} gate(s) passed; ${knownFailing.length} known-failing (quarantined); ` +
        `${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"}; ${failed.length} unexpected failure(s); ` +
        `${notSelected.length} not selected.\nReport: docs/internal/visual-checks/visual-gate-report.json`
    );

    if (anomalies.length > 0) {
      /*
       * Loud, but not fatal. An anomaly means the quarantine list is out of date
       * in the good direction — a repair landed and nobody removed the entry.
       */
      console.warn(`\n${anomalies.length} quarantined gate(s) PASSED and should leave KNOWN_FAILING:`);
      for (const result of anomalies) {
        console.warn(`  ${result.id} — owned by ${result.owner}: ${result.quarantineReason}`);
        // A green job's log is a log nobody opens; an annotation is visible on the run itself.
        console.warn(`::warning title=Visual gate ${result.id} no longer fails::Remove it from KNOWN_FAILING (owned by ${result.owner}).`);
      }
    }

    if (knownFailing.length > 0) {
      console.log(`\n${knownFailing.length} gate(s) failed as recorded in the quarantine:`);
      for (const result of knownFailing) {
        console.log(`  ${result.id} — ${result.owner}: ${result.quarantineReason}`);
      }
    }

    if (failed.length > 0) {
      console.error(`\n${failed.length} visual gate(s) failed unexpectedly:`);
      for (const result of failed) {
        console.error(`\n--- ${result.id} (${result.script}) — ${result.reason}`);
        console.error(result.output);
      }
      process.exitCode = 1;
    }
  } finally {
    for (const server of servers.values()) {
      await server.stop();
    }
  }
}

await main();
