# Visual Checks

UI screenshots and visual verification artifacts are stored here by issue ID.

Each UI issue should create a folder such as `docs/internal/visual-checks/MME-0002/` and include either:

- a short `README.md` explaining what each artifact proves; or
- equivalent links and explanations in `docs/internal/build-log.md`.

Do not mark an issue visually verified if the browser or screenshot tooling was unavailable.

Visual scripts resolve Chrome/Chromium through the shared `scripts/chrome-helpers.mjs` helper. Set `CHROME_BIN` when Chrome is installed in a non-standard location.

## The artifact policy (MME-0116, decided 2026-08-06)

**Screenshots are gate output. They are not committed.**

A PNG here is re-rendered by every `npm run visual`. Committing them put two of this repository's own rules in direct conflict — *run the visual suite before your commit* and *commit only your issue* — because a full run rewrites every image in the tree. MME-0123's run dirtied 242 tracked PNGs, not one of them caused by its change. The habit that resolves the conflict, `git checkout -- docs/internal/visual-checks/`, is the same habit that would throw away a real rendering regression.

So:

| Artifact | Committed? | Why |
| --- | --- | --- |
| `*.png` | **No** — gitignored, uploaded by CI as `visual-gate-screenshots` | Re-rendered every run; a diff of one is noise, not signal |
| `result.json`, `measurements.json` | Yes | Deterministic and reviewable — a human can read what changed |
| `README.md` | Yes | Says what the gate proves and how to reproduce it |
| `visual-gate-report.json` | No — gitignored, uploaded as `visual-gate-report` | Describes one run |

To see the images for a run, download the `visual-gate-screenshots` artifact from that CI run, or reproduce them locally:

```bash
npm run visual -- --only mme-0055
```

Build-log entries written before 2026-08-06 cite screenshot paths under this directory. Those paths still name the artifact the gate produces — they are now reproduced by the command above rather than read out of the tree.

### Keeping a screenshot by exception

A screenshot may stay committed only when it is load-bearing evidence for an issue record **and** nothing in the suite reproduces it. Declare it in `KEPT_VISUAL_ARTIFACTS` in `scripts/visual-gates.mjs` with a reason and an owning issue, and add the matching `!` negation to `.gitignore`. Two entries qualify today:

- `MME-0011.5/` — no gate script and no `package.json` entry; the artifacts came from `visual:mme-0011` under an `MME_VISUAL_DIR` override the manifest does not run, and `tests/alignment-gate.test.mjs` requires the build-log entry that cites one of them.
- `MME-0100/before/` — the pre-extraction half of a before/after proof, unreproducible without reverting the extraction.

`npm run test:visual-gate-integrity` rejects any other committed PNG, rejects an entry whose reason or owning issue is missing, and rejects an entry that no longer matches a tracked file — so the exception list cannot quietly become the rule.

## Running the gates (MME-0114)

One command runs the whole suite. It starts the dev servers the gates need, runs them, tears the servers down, writes `visual-gate-report.json` here (gitignored — it describes one run), and exits non-zero if a gate expected to pass fails:

```bash
npm run visual
```

Useful variants:

```bash
npm run visual -- --list                       # every gate, its group and status
npm run visual -- --only mme-0013,mme-0027     # one or more gates by id
npm run visual -- --groups demo,docs,registry  # pick server groups
npm run visual -- --all                        # include the opt-in groups
npm run visual -- --concurrency 3              # faster, less deterministic
```

Gates are declared in `scripts/visual-gates.mjs`, which is the single source of truth: a script that is not in the manifest is a script nothing runs. `npm test` enforces that contract deterministically through `npm run test:visual-gate-integrity` — manifest completeness, one `package.json` entry per gate, every gate capable of exiting non-zero, no gate deleting the documentation in its own artifact folder, and no gate declaring a group whose server it never reads.

Groups:

| Group | Server | Needs | Runs in |
| --- | --- | --- | --- |
| `demo` | `apps/md-demo` on `127.0.0.1:5174` | `npm ci` | every push (`visual-gates` job) |
| `docs` | `apps/docs-site` on `127.0.0.1:5178` | `npm ci` | every push (`visual-gates` job) |
| `registry` | `examples/next-app` on `127.0.0.1:5179` | a real npm-registry install | weekly (`example-next-app` job) |
| `theia` | `apps/theia-demo` on `127.0.0.1:5176` | a Theia build | on request only |

Gates outside the selected groups are reported as `not-selected` with the reason, never skipped silently.

Two rules the runner enforces that individual scripts cannot:

- **Fresh artifacts.** A gate that exits 0 without writing anything into its artifact directory during this run is failed. Last month's screenshots are not evidence about today. (Known limit, owned by `MME-0116`: this proves recency, not meaning — a gate reduced to writing one hardcoded `result.json` would still pass.)
- **Pinned URLs.** Each gate runs against the server the runner actually started, not the port hardcoded in the script — several gates still default to a port nothing has served since MME-0009.

## The quarantine

MME-0114's first full run found 38 red gates. Repairing them is `MME-0116` (stale assertions) and `MME-0117` (a live coarse-pointer regression), so each one is listed in `KNOWN_FAILING` in `scripts/visual-gates.mjs` with a one-line reason, an owning issue, and the date it entered.

The rules, all asserted by `npm run test:visual-gate-integrity`:

- The build fails **only** when a gate expected to pass fails. A permanently red job is a job everyone learns to ignore.
- Quarantined gates still run and are reported and counted as `known-failing` — never skipped.
- A quarantined gate that **passes** is reported as an `anomaly`, with a GitHub warning annotation so it is visible on a green run. That is what stops the list becoming a graveyard.
- Nothing enters quarantine anonymously: an entry without a reason, an approved owning issue and a date fails `npm test`, and the `KNOWN_FAILING` keys must match the gates marked `known-failing` exactly.
- Retiring a gate is not the cheaper escape hatch: it additionally requires `obsoletedBy` naming the issue that made it obsolete.

Adding an entry is how you record a known problem, not how you silence a red gate.
