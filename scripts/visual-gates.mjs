/**
 * MME-0114 — the visual gate manifest.
 *
 * Before this file existed, the `visual:*` scripts were 76 loose files reachable
 * only through 73 hand-maintained `package.json` entries. Four scripts were not
 * registered at all, several defaulted to a port no dev server has listened on
 * since MME-0009, and nothing ran them as a set — which is how MME-0088 broke
 * five shipped gates without a single test turning red, and how two gates stayed
 * red for weeks with nobody aware.
 *
 * This module is the single source of truth: every gate, the server it needs,
 * the artifacts it must produce, and whether it is active or deliberately
 * retired. `scripts/visual-runner.mjs` executes it;
 * `tests/visual-gate-integrity.test.mjs` proves it stays in sync with the
 * filesystem and with `package.json` on every `npm test`.
 */

/**
 * A server a gate needs running. `env` is the variable each gate reads for its
 * URL, so the runner can pin every gate to the server it actually started
 * instead of trusting each script's hardcoded default.
 */
export const VISUAL_SERVERS = {
  demo: {
    args: ["run", "dev", "-w", "@momentarise/md-demo", "--", "--host", "127.0.0.1", "--port", "5174"],
    command: "npm",
    description: "The reference editor demo (apps/md-demo), Vite dev server.",
    env: "MME_DEMO_URL",
    readyPath: "/",
    url: "http://127.0.0.1:5174/"
  },
  docs: {
    args: ["run", "dev", "-w", "@momentarise/docs-site", "--", "--hostname", "127.0.0.1", "--port", "5178"],
    command: "npm",
    description: "The public docs site (apps/docs-site), Next dev server.",
    env: "MME_DOCS_URL",
    readyPath: "/",
    startupTimeoutMs: 180000,
    url: "http://127.0.0.1:5178/"
  },
  reactDemo: {
    args: ["run", "dev", "-w", "@momentarise/react-demo", "--", "--host", "127.0.0.1", "--port", "5175"],
    command: "npm",
    description:
      "The workspace-backed React host (apps/react-demo), Vite dev server. Exists so @momentarise/md-react has a rendering proof; examples/next-app stays a pure registry install.",
    env: "MME_REACT_DEMO_URL",
    readyPath: "/",
    url: "http://127.0.0.1:5175/"
  },
  registry: {
    args: ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", "5179"],
    command: "npm",
    cwd: "examples/next-app",
    description:
      "examples/next-app built against the published @momentarise/*@alpha packages. Needs a real registry install first (npm run test:example-next-registry).",
    env: "MME_NEXT_APP_URL",
    readyPath: "/",
    startupTimeoutMs: 180000,
    url: "http://127.0.0.1:5179/"
  },
  theia: {
    args: ["run", "start", "-w", "@momentarise/theia-demo"],
    command: "npm",
    description: "The Theia adapter shell (apps/theia-demo). Needs a Theia build, which is not part of npm ci.",
    env: "MME_THEIA_DEMO_URL",
    readyPath: "/",
    startupTimeoutMs: 240000,
    url: "http://127.0.0.1:5176/"
  }
};

/**
 * Groups the runner can select. `default` is what a laptop and CI both run:
 * everything that only needs `npm ci` plus a browser.
 */
export const DEFAULT_GROUPS = ["demo", "docs", "reactDemo"];

/** Groups that need a setup step beyond `npm ci`, so they are opt-in. */
export const OPT_IN_GROUPS = ["registry", "theia"];

/**
 * The quarantine — emptied by MME-0116 on 2026-08-12.
 *
 * MME-0114's first full-suite run found 40 failing gates. Repairing them was
 * split out as `MME-0116` (37 stale assertions) and `MME-0117` (a live
 * coarse-pointer regression), and each failure was listed here by name with why
 * it failed and who owned the repair, so a permanently red CI job could not
 * train everyone to ignore it.
 *
 * Every entry is now resolved. `MME-0117` and `MME-0119` shipped their product
 * fixes; `MME-0116` repaired the remaining 37, including `MME-0080`'s gate,
 * which had never passed since it was written. The list is deliberately kept as
 * an empty object rather than deleted: the mechanism around it is what stops the
 * next batch of red gates from going quiet, and
 * `tests/visual-gate-integrity.test.mjs` still enforces that nothing enters it
 * anonymously.
 *
 * Adding an entry is how you record a known problem. It is not how you silence a
 * red gate.
 */
export const KNOWN_FAILING = {};

const gate = (id, file, artifacts, group = "demo") => {
  const quarantined = KNOWN_FAILING[id];
  return {
    artifacts: `docs/internal/visual-checks/${artifacts}`,
    group,
    id,
    npmScript: `visual:${id}`,
    script: `scripts/visual-check-${file}.mjs`,
    /*
     * MME-0116: `since` used to fall back to a `QUARANTINED_ON` constant, which
     * was right while one batch entered together on one date. With the list
     * emptied, that constant would silently stamp 2026-08-02 on an entry made
     * years later — and it would pass the integrity test's date-format check,
     * defeating the rule that an entry outliving its owning issue must be
     * visible. Every entry now dates itself or fails.
     */
    ...(quarantined
      ? { owner: quarantined.owner, reason: quarantined.reason, since: quarantined.since, status: "known-failing" }
      : { status: "active" })
  };
};

const demoGate = (id, file, artifacts) => gate(id, file, artifacts);

export const VISUAL_GATES = [
  demoGate("mme-0002", "mme0002", "MME-0002"),
  demoGate("mme-0004", "mme0004", "MME-0004"),
  demoGate("mme-0005", "mme0005", "MME-0005"),
  demoGate("mme-0007", "mme0007", "MME-0007"),
  demoGate("mme-0008", "mme0008", "MME-0008"),
  demoGate("mme-0009", "mme0009", "MME-0009"),
  demoGate("mme-0011", "mme0011", "MME-0011"),
  demoGate("mme-0012", "mme0012", "MME-0012"),
  demoGate("mme-0013", "mme0013", "MME-0013"),
  demoGate("mme-0013.5", "mme00135", "MME-0013.5"),
  demoGate("mme-0014", "mme0014", "MME-0014"),
  demoGate("mme-0015", "mme0015", "MME-0015"),
  demoGate("mme-0017", "mme0017", "MME-0017"),
  demoGate("mme-0018", "mme0018", "MME-0018"),
  demoGate("mme-0019", "mme0019", "MME-0019"),
  demoGate("mme-0021", "mme0021", "MME-0021"),
  demoGate("mme-0022", "mme0022", "MME-0022"),
  demoGate("mme-0023", "mme0023-ai-surface", "MME-0023"),
  demoGate("mme-0025", "mme0025", "MME-0025"),
  demoGate("mme-0026", "mme0026", "MME-0026"),
  demoGate("mme-0027", "mme0027", "MME-0027"),
  demoGate("mme-0028", "mme0028", "MME-0028"),
  demoGate("mme-0028.5", "mme00285", "MME-0028.5"),
  demoGate("mme-0028.6", "mme00286", "MME-0028.6"),
  demoGate("mme-0029", "mme0029", "MME-0029"),
  demoGate("mme-0030", "mme0030", "MME-0030"),
  demoGate("mme-0032", "mme0032", "MME-0032"),
  demoGate("mme-0033", "mme0033", "MME-0033"),
  gate("mme-0034", "mme0034", "MME-0034", "theia"),
  demoGate("mme-0035", "mme0035", "MME-0035"),
  gate("mme-0038", "mme0038", "MME-0038", "docs"),
  demoGate("mme-0039", "mme0039", "MME-0039"),
  demoGate("mme-0040", "mme0040", "MME-0040"),
  demoGate("mme-0041", "mme0041", "MME-0041"),
  demoGate("mme-0042", "mme0042", "MME-0042"),
  demoGate("mme-0043", "mme0043", "MME-0043"),
  demoGate("mme-0044", "mme0044", "MME-0044"),
  demoGate("mme-0045", "mme0045", "MME-0045"),
  demoGate("mme-0046", "mme0046", "MME-0046"),
  demoGate("mme-0047", "mme0047", "MME-0047"),
  demoGate("mme-0053", "mme0053", "MME-0053"),
  demoGate("mme-0054", "mme0054", "MME-0054"),
  demoGate("mme-0055", "mme0055", "MME-0055"),
  demoGate("mme-0056", "mme0056", "MME-0056"),
  demoGate("mme-0057", "mme0057", "MME-0057"),
  demoGate("mme-0058", "mme0058", "MME-0058"),
  demoGate("mme-0059", "mme0059", "MME-0059"),
  demoGate("mme-0060", "mme0060", "MME-0060"),
  demoGate("mme-0061", "mme0061", "MME-0061"),
  demoGate("mme-0062", "mme0062", "MME-0062"),
  demoGate("mme-0063", "mme0063", "MME-0063"),
  demoGate("mme-0064", "mme0064", "MME-0064"),
  demoGate("mme-0065", "mme0065", "MME-0065"),
  demoGate("mme-0066", "mme0066", "MME-0066"),
  demoGate("mme-0067", "mme0067", "MME-0067"),
  demoGate("mme-0068", "mme0068", "MME-0068"),
  demoGate("mme-0069", "mme0069", "MME-0069"),
  demoGate("mme-0070", "mme0070", "MME-0070"),
  demoGate("mme-0071", "mme0071", "MME-0071"),
  demoGate("mme-0072", "mme0072", "MME-0072"),
  demoGate("mme-0073", "mme0073", "MME-0073"),
  demoGate("mme-0074", "mme0074", "MME-0074"),
  demoGate("mme-0075", "mme0075", "MME-0075"),
  demoGate("mme-0077", "mme0077", "MME-0077"),
  demoGate("mme-0078", "mme0078", "MME-0078"),
  demoGate("mme-0080", "mme0080", "MME-0080"),
  gate("mme-0085", "mme0085", "MME-0085", "registry"),
  demoGate("mme-0086", "mme0086", "MME-0086"),
  demoGate("mme-0087", "mme0087", "MME-0087"),
  demoGate("mme-0088", "mme0088", "MME-0088"),
  demoGate("mme-0089", "mme0089", "MME-0089"),
  demoGate("mme-0090", "mme0090", "MME-0090"),
  gate("mme-0125", "mme0125", "MME-0125", "reactDemo"),
  /*
   * MME-0100 was a before/after extraction proof. The "before" run is a
   * historical artifact that cannot be reproduced without reverting the
   * extraction; only the "after" label is reproducible, and it is the label the
   * script defaults to.
   */
  gate("mme-0100", "mme0100", "MME-0100/after"),
  gate("mme-0100-example", "mme0100-example", "MME-0100/example", "registry"),
  gate("mme-0101", "mme0101", "MME-0101", "registry"),
  demoGate("mme-0102", "mme0102", "MME-0102"),
  gate("mme-0102-registry", "mme0102-registry", "MME-0102/registry", "registry"),
  demoGate("mme-0103", "mme0103", "MME-0103"),
  demoGate("mme-0104a", "mme0104a", "MME-0104a"),
  demoGate("mme-0104b", "mme0104b", "MME-0104b"),
  demoGate("mme-0120", "mme0120", "MME-0120"),
  demoGate("mme-0121", "mme0121", "MME-0121"),
  demoGate("mme-0115", "mme0115", "MME-0115"),
  demoGate("mme-0123", "mme0123", "MME-0123"),
  demoGate("mme-0117", "mme0117", "MME-0117"),
  demoGate("mme-0119", "mme0119", "MME-0119")
];

/**
 * MME-0116 — the artifact policy, decided 2026-08-06.
 *
 * A screenshot under `docs/internal/visual-checks/` is gate *output*, not
 * evidence. Every `npm run visual` re-renders it, so committing screenshots made
 * two rules of this repository contradict each other: "run the visual suite
 * before your commit" and "commit only your own issue". MME-0123's run dirtied
 * 242 tracked PNGs, not one of them caused by its change, and the reflex that
 * teaches — `git checkout -- docs/internal/visual-checks/` — is the same reflex
 * that hides a real rendering regression.
 *
 * So the images are gitignored and uploaded by CI, while each gate's
 * `result.json` and `README.md` — the deterministic, reviewable proof a human
 * can diff — stay committed.
 *
 * A screenshot may be kept only when it is load-bearing evidence *and* nothing
 * in the suite reproduces it. Both entries below are that: no gate in
 * `VISUAL_GATES` writes into either directory, so purging them would delete the
 * only copy rather than remove drift. `tests/visual-gate-integrity.test.mjs`
 * rejects every other committed PNG, and rejects an entry here that no longer
 * matches a tracked file, so the exception list cannot quietly become the rule.
 */
export const KEPT_VISUAL_ARTIFACTS = [
  {
    issue: "MME-0011.5",
    path: "docs/internal/visual-checks/MME-0011.5",
    reason:
      "MME-0011.5 has no gate script and no package.json entry: its artifacts came from `visual:mme-0011` under an MME_VISUAL_DIR override the manifest does not run. `tests/alignment-gate.test.mjs` requires the build-log entry that cites `unsupported-local-file-state.png` as the alignment gate's evidence, and the issue is still `code-complete/pending human review`."
  },
  {
    issue: "MME-0100",
    path: "docs/internal/visual-checks/MME-0100/before",
    reason:
      "The pre-extraction rendering in MME-0100's before/after proof. It cannot be reproduced without reverting the extraction, which is why only the `after` label is in the manifest; deleting it destroys one half of a comparison rather than a regenerable render."
  }
];

export function gateById(id) {
  return VISUAL_GATES.find((gate) => gate.id === id);
}

export function gatesForGroups(groups) {
  return VISUAL_GATES.filter((gate) => groups.includes(gate.group));
}
