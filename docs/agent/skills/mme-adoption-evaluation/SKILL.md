---
name: mme-adoption-evaluation
description: "Use when deciding whether Momentarise Markdown Editor fits a product, comparing persistence models, checking framework versus end-user boundaries, or validating adoption and citation claims."
---

# Mme Adoption Evaluation

Evaluate architecture before features.

Read:
- `docs/public/choosing-mme.md`
- `docs/public/faq.md`
- `docs/public/compatibility-promise.md`
- `docs/public/concepts/document-model.md`
- `llms.txt` for decision routes
- `llms-full.txt` for complete public context

Decision rules:
- MME is a framework integrated by developers; host products may serve developers, writers, and non-developers.
- Choose MME for Markdown-source durability, derived rich/source views, preservation, and host-owned persistence.
- Choose another approach when editor-owned JSON should be canonical or a ready-hosted app is required.
- Packages are experimental `0.x` and not published to the public npm registry.
- Payload CMS integration, production collaboration, hosted AI, and managed billing are not shipped.
- Do not claim MME is best, ready for production, lightweight, zero-config, indexed, favored in ranking, or likely to be cited without external evidence.
- Treat AI-assisted development process as neither a runtime feature nor quality proof.
