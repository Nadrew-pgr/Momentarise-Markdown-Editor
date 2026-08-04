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
export const DEFAULT_GROUPS = ["demo", "docs"];

/** Groups that need a setup step beyond `npm ci`, so they are opt-in. */
export const OPT_IN_GROUPS = ["registry", "theia"];

/**
 * The quarantine, added by the MME-0114 addendum (2026-08-02).
 *
 * The first full-suite run found 40 failing gates, not the 7 the issue assumed.
 * Repairing them is `MME-0116` and `MME-0117`; leaving CI permanently red until
 * then would train everyone to ignore it, which would waste the harness.
 *
 * So each failure is quarantined *by name*, with why it fails and who owns the
 * repair. The runner fails the build only on a gate expected to pass, and
 * reports a `known-failing` gate that starts passing as an anomaly — that
 * anomaly report is what stops this list becoming a graveyard.
 *
 * Adding an entry here is a deliberate act, not a way to make a red gate quiet:
 * `tests/visual-gate-integrity.test.mjs` rejects any entry without a reason and
 * an owning issue, and the build log carries the full classified inventory.
 */
/** When every current entry was quarantined, so age is visible rather than implicit. */
export const QUARANTINED_ON = "2026-08-02";

export const KNOWN_FAILING = {
  // Class A — reads a diagnostic through `.innerText` inside the collapsed
  // "Technical diagnostics" disclosure, so it asserts against "".
  "mme-0002": { owner: "MME-0116", reason: "Class A: reads `event-log` via innerText inside the collapsed debug-inspector." },
  "mme-0004": {
    owner: "MME-0116",
    reason:
      "Class A plus a stale assertion underneath: reads `roundtrip-status` inside the collapsed debug-inspector, and still demands the `pre-parser identity` diagnostic that MME-0005 deleted."
  },
  "mme-0007": { owner: "MME-0116", reason: "Class A: reads `roundtrip-diagnostics` via innerText inside the collapsed debug-inspector." },

  /*
   * MME-0114 repaired the save-truthfulness half of these two: both now assert
   * the `persistence-target` / `save-state` pair on every poll (and pass), and
   * both now open the diagnostics disclosure so they read real text instead of
   * "". What remains is unrelated staleness, which MME-0116 owns. MME-0011, the
   * third save-truthfulness gate, is fully green and not quarantined.
   */
  "mme-0008": {
    owner: "MME-0116",
    reason:
      "Save-truthfulness pair repaired and passing; residual staleness only — it still expects the event log to contain `autosave` after a memory-only autosave, which the demo no longer logs."
  },
  "mme-0009": {
    owner: "MME-0116",
    reason:
      "Save-truthfulness pair repaired and passing; residual staleness only — it still expects `blocked` as the last save action for an imported copy, but the demo now generates the download (`download/export generated; original target unchanged`)."
  },

  // Class B — asserts behaviour a later, named issue intentionally changed.
  "mme-0012": { owner: "MME-0116", reason: "MME-0020 relabelled the imported-copy primary action `Export` to `Export copy`." },
  "mme-0013": { owner: "MME-0116", reason: "MME-0027 namespaced built-in command ids (`heading1` became `mme:heading1`)." },
  "mme-0013.5": {
    owner: "MME-0116",
    reason: "MME-0029 renders a contenteditable=false affordance widget inside every top-level block, so a heading's textContent is now `+::Reco`."
  },
  "mme-0014": { owner: "MME-0116", reason: "MME-0029 affordance widget prefixes every heading's textContent, so hover-by-heading-text no longer matches." },
  "mme-0015": { owner: "MME-0116", reason: "MME-0044 gave HTML artifacts Source/Preview only; the rich button is absent rather than rendered-disabled." },
  "mme-0017": {
    owner: "MME-0116",
    reason: "MME-0028.6 renamed the exposed BYOK field `keyInputValue` to `keyInputHasValue` so the raw key never enters page state; the old predicate is unsatisfiable."
  },
  "mme-0018": { owner: "MME-0116", reason: "MME-0029 disabled the legacy selection AI control and MME-0028.5 rerouted AI actions to the inline prompt." },
  "mme-0019": { owner: "MME-0116", reason: "MME-0055 shipped native rich tables, so a well-formed GFM table is no longer a preserved fallback." },
  "mme-0023": { owner: "MME-0116", reason: "MME-0028.5 rerouted AI actions to the inline prompt; the assistant panel stays hidden." },
  "mme-0025": { owner: "MME-0116", reason: "MME-0102 rebuilt the tokens as a ramp: light `--mme-color-bg` is `#fbfcff`, not the hard-coded `#ffffff`." },
  "mme-0027": { owner: "MME-0116", reason: "MME-0028.5 fills the inline prompt input; the legacy `ai-prompt-input` is only written at submit time." },
  "mme-0040": { owner: "MME-0116", reason: "MME-0055 superseded the preserved-table fallback for well-formed tables." },
  "mme-0041": { owner: "MME-0116", reason: "MME-0056 shipped native footnotes, so only the malformed definition still falls back." },
  "mme-0042": { owner: "MME-0116", reason: "MME-0055 superseded the preserved-table fallback this gate anchors on." },
  "mme-0045": { owner: "MME-0116", reason: "MME-0078 made the narrow topbar a horizontal scroller; controls are scrolled out, not clipped, and the gate never scrolls them in." },
  "mme-0055": { owner: "MME-0116", reason: "MME-0080 added edge-whitespace encoding, so typing `Tab ` correctly serialises as `Tab&#32;`." },

  /*
   * The footnote family, one shared cause: each of MME-0062 through MME-0071
   * shipped semantic support for one more construct, converting preserved
   * fallbacks into semantic nodes in every *earlier* fixture too, while only the
   * issue's own gate was written. Every gate hard-codes document-wide totals
   * frozen at its authoring date. No preservation regression: byte identity
   * holds and all 16 `tests/rich-footnote-*.test.mjs` suites pass.
   */
  "mme-0056": { owner: "MME-0116", reason: "Frozen fallback count: MME-0059/0060/0071 made three of fixture 022's preserved definitions semantic." },
  "mme-0059": { owner: "MME-0116", reason: "Frozen fallback count: MME-0060/0071 made two of fixture 023's preserved definitions semantic." },
  "mme-0060": { owner: "MME-0116", reason: "Frozen fallback count: MME-0061/0071 made two of fixture 024's preserved definitions semantic." },
  "mme-0061": { owner: "MME-0116", reason: "Frozen fallback count: MME-0062/0063/0064/0065/0071 made five of fixture 025's preserved definitions semantic." },
  "mme-0062": { owner: "MME-0116", reason: "Frozen fallback count: MME-0063/0064/0065/0071 made four of fixture 026's preserved definitions semantic." },
  "mme-0063": { owner: "MME-0116", reason: "Frozen todo-button and fallback totals: later loose-list, quote and inline-HTML support added semantic task lists to fixture 027." },
  "mme-0064": { owner: "MME-0116", reason: "Frozen definition and fallback totals: MME-0065 through MME-0071 made fixture 028's remaining definitions semantic." },
  "mme-0065": { owner: "MME-0116", reason: "Frozen definition, role and fallback totals: MME-0071 made fixture 029's unsafe-style definition semantic." },
  "mme-0066": { owner: "MME-0116", reason: "Frozen definition, role and fallback totals: MME-0067 through MME-0071 absorbed fixture 030's code definitions." },
  "mme-0067": { owner: "MME-0116", reason: "Frozen definition, role, code-block and fallback totals: MME-0068 through MME-0071 absorbed fixture 031's definitions." },
  "mme-0068": { owner: "MME-0116", reason: "Frozen definition, role and fallback totals: MME-0069 through MME-0071 absorbed fixture 032's definitions." },
  "mme-0069": { owner: "MME-0116", reason: "Frozen callout count: MME-0071 made fixture 033's `[^unsafe-body]` callout semantic, so there are four callouts, not three." },
  "mme-0070": { owner: "MME-0116", reason: "Frozen definition and fallback totals: MME-0071 made fixture 034's inline-html and paragraph-html definitions semantic." },

  // Class D — the gate's own machinery is wrong.
  "mme-0029": {
    owner: "MME-0116",
    reason: "Reads `opacity` in the same tick as the state change; `.rich-block-affordance` transitions over `--mme-motion-fast` (100ms). The passing MME-0087 gate settles first."
  },
  "mme-0071": {
    owner: "MME-0116",
    reason: "Over-broad payload probe: the blanket `[style]` term matches MME-0087's affordance widgets, which set inline top/left on every atom block."
  },
  "mme-0080": {
    owner: "MME-0116",
    reason:
      "Has never passed. It scrolls `.ProseMirror`, which has no overflow — the real scroll box is `.rich-editor-host` — and its `tableScrollable` check (`scrollWidth >= clientWidth`) is true of every element."
  }
};

const gate = (id, file, artifacts, group = "demo") => {
  const quarantined = KNOWN_FAILING[id];
  return {
    artifacts: `docs/internal/visual-checks/${artifacts}`,
    group,
    id,
    npmScript: `visual:${id}`,
    script: `scripts/visual-check-${file}.mjs`,
    ...(quarantined
      ? { owner: quarantined.owner, reason: quarantined.reason, since: quarantined.since ?? QUARANTINED_ON, status: "known-failing" }
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
  demoGate("mme-0117", "mme0117", "MME-0117"),
  demoGate("mme-0119", "mme0119", "MME-0119")
];

export function gateById(id) {
  return VISUAL_GATES.find((gate) => gate.id === id);
}

export function gatesForGroups(groups) {
  return VISUAL_GATES.filter((gate) => groups.includes(gate.group));
}
