# Momentarise Markdown Editor

Momentarise Markdown Editor (MME) is an experimental TypeScript framework for building modern document editors where Markdown remains the durable source.

It combines source editing, rich editing, safe rendering, truthful persistence, extensible UI, and policy-gated AI without replacing user files with a hidden JSON or block database.

- **Docs:** [momentarise.dev/docs](https://momentarise.dev/docs)
- **Agent index:** [llms.txt](https://momentarise.dev/llms.txt)
- **Full public context:** [llms-full.txt](https://momentarise.dev/llms-full.txt)
- **Source:** [GitHub](https://github.com/Nadrew-pgr/Momentarise-Markdown-Editor)

## Why MME

Most rich-text frameworks make an editor-owned model the real document and treat Markdown as import/export. MME takes the opposite position:

> Markdown remains the durable source. Rich views, HTML, AI suggestions, and host integrations are derived layers.

That gives developers a reusable editor foundation while keeping documents portable, inspectable, diffable, and recoverable outside the host application.

Use MME when you need:

- real `.md` files plus optional YAML frontmatter;
- CodeMirror 6 source editing and a ProseMirror rich view;
- exact untouched round trips and bounded edits;
- raw fallback for unknown or unsupported syntax;
- explicit disk, download, memory, dirty, saved, conflict, and error states;
- framework-free surfaces, React and Next.js integration, or a headless session;
- sanitized Markdown rendering and sandboxed HTML artifacts;
- staged, policy-gated AI writing with host-owned credentials;
- host adapters that do not leak into core document contracts.

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

Public npm artifacts are **not published yet**. The commands below build the current workspace; consumer installation snippets document the intended package interface and are validated against packed workspace tarballs.

```bash
git clone https://github.com/Nadrew-pgr/Momentarise-Markdown-Editor.git
cd Momentarise-Markdown-Editor
npm install
npm run build
npm test
```

Choose the integration path:

- [Vanilla](docs/public/quickstart/vanilla.md): framework-free browser and custom-shell integration.
- [React](docs/public/quickstart/react.md): thin lifecycle binding around MME sessions and views.
- [Next.js](docs/public/quickstart/next.md): client-boundary integration for App Router hosts.
- [Headless](docs/public/quickstart/headless.md): document orchestration without rendered UI.
- [CLI](docs/public/packages/md-cli.md): local checks, inspection, formatting, and agent workflows.

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

## For Coding Agents

Use public source files instead of screenshots or inferred product claims:

1. Read this README for the repository-level overview.
2. Read [`llms.txt`](llms.txt) for the short public index.
3. Read [`llms-full.txt`](llms-full.txt) when complete public documentation context is required.
4. Use [`docs/agent/manifest.json`](docs/agent/manifest.json) to discover reusable actions and skills.
5. Use [`docs/public/`](docs/public/) as the canonical public documentation source.
6. For repository changes, start with [`AGENTS.md`](AGENTS.md), which routes to the mandatory build protocol.

Stable web endpoints:

- `https://momentarise.dev/llms.txt`
- `https://momentarise.dev/llms-full.txt`
- `https://momentarise.dev/agent/README.md`
- `https://momentarise.dev/agent/manifest.json`
- `https://momentarise.dev/agent/actions.json`
- `https://momentarise.dev/agent/skills/<skill-id>/SKILL.md`
- `https://momentarise.dev/docs/<page>.md` for raw public Markdown

Generated agent artifacts are committed for inspection. They are not installed automatically into a global agent configuration.

## Status And Boundaries

MME is experimental `0.x` software. Public APIs are audited, but minor releases may still include breaking changes before `1.0`.

Do not assume these are shipped:

- a stable public package release;
- a shipped CMS integration;
- hosted Ask AI or semantic documentation search;
- production collaboration or CRDT;
- managed AI billing or browser-owned production secrets;
- automatic agent-skill installation;
- SaaS sync, desktop/mobile applications, or non-Markdown office-file round trips.

See the [public roadmap](docs/public/roadmap.md) for direction. Internal issue history and build evidence remain separate from public product documentation.

## Repository Structure

```text
packages/              Framework packages
apps/md-demo/          Reference editor demo
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
