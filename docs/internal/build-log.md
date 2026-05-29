# Build Log

## MME-0000 — Repository bootstrap and documentation acceptance

- Timestamp: 2026-05-29T07:41:41Z
- Summary: Read the restart documentation, verified the documentation-only bootstrap state, and created the mandatory build log.
- Files changed:
  - `docs/internal/build-log.md`
- Tests run:
  - `ls README.md AGENT.md docs/internal/PRD.md docs/internal/QUALITY_GATES.md docs/internal/ISSUES.md docs/public/GLOSSARY.md docs/internal/build-log.md`
  - `rg --files`
  - `find . -maxdepth 3 -type f`
- Manual verification:
  - Confirmed the restart folder contains the six required documents and the build log only.
- Reviewer/subagent used and result:
  - Architecture Reviewer subagent: initial fail because this build-log entry still said reviewer status was pending. Finding addressed; re-check passed with no remaining findings.
- Deviations from PRD:
  - None.
- Open questions:
  - None.
- Suggested commit message:
  - `chore: accept restart docs bootstrap`

## MME-0000 follow-up — Test-first documentation rule

- Timestamp: 2026-05-29T08:25:49Z
- Summary: Added explicit Test-First/TDD build rules before MME-0001, plus strict fixture and save truthfulness definitions.
- Files changed:
  - `AGENT.md`
  - `docs/internal/QUALITY_GATES.md`
  - `docs/internal/build-log.md`
- Tests run:
  - `sed -n '50,160p' AGENT.md`
  - `sed -n '1,180p' docs/internal/QUALITY_GATES.md`
  - `rg -n "Test-Driven|test-first|Fixture definition|Save truthfulness|Documentation-only|Document Access Policy tests|conflict detection tests" AGENT.md docs/internal/QUALITY_GATES.md`
  - `find . -maxdepth 3 -type f`
  - `rg --files`
- Manual verification:
  - Confirmed the restart folder remains documentation-only after removing an unwanted `.DS_Store`.
- Reviewer/subagent used and result:
  - Architecture/Test Reviewer subagent: initial fail on missing `QUALITY_GATES.md` bootstrap exception, missing policy/conflict test bullets, and `.DS_Store`. Findings addressed; re-check passed with no remaining findings.
- Deviations from PRD:
  - None. This tightens the existing testing and preservation requirements.
- Open questions:
  - None.
- Suggested commit message:
  - `docs: require test-first workflow`

## MME-0000 follow-up — Repository documentation layout

- Timestamp: 2026-05-29T08:32:20Z
- Summary: Moved restart docs into a clean root/public/internal documentation layout and made the publishing boundary explicit.
- Files changed:
  - `README.md`
  - `AGENT.md`
  - `docs/README.md`
  - `docs/public/GLOSSARY.md`
  - `docs/internal/PRD.md`
  - `docs/internal/QUALITY_GATES.md`
  - `docs/internal/ISSUES.md`
  - `docs/internal/build-log.md`
- Tests run:
  - `rg -n "docs/build-log.md|docs/internal/build-log.md|docs/public|docs/internal" README.md AGENT.md docs/README.md docs/internal/QUALITY_GATES.md docs/internal/ISSUES.md docs/internal/build-log.md`
  - `find . -path ./.git -prune -o -path ./.learnings -prune -o -type f -print`
  - `rg --files -g '*.ts' -g '*.tsx' -g '*.js' -g '*.jsx' -g '*.mjs' -g '*.cjs' -g 'package.json' -g 'tsconfig*.json' -g '!node_modules'`
  - `git check-ignore --no-index -v .learnings/ERRORS.md .DS_Store`
- Manual verification:
  - Confirmed root keeps `README.md` and `AGENT.md`, publishable docs live in `docs/public/`, internal docs live in `docs/internal/`, and no source/package/config files are present.
- Reviewer/subagent used and result:
  - Architecture/DX Reviewer subagent: initial fail because the old Git history still tracked `.learnings/` and this entry still had pending fields. Findings addressed by restarting Git history and updating this entry; re-check passed with no remaining findings.
- Deviations from PRD:
  - None. This organizes documentation without adding framework code.
- Open questions:
  - Whether `docs/internal/` should be published later remains an explicit product/documentation decision.
- Suggested commit message:
  - `docs: organize public and internal docs`

## MME-0000 follow-up — Git repository restart

- Timestamp: 2026-05-29T08:36:02Z
- Summary: Removed the old local Git history, initialized a fresh `main` branch, and configured the GitHub remote requested by the user.
- Files changed:
  - `.gitignore`
  - `.git` local metadata, not tracked
- Tests run:
  - `git status --short`
  - `git ls-files`
  - `git remote -v`
  - `git check-ignore --no-index -v .learnings/ERRORS.md .DS_Store`
- Manual verification:
  - Confirmed the new repository has no tracked files yet, `.learnings/` and `.DS_Store` are ignored, and `origin` points to `https://github.com/Nadrew-pgr/Momentarise-Markdown-Editor.git`.
- Reviewer/subagent used and result:
  - Architecture/DX Reviewer subagent: passed with no remaining findings. Verified fresh `main`, empty tracked file set before initial commit, ignored `.learnings/` and `.DS_Store`, docs-only visible files, no source/package/config files, and configured GitHub origin.
- Deviations from PRD:
  - None. This is repository housekeeping before MME-0001.
- Open questions:
  - None.
- Suggested commit message:
  - `chore: restart repository from docs`

## MME-0001 — Repo skeleton and core contracts

- Timestamp: 2026-05-29T08:50:52Z
- Summary: Added a TypeScript workspace skeleton with host-independent core contracts and minimal package entrypoints for format, web adapter, and CLI contracts.
- Files changed:
  - `package.json`
  - `package-lock.json`
  - `tsconfig.base.json`
  - `tsconfig.json`
  - `tsconfig.tests.json`
  - `packages/md-core/package.json`
  - `packages/md-core/tsconfig.json`
  - `packages/md-core/src/index.ts`
  - `packages/md-format/package.json`
  - `packages/md-format/tsconfig.json`
  - `packages/md-format/src/index.ts`
  - `packages/md-adapter-web/package.json`
  - `packages/md-adapter-web/tsconfig.json`
  - `packages/md-adapter-web/src/index.ts`
  - `packages/md-cli/package.json`
  - `packages/md-cli/tsconfig.json`
  - `packages/md-cli/src/index.ts`
  - `tests/type-contracts.test.ts`
  - `tests/no-host-imports.mjs`
  - `docs/internal/build-log.md`
- Tests run:
  - Test-first red: `npm run test:contracts` failed before package implementation with `TS2307` missing modules for `@momentarise/md-core`, `@momentarise/md-format`, `@momentarise/md-adapter-web`, and `@momentarise/md-cli`.
  - Test-first red: `npm run test:architecture` failed before package implementation with `Missing core public entrypoint: packages/md-core/src/index.ts`.
  - `npm i`
  - `npm run test:contracts`
  - `npm run test:architecture`
  - `npm run build`
  - `npm test`
  - `git diff --check`
  - `rg -n "from ['\"](react|@theia/|vscode|@codemirror/|codemirror|prosemirror|electron)|import ['\"](react|@theia/|vscode|@codemirror/|codemirror|prosemirror|electron)" packages/md-core/src package.json packages/*/package.json`
- Manual verification:
  - Confirmed `md-core` exports `OpaqueNode`, `DocumentSnapshot`, `PolicyCapability`, source ranges, hashes, snapshots, editor/save/policy/sidecar contract types, and has no host/editor imports.
  - Confirmed `md-format`, `md-adapter-web`, and `md-cli` expose contract-only entrypoints and do not implement parser, serializer, UI, CodeMirror, Theia, or AI behavior.
  - Confirmed generated `dist/`, `node_modules/`, and `.learnings/` are ignored.
- Reviewer/subagent used and result:
  - Architecture Reviewer subagent: initial fail because this build-log entry was missing, test-first proof was not recorded, and the architecture check did not cover browser/mobile globals. Findings addressed by adding this entry and expanding `tests/no-host-imports.mjs`; re-check passed with no remaining findings.
- Deviations from PRD:
  - None. Parser, serializer, UI, CodeMirror, Theia, and AI remain out of scope.
- Open questions:
  - None.
- Suggested commit message:
  - `feat: add repo skeleton and core contracts`

## MME-0001 follow-up — UI process gates before MME-0002

- Timestamp: 2026-05-29T09:27:08Z
- Summary: Added mandatory UI visual verification, canonical build-log path wording, stronger source editor baseline requirements, no-false-done rules, and MME-0002 screenshot/human-review acceptance criteria before starting the first UI slice.
- Files changed:
  - `AGENT.md`
  - `docs/internal/QUALITY_GATES.md`
  - `docs/internal/ISSUES.md`
  - `docs/internal/visual-checks/README.md`
  - `docs/internal/build-log.md`
- Tests run:
  - `rg -n "docs/build-log\\.md|docs/internal/build-log\\.md|Visual Verification|UI visual verification|Source editor baseline|visual-checks|No false done|Minimal, not toy|MME-0002" AGENT.md docs/internal/QUALITY_GATES.md docs/internal/ISSUES.md docs/internal/visual-checks/README.md docs/internal/build-log.md`
  - `find . -name 'init.md' -o -name 'INIT.md'`
  - `git diff --check`
- Manual verification:
  - Confirmed no `init.md` exists in the restarted repository.
  - Confirmed `AGENT.md`, `QUALITY_GATES.md`, and `ISSUES.md` identify `docs/internal/build-log.md` as the canonical build-log path.
  - Confirmed MME-0002 now requires dev server command, local URL, browser/host preview, manual UI scenario, screenshots in `docs/internal/visual-checks/MME-0002/`, reviewer UI inspection, and human review request.
- Reviewer/subagent used and result:
  - Process/UX Reviewer subagent: passed with no blocking findings. Confirmed canonical build-log path, UI visual verification gate, MME-0002 source editing baseline, no-false-done/no-toy rules, first UI human-review pause, and follow-up build-log entry.
- Deviations from PRD:
  - None. This tightens process gates before visible UI work starts.
- Open questions:
  - None.
- Suggested commit message:
  - `docs: require visual verification for UI slices`
