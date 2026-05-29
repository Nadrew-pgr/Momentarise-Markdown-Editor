# Release Planning Note

---
owner: docs-team
status: review
---

## Summary

We need source mode, parser preservation, and a truthful Save Engine before rich mode.

> [!WARNING] Gate reminder
> Do not ship a pretty editor that corrupts Markdown.

| Area | Risk | Mitigation |
| -- | -- | -- |
| Parser | unknown syntax | opaque nodes |
| Save | false status | target labels |

```mermaid
sequenceDiagram
  participant User
  participant Editor
  User->>Editor: Edit Markdown
  Editor-->>User: Honest save state
```

Related: [[Save Engine]], [Quality Gates](../docs/internal/QUALITY_GATES.md)

<div data-preview="safe">HTML artifact placeholder</div>

Final note with $a^2 + b^2 = c^2$.
