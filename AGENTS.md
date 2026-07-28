# Repository Instructions For Agents

`AGENT.md` is the canonical build protocol for this repository. Read it before modifying code, tests, generated artifacts, or documentation.

## Source Order

For repository work:

1. `AGENT.md`
2. `README.md`
3. the active normal issue and required internal quality files named by `AGENT.md`
4. the target implementation files

For public product answers:

1. `README.md`
2. `llms.txt` or `llms-full.txt`
3. `docs/public/`
4. `docs/agent/manifest.json`

## Boundaries

- Treat Markdown plus YAML frontmatter as durable source.
- Treat rich views, HTML, and AI prompts as derived layers.
- Preserve unknown syntax and untouched bytes.
- Do not describe roadmap work as shipped.
- Do not publish `docs/internal/` as product documentation.
- Do not bypass the issue, test, reviewer, build-log, or issue-scoped commit gates in `AGENT.md`.
- Generated files must be changed through their generators and verified for drift.
