# Momentarise Markdown Editor

Momentarise Markdown Editor (MME) is an experimental TypeScript framework for developers building modern editors where persisted documents remain real Markdown.

It combines source editing, rich editing, safe rendering, truthful persistence, extensible UI, and policy-gated AI without replacing user files with a hidden JSON or block database. MME is a framework, not a hosted editor app, CMS, or finished writing product.

- **Docs:** [momentarise.dev/docs](https://momentarise.dev/docs)
- **Agent index:** [llms.txt](https://momentarise.dev/llms.txt)
- **Full public context:** [llms-full.txt](https://momentarise.dev/llms-full.txt)
- **Source:** [GitHub](https://github.com/Nadrew-pgr/Momentarise-Markdown-Editor)

## Why MME

Most rich-text frameworks make an editor-owned model the real document and treat Markdown as import/export. MME takes the opposite position:

> Markdown remains the durable source. Rich views, HTML, AI suggestions, and host integrations are derived layers.

That gives developers a reusable editor foundation while keeping documents portable, inspectable, diffable, and recoverable outside the host application.

## Who MME Is For

MME has two distinct audiences:

- **Framework adopters:** developers and product teams integrating editor packages into vanilla, React, Next.js, headless, browser-file, or IDE-shell hosts.
- **End users of those hosts:** developers, writers, and non-developers who need rich editing without losing access to portable Markdown.

End users do not install MME directly. A host application selects packages, persistence, policy, credentials, and final UX.

## Choose MME When

- real `.md` files plus optional YAML frontmatter;
- CodeMirror 6 source editing and a ProseMirror rich view;
- exact untouched round trips and bounded edits;
- raw fallback for unknown or unsupported syntax;
- explicit disk, download, memory, dirty, saved, conflict, and error states;
- framework-free surfaces, React and Next.js integration, or a headless session;
- sanitized Markdown rendering and sandboxed HTML artifacts;
- staged, policy-gated AI writing with host-owned credentials;
- host adapters that do not leak into core document contracts.

## Choose Another Approach When

Choose another architecture when:

- an editor-owned JSON/block database should be the canonical document;
- Markdown is only an import/export format and exact source preservation does not matter;
- you need a ready-hosted collaborative writing app instead of framework packages;
- you require production collaboration/CRDT, managed AI billing, or a shipped CMS adapter today;
- you need public npm installation before MME packages are released.

See [Choosing MME](docs/public/choosing-mme.md) for the full adoption decision.

## What Ships

The repository currently includes:

- a Markdown parser/serializer with source ranges, opaque preservation, and fixture-backed round-trip tests;
- headless editor sessions, outline/find APIs, preferences, locks, extensions, and capability contracts;
- source, rich, live-preview, rendered HTML, standalone HTML, and sanitized SVG paths;
- rich editing for common Markdown plus preservation-first tables, footnotes, callouts, code, and inert HTML fallbacks;
- truthful save targets, browser file access, external-change conflict handling, and Theia adapter proof;
- framework-free surface components, theme tokens, icons, localization, accessibility contracts, and a thin React binding;
- policy-gated AI suggestion contracts and an OpenAI-compatible provider adapter path;
- a CLI for inspection, checks, fixture workflows, and machine-readable agent output;
- a Next.js documentation site whose canonical content remains plain Markdown.

Shipped means implemented and tested in this repository. It does not mean every package has reached a stable public release.

## Start Building

`@momentarise/*` packages are published to npm under the `alpha` dist-tag (`0.1.0-alpha.3`), not `latest`. This is a first experimental alpha for early feedback, not a stable release.

```bash
npm install @momentarise/md-editor@alpha @momentarise/md-save@alpha @momentarise/md-source-codemirror@alpha @momentarise/md-surface@alpha
```

To build the workspace from source instead:

```bash
git clone https://github.com/Nadrew-pgr/Momentarise-Markdown-Editor.git
cd Momentarise-Markdown-Editor
npm install
npm run build
npm test
```

## Integration Paths

| Need | Start here |
| --- | --- |
| Framework-free browser or custom shell | [Vanilla quickstart](docs/public/quickstart/vanilla.md) |
| React lifecycle binding | [React quickstart](docs/public/quickstart/react.md) |
| Next.js App Router client boundary | [Next.js quickstart](docs/public/quickstart/next.md) |
| Sessions and document orchestration without UI | [Headless quickstart](docs/public/quickstart/headless.md) |
| Local inspection, validation, and agent workflows | [CLI reference](docs/public/packages/md-cli.md) |
| Migration or architecture decision | [Choosing MME](docs/public/choosing-mme.md) |

Useful workspace commands:

```bash
npm run build
npm run build:demo
npm run build:docs-site
npm run test:docs
npm run test:agent-discovery
```

## Package Map

| Layer | Packages | Responsibility |
| --- | --- | --- |
| Model and services | `md-core`, `md-format`, `md-save`, `md-policy`, `md-ai` | Durable document contracts, preservation, persistence, policy, and AI suggestions |
| Headless engine | `md-editor` | Session state, events, modes, outline, find, preferences, and extensions |
| View engines | `md-source-codemirror`, `md-rich-prosemirror`, `md-render-html`, `md-preview-html` | Source, rich, rendered, and artifact views |
| UI | `md-theme`, `md-surface` | Tokens, icons, localization, toolbar, slash, status, and assistant surfaces |
| Binding | `md-react` | Thin React lifecycle integration |
| Host capabilities | `md-adapter-web`, `md-adapter-theia` | Browser file access and IDE-shell integration |
| Tooling | `md-cli` | Developer and coding-agent workflows |

All framework packages use the `@momentarise/` scope. Read the [package reference](docs/public/index.md#reference) and [compatibility promise](docs/public/compatibility-promise.md) before integrating.

## Core Guarantees

MME development is gated by:

- Markdown plus YAML frontmatter as canonical persisted source;
- zero-byte changes for untouched documents through derived views;
- bounded serialization that preserves bytes outside edited ownership;
- raw or opaque preservation instead of silent flattening;
- no full-document rewrite for a targeted rich edit;
- host-independent core packages;
- save state that names the real persistence target;
- sandboxing and sanitization for rendered artifacts;
- Document Access Policy before sensitive reads, writes, exports, or AI calls;
- real fixtures, focused tests, consumer builds, and browser proof where UI changes.

See [Document Model](docs/public/concepts/document-model.md), [Preservation](docs/public/concepts/preservation.md), and [Save Truthfulness](docs/public/concepts/save-truthfulness.md).

## Verified Evidence

Claims in this README map to executable repository gates:

```bash
npm run test:roundtrip
npm run test:rich-fidelity
npm run test:rich-targeted-serialization
npm run test:save-engine
npm run test:publishability
npm run test:public-api
npm run test:agent-discovery
```

Use [Compatibility Promise](docs/public/compatibility-promise.md) for release status, [package docs](docs/public/index.md#reference) for public API checkpoints, and [Agentic Experience](docs/public/concepts/agentic-experience.md) for discovery boundaries. Passing local gates proves repository behavior; it does not prove registry publication, production deployment, adoption, indexing, or citation.

## For Coding Agents

Use public source files instead of screenshots or inferred product claims:

1. Read this README for the repository-level overview.
2. Read [`llms.txt`](llms.txt) for the short public index.
3. Read [`llms-full.txt`](llms-full.txt) when complete public documentation context is required.
4. Read [`docs/agent/product.json`](docs/agent/product.json) for a machine-readable product/status profile.
5. Use [`docs/agent/manifest.json`](docs/agent/manifest.json) to discover reusable actions and skills.
6. Use [`docs/public/`](docs/public/) as the canonical public documentation source.
7. For repository changes, start with [`AGENTS.md`](AGENTS.md), which routes to the mandatory build protocol.

Stable web endpoints:

- `https://momentarise.dev/llms.txt`
- `https://momentarise.dev/llms-full.txt`
- `https://momentarise.dev/agent/README.md`
- `https://momentarise.dev/agent/product.json`
- `https://momentarise.dev/agent/manifest.json`
- `https://momentarise.dev/agent/actions.json`
- `https://momentarise.dev/agent/skills/<skill-id>/SKILL.md`
- `https://momentarise.dev/docs/<page>.md` for raw public Markdown

Generated agent artifacts are committed for inspection. They are not installed automatically into a global agent configuration.

## Status And Boundaries

MME is experimental `0.x` software. Public APIs are audited, but minor releases may still include breaking changes before `1.0`.

Do not assume these are shipped:

- a stable public package release;
- a shipped Payload CMS or other CMS integration;
- hosted Ask AI or semantic documentation search;
- production collaboration or CRDT;
- managed AI billing or browser-owned production secrets;
- automatic agent-skill installation;
- SaaS sync, desktop/mobile applications, or non-Markdown office-file round trips.

See the [public roadmap](docs/public/roadmap.md) for direction. Internal issue history and build evidence remain separate from public product documentation.

Public source structure can help agents retrieve and verify MME facts. It does not guarantee search indexing or citation by any model or service.

## Repository Structure

```text
packages/              Framework packages
apps/md-demo/          Reference editor demo
apps/react-demo/       Workspace-backed React host, used to prove the React binding renders
apps/docs-site/        Next.js public site and docs shell
docs/public/           Canonical publishable Markdown
docs/agent/            Generated public agent artifacts
docs/internal/         Private-by-default planning and build evidence
fixtures/              Preservation and behavior corpus
tests/                 Contract and regression gates
scripts/               Build, generation, benchmark, and visual proof tools
```

## License

- Framework packages and repository source: [MPL-2.0](LICENSE).
- Demos and examples under `apps/*` and `examples/*`: Apache-2.0.
- Third-party dependencies retain their own licenses.

See [Compatibility Promise](docs/public/compatibility-promise.md) for the release and licensing boundary.
