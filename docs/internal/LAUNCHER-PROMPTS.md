# Launcher Prompts — One Conversation Per Block

Copy-paste one prompt per new conversation. Set the conversation model to the one named in the prompt before sending. Blocks are defined in `docs/internal/ISSUES.md` (Active Queue — Re-Plan 2026-07-30).

Rules that apply to every block:

- The agent implements only its own block, then stops.
- Block boundaries are HITL gates. Andrew reviews between blocks.
- Standing policy since 2026-07-30: commit each issue and push to `origin/main`.
- Reviewers are inspect-only subagents; no review model is imposed (see Reviewer policy in `docs/internal/ISSUES.md`).
- Default execution is sequential, one block at a time. The only pre-approved parallel arrangement is Block G on its own branch alongside Block A or C (see Parallel execution policy).

Progress tracking: tick a block here once its exit gate passed.

- [x] Block A — adoption foundations (2026-07-30: CI green on GitHub for `main` — https://github.com/Nadrew-pgr/Momentarise-Markdown-Editor/actions/runs/30577501210 — and tarball smoke install green, both exit-gate conditions met)
- [ ] Block B — npm publication + registry example
- [x] Block B2 — package parity (2026-07-31: reviewed and accepted — packaged stylesheet token-clean, demo 0-pixel diff, example styled, rich round-trip proven; alpha.2 republish deferred to Block B3's close)
- [x] Block B3 — design foundation (2026-07-31: accepted; all 16 packages republished at 0.1.0-alpha.3)
- [x] Block C — interaction correctness part 1 (2026-08-01: MME-0086/0087/0088 shipped; MME-0103 attempted and correctly reverted for Markdown corruption)
- [x] Block C1 — block selection, attempt 2 (2026-08-01: accepted; the literal `"\n\n"` was a pre-existing serializer fallback, now byte-derived)
- [ ] Block C2 — visual gates, input rules, composition (MME-0114, 0104, 0115)
- [ ] Block D — interaction surfaces (MME-0089, 0090, 0091, 0105, 0106)
- [ ] Block D2 — Markdown-native differentiators (MME-0107, 0108)
- [ ] Block D3 — full-surface UX audit (MME-0109)
- [ ] Block E — AI writing surface
- [ ] Block F — host contracts
- [ ] Block G — docs site tier
- [ ] Block H — landing + blog/SEO
- [ ] Block I — Payload CMS baseline

---

## Block A — Adoption foundations (model: Sonnet 5)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (Active Queue — Re-Plan 2026-07-30).

Execute ONLY Block A, autonomously, in this order:
1. Finish the uncommitted MME-0080 closeout already in the worktree (re-run its proofs, record fallback review, update the build log, issue-scoped commit, push).
2. MME-0081 — React StrictMode-safe session lifecycle.
3. MME-0082 — GitHub Actions CI pipeline.
4. MME-0083 — Package publish readiness and tarball smoke install.

Follow the full per-issue protocol each time: fresh context rebuild, Pre-Issue Execution Plan, test-first (RED before GREEN), reviewer subagent or documented fallback review, build-log entry, issue-scoped commit, push.

Do NOT publish anything to npm — that is Block B.

When MME-0083 is committed and pushed, or at the first blocker, write the final report and STOP. Never start an issue outside Block A.
```

Exit gate: CI green on GitHub for `main`; tarball smoke install green.

---

## Block B — npm publication + registry example (model: Sonnet 5, Andrew present)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (Active Queue — Re-Plan 2026-07-30).

Execute ONLY Block B: MME-0084 then MME-0085.

Human prerequisites are already satisfied (confirm before publishing, do not ask me to redo them): npm account `andrew_pougary` logged in on this machine, 2FA enabled, npm organization `momentarise` created. Publish under the `@momentarise/*` scope as 0.1.0-alpha.1 with dist-tag `alpha` and `--access public`. Never print, log, or commit credentials or tokens.

Stop and ask me if any publish step fails for a reason that needs an account decision (scope taken, permissions, 2FA prompt).

Before the first publish, apply the two Block A review follow-ups now written into MME-0084's acceptance criteria: bound the md-react react peer range to `^18 || ^19` instead of `>=18`, and document the ESM-only boundary in the compatibility promise and install docs. Both are baked into published tarballs, so they cannot wait.

After publication, update every install claim in README.md and docs/public/ to the truthful alpha commands, and update the truth gates (test:agent-discovery, test:agent-retrieval-content, test:publishability) in the same slice. Then build MME-0085, the Next.js App Router example consuming the published registry packages.

MME-0085 carries the third Block A review follow-up: MME-0081's StrictMode fix was only ever proven against React 18.3.1, and React 19 changes StrictMode ref behavior in a way that touches that exact code path. Prove it on React 19 in the example (StrictMode on, real browser check that the editor still edits and reports state), and add a React 19 leg to the lifecycle test so CI catches regressions.

Follow the full per-issue protocol: context rebuild, Pre-Issue Execution Plan, test-first, review, build log, issue-scoped commit, push.

When MME-0085 is committed and pushed, or at the first blocker, write the final report and STOP. Never start an issue outside Block B.
```

Exit gate: Andrew installs the packages in a scratch project and it works.

---

## Block B2 — Package parity (model: Opus 4.8)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (Active Queue — Re-Plan 2026-07-30).

Execute ONLY Block B2: MME-0100 then MME-0101.

Context, from the Block B review: the packages are now published and installable, but a consumer who installs them gets an unstyled editor with an inert Rich button. All 2757 lines of MME's visual design live in apps/md-demo/src/styles.css, which ships nowhere; the only packaged CSS is 156 lines of custom properties that style nothing on their own. And packages/md-react never mounts the rich view at all. Compare docs/internal/visual-checks/MME-0085/01-mounted-after-strictmode-remount.png (what adopters get) with the reference demo (what MME actually looks like) before you start.

MME-0100 is a move and tokenization, not a redesign: the demo must look identical afterward, and the registry example must look like the demo. Prove both with before/after screenshots at 1280 and 390 widths. Fix examples/next-app/app/globals.css, which references custom properties that do not exist in the theme, so its var() calls all fall back silently.

MME-0101 must leave no inert control: if a mode is offered by the binding's default mode control, it mounts a real surface, otherwise it is not offered. Keep the binding thin, dynamically import the rich view, keep StrictMode (React 18 and 19) and SSR safety intact, and correct the react.md/next.md capability wording to match what actually ships.

Follow the full per-issue protocol: context rebuild, Pre-Issue Execution Plan, test-first, review, build log, issue-scoped commit, push.

When MME-0101 is committed and pushed, or at the first blocker, write the final report and STOP. Never start an issue outside Block B2.
```

Exit gate: Andrew sees the registry example look and behave like the demo.

---

## Block B3 — Design foundation (model: Opus 5 or Fable 5)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (Active Queue — Re-Plan 2026-07-30).

Execute ONLY Block B3: MME-0102 — Design foundation: premium by default.

The issue contains a normative numeric spec (type scale, spacing ladder, radius/elevation/motion scales, color ramp architecture, accent scarcity, contrast floors). Those numbers ARE the design decisions, approved by Andrew — implement them exactly; any deviation needs a recorded reason. Direction: Notion's content warmth (16px document text, real heading scale, generous breathing room) combined with Vercel/Linear's chrome precision (28px controls, hairlines, quiet elevation). Final brand hues are explicitly deferred: build the ramp architecture, seed it from current colors.

The MME-0100 "byte-identical demo" constraint is lifted for this issue: appearance is SUPPOSED to change everywhere — demo, example, and packaged stylesheet together. Behavior and preservation suites must stay green. Keep the 44px coarse-pointer contract and the styling ownership rule (all of it lands in the packaged stylesheet, not the demo).

Work section by section (content typography → chrome → menus/overlays → motion), re-screenshotting after each. Produce the side-by-side benchmark comparisons the issue requires (vs Notion, Linear/Vercel, BlockNote) at 1280/768/390 in both schemes.

After MME-0102 is committed and pushed, one more step inside this block, with me present: republish the changed packages. Bump every @momentarise/* package to 0.1.0-alpha.2 (keeping internal ranges consistent, same ordering as MME-0084), publish with --tag alpha --access public, verify a clean registry-only install renders the styled editor with working rich mode, update install docs if versions are quoted anywhere, and record the registry state in the build log. Ask me to be at the keyboard for the 2FA prompts before you start publishing.

Follow the full per-issue protocol: context rebuild, Pre-Issue Execution Plan, test-first, review, build log, issue-scoped commit, push.

When the republish is verified and recorded, or at the first blocker, write the final report and STOP. Never start an issue outside Block B3.
```

Exit gate: Andrew approves the look; registry-only install shows the premium editor.

---

## Block C — Interaction correctness (model: Opus 4.8)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (Active Queue — Re-Plan 2026-07-30), then docs/internal/research/editor-ux-benchmark.md in full before writing any code. That report defines twelve interaction contracts observed in BlockNote, Notion, Obsidian and Typora; it is the rationale behind every issue in this block and its gap table maps each reported symptom to its issue.

Execute ONLY Block C: MME-0086, MME-0087, MME-0088, MME-0103, MME-0104, in that order.

This block is where MME stops feeling like a code editor with Markdown bolted on. Andrew's verdict on the current state was blunt and correct: interactions are not natural and must-haves are missing. Two of these issues (0103 block selection, 0104 input rules and pairing) are behaviour MME never had at all.

Standing rules for this block:
- The behavioral parity checklist is part of each issue's exit gate: a table of every interaction touched, each marked `same as benchmark` / `better` / `intentionally different (reason)`, verified in a real browser, not on paper.
- BlockNote (TypeCellOS/BlockNote, MIT core) is the standing implementation reference. Read its side-menu, formatting-toolbar and suggestion-menu sources when useful. Imitate behaviour; never copy code or styling.
- Styling ownership rule: any CSS for a package-owned surface goes in the packaged stylesheet from MME-0100, never in the demo's private stylesheet. Work only visible to someone running this repo's demo is not finished work.
- Reviewer subagents are mandatory per the updated AGENT.md reviewer protocol. Self-review is not a reviewer pass; if subagents appear disabled, stop and ask Andrew to enable them rather than falling back.
- A passing gate is not evidence until you have seen it fail. Block B3's reviewers found three gates reporting green while checking nothing — including one silently disabled by the space in this repository's directory name. Confirm every new test actually fails before you make it pass.

Visual verification is mandatory per issue: demo at `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`, real browser scenario, screenshots at 1280 and 390 under docs/internal/visual-checks/<issue-id>/, and a note on what each screenshot proves.

Follow the full per-issue protocol: context rebuild, Pre-Issue Execution Plan, test-first (RED before GREEN), reviewer, build log, issue-scoped commit, push.

When MME-0104 is committed and pushed, or at the first blocker, write the final report and STOP. Never start an issue outside Block C.
```

Exit gate: parity checklists green for contracts 2, 3, 5 and 8; Andrew uses the editor and agrees it behaves.

---

## Block C1 — Block selection, attempt 2 (model: Opus 5 or Fable 5)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (MME-0103, whose acceptance criteria were hardened after attempt 1), then docs/internal/research/editor-ux-benchmark.md contract 3, then the build-log entry recording why attempt 1 was reverted.

Execute ONLY MME-0103. Nothing else.

Attempt 1 was reverted from main, correctly, for silent Markdown corruption: deleting or duplicating a block rewrote the gap between surviving neighbours as a literal "\n\n", so a CRLF document lost its line endings and multi-blank gaps collapsed. Tables were worse — prosemirror-tables converts a table NodeSelection into a CellSelection, so Esc then Backspace wiped every cell instead of deleting the block. The architecture was judged sound; the implementation approach was not.

The redesign is the point: use targeted transactions over the owned block range, never a full-document replace. Separator bytes between surviving blocks must be preserved exactly as authored — assert with assert.equal on full output against CRLF fixtures, multi-blank-line gaps, and frontmatter documents. Framed blocks (table, code, callout, opaque, raw HTML, media) must each be selectable and deletable as whole objects; the table case needs an explicit answer to the CellSelection conversion.

Mutation-test every assertion per the AGENT.md rule: break the implementation, watch the assertion fail, record which reversion produces which failure, restore. Attempt 1 shipped a framed-block matrix whose table case silently re-tested a code fence, which is exactly how the table corruption escaped.

Reviewer subagents are mandatory. If a reviewer hits a session limit, wait and retry rather than falling back.

Follow the full per-issue protocol. When MME-0103 is committed and pushed, or at the first blocker, write the final report and STOP.
```

Exit gate: no corruption on any fixture; parity checklist for contract 3 green.

---

## Block C2 — Input rules and visual gate integrity (model: Opus 4.8)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (MME-0104, MME-0114), then docs/internal/research/editor-ux-benchmark.md contract 5.

Execute ONLY Block C2: MME-0114 first, then MME-0104, then MME-0115.

MME-0115 closes a defect MME-0103 found and deliberately left visible: composition input (macOS dead keys, IME) over a block selection lands inside the anchor block instead of replacing it. It fires on ordinary French typing, so it is a correctness bug rather than an edge case, and its evidence must be a real browser proof — composition cannot be faithfully simulated headlessly.

MME-0114 comes first deliberately. Block C discovered that visual:* scripts are not part of npm test, so a slash-rule change broke five previously shipped visual gates invisibly, and two gates (MME-0013 slash keyboard navigation, MME-0027 AI prompt) were already red before that block began. One broken gate was asserting the very defect MME-0088 removed. Fix the harness before adding behaviour that depends on it.

MME-0104 then implements the full Notion input-rule table plus smart pairing, reusing the richTextInputContext / matchRichSlashTrigger contracts MME-0088 introduced precisely so both features share one answer to "is this a safe context". The subtlety that matters: one Cmd/Ctrl+Z immediately after a conversion restores the literal typed text, not the whole paragraph.

Mutation-test every assertion per the AGENT.md rule. Reviewer subagents mandatory. Styling ownership rule applies: packaged stylesheet, never the demo.

Follow the full per-issue protocol. When MME-0104 is committed and pushed, or at the first blocker, write the final report and STOP.
```

Exit gate: visual runner green and meaningful; parity checklist for contract 5 green.

---

## Block D — Interaction surfaces (model: Opus 4.8)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (Active Queue — Re-Plan 2026-07-30), then docs/internal/research/editor-ux-benchmark.md in full.

Execute ONLY Block D: MME-0089, MME-0090, MME-0091, MME-0105, MME-0106, in that order.

Three decisions in this block are benchmark-driven and non-negotiable: the persistent formatting toolbar goes OFF by default (Notion and BlockNote have none — formatting lives in the selection bubble and slash menu); rich becomes the default mode with a single compact toggle plus Cmd/Ctrl+E instead of a three-button row; and no inert control ships anywhere, which means Live Preview is not offered until MME-0107 folds syntax reveal into the rich surface.

Same standing rules as Block C: parity checklist per issue, BlockNote as implementation reference (behaviour only), packaged stylesheet ownership, mandatory reviewer subagents, and no gate trusted until seen failing.

Follow the full per-issue protocol. Visual verification at 1280 / 768 / 390 in both schemes, artifacts under docs/internal/visual-checks/<issue-id>/.

When MME-0106 is committed and pushed, or at the first blocker, write the final report and STOP. Never start an issue outside Block D.
```

Exit gate: Andrew's visual review of Blocks C and D together.

---

## Block D (superseded prompt, kept for reference)

```text
Execute ONLY Block D: MME-0089, MME-0090, MME-0091.

This block is judged on product feel, not just passing tests. Benchmarks: Notion for the selection bubble and block interactions, Obsidian for the frontmatter Properties panel, Vercel/Linear-grade restraint for the top chrome. Preservation rules stay absolute: MME-0090 must splice YAML values positionally and leave complex values read-only rather than rewriting them.

Visual verification is mandatory: demo at 127.0.0.1:5174, screenshots at 1280 / 768 / 390 widths under docs/internal/visual-checks/<issue-id>/, plus a short README in each folder saying what each screenshot proves.

Follow the full per-issue protocol: context rebuild, Pre-Issue Execution Plan, test-first, review, build log, issue-scoped commit, push.

When MME-0091 is committed and pushed, or at the first blocker, write the final report and STOP. Never start an issue outside Block D. Andrew reviews the Block C + Block D screenshots before anything else proceeds.
```

Exit gate: Andrew's visual review of Block C + D screenshots.

---

## Block E — AI writing surface (model: Opus 5 or Fable 5)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (Active Queue — Re-Plan 2026-07-30).

Execute ONLY Block E: MME-0098 — AI writing surface at BlockNote/Notion tier.

Before designing, study the benchmark: BlockNote's xl-ai package (github.com/TypeCellOS/BlockNote, packages/xl-ai) for entry points, the inline AI menu, streaming into the document, and accept/reject/retry controls. Copy interaction patterns, not code. MME differs by staging suggestions as bounded Markdown edits: streaming goes into a preview decoration, and only Accept serializes.

Non-negotiable: Document Access Policy gates every request, BYOK keys stay memory-only and are never logged, refusal states are honest, and the mock provider powers all automated tests.

Visual verification is mandatory: full prompt → stream → accept → undo → reject flow at desktop and 390px, artifacts under docs/internal/visual-checks/MME-0098/.

Follow the full per-issue protocol: context rebuild, Pre-Issue Execution Plan, test-first, review, build log, issue-scoped commit, push.

When MME-0098 is committed and pushed, or at the first blocker, write the final report and STOP. Never start an issue outside Block E.
```

Exit gate: Andrew tries the AI flow in the demo.

---

## Block F — Host contracts (model: Opus 5 or Fable 5)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (Active Queue — Re-Plan 2026-07-30).

Execute ONLY Block F: MME-0092 then MME-0093.

These are public API contracts, so design carefully: the diff/patch model must be block/source-range based (not line diffs), rebasable later for collaboration, and must never touch bytes outside the patch's ownership. The revision contract must keep the existing external-integrator vocabulary stable (DocumentSnapshot, DocumentHash, SaveState with dirty/saving/saved/conflict/error, PolicyCapability).

Include the property-style test required by MME-0092: for random block edits across the fixture corpus, applyPatch(a, diffDocuments(a, b)) must reproduce b byte-exactly.

Public API checkpoints and the compatibility promise must be updated deliberately, with the reasoning recorded.

Follow the full per-issue protocol: context rebuild, Pre-Issue Execution Plan, test-first, review, build log, issue-scoped commit, push.

Present the proposed public API shape in your final report for my sign-off. When MME-0093 is committed and pushed, or at the first blocker, write the final report and STOP. Never start an issue outside Block F.
```

Exit gate: Andrew signs off on the API shape.

---

## Block G — Docs site tier (model: Opus 4.8)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (Active Queue — Re-Plan 2026-07-30).

Execute ONLY Block G: MME-0094 then MME-0095.

The acceptance bar is visual and structural parity with vercel.com/docs and blocknotejs.org: three-column layout, sticky top bar, grouped collapsible sidebar, ~72ch content column, right-hand On-this-page TOC with scroll-spy, refined typography, bordered code blocks with copy buttons, first-class light/dark, mobile drawer. Content IA follows the BlockNote journey (Getting Started / Foundations / Features / Reference) with MME-original, truthful prose — never copied text.

Hard constraints: every existing docs gate stays green, no dead URLs (redirect old paths), raw .md routes and llms/agent endpoints keep working, generated artifacts stay generated, static export still succeeds, no external CDN or font requests if the CSP forbids them.

Capture side-by-side screenshots of MME versus the benchmark for the docs landing, one concept page, and one reference page, in both themes, under docs/internal/visual-checks/<issue-id>/.

Follow the full per-issue protocol: context rebuild, Pre-Issue Execution Plan, test-first, review, build log, issue-scoped commit, push.

When MME-0095 is committed and pushed, or at the first blocker, write the final report and STOP. Never start an issue outside Block G.
```

Exit gate: Andrew's screenshot review against the benchmarks.

---

## Block H — Landing + blog/SEO (model: Opus 4.8)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (Active Queue — Re-Plan 2026-07-30).

Execute ONLY Block H: MME-0096 then MME-0097.

The canonical domain is momentarise.dev (owned). Landing page must include a working MME editor above or immediately below the hero, honest experimental 0.x status, and a truth-gated install command. Blog posts are authored as Markdown in docs/public/blog/ and rendered by the same pipeline, with Article JSON-LD, OG/Twitter cards, canonical URLs, sitemap inclusion, and an RSS feed.

Write the two launch posts from repository truth only, definition-first (direct answer in the first paragraph, stable headings, concrete examples, no unshipped claims): why Markdown must stay the source of truth, and how MME preserves bytes.

Run a local Lighthouse-equivalent audit and record the scores; performance >= 90, SEO >= 95, accessibility >= 95 on the landing route, mobile and desktop.

Follow the full per-issue protocol: context rebuild, Pre-Issue Execution Plan, test-first, review, build log, issue-scoped commit, push.

Do not deploy publicly. Present the copy for my approval in your final report. When MME-0097 is committed and pushed, or at the first blocker, write the final report and STOP. Never start an issue outside Block H.
```

Exit gate: Andrew approves the copy before any public deploy.

---

## Block I — Payload CMS baseline (model: Opus 4.8)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (Active Queue — Re-Plan 2026-07-30).

Execute ONLY Block I: MME-0099 — Payload CMS integration baseline.

Build the Payload custom field that embeds the MME editor in Payload's admin UI with canonical Markdown as the field value, plus a minimal local example app (Payload + Next.js + SQLite, one posts collection). It must consume the published @momentarise/*@alpha registry packages, not workspace links.

Save truthfulness is the delicate part: Payload owns persistence and draft/publish; MME must never claim saved beyond what Payload confirms; conflicts surface Payload's version. Preservation must hold byte-exact through the field round trip, including frontmatter and unknown syntax.

Visual verification is mandatory: edit, draft-save, and publish inside Payload admin, screenshots under docs/internal/visual-checks/MME-0099/.

Follow the full per-issue protocol: context rebuild, Pre-Issue Execution Plan, test-first, review, build log, issue-scoped commit, push.

When MME-0099 is committed and pushed, or at the first blocker, write the final report and STOP. Never start an issue outside Block I.
```

Exit gate: Andrew edits a post through MME inside Payload admin.
