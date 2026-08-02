# MME-0117 — Coarse-pointer touch targets

`npm run visual -- --only mme-0117`

| Artifact | What it proves |
| --- | --- |
| `touch-targets-390.png` | Every reachable control on a 390px touch viewport, after the MME-0100 regression was repaired. The command palette and AI buttons — measured at 30px and 34px before this issue — now meet the 44px floor. |
| `touch-targets-768.png` | The same floor at tablet width, where the topbar does not scroll and a different set of controls is visible. |
| `measurements.json` | The measured control count and the smallest control per viewport, plus the resolved `--mme-touch-target-size`. The gate fails if fewer than 10 controls are found, so it cannot pass by matching nothing. |

The gate measures rather than asserts: it reads every rendered control in the command surface, rich toolbar, properties panel and block affordances at both widths, in a browser that really reports `pointer: coarse`, and fails on any control below 44px in either dimension.

The structural half of the same contract — that a host stylesheet cannot silently undercut the packaged floor with an equal-specificity rule — runs on every push as `npm run test:touch-target-floor`.
