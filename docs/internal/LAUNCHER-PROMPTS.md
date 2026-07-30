# Launcher Prompts — One Conversation Per Block

Copy-paste one prompt per new conversation. Set the conversation model to the one named in the prompt before sending. Blocks are defined in `docs/internal/ISSUES.md` (Active Queue — Re-Plan 2026-07-30).

Rules that apply to every block:

- The agent implements only its own block, then stops.
- Block boundaries are HITL gates. Andrew reviews between blocks.
- Standing policy since 2026-07-30: commit each issue and push to `origin/main`.
- Reviewers are inspect-only subagents; no review model is imposed (see Reviewer policy in `docs/internal/ISSUES.md`).
- Default execution is sequential, one block at a time. The only pre-approved parallel arrangement is Block G on its own branch alongside Block A or C (see Parallel execution policy).

Progress tracking: tick a block here once its exit gate passed.

- [ ] Block A — adoption foundations
- [ ] Block B — npm publication + registry example
- [ ] Block C — editor UX correctness
- [ ] Block D — editor UX surfaces
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

After publication, update every install claim in README.md and docs/public/ to the truthful alpha commands, and update the truth gates (test:agent-discovery, test:agent-retrieval-content, test:publishability) in the same slice. Then build MME-0085, the Next.js App Router example consuming the published registry packages.

Follow the full per-issue protocol: context rebuild, Pre-Issue Execution Plan, test-first, review, build log, issue-scoped commit, push.

When MME-0085 is committed and pushed, or at the first blocker, write the final report and STOP. Never start an issue outside Block B.
```

Exit gate: Andrew installs the packages in a scratch project and it works.

---

## Block C — Editor UX correctness (model: Sonnet 5)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (Active Queue — Re-Plan 2026-07-30).

Execute ONLY Block C: MME-0086, MME-0087, MME-0088.

These fix real defects observed in the 2026-07-30 UX tour (full-editor blue focus outline, overlays that survive blur, code meta bar pinned at content top, static/misaligned block handles, no empty-block placeholder, slash triggering inside code blocks). The benchmark for feel is Notion and Obsidian.

Visual verification is mandatory for each issue: start the demo with `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`, run the manual scenario in a browser, capture screenshots at desktop and 390px widths under docs/internal/visual-checks/<issue-id>/, and record what each screenshot proves.

Follow the full per-issue protocol: context rebuild, Pre-Issue Execution Plan, test-first, review, build log, issue-scoped commit, push.

When MME-0088 is committed and pushed, or at the first blocker, write the final report and STOP. Never start an issue outside Block C.
```

Exit gate: screenshots produced for all three issues.

---

## Block D — Editor UX surfaces (model: Opus 4.8)

```text
Read CLAUDE.md, then docs/internal/ISSUES.md (Active Queue — Re-Plan 2026-07-30).

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
