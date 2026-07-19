---
name: mme-ai-privacy-boundary
description: "Use when reviewing AI writing, BYOK, provider adapters, policy checks, prompt sharing, or privacy boundaries for Momentarise Markdown Editor."
---

# Mme Ai Privacy Boundary

Apply policy before AI.

Read:
- `docs/public/concepts/ai-privacy.md`
- `docs/public/concepts/policy.md`
- `docs/public/packages/md-ai.md`
- `docs/public/packages/md-policy.md`
- `llms.txt` for the public docs index
- `llms-full.txt` for current public context

Rules:
- AI writing is assistive and staged.
- Prompts are transport, not persistence.
- BYOK/provider credentials are host-owned and must not be logged.
- Do not claim hosted Ask AI, semantic search, managed billing, or long-running agents as shipped.
- Do not expose private repo docs or local secrets in copied prompts.
