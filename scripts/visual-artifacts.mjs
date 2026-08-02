/**
 * MME-0114 — clearing a gate's own output without destroying its evidence.
 *
 * Eight gate scripts opened with `rm(visualDir, { recursive: true })`. That is
 * fine while a gate passes and rewrites everything, and destructive the moment
 * it fails: the committed `README.md` that Gate 0.8 requires, and any
 * `result.json` a reviewer was meant to read, go with it. The first full-suite
 * run in MME-0114 deleted MME-0078's README and its 1216-line result.json this
 * way before failing on an unrelated assertion.
 *
 * A gate should remove only what it regenerates.
 */

import { readdir, rm, stat } from "node:fs/promises";

/** Files a visual gate is allowed to delete before regenerating them. */
const GENERATED_SUFFIXES = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
const GENERATED_NAMES = new Set(["measurements.json", "result.json", "results.json", "report.json"]);

/**
 * Delete the artifacts this gate produces, leaving documentation intact.
 *
 * `result.json` is treated as generated because the gates that write one always
 * rewrite it; `README.md` never is.
 *
 * @param {string} directory the gate's `docs/internal/visual-checks/<id>` path
 */
export async function clearGeneratedArtifacts(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      await clearGeneratedArtifacts(path);
      continue;
    }
    const isGenerated =
      GENERATED_NAMES.has(entry.name) || GENERATED_SUFFIXES.some((suffix) => entry.name.endsWith(suffix));
    if (isGenerated) {
      await rm(path, { force: true });
    }
  }
}

/**
 * Decide a gate's outcome from what actually happened.
 *
 * Extracted from the runner so the quarantine contract is provable without a
 * browser. The three rules the MME-0114 addendum requires all live here:
 *
 *  - a gate expected to pass that fails is `failed`, and only `failed` sets a
 *    non-zero exit;
 *  - a quarantined gate that fails is `known-failing` — reported and counted,
 *    never silent, never fatal, because a permanently red job is a job everyone
 *    learns to ignore;
 *  - a quarantined gate that *passes* is an `anomaly`, so a repair that landed
 *    without the manifest being updated gets noticed instead of rotting.
 *
 * @param {{quarantined: boolean, exitedZero: boolean, wroteFreshArtifact: boolean}} observed
 * @returns {"passed" | "failed" | "known-failing" | "anomaly"}
 */
export function classifyGateOutcome(observed) {
  const succeeded = observed.exitedZero && observed.wroteFreshArtifact;
  if (observed.quarantined) {
    return succeeded ? "anomaly" : "known-failing";
  }
  return succeeded ? "passed" : "failed";
}

/** Only an unexpected failure may fail the build. */
export function outcomeFailsBuild(status) {
  return status === "failed";
}

/**
 * Count the files a gate wrote during this run.
 *
 * The staleness rule the runner enforces: a gate that exits 0 without writing
 * anything is indistinguishable, from the outside, from a gate that never ran.
 * A directory full of last month's screenshots proves last month.
 *
 * @param {string} directory the gate's artifact directory
 * @param {number} sinceMs epoch ms the run started
 * @returns {Promise<{fresh: number, total: number}>}
 */
export async function countFreshArtifacts(directory, sinceMs) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => undefined);
  if (!entries) {
    return { fresh: 0, missing: true, total: 0 };
  }

  let fresh = 0;
  let total = 0;
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      const nested = await countFreshArtifacts(path, sinceMs);
      fresh += nested.fresh;
      total += nested.total;
      continue;
    }
    total += 1;
    const stats = await stat(path);
    // 1s of slack: some filesystems round mtime down to the whole second.
    if (stats.mtimeMs >= sinceMs - 1000) {
      fresh += 1;
    }
  }
  return { fresh, missing: false, total };
}
