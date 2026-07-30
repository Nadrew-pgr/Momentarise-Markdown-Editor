# Momentarise Vision — North Star

Status: human-directed vision record (Andrew, 2026-07-30). Pending Andrew's validation.

This document defines durable product direction above V0. `PRD.md` remains the V0 execution contract. This file explains where V0 is heading and why, so issue selection can be judged against product value, not only against internal completeness.

## One line

MME aims to become the reference Markdown-native editor framework: BlockNote-class editing UX and DX, Obsidian-class document ownership, Vercel-class documentation, and first-class agent experience — while real `.md` files stay the durable source.

## Audiences, in adoption order

1. **Framework adopters (developers).** Drop MME into vanilla, React, Next.js, mobile shells, IDE shells, or headless servers with installable packages, world-class docs, and a lifecycle that survives React StrictMode and modern framework versions.
2. **AI agents.** Integrate, drive, and embed MME programmatically. Agent experience (discovery, machine-readable contracts, CLI, policy-gated writing) is a first-class product surface, not marketing.
3. **Non-developers (largest long-term audience).** Use finished Momentarise applications — standalone desktop, mobile, and tablet apps comparable to Obsidian — built on this framework. These apps are outside V0 but are the north star that justifies the framework's strictness.

## Product layers

1. **Core framework** — open source, host-independent packages (current repository).
2. **Bindings and adapters** — React today; Vue/Svelte, IDE shells, desktop/mobile shells later.
3. **Reference applications** — an Obsidian-class standalone/mobile app for non-developers; also the best real-world test bench for the framework. Future work.
4. **Monetized services** — hosted document converter, sync, managed AI, and similar paid surfaces layered above the open core. Future work; requires dedicated issues and human decisions per existing rules.

## Quality bar and benchmarks

- Editing UX: BlockNote, Notion, Obsidian Live Preview.
- Docs: Vercel and BlockNote documentation sites.
- Ownership/preservation: Obsidian, and stricter (byte-exact round trips).
- Copying or strongly adapting best-in-class implementations (including patterns from Obsidian plugins) is explicitly allowed where licenses permit. MME differentiates on Markdown-source truth and host independence, not on novelty for its own sake.
- Every user-facing surface should be benchmarked against the named references before public launch, not only against internal acceptance criteria.

## Host adoption requirements

Recorded from real external integrator feedback (CallInt agent evaluation, 2026-07-30). A serious host application needs, beyond editing quality:

- installable packages: published npm artifacts, built `dist/` in the published tarball, correct `prepare`/`prepack`, exports validated by consumer smoke tests;
- a pushed remote: the local machine must never be the only copy of the repository;
- a public diff/patch API over documents (the bounded-serialization machinery exists internally and should gain a public contract);
- a usable revision/version contract: `DocumentRevision` must become a real interface with a minimal host-ownable store, not only a brand type;
- collaboration-readiness: CRDT stays future work, but invariants must keep the door open and the public positioning must say so;
- React 19 / Next.js StrictMode-safe lifecycle in `@momentarise/md-react`.

External integrators already mirror MME vocabulary (`DocumentSnapshot`, `DocumentHash`, `SaveState` dirty/saving/saved/conflict/error, `PolicyCapability`). Keeping this vocabulary stable makes later adoption a mechanical swap for them; treat it as a de facto public contract.

## Modes of use

Every surface must support host-controlled editability — read-only, suggest-only, full edit — switchable by the host developer, the end user, or agent policy, per document.

## What this vision does not change

- V0 non-goals in `PRD.md` still apply until dedicated issues and human decisions say otherwise.
- Preservation gates, save truthfulness, and no-false-done discipline are non-negotiable at every layer, including future apps and paid services.
- `docs/internal/BACKLOG.md` remains the parking lot; this file only sets direction and priority pressure.

## Priority pressure on issue selection

When choosing the next must-have, weigh product value in this order:

1. consumability and distribution (someone other than this laptop can use MME);
2. correctness of the primary integration paths (React/Next first);
3. host-adoption APIs (diff/patch, revisions);
4. breadth of credible editing UX against benchmarks;
5. depth of exhaustive edge-case coverage.

Deep edge-case slices remain valuable, but they must not indefinitely outrank the first three tiers.
